// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Patch 342 — Flag mutation routes lacking visible Zod validation.
import fs from "node:fs";
import path from "node:path";

const root = path.resolve("artifacts/api-server/src/routes");
const findings: string[] = [];

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).flatMap((e) => {
    const f = path.join(dir, e);
    return fs.statSync(f).isDirectory() ? walk(f) : [f];
  });
}

for (const file of walk(root).filter((f) => f.endsWith(".ts"))) {
  const src = fs.readFileSync(file, "utf8");
  const hasMutation = /router\.(post|put|patch|delete)\s*\(/.test(src);
  if (!hasMutation) continue;

  const hasValidation =
    src.includes("validateRequest") ||
    src.includes("z.object") ||
    src.includes("z.string") ||
    src.includes(".parse(") ||
    src.includes(".safeParse(") ||
    src.includes("zod");

  if (!hasValidation) {
    findings.push(`${path.relative(process.cwd(), file)}: mutation route lacks visible Zod validation`);
  }
}

if (findings.length) {
  console.error("❌ Route validation gaps:\n" + findings.join("\n"));
  process.exit(1);
}

console.log("✅ Route validation audit passed");
