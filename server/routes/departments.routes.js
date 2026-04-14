const express = require('express');
const router = express.Router();
const { query } = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');

// GET /api/departments
router.get('/', async (req, res) => {
  try {
    const result = await query(
      `SELECT d.*,
              (SELECT COUNT(*) FROM reports r WHERE r.assigned_department_id = d.id AND r.is_draft = false) AS total_reports,
              (SELECT COUNT(*) FROM reports r WHERE r.assigned_department_id = d.id AND r.status = 'submitted') AS pending_reports,
              (SELECT COUNT(*) FROM authority_profiles ap WHERE ap.department_id = d.id AND ap.is_verified = true) AS authority_count
       FROM departments d
       ORDER BY d.name ASC`
    );
    res.json({ success: true, data: { departments: result.rows } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch departments.' });
  }
});

// GET /api/departments/:id
router.get('/:id', async (req, res) => {
  try {
    const result = await query('SELECT * FROM departments WHERE id = $1', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ success: false, message: 'Department not found.' });
    res.json({ success: true, data: { department: result.rows[0] } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch department.' });
  }
});

// POST /api/departments (admin only)
router.post('/', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { name, description, contact_email, contact_phone, icon, color } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'Name is required.' });

    const result = await query(
      `INSERT INTO departments (name, description, contact_email, contact_phone, icon, color)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [name, description, contact_email, contact_phone, icon || 'shield', color || '#3B82F6']
    );
    res.status(201).json({ success: true, data: { department: result.rows[0] } });
  } catch (error) {
    if (error.code === '23505') return res.status(409).json({ success: false, message: 'Department name already exists.' });
    res.status(500).json({ success: false, message: 'Failed to create department.' });
  }
});

// PUT /api/departments/:id (admin only)
router.put('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const { name, description, contact_email, contact_phone, icon, color } = req.body;
    const result = await query(
      `UPDATE departments SET
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        contact_email = COALESCE($3, contact_email),
        contact_phone = COALESCE($4, contact_phone),
        icon = COALESCE($5, icon),
        color = COALESCE($6, color)
       WHERE id = $7 RETURNING *`,
      [name, description, contact_email, contact_phone, icon, color, req.params.id]
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, message: 'Department not found.' });
    res.json({ success: true, data: { department: result.rows[0] } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update department.' });
  }
});

// DELETE /api/departments/:id (admin only)
router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  try {
    const reports = await query('SELECT COUNT(*) FROM reports WHERE assigned_department_id = $1', [req.params.id]);
    if (parseInt(reports.rows[0].count) > 0) {
      return res.status(400).json({ success: false, message: 'Cannot delete department with assigned reports.' });
    }
    await query('DELETE FROM departments WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'Department deleted.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete department.' });
  }
});

// GET /api/departments/:id/authorities (admin only)
router.get('/:id/authorities', authenticate, authorize('admin'), async (req, res) => {
  try {
    const result = await query(
      `SELECT u.id, u.name, u.email, u.is_verified, ap.badge_number, ap.designation, ap.is_verified AS profile_verified
       FROM users u
       JOIN authority_profiles ap ON u.id = ap.user_id
       WHERE ap.department_id = $1
       ORDER BY u.name ASC`,
      [req.params.id]
    );
    res.json({ success: true, data: { authorities: result.rows } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch authorities.' });
  }
});

module.exports = router;
