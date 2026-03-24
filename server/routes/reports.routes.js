const express = require('express');
const path = require('path');
const router = express.Router();
const { query } = require('../config/db');
const { authenticate, authorize, canAccessReport } = require('../middleware/auth');
const { upload } = require('../config/cloudinary');
const { generateTrackingId, autoAssignDepartment, paginate } = require('../utils/helpers');

router.get('/', authenticate, async (req, res) => {
  try {
    const { page = 1, limit = 10, category_id, search } = req.query;
    const { offset, limit: lim } = paginate(page, limit);

    const user = req.user;
    let whereClause = '';
    const params = [];

    if (user.role === 'reporter') {
      whereClause = `WHERE r.reporter_id = $1`;
      params.push(user.id);
    } else if (user.role === 'authority') {
      // For Sprint 1, authorities see all reports (simplified without department assignment)
      whereClause = `WHERE r.is_draft = false`;
    } else {
      whereClause = 'WHERE 1=1';
    }

    let idx = params.length + 1;

    if (category_id) {
      whereClause += ` AND r.category_id = $${idx++}`;
      params.push(category_id);
    }

    if (search) {
      whereClause += ` AND (r.title ILIKE $${idx} OR r.tracking_id ILIKE $${idx})`;
      params.push(`%${search}%`);
      idx += 1;
    }

    const totalResult = await query(`SELECT COUNT(*) FROM reports r ${whereClause}`, params);
    const total = parseInt(totalResult.rows[0].count, 10);

    const allParams = [...params, user.role, lim, offset];
const result = await query(
      `SELECT r.id, r.tracking_id, r.title, r.description, r.is_anonymous, r.status, r.is_draft, r.incident_date,
              r.location_text, r.location_lat, r.location_lng, r.created_at,
              c.name AS category_name,
              d.name AS department_name,
              CASE
                WHEN $${params.length + 1} = 'authority' AND r.is_anonymous THEN 'Anonymous Reporter'
                ELSE u.name
              END AS reporter_name,
              (SELECT COUNT(*) FROM evidence e WHERE e.report_id = r.id) AS evidence_count
       FROM reports r
       LEFT JOIN categories c ON c.id = r.category_id
       LEFT JOIN departments d ON d.id = r.assigned_department_id
       LEFT JOIN users u ON u.id = r.reporter_id
       ${whereClause}
       ORDER BY r.created_at DESC
       LIMIT $${params.length + 2} OFFSET $${params.length + 3}`,
      allParams
    );

    return res.json({
      success: true,
      data: {
        reports: result.rows,
        total,
        page: parseInt(page, 10),
        limit: lim,
        totalPages: Math.ceil(total / lim),
      },
    });
  } catch (error) {
    console.error('Get reports error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch reports.' });
  }
});

router.post('/', authenticate, authorize('reporter'), upload.any(), async (req, res) => {
  try {
    const {
      title,
      description,
      category_id,
      is_anonymous = 'false',
      incident_date,
      location_text,
      location_lat,
      location_lng,
      is_draft = 'false',
    } = req.body;

    const isDraft = String(is_draft) === 'true';
    
    if (!isDraft && (!title || !description || !category_id)) {
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
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,NOW())
      RETURNING *`,
      [
        trackingId,
        title || '',
        description || '',
        category_id || null,
        req.user.id,
        isAnon,
        incident_date || null,
        location_text || null,
        location_lat || null,
        location_lng || null,
        isDraft ? 'draft' : 'submitted',
        isDraft,
        assignedDeptId,
      ]
    );

    const report = created.rows[0];

    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        // CloudinaryStorage returns a URL; diskStorage returns a local file path.
        const isUrl = typeof file.path === 'string' && file.path.startsWith('http');
        const fileUrl = isUrl
          ? file.path
          : `${req.protocol}://${req.get('host')}/uploads/${file.filename || path.basename(file.path)}`;

        await query(
          `INSERT INTO evidence (report_id, file_url, file_name, file_type, file_size, public_id, hash_sha256)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            report.id,
            fileUrl,
            file.originalname,
            file.mimetype,
            file.size,
            file.filename || file.public_id,
            null,
          ]
        );
      }
    }

    return res.status(201).json({
      success: true,
      message: isDraft ? 'Draft saved successfully.' : 'Report submitted successfully.',
      data: { report },
    });
  } catch (error) {
    console.error('Create report error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create report.' });
  }
});

router.get('/:id', authenticate, canAccessReport, async (req, res) => {
  try {
    const full = await query(
      `SELECT r.*,
              c.name AS category_name,
              d.name AS department_name,
              CASE
                WHEN r.is_anonymous AND $2 = 'authority' THEN 'Anonymous Reporter'
                ELSE u.name
              END AS reporter_name,
              CASE
                WHEN r.is_anonymous AND $2 = 'authority' THEN NULL
                ELSE u.email
              END AS reporter_email
       FROM reports r
       LEFT JOIN categories c ON c.id = r.category_id
       LEFT JOIN departments d ON d.id = r.assigned_department_id
       LEFT JOIN users u ON u.id = r.reporter_id
       WHERE r.id = $1`,
      [req.params.id, req.user.role]
    );

    if (!full.rows[0]) {
      return res.status(404).json({ success: false, message: 'Report not found.' });
    }

    const evidence = await query(
      'SELECT * FROM evidence WHERE report_id = $1 ORDER BY uploaded_at DESC',
      [req.params.id]
    );

    return res.json({
      success: true,
      data: {
        report: full.rows[0],
        evidence: evidence.rows,
      },
    });
  } catch (error) {
    console.error('Get report error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch report.' });
  }
});

router.put('/:id', authenticate, authorize('reporter'), upload.any(), async (req, res) => {
  try {
    const {
      title,
      description,
      category_id,
      is_anonymous = 'false',
      incident_date,
      location_text,
      location_lat,
      location_lng,
      is_draft = 'false',
      existing_file_ids = '[]',
    } = req.body;

    const isDraft = String(is_draft) === 'true';
    const isAnon = String(is_anonymous) === 'true';
    const existingFileIds = JSON.parse(existing_file_ids);

    // Check if report exists and belongs to user
    const reportCheck = await query('SELECT * FROM reports WHERE id = $1 AND reporter_id = $2', [req.params.id, req.user.id]);
    if (!reportCheck.rows[0]) {
      return res.status(404).json({ success: false, message: 'Report not found.' });
    }

    const currentReport = reportCheck.rows[0];

    if (!isDraft && (!title || !description || !category_id)) {
      return res.status(400).json({ success: false, message: 'Title, description, and category are required.' });
    }

    const deptResult = await autoAssignDepartment(category_id);
    const assignedDeptId = deptResult?.departmentId || null;

    const updated = await query(
      `UPDATE reports SET 
        title = $1, description = $2, category_id = $3, is_anonymous = $4,
        incident_date = $5, location_text = $6, location_lat = $7, location_lng = $8,
        status = $9, is_draft = $10, assigned_department_id = $11, submitted_at = $12,
        updated_at = NOW()
       WHERE id = $13 AND reporter_id = $14
       RETURNING *`,
      [
        title || '',
        description || '',
        category_id || null,
        isAnon,
        incident_date || null,
        location_text || null,
        location_lat || null,
        location_lng || null,
        isDraft ? 'draft' : 'submitted',
        isDraft,
        assignedDeptId,
        isDraft ? null : (currentReport.submitted_at || NOW()),
        req.params.id,
        req.user.id,
      ]
    );

    const report = updated.rows[0];

    // Remove evidence files that are not in the existing list
    if (existingFileIds.length > 0) {
      await query(
        'DELETE FROM evidence WHERE report_id = $1 AND id NOT IN ($2)',
        [req.params.id, existingFileIds.join(',')]
      );
    } else {
      await query('DELETE FROM evidence WHERE report_id = $1', [req.params.id]);
    }

    // Add new uploaded files
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const isUrl = typeof file.path === 'string' && file.path.startsWith('http');
        const fileUrl = isUrl
          ? file.path
          : `${req.protocol}://${req.get('host')}/uploads/${file.filename || path.basename(file.path)}`;

        await query(
          `INSERT INTO evidence (report_id, file_url, file_name, file_type, file_size, public_id, hash_sha256)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            report.id,
            fileUrl,
            file.originalname,
            file.mimetype,
            file.size,
            file.filename || file.public_id,
            null,
          ]
        );
      }
    }

    return res.json({
      success: true,
      message: isDraft ? 'Draft updated successfully.' : 'Report submitted successfully.',
      data: { report },
    });
  } catch (error) {
    console.error('Update report error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update report.' });
  }
});

// ── Status workflow transition ──
router.patch('/:id/status', authenticate, authorize('authority'), async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['submitted', 'under_review', 'investigating', 'resolved', 'closed'];

    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value.' });
    }

    const validTransitions = {
      submitted: ['under_review'],
      under_review: ['investigating'],
      investigating: ['resolved'],
      resolved: ['closed'],
      closed: [],
    };

    const reportResult = await query('SELECT status FROM reports WHERE id = $1', [req.params.id]);
    if (!reportResult.rows[0]) {
      return res.status(404).json({ success: false, message: 'Report not found.' });
    }

    const currentStatus = reportResult.rows[0].status;
    if (!validTransitions[currentStatus]?.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot transition from "${currentStatus}" to "${status}".`,
      });
    }

    const updated = await query(
      `UPDATE reports SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [status, req.params.id]
    );

    return res.json({
      success: true,
      message: `Status updated to "${status}".`,
      data: { report: updated.rows[0] },
    });
  } catch (error) {
    console.error('Update status error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update status.' });
  }
});

module.exports = router;
