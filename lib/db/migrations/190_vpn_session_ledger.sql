-- Patch 190: VPN session ledger
CREATE TABLE IF NOT EXISTS patch_190_vpn_session_ledger (
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

CREATE INDEX IF NOT EXISTS idx_patch_190_vpn_session_ledger_tenant_status
  ON patch_190_vpn_session_ledger(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_patch_190_vpn_session_ledger_user_created
  ON patch_190_vpn_session_ledger(user_id, created_at DESC);
