---
name: routeCapabilities.ts sync requirement
description: All routes registered via registerVpnRoute/registerAdminRoute/registerCommandCenterRoute must also have an entry in routeCapabilities.ts to silence dev warnings.
---

## Rule

Every route mounted via `registerVpnRoute`, `registerAdminRoute`, or `registerCommandCenterRoute` must also have a matching `{ mountPath, capability }` entry in `artifacts/api-server/src/routes/routeCapabilities.ts`.

**Why:** `registerRoute` (called by all three helpers) checks `apiRouteCapabilities` at mount time. If the route is absent, a `[route-capability] route mounted but missing from apiRouteCapabilities` warning is logged in dev. In production the warning is suppressed but the omission indicates untracked surface area in the capability map.

**How to apply:** Any time a new router is added to a group file (admin.ts, vpn.ts, command-center.ts), add the corresponding entry to `routeCapabilities.ts` in the same PR. There are two separate lists that must stay in sync:
1. `ADMIN_CAPABILITIES` in `registerAdminRoute.ts` — controls which Capability values are legal for admin routes (throws at startup if violated).
2. `apiRouteCapabilities` in `routeCapabilities.ts` — a catalog of all routes and their required capability, used for documentation/audit and dev warnings.
