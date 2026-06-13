#!/usr/bin/env tsx
// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Seeds default ProxhqVPN-owned validation targets.
// Only ProxhqVPN-owned assets — no third-party targets ever.
import pg from "pg";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

interface SeedTarget {
  name: string;
  target_type: string;
  url?: string;
  host?: string;
  port?: number;
  environment: string;
  owned_by: string;
  allow_security_scans: boolean;
  allow_load_tests: boolean;
}

const DEFAULT_TARGETS: SeedTarget[] = [
  {
    name:                 "proxhqvpn-homepage",
    target_type:          "web",
    url:                  "https://proxhqvpn.com",
    environment:          "production",
    owned_by:             "alpha-unlimited-technologies",
    allow_security_scans: false, // enable manually after verifying ownership
    allow_load_tests:     false,
  },
  {
    name:                 "proxhqvpn-api",
    target_type:          "api",
    url:                  "https://proxhqvpn.com/api",
    environment:          "production",
    owned_by:             "alpha-unlimited-technologies",
    allow_security_scans: false,
    allow_load_tests:     false,
  },
  {
    name:                 "proxhqvpn-status",
    target_type:          "web",
    url:                  "https://status.proxhqvpn.com",
    environment:          "production",
    owned_by:             "alpha-unlimited-technologies",
    allow_security_scans: false,
    allow_load_tests:     false,
  },
  {
    name:                 "proxhqvpn-replit-dev",
    target_type:          "api",
    url:                  `https://${process.env.REPL_SLUG ?? "proxhqvpn"}.replit.app`,
    environment:          "development",
    owned_by:             "alpha-unlimited-technologies",
    allow_security_scans: false,
    allow_load_tests:     false,
  },
];

async function main() {
  console.log("Seeding validation targets…");

  // Ensure table exists
  await pool.query(`
    CREATE TABLE IF NOT EXISTS validation_targets (
      id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name                 TEXT NOT NULL,
      target_type          TEXT NOT NULL,
      url                  TEXT,
      host                 TEXT,
      port                 INTEGER,
      region               TEXT,
      environment          TEXT NOT NULL DEFAULT 'production',
      owned_by             TEXT,
      allow_security_scans BOOLEAN NOT NULL DEFAULT FALSE,
      allow_load_tests     BOOLEAN NOT NULL DEFAULT FALSE,
      enabled              BOOLEAN NOT NULL DEFAULT TRUE,
      metadata             JSONB DEFAULT '{}'::jsonb,
      created_at           TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // Seed WireGuard node targets from nodes table
  const nodeRows = await pool.query(`
    SELECT id, name, ip, region FROM nodes WHERE status = 'active' LIMIT 60
  `).catch(() => ({ rows: [] }));

  const wgTargets: SeedTarget[] = nodeRows.rows.map((n: any) => ({
    name:                 `wg-node-${n.name ?? n.id}`,
    target_type:          "wireguard",
    host:                 n.ip ?? undefined,
    environment:          "production",
    owned_by:             "alpha-unlimited-technologies",
    allow_security_scans: false,
    allow_load_tests:     false,
  }));

  const allTargets = [...DEFAULT_TARGETS, ...wgTargets];
  let created = 0;
  let skipped = 0;

  for (const t of allTargets) {
    const existing = await pool.query(
      "SELECT id FROM validation_targets WHERE name = $1",
      [t.name],
    );
    if (existing.rows.length > 0) {
      skipped++;
      continue;
    }

    await pool.query(`
      INSERT INTO validation_targets
        (name, target_type, url, host, environment, owned_by, allow_security_scans, allow_load_tests)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    `, [t.name, t.target_type, t.url ?? null, t.host ?? null, t.environment, t.owned_by, t.allow_security_scans, t.allow_load_tests]);
    created++;
    console.log(`  ✓ Created: ${t.name}`);
  }

  console.log(`\nDone — ${created} created, ${skipped} skipped (already exist).`);
  await pool.end();
}

main().catch(err => { console.error(err); process.exit(1); });
