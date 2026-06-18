-- C-4: Two-person rule for high-risk terminal commands
CREATE TABLE IF NOT EXISTS privileged_command_approvals (
  id             TEXT        PRIMARY KEY,
  requested_by   TEXT        NOT NULL,
  command        TEXT        NOT NULL,
  target_host    TEXT        NOT NULL DEFAULT 'local',
  reason         TEXT        NOT NULL,
  status         TEXT        NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending','approved','denied','expired')),
  requested_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at     TIMESTAMPTZ NOT NULL,
  approved_by    TEXT,
  approved_at    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_cmd_approvals_status ON privileged_command_approvals (status, expires_at);
