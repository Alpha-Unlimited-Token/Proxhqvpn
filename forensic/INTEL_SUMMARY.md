# BRD Market / Gateway Ventures — Forensic Intel Summary
**Target**: `brdmarket.com` (lure surfaced 2026-05-27 via TikTok DM)
**Operator alias seen**: "BigTrap"
**Scam family**: Pig-butchering / fake-brokerage / fake-investment-mentor

## Confirmed infrastructure
| Field | Value | Source |
|---|---|---|
| Apex IP | 185.27.133.17 | DOH A |
| Hosting | iFastNet (ns1082/ns2082.ifastnet.com) shared reseller | DOH NS |
| Shell user | `getwayve` | Leaked Laravel stack `/home/getwayve/brdmarket.com/` |
| Tech stack | Laravel + Livewire + Turbo + Ignition + OpenResty | Stack trace + cookies |
| TLS cert | Let's Encrypt R12 valid 2026-05-12 → 2026-08-10 | openssl s_client |
| Admin email | admin@brdmarket.com | /contact |
| Phone | "1234567890" placeholder (FAKE) | /contact |
| Claimed address | "Suite ... Katherine Street, Sandton" (Johannesburg, ZA) | /contact |
| Claimed entity | "Brdmarket LIMITED, operating in the UK" | /about meta |
| UK Companies House | **NOT REGISTERED** under either name | search/companies query |

## Sister-domain network (via cert SAN + reverse DNS)
- `getwayventures.com` — parent infra, "Gateway Ventures" branding, same IP
- `i.getwayventures.com` — secondary front
- `test.getwayventures.com` — dev environment (operational opsec failure)
- `mgrr.org.uk` — UK shell (NXDOMAIN, torn down or never lived)
- `mgrr.org.uk.getwayventures.com` — historic SAN entry
- `onlintrade.com` — leaked in `/wallet` Laravel stack trace; NXDOMAIN (prior scam, burned)

## Smoking guns
1. **3-5% DAILY profit "guarantee"** in meta description = mathematically impossible (21-35%/week, ~5,400× per year)
2. **`generateRandomCountry()`** JavaScript on /contact dynamically FAKES visitor country labels — direct evidence of intentional deception
3. **`brdapp.apk`** direct Android download (no iOS, no Play Store) — likely RAT/spyware
4. **Laravel debug mode enabled in production** (`/wallet` returns 808KB Ignition stack with file paths) — careless ops
5. **Domain reactivated Nov 2025** after 8-year dormancy (2017 → 2025) = bought-aged-domain pattern common in scam ops
6. **Phone literally "1234567890"** — no real human

## Lure mechanics (this operator)
1. TikTok DM cold-open: flattery + "I have a job proposal"
2. Bait-and-switch to "crypto mentorship"
3. $500 minimum, claims $5,572.34 / $50k-$100k per month return
4. Push to WhatsApp/Telegram (off-platform = harder to report)
5. Ask for phone number (SIM-swap setup + APK SMS payload)
6. Eventually: deposit USDT/BTC to wallet address (TBD — gated behind login)

## Status
- Wallet addresses NOT YET in scope (require account registration to extract)
- Recommended next step: register with throwaway email to pull deposit wallets from dashboard
