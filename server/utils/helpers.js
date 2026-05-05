const { pool } = require('../config/db');

// ── Priority scoring ──────────────────────────────────────────────────────────
// Values MUST match DB CHECK constraint: 'Low','Medium','High','Critical'
const CATEGORY_PRIORITY = {
  'harassment':              'Critical',
  'cybercrime':              'Critical',
  'cyber crime':             'Critical',
  'violence':                'Critical',
  'safety hazard':           'High',
  'infrastructure issue':    'Medium',
  'environmental violation': 'Low',
  'public nuisance':         'Low',
};

const CRITICAL_KEYWORDS = [
  'fire', 'explosion', 'emergency', 'murder', 'rape', 'bomb',
  'terrorist', 'attack', 'assault', 'kidnap', 'bleeding', 'dead',
  'fatal', 'danger', 'urgent', 'shooting', 'stabbing', 'hostage',
];

const HIGH_KEYWORDS = ['fight', 'injured', 'accident', 'collapse', 'flood', 'robbery'];

const PRIORITY_RANK = { Low: 0, Medium: 1, High: 2, Critical: 3 };

const computePriority = async (categoryId, description) => {
  // Rule 1 — category sets the BASE priority (unknown/missing category → Medium)
  let base = 'Medium';
  if (categoryId) {
    try {
      const { rows } = await pool.query('SELECT name FROM categories WHERE id = $1', [categoryId]);
      const mapped = CATEGORY_PRIORITY[rows[0]?.name?.toLowerCase()];
      if (mapped) base = mapped;
    } catch { /* non-fatal — keep Medium */ }
  }

  let rank = PRIORITY_RANK[base];

  // Rule 2 — keywords can only INCREASE priority (Critical > High hierarchy)
  if (description) {
    const lower = description.toLowerCase();
    if (CRITICAL_KEYWORDS.some(kw => lower.includes(kw))) {
      rank = Math.max(rank, PRIORITY_RANK.Critical);
    } else if (HIGH_KEYWORDS.some(kw => lower.includes(kw))) {
      rank = Math.max(rank, PRIORITY_RANK.High);
    }
  }

  return Object.keys(PRIORITY_RANK).find(k => PRIORITY_RANK[k] === rank);
};

const generateTrackingId = () => {
  const year = new Date().getFullYear();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `CS-${year}-${random}`;
};

const autoAssignDepartment = async (categoryId) => {
  if (!categoryId) return null;
  try {
    const { rows } = await pool.query(
      'SELECT department_id FROM category_department_mappings WHERE category_id = $1 LIMIT 1',
      [categoryId]
    );
    if (rows[0]) return { departmentId: rows[0].department_id };
  } catch (err) {
    console.error('autoAssignDepartment error:', err.message);
  }
  return null;
};

const paginate = (page = 1, limit = 10) => {
  const p = Math.max(1, parseInt(page, 10));
  const l = Math.min(50, Math.max(1, parseInt(limit, 10)));
  return { offset: (p - 1) * l, limit: l };
};

const createNotification = async (userId, title, message, type, reportId) => {
  if (!userId) return;
  try {
    const result = await pool.query(
      `INSERT INTO notifications (user_id, title, message, type, report_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [userId, title, message, type, reportId || null]
    );
    // Push real-time notification to the recipient's socket room
    if (global.io && result.rows[0]) {
      global.io.to(`user_${userId}`).emit('notification', result.rows[0]);
    }
  } catch {
    // Silently skip if notifications table doesn't exist yet
  }
};

module.exports = { generateTrackingId, autoAssignDepartment, paginate, createNotification, computePriority };
