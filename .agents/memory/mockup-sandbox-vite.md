---
name: Mockup-sandbox vite config PORT/BASE_PATH
description: vite.config.ts must not hard-throw when PORT/BASE_PATH are absent — they're only available at runtime, not during vite build.
---

`artifacts/mockup-sandbox/vite.config.ts` previously threw a hard error if `PORT` or `BASE_PATH` env vars were missing. The Replit workflow sets these at runtime, but `vite build` (called during deploy) runs without them.

**Why:** `process.env.PORT` is set by the workflow's `[services.env]` block, which only applies to the running dev server, not to the deploy build step. During build, the config file is evaluated without those vars.

**How to apply:** Use `process.env.PORT ?? "3000"` and `process.env.BASE_PATH ?? "/"` as fallbacks. Never throw on missing PORT/BASE_PATH in vite.config.ts — only the `server.port` field actually needs PORT at dev time.
