# ProxhqVPN — System Architecture Map

**Generated:** 2026-06-11  
**Copyright © Alpha Unlimited Technologies LLC**

---

## 1. Monorepo Layout

```
workspace/
├── artifacts/
│   ├── api-server/          @workspace/api-server   — Express 5 backend (PORT env)
│   ├── ghost-vpn/           @workspace/ghost-vpn    — React+Vite main app (PORT env)
│   ├── quantum-audit/       @workspace/quantum-audit — React+Vite blockchain scanner (PORT env)
│   ├── omega-dashboard/     @workspace/omega-dashboard — React+Vite C2 dashboard (PORT env)
│   ├── mobile/              @workspace/mobile       — Expo React Native app
│   ├── desktop/             @workspace/desktop      — Electron desktop app
│   └── mockup-sandbox/      @workspace/mockup-sandbox — Vite component preview server
├── lib/
│   ├── db/                  @workspace/db           — Drizzle ORM + PostgreSQL schema
│   ├── api-spec/            @workspace/api-spec     — OpenAPI spec + Orval codegen
│   ├── omega-api-zod/       @workspace/omega-api-zod — Omega Zod schemas (composite lib)
│   └── omega-api-client-react/ @workspace/omega-api-client-react — React Query hooks (composite lib)
├── scripts/                 @workspace/scripts      — Utility scripts
└── standalone/              — Self-contained server + TUN daemon + Docker
```

---

## 2. Request Routing

```
User Browser / Mobile App
        │
        ▼
  Replit Reverse Proxy (mTLS, path-based)
        │
        ├──/                → ghost-vpn (Vite dev server, PORT)
        ├──/quantum-audit   → quantum-audit (Vite dev server, PORT)
        ├──/omega           → omega-dashboard (Vite dev server, PORT)
        └──/api             → api-server (Express 5, PORT)
                │
                ├── Public routes
                │     ├── GET  /api/healthz
                │     └── POST /api/ambassadors/record-referral
                │
                ├── Before requireAuth (BYPASSES AUTH — intentional)
                │     ├── /api/wallet      (wallet-tx: crypto invoice flow)
                │     ├── /api/wallet-intel (⚠ now fixed: requireAuth added)
                │     ├── /api/node-cracker (security-lab flag gated)
                │     └── /api/dev-audit   (security-lab flag gated)
                │
                ├── Auth Tier 1: requireAuth (any signed-in user)
                │     ├── /api/nodes, /api/beacons, /api/silkweb
                │     ├── /api/firewall, /api/monitor, /api/wireguard
                │     ├── /api/killswitch, /api/leaks, /api/threatintel
                │     ├── /api/split-tunnel, /api/obfuscation, /api/vpn-coexist
                │     ├── /api/devices, /api/dns-shield, /api/smart-dns
                │     ├── /api/security-audit, /api/proxy-browser
                │     ├── /api/router-config, /api/siem, /api/osint
                │     ├── /api/canary, /api/ghost-trace, /api/attack-chain
                │     └── /api/ambassadors, /api/stripe
                │
                ├── Auth Tier 2: requireAccess (VPN Basic+ subscription)
                │     └── /api/network-monitor, /api/dns-sinkhole
                │
                ├── Auth Tier 3: requireCommandCenter (Command Center Pro)
                │     ├── /api/terminal, /api/sql
                │     ├── /api/quantum-audit (includes sig-engine, key-recovery)
                │     ├── /api/ztna
                │     └── /api/omega/* (C2 modules: keylogger, screenshot, etc.)
                │
                └── Auth Tier 4: requireAdmin (admin email list)
                      ├── /api/admin/users
                      └── /api/setup/*
```

---

## 3. Authentication Stack

```
Clerk (app_3CcwHo66ohArVtaIa0XTcv88i4Y)
    │
    ├── clerkMiddleware()      — attaches auth context to req (all routes)
    ├── requireAuth            — getAuth(req).userId must exist
    ├── requireAccess          — user has active subscription (DB check)
    ├── requireCommandCenter   — user has Command Center Pro tier
    ├── requireAdmin           — userId in ADMIN_EMAILS env var
    └── internalSecretBypass   — X-Internal-Secret header (loopback only in prod)

RBAC (lib/rbac.ts) — 6 roles, 10 actions — IMPLEMENTED BUT NOT ENFORCED ON ROUTES
Daemon Auth (lib/daemon-auth.ts) — shared DAEMON_PSK header for daemon-inbound routes
```

---

## 4. Database Schema Overview

**Engine:** PostgreSQL (Drizzle ORM)  
**Package:** `@workspace/db` (lib/db)

| Schema File | Tables |
|------------|--------|
| users.ts | users, employees |
| nodes.ts | nodes |
| beacons.ts | beaconAlerts |
| silkweb.ts | silkWeb, silkRoutes, trappedAttackers |
| firewall.ts | firewallRules, firewallBlocklist, firewallEvents, firewallTrafficDecisions, firewallTranscriberLog, ebpfRules |
| wireguard.ts | userWgConfigs (encrypted key cols) |
| devices.ts | devices (WireGuard device registry) |
| ztna-devices.ts | ztnaDevices |
| ambassadors.ts | ambassadors, referrals |
| stripe.ts | stripeEvents |
| crypto.ts | cryptoInvoices, cryptoSubscriptions |
| deception.ts | deceptionEvents |
| omega.ts | omegaHosts, omegaEvents, keystrokes, screenshots, files, clipboard, messages, processes |
| commands.ts | remoteCommands, wgPeerCommands |
| quantum.ts | quantumScans, quantumFindings |

**Migration-only tables (no Drizzle schema):**
- `audit_log_append_only` — created in `20260609_ztna_schema.sql` with immutable trigger

---

## 5. Background Services

All started in `artifacts/api-server/src/index.ts`:

| Service | Startup Function | Interval |
|---------|-----------------|----------|
| Node Lifecycle Engine | `startNodeLifecycleEngine()` | 10s decay, 30s rotation |
| Batch Worker | `startBatchWorker()` | configurable |
| Crypto Poller | `startCryptoPoller(60_000)` | 60s |
| Autonomous Sig Miner | `startAutonomousRunner()` | **NOT STARTED** (manual API trigger only) |

---

## 6. Key Libraries

| Library | Purpose |
|---------|---------|
| `lib/rbac.ts` | Role-based access control — 6 roles, 10 actions |
| `lib/audit-chain.ts` | SHA3-256 hash chain + HMAC-SHA512 per-entry |
| `lib/device-trust.ts` | ZTNA device posture scoring |
| `lib/siem.ts` | Security event fanout (Splunk HEC + webhook) |
| `lib/encrypted-secret-store.ts` | AES-256-GCM envelope for WG keys |
| `lib/daemon-auth.ts` | PSK middleware for daemon-inbound routes |
| `lib/node-lifecycle-engine.ts` | WireGuard node decay/rotation/command delivery |
| `lib/unified-firewall-core.ts` | eBPF + nftables firewall rule engine |
| `lib/wallet-intel/` | Blockchain vulnerability scanning (5 sub-modules) |
| `lib/signature-miner/` | 5-engine ECDSA signature extraction suite |

---

## 7. Frontend Apps

### ghost-vpn (main app)
- **Framework:** React 18 + Vite + Tailwind + shadcn/ui
- **Router:** react-router-dom v6
- **Auth:** Clerk `<ClerkProvider>`, `useAuth()`, `<SignedIn>/<SignedOut>`
- **API:** Generated React Query hooks from `@workspace/api-client-react` + direct fetch
- **Pages:** 50+ pages (see replit.md table)

### quantum-audit
- **Framework:** React + Vite + Tailwind
- **Router:** react-router-dom
- **Auth:** Clerk
- **API:** Direct fetch with `BASE()` helper → `/api/quantum-audit/*`

### omega-dashboard
- **Framework:** React + Vite + wouter
- **API:** `@workspace/omega-api-client-react` generated hooks + some direct fetch
- **Auth:** Clerk session cookie (`credentials: "include"`)

### mobile
- **Framework:** Expo (React Native + Expo Router)
- **Auth:** Clerk native SDK
- **Pattern:** 4 native screens + WebView container for 70+ tools (proxies to ghost-vpn)

---

## 8. Deployment Topology

```
Production (Replit Deployment)
    │
    ├── api-server  — Express, PORT assigned by Replit, /api prefix
    ├── ghost-vpn   — Vite preview/build, / prefix
    ├── quantum-audit — Vite preview/build, /quantum-audit prefix
    └── omega-dashboard — Vite preview/build, /omega prefix

Environment Variables Required for Production:
    DATABASE_URL, SESSION_SECRET (min 32 chars)
    PROXHQ_MASTER_KEY_B64 (min 44 chars, AES master key)
    AUDIT_HMAC_KEY_B64 (min 44 chars, HMAC signing key)
    VITE_CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY
    DAEMON_PSK (daemon-inbound authentication)
    ADMIN_EMAILS (comma-separated)
    STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY, STRIPE_WEBHOOK_SECRET
    CRYPTO_BTC_ADDRESS, CRYPTO_ETH_ADDRESS
```

---

## 9. Security Perimeter

```
External Attacker
    │
    ▼ HTTPS (mTLS on Replit proxy)
    │
    ├── Helmet (CSP, HSTS, noSniff, XSS filter)
    ├── Rate Limits (global 300/min, terminal 20/min, SQL 30/min)
    ├── CORS (strict Replit regex allowlist)
    ├── Zod input validation (all endpoints)
    ├── Clerk session auth (requireAuth and tiers above)
    └── Route-specific controls:
          ├── Shell exec: allowlist + HARD_BLOCKED patterns
          ├── SQL: SELECT-only local mode; external CRUD only
          ├── Daemon-inbound: DAEMON_PSK header required
          └── WireGuard config: ZTNA posture check (advisory)
```
