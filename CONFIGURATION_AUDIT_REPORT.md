# Configuration Audit Report

**Generated:** 2026-06-13  
**Scope:** Full ProxhqVPN monorepo

---

## URLs Found

| URL / Pattern | Files | Status |
|---------------|-------|--------|
| `https://proxhqvpn.example.com` | `killswitch.ts` | Fixed → `https://proxhqvpn.com` |
| `http://localhost:3000` | `stripe.ts` | Fixed → `APP_URL \|\| "https://proxhqvpn.com"` |
| `https://example.com` (fallback) | `social-account.ts` | Fixed → `APP_URL \|\| "https://proxhqvpn.com"` |
| `https://app.yourdomain.com` | `exploitReport.ts` ×2 | Fixed → `https://app.proxhqvpn.com` |
| `https://yourdomain.com` | `exploitReport.ts` ×2 | Fixed → `https://proxhqvpn.com` |
| `https://security-console.your-internal-domain.com` | `.env.security-api.example` | Fixed → `https://security.proxhqvpn.com` |
| `https://security-api.your-internal-domain.com` | `security-console/.env.example` | Fixed → `https://security.proxhqvpn.com` |
| `https://prox.example.com` | `security-console/.env.example` | Fixed → `https://proxhqvpn.com` |
| `https://your-domain.com` | `.env.example` | Fixed → `https://proxhqvpn.com` |

---

## URLs Replaced

9 placeholder/wrong-domain values replaced across 6 source files and 3 environment template files.

---

## Remaining Placeholders (Legitimate — No Action Required)

| Pattern | Location | Reason Kept |
|---------|----------|-------------|
| `example.com` in `placeholder=` attrs | `toolrunner.ts`, UI components | HTML input hint text, not routing |
| `example.com` in test files | `__tests__/*.ts` | Standard test domain per RFC 2606 |
| `http://127.0.0.1:*` | `daemon.ts`, `monero.ts` | Local process sockets, correct by design |
| `http://localhost/admin` etc. | `omnistrike.ts`, `pentest-suite.ts` | SSRF/bypass attack test payloads |
| `example.com` in blocklist seeds | `firewall-*.ts`, `dnsshield.ts` | Fake malware domain data, RFC 2606 |
| `http://127.0.0.1` | `mockupPreviewPlugin.ts` | Vite request URL parsing internal |

---

## Environment Variables Created

### Backend (`artifacts/api-server/src/config/platform.ts`)

| Variable | Default | Purpose |
|----------|---------|---------|
| `APP_URL` | `https://proxhqvpn.com` | Primary application URL |
| `API_URL` | `https://proxhqvpn.com/api` | Backend API base URL |
| `SECURITY_URL` | `https://security.proxhqvpn.com` | Isolated security console URL |
| `STATUS_URL` | `https://status.proxhqvpn.com` | Public status page URL |
| `DOWNLOAD_URL` | `https://downloads.proxhqvpn.com` | Platform downloads URL |
| `DOCS_URL` | `https://docs.proxhqvpn.com` | Documentation URL |

### Frontend (`artifacts/ghost-vpn/src/config/runtime.ts`)

| Variable | Default | Purpose |
|----------|---------|---------|
| `VITE_APP_URL` | `https://proxhqvpn.com` | Primary application URL |
| `VITE_API_URL` | `https://proxhqvpn.com/api` | Backend API base URL |
| `VITE_SECURITY_URL` | `https://security.proxhqvpn.com` | Security console URL |
| `VITE_STATUS_URL` | `https://status.proxhqvpn.com` | Public status page URL |
| `VITE_DOWNLOAD_URL` | `https://downloads.proxhqvpn.com` | Downloads URL |
| `VITE_DOCS_URL` | `https://docs.proxhqvpn.com` | Documentation URL |
| `VITE_SITE_URL` | `https://proxhqvpn.com` | Canonical site URL for SEO meta |

---

## Configuration Files Added / Updated

| File | Action | Description |
|------|--------|-------------|
| `artifacts/ghost-vpn/src/config/runtime.ts` | **Created** | Frontend centralized URL config |
| `artifacts/api-server/src/config/platform.ts` | **Created** | Backend centralized URL config |
| `.env.example` | **Updated** | Fixed `ALLOWED_ORIGINS`, added 6 platform URL vars |
| `artifacts/api-server/.env.security-api.example` | **Updated** | Fixed `SECURITY_API_ALLOWED_ORIGINS`, added platform URL vars |
| `artifacts/security-console/.env.example` | **Updated** | Fixed all 3 placeholder URLs, added platform URL vars |

---

## Production Domain Architecture

```
https://proxhqvpn.com               ← Primary app / marketing / dashboard
https://proxhqvpn.com/api           ← Backend API (path-routed, same domain)
https://security.proxhqvpn.com      ← Isolated security console
https://status.proxhqvpn.com        ← Public uptime status page
https://downloads.proxhqvpn.com     ← Platform installers and binaries
https://docs.proxhqvpn.com          ← Documentation
```

> Note: `api.proxhqvpn.com` is reserved for future dedicated API subdomain use.
> Current deployment uses path-based routing (`/api` on the primary domain) to match
> the existing Replit proxy configuration.

---

## Typecheck Results After Changes

| Artifact | Result |
|----------|--------|
| `@workspace/api-server` | ✅ 0 new errors (4 pre-existing unchanged) |
| `@workspace/ghost-vpn` | ✅ 0 new errors (2 pre-existing unchanged) |

---

## Recommended Next Steps

1. **Set `APP_URL` in production** — add `APP_URL=https://proxhqvpn.com` to the deployment environment so the Stripe success/cancel URL fallback always uses the config-driven value rather than the inline default.
2. **Migrate `canary.ts` / `ambassadors.ts` email bodies** to `platformConfig.APP_URL` (currently hardcoded `proxhqvpn.com` — correct domain but not config-driven).
3. **Wire `config.API_URL`** in frontend fetch calls that currently use relative `/api/…` paths — low priority since relative paths work correctly with the Replit proxy, but config-driven absolute URLs are safer for multi-region deployments.
