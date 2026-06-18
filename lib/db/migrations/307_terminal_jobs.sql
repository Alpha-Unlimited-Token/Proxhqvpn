-- C-1: Persist terminal jobs to DB so they survive server restarts
CREATE TABLE IF NOT EXISTS terminal_jobs (
  id              TEXT        PRIMARY KEY,
  owner_user_id   TEXT        NOT NULL,
  command         TEXT        NOT NULL,
  ghost_mode      BOOLEAN     NOT NULL DEFAULT false,
  status          TEXT        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending','running','done','error','timeout')),
  stdout          TEXT,
  stderr          TEXT,
  exit_code       INTEGER,
  timeout_ms      INTEGER     NOT NULL DEFAULT 30000,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '24 hours'
);
CREATE INDEX IF NOT EXISTS idx_terminal_jobs_owner   ON terminal_jobs (owner_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_terminal_jobs_expires ON terminal_jobs (expires_at);
