---
name: Full project audit findings
description: What was broken vs working after the June 2026 full audit; durable patterns to be consistent with
---

## Broken patterns to watch for

**Validation API path**: frontend validation components (ValidationScorecard, ValidationRunTable,
ValidationTargetForm, ValidationScheduleForm, ValidationFindingTable) previously called
`/api/admin/validation/...` but the backend mounts at `/api/validation/...` via
`registerAdminRoute(router, "/validation", ...)`. Admin group is mounted at root, not at `/admin`.

**Route group prefix rule**: admin.ts uses `registerAdminRoute(router, "/admin/users", ...)` for
admin-users (giving `/api/admin/users`) but `/validation` gives `/api/validation` — prefix is the
literal string passed to registerAdminRoute, not `/api/admin/<name>`.

**quantum-audit routes**: quantum-audit endpoints (cc-summary, threat-scan/*) were absent from
api-server despite being documented. Created artifacts/api-server/src/routes/quantum-audit.ts
and registered in command-center group. In-memory scan state + DB aggregation from
batchScanResultsTable / scanJobsTable / vulnerabilitiesTable.

**Why:** standalone/src/server.ts has parallel implementations of many routes that are documented
as being in api-server. When a route is missing, check standalone first to understand the
intended contract before implementing.

## Working correctly (audit confirmed)

- Firewall /api/fw/, /api/fwn/, /api/fwm/ — routes DO exist in firewall-advanced.ts,
  firewall-next.ts, firewall-military.ts (mounted in vpn.ts group)
- All 53 DB schema tables exported correctly from lib/db/src/schema/index.ts
- 17 workers all wire correctly in bootstrap/workers.ts
- Stripe checkout/portal/change-plan/webhook: fully end-to-end
- Mobile app: uses const BASE = `https://${EXPO_PUBLIC_DOMAIN}` consistently
