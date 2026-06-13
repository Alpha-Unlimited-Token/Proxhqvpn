# REMOVED_DANGEROUS_BEHAVIOR_REPORT.md
**ProxhqVPN — Complete Inventory of Removed Dangerous Behaviors**
**Date:** 2026-06-13 | **Author:** Alpha Unlimited Technologies LLC

---

## What Was Removed and Why

### 1. Auto-SQLmap Against Attacker IPs (daemon-inbound.ts)

**File:** `artifacts/api-server/src/routes/daemon-inbound.ts`
**Removed:** Automatic SQLmap execution triggered when a node daemon reported a new attacker IP
**Reason:** Running SQLmap against an attacker's IP without authorization is unauthorized computer access under:
- Computer Fraud and Abuse Act (CFAA) 18 U.S.C. § 1030
- UK Computer Misuse Act 1990
- EU Directive 2013/40/EU

**Replaced with:** Defensive intelligence collection — ghost_trap_event creation, evidence record, SIEM event, optional IP block. No outbound connections to attacker systems.

---

### 2. POST /trapped/:id/sqlmap (silkweb.ts)

**Route:** `POST /api/silkweb/trapped/:id/sqlmap`
**Auth:** Previously required `requireRbac("silkweb_exploit")`
**Action:** Ran `sqlmap -u "http://<attacker_ip>/" --batch --level=2 --risk=2 --dbs`
**Target:** `attacker.ip` — a public internet address captured from a honeypot probe
**Removed:** Yes — returns HTTP 451
**Reason:** Attacker IPs are public internet addresses. Scanning them constitutes unauthorized access regardless of whether they attacked the platform first. The platform has no ownership or authorization over attacker systems.

---

### 3. POST /trapped/:id/sqlmap-custom (silkweb.ts)

**Route:** `POST /api/silkweb/trapped/:id/sqlmap-custom`
**Auth:** `requireRbac("silkweb_exploit")`
**Action:** Ran arbitrary SQLmap flags against attacker IP
**Removed:** Yes — returns HTTP 451
**Additional concern:** `safeFlags = customFlags.replace(/[backtick$(){}|;&<>]/g, "")` — insufficient sanitization for a production server; shell injection risk through unescaped characters.

---

### 4. POST /trapped/:id/file-read (silkweb.ts)

**Route:** `POST /api/silkweb/trapped/:id/file-read`
**Auth:** `requireRbac("silkweb_exploit")`
**Action:** Ran `sqlmap --file-read="/etc/passwd"` against attacker IP
**Removed:** Yes — returns HTTP 451
**Reason:** Attempting to read files on a remote system without authorization is unauthorized access. This is more severe than a port scan — it attempts active exploitation.

---

### 5. POST /trapped/:id/os-cmd (silkweb.ts)

**Route:** `POST /api/silkweb/trapped/:id/os-cmd`
**Auth:** `requireRbac("silkweb_exploit")`
**Action:** Ran `sqlmap --os-cmd="id"` against attacker IP
**Removed:** Yes — returns HTTP 451
**Reason:** Remote OS command execution on a system you do not own is the most severe form of unauthorized access. This would constitute a criminal offense under all major jurisdictions regardless of the target's prior behavior.

---

### 6. POST /scan/portscan (silkweb.ts)

**Route:** `POST /api/silkweb/scan/portscan`
**Auth:** Previously **none** — completely unauthenticated
**Action:** Ran `nmap -sV -T4 -p 1-10000 <any_ip>`
**Removed:** Yes — returns HTTP 451 + now requires `requireRbac("silkweb_exploit")`
**Critical concern:** No authentication gate. Any user who could reach the API could trigger nmap scans against arbitrary public IPs, creating serious legal liability for Alpha Unlimited Technologies LLC.

---

### 7. POST /scan/sqlmap (silkweb.ts)

**Route:** `POST /api/silkweb/scan/sqlmap`
**Auth:** `requireRbac("silkweb_exploit")`
**Action:** Ran SQLmap against any user-supplied IP/URL
**Removed:** Yes — returns HTTP 451
**Reason:** No lab-target validation. Any silkweb_exploit user could target any public URL.

---

## What Was Preserved (Defensive Only)

| Route | Behavior | Why Safe |
|-------|----------|----------|
| GET /api/silkweb/trapped/:id/sqlmap | Read stored sqlmap status | No outbound connections |
| GET /api/silkweb/trapped/:id/sqlmap-custom/:jobId | Read stored job result | No outbound connections |
| GET /api/silkweb/trapped/:id/file-read/:jobId | Read stored result | No outbound connections |
| GET /api/silkweb/trapped/:id/os-cmd/:jobId | Read stored result | No outbound connections |
| GET /api/silkweb/scan/portscan/:jobId | Read stored result | No outbound connections |
| GET /api/silkweb/scan/sqlmap/:jobId | Read stored result | No outbound connections |
| POST /api/ghost-trap/counter/port-scan | TCP probe ONLY to IPs that attacked this user | Gated on proof-of-attack, probe only |
| POST /api/ghost-trap/counter/osint | Passive geo/RDNS ONLY | No exploitation, no write |
| POST /api/ghost-trap/counter/canary-inject | Creates a beacon URL | No outbound scan |

---

## Lab Target System (Retained for Authorized Internal Use)

SQLmap and nmap remain available for authorized internal lab targets ONLY through the `/api/lab-targets` system:
- `authorized_lab_target = true`
- `target_scope = "internal_lab"`
- Target IP must be a private/RFC-1918 address
- Requires `silkweb_exploit` RBAC capability
- All actions are audit-logged

This allows the platform to be used for legitimate internal security lab exercises without enabling illegal public internet scanning.

---

## Risk Reduction

| Risk | Before | After |
|------|--------|-------|
| Unauthorized access to attacker systems | **CRITICAL** | Eliminated |
| Unauthenticated port scan API | **CRITICAL** | Eliminated |
| Automatic exploitation trigger | **HIGH** | Eliminated |
| Shell injection via unsanitized flags | **HIGH** | Eliminated |
| Legal liability (CFAA/CMA) | **HIGH** | Significantly reduced |
