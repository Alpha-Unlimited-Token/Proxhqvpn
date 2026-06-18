-- Migration 303: ZTNA posture expiry (expiresAt column)
-- Device posture records expire after a configurable TTL.
-- The ztna-posture-expiry-worker.ts revokes expired records every 2 minutes.

ALTER TABLE ztna_devices
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

COMMENT ON COLUMN ztna_devices.expires_at IS
  'Posture expiry timestamp. Record is auto-revoked by worker after this time. NULL = no expiry.';

CREATE INDEX IF NOT EXISTS idx_ztna_devices_expires_at
  ON ztna_devices (expires_at)
  WHERE expires_at IS NOT NULL AND revoked = FALSE;
