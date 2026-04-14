const express = require('express');
const router = express.Router();
const { query } = require('../config/db');
const { authenticate, authorize, canAccessReport } = require('../middleware/auth');
const { upload } = require('../config/cloudinary');
const {
  generateTrackingId, calculatePriority, autoAssignDepartment,
  calculateSLADeadline, createNotification, addTimeline,
  checkDuplicates, paginate, computeFileHash
} = require('../utils/helpers');
const crypto = require('crypto');

// GET /api/reports - Reporter's own reports (or authority's dept reports)
router.get('/', authenticate, async (req, res) => {
  try {
    const { page = 1, limit = 10, status, category_id, priority, search } = req.query;
    const { offset, limit: lim } = paginate(page, limit);
    const user = req.user;

    let whereClause = '';
    let params = [];
    let paramIdx = 1;

    if (user.role === 'reporter') {
      whereClause = `WHERE r.reporter_id = $${paramIdx++}`;
      params.push(user.id);
    } else if (user.role === 'authority') {
      const profileResult = await query(
        'SELECT department_id FROM authority_profiles WHERE user_id = $1',
        [user.id]
      );
      const deptId = profileResult.rows[0]?.department_id;
      if (!deptId) return res.json({ success: true, data: { reports: [], total: 0 } });
      whereClause = `WHERE r.assigned_department_id = $${paramIdx++} AND r.is_draft = false`;
      params.push(deptId);
    } else if (user.role === 'admin') {
      whereClause = 'WHERE 1=1';
    }

    if (status) {
      whereClause += ` AND r.status = $${paramIdx++}`;
      params.push(status);
    }
    if (category_id) {
      whereClause += ` AND r.category_id = $${paramIdx++}`;
      params.push(category_id);
    }
    if (priority) {
      whereClause += ` AND r.priority = $${paramIdx++}`;
      params.push(priority);
    }
    if (search) {
      whereClause += ` AND (r.title ILIKE $${paramIdx} OR r.tracking_id ILIKE $${paramIdx})`;
      params.push(`%${search}%`);
      paramIdx++;
    }

    // Hide draft reports from authorities/admin in listing unless admin
    if (user.role === 'authority') {
      whereClause += ' AND r.is_draft = false';
    }

    const countResult = await query(
      `SELECT COUNT(*) FROM reports r ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    const result = await query(
      `SELECT r.*, c.name AS category_name, c.icon AS category_icon,
              d.name AS department_name,
              CASE WHEN r.is_anonymous THEN NULL ELSE u.name END AS reporter_name,
              CASE WHEN r.is_anonymous THEN NULL ELSE u.email END AS reporter_email,
              (SELECT COUNT(*) FROM evidence WHERE report_id = r.id) AS evidence_count,
              (SELECT COUNT(*) FROM comments WHERE report_id = r.id AND is_deleted = false) AS comment_count
       FROM reports r
       LEFT JOIN categories c ON r.category_id = c.id
       LEFT JOIN departments d ON r.assigned_department_id = d.id
       LEFT JOIN users u ON r.reporter_id = u.id
       ${whereClause}
       ORDER BY r.created_at DESC
       LIMIT $${paramIdx++} OFFSET $${paramIdx++}`,
      [...params, lim, offset]
    );

    res.json({
      success: true,
      data: {
        reports: result.rows,
        total,
        page: parseInt(page),
        limit: lim,
        totalPages: Math.ceil(total / lim),
      }
    });
  } catch (error) {
    console.error('Get reports error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch reports.' });
  }
});

// POST /api/reports - Create new report (draft or submit)
router.post('/', authenticate, authorize('reporter'), async (req, res) => {
  try {
    const {
      title, description, category_id, is_anonymous = false,
      location_text, latitude, longitude, incident_date,
      is_draft = true
    } = req.body;

    if (!title) {
      return res.status(400).json({ success: false, message: 'Title is required.' });
    }

    const trackingId = generateTrackingId();
    let priority = 'medium';
    let assignedDeptId = null;
    let slaDeadline = null;

    if (!is_draft) {
      if (!description || !category_id) {
        return res.status(400).json({ success: false, message: 'Description and category are required for submission.' });
      }
      priority = await calculatePriority(category_id, title, description);
      assignedDeptId = await autoAssignDepartment(category_id);
      slaDeadline = await calculateSLADeadline(category_id, priority);
    }

    const status = is_draft ? 'draft' : 'submitted';

    const result = await query(
      `INSERT INTO reports (
        tracking_id, title, description, category_id, reporter_id,
        is_anonymous, location_text, latitude, longitude, incident_date,
        status, priority, assigned_department_id, is_draft, sla_deadline, submitted_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
      RETURNING *`,
      [
        trackingId, title, description || '', category_id || null, req.user.id,
        is_anonymous, location_text || null, latitude || null, longitude || null,
        incident_date || null, status, priority, assignedDeptId, is_draft,
        slaDeadline, is_draft ? null : new Date()
      ]
    );

    const report = result.rows[0];

    if (!is_draft) {
      await addTimeline(report.id, 'Report Submitted', req.user.id, 'reporter', 'Report submitted for review');

      // Check for duplicates
      const duplicates = await checkDuplicates(report.id, title, description || '', category_id);
      if (duplicates.length > 0) {
        const topDup = duplicates[0];
        await query(
          'UPDATE reports SET duplicate_of = $1, similarity_score = $2 WHERE id = $3',
          [topDup.id, topDup.score, report.id]
        );
        for (const dup of duplicates) {
          await query(
            'INSERT INTO duplicate_checks (report_id, potential_duplicate_id, similarity_score) VALUES ($1, $2, $3)',
            [report.id, dup.id, dup.score]
          );
        }
      }

      // Notify assigned department authority if exists
      if (assignedDeptId) {
        const authUsers = await query(
          `SELECT u.id FROM users u
           JOIN authority_profiles ap ON u.id = ap.user_id
           WHERE ap.department_id = $1 AND ap.is_verified = true`,
          [assignedDeptId]
        );
        for (const authUser of authUsers.rows) {
          await createNotification(
            authUser.id,
            'New Report Assigned',
            `A new ${priority} priority report has been assigned to your department: "${title}"`,
            'assignment',
            report.id
          );
        }
      }
    } else {
      await addTimeline(report.id, 'Draft Created', req.user.id, 'reporter', 'Report saved as draft');
    }

    res.status(201).json({
      success: true,
      message: is_draft ? 'Draft saved successfully.' : 'Report submitted successfully.',
      data: { report }
    });
  } catch (error) {
    console.error('Create report error:', error);
    res.status(500).json({ success: false, message: 'Failed to create report.' });
  }
});

// GET /api/reports/:id - Get single report
router.get('/:id', authenticate, canAccessReport, async (req, res) => {
  try {
    const report = req.report;

    // Increment view count
    await query('UPDATE reports SET view_count = view_count + 1 WHERE id = $1', [report.id]);

    // Fetch full details
    const fullReport = await query(
      `SELECT r.*,
              c.name AS category_name, c.icon AS category_icon, c.description AS category_description,
              d.name AS department_name, d.icon AS department_icon, d.contact_email AS dept_email,
              CASE WHEN r.is_anonymous AND $2 = 'authority' THEN 'Anonymous Reporter'
                   WHEN r.is_anonymous AND $2 = 'reporter' THEN u.name
                   ELSE u.name END AS reporter_name,
              CASE WHEN r.is_anonymous AND $2 = 'authority' THEN NULL ELSE u.email END AS reporter_email,
              u.phone AS reporter_phone,
              aa.name AS assigned_authority_name
       FROM reports r
       LEFT JOIN categories c ON r.category_id = c.id
       LEFT JOIN departments d ON r.assigned_department_id = d.id
       LEFT JOIN users u ON r.reporter_id = u.id
       LEFT JOIN users aa ON r.assigned_authority_id = aa.id
       WHERE r.id = $1`,
      [report.id, req.user.role]
    );

    const evidence = await query(
      'SELECT * FROM evidence WHERE report_id = $1 ORDER BY uploaded_at DESC',
      [report.id]
    );

    const timeline = await query(
      `SELECT rt.*, u.name AS actor_name, u.role AS actor_role
       FROM report_timeline rt
       LEFT JOIN users u ON rt.actor_id = u.id
       WHERE rt.report_id = $1
       ORDER BY rt.created_at ASC`,
      [report.id]
    );

    const reopenRequests = await query(
      `SELECT rr.*, u.name AS reporter_name, da.name AS decided_by_name
       FROM reopen_requests rr
       LEFT JOIN users u ON rr.reporter_id = u.id
       LEFT JOIN users da ON rr.decided_by = da.id
       WHERE rr.report_id = $1
       ORDER BY rr.requested_at DESC`,
      [report.id]
    );

    res.json({
      success: true,
      data: {
        report: fullReport.rows[0],
        evidence: evidence.rows,
        timeline: timeline.rows,
        reopenRequests: reopenRequests.rows,
      }
    });
  } catch (error) {
    console.error('Get report error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch report.' });
  }
});

// PUT /api/reports/:id - Update report (draft editing)
router.put('/:id', authenticate, authorize('reporter'), async (req, res) => {
  try {
    const { id } = req.params;
    const report = await query('SELECT * FROM reports WHERE id = $1 AND reporter_id = $2', [id, req.user.id]);

    if (!report.rows[0]) {
      return res.status(404).json({ success: false, message: 'Report not found.' });
    }

    if (!report.rows[0].is_draft) {
      return res.status(400).json({ success: false, message: 'Only draft reports can be edited.' });
    }

    const { title, description, category_id, is_anonymous, location_text, latitude, longitude, incident_date } = req.body;

    const result = await query(
      `UPDATE reports SET
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        category_id = COALESCE($3, category_id),
        is_anonymous = COALESCE($4, is_anonymous),
        location_text = COALESCE($5, location_text),
        latitude = COALESCE($6, latitude),
        longitude = COALESCE($7, longitude),
        incident_date = COALESCE($8, incident_date),
        updated_at = NOW()
       WHERE id = $9 RETURNING *`,
      [title, description, category_id, is_anonymous, location_text, latitude, longitude, incident_date, id]
    );

    await addTimeline(id, 'Draft Updated', req.user.id, 'reporter', 'Report draft was updated');

    res.json({ success: true, data: { report: result.rows[0] } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update report.' });
  }
});

// POST /api/reports/:id/submit - Submit a draft
router.post('/:id/submit', authenticate, authorize('reporter'), async (req, res) => {
  try {
    const { id } = req.params;
    const reportResult = await query('SELECT * FROM reports WHERE id = $1 AND reporter_id = $2', [id, req.user.id]);

    if (!reportResult.rows[0]) {
      return res.status(404).json({ success: false, message: 'Report not found.' });
    }

    const report = reportResult.rows[0];
    if (!report.is_draft) {
      return res.status(400).json({ success: false, message: 'Report already submitted.' });
    }

    if (!report.description || !report.category_id) {
      return res.status(400).json({ success: false, message: 'Description and category are required.' });
    }

    const priority = await calculatePriority(report.category_id, report.title, report.description);
    const assignedDeptId = await autoAssignDepartment(report.category_id);
    const slaDeadline = await calculateSLADeadline(report.category_id, priority);

    const result = await query(
      `UPDATE reports SET is_draft = false, status = 'submitted', priority = $1,
       assigned_department_id = $2, sla_deadline = $3, submitted_at = NOW(), updated_at = NOW()
       WHERE id = $4 RETURNING *`,
      [priority, assignedDeptId, slaDeadline, id]
    );

    await addTimeline(id, 'Report Submitted', req.user.id, 'reporter', 'Draft submitted for review');

    const duplicates = await checkDuplicates(id, report.title, report.description, report.category_id);
    if (duplicates.length > 0) {
      await query('UPDATE reports SET duplicate_of = $1, similarity_score = $2 WHERE id = $3',
        [duplicates[0].id, duplicates[0].score, id]);
    }

    res.json({
      success: true,
      message: 'Report submitted successfully.',
      data: { report: result.rows[0] }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to submit report.' });
  }
});

// PUT /api/reports/:id/status - Update report status (authority/admin)
router.put('/:id/status', authenticate, authorize('authority', 'admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    const validStatuses = ['under_review', 'investigating', 'resolved', 'closed'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status.' });
    }

    const reportResult = await query('SELECT * FROM reports WHERE id = $1', [id]);
    if (!reportResult.rows[0]) {
      return res.status(404).json({ success: false, message: 'Report not found.' });
    }

    const report = reportResult.rows[0];
    const oldStatus = report.status;

    // Check authority has access to this report's department
    if (req.user.role === 'authority') {
      const profile = await query('SELECT department_id FROM authority_profiles WHERE user_id = $1', [req.user.id]);
      if (!profile.rows[0] || profile.rows[0].department_id !== report.assigned_department_id) {
        return res.status(403).json({ success: false, message: 'Not authorized for this department.' });
      }
    }

    const updateFields = { status, updated_at: new Date() };
    if (status === 'resolved') updateFields.resolved_at = new Date();
    if (status === 'closed') updateFields.closed_at = new Date();

    await query(
      `UPDATE reports SET status = $1, resolved_at = CASE WHEN $1 = 'resolved' THEN NOW() ELSE resolved_at END,
       closed_at = CASE WHEN $1 = 'closed' THEN NOW() ELSE closed_at END, updated_at = NOW()
       WHERE id = $2`,
      [status, id]
    );

    await addTimeline(id, `Status Changed to ${status.replace('_', ' ').toUpperCase()}`,
      req.user.id, req.user.role, notes, oldStatus, status);

    // Notify reporter
    if (report.reporter_id) {
      await createNotification(
        report.reporter_id,
        'Report Status Updated',
        `Your report "${report.title}" (${report.tracking_id}) status changed to: ${status.replace('_', ' ')}. ${notes || ''}`,
        'status_change',
        id
      );
    }

    res.json({ success: true, message: `Status updated to ${status}.` });
  } catch (error) {
    console.error('Update status error:', error);
    res.status(500).json({ success: false, message: 'Failed to update status.' });
  }
});

// PUT /api/reports/:id/assign - Reassign department (authority/admin)
router.put('/:id/assign', authenticate, authorize('authority', 'admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { department_id, authority_id, notes } = req.body;

    const reportResult = await query('SELECT * FROM reports WHERE id = $1', [id]);
    if (!reportResult.rows[0]) {
      return res.status(404).json({ success: false, message: 'Report not found.' });
    }

    const report = reportResult.rows[0];

    await query(
      `UPDATE reports SET assigned_department_id = COALESCE($1, assigned_department_id),
       assigned_authority_id = COALESCE($2, assigned_authority_id), updated_at = NOW()
       WHERE id = $3`,
      [department_id, authority_id, id]
    );

    const actionNote = department_id ? `Transferred to new department` : 'Authority assigned';
    await addTimeline(id, 'Assignment Updated', req.user.id, req.user.role, notes || actionNote,
      report.assigned_department_id, department_id);

    // Notify reporter
    if (report.reporter_id) {
      await createNotification(
        report.reporter_id,
        'Report Reassigned',
        `Your report has been transferred to another department for better handling.`,
        'assignment',
        id
      );
    }

    res.json({ success: true, message: 'Assignment updated.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update assignment.' });
  }
});

// POST /api/reports/:id/evidence - Upload evidence
router.post('/:id/evidence', authenticate, authorize('reporter', 'authority', 'admin'), upload.array('files', 10), async (req, res) => {
  try {
    const { id } = req.params;
    const reportResult = await query('SELECT * FROM reports WHERE id = $1', [id]);
    if (!reportResult.rows[0]) {
      return res.status(404).json({ success: false, message: 'Report not found.' });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: 'No files uploaded.' });
    }

    const uploadedEvidence = [];
    for (const file of req.files) {
      const verificationHash = crypto.createHash('sha256')
        .update(file.originalname + file.size + Date.now())
        .digest('hex');

      const result = await query(
        `INSERT INTO evidence (report_id, file_url, file_name, file_type, file_size, public_id, uploaded_by, verification_hash)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [id, file.path, file.originalname, file.mimetype, file.size,
         file.filename || file.public_id, req.user.id, verificationHash]
      );
      uploadedEvidence.push(result.rows[0]);
    }

    await addTimeline(id, `${req.files.length} Evidence File(s) Uploaded`, req.user.id, req.user.role);

    res.status(201).json({ success: true, message: 'Evidence uploaded.', data: { evidence: uploadedEvidence } });
  } catch (error) {
    console.error('Upload evidence error:', error);
    res.status(500).json({ success: false, message: 'Failed to upload evidence.' });
  }
});

// POST /api/reports/:id/reopen - Request reopen
router.post('/:id/reopen', authenticate, authorize('reporter'), async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({ success: false, message: 'Reason is required.' });
    }

    const reportResult = await query(
      'SELECT * FROM reports WHERE id = $1 AND reporter_id = $2',
      [id, req.user.id]
    );
    if (!reportResult.rows[0]) {
      return res.status(404).json({ success: false, message: 'Report not found.' });
    }

    const report = reportResult.rows[0];
    if (report.status !== 'closed' && report.status !== 'resolved') {
      return res.status(400).json({ success: false, message: 'Only closed or resolved reports can be reopened.' });
    }

    // Check attempt limit (max 3)
    const attempts = await query(
      'SELECT COUNT(*) FROM reopen_requests WHERE report_id = $1',
      [id]
    );
    if (parseInt(attempts.rows[0].count) >= 3) {
      return res.status(400).json({ success: false, message: 'Maximum reopen attempts (3) reached.' });
    }

    const attemptNumber = parseInt(attempts.rows[0].count) + 1;

    const result = await query(
      `INSERT INTO reopen_requests (report_id, reporter_id, reason, attempt_number)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [id, req.user.id, reason, attemptNumber]
    );

    await addTimeline(id, 'Reopen Requested', req.user.id, 'reporter', reason);

    // Notify authority
    if (report.assigned_department_id) {
      const authorities = await query(
        `SELECT u.id FROM users u JOIN authority_profiles ap ON u.id = ap.user_id
         WHERE ap.department_id = $1 AND ap.is_verified = true`,
        [report.assigned_department_id]
      );
      for (const auth of authorities.rows) {
        await createNotification(
          auth.id,
          'Reopen Request Received',
          `Reporter has requested to reopen report "${report.title}". Reason: ${reason}`,
          'reopen_decision',
          id
        );
      }
    }

    res.status(201).json({ success: true, message: 'Reopen request submitted.', data: { request: result.rows[0] } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to submit reopen request.' });
  }
});

// PUT /api/reports/:id/reopen/:requestId - Decide on reopen request (authority/admin)
router.put('/:id/reopen/:requestId', authenticate, authorize('authority', 'admin'), async (req, res) => {
  try {
    const { id, requestId } = req.params;
    const { decision, response } = req.body;

    if (!['approved', 'denied'].includes(decision)) {
      return res.status(400).json({ success: false, message: 'Decision must be approved or denied.' });
    }

    const reqResult = await query('SELECT * FROM reopen_requests WHERE id = $1 AND report_id = $2', [requestId, id]);
    if (!reqResult.rows[0]) {
      return res.status(404).json({ success: false, message: 'Reopen request not found.' });
    }

    await query(
      `UPDATE reopen_requests SET status = $1, authority_response = $2, decided_by = $3, decided_at = NOW()
       WHERE id = $4`,
      [decision, response, req.user.id, requestId]
    );

    if (decision === 'approved') {
      await query(
        `UPDATE reports SET status = 'investigating', updated_at = NOW() WHERE id = $1`,
        [id]
      );
      await addTimeline(id, 'Report Reopened', req.user.id, req.user.role, response);
    } else {
      await addTimeline(id, 'Reopen Request Denied', req.user.id, req.user.role, response);
    }

    const reportResult = await query('SELECT reporter_id, title FROM reports WHERE id = $1', [id]);
    const report = reportResult.rows[0];

    if (report.reporter_id) {
      await createNotification(
        report.reporter_id,
        `Reopen Request ${decision.charAt(0).toUpperCase() + decision.slice(1)}`,
        `Your request to reopen "${report.title}" has been ${decision}. ${response || ''}`,
        'reopen_decision',
        id
      );
    }

    res.json({ success: true, message: `Reopen request ${decision}.` });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to process reopen request.' });
  }
});

module.exports = router;
