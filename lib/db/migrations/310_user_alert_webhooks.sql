-- X-1: Per-user outbound alert webhooks (Slack, PagerDuty, Discord, custom)
CREATE TABLE IF NOT EXISTS user_alert_webhooks (
  id           TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id      TEXT        NOT NULL,
  name         TEXT        NOT NULL,
  url          TEXT        NOT NULL,
  secret       TEXT        NOT NULL,
  events       TEXT[]      NOT NULL DEFAULT ARRAY['canary.triggered','darkweb.breach','beacon.alert'],
  enabled      BOOLEAN     NOT NULL DEFAULT true,
  last_fired   TIMESTAMPTZ,
  fire_count   INTEGER     NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_webhooks_user ON user_alert_webhooks (user_id);
