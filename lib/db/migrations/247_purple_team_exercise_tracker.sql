CREATE TABLE IF NOT EXISTS patch_247_purple_team_exercise_tracker (
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

CREATE INDEX IF NOT EXISTS idx_patch_247_purple_team_exercise_tracker_tenant_status
  ON patch_247_purple_team_exercise_tracker(tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_patch_247_purple_team_exercise_tracker_user_created
  ON patch_247_purple_team_exercise_tracker(user_id, created_at DESC);
