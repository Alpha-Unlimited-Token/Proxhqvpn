# Domain Replacement Report
**Generated:** 2026-06-13  
**Scope:** Full ProxhqVPN monorepo  
**Primary domain:** `https://proxhqvpn.com`  
**Centralized config files:**  
- Frontend → `artifacts/ghost-vpn/src/config/runtime.ts`  
- Backend → `artifacts/api-server/src/config/platform.ts`

---

## Summary

| Category | Count |
|---|---|
| Files modified (this session) | 8 source files + 1 new file |
| Hardcoded URLs replaced (this session) | 14 backend · 1 layout fix |
| Config references introduced | 14 |
| New component created | `PublicPageLayout.tsx` |
| Legitimate placeholder domains left unchanged | 40+ (see §4) |

---

## §1 — Backend replacements — `artifacts/api-server/src/`

All 6 files received `import { platformConfig } from "../config/platform"` and had every direct `"https://proxhqvpn.com"` / `"proxhqvpn.com"` reference replaced with the corresponding `platformConfig.*` property.

### `routes/canary.ts` (5 replacements)

| Location | Original | Replacement |
|---|---|---|
| `buildTokenPayload` domain fallback | `"proxhqvpn.com"` | `platformConfig.APP_URL.replace(/^https?:\/\//,"")` |
| Canary alert email HTML | `href="https://proxhqvpn.com/silkweb"` | `href="${platformConfig.APP_URL}/silkweb"` |
| Token creation domain fallback | `process.env.REPLIT_DEV_DOMAIN \|\| "proxhqvpn.com"` | `process.env.REPLIT_DEV_DOMAIN \|\| platformConfig.APP_URL.replace(…)` |
| Canary redirect target | `res.redirect(302,"https://proxhqvpn.com")` | `res.redirect(302, platformConfig.APP_URL)` |
| Warrant canary statement | `"https://proxhqvpn.com"` (array entry) | `platformConfig.APP_URL` |

### `routes/meshnet.ts` (1 replacement)

| Location | Original | Replacement |
|---|---|---|
| Invite link generation | `` `https://proxhqvpn.com/meshnet/join/${code}` `` | `` `${platformConfig.APP_URL}/meshnet/join/${code}` `` |

### `routes/ambassadors.ts` (5 replacements)

| Location | Original | Replacement |
|---|---|---|
| New-application email HTML CTA | `href="https://proxhqvpn.com/employees"` | `href="${platformConfig.APP_URL}/employees"` |
| New-application email plain text | `Review at: https://proxhqvpn.com/employees` | `Review at: ${platformConfig.APP_URL}/employees` |
| Approval email referral link | `proxhqvpn.com?ref=${promo}` | `${platformConfig.APP_URL.replace(/^https?:\/\//,"")}?ref=${promo}` |
| Approval email dashboard CTA | `href="https://proxhqvpn.com/ambassador/dashboard"` | `href="${platformConfig.APP_URL}/ambassador/dashboard"` |
| Approval email plain text | `Dashboard: https://proxhqvpn.com/ambassador/dashboard` | `Dashboard: ${platformConfig.APP_URL}/ambassador/dashboard` |

### `routes/killswitch.ts` (1 replacement)

| Location | Original | Replacement |
|---|---|---|
| Generated systemd unit file | `Documentation=https://proxhqvpn.com` | `Documentation=${platformConfig.APP_URL}` |

### `routes/stripe.ts` (1 replacement)

| Location | Original | Replacement |
|---|---|---|
| `HOST()` fallback | `process.env.APP_URL \|\| "https://proxhqvpn.com"` | `platformConfig.APP_URL` |

### `routes/social-account.ts` (1 replacement)

| Location | Original | Replacement |
|---|---|---|
| `homeUrl` fallback | `process.env.APP_URL \|\| "https://proxhqvpn.com"` | `platformConfig.APP_URL` |

---

## §2 — Frontend: sidebar bug fix + `PublicPageLayout`

**Problem:** `PublicLayout` in `routeGuards.tsx` passed all public routes (`/pricing`, `/downloads`, `/guide`, `/ambassadors`, `/handbook/ambassador`) through the full authenticated `<Layout>` component, which always renders the 56 px sidebar on large screens. Unauthenticated visitors to `/pricing` saw the dashboard app shell.

**Fix:** `PublicLayout` now reads Clerk auth state:

```tsx
export function PublicLayout({ children }) {
  const { isSignedIn, isLoaded } = useUser();
  if (!isLoaded) return <spinner />;
  if (isSignedIn) return <Layout>{children}</Layout>;      // app shell with sidebar
  return <PublicPageLayout>{children}</PublicPageLayout>;  // clean marketing layout
}
```

**New file:** `artifacts/ghost-vpn/src/components/layout/PublicPageLayout.tsx`  
A sticky-header marketing layout matching the home page aesthetic:
- ProxhqVPN logo (left)
- Nav links: Pricing · Downloads · Ambassadors · Guide
- Sign In + Get Started CTA buttons (right)
- Mobile hamburger menu
- No sidebar
- Active route highlight
- Copyright footer

Signed-in users visiting `/pricing` still see the full app shell (correct — they're managing their subscription in-context). Unauthenticated visitors see the clean marketing layout (correct — conversion-optimized).

---

## §3 — Previously fixed (prior session)

| File | Original | Replacement |
|---|---|---|
| `routes/killswitch.ts` | `Documentation=https://proxhqvpn.example.com` | `https://proxhqvpn.com` (later → `platformConfig.APP_URL`) |
| `routes/stripe.ts` | `"http://localhost:3000"` | `process.env.APP_URL \|\| "https://proxhqvpn.com"` (later → `platformConfig.APP_URL`) |
| `routes/social-account.ts` | `"https://example.com"` (homeUrl fallback) | `process.env.APP_URL \|\| "https://proxhqvpn.com"` (later → `platformConfig.APP_URL`) |
| `lib/exploitReport.ts` ×2 | `https://app.yourdomain.com`, `https://yourdomain.com` | `https://app.proxhqvpn.com`, `https://proxhqvpn.com` |
| `.env.example` | `ALLOWED_ORIGINS=https://your-domain.com` | `https://proxhqvpn.com` |

---

## §4 — Intentionally unchanged occurrences

The following patterns are **correct as-is** and must not be replaced:

| Pattern | Location(s) | Rationale |
|---|---|---|
| `example.com` in `placeholder=` attrs | `toolrunner.ts` (15×), UI pages | HTML form hint text — teaches users what format to type; changing would mislead |
| `example.com` in error message strings | `apitester.ts`, `node-cracker.ts` | Developer-facing error guidance, not routing |
| `example.com` / `api.example.com` in test files | `__tests__/*.ts` | RFC 2606 reserved domain; standard unit-test fixture practice |
| `http://127.0.0.1:*`, `http://localhost/*` | `daemon.ts`, `monero.ts`, pentest tools | Local process sockets — intentionally point at localhost |
| SSRF/bypass payloads | `omnistrike.ts`, `wafbypass.ts`, `pentest-suite.ts` | Security test payloads using localhost — must remain |
| DNS blocklist seeds | `dnsshield.ts`, `firewall-*.ts` | `botnet-c2.example.com`, `malware.example.com` as fake malicious seed data |
| `Downloads.tsx` README text | ~40 `proxhqvpn.com` occurrences in `.txt` content strings | User-downloadable README files — these ARE the correct production URLs, not misuse |
| `AmbassadorHandbook.tsx` | `proxhqvpn.com/api/warrant-canary`, promo code examples | Handbook display content, not routing code |
| `Manuals.tsx` curl examples | `curl -s https://api.proxhqvpn.com/api/healthz` | Documentation showing real endpoints to users — intentional |
| Third-party URLs | `app.intigriti.com`, `api.openai.com`, `api.stripe.com`, `api.dicebear.com` | External service URLs; not ProxhqVPN domains |
| Security payload library | `exploitPayloads.ts` — `api.stripe.com`, `api.TARGET.com` | Attack simulation templates — `TARGET.com` is a variable placeholder, not production |
| Pentest tool placeholders | `SqliScanner`, `GhostPentest`, `GhostChain`, `Intruder`, `AlphaTools` | Security tool target examples — `example.com` is the IANA-standard example domain |

---

## §5 — Centralized configuration architecture

### Frontend — `artifacts/ghost-vpn/src/config/runtime.ts`

```ts
import { config } from "@/config/runtime";
// config.APP_URL, config.API_URL, config.SECURITY_URL, config.DOCS_URL, …
```

### Backend — `artifacts/api-server/src/config/platform.ts`

```ts
import { platformConfig } from "../config/platform";
// platformConfig.APP_URL, platformConfig.API_URL, platformConfig.SECURITY_URL, …
```

### Environment variables

| Backend var | Frontend var | Default | Purpose |
|---|---|---|---|
| `APP_URL` | `VITE_APP_URL` | `https://proxhqvpn.com` | Primary domain |
| `API_URL` | `VITE_API_URL` | `https://proxhqvpn.com/api` | API base URL |
| `SECURITY_URL` | `VITE_SECURITY_URL` | `https://security.proxhqvpn.com` | Security console |
| `STATUS_URL` | `VITE_STATUS_URL` | `https://status.proxhqvpn.com` | Status page |
| `DOWNLOAD_URL` | `VITE_DOWNLOAD_URL` | `https://downloads.proxhqvpn.com` | Downloads |
| `DOCS_URL` | `VITE_DOCS_URL` | `https://docs.proxhqvpn.com` | Documentation |
| `SITE_URL` | `VITE_SITE_URL` | `https://proxhqvpn.com` | SEO canonical URL |

---

*© 2026 ALPHA UNLIMITED TECHNOLOGIES LLC*
