const express = require('express');
const router = express.Router();
const { query } = require('../config/db');
const { authenticate, authorize } = require('../middleware/auth');
const stripe = require('../config/stripe');

// ── GET /api/consultations ────────────────────────────────────────────────────
// Reporter sees their own; authority sees ones assigned to them
router.get('/', authenticate, async (req, res) => {
  try {
    let sql, params;
    if (req.user.role === 'reporter') {
      sql = `
        SELECT c.*,
          u_a.name AS authority_name,
          d.name   AS department_name,
          ROUND(c.amount_cents / 100.0, 2) AS amount
        FROM consultations c
        JOIN users u_a ON u_a.id = c.authority_id
        LEFT JOIN authority_profiles ap ON ap.user_id = c.authority_id
        LEFT JOIN departments d ON d.id = ap.department_id
        WHERE c.reporter_id = $1
        ORDER BY c.created_at DESC`;
      params = [req.user.id];
    } else if (req.user.role === 'authority') {
      sql = `
        SELECT c.*,
          u_r.name AS reporter_name,
          ROUND(c.amount_cents / 100.0, 2) AS amount
        FROM consultations c
        JOIN users u_r ON u_r.id = c.reporter_id
        WHERE c.authority_id = $1
        ORDER BY c.created_at DESC`;
      params = [req.user.id];
    } else {
      // Admin sees all
      sql = `
        SELECT c.*,
          u_r.name AS reporter_name,
          u_a.name AS authority_name,
          ROUND(c.amount_cents / 100.0, 2) AS amount
        FROM consultations c
        JOIN users u_r ON u_r.id = c.reporter_id
        JOIN users u_a ON u_a.id = c.authority_id
        ORDER BY c.created_at DESC`;
      params = [];
    }
    const result = await query(sql, params);
    return res.json({ success: true, data: { consultations: result.rows } });
  } catch (error) {
    console.error('Get consultations error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch consultations.' });
  }
});

// ── GET /api/consultations/authorities ────────────────────────────────────────
// Returns verified authority users (for reporter to choose when creating)
router.get('/authorities', authenticate, authorize('reporter'), async (req, res) => {
  try {
    const result = await query(
      `SELECT u.id, u.name, u.email, d.name AS department_name,
              ROUND(COALESCE(ap.consultation_fee_cents, 0) / 100.0, 2) AS consultation_fee
       FROM users u
       LEFT JOIN authority_profiles ap ON ap.user_id = u.id
       LEFT JOIN departments d ON d.id = ap.department_id
       WHERE u.role = 'authority' AND u.is_verified = true
       ORDER BY d.name, u.name`,
      []
    );
    return res.json({ success: true, data: { authorities: result.rows } });
  } catch (error) {
    console.error('Get authorities error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch authorities.' });
  }
});

// ── POST /api/consultations ───────────────────────────────────────────────────
router.post('/', authenticate, authorize('reporter'), async (req, res) => {
  try {
    const { authority_id, title, description, scheduled_at } = req.body;
    if (!authority_id) {
      return res.status(400).json({ success: false, message: 'authority_id is required.' });
    }

    // Verify authority exists and is verified; read their fee from their profile
    const authCheck = await query(
      `SELECT u.id, COALESCE(ap.consultation_fee_cents, 0) AS fee_cents
       FROM users u
       LEFT JOIN authority_profiles ap ON ap.user_id = u.id
       WHERE u.id = $1 AND u.role = 'authority' AND u.is_verified = true`,
      [authority_id]
    );
    if (!authCheck.rows[0]) {
      return res.status(400).json({ success: false, message: 'Selected authority not found or not verified.' });
    }

    const amountCents = authCheck.rows[0].fee_cents;
    const result = await query(
      `INSERT INTO consultations (reporter_id, authority_id, title, description, scheduled_at, amount_cents)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [
        req.user.id, authority_id,
        title || 'Consultation Request',
        description || null,
        scheduled_at || null,
        amountCents,
      ]
    );
    return res.status(201).json({ success: true, data: { consultation: result.rows[0] } });
  } catch (error) {
    console.error('Create consultation error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create consultation.' });
  }
});

// ── PUT /api/consultations/:id/status ─────────────────────────────────────────
// Authority confirms / cancels / completes
router.put('/:id/status', authenticate, authorize('authority'), async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ['Confirmed', 'Cancelled', 'Completed'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status.' });
    }

    const check = await query(
      'SELECT * FROM consultations WHERE id = $1 AND authority_id = $2',
      [req.params.id, req.user.id]
    );
    if (!check.rows[0]) {
      return res.status(404).json({ success: false, message: 'Consultation not found.' });
    }

    const result = await query(
      'UPDATE consultations SET status = $1 WHERE id = $2 RETURNING *',
      [status, req.params.id]
    );
    return res.json({ success: true, data: { consultation: result.rows[0] } });
  } catch (error) {
    console.error('Update consultation status error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update status.' });
  }
});

// ── POST /api/consultations/:id/pay ──────────────────────────────────────────
// Reporter initiates Stripe Checkout Session
router.post('/:id/pay', authenticate, authorize('reporter'), async (req, res) => {
  try {
    const consultation = await query(
      'SELECT * FROM consultations WHERE id = $1 AND reporter_id = $2',
      [req.params.id, req.user.id]
    );
    if (!consultation.rows[0]) {
      return res.status(404).json({ success: false, message: 'Consultation not found.' });
    }

    const c = consultation.rows[0];
    if (c.payment_status === 'Paid') {
      return res.status(400).json({ success: false, message: 'Already paid.' });
    }
    if (c.amount_cents <= 0) {
      return res.status(400).json({ success: false, message: 'No payment required for this consultation.' });
    }

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: { name: c.title || 'Consultation' },
          unit_amount: c.amount_cents,
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${frontendUrl}/consultations?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontendUrl}/consultations?payment=cancelled`,
      metadata: { consultation_id: String(c.id) },
    });

    // Store session id so webhook can match it back
    await query(
      'UPDATE consultations SET checkout_session_id = $1 WHERE id = $2',
      [session.id, c.id]
    );

    return res.json({ success: true, data: { url: session.url } });
  } catch (error) {
    console.error('Create checkout session error:', error);
    return res.status(500).json({ success: false, message: 'Failed to initiate payment.' });
  }
});

module.exports = router;
