const express = require('express');
const router = express.Router();
const { query } = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const { createNotification } = require('../utils/helpers');

// ===================== COMMENTS =====================

// GET /api/comments/:reportId
router.get('/comments/:reportId', authenticate, async (req, res) => {
  try {
    const { reportId } = req.params;
    const result = await query(
      `SELECT c.*, u.name AS author_name, u.role AS author_role, u.avatar_url
       FROM comments c
       JOIN users u ON c.author_id = u.id
       WHERE c.report_id = $1 AND c.is_deleted = false
       ORDER BY c.created_at ASC`,
      [reportId]
    );
    res.json({ success: true, data: { comments: result.rows } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch comments.' });
  }
});

// POST /api/comments/:reportId
router.post('/comments/:reportId', authenticate, async (req, res) => {
  try {
    const { reportId } = req.params;
    const { content, is_internal = false, parent_id = null } = req.body;

    if (!content?.trim()) {
      return res.status(400).json({ success: false, message: 'Comment content is required.' });
    }

    // Verify access to report
    const reportResult = await query('SELECT * FROM reports WHERE id = $1', [reportId]);
    if (!reportResult.rows[0]) {
      return res.status(404).json({ success: false, message: 'Report not found.' });
    }

    const report = reportResult.rows[0];

    // Reporters can't post internal comments
    const internal = req.user.role === 'reporter' ? false : is_internal;

    const result = await query(
      `INSERT INTO comments (report_id, author_id, content, is_internal, parent_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [reportId, req.user.id, content.trim(), internal, parent_id]
    );

    const comment = await query(
      `SELECT c.*, u.name AS author_name, u.role AS author_role, u.avatar_url
       FROM comments c JOIN users u ON c.author_id = u.id WHERE c.id = $1`,
      [result.rows[0].id]
    );

    // Notify other participant
    const notifyUserId = req.user.role === 'reporter'
      ? report.assigned_authority_id
      : report.reporter_id;

    if (notifyUserId && notifyUserId !== req.user.id) {
      await createNotification(
        notifyUserId,
        'New Comment on Report',
        `${req.user.name} commented on report "${report.title}": "${content.substring(0, 80)}${content.length > 80 ? '...' : ''}"`,
        'new_comment',
        reportId
      );
    }

    // Emit via socket if available
    if (req.io) {
      req.io.to(`report_${reportId}`).emit('new_comment', comment.rows[0]);
    }

    res.status(201).json({ success: true, data: { comment: comment.rows[0] } });
  } catch (error) {
    console.error('Post comment error:', error);
    res.status(500).json({ success: false, message: 'Failed to post comment.' });
  }
});

// DELETE /api/comments/:commentId
router.delete('/comments/:commentId', authenticate, async (req, res) => {
  try {
    const { commentId } = req.params;
    const result = await query('SELECT * FROM comments WHERE id = $1', [commentId]);
    if (!result.rows[0]) {
      return res.status(404).json({ success: false, message: 'Comment not found.' });
    }
    if (result.rows[0].author_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized.' });
    }
    await query('UPDATE comments SET is_deleted = true WHERE id = $1', [commentId]);
    res.json({ success: true, message: 'Comment deleted.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete comment.' });
  }
});

module.exports = router;
