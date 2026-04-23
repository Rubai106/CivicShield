const express = require('express');
const router = express.Router();
const { query } = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');

// All admin routes require authentication and admin role
router.use(authenticate, authorize('admin'));

// ===================== DASHBOARD STATS ====================
router.get('/stats', async (req, res) => {
  try {
    const [totalReports, openReports, resolvedReports, closedReports, totalUsers, slaBreached] = await Promise.all([
      query("SELECT COUNT(*) FROM reports WHERE is_draft = false"),
      query("SELECT COUNT(*) FROM reports WHERE status IN ('submitted','under_review','investigating')"),
      query("SELECT COUNT(*) FROM reports WHERE status = 'resolved'"),
      query("SELECT COUNT(*) FROM reports WHERE status = 'closed'"),
      query("SELECT COUNT(*) FROM users WHERE role = 'reporter'"),
      query("SELECT COUNT(*) FROM reports WHERE sla_deadline < NOW() AND status NOT IN ('resolved','closed') AND is_draft = false"),
    ]);

    // Monthly trend (last 12 months)
    const monthlyTrend = await query(`
      SELECT TO_CHAR(submitted_at, 'YYYY-MM') AS month,
             COUNT(*) AS count,
             SUM(CASE WHEN priority = 'critical' THEN 1 ELSE 0 END) AS critical,
             SUM(CASE WHEN priority = 'high' THEN 1 ELSE 0 END) AS high
      FROM reports
      WHERE is_draft = false AND submitted_at >= NOW() - INTERVAL '12 months'
      GROUP BY month
      ORDER BY month ASC
    `);

    // Category distribution
    const categoryDist = await query(`
      SELECT c.name, COUNT(r.id) AS count
      FROM categories c
      LEFT JOIN reports r ON r.category_id = c.id AND r.is_draft = false
      GROUP BY c.name ORDER BY count DESC LIMIT 10
    `);

    // Department performance
    const deptPerf = await query(`
      SELECT d.name,
             COUNT(r.id) AS total,
             SUM(CASE WHEN r.status = 'resolved' OR r.status = 'closed' THEN 1 ELSE 0 END) AS resolved,
             AVG(EXTRACT(EPOCH FROM (r.resolved_at - r.submitted_at))/3600) AS avg_resolution_hours
      FROM departments d
      LEFT JOIN reports r ON r.assigned_department_id = d.id AND r.is_draft = false
      GROUP BY d.name
      ORDER BY total DESC
    `);

    // Priority distribution
    const priorityDist = await query(`
      SELECT priority, COUNT(*) AS count
      FROM reports WHERE is_draft = false
      GROUP BY priority
    `);

    res.json({
      success: true,
      data: {
        summary: {
          total: parseInt(totalReports.rows[0].count),
          open: parseInt(openReports.rows[0].count),
          resolved: parseInt(resolvedReports.rows[0].count),
          closed: parseInt(closedReports.rows[0].count),
          total_users: parseInt(totalUsers.rows[0].count),
          sla_breached: parseInt(slaBreached.rows[0].count),
        },
        monthly_trend: monthlyTrend.rows,
        category_distribution: categoryDist.rows,
        department_performance: deptPerf.rows,
        priority_distribution: priorityDist.rows,
      }
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch stats.' });
  }
});

// ===================== ROUTING RULES =====================
router.get('/routing-rules', async (req, res) => {
  try {
    const result = await query(
      `SELECT rr.*, c.name AS category_name, d.name AS department_name
       FROM routing_rules rr
       JOIN categories c ON rr.category_id = c.id
       JOIN departments d ON rr.department_id = d.id
       ORDER BY c.name ASC`
    );
    res.json({ success: true, data: { rules: result.rows } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch routing rules.' });
  }
});

router.post('/routing-rules', async (req, res) => {
  try {
    const { category_id, department_id, priority_boost, keywords } = req.body;
    if (!category_id || !department_id) {
      return res.status(400).json({ success: false, message: 'Category and department are required.' });
    }
    const result = await query(
      `INSERT INTO routing_rules (category_id, department_id, priority_boost, keywords)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [category_id, department_id, priority_boost || 0, keywords || []]
    );
    res.status(201).json({ success: true, data: { rule: result.rows[0] } });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ success: false, message: 'Rule already exists.' });
    res.status(500).json({ success: false, message: 'Failed to create routing rule.' });
  }
});

router.put('/routing-rules/:id', async (req, res) => {
  try {
    const { department_id, priority_boost, keywords, is_active } = req.body;
    const result = await query(
      `UPDATE routing_rules SET
        department_id = COALESCE($1, department_id),
        priority_boost = COALESCE($2, priority_boost),
        keywords = COALESCE($3, keywords),
        is_active = COALESCE($4, is_active)
       WHERE id = $5 RETURNING *`,
      [department_id, priority_boost, keywords, is_active, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, message: 'Rule not found.' });
    res.json({ success: true, data: { rule: result.rows[0] } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update rule.' });
  }
});

router.delete('/routing-rules/:id', async (req, res) => {
  try {
    await query('DELETE FROM routing_rules WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'Routing rule deleted.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete rule.' });
  }
});

// ===================== SLA RULES =====================
router.get('/sla-rules', async (req, res) => {
  try {
    const result = await query(
      `SELECT sr.*, c.name AS category_name
       FROM sla_rules sr
       LEFT JOIN categories c ON sr.category_id = c.id
       WHERE sr.is_active = true
       ORDER BY c.name NULLS LAST, sr.priority_level ASC`
    );
    res.json({ success: true, data: { rules: result.rows } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch SLA rules.' });
  }
});

router.post('/sla-rules', async (req, res) => {
  try {
    const { category_id, priority_level, expected_hours } = req.body;
    if (!priority_level || !expected_hours) {
      return res.status(400).json({ success: false, message: 'Priority and expected hours are required.' });
    }
    const result = await query(
      `INSERT INTO sla_rules (category_id, priority_level, expected_hours)
       VALUES ($1, $2, $3) RETURNING *`,
      [category_id || null, priority_level, expected_hours]
    );
    res.status(201).json({ success: true, data: { rule: result.rows[0] } });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ success: false, message: 'SLA rule already exists for this category/priority.' });
    res.status(500).json({ success: false, message: 'Failed to create SLA rule.' });
  }
});

router.delete('/sla-rules/:id', async (req, res) => {
  try {
    await query('UPDATE sla_rules SET is_active = false WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'SLA rule deleted.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete SLA rule.' });
  }
});

// ===================== USER MANAGEMENT =====================
router.get('/users', async (req, res) => {
  try {
    const { role, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    let whereClause = 'WHERE 1=1';
    const params = [];
    if (role) { whereClause += ` AND u.role = $${params.length + 1}`; params.push(role); }

    const result = await query(
      `SELECT u.id, u.name, u.email, u.role, u.is_verified, u.is_active, u.created_at,
              ap.department_id, ap.badge_number, ap.is_verified AS authority_verified,
              d.name AS department_name
       FROM users u
       LEFT JOIN authority_profiles ap ON u.id = ap.user_id
       LEFT JOIN departments d ON ap.department_id = d.id
       ${whereClause}
       ORDER BY u.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, parseInt(limit), parseInt(offset)]
    );
    res.json({ success: true, data: { users: result.rows } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch users.' });
  }
});

// Verify authority
router.put('/users/:id/verify-authority', async (req, res) => {
  try {
    const { id } = req.params;
    await query(
      'UPDATE authority_profiles SET is_verified = true, verified_at = NOW(), verified_by = $1 WHERE user_id = $2',
      [req.user.id, id]
    );
    await query('UPDATE users SET is_verified = true WHERE id = $1', [id]);
    res.json({ success: true, message: 'Authority verified.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to verify authority.' });
  }
});

// Toggle user active status
router.put('/users/:id/toggle-status', async (req, res) => {
  try {
    const result = await query(
      'UPDATE users SET is_active = NOT is_active WHERE id = $1 RETURNING is_active, name',
      [req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, message: 'User not found.' });
    res.json({ success: true, message: `User ${result.rows[0].is_active ? 'activated' : 'deactivated'}.` });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update user status.' });
  }
});

// ===================== SLA MONITORING =====================
router.get('/sla-monitoring', async (req, res) => {
  try {
    const result = await query(`
      SELECT r.id, r.tracking_id, r.title, r.priority, r.status,
             r.submitted_at, r.sla_deadline,
             EXTRACT(EPOCH FROM (r.sla_deadline - NOW()))/3600 AS hours_remaining,
             r.sla_breached,
             d.name AS department_name,
             c.name AS category_name
      FROM reports r
      LEFT JOIN departments d ON r.assigned_department_id = d.id
      LEFT JOIN categories c ON r.category_id = c.id
      WHERE r.is_draft = false
        AND r.status NOT IN ('resolved', 'closed')
        AND r.sla_deadline IS NOT NULL
      ORDER BY r.sla_deadline ASC
      LIMIT 100
    `);

    // Update SLA breached status
    await query(`
      UPDATE reports SET sla_breached = true
      WHERE is_draft = false
        AND status NOT IN ('resolved', 'closed')
        AND sla_deadline < NOW()
        AND sla_breached = false
    `);

    res.json({ success: true, data: { reports: result.rows } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch SLA data.' });
  }
});

// ===================== ALL REPORTS (admin view) =====================
router.get('/reports', async (req, res) => {
  try {
    const { page = 1, limit = 20, status, category_id, department_id, priority } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE r.is_draft = false';
    const params = [];
    let pidx = 1;

    if (status) { whereClause += ` AND r.status = $${pidx++}`; params.push(status); }
    if (category_id) { whereClause += ` AND r.category_id = $${pidx++}`; params.push(category_id); }
    if (department_id) { whereClause += ` AND r.assigned_department_id = $${pidx++}`; params.push(department_id); }
    if (priority) { whereClause += ` AND r.priority = $${pidx++}`; params.push(priority); }

    const countResult = await query(`SELECT COUNT(*) FROM reports r ${whereClause}`, params);

    const result = await query(
      `SELECT r.*, c.name AS category_name, d.name AS department_name,
              CASE WHEN r.is_anonymous THEN 'Anonymous' ELSE u.name END AS reporter_name
       FROM reports r
       LEFT JOIN categories c ON r.category_id = c.id
       LEFT JOIN departments d ON r.assigned_department_id = d.id
       LEFT JOIN users u ON r.reporter_id = u.id
       ${whereClause}
       ORDER BY r.created_at DESC
       LIMIT $${pidx++} OFFSET $${pidx++}`,
      [...params, parseInt(limit), parseInt(offset)]
    );

    res.json({
      success: true,
      data: {
        reports: result.rows,
        total: parseInt(countResult.rows[0].count),
        page: parseInt(page),
        totalPages: Math.ceil(parseInt(countResult.rows[0].count) / limit),
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch reports.' });
  }
});

module.exports = router;
