# ProxhqVPN Security Testing Scope

**Version:** 1.0.0 | **Classification:** Internal — Security Team

## In Scope (ProxhqVPN-Owned Systems Only)

| System | Type | Security Scans | Load Tests |
|--------|------|---------------|-----------|
| proxhqvpn.com | Web/Marketing | Requires explicit enable | No |
| proxhqvpn.com/api | REST API | Requires explicit enable | No |
| status.proxhqvpn.com | Status page | Headers/TLS only | No |
| WireGuard nodes (owned) | VPN infrastructure | Health checks only | No |
| Local repository | SAST/dependency | Yes (semgrep, pnpm audit) | N/A |

## Strictly Out of Scope

- Third-party IPs or domains (NordVPN, ExpressVPN, Mullvad, etc.)
- Customer/user IPs or systems
- Attacker IPs captured in firewall/honeypot logs — **these are NEVER scanned back**
- Any IP that does not appear in `validation_targets.owned_by = 'alpha-unlimited-technologies'`
- Any target where `allow_security_scans = FALSE`

## Safety Controls

1. **Allowlist enforcement** — `assertTargetAllowed()` in `validationTargetService.ts` rejects unknown targets at runtime
2. **No auto-attack** — daemon-inbound NEVER triggers offensive scans based on attacker input
3. **Rate limiting** — manual run trigger uses `criticalRateLimit` (strictest tier)
4. **Admin only** — all validation write routes require `admin.write` Clerk capability
5. **Audit logging** — every manual run is logged to the audit chain
6. **Output sanitization** — `validationSanitizerService.ts` redacts secrets before DB storage

## Engagement Rules

- All security scans are **passive or controlled** — no exploit execution
- ZAP runs in quick-scan mode with no authenticated crawl by default
- k6 uses conservative settings: 3 VUs, 30s duration, <5% error threshold
- No scan runs without a queued `validation_run` record in the DB

© 2026 Alpha Unlimited Technologies LLC
