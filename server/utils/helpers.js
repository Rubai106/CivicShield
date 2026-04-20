const crypto = require('crypto');
const pool = require('../config/db');

const generateTrackingId = () => {
  const year = new Date().getFullYear();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `CS-${year}-${random}`;
};

const calculatePriority = (categoryName = '', description = '', mappingPriority = 'Low') => {
  const criticalKeywords = ['assault', 'murder', 'bomb', 'explosion', 'shooting', 'rape', 'kidnap', 'hostage', 'stabbing'];
  const highKeywords = ['attack', 'violence', 'theft', 'hacking', 'fraud', 'fire', 'injury', 'threat', 'urgent', 'weapon'];
  const mediumKeywords = ['harassment', 'damage', 'broken', 'illegal', 'complaint', 'stolen', 'abuse', 'scam'];
  const text = `${categoryName} ${description}`.toLowerCase();
  if (criticalKeywords.some(k => text.includes(k))) return 'Critical';
  if (highKeywords.some(k => text.includes(k))) return 'High';
  if (mediumKeywords.some(k => text.includes(k))) return 'Medium';
  return mappingPriority || 'Low';
};

const autoAssignDepartment = async (categoryId) => {
  if (!categoryId) return null;
  try {
    const { rows } = await pool.query(
      'SELECT department_id, priority_rule FROM category_department_mappings WHERE category_id = $1 LIMIT 1',
      [categoryId]
    );
    if (rows[0]) return { departmentId: rows[0].department_id, priorityRule: rows[0].priority_rule };
  } catch (err) {
    console.error('autoAssignDepartment error:', err.message);
  }
  return null;
};

const calculateSLADeadline = async (categoryId) => {
  if (!categoryId) return null;
  try {
    const { rows } = await pool.query(
      'SELECT hours_to_resolve FROM sla_rules WHERE category_id = $1 LIMIT 1',
      [categoryId]
    );
    if (rows[0]) {
      const deadline = new Date();
      deadline.setHours(deadline.getHours() + rows[0].hours_to_resolve);
      return deadline;
    }
  } catch (err) {
    console.error('calculateSLADeadline error:', err.message);
  }
  return null;
};

const createNotification = async (userId, title, message, type, reportId = null) => {
  try {
    await pool.query(
      'INSERT INTO notifications (user_id, type, title, message, report_id) VALUES ($1, $2, $3, $4, $5)',
      [userId, type || 'general', title, message, reportId]
    );
  } catch (err) {
    console.error('createNotification error:', err.message);
  }
};

const addTimeline = async (reportId, action, performedBy, performedByRole = null, details = null) => {
  try {
    await pool.query(
      `INSERT INTO report_timeline (report_id, action, performed_by, actor_id, actor_role, details)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [reportId, action, performedBy, performedBy, performedByRole, details]
    );
  } catch (err) {
    console.error('addTimeline error:', err.message);
  }
};

const checkDuplicates = async (reporterId, title, description, categoryId) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, tracking_id, title FROM reports
       WHERE reporter_id = $1 AND category_id = $2 AND is_draft = false
       AND created_at > NOW() - INTERVAL '24 hours'`,
      [reporterId, categoryId]
    );
    const normalize = (s) => s.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
    const wordsNew = normalize(`${title} ${description}`).split(/\s+/).filter(w => w.length > 3);
    const setNew = new Set(wordsNew);
    for (const existing of rows) {
      const wordsExist = normalize(existing.title).split(/\s+/).filter(w => w.length > 3);
      const intersection = wordsExist.filter(w => setNew.has(w)).length;
      if (intersection >= 3) return existing.id;
    }
  } catch (err) {
    console.error('checkDuplicates error:', err.message);
  }
  return null;
};

const computeFileHash = (buffer) => {
  return crypto.createHash('sha256').update(buffer).digest('hex');
};

const paginate = (page = 1, limit = 10) => {
  const p = Math.max(1, parseInt(page));
  const l = Math.min(50, Math.max(1, parseInt(limit)));
  return { offset: (p - 1) * l, limit: l };
};

module.exports = {
  generateTrackingId,
  calculatePriority,
  autoAssignDepartment,
  calculateSLADeadline,
  createNotification,
  addTimeline,
  checkDuplicates,
  computeFileHash,
  paginate,
};
