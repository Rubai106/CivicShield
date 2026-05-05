const express = require('express');
const router = express.Router();
const { query } = require('../config/db');
const { authenticate } = require('../middleware/auth');

// ── GET /api/notifications ────────────────────────────────────────────────────
router.get('/', authenticate, async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    const lim = Math.min(50, Math.max(1, parseInt(limit, 10)));

    const [listResult, countResult] = await Promise.all([
      query(
        `SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
        [req.user.id, lim]
      ),
      query(
        `SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false`,
        [req.user.id]
      ),
    ]);

    return res.json({
      success: true,
      data: {
        notifications: listResult.rows,
        unread_count: parseInt(countResult.rows[0].count, 10),
      },
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch notifications.' });
  }
});

// ── PUT /api/notifications/read-all ──────────────────────────────────────────
// Must be declared BEFORE /:id/read to avoid Express matching "read-all" as an id
router.put('/read-all', authenticate, async (req, res) => {
  try {
    await query(
      `UPDATE notifications SET is_read = true WHERE user_id = $1`,
      [req.user.id]
    );
    return res.json({ success: true, message: 'All notifications marked as read.' });
  } catch (error) {
    console.error('Mark all read error:', error);
    return res.status(500).json({ success: false, message: 'Failed to mark notifications as read.' });
  }
});

// ── PUT /api/notifications/:id/read ──────────────────────────────────────────
router.put('/:id/read', authenticate, async (req, res) => {
  try {
    const result = await query(
      `UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2 RETURNING *`,
      [req.params.id, req.user.id]
    );
    if (!result.rows[0]) {
      return res.status(404).json({ success: false, message: 'Notification not found.' });
    }
    return res.json({ success: true, data: { notification: result.rows[0] } });
  } catch (error) {
    console.error('Mark read error:', error);
    return res.status(500).json({ success: false, message: 'Failed to mark notification as read.' });
  }
});

module.exports = router;
