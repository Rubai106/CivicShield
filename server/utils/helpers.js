const pool = require('../config/db');

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

    if (rows[0]) {
      return { departmentId: rows[0].department_id };
    }
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

module.exports = {
  generateTrackingId,
  autoAssignDepartment,
  paginate,
};
