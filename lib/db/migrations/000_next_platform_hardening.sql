-- Patch 17: Platform hardening schema additions
-- Run once against the target database (idempotent: all statements use IF NOT EXISTS)

CREATE TABLE IF NOT EXISTS terminal_jobs (
  id UUID PRIMARY KEY,
  owner_user_id TEXT NOT NULL,
  command TEXT NOT NULL,
  ghost_mode BOOLEAN NOT NULL DEFAULT FALSE,
  timeout_ms INTEGER NOT NULL DEFAULT 15000,
  status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'completed', 'failed')),
  stdout TEXT NOT NULL DEFAULT '',
  stderr TEXT NOT NULL DEFAULT '',
  exit_code INTEGER,
  error TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_terminal_jobs_owner_created
  ON terminal_jobs(owner_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_terminal_jobs_status_created
  ON terminal_jobs(status, created_at);

CREATE TABLE IF NOT EXISTS audit_chain_verifications (
  id BIGSERIAL PRIMARY KEY,
  verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  checked_count INTEGER NOT NULL DEFAULT 0,
  first_broken_id TEXT,
  ok BOOLEAN NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS platform_events (
  id UUID PRIMARY KEY,
  type TEXT NOT NULL,
  actor TEXT,
  subject TEXT,
  severity TEXT NOT NULL DEFAULT 'info',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_platform_events_type_created
  ON platform_events(type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_platform_events_processed
  ON platform_events(processed_at)
  WHERE processed_at IS NULL;
