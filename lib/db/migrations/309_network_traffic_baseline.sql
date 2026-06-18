-- C-7: Per-node traffic baselines for anomaly detection
CREATE TABLE IF NOT EXISTS network_traffic_baseline (
  id              SERIAL      PRIMARY KEY,
  node_id         INTEGER     NOT NULL,
  metric          TEXT        NOT NULL,
  hour_of_week    SMALLINT    NOT NULL CHECK (hour_of_week BETWEEN 0 AND 167),
  baseline_value  REAL        NOT NULL,
  stddev_value    REAL        NOT NULL DEFAULT 0,
  sample_count    INTEGER     NOT NULL DEFAULT 0,
  last_updated    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (node_id, metric, hour_of_week)
);
CREATE INDEX IF NOT EXISTS idx_baseline_node_metric ON network_traffic_baseline (node_id, metric);
