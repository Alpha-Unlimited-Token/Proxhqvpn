-- Patch 35: Node bandwidth forecasts table
-- Idempotent: all statements use IF NOT EXISTS

CREATE TABLE IF NOT EXISTS node_bandwidth_forecasts (
  id UUID PRIMARY KEY,
  node_id TEXT NOT NULL,
  window_minutes INTEGER NOT NULL,
  observed_bytes BIGINT NOT NULL DEFAULT 0,
  forecast_bytes BIGINT NOT NULL DEFAULT 0,
  confidence NUMERIC NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_node_bandwidth_forecasts_node_created
  ON node_bandwidth_forecasts(node_id, created_at DESC);
