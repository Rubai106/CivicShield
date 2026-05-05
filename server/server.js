const path = require('path');
const dotenvResult = require('dotenv').config({ path: path.join(__dirname, '.env') });
if (dotenvResult.error) {
  console.warn('⚠️  Failed to load .env file:', dotenvResult.error.message);
}
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  },
});
require('./socket/chat.socket')(io);
global.io = io;
app.set('io', io);

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin: process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(compression());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: { success: false, message: 'Too many requests. Please try again later.' },
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { success: false, message: 'Too many login attempts.' },
});

app.use('/api', limiter);
app.use('/api/auth/login', authLimiter);

// ── Stripe webhook (must be raw body, registered BEFORE express.json) ─────────
app.post(
  '/api/webhooks/stripe',
  express.raw({ type: 'application/json' }),
  require('./routes/consultations.routes').stripeWebhook
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/reports', require('./routes/reports.routes'));
app.use('/api/categories', require('./routes/categories.routes'));
app.use('/api/departments', require('./routes/departments.routes'));
app.use('/api/admin', require('./routes/admin.routes'));
app.use('/api/chat', require('./routes/chat.routes'));
app.use('/api/comments', require('./routes/comments.routes'));
app.use('/api/notifications', require('./routes/notifications.routes'));
app.use('/api/consultations', require('./routes/consultations.routes'));

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'CivicShield API is running.' });
});

app.use((req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} not found.` });
});

app.use((err, req, res, next) => {
  console.error('Server error:', err);
  if (err.message === 'Invalid file type') {
    return res.status(400).json({ success: false, message: err.message });
  }
  return res.status(500).json({ success: false, message: 'Internal server error.' });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 CivicShield server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV}`);
});

module.exports = { app };
