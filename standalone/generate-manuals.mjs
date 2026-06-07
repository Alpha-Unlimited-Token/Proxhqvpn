/**
 * ProxhqVPN — Manual Extractor
 * Reads Manuals.tsx, extracts each manual's plain-text content,
 * and writes individual .txt files to standalone/manuals/.
 *
 * Run: node generate-manuals.mjs
 * Called automatically by build.mjs before packaging.
 */

import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MANUALS_TSX = path.join(__dirname, "..", "artifacts", "ghost-vpn", "src", "pages", "Manuals.tsx");
const OUT_DIR = path.join(__dirname, "manuals");

function extractManuals(src) {
  // Only search within the MANUALS array (before CATEGORIES const)
  const categoriesIdx = src.indexOf("const CATEGORIES");
  const section = categoriesIdx > 0 ? src.slice(0, categoriesIdx) : src;

  const manuals = [];
  const idPattern = /\bid:\s*"([^"]+)"/g;
  let m;

  while ((m = idPattern.exec(section)) !== null) {
    const id = m[1];
    const searchFrom = m.index + m[0].length;

    // Find the content template literal that belongs to this entry
    const contentKey = "content: `";
    const contentStart = section.indexOf(contentKey, searchFrom);
    if (contentStart === -1) continue;

    // Walk forward to find the closing unescaped backtick
    let i = contentStart + contentKey.length;
    while (i < section.length) {
      if (section[i] === "`" && section[i - 1] !== "\\") break;
      i++;
    }

    let content = section.slice(contentStart + contentKey.length, i);

    // Unescape JS template literal escape sequences
    content = content
      .replace(/\\`/g, "`")
      .replace(/\\\$\{/g, "${")
      .trim();

    // Also grab title for the INDEX
    const titleMatch = section.slice(m.index, contentStart).match(/title:\s*"([^"]+)"/);
    const title = titleMatch ? titleMatch[1] : id;

    manuals.push({ id, title, content });
  }

  return manuals;
}

function buildIndex(manuals) {
  const border = "═".repeat(60);
  const lines = [
    "ProxhqVPN — Complete User Manual Library",
    border,
    `${manuals.length} manuals included`,
    "",
    ...manuals.map((m, i) =>
      `  ${String(i + 1).padStart(2, " ")}. ${m.title.padEnd(50)} → ${m.id}.txt`
    ),
    "",
    border,
    "All documentation © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC",
    "For personal use only. All rights reserved.",
  ];
  return lines.join("\n") + "\n";
}

// ── Main ─────────────────────────────────────────────────────────────────────

if (!fs.existsSync(MANUALS_TSX)) {
  console.error(`❌ Manuals.tsx not found at: ${MANUALS_TSX}`);
  process.exit(1);
}

const src = fs.readFileSync(MANUALS_TSX, "utf8");
const manuals = extractManuals(src);

if (manuals.length === 0) {
  console.error("❌ No manuals extracted — check Manuals.tsx format");
  process.exit(1);
}

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

// Write individual manual files
for (const { id, content } of manuals) {
  const outPath = path.join(OUT_DIR, `${id}.txt`);
  fs.writeFileSync(outPath, content + "\n", "utf8");
  console.log(`  ✓ manuals/${id}.txt`);
}

// Write INDEX
fs.writeFileSync(path.join(OUT_DIR, "INDEX.txt"), buildIndex(manuals), "utf8");
console.log(`  ✓ manuals/INDEX.txt`);

console.log(`\n  Extracted ${manuals.length} manuals → standalone/manuals/`);
