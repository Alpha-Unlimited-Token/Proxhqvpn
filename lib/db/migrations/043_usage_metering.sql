-- Patch 87: Usage metering table
-- Idempotent: all statements use IF NOT EXISTS

CREATE TABLE IF NOT EXISTS usage_meter_events (
  id UUID PRIMARY KEY,
  tenant_id UUID,
  user_id TEXT,
  metric TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit TEXT NOT NULL DEFAULT 'count',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usage_meter_events_user_metric
  ON usage_meter_events(user_id, metric, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_usage_meter_events_tenant_metric
  ON usage_meter_events(tenant_id, metric, created_at DESC);
