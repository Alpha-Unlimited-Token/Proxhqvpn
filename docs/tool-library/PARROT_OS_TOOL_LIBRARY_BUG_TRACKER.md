# Parrot OS Tool Library — Bug Tracker
## © 2026 Alpha Unlimited Technologies LLC

**Status:** All bugs from audit resolved in v2.0 (2026-06-11)

---

## Bug Index

| ID | Severity | Status | Title |
|----|----------|--------|-------|
| BUG-001 | CRITICAL | ✅ FIXED | Nmap extra flags shell argument injection |
| BUG-002 | CRITICAL | ✅ FIXED | No target allowlist — SSRF to RFC1918/internal |
| BUG-003 | CRITICAL | ✅ FIXED | Zero audit logging on all tool runs |
| BUG-004 | HIGH | ✅ FIXED | In-memory-only job state, no DB persistence |
| BUG-005 | HIGH | ✅ FIXED | No approval workflow for high-risk tools |
| BUG-006 | HIGH | ✅ FIXED | Unvalidated numeric field values (DoS) |
| BUG-007 | HIGH | ✅ FIXED | No per-user concurrency limit |
| BUG-008 | MEDIUM | ✅ FIXED | Missing 8 tool categories vs Parrot OS library |
| BUG-009 | MEDIUM | ✅ FIXED | No GeoIP enrichment of scan targets |
| BUG-010 | MEDIUM | ✅ FIXED | No evidence export / structured reporting |
| BUG-011 | MEDIUM | ✅ FIXED | No remote node agent backend |
| BUG-012 | LOW | ✅ FIXED | No persistent job history frontend page |
| BUG-013 | LOW | ✅ FIXED | No target scope management UI |
| BUG-014 | LOW | ✅ FIXED | No scan scheduler UI |
| BUG-015 | LOW | ✅ FIXED | No admin approval queue UI |
| BUG-016 | LOW | ✅ FIXED | No node health dashboard UI |

---

## Detailed Bug Reports

### BUG-001: Nmap Extra Flags Injection
**File:** `artifacts/api-server/src/routes/toolrunner.ts`  
**Lines (pre-fix):** 88  
**Reproduction:**
```
POST /api/tool-runner/run
{ "toolId": "nmap", "opts": { "target": "8.8.8.8", "mode": "quick", "extra": "--script /etc/passwd --open" } }
```
**Impact:** Arbitrary nmap script loading, potential data exfiltration via DNS NSE scripts.  
**Fix:** Removed the `extra` field from nmap tool definition entirely. Replaced with structured, predefined scan mode selection.  
**Verified:** Field no longer present in tool definition or buildArgs function. ✅

### BUG-002: No Target Allowlist
**File:** `artifacts/api-server/src/routes/toolrunner.ts`  
**Lines (pre-fix):** POST /run handler  
**Reproduction:**
```
POST /api/tool-runner/run
{ "toolId": "nmap", "opts": { "target": "169.254.169.254", "mode": "quick" } }
→ Would have scanned AWS metadata endpoint
```
**Impact:** SSRF to internal infrastructure, cloud metadata theft, internal network mapping.  
**Fix:** Hard-blocked CIDR list includes `127.0.0.0/8`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16`, `::1/128`, `fc00::/7`. Added `tool_target_scopes` table for user-declared approved targets.  
**Verified:** Validated CIDR check function rejects all internal ranges with 400 error. ✅

### BUG-003: No Audit Logging
**File:** `artifacts/api-server/src/routes/toolrunner.ts`  
**Reproduction:** Run any tool — no trace in audit chain.  
**Impact:** Zero forensic accountability. Violates authorized-testing operator requirements.  
**Fix:** `appendAuditEvent()` called on: run start, run completion, kill, approval create/approve/reject, scope add/remove.  
**Verified:** Audit chain entries appear in DB after tool run. ✅

### BUG-004: In-Memory Job State
**Description:** `const jobs = new Map<string, Job>()` — process restart erases all history.  
**Fix:** `tool_jobs` table created. Job created on `POST /run`, updated on close. History available at `GET /tool-runner/history`.  
**Verified:** Jobs persist across server restart. ✅

### BUG-005: No Approval Workflow
**Reproduction:** `POST /run` with `{ toolId: "sqlmap", opts: { level: "5", risk: "3" } }` — runs immediately.  
**Fix:** `REQUIRES_APPROVAL` set checked before spawn. If true, inserts into `tool_approvals` and returns `{ status: "pending_approval", approvalId }` with HTTP 202. Admin approves via `POST /approvals/:id/approve`.  
**Verified:** High-risk runs return 202 until approved. ✅

### BUG-006: Unvalidated Numeric Fields
**Reproduction:** `opts.threads = "999999"` → spawns process with 999999 threads.  
**Fix:** Zod schema clamps threads 1–200, timeout 1–300, depth 1–4, rateLimit 1–150.  
**Verified:** Values above max are clamped silently. ✅

### BUG-007: Per-User Concurrency
**Reproduction:** Loop POST /run 50 times rapidly — all 50 processes spawn.  
**Fix:** Count active (non-done) jobs per userId in in-memory jobs map. If ≥ 3, return 429.  
**Verified:** 4th concurrent job returns 429. ✅

### BUG-008: Missing Tool Categories
**Categories added:** Password Attacks, Forensics & DFIR, Cryptography, Stress Testing  
**Tools added:** hydra, john, volatility3, binwalk, gpg, hashcat, hping3, slowhttptest  
**Verified:** All 8 new tools appear in `GET /tool-runner/tools` response. ✅

### BUG-009: No GeoIP Enrichment
**Fix:** `geoip-lite` package installed. On `POST /run`, if target is an IP, `geoip.lookup(ip)` is called and result stored in `tool_jobs.geo_json`.  
**Verified:** `tool_jobs.geo_json` populated with country/city/ll for IP targets. ✅

### BUG-010: No Evidence Export
**Fix:** `POST /tool-runner/evidence/:jobId` streams a ZIP containing: `job-metadata.json`, `output.txt`, `geo-report.json`, `threat-summary.txt`.  
**Verified:** ZIP download works from ToolHistory page. ✅

### BUG-011: No Node Agent Backend
**Fix:** `POST /api/node-agent/checkin` accepts PSK-authenticated POST with `{ nodeId, version, ip, os, tools }`. Upserts `node_agent_health`. Inserts `node_agent_events`.  
**Verified:** Check-in request creates/updates health record. ✅

### BUG-012–016: Frontend Pages
**Pages added:** ToolHistory, ToolScope, ScanScheduler, ToolApprovals, NodeHealth  
**Routes added to App.tsx and sidebar:** `/tool-history`, `/tool-scope`, `/scan-scheduler`, `/tool-approvals`, `/node-health`  
**Verified:** All pages render and fetch real data from API. ✅

---

## Open Issues (Post v2.0)

None at release. The following are future enhancement candidates tracked for v2.1:

| ID | Priority | Title |
|----|----------|-------|
| ENH-001 | MEDIUM | Tool output search / grep within history |
| ENH-002 | MEDIUM | Scheduled scan email/webhook notifications |
| ENH-003 | LOW | Node agent tool auto-installation script |
| ENH-004 | LOW | Multi-target batch run support |
| ENH-005 | LOW | SARIF export format for vulnerability tools |
