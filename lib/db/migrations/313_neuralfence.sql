-- INVENTION 2: NeuralFence™ — Attacker Memory Graph with Temporal Decay Scoring
CREATE TABLE IF NOT EXISTS neuralfence_nodes (
  ip               TEXT        PRIMARY KEY,
  first_seen_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  event_count      INTEGER     NOT NULL DEFAULT 0,
  suspicion_score  REAL        NOT NULL DEFAULT 0,
  score_updated_at TIMESTAMPTZ,
  action           TEXT        NOT NULL DEFAULT 'allow'
                               CHECK (action IN ('allow','rate_limit','challenge','soft_block','hard_block')),
  action_updated_at TIMESTAMPTZ,
  manual_action    TEXT        CHECK (manual_action IN ('allow','rate_limit','challenge','soft_block','hard_block')),
  geo_country      TEXT,
  geo_asn          TEXT,
  isp              TEXT,
  is_tor_exit      BOOLEAN     NOT NULL DEFAULT false,
  is_datacenter    BOOLEAN     NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS neuralfence_events (
  id            BIGSERIAL   PRIMARY KEY,
  ip            TEXT        NOT NULL,
  event_type    TEXT        NOT NULL,
  base_weight   REAL        NOT NULL,
  occurred_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  node_id       INTEGER,
  raw_metadata  JSONB
);
CREATE INDEX IF NOT EXISTS idx_nf_events_ip_time ON neuralfence_events (ip, occurred_at DESC);

CREATE TABLE IF NOT EXISTS neuralfence_patterns (
  id            BIGSERIAL   PRIMARY KEY,
  ip            TEXT        NOT NULL,
  pattern_name  TEXT        NOT NULL,
  amplifier     REAL        NOT NULL,
  event_ids     INTEGER[]   NOT NULL DEFAULT '{}',
  detected_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_nf_patterns_ip ON neuralfence_patterns (ip, detected_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_nf_patterns_unique ON neuralfence_patterns (ip, pattern_name, (detected_at::date));
