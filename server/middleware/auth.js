const jwt = require('jsonwebtoken');
const pool = require('../config/db');

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
      // For Sprint 1, authorities can access all reports (simplified)
      return next();
    }
    return res.status(403).json({ success: false, message: 'Access denied to this report' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
};

module.exports = { authenticate, authorize, canAccessReport };
