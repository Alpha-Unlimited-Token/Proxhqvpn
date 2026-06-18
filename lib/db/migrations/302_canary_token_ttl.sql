-- Migration 302: Canary token TTL (expiresAt column)
-- Allows tokens to auto-expire after a configurable duration.
-- The canary-token-cleanup-worker.ts enforces expiry every 5 minutes.

ALTER TABLE canary_tokens
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

COMMENT ON COLUMN canary_tokens.expires_at IS
  'Optional: token is deactivated by the cleanup worker after this timestamp. NULL = no expiry.';

CREATE INDEX IF NOT EXISTS idx_canary_tokens_expires_at
  ON canary_tokens (expires_at)
  WHERE expires_at IS NOT NULL AND active = TRUE;
