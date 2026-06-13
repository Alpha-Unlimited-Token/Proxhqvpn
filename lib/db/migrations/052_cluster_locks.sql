-- Patch 129: Distributed cluster locks
-- Idempotent: all statements use IF NOT EXISTS

CREATE TABLE IF NOT EXISTS cluster_locks (
  lock_key TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
