-- Patch 234: AI-generated investigation timeline
CREATE TABLE IF NOT EXISTS patch_234_ai_generated_investigation_timeline (
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

CREATE INDEX IF NOT EXISTS idx_patch_234_ai_generated_investigation_timeline_tenant_status
  ON patch_234_ai_generated_investigation_timeline(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_patch_234_ai_generated_investigation_timeline_user_created
  ON patch_234_ai_generated_investigation_timeline(user_id, created_at DESC);
