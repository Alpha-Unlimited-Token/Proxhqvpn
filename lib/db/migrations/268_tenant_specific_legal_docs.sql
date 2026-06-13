CREATE TABLE IF NOT EXISTS patch_268_tenant_specific_legal_docs (
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

CREATE INDEX IF NOT EXISTS idx_patch_268_tenant_specific_legal_docs_tenant_status
  ON patch_268_tenant_specific_legal_docs(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_patch_268_tenant_specific_legal_docs_user_created
  ON patch_268_tenant_specific_legal_docs(user_id, created_at DESC);
