CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(150)  NOT NULL,
  email         VARCHAR(255)  UNIQUE NOT NULL,
  password_hash VARCHAR(255)  NOT NULL,
  role          VARCHAR(20)   NOT NULL DEFAULT 'reporter'
                  CHECK (role IN ('reporter','authority','admin')),
  phone         VARCHAR(30),
  avatar_url    VARCHAR(600),
  is_verified   BOOLEAN       DEFAULT FALSE,
  is_active     BOOLEAN       DEFAULT TRUE,
  created_at    TIMESTAMPTZ   DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS departments (
  id            SERIAL PRIMARY KEY,
  name          VARCHAR(150)  UNIQUE NOT NULL,
  description   TEXT,
  contact_email VARCHAR(255),
  icon          VARCHAR(50)   DEFAULT 'department',
  created_at    TIMESTAMPTZ   DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categories (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(150)  UNIQUE NOT NULL,
  description TEXT,
  icon        VARCHAR(50)   DEFAULT 'tag',
  is_active   BOOLEAN       DEFAULT TRUE,
  created_at  TIMESTAMPTZ   DEFAULT NOW(),
  updated_at  TIMESTAMPTZ   DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS category_department_mappings (
  id            SERIAL PRIMARY KEY,
  category_id   INTEGER NOT NULL REFERENCES categories(id)  ON DELETE CASCADE,
  department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(category_id, department_id)
);

-- ── Reports ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS reports (
  id                    SERIAL PRIMARY KEY,
  tracking_id           VARCHAR(30)   UNIQUE NOT NULL,
  title                 VARCHAR(300)  NOT NULL,
  description           TEXT          NOT NULL,
  category_id           INTEGER       REFERENCES categories(id),
  reporter_id           INTEGER       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_anonymous          BOOLEAN       DEFAULT FALSE,
  incident_date         TIMESTAMPTZ,
  status                VARCHAR(30)   NOT NULL DEFAULT 'Draft'
                          CHECK (status IN ('Draft','Submitted','Under Review','Investigating','Resolved','Closed')),
  priority              VARCHAR(20)   DEFAULT 'Medium'
                          CHECK (priority IN ('Low','Medium','High','Critical')),
  is_draft              BOOLEAN       DEFAULT FALSE,
  assigned_department_id INTEGER      REFERENCES departments(id),
  location_text         TEXT,
  location_lat          DOUBLE PRECISION,
  location_lng          DOUBLE PRECISION,
  submitted_at          TIMESTAMPTZ,
  resolved_at           TIMESTAMPTZ,
  possible_duplicate_of INTEGER       REFERENCES reports(id),
  duplicate_status      VARCHAR(20)
                          CHECK (duplicate_status IN ('flagged','confirmed','dismissed')),
  created_at            TIMESTAMPTZ   DEFAULT NOW(),
  updated_at            TIMESTAMPTZ   DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS evidence (
  id          SERIAL PRIMARY KEY,
  report_id   INTEGER       NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  file_url    VARCHAR(800)  NOT NULL,
  file_name   VARCHAR(300),
  file_type   VARCHAR(100),
  file_size   INTEGER,
  hash_sha256 VARCHAR(64),
  public_id   VARCHAR(300),
  uploaded_at TIMESTAMPTZ   DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS report_status_history (
  id          SERIAL PRIMARY KEY,
  report_id   INTEGER       NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  from_status VARCHAR(30),
  to_status   VARCHAR(30)   NOT NULL,
  changed_by  INTEGER       REFERENCES users(id),
  note        TEXT,
  created_at  TIMESTAMPTZ   DEFAULT NOW()
);

-- ── Authority workflow ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS authority_review_requests (
  id                    SERIAL PRIMARY KEY,
  user_id               INTEGER       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status                VARCHAR(30)   NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending','approved','rejected','info_requested')),
  full_name             VARCHAR(150),
  official_email        VARCHAR(255),
  official_email_domain VARCHAR(100),
  phone                 VARCHAR(30),
  organization          VARCHAR(200),
  designation           VARCHAR(200),
  department_id         INTEGER       REFERENCES departments(id),
  department_type       VARCHAR(100),
  badge_number          VARCHAR(50),
  office_address        TEXT,
  document_url          VARCHAR(800),
  admin_note            TEXT,
  rejection_reason      TEXT,
  reviewed_by           INTEGER       REFERENCES users(id),
  reviewed_at           TIMESTAMPTZ,
  created_at            TIMESTAMPTZ   DEFAULT NOW(),
  updated_at            TIMESTAMPTZ   DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS authority_profiles (
  id                  SERIAL PRIMARY KEY,
  user_id             INTEGER       UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  department_id       INTEGER       REFERENCES departments(id),
  designation         VARCHAR(200),
  badge_number        VARCHAR(50),
  department_type     VARCHAR(100),
  office_address      TEXT,
  is_verified         BOOLEAN       DEFAULT FALSE,
  verified_at         TIMESTAMPTZ,
  verified_by         INTEGER       REFERENCES users(id),
  consultation_fee_cents INTEGER    NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ   DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   DEFAULT NOW()
);

-- ── SLA ───────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sla_rules (
  id              SERIAL PRIMARY KEY,
  department_id   INTEGER   UNIQUE REFERENCES departments(id) ON DELETE CASCADE,
  resolution_days INTEGER   NOT NULL DEFAULT 5,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ── Notifications & Audit ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notifications (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       VARCHAR(60)   NOT NULL DEFAULT 'general',
  title      VARCHAR(200),
  message    TEXT,
  report_id  INTEGER       REFERENCES reports(id) ON DELETE SET NULL,
  is_read    BOOLEAN       DEFAULT FALSE,
  read_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ   DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id          SERIAL PRIMARY KEY,
  actor_id    INTEGER       REFERENCES users(id),
  action      VARCHAR(100)  NOT NULL,
  target_type VARCHAR(60),
  target_id   INTEGER,
  details     JSONB,
  created_at  TIMESTAMPTZ   DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_reports_reporter       ON reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_reports_dept           ON reports(assigned_department_id);
CREATE INDEX IF NOT EXISTS idx_reports_status         ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_priority       ON reports(priority);
CREATE INDEX IF NOT EXISTS idx_reports_tracking       ON reports(tracking_id);
CREATE INDEX IF NOT EXISTS idx_reports_resolved_at    ON reports(resolved_at);
CREATE INDEX IF NOT EXISTS idx_evidence_report        ON evidence(report_id);
CREATE INDEX IF NOT EXISTS idx_status_history_report  ON report_status_history(report_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user     ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor       ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_authority_requests_user   ON authority_review_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_authority_requests_status ON authority_review_requests(status);

-- ── Seed data ─────────────────────────────────────────────────────────────────

INSERT INTO departments (name, description, contact_email, icon) VALUES
  ('Police Department',       'Handles public safety and crime incidents',  'police@civicshield.local', 'shield'),
  ('Cyber Crime Unit',        'Handles online and cyber incidents',         'cyber@civicshield.local',  'cpu'),
  ('Fire & Safety Department','Handles fire and hazard incidents',          'fire@civicshield.local',   'flame'),
  ('Infrastructure Department','Handles roads and utility issues',          'infra@civicshield.local',  'building'),
  ('Law Enforcement',         'Handles law enforcement operations',         'law@civicshield.local',    'badge'),
  ('Environmental Department','Handles environmental violations',           'env@civicshield.local',    'leaf'),
  ('General Administration',  'Handles general administrative matters',     'admin@civicshield.local',  'office')
ON CONFLICT (name) DO NOTHING;

INSERT INTO categories (name, description, icon) VALUES
  ('Harassment',             'Physical or verbal harassment incidents',    'alert'),
  ('Cybercrime',             'Online fraud, hacking, phishing incidents',  'cpu'),
  ('Safety Hazard',          'Immediate safety hazards',                   'triangle'),
  ('Violence',               'Physical violence incidents',                'alert-circle'),
  ('Environmental Violation','Environmental law violations',               'leaf'),
  ('Public Nuisance',        'Public disturbance and nuisance incidents',  'volume-2'),
  ('Infrastructure Issue',   'Road and public facility issues',            'building')
ON CONFLICT (name) DO NOTHING;

INSERT INTO category_department_mappings (category_id, department_id)
SELECT c.id, d.id FROM categories c, departments d
WHERE (c.name = 'Harassment'             AND d.name = 'Police Department')
   OR (c.name = 'Violence'               AND d.name = 'Police Department')
   OR (c.name = 'Cybercrime'             AND d.name = 'Cyber Crime Unit')
   OR (c.name = 'Safety Hazard'          AND d.name = 'Fire & Safety Department')
   OR (c.name = 'Infrastructure Issue'   AND d.name = 'Infrastructure Department')
   OR (c.name = 'Environmental Violation'AND d.name = 'Environmental Department')
   OR (c.name = 'Public Nuisance'        AND d.name = 'General Administration')
ON CONFLICT DO NOTHING;

-- Default SLA rules for all departments (5 days)
INSERT INTO sla_rules (department_id, resolution_days)
SELECT id, 5 FROM departments
ON CONFLICT (department_id) DO NOTHING;

-- ── Consultations & Payments ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS consultations (
  id                   SERIAL PRIMARY KEY,
  reporter_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  authority_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title                VARCHAR(200) NOT NULL DEFAULT 'Consultation Request',
  description          TEXT,
  scheduled_at         TIMESTAMPTZ,
  status               VARCHAR(20) NOT NULL DEFAULT 'Pending'
                         CHECK (status IN ('Pending','Confirmed','Cancelled','Completed')),
  payment_status       VARCHAR(20) NOT NULL DEFAULT 'Unpaid'
                         CHECK (payment_status IN ('Unpaid','Paid','Refunded')),
  checkout_session_id  VARCHAR(300),
  amount_cents         INTEGER NOT NULL DEFAULT 0,
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consultations_reporter  ON consultations(reporter_id);
CREATE INDEX IF NOT EXISTS idx_consultations_authority ON consultations(authority_id);
CREATE INDEX IF NOT EXISTS idx_consultations_status    ON consultations(status);

-- Seed users  (password for all: "password")
INSERT INTO users (name, email, password_hash, role, is_verified, is_active) VALUES
  ('Admin',     'admin@civicshield.gov',       '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/RK.PQvSie', 'admin',     TRUE, TRUE),
  ('Reporter',  'reporter@civicshield.local',  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/RK.PQvSie', 'reporter',  TRUE, TRUE),
  ('Authority', 'authority@civicshield.local', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/RK.PQvSie', 'authority', TRUE, TRUE)
ON CONFLICT (email) DO NOTHING;
