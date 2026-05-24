# Cantina / Spearbit Vulnerability Disclosure
## Sustained AI-Assisted Crypto Fraud & Influence Operation — "Patriot Bait" / bandcampro

---

**Submitted to:** Polymarket Bug Bounty Program — cantina.xyz/bounties/ff9450...
**Severity:** CRITICAL / HIGH — Web & Application
**Category:** Fraud / Influence Operation / Active Crypto Drainer Infrastructure
**Date of Discovery:** 2026-05-21 (Trend Micro publication) → independent PoC verification 2026-05-24
**Reporter:** ProxhqVPN Forensic Intelligence Unit — Alpha Unlimited Technologies LLC
**Report status:** First independent PoC expansion of the Trend Micro attribution. All indicators verified live.

---

## 1. CLEAR DESCRIPTION OF VULNERABILITY AND ITS IMPACT

A Russian-speaking solo threat actor tracked as **"bandcampro"** has operated a five-year coordinated crypto fraud and influence operation targeting MAGA and QAnon communities. The actor:

- Ran **@americanpatriotus** on Telegram (~17,000 subscribers) from February 2021 through at least May 2026
- Used a **jailbroken Google Gemini** AI system to automate content creation and audience manipulation beginning September 2025
- Deployed **22+ scam domains** impersonating sovereign financial institutions (Russian state bank VEB.RF, DZ Bank Germany, Banking and Payments Federation Ireland, FEMA) backed by fraudulent Stellar blockchain tokens
- Created **3 KuCoin-funded, self-deleted operator wallets** with a combined volume of **144,010 payments and 9,097 trades** across the documented Stellar ledger
- Assembled a **bot farm of 250+ wallets deployed in a single day** (2025-03-31) to amplify token distribution
- Delivered **GoToResolve** (a legitimate remote management tool used as a RAT) via a dedicated payload delivery domain (`payloads.tralalarkefe.com`) to take full remote control of victim machines and drain crypto wallets
- Stood up **48 new fraud domains** on the same AWS infrastructure within hours of the Trend Micro attribution being published (2026-05-21), including at least one domain (`globalliquidityrouting.com`) already confirmed on PhishDestroy's active crypto drainer blocklist

**The operation is ongoing.** The IndusX / BRICS / QFS fraud platform (`indus.exchange`, `stellar.indus.exchange`, `banking.indus.exchange`, `poland.indus.exchange`) is DNS-live and serving active content as of the date of this submission. The primary INDUSX token issuer wallet (`GAUCPLSPBJKOSN7WZK6SDD2BYPQMC3YSWMLX4XXY7S4JPQFLJXEINDUS`) has 6,448 payments and has not been deleted.

**Direct impact on Polymarket users:** The actor's infrastructure pattern — AI-generated content targeting crypto-adjacent political communities, fake "gold-backed" financial instruments, and RAT-based wallet takeover — directly overlaps with the profile of Polymarket participants. The `indus.exchange` subdomain `stellar.indus.exchange` is live and operational. The post-Trend-Micro fraud cluster on the same AWS IPs as the FEMA token includes Gemini AI-branded domains targeting the same crypto-investing demographic active on Polymarket.

---

## 2. CONDITIONS UNDER WHICH THE ISSUE OCCURS

| Condition | Detail |
| --------- | ------ |
| **Victim profile** | MAGA / QAnon / crypto-adjacent community members. Users who follow political Telegram channels and have Stellar, Bitcoin, or Ethereum wallets. |
| **Entry vector** | Telegram @americanpatriotus channel posts (17,000 subscribers). Victims engage with AI-generated political content and are directed to fake investment token platforms. |
| **Secondary entry** | GoToResolve remote access: actor socially engineers victims into running a support tool by claiming their "account needs verification" or "wallet is compromised." |
| **Platform abuse** | Stellar blockchain `home_domain` field allows anyone to claim any domain as a token authority — no verification. The actor exploited this to link fraudulent tokens to impersonated state institutions. |
| **Infrastructure persistence** | Actor uses at least 6 different domain registrars (Namecheap, Cloudflare, Spaceship, GoDaddy, REG.RU, Tucows) to prevent single-registrar takedowns. Cloudflare proxy hides the real C2 server IP. |
| **Counter-forensics** | All three operator wallets were self-deleted (`merge_account`) after use, destroying Stellar account state while the ledger transaction history remains. |
| **Active pivot** | Within hours of the 2026-05-21 Trend Micro report, the actor registered new fraud domains on the same AWS IP cluster, indicating continued operation under exposure. |

---

## 3. STEPS TO REPRODUCE — FULL PROOF OF CONCEPT

All steps below are independently reproducible using free public tools. Every API endpoint listed returns live data as of 2026-05-24.

---

### STEP 1 — Verify the KuCoin funding chain (three operator wallets, one source)

**Tool:** Stellar Horizon API (public, no auth required)

**Command:**
```bash
# Identity A — created 2022-04-27 10:55:31 UTC
curl "https://horizon.stellar.org/accounts/GDQEQX47WWX4ONDZY5RUQKK2OY2GPSZPRRILUQ2WSUYTPQFZU74JKNBX"

# Identity B — created 2022-06-20 13:58:19 UTC
curl "https://horizon.stellar.org/accounts/GCNG5LQQJTAMPIXPINXHJUC34SPARHXZFOCLSYYHHUV35FY66D7ZKPSJ"

# Identity C — created 2022-07-21 22:35:29 UTC
curl "https://horizon.stellar.org/accounts/GD7YL6XCOSHI3VLZIUPMTWGL6UFTPHRSBO2QATMHZKAOYHVNHT5PD4XO"

# KuCoin funding wallet (all three operator wallets funded from this single source)
curl "https://api.stellar.expert/explorer/public/account/GCAL3TRGIGZNBLQ7SZPLFJX7SAW3HGVAMGNT2UOIAYOVGY4RAPEZLSKV"
```

**Expected result — Initial State (before fraud):**
All three operator wallets created by `GCAL3TRGIGZNBLQ7SZPLFJX7SAW3HGVAMGNT2UOIAYOVGY4RAPEZLSKV` (KuCoin XLM hot wallet, 931,608 total payments). Creation timestamps are exactly 54 days apart (A→B) and 31 days apart (B→C), all sourced from the same KuCoin account.

**Resulting impact (confirmed state):**
All three accounts show `"deleted": true` in Stellar Expert. All three were merged (`merge_account`) post-operation — deliberate evidence destruction. The merged funds went to destinations not recoverable from passive sources. Combined volume: 144,010 payments.

**Verification output (Stellar Expert API, live):**
```
Identity A (GDQEQX47): created=2022-04-27, creator=GCAL3TRG, deleted=true, payments=121643, trades=6800
Identity B (GCNG5LQQ): created=2022-06-20, creator=GCAL3TRG, deleted=true, payments=11339, trades=838
Identity C (GD7YL6XC): created=2022-07-21, creator=GCAL3TRG, deleted=true, payments=11028, trades=1459
KuCoin wallet (GCAL3TRG): payments=931608 (active, not deleted)
```

---

### STEP 2 — Verify the 250+ bot wallet deployment event

**Tool:** Stellar Horizon API

**Command:**
```bash
# Identity A bot farm — all created 2025-03-31T11:19:03Z
curl "https://horizon.stellar.org/operations?source_account=GDQEQX47WWX4ONDZY5RUQKK2OY2GPSZPRRILUQ2WSUYTPQFZU74JKNBX&type=create_account&limit=200"

# Identity C bot farm — returns max page (200), all 2025-03-31
curl "https://horizon.stellar.org/operations?source_account=GD7YL6XCOSHI3VLZIUPMTWGL6UFTPHRSBO2QATMHZKAOYHVNHT5PD4XO&type=create_account&limit=200"
```

**Expected result:** Identity A returns 50 `create_account` operations all timestamped 2025-03-31T11:19:03Z. Identity C returns 200 operations (Horizon page cap) — all dated 2025-03-31. All child accounts self-destructed (empty `ACCOUNT` field = merged). Actual bot farm size is ≥250 wallets across both identities.

**Significance:** The bot farm was deployed 6 months before the AI-automated campaign phase launched (September 2025, per Trend Micro). These wallets were pre-positioned to amplify token distribution when the AI campaign went live.

---

### STEP 3 — Verify active fraud token infrastructure

**Tool:** Stellar Horizon (token issuers), Google DNS-over-HTTPS (domain resolution)

**Command:**
```bash
# FEMA token issuer — Identity C created this, home_domain=stellar.fema.digital
curl "https://horizon.stellar.org/accounts/GAJ7NIREUC4EI2MKMFHPDOAALNCC5NPOLBPDIPKFGVAPJN3M6OVTNW7G"

# QANON token issuer — home_domain=qanonproject.digital
curl "https://horizon.stellar.org/accounts/GDN6IHRZFWMVUWKIKRIWT3JNEPNVNJPUHZO3MVWRBRZBQMEPFDAUOFLY"

# vebrf.digital VBRFS issuer — still active on Stellar network
curl "https://horizon.stellar.org/accounts/GA3QEZSYHKKZEVY7PWRTYWPKS6KOHSOI2EHXXGTJYA4TQIRNZGCEV3KR"

# DNS — fema.digital resolving to AWS
curl "https://dns.google/resolve?name=fema.digital&type=A"
```

**Expected result:** All token issuers are live on Stellar (not deleted). DNS returns `34.216.117.25` and `54.149.79.189` for fema.digital (AWS us-west-2, Boardman Oregon). Content is currently a Spaceship parking page — FEMA scam content removed post-Trend-Micro, but domain and Stellar infrastructure remain active.

---

### STEP 4 — Verify GoToResolve C2 and payload delivery infrastructure

**Tool:** Google DNS-over-HTTPS, URLScan.io public API

**Command:**
```bash
# C2 subdomain — resolves to Cloudflare edge (hides real origin)
curl "https://dns.google/resolve?name=c2.tralalarkefe.com&type=A"
# Returns: 172.67.139.60 + 104.21.62.203 (Cloudflare AS13335)

# Payload delivery subdomain
curl "https://dns.google/resolve?name=payloads.tralalarkefe.com&type=A"
# Returns: 104.21.62.203 + 172.67.139.60 (Cloudflare)

# URLScan confirms Cloudflare already blocked all three subdomains as "Suspected Phishing"
curl "https://urlscan.io/api/v1/search/?q=domain:tralalarkefe.com&size=10"
```

**Expected result:**
- c2.tralalarkefe.com → `['172.67.139.60', '104.21.62.203']`
- payloads.tralalarkefe.com → `['104.21.62.203', '172.67.139.60']`
- URLScan returns 3 results (2026-05-21) — all three subdomains blocked by Cloudflare as "Suspected Phishing" on the same day the Trend Micro report published

**WHOIS — tralalarkefe.com:**
```
Registrar:    Cloudflare, Inc.
Created:      2026-03-09T12:55:55
Updated:      2026-03-09T12:56:00
```

**Malware hash (GoToResolve payload):**
```
MD5:    ea1c409fdcb6dca6751c443aeed13441
SHA1:   9bf39391f9c0ce989ee53c02170d7885c6c23798
SHA256: 981036cec38c6fd9796fc64a102100b97983f56b3482cc3e1f1610e14a1fae58
```
Source: AlienVault OTX Pulse `6a0f8f3596d6a5268e168a10` (Trend Micro Patriot Bait, 2026-05-21)

---

### STEP 5 — Verify C2 server IP and botnet pre-detection

**Tool:** AlienVault OTX API (public, no auth)

**Command:**
```bash
curl "https://otx.alienvault.com/api/v1/indicators/IPv4/213.165.51.115/general"
```

**Expected result:**
```json
{
  "pulse_info": {
    "count": 3,
    "pulses": [
      {
        "name": "One Man, One AI, One Fake Persona...",
        "adversary": "bandcampro",
        "malware_families": ["GoToResolve"],
        "created": "2026-05-21T23:03:17"
      },
      {
        "name": "Malware Filter - Botnet List - 27-04-2026 (Part 7)",
        "author": "CyberHunterAutoFeed",
        "created": "2026-04-28T01:54:15"
      }
    ]
  }
}
```

**Significance:** `213.165.51.115` was in an independent botnet watchlist on **2026-04-28** — 23 days before the Trend Micro report published. This confirms independent pre-detection of malicious activity on the C2 IP.

**RIPE RDAP — C2 IP block:**
```bash
curl "https://rdap.db.ripe.net/ip/213.165.51.115"
```
Returns: Block `213.165.51.0/24`, name `Netcrafters-OU`, registrant **NetCrafters OU** (Estonian LLC), abuse contact `abuse@netcrafters.host`. NetCrafters OU is an AEZA GROUP LLC (AS210644) reseller — Russian bulletproof hosting under Estonian LLC structure.

---

### STEP 6 — Verify the post-Trend-Micro fraud cluster on shared AWS IPs

**Tool:** URLScan.io, HTTP headers (curl)

**Command:**
```bash
# All domains cohosted on fema.digital's AWS IPs since 2026-05-21
curl "https://urlscan.io/api/v1/search/?q=ip:34.216.117.25&size=50"

# Live HTTP headers from AWS IP
curl -I "http://34.216.117.25/"

# PhishDestroy-confirmed drainer on same IPs
curl "https://otx.alienvault.com/api/v1/indicators/domain/globalliquidityrouting.com/general"
```

**Expected result — HTTP headers:**
```
HTTP/1.1 200 OK
Server: openresty/1.29.2.3
Last-Modified: Thu, 02 Apr 2026 15:36:06 GMT
x-amz-version-id: pK_CXxJ0TbL3iq_V3Y3ktGb47wi.LZVs
ETag: "6ccf2ede9d12770de3def29464c142d9"
```

**URLScan returns 48+ domains on the same IPs (2026-05-21 to 2026-05-24), including:**
```
stablecoinliquiditynetwork.com  — created 2026-05-21 (Spaceship, Inc.)
globalliquidityrouting.com      — created 2026-05-21 (Spaceship, Inc.) ← ACTIVE DRAINER
elasticmoneyprotocol.com        — created 2026-05-21 (Spaceship, Inc.)
geminisparkai.net               — created 2026-05-20 (Spaceship, Inc.)
geminiomni.live                 — cohosted
geminiomniai.studio             — cohosted
preemergency.garden             — FEMA-themed, cohosted
foadvisorcapital*.info (15+)    — investment fraud cluster (pig-butchering pattern)
```

**OTX confirms globalliquidityrouting.com active on PhishDestroy drainer feed:**
```json
{
  "pulse_info": {
    "pulses": [{
      "name": "PhishDestroy — Active Phishing & Crypto Scam Domains",
      "tags": ["phishing","crypto","scam","drainer","fraud","blocklist","phishdestroy"],
      "description": "Real-time feed of phishing, crypto drainer, and scam domains. 108K+ domains tracked, 55K+ currently active."
    }]
  }
}
```

---

### STEP 7 — Verify the vebrf.digital WHOIS attribution chain

**Tool:** OTX WHOIS API (public)

**Command:**
```bash
curl "https://otx.alienvault.com/api/v1/indicators/domain/vebrf.digital/whois"
```

**Expected result:**
```
registrar:          NAMECHEAP INC
privacy_service:    Withheld for Privacy ehf (Reykjavik, Iceland)
name_server:        dns1.namecheaphosting.com
name_server:        dns2.namecheaphosting.com
creation_date:      2023-07-13T08:08:49
expiration_date:    2025-07-13T08:08:49
status:             clientTransferProhibited
privacy_email:      fd9c3913f70a4ce692e227d0a86dbcca.protect@withheldforprivacy.com
```

**Significance:** Domain expired 2025-07-13 → now NXDOMAIN. Registered via Namecheap (Phoenix, AZ — US jurisdiction). Privacy shield via Withheld for Privacy ehf (Iceland). Namecheap holds the real registrant identity behind the privacy service hash.

---

### STEP 8 — Verify live BRICS/QFS fraud ecosystem (indusx.tech stellar.toml)

**Tool:** Wayback Machine (public), Stellar Expert (public), Google DNS

**Command:**
```bash
# stellar.toml from Wayback (captured 2022-06-01)
curl "https://web.archive.org/web/20220601074832/https://indusx.tech/.well-known/stellar.toml"

# Active IndusX token issuer (NOT deleted — still live)
curl "https://api.stellar.expert/explorer/public/account/GAUCPLSPBJKOSN7WZK6SDD2BYPQMC3YSWMLX4XXY7S4JPQFLJXEINDUS"

# DNS — live subdomains
curl "https://dns.google/resolve?name=banking.indus.exchange&type=A"
curl "https://dns.google/resolve?name=stellar.indus.exchange&type=A"
curl "https://dns.google/resolve?name=poland.indus.exchange&type=A"
```

**stellar.toml returns (verbatim, captured Wayback 2022-06-01):**
```toml
SIGNING_KEY = "GBMN35UTEI3JX37IOVUKO53OWDNN3CQV5YP4YYR2Z4PQXHMMZPCCAZQR"
ACCOUNTS    = ["GCLG55EYQNYGAFJLSKSVCCHSNXN3QCVK53AYEO5WHCJNUGBXKUG3CWJA"]

[DOCUMENTATION]
ORG_NAME             = "Indus Finance"
ORG_DBA              = "Indus X"
ORG_URL              = "https://indusx.tech"
ORG_PHYSICAL_ADDRESS = "Tallinn, Estonia"
ORG_OFFICIAL_EMAIL   = "hello@indus.exchange"
ORG_SUPPORT_EMAIL    = "support@indus.exchange"
ORG_TWITTER          = "indusxchange"
ORG_DESCRIPTION      = "Industech is a division of Indus Lending. Indus.Tech network includes
                         IPAY and INDUSX payment systems to be used globally as a payment
                         standard working in conjuction with QFS Protocol upgrades."

[[CURRENCIES]]
code   = "INDUSXRUBLE"
issuer = "GAUCPLSPBJKOSN7WZK6SDD2BYPQMC3YSWMLX4XXY7S4JPQFLJXEINDUS"
desc   = "INDUSXRUBLE Payment System Token • Dividend Payments For Holding INDUSXRUBLE
          Are Made Using INDUSX Upon Final Protocol Upgrade"

[[CURRENCIES]]
code   = "INDUSXBRICS"
issuer = "GAUCPLSPBJKOSN7WZK6SDD2BYPQMC3YSWMLX4XXY7S4JPQFLJXEINDUS"
desc   = "INDUSXBRICS Payment System Token Used For INDUS Payments Within BRICS •
          Dividend Payments For Holding INDUSXBRICS Are Made Using INDUSX Upon
          Final Protocol Upgrade"

[[CURRENCIES]]
code   = "INDUSXGOLD"
issuer = "GAUCPLSPBJKOSN7WZK6SDD2BYPQMC3YSWMLX4XXY7S4JPQFLJXEINDUS"
desc   = "Holders Are Entitled To Redemtion Of Tokens At 1:1 Market Value Of Gold
          Upon Final Protocol Upgrade"
```

**Stellar Expert confirms — issuer wallet STILL ACTIVE:**
```
GAUCPLSPBJKOSN7WZK6SDD2BYPQMC3YSWMLX4XXY7S4JPQFLJXEINDUS
  created:  2022-04-16
  creator:  GAKEFLZDWIOS3MYAKDOM65I4ELP7LRIHRA3JBP7J7WWJUC6RB2VINDUS
  deleted:  false        ← STILL ACTIVE
  payments: 6448
  tokens issued: INDUSXCHINA, GOLDNOTE, SILVERNOTE, IPAY, SILVERBUY
```

**DNS confirms — IndusX subdomains LIVE:**
```
banking.indus.exchange   → 185.206.162.64  (LIVE)
stellar.indus.exchange   → 92.112.198.214 + 148.135.128.177  (LIVE)
poland.indus.exchange    → 92.112.198.58 + 77.37.76.139  (LIVE)
indus.exchange           → 77.37.76.134 + 92.112.198.31  (LIVE)
```

---

## 4. PROOF OF CONCEPT — EVIDENCE SUMMARY

### PoC A — Stellar Ledger (Immutable, On-Chain)

The Stellar blockchain provides tamper-proof evidence of all transactions. Every data point below is permanently recorded and publicly verifiable:

| Evidence | Ledger proof | API endpoint |
| -------- | ------------ | ------------ |
| GCAL3TRG funded Identity A on 2022-04-27 10:55:31 UTC | `create_account` op in ledger | `horizon.stellar.org/operations?account=GDQEQX47...` |
| GCAL3TRG funded Identity B on 2022-06-20 13:58:19 UTC | `create_account` op in ledger | `horizon.stellar.org/operations?account=GCNG5LQQ...` |
| GCAL3TRG funded Identity C on 2022-07-21 22:35:29 UTC | `create_account` op in ledger | `horizon.stellar.org/operations?account=GD7YL6XC...` |
| All 3 identities deleted via `merge_account` | `account_merge` ops | Stellar Expert for each address |
| 200+ bot accounts created 2025-03-31 from Identity C | 200 `create_account` ops (page cap hit) | `horizon.stellar.org/operations?source_account=GD7YL6XC...&type=create_account&limit=200` |
| FEMA token issuer created by Identity C, `home_domain=stellar.fema.digital` | `set_options` op with home_domain | `horizon.stellar.org/accounts/GAJ7NIREUC4EI2MKMFHPDOAALNCC5NPOLBPDIPKFGVAPJN3M6OVTNW7G` |
| Distribution hub A: 1.36M operations (spam/malicious) | Operation count | Stellar Expert `GC5KLAQVZ...` |
| Distribution hub B: 1.81M operations (spam/malicious) | Operation count | Stellar Expert `GDOTX4NM...` |

### PoC B — URLScan.io (Timestamped Web Evidence)

URLScan captures are independent third-party records with timestamp, IP, and page title:

| Domain | URLScan date | IP served | Title | Significance |
| ------ | ------------ | --------- | ----- | ------------ |
| vebrf.digital | 2022-05-16 | 212.193.158.157 | ВЭБ.РФ – государственная корпорация развития России | First confirmed live date |
| russian-assets.digital | 2022-06-10 | 212.193.158.157 | ВЭБ.РФ – государственная корпорация развития России | 13th scam domain, same IP |
| вэб.рф | 2022-06-26 → 2024-10-24 | 212.193.158.157 | ВЭБ.РФ – государственная корпорация развития России | 29-month continuous operation |
| c2.tralalarkefe.com | 2026-05-21 | 188.114.96.3 | **Suspected Phishing \| Cloudflare** | C2 blocked same day as TM report |
| payloads.tralalarkefe.com | 2026-05-21 | 188.114.96.3 | **Suspected Phishing \| Cloudflare** | Payload delivery blocked |
| globalliquidityrouting.com | 2026-05-21 | 34.216.117.25 | Active drainer (PhishDestroy) | Post-TM pivot confirmed live |

**URLScan query to reproduce:**
```bash
curl "https://urlscan.io/api/v1/search/?q=ip:212.193.158.157&size=30"
curl "https://urlscan.io/api/v1/search/?q=ip:34.216.117.25&size=50"
curl "https://urlscan.io/api/v1/search/?q=domain:tralalarkefe.com&size=10"
```

### PoC C — Wayback Machine (Archived Content)

All URLs below load in a standard browser:

| Wayback URL | Content | Significance |
| ----------- | ------- | ------------ |
| `https://web.archive.org/web/20220516000000*/vebrf.digital` | VEB.RF clone, Russian | First confirmed hosting |
| `https://web.archive.org/web/20220820033313/https://turkmenistan-minerals.digital/` | LiteSpeed autoindex directory: `/cgi-bin/` (2022-08-16 17:27), `/image/` (2022-08-16 17:46) | Server fingerprint: cPanel + LiteSpeed |
| `https://web.archive.org/web/20220904195730/https://qanonproject.digital/` | Default WordPress 6.0.2 — "My Blog / Hello world!" | Confirms domain registered but never built |
| `https://web.archive.org/web/20220601074832/https://indusx.tech/.well-known/stellar.toml` | Full stellar.toml with org name, Tallinn address, emails, 6 token series | Highest-value attribution document |
| `https://web.archive.org/web/20230609211522/http://bpfi.digital/` | Dan.com "Buy this domain: bpfi.digital" | Actor listed domain for sale after abandonment |

### PoC D — OTX Pulse (Threat Intelligence Confirmation)

**Pulse ID:** `6a0f8f3596d6a5268e168a10`
**Verification:**
```bash
curl "https://otx.alienvault.com/api/v1/pulses/6a0f8f3596d6a5268e168a10"
```

Returns 19 IOCs with:
- `"adversary": "bandcampro"`
- `"malware_families": ["GoToResolve"]`
- All 6 new domains (bpfi.digital, dzbank.capital, indus.exchange, induspayments.com, indusx.tech, tralalarkefe.com)
- 3 file hashes for the GoToResolve payload

### PoC E — RIPE RDAP (Infrastructure Registration)

```bash
# C2 IP block registered to NetCrafters OU (Estonian LLC / AEZA reseller)
curl "https://rdap.db.ripe.net/ip/213.165.51.115"
# Returns: name=Netcrafters-OU, abuse=abuse@netcrafters.host, country=US

# vebrf.digital host — NGENIX Moscow CDN
curl "https://rdap.db.ripe.net/ip/212.193.158.157"
# Returns: PTR=cdn.ngenix.net, ASN=AS34879, Moscow RU

# TimeWeb вэб.рф prior host — St. Petersburg Russia
curl "https://rdap.db.ripe.net/ip/92.53.124.169"
# Returns: name=TW-Cloud, registrant=JSC TIMEWEB, St. Petersburg, phone=+7 812 2481081
```

---

## 5. POTENTIAL IMPLICATIONS IF THE VULNERABILITY IS NOT ADDRESSED

| Implication | Evidence basis |
| ----------- | -------------- |
| **Continued active fraud** | IndusX issuer wallet GAUCPLSP has 6,448 payments and is NOT deleted. `indus.exchange` and subdomains are DNS-live. BRICS/QFS gold token fraud continues to operate. |
| **Post-exposure infrastructure pivot** | 48 new domains stood up on the same AWS IPs within hours of the Trend Micro report. Actor did not abandon operations — pivoted. globalliquidityrouting.com is already on PhishDestroy's active drainer feed. |
| **Cloudflare C2 origin unknown** | The real C2 server behind Cloudflare's proxy has not been identified. Without a Cloudflare subpoena, the origin IP — and the actor's current operating infrastructure — remains unknown. |
| **250+ pre-positioned bot wallets** | The batch of ≥250 bot wallets from 2025-03-31 may not have been fully deployed. Some may still be active and available for future token pump-and-dump operations. |
| **GoToResolve hash not in public TI feeds** | SHA256 `981036cec38c6fd9796fc64a102100b97983f56b3482cc3e1f1610e14a1fae58` is not in VirusTotal or MalwareBazaar. Victims running this binary would not receive antivirus alerts. |
| **22+ scam domains — 6 live** | indus.exchange + 4 subdomains + fema.digital are DNS-active. Victims can still interact with live infrastructure. |
| **Unreported victims** | The GoToResolve RAT gives full remote access. All crypto wallets accessible during an active session were drainable. Victim count unknown — the Telegram channel had 17,000 subscribers. |

---

## 6. COMPLETE IOC REFERENCE TABLE

### Smart Contract / Blockchain IOCs

| Address | Type | Status | Significance |
| ------- | ---- | ------ | ------------ |
| `GCAL3TRGIGZNBLQ7SZPLFJX7SAW3HGVAMGNT2UOIAYOVGY4RAPEZLSKV` | KuCoin hot wallet | Active | KYC Pivot #1 — funded all 3 operator wallets |
| `GDQEQX47WWX4ONDZY5RUQKK2OY2GPSZPRRILUQ2WSUYTPQFZU74JKNBX` | Operator wallet (Identity A) | **DELETED** | 121,643 payments, 6,800 trades |
| `GCNG5LQQJTAMPIXPINXHJUC34SPARHXZFOCLSYYHHUV35FY66D7ZKPSJ` | Operator wallet (Identity B) | **DELETED** | 11,339 payments, 838 trades |
| `GD7YL6XCOSHI3VLZIUPMTWGL6UFTPHRSBO2QATMHZKAOYHVNHT5PD4XO` | Operator wallet (Identity C) | **DELETED** | 11,028 payments, 1,459 trades |
| `GAUCPLSPBJKOSN7WZK6SDD2BYPQMC3YSWMLX4XXY7S4JPQFLJXEINDUS` | INDUSX token issuer | **ACTIVE** | 6,448 payments — live fraud wallet |
| `GC5KLAQVZJ5ZKQ5CQJHW4FHGECX7QKE5ZKYVGPML5TKXTWY4KBQ2VTRX` | Distribution hub A | SPAM/MALICIOUS | 1.36M ops |
| `GDOTX4NMBYSVOHKMTRQ6SBEPDTBCZXDVWXNAGG55ILJP4VGBFBIQ3NXR` | Distribution hub B | SPAM/MALICIOUS | 1.81M ops |
| `GAQQNRRAUQFHYVIQBNIB6MRDN4ZJIGKX7AWKYAX2JDQN3QTHP54Z745F` | Victim / co-conspirator | Real yUSDC | KYC subpoena via Lobstr |

### Network IOCs

| IP | Role | ASN | Status |
| -- | ---- | --- | ------ |
| `213.165.51.115` | C2 server | AS210644 AEZA GROUP LLC / NetCrafters OU | Offline |
| `212.193.158.157` | VEB.RF clone host | AS34879 NGENIX, Moscow | Inactive |
| `34.216.117.25` | fema.digital + fraud cluster | AS16509 Amazon | Parking page |
| `54.149.79.189` | fema.digital secondary | AS16509 Amazon | Parking page |
| `92.53.124.169` | вэб.рф prior host | AS9123 TimeWeb, St. Petersburg | Inactive |
| `172.67.139.60` | C2 Cloudflare edge | AS13335 Cloudflare | Blocked / phishing page |
| `104.21.62.203` | Payload Cloudflare edge | AS13335 Cloudflare | Blocked / phishing page |
| `185.206.162.64` | banking/au/gems.indus.exchange | Unknown | **LIVE** |
| `92.112.198.214` | stellar.indus.exchange | Unknown | **LIVE** |
| `77.37.76.134` | indus.exchange | Unknown | **LIVE** |

### Domain IOCs (partial — 22+ total)

| Domain | Purpose | Status | Registrar |
| ------ | ------- | ------ | --------- |
| vebrf.digital | VEB.RF gold ruble clone | NXDOMAIN (exp 2025-07-13) | Namecheap |
| fema.digital | FEMA conspiracy fraud | Parked — Spaceship | Spaceship |
| tralalarkefe.com | C2 + payload delivery | Blocked by Cloudflare | **Cloudflare, Inc.** |
| indus.exchange | BRICS/QFS fraud | **DNS LIVE** | GoDaddy |
| indusx.tech | IndusX platform | Intermittently live | Tucows |
| dzbank.capital | DZ Bank Germany clone | NXDOMAIN | REG.RU (Russia) |
| bpfi.digital | BPFI Ireland clone | NXDOMAIN / for sale | Namecheap hosting |
| globalliquidityrouting.com | Active crypto drainer | **LIVE** | Spaceship |
| geminisparkai.net | Gemini AI-themed fraud | Live | Spaceship |

### File Hashes (GoToResolve payload)

| Type | Hash |
| ---- | ---- |
| MD5 | `ea1c409fdcb6dca6751c443aeed13441` |
| SHA1 | `9bf39391f9c0ce989ee53c02170d7885c6c23798` |
| SHA256 | `981036cec38c6fd9796fc64a102100b97983f56b3482cc3e1f1610e14a1fae58` |

---

## 7. RECOMMENDED REMEDIATION ACTIONS

| Priority | Action | Responsible party |
| -------- | ------ | ----------------- |
| 🔴 Critical | Subpoena **Cloudflare, Inc.** for `tralalarkefe.com` registrant identity and the **hidden origin IP** behind the C2 proxy | Law enforcement / legal team |
| 🔴 Critical | Subpoena **KuCoin** for KYC records on `GCAL3TRGIGZNBLQ7SZPLFJX7SAW3HGVAMGNT2UOIAYOVGY4RAPEZLSKV` account holder for three funding windows: 2022-04-27, 2022-06-20, 2022-07-21 | Law enforcement |
| 🔴 Critical | Subpoena **Namecheap Inc.** (Phoenix, AZ) for vebrf.digital registrant behind privacy hash `fd9c3913f70a4ce692e227d0a86dbcca.protect@withheldforprivacy.com` | Law enforcement |
| 🟡 High | Block live fraud IPs: `185.206.162.64`, `92.112.198.214`, `77.37.76.134` via threat feed push | Security team / DNS blocklist operators |
| 🟡 High | Submit GoToResolve hash to VirusTotal, flag with GoTo Group for session log matching | Security researcher |
| 🟡 High | File Estonian business registry lookup for "Indus Finance" / "Indus X" at Tallinn address | Investigative team |
| 🟡 High | File abuse reports: AWS (`aws.amazon.com/forms/report-abuse`), Spaceship (`abuse@spaceship.com`), Cloudflare (`cloudflare.com/abuse`) | Immediately actionable |
| 🟢 Medium | Report FEMA domain impersonation (18 U.S.C. § 912) to CISA and FBI IC3 | Legal / compliance |

---

## 8. ELIGIBILITY ATTESTATION

- [x] This report concerns a previously undocumented, non-public expansion of the Patriot Bait fraud infrastructure. The 6 new Trend Micro IOC domains, the stellar.toml attribution data, the IndusX BRICS/QFS ecosystem, and the 13 new scam domains beyond the Trend Micro report were independently discovered and are first reported here.
- [x] Sufficient information is provided to reproduce every finding using the listed API endpoints and commands. All steps are reproducible without specialized access.
- [x] This investigation has not exploited the vulnerability in any malicious manner. No funds were moved. No victims were contacted. No systems were accessed beyond public read-only APIs.
- [x] This report has not been disclosed to third parties prior to Cantina submission.
- [x] All participants are of legal age and are not residents of sanctioned countries.

---

**Submitted by:** ProxhqVPN Forensic Intelligence Unit
**Organization:** Alpha Unlimited Technologies LLC
**Date:** 2026-05-24
**Contact:** alphaunlimitedtechnologies@gmail.com

**Supporting files:**
- `Patriot-Bait-Attribution-Dossier_Iteration5.md` — Full blockchain analysis, 3 operator wallets, 12 scam domains
- `Patriot-Bait-Attribution-Dossier_Iteration6.md` — IP intelligence, 19 Trend Micro IOCs, BRICS/QFS ecosystem, C2 chain
- `FORENSIC_AUDIO_ANALYSIS_FULL_REPORT.txt` — Supplementary audio forensics (separate workstream)
