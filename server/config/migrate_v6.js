require('dotenv').config();
const { query, pool } = require('./db');

async function migrateV6() {
  console.log('🔄 Connecting to database...');
  try {
    await pool.query('SELECT 1');
    console.log('📦 Connected to PostgreSQL\n✅ Connected!');
  } catch (err) {
    console.error('❌ Connection failed:', err.message);
    process.exit(1);
  }

  console.log('🔄 Running v6 migration: add consultation_fee_cents to authority_profiles...');
  try {
    await query(`
      ALTER TABLE authority_profiles
        ADD COLUMN IF NOT EXISTS consultation_fee_cents INTEGER NOT NULL DEFAULT 0
    `);
    console.log('✅ v6 migration completed successfully');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  }

  await pool.end();
  process.exit(0);
}

migrateV6();
