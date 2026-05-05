-- Migration: Consultations & Payment table
CREATE TABLE IF NOT EXISTS consultations (
  id                SERIAL PRIMARY KEY,
  reporter_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  authority_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title             VARCHAR(200) NOT NULL DEFAULT 'Consultation Request',
  description       TEXT,
  scheduled_at      TIMESTAMPTZ,
  status            VARCHAR(20) NOT NULL DEFAULT 'Pending'
                      CHECK (status IN ('Pending','Confirmed','Cancelled','Completed')),
  payment_status    VARCHAR(20) NOT NULL DEFAULT 'Unpaid'
                      CHECK (payment_status IN ('Unpaid','Paid','Refunded')),
  checkout_session_id VARCHAR(300),
  amount_cents      INTEGER NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);
