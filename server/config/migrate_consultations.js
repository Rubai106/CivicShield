const fs = require('fs');
const path = require('path');
const { pool } = require('./db');

async function migrate() {
  try {
    console.log('🔄 Connecting to database...');
    await pool.query('SELECT 1');
    console.log('✅ Connected!');
    const sql = fs.readFileSync(path.join(__dirname, 'schema_consultations.sql'), 'utf8');
    console.log('🔄 Running consultations migration...');
    await pool.query(sql);
    console.log('✅ Consultations migration completed successfully');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  }
}

migrate();
