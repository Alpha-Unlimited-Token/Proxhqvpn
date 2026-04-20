# GhostNet VPN — Workspace

## Overview

GhostNet is a VPN orchestration and security platform with 60-node mesh (50 outer + 10 inner), silk web trap network, port knocking, mTLS, beacons/spiders/worms, firewall, WireGuard config generation, SQL interface, terminal emulator, system monitor, and Tor/SOCKS5 integration. React + Vite frontend; Express/PostgreSQL backend.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod v3 (always `import from "zod"`, never `"zod/v4"`)
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Pages

| Route | Page | Description |
|-------|------|-------------|
| / | Dashboard | Live stats, node feed, intrusion alerts |
| /nodes | NodeManager | Swarm grid with 3s rotation + lifecycle animations |
| /beacons | BeaconAlerts | Spider/worm/beacon alert table |
| /silkweb | SilkWeb | SVG chord topology map + trapped entity list |
| /firewall | Firewall | Rules, blocked IPs, IPTables export |
| /wireguard | WireGuardConfig | Per-node WireGuard config generator |
| /monitor | SystemMonitor | CPU, RAM, network metrics |
| /terminal | Terminal | Shell emulator with arrow-key command history |
| /sql | SqlInterface | SELECT-only SQL query interface |
| /proxy | ProxyConfig | Tor Browser, SOCKS5, multi-OS, port knocking docs |

## Security Hardening

- Helmet (CSP, HSTS, noSniff, XSS filter)
- express-rate-limit (global 300/min, terminal 20/min, SQL 30/min, mutate 60/min)
- Strict CORS with Replit regex allowlist
- 64kb body limits
- Shell metacharacter stripping in terminal route
- SELECT-only enforcement in SQL route

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
