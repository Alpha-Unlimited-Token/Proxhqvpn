-- Patch 143: Privacy requests (GDPR/CCPA)
-- Idempotent: all statements use IF NOT EXISTS

CREATE TABLE IF NOT EXISTS privacy_requests (
  id UUID PRIMARY KEY,
  user_id TEXT,
  email TEXT,
  request_type TEXT NOT NULL,
  regulation TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
