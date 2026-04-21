# ProxhqVPN — Workspace

**Brand:** ProxhqVPN | **Copyright:** © ALPHA UNLIMITED TECHNOLOGIES LLC

## Overview

ProxhqVPN is an advanced VPN orchestration and security platform with 60-node mesh (50 outer + 10 inner), silk web trap network, port knocking, mTLS, beacons/spiders/worms, firewall, WireGuard config generation, SQL interface (local + external PostgreSQL + HTTP API mode), terminal emulator (ProxhqVPN Mode with full outbound), security audit suite, system monitor, Tor/SOCKS5 integration, kill switch, leak detection, threat intelligence, split tunneling, and DPI obfuscation. React + Vite frontend; Express/PostgreSQL backend.

**Latest additions:**
- `/downloads` — Multi-platform download/install page: Windows, macOS, Linux, Android, iPhone/iPad, Amazon Fire Stick, Fire TV, Android TV/Google TV, Samsung/LG Smart TVs, Apple TV, Routers (OpenWRT/DD-WRT/pfSense/AsusWRT), Roku, PS5/Xbox, Raspberry Pi, Chromebook.
- `/guide` — Complete comprehensive user guide / instruction manual covering all 20+ features with step-by-step instructions, command references, SQLmap code examples, and Alpha Toolkit full documentation.
- Alpha Toolkit Scanner → Verifier pipeline: Scanner generates HTML report → `htmlReady` flag on poll endpoint → "Send to Verifier" auto-switches tab and pre-loads the report HTML.
- `artifacts/desktop/` — Electron desktop app for Windows, macOS, and Linux. 4-screen setup wizard with OS-specific WireGuard consent checkbox (legal gate), silent WireGuard install (Win: official installer/S; Mac: Homebrew; Linux: apt/dnf/yum/pacman/zypper), progress log, and main app launch. See `artifacts/desktop/BUILD_INSTRUCTIONS.md` for building installers.
- `/setup` — Admin server setup page: auto-installs all server-side dependencies (openvpn, proxychains4, wireguard-tools, tor, iptables) with streaming install log and dependency status grid.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5 (async errors auto-forwarded to error handler)
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod v3 (always `import from "zod"`, never `"zod/v4"`)
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Authentication

Clerk-based auth (app_3CcwHo66ohArVtaIa0XTcv88i4Y). Env vars: `VITE_CLERK_PUBLISHABLE_KEY`, `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`.
- `/` — Public landing page (ProxhqVPN marketing). Signed-in users redirect to `/dashboard`.
- `/sign-in`, `/sign-up` — Branded Clerk auth pages with ProxhqVPN dark/green terminal theme.
- All `/dashboard/*` routes — Protected. Unauthenticated users redirect to `/sign-in`.
- API proxy: `CLERK_PROXY_PATH = /api/__clerk` (only active in production, dev uses Clerk dev instance directly).
- Sign-out available via Layout sidebar footer.
- **All `/api/*` routes (except `/api/healthz`) require a valid Clerk session** — enforced by `requireAuth` middleware in `routes/index.ts` using `getAuth(req)` from `@clerk/express`.

**STRICT RULE: No mock/simulated data anywhere.** All pages use real APIs or real DB. `useSilkWebEngine.ts` was deleted.

## Pages

| Route | Page | Description |
|-------|------|-------------|
| / | Home | Public landing page — ProxhqVPN OS marketing + CTA |
| /dashboard | Dashboard | Live stats, node feed, intrusion alerts (auth required) |
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
| /monitor | SystemMonitor | CPU, RAM, network metrics (all real: `/proc/net/dev`, `ss`, `wg show`, `api.ipify.org`) |
| /proxy | ProxyConfig | Tor Browser, SOCKS5, multi-OS, port knocking docs |
| /onion-browser | OnionBrowser | Proxied browser (Direct/ProxhqVPN Onion/Tor/Double/Custom SOCKS4/5/HTTP) — **VPN Basic tier** (Tor over VPN or standalone) |
| /terminal | Terminal | 4-tab shell (SHELL/HTTP CLIENT/PORT SCAN/AUDIT LOG), ProxhqVPN Mode toggle for full outbound |
| /sql | SqlInterface | 3-mode SQL interface (LOCAL DB/EXTERNAL DB/HTTP API), external PostgreSQL connection manager + schema explorer |
| /security-audit | SecurityAudit | Self-audit findings (Critical/High/Medium/Low), TLS cert inspector, HTTP security-headers grader (A–F), WHOIS/RDAP lookup |
| /vpn-coexist | VpnCoexist | Run ProxhqVPN alongside NordVPN/ExpressVPN/ProtonVPN/Mullvad/Surfshark — 4 coexistence modes (fwmark, double-hop, namespace, routing-table), auto-detect running VPNs, exception rules (bypass-proxhq/force-proxhq/block), MTU optimizer, script generator |
| /platforms | Platforms | Device support grid (20+ devices: desktop/mobile/TV/console/router/browser) with expandable setup guides and links to relevant config pages |
| /devices | DeviceManager | WireGuard device management — add/remove devices, per-device config download + QR code scan (react-qr-code) |
| /smart-dns | SmartDns | DNS-only routing for TVs/consoles — server IP display, per-platform instructions, DNS reachability test |
| /dns-shield | DnsShield | DNS-level blocking — ads/trackers/malware/adult toggles, custom allow/block rules, DNS-over-HTTPS, built-in rule lists |
| /router-config | RouterConfig | Router firmware config generator — OpenWRT/DD-WRT/Merlin/pfSense/GL.iNet/Ubiquiti with downloadable scripts + .conf files |

## API Routes (api-server)

| Prefix | Module | Description |
|--------|--------|-------------|
| /api/healthz | health.ts | Public health check |
| /api/nodes | nodes.ts | Node CRUD, IP rotation |
| /api/beacons | beacons.ts | Beacon/spider/worm alerts |
| /api/silkweb | silkweb.ts | Silk web topology, trapped entities |
| /api/firewall | firewall.ts | Firewall rules, blacklist, iptables export |
| /api/monitor | monitor.ts | Real CPU/RAM (`os.*`), real network I/O (`/proc/net/dev`), real connections (`ss`), real WG tunnels (`wg show`), real external IP (`api.ipify.org`) |
| /api/terminal | terminal.ts | Shell exec (allowlist + ProxhqVPN Mode), /http-request outbound client, /port-scan TCP scanner, /audit-log viewer |
| /api/sql | sqlquery.ts | Local SELECT-only + external PostgreSQL full CRUD + /http-query REST→table mode, /connections manager, /schema explorer |
| /api/security-audit | securityaudit.ts | TLS cert check, HTTP header grader, WHOIS/RDAP, self-audit findings |
| /api/proxy-browser | proxybrowser.ts | Proxy/Tor browsing + custom proxy |
| /api/killswitch | killswitch.ts | Kill switch state, OS firewall rule generation |
| /api/leaks | leaks.ts | DNS/IPv6/WebRTC leak detection |
| /api/threatintel | threatintel.ts | IP reputation, blocklist, Tor exit feed, intelligence feeds |
| /api/split-tunnel | splittunnel.ts | Split tunneling rules, Linux/Windows route script gen |
| /api/obfuscation | obfuscation.ts | obfs4/Shadowsocks/V2Ray config, DPI test guide |
| /api/vpn-coexist | vpncoexist.ts | VPN coexistence: detect running VPNs, commercial profiles, exception rules, script generation (fwmark/double-hop/namespace/routing-table), MTU optimizer. Fields: `proxhqIface`, `proxhqFwmark` |
| /api/vpngate | vpngate.ts | VPN Gate integration (6000+ nodes), veil node selector, connect/disconnect, status, config export. Response key: `servers` |
| /api/devices | devices.ts | WireGuard device registry — add/list/delete devices, IP allocation (10.8.0.x/24), per-device client config + server peer snippet |
| /api/dns-shield | dnsshield.ts | DNS-level block/allow rules (ads/trackers/malware/adult categories), DoH config, stats, built-in lists loader |
| /api/smart-dns | smartdns.ts | Smart DNS server IP, per-platform instructions (Samsung TV/LG/Roku/Xbox/PS5/iOS/Android/Windows/macOS/Router), DNS reachability test |
| /api/router-config | routerconfig.ts | Router config generator for 6 firmwares (OpenWRT/DD-WRT/Merlin/pfSense/GL.iNet/Ubiquiti) — returns commands, steps, .conf |

## Standalone Build

- `standalone/src/server.ts` — embedded Node.js server with full ProxhqVPN API
- `standalone/tun_daemon.py` — Python TUN/TAP daemon (Linux utun0, macOS utun, Windows WinTun)
- `standalone/docker-compose.yml` — wg-easy + proxhq + tor services
- `standalone/build.mjs` — multi-platform build (Windows/macOS-arm64/macOS-x64/Linux + All-Platforms zip)

## Security Hardening

- Helmet (CSP, HSTS, noSniff, XSS filter)
- express-rate-limit (global 300/min, terminal 20/min, SQL 30/min, mutate 60/min)
- Strict CORS with Replit regex allowlist
- 64kb body limits
- **Clerk `requireAuth` on all API routes** (except `/api/healthz`) — `getAuth(req).userId` check
- Shell allowlist enforcement + HARD_BLOCKED destructive pattern list in terminal route
- ProxhqVPN Mode: bypasses allowlist while still enforcing HARD_BLOCKED patterns; all commands logged to audit log
- SELECT-only enforcement in local SQL mode; full CRUD/DDL permitted on external connections
- External PostgreSQL connections: in-memory pool map with 10-connection cap, masked display of connection strings
- Terminal audit log: timestamped record of every executed command + ProxhqVPN Mode status
- Zod validation on all POST body parameters in all routes

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally
- `cd standalone && node build.mjs` — rebuild all 6 standalone platform zips

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
