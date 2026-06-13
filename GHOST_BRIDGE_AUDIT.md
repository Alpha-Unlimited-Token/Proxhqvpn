# GHOST_BRIDGE_AUDIT.md
**Generated:** 2026-06-13  
**Scope:** Full cross-layer audit of Ghost Node and Ghost Trap — frontend ↔ backend ↔ database ↔ SIEM ↔ node daemon ↔ firewall ↔ WireGuard

---

## §1 — Audit Methodology

For each component, this audit answers:
- Is it frontend-only? Backend-only? Server-node-only? Fully bridged? Dead code? Partially wired? Dangerous/offensive? Missing DB? Missing audit logging? Missing frontend? Missing node daemon support?

Search terms used: `ghost-node`, `ghostNodes`, `ghost-node-router`, `ghost-trap`, `ghostTrap`, `honeypot`, `deception`, `trap`, `decoy`, `vultr`, `node daemon`, `proxhqd`, `wireguard node`

---

## §2 — Ghost Node — Full Component Verdict

### VERDICT: DEAD CODE — SYSTEM DOES NOT EXIST

| Layer | Status | Evidence |
|---|---|---|
| Frontend page | ❌ MISSING | No import, no Route, no page file for "Ghost Node" in vpnRoutes.tsx or commandCenterRoutes.tsx |
| Backend route | ❌ MISSING | No `ghost-node.ts`, no `/api/ghost-nodes` route in routes/ directory |
| DB table | ❌ MISSING | No `ghost_nodes` table in lib/db/src/schema/ |
| SIEM integration | ❌ N/A | Nothing to wire |
| Daemon support | ❌ MISSING | No policy delivery for ghost/decoy node via daemon-inbound |
| WireGuard decoy peers | ❌ MISSING | No fake WG peers in DB or route |
| Node daemon (ghostd.py) | ❌ MISSING | ghostd.py has no ghost node concept |
| Firewall/routing isolation | ❌ MISSING | No decoy routing table, no isolated interface |

**What "Ghost Node" was supposed to be:** A layer of fake/decoy VPN nodes presented to scanners and attackers to misdirect them away from real infrastructure. They would respond to probes with convincing but fake WireGuard configuration data, while real nodes remain hidden.

**Current state:** The `nodes` table has `status = "trapped"` which marks a node that has been used to trap an attacker (SilkWeb), but this is not the same as a Ghost Node. A "trapped" node is a real node whose attacker has been caught. A Ghost Node would be a fake node that doesn't exist.

---

## §3 — Ghost Trap — Full Component Verdict

### VERDICT: MOSTLY IMPLEMENTED — SAFETY GAPS, MISSING NODE DAEMON BRIDGE

| Layer | Status | Evidence |
|---|---|---|
| Frontend page | ✅ FULLY WIRED | `GhostTrap.tsx` (1,972 lines) at `/ghost-trap` in vpnRoutes.tsx |
| Backend routes | ✅ FULLY WIRED | `ghosttrap.ts` (1,566 lines) — lures, beacons, backtrace, counter-attack, tarpit |
| DB schema | ✅ FULLY WIRED | ghost_trap_probes, ghost_trap_beacons, ghost_trap_config, ghost_trap_loop_sessions |
| SIEM integration | ❌ MISSING | No `publishPlatformEvent` in ghosttrap.ts |
| Audit chain | ❌ MISSING | No `appendAuditEvent` in ghosttrap.ts |
| Node daemon delivery | ❌ MISSING | daemon-inbound has no endpoint to push Ghost Trap policy to nodes |
| WireGuard deception routing | ❌ MISSING | No WG routing of suspicious IPs to Ghost Trap lures |
| Counter-attack RBAC | ❌ MISSING | `/counter/*` has no `requireRbac` gate |
| Auto-SQLmap against external IP | ❌ DANGEROUS | daemon-inbound.ts:447–480 runs sqlmap against attacker IPs automatically |
| `authorized_lab_target` gate | ❌ MISSING | No such field or table exists anywhere |

---

## §4 — Honeypot (SilkWeb Command Center) — Full Component Verdict

### VERDICT: PARTIALLY WIRED — STANDALONE BUILT, FRONTEND IN SEPARATE ARTIFACT, MAIN APP GAP

| Layer | Status | Evidence |
|---|---|---|
| Frontend (HoneypotCommand artifact) | ✅ EXISTS | `/honeypot-command` registered artifact — Dashboard, Nodes, Attackers, Sessions, Commands, Files, IOCs, Alerts pages |
| Frontend (ghost-vpn main app) | ❌ MISSING | No honeypot nav link, no route in vpnRoutes.tsx or commandCenterRoutes.tsx for honeypot |
| Backend routes | ✅ FULLY WIRED | `honeypot.ts` (530 lines) — stats, nodes CRUD, attackers, sessions, commands, files, IOCs, alerts, ingest |
| DB schema | ✅ FULLY WIRED | 7 tables: honeypot_nodes, honeypot_attackers, honeypot_sessions, honeypot_commands, honeypot_files, honeypot_iocs, honeypot_alerts |
| Standalone Cowrie honeypot | ✅ EXISTS | `standalone/honeypot/` — Ansible playbook, configs, relay_agent.py |
| Relay agent → API bridge | ✅ WIRED | relay_agent.py ships Cowrie+Suricata events to POST /api/honeypot/ingest |
| SIEM integration | ❌ UNKNOWN | Not verified in honeypot.ts |
| Audit chain | ❌ UNKNOWN | Not verified in honeypot.ts |
| RBAC on mutate routes | ❌ MISSING | honeypot.ts has no `requireRbac` — any Clerk auth user can modify |
| PSK on ingest | ✅ EXISTS | X-Honeypot-PSK header required on /api/honeypot/ingest |

---

## §5 — Deception Engine — Full Component Verdict

### VERDICT: FULLY BRIDGED — SAFE

| Layer | Status | Evidence |
|---|---|---|
| Frontend page | ✅ WIRED | `DeceptionEngine.tsx` at `/deception-engine` in commandCenterRoutes.tsx |
| Backend routes | ✅ WIRED | `deception.ts` (529 lines) — trap banners, canary tokens, events, stats |
| DB schema | ✅ WIRED | deception_events, deception_banners |
| Offensive behavior | ✅ SAFE | File header explicitly states: "NOTHING here executes code on remote systems. This is purely defensive." |
| RBAC | ⚠️ PARTIAL | File header says admin/security_admin/network_admin only — but no `requireRbac` middleware visible |
| SIEM/audit | ❌ UNKNOWN | Not verified |

---

## §6 — SilkWeb — Full Component Verdict

### VERDICT: FULLY BRIDGED — CRITICAL SAFETY VIOLATIONS

| Layer | Status | Evidence |
|---|---|---|
| Frontend page | ✅ WIRED | `SilkWeb.tsx` (1,786 lines) — SVG chord map, trapped entity list |
| Backend routes | ✅ WIRED | `silkweb.ts` (662 lines) |
| DB schema | ✅ WIRED | silk_web, silk_routes, trapped_attackers |
| Honeypot bridge | ✅ WIRED | daemon-inbound `POST /honeypot-hit` → inserts into trapped_attackers |
| SQLmap vs. attacker IPs | ❌ DANGEROUS | POST /trapped/:id/sqlmap, /scan/sqlmap, /trapped/:id/sqlmap-custom — no authorized_lab_target gate |
| OS command vs. attacker IPs | ❌ DANGEROUS | POST /trapped/:id/os-cmd — no authorized_lab_target gate |
| File read vs. attacker IPs | ❌ DANGEROUS | POST /trapped/:id/file-read — no authorized_lab_target gate |
| RBAC | ❌ MISSING | Exploit console has no requireRbac |

---

## §7 — Node Daemon (ghostd.py + daemon-inbound) — Full Component Verdict

### VERDICT: PARTIALLY BRIDGED — NO GHOST/DECEPTION POLICY DELIVERY

| Layer | Status | Evidence |
|---|---|---|
| Local daemon (ghostd.py) | ✅ IMPLEMENTED | Standalone TUN/TAP VPN daemon, local REST on :7475 |
| API proxy (daemon.ts) | ✅ WIRED | Routes /api/daemon/* to http://127.0.0.1:7475 |
| Passive callbacks (daemon-inbound.ts) | ✅ WIRED | 1,052 lines — worm callhome, beacon, report, honeypot-hit, firewall rules, WG key, IPS events, eBPF, peer rules |
| WireGuard key delivery | ✅ WIRED | POST /api/daemon-inbound/wg-key |
| Firewall rule delivery | ✅ WIRED | GET /api/daemon-inbound/firewall-rules |
| Suricata rules | ✅ WIRED | GET /api/daemon-inbound/suricata-rules |
| IPS event reporting | ✅ WIRED | POST /api/daemon-inbound/ips-event |
| Ghost Trap policy delivery | ❌ MISSING | No endpoint to push ghost trap rules to node |
| Ghost Node policy delivery | ❌ MISSING | No endpoint to push decoy node config to daemon |
| Deception routing | ❌ MISSING | No WG peer routing of suspicious IPs to honeypot |
| Auto-SQLmap (dangerous) | ❌ DANGEROUS | Lines 447–480: automated sqlmap against external attacker IP |
| mTLS | ❌ MISSING | PSK-only auth; CA cert generation script exists but not used |

---

## §8 — Vultr Integration — Full Component Verdict

### VERDICT: NOT INTEGRATED — INFRASTRUCTURE MANAGEMENT IS MANUAL

| Layer | Status | Evidence |
|---|---|---|
| Vultr API client | ❌ MISSING | No Vultr SDK or API calls anywhere in codebase |
| Node provisioning (Vultr) | ❌ MISSING | node-provision.ts only creates DB records — doesn't create Vultr VMs |
| Cloud firewall management | ❌ MISSING | No Vultr firewall API calls |
| Region selection from Vultr | ❌ MISSING | Regions hardcoded in DB |
| Vultr DNS management | ❌ MISSING | |
| Node deployment automation | ❌ MISSING | Install scripts are manual (run on already-provisioned VMs) |

**Vultr is mentioned once in the codebase:** as an ASN org name pattern in ghosttrap.ts used to classify datacenter IPs (line 38: `/vultr/i`). This is just a regex, not an API integration.

---

## §9 — Worm / Worm Callhome

### VERDICT: PARTIALLY WIRED

| Layer | Status | Evidence |
|---|---|---|
| Worm callhome endpoint | ✅ WIRED | POST /api/daemon-inbound/worm-callhome (PUBLIC — no PSK needed) |
| Worm payload endpoint | ✅ WIRED | GET /api/daemon-inbound/worm-payload (PSK required) |
| Node worm flag | ✅ IN DB | nodes.hasWorm boolean |
| Frontend worm management | ⚠️ PARTIAL | BeaconAlerts page shows spider/worm events but no worm control panel |
| Worm isolation from VPN users | ❌ UNKNOWN | Worm network not verified to be isolated from customer VPN traffic |

---

## §10 — Bridge Summary Matrix

| System | FE | BE | DB | SIEM | Daemon | WG | Safe |
|---|---|---|---|---|---|---|---|
| Ghost Node | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | N/A |
| Ghost Trap | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Honeypot (separate app) | ✅ | ✅ | ✅ | ❓ | ✅ | ❌ | ✅ |
| Honeypot (main app) | ❌ | ✅ | ✅ | ❓ | ✅ | ❌ | ✅ |
| Deception Engine | ✅ | ✅ | ✅ | ❓ | ❌ | ❌ | ✅ |
| SilkWeb | ✅ | ✅ | ✅ | ❓ | ✅ | ❌ | ❌ |
| Node Daemon | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ⚠️ |
| Vultr | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | N/A |
| WireGuard | ✅ | ✅ | ✅ | ❓ | ✅ | ✅ | ✅ |

Legend: ✅ Present | ❌ Missing | ⚠️ Gap/concern | ❓ Not verified

---

*© 2026 ALPHA UNLIMITED TECHNOLOGIES LLC — CONFIDENTIAL AUDIT*
