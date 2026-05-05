const express = require('express');
const router = express.Router();
const { query } = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/', async (req, res) => {
  try {
    const result = await query(
      `SELECT DISTINCT ON (c.id)
              c.*, 
              d.name AS default_department
       FROM categories c
       LEFT JOIN category_department_mappings cdm ON cdm.category_id = c.id
       LEFT JOIN departments d ON d.id = cdm.department_id
       WHERE c.is_active = true
       ORDER BY c.id, c.name ASC`
    );

    return res.json({ success: true, data: { categories: result.rows } });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch categories.' });
  }
});

// ── Admin-only: create / update / delete ─────────────────────────────────────
router.post('/', authenticate, authorize('admin'), async (req, res) => {
  const { name, description } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, message: 'Category name is required.' });
  }
  try {
    const result = await query(
      'INSERT INTO categories (name, description) VALUES ($1, $2) RETURNING *',
      [name.trim(), description?.trim() || null]
    );
    return res.status(201).json({ success: true, data: { category: result.rows[0] } });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ success: false, message: 'A category with that name already exists.' });
    }
    return res.status(500).json({ success: false, message: 'Failed to create category.' });
  }
});

router.put('/:id', authenticate, authorize('admin'), async (req, res) => {
  const { id } = req.params;
  const { name, description, is_active } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, message: 'Category name is required.' });
  }
  try {
    const result = await query(
      `UPDATE categories
       SET name = $1, description = $2, is_active = COALESCE($3, is_active)
       WHERE id = $4 RETURNING *`,
      [name.trim(), description?.trim() || null, is_active ?? null, id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Category not found.' });
    }
    return res.json({ success: true, data: { category: result.rows[0] } });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ success: false, message: 'A category with that name already exists.' });
    }
    return res.status(500).json({ success: false, message: 'Failed to update category.' });
  }
});

router.delete('/:id', authenticate, authorize('admin'), async (req, res) => {
  const { id } = req.params;
  try {
    const inUse = await query(
      'SELECT 1 FROM reports WHERE category_id = $1 LIMIT 1',
      [id]
    );
    if (inUse.rowCount > 0) {
      return res.status(409).json({ success: false, message: 'Cannot delete a category that has associated reports.' });
    }
    const result = await query('DELETE FROM categories WHERE id = $1', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ success: false, message: 'Category not found.' });
    }
    return res.json({ success: true, message: 'Category deleted.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to delete category.' });
  }
});

module.exports = router;
