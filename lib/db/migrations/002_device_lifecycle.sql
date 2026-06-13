-- Patch 25: Device lifecycle events table
-- Idempotent: all statements use IF NOT EXISTS

CREATE TABLE IF NOT EXISTS device_lifecycle_events (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_device_lifecycle_user_device
  ON device_lifecycle_events(user_id, device_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_device_lifecycle_event_type
  ON device_lifecycle_events(event_type, created_at DESC);
