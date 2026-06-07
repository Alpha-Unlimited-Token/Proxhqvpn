/**
 * ProxhqVPN — Full Codebase Collector
 * Generates CHATGPT-FULL-CODE.txt with every source file in the project.
 * Usage: node collect-all-code.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const OUT  = path.join(__dirname, "CHATGPT-FULL-CODE.txt");

const INCLUDE_DIRS = [
  // Standalone — the entire platform in one server file
  { dir: "standalone/src",            exts: [".ts"] },
  { dir: "standalone",                exts: [".mjs"], depth: 0 },
  // API Server — all 92 route files
  { dir: "artifacts/api-server/src",  exts: [".ts"] },
  // Frontend — all pages and components
  { dir: "artifacts/ghost-vpn/src",   exts: [".tsx", ".ts"] },
  // QuantumAudit frontend
  { dir: "artifacts/quantum-audit/src", exts: [".tsx", ".ts"] },
  // DB schema (all tables)
  { dir: "lib/db/src",                exts: [".ts"] },
  // API spec (OpenAPI contract)
  { dir: "lib/api-spec",              exts: [".yaml", ".yml", ".ts"] },
];

// Skip generated/vendor files
const SKIP_PATTERNS = [
  "node_modules", ".tsbuildinfo", "dist", ".git", "generated",
  "server.bundle.cjs", "collect-all-code.mjs",
];

function shouldSkip(p) {
  return SKIP_PATTERNS.some(s => p.includes(s));
}

function collectFiles(dir, exts, maxDepth = 99, currentDepth = 0) {
  const results = [];
  if (!fs.existsSync(dir) || currentDepth > maxDepth) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (shouldSkip(fullPath)) continue;
    if (entry.isDirectory()) {
      results.push(...collectFiles(fullPath, exts, maxDepth, currentDepth + 1));
    } else if (exts.some(ext => entry.name.endsWith(ext))) {
      results.push(fullPath);
    }
  }
  return results;
}

const PROMPT_HEADER = `╔══════════════════════════════════════════════════════════════════════════════╗
║     PROXHQVPN — COMPLETE SOURCE CODE DUMP FOR CHATGPT ANALYSIS              ║
║     © 2026 Alpha Unlimited Technologies LLC — CONFIDENTIAL                  ║
╚══════════════════════════════════════════════════════════════════════════════╝

This file contains the COMPLETE SOURCE CODE of the ProxhqVPN platform.
Please read the CHATGPT-ANALYSIS-PROMPT.txt file first for the full
analysis questions, then use this file as the code reference.

ANALYSIS REQUEST (repeated):
─────────────────────────────
1. List every specific improvement, fix, or addition you would recommend
   (technical, security, UX, performance, architecture — everything specific)

2. After all suggestions: give an HONEST, no-hype, realistic valuation:
   a) As a SaaS/subscription business (MRR potential)
   b) As an acquisition target (what would a cybersecurity company pay)
   c) As open-source (community/GitHub value)
   d) As IP/patents if novel engines are filed

3. Design a complete pricing tier structure:
   Tier A — VPN Only · Tier B — Security Suite · Tier C — Dev/Pentest Pro
   Tier D — Enterprise · Standalone one-time price
   Include monthly + yearly, individual + team/enterprise

4. Overall honest valuation: is this a $50K, $500K, or $5M+ project?
   Compare to real acquisitions. Be direct.

`;

let out = PROMPT_HEADER;
let totalFiles = 0;
let totalLines = 0;

for (const { dir, exts, depth } of INCLUDE_DIRS) {
  const absDir = path.join(ROOT, dir);
  const files  = collectFiles(absDir, exts, depth);
  for (const file of files.sort()) {
    const rel = path.relative(ROOT, file);
    let content;
    try { content = fs.readFileSync(file, "utf8"); } catch { continue; }
    const lines = content.split("\n").length;
    totalFiles++;
    totalLines += lines;
    const ext  = path.extname(file).replace(".", "");
    out += `\n${"═".repeat(80)}\n`;
    out += `FILE: ${rel}  (${lines} lines)\n`;
    out += `${"═".repeat(80)}\n`;
    out += `\`\`\`${ext}\n`;
    out += content;
    if (!content.endsWith("\n")) out += "\n";
    out += "```\n";
  }
}

out += `\n${"═".repeat(80)}\n`;
out += `END OF CODEBASE DUMP\n`;
out += `Total: ${totalFiles} files · ${totalLines.toLocaleString()} lines\n`;
out += `${"═".repeat(80)}\n`;

fs.writeFileSync(OUT, out, "utf8");
const sizeMb = (fs.statSync(OUT).size / 1024 / 1024).toFixed(2);
console.log(`✓ Written: CHATGPT-FULL-CODE.txt`);
console.log(`  Files:  ${totalFiles}`);
console.log(`  Lines:  ${totalLines.toLocaleString()}`);
console.log(`  Size:   ${sizeMb} MB`);
console.log(`\n  TIP: For ChatGPT, use the file upload feature (paperclip icon).`);
console.log(`  Claude can also analyze it directly from this file.`);
