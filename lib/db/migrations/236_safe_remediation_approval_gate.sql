CREATE TABLE IF NOT EXISTS patch_236_safe_remediation_approval_gate (
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

CREATE INDEX IF NOT EXISTS idx_patch_236_safe_remediation_approval_gate_tenant_status
  ON patch_236_safe_remediation_approval_gate(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_patch_236_safe_remediation_approval_gate_user_created
  ON patch_236_safe_remediation_approval_gate(user_id, created_at DESC);
