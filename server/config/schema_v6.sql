-- Migration v6: Add consultation_fee_cents to authority_profiles
ALTER TABLE authority_profiles
  ADD COLUMN IF NOT EXISTS consultation_fee_cents INTEGER NOT NULL DEFAULT 0;
