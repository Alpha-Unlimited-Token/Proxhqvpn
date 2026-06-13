# NODE_SECURITY_GAPS.md
**Generated:** 2026-06-13  
**Scope:** Security gaps found across node infrastructure, Ghost Trap, SilkWeb, honeypot, and daemon layers

---

## Severity Legend
| Level | Meaning |
|---|---|
| CRITICAL | Violates legal / ethical boundaries or exposes platform to serious exploitation |
| HIGH | Significant security control missing; active attack risk or compliance violation |
| MEDIUM | Defensive gap; no immediate exploit but increases attack surface |
| LOW | Quality/hardening improvement; no direct exploit path |

---

## §1 — CRITICAL Gaps

### GAP-001 — Auto-SQLmap against external attacker IPs (daemon-inbound.ts:447–480)
**File:** `artifacts/api-server/src/routes/daemon-inbound.ts` lines 447–480  
**Risk:** CRITICAL  

When a honeypot node reports a connection (`POST /api/daemon-inbound/honeypot-hit`) with an HTTP banner, the server automatically runs:
```
sqlmap -u "http://<attacker_ip>:<port>/" --batch --level=2 --risk=2 ...
```

**No gate:** No `authorized_lab_target` flag, no admin approval, no rate limit, no RBAC check.

**Legal risk:** The attacker's IP may be:
- A shared hosting server with thousands of innocent users
- A Tor exit node
- A corporate network probing a Cloudflare CDN
- A VPN exit node

Running SQLmap against it is unauthorized computer access under CFAA (18 U.S.C. §1030), UK Computer Misuse Act, and EU Computer Crime Directive.

**Impact:** Alpha Unlimited Technologies LLC server infrastructure initiates offensive attacks against unknown third-party systems automatically.

---

### GAP-002 — SilkWeb SQLmap against trapped attacker IPs (silkweb.ts)
**File:** `artifacts/api-server/src/routes/silkweb.ts` lines 189–238  
**Risk:** CRITICAL  

`POST /api/silkweb/trapped/:id/sqlmap` builds:
```
sqlmap -u "http://<attacker.ip>/" --batch --level=2 --risk=2 ...
```
where `attacker.ip` is the external IP of whoever touched a honeypot endpoint. No `authorized_lab_target` check.

Same legal risk as GAP-001. This path is manually triggered (vs. automatic in GAP-001) but equally problematic.

Additional violations:
- `POST /api/silkweb/scan/sqlmap` — direct SQLmap against any URL submitted by authenticated user
- `POST /api/silkweb/trapped/:id/os-cmd` — OS command execution against trapped attacker's host
- `POST /api/silkweb/trapped/:id/file-read` — File read against trapped attacker's host

All of these are offensive capabilities aimed at external IPs with no target authorization system.

---

### GAP-003 — Ghost Trap counter-attack port scanner against any public IP (ghosttrap.ts)
**File:** `artifacts/api-server/src/routes/ghosttrap.ts` lines 938–980  
**Risk:** CRITICAL  

`POST /api/ghost-trap/counter/manual-scan` allows any authenticated user (not just security_admin) to initiate TCP port scans against any public IP. Only RFC1918/loopback addresses are blocked.

**No RBAC gate:** `requireRbac` is not applied. Any Clerk-authenticated user can call this.

Same for `/counter/port-scan`, `/counter/manual-osint`, `/counter/osint`.

---

## §2 — HIGH Gaps

### GAP-004 — No `authorized_lab_target` system exists anywhere in the codebase
**Risk:** HIGH  

The original design requirement states: "If SQLmap exists, restrict it to authorized internal lab targets only." A field `authorized_lab_target = true` is mentioned as the gate.

**Finding:** This field does NOT exist in any DB schema, route handler, or middleware. The system has no concept of "authorized lab targets." All offensive tooling (SQLmap, port scan, os-cmd, file-read) targets whatever IP is supplied.

**Required:** Add `authorized_lab_target` boolean to `nodes` table; add a whitelist table `lab_targets` with `ip`, `authorized_by`, `authorized_at`, `expires_at`; add a helper `requireLabTarget(ip)` that checks the whitelist before executing any offensive tool.

---

### GAP-005 — Ghost Node system completely absent
**Risk:** HIGH  

No frontend page, no backend route, no DB table exists for "Ghost Node" — a system designed to present fake/decoy node inventory to attackers and scanners.

The `nodes` table has a `trapped` status enum value, but this is the SilkWeb attacker-trap concept, not a Ghost Node (fake VPN node presented to scanners to misdirect them).

**Impact:** Sophisticated attackers scanning for ProxhqVPN infrastructure can identify real node IPs without encountering any deception layer.

---

### GAP-006 — No mTLS on daemon-inbound; PSK-only authentication
**Risk:** HIGH  

`generate-ca-and-mtls.sh` script exists to generate CA and daemon certificates, but the daemon-inbound routes use only PSK header authentication (`DAEMON_PSK` / per-node `daemonSecret`). No client certificate validation.

**Risk:** If the PSK is intercepted (in-transit or via server env exposure), an attacker can inject false firewall rules, honeypot events, and beacon data into the platform.

**Required:** Enforce mutual TLS on daemon-inbound: client presents cert signed by platform CA, verified at Express HTTPS layer.

---

### GAP-007 — Honeypot has no frontend in main ghost-vpn app
**Risk:** HIGH (operational)  

`HoneypotCommand` exists as a separate registered artifact (`/honeypot-command`), but:
- It is not linked from the ghost-vpn dashboard
- It has no nav entry in the sidebar
- There is no paywall gate (any user who discovers the URL can access it)
- It calls `/api/honeypot/*` endpoints without requiring admin/security_admin role
- Unauthenticated access to the honeypot API is not blocked (honeypot routes use Clerk auth but have no RBAC role requirement)

---

### GAP-008 — Firewall-to-node sync has no node identity verification
**Risk:** HIGH  

`GET /api/daemon-inbound/firewall-rules` returns the full firewall ruleset to anyone presenting the correct PSK. There is no per-node binding — any node (or attacker who knows the PSK) gets the full ruleset.

**Required:** Bind rule exports to nodeId; use per-node `daemonSecret` (already in schema) so each node only gets its own rules.

---

### GAP-009 — No isolation between honeypot and production WireGuard traffic
**Risk:** HIGH  

The honeypot standalone setup runs Cowrie on the same host as WireGuard. There is no WireGuard policy routing suspicious traffic to an isolated honeypot interface. Production VPN users and attacker connections share the same node.

**Required:** Separate WireGuard interfaces (e.g. `wg0` for production, `wg-decoy0` for honeypot), with iptables policy routing suspicious source IPs to the decoy interface.

---

## §3 — MEDIUM Gaps

### GAP-010 — No audit chain entries in Ghost Trap counter-attack routes
**Risk:** MEDIUM  

`appendAuditEvent` is never called in `ghosttrap.ts`. Port scans, OSINT queries, and tarpit engagements leave no audit trail in the SHA3-256 audit chain.

---

### GAP-011 — No SIEM forwarding from Ghost Trap
**Risk:** MEDIUM  

`publishPlatformEvent` is never called in `ghosttrap.ts`. Ghost Trap events (probes, counter-attacks, tarpit sessions) do not appear in the SIEM (`/siem` dashboard).

---

### GAP-012 — Ghost Trap lure endpoints are PUBLIC (no auth required)
**Risk:** MEDIUM  

`/api/ghost-trap/lure/*` and `/api/ghost-trap/beacon/*` are intentionally public. However, there is no rate limiting specifically on these endpoints. A DDoS targeting lure endpoints would fill the `ghost_trap_probes` table rapidly.

**Required:** Add per-IP rate limiting (distinct from the global 300/min) on lure endpoints.

---

### GAP-013 — SilkWeb exploitation console requires only Clerk auth (no RBAC)
**Risk:** MEDIUM  

`POST /api/silkweb/trapped/:id/os-cmd`, `/file-read`, `/sqlmap-custom` require only a valid Clerk session. No `security_admin` or `owner` role check. Any paying subscriber could trigger offensive commands.

---

### GAP-014 — Node daemon has no version pinning or update mechanism
**Risk:** MEDIUM  

Node agents check in via `/api/node-agent/checkin` with their `version` field, but the API never rejects or quarantines outdated versions, and there is no `POST /api/node-agent/update` endpoint. Compromised or outdated nodes continue operating silently.

---

### GAP-015 — Vultr cloud firewall not managed
**Risk:** MEDIUM  

No Vultr API integration exists. Vultr-level firewall rules (separate from VM-level iptables) are not automated. A node's VM-level firewall may be hardened but the cloud firewall (managed from Vultr dashboard) may allow all traffic by default.

---

## §4 — LOW Gaps

### GAP-016 — ghostd.py uses plain HTTP on 127.0.0.1:7475 for local REST API
**Risk:** LOW  

The daemon's local control REST API (proxied via `routes/daemon.ts`) is plain HTTP. If there's any local privilege escalation, an attacker could manipulate the daemon without authentication.

---

### GAP-017 — `nodes.privateKey` stores WireGuard private keys (even if encrypted)
**Risk:** LOW  

Even though keys are AES-256-GCM encrypted, the RAM-only architecture goal is that keys never touch disk. The DB is a disk-backed store. Any DB dump exports encrypted key material.

**Recommendation:** For RAM-only nodes, consider storing only `publicKey` in the DB; distribute `privateKey` only via `/api/daemon-inbound/wg-key` at daemon startup.

---

### GAP-018 — honeypot relay_agent.py has no retry backoff
**Risk:** LOW  

The relay agent ships events every 15 seconds. On network error it falls through and retries immediately at the next interval. Under sustained outages this can cause log accumulation and missed events.

---

*© 2026 ALPHA UNLIMITED TECHNOLOGIES LLC — CONFIDENTIAL AUDIT*
