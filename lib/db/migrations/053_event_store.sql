-- Patch 130: Event store for event sourcing
-- Idempotent: all statements use IF NOT EXISTS

CREATE TABLE IF NOT EXISTS event_store (
  id UUID PRIMARY KEY,
  stream_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  version INTEGER NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(stream_id, version)
);

CREATE INDEX IF NOT EXISTS idx_event_store_stream
  ON event_store(stream_id, version ASC);

CREATE INDEX IF NOT EXISTS idx_event_store_type_created
  ON event_store(event_type, created_at DESC);
