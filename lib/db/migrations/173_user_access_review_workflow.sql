-- Patch 173: User access review workflow
CREATE TABLE IF NOT EXISTS patch_173_user_access_review_workflow (
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

CREATE INDEX IF NOT EXISTS idx_patch_173_user_access_review_workflow_tenant_status
  ON patch_173_user_access_review_workflow(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_patch_173_user_access_review_workflow_user_created
  ON patch_173_user_access_review_workflow(user_id, created_at DESC);
