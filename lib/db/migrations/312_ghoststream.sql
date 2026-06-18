-- INVENTION 1: GhostStream™ — Adversarial Traffic Metamorphosis Engine
CREATE TABLE IF NOT EXISTS ghoststream_profiles (
  id                  TEXT        PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name                TEXT        NOT NULL UNIQUE,
  description         TEXT        NOT NULL,
  size_cdf            REAL[]      NOT NULL,
  iat_cdf             REAL[]      NOT NULL,
  burst_min_packets   INTEGER     NOT NULL DEFAULT 2,
  burst_max_packets   INTEGER     NOT NULL DEFAULT 12,
  burst_gap_min_ms    INTEGER     NOT NULL DEFAULT 50,
  burst_gap_max_ms    INTEGER     NOT NULL DEFAULT 800,
  dummy_pps           REAL        NOT NULL DEFAULT 0.5,
  hold_min_s          INTEGER     NOT NULL DEFAULT 30,
  hold_max_s          INTEGER     NOT NULL DEFAULT 120,
  enabled             BOOLEAN     NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO ghoststream_profiles (name, description, size_cdf, iat_cdf, burst_min_packets, burst_max_packets, dummy_pps, hold_min_s, hold_max_s) VALUES
('https_browse',    'Casual HTTPS browsing (mixed small/large)',
 ARRAY[0.35,0.48,0.58,0.65,0.70,0.74,0.77,0.80,0.83,0.86,0.88,0.90,0.92,0.94,0.95,0.96,0.97,0.98,0.99,1.00],
 ARRAY[0.10,0.22,0.35,0.46,0.55,0.63,0.70,0.76,0.81,0.85,0.88,0.91,0.93,0.95,0.96,0.97,0.98,0.99,0.995,1.00],
 2, 8, 0.3, 45, 90),
('video_stream',    'Video streaming (large dominant, low IAT variance)',
 ARRAY[0.02,0.04,0.06,0.08,0.10,0.12,0.14,0.16,0.18,0.20,0.25,0.30,0.40,0.55,0.70,0.80,0.90,0.96,0.99,1.00],
 ARRAY[0.05,0.12,0.20,0.30,0.42,0.54,0.63,0.71,0.78,0.84,0.88,0.91,0.94,0.96,0.97,0.98,0.99,0.995,0.998,1.00],
 8, 24, 0.1, 60, 120),
('ssh_interactive',  'Interactive SSH (small, irregular bursts)',
 ARRAY[0.55,0.70,0.80,0.87,0.91,0.94,0.96,0.97,0.98,0.985,0.99,0.993,0.996,0.997,0.998,0.999,0.9993,0.9996,0.9998,1.00],
 ARRAY[0.02,0.05,0.09,0.14,0.20,0.27,0.35,0.43,0.52,0.60,0.67,0.74,0.80,0.85,0.89,0.93,0.96,0.98,0.99,1.00],
 1, 4, 0.8, 30, 60),
('voip_call',       'VoIP/video call (fixed small, high regularity)',
 ARRAY[0.15,0.40,0.75,0.90,0.95,0.97,0.98,0.985,0.99,0.993,0.996,0.997,0.998,0.999,0.9993,0.9996,0.9998,0.9999,0.99995,1.00],
 ARRAY[0.02,0.10,0.60,0.85,0.92,0.95,0.97,0.98,0.985,0.99,0.993,0.995,0.997,0.998,0.999,0.9993,0.9996,0.9998,0.9999,1.00],
 4, 6, 1.5, 30, 90),
('gaming',          'Online gaming (small bursts, irregular)',
 ARRAY[0.30,0.55,0.72,0.82,0.88,0.92,0.94,0.96,0.97,0.98,0.985,0.99,0.993,0.995,0.997,0.998,0.999,0.9993,0.9997,1.00],
 ARRAY[0.08,0.18,0.30,0.42,0.54,0.64,0.72,0.79,0.84,0.88,0.92,0.95,0.97,0.98,0.99,0.993,0.996,0.998,0.999,1.00],
 2, 6, 1.0, 20, 45)
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS ghoststream_sessions (
  user_id          TEXT        NOT NULL,
  config_id        INTEGER     NOT NULL,
  current_profile  TEXT        NOT NULL REFERENCES ghoststream_profiles(id),
  profile_until    TIMESTAMPTZ NOT NULL,
  session_key      TEXT        NOT NULL,
  morphing_enabled BOOLEAN     NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, config_id)
);
CREATE INDEX IF NOT EXISTS idx_ghoststream_sessions_until ON ghoststream_sessions (profile_until);
