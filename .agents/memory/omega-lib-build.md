---
name: Omega lib composite build
description: lib/omega-api-client-react and lib/omega-api-zod must be in root tsconfig.json references or tsc --build skips them.
---

Both `lib/omega-api-client-react` and `lib/omega-api-zod` are composite TypeScript libs (have `composite: true` + `emitDeclarationOnly: true`). They must appear in the root `tsconfig.json` `references` array so that `pnpm run typecheck:libs` (`tsc --build`) compiles them and writes their `.d.ts` output before artifact typechecks run.

**Why:** Without being in root references, `tsc --build` never emits their `.d.ts` files. Any artifact that imports from these libs gets TS6305 ("Output file has not been built from source file") and cascading TS7006 implicit-any errors.

**How to apply:** When adding a new composite lib under `lib/`, always add it to root `tsconfig.json` `references`. Also watch for stale partial builds — if only `.d.ts.map` files exist but no `.d.ts`, delete the `dist/` and `.tsbuildinfo`, then run `tsc -p tsconfig.json` inside the lib to force a clean emit.
