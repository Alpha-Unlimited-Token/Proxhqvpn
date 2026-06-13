import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "../../artifacts/ghost-vpn/src");
const ALLOWED_BRAND = "ProxhqVPN";
const BAD_PATTERNS = ["ProxyHQ", "ProxHQ", "GhostVPN", "Ghost VPN"];

function walk(dir: string): string[] {
  return fs.readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    const stat = fs.statSync(full);
    return stat.isDirectory() ? walk(full) : [full];
  });
}

const files = walk(ROOT).filter((file) => /\.(ts|tsx|js|jsx)$/.test(file));
const violations: string[] = [];

for (const file of files) {
  const source = fs.readFileSync(file, "utf8");

  for (const bad of BAD_PATTERNS) {
    if (source.includes(bad)) {
      violations.push(`${file}: replace "${bad}" with "${ALLOWED_BRAND}"`);
    }
  }
}

if (violations.length > 0) {
  console.error("Brand consistency violations:");
  console.error(violations.join("\n"));
  process.exit(1);
}

console.log("✅ Brand consistency audit passed");
