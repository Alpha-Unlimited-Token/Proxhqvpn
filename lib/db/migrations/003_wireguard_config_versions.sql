-- Patch 29: WireGuard config versioning table
-- Idempotent: all statements use IF NOT EXISTS

CREATE TABLE IF NOT EXISTS wireguard_config_versions (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  fingerprint TEXT NOT NULL,
  config TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_wireguard_config_versions_unique
  ON wireguard_config_versions(user_id, device_id, version);

CREATE INDEX IF NOT EXISTS idx_wireguard_config_versions_device
  ON wireguard_config_versions(user_id, device_id, created_at DESC);
