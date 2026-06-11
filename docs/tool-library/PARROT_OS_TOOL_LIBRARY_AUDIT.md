# Parrot OS Tool Library — Security Audit Report
## © 2026 Alpha Unlimited Technologies LLC

**Audit Date:** 2026-06-11  
**Scope:** `artifacts/ghost-vpn/src/pages/ToolRunner.tsx`, `artifacts/api-server/src/routes/toolrunner.ts`, related middleware and DB layer  
**Auditor:** Internal security review (automated + manual)

---

## Executive Summary

The Parrot OS Tool Runner exposes real security-tool binaries (nmap, sqlmap, nuclei, ffuf, gobuster, feroxbuster, subfinder, httpx, dig, openssl, curl, whois, ping, traceroute) to authenticated Command Center Pro users via an Express backend. The authentication boundary is correctly enforced by `requireCommandCenter` middleware. However, **critical gaps** in argument sanitization, target scoping, audit logging, persistence, and approval gating were identified and have been remediated in this release.

---

## CRITICAL Findings (CRIT)

### CRIT-001: Nmap Extra Flags — Shell Argument Injection
**File:** `toolrunner.ts` line 88  
**Severity:** CRITICAL  
**Description:** The nmap tool definition accepted a free-form `extra` text field and split it on whitespace directly into `spawn()` arguments:
```
if (o.extra?.trim()) args.push(...o.extra.trim().split(/\s+/));
```
An authenticated attacker could pass `--script /etc/passwd` or `--datadir /tmp/malicious` to cause arbitrary nmap script execution or data exfiltration. Although this does not give shell code execution (spawn does not invoke a shell), it allows using nmap as a proxy for reading arbitrary files and exfiltrating them via DNS/HTTP scripts.  
**Remediation:** The `extra` free-form field has been removed from nmap. Users select from a predefined set of scan modes and ports only. All other field values are validated against type-safe allowlists.

### CRIT-002: No Target Allowlist / Scope Enforcement
**File:** `toolrunner.ts` POST `/run`  
**Severity:** CRITICAL  
**Description:** Any authenticated user could target any IP, domain, or CIDR — including internal infrastructure (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `127.0.0.1`, `169.254.0.0/16`), cloud metadata endpoints (`169.254.169.254`), and Replit's internal routing fabric. No SSRF protection existed.  
**Remediation:** Added `tool_target_scopes` DB table. RFC-1918 / loopback / link-local / cloud-metadata ranges are hard-blocked at the API layer for all tools. Users must register approved target scopes; admins can approve additional scopes.

### CRIT-003: No Audit Logging
**File:** `toolrunner.ts`  
**Severity:** CRITICAL  
**Description:** No audit trail existed for tool runs, kills, or scope access. For an authorized-testing platform, this violates basic forensic accountability.  
**Remediation:** Every tool run, kill, and approval action is now recorded via `appendAuditEvent()` (SHA3-256 + HMAC-SHA512 chain) and persisted to `tool_jobs` table.

---

## HIGH Findings

### HIGH-001: In-Memory-Only Job State
**Severity:** HIGH  
**Description:** All job records existed only in the process-local `Map<string, Job>`. A server restart wiped all history. Users had no persistent record of what was run.  
**Remediation:** Jobs are now persisted to the `tool_jobs` PostgreSQL table on create and on completion.

### HIGH-002: No Approval Workflow for High-Risk Tools
**Severity:** HIGH  
**Description:** High-risk tool configurations (sqlmap level≥2, nuclei cves/vulnerabilities, nmap vuln/full, feroxbuster depth≥3) were executable immediately by any Command Center Pro subscriber without admin review.  
**Remediation:** High-risk configurations create a `tool_approvals` record and return HTTP 202 (pending) until an admin approves. The `GET /tool-runner/approvals` and `POST /tool-runner/approvals/:id/approve|reject` endpoints are admin-only.

### HIGH-003: Unvalidated Field Values
**Severity:** HIGH  
**Description:** Numeric fields (threads, depth, rateLimit, timeout) were passed as strings directly to subprocess arguments without validation. A value of `999999` could cause resource exhaustion.  
**Remediation:** All numeric fields are clamped to safe ranges (e.g., threads max 200, timeout max 300s, depth max 4) via Zod refinements before use.

### HIGH-004: No Per-User Rate Limiting on Tool Runs
**Severity:** HIGH  
**Description:** The global rate limiter (300/min) was the only protection. A single user could monopolize all server CPU with continuous scans.  
**Remediation:** Per-user job concurrency limit of 3 simultaneous active jobs enforced server-side.

---

## MEDIUM Findings

### MED-001: Missing Tool Categories (8 categories)
**Severity:** MEDIUM  
**Description:** The ToolRunner only had 11 tool categories against ParrotOS's full library. Missing: Password Attacks, Exploitation Frameworks, Forensics/DFIR, Reverse Engineering, Cryptography, Social Engineering, Hardware/IoT, Stress Testing.  
**Remediation:** Added representative safe tools for each missing category (hydra, john, volatility, binwalk, gpg, hashcat, hping3, slowhttptest).

### MED-002: No GeoIP Enrichment of Target
**Severity:** MEDIUM  
**Description:** Target IPs were not enriched with geolocation/ASN data, making scan results harder to contextualize.  
**Remediation:** `geoip-lite` enrichment runs on target IPs before job creation; results stored in `tool_jobs.geo_json`.

### MED-003: No Evidence Export
**Severity:** MEDIUM  
**Description:** Users could only download raw output text. No structured evidence package for reporting.  
**Remediation:** `POST /tool-runner/evidence/:jobId` generates a ZIP containing job metadata JSON, raw output, GeoIP report, and threat intel lookup.

### MED-004: No Node Agent Health Tracking
**Severity:** MEDIUM  
**Description:** No mechanism existed for remote Parrot OS node agents to register, check in, or report tool availability.  
**Remediation:** Added `node_agent_health` and `node_agent_events` DB tables, plus `POST /api/node-agent/checkin` and `GET /api/tool-runner/node-agents` endpoints authenticated via PSK.

---

## LOW Findings

### LOW-001: Frontend Lacks Job History Page
**Severity:** LOW  
**Description:** No persistent history view; users could not review past runs.  
**Remediation:** Added `/tool-history` page backed by `GET /tool-runner/history`.

### LOW-002: No Target Scope Management UI
**Severity:** LOW  
**Remediation:** Added `/tool-scope` page for users to declare and manage approved scan targets.

### LOW-003: No Scheduler
**Severity:** LOW  
**Remediation:** Added `/scan-scheduler` page for admin-approved recurring scans.

### LOW-004: No Admin Approval UI
**Severity:** LOW  
**Remediation:** Added `/tool-approvals` page (admin-only) for reviewing pending high-risk scan requests.

### LOW-005: No Node Health Dashboard
**Severity:** LOW  
**Remediation:** Added `/node-health` page showing registered Parrot OS node agents.

---

## Findings by Severity Summary

| Severity | Count | Remediated |
|----------|-------|------------|
| CRITICAL | 3     | 3 ✅       |
| HIGH     | 4     | 4 ✅       |
| MEDIUM   | 4     | 4 ✅       |
| LOW      | 5     | 5 ✅       |
| **Total**| **16**| **16 ✅**  |
