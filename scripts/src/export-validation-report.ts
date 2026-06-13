#!/usr/bin/env tsx
// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Exports validation results to VALIDATION_REPORT.json and VALIDATION_REPORT.md
import pg from "pg";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const outDir = process.cwd();

async function main() {
  console.log("Exporting validation report…");

  // Scorecard snapshot
  const snapshotRows = await pool.query(`
    SELECT score, max_score, status, metrics, created_at
    FROM validation_trust_snapshots ORDER BY created_at DESC LIMIT 1
  `).catch(() => ({ rows: [] }));
  const snapshot = snapshotRows.rows[0] as any;

  // Recent runs
  const runRows = await pool.query(`
    SELECT id, run_type, status, tool_name, tool_version, score, max_score,
           summary, finding_count, critical_count, high_count,
           started_at, completed_at, result_hash, previous_hash
    FROM validation_runs
    ORDER BY started_at DESC LIMIT 100
  `).catch(() => ({ rows: [] }));

  // Open findings (no raw evidence — safe for export)
  const findingRows = await pool.query(`
    SELECT id, title, severity, category, description, status, created_at
    FROM validation_findings WHERE status = 'open'
    ORDER BY CASE severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END, created_at DESC
    LIMIT 200
  `).catch(() => ({ rows: [] }));

  // Targets (no private keys or auth)
  const targetRows = await pool.query(`
    SELECT id, name, target_type, url, environment, owned_by, allow_security_scans, allow_load_tests, enabled, created_at
    FROM validation_targets ORDER BY created_at DESC
  `).catch(() => ({ rows: [] }));

  const report = {
    generated_at:       new Date().toISOString(),
    framework_version:  "1.0.0",
    commit_sha:         process.env.GIT_COMMIT ?? "unknown",
    environment:        "production",
    security_note:      "ProxhqVPN-owned systems only. No third-party targets. No raw scan output included.",
    scorecard:          snapshot ?? { status: "unknown", score: 0, max_score: 100 },
    run_summary: {
      total:    runRows.rows.length,
      passed:   runRows.rows.filter((r: any) => r.status === "passed").length,
      failed:   runRows.rows.filter((r: any) => r.status === "failed").length,
      warning:  runRows.rows.filter((r: any) => r.status === "warning").length,
      error:    runRows.rows.filter((r: any) => r.status === "error").length,
    },
    runs:     runRows.rows,
    findings: findingRows.rows,
    targets:  targetRows.rows,
  };

  // Compute report hash
  const hash = crypto.createHash("sha3-256")
    .update(JSON.stringify(report), "utf8").digest("hex");
  (report as any).report_hash = hash;

  // Write JSON
  const jsonPath = path.join(outDir, "VALIDATION_REPORT.json");
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  console.log(`✓ VALIDATION_REPORT.json — ${hash.slice(0, 16)}…`);

  // Write Markdown
  const snap   = report.scorecard as any;
  const status = snap.status ?? "unknown";
  const score  = snap.score  ?? 0;
  const max    = snap.max_score ?? 100;
  const pct    = max > 0 ? Math.round((score / max) * 100) : 0;

  const md = `# ProxhqVPN Validation Report

**Generated:** ${report.generated_at}
**Environment:** ${report.environment}
**Framework Version:** ${report.framework_version}
**Report Hash (SHA3-256):** \`${hash}\`

---

## Security Posture

| Field | Value |
|-------|-------|
| Status | **${status.toUpperCase()}** |
| Score | ${score} / ${max} (${pct}%) |
| Open Findings | ${report.findings.length} |
| Critical | ${report.findings.filter((f: any) => f.severity === "critical").length} |
| High | ${report.findings.filter((f: any) => f.severity === "high").length} |

---

## Run Summary (Last 100 Runs)

| Status | Count |
|--------|-------|
| Passed | ${report.run_summary.passed} |
| Failed | ${report.run_summary.failed} |
| Warning | ${report.run_summary.warning} |
| Error | ${report.run_summary.error} |

### By Type
${[...new Set(runRows.rows.map((r: any) => r.run_type))].map(t => {
  const typed = runRows.rows.filter((r: any) => r.run_type === t);
  const pass  = typed.filter((r: any) => r.status === "passed").length;
  return `- **${t}**: ${typed.length} runs, ${pass} passed`;
}).join("\n")}

---

## Targets

${report.targets.map((t: any) => `- **${t.name}** (${t.target_type}) — ${t.url ?? t.environment}`).join("\n")}

---

## Hash Chain Integrity

Every validation run includes:
- \`result_hash\` — SHA3-256 of the canonical run result
- \`previous_hash\` — links to the prior run forming an immutable chain
- Verify integrity: \`SELECT result_hash, previous_hash FROM validation_runs ORDER BY started_at\`

---

## Open Findings

${report.findings.length === 0
  ? "_No open findings._"
  : report.findings.slice(0, 20).map((f: any) =>
    `- [${f.severity.toUpperCase()}] **${f.title}** (${f.category ?? "general"}) — ${f.created_at.split("T")[0]}`
  ).join("\n")}
${report.findings.length > 20 ? `\n_…and ${report.findings.length - 20} more. See VALIDATION_REPORT.json._` : ""}

---

## Audit Notes

- All validation targets are ProxhqVPN-owned assets only
- Security scans require explicit \`allow_security_scans=true\` on each target
- Load tests require explicit \`allow_load_tests=true\` on each target
- Raw scan output is stored in the DB but not exported here
- Results are immutable once written — only status can be updated via admin routes

© ${new Date().getFullYear()} Alpha Unlimited Technologies LLC
`;

  const mdPath = path.join(outDir, "VALIDATION_REPORT.md");
  fs.writeFileSync(mdPath, md);
  console.log(`✓ VALIDATION_REPORT.md`);

  await pool.end();
  console.log("\nReport export complete.");
}

main().catch(err => { console.error(err); process.exit(1); });
