# RECOMMENDED_NODE_PATCHES.md
**Generated:** 2026-06-13  
**Priority:** CRITICAL first, then HIGH, MEDIUM, LOW  
**Note:** This is an implementation plan document. No code has been changed. Review and approve before implementation.

---

## PATCH-001 — Remove auto-SQLmap from honeypot-hit handler
**Addresses:** GAP-001  
**Priority:** CRITICAL — implement before any deployment  
**File:** `artifacts/api-server/src/routes/daemon-inbound.ts` lines 447–480  

### Action
Delete lines 447–480 (the auto-exec SQLmap block). The beacon alert and silkweb trap record are fine. Only the `exec(cmd, ...)` block must be removed.

```typescript
// DELETE this entire block:
if (body.banner && body.banner.includes("HTTP")) {
  const jobId = randomUUID().substring(0, 8).toUpperCase();
  const safeIp = body.attackerIp.replace(/[^0-9a-fA-F.:]/g, "");
  const targetUrl = `http://${safeIp}:${body.port}/`;
  const cmd = [...].join(" ");
  await db.update(...).set({ sqlmapStatus: "running", ... });
  exec(cmd, { timeout: 120000 }, ...);
  logger.info({ ip: body.attackerIp, jobId, targetUrl }, "Auto-SQLmap launched via honeypot banner detection");
}
```

**Replace with:** Log the HTTP banner detection as intelligence only.
```typescript
if (body.banner && body.banner.includes("HTTP")) {
  logger.info({ ip: body.attackerIp, port: body.port }, "HTTP banner detected on honeypot hit — manual investigation available via SilkWeb");
}
```

---

## PATCH-002 — Add `authorized_lab_target` system for all offensive tools
**Addresses:** GAP-002, GAP-004  
**Priority:** CRITICAL  

### Step 1: Add `lab_targets` DB table
```sql
CREATE TABLE lab_targets (
  id          SERIAL PRIMARY KEY,
  ip          TEXT NOT NULL UNIQUE,
  hostname    TEXT,
  description TEXT,
  authorized_by TEXT NOT NULL,  -- Clerk userId
  authorized_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ,      -- null = no expiry
  active      BOOLEAN NOT NULL DEFAULT true
);
```

### Step 2: Add helper `requireLabTarget(ip: string): Promise<void>`
```typescript
async function requireLabTarget(ip: string): Promise<void> {
  const [row] = await db.select().from(labTargetsTable)
    .where(and(
      eq(labTargetsTable.ip, ip),
      eq(labTargetsTable.active, true),
      or(isNull(labTargetsTable.expiresAt), gte(labTargetsTable.expiresAt, new Date()))
    ));
  if (!row) throw new Error(`IP ${ip} is not an authorized lab target`);
}
```

### Step 3: Gate all offensive tool invocations
Apply `await requireLabTarget(ip)` before any `exec(sqlmap ...)`, `exec(nmap ...)`, or OS command targeting an external IP.

### Scope
| File | Function | Action |
|---|---|---|
| `silkweb.ts` | `/trapped/:id/sqlmap` | Require lab target for `attacker.ip` |
| `silkweb.ts` | `/scan/sqlmap` | Require lab target for submitted URL's host |
| `silkweb.ts` | `/trapped/:id/sqlmap-custom` | Require lab target |
| `silkweb.ts` | `/trapped/:id/os-cmd` | Require lab target |
| `silkweb.ts` | `/trapped/:id/file-read` | Require lab target |
| `daemon-inbound.ts` | auto-SQLmap block | Remove (PATCH-001) or require lab target |

---

## PATCH-003 — Add RBAC gates to Ghost Trap counter-attack endpoints
**Addresses:** GAP-003  
**Priority:** CRITICAL  
**File:** `artifacts/api-server/src/routes/ghosttrap.ts` lines 938–1127  

Add `requireRbac("counter_attack")` middleware before all `/counter/*` routes:

```typescript
import { requireRbac } from "../middlewares/requireRbac";

// Apply to all counter-attack routes:
router.post("/counter/manual-scan",   requireAuth, requireRbac("counter_attack"), async (req, res) => { ... });
router.post("/counter/manual-osint",  requireAuth, requireRbac("counter_attack"), async (req, res) => { ... });
router.post("/counter/port-scan",     requireAuth, requireRbac("counter_attack"), async (req, res) => { ... });
router.post("/counter/osint",         requireAuth, requireRbac("counter_attack"), async (req, res) => { ... });
router.post("/counter/canary-inject", requireAuth, requireRbac("counter_attack"), async (req, res) => { ... });
```

Add `"counter_attack"` to `lib/rbac.ts` action list, allowed only for `owner` and `security_admin` roles.

---

## PATCH-004 — Add RBAC to SilkWeb exploitation console
**Addresses:** GAP-013  
**Priority:** HIGH  
**File:** `artifacts/api-server/src/routes/silkweb.ts`  

Add `requireRbac("silkweb_exploit")` (new action, owner/security_admin only) to:
- `/trapped/:id/sqlmap`
- `/scan/sqlmap`
- `/trapped/:id/sqlmap-custom`
- `/trapped/:id/os-cmd`
- `/trapped/:id/file-read`

Regular VPN users and `support` role should never see or call these endpoints.

---

## PATCH-005 — Add audit chain entries to Ghost Trap counter-attack
**Addresses:** GAP-010  
**Priority:** HIGH  
**File:** `artifacts/api-server/src/routes/ghosttrap.ts`  

After each counter-attack action completes, call:
```typescript
appendAuditEvent({
  actor: userId,
  action: "ghost_trap.counter_scan",
  target: ip,
  metadata: { openPorts: open.map(r => r.port), scannedAt: new Date().toISOString() },
  severity: "warn",
});
```

---

## PATCH-006 — Add SIEM forwarding from Ghost Trap
**Addresses:** GAP-011  
**Priority:** HIGH  
**File:** `artifacts/api-server/src/routes/ghosttrap.ts`  

Import `publishPlatformEvent` and call it on:
- Every probe capture (severity: "warn" for known-scanner UA, "info" otherwise)
- Every counter-attack action (severity: "warn")
- Every tarpit engagement (severity: "info")
- Every beacon fire (severity: "info")

---

## PATCH-007 — Implement mTLS for daemon-inbound
**Addresses:** GAP-006  
**Priority:** HIGH  

### Step 1: Use `generate-ca-and-mtls.sh` to issue certs
Already exists at `standalone/scripts/generate-ca-and-mtls.sh` — run it, distribute client certs to nodes.

### Step 2: Load CA in Express HTTPS server
```typescript
// In app startup (requires HTTPS listener):
const tlsOptions = {
  key:  fs.readFileSync(process.env.TLS_KEY_PATH!),
  cert: fs.readFileSync(process.env.TLS_CERT_PATH!),
  ca:   fs.readFileSync(process.env.TLS_CA_PATH!),
  requestCert: true,
  rejectUnauthorized: false, // handle in middleware
};
```

### Step 3: Add cert verification middleware for daemon-inbound routes
```typescript
function requireNodeCert(req, res, next) {
  const cert = (req.socket as TLSSocket).getPeerCertificate();
  if (!cert || !cert.subject) {
    return res.status(401).json({ error: "Client certificate required" });
  }
  // Verify cert CN matches expected nodeId
  next();
}
```

---

## PATCH-008 — Implement Ghost Node system
**Addresses:** GAP-005  
**Priority:** HIGH  

See GHOST_SYSTEM_PATCH_PLAN.md §1 for full implementation plan. Summary:

1. Add `ghost_nodes` DB table (fake/decoy node records)
2. Add backend routes `GET /api/ghost-nodes`, `POST /api/ghost-nodes/:id/enable`, etc.
3. Add frontend page at `/ghost-nodes` (CommandCenter tier)
4. Add WireGuard decoy peer delivery via daemon-inbound
5. Keep decoy nodes isolated from production VPN traffic

---

## PATCH-009 — Isolate honeypot traffic from production VPN via WireGuard policy routing
**Addresses:** GAP-009  
**Priority:** HIGH  

### On each node (iptables/nftables):
```bash
# Create separate WireGuard interface for honeypot decoys
wg-quick up wg-decoy  # separate config, different port (51821)

# Route suspicious IPs to decoy interface
iptables -t mangle -A PREROUTING -s <suspicious_ip> -j MARK --set-mark 2
ip rule add fwmark 2 table 100
ip route add default dev wg-decoy table 100
```

### Trigger: when `silkWebTable.status = "trapped"`, push the attacker's IP to the node's decoy routing policy via `POST /api/daemon-inbound/peer-rules`.

---

## PATCH-010 — Add HoneypotCommand nav link and RBAC
**Addresses:** GAP-007  
**Priority:** HIGH  

1. Add sidebar link in `ghost-vpn` Layout to `/honeypot-command` (CommandCenter tier only)
2. Add PaywallGate around `HoneypotCommand` — require `command_center` capability
3. Add `requireRbac("honeypot_admin")` to `/api/honeypot/*` mutate routes (POST/PATCH/DELETE)
4. Read-only GET routes: allow `security_admin` and above

---

## PATCH-011 — Add per-IP rate limiting on Ghost Trap lure endpoints
**Addresses:** GAP-012  
**Priority:** MEDIUM  

```typescript
import rateLimit from "express-rate-limit";

const lureLimiter = rateLimit({
  windowMs: 60_000,  // 1 minute
  max: 30,           // 30 probes per IP per minute
  keyGenerator: (req) => getAttackerIp(req),
  handler: (req, res) => res.status(429).json({ error: "Too many probes" }),
  skip: () => false,  // never skip — even attackers get rate-limited
});

router.all("/lure/*", lureLimiter, (req, res) => handleProbe(req, res, req.path));
router.get("/beacon/:beaconId", lureLimiter, async (req, res) => { ... });
```

---

## PATCH-012 — Add node version enforcement
**Addresses:** GAP-014  
**Priority:** MEDIUM  

In `node-agent.ts` checkin handler, compare `body.version` against minimum required version from env (`NODE_AGENT_MIN_VERSION`). If below minimum, still accept health data but return `{ ok: true, updateRequired: true, minimumVersion: "x.y.z" }` in response.

---

## PATCH-013 — Vultr cloud firewall automation
**Addresses:** GAP-015  
**Priority:** MEDIUM  

Integrate Vultr API (`https://api.vultr.com/v2`) using `VULTR_API_KEY` env var to:
1. List firewall groups and rules
2. Create/update rules to match the DB firewall policy
3. Sync node provisioning (creating a Vultr instance when a new node is provisioned)

---

*© 2026 ALPHA UNLIMITED TECHNOLOGIES LLC — CONFIDENTIAL AUDIT*
