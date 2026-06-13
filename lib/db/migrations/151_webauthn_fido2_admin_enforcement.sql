-- Patch 151: WebAuthn/FIDO2 admin enforcement
CREATE TABLE IF NOT EXISTS patch_151_webauthn_fido2_admin_enforcement (
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

CREATE INDEX IF NOT EXISTS idx_patch_151_webauthn_fido2_admin_enforcement_tenant_status
  ON patch_151_webauthn_fido2_admin_enforcement(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_patch_151_webauthn_fido2_admin_enforcement_user_created
  ON patch_151_webauthn_fido2_admin_enforcement(user_id, created_at DESC);
