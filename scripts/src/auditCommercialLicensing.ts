// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Commercial License Audit — scan frontend source for dangerous route references
// that lack visible entitlement guards (RequireFeature / requiredFeatures).
import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const FRONTEND = path.join(ROOT, "artifacts/ghost-vpn/src");

const DANGEROUS_ROUTES = [
  "ghost-trap",
  "ghost-nodes",
  "ghost-node",
  "omega",
  "security-console",
  "command-center",
  "siem",
  "audit-chain",
  "compliance",
];

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    const stat = fs.statSync(full);
    return stat.isDirectory() ? walk(full) : [full];
  });
}

const findings: string[] = [];
const files = walk(FRONTEND).filter((f) => /\.(ts|tsx)$/.test(f));

for (const file of files) {
  const source = fs.readFileSync(file, "utf8");
  for (const route of DANGEROUS_ROUTES) {
    if (
      source.includes(`/${route}`) &&
      !source.includes("requiredFeatures") &&
      !source.includes("RequireFeature") &&
      !source.includes("hasFeature") &&
      !source.includes("useEntitlements")
    ) {
      findings.push(
        `${path.relative(ROOT, file)} — references /${route} without visible entitlement guard`,
      );
    }
  }
}

const report = [
  "# Commercial License Audit",
  "",
  `Generated: ${new Date().toISOString()}`,
  `Files scanned: ${files.length}`,
  "",
  findings.length ? "## ⚠️ Findings" : "## ✅ Passed",
  findings.length
    ? findings.map((f) => `- ${f}`).join("\n")
    : "No frontend route entitlement leaks found.",
].join("\n");

fs.writeFileSync(path.join(ROOT, "COMMERCIAL_LICENSE_AUDIT.md"), report);

if (findings.length) {
  console.error(report);
  process.exit(1);
}

console.log(report);
