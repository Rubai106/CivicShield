const express = require('express');
const path = require('path');
const router = express.Router();
const { query, pool } = require('../config/db');
const { authenticate, authorize, canAccessReport } = require('../middleware/auth');
const { upload, processUploadedFiles } = require('../config/cloudinary');
const { generateTrackingId, autoAssignDepartment, paginate, createNotification } = require('../utils/helpers');

// ── GET all reports (role-filtered) ──────────────────────────────────────────
router.get('/', authenticate, async (req, res) => {
  try {
    const { page = 1, limit = 10, category_id, search, status } = req.query;
    const { offset, limit: lim } = paginate(page, limit);
    const user = req.user;
    const params = [];
    let where = '';

    if (user.role === 'reporter') {
      where = `WHERE r.reporter_id = $1`;
      params.push(user.id);
    } else if (user.role === 'authority') {
      where = `WHERE r.is_draft = false`;
    } else {
      where = 'WHERE 1=1';
    }

    let idx = params.length + 1;
    if (category_id) { where += ` AND r.category_id = $${idx++}`; params.push(category_id); }
    if (status)      { where += ` AND r.status = $${idx++}`;      params.push(status); }
    if (search) {
      where += ` AND (r.title ILIKE $${idx} OR r.tracking_id ILIKE $${idx})`;
      params.push(`%${search}%`);
      idx++;
    }

    const totalResult = await query(`SELECT COUNT(*) FROM reports r ${where}`, params);
    const total = parseInt(totalResult.rows[0].count, 10);

    const result = await query(
      `SELECT r.id, r.tracking_id, r.title, r.status, r.is_draft, r.priority,
              r.incident_date, r.location_text, r.created_at, r.submitted_at,
              r.reporter_id, r.is_anonymous,
              c.name AS category_name,
              d.name AS department_name,
              CASE WHEN $${params.length + 1} = 'authority' AND r.is_anonymous THEN 'Anonymous'
                   ELSE u.name END AS reporter_name,
              (SELECT COUNT(*) FROM evidence e WHERE e.report_id = r.id) AS evidence_count
       FROM reports r
       LEFT JOIN categories c ON c.id = r.category_id
       LEFT JOIN departments d ON d.id = r.assigned_department_id
       LEFT JOIN users u ON u.id = r.reporter_id
       ${where}
       ORDER BY r.created_at DESC
       LIMIT $${params.length + 2} OFFSET $${params.length + 3}`,
      [...params, user.role, lim, offset]
    );

    return res.json({
      success: true,
      data: { reports: result.rows, total, page: parseInt(page), limit: lim, totalPages: Math.ceil(total / lim) },
    });
  } catch (error) {
    console.error('Get reports error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch reports.' });
  }
});

// ── POST create report ────────────────────────────────────────────────────────
router.post('/', authenticate, authorize('reporter'), upload.any(), processUploadedFiles, async (req, res) => {
  try {
    const {
      title = '', description = '', category_id,
      is_anonymous = 'false', incident_date,
      location_text, location_lat, location_lng,
      is_draft = 'false',
    } = req.body;

    const isDraft = String(is_draft) === 'true';

    if (!isDraft && (!title.trim() || !description.trim() || !category_id)) {
      return res.status(400).json({ success: false, message: 'Title, description, and category are required.' });
    }

    const isAnon = String(is_anonymous) === 'true';
    const trackingId = generateTrackingId();
    const deptResult = await autoAssignDepartment(category_id);
    const assignedDeptId = deptResult?.departmentId || null;

    const created = await query(
      `INSERT INTO reports (
        tracking_id, title, description, category_id, reporter_id,
        is_anonymous, incident_date, location_text, location_lat, location_lng,
        status, is_draft, assigned_department_id, submitted_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      RETURNING *`,
      [
        trackingId, title, description, category_id || null, req.user.id,
        isAnon, incident_date || null, location_text || null,
        location_lat || null, location_lng || null,
        isDraft ? 'Draft' : 'Submitted', isDraft,
        assignedDeptId, isDraft ? null : new Date(),
      ]
    );

    const report = created.rows[0];

    // Record initial status in history
    await query(
      `INSERT INTO report_status_history (report_id, from_status, to_status, changed_by)
       VALUES ($1, NULL, $2, $3)`,
      [report.id, report.status, req.user.id]
    ).catch(() => {}); // non-fatal if table doesn't exist yet

    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const isUrl = typeof file.path === 'string' && file.path.startsWith('http');
        const fileUrl = isUrl
          ? file.path
          : `${req.protocol}://${req.get('host')}/uploads/${file.filename || path.basename(file.path)}`;
        await query(
          `INSERT INTO evidence (report_id, file_url, file_name, file_type, file_size, public_id, hash_sha256)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [report.id, fileUrl, file.originalname, file.mimetype, file.size, file.filename || file.public_id || null, file.sha256 || null]
        );
      }
    }

    return res.status(201).json({
      success: true,
      message: isDraft ? 'Draft saved.' : 'Report submitted successfully.',
      data: { report },
    });
  } catch (error) {
    console.error('Create report error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create report.' });
  }
});

// ── GET single report ─────────────────────────────────────────────────────────
router.get('/:id', authenticate, canAccessReport, async (req, res) => {
  try {
    const full = await query(
      `SELECT r.*,
              c.name AS category_name,
              d.name AS department_name,
              CASE WHEN r.is_anonymous AND $2 = 'authority' THEN 'Anonymous'
                   ELSE u.name END AS reporter_name,
              CASE WHEN r.is_anonymous AND $2 = 'authority' THEN NULL
                   ELSE u.email END AS reporter_email
       FROM reports r
       LEFT JOIN categories c ON c.id = r.category_id
       LEFT JOIN departments d ON d.id = r.assigned_department_id
       LEFT JOIN users u ON u.id = r.reporter_id
       WHERE r.id = $1`,
      [req.params.id, req.user.role]
    );

    if (!full.rows[0]) return res.status(404).json({ success: false, message: 'Report not found.' });

    const evidence = await query(
      'SELECT * FROM evidence WHERE report_id = $1 ORDER BY uploaded_at DESC',
      [req.params.id]
    );

    const history = await query(
      `SELECT rsh.*, u.name AS changed_by_name
       FROM report_status_history rsh
       LEFT JOIN users u ON u.id = rsh.changed_by
       WHERE rsh.report_id = $1 ORDER BY rsh.created_at ASC`,
      [req.params.id]
    ).catch(() => ({ rows: [] }));

    return res.json({ success: true, data: { report: full.rows[0], evidence: evidence.rows, history: history.rows } });
  } catch (error) {
    console.error('Get report error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch report.' });
  }
});

// ── PUT update report (edit/resubmit draft) ───────────────────────────────────
router.put('/:id', authenticate, authorize('reporter'), upload.any(), processUploadedFiles, async (req, res) => {
  try {
    const {
      title = '', description = '', category_id,
      is_anonymous = 'false', incident_date,
      location_text, location_lat, location_lng,
      is_draft = 'false', existing_file_ids = '[]',
    } = req.body;

    const isDraft = String(is_draft) === 'true';
    const isAnon = String(is_anonymous) === 'true';
    const existingFileIds = JSON.parse(existing_file_ids);

    const reportCheck = await query(
      'SELECT * FROM reports WHERE id = $1 AND reporter_id = $2',
      [req.params.id, req.user.id]
    );
    if (!reportCheck.rows[0]) return res.status(404).json({ success: false, message: 'Report not found.' });

    if (!isDraft && (!title.trim() || !description.trim() || !category_id)) {
      return res.status(400).json({ success: false, message: 'Title, description, and category are required.' });
    }

    const deptResult = await autoAssignDepartment(category_id);
    const assignedDeptId = deptResult?.departmentId || null;
    const submittedAt = isDraft ? null : (reportCheck.rows[0].submitted_at || new Date());

    const updated = await query(
      `UPDATE reports SET
        title=$1, description=$2, category_id=$3, is_anonymous=$4,
        incident_date=$5, location_text=$6, location_lat=$7, location_lng=$8,
        status=$9, is_draft=$10, assigned_department_id=$11, submitted_at=$12,
        updated_at=NOW()
       WHERE id=$13 AND reporter_id=$14 RETURNING *`,
      [
        title, description, category_id || null, isAnon,
        incident_date || null, location_text || null, location_lat || null, location_lng || null,
        isDraft ? 'Draft' : 'Submitted', isDraft,
        assignedDeptId, submittedAt,
        req.params.id, req.user.id,
      ]
    );

    const report = updated.rows[0];

    // Clean up removed files
    if (existingFileIds.length > 0) {
      await query(
        `DELETE FROM evidence WHERE report_id = $1 AND id NOT IN (${existingFileIds.map((_, i) => `$${i + 2}`).join(',')})`,
        [req.params.id, ...existingFileIds]
      );
    } else {
      await query('DELETE FROM evidence WHERE report_id = $1', [req.params.id]);
    }

    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const isUrl = typeof file.path === 'string' && file.path.startsWith('http');
        const fileUrl = isUrl
          ? file.path
          : `${req.protocol}://${req.get('host')}/uploads/${file.filename || path.basename(file.path)}`;
        await query(
          `INSERT INTO evidence (report_id, file_url, file_name, file_type, file_size, public_id, hash_sha256)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [report.id, fileUrl, file.originalname, file.mimetype, file.size, file.filename || null, file.sha256 || null]
        );
      }
    }

    return res.json({
      success: true,
      message: isDraft ? 'Draft updated.' : 'Report submitted successfully.',
      data: { report },
    });
  } catch (error) {
    console.error('Update report error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update report.' });
  }
});

// ── PATCH status (authority) ──────────────────────────────────────────────────
router.patch('/:id/status', authenticate, authorize('authority', 'admin'), async (req, res) => {
  try {
    const { status, note } = req.body;
    const validStatuses = ['Submitted', 'Under Review', 'Investigating', 'Resolved', 'Closed'];

    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value.' });
    }

    const reportResult = await query('SELECT status FROM reports WHERE id = $1', [req.params.id]);
    if (!reportResult.rows[0]) return res.status(404).json({ success: false, message: 'Report not found.' });

    const currentStatus = reportResult.rows[0].status;
    // Normalize status to title-case to handle legacy lowercase values in DB
    const STATUS_NORMALIZE = {
      'submitted': 'Submitted', 'under review': 'Under Review',
      'investigating': 'Investigating', 'resolved': 'Resolved',
      'closed': 'Closed', 'draft': 'Draft',
    };
    const normalizedCurrent = STATUS_NORMALIZE[currentStatus?.toLowerCase()] || currentStatus;
    const validTransitions = {
      'Submitted': ['Under Review'],
      'Under Review': ['Investigating'],
      'Investigating': ['Resolved'],
      'Resolved': ['Closed'],
      'Closed': [],
      'Draft': [],
    };

    if (!validTransitions[normalizedCurrent]?.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot transition from "${normalizedCurrent}" to "${status}".`,
      });
    }

    const resolvedAt = status === 'Resolved' ? new Date() : null;

    const updated = await query(
      `UPDATE reports SET status=$1, updated_at=NOW()
       ${resolvedAt ? ', resolved_at=$3' : ''}
       WHERE id=$2 RETURNING *`,
      resolvedAt ? [status, req.params.id, resolvedAt] : [status, req.params.id]
    );

    // Record status change in history
    await query(
      `INSERT INTO report_status_history (report_id, from_status, to_status, changed_by, note)
       VALUES ($1,$2,$3,$4,$5)`,
      [req.params.id, currentStatus, status, req.user.id, note || null]
    ).catch(() => {});

    // Notify the reporter of the status change
    const reportRow = updated.rows[0];
    await createNotification(
      reportRow.reporter_id,
      'Report Status Updated',
      `Your report "${reportRow.title}" status changed to "${status}".`,
      'status_change',
      reportRow.id
    );

    return res.json({ success: true, message: `Status updated to "${status}".`, data: { report: updated.rows[0] } });
  } catch (error) {
    console.error('Update status error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update status.' });
  }
});

// ── PATCH reassign department (authority / admin) ─────────────────────────────
router.patch('/:id/reassign', authenticate, authorize('authority', 'admin'), async (req, res) => {
  try {
    const { department_id, note } = req.body;
    if (!department_id) {
      return res.status(400).json({ success: false, message: 'department_id is required.' });
    }

    const reportResult = await query('SELECT * FROM reports WHERE id = $1', [req.params.id]);
    if (!reportResult.rows[0]) {
      return res.status(404).json({ success: false, message: 'Report not found.' });
    }

    const report = reportResult.rows[0];
    const oldDeptResult = await query('SELECT name FROM departments WHERE id = $1', [report.assigned_department_id]);
    const newDeptResult = await query('SELECT name FROM departments WHERE id = $1', [department_id]);

    if (!newDeptResult.rows[0]) {
      return res.status(400).json({ success: false, message: 'Target department not found.' });
    }

    const oldDeptName = oldDeptResult.rows[0]?.name || 'Unassigned';
    const newDeptName = newDeptResult.rows[0].name;

    const updated = await query(
      'UPDATE reports SET assigned_department_id=$1, updated_at=NOW() WHERE id=$2 RETURNING *',
      [department_id, req.params.id]
    );

    // Audit log
    const auditDetails = JSON.stringify({
      report_tracking_id: report.tracking_id,
      from_department: oldDeptName,
      to_department: newDeptName,
      note: note || null,
    });
    await query(
      `INSERT INTO audit_logs (actor_id, action, target_type, target_id, details)
       VALUES ($1, 'case_reassigned', 'report', $2, $3)`,
      [req.user.id, req.params.id, auditDetails]
    ).catch(() => {});

    // Status history entry
    await query(
      `INSERT INTO report_status_history (report_id, from_status, to_status, changed_by, note)
       VALUES ($1, $2, $2, $3, $4)`,
      [req.params.id, report.status, req.user.id,
       `Case reassigned from ${oldDeptName} to ${newDeptName}. ${note || ''}`.trim()]
    ).catch(() => {});

    return res.json({
      success: true,
      message: `Case reassigned to ${newDeptName}.`,
      data: { report: updated.rows[0] },
    });
  } catch (error) {
    console.error('Reassign error:', error);
    return res.status(500).json({ success: false, message: 'Failed to reassign case.' });
  }
});

// ── GET evidence integrity (verify SHA-256) ───────────────────────────────────
router.get('/:id/evidence/:eid/verify', authenticate, canAccessReport, async (req, res) => {
  try {
    const ev = await query(
      `SELECT id, file_name, file_type, file_url, hash_sha256, uploaded_at
       FROM evidence WHERE id = $1 AND report_id = $2`,
      [req.params.eid, req.params.id]
    );
    if (!ev.rows[0]) return res.status(404).json({ success: false, message: 'Evidence not found.' });
    return res.json({ success: true, data: ev.rows[0] });
  } catch (error) {
    console.error('Verify evidence error:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve evidence record.' });
  }
});

// ── PATCH priority (admin) ────────────────────────────────────────────────────
router.patch('/:id/priority', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { priority } = req.body;
    const valid = ['low', 'medium', 'high', 'critical'];
    if (!valid.includes(priority)) return res.status(400).json({ success: false, message: 'Invalid priority.' });
    const updated = await query(
      'UPDATE reports SET priority=$1, updated_at=NOW() WHERE id=$2 RETURNING *',
      [priority, req.params.id]
    );
    return res.json({ success: true, data: { report: updated.rows[0] } });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to update priority.' });
  }
});

module.exports = router;