-- Migration v5: Fix reports status CHECK constraint to match Title Case values used in application code
-- 1. Drop the old lowercase/underscore constraint
ALTER TABLE reports DROP CONSTRAINT IF EXISTS reports_status_check;

-- 2. Convert any existing lowercase/underscore rows to Title Case
UPDATE reports SET status = 'Draft'        WHERE status = 'draft';
UPDATE reports SET status = 'Submitted'    WHERE status = 'submitted';
UPDATE reports SET status = 'Under Review' WHERE status = 'under_review';
UPDATE reports SET status = 'Investigating' WHERE status = 'investigating';
UPDATE reports SET status = 'Resolved'     WHERE status = 'resolved';
UPDATE reports SET status = 'Closed'       WHERE status = 'closed';

-- 3. Add new constraint with Title Case values
ALTER TABLE reports ADD CONSTRAINT reports_status_check
  CHECK (status IN ('Draft', 'Submitted', 'Under Review', 'Investigating', 'Resolved', 'Closed'));
