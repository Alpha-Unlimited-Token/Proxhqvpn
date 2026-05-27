# BRD Market / Gateway Ventures / GB Trade Ltd — MASTER Forensic Dossier
## Pig-Butchering Scam Attribution Package — CONSOLIDATED

| Field | Value |
|---|---|
| **Case ID** | BRD-MARKET-2026-05-27 |
| **Version** | MASTER (merged from primary recon + parallel OSINT engine) |
| **Compiled** | 2026-05-27 |
| **Compiled by** | Alpha Unlimited Technologies LLC — Forensic Intelligence Unit |
| **Lure platform** | TikTok DM |
| **Operator alias** | "BigTrap" (TikTok display name; group chat "Alpha Unlimited, BigTrap") |
| **Scam family** | Pig-butchering / fake crypto-mentorship / fake brokerage |
| **Confirmed fronts** | 3 active (brdmarket.com, getwayventures.com, gbtrade-ltd.com) + 1 secondary scam vertical (test.getwayventures.com → "ZipperTicket" fake ticketing) |
| **Lure ask** | $500 minimum deposit; promises $5,572.34 → $50k–$100k/month |
| **Status** | ACTIVE — operator currently soliciting victims |
| **Evidence collected** | 26+ raw HTML/JSON files (~1.5 MB) + 11 TikTok DM screenshots + 3 website screenshots + this dossier + MISP IOC bundle |

---

## 1. Executive Summary

The TikTok user "BigTrap" cold-opened a DM with the reporter on 2026-05-27 02:59 AM and executed a textbook pig-butchering script across ~7 hours: flattery → fake job pitch → bait-and-switch to crypto mentorship → push to a fake brokerage platform (`brdmarket.com`) → pressure to relocate to WhatsApp/Telegram and surrender a phone number.

Parallel OSINT against the platform URL revealed that **BRD Market is one of three active commercial fronts operated by a single multi-domain scam infrastructure operator** trading as "Gateway Ventures" (`getwayventures.com`). A third confirmed sister, **GB Trade Ltd / "Reality Investment Firm"** (`gbtrade-ltd.com`), was discovered via the parent domain's HTML source and lives on a separate iFastNet IP (`82.163.176.236`) but is tied back through the email `admin@gbtrade-ltd.com` referenced in getwayventures.com's source and through identical Laravel/Livewire templating. A second scam vertical operated by the same entity — **"ZipperTicket"** fake event ticketing — runs on the exposed dev subdomain `test.getwayventures.com`.

The operator:
- Falsely claims **UK incorporation** that does not exist at Companies House
- Lists **two additional jurisdictional company registrations** (South Africa CIPC `2015/341406/07`, Seychelles FSA `8419176-1`) that should be verified by law enforcement against those registries
- Lists a third **St. Vincent and the Grenadines** offshore shell address (no company number provided)
- Displays a **placeholder phone number** `1234567890`
- Promises a **mathematically impossible 3–5% daily profit** (~5,400× annualized)
- Ships JavaScript on `/contact` (`generateRandomCountry()`) that **deliberately fabricates random visitor-country labels** to appear international
- Distributes a sideloaded **Android RAT/wallet-drainer** (`brdapp.apk`) outside Google Play
- Runs **Laravel debug mode in production** at `/wallet`, which leaks the shell user `getwayve` and a prior burned scam domain `@onlintrade.com`
- Operated under an **aged-domain-purchase pattern** — brdmarket.com was a legitimate Dominican Republic real-estate site (Vicente Bengoa, "Mercado de Bienes Raíces Dominicana") from 2012 to 2017, then sat dormant 8 years before being weaponized in Nov 2025
- Embeds **two SmartSupp live-chat tracking keys** (`554b9280f064e970e99b65ccc93283166b17b86d` on getwayventures.com, `f987db63f7caf291cecd3d76a85f9b61ed3eae4a` on gbtrade-ltd.com) that tie directly to a SmartSupp billing account holder — the **single highest-value attribution pivot** available

Third-party scam-DB **ScamAdviser already flags `brdmarket.com` as HIGH RISK / SCAM**, providing independent corroboration.

This dossier compiles every IOC recovered across both recon passes, the complete sister-domain infrastructure map, the eight recommended reporting channels with pre-formatted submission text, the eight open OSINT/law-enforcement pivots, and a chain-of-custody log suitable for downstream legal action.

---

## 2. Consolidated Attribution Chain

```
                  TikTok DM "BigTrap"
                          │
                          │  pitches "BRD Trading Brokerage" $500/$50k-$100k pitch
                          ▼
                  ┌───────────────────────────────────────────┐
                  │   OPERATOR (identity unknown)              │
                  │   • cPanel user: getwayve                  │
                  │   • Linux path /home/getwayve/...           │
                  │   • iFastNet shared hosting customer        │
                  │   • SmartSupp billing account holder        │
                  └───────────────────────────────────────────┘
                                  │
                ┌─────────────────┼─────────────────┐
                │                 │                 │
          185.27.133.17     185.27.133.17    82.163.176.236
                │                 │                 │
            BRDMARKET     GATEWAY VENTURES     GB TRADE LTD
            brdmarket.com getwayventures.com  gbtrade-ltd.com
            (primary lure (parent brand,     (sister, "Reality
             on TikTok)    "Diversified       Investment Firm";
                           Investment")       admin@gbtrade-ltd.com
                                              leaked in parent source)
                │                 │                 │
                │                 │                 ▼
                │                 │           SmartSupp key
                │                 │           f987db63f7caf291...
                │                 │
                │     ┌───────────┼──────────────┐
                │     │           │              │
                │  i.getway   test.getway     mgrr.org.uk
                │  ventures   ventures        (UK shell,
                │  .com       .com            NXDOMAIN)
                │             │
                │         "ZipperTicket"
                │         fake event-ticketing site
                │         (second scam vertical)
                │
                ▼
            BURNED FRONT:
            onlintrade.com (NXDOMAIN)
            leaked in /wallet Laravel stack trace

                      ▲                ▲
                      │                │
              WAYBACK reveals    ScamAdviser
              brdmarket.com      already flags
              was a legit DR     brdmarket.com
              real-estate site   as HIGH RISK
              (Vicente Bengoa)
              2012–2017,
              dormant 2017–2025,
              weaponized Nov 2025
```

---

## 3. Consolidated Indicators of Compromise

### 3.1 Domains
| Domain | Status | Role | First seen |
|---|---|---|---|
| `brdmarket.com` | **LIVE** | Primary lure / fake brokerage | 2026-03-12 (URLScan); orig. 2012 |
| `getwayventures.com` | **LIVE** | Parent infrastructure brand | 2025-05-28 (URLScan) |
| `gbtrade-ltd.com` | **LIVE** | Sister scam — "GB Trade Ltd / Reality Investment Firm" | Q1 2026 |
| `i.getwayventures.com` | LIVE | Secondary front (cert SAN) | Unknown |
| `test.getwayventures.com` | LIVE | Dev/staging env hosting "ZipperTicket" fake event-ticketing scam | Unknown |
| `mgrr.org.uk` | NXDOMAIN | UK shell, torn down | Unknown |
| `mgrr.org.uk.getwayventures.com` | Historic | Cert SAN entry | Unknown |
| `onlintrade.com` | NXDOMAIN | Prior burned scam, leaked in stack trace | Unknown |
| `brdmarket.com.getwayventures.com` | Historic | Subdomain rewrite | Unknown |
| `www.brdmarket.com.getwayventures.com` | Historic | Subdomain rewrite | Unknown |

### 3.2 Network / hosting
| Field | Value |
|---|---|
| Primary IP | `185.27.133.17` (brdmarket + getwayventures + subdomains) |
| Sister IP | `82.163.176.236` (gbtrade-ltd.com) |
| SPF relay IPs | `82.163.176.83`, `31.22.4.169`, `185.27.133.16`, `185.27.133.17` |
| Hosting provider | iFastNet shared reseller |
| Hosting abuse contact | `abuse@ifastnet.com` |
| Nameservers | `ns1082.ifastnet.com`, `ns2082.ifastnet.com` |
| Linux shell user | `getwayve` (leaked path `/home/getwayve/brdmarket.com/...`) |
| App stack | OpenResty → Apache → PHP → Laravel + Livewire + Turbo + facade/ignition |
| TLS cert | Let's Encrypt R12, NotBefore 2026-05-12, NotAfter 2026-08-10 |
| TLS cert SAN | `*.brdmarket.com`, `brdmarket.com`, `brdmarket.com.getwayventures.com`, `mgrr.org.uk.getwayventures.com`, `test.getwayventures.com`, `www.brdmarket.com.getwayventures.com`, `www.mgrr.org.uk.getwayventures.com`, `www.test.getwayventures.com` |

### 3.3 Live-chat tracking keys (HIGH-VALUE)
| Key | Site | Pivot |
|---|---|---|
| `554b9280f064e970e99b65ccc93283166b17b86d` | getwayventures.com | SmartSupp account holder identity |
| `f987db63f7caf291cecd3d76a85f9b61ed3eae4a` | gbtrade-ltd.com | SmartSupp account holder identity |

*These keys are registered to a paid SmartSupp account with billing details. A subpoena or abuse report to SmartSupp can resolve them to the registered email, name, and payment method.*

### 3.4 Email addresses
| Email | Source | Notes |
|---|---|---|
| `admin@brdmarket.com` | brdmarket.com `/contact` | Role address; only on-site contact |
| `admin@gbtrade-ltd.com` | getwayventures.com HTML source | **Ties two fronts to one operator** |
| `*@onlintrade.com` | brdmarket.com `/wallet` Ignition stack trace | Prior burned scam domain |

### 3.5 Claimed identities (all unverified / falsified)
| Jurisdiction | Claimed entity | Reg # | Address | Status |
|---|---|---|---|---|
| **UK** | "Brdmarket LIMITED operating in the UK" | — | — | **CONFIRMED FALSE** — zero results at Companies House for BRDMARKET, BRD MARKET, GATEWAY VENTURES, GETWAYVENTURES, or MGRR |
| **South Africa** | "Brdmarket SA (PTY) Ltd" | `2015/341406/07` | "Suite 18 Second floor, 114 West Street Sandton, Johannesburg 2031" | **PENDING** verification against CIPC (cipc.co.za); if real, discloses directors |
| **Seychelles** | "Brdmarket (Seychelles) Ltd" | `8419176-1` | "Room S203A, Second Floor, Orion Complex, Victoria, Mahe" | **PENDING** verification against Seychelles FSA; if real, discloses beneficial owner |
| **St. Vincent & the Grenadines** | (none stated) | — | "Griffith Corporate Centre, P.O. Box 1510, Beachmont Kingstown" | Standard unregulated-broker shell address, no company name disclosed |
| Phone | `1234567890` | — | — | **Placeholder — fake** |

### 3.6 Suspected malware (CONFIRMED LIVE)
| File | URL | Status | Risk |
|---|---|---|---|
| `brdapp.apk` | `https://brdmarket.com/brdapp.apk` | **HTTP 200 — live** | **CRITICAL** — sideloaded Android APK, no iOS, not on Play Store. High probability RAT or wallet drainer. Detonate only in isolated sandbox. |

### 3.7 Operator on TikTok
| Field | Value |
|---|---|
| Display name | `BigTrap` |
| Group chat name | `Alpha Unlimited, BigTrap` (operator scraped reporter's company name as personalization) |
| @handle | **Unknown — requires TikTok subpoena** |
| First DM | 2026-05-27 02:59 AM |
| Active hours observed | 2026-05-27 09:02 – 10:28 AM |

### 3.8 Wallet addresses
**Not yet recovered.** Deposit wallet addresses are gated behind account registration on `brdmarket.com/register`. Recovery requires registering with a throwaway email. This is the **single highest-priority outstanding pivot** because it unlocks crypto-tracing via Chainalysis/Elliptic.

---

## 4. Court-Ready Evidence of Fraud

| # | Evidence | Location | Legal significance |
|---|---|---|---|
| 1 | "3–5% daily profit guaranteed" in homepage `<meta>` | brdmarket.com source | Mathematically impossible. UK FSMA 2000 §21 (unlawful financial promotion); US FTC Act §5; SEC Rule 10b-5 |
| 2 | `generateRandomCountry()` JavaScript fabricates fake visitor countries on `/contact` | brdmarket.com/contact source | Hand-coded, intentional deception. Direct evidence of mens rea |
| 3 | False "UK Limited" claim — zero hits at Companies House | /about meta + Companies House verification | UK Companies Act 2006 §1192 (improper use of "Limited") |
| 4 | Laravel Ignition debug mode in production at `/wallet` leaking `/home/getwayve/...` and `@onlintrade.com` | brdmarket.com/wallet (808 KB stack trace) | Proves shared operator infrastructure and prior scam history |
| 5 | Placeholder phone "1234567890" | /contact | Inconsistent with any legitimate regulated broker |
| 6 | Sideloaded Android APK outside Google Play, HTTP 200 confirmed | brdmarket.com/brdapp.apk | Standard RAT/wallet-drainer delivery vector |
| 7 | Aged-domain purchase: brdmarket.com was legitimate Dominican Republic real estate site (Vicente Bengoa, "Mercado de Bienes Raíces Dominicana") 2012–2017, then dormant, then weaponized Nov 2025 | Wayback Machine | Deliberate purchase to evade new-domain spam filters |
| 8 | gbtrade-ltd.com uses identical template, same admin-email pattern, ties via `admin@gbtrade-ltd.com` leaked in getwayventures.com source | getwayventures.com HTML | Multi-front fraud network operated by single entity |
| 9 | test.getwayventures.com runs "ZipperTicket" fake event-ticketing platform | test.getwayventures.com live HTTP | Second scam vertical (event ticket fraud) operated by same entity |
| 10 | ScamAdviser independently flags brdmarket.com as **HIGH RISK / SCAM** | scamadviser.com public report | Third-party corroboration |
| 11 | Two SmartSupp live-chat keys (`554b9280...`, `f987db63...`) embedded across two domains | getwayventures.com + gbtrade-ltd.com source | Ties both fronts to a single paid SmartSupp account = identity pivot |
| 12 | Three contradictory jurisdictional registrations (UK, SA, Seychelles) plus an SVG shell | brdmarket.com/contact | Pattern characteristic of unregulated scam-broker template kits |
| 13 | iFastNet $3/mo shared hosting alongside 40+ unrelated `.com.ar` and `.com.br` cPanel sites | Reverse-IP enumeration | No legitimate brokerage operates on bulk-reseller hosting |

---

## 5. Conversational Lure Mechanics (TikTok DM Timeline)

| Time (UTC) | Stage | Operator message (paraphrased) | Tactic |
|---|---|---|---|
| 02:59 AM | Cold open | Created group chat named "Alpha Unlimited, BigTrap"; "Your looks are positive, I work with upper-class influencers, I have a job proposal" | Flattery + vague high-status anchor + **scraped reporter's company name** into chat name as personalization |
| 09:02 AM | Bait-and-switch | "Ongoing program to help newbies generate over $20,000 weekly with crypto option trade" | Pivot from "job" to "investment" |
| 09:12 AM | Anchor inflation | "$50k–$100k a month in crypto, build a solid capital base for investors" | Scale target up to lock commitment |
| 09:28 AM | Funnel | "Create trade account on our company platform, make deposit, we trade for you" | Standard fake-brokerage funnel |
| 09:41 AM | Specific ask | "$500 minimum, $5,572.34 returns possible" | False precision = social-engineering tell |
| 10:15 AM | Brand drop | "We'll activate your trading profile under BRD Trading Brokerage" | First mention of platform name |
| 10:19 AM | Off-platform pressure | "Are you on WhatsApp or Telegram? Send me your number" | Get off TikTok = no reporting trail; harvest phone for SMS APK delivery + SIM-swap |
| 10:28 AM | URL reveal | "Fair enough — `http://Brdmarket.com`" | URL delivered only after **three prior evasions** |

---

## 6. Reporting Package (Pre-Formatted Submissions)

### 6.1 FBI Internet Crime Complaint Center — ic3.gov/complaint
> Pig-butchering / advance-fee fraud. Operator alias "BigTrap" contacted me via TikTok DM on 2026-05-27 pitching a fake crypto mentorship, then directed me to fake brokerage `brdmarket.com` ($500 minimum deposit, promising $50k–$100k/month). Infrastructure: IP `185.27.133.17`, iFastNet hosting, cPanel user `getwayve`. Confirmed sister domains operated by same entity: `getwayventures.com`, `gbtrade-ltd.com`, `i.getwayventures.com`, `test.getwayventures.com` (the last hosting a second scam vertical "ZipperTicket" fake event ticketing). Operator falsely claims UK incorporation (not registered at Companies House) and lists unverified South Africa CIPC reg `2015/341406/07` and Seychelles FSA reg `8419176-1`. Site distributes sideloaded Android APK at `https://brdmarket.com/brdapp.apk` (HTTP 200 confirmed). Two SmartSupp live-chat keys (`554b9280f064e970e99b65ccc93283166b17b86d`, `f987db63f7caf291cecd3d76a85f9b61ed3eae4a`) tie the fronts to a single paid account that can be subpoenaed. Full infrastructure dossier with 11 DM screenshots and 26 raw HTML evidence files available.

### 6.2 FTC Consumer Sentinel — reportfraud.ftc.gov
> Investment-mentor scam. TikTok operator "BigTrap" cold-messaged me 2026-05-27, pitched $20k/week crypto returns, directed me to fake brokerage `brdmarket.com` ($500 minimum). Same operator runs `getwayventures.com` and `gbtrade-ltd.com` on shared iFastNet hosting. Sites falsely claim UK LIMITED status, promise 3–5% daily returns (mathematically impossible), use fake phone "1234567890", and distribute a non-Play-Store Android APK. ScamAdviser already flags `brdmarket.com` as HIGH RISK.

### 6.3 TikTok Trust & Safety — tiktok.com/legal/report
> Display name "BigTrap" executed unsolicited pig-butchering pitch via TikTok DM on 2026-05-27. Operator stalled three times when asked for the platform URL on TikTok before sending `http://Brdmarket.com`. Part of confirmed multi-front commercial fraud network (3 active fronts on shared iFastNet hosting). Full 11-screenshot DM transcript and infrastructure dossier available. Request: immediate account termination, IP/device-fingerprint ban, identification of other users targeted by this account, and preservation of message logs for law-enforcement subpoena.

### 6.4 iFastNet Hosting Abuse — abuse@ifastnet.com
> cPanel account `getwayve` at IP `185.27.133.17` hosts confirmed fraud domains: `brdmarket.com`, `getwayventures.com`, `i.getwayventures.com`, `test.getwayventures.com`. A sister account on `82.163.176.236` hosts `gbtrade-ltd.com`. All are pig-butchering investment-scam fronts falsely claiming UK incorporation and distributing suspected Android malware. Additional opsec failures include Laravel Ignition debug mode leaking server paths and a prior scam domain `@onlintrade.com`. Request: immediate account suspension across all related accounts, full content takedown, and preservation of account-registration data, billing records, and access logs for law-enforcement subpoena.

### 6.5 Let's Encrypt — security@letsencrypt.org
> Fraud certificate revocation request: Let's Encrypt R12 cert (issued 2026-05-12, expires 2026-08-10) covering `*.brdmarket.com` plus SAN entries `brdmarket.com.getwayventures.com`, `test.getwayventures.com`, `mgrr.org.uk.getwayventures.com`, and related. Issued to a confirmed pig-butchering brokerage falsely claiming UK incorporation and distributing a suspected Android RAT. Request revocation per Subscriber Agreement §3.4 (fraudulent use).

### 6.6 UK Action Fraud — actionfraud.police.uk/report-a-fraud
> `brdmarket.com` self-describes as "Brdmarket LIMITED operating in the UK" in its homepage `<meta>` description and About page. **Zero results at UK Companies House** for that name (verified 2026-05-27). Site promises 3–5% daily returns to UK and international consumers, requires $500 minimum deposit, and is currently soliciting victims via TikTok DM. Possible offenses: Companies Act 2006 §1192 (improper use of "Limited"); Financial Services and Markets Act 2000 §21 (unlawful financial promotion to UK consumers); Fraud Act 2006 §2 (fraud by false representation).

### 6.7 Google Play Protect / Android Security — android-security-reports@google.com
> APK distributed outside Google Play at `https://brdmarket.com/brdapp.apk` (HTTP 200 confirmed 2026-05-27) by a confirmed pig-butchering fraud operator. High probability malware (RAT or crypto-wallet drainer). Request sandbox detonation, SHA-256 blacklisting in Play Protect signature database, and Safe Browsing flag on `brdmarket.com`.

### 6.8 Chainabuse — chainabuse.com/report
> Pig-butchering / fake-brokerage category. Primary lure URL: `brdmarket.com`. Confirmed sister fronts: `getwayventures.com`, `gbtrade-ltd.com`. Deposit wallet addresses pending recovery (gated behind dashboard registration). TikTok lure operator: "BigTrap." Will update report with on-chain IOCs once wallets extracted.

---

## 7. Open OSINT / Law-Enforcement Pivots (Ordered by Value)

| Priority | Pivot | Why it matters |
|---|---|---|
| 🔴 **HIGHEST** | **iFastNet account records subpoena** — cPanel user `getwayve` registration name, email, billing address, payment method, IP login history | Direct path to operator's real identity and payment trail |
| 🔴 **HIGHEST** | **SmartSupp account subpoena** — keys `554b9280f064e970e99b65ccc93283166b17b86d` and `f987db63f7caf291cecd3d76a85f9b61ed3eae4a` | SmartSupp is a paid SaaS; account holder is registered with billing info |
| 🔴 **HIGHEST** | **Register a throwaway account at brdmarket.com** | Extracts gated deposit-wallet addresses → unlocks Chainalysis/Elliptic crypto tracing |
| 🟠 HIGH | **TikTok platform subpoena** | Resolve "BigTrap" display name to @handle, device fingerprint, registration IP, phone |
| 🟠 HIGH | **Domain registrar subpoena** — registrars of brdmarket.com, getwayventures.com, gbtrade-ltd.com | Pierce WHOIS-privacy proxy to recover registrant identity |
| 🟠 HIGH | **APK static + dynamic analysis** of `brdapp.apk` in isolated sandbox | Extract C2 endpoints, embedded wallet addresses, API keys, permissions |
| 🟡 MEDIUM | **South Africa CIPC verification** of `2015/341406/07` | If registration is real, discloses director names and addresses under SA company law |
| 🟡 MEDIUM | **Seychelles FSA verification** of `8419176-1` | If registration is real, discloses beneficial owner |
| 🟡 MEDIUM | **Paid passive-DNS lookup** (SecurityTrails / Farsight DNSDB) on `185.27.133.17` and `82.163.176.236` | Reveals historical resolutions during dormancy windows; may surface additional sister fronts |
| 🟢 LOW | **Wayback diff** of brdmarket.com 2012–2017 vs 2026 | Document the original Vicente Bengoa real-estate site for "domain hijack" framing |

---

## 8. Evidence File Inventory

All files bundled in the accompanying ZIP archive (`BRD-Market-MASTER-Dossier.zip`).

### Primary deliverables
- `BRD-Market-MASTER-Dossier.md` — this dossier
- `iocs_master.json` — MISP-compatible consolidated IOC bundle
- `INTEL_SUMMARY.md` — original short-form summary

### Raw web evidence (brdmarket.com)
- `home.html` (22 KB) — homepage source (contains "3-5% daily" claim, brdapp.apk link, gallery)
- `register.html` (39 KB) — victim onboarding page
- `contact.html` (29 KB) — **contains `generateRandomCountry()` JS deception evidence**
- `about.html` (33 KB) — contains false "UK Limited" claim in meta
- `terms.html` (45 KB) — terms of service
- `wallet_500.html` (808 KB) — **leaked Laravel Ignition stack trace exposing `/home/getwayve/` path and `@onlintrade.com`**
- `page_login.html` (7.7 KB) — login page

### Certificate transparency
- `crt_brdmarket.json` (4.9 KB) — full cert history for brdmarket.com
- `crt_getwayventures.json` (13 KB) — cert history for parent domain, enumerated 10 historic SAN domains

### Parallel-engine deliverables (merged)
- `brd_market_2026_05_27.md` — original report from the parallel OSINT engine
- `brd_market_2026_05_27_iocs.json` — original MISP IOC bundle from parallel engine

### Screenshots
- `screenshots/brdmarket_com.png` — primary lure homepage
- `screenshots/getwayventures_com.png` — parent infrastructure brand
- `screenshots/gbtrade-ltd_com.png` — **newly discovered sister scam** (from parallel engine)
- `screenshots/tiktok/*.png` (11 files) — full TikTok DM transcript

---

## 9. Chain of Custody

| Event | UTC time | Source / method |
|---|---|---|
| Lure DM received (cold open) | 2026-05-27 02:59 | TikTok app — screenshot #1 |
| Lure URL `http://brdmarket.com` disclosed | 2026-05-27 ~14:28 | TikTok DM — screenshot #11 |
| Live site screenshot captured | 2026-05-27 14:28 | external-URL screenshot service |
| HTTP HEAD + Cloudflare DOH recon | 2026-05-27 14:28 | curl + DoH JSON API |
| TLS cert SAN enumeration | 2026-05-27 14:29 | openssl s_client |
| Full HTML scrape (8 pages) | 2026-05-27 14:29 | curl with browser UA |
| /wallet 500-error stack capture | 2026-05-27 14:29 | curl |
| crt.sh cert-transparency enumeration | 2026-05-27 14:30 | crt.sh JSON API |
| Reverse-IP enumeration on 185.27.133.17 | 2026-05-27 14:30 | hackertarget.com API |
| Sister-domain DNS resolution | 2026-05-27 14:30 | Cloudflare DoH |
| Parallel OSINT engine run | 2026-05-27 ~14:50 | Sister Replit forensic project |
| Sister domain `gbtrade-ltd.com` discovered | 2026-05-27 (parallel engine) | getwayventures.com HTML source grep |
| SmartSupp keys extracted | 2026-05-27 (parallel engine) | Page source HTML |
| Wayback historic timeline | 2026-05-27 (parallel engine) | web.archive.org CDX API |
| URLScan + ScamAdviser corroboration | 2026-05-27 (parallel engine) | Public APIs |
| UK Companies House search | 2026-05-27 | find-and-update.company-information.service.gov.uk |
| MASTER dossier merged | 2026-05-27 ~15:05 | This file |

All reconnaissance performed against publicly-resolvable infrastructure using public APIs and standard OSINT tooling consistent with the Bellingcat / SANS SEC487 / OSINT Foundation ethical-OSINT frameworks. No private systems were accessed, no credentials were used, no malware was detonated. All evidence is preserved with original timestamps and source attribution.

---

*Case ID: BRD-MARKET-2026-05-27 — MASTER*
*Alpha Unlimited Technologies LLC — Forensic Intelligence Unit*
*© 2026 Alpha Unlimited Technologies LLC. Compiled for the purpose of victim protection, fraud attribution, and submission to relevant law-enforcement and abuse-reporting channels.*

---

## Addendum E — On-Chain Wallet Trace (added 2026-05-27)

The Subject "BigTrap" supplied Bitcoin deposit address `bc1qy0e4jgq86w8kfdlvmlc4muahh35ss2hu0demat` via TikTok at 17:12 UTC on 2026-05-27. Full multi-hop forensic analysis is filed as `ADDENDUM-E-On-Chain-Wallet-Trace.md` with all raw block-explorer JSON in `wallet_trace_raw_evidence/`.

**Headline findings**:
- Burner wallet — 6 lifetime txs, $1,500 throughput, 0.00 BTC current balance, 100% pass-through
- Forward trace reaches CEX-OWNED internal infrastructure at hop 2 (1.10M / 1.17M / 11.97M BTC lifetime received; confirmed exchange-owned by sender-diversity test [8k–11k unique senders per 200-tx sample] + intra-trio rotation test [50–68 cross-payments]). Subpoena target = the exchange operating those wallets — ask for the KYC account credited by deposits from `1MBdc...` at the three pinpoint timestamps.
- Backward trace identifies origin point at `bc1qujgkx8l…` (1,805 BTC lifetime — second subpoena target)
- Funding batches verified as EXCHANGE WITHDRAWAL BATCHES (Annex II of Addendum E): ~53% of sibling outputs are unrelated real users. No sibling address other than `bc1qy0e4j...` itself is characterized as scam-affiliated. Materiality threshold rests on brdmarket.com's public solicitation conduct, NOT on any inference from the sibling addresses.
- Complainant did not transact with the wallet; clean hands preserved

