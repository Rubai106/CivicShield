const express = require('express');
const router = express.Router();
const { query } = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');

// ===================== CHAT =====================

// GET /api/chat/conversations - List conversations
router.get('/conversations', authenticate, async (req, res) => {
  try {
    const result = await query(
      `SELECT DISTINCT ON (partner_id)
        CASE WHEN cm.sender_id = $1 THEN cm.receiver_id ELSE cm.sender_id END AS partner_id,
        u.name AS partner_name, u.email AS partner_email, u.role AS partner_role, u.avatar_url,
        cm.content AS last_message, cm.created_at AS last_message_time,
        (SELECT COUNT(*) FROM chat_messages WHERE receiver_id = $1 AND sender_id = partner_id AND is_read = false) AS unread_count
       FROM chat_messages cm
       JOIN users u ON u.id = CASE WHEN cm.sender_id = $1 THEN cm.receiver_id ELSE cm.sender_id END
       WHERE cm.sender_id = $1 OR cm.receiver_id = $1
       ORDER BY partner_id, cm.created_at DESC`,
      [req.user.id]
    );
    res.json({ success: true, data: { conversations: result.rows } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch conversations.' });
  }
});

// GET /api/chat/:partnerId - Get messages with a user
router.get('/:partnerId', authenticate, async (req, res) => {
  try {
    const { partnerId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    // Mark messages as read
    await query(
      'UPDATE chat_messages SET is_read = true, read_at = NOW() WHERE sender_id = $1 AND receiver_id = $2 AND is_read = false',
      [partnerId, req.user.id]
    );

    const result = await query(
      `SELECT cm.*, u.name AS sender_name, u.avatar_url AS sender_avatar
       FROM chat_messages cm
       JOIN users u ON u.id = cm.sender_id
       WHERE (cm.sender_id = $1 AND cm.receiver_id = $2)
          OR (cm.sender_id = $2 AND cm.receiver_id = $1)
       ORDER BY cm.created_at DESC
       LIMIT $3 OFFSET $4`,
      [req.user.id, partnerId, parseInt(limit), parseInt(offset)]
    );

    res.json({ success: true, data: { messages: result.rows.reverse() } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch messages.' });
  }
});

// POST /api/chat/:partnerId - Send message
router.post('/:partnerId', authenticate, async (req, res) => {
  try {
    const { partnerId } = req.params;
    const { content, report_id } = req.body;

    if (!content?.trim()) {
      return res.status(400).json({ success: false, message: 'Message content is required.' });
    }

    const partnerResult = await query('SELECT id, name FROM users WHERE id = $1', [partnerId]);
    if (!partnerResult.rows[0]) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const result = await query(
      `INSERT INTO chat_messages (sender_id, receiver_id, content, report_id)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.user.id, partnerId, content.trim(), report_id || null]
    );

    const message = await query(
      `SELECT cm.*, u.name AS sender_name, u.avatar_url AS sender_avatar
       FROM chat_messages cm JOIN users u ON u.id = cm.sender_id WHERE cm.id = $1`,
      [result.rows[0].id]
    );

    if (req.io) {
      req.io.to(`user_${partnerId}`).emit('new_message', message.rows[0]);
    }

    res.status(201).json({ success: true, data: { message: message.rows[0] } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to send message.' });
  }
});

module.exports = router;
