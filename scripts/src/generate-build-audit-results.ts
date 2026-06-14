// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Patch 348 — Generate BUILD_AND_AUDIT_RESULTS.md evidence report.
import { execSync } from "node:child_process";
import fs from "node:fs";

const COMMANDS = [
  "pnpm run audit:brand",
  "pnpm run audit:frontend-api",
  "pnpm run audit:route-validation",
  "pnpm run audit:worker-singletons",
  "pnpm run audit:env-domains",
  "pnpm run audit:public-data",
  "pnpm run typecheck:libs",
];

let md = `# BUILD_AND_AUDIT_RESULTS\n\nGenerated: ${new Date().toISOString()}\n\n`;

for (const cmd of COMMANDS) {
  md += `## \`${cmd}\`\n\n`;
  try {
    const out = execSync(cmd, { encoding: "utf8", stdio: "pipe", timeout: 120_000 });
    md += `**Status: PASSED**\n\n\`\`\`\n${out.slice(-6000)}\n\`\`\`\n\n`;
  } catch (err: any) {
    md += `**Status: FAILED**\n\n\`\`\`\n${String(err.stdout ?? "").slice(-3000)}${String(err.stderr ?? "").slice(-3000)}\n\`\`\`\n\n`;
    process.exitCode = 1;
  }
}

fs.writeFileSync("BUILD_AND_AUDIT_RESULTS.md", md);
console.log("Wrote BUILD_AND_AUDIT_RESULTS.md");
if (process.exitCode) console.error("One or more audit checks failed.");
