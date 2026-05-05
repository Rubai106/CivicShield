const Stripe = require('stripe');

if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY.includes('your_')) {
  console.warn('⚠️  Stripe secret key not configured. Payment features will be unavailable.');
}

module.exports = Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder');
