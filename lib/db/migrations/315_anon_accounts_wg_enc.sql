-- Migration 315: Add AES-256-GCM envelope columns for anonymous account WireGuard keys.
-- wg_private_key is kept (nullable) during backfill, then constrained to sentinel.

ALTER TABLE anon_accounts
  ADD COLUMN IF NOT EXISTS wg_private_key_enc   TEXT,
  ADD COLUMN IF NOT EXISTS key_encryption_version TEXT NOT NULL DEFAULT 'v1';

-- After backfill (encrypted value moved to wg_private_key_enc), enforce that
-- the plaintext column is either NULL or holds the sentinel '__encrypted__'.
-- Run the UPDATE below first in production, then uncomment the constraint.
--
-- UPDATE anon_accounts
--   SET wg_private_key_enc = wg_private_key,   -- placeholder: real encrypt done in app
--       wg_private_key = '__encrypted__'
--   WHERE wg_private_key IS NOT NULL
--     AND wg_private_key != '__encrypted__';
--
-- ALTER TABLE anon_accounts
--   ADD CONSTRAINT chk_anon_wg_plaintext_removed
--   CHECK (wg_private_key IS NULL OR wg_private_key = '__encrypted__');

CREATE INDEX IF NOT EXISTS idx_anon_accounts_wg_enc
  ON anon_accounts (id)
  WHERE wg_private_key_enc IS NOT NULL;
