---
name: Cloud Run startup crash — module-level mkdirSync
description: Any fs.mkdirSync at module load time crashes Cloud Run before port is bound, failing the startup probe. Pattern and fix.
---

## The rule
Wrap **every** `fs.mkdirSync` that runs at module load time in `try { ... } catch {}`. Treat it as non-fatal — the server should start and serve `/api/healthz` even if it can't create report directories.

**Why:** Cloud Run autoscale containers mount a fresh, restricted filesystem. Paths like `/home/proxhq-reports/...` (derived from `path.join(process.cwd(), '../..')`) do not exist and cannot be created. `mkdirSync` throws `ENOENT`, crashing the process before it ever binds a port. The startup probe (`GET /api/healthz`) times out and the deployment fails.

**How to apply:**
- Module-level code: `try { fs.mkdirSync(dir, { recursive: true }); } catch {}`
- Class constructors instantiated at module level (e.g. `KnowledgeStore`, `MegaScanner`): same try/catch in the constructor body
- Bootstrap worker functions (`startBatchWorker` → `ensureDirs()`): wrap each mkdirSync call
- `multer({ dest })`: falls back to `os.tmpdir()` when the preferred dir is unavailable — `os.tmpdir()` is always writable

Files where this was applied:
- `routes/updates.ts` — module-level mkdir + multer dest
- `routes/quantum-audit.ts` — THREAT_REPORTS_DIR and setTimeout watchdog
- `lib/spider/knowledge-store.ts` — KnowledgeStore constructor
- `lib/unified-scanner.ts` — MegaScanner constructor
- `lib/scheme-auditor/batch-worker.ts` — ensureDirs()
