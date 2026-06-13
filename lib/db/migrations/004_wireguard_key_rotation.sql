-- Patch 31: WireGuard key rotation tracking
-- Idempotent: all statements use IF NOT EXISTS

CREATE TABLE IF NOT EXISTS wireguard_key_rotations (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  old_fingerprint TEXT,
  new_fingerprint TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wg_key_rotations_device
  ON wireguard_key_rotations(user_id, device_id, created_at DESC);
