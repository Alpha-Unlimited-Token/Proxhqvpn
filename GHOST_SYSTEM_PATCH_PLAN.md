# GHOST_SYSTEM_PATCH_PLAN.md
**Generated:** 2026-06-13  
**Status:** PLAN ONLY — no code has been changed  
**Instructions:** Review this plan. Approve for implementation (Step 4). Each patch is independent unless marked "DEPENDS ON."

---

## Phase 1 — Critical Safety Fixes (implement first, before any deployment)

### P1-A: Remove auto-SQLmap from daemon-inbound honeypot-hit handler
**Gap:** GS-001  
**File:** `artifacts/api-server/src/routes/daemon-inbound.ts`  
**Change:** Delete lines 447–480 (the `if (body.banner && body.banner.includes("HTTP"))` exec block)  
**Replace with:** Intelligence log line only  
**Risk if skipped:** ProxhqVPN servers automatically attack external IPs — legal liability

### P1-B: Add `authorized_lab_target` system
**Gap:** GS-004  
**Files to create/modify:**
- `lib/db/src/schema/lab-targets.ts` — new schema file
- `lib/db/src/schema/index.ts` — add export
- `artifacts/api-server/src/lib/lab-targets.ts` — `requireLabTarget(ip)` helper
- `artifacts/api-server/src/routes/silkweb.ts` — add requireLabTarget before every exec()
- `artifacts/api-server/src/routes/ghosttrap.ts` — add requireLabTarget on counter routes
**New DB table:** `lab_targets (id, ip, hostname, description, authorized_by, authorized_at, expires_at, active)`

### P1-C: Add RBAC to Ghost Trap counter-attack routes
**Gap:** GS-003  
**File:** `artifacts/api-server/src/routes/ghosttrap.ts`  
**Change:** Add `requireRbac("counter_attack")` to all `/counter/*` routes  
**Also:** Add `"counter_attack"` action to `lib/rbac.ts` — allowed for `owner` and `security_admin` only

### P1-D: Add RBAC to SilkWeb exploitation console
**Gap:** GS-002, GS-014  
**File:** `artifacts/api-server/src/routes/silkweb.ts`  
**Change:** Add `requireRbac("silkweb_exploit")` to sqlmap, os-cmd, file-read routes  
**Also:** Add `"silkweb_exploit"` action to `lib/rbac.ts`

---

## Phase 2 — High Priority Security & Observability

### P2-A: Add audit chain to Ghost Trap
**Gap:** GS-010  
**File:** `artifacts/api-server/src/routes/ghosttrap.ts`  
**Change:** Import `appendAuditEvent` from `../lib/audit-chain`. Call it on:
- Counter-attack scan/OSINT executed
- Tarpit session engaged
- Config changed
- Probe threshold triggered (auto-block / silk-trap)

### P2-B: Add SIEM forwarding to Ghost Trap
**Gap:** GS-009  
**File:** `artifacts/api-server/src/routes/ghosttrap.ts`  
**Change:** Import `publishPlatformEvent` from `../lib/siem`. Call it on:
- Probe captured (severity: "warn" for known scanners, "info" for others)
- Counter-attack fired (severity: "warn")
- Tarpit engaged (severity: "info")
- Auto-block triggered (severity: "warn")

### P2-C: Add RBAC to Honeypot mutate routes
**Gap:** GS-008  
**File:** `artifacts/api-server/src/routes/honeypot.ts`  
**Change:** Add `requireRbac("honeypot_admin")` to POST /nodes, PATCH /nodes/:id, DELETE /nodes/:id, POST /iocs, DELETE /iocs/:id, POST /alerts/:id/acknowledge

### P2-D: Add Honeypot nav link + PaywallGate to ghost-vpn
**Gap:** GS-007  
**Files:**
- `artifacts/ghost-vpn/src/components/layout/Layout.tsx` — add sidebar entry "Honeypot Command" pointing to `/honeypot-command`
- Wrap with CommandCenter capability check

### P2-E: Add RBAC to Deception Engine
**Gap:** GS-019  
**File:** `artifacts/api-server/src/routes/deception.ts`  
**Change:** Add `requireRbac("deception_admin")` to trap banner CRUD and event management. Public trap routes (`/trap/*`, `/canary/:token`) remain public.

### P2-F: Add SIEM + audit chain to Honeypot and Deception
**Gap:** GS-021, GS-022  
**Files:** `honeypot.ts`, `deception.ts`  
**Change:** Import and call `appendAuditEvent` and `publishPlatformEvent` on significant events (new session, alert, attacker capture, banner create/delete)

---

## Phase 3 — Ghost Node Implementation (largest feature — plan separately)

### P3-A: Create Ghost Node DB schema
**Gap:** GS-005  
**New files:**
- `lib/db/src/schema/ghost-nodes.ts`  
  Tables: `ghost_nodes`, `ghost_node_events`, `ghost_node_routes`, `vultr_node_deception_state`
- Update `lib/db/src/schema/index.ts`

### P3-B: Create Ghost Node backend routes
**New file:** `artifacts/api-server/src/routes/ghost-node.ts`  
**Routes:**
```
GET    /api/ghost-nodes
POST   /api/ghost-nodes
GET    /api/ghost-nodes/:id
PATCH  /api/ghost-nodes/:id
DELETE /api/ghost-nodes/:id
POST   /api/ghost-nodes/:id/enable
POST   /api/ghost-nodes/:id/disable
POST   /api/ghost-nodes/:id/quarantine
GET    /api/ghost-nodes/:id/events
POST   /api/ghost-nodes/:id/export-evidence
```
All routes: `requireAuth + requireRbac("ghost_node_admin")` (security_admin+)

### P3-C: Add Ghost Node daemon-inbound endpoints
**File:** `artifacts/api-server/src/routes/daemon-inbound.ts`  
**Add:**
```
GET  /api/daemon-inbound/ghost-policy     — node polls for ghost node config
POST /api/daemon-inbound/ghost-event      — node reports ghost probe received
```

### P3-D: Create Ghost Node frontend page
**New file:** `artifacts/ghost-vpn/src/pages/GhostNodes.tsx`  
**Register:** Add `<Route path="/ghost-nodes">` in `commandCenterRoutes.tsx`  
**Layout:** CcLayout  
**Components:**
- Ghost node status grid
- Recent interaction event feed
- Create/edit ghost node modal
- Evidence export button
- Quarantine control

### P3-E: Add RBAC action for Ghost Node
**File:** `artifacts/api-server/src/lib/rbac.ts`  
**Add:** `"ghost_node_admin"` — allowed for `owner` and `security_admin`

---

## Phase 4 — Node Daemon Hardening

### P4-A: Implement mTLS on daemon-inbound
**Gap:** GS-006  
**Files:** `artifacts/api-server/src/app.ts`  
**Steps:**
1. Run `standalone/scripts/generate-ca-and-mtls.sh`
2. Set env vars: `TLS_CA_PATH`, `TLS_CERT_PATH`, `TLS_KEY_PATH`
3. Add HTTPS listener with `requestCert: true` in app.ts (or separate HTTPS server for /api/daemon-inbound/*)
4. Add cert verification middleware: verify `req.socket.getPeerCertificate()` CN matches nodeId

### P4-B: Add Ghost Trap policy delivery to daemon
**Gap:** GS-011  
**File:** `artifacts/api-server/src/routes/daemon-inbound.ts`  
**Add:**
- `GET /api/daemon-inbound/ghost-trap-policy` — returns lure URLs + tarpit IP list for this node
- `POST /api/daemon-inbound/ghost-trap-event` — node reports trap interaction (distinct from honeypot-hit)

### P4-C: Add WireGuard decoy interface support
**Gap:** GS-012  
**Node-side (systemd/iptables):**
```bash
# New WireGuard interface for honeypot routing
wg-quick up wg-decoy  # listen on 51821
iptables -t mangle -A PREROUTING -s <trapped_ip> -j MARK --set-mark 2
ip rule add fwmark 2 table 100
ip route add default dev wg-decoy table 100
```
**API-side:** Add endpoint `GET /api/daemon-inbound/decoy-routing-rules` — returns list of IPs from `trapped_attackers` + `blocked_ips` to route to decoy interface

### P4-D: Node version enforcement
**Gap:** GS-018  
**File:** `artifacts/api-server/src/routes/node-agent.ts`  
**Change:** Compare `body.version` against `process.env.NODE_AGENT_MIN_VERSION`. Return `updateRequired: true` if below minimum.

---

## Phase 5 — Vultr Integration

### P5-A: Vultr API client and node sync
**Gap:** GS-013  
**New file:** `artifacts/api-server/src/lib/vultr-client.ts`  
**Env var needed:** `VULTR_API_KEY`  
**New route:** `GET /api/nodes/vultr-sync` (admin only)  
**DB change:** Add `vultr_instance_id` column to `nodes` table

---

## Phase 6 — Ghost Trap Feature Completions

### P6-A: Add `ghost_trap_rules` table
**File:** `lib/db/src/schema/ghosttrap.ts`  
**Table:** `ghost_trap_rules (id, user_id, rule_type, pattern, action, priority, enabled, created_at)`  
**Backend:** Add routes `GET/POST/PATCH/DELETE /api/ghost-trap/rules`

### P6-B: Add evidence export endpoint
**File:** `artifacts/api-server/src/routes/ghosttrap.ts`  
**New route:** `POST /api/ghost-trap/export-evidence`  
Returns ZIP of: probe records, beacon fires, tarpit session intelligence, backtrace data, authority report

### P6-C: Per-IP rate limiting on lure endpoints
**File:** `artifacts/api-server/src/routes/ghosttrap.ts`  
30 probes/min per source IP via `express-rate-limit` keyed on `getAttackerIp(req)`

---

## Implementation Checklist (for Step 4)

```
Phase 1 (Safety — do first):
  [ ] P1-A: Remove auto-SQLmap from daemon-inbound
  [ ] P1-B: lab_targets table + requireLabTarget helper
  [ ] P1-C: RBAC on Ghost Trap counter-attack
  [ ] P1-D: RBAC on SilkWeb exploit console

Phase 2 (Observability):
  [ ] P2-A: appendAuditEvent in ghosttrap.ts
  [ ] P2-B: publishPlatformEvent in ghosttrap.ts
  [ ] P2-C: RBAC on honeypot mutate routes
  [ ] P2-D: HoneypotCommand nav link + PaywallGate
  [ ] P2-E: RBAC on deception routes
  [ ] P2-F: SIEM + audit in honeypot.ts, deception.ts

Phase 3 (Ghost Node — new feature):
  [ ] P3-A: ghost_nodes DB schema
  [ ] P3-B: /api/ghost-nodes routes
  [ ] P3-C: daemon-inbound ghost policy endpoints
  [ ] P3-D: /ghost-nodes frontend page
  [ ] P3-E: ghost_node_admin RBAC action

Phase 4 (Daemon hardening):
  [ ] P4-A: mTLS on daemon-inbound
  [ ] P4-B: Ghost Trap policy delivery endpoint
  [ ] P4-C: WG decoy interface support
  [ ] P4-D: Node version enforcement

Phase 5 (Vultr):
  [ ] P5-A: Vultr API client + node sync

Phase 6 (Ghost Trap features):
  [ ] P6-A: ghost_trap_rules table
  [ ] P6-B: Evidence export endpoint
  [ ] P6-C: Lure rate limiting
```

---

## Post-implementation validation commands

```bash
pnpm run typecheck:libs
pnpm --filter @workspace/api-server run typecheck
pnpm --filter @workspace/ghost-vpn run typecheck
pnpm --filter @workspace/db run push
```

---

*© 2026 ALPHA UNLIMITED TECHNOLOGIES LLC — CONFIDENTIAL AUDIT*
