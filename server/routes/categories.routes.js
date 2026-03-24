const express = require('express');
const router = express.Router();
const { query } = require('../config/db');

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

module.exports = router;
