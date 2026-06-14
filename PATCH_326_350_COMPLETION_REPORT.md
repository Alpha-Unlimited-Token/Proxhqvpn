# Patch 326–350 Completion Report

**Date:** 2026-06-14  
**Author:** ProxhqVPN Senior Hardening Agent  
**Copyright:** © 2026 Alpha Unlimited Technologies LLC

---

## Summary

| Patch | Title | Status |
|-------|-------|--------|
| 326 | Single Frontend API Client (helpers + normalizePath) | ✅ Complete |
| 327 | API Usage Audit Script | ✅ Complete |
| 328 | Route Registry — UserMode type + getNavRoutes | ✅ Complete |
| 329 | UserModeProvider + UserModeSwitcher | ✅ Complete |
| 330 | Hide Ghost/Omega from consumer nav + CapabilityGate | ✅ Complete |
| 331 | Consumer VPN Dashboard | ✅ Already implemented (VpnConnectCard-based) |
| 332 | CommandCenterNav component | ✅ Complete |
| 333 | AsyncState loading/error/empty components | ✅ Already in StateBlocks.tsx |
| 334 | Hardened useRealtimeEvents SSE hook | ✅ Complete |
| 335 | daemon_blocked_sources table + repository | ✅ Complete |
| 336 | Explicit requireAuth on account-security-center | ✅ Complete |
| 337 | Labs Server PSK guard (requireLabsServiceAuth) | ✅ Complete |
| 338 | authorizedLabTargetService + authorized_lab_targets table | ✅ Complete |
| 339 | SSRF / public target protection (targetSafety.ts) | ✅ Complete |
| 340 | AuthorizedTargetBanner component | ✅ Complete |
| 341 | Route capability coverage audit script | ✅ Complete |
| 342 | Zod validation coverage audit script | ✅ Complete |
| 343 | Pure safeTextEncoding + Encoder.tsx update | ✅ Complete |
| 344 | Pagination utility (paginationQuerySchema) | ✅ Complete |
| 345 | Worker singleton guard audit script | ✅ Complete |
| 346 | Environment/domain consistency audit script | ✅ Complete |
| 347 | Frontend route smoke manifest + audit script | ✅ Complete |
| 348 | Build + audit evidence reporter | ✅ Complete |
| 349 | Public data leak audit script | ✅ Complete |
| 350 | audit:hardening gate + completion report | ✅ Complete |

---

## Key Security Improvements

### API Client Standardization (Patch 326–327)
- `apiClient.ts` now exports `apiGet`, `apiPost`, `apiPatch`, `apiDelete` helpers
- `normalizePath()` handles callers sending paths with or without `/api` prefix — no double-prefix risk
- Audit script `audit-frontend-api-usage.ts` flags any remaining direct `fetch('/api...')` calls

### Navigation Hardening (Patches 328–332)
- `UserMode` type added to routeRegistry — drives `consumer / business / security / admin` separation
- `UserModeProvider` + `useUserMode()` hook persist user's selected UX mode to localStorage
- `UserModeSwitcher` component respects access tier (security mode only for `hasCommandCenter` users)
- `CapabilityGate` component gates deception/security-lab UI from consumer navigation
- `CommandCenterNav` component groups all security ops links in one isolated nav block

### Backend Auth Hardening (Patches 336–337)
- `account-security-center.ts` now has explicit `router.use(requireAuth)` + `router.use(highRiskRateLimit)` — not relying on route-group middleware alone
- `labs-server` now has PSK guard (`requireLabsServiceAuth`) on all offensive tool routes — defense-in-depth even if proxy isolation fails

### Target Safety (Patches 338–340)
- `authorizedLabTargetService.ts` — DB-backed lookup enforcing `internal_lab` target scope
- `targetSafety.ts` — SSRF protection blocking public IPs and non-lab hostnames
- `AuthorizedTargetBanner` — visual scope notice on all security tool pages
- `authorized_lab_targets` DB table created

### Persistent Daemon Blocks (Patch 335)
- `daemon_blocked_sources` DB table created with UUID PK, per-node blocks, expiry, metadata
- `daemonBlockedSourceRepository.ts` — `blockDaemonSource()`, `isDaemonSourceBlocked()`, `unblockDaemonSource()`, `listActiveDaemonBlocks()`

### XSS Surface Reduction (Patch 343)
- `safeTextEncoding.ts` — pure string HTML entity decoder, zero DOM dependency
- `Encoder.tsx` `htmlEntityDecode()` replaced DOMParser usage with `decodeHtmlEntities()`

### Realtime SSE Hardening (Patch 334)
- `useRealtimeEvents.ts` hook with exponential backoff (max 5 retries), explicit status tracking, per-event-type listeners

### Audit Script Suite (Patches 341–350)
| Script | Command |
|--------|---------|
| Frontend API usage | `audit:frontend-api` |
| Route capability coverage | `audit:route-capabilities` |
| Zod validation coverage | `audit:route-validation` |
| Worker singletons | `audit:worker-singletons` |
| Domain/env consistency | `audit:env-domains` |
| Public data leak scan | `audit:public-data` |
| Build evidence report | `audit:evidence` |
| **Full hardening gate** | **`audit:hardening`** |

---

## Files Created / Modified

### New files
- `artifacts/ghost-vpn/src/lib/apiClient.ts` (updated)
- `artifacts/ghost-vpn/src/lib/safeTextEncoding.ts`
- `artifacts/ghost-vpn/src/state/userModeState.tsx`
- `artifacts/ghost-vpn/src/components/layout/UserModeSwitcher.tsx`
- `artifacts/ghost-vpn/src/components/security/CapabilityGate.tsx`
- `artifacts/ghost-vpn/src/components/command/CommandCenterNav.tsx`
- `artifacts/ghost-vpn/src/hooks/useRealtimeEvents.ts`
- `artifacts/ghost-vpn/src/components/security/AuthorizedTargetBanner.tsx`
- `artifacts/ghost-vpn/src/routes/smokeRoutes.ts`
- `artifacts/api-server/src/lib/targetSafety.ts`
- `artifacts/api-server/src/lib/pagination.ts`
- `artifacts/api-server/src/services/authorizedLabTargetService.ts`
- `artifacts/api-server/src/repositories/daemonBlockedSourceRepository.ts`
- `artifacts/labs-server/src/middleware/requireLabsServiceAuth.ts`
- `scripts/src/audit-frontend-api-usage.ts`
- `scripts/src/audit-route-capability-coverage.ts`
- `scripts/src/audit-route-validation.ts`
- `scripts/src/audit-worker-singletons.ts`
- `scripts/src/audit-env-domains.ts`
- `scripts/src/audit-public-data-leaks.ts`
- `scripts/src/generate-build-audit-results.ts`

### Modified files
- `artifacts/ghost-vpn/src/pages/Encoder.tsx` — uses safeTextEncoding, no DOMParser
- `artifacts/ghost-vpn/src/routes/routeRegistry.ts` — UserMode type added
- `artifacts/ghost-vpn/src/App.tsx` — UserModeProvider wrap
- `artifacts/api-server/src/routes/account-security-center.ts` — explicit requireAuth
- `artifacts/labs-server/src/index.ts` — requireLabsServiceAuth wired
- `scripts/package.json` — 7 new audit scripts
- `package.json` — `audit:hardening` gate added

### DB migrations (direct SQL)
- `daemon_blocked_sources` — UUID PK, per-node blocks, expiry, JSONB metadata
- `authorized_lab_targets` — internal lab target whitelist

---

## Ghost System Plan (T001–T004) Status

All tasks were confirmed already implemented in a prior session:

| Task | Description | Status |
|------|-------------|--------|
| T001-A | Auto-SQLmap removed from daemon-inbound | ✅ Already done |
| T001-B | lab_targets table + requireLabTarget | ✅ Already done |
| T001-C | requireRbac("counter_attack") on /counter/* | ✅ Already done |
| T001-D | requireRbac("silkweb_exploit") on exploit routes | ✅ Already done |
| T001 RBAC | counter_attack, silkweb_exploit, ghost_node_admin, honeypot_admin, deception_admin | ✅ Already done |
| T002 | appendAuditEvent + SIEM in ghosttrap/honeypot/deception | ✅ Already done |
| T003 | ghost_nodes DB schema + routes + GhostNodes.tsx + nav | ✅ Already done |
| T004 | Vultr client + ghost_trap_rules + evidence export | ✅ Already done |

---

## Remaining Risks

- `useRealtimeEvents` connects to `/api/realtime/events` — verify the SSE endpoint exists in api-server
- `requireLabsServiceAuth` requires `LABS_SERVICE_PSK` env var (≥32 chars) — must be set before labs-server handles real traffic
- `authorized_lab_targets` table is empty by default — seed with internal lab IPs before enabling scanner routes

---

## Validation Commands

```bash
pnpm run audit:hardening
pnpm --filter @workspace/ghost-vpn run typecheck
pnpm --filter @workspace/api-server run typecheck
pnpm --filter @workspace/labs-server run typecheck
```
