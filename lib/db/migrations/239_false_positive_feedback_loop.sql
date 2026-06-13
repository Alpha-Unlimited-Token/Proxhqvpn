CREATE TABLE IF NOT EXISTS patch_239_false_positive_feedback_loop (
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

CREATE INDEX IF NOT EXISTS idx_patch_239_false_positive_feedback_loop_tenant_status
  ON patch_239_false_positive_feedback_loop(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_patch_239_false_positive_feedback_loop_user_created
  ON patch_239_false_positive_feedback_loop(user_id, created_at DESC);
