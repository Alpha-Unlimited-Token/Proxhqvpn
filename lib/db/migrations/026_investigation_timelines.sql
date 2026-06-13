-- Patch 63: Investigation timelines tables
-- Idempotent: all statements use IF NOT EXISTS

CREATE TABLE IF NOT EXISTS investigation_timelines (
  id UUID PRIMARY KEY,
  subject TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS investigation_timeline_events (
  id UUID PRIMARY KEY,
  timeline_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_investigation_timeline_events_timeline
  ON investigation_timeline_events(timeline_id, occurred_at ASC);
