-- Patch 212: Incident postmortem service
CREATE TABLE IF NOT EXISTS patch_212_incident_postmortem_service (
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

CREATE INDEX IF NOT EXISTS idx_patch_212_incident_postmortem_service_tenant_status
  ON patch_212_incident_postmortem_service(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_patch_212_incident_postmortem_service_user_created
  ON patch_212_incident_postmortem_service(user_id, created_at DESC);
