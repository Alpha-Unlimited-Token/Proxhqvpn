# GHOST_TRAP_FRONTEND_BACKEND_NODE_MAP.md
**Generated:** 2026-06-13  
**Scope:** Complete map of Ghost Trap across every layer — what exists, what is wired, what is missing

---

## §1 — Layer-by-Layer Map

| Layer | Component | Status | File / Route |
|---|---|---|---|
| **Frontend** | | | |
| | Page: GhostTrap | ✅ WIRED | `artifacts/ghost-vpn/src/pages/GhostTrap.tsx` (1,972 lines) |
| | Route registration | ✅ WIRED | vpnRoutes.tsx → `/ghost-trap` (ToolLayout, all auth'd users) |
| | Sidebar nav link | ✅ WIRED | Accessible to authenticated users |
| | Config UI | ✅ WIRED | Personal/server mode, tarpit settings, auto-block threshold |
| | Probe dashboard | ✅ WIRED | Real-time table of captured attacker probes |
| | Beacon management | ✅ WIRED | Pixel/JS beacon placement for external sites |
| | Backtrace engine | ✅ WIRED | Hop chain analysis per attacker IP |
| | Authority report | ✅ WIRED | Dossier: geo, ASN, VPN/DC classification |
| | Counter-attack panel | ✅ WIRED (UNSAFE) | Port scan, OSINT — visible to all auth'd users |
| | Tarpit loop manager | ✅ WIRED | Engage, stage progress, session management |
| | RBAC visibility gate | ❌ MISSING | Counter-attack UI not gated behind security_admin role in frontend |
| **Backend** | | | |
| | Route file | ✅ WIRED | `artifacts/api-server/src/routes/ghosttrap.ts` (1,566 lines) |
| | Lure endpoints (public) | ✅ WIRED | `/lure/*`, `/beacon/:id`, `/loop/:sessionId` |
| | Probe management | ✅ WIRED | GET/DELETE /probes, GET /config, POST /config |
| | WHOIS lookup | ✅ WIRED | GET /whois/:ip |
| | Backtrace/VPN detect | ✅ WIRED | GET /backtrace/:ip — full hop chain + ASN + VPN/Tor flags |
| | Authority report | ✅ WIRED | GET /report/:ip |
| | Counter-attack scan | ✅ WIRED (UNSAFE) | POST /counter/manual-scan — no RBAC, no lab gate |
| | Counter-attack OSINT | ✅ WIRED (UNSAFE) | POST /counter/manual-osint — no RBAC, no lab gate |
| | Tarpit engage | ✅ WIRED | POST /engage |
| | Tarpit loop | ✅ WIRED | ALL /loop/:sessionId — state machine with 10+ stages |
| | Session CRUD | ✅ WIRED | GET/DELETE /sessions/:id |
| | RBAC on counter-attack | ❌ MISSING | No requireRbac on /counter/* routes |
| | Rate limit on lures | ❌ MISSING | Global 300/min applies; no per-IP lure-specific limit |
| | Zod validation | ⚠️ PARTIAL | Config validated; counter-attack body minimal validation |
| | Audit chain entries | ❌ MISSING | No appendAuditEvent calls anywhere in ghosttrap.ts |
| | SIEM events | ❌ MISSING | No publishPlatformEvent calls in ghosttrap.ts |
| | `authorized_lab_target` gate | ❌ MISSING | Counter-attack scans any public IP |
| **Database** | | | |
| | ghost_trap_probes | ✅ WIRED | Full probe record with geo, hop chain, beacon, tarpit fields |
| | ghost_trap_beacons | ✅ WIRED | Beacon fire record with browser fingerprint |
| | ghost_trap_config | ✅ WIRED | Per-user config: tarpit timing, fake identity, auto-block threshold |
| | ghost_trap_loop_sessions | ✅ WIRED | Tarpit state machine: stage, loop count, intelligence accumulation |
| | ghost_trap_rules | ❌ MISSING | No configurable rule set table |
| | ghost_trap_evidence | ❌ MISSING | No evidence export table |
| | lab_targets | ❌ MISSING | No authorized lab target whitelist |
| **SIEM/Audit** | | | |
| | Probe events → SIEM | ❌ MISSING | |
| | Counter-attack → audit chain | ❌ MISSING | |
| | Tarpit engagement → SIEM | ❌ MISSING | |
| | Beacon fire → SIEM | ❌ MISSING | |
| **Node Daemon** | | | |
| | Ghost Trap policy delivery | ❌ MISSING | No daemon-inbound endpoint to push trap policy to nodes |
| | Ghost Trap event reporting from nodes | ❌ MISSING | Only honeypot-hit and worm events reported from nodes; no dedicated ghost-trap path |
| | WG suspicious-IP routing to lures | ❌ MISSING | |
| **WireGuard** | | | |
| | Decoy routing to lure endpoints | ❌ MISSING | Suspicious IPs not routed to /api/ghost-trap/lure/* via WG policy |
| | Isolated ghost interface | ❌ MISSING | |

---

## §2 — API Call Map: Frontend → Backend

| Frontend action | HTTP call | Backend handler | DB write |
|---|---|---|---|
| Load probe list | GET /api/ghost-trap/probes | ghosttrap.ts:471 | — |
| Load config | GET /api/ghost-trap/config | ghosttrap.ts:494 | — |
| Save config | POST /api/ghost-trap/config | ghosttrap.ts:502 | ghost_trap_config |
| Clear probes | DELETE /api/ghost-trap/probes | ghosttrap.ts:525 | ghost_trap_probes |
| Backtrace IP | GET /api/ghost-trap/backtrace/:ip | ghosttrap.ts:550 | — |
| Authority report | GET /api/ghost-trap/report/:ip | ghosttrap.ts:763 | — |
| WHOIS | GET /api/ghost-trap/whois/:ip | ghosttrap.ts:534 | — |
| Counter scan | POST /api/ghost-trap/counter/manual-scan | ghosttrap.ts:939 | — (no audit log!) |
| Counter OSINT | POST /api/ghost-trap/counter/manual-osint | ghosttrap.ts:984 | — (no audit log!) |
| Engage tarpit | POST /api/ghost-trap/engage | ghosttrap.ts:1351 | ghost_trap_loop_sessions |
| Tarpit loop | ALL /api/ghost-trap/loop/:sessionId | ghosttrap.ts:1396 | ghost_trap_loop_sessions (stage++) |
| Session list | GET /api/ghost-trap/sessions | ghosttrap.ts:1506 | — |

---

## §3 — Data Flow: Attacker → Ghost Trap

```
Attacker browser / scanner
      │
      ▼ (public endpoint, no auth)
/api/ghost-trap/lure/admin
      │
      ▼ handleProbe()
  1. Extract attacker IP from headers (hop chain aware)
  2. Detect VPN/Tor/datacenter via ASN patterns
  3. Apply tarpit delay (1500–8000ms configurable)
  4. Serve poisoned fake response (login page / SQL error / .env file)
  5. Insert ghost_trap_probes record
  6. If probe count >= silkTrapAfter: insert trapped_attackers (SilkWeb)
  7. If probe count >= autoBlockAfter: insert blocked_ips
  8. If beacon: schedule beacon pixel in response
      │
      ▼ (fire-and-forget)
  Geo enrichment (ip-api.com)
  → Updates ghost_trap_probes.geo* fields
```

---

## §4 — Data Flow: Beacon

```
Admin places beacon pixel on external site (img src="https://proxhqvpn.com/api/ghost-trap/beacon/ABC123")
      │
      ▼ (when site is visited by attacker)
GET /api/ghost-trap/beacon/ABC123
      │
      ▼
  1. Return 1×1 transparent GIF (immediate)
  2. Insert ghost_trap_beacons record
  3. Tag related probe (if probeId linked to beacon)
      │
      ▼ (JS variant)
/beacon/ABC123/js
  Returns: JavaScript snippet that collects browserLang, screenSize, timezone
  and POSTs to /beacon/ABC123/cb
```

---

## §5 — Dangerous / Offensive Code Map

| Route | What it does | Risk |
|---|---|---|
| POST /counter/manual-scan | TCP port scan any public IP | CRITICAL — no RBAC, no lab gate |
| POST /counter/port-scan | Port scan | CRITICAL |
| POST /counter/manual-osint | OSINT any IP | CRITICAL — no RBAC |
| POST /counter/osint | OSINT | CRITICAL |
| POST /counter/canary-inject | Inject canary token into attacker infra | HIGH — review needed |
| daemon-inbound.ts:447–480 | Auto-SQLmap against honeypot visitor | CRITICAL — outbound attack |

---

## §6 — Missing Components Summary

| Missing | Priority | Where to add |
|---|---|---|
| `requireRbac("counter_attack")` on all /counter/* routes | CRITICAL | ghosttrap.ts |
| Remove or gate auto-SQLmap in daemon-inbound.ts | CRITICAL | daemon-inbound.ts:447–480 |
| `appendAuditEvent` on every probe and counter-attack | HIGH | ghosttrap.ts |
| `publishPlatformEvent` for SIEM | HIGH | ghosttrap.ts |
| `ghost_trap_rules` DB table | HIGH | lib/db/src/schema/ghosttrap.ts |
| `ghost_trap_evidence` DB table + export endpoint | HIGH | new |
| `lab_targets` DB table + `requireLabTarget()` helper | CRITICAL | new |
| Ghost Trap policy delivery to node daemon | HIGH | daemon-inbound.ts |
| Per-IP rate limiting on lure endpoints | MEDIUM | ghosttrap.ts |

---

*© 2026 ALPHA UNLIMITED TECHNOLOGIES LLC — CONFIDENTIAL AUDIT*
