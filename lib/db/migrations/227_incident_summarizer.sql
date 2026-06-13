-- Patch 227: Incident summarizer
CREATE TABLE IF NOT EXISTS patch_227_incident_summarizer (
  id UUID PRIMARY KEY,
  tenant_id UUID,
  user_id TEXT,
  subject TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_patch_227_incident_summarizer_tenant_status
  ON patch_227_incident_summarizer(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_patch_227_incident_summarizer_user_created
  ON patch_227_incident_summarizer(user_id, created_at DESC);
