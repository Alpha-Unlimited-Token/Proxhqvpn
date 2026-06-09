-- Migration: Encrypt WireGuard private keys and PSKs stored in user_wg_configs
-- Audit finding: Plaintext VPN keys/PSKs in DB — Critical severity (2026-06-09)
--
-- STEP 1: Add encrypted columns and sentinel default
ALTER TABLE user_wg_configs
  ADD COLUMN IF NOT EXISTS client_private_key_enc text,
  ADD COLUMN IF NOT EXISTS psk_key_enc             text,
  ADD COLUMN IF NOT EXISTS key_encryption_version  text DEFAULT 'v1';

-- STEP 2: Backfill encrypted columns from plaintext
-- NOTE: This must be run via the API server's backfill script (see below),
--       NOT directly in SQL, because AES-256-GCM requires the PROXHQ_MASTER_KEY_B64
--       environment variable which is not available in the DB session.
--
-- Run: pnpm --filter @workspace/api-server run backfill-wg-keys
--
-- STEP 3: After verifying backfill succeeded (all rows have client_private_key_enc NOT NULL),
--         replace plaintext column with sentinel:
-- UPDATE user_wg_configs SET client_private_key = '__encrypted__' WHERE client_private_key_enc IS NOT NULL;
-- UPDATE user_wg_configs SET psk_key = '__encrypted__' WHERE psk_key_enc IS NOT NULL;
--
-- STEP 4: After all code paths use encrypted columns, optionally drop plaintext:
-- ALTER TABLE user_wg_configs DROP COLUMN client_private_key;
-- ALTER TABLE user_wg_configs DROP COLUMN psk_key;
-- (Keep columns until all deploys confirm encrypted columns work end-to-end.)

-- STEP 5: Enable Row Level Security (separate from encryption — prevents cross-user reads at DB level)
-- Requires app to SET LOCAL app.current_user_id = $userId before queries in a transaction.
ALTER TABLE user_wg_configs ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if re-running this migration
DROP POLICY IF EXISTS user_wg_configs_owner_policy ON user_wg_configs;

CREATE POLICY user_wg_configs_owner_policy ON user_wg_configs
  USING (user_id = current_setting('app.current_user_id', true));

ALTER TABLE wg_peer_commands ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS wg_peer_commands_owner_policy ON wg_peer_commands;

CREATE POLICY wg_peer_commands_owner_policy ON wg_peer_commands
  USING (user_id = current_setting('app.current_user_id', true));
