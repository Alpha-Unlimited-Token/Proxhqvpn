-- Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
-- Continuous Validation Framework — Phase 1 DB Migration
-- ProxhqVPN internal infrastructure testing only. No third-party targets.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS validation_targets (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL,
  target_type         TEXT NOT NULL CHECK (target_type IN ('web','api','vpn_node','wireguard','container','repository','dns','tls','synthetic')),
  url                 TEXT,
  host                TEXT,
  port                INTEGER,
  region              TEXT,
  environment         TEXT NOT NULL DEFAULT 'production',
  owned_by            TEXT,
  allow_security_scans BOOLEAN NOT NULL DEFAULT FALSE,
  allow_load_tests    BOOLEAN NOT NULL DEFAULT FALSE,
  enabled             BOOLEAN NOT NULL DEFAULT TRUE,
  metadata            JSONB DEFAULT '{}'::jsonb,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS validation_runs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_id       UUID REFERENCES validation_targets(id),
  run_type        TEXT NOT NULL CHECK (run_type IN ('zap','trivy','semgrep','dependency','tls','headers','uptime','wireguard','node_health','k6','synthetic','custom')),
  status          TEXT NOT NULL CHECK (status IN ('queued','running','passed','failed','warning','error')),
  tool_name       TEXT NOT NULL,
  tool_version    TEXT,
  commit_sha      TEXT,
  environment     TEXT,
  started_at      TIMESTAMPTZ DEFAULT NOW(),
  completed_at    TIMESTAMPTZ,
  duration_ms     INTEGER,
  score           INTEGER DEFAULT 0,
  max_score       INTEGER DEFAULT 100,
  severity        TEXT DEFAULT 'info',
  summary         TEXT,
  raw_output      JSONB DEFAULT '{}'::jsonb,
  sanitized_output JSONB DEFAULT '{}'::jsonb,
  finding_count   INTEGER DEFAULT 0,
  critical_count  INTEGER DEFAULT 0,
  high_count      INTEGER DEFAULT 0,
  medium_count    INTEGER DEFAULT 0,
  low_count       INTEGER DEFAULT 0,
  previous_hash   TEXT,
  result_hash     TEXT NOT NULL,
  metadata        JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS validation_findings (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id       UUID REFERENCES validation_runs(id),
  target_id    UUID REFERENCES validation_targets(id),
  title        TEXT NOT NULL,
  severity     TEXT NOT NULL,
  category     TEXT,
  description  TEXT,
  evidence     JSONB DEFAULT '{}'::jsonb,
  remediation  TEXT,
  status       TEXT DEFAULT 'open',
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  resolved_at  TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS validation_schedules (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_id         UUID REFERENCES validation_targets(id),
  run_type          TEXT NOT NULL,
  cron_expression   TEXT,
  interval_minutes  INTEGER,
  enabled           BOOLEAN DEFAULT TRUE,
  last_run_at       TIMESTAMPTZ,
  next_run_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS validation_trust_snapshots (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  score     INTEGER NOT NULL,
  max_score INTEGER NOT NULL DEFAULT 100,
  status    TEXT NOT NULL,
  metrics   JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_validation_targets_enabled_type
  ON validation_targets(enabled, target_type);

CREATE INDEX IF NOT EXISTS idx_validation_runs_target_started
  ON validation_runs(target_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_validation_runs_type_started
  ON validation_runs(run_type, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_validation_findings_status_severity
  ON validation_findings(status, severity, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_validation_schedules_enabled_next
  ON validation_schedules(enabled, next_run_at);
