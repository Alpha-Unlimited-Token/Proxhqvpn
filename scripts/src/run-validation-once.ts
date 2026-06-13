#!/usr/bin/env tsx
// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Run a single validation check from the CLI.
// Usage: tsx scripts/src/run-validation-once.ts --run-type uptime --target-name proxhqvpn-homepage
import pg from "pg";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

function arg(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  return idx !== -1 ? process.argv[idx + 1] : undefined;
}

const targetName = arg("target-name");
const targetId   = arg("target-id");
const runType    = arg("run-type") ?? "uptime";

if (!targetName && !targetId) {
  console.error("Usage: tsx scripts/src/run-validation-once.ts --run-type <type> [--target-name <name> | --target-id <uuid>]");
  console.error("Supported run-types: uptime tls headers wireguard synthetic dependency zap trivy semgrep k6");
  process.exit(1);
}

async function main() {
  // Find target
  const q = targetId
    ? "SELECT * FROM validation_targets WHERE id = $1::uuid"
    : "SELECT * FROM validation_targets WHERE name = $1";
  const rows = await pool.query(q, [targetId ?? targetName]);

  if (rows.rows.length === 0) {
    console.error(`Target not found: ${targetId ?? targetName}`);
    const all = await pool.query("SELECT name, id, target_type FROM validation_targets WHERE enabled = TRUE ORDER BY name").catch(() => ({ rows: [] }));
    console.log("Available targets:");
    for (const t of all.rows as any[]) console.log(`  ${t.name} (${t.target_type}) — ${t.id}`);
    process.exit(1);
  }

  const target = rows.rows[0] as any;
  console.log(`Running ${runType} on target: ${target.name} (${target.id})`);
  console.log(`  URL: ${target.url ?? target.host ?? "n/a"}`);
  console.log(`  Security scans: ${target.allow_security_scans ? "✓" : "✗"}`);

  // Inline run using HTTP call to the running API
  const apiBase = process.env.PROXHQ_API_URL ?? "http://localhost:80";
  const cookie  = process.env.PROXHQ_SESSION_COOKIE ?? "";

  try {
    const resp = await fetch(`${apiBase}/api/admin/validation/runs`, {
      method:  "POST",
      headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
      body:    JSON.stringify({ targetId: target.id, runType }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: resp.statusText }));
      console.error(`API error ${resp.status}: ${(err as any).error ?? resp.statusText}`);
      console.log("\nHint: Set PROXHQ_SESSION_COOKIE or PROXHQ_API_URL env vars for auth.");
      process.exit(1);
    }

    const result = await resp.json() as any;
    console.log(`\n✓ Queued — Run ID: ${result.runId}`);
    console.log(`  Poll: ${apiBase}/api/admin/validation/runs/${result.runId}`);

    // Poll for completion
    console.log("\nWaiting for completion…");
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 2000));
      const pollResp = await fetch(`${apiBase}/api/admin/validation/runs/${result.runId}`, {
        headers: { ...(cookie ? { Cookie: cookie } : {}) },
      });
      const run = await pollResp.json().catch(() => ({})) as any;
      if (run.status && run.status !== "queued" && run.status !== "running") {
        const statusEmoji = run.status === "passed" ? "✅" : run.status === "warning" ? "⚠️" : "❌";
        console.log(`\n${statusEmoji} ${run.status.toUpperCase()} — Score: ${run.score}/${run.max_score}`);
        if (run.summary) console.log(`  ${run.summary}`);
        if (run.result_hash) console.log(`  Hash: ${run.result_hash}`);
        console.log(`  Findings: ${run.finding_count} (critical: ${run.critical_count}, high: ${run.high_count})`);
        break;
      }
      process.stdout.write(".");
    }
  } catch (err: any) {
    console.error(`\nCould not reach API: ${err.message}`);
    console.log("Is the API server running? Set PROXHQ_API_URL if needed.");
    process.exit(1);
  }

  await pool.end();
}

main().catch(err => { console.error(err); process.exit(1); });
