const express = require('express');
const router = express.Router();
const { query } = require('../config/db');

router.get('/', async (req, res) => {
  try {
    const result = await query('SELECT id, name, description, contact_email, icon FROM departments ORDER BY name ASC');
    return res.json({ success: true, data: { departments: result.rows } });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch departments.' });
  }
});

module.exports = router;
