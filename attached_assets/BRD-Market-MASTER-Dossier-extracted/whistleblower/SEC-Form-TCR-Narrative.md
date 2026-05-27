# SEC Whistleblower Submission — Narrative for Form TCR
## Tip, Complaint, or Referral Regarding brdmarket.com and Affiliated Pig-Butchering Scheme

**Submitting program:** U.S. Securities and Exchange Commission Office of the Whistleblower
**Submission portal:** https://www.sec.gov/whistleblower
**Form type:** Form TCR (Tip, Complaint, or Referral)
**Authority:** Section 21F of the Securities Exchange Act of 1934 (Dodd-Frank §922)
**Drafted:** 2026-05-27

---

## Section A — Complainant information
*(To be completed by you OR your attorney. If filing anonymously through counsel, this section is completed by the attorney and the complainant remains pseudonymous.)*

- **Name**: [YOUR FULL LEGAL NAME]
- **State of residence**: [YOUR STATE]
- **Best contact email**: [YOUR EMAIL — use a dedicated whistleblower email, not personal]
- **Best contact phone**: [YOUR PHONE]
- **Are you represented by counsel?**: [Yes / No — if yes, attorney completes Section A on your behalf]
- **Do you wish to remain anonymous?**: [Yes — anonymous submission requires representation by an attorney per SEC rules]

## Section B — Subject(s) of the complaint

### Primary entity
- **Name as advertised**: "Brdmarket LIMITED" (claimed UK entity)
- **Primary website**: https://brdmarket.com
- **Hosting IP**: 185.27.133.17 (iFastNet shared reseller)
- **Hosting provider**: iFastNet (ns1082.ifastnet.com / ns2082.ifastnet.com)
- **Apparent shell user on server**: `getwayve` (leaked via Laravel Ignition stack trace at `/wallet` endpoint)
- **UK Companies House registration**: **NONE** — neither "Brdmarket Limited" nor any close variant is registered with the UK Registrar of Companies despite the public claim to be "operating in the UK"
- **Claimed business address**: "Suite ___, Katherine Street, Sandton" (Johannesburg, South Africa) — incomplete, no suite number, no postal code
- **Claimed contact phone**: literally "1234567890" — a placeholder, not a real number
- **Real operator phone (recovered from infrastructure)**: +44 1623 302190 (Mansfield, United Kingdom — geographic landline)
- **Admin email**: admin@brdmarket.com

### Affiliated entities operated by the same actor or actor group
Forensic infrastructure analysis (certificate transparency logs, reverse DNS, leaked server paths) identified **seven** confirmed sister fraud fronts sharing the same infrastructure footprint, Laravel template kit, SmartSupp live-chat keys, and/or iFastNet cPanel accounts:

1. **getwayventures.com** ("Gateway Ventures") — same IP, parent infrastructure
2. **i.getwayventures.com** — secondary front
3. **test.getwayventures.com** — operational dev environment (opsec failure)
4. **gbtrade-ltd.com** — same Laravel KYC kit (`/dashboard/kyc-form` → POST `/dashboard/verifyaccount`)
5. **mgrr.org.uk** — UK shell domain (NXDOMAIN as of 2026-05-27, torn down or never lived)
6. **onlintrade.com** — historical front, leaked in `/wallet` Laravel stack trace, now NXDOMAIN (suggests prior burn-and-rebuild cycle)
7. *(One additional front documented in Addendum A of the evidence package)*

The use of multiple parallel front domains served by shared infrastructure is itself probative of a coordinated commercial fraud operation rather than an isolated bad-faith broker.

### Suspect operating alias
- **TikTok alias**: "BigTrap" (account screenshot captured in evidence ZIP, exhibits 01-13)
- **Off-platform handle used during solicitation**: pushed complainant toward WhatsApp / Telegram for the bulk of the conversation (standard pig-butchering pivot to encrypted off-platform channels)

## Section C — Type of violation alleged

**Securities Exchange Act of 1934, Sections 10(b) and 17(a) — fraud in the offer or sale of securities, and use of manipulative or deceptive devices**, in connection with what the operator markets as a "crypto trading and investment platform" offering pooled returns of approximately 3–5% per day.

The pooled-return investment product offered on brdmarket.com meets the four-prong **Howey test** for an investment contract / security:
1. **Investment of money** — complainant invited to deposit $500 minimum via cryptocurrency
2. **In a common enterprise** — funds pooled with other "clients" of the operator
3. **With the expectation of profit** — explicit promise of 3–5% daily returns and case-study examples of "$5,572.34" weekly profits and "$50,000–$100,000 per month" returns
4. **Derived primarily from the efforts of others** — the operator-promoter ("BigTrap" or "your account manager") personally manages the funds; the depositor takes no active role

Because the offering is not registered with the SEC, the offer or sale itself is also a violation of **Section 5 of the Securities Act of 1933**.

## Section D — Description of conduct

### 1. Initial solicitation and false statements of material fact

On 2026-05-27 at approximately 09:29 device-local time, the suspect using the TikTok alias "BigTrap" initiated unsolicited contact with the complainant via TikTok direct message. The opening solicitation followed the textbook pig-butchering pattern: flattery, false personal rapport, and a pivoted "business opportunity" pitch. (Evidence: TikTok exhibits 01-04.)

The suspect represented, inter alia, that:
- Investors on the brdmarket.com platform earn approximately **3–5% per day** on deposited capital
- A typical client "made $5,572.34" in a recent payout cycle
- Monthly returns of **$50,000 to $100,000** are routine
- The platform is operated by a UK-regulated entity ("Brdmarket LIMITED, operating in the UK")
- Funds are protected by professional trading and an experienced "team"

Each of these representations is **demonstrably false**:
- A 3–5% daily compounded return equates to approximately 5,400× per year, an impossible figure with no historical precedent in any legitimate market
- The "client testimonial" payout figures are not corroborated by any audited or verifiable financial record
- **"Brdmarket LIMITED" is not registered with the UK Companies House** — direct lookup against the official UK Registrar produces no result for this name
- The claimed Johannesburg business address is incomplete (no suite number, no postal code) and the published contact phone is the placeholder string "1234567890"

### 2. Deceptive platform infrastructure

Independent forensic examination of brdmarket.com established additional material deception:

- The platform's `/contact` page contains a JavaScript function `generateRandomCountry()` that dynamically falsifies the country of supposed visitor testimonials in real time. **This is direct programmatic evidence of intentional deception** of prospective investors as to the geographic reach and legitimacy of the platform's user base.
- The platform offers an Android application (`brdapp.apk`) for direct sideload download, with **no equivalent iOS application and no presence on the Google Play Store**. Direct-APK distribution outside of vetted app stores is a known vector for credential-harvesting and SMS-interception malware.
- The platform's `/wallet` endpoint runs with Laravel debug mode enabled in production, exposing a full Ignition stack trace (~808 KB) that reveals filesystem paths, the operator's shell username, and references to a prior burned domain (`onlintrade.com`).
- The brdmarket.com domain was **re-activated in November 2025 after approximately 8 years of dormancy** (originally registered 2017, lapsed, re-purchased and re-pointed in 2025). The acquisition of aged dormant domains is a recognized pig-butchering operational pattern intended to defeat domain-age-based fraud heuristics.

### 3. KYC-gated personally-identifiable-information harvest (live captured)

The operator structures the platform such that the cryptocurrency deposit address is **never displayed** to any account until the user completes a 4-step "KYC" form that requires:
- Full legal name, date of birth, residential address, phone number, optional social media handle
- Selection of one of three government-issued ID types (international passport, national ID, or driver's license)
- Upload of **both the front and back** of the chosen ID document, accepted as JPG, PNG, or PDF up to 5 MB each

The form is captured live at exhibit `authenticated_probe_evidence/kyc_form_live_capture.html` in the evidence package. Three throwaway accounts were registered with disposable Mailinator email addresses to confirm that **zero verification emails of any kind** are sent by the platform (direct Mailinator API responses captured in Addendum C). The platform performs no email verification step that would substitute for the document upload.

The PII package harvested through this flow has independent dark-web resale value of approximately $100–$300 per victim ("fullz + ID scans") **before** any deposit is also extracted. This is consistent with a dual-revenue operational model in which the harvested PII is the primary product and the cryptocurrency deposit is a secondary product.

### 4. Off-platform pressure to commit funds and refusal to disclose deposit address before KYC

The suspect repeatedly attempted to move the complainant from TikTok to WhatsApp during the conversation. When the complainant asked clarifying questions about deposit mechanics and expressed reasonable privacy concerns about uploading government identification, the suspect alternated between standard scripted reassurance and periods of complete silence, consistent with a multi-mark-pipeline triage model in which difficult marks are deprioritized.

At no point during the captured conversation did the suspect disclose any cryptocurrency deposit address. The deposit address is gated behind the KYC document upload, by design, ensuring that no investor can transfer funds without first surrendering identity documents.

### 5. Critical security posture confirming intent

Authenticated probing of the brdmarket.com production environment confirmed the presence of **CVE-2021-3129**, an unauthenticated remote-code-execution vulnerability in the Laravel Ignition error handler. The endpoint `/_ignition/health-check` returns `{"can_execute_commands":true}` from the production server. (Full evidence in Addendum B of the evidence package.)

This was **not exploited** by the complainant or the complainant's forensic agent. It is reported here solely as material evidence of (a) the operator's complete indifference to investor data security, and (b) the operator's apparent technical incompetence inconsistent with the marketed image of a regulated professional brokerage. The vulnerability also provides an investigative-warrant pathway by which qualified law enforcement could lawfully obtain server-side records.

## Section E — Materiality and scale

### Victim count (estimated)
The operator's parallel front-domain count (≥7), the operator's pattern of cycling burned domains (`onlintrade.com` already burned, `mgrr.org.uk` torn down), and the standard pig-butchering operational profile (industry estimates: 30-100 simultaneous marks per operator persona) suggest a cumulative victim population in the **hundreds to low thousands** since the brdmarket.com domain was reactivated in November 2025.

### Dollar volume (estimated)
At the marketed $500 minimum deposit per victim, even a conservative estimate of 500 historical victims across all confirmed fronts produces a baseline scheme volume of **$250,000**. Realistic estimates incorporating average actual deposits (which in documented pig-butchering cases typically range from $5,000 to $50,000+ per victim once the "investment growth" psychology takes hold) produce scheme volumes in the **$2.5M – $25M+ range**. The FBI's 2024 IC3 report attributes more than **$5.6 billion in 2024 alone** to pig-butchering and related cryptocurrency investment-confidence schemes.

### Original-information criterion
The evidence package accompanying this submission includes original investigative work product not previously in the public domain, including:
- Live capture of the KYC harvest form from inside an authenticated session
- Direct Mailinator API confirmation of zero verification email traffic
- Identification of the operator's UK landline phone number (Mansfield, +44 1623 302190)
- Identification of three SmartSupp live-chat API keys linking sister fronts
- Identification of two distinct iFastNet cPanel accounts under operator control
- Discovery of CVE-2021-3129 RCE exposure on the production server
- Identification of seven sister fronts via cert-transparency and reverse-DNS pivots

This information **was not previously in the public domain or in any prior governmental or media report**, satisfying the SEC's "original information" criterion under Section 21F.

## Section F — Requested relief

The complainant requests:
1. Investigation by the SEC Office of Internet Enforcement and the Crypto Assets and Cyber Unit
2. Coordination with the U.S. Department of Justice for criminal referral
3. Coordination with the UK Financial Conduct Authority and UK National Crime Agency given the operator's apparent UK telephony presence
4. Coordination with the South African Financial Sector Conduct Authority given the false claimed Johannesburg business address
5. Disgorgement of investor funds and civil penalties
6. Consideration of this complainant for an award under Section 21F of the Securities Exchange Act, payable upon successful sanction of $1,000,000 or more in monetary sanctions

## Section G — Evidence package manifest

The complete evidence package is provided as `BRD-Market-MASTER-Dossier.zip` (11.2 MB, 69 files) and includes:
- Master dossier markdown (`BRD-Market-MASTER-Dossier.md`)
- Addendum A — Cross-Reference Findings (7 sister fronts, infrastructure correlation)
- Addendum B — Authenticated Probe Findings (CVE-2021-3129 RCE confirmation, authenticated dashboard captures)
- Addendum C — KYC-Form Definitive Evidence (live capture of PII-harvest form, zero-email-verification confirmation)
- 13 chronologically-ordered TikTok conversation screenshots with chain-of-custody INDEX.md
- Raw HTML captures of public-facing pages
- Raw HTML captures of authenticated dashboard pages
- Indicators of compromise (`iocs.json`, `iocs_master.json`)
- Certificate-transparency captures (`crt_*.json`)
- DNS and infrastructure pivot artifacts
- Registration-probe artifacts and throwaway-account credentials (for investigative reproducibility)

---

*This narrative is suitable for direct submission as the free-text "Description" attachment to SEC Form TCR. The Form TCR itself is a short electronic web form available at the SEC Whistleblower portal; this narrative attaches as a PDF or DOCX to the "Additional Information" section.*

---

## Section H — On-Chain Wallet Evidence (added 2026-05-27)

**Subject-supplied Bitcoin deposit address**: `bc1qy0e4jgq86w8kfdlvmlc4muahh35ss2hu0demat`

Provided by Subject "BigTrap" via TikTok DM at 17:12 UTC on 2026-05-27 in response to the complainant's request for deposit instructions. Chain-of-custody screenshots are filed as `tiktok_conversation_screenshots/15_…WALLET_HANDOVER.png` and `16_…WALLET_CONFIRM.png`.

**Address profile** (independently corroborated by Blockstream Esplora, Mempool.space, and Blockchain.info on 2026-05-27):
- Total received: 0.01722303 BTC (~$1,500 USD)
- Total spent: 0.01722303 BTC
- Current balance: 0.00000000 BTC
- Transaction count: 6 (3 incoming, 3 outgoing)
- First activity: 2026-04-08 — Last activity: 2026-05-21
- Behavior: pure burner / pass-through (zero hold time, 100% sweep to a single downstream consolidator)

**Forward trace** (full detail in Addendum E):
- All 3 outgoing transactions deposit to legacy P2PKH consolidator `1MBdcWEjPcdSwGLxtS3qaHahc4asVBii5g` (412 lifetime txs, 0.83 BTC throughput, 0.00 BTC current balance, all funds forwarded to only 3 downstream addresses).
- Those 3 downstream destinations are confirmed **CEX-owned internal hot-wallet infrastructure** (NOT scammer-owned destinations) — each receives from 8,000–11,000 unique senders in a 200-transaction sample, all three transfer 50–68 times to each other within that same sample (classic single-operator cold ↔ warm ↔ hot rotation), and lifetime volumes (1.10M / 1.17M / 11.97M BTC) are infeasible for any non-CEX actor. Pre-2018 legacy P2PKH format narrows attribution to older-generation exchange infrastructure (candidates: legacy Bitfinex, Bittrex, Poloniex, Huobi, HitBTC, OKX, Binance, or Coinbase). All such exchanges are subject to FinCEN MSB record-keeping under 31 CFR 1010.430.

**Backward trace**:
- Three incoming transactions to the target wallet are batch payouts with 92, 140, and 161 outputs respectively. Verified by sibling sampling (Annex II of Addendum E): these are **exchange withdrawal batches**, and approximately 53% of the sibling outputs are real-user-pattern wallets unrelated to the BRD Market operation. **No claim is made that the sibling addresses are scam-affiliated.** The operator's relationship to these transactions is as one customer-of-the-exchange whose withdrawal happened to be batched with ~100 unrelated other customers.
- Hop-2-back upstream funding originates at `bc1qujgkx8ldfqw2r2f4hn644n83y7uwue5vsf3rrx` — **1,805.59 BTC lifetime, 543 transactions** — likely the operator's exchange withdrawal account or pre-funding service.

**Significance for the SEC investigation**:
1. The on-chain evidence corroborates Section D's pig-butchering classification with **independently verifiable, non-repudiable blockchain data** — the burner-and-fan-in structure is the standard typology Chainalysis and TRM Labs use for pig-butchering attribution.
2. Three CEX-scale wallets sit one hop downstream of the cashout address. **The actionable subpoena target is the centralized exchange that operates the three hop-2 wallets** — the exchange's compliance team will confirm or deny ownership of each address upon Form 1661 (or equivalent) service. The subpoena should ask the exchange to identify the KYC-verified account(s) credited by deposits originating from `1MBdcWEjPcdSwGLxtS3qaHahc4asVBii5g` at these three timestamps: 2026-04-08 21:43 UTC (~$60), 2026-04-19 09:01 UTC (~$1,220), and 2026-05-21 00:40 UTC (~$215). These timestamps are unique enough to deterministically resolve to the credited account from the exchange's internal ledger. **This is the highest-value actionable lead in this filing.**
3. The materiality threshold for SEC whistleblower-award eligibility (≥ $1,000,000 in monetary sanctions) is supported by the scheme's targeting structure described in Section D — brdmarket.com is a public-facing platform soliciting deposits from any visitor, and the complainant's experience is consistent with a templated pig-butchering script run at scale. The on-chain evidence does NOT, by itself, establish a multi-victim count; that claim rests on the platform's public-solicitation conduct, not on the funding-batch siblings.
4. The complainant did not transact with the target wallet at any point — clean hands status preserved.

Raw block-explorer JSON for all hops is filed under `wallet_trace_raw_evidence/` in the evidence ZIP. See full analysis in Addendum E.
