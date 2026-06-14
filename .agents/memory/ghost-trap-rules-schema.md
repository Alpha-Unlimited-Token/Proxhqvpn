---
name: ghost_trap_rules schema location and columns
description: ghostTrapRulesTable is in ghost-nodes.ts, not ghosttrap.ts. Column list for CRUD routes.
---

## The rule
`ghostTrapRulesTable` is defined in `lib/db/src/schema/ghost-nodes.ts` — NOT `ghosttrap.ts`. Adding it to `ghosttrap.ts` creates an ambiguous export collision.

**Why:** The ghost-nodes schema was created as the canonical home for Ghost Trap rule infrastructure during the Ghost Node feature sprint. Ghosttrap.ts schema only owns the runtime tables (probes, beacons, config, sessions, evidence, blocked sources).

**How to apply:** When writing routes that use `ghostTrapRulesTable`, just import from `@workspace/db` — it re-exports everything. Never declare it again in `ghosttrap.ts`.

## Columns (as of current schema)
| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| userId | text NOT NULL | Clerk userId |
| ruleType | text NOT NULL | `path_pattern` \| `ua_pattern` \| `header_pattern` \| `ip_cidr` |
| pattern | text NOT NULL | value to match |
| action | text NOT NULL default "log" | `log` \| `tarpit` \| `block` \| `silk_trap` |
| priority | integer NOT NULL default 50 | lower = higher priority |
| enabled | boolean NOT NULL default true | |
| description | text nullable | human label |
| matchCount | integer NOT NULL default 0 | auto-incremented on match |
| lastMatchAt | timestamp nullable | |
| createdAt | timestamp NOT NULL | |
| updatedAt | timestamp NOT NULL | |

## CRUD routes (in ghosttrap.ts)
- `GET /api/ghost-trap/rules` — list rules for authed user
- `POST /api/ghost-trap/rules` — requireRbac("counter_attack")
- `PATCH /api/ghost-trap/rules/:id` — requireRbac("counter_attack")
- `DELETE /api/ghost-trap/rules/:id` — requireRbac("counter_attack")
