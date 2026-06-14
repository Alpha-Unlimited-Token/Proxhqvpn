// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Patch 341 — Flag route files that mount handlers without capability enforcement.
import fs from "node:fs";
import path from "node:path";

const routeRoot = path.resolve("artifacts/api-server/src/routes");
const capFile = path.resolve("artifacts/api-server/src/security/routeCapabilities.ts");
const caps = fs.existsSync(capFile) ? fs.readFileSync(capFile, "utf8") : "";
const findings: string[] = [];

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).flatMap((e) => {
    const f = path.join(dir, e);
    return fs.statSync(f).isDirectory() ? walk(f) : [f];
  });
}

for (const file of walk(routeRoot).filter((f) => /\.ts$/.test(f) && !f.includes("node_modules"))) {
  const src = fs.readFileSync(file, "utf8");
  if (!(/Router\s*\(/.test(src) && /router\.(get|post|put|patch|delete)\s*\(/.test(src))) continue;

  const routeName = path.basename(file, ".ts");
  const hasCap = src.includes("requireRbac") || src.includes("requireCapability") || caps.includes(routeName);
  const isPublic = file.includes("healthz") || file.includes("public") || routeName === "health";

  if (!hasCap && !isPublic) {
    findings.push(`${path.relative(process.cwd(), file)}: route file may lack capability enforcement`);
  }
}

if (findings.length) {
  console.warn("⚠️  Route capability coverage gaps:\n" + findings.join("\n"));
  // Warn only — not all routes require RBAC (e.g. public-facing ones)
}

console.log(`✅ Route capability audit complete — ${findings.length} advisory findings`);
