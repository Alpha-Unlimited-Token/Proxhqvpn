-- X-2: Per-user WireGuard tunnel health and quality metrics
CREATE TABLE IF NOT EXISTS tunnel_quality_metrics (
  id            SERIAL      PRIMARY KEY,
  user_id       TEXT        NOT NULL,
  config_id     INTEGER     NOT NULL,
  node_id       INTEGER     NOT NULL,
  latency_ms    REAL,
  packet_loss   REAL,
  jitter_ms     REAL,
  bytes_sent    BIGINT      NOT NULL DEFAULT 0,
  bytes_recv    BIGINT      NOT NULL DEFAULT 0,
  handshake_at  TIMESTAMPTZ,
  measured_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tunnel_metrics_user ON tunnel_quality_metrics (user_id, measured_at DESC);
