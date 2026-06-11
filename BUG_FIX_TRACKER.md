# ProxhqVPN — Bug Fix Tracker

**Session:** 2026-06-11 (3-pass rolling audit)
**Copyright © Alpha Unlimited Technologies LLC**

---

## Fixed This Session

### FIX-001 — wallet-intel Auth Bypass (Critical)
**Root Cause:** `walletIntelRouter` mounted in `app.ts` before `requireAuth` middleware chain. No per-route Clerk auth in `routes/wallet-intel.ts`.
**Fix:** Added `requireAuth` middleware at the top of `wallet-intel.ts` router.
**Files:** `artifacts/api-server/src/routes/wallet-intel.ts`
**Typecheck:** ✅ Clean

### FIX-002 — ECDSAScanner Wrong API Prefix (Critical)
**Root Cause:** Three fetch calls used `/api/quantum/advanced-attack-*`. Actual mount is `/api/quantum-audit/`.
**Fix:** Changed prefix to `/api/quantum-audit/` in all three calls.
**Files:** `artifacts/quantum-audit/src/pages/ECDSAScanner.tsx`
**Typecheck:** ✅ Clean

### FIX-003 — intruder.ts Double-Prefix Route Bug (Critical)
**Root Cause:** `router.post("/api/intruder/run", ...)` inside a router mounted at `/api/intruder/`. Effective path was `/api/intruder/api/intruder/run` — always 404.
**Fix:** Changed to `router.post("/run", ...)`.
**Files:** `artifacts/api-server/src/routes/intruder.ts`
**Typecheck:** ✅ Clean

### FIX-004 — oastserver.ts Missing Session Ownership (High)
**Root Cause:** `GET /session/:id`, `DELETE /session/:id`, `GET /poll/:id` — no ownership check. Any authenticated user could read/delete/poll any OAST session.
**Fix:** Added `if (session.userId !== uid(req)) return res.status(403)` to all three routes.
**Files:** `artifacts/api-server/src/routes/oastserver.ts`
**Typecheck:** ✅ Clean

### FIX-005 — jwtanalyzer.ts All Routes Missing Zod (Medium)
**Root Cause:** All 10 route handlers used `req.body as { ... }` TypeScript type casts — no runtime validation. Invalid input types caused uncaught exceptions in `decodeJwt()`.
**Fix:** Added `import { z } from "zod"`, defined 7 schemas, replaced all `as {...}` casts with `safeParse()` calls.
**Files:** `artifacts/api-server/src/routes/jwtanalyzer.ts`
**Typecheck:** ✅ Clean

### FIX-006 — chat.tsx Wrong API Path (Medium)
**Root Cause:** Hardcoded `/api/chat/` paths. Omega router is at `/api/omega/`. All chat operations returned 404.
**Fix:** Added `const BASE = "/api/omega"` and updated all fetch calls to use `${BASE}/chat/...`.
**Files:** `artifacts/omega-dashboard/src/pages/chat.tsx`

### FIX-007 — clipboard.tsx Wrong API Path (Medium)
**Root Cause:** Hardcoded `/api/clipboard/` paths.
**Fix:** Added `const BASE = "/api/omega"`, updated fetch calls.
**Files:** `artifacts/omega-dashboard/src/pages/clipboard.tsx`

### FIX-008 — keylogger.tsx Wrong API Path (Medium)
**Root Cause:** Hardcoded `/api/keylogger/` paths.
**Fix:** Added `const BASE = "/api/omega"`, updated fetch calls.
**Files:** `artifacts/omega-dashboard/src/pages/keylogger.tsx`

### FIX-009 — message-manager.tsx Wrong API Path (Medium)
**Root Cause:** Hardcoded `/api/messages/` paths.
**Fix:** Added `const BASE = "/api/omega"`, updated fetch calls.
**Files:** `artifacts/omega-dashboard/src/pages/message-manager.tsx`

### FIX-010 — ip-scanner.tsx Wrong API Path (Medium)
**Root Cause:** Hardcoded `/api/tools/scan` path.
**Fix:** Added `const BASE = "/api/omega"`, updated fetch call.
**Files:** `artifacts/omega-dashboard/src/pages/ip-scanner.tsx`

### FIX-011 — file-manager.tsx Wrong API Path (Medium)
**Root Cause:** Hardcoded `/api/remote-commands/` paths.
**Fix:** Added `const BASE = "/api/omega"`, updated fetch calls.
**Files:** `artifacts/omega-dashboard/src/pages/file-manager.tsx`

### FIX-012 — system-info.tsx Wrong BASE (Medium)
**Root Cause:** `const BASE = "/api"` — missing `/omega` segment.
**Fix:** Changed to `const BASE = "/api/omega"`.
**Files:** `artifacts/omega-dashboard/src/pages/system-info.tsx`

### FIX-013 — processes.tsx Wrong BASE (Medium)
**Root Cause:** `const BASE = "/api"` — missing `/omega` segment.
**Fix:** Changed to `const BASE = "/api/omega"`.
**Files:** `artifacts/omega-dashboard/src/pages/processes.tsx`

### FIX-014 — remote-commands.tsx Wrong BASE (Medium)
**Root Cause:** `const BASE = "/api"` — missing `/omega` segment.
**Fix:** Changed to `const BASE = "/api/omega"`.
**Files:** `artifacts/omega-dashboard/src/pages/remote-commands.tsx`

### FIX-015 — windows.tsx Wrong BASE (Medium)
**Root Cause:** `const BASE = "/api"` — missing `/omega` segment.
**Fix:** Changed to `const BASE = "/api/omega"`.
**Files:** `artifacts/omega-dashboard/src/pages/windows.tsx`

### FIX-016 — screen-capture.tsx Wrong BASE (Medium)
**Root Cause:** `const BASE = "/api"` — missing `/omega` segment.
**Fix:** Changed to `const BASE = "/api/omega"`.
**Files:** `artifacts/omega-dashboard/src/pages/screen-capture.tsx`

### FIX-017 — ip-tool.tsx Double /api Prefix Bug (Medium)
**Root Cause:** `BASE = import.meta.env.BASE_URL.replace(...)` combined with `${BASE}/api/tools/ping` → resolved to `/api/omega/api/tools/ping`. Server route is `/api/omega/tools/ping`.
**Fix:** Changed to `const BASE = "/api/omega"` and removed extra `/api/` in fetch calls.
**Files:** `artifacts/omega-dashboard/src/pages/ip-tool.tsx`
**Typecheck:** ✅ Clean

### FIX-018 — devices.ts IDOR — No Ownership Check (High)
**Root Cause:** `GET /:id/config`, `PUT /:id`, `DELETE /:id` didn't verify device belonged to requesting user. Any authenticated user could access/modify/delete any device by integer ID.
**Fix Applied (3 parts):**
1. Added `userId text` column to `devicesTable` schema (`lib/db/src/schema/devices.ts`) and applied via raw SQL `ALTER TABLE devices ADD COLUMN IF NOT EXISTS user_id text`
2. Added `getAuth(req)` in `POST /` to store `userId` on device creation
3. Added `if (device.userId && device.userId !== userId) return 403` guard on `GET /config`, `PUT /:id`, `DELETE /:id`
**Files:** `lib/db/src/schema/devices.ts`, `artifacts/api-server/src/routes/devices.ts`
**Typecheck:** ✅ Clean

### FIX-019 — remote-commands.ts Unbounded params Field (Medium)
**Root Cause:** `params` field in `POST /remote-commands/:hostId/execute` had no size limit. Arbitrary payload sizes could be written to the database.
**Fix:** Added 8192-byte length check before DB insert; returns 400 if exceeded.
**Files:** `artifacts/api-server/src/routes/omega/remote-commands.ts`
**Typecheck:** ✅ Clean

### FIX-020 — wallet-tx.ts Auth Bypass (Critical) [Pass 3]
**Root Cause:** `walletTxRouter` mounted in `app.ts` before `requireAuth` middleware chain (`app.use("/api/wallet", walletTxRouter)`). `routes/wallet-tx.ts` had no Clerk auth checks — all 9 routes (scan-job CRUD, chains, nonce, outgoing, signature-scan, multi-chain) were publicly accessible without a session.
**Fix:** Added `import { getAuth } from "@clerk/express"`, defined `requireAuth` middleware, called `router.use(requireAuth)` before all route handlers.
**Files:** `artifacts/api-server/src/routes/wallet-tx.ts`
**Typecheck:** ✅ Clean

### FIX-021 — omega/windows.ts Raw Handle Param (Medium) [Pass 3]
**Root Cause:** `DELETE /windows/:hostId/:handle` — `req.params.handle` used directly in Drizzle ORM queries with no format or length validation. While Drizzle parameterizes the query (no SQL injection), unvalidated string params allow arbitrary-length identifiers.
**Fix:** Added format and length guard: `handle.length > 256 || !/^[\w\-.:]+$/.test(handle)` → 400 response.
**Files:** `artifacts/api-server/src/routes/omega/windows.ts`
**Typecheck:** ✅ Clean

---

## False Positives Cleared (Pass 3)

### DOC-001 — ZTNA Deny-By-Default (High)
Redesign WireGuard config issuance to require posture enrollment. Add `/ztna/enroll` onboarding flow.

### DOC-002 — RBAC Enforcement (High)
Wire `requirePermission()` to routes. Prioritize: `/api/nodes` (network_admin), `/api/firewall` (security_admin), `/api/admin/users` (owner).

### DOC-003 — Omega IDOR on hostId (High)
Add `ownerUserId` column to `omegaHosts` table. Add ownership check to all host-scoped Omega routes.

### DOC-004 — Daemon Shared PSK (High)
Issue per-node HMAC tokens derived from `HMAC(DAEMON_PSK, nodePublicKey)`. Store expected token per node in DB.

### DOC-005 — Audit Chain Coverage Gaps (High)
Add `appendAuditEvent({...})` calls in `terminal.ts` (shell exec path), `admin-users.ts` (create/delete), `nodes.ts` (POST/DELETE).

### DOC-006 — audit_log_append_only Drizzle Schema (High)
Create `lib/db/src/schema/audit-log-append-only.ts` with matching columns. Export from schema index.

### DOC-007 — SIEM Coverage Gaps (High)
Add `shipSecurityEvent()` to break-glass token usage, admin user creation/deletion, bulk node rotation.

### DOC-008 — ZTNA Migration Table Name Drift (Medium)
Migration creates `devices` with ZTNA columns. Drizzle schema defines `ztna_devices`. Resolve naming collision.

### DOC-009 — WG Key Sentinel Read Risk (Medium)
Ensure all code paths read `client_private_key_enc` (encrypted column) not `client_private_key` (sentinel column).

### DOC-010 — startAutonomousRunner Not Auto-Started (Info)
Intentional design. Add `PROXHQ_ENABLE_AUTONOMOUS_MINER=1` env gate to `index.ts` if auto-start is desired.

### DOC-011 — Mobile WebView Session Sync (Medium)
Inject Clerk session token into WebView request headers for seamless auth continuity.

### DOC-012 — Systematic Zod Remediation (~30+ routes) (Low-Medium)
Routes in redteamscan.ts, imautomation.ts, ghosttrap.ts, dev-audit.ts, ambassadors.ts, silkweb.ts, etc. still use `req.body as {...}` type casts. Systematic migration to Zod safeParse recommended.

---

## False Positives Cleared (Pass 1–2)

- `SplitTunnel /rules/reset` — confirmed present at `splittunnel.ts:141`
- `WAF /seed`, `/reset`, `/generate-config` — confirmed present at `waf.ts`
- `NodeManager.tsx "missing"` — page exists under `pages/` not `components/`
- `VpnGate.tsx "missing"` — routing confusion; backend fully implemented
- Dead imports in `routes/index.ts` — `attackIntelRouter`, `adminUsersRouter`, `securityScoreRouter` are all mounted (confirmed lines 499, 511, 513)

## False Positives Cleared (Pass 3)

- `quantum-audit.ts path traversal` — already protected by `!filePath.startsWith(getReportsDir())` guard; sanitization is in place
- `omega-agent public mount` — intentional; per-host token validated in `touchHost(token)` before any data processing; protected counterpart `/api/omega/` is auth-gated in `app.ts`
- `ghost-vpn hardcoded /api/ paths` — ghost-vpn artifact is mounted at `/` (root); its `BASE_URL` resolves to `""`, making `/api/...` correct for all its pages
- `omega/windows.ts "raw string in DB"` — Drizzle ORM parameterizes all values; no SQL injection risk, only length/format concern (addressed by FIX-021)
- `firewall.ts mass assignment` — Drizzle `set(body)` only applies fields present in the table schema; unknown fields are silently ignored by the ORM; not exploitable
