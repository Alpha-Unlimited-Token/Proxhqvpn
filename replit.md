# GhostNet VPN — Workspace

## Overview

GhostNet is an advanced VPN orchestration and security platform with 60-node mesh (50 outer + 10 inner), silk web trap network, port knocking, mTLS, beacons/spiders/worms, firewall, WireGuard config generation, SQL interface (local + external PostgreSQL + HTTP API mode), terminal emulator (Ghost Mode with full outbound), security audit suite, system monitor, Tor/SOCKS5 integration, kill switch, leak detection, threat intelligence, split tunneling, and DPI obfuscation. React + Vite frontend; Express/PostgreSQL backend.

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
| /kill-switch | KillSwitch | Kill switch arm/disarm, mode config, OS firewall rule generator (Linux/macOS/Windows) |
| /leaks | LeakDetection | DNS/IPv6/WebRTC leak detection suite + browser console test script |
| /threat-intel | ThreatIntel | IP reputation checker, Tor exit node feed, local blocklist, 6 threat feeds |
| /wireguard | WireGuardConfig | Per-node WireGuard config generator |
| /split-tunnel | SplitTunnel | Per-IP/CIDR/port/app routing rules, Linux/Windows script generator |
| /obfuscation | Obfuscation | obfs4/Shadowsocks/V2Ray-WS/Meek/Snowflake/XOR DPI bypass config |
| /monitor | SystemMonitor | CPU, RAM, network metrics |
| /proxy | ProxyConfig | Tor Browser, SOCKS5, multi-OS, port knocking docs |
| /onion-browser | OnionBrowser | Proxied browser (Direct/GhostNet/Tor/Double/Custom SOCKS4/5/HTTP) |
| /terminal | Terminal | 4-tab shell (SHELL/HTTP CLIENT/PORT SCAN/AUDIT LOG), Ghost Mode toggle for full outbound |
| /sql | SqlInterface | 3-mode SQL interface (LOCAL DB/EXTERNAL DB/HTTP API), external PostgreSQL connection manager + schema explorer |
| /security-audit | SecurityAudit | Self-audit findings (Critical/High/Medium/Low), TLS cert inspector, HTTP security-headers grader (A–F), WHOIS/RDAP lookup |

## API Routes (api-server)

| Prefix | Module | Description |
|--------|--------|-------------|
| /api/nodes | nodes.ts | Node CRUD, IP rotation |
| /api/beacons | beacons.ts | Beacon/spider/worm alerts |
| /api/silkweb | silkweb.ts | Silk web topology, trapped entities |
| /api/firewall | firewall.ts | Firewall rules, blacklist, iptables export |
| /api/monitor | monitor.ts | CPU/RAM/network/connections |
| /api/terminal | terminal.ts | Shell exec (allowlist + Ghost Mode), /http-request outbound client, /port-scan TCP scanner, /audit-log viewer |
| /api/sql | sqlquery.ts | Local SELECT-only + external PostgreSQL full CRUD + /http-query REST→table mode, /connections manager, /schema explorer |
| /api/security-audit | securityaudit.ts | TLS cert check, HTTP header grader, WHOIS/RDAP, self-audit findings |
| /api/proxy-browser | proxybrowser.ts | Proxy/Tor browsing + custom proxy |
| /api/killswitch | killswitch.ts | Kill switch state, OS firewall rule generation |
| /api/leaks | leaks.ts | DNS/IPv6/WebRTC leak detection |
| /api/threatintel | threatintel.ts | IP reputation, blocklist, Tor exit feed, intelligence feeds |
| /api/split-tunnel | splittunnel.ts | Split tunneling rules, Linux/Windows route script gen |
| /api/obfuscation | obfuscation.ts | obfs4/Shadowsocks/V2Ray config, DPI test guide |

## Standalone Build

- `standalone/src/server.ts` — embedded Node.js server with full GhostNet API
- `standalone/tun_daemon.py` — Python TUN/TAP daemon (Linux utun0, macOS utun, Windows WinTun)
- `standalone/docker-compose.yml` — wg-easy + ghostnet + tor services
- `standalone/build.mjs` — multi-platform build (Windows/macOS-arm64/macOS-x64/Linux + All-Platforms zip)

## Security Hardening

- Helmet (CSP, HSTS, noSniff, XSS filter)
- express-rate-limit (global 500/min, terminal 30/min, SQL 60/min, mutate 100/min)
- Strict CORS with Replit regex allowlist
- 64kb body limits
- Shell allowlist enforcement + HARD_BLOCKED destructive pattern list in terminal route
- Ghost Mode: bypasses allowlist while still enforcing HARD_BLOCKED patterns; all Ghost Mode commands logged to audit log
- SELECT-only enforcement in local SQL mode; full CRUD/DDL permitted on external connections
- External PostgreSQL connections: in-memory pool map with 10-connection cap, masked display of connection strings
- Terminal audit log: timestamped record of every executed command + Ghost Mode status

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally
- `cd standalone && node build.mjs` — rebuild all 6 standalone platform zips

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
