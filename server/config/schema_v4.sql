-- Migration v4: Add report_id column to notifications table
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS report_id INTEGER REFERENCES reports(id) ON DELETE SET NULL;
