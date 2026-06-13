-- Patch 145: Trust center documents
-- Idempotent: all statements use IF NOT EXISTS

CREATE TABLE IF NOT EXISTS trust_center_documents (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  document_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'published',
  storage_uri TEXT,
  summary TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  published_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
