# GHOST_SYSTEM_GAPS.md
**Generated:** 2026-06-13  
**Scope:** Every gap across the Ghost Node + Ghost Trap + Honeypot + Deception + SilkWeb + Daemon systems

---

## §1 — Priority Matrix

| ID | Gap | System | Severity | Type |
|---|---|---|---|---|
| GS-001 | Auto-SQLmap against external attacker IPs | daemon-inbound | CRITICAL | Safety / Legal |
| GS-002 | SilkWeb SQLmap/os-cmd against external IPs, no lab gate | SilkWeb | CRITICAL | Safety / Legal |
| GS-003 | Ghost Trap counter-attack — any user, any public IP | Ghost Trap | CRITICAL | Safety / Legal |
| GS-004 | `authorized_lab_target` system does not exist | Platform-wide | CRITICAL | Safety |
| GS-005 | Ghost Node system completely absent | Ghost Node | HIGH | Feature missing |
| GS-006 | No mTLS on daemon-inbound | Daemon | HIGH | Security |
| GS-007 | Honeypot has no route in main ghost-vpn app | Honeypot | HIGH | UX / Operational |
| GS-008 | No RBAC on honeypot mutate routes | Honeypot | HIGH | Security |
| GS-009 | No SIEM forwarding from Ghost Trap | Ghost Trap | HIGH | Observability |
| GS-010 | No audit chain entries in Ghost Trap | Ghost Trap | HIGH | Compliance |
| GS-011 | No Ghost Trap policy delivery to node daemons | Ghost Trap | HIGH | Integration |
| GS-012 | No WireGuard decoy routing | Ghost Trap / Ghost Node | HIGH | Integration |
| GS-013 | Vultr API not integrated | Infrastructure | MEDIUM | Feature |
| GS-014 | No RBAC on SilkWeb exploitation console | SilkWeb | HIGH | Security |
| GS-015 | No per-IP rate limit on Ghost Trap lures | Ghost Trap | MEDIUM | Reliability |
| GS-016 | No `ghost_trap_rules` table | Ghost Trap | MEDIUM | Feature |
| GS-017 | No evidence export endpoint | Ghost Trap | MEDIUM | Feature |
| GS-018 | No node version enforcement | Node Agent | MEDIUM | Operational |
| GS-019 | Deception Engine has no RBAC middleware | Deception | MEDIUM | Security |
| GS-020 | Worm network not isolated from VPN users | Worm / Daemon | HIGH | Safety |
| GS-021 | No SIEM forwarding from Deception, Honeypot | Deception / Honeypot | MEDIUM | Observability |
| GS-022 | No audit chain from Deception, Honeypot | Deception / Honeypot | MEDIUM | Compliance |
| GS-023 | ghostd.py local REST API is plain HTTP (no auth) | Daemon | LOW | Security |
| GS-024 | WireGuard private keys stored in DB (even if encrypted) | WireGuard | LOW | Architecture |

---

## §2 — Critical Gaps (Detail)

### GS-001 — Auto-SQLmap against external attacker IPs
**Location:** `artifacts/api-server/src/routes/daemon-inbound.ts` lines 447–480  
**What happens:** When a honeypot node reports `POST /api/daemon-inbound/honeypot-hit` with an HTTP banner, the API server automatically runs `sqlmap -u "http://<attacker_ip>:<port>/"` with no gate of any kind.  
**Legal exposure:** Unauthorized computer access (CFAA, Computer Misuse Act, EU Directive 2013/40/EU).  
**Fix:** Remove the exec block entirely (lines 447–480). Log the HTTP detection as intelligence only.

### GS-002 — SilkWeb SQLmap / os-cmd / file-read against external IPs
**Location:** `artifacts/api-server/src/routes/silkweb.ts`  
**Affected routes:**
- `POST /api/silkweb/trapped/:id/sqlmap` — sqlmap against `attacker.ip`
- `POST /api/silkweb/scan/sqlmap` — sqlmap against any submitted URL
- `POST /api/silkweb/trapped/:id/sqlmap-custom` — custom sqlmap against `attacker.ip`
- `POST /api/silkweb/trapped/:id/os-cmd` — OS command against attacker host
- `POST /api/silkweb/trapped/:id/file-read` — file read against attacker host  
**No `authorized_lab_target` check. No RBAC gate beyond Clerk auth.**  
**Fix:** Require `authorized_lab_target` whitelist check before any `exec()`. Add `requireRbac("silkweb_exploit")`.

### GS-003 — Ghost Trap counter-attack, any user, any public IP
**Location:** `artifacts/api-server/src/routes/ghosttrap.ts` lines 938–1127  
**Affected routes:** `/counter/manual-scan`, `/counter/port-scan`, `/counter/manual-osint`, `/counter/osint`, `/counter/canary-inject`  
**Any authenticated user (including `user` role) can initiate TCP port scans against any public internet IP.**  
**Fix:** Add `requireRbac("counter_attack")` (owner/security_admin only). Add lab target gate for any scan with `exec()`.

### GS-004 — No `authorized_lab_target` system
**Scope:** Platform-wide  
**Required:** 
1. `lab_targets` DB table (ip, hostname, authorized_by, authorized_at, expires_at, active)
2. `requireLabTarget(ip)` async helper
3. Applied before every `exec(sqlmap ...)`, `exec(nmap ...)`, and `exec(os-cmd ...)` call
4. Admin UI to add/remove/expire lab targets

---

## §3 — High Gaps (Detail)

### GS-005 — Ghost Node system completely absent
**What's missing:** Entire system — frontend page, backend routes, DB tables, daemon policy endpoint, WG decoy peers.  
**Specification:** See GHOST_NODE_FRONTEND_BACKEND_NODE_MAP.md §3–§6.  
**Required tables:** `ghost_nodes`, `ghost_node_events`, `ghost_node_routes`, `vultr_node_deception_state`.

### GS-006 — No mTLS on daemon-inbound
**Current:** PSK-only authentication (constant-time comparison of `DAEMON_PSK` / `daemonSecret`).  
**Script exists:** `standalone/scripts/generate-ca-and-mtls.sh` — generates CA + daemon client certs.  
**Fix:** Enable TLS on Express with `requestCert: true`, add cert verification middleware before `requirePsk`.

### GS-007 — Honeypot missing from main ghost-vpn app
**HoneypotCommand artifact** (`/honeypot-command`) exists as a fully implemented standalone app (8 pages: Dashboard, Nodes, Attackers, Sessions, Commands, Files, IOCs, Alerts).  
**But:** No sidebar link in ghost-vpn, no navigation from dashboard, no Clerk auth gate, no RBAC.  
**Fix:** Add PaywallGate + CommandCenter capability requirement. Add sidebar nav entry in ghost-vpn Layout.tsx.

### GS-008 — No RBAC on honeypot mutate routes
**honeypot.ts:** POST /nodes, PATCH /nodes/:id, DELETE /nodes/:id, POST /iocs, DELETE /iocs/:id, POST /alerts/:id/acknowledge — all require only Clerk auth. No role check.  
**Fix:** Add `requireRbac("honeypot_admin")` to POST/PATCH/DELETE routes.

### GS-009 — No SIEM forwarding from Ghost Trap
**ghosttrap.ts:** `publishPlatformEvent` import not present. No SIEM events for probes, counter-attacks, or tarpit sessions.  
**Fix:** Import and call `publishPlatformEvent` for: every probe capture (warn severity for known scanners), every counter-attack, every tarpit engagement.

### GS-010 — No audit chain from Ghost Trap
**ghosttrap.ts:** `appendAuditEvent` not imported or called.  
**Fix:** Call `appendAuditEvent` on: counter-attack actions (audit.action = "ghost_trap.counter_scan"), tarpit engagements, config changes.

### GS-011 — No Ghost Trap policy delivery to node daemons
**daemon-inbound.ts:** Has WG key delivery, firewall rules, Suricata rules, eBPF rules, worm payload. But no endpoint to:
- Push Ghost Trap lure URLs to nodes
- Instruct nodes to route suspicious IPs to lure endpoints
- Receive trap events from nodes (distinct from honeypot-hit)

### GS-012 — No WireGuard decoy routing
**Neither nodes.ts nor wireguard.ts nor daemon-inbound.ts** implements routing of suspicious IPs to Ghost Trap lure or honeypot endpoints via WireGuard policy.  
**Required:** Separate `wg-decoy` interface on each node with iptables MARK+routing rules for `trapped_attackers` IPs.

### GS-014 — No RBAC on SilkWeb exploitation console
**silkweb.ts:** `/trapped/:id/sqlmap`, `/trapped/:id/os-cmd`, `/trapped/:id/file-read` — require only Clerk auth. Any paying subscriber could theoretically access these if they find the API.  
**Fix:** Add `requireRbac("silkweb_exploit")` (owner/security_admin only).

### GS-020 — Worm network not isolated from VPN users
**daemon-inbound.ts:** Worm callhome (`POST /worm-callhome`) is PUBLIC — any IP can call it. Worm payload is served to any PSK-bearing daemon. There is no explicit isolation ensuring worm traffic cannot affect real VPN customers.  
**Fix:** Validate worm callhome IPs against known-bad/scanner signatures before recording; isolate worm events to a separate network namespace on nodes.

---

## §4 — Gaps By System

### Ghost Node
- GS-005 (entire system missing)

### Ghost Trap  
- GS-001 (auto-sqlmap — in daemon but triggered by trap event)
- GS-003 (counter-attack any user)
- GS-004 (lab target system)
- GS-009 (no SIEM)
- GS-010 (no audit chain)
- GS-011 (no daemon policy delivery)
- GS-012 (no WG decoy routing)
- GS-015 (no per-IP lure rate limit)
- GS-016 (no ghost_trap_rules table)
- GS-017 (no evidence export)

### Honeypot
- GS-007 (missing from main app nav)
- GS-008 (no RBAC on mutate routes)
- GS-021 (no SIEM)
- GS-022 (no audit chain)

### SilkWeb
- GS-002 (sqlmap/os-cmd against external IPs)
- GS-004 (lab target system)
- GS-014 (no RBAC on exploit console)

### Daemon
- GS-001 (auto-sqlmap in honeypot-hit)
- GS-006 (no mTLS)
- GS-011 (no ghost trap policy endpoint)
- GS-020 (worm isolation)
- GS-023 (plain HTTP local REST)

### Deception Engine
- GS-019 (no RBAC middleware — comment says admin only but not enforced)
- GS-021 (no SIEM)
- GS-022 (no audit chain)

### Vultr / Infrastructure
- GS-013 (no Vultr API)

---

*© 2026 ALPHA UNLIMITED TECHNOLOGIES LLC — CONFIDENTIAL AUDIT*
