# Domain Replacement Report

**Generated:** 2026-06-13  
**Scope:** Full ProxhqVPN monorepo  
**Primary domain:** `https://proxhqvpn.com`

---

## Summary

| Category | Count |
|----------|-------|
| Real issues fixed | 8 |
| Legitimate uses kept | 47+ |
| New config files created | 2 |
| .env example files updated | 3 |

---

## Fixed: Placeholder / Wrong Domain Occurrences

| File | Line | Original Value | Replacement | Reason |
|------|------|----------------|-------------|--------|
| `artifacts/api-server/src/routes/killswitch.ts` | 385 | `https://proxhqvpn.example.com` | `https://proxhqvpn.com` | Typo — `.example` suffix on ProxhqVPN domain in generated systemd unit file |
| `artifacts/api-server/src/routes/stripe.ts` | 19 | `"http://localhost:3000"` | `process.env.APP_URL \|\| "https://proxhqvpn.com"` | Final fallback for HOST() used in Stripe success/cancel URLs |
| `artifacts/api-server/src/routes/social-account.ts` | 594 | `"https://example.com"` | `process.env.APP_URL \|\| "https://proxhqvpn.com"` | Fallback homeUrl when platform has no registered home + no loginUrl |
| `artifacts/ghost-vpn/src/lib/exploitReport.ts` | 496 | `https://app.yourdomain.com`, `https://yourdomain.com` | `https://app.proxhqvpn.com`, `https://proxhqvpn.com` | Customer-facing CORS remediation code snippet shown in security report output |
| `artifacts/ghost-vpn/src/lib/exploitReport.ts` | 843 | `https://app.yourdomain.com`, `https://yourdomain.com` | `https://app.proxhqvpn.com`, `https://proxhqvpn.com` | Customer-facing open-redirect remediation code snippet shown in security report output |
| `artifacts/api-server/.env.security-api.example` | 8 | `https://security-console.your-internal-domain.com` | `https://security.proxhqvpn.com` | CORS allowed-origins for isolated security API deployment |
| `artifacts/security-console/.env.example` | 2 | `https://security-api.your-internal-domain.com` | `https://security.proxhqvpn.com` | Security console → security API base URL |
| `artifacts/security-console/.env.example` | 3 | `https://prox.example.com` | `https://proxhqvpn.com` | Customer app origin for cross-frame checks |
| `.env.example` | 6 | `https://your-domain.com` | `https://proxhqvpn.com` | Root template ALLOWED_ORIGINS value |

---

## Kept As-Is: Legitimate `example.com` / `localhost` / `127.0.0.1` Uses

These were reviewed and confirmed correct — changing them would break functionality or distort meaning:

### UI Form Placeholders (input hint text, not real values)
- `artifacts/api-server/src/routes/toolrunner.ts` — 15 occurrences of `example.com` / `https://example.com` as `placeholder:` strings in tool parameter definitions shown to users in the security tool UI
- `artifacts/ghost-vpn/src/pages/omega/remote-commands.tsx` — `placeholder: "https://example.com"` in Open URL command form
- `artifacts/ghost-vpn/src/pages/DnsShield.tsx` — `placeholder="example.com"` in custom domain input
- `artifacts/ghost-vpn/src/pages/AmbassadorApply.tsx` — `placeholder="https://example.com/your-photo.jpg"` in photo URL field

### Documentation / Code Example Text
- `artifacts/ghost-vpn/src/pages/ProxyConfig.tsx` — `wget -e "use_proxy = yes" ... https://example.com` in shell command documentation (teaching proxied wget)
- `artifacts/api-server/src/routes/apitester.ts` — `"baseUrl required (e.g. https://api.example.com)"` in error message
- `artifacts/api-server/src/routes/node-cracker.ts` — `"endpoint is required (e.g. https://my-node.example.com:8545)"` in error message

### Security Test Payloads / Attack Simulation Data
- `artifacts/api-server/src/middlewares/targetAllowlist.ts` — comment explaining URL parsing security logic using `example.com` as illustration
- `artifacts/api-server/src/routes/omnistrike.ts` — `http://localhost/admin`, `http://127.0.0.1/`, `http://0.0.0.0/` etc. as SSRF/bypass test payloads
- `artifacts/api-server/src/routes/wafbypass.ts` — `http://127.0.0.1/admin` as WAF bypass test payload
- `artifacts/api-server/src/lib/dev-audit/pentest-suite.ts` — `http://127.0.0.1:8545/`, `http://127.0.0.1:8080/`, `http://127.0.0.1/` as local RPC probe targets in pentest suite
- `artifacts/api-server/src/routes/leaks.ts` — `http://127.0.0.1:22/` as SSRF probe in leak detection
- `artifacts/api-server/src/routes/ai-security.ts` — `http://localhost:8080/admin` as AI SSRF attack simulation payload

### Fake/Seed Data for Firewall / DNS / Blocklists
- `artifacts/api-server/src/routes/dnsshield.ts` — `"tracker.malicious.example"`, `"botnet-c2.example.com"` as seed blocklist entries
- `artifacts/api-server/src/routes/firewall-advanced.ts` — `"malware-c2.example.com"` as seed firewall rule
- `artifacts/api-server/src/routes/firewall-next.ts` — `"malware.example.com"`, `"cdn.example.com"`, `"example.com"` as SNI/flow log sample data
- `artifacts/api-server/src/routes/firewall-military.ts` — `"malware.example.com"` as seed DNS sinkhole entry

### Internal Service / Daemon Addresses (correct by design)
- `artifacts/api-server/src/routes/daemon.ts` — `http://127.0.0.1:7475` (local ProxhqVPN daemon socket)
- `artifacts/api-server/src/lib/blockchain-connectors/monero.ts` — `http://127.0.0.1:18081` (local Monero RPC node)
- `artifacts/mockup-sandbox/mockupPreviewPlugin.ts` — `http://127.0.0.1` for request URL parsing (Vite plugin internal)

### Test Files (standard practice)
- `artifacts/api-server/src/__tests__/toolrunner.test.ts` — 6 uses of `example.com` as test input domain
- `artifacts/api-server/src/__tests__/targetscope.test.ts` — 14 uses of `example.com` / `api.example.com` testing URL scope matching logic

---

## New Configuration Files Created

### `artifacts/ghost-vpn/src/config/runtime.ts` (Frontend)
Centralized frontend URL config sourced from `VITE_*` environment variables with `proxhqvpn.com` production defaults:
- `config.APP_URL` — `VITE_APP_URL` / `https://proxhqvpn.com`
- `config.API_URL` — `VITE_API_URL` / `https://proxhqvpn.com/api`
- `config.SECURITY_URL` — `VITE_SECURITY_URL` / `https://security.proxhqvpn.com`
- `config.STATUS_URL` — `VITE_STATUS_URL` / `https://status.proxhqvpn.com`
- `config.DOWNLOAD_URL` — `VITE_DOWNLOAD_URL` / `https://downloads.proxhqvpn.com`
- `config.DOCS_URL` — `VITE_DOCS_URL` / `https://docs.proxhqvpn.com`
- `config.SITE_URL` — `VITE_SITE_URL` / `https://proxhqvpn.com`

### `artifacts/api-server/src/config/platform.ts` (Backend)
Centralized backend URL config sourced from environment variables with `proxhqvpn.com` production defaults:
- `platformConfig.APP_URL` — `APP_URL` / `https://proxhqvpn.com`
- `platformConfig.API_URL` — `API_URL` / `https://proxhqvpn.com/api`
- `platformConfig.SECURITY_URL` — `SECURITY_URL` / `https://security.proxhqvpn.com`
- `platformConfig.STATUS_URL` — `STATUS_URL` / `https://status.proxhqvpn.com`
- `platformConfig.DOWNLOAD_URL` — `DOWNLOAD_URL` / `https://downloads.proxhqvpn.com`
- `platformConfig.DOCS_URL` — `DOCS_URL` / `https://docs.proxhqvpn.com`

---

## Intentionally Hardcoded `proxhqvpn.com` References (Pre-Existing, Correct)

These existing references use the real production domain and are correct. They do not need to move to config:

- `artifacts/api-server/src/routes/canary.ts` — redirect and HTML link to `https://proxhqvpn.com` (canary token redirect target)
- `artifacts/api-server/src/routes/ambassadors.ts` — email body links to ambassador dashboard / review page
- `artifacts/api-server/src/routes/meshnet.ts` — meshnet join invite link
- `artifacts/ghost-vpn/src/components/PageSEO.tsx` — `SITE_URL` defaulting to `https://proxhqvpn.com` (now superseded by `config.SITE_URL`)
- `artifacts/ghost-vpn/src/pages/Downloads.tsx` — embedded README / manual text content (user-readable docs, not routing code)
- `artifacts/ghost-vpn/public/downloads/*.sh` / `*.ps1` — installer scripts pointing to `https://proxhqvpn.com`
