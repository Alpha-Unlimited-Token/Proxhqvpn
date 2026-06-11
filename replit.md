# ProxhqVPN — Workspace

**Brand:** ProxhqVPN | **Copyright:** © ALPHA UNLIMITED TECHNOLOGIES LLC

## Overview

ProxhqVPN is an advanced VPN orchestration and security platform: 60-node WireGuard mesh (50 outer + 10 inner), silk-web honeypot network, port knocking, mTLS, beacons/spiders/worms, firewall suite, RAM-only WireGuard key architecture, ZTNA device posture, SIEM integration, RBAC, SHA3-256 audit chain, SQL interface (local + external PostgreSQL + HTTP API), terminal emulator (ProxhqVPN Mode), security audit suite, system monitor, Tor/SOCKS5, kill switch, leak detection, threat intelligence, split tunneling, DPI obfuscation, QuantumAudit blockchain scanner, and Sig Mining Engine. React + Vite frontend; Express/PostgreSQL backend.

## Recent Changes (2026-06-09)

- **Top-3 Gap Bridge** — RBAC (`lib/rbac.ts`, 6 roles), device trust/ZTNA (`lib/device-trust.ts`, score ≥ 75 = allow), SHA3-256 + HMAC-SHA512 audit ledger upgrade (`lib/audit-chain.ts`), SIEM fanout to Splunk HEC + webhook (`lib/siem.ts`), `POST /api/ztna/posture` + `GET /api/ztna/device/:fp`, `ztna_devices` DB table, 5 ops scripts + 2 hardened installers.
- **Node Security Hardening** — 9 systemd services, `firewallTrafficDecisionsTable`, hardening script downloadable from Firewall → NodeSync. ATR never blocks WireGuard FORWARD chain.
- **RAM-Only WireGuard Keys** — Mullvad-style; 4 active nodes (LA/London/Chicago/Tokyo). Keys only in `/dev/shm`, fetched via `POST /api/daemon-inbound/wg-key` with PSK header.
- **Native Mobile WireGuard** — 3-step flow (Select → Generate → Activate), deep-link `wireguard://airdrop/`, per-OS install links, real latency badges.
- **Security patches (prev session)** — `encrypted-secret-store.ts`, `daemon-auth.ts`, passive-only `daemon-inbound.ts`, break-glass token in terminal, AES-256-GCM WireGuard key envelope encryption.

## Stack

- **Monorepo**: pnpm workspaces
- **Node.js**: 24 | **TypeScript**: 5.9 | **Package manager**: pnpm
- **API framework**: Express 5 (async errors auto-forwarded)
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod v3 — always `import from "zod"`, never `"zod/v4"`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (ESM bundle)

## Authentication

Clerk (`app_3CcwHo66ohArVtaIa0XTcv88i4Y`). Env vars: `VITE_CLERK_PUBLISHABLE_KEY`, `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`.
- `/` — Public landing. Signed-in users redirect to `/dashboard`.
- `/sign-in`, `/sign-up` — Branded Clerk auth pages (dark/green terminal theme).
- All `/dashboard/*` — Protected; unauthenticated → `/sign-in`.
- API proxy: `CLERK_PROXY_PATH = /api/__clerk` (production only).
- **All `/api/*` routes require Clerk session** (except `/api/healthz` and `/api/daemon-inbound/*`) — enforced by `requireAuth` middleware via `getAuth(req)`.
- `ADMIN_EMAILS=alphaunlimitedtechnologies@gmail.com` — admin guaranteed on every login regardless of DB state.

**STRICT RULE: No mock/simulated data.** All pages use real APIs or real DB.

## Pages

| Route | Page | Description |
|-------|------|-------------|
| / | Home | Public landing — ProxhqVPN marketing + CTA |
| /dashboard | Dashboard | Live stats, node feed, intrusion alerts |
| /nodes | NodeManager | Swarm grid with 3s rotation + lifecycle animations |
| /beacons | BeaconAlerts | Spider/worm/beacon alert table |
| /silkweb | SilkWeb | SVG chord topology map + trapped entity list |
| /firewall | Firewall | Rules, blocked IPs, iptables export, NodeSync hardening script |
| /kill-switch | KillSwitch | Arm/disarm, mode config, OS firewall rule generator (Linux/macOS/Windows + IPv6) |
| /leaks | LeakDetection | DNS/IPv6/WebRTC leak detection + browser console test script |
| /threat-intel | ThreatIntel | IP reputation, Tor exit feed, local blocklist, 6 threat feeds |
| /wireguard | WireGuardConfig | Per-node WireGuard config generator (RAM-only key flow) |
| /split-tunnel | SplitTunnel | Per-IP/CIDR/port/app routing rules, Linux/Windows script generator |
| /obfuscation | Obfuscation | obfs4/Shadowsocks/V2Ray-WS/Meek/Snowflake/XOR DPI bypass config |
| /monitor | SystemMonitor | Real CPU/RAM/network (`/proc/net/dev`, `ss`, `wg show`, `api.ipify.org`) |
| /proxy | ProxyConfig | Tor Browser, SOCKS5, multi-OS, port knocking docs |
| /onion-browser | OnionBrowser | Proxied browser (Direct/Onion/Tor/Double/Custom SOCKS) — VPN Basic tier |
| /terminal | Terminal | 4-tab shell (SHELL/HTTP CLIENT/PORT SCAN/AUDIT LOG), ProxhqVPN Mode + break-glass |
| /sql | SqlInterface | 3-mode SQL (LOCAL/EXTERNAL/HTTP API), connection manager, schema explorer |
| /security-audit | SecurityAudit | Self-audit findings, TLS cert inspector, HTTP header grader, WHOIS/RDAP |
| /vpn-coexist | VpnCoexist | Run alongside NordVPN/ExpressVPN/Mullvad etc — 4 coexistence modes, MTU optimizer |
| /platforms | Platforms | 20+ device support grid with expandable setup guides |
| /devices | DeviceManager | WireGuard device registry — add/remove, config download, QR code |
| /smart-dns | SmartDns | DNS-only routing for TVs/consoles — per-platform instructions, reachability test |
| /dns-shield | DnsShield | DNS-level blocking — category toggles, custom rules, DoH, built-in lists |
| /router-config | RouterConfig | Config generator for OpenWRT/DD-WRT/Merlin/pfSense/GL.iNet/Ubiquiti |
| /network-monitor | NetworkMonitor | Real-time traffic flow, bandwidth timeline, protocol breakdown, geo routing |
| /dns-sinkhole | DnsSinkhole | Pi-hole-style DNS blocking: Ads/Trackers/Malware/Phishing/Cryptomining/Botnet/Adult |
| /siem | SIEM | Unified security event timeline — Beacon/Firewall/GhostTrace/GhostChain aggregator |
| /osint | OsintRecon | DNS, TLS, HTTP headers, email security, ASN fingerprinting, exposure scoring |
| /canary | CanaryTokens | 12 token types — URL/pixel/DNS/email/AWS/SQL/PS1/PDF/Slack + trigger log |
| /ghost-trace | GhostTrace | Agentless outbound behavioral analysis — C2 beaconing, exfil, anomaly scoring |
| /ghost-chain | GhostChain | Automated kill chain discovery — 5-stage pipeline, SVG chain graph |
| /ambassadors | Ambassadors | Public ambassador browse — video embeds, promo code copy |
| /ambassador/apply | AmbassadorApply | Application form with auto-slugified promo code |
| /ambassador/dashboard | AmbassadorDash | Stats, bio editing, video management, referrals + earnings |
| /handbook/ambassador | AmbassadorHandbook | 9-section public handbook |
| /handbook/employee | EmployeeHandbook | 10-section internal handbook (auth required) |
| /guide | UserGuide | Complete instruction manual — all features, CLI references, Alpha Toolkit docs |
| /manuals | Manuals | Downloadable PDF-style manuals (RAM Keys, Node Hardening, Firewall Suite, etc.) |
| /downloads | Downloads | Multi-platform install page + README .txt guides |
| /setup | AdminSetup | Streaming server dependency installer (admin only) |
| /pricing | Pricing | Subscription plans — VPN Basic $6.99/mo, Command Center Pro $39.99/mo |

## API Routes (api-server)

| Prefix | Module | Description |
|--------|--------|-------------|
| /api/healthz | health.ts | Public health check |
| /api/nodes | nodes.ts | Node CRUD, IP rotation |
| /api/beacons | beacons.ts | Beacon/spider/worm alerts |
| /api/silkweb | silkweb.ts | Silk web topology, trapped entities |
| /api/firewall | firewall.ts | Rules, blacklist, iptables export, security events, node hardening script |
| /api/monitor | monitor.ts | Real CPU/RAM/network/WG tunnels/external IP |
| /api/terminal | terminal.ts | Shell exec (allowlist + ProxhqVPN Mode + break-glass), HTTP client, port scan, audit log |
| /api/sql | sqlquery.ts | Local SELECT-only + external full CRUD + HTTP API mode, connections, schema |
| /api/security-audit | securityaudit.ts | TLS cert, HTTP header grader, WHOIS/RDAP, self-audit |
| /api/proxy-browser | proxybrowser.ts | Proxy/Tor browsing |
| /api/killswitch | killswitch.ts | Kill switch state, OS rule generation (IPv4 + IPv6) |
| /api/leaks | leaks.ts | DNS/IPv6/WebRTC leak detection |
| /api/threatintel | threatintel.ts | IP reputation, blocklist, Tor exit feed, threat feeds |
| /api/split-tunnel | splittunnel.ts | Split tunneling rules, route script generation |
| /api/obfuscation | obfuscation.ts | obfs4/Shadowsocks/V2Ray config |
| /api/vpn-coexist | vpncoexist.ts | Coexistence profiles, detection, exception rules, MTU optimizer |
| /api/vpngate | vpngate.ts | VPN Gate (6000+ nodes), config export. Response key: `servers` |
| /api/devices | devices.ts | WireGuard device registry, IP allocation (10.8.0.x/24), config + QR |
| /api/dns-shield | dnsshield.ts | DNS block/allow rules, DoH config, stats |
| /api/smart-dns | smartdns.ts | Smart DNS server, per-platform instructions, reachability test |
| /api/router-config | routerconfig.ts | Router config for 6 firmwares |
| /api/wireguard | wireguard.ts | Config generation; keys AES-256-GCM encrypted at rest |
| /api/daemon-inbound | daemon-inbound.ts | Passive-only daemon callbacks — WG key delivery, IPS events, peer rules, traffic flags |
| /api/ztna | ztna.ts | `POST /posture` (device trust score + allow/deny) + `GET /device/:fp` |
| /api/warrant-canary | — | Signed transparency statement, 30-day expiry |
| /api/quantum-audit | quantum-audit.ts | Blockchain security scanning — classical + post-quantum vuln detection |
| /api/quantum-audit/sig-engine | sig-engine/* | 5-engine signature mining suite (Block Scanner / Web Spider / OSINT / Peel Chain / Hybrid) |
| /api/siem | siem.ts | Security event aggregator — Beacon/Firewall/GhostTrace/GhostChain |
| /api/network-monitor | networkmonitor.ts | Traffic flows, bandwidth, protocols, geo routing |
| /api/dns-sinkhole | sinkhole.ts | DNS sinkhole config and stats |
| /api/osint | osint.ts | Passive recon: DNS, TLS, HTTP headers, email security, ASN |
| /api/canary | canary.ts | Canary token CRUD + trigger log (12 types) |
| /api/ghost-trace | ghosttrace.ts | WireGuard peer behavioral analysis |
| /api/attack-chain | attackchain.ts | Kill chain discovery, 5-stage pipeline |
| /api/ambassadors | ambassadors.ts | Ambassador CRUD, referral tracking, 10% commission calc |
| /api/stripe | stripe.ts | Checkout, webhooks, subscription management |

## Node Agent PSK Configuration

| Secret | Purpose | Used By |
|--------|---------|---------|
| `NODE_AGENT_PSK` | Shared key for remote Parrot OS agent check-ins | All `/api/node-agent/*` POST routes (`/checkin`, `/health`, `/events`). Agents send `x-node-agent-psk: <value>` header. Without this env var, all agent check-in requests return 401. |
| `HONEYPOT_PSK` | Shared key for honeypot sensor callbacks | Honeypot network callbacks posting trap events; same PSK-validation pattern as NODE_AGENT_PSK. |

**Node agent endpoints (PSK-authenticated, no Clerk):**
- `POST /api/node-agent/checkin` — full registration + optional event (runs every 30s on node)
- `POST /api/node-agent/health` — lightweight telemetry-only update (cpuPct, memPct, diskMb)
- `POST /api/node-agent/events` — batch event reporting (up to 100 events per call)

**Admin-only node endpoints (Clerk auth):**
- `GET  /api/node-agent/health` — list all nodes with telemetry
- `GET  /api/node-agent/nodes` — paginated node list with status filter
- `GET  /api/node-agent/events` — all events paginated (nodeId/eventType filters)
- `GET  /api/node-agent/events/:nodeId` — events for a specific node
- `DELETE /api/node-agent/:nodeId` — deregister a node

## Security Architecture

- **RBAC** — 6 roles: `owner / security_admin / network_admin / auditor / support / user`. 10 actions. `lib/rbac.ts`.
- **Device Trust / ZTNA** — Posture scoring (score ≥ 75 = allow). `lib/device-trust.ts`. Live endpoint: `POST /api/ztna/posture`.
- **Audit Chain** — SHA3-256 hash chain + HMAC-SHA512 per-entry signature. `lib/audit-chain.ts`. `verifyChain()` for tamper detection.
- **SIEM fanout** — `lib/siem.ts`: Splunk HEC (`SPLUNK_HEC_URL/TOKEN`) + generic webhook (`SIEM_WEBHOOK_URL`). Local pino log always fires first.
- **Encrypted secrets** — AES-256-GCM envelope for WireGuard private keys (`lib/encrypted-secret-store.ts`). Master key: `PROXHQ_MASTER_KEY_B64`.
- **Daemon auth** — `lib/daemon-auth.ts`. PSK header required for all daemon-inbound routes.
- **Helmet** — CSP, HSTS, noSniff, XSS filter
- **Rate limits** — global 300/min, terminal 20/min, SQL 30/min, mutate 60/min
- **CORS** — strict Replit regex allowlist
- **Shell** — allowlist + HARD_BLOCKED destructive patterns; ProxhqVPN Mode logs all commands; break-glass token for emergency access
- **SQL** — SELECT-only local mode; full CRUD on external connections only

## Ops Scripts (`standalone/scripts/`)

| Script | Purpose |
|--------|---------|
| `harden-ubuntu-stig.sh` | UFW + auditd + fail2ban + sysctl + SSH key-only auth |
| `generate-ca-and-mtls.sh` | 4096-bit CA + 3072-bit daemon mTLS cert |
| `rotate-wireguard-keys.sh` | Staged key rotation with backup |
| `backup-postgres.sh` | `pg_dump` + SHA-256 manifest |
| `openscap-scan.sh` | STIG profile OpenSCAP scan |
| `install-linux.sh` | Standard Linux installer |
| `install-linux-hardened.sh` | SHA-256 config zip verify + nftables kill-switch |
| `Install-ProxHQVPN-Hardened.ps1` | Windows: hash verify + WireGuard MSI + Defender kill-switch |

## Standalone Build

- `standalone/src/server.ts` — embedded Node.js server with full ProxhqVPN API
- `standalone/tun_daemon.py` — Python TUN/TAP daemon (Linux/macOS/Windows)
- `standalone/docker-compose.yml` — wg-easy + proxhq + tor services
- `standalone/build.mjs` — multi-platform build (Windows/macOS-arm64/macOS-x64/Linux + zip)
- `artifacts/desktop/` — Electron desktop app, 4-screen setup wizard, silent WireGuard install

## Signature Mining Engine Suite

5 engines at `/api/quantum-audit/sig-engine/*`, frontend at `/quantum-audit/sig-miner`:

| Engine | Route | Description |
|--------|-------|-------------|
| Block Scanner | `POST /sig-engine/block-scanner` | ECDSA (r,s,z) from on-chain txs; nonce reuse, weak-k, r-collisions, bias |
| Web Sig Spider | `POST /sig-engine/web-spider` | BFS crawl of paste sites/Gists; extracts keys, mnemonics, xpub/xprv |
| OSINT Spider | `POST /sig-engine/osint` | GitHub search, Pastebin, ENS records, OP_RETURN, tx input data |
| Peel Chain | `POST /sig-engine/peel-chain` | Hop-by-hop fund-flow with sig collection + nonce-reuse key recovery |
| Hybrid Worm | `POST /sig-engine/hybrid` | All 4 engines as parallel worms; shared `CrossEnginePool`, 12 data-flow wires |

Control: `GET /sig-engine/status` · `GET /sig-engine/result` · `POST /sig-engine/stop`

## Key Commands

```bash
pnpm run typecheck                              # full typecheck across all packages
pnpm run build                                  # typecheck + build all packages
pnpm --filter @workspace/api-spec run codegen  # regenerate API hooks + Zod schemas
pnpm --filter @workspace/db run push            # push DB schema (dev only)
pnpm --filter @workspace/api-server run typecheck
cd standalone && node build.mjs                 # rebuild standalone platform zips
```

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## User preferences

- No mock/simulated data anywhere — all routes use real DB or real APIs.
