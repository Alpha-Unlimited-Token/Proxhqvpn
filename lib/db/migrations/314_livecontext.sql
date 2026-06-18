-- INVENTION 3: LiveContext™ — Intent-Runtime Correlation Engine
CREATE TABLE IF NOT EXISTS livecontext_sessions (
  id                  TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id             TEXT        NOT NULL,
  session_type        TEXT        NOT NULL CHECK (session_type IN ('terminal','sql','ssh','combined')),
  intent_text         TEXT,
  intent_keywords     TEXT[],
  intent_category     TEXT,
  started_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at            TIMESTAMPTZ,
  commands_run        INTEGER     NOT NULL DEFAULT 0,
  queries_run         INTEGER     NOT NULL DEFAULT 0,
  tables_accessed     TEXT[]      NOT NULL DEFAULT '{}',
  commands_blocked    INTEGER     NOT NULL DEFAULT 0,
  ips_contacted       TEXT[]      NOT NULL DEFAULT '{}',
  files_accessed      TEXT[]      NOT NULL DEFAULT '{}',
  divergence_score    REAL        NOT NULL DEFAULT 0,
  divergence_flags    JSONB       NOT NULL DEFAULT '[]',
  flagged_at          TIMESTAMPTZ,
  review_required     BOOLEAN     NOT NULL DEFAULT false,
  reviewed_by         TEXT,
  reviewed_at         TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_livecontext_user       ON livecontext_sessions (user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_livecontext_divergence ON livecontext_sessions (divergence_score DESC) WHERE divergence_score > 0;
CREATE INDEX IF NOT EXISTS idx_livecontext_review     ON livecontext_sessions (review_required) WHERE review_required = true;

CREATE TABLE IF NOT EXISTS livecontext_events (
  id          BIGSERIAL   PRIMARY KEY,
  session_id  TEXT        NOT NULL REFERENCES livecontext_sessions(id) ON DELETE CASCADE,
  event_type  TEXT        NOT NULL CHECK (event_type IN ('command','query','ssh_exec','file_read','ip_contact','block')),
  content     TEXT        NOT NULL,
  result      TEXT,
  exit_code   INTEGER,
  risk_weight REAL        NOT NULL DEFAULT 0,
  tables      TEXT[],
  ips         TEXT[],
  files       TEXT[],
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_livecontext_events_session ON livecontext_events (session_id, occurred_at);
