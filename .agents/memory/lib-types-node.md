---
name: Workspace lib @types/node pattern
description: Any lib tsconfig with "types": ["node"] must also declare @types/node in its own package.json devDependencies.
---

pnpm uses strict isolation — packages only see dependencies they explicitly declare. A lib tsconfig can set `"types": ["node"]` to use Node.js globals, but TypeScript will still fail to find `@types/node` unless the lib's `package.json` declares it in `devDependencies`.

**Why:** Root-level `@types/node` in the monorepo is NOT automatically hoisted to all workspace packages. Each lib must own its type dependencies.

**How to apply:** Any `lib/*` package whose `tsconfig.json` has `"types": ["node"]` needs `"@types/node": "catalog:"` in its `package.json` devDependencies. Check `lib/wallet-tx` as the canonical example.
