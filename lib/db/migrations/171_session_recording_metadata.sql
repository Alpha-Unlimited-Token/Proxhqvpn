-- Patch 171: Session recording metadata
CREATE TABLE IF NOT EXISTS patch_171_session_recording_metadata (
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

CREATE INDEX IF NOT EXISTS idx_patch_171_session_recording_metadata_tenant_status
  ON patch_171_session_recording_metadata(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_patch_171_session_recording_metadata_user_created
  ON patch_171_session_recording_metadata(user_id, created_at DESC);
