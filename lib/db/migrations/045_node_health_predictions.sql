-- Patch 91: Node health predictions table
-- Idempotent: all statements use IF NOT EXISTS

CREATE TABLE IF NOT EXISTS node_health_predictions (
  id UUID PRIMARY KEY,
  node_id TEXT NOT NULL,
  health_score NUMERIC NOT NULL,
  failure_probability NUMERIC NOT NULL,
  prediction_window_minutes INTEGER NOT NULL,
  factors JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_node_health_predictions_node
  ON node_health_predictions(node_id, created_at DESC);
