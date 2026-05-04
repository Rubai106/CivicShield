-- Add priority column to reports
ALTER TABLE reports ADD COLUMN IF NOT EXISTS priority VARCHAR(20) DEFAULT 'medium'
  CHECK (priority IN ('low', 'medium', 'high', 'critical'));

-- Add resolved_at column
ALTER TABLE reports ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;

-- Status history table
CREATE TABLE IF NOT EXISTS report_status_history (
  id SERIAL PRIMARY KEY,
  report_id INTEGER NOT NULL REFERENCES reports(id) ON DELETE CASCADE,
  from_status VARCHAR(30),
  to_status VARCHAR(30) NOT NULL,
  changed_by INTEGER REFERENCES users(id),
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Drop and recreate sla_rules cleanly
DROP TABLE IF EXISTS sla_rules CASCADE;
CREATE TABLE sla_rules (
  id SERIAL PRIMARY KEY,
  department_id INTEGER UNIQUE REFERENCES departments(id) ON DELETE CASCADE,
  resolution_days INTEGER NOT NULL DEFAULT 5,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default SLA for all departments
INSERT INTO sla_rules (department_id, resolution_days)
SELECT id, 5 FROM departments
ON CONFLICT (department_id) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_status_history_report ON report_status_history(report_id);
CREATE INDEX IF NOT EXISTS idx_reports_priority ON reports(priority);
CREATE INDEX IF NOT EXISTS idx_reports_resolved_at ON reports(resolved_at);
