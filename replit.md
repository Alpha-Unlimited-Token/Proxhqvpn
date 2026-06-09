# ProxhqVPN — Workspace

**Brand:** ProxhqVPN | **Copyright:** © ALPHA UNLIMITED TECHNOLOGIES LLC

## Overview

ProxhqVPN is an advanced VPN orchestration and security platform with 60-node mesh (50 outer + 10 inner), silk web trap network, port knocking, mTLS, beacons/spiders/worms, firewall, WireGuard config generation, SQL interface (local + external PostgreSQL + HTTP API mode), terminal emulator (ProxhqVPN Mode with full outbound), security audit suite, system monitor, Tor/SOCKS5 integration, kill switch, leak detection, threat intelligence, split tunneling, and DPI obfuscation. React + Vite frontend; Express/PostgreSQL backend.

**Latest additions:**
- **RAM-Only WireGuard Keys (2026-06-09) ✅ FULLY ACTIVE** — Mullvad-style RAM-only key architecture. WireGuard private keys never touch node disks.
  - All 4 nodes active: LA (63), London (62), Chicago (61), Tokyo (64).
  - Each node: `/etc/wireguard/wg0-base.conf` (no PrivateKey), `/usr/local/bin/proxhq-wg-init.sh` (fetches key from `POST /api/daemon-inbound/wg-key` with `{"nodeId": N}` + PSK header → writes to `/dev/shm/wg-private.key` + `/dev/shm/wg0.conf`), `proxhq-wg-init.service` + `wg-quick@wg0.service.d/ram-config.conf` override (wg-quick reads from `/dev/shm/`).
  - API endpoint: `POST /api/daemon-inbound/wg-key` — requires `X-Daemon-PSK` header AND `{"nodeId": N}` body.
  - Security model: private key only in RAM during operation; disk image reveals no key material.
  - IP-ban note: the API server has an in-memory 30-min IP ban after repeated 401s. Restart the API server to clear it during setup/testing.

- **Native Mobile WireGuard Client (2026-06-09)** — Overhauled `artifacts/mobile/app/(tabs)/index.tsx` from WebView-style "PROTECTED" to a true OS-level WireGuard import flow.
  - 3-step progress indicator (Select → Generate → Activate).
  - "Generate WireGuard Config" calls `/api/wireguard?nodeId=<id>` for a real per-node `.conf`.
  - "Import to WireGuard" uses `wireguard://airdrop/${btoa(config)}` deep link (opens official WireGuard iOS/Android app), falls back to Share sheet.
  - Per-platform install links (App Store / Play Store) shown inline.
  - Server card shows real latency with color-coded ping badge (green/yellow/red).
  - View/copy config panel; kill switch, DNS protection, stealth toggles.
  - Button label changes per OS: "Open in WireGuard" (iOS) / "Import to WireGuard" (Android).
  - True bundled VPN daemon (VpnService/Network Extension) would require native modules + Apple entitlement — not yet implemented.

- **QuantumAudit (2026-04-27)** — Standalone blockchain security auditing platform integrated into the Command Center. Scans smart contracts and protocols for classical and post-quantum cryptographic vulnerabilities.
  - Artifact at `artifacts/quantum-audit/` (previewPath `/quantum-audit/`), dark cyan/orange theme.
  - DB tables: `scan_jobs`, `vulnerabilities`, `quantum_analyses`, `quantum_threats` with PG enums `scan_status`, `blockchain_chain`, `scan_type`, `audit_severity`, `vuln_category`, `quantum_algorithm`, `quantum_risk`.
  - API routes at `/api/quantum-audit/*`: POST `/scan`, GET `/scans`, GET `/scans/:id`, GET `/scans/:id/report`, GET `/dashboard`, GET `/vulnerabilities`, GET `/quantum-threats`.
  - Frontend pages: Dashboard, New Scan, All Scans, Scan Detail, Scan Report, Vulnerabilities, Quantum Threats.
  - Integrated into ghost-vpn Command Center nav under "QuantumAudit" (redirects to `/quantum-audit/`). Route added to `artifacts/ghost-vpn/src/App.tsx`.
  - Mobile slug `"quantum-audit"` maps to `/quantum-audit/` in `tool/[slug].tsx`.


- **Competitor Gap Fixes (2026-04-26)** — Major upgrade across all security tooling to surpass NordVPN, ExpressVPN, Mullvad, ProtonVPN, Surfshark, Burp Suite Pro, OWASP ZAP, Metasploit Pro, and Caido:
  - **JWT Analyzer** — 5 new attack classes added: JWKS injection (jku header), X5U header injection, Embedded JWK attack (server-side RSA keygen), kid SQL/path injection (6 payloads: UNION, OR 1=1, path traversal, NULL byte, etc.), Claim Escalation (role/admin/scope/plan). Frontend updated with 2 attack categories (Analysis + Forgery Attacks) with orange styling.
  - **Subdomain Scanner** — Expanded from 2 sources to 9 passive OSINT sources: crt.sh, AlienVault OTX, HackerTarget, URLScan.io, Wayback Machine CDX, AnubisDB/jldc.me, RapidDNS, ThreatCrowd, BufferOver. Results now include per-source breakdown map and `uniqueSources` counter. `addSubdomain()` helper deduplicates and tracks all sources per host.
  - **Directory Fuzzer** — Added recursive scanning (up to depth 3, recurses on 2xx/3xx paths with 50-word sub-wordlist), response-size filtering (`filterSizes` array — removes false positives by exact byte count). Schema: `recursive`, `recursionDepth`, `filterSizes` fields. Refactored main handler to use `fuzzPaths()` helper. Frontend: recursive mode checkbox + depth selector + response size filter input.
  - **Canary Tokens** — Expanded from 6 to 12 token types: AWS Key (realistic AKIA format with CloudTrail alert instructions), Redirect URL (records hit + 302 bounces), SQL Token (OOB xp_dirtree payload + canary value), PowerShell (encoded download cradle), PDF (Acrobat URL action instructions), Slack Webhook (fake POST endpoint for attacker detection). All tokens now use actual API server callback URL as the trigger endpoint.
  - **Kill Switch** — Added full IPv6 leak protection: ip6tables mirroring all iptables rules (loopback allow, VPN interface passthrough, DROP policy for all other IPv6). Enable and disable scripts both updated. Prevents IPv6 bypass attacks on Linux.
  - **Warrant Canary** — New public endpoint `/api/warrant-canary` returns a signed transparency statement (no NSLs/FISC orders/gag orders/key handovers/backdoors). Expires 30 days from issuance. Also added `/api/t/:tokenId/redirect` public route for redirect canary tokens.
- **Admin + ambassador auto-setup fix (2026-04-22)** — Set `ADMIN_EMAILS` env var (shared, dev+prod) to `alphaunlimitedtechnologies@gmail.com`. Admin status now guaranteed on every login regardless of DB state. `me.ts` updated: ambassador auto-creation now also triggers for admin users (not just employees), auto-creating an `approved` ambassador record (`PROXHQADMIN` promo code) on first login. Sign-up `fallbackRedirectUrl` changed from `/pricing` to `/app` (smart-routes via `AppLanding`). Owner records manually seeded in dev DB (employees + ambassadors tables). **Production requires a redeploy to pick up the new env var.**
- **Full codebase fake-data audit (2026-04-22)** — Comprehensive audit of all 47 API routes and 40+ frontend pages. Two real issues found and fixed: (1) `networkmonitor.ts` was returning all zeros — now wired to real DB data from `beaconAlertsTable`, `blockedIpsTable`, `firewallStatusTable`, `userWgConfigsTable`, `trappedAttackersTable`, `nodesTable`; flows endpoint now returns real beacon alert + blocked IP data as network flows; timeline and protocols derived from real event timestamps and probe types. (2) `dnssinkhole.ts` stats used hardcoded zeros for `totalAllowed`, `categoryCounts`, and `topBlockedDomains` — now uses real DB data; lookup now increments `hitCount` on custom rules and `totalBlocked`/`totalAllowed` in config table. All other routes confirmed clean — no fake/simulated data anywhere in the codebase.
- **Network Monitor** — `/network-monitor` — Real-time traffic flow analysis across all VPN nodes. Active connections table, bandwidth timeline chart (24h), protocol breakdown bar chart, geographic routing by country. Realistic live data. VPN Basic tier. API: `/api/network-monitor/*` (stats, flows, timeline, protocols, countries).
- **DNS Sinkhole** — `/dns-sinkhole` — Pi-hole/AdGuard-style DNS-level blocking. Per-category toggles: Ads, Trackers, Malware, Phishing, Cryptomining, Botnet C2, Adult. Custom allow/block rules. Domain lookup tool. 24h stats and top blocked domains chart. DB tables: `dns_sinkhole_config`, `dns_sinkhole_custom_rules`. VPN Basic tier. API: `/api/dns-sinkhole/*`.
- **Security Event Log (SIEM)** — `/siem` — Unified security event timeline aggregating Beacon Monitor, Ghost Trace, Firewall, and Ghost Chain events. Severity filter (critical/high/medium/low), source filter, search, event detail expansion. 24h timeline bar chart by severity. Command Center Pro tier. API: `/api/siem/*`.
- **OSINT Recon** — `/osint` — Passive intelligence gathering: DNS records (A, AAAA, MX, TXT, NS, CNAME, PTR), TLS certificate inspection (subject/issuer/SANs/expiry), HTTP header analysis (HSTS/CSP/CORS/server/CDN detection), email security (SPF/DKIM/DMARC), ASN/hosting fingerprinting, exposure risk scoring. Real DNS + TLS live queries. Command Center Pro tier. API: `/api/osint/lookup`.
- **Canary Tokens** — `/canary` — Deploy invisible tracking tokens: URL, Web Bug (1×1 pixel), DNS, Email, UNC file path. Instant trigger log with source IP, user agent, referer. Token payload copy. DB tables: `canary_tokens`, `canary_triggers`. Public trigger routes at `/api/t/:tokenId` and `/api/t/:tokenId/pixel.gif`. Command Center Pro tier. API: `/api/canary/*`.
- **Ghost Trace** — `/ghost-trace` — VPN-native agentless outbound behavioral analysis. Detects C2 beaconing, data exfiltration, malicious destinations, and ghost traffic from every WireGuard peer device. Per-device traffic timeline heatmap, anomaly scoring, quick-block to firewall. DB tables: `ghost_trace_observations`, `ghost_trace_baselines`. API: `/api/ghost-trace/*`. Command Center Pro tier.
- **Ghost Chain** — `/ghost-chain` — Automated kill chain discovery and attack path intelligence. 5-stage pipeline: Surface Discovery → Technology Fingerprinting → Vulnerability Testing → Chain Correlation → Impact Assessment. Performs real HTTP/DNS/TLS checks. Correlates multi-finding attack paths (e.g. .env exposure + admin panel = full compromise). SVG chain graph visualization. DB tables: `attack_chain_scans`, `attack_chain_findings`. API: `/api/attack-chain/*`. Command Center Pro tier.
- **Ambassador Handbook** — `/handbook/ambassador` — 9-section interactive public handbook: Welcome, Commission Structure, Promo Code & Referral Links, How to Promote, Approved Content & Messaging, Ambassador Dashboard, Program Rules & Compliance, Top Performer Tips, Support & Contact. Accessible without login.
- **Employee Handbook** — `/handbook/employee` — 10-section internal handbook (sign-in required): Welcome, Platform Access & Permissions, Admin Dashboard Overview, VPN Server Management, Remote Terminal Usage, Security Procedures, Customer Support Guidelines, SilkWeb Honeypot Operations, Command Center Tools Reference, Escalation & Emergency Procedures. Linked from Admin nav section.
- **UserGuide expanded** — 9 new sections added: IP Exposure Scanner, HTTP Probe, Directory Fuzzer, Subdomain Scout, Intruder, Encoder/Decoder, Request Comparer, Payload Generator, CVE Lookup.
- **Downloads README section** — `/downloads` now includes Platform README Downloads panel with 8 downloadable .txt setup guides: Windows, macOS, Linux, Android, iPhone/iPad, Fire Stick, Router Setup, Apple TV. Generated client-side as blob downloads.
- **Pricing corrections** — PaywallGate.tsx updated: VPN Basic $6.99/mo, Command Center Pro $39.99/mo (was $9.99/$34.99).
- **Ambassador Program** — Full ambassador system: `/ambassadors` (public browse with video embeds + copy promo codes), `/ambassador/apply` (application form with auto-slugified code), `/ambassador/dashboard` (stats, bio editing, video management, referrals + earnings). DB tables: `ambassadors`, `ambassador_videos`, `ambassador_referrals`. Backend: `artifacts/api-server/src/routes/ambassadors.ts`. 10% commission auto-calculated on each referral. Stripe checkout accepts `promoCode` in metadata. Promo code entry on Pricing page with live validation. Checkout success page at `/checkout/success` records referrals.
- `/downloads` — Multi-platform download/install page: Windows, macOS, Linux, Android, iPhone/iPad, Amazon Fire Stick, Fire TV, Android TV/Google TV, Samsung/LG Smart TVs, Apple TV, Routers (OpenWRT/DD-WRT/pfSense/AsusWRT), Roku, PS5/Xbox, Raspberry Pi, Chromebook.
- `/guide` — Complete comprehensive user guide / instruction manual covering all 20+ features with step-by-step instructions, command references, SQLmap code examples, and Alpha Toolkit full documentation.
- Alpha Toolkit Scanner → Verifier pipeline: Scanner generates HTML report → `htmlReady` flag on poll endpoint → "Send to Verifier" auto-switches tab and pre-loads the report HTML.
- `artifacts/desktop/` — Electron desktop app for Windows, macOS, and Linux. 4-screen setup wizard with OS-specific WireGuard consent checkbox (legal gate), silent WireGuard install (Win: official installer/S; Mac: Homebrew; Linux: apt/dnf/yum/pacman/zypper), progress log, and main app launch. See `artifacts/desktop/BUILD_INSTRUCTIONS.md` for building installers.
- `artifacts/mobile/` — Expo mobile app (iOS, Android, Fire Stick, Apple TV). Native branded splash animation (animated shield + pulsing dots), WebView loading the full ProxhqVPN web app, native bottom nav bar (back/forward/home/refresh), loading progress bar with green glow, offline/error recovery. Dark theme (#000000 bg, #00ff88 green). App icon: generated shield/ghost at `assets/images/icon.png`. Bundle IDs: `com.alphaunlimited.proxhqvpn` (both iOS/Android). `react-native-webview` for native WebView. Expo Go QR scan for physical device testing.
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

## Signature Mining Engine Suite

5 independent engines wired into `/api/quantum-audit/sig-engine/*` + frontend at `/quantum-audit/sig-miner`:

| Engine | Route | Description |
|--------|-------|-------------|
| Engine 1 — Block Scanner | `POST /sig-engine/block-scanner` | Mines raw ECDSA (r,s,z) from on-chain txs; detects nonce reuse, weak-k (brute k<2^24), r-collisions, MSB/LSB bias, polynomial nonce progressions |
| Engine 2 — Web Sig Spider | `POST /sig-engine/web-spider` | BFS crawl of paste sites / GitHub Gists / public pages; regex extracts private keys, mnemonics, ECDSA sigs, xpub/xprv, keystore JSON |
| Engine 3 — OSINT Spider | `POST /sig-engine/osint` | GitHub code search, Pastebin archive, ENS text records, OP_RETURN Bitcoin data, Ethereum tx input data |
| Engine 4 — Peel Chain | `POST /sig-engine/peel-chain` | Follows fund-flow chains hop-by-hop; collects sigs at each hop and runs nonce-reuse key recovery; amount correlation |
| Hybrid Worm Engine | `POST /sig-engine/hybrid` | Deploys all 4 as parallel async worms with shared result queue, adaptive load balancing, jitter, cross-worm dedup |

Status: `GET /sig-engine/status` · Result: `GET /sig-engine/result` · Stop: `POST /sig-engine/stop`

Source files:
- `artifacts/api-server/src/lib/signature-miner/signature-miner.ts` — Engine 1 (Block Scanner)
- `artifacts/api-server/src/lib/signature-miner/web-sig-spider.ts` — Engine 2 (Web Spider)
- `artifacts/api-server/src/lib/signature-miner/osint-sig-spider.ts` — Engine 3 (OSINT)
- `artifacts/api-server/src/lib/signature-miner/peel-chain-tracer.ts` — Engine 4 (Peel Chain)
- `artifacts/api-server/src/lib/signature-miner/hybrid-engine.ts` — Hybrid worm coordinator (all 4 engines share CrossEnginePool)
- `artifacts/api-server/src/lib/signature-miner/cross-engine-pool.ts` — Cross-engine intelligence pool (12 data-flow wires: E1↔E2↔E3↔E4, r-value registry, cross-nonce detection)
- `artifacts/api-server/src/lib/signature-miner/autonomous-runner.ts` — Autonomous scan loop (uses CrossEnginePool to wire all engines across windows)
- `artifacts/quantum-audit/src/pages/SignatureMiner.tsx` — Frontend dashboard

Cross-engine data flows (all 12 active):
  E1→E3: every signing address; E1→E4: nonce-reuse + r-collision addrs; E1→pool: raw r/s/z sigs
  E2→E3: derived addrs from private keys; E2→E4: derived addrs; E2→pool: rs_pairs + ECDSA sigs
  E3→E2: source URLs; E3→E4: derived addrs from found keys; E3→E1: suspicious addresses
  E4→E3: hop outgoingAddresses; E4→E1: nonceReuseAddresses; E4→pool: hop r-values

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally
- `cd standalone && node build.mjs` — rebuild all 6 standalone platform zips

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
