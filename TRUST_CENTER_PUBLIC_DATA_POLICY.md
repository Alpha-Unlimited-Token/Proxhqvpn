# ProxhqVPN Trust Center — Public Data Policy

**Date:** 2026-06-13
**Operator:** Alpha Unlimited Technologies LLC

---

## Purpose

This document defines what data the ProxhqVPN Trust Center is permitted to expose publicly, and what data must never be exposed. It serves as the authoritative reference for trust center developers and auditors.

---

## Permitted Public Data

The Trust Center may expose the following categories of information:

### Security Status
- Aggregate trust score (number, 0–100)
- Overall status label: `trusted`, `monitoring`, `incident`, or `initializing`
- Last validation timestamp (ISO-8601, no granular details)
- Aggregate uptime percentages (30/90/365 days)

### Validation Summary
- Total number of checks performed
- Aggregate pass/fail/warning counts
- Check type categories (e.g., `uptime`, `tls`, `wg`) — no details
- Last validation run timestamp

### System Status
- Component operational status: `operational`, `degraded`, `outage`, `maintenance`
- Component names (human-readable, no internal hostnames)
- Component uptime percentages
- Active incident titles and severity labels (no technical details)

### Compliance
- Compliance framework names (SOC 2, GDPR, ISO 27001, etc.)
- Status: `active`, `in_progress`, or `planned`
- No audit reports or assessment details

### Published Documents
- Document title, type, and summary (human-readable)
- Published date
- Public download URL if explicitly approved by admin

### Security Program Summary
- Plain-English description of security practices
- Security pillar names and brief descriptions

---

## Prohibited Public Data

The Trust Center must **never** expose:

### Infrastructure Secrets
- Private keys of any kind (WireGuard, TLS, API keys, tokens)
- Session cookies or bearer tokens
- Database credentials or connection strings
- Environment variable values

### Network Topology
- Internal IP addresses (RFC-1918: 10.x, 172.16–31.x, 192.168.x)
- Internal IPv6 ranges (fc00::/7)
- VPN node hostnames, endpoints, or identifiers
- WireGuard peer configurations (PrivateKey, PublicKey, AllowedIPs, Endpoint)
- Firewall rules or iptables configurations
- Network architecture diagrams with internal addressing

### Vulnerability Details
- Raw vulnerability reports or findings
- CVE references for unpatched vulnerabilities
- Exploit code or proof-of-concept
- Affected host lists
- Penetration test raw output

### User Data
- User accounts, email addresses, or identifiers
- VPN session logs or connection records
- Usage statistics attributable to individuals
- Payment or billing information

### Operational Details
- Server inventory (hardware specs, OS versions, provider)
- Internal service names or deployment configuration
- Cron schedules or job names
- Internal monitoring thresholds or alert rules

---

## Enforcement

### Code Controls
- `publicTrustCenterService.ts` enforces approved field lists at the service layer
- No internal imports leak into public service responses
- All DB queries use safe fallbacks; errors return defaults, not stack traces

### Audit Controls
- `scripts/src/audit-public-trust-center.ts` scans all public routes for prohibited patterns
- CI should run `pnpm --filter @workspace/scripts run audit:trust-center` before every deploy
- Admin document publish endpoint requires `admin.write` capability + audit logging

### Admin Controls
- Document publishing gated behind `requireAdmin` middleware
- All publishes recorded in SHA3-256 audit chain with actor, action, and document metadata
- Admin cannot publish documents containing prohibited data (validation is caller's responsibility)

---

## Change Control

Any change to permitted or prohibited data categories requires:
1. Review by a security-admin role holder
2. Update to this policy document
3. Re-run of the audit script
4. Re-review of all public Trust Center endpoints
