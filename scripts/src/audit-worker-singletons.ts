// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Patch 345 — Verify critical workers have singleton protection.
import fs from "node:fs";
import path from "node:path";

const root = path.resolve("artifacts/api-server/src/workers");
const CRITICAL_PATTERNS = [/scheduler/i, /retention/i, /maintenance/i, /reconciliation/i, /validation/i, /self-healing/i];
const SINGLETON_MARKERS = ["clusterSingleton: true", "isSingleton", "SINGLETON_LOCK", "acquireLock"];
const findings: string[] = [];

if (!fs.existsSync(root)) {
  console.log("✅ No workers directory found — skipping");
  process.exit(0);
}

for (const entry of fs.readdirSync(root)) {
  if (!entry.endsWith(".ts")) continue;
  const full = path.join(root, entry);
  const src = fs.readFileSync(full, "utf8");
  if (!CRITICAL_PATTERNS.some((p) => p.test(entry))) continue;
  if (!SINGLETON_MARKERS.some((m) => src.includes(m))) {
    findings.push(`${path.relative(process.cwd(), full)}: critical worker should use singleton protection`);
  }
}

if (findings.length) {
  console.warn("⚠️  Worker singleton gaps (advisory):\n" + findings.join("\n"));
}
console.log(`✅ Worker singleton audit complete — ${findings.length} advisory findings`);
