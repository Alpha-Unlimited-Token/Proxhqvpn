// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Patch 327 — Detect direct fetch('/api...') calls and double /api/api prefix risk.
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve("artifacts/ghost-vpn/src");
const violations: string[] = [];

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    const stat = fs.statSync(full);
    return stat.isDirectory() ? walk(full) : [full];
  });
}

for (const file of walk(ROOT).filter((f) => /\.(ts|tsx)$/.test(f))) {
  if (file.includes("lib/apiClient.ts")) continue;
  const source = fs.readFileSync(file, "utf8");

  // Direct fetch to /api (not routed through apiClient)
  if (/fetch\s*\(\s*[`'"]\/api/.test(source)) {
    violations.push(`${path.relative(process.cwd(), file)}: direct fetch('/api...) — use apiFetch from @/lib/apiClient`);
  }

  // Double-prefix risk (belt-and-suspenders; apiClient now strips these)
  if (/apiFetch\s*\([^)]*[`'"]\/api\/api/.test(source)) {
    violations.push(`${path.relative(process.cwd(), file)}: double /api/api prefix detected`);
  }
}

if (violations.length) {
  console.error("❌ Frontend API usage violations:\n" + violations.join("\n"));
  process.exit(1);
}

console.log(`✅ Frontend API usage audit passed (${walk(ROOT).filter((f) => /\.(ts|tsx)$/.test(f)).length} files scanned)`);
