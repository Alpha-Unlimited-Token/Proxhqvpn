---
name: pnpm catalog coverage gaps
description: Which npm packages are NOT in pnpm-workspace.yaml catalog and need explicit versions when adding to new server artifacts.
---

The pnpm-workspace.yaml catalog only has a small set of entries. When creating a new server-side package (not a Vite app), many common packages are missing.

**NOT in catalog (use explicit versions from api-server/package.json):**
- `express` → `"^5"`
- `helmet` → `"^8.1.0"`
- `pino` → `"^9"`
- `pino-http` → `"^10"`
- `express-rate-limit` → `"^8.3.2"`
- `@clerk/express` → `"^2.1.5"`
- `esbuild` → `"^0.27.3"`
- `@types/express` → `"^5.0.6"`
- `typescript` → `"~5.9.2"`

**In catalog (use `catalog:`):**
- `drizzle-orm`, `zod`, `tsx`, `@types/node`, `@types/react`, `@types/react-dom`

**Why:** pnpm strict mode rejects `catalog:` references for keys not present in the catalog YAML — it throws ERR_PNPM_CATALOG_ENTRY_NOT_FOUND_FOR_SPEC at install time.

**How to apply:** When writing package.json for any new server artifact, default to explicit versions for server deps and only use `catalog:` for the known-good subset above.
