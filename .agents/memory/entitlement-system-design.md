---
name: Commercial Entitlement System Design
description: Key design decisions for the requireFeature middleware and public vs authenticated endpoint split.
---

## Admin bypass pattern in requireFeature

`requireFeature(featureKey)` in `middlewares/requireFeature.ts` checks `(req as any).__isAdmin` first — if true, calls `next()` immediately without hitting the DB. This prevents platform admins from being locked out while the entitlement tables are empty for new users.

**Why:** The entitlement tables start empty. Without this bypass, every admin would hit 402 on every gated route until entitlements are manually provisioned.

**How to apply:** Any future feature gate middleware should respect `__isAdmin`. The `__isAdmin` flag is set by `requireAdmin` / `requireAdminMiddleware`.

## Public vs authenticated split

The entitlements router is mounted at `/entitlements` in `misc-authenticated.ts` (requires Clerk auth). However, `GET /entitlements/products` and `GET /entitlements/features` are also exposed directly in `public.ts` so the pricing page and unauthenticated visitors can read the catalog.

**How to apply:** Always add public-facing catalog endpoints to `groups/public.ts` directly using the catalog constants, not via the authed router.

## Admin /me override

`GET /api/entitlements/me` returns all features as `true` for admin users (checked via `req.__isAdmin`) so admins always see the full product surface without needing DB rows.
