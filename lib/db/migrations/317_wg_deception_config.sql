-- Migration 317: WireGuard Deception Layer configuration table.
CREATE TABLE IF NOT EXISTS wg_deception_config (
  id                    SERIAL PRIMARY KEY,
  user_id               TEXT NOT NULL,
  real_wg_port          INTEGER NOT NULL DEFAULT 51280,
  decoy_port            INTEGER NOT NULL DEFAULT 51820,
  ghost_daemon_port     INTEGER NOT NULL DEFAULT 51821,
  wg_interface          TEXT NOT NULL DEFAULT 'wg0',
  firewall_backend      TEXT NOT NULL DEFAULT 'nftables',
  use_netns             BOOLEAN NOT NULL DEFAULT true,
  loop_count            INTEGER NOT NULL DEFAULT 8,
  tarpit_ms             INTEGER NOT NULL DEFAULT 3000,
  api_callback_url      TEXT,
  callback_psk_hint     TEXT,
  ghost_node_id         INTEGER,
  authorized_peer_cidrs JSONB,
  enabled               BOOLEAN NOT NULL DEFAULT false,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_wg_deception_user
  ON wg_deception_config (user_id);

CREATE INDEX IF NOT EXISTS idx_wg_deception_ghost_node
  ON wg_deception_config (ghost_node_id)
  WHERE ghost_node_id IS NOT NULL;
