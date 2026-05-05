const jwt = require('jsonwebtoken');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { pool } = require('../config/db');

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { rows } = await pool.query(
      'SELECT id, name, email, role, is_verified FROM users WHERE id = $1 AND is_active = true',
      [decoded.id]
    );
    if (!rows[0]) return res.status(401).json({ success: false, message: 'User not found or deactivated' });
    req.user = rows[0];
    next();
  } catch (err) {
    console.error('[auth] JWT verify failed:', err.name, '—', err.message);
    console.error('[auth] JWT_SECRET length:', process.env.JWT_SECRET?.length, 'first 4:', process.env.JWT_SECRET?.slice(0, 4));
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Access denied: insufficient permissions' });
    }
    next();
  };
};

const canAccessReport = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = req.user;
    const { rows } = await pool.query('SELECT * FROM reports WHERE id = $1', [id]);
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Report not found' });
    req.report = rows[0];

    if (user.role === 'admin') return next();

    if (user.role === 'reporter' && rows[0].reporter_id === user.id) return next();

    if (user.role === 'authority') {
      // Authority can only access reports assigned to their department
      const { rows: profileRows } = await pool.query(
        'SELECT department_id FROM authority_profiles WHERE user_id = $1 LIMIT 1',
        [user.id]
      );
      const deptId = profileRows[0]?.department_id;
      if (!deptId) {
        return res.status(403).json({ success: false, message: 'Your department has not been assigned yet.' });
      }
      if (parseInt(rows[0].assigned_department_id) === parseInt(deptId)) return next();
      return res.status(403).json({ success: false, message: 'This report is not assigned to your department.' });
    }

    return res.status(403).json({ success: false, message: 'Access denied to this report' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { authenticate, authorize, canAccessReport };
