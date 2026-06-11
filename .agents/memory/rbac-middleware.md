---
name: requireRbac middleware pattern
description: How the RBAC middleware factory is implemented and wired in this project.
---

## The Rule
The RBAC middleware factory lives at `artifacts/api-server/src/middlewares/requireRbac.ts`.
Call it as `requireRbac("vpn:write")` in route declarations — place it AFTER `requireAuth` or `requireAdmin` so `getAuth(req).userId` is guaranteed.

**Why:** `lib/rbac.ts` defines roles and actions but had no Express middleware. The factory reads `users.role` from DB via Drizzle, falls back to "user" if no role stored, maps `isAdmin=true` to "owner" if role is "user", then calls `requirePermission(role, action)` which throws on deny.

**How to apply:**
- Currently wired to: `nodes.ts` POST / and DELETE /:id with `"vpn:write"` action.
- Extend to: `/api/firewall` (`"security_admin"` or action `"peer:write"`), `/api/siem` (`"audit:read"`), `/api/admin/users` (`"admin:write"`).
- Actions available: `"vpn:read"`, `"vpn:write"`, `"peer:read"`, `"peer:write"`, `"audit:read"`, `"audit:export"`, `"admin:write"`, `"billing:read"`, `"incident:write"`, `"ztna:posture"`.
- DB column: `users.role text` (nullable) — set to one of: `owner | security_admin | network_admin | auditor | support | user`.
