const express = require('express');
const router = express.Router();
const { query, pool } = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');

// All admin routes require login + admin role
router.use(authenticate, authorize('admin'));

// ── STATS / ANALYTICS ────────────────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const [total, open, resolved, users, authorities, pending, monthlyRaw, catRaw] = await Promise.all([
      query('SELECT COUNT(*) FROM reports WHERE is_draft = false'),
      query("SELECT COUNT(*) FROM reports WHERE status IN ('Submitted','Under Review','Investigating') AND is_draft = false"),
      query("SELECT COUNT(*) FROM reports WHERE status IN ('Resolved','Closed') AND is_draft = false"),
      query('SELECT COUNT(*) FROM users'),
      query("SELECT COUNT(*) FROM users WHERE role = 'authority' AND is_active = true"),
      query("SELECT COUNT(*) FROM authority_review_requests WHERE status = 'pending'"),
      query(`SELECT TO_CHAR(DATE_TRUNC('month', created_at), 'Mon YYYY') AS month,
                    COUNT(*) AS count
             FROM reports WHERE is_draft = false
             GROUP BY DATE_TRUNC('month', created_at)
             ORDER BY DATE_TRUNC('month', created_at) DESC LIMIT 12`),
      query(`SELECT c.name, COUNT(r.id) AS count
             FROM categories c
             LEFT JOIN reports r ON r.category_id = c.id AND r.is_draft = false
             GROUP BY c.id, c.name ORDER BY count DESC`),
    ]);

    return res.json({
      success: true,
      data: {
        summary: {
          total: parseInt(total.rows[0].count),
          open: parseInt(open.rows[0].count),
          resolved: parseInt(resolved.rows[0].count),
          total_users: parseInt(users.rows[0].count),
          total_authorities: parseInt(authorities.rows[0].count),
          pending_authority_requests: parseInt(pending.rows[0].count),
        },
        monthly_trend: monthlyRaw.rows.reverse(),
        category_distribution: catRaw.rows,
      },
    });
  } catch (err) {
    console.error('Admin stats error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch stats.' });
  }
});

// ── MONTHLY TREND (filterable) ───────────────────────────────────────────────
router.get('/monthly-trend', async (req, res) => {
  try {
    const { category_id, months = 12 } = req.query;
    const m = Math.min(60, Math.max(1, parseInt(months, 10)));

    let sql = `
      SELECT TO_CHAR(DATE_TRUNC('month', r.created_at), 'Mon YYYY') AS month,
             DATE_TRUNC('month', r.created_at) AS month_ts,
             COUNT(*) AS count
      FROM reports r
      WHERE r.is_draft = false
        AND r.created_at >= NOW() - INTERVAL '${m} months'
    `;
    const params = [];

    if (category_id) {
      params.push(category_id);
      sql += ` AND r.category_id = $${params.length}`;
    }

    sql += ` GROUP BY DATE_TRUNC('month', r.created_at)
             ORDER BY DATE_TRUNC('month', r.created_at) ASC`;

    const result = await query(sql, params);
    return res.json({
      success: true,
      data: { trend: result.rows.map(r => ({ month: r.month, count: parseInt(r.count) })) },
    });
  } catch (err) {
    console.error('Monthly trend error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch trend data.' });
  }
});

// ── USERS ────────────────────────────────────────────────────────────────────
router.get('/users', async (req, res) => {
  try {
    const { role, page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const params = [];
    let where = 'WHERE 1=1';

    if (role) { params.push(role); where += ` AND role = $${params.length}`; }

    params.push(parseInt(limit), offset);
    const result = await query(
      `SELECT id, name, email, role, is_active, is_verified, created_at
       FROM users ${where}
       ORDER BY created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    return res.json({ success: true, data: { users: result.rows } });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch users.' });
  }
});

// ── AUTHORITY REVIEW REQUESTS ────────────────────────────────────────────────
router.get('/authority-requests', async (req, res) => {
  try {
    const { status = 'pending' } = req.query;
    let where = status === 'all' ? '' : `WHERE arr.status = $1`;
    const params = status === 'all' ? [] : [status];

    const result = await query(
      `SELECT arr.*,
              u.name AS user_name,
              u.email AS user_email,
              u.is_active,
              d.name AS department_name,
              -- Risk indicator: non-official email (not .gov, .org, .edu)
              (u.email NOT LIKE '%.gov%' AND u.email NOT LIKE '%.org%' AND u.email NOT LIKE '%.edu%') AS has_risk_indicator
       FROM authority_review_requests arr
       JOIN users u ON u.id = arr.user_id
       LEFT JOIN departments d ON d.id = arr.department_id
       ${where}
       ORDER BY arr.created_at DESC`,
      params
    );

    return res.json({ success: true, data: { requests: result.rows } });
  } catch (err) {
    console.error('Get authority requests error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch requests.' });
  }
});

// APPROVE authority
router.post('/authority-requests/:id/approve', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const reqResult = await client.query(
      'SELECT * FROM authority_review_requests WHERE id = $1',
      [req.params.id]
    );
    if (!reqResult.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Request not found.' });
    }

    const request = reqResult.rows[0];

    // Activate the user account
    await client.query(
      `UPDATE users SET is_active = true, is_verified = true, updated_at = NOW()
       WHERE id = $1`,
      [request.user_id]
    );

    // Update request status
    await client.query(
      `UPDATE authority_review_requests
       SET status = 'approved', reviewed_by = $1, reviewed_at = NOW(), updated_at = NOW()
       WHERE id = $2`,
      [req.user.id, req.params.id]
    );

    // Create/update authority profile with all submitted info
    await client.query(
      `INSERT INTO authority_profiles (user_id, department_id, designation, badge_number, department_type, office_address, is_verified)
       VALUES ($1, $2, $3, $4, $5, $6, true)
       ON CONFLICT (user_id) DO UPDATE SET
         department_id = $2, designation = $3, badge_number = $4,
         department_type = $5, office_address = $6, is_verified = true`,
      [request.user_id, request.department_id || null, request.designation || null,
       request.badge_number || null, request.department_type || null, request.office_address || null]
    );

    // Audit log
    await client.query(
      `INSERT INTO audit_logs (actor_id, action, target_type, target_id, details)
       VALUES ($1, 'authority_approved', 'user', $2, $3)`,
      [req.user.id, request.user_id, JSON.stringify({ request_id: req.params.id })]
    );

    // Notify the authority user
    await client.query(
      `INSERT INTO notifications (user_id, type, title, message)
       VALUES ($1, 'account_approved', 'Account Approved', 'Your authority account has been approved. You now have full access to the system.')`,
      [request.user_id]
    );

    await client.query('COMMIT');

    return res.json({ success: true, message: 'Authority approved and account activated.' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Approve authority error:', err);
    return res.status(500).json({ success: false, message: 'Failed to approve.' });
  } finally {
    client.release();
  }
});

// REJECT authority
router.post('/authority-requests/:id/reject', async (req, res) => {
  const client = await pool.connect();
  try {
    const { reason } = req.body;
    if (!reason || !reason.trim()) {
      return res.status(400).json({ success: false, message: 'Rejection reason is required.' });
    }

    await client.query('BEGIN');

    const reqResult = await client.query(
      'SELECT * FROM authority_review_requests WHERE id = $1',
      [req.params.id]
    );
    if (!reqResult.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Request not found.' });
    }

    const request = reqResult.rows[0];

    await client.query(
      `UPDATE authority_review_requests
       SET status = 'rejected', rejection_reason = $1, admin_note = $1,
           reviewed_by = $2, reviewed_at = NOW(), updated_at = NOW()
       WHERE id = $3`,
      [reason.trim(), req.user.id, req.params.id]
    );

    // Audit log
    await client.query(
      `INSERT INTO audit_logs (actor_id, action, target_type, target_id, details)
       VALUES ($1, 'authority_rejected', 'user', $2, $3)`,
      [req.user.id, request.user_id, JSON.stringify({ reason, request_id: req.params.id })]
    );

    // Notify the authority
    await client.query(
      `INSERT INTO notifications (user_id, type, title, message)
       VALUES ($1, 'account_rejected', 'Account Request Rejected', $2)`,
      [request.user_id, `Your authority account request was not approved. Reason: ${reason.trim()}`]
    );

    await client.query('COMMIT');

    return res.json({ success: true, message: 'Request rejected and authority notified.' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Reject authority error:', err);
    return res.status(500).json({ success: false, message: 'Failed to reject.' });
  } finally {
    client.release();
  }
});

// REQUEST MORE INFO
router.post('/authority-requests/:id/request-info', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Message is required.' });
    }

    const reqResult = await query(
      'SELECT * FROM authority_review_requests WHERE id = $1',
      [req.params.id]
    );
    if (!reqResult.rows[0]) {
      return res.status(404).json({ success: false, message: 'Request not found.' });
    }

    const request = reqResult.rows[0];

    await query(
      `UPDATE authority_review_requests
       SET status = 'info_requested', admin_note = $1, updated_at = NOW()
       WHERE id = $2`,
      [message.trim(), req.params.id]
    );

    // Notify the authority
    await query(
      `INSERT INTO notifications (user_id, type, title, message)
       VALUES ($1, 'info_requested', 'Additional Information Needed', $2)`,
      [request.user_id, `Admin has requested additional information: ${message.trim()}`]
    );

    return res.json({ success: true, message: 'Info request sent to authority.' });
  } catch (err) {
    console.error('Request info error:', err);
    return res.status(500).json({ success: false, message: 'Failed to send request.' });
  }
});

// ── DUPLICATE FLAGS ──────────────────────────────────────────────────────────
router.get('/duplicate-flags', async (req, res) => {
  try {
    const result = await query(`
      SELECT
        r.id, r.tracking_id, r.title, r.status, r.submitted_at,
        r.location_lat, r.location_lng, r.location_text,
        r.possible_duplicate_of, r.duplicate_status,
        c.name AS category_name,
        orig.tracking_id AS orig_tracking_id,
        orig.title        AS orig_title,
        orig.submitted_at AS orig_submitted_at,
        orig.location_text AS orig_location_text,
        u.name AS reporter_name,
        CASE
          WHEN r.location_lat IS NOT NULL AND orig.location_lat IS NOT NULL THEN
            ROUND(6371000 * 2 * asin(sqrt(
              power(sin(radians((r.location_lat - orig.location_lat) / 2)), 2) +
              cos(radians(orig.location_lat)) * cos(radians(r.location_lat)) *
              power(sin(radians((r.location_lng - orig.location_lng) / 2)), 2)
            )))
          ELSE NULL
        END AS distance_meters,
        ROUND(EXTRACT(EPOCH FROM (r.submitted_at - orig.submitted_at)) / 3600, 1) AS hours_apart
      FROM reports r
      JOIN reports orig ON orig.id = r.possible_duplicate_of
      LEFT JOIN categories c ON c.id = r.category_id
      LEFT JOIN users u ON u.id = r.reporter_id
      WHERE r.duplicate_status = 'flagged'
      ORDER BY r.submitted_at DESC
    `);
    return res.json({ success: true, data: { flags: result.rows } });
  } catch (err) {
    console.error('Duplicate flags error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch duplicate flags.' });
  }
});

router.post('/reports/:id/duplicate/dismiss', async (req, res) => {
  try {
    await query(
      `UPDATE reports SET duplicate_status = 'dismissed', possible_duplicate_of = NULL WHERE id = $1`,
      [req.params.id]
    );
    await query(
      `INSERT INTO audit_logs (actor_id, action, target_type, target_id, details)
       VALUES ($1, 'duplicate_dismissed', 'report', $2, $3)`,
      [req.user.id, req.params.id, JSON.stringify({ note: 'Admin dismissed duplicate flag' })]
    ).catch(() => {});
    return res.json({ success: true, message: 'Duplicate flag dismissed.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to dismiss flag.' });
  }
});

router.post('/reports/:id/duplicate/confirm', async (req, res) => {
  try {
    const { original_id } = req.body;
    await query(
      `UPDATE reports SET duplicate_status = 'confirmed', status = 'Closed', updated_at = NOW()
       WHERE id = $1`,
      [req.params.id]
    );
    await query(
      `INSERT INTO report_status_history (report_id, from_status, to_status, changed_by, note)
       SELECT status, status, 'Closed', $2, 'Marked as duplicate of report #' || $3
       FROM reports WHERE id = $1`,
      [req.params.id, req.user.id, original_id || '?']
    ).catch(() => {});
    await query(
      `INSERT INTO audit_logs (actor_id, action, target_type, target_id, details)
       VALUES ($1, 'duplicate_confirmed', 'report', $2, $3)`,
      [req.user.id, req.params.id, JSON.stringify({ duplicate_of: original_id })]
    ).catch(() => {});
    return res.json({ success: true, message: 'Report marked as confirmed duplicate and closed.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to confirm duplicate.' });
  }
});

// ── UNASSIGNED REPORTS ───────────────────────────────────────────────────────
router.get('/unassigned-reports', async (req, res) => {
  try {
    const result = await query(
      `SELECT r.id, r.tracking_id, r.title, r.status, r.priority, r.created_at, r.submitted_at,
              r.is_anonymous, r.category_id,
              c.name AS category_name,
              CASE WHEN r.is_anonymous THEN 'Anonymous' ELSE u.name END AS reporter_name,
              u.email AS reporter_email
       FROM reports r
       LEFT JOIN categories c ON c.id = r.category_id
       LEFT JOIN users u ON u.id = r.reporter_id
       WHERE r.assigned_department_id IS NULL
         AND r.is_draft = false
         AND r.status NOT IN ('Draft', 'draft')
       ORDER BY r.created_at DESC`
    );
    return res.json({ success: true, data: { reports: result.rows } });
  } catch (err) {
    console.error('Unassigned reports error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch unassigned reports.' });
  }
});

// ── MANUAL DEPARTMENT ASSIGNMENT ─────────────────────────────────────────────
router.patch('/reports/:id/assign', async (req, res) => {
  const client = await pool.connect();
  try {
    const { department_id, note } = req.body;
    if (!department_id) {
      return res.status(400).json({ success: false, message: 'department_id is required.' });
    }

    await client.query('BEGIN');

    const reportResult = await client.query(
      'SELECT * FROM reports WHERE id = $1',
      [req.params.id]
    );
    if (!reportResult.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, message: 'Report not found.' });
    }

    const deptResult = await client.query(
      'SELECT name FROM departments WHERE id = $1', [department_id]
    );
    if (!deptResult.rows[0]) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Department not found.' });
    }

    const report = reportResult.rows[0];
    const deptName = deptResult.rows[0].name;

    await client.query(
      'UPDATE reports SET assigned_department_id=$1, updated_at=NOW() WHERE id=$2',
      [department_id, req.params.id]
    );

    // Audit log
    await client.query(
      `INSERT INTO audit_logs (actor_id, action, target_type, target_id, details)
       VALUES ($1, 'manual_assignment', 'report', $2, $3)`,
      [req.user.id, req.params.id, JSON.stringify({
        report_tracking_id: report.tracking_id,
        assigned_to: deptName,
        note: note || null,
      })]
    );

    // Notify authority officers in the assigned department
    const officers = await client.query(
      `SELECT u.id FROM users u
       JOIN authority_profiles ap ON ap.user_id = u.id
       WHERE ap.department_id = $1 AND u.is_active = true`,
      [department_id]
    );
    for (const officer of officers.rows) {
      await client.query(
        `INSERT INTO notifications (user_id, type, title, message)
         VALUES ($1, 'assignment', 'New Report Assigned', $2)`,
        [officer.id, `Report "${report.title}" (${report.tracking_id}) has been manually assigned to ${deptName}.`]
      ).catch(() => {});
    }

    await client.query('COMMIT');

    return res.json({
      success: true,
      message: `Report manually assigned to ${deptName}.`,
      data: { department_name: deptName },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Manual assign error:', err);
    return res.status(500).json({ success: false, message: 'Failed to assign report.' });
  } finally {
    client.release();
  }
});

// ── ROUTING RULES ────────────────────────────────────────────────────────────
router.get('/routing-rules', async (req, res) => {
  try {
    const result = await query(
      `SELECT cdm.id, c.name AS category_name, d.name AS department_name
       FROM category_department_mappings cdm
       JOIN categories c ON c.id = cdm.category_id
       JOIN departments d ON d.id = cdm.department_id
       ORDER BY c.name`
    );
    return res.json({ success: true, data: { rules: result.rows } });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch rules.' });
  }
});

router.post('/routing-rules', async (req, res) => {
  try {
    const { category_id, department_id } = req.body;
    if (!category_id || !department_id) {
      return res.status(400).json({ success: false, message: 'category_id and department_id required.' });
    }
    await query(
      'INSERT INTO category_department_mappings (category_id, department_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [category_id, department_id]
    );
    return res.status(201).json({ success: true, message: 'Mapping created.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to create mapping.' });
  }
});

router.delete('/routing-rules/:id', async (req, res) => {
  try {
    await query('DELETE FROM category_department_mappings WHERE id = $1', [req.params.id]);
    return res.json({ success: true, message: 'Mapping deleted.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to delete mapping.' });
  }
});

// ── AUDIT LOGS ───────────────────────────────────────────────────────────────
router.get('/audit-logs', async (req, res) => {
  try {
    const result = await query(
      `SELECT al.*, u.name AS actor_name, u.email AS actor_email
       FROM audit_logs al
       LEFT JOIN users u ON u.id = al.actor_id
       ORDER BY al.created_at DESC LIMIT 100`
    );
    return res.json({ success: true, data: { logs: result.rows } });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch logs.' });
  }
});

// ── CATEGORIES (admin CRUD) ───────────────────────────────────────────────────
router.post('/categories-manage', async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Name required.' });
    const result = await query(
      'INSERT INTO categories (name, description) VALUES ($1, $2) RETURNING *',
      [name.trim(), description || null]
    );
    return res.status(201).json({ success: true, data: { category: result.rows[0] } });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ success: false, message: 'Category already exists.' });
    return res.status(500).json({ success: false, message: 'Failed to create category.' });
  }
});

module.exports = router;

// ── COMPLIANCE DASHBOARD ─────────────────────────────────────────────────────

// SLA Compliance per department
router.get('/compliance/sla', async (req, res) => {
  try {
    const result = await query(`
      SELECT
        d.name AS department,
        COUNT(r.id) AS total_cases,
        COUNT(r.id) FILTER (
          WHERE r.resolved_at IS NOT NULL
            AND EXTRACT(EPOCH FROM (r.resolved_at - r.submitted_at))/3600
                <= sl.resolution_hours
        ) AS sla_met,
        COUNT(r.id) FILTER (
          WHERE r.resolved_at IS NOT NULL
            AND EXTRACT(EPOCH FROM (r.resolved_at - r.submitted_at))/3600
                > sl.resolution_hours
        ) AS sla_breached,
        COUNT(r.id) FILTER (
          WHERE r.resolved_at IS NULL
            AND r.status NOT IN ('draft','closed')
            AND EXTRACT(EPOCH FROM (NOW() - r.submitted_at))/3600
                > sl.resolution_hours
        ) AS sla_overdue,
        ROUND(
          COUNT(r.id) FILTER (
            WHERE r.resolved_at IS NOT NULL
              AND EXTRACT(EPOCH FROM (r.resolved_at - r.submitted_at))/3600
                  <= sl.resolution_hours
          ) * 100.0 / NULLIF(
            COUNT(r.id) FILTER (WHERE r.resolved_at IS NOT NULL), 0
          ), 1
        ) AS sla_met_pct
      FROM departments d
      LEFT JOIN reports r ON r.assigned_department_id = d.id AND r.is_draft = false
      LEFT JOIN sla_rules sl ON sl.priority = COALESCE(r.priority, 'medium')
      GROUP BY d.id, d.name
      ORDER BY sla_met_pct ASC NULLS LAST
    `);

    return res.json({ success: true, data: { sla: result.rows } });
  } catch (err) {
    console.error('SLA compliance error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch SLA data.' });
  }
});

// Department risk indicators
router.get('/compliance/risk', async (req, res) => {
  try {
    const result = await query(`
      SELECT
        d.name AS department,
        COUNT(r.id) AS total,
        COUNT(r.id) FILTER (WHERE r.status IN ('submitted','under_review','investigating')) AS pending,
        COUNT(r.id) FILTER (
          WHERE r.resolved_at IS NULL
            AND r.status NOT IN ('draft','closed','resolved')
            AND r.submitted_at < NOW() - INTERVAL '72 hours'
        ) AS overdue,
        ROUND(AVG(
          CASE WHEN r.resolved_at IS NOT NULL
            THEN EXTRACT(EPOCH FROM (r.resolved_at - r.submitted_at))/3600
          END
        ), 1) AS avg_resolution_hours,
        CASE
          WHEN COUNT(r.id) FILTER (
            WHERE r.resolved_at IS NULL
              AND r.status NOT IN ('draft','closed','resolved')
              AND r.submitted_at < NOW() - INTERVAL '72 hours'
          ) > 5 THEN 'high'
          WHEN COUNT(r.id) FILTER (
            WHERE r.resolved_at IS NULL
              AND r.status NOT IN ('draft','closed','resolved')
              AND r.submitted_at < NOW() - INTERVAL '72 hours'
          ) > 2 THEN 'medium'
          ELSE 'low'
        END AS risk_level
      FROM departments d
      LEFT JOIN reports r ON r.assigned_department_id = d.id AND r.is_draft = false
      GROUP BY d.id, d.name
      ORDER BY overdue DESC
    `);

    return res.json({ success: true, data: { risk: result.rows } });
  } catch (err) {
    console.error('Risk indicators error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch risk data.' });
  }
});

// Average resolution time per department
router.get('/compliance/resolution-time', async (req, res) => {
  try {
    const result = await query(`
      SELECT
        d.name AS department,
        COUNT(r.id) FILTER (WHERE r.resolved_at IS NOT NULL) AS resolved_count,
        ROUND(AVG(
          CASE WHEN r.resolved_at IS NOT NULL
            THEN EXTRACT(EPOCH FROM (r.resolved_at - r.submitted_at))/3600
          END
        ), 1) AS avg_hours,
        ROUND(MIN(
          CASE WHEN r.resolved_at IS NOT NULL
            THEN EXTRACT(EPOCH FROM (r.resolved_at - r.submitted_at))/3600
          END
        ), 1) AS min_hours,
        ROUND(MAX(
          CASE WHEN r.resolved_at IS NOT NULL
            THEN EXTRACT(EPOCH FROM (r.resolved_at - r.submitted_at))/3600
          END
        ), 1) AS max_hours
      FROM departments d
      LEFT JOIN reports r ON r.assigned_department_id = d.id AND r.is_draft = false
      GROUP BY d.id, d.name
      ORDER BY avg_hours DESC NULLS LAST
    `);

    return res.json({ success: true, data: { resolution: result.rows } });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch resolution data.' });
  }
});

// Pending case load per department
router.get('/compliance/pending-load', async (req, res) => {
  try {
    const result = await query(`
      SELECT
        d.name AS department,
        COUNT(r.id) FILTER (WHERE r.status = 'submitted') AS submitted,
        COUNT(r.id) FILTER (WHERE r.status = 'under_review') AS under_review,
        COUNT(r.id) FILTER (WHERE r.status = 'investigating') AS investigating,
        COUNT(r.id) FILTER (WHERE r.status IN ('submitted','under_review','investigating')) AS total_pending,
        COUNT(r.id) FILTER (WHERE r.status IN ('resolved','closed')) AS completed
      FROM departments d
      LEFT JOIN reports r ON r.assigned_department_id = d.id AND r.is_draft = false
      GROUP BY d.id, d.name
      ORDER BY total_pending DESC
    `);

    return res.json({ success: true, data: { load: result.rows } });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch pending load.' });
  }
});

// Priority distribution
router.get('/compliance/priority', async (req, res) => {
  try {
    const [dist, byDept] = await Promise.all([
      query(`
        SELECT
          COALESCE(priority, 'medium') AS priority,
          COUNT(*) AS count
        FROM reports WHERE is_draft = false
        GROUP BY priority ORDER BY count DESC
      `),
      query(`
        SELECT
          d.name AS department,
          COUNT(r.id) FILTER (WHERE r.priority = 'critical') AS critical,
          COUNT(r.id) FILTER (WHERE r.priority = 'high') AS high,
          COUNT(r.id) FILTER (WHERE r.priority = 'medium' OR r.priority IS NULL) AS medium,
          COUNT(r.id) FILTER (WHERE r.priority = 'low') AS low
        FROM departments d
        LEFT JOIN reports r ON r.assigned_department_id = d.id AND r.is_draft = false
        GROUP BY d.id, d.name ORDER BY d.name
      `)
    ]);

    return res.json({ success: true, data: { distribution: dist.rows, byDepartment: byDept.rows } });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch priority data.' });
  }
});

// ── COMPLIANCE & RISK DASHBOARD ───────────────────────────────────────────────

// SLA Rules — get and set
router.get('/sla-rules', async (req, res) => {
  try {
    const result = await query(
      `SELECT sr.id, sr.department_id, sr.resolution_days, d.name AS department_name
       FROM sla_rules sr
       JOIN departments d ON d.id = sr.department_id
       ORDER BY d.name`
    );
    return res.json({ success: true, data: { rules: result.rows } });
  } catch (err) {
    // Table might not exist yet — return empty
    return res.json({ success: true, data: { rules: [] } });
  }
});

router.post('/sla-rules', async (req, res) => {
  try {
    const { department_id, resolution_days } = req.body;
    if (!department_id || !resolution_days)
      return res.status(400).json({ success: false, message: 'department_id and resolution_days required.' });
    await query(
      `INSERT INTO sla_rules (department_id, resolution_days)
       VALUES ($1, $2)
       ON CONFLICT (department_id) DO UPDATE SET resolution_days = $2, updated_at = NOW()`,
      [department_id, parseInt(resolution_days)]
    );
    return res.json({ success: true, message: 'SLA rule saved.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to save SLA rule.' });
  }
});

// Main compliance dashboard data
router.get('/sla-monitoring', async (req, res) => {
  try {
    // SLA compliance per department
    const slaResult = await query(`
      SELECT
        d.id AS department_id,
        d.name AS department_name,
        COUNT(r.id) AS total_cases,
        COUNT(r.id) FILTER (WHERE r.status IN ('Resolved','Closed')) AS resolved_cases,
        COUNT(r.id) FILTER (WHERE r.status NOT IN ('Resolved','Closed','Draft') AND r.is_draft = false) AS active_cases,
        -- SLA met: resolved within resolution_days
        COUNT(r.id) FILTER (
          WHERE r.status IN ('Resolved','Closed')
          AND r.resolved_at IS NOT NULL
          AND r.submitted_at IS NOT NULL
          AND r.resolved_at - r.submitted_at <= (COALESCE(sr.resolution_days, 5) || ' days')::INTERVAL
        ) AS sla_met,
        -- SLA breached: resolved but took too long, OR still active past SLA
        COUNT(r.id) FILTER (
          WHERE (
            r.status IN ('Resolved','Closed')
            AND r.resolved_at IS NOT NULL
            AND r.submitted_at IS NOT NULL
            AND r.resolved_at - r.submitted_at > (COALESCE(sr.resolution_days, 5) || ' days')::INTERVAL
          ) OR (
            r.status NOT IN ('Resolved','Closed','Draft')
            AND r.is_draft = false
            AND r.submitted_at IS NOT NULL
            AND NOW() - r.submitted_at > (COALESCE(sr.resolution_days, 5) || ' days')::INTERVAL
          )
        ) AS sla_breached,
        -- Average resolution time in hours
        ROUND(AVG(
          EXTRACT(EPOCH FROM (r.resolved_at - r.submitted_at)) / 3600
        ) FILTER (WHERE r.resolved_at IS NOT NULL AND r.submitted_at IS NOT NULL)::NUMERIC, 1) AS avg_resolution_hours,
        COALESCE(sr.resolution_days, 5) AS sla_days
      FROM departments d
      LEFT JOIN reports r ON r.assigned_department_id = d.id AND r.is_draft = false
      LEFT JOIN sla_rules sr ON sr.department_id = d.id
      GROUP BY d.id, d.name, sr.resolution_days
      ORDER BY d.name
    `);

    // Pending case load per department
    const pendingResult = await query(`
      SELECT d.name AS department_name, d.id AS department_id,
             COUNT(r.id) AS pending_count
      FROM departments d
      LEFT JOIN reports r ON r.assigned_department_id = d.id
        AND r.status NOT IN ('Resolved','Closed','Draft')
        AND r.is_draft = false
      GROUP BY d.id, d.name
      ORDER BY pending_count DESC
    `);

    // Priority distribution
    const priorityResult = await query(`
      SELECT COALESCE(priority, 'Medium') AS priority, COUNT(*) AS count
      FROM reports
      WHERE is_draft = false
      GROUP BY priority
      ORDER BY
        CASE priority WHEN 'Critical' THEN 1 WHEN 'High' THEN 2 WHEN 'Medium' THEN 3 ELSE 4 END
    `);

    // Overdue cases — active for 72+ hours with no resolution
    const overdueResult = await query(`
      SELECT r.tracking_id, r.title, r.status,
             COALESCE(r.priority, 'Medium') AS priority,
             d.name AS department,
             ROUND(EXTRACT(EPOCH FROM (NOW() - r.submitted_at)) / 3600, 1) AS hours_open
      FROM reports r
      LEFT JOIN departments d ON d.id = r.assigned_department_id
      WHERE r.resolved_at IS NULL
        AND r.is_draft = false
        AND r.status NOT IN ('Resolved', 'Closed', 'Draft')
        AND r.submitted_at < NOW() - INTERVAL '72 hours'
      ORDER BY r.submitted_at ASC
      LIMIT 20
    `);

    // Build risk indicators per department
    const departments = slaResult.rows.map(d => {
      const total = parseInt(d.total_cases) || 0;
      const breached = parseInt(d.sla_breached) || 0;
      const active = parseInt(d.active_cases) || 0;
      const breachRate = total > 0 ? (breached / total) * 100 : 0;
      const slaMetCount = parseInt(d.sla_met) || 0;
      const resolvedCount = parseInt(d.resolved_cases) || 0;
      const slaMetRate = resolvedCount > 0 ? (slaMetCount / resolvedCount) * 100 : 100;

      let riskLevel = 'low';
      if (breachRate > 40 || active > 20) riskLevel = 'high';
      else if (breachRate > 20 || active > 10) riskLevel = 'medium';

      return {
        ...d,
        total_cases: total,
        resolved_cases: resolvedCount,
        active_cases: active,
        sla_met: slaMetCount,
        sla_breached: breached,
        sla_met_rate: Math.round(slaMetRate),
        sla_breach_rate: Math.round(breachRate),
        avg_resolution_hours: d.avg_resolution_hours ? parseFloat(d.avg_resolution_hours) : null,
        risk_level: riskLevel,
      };
    });

    // Overall system stats
    const overallSlaMetRate = (() => {
      const totRes = departments.reduce((s, d) => s + d.resolved_cases, 0);
      const totMet = departments.reduce((s, d) => s + d.sla_met, 0);
      return totRes > 0 ? Math.round((totMet / totRes) * 100) : 0;
    })();

    return res.json({
      success: true,
      data: {
        departments,
        pending_load: pendingResult.rows.map(r => ({ ...r, pending_count: parseInt(r.pending_count) })),
        priority_distribution: priorityResult.rows.map(r => ({ ...r, count: parseInt(r.count) })),
        overall_sla_met_rate: overallSlaMetRate,
        high_risk_count: departments.filter(d => d.risk_level === 'high').length,
        overdue_cases: overdueResult.rows,
      },
    });
  } catch (err) {
    console.error('SLA monitoring error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch compliance data.' });
  }
});