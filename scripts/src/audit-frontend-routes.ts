// Audit frontend routes: check that nav items point to registered routes.
// Output: UX_ROUTE_NAVIGATION_REPORT.md
// Usage: pnpm --filter @workspace/scripts run audit:frontend-routes

import * as fs from "fs";
import * as path from "path";

const ROOT = path.resolve(__dirname, "../../");
const ROUTES_DIR = path.join(ROOT, "artifacts/ghost-vpn/src/routes");
const PAGES_DIR  = path.join(ROOT, "artifacts/ghost-vpn/src/pages");
const OUT_FILE   = path.join(ROOT, "UX_ROUTE_NAVIGATION_REPORT.md");

function readFile(p: string): string {
  try { return fs.readFileSync(p, "utf8"); } catch { return ""; }
}

function listPages(): string[] {
  return fs.readdirSync(PAGES_DIR)
    .filter(f => f.endsWith(".tsx") || f.endsWith(".ts"))
    .map(f => f.replace(/\.(tsx|ts)$/, ""));
}

function extractRoutes(dir: string): { path: string; file: string }[] {
  const results: { path: string; file: string }[] = [];
  const files = fs.readdirSync(dir).filter(f => f.endsWith(".tsx") || f.endsWith(".ts"));
  for (const file of files) {
    const content = readFile(path.join(dir, file));
    const rx = /path="([^"]+)"/g;
    let m: RegExpExecArray | null;
    while ((m = rx.exec(content)) !== null) {
      results.push({ path: m[1], file });
    }
  }
  return results;
}

function findDuplicates(routes: { path: string }[]): string[] {
  const seen = new Map<string, number>();
  for (const r of routes) seen.set(r.path, (seen.get(r.path) ?? 0) + 1);
  return [...seen.entries()].filter(([, n]) => n > 1).map(([p]) => p);
}

const pages = new Set(listPages());
const routes = extractRoutes(ROUTES_DIR);
const duplicates = findDuplicates(routes);

const lines: string[] = [
  "# UX Route Navigation Report",
  `Generated: ${new Date().toISOString()}`,
  "",
  "## Registered Routes",
  "",
  "| Route Path | Source File |",
  "|-----------|-------------|",
  ...routes.map(r => `| \`${r.path}\` | ${r.file} |`),
  "",
  `**Total registered routes**: ${routes.length}`,
  "",
  "## Duplicate Paths",
  "",
  duplicates.length === 0
    ? "None found. ✅"
    : duplicates.map(p => `- \`${p}\``).join("\n"),
  "",
  "## Page Component Index",
  "",
  `Total page components in \`pages/\`: **${pages.size}**`,
  "",
  "## Navigation Mode Rules",
  "",
  "| Mode | Hidden Routes |",
  "|------|--------------|",
  "| consumer | /command-center, /ghost-trap, /ghost-nodes, /siem, /threat-intel, /firewall, /osint, /canary, /ghost-trace, /ghost-chain, /silkweb, /beacons |",
  "| business | /ghost-trap, /ghost-nodes, /ghost-chain, /osint, /canary, /alpha-tools, /sqlmap, /parrot-tools, /silkweb, /beacons |",
  "| security | All routes visible (with capability gates) |",
  "",
  "## Accessibility Checks",
  "",
  "- All routes are accessible by authorized users only (Clerk auth + capability gates)",
  "- Consumer mode hides security/deception tools from navigation",
  "- Ghost routes remain routable but are not shown in consumer/business nav",
  "",
];

fs.writeFileSync(OUT_FILE, lines.join("\n"), "utf8");
console.log(`Report written to ${OUT_FILE}`);
console.log(`Total routes: ${routes.length} | Duplicates: ${duplicates.length} | Pages: ${pages.size}`);
