const fs = require('fs');
const path = require('path');
const { pool } = require('./db');


const PATCHES = [

  `ALTER TABLE reports ADD COLUMN IF NOT EXISTS incident_date         TIMESTAMPTZ`,
  `ALTER TABLE reports ADD COLUMN IF NOT EXISTS resolved_at           TIMESTAMPTZ`,
  `ALTER TABLE reports ADD COLUMN IF NOT EXISTS priority              VARCHAR(20)  DEFAULT 'Medium'`,
  `ALTER TABLE reports ADD COLUMN IF NOT EXISTS possible_duplicate_of INTEGER      REFERENCES reports(id)`,
  `ALTER TABLE reports ADD COLUMN IF NOT EXISTS duplicate_status      VARCHAR(20)`,


  `DO $$ BEGIN
     ALTER TABLE reports ADD CONSTRAINT reports_status_check
       CHECK (status IN ('Draft','Submitted','Under Review','Investigating','Resolved','Closed'));
   EXCEPTION WHEN duplicate_object THEN NULL; END $$`,

  `DO $$ BEGIN
     ALTER TABLE reports ADD CONSTRAINT reports_priority_check
       CHECK (priority IN ('Low','Medium','High','Critical'));
   EXCEPTION WHEN duplicate_object THEN NULL; END $$`,

  `DO $$ BEGIN
     ALTER TABLE reports ADD CONSTRAINT reports_duplicate_status_check
       CHECK (duplicate_status IN ('flagged','confirmed','dismissed'));
   EXCEPTION WHEN duplicate_object THEN NULL; END $$`,


  `ALTER TABLE authority_review_requests ADD COLUMN IF NOT EXISTS official_email_domain VARCHAR(100)`,
  `ALTER TABLE authority_review_requests ADD COLUMN IF NOT EXISTS office_address        TEXT`,
  `ALTER TABLE authority_review_requests ADD COLUMN IF NOT EXISTS department_type       VARCHAR(100)`,
  `ALTER TABLE authority_review_requests ADD COLUMN IF NOT EXISTS document_url          VARCHAR(800)`,
  `ALTER TABLE authority_review_requests ADD COLUMN IF NOT EXISTS badge_number          VARCHAR(50)`,
  `ALTER TABLE authority_review_requests ADD COLUMN IF NOT EXISTS rejection_reason      TEXT`,


  `ALTER TABLE authority_profiles ADD COLUMN IF NOT EXISTS designation      VARCHAR(200)`,
  `ALTER TABLE authority_profiles ADD COLUMN IF NOT EXISTS badge_number     VARCHAR(50)`,
  `ALTER TABLE authority_profiles ADD COLUMN IF NOT EXISTS department_type  VARCHAR(100)`,
  `ALTER TABLE authority_profiles ADD COLUMN IF NOT EXISTS office_address   TEXT`,
  `ALTER TABLE authority_profiles ADD COLUMN IF NOT EXISTS is_verified      BOOLEAN DEFAULT FALSE`,
  `ALTER TABLE authority_profiles ADD COLUMN IF NOT EXISTS verified_at      TIMESTAMPTZ`,
  `ALTER TABLE authority_profiles ADD COLUMN IF NOT EXISTS verified_by      INTEGER REFERENCES users(id)`,
  `ALTER TABLE authority_profiles ADD COLUMN IF NOT EXISTS updated_at       TIMESTAMPTZ DEFAULT NOW()`,


  `ALTER TABLE notifications ADD COLUMN IF NOT EXISTS report_id INTEGER REFERENCES reports(id) ON DELETE SET NULL`,
  `ALTER TABLE notifications ADD COLUMN IF NOT EXISTS read_at   TIMESTAMPTZ`,


  `INSERT INTO sla_rules (department_id, resolution_days)
   SELECT id, 5 FROM departments
   ON CONFLICT (department_id) DO NOTHING`,
];

async function migrate() {
  try {
    console.log('🔄 Connecting to database...');
    await pool.query('SELECT 1');
    console.log('✅ Connected!\n');


    const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    console.log('🔄 Applying schema.sql...');
    await pool.query(sql);
    console.log('✅ schema.sql applied\n');

    console.log('🔄 Applying column patches...');
    for (const patch of PATCHES) {
      try {
        await pool.query(patch);
        const preview = patch.trim().replace(/\s+/g, ' ').substring(0, 70);
        console.log(`  ✓ ${preview}...`);
      } catch (err) {

        if (!err.message.includes('already exists') && !err.message.includes('duplicate')) {
          console.warn(`  ⚠  ${err.message}`);
        }
      }
    }

    console.log('\n✅ Migration completed successfully.');
    console.log('\nDefault accounts (password: "password"):');
    console.log('  Admin    : admin@civicshield.gov');
    console.log('  Reporter : reporter@civicshield.local');
    console.log('  Authority: authority@civicshield.local');

    process.exit(0);
  } catch (err) {
    console.error('\n❌ Migration failed:', err.message);
    if (err.detail) console.error('   Detail:', err.detail);
    process.exit(1);
  }
}

migrate();
