-- CivicShield Schema

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'reporter' CHECK (role IN ('reporter','authority','admin')),
  phone VARCHAR(30),
  avatar_url VARCHAR(600),
  is_verified BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS departments (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) UNIQUE NOT NULL,
  description TEXT,
  contact_email VARCHAR(255),
  icon VARCHAR(50) DEFAULT 'department',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) UNIQUE NOT NULL,
  description TEXT,
  icon VARCHAR(50) DEFAULT 'tag',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS category_department_mappings (
  id SERIAL PRIMARY KEY,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(category_id, department_id)
);

CREATE TABLE IF NOT EXISTS reports (
  id SERIAL PRIMARY KEY,
  tracking_id VARCHAR(30) UNIQUE NOT NULL,
  title VARCHAR(300) NOT NULL,
  description TEXT NOT NULL,
  category_id INTEGER REFERENCES categories(id),
  reporter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_anonymous BOOLEAN DEFAULT FALSE,
  incident_date TIMESTAMPTZ,
  status VARCHAR(30) NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('draft','submitted','under_review','investigating','resolved','closed')),
  is_draft BOOLEAN DEFAULT FALSE,
  assigned_department_id INTEGER REFERENCES departments(id),
  location_text TEXT,
  location_lat DOUBLE PRECISION,
  location_lng DOUBLE PRECISION,
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sprint-1 already has reports created; add incident_date for existing DBs too.
ALTER TABLE reports ADD COLUMN IF NOT EXISTS incident_date TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS evidence (
  id SERIAL PRIMARY KEY,
  report_id INTEGER NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  file_url VARCHAR(800) NOT NULL,
  file_name VARCHAR(300),
  file_type VARCHAR(100),
  file_size INTEGER,
  hash_sha256 VARCHAR(64),
  public_id VARCHAR(300),
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reports_reporter ON reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_reports_dept ON reports(assigned_department_id);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_tracking ON reports(tracking_id);
CREATE INDEX IF NOT EXISTS idx_evidence_report ON evidence(report_id);

-- Seed departments
INSERT INTO departments (name, description, contact_email, icon) VALUES
  ('Police Department','Handles public safety incidents','police@civicshield.local','shield'),
  ('Cyber Crime Unit','Handles online and cyber incidents','cyber@civicshield.local','cpu'),
  ('Fire & Safety Department','Handles fire and hazard incidents','fire@civicshield.local','flame'),
  ('Infrastructure Department','Handles roads and utility issues','infra@civicshield.local','building')
ON CONFLICT (name) DO NOTHING;

-- Seed categories
INSERT INTO categories (name, description, icon) VALUES
  ('Harassment','Physical or verbal harassment incidents','alert'),
  ('Cybercrime','Online fraud, hacking, phishing incidents','cpu'),
  ('Safety Hazard','Immediate safety hazards','triangle'),
  ('Infrastructure Issue','Road and public facility issues','building')
ON CONFLICT (name) DO NOTHING;

-- Seed mappings
INSERT INTO category_department_mappings (category_id, department_id)
SELECT c.id, d.id
FROM categories c, departments d
WHERE c.name = 'Harassment' AND d.name = 'Police Department'
ON CONFLICT DO NOTHING;

INSERT INTO category_department_mappings (category_id, department_id)
SELECT c.id, d.id
FROM categories c, departments d
WHERE c.name = 'Cybercrime' AND d.name = 'Cyber Crime Unit'
ON CONFLICT DO NOTHING;

INSERT INTO category_department_mappings (category_id, department_id)
SELECT c.id, d.id
FROM categories c, departments d
WHERE c.name = 'Safety Hazard' AND d.name = 'Fire & Safety Department'
ON CONFLICT DO NOTHING;

INSERT INTO category_department_mappings (category_id, department_id)
SELECT c.id, d.id
FROM categories c, departments d
WHERE c.name = 'Infrastructure Issue' AND d.name = 'Infrastructure Department'
ON CONFLICT DO NOTHING;

-- Seed users (password for both: password)
INSERT INTO users (name, email, password_hash, role, is_verified, is_active) VALUES
  ('Reporter', 'reporter@civicshield.local', '$2a$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'reporter', true, true),
  ('Authority', 'authority@civicshield.local', '$2a$12$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'authority', true, true)
ON CONFLICT (email) DO NOTHING;
