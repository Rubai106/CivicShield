const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { query } = require('../config/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

const generateToken = (user) => {
  console.log('[auth] signing with secret length:', process.env.JWT_SECRET?.length, 'first 4:', process.env.JWT_SECRET?.slice(0, 4));
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// ── REGISTER ──────────────────────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role = 'reporter', phone } = req.body;

    if (!name || !email || !password)
      return res.status(400).json({ success: false, message: 'Name, email, and password are required.' });

    if (password.length < 8)
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters.' });

    const allowedRoles = ['reporter', 'authority'];
    const userRole = allowedRoles.includes(role) ? role : 'reporter';

    const existing = await query('SELECT id FROM users WHERE email = $1', [email.toLowerCase().trim()]);
    if (existing.rows.length > 0)
      return res.status(409).json({ success: false, message: 'Email already registered.' });

    const passwordHash = await bcrypt.hash(password, 12);

    // Authority accounts start INACTIVE — admin must approve first
    const isActive = userRole !== 'authority';

    const created = await query(
      `INSERT INTO users (name, email, password_hash, role, phone, is_active, is_verified)
       VALUES ($1, $2, $3, $4, $5, $6, false)
       RETURNING id, name, email, role, phone, is_verified, is_active, created_at`,
      [name.trim(), email.toLowerCase().trim(), passwordHash, userRole, phone || null, isActive]
    );

    const user = created.rows[0];

    // For authority: create a review request and notify all admins
    if (userRole === 'authority') {
      try {
        const { department_id, department_type, designation, badge_number, office_address } = req.body;
        await query(
          `INSERT INTO authority_review_requests
            (user_id, full_name, official_email, phone, department_id,
             department_type, designation, badge_number, office_address)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [user.id, name.trim(), email.toLowerCase().trim(), phone || null,
           department_id || null, department_type || null, designation || null,
           badge_number || null, office_address || null]
        );
        await query(
          `INSERT INTO notifications (user_id, type, title, message)
           SELECT id, 'new_authority_request', 'New Authority Request', $1
           FROM users WHERE role = 'admin'`,
          [`${name.trim()} has submitted an authority account request and is awaiting your review.`]
        );
      } catch (notifErr) {
        // Non-fatal — user is still created, just log the error
        console.error('Could not create review request (run npm run migrate:v2):', notifErr.message);
      }

      // Return without a token — authority must wait for approval
      return res.status(201).json({
        success: true,
        message: 'Account created. Please wait for admin approval before you can log in.',
        data: { pendingApproval: true },
      });
    }

    const token = generateToken(user);
    return res.status(201).json({
      success: true,
      message: 'Account created successfully.',
      data: { user, token },
    });
  } catch (error) {
    console.error('Register error:', error);
    return res.status(500).json({ success: false, message: 'Registration failed.' });
  }
});

// ── LOGIN ─────────────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ success: false, message: 'Email and password are required.' });

    const found = await query(
      'SELECT id, name, email, role, password_hash, is_verified, is_active, avatar_url FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );

    const user = found.rows[0];
    if (!user)
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });

    // Authority blocked until admin approves
    if (user.role === 'authority' && !user.is_active) {
      return res.status(403).json({
        success: false,
        message: 'Your account is pending admin approval. You will be notified once approved.',
      });
    }

    if (!user.is_active)
      return res.status(403).json({ success: false, message: 'Your account has been deactivated.' });

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch)
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });

    const token = generateToken(user);

    return res.json({
      success: true,
      message: 'Login successful.',
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          is_verified: user.is_verified,
          avatar_url: user.avatar_url,
        },
        token,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ success: false, message: 'Login failed.' });
  }
});

// ── ME ────────────────────────────────────────────────────────────────────────
router.get('/me', authenticate, async (req, res) => {
  try {
    return res.json({ success: true, data: { user: req.user } });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch profile.' });
  }
});

// ── UPDATE PROFILE ────────────────────────────────────────────────────────────
router.put('/profile', authenticate, async (req, res) => {
  try {
    const { name, phone, avatar_url } = req.body;
    const result = await query(
      `UPDATE users SET name = COALESCE($1, name), phone = COALESCE($2, phone),
       avatar_url = COALESCE($3, avatar_url), updated_at = NOW()
       WHERE id = $4
       RETURNING id, name, email, role, phone, avatar_url, is_verified, is_active`,
      [name || null, phone || null, avatar_url || null, req.user.id]
    );
    return res.json({ success: true, data: { user: result.rows[0] } });
  } catch (error) {
    console.error('Update profile error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update profile.' });
  }
});

// ── CHANGE PASSWORD ───────────────────────────────────────────────────────────
router.put('/change-password', authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword)
      return res.status(400).json({ success: false, message: 'Current and new password required.' });
    if (newPassword.length < 8)
      return res.status(400).json({ success: false, message: 'New password must be at least 8 characters.' });

    const found = await query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    const isMatch = await bcrypt.compare(currentPassword, found.rows[0].password_hash);
    if (!isMatch)
      return res.status(401).json({ success: false, message: 'Current password is incorrect.' });

    const newHash = await bcrypt.hash(newPassword, 12);
    await query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [newHash, req.user.id]);
    return res.json({ success: true, message: 'Password changed successfully.' });
  } catch (error) {
    console.error('Change password error:', error);
    return res.status(500).json({ success: false, message: 'Failed to change password.' });
  }
});

// ── ONBOARDING STATUS ─────────────────────────────────────────────────────────
router.get('/onboarding-status', authenticate, async (req, res) => {
  try {
    const [reqResult, profileResult] = await Promise.all([
      query(
        `SELECT arr.*, d.name AS department_name
         FROM authority_review_requests arr
         LEFT JOIN departments d ON d.id = arr.department_id
         WHERE arr.user_id = $1
         ORDER BY arr.created_at DESC LIMIT 1`,
        [req.user.id]
      ),
      query(
        `SELECT ap.*, d.name AS department_name
         FROM authority_profiles ap
         LEFT JOIN departments d ON d.id = ap.department_id
         WHERE ap.user_id = $1`,
        [req.user.id]
      ),
    ]);
    return res.json({
      success: true,
      data: {
        request: reqResult.rows[0] || null,
        profile: profileResult.rows[0] || null,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to fetch onboarding status.' });
  }
});

// ── SUBMIT / UPDATE ONBOARDING ────────────────────────────────────────────────
router.post('/onboard-authority', authenticate, async (req, res) => {
  try {
    if (req.user.role !== 'authority') {
      return res.status(403).json({ success: false, message: 'Only authority accounts can submit onboarding.' });
    }

    const {
      department_id, badge_number, designation, department_type,
      official_email_domain, office_address, document_url,
    } = req.body;

    if (!department_id) {
      return res.status(400).json({ success: false, message: 'Department is required.' });
    }

    // Check if a request already exists for this user
    const existing = await query(
      'SELECT id, status FROM authority_review_requests WHERE user_id = $1',
      [req.user.id]
    );

    // Block resubmission only if approved AND already has a department assigned
    if (existing.rows[0] && existing.rows[0].status === 'approved') {
      const profile = await query(
        'SELECT department_id FROM authority_profiles WHERE user_id = $1',
        [req.user.id]
      );
      if (profile.rows[0]?.department_id) {
        return res.status(400).json({ success: false, message: 'Your department is already assigned.' });
      }
    }

    if (existing.rows[0]) {
      // Update the existing request with detailed info
      await query(
        `UPDATE authority_review_requests SET
          department_id = $1, badge_number = $2, designation = $3,
          department_type = $4, official_email_domain = $5, office_address = $6,
          document_url = $7, status = 'pending', updated_at = NOW()
         WHERE user_id = $8`,
        [department_id, badge_number || null, designation || null, department_type || null,
         official_email_domain || null, office_address || null, document_url || null, req.user.id]
      );
    } else {
      // Create a new request
      await query(
        `INSERT INTO authority_review_requests
          (user_id, full_name, official_email, phone, department_id, badge_number,
           designation, department_type, official_email_domain, office_address, document_url)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [req.user.id, req.user.name, req.user.email, null, department_id,
         badge_number || null, designation || null, department_type || null,
         official_email_domain || null, office_address || null, document_url || null]
      );
    }

    // Notify admins
    await query(
      `INSERT INTO notifications (user_id, type, title, message)
       SELECT id, 'new_authority_request', 'Authority Onboarding Updated',
              $1 FROM users WHERE role = 'admin'`,
      [`${req.user.name} has updated their onboarding information and is awaiting review.`]
    ).catch(() => {});

    return res.json({ success: true, message: 'Onboarding submitted. Awaiting admin verification.' });
  } catch (error) {
    console.error('Onboard authority error:', error);
    return res.status(500).json({ success: false, message: 'Failed to submit onboarding.' });
  }
});

module.exports = router;