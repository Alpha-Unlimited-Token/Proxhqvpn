// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Patch 346 — Detect placeholder domain strings left in source files.
import fs from "node:fs";
import path from "node:path";

const ROOTS = ["artifacts", "lib"].map((p) => path.resolve(p)).filter(fs.existsSync);
const FORBIDDEN = [
  /yourdomain\.com/i,
  /yourwebsite\.com/i,
  /example\.com/i,
  /api\.example/i,
  /localhost:3000(?!\d)/,  // 3000 specifically (common dev placeholder), not 30000+
];
const SKIP_DIRS = ["node_modules", "dist", ".git", "__pycache__"];
const findings: string[] = [];

function walk(dir: string): string[] {
  return fs.readdirSync(dir).flatMap((e) => {
    const f = path.join(dir, e);
    if (SKIP_DIRS.some((s) => f.includes(`/${s}/`) || f.endsWith(`/${s}`))) return [];
    return fs.statSync(f).isDirectory() ? walk(f) : [f];
  });
}

for (const root of ROOTS) {
  for (const file of walk(root).filter((f) => /\.(ts|tsx|js|jsx|md|env|yml|yaml)$/.test(f))) {
    let src: string;
    try { src = fs.readFileSync(file, "utf8"); } catch { continue; }
    for (const pattern of FORBIDDEN) {
      if (pattern.test(src)) {
        findings.push(`${path.relative(process.cwd(), file)}: placeholder domain/URL pattern "${pattern}"`);
        break;
      }
    }
  }
}

if (findings.length) {
  console.error("❌ Placeholder domain findings:\n" + findings.join("\n"));
  process.exit(1);
}
console.log("✅ Domain/env consistency audit passed");
