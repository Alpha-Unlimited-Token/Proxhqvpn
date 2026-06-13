-- Patch 59: Session anomalies table
-- Idempotent: all statements use IF NOT EXISTS

CREATE TABLE IF NOT EXISTS session_anomalies (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL,
  device_id TEXT,
  anomaly_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_session_anomalies_user_created
  ON session_anomalies(user_id, created_at DESC);
