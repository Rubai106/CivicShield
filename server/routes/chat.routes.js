const express = require('express');
const router = express.Router();
const { query, pool } = require('../config/db');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

// Helper: get or create conversation between two users
// Always store lower id as participant_1 to keep unique constraint consistent
async function getOrCreateConversation(client, userA, userB) {
  const p1 = Math.min(userA, userB);
  const p2 = Math.max(userA, userB);

  const existing = await client.query(
    'SELECT id FROM conversations WHERE participant_1_id = $1 AND participant_2_id = $2',
    [p1, p2]
  );
  if (existing.rows[0]) return existing.rows[0].id;

  const created = await client.query(
    `INSERT INTO conversations (participant_1_id, participant_2_id, last_message_at)
     VALUES ($1, $2, NOW()) RETURNING id`,
    [p1, p2]
  );
  return created.rows[0].id;
}

// GET /api/chat/contacts — all conversations for current user
router.get('/contacts', async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await query(
      `SELECT
         c.id AS conversation_id,
         CASE WHEN c.participant_1_id = $1 THEN c.participant_2_id ELSE c.participant_1_id END AS partner_id,
         u.name AS partner_name,
         u.role AS partner_role,
         (SELECT dm.content FROM direct_messages dm WHERE dm.conversation_id = c.id ORDER BY dm.created_at DESC LIMIT 1) AS last_message,
         (SELECT COUNT(*) FROM direct_messages dm WHERE dm.conversation_id = c.id AND dm.sender_id != $1 AND dm.is_read = false) AS unread_count,
         c.last_message_at
       FROM conversations c
       JOIN users u ON u.id = CASE WHEN c.participant_1_id = $1 THEN c.participant_2_id ELSE c.participant_1_id END
       WHERE c.participant_1_id = $1 OR c.participant_2_id = $1
       ORDER BY c.last_message_at DESC NULLS LAST`,
      [userId]
    );
    return res.json({ success: true, data: { conversations: result.rows } });
  } catch (err) {
    console.error('Chat contacts error:', err);
    return res.status(500).json({ success: false, message: 'Failed to fetch contacts.' });
  }
});

// GET /api/chat/user/:userId — get user info for chat header
router.get('/user/:userId', async (req, res) => {
  try {
    const result = await query(
      'SELECT id, name, role FROM users WHERE id = $1 AND is_active = true',
      [req.params.userId]
    );
    if (!result.rows[0]) return res.status(404).json({ success: false, message: 'User not found.' });
    return res.json({ success: true, data: { user: result.rows[0] } });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to fetch user.' });
  }
});

// GET /api/chat/conversation/:userId — get message history + mark messages as read
router.get('/conversation/:userId', async (req, res) => {
  const client = await pool.connect();
  try {
    const myId = req.user.id;
    const theirId = parseInt(req.params.userId);

    const convId = await getOrCreateConversation(client, myId, theirId);

    // Mark their messages to me as read
    await client.query(
      `UPDATE direct_messages SET is_read = true
       WHERE conversation_id = $1 AND sender_id = $2 AND is_read = false`,
      [convId, theirId]
    );

    const messages = await client.query(
      `SELECT dm.id, dm.sender_id, dm.content, dm.is_read, dm.created_at,
              u.name AS sender_name
       FROM direct_messages dm
       JOIN users u ON u.id = dm.sender_id
       WHERE dm.conversation_id = $1
       ORDER BY dm.created_at ASC`,
      [convId]
    );

    return res.json({ success: true, data: { conversation_id: convId, messages: messages.rows } });
  } catch (err) {
    console.error('Get conversation error:', err);
    return res.status(500).json({ success: false, message: 'Failed to load conversation.' });
  } finally {
    client.release();
  }
});

// POST /api/chat/message/:userId — send a message
router.post('/message/:userId', async (req, res) => {
  const client = await pool.connect();
  try {
    const myId = req.user.id;
    const theirId = parseInt(req.params.userId);
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ success: false, message: 'Message content is required.' });
    }

    // Authority can only message reporters; reporters can only reply to authorities
    const them = await client.query(
      'SELECT id, name, role FROM users WHERE id = $1 AND is_active = true',
      [theirId]
    );
    if (!them.rows[0]) return res.status(404).json({ success: false, message: 'User not found.' });

    const convId = await getOrCreateConversation(client, myId, theirId);

    const inserted = await client.query(
      `INSERT INTO direct_messages (conversation_id, sender_id, content)
       VALUES ($1, $2, $3)
       RETURNING id, sender_id, content, is_read, created_at`,
      [convId, myId, content.trim()]
    );

    await client.query(
      'UPDATE conversations SET last_message_at = NOW() WHERE id = $1',
      [convId]
    );

    const message = {
      ...inserted.rows[0],
      sender_name: req.user.name,
      receiver_id: theirId,
    };

    // Emit real-time event to recipient
    const io = req.app.get('io');
    if (io) {
      io.to(`user_${theirId}`).emit('new_message', message);
    }

    return res.status(201).json({ success: true, data: { message } });
  } catch (err) {
    console.error('Send message error:', err);
    return res.status(500).json({ success: false, message: 'Failed to send message.' });
  } finally {
    client.release();
  }
});

module.exports = router;
