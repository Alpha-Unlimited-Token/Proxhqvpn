-- Migration 316: Add category column to notifications for multi-system event routing.
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'system'
    CHECK (category IN ('payment','security','vpn','system','compliance'));

CREATE INDEX IF NOT EXISTS idx_notifications_user_category
  ON notifications (user_id, category, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications (user_id, read, created_at DESC)
  WHERE read = false;
