# ProxhqVPN — Bug Fix Tracker

**Session:** 2026-06-11  
**Copyright © Alpha Unlimited Technologies LLC**

---

## Fixed This Session

### FIX-001 — wallet-intel Auth Bypass (Critical)
**Root Cause:** `walletIntelRouter` was mounted in `app.ts` before `app.use("/api", router)`, bypassing the main auth middleware chain. No per-route Clerk auth check existed in `routes/wallet-intel.ts`.  
**Fix Applied:** Added `requireAuth` middleware import and application at the top of `wallet-intel.ts` router, protecting all five scan endpoints.  
**Files Changed:** `artifacts/api-server/src/routes/wallet-intel.ts`

### FIX-002 — ECDSAScanner Wrong API Path (Critical)
**Root Cause:** Three fetch calls in `ECDSAScanner.tsx` used the prefix `/api/quantum/` when the actual backend route is mounted at `/api/quantum-audit/` (confirmed via `routes/index.ts` line 464). There is no `/api/quantum` mount in `app.ts`, causing silent 404s.  
**Fix Applied:** Changed all three calls from `/api/quantum/advanced-attack-*` to `/api/quantum-audit/advanced-attack-*`.  
**Files Changed:** `artifacts/quantum-audit/src/pages/ECDSAScanner.tsx`

---

## Documented — Require Follow-Up

### DOC-001 — ZTNA Deny-By-Default (High Priority)
**Finding:** VULN-03 — users with no ZTNA posture record receive WireGuard configs without restriction.  
**Required Work:** Redesign wireguard config issuance to require at least one posture check before first config generation. Add a `/ztna/enroll` onboarding step to ghost-vpn.

### DOC-002 — RBAC Enforcement (High Priority)
**Finding:** VULN-04 — `lib/rbac.ts` and `requirePermission()` are dead code.  
**Required Work:** Wire `requirePermission()` to routes. Prioritize: `/api/nodes` (network_admin), `/api/firewall` (security_admin), `/api/admin/users` (owner).

### DOC-003 — Omega IDOR on hostId (High Priority)
**Finding:** VULN-05 — all Omega C2 routes accept hostId without user ownership verification.  
**Required Work:** Add `WHERE host_id = :hostId AND owner_user_id = :clerkUserId` to all Omega host-scoped DB queries. Also add ownership to `omegaHosts` table schema.

### DOC-004 — Daemon Shared PSK (High)
**Finding:** VULN-06 — single shared PSK for all nodes.  
**Required Work:** Issue per-node tokens derived from `HMAC(DAEMON_PSK, nodePublicKey)`. Store expected token per node in DB and verify on inbound calls.

### DOC-005 — Audit Chain Coverage Gaps (High)
**Finding:** VULN-07 — terminal shell exec, admin user management, node provisioning not in audit chain.  
**Required Work:** Add `appendAuditEvent({...})` calls in `terminal.ts` (shell exec path), `admin-users.ts` (create/delete), `nodes.ts` (POST/DELETE).

### DOC-006 — audit_log_append_only Drizzle Schema (High)
**Finding:** VULN-08 — migration-created table has no Drizzle schema.  
**Required Work:** Add `lib/db/src/schema/audit-log-append-only.ts` with matching column definitions. Export from schema index. Run `pnpm --filter @workspace/db run push` after.

### DOC-007 — SIEM Coverage (High)
**Finding:** VULN-09 — break-glass terminal access, admin elevation, bulk node ops not emitting SIEM events.  
**Required Work:** Add `shipSecurityEvent()` calls to: break-glass token usage in terminal, admin user creation/deletion, bulk node rotation.

### DOC-008 — startAutonomousRunner Missing from Boot (Medium)
**Finding:** BUG-05 — autonomous signature mining engine not auto-started.  
**Required Work:** Decide whether autonomous runner should start on boot (with a `PROXHQ_ENABLE_AUTONOMOUS_MINER=1` env gate), and add to `index.ts` if so.

### DOC-009 — Omega Dashboard Hardcoded /api Paths (Medium)
**Finding:** BUG-04 — 6 Omega pages use `fetch("/api/...")` without BASE prefix.  
**Files:** `clipboard.tsx`, `keylogger.tsx`, `ip-scanner.tsx`, `file-manager.tsx`, `chat.tsx`, `message-manager.tsx`  
**Required Work:** Import and use the same `BASE` helper used by other Omega pages.

### DOC-010 — WalletWebSpider BASE() Call Inconsistency (Medium)
**Finding:** BUG-06 — `WalletWebSpider.tsx` uses `${BASE}` where others use `${BASE()}`.  
**Required Work:** Audit whether `BASE` is a constant or function in quantum-audit context; fix to match all other pages.

### DOC-011 — Mobile WebView Session Sync (Medium)
**Finding:** BUG-07 — native Clerk auth not propagated into WebView for ghost-vpn tool pages.  
**Required Work:** Inject Clerk session token into WebView via `injectedJavaScript` or custom request headers. See Clerk React Native docs for session token extraction.

### DOC-012 — ZTNA Migration Table Name Drift (Medium)
**Finding:** BUG-02 — migration creates `devices` with ZTNA columns; ORM uses `ztna_devices`.  
**Required Work:** Verify migration execution — if `ztna_devices` table exists correctly in prod DB, rename or remove the conflicting migration. Add note in migration comment.

### DOC-013 — WireGuard Key Derivation (Info)
**Finding:** INFO-04 — `generateWgPublicKey()` in nodes.ts uses SHA-256 not Curve25519.  
**Required Work:** Ensure this function is only used for display/mock keys. If used for actual peer configs, replace with `wg pubkey` via execAsync or a native Curve25519 library.

---

## Verified Non-Issues (False Positives from Explorer Agents)

| ID | Claim | Verdict |
|----|-------|---------|
| FP-001 | SplitTunnel missing `/rules/reset` | Route exists at `splittunnel.ts:141` |
| FP-002 | WAF missing `/seed` and `/reset` | Both routes exist at `waf.ts:258` and `:314` |
| FP-003 | WAF missing `/generate-config` | Route exists at `waf.ts:727` |
| FP-004 | NodeManager.tsx missing | Page exists under `pages/` not `components/` |
| FP-005 | VpnGate.tsx missing | Route exists; page may be under different path |
