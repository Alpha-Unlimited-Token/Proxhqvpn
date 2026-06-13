# Configuration Audit Report
**Generated:** 2026-06-13  
**Scope:** Full ProxhqVPN monorepo

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

> `api.proxhqvpn.com` is reserved for a future dedicated API subdomain.  
> Current deployment uses path-based routing (`/api`) through the Replit proxy.

---

## URLs Found and Resolved

| File | Original URL / Pattern | Status |
|---|---|---|
| `routes/canary.ts` | `"proxhqvpn.com"` (×2 domain fallbacks) | ✅ → `platformConfig.APP_URL` |
| `routes/canary.ts` | `https://proxhqvpn.com/silkweb` (email HTML) | ✅ → `${platformConfig.APP_URL}/silkweb` |
| `routes/canary.ts` | `res.redirect(302,"https://proxhqvpn.com")` | ✅ → `platformConfig.APP_URL` |
| `routes/canary.ts` | `"https://proxhqvpn.com"` (warrant canary statement) | ✅ → `platformConfig.APP_URL` |
| `routes/meshnet.ts` | `` `https://proxhqvpn.com/meshnet/join/${code}` `` | ✅ → `${platformConfig.APP_URL}/meshnet/join/${code}` |
| `routes/ambassadors.ts` | `href="https://proxhqvpn.com/employees"` | ✅ → `platformConfig.APP_URL` |
| `routes/ambassadors.ts` | `Review at: https://proxhqvpn.com/employees` (text) | ✅ → `platformConfig.APP_URL` |
| `routes/ambassadors.ts` | `proxhqvpn.com?ref=` (referral link) | ✅ → `platformConfig.APP_URL` stripped |
| `routes/ambassadors.ts` | `href="https://proxhqvpn.com/ambassador/dashboard"` | ✅ → `platformConfig.APP_URL` |
| `routes/ambassadors.ts` | `Dashboard: https://proxhqvpn.com/ambassador/dashboard` (text) | ✅ → `platformConfig.APP_URL` |
| `routes/killswitch.ts` | `Documentation=https://proxhqvpn.com` (systemd) | ✅ → `platformConfig.APP_URL` |
| `routes/stripe.ts` | `process.env.APP_URL \|\| "https://proxhqvpn.com"` | ✅ → `platformConfig.APP_URL` |
| `routes/social-account.ts` | `process.env.APP_URL \|\| "https://proxhqvpn.com"` | ✅ → `platformConfig.APP_URL` |
| `components/layout/routeGuards.tsx` | `PublicLayout` always used `<Layout>` (sidebar visible to guests) | ✅ → auth-aware: guests get `<PublicPageLayout>`, signed-in get `<Layout>` |

---

## Remaining Legitimate Placeholders (No Action Required)

| Pattern | Count | Location(s) | Reason |
|---|---|---|---|
| `example.com` in `placeholder=` attrs | 15+ | `toolrunner.ts`, UI pages | Form hint text per IANA RFC 2606 |
| `example.com` in error messages | 3 | `apitester.ts`, `node-cracker.ts` | Developer guidance strings |
| `example.com` in test files | 20+ | `__tests__/*.ts` | Standard unit test fixture domain |
| `http://127.0.0.1:*` / `localhost` | 8 | `daemon.ts`, `monero.ts`, proxy docs | Local process sockets — correct |
| SSRF/bypass test payloads | 10+ | `omnistrike.ts`, `pentest-suite.ts` | Security simulation — must stay |
| DNS blocklist seed data | 6 | `dnsshield.ts`, `firewall-*.ts` | Fake malicious domains for UI |
| `proxhqvpn.com` in `Downloads.tsx` | ~40 | README text template strings | User-facing install docs — correct |
| `api.proxhqvpn.com` in `Manuals.tsx` | 2 | curl command examples | Showing users the real endpoint |
| `proxhqvpn.com` in `AmbassadorHandbook.tsx` | 8+ | Handbook display text | Content, not routing code |
| Third-party service URLs | many | `BugBountyHub.tsx`, `SocialBreach.tsx`, `LlmProbe.tsx` | External APIs; not ProxhqVPN |

---

## Environment Variables

### Backend (`artifacts/api-server/src/config/platform.ts`)

```ts
export const platformConfig = {
  APP_URL:      process.env.APP_URL      || "https://proxhqvpn.com",
  API_URL:      process.env.API_URL      || "https://proxhqvpn.com/api",
  SECURITY_URL: process.env.SECURITY_URL || "https://security.proxhqvpn.com",
  STATUS_URL:   process.env.STATUS_URL   || "https://status.proxhqvpn.com",
  DOWNLOAD_URL: process.env.DOWNLOAD_URL || "https://downloads.proxhqvpn.com",
  DOCS_URL:     process.env.DOCS_URL     || "https://docs.proxhqvpn.com",
};
```

### Frontend (`artifacts/ghost-vpn/src/config/runtime.ts`)

```ts
export const config = {
  APP_URL:      import.meta.env.VITE_APP_URL      || "https://proxhqvpn.com",
  API_URL:      import.meta.env.VITE_API_URL      || "https://proxhqvpn.com/api",
  SECURITY_URL: import.meta.env.VITE_SECURITY_URL || "https://security.proxhqvpn.com",
  STATUS_URL:   import.meta.env.VITE_STATUS_URL   || "https://status.proxhqvpn.com",
  DOWNLOAD_URL: import.meta.env.VITE_DOWNLOAD_URL || "https://downloads.proxhqvpn.com",
  DOCS_URL:     import.meta.env.VITE_DOCS_URL     || "https://docs.proxhqvpn.com",
  SITE_URL:     import.meta.env.VITE_SITE_URL     || "https://proxhqvpn.com",
};
```

### Recommended `.env` entries for production

```bash
# Backend
APP_URL=https://proxhqvpn.com
API_URL=https://proxhqvpn.com/api
SECURITY_URL=https://security.proxhqvpn.com
STATUS_URL=https://status.proxhqvpn.com
DOWNLOAD_URL=https://downloads.proxhqvpn.com
DOCS_URL=https://docs.proxhqvpn.com

# Frontend (Vite)
VITE_APP_URL=https://proxhqvpn.com
VITE_API_URL=https://proxhqvpn.com/api
VITE_SECURITY_URL=https://security.proxhqvpn.com
VITE_STATUS_URL=https://status.proxhqvpn.com
VITE_DOWNLOAD_URL=https://downloads.proxhqvpn.com
VITE_DOCS_URL=https://docs.proxhqvpn.com
VITE_SITE_URL=https://proxhqvpn.com
```

---

## Configuration Files

| File | Status | Description |
|---|---|---|
| `artifacts/ghost-vpn/src/config/runtime.ts` | ✅ Exists | Frontend centralized URL config |
| `artifacts/api-server/src/config/platform.ts` | ✅ Exists | Backend centralized URL config |
| `artifacts/ghost-vpn/src/components/layout/PublicPageLayout.tsx` | ✅ Created | Marketing layout (no sidebar) for public pages |

---

## Typecheck Results

| Artifact | Result |
|---|---|
| `@workspace/api-server` | ✅ Clean — 0 errors |
| `@workspace/ghost-vpn` | ✅ Vite HMR compiled all changed files without errors |

---

## Recommended Next Steps

1. **Set env vars in production** — add the 7 backend + 7 frontend variables above to your deployment environment. All code will then use those values; changing a domain requires editing only one place.
2. **Wire `config.API_URL` in frontend fetches** — low priority (relative `/api/…` paths work correctly with the Replit proxy), but absolute config-driven URLs are more portable for multi-region or CDN deployments.
3. **Apply pending DB migrations** — `platform_events`, `scheduled_tasks`, and `node_maintenance_windows` tables are missing in the dev DB (pre-existing, unrelated to URL changes). Run `pnpm --filter @workspace/db run push` to apply.

---

*© 2026 ALPHA UNLIMITED TECHNOLOGIES LLC*
