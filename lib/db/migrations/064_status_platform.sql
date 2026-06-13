-- Patch 146: Public status platform
-- Idempotent: all statements use IF NOT EXISTS

CREATE TABLE IF NOT EXISTS status_incidents (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'investigating',
  impact TEXT NOT NULL DEFAULT 'minor',
  summary TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS status_components (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'operational',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
