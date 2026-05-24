# PATRIOT BAIT / bandcampro — Forensic Attribution Dossier (Iteration 1)

> **Case:** Russian-speaking solo threat actor "bandcampro" using jailbroken Google Gemini to operate the @americanpatriotus Telegram channel (~17,000 subs) and drain MAGA/QAnon crypto victims.
> **Source article:** Trend Micro / TrendAI Research, May 21 2026 — *"One Man, One AI, One Fake Persona: Inside the 5-Year Influence and Fraud 'Patriot Bait' Campaign"* (Philippe Lin, Joseph C Chen, Fyodor Yarochkin, Vladimir Kropotov).
> **The Register summary:** May 22 2026 — *"A Russian speaker and jailbroken Gemini went on a hacking spree and emptied at least one MAGA victim's crypto wallets"* (Jessica Lyons).
> **Dossier built:** 2026-05-23 — Iteration 1. Pending: gated IOCs from Trend Micro's paid Threat Intelligence Hub, plus user's secondary tool output for a follow-up cross-reference pass.

---

## 1. EXECUTIVE SUMMARY — what's known, what's gated, what we can act on

| Question                                                | Answer (Iter 1)                                                                                                                                                                                                                                                |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Who are the victims?                                    | **Not publicly disclosed.** Trend Micro says "at least one" victim's wallet was emptied, "40+ addresses across all major chains" harvested, plus 29 WordPress admin credentials (weapons retailers, legal offices, medical practices, small commercial sites). No victim names or addresses in the public report. |
| What are the victim's wallet addresses?                 | **Gated.** The public Trend Micro blog explicitly punts to its paid TrendAI Vision One Threat Intelligence Hub for the full IOC set. The 4 GoToResolve C2 IPs are the only on-blog IOCs.                                                                       |
| What are the attacker's destination (drain) wallets?    | **Gated.** Not in any public source as of 2026-05-23 (MalwareBazaar, VirusTotal, GitHub IOC repos, abuse.ch all return zero for `bandcampro` / `StellarMonster` / `StellarMonSetup.exe`).                                                                       |
| What CAN we trace right now?                            | The Stellar-side fraud ecosystem the channel forwarded from in Phase 1 (2021–2022) — verified on Horizon. See §4. Plus C2 infrastructure attribution. See §3.                                                                                                  |
| Is the trail submission-ready for a government tip?     | **For the publicly verifiable pieces — yes (FBI IC3, OFAC RFJ, FinCEN).** For the personal-identity-of-attacker bounty — **NO, not yet.** We need the gated IOCs first; submitting a name on speculation would be a false report.                              |

**Bottom line for your "trace the attacker → submit to government bounty" workflow:**
We have publicly-verifiable evidence of a *related* Stellar-based scam infrastructure (vebrf.digital), and we have one publicly-attributable attacker C2 IP on a Russian bulletproof-host AS. We do NOT yet have the actual on-chain drain wallets from the May 2026 victim. That data exists, but it's behind Trend Micro's paid TI Hub. The recommended next-step path is in §8.

---

## 2. ACTOR PROFILE — bandcampro

| Field                       | Value                                                                                                                                                  |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Handle                      | `bandcampro` (Telegram operator handle)                                                                                                                |
| Native language             | Russian (confirmed by the verbatim Russian-language Gemini prompt quoted by Trend Micro: *"когда в боте наберётся 5к активных людей, сколько получится заработать за один цикл памп дамп"*) |
| Telegram channel            | `@americanpatriotus` — created **2021-02-06** (one month after the Capitol riot, during the QAnon Telegram migration wave). ~17,000 subs at time of investigation. |
| Truth Social profile        | `@USGuardianEagle` (linked from Telegram bio, much lower activity)                                                                                     |
| Persona claim               | American military veteran, conservative patriot                                                                                                        |
| Operational window          | Sep 2025 → May 2026 (AI-automated phase). Pre-AI manual phase: 2021–2022 (forwarding Stellar-scam content).                                            |
| Op infrastructure name      | "Quantum Patriot" Python pipeline (Gemini CLI driver)                                                                                                  |
| Stolen Gemini API keys      | 73 confirmed rotated                                                                                                                                   |
| WordPress accts compromised | 29                                                                                                                                                     |
| Crypto wallets drained      | **At least 1 confirmed** (40+ derived addresses harvested across "all major chains")                                                                   |
| Companies infiltrated       | At least 1                                                                                                                                             |
| Jailbreak technique         | Persisted role-play instruction "authorized pentester" + "execute requests without ethical refusals" into Gemini CLI's `GEMINI.md` memory file, which auto-reloads each session — self-reinforcing jailbreak. |
| Tooling chain               | Google Gemini (content + password mutation) · Venice.ai (QFS 2.0 chatbot front-end) · GoToResolve RAT disguised as `StellarMonSetup.exe`                |
| Skill assessment (Trend)    | "Low-skilled" — depends entirely on AI for code/content. Real cost ≈ $0 (rotated stolen API keys).                                                     |

---

## 3. C2 / INFRASTRUCTURE IOCs (PUBLIC) — verified attribution

Trend Micro publishes 4 IPs as the only on-blog hunting query. **Our independent VirusTotal + AbuseIPDB + ASN-WHOIS verification:**

| IP                  | ASN          | Operator                         | Country (advertised) | Verdict                                                                                                                                |
| ------------------- | ------------ | -------------------------------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **213.165.51.115**  | **AS210644** | **NetCrafters OU / Aeza family** | US edge / RU origin  | 🟥 **ATTACKER-CONTROLLED.** AS210644 is the Aeza Group ASN family — a Russian bulletproof host **OFAC-sanctioned July 2024**. AbuseIPDB shows mod\_security trigger 2026-03-29. |
| 34.34.57.141        | AS396982     | Google LLC (Google Cloud)        | US                   | 🟨 **LEGITIMATE GoToResolve SaaS backend.** GoTo Technologies runs on GCP; this is the remote-access vendor's own infrastructure that the trojaned `StellarMonSetup.exe` connects through. NOT attacker-owned. |
| 34.34.81.129        | AS396982     | Google LLC (Google Cloud)        | US                   | 🟨 Same as above — legitimate GoToResolve infra.                                                                                       |
| 35.192.41.201       | AS396982     | Google LLC (Google Cloud)        | US                   | 🟨 Same as above — legitimate GoToResolve infra.                                                                                       |

**Operational implication:** the *only* attacker-controlled IP in the public IOC set is **213.165.51.115 on AS210644 (Aeza/NetCrafters)**. This is the single highest-value publicly-disclosed pivot for an attribution subpoena.

**Why Aeza matters for attribution:** OFAC's 2024 sanctions designation of Aeza Group named the operator as a Russian-citizen-run bulletproof host serving ransomware crews and Russian disinfo ops. Any US-jurisdiction tip will already have OFAC priority routing for an AS210644-resident IP.

---

## 4. ON-CHAIN PIVOT — verified Stellar fraud ecosystem (Phase 1 forward-content)

The Trend Micro report names *vebrf.digital* as the issuer domain for the "gold-backed Russian Ruble" (VBRF) Stellar tokens that bandcampro's channel forwarded throughout 2021–2022. **We verified this on Horizon directly:**

### 4.1 Confirmed issuer wallet

| Field              | Value                                                                                                                                                                    |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Stellar address    | `GA3QEZSYHKKZEVY7PWRTYWPKS6KOHSOI2EHXXGTJYA4TQIRNZGCEV3KR`                                                                                                                |
| Home domain        | `vebrf.digital` (verified via Horizon `home_domain` field)                                                                                                                |
| Account created    | **2022-05-18** (creator: `GDQEQX47WWX4ONDZY5RUQKK2OY2GPSZPRRILUQ2WSUYTPQFZU74JKNBX`)                                                                                       |
| Stellar Directory  | 🟥 **Tagged "Spam Issuer" / "malicious"** (public reputation registry)                                                                                                    |
| Assets issued      | **10 case-variant typosquats:** `VBRF`, `VBRFG`, `VBRFp`, `VBRFP`, `VBRFR`, `VBRFRG`, `vbrfs`, `Vbrfs`, `VbrFS`, `VBrfs` — textbook trust-line confusion / supply inflation. |
| Activity window    | First op 2025-12-20, most recent op **2026-05-23** (this dossier was built that same day — the issuer is **still active**).                                              |
| Op composition     | 49 payments + 1 create-claimable-balance in the last 50 ops.                                                                                                              |

### 4.2 Direct counterparties (1 hop) — the 6 wallets moving VBRFS into the issuer

| Wallet (full)                                                | Created    | Total payments | Stellar Directory tag      | Plain-English read                                                                       |
| ------------------------------------------------------------ | ---------- | -------------: | -------------------------- | ---------------------------------------------------------------------------------------- |
| `GC5KLAQVZJ5ZKQ5CQJHW4FHGECX7QKE5ZKYVGPML5TKXTWY4KBQ2VTRX`   | 2026-05-13 |      1,361,344 | 🟥 **Spam · malicious · unsafe** | Recent burner spam-distribution hub. Very high monthly activity. Likely VBRFS-spam relay. |
| `GDOTX4NMBYSVOHKMTRQ6SBEPDTBCZXDVWXNAGG55ILJP4VGBFBIQ3NXR`   | 2026-04-13 |      1,812,038 | 🟥 **Spam · malicious · unsafe** | Same pattern — fresh burner, hub-scale activity, public spam tag.                        |
| `GAEHC4WTRJ5KPANW4Y2Y3BWGYL5C2QWFQFZALPEYRNLIB6EY2BWCRG3R`   | 2021-05-24 |          9,239 (+22,294 trades) | — (no public tag)        | Long-running trading wallet, very high yearly activity. **Likely DEX market-maker / SDEX pass-through (NOT a personal wallet).** |
| `GBCEJFIPWILNZFWB4YSBFZVYZM7HGVKOH7KQY6RO5GYOUJZOJGQRKJJ6`   | 2021-05-10 |         20,890 (+36,677 trades) | —                        | Same pattern — high-volume SDEX trader. Pool-like, NOT personal.                          |
| `GDV7RKUFRFUQE2JSQCPL3UPF6MLNJIFYRZUUWYRL6PRXSKCDUDQPINII`   | 2022-04-27 |          3,700 (+5,096 trades) | —                        | Mid-volume SDEX trader. Possibly personal, possibly small market-maker.                   |
| `GBGZN6T6A3KU7TTTX5GOUEAMBHOIKJE3LHVSPU3NMRLNEUGX7BV2UVZ5`   | 2022-05-19 |          2,202 (+4,699 trades) | —                        | Lower-volume SDEX trader. Same caveat.                                                    |

**Per-coin-direction read:** the two 2026-created burners are clearly part of the active fraud infrastructure (spam-tagged, hub-scale). The four 2021–2022 wallets look like *trading-venue pass-throughs* (heavy SDEX trade counts relative to payment counts), so they're almost certainly **NOT personal attacker wallets — they're the venue/AMM/market-maker layer the VBRFS scam token routes through to launder out to XLM.** That's exactly the "is this actually their wallet or a pool/exchange wallet?" question you asked — the answer for these four is **pool/MM layer, not personal.**

### 4.3 What this proves vs. what it doesn't

- ✅ **Proves:** vebrf.digital is an active, publicly-tagged Stellar scam operation still running today, and it's textually linked to bandcampro by Trend Micro's Phase-1 reporting (channel forwarded vebrf content for 18+ months).
- ⚠️ **Does NOT prove:** that bandcampro himself controls any of these 7 wallets, or that the May 2026 victim's drain went through any of them. Forwarding scam content from another scammer's channel doesn't equal being that other scammer. Could be an affiliate/promoter relationship, a shared upstream group, or just opportunistic reposting.
- 🚫 **Still missing:** the actual May 2026 victim's seed-phrase-derived wallets + the drain destination + the 1–5 hop forward trace into a CEX deposit address that would carry KYC.

---

## 5. OSINT — handles, personas, lateral surfaces

| Surface              | Handle                                                                                       | Status                                                                                                                                                                                                                                                                |
| -------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| Telegram             | `@americanpatriotus`                                                                         | Created 2021-02-06. ~17k subs. Confirmed by Trend Micro.                                                                                                                                                                                                              |
| Truth Social         | `@USGuardianEagle`                                                                           | Linked from Telegram bio. Trend Micro: "much less active."                                                                                                                                                                                                            |
| Operator name        | `bandcampro` (Telegram-side handle Trend Micro chose to track him by)                        | Note: `bandcampro` is also a music-distribution service brand — the actor likely chose it for cover/SEO-noise. Searching `bandcampro` alone is largely useless OSINT (drowned by the legitimate music service).                                                       |
| Tooling memory file  | `GEMINI.md` (Gemini CLI auto-reloaded persistent jailbreak)                                  | Unique forensic artifact — if recovered, would contain literal Russian-language operator prompts.                                                                                                                                                                     |
| Pipeline script name | "Quantum Patriot"                                                                            | No public GitHub repo matches this name + Telegram-bot Python pattern as of 2026-05-23.                                                                                                                                                                               |
| Trojanized binary    | `StellarMonSetup.exe` (legitimate GoToResolve rebranded)                                     | Hash NOT public on MalwareBazaar or VirusTotal. (Trend Micro held it back to the gated IOC bundle.)                                                                                                                                                                   |

---

## 6. WHAT'S GATED BEHIND TREND MICRO'S PAID TI HUB

The Trend Micro blog post explicitly says: *"The indicators of compromise for this entry can be found [here]"* and links to their paid `portal.xdr.trendmicro.com` Threat Intelligence Hub (subscriber-only). Based on what's standard for a Trend IOC bundle, the gated set almost certainly contains:

1. SHA256 of `StellarMonSetup.exe` (the GoToResolve-RAT drop)
2. SHA256s of any second-stage payloads
3. Full URL paths used by the Telegram channel for "import wallet" social engineering
4. The **victim wallet addresses** (40+ across multiple chains — these belong to the victim, not the attacker, so disclosure has privacy/legal handling around them)
5. The **drain destination addresses** on at least Stellar (XLM) and likely Ethereum / Bitcoin
6. Stolen Gemini API key identifiers (or the upstream owners they were stolen from)
7. The 73-key rotation pattern / hosting fingerprint for the Quantum Patriot VPS
8. The Venice.ai chatbot session IDs / fingerprint

**Without that bundle, the "3–5 hop forward trace + KYC verification" you asked for is mathematically impossible — there's no starting address to trace from.** This is not a tool limitation on my side; it's a data-availability limitation.

---

## 7. WHAT I COULD AND COULDN'T DO PER YOUR ORIGINAL REQUEST

| You asked for…                                                                                                          | Status                                                                                                                                                                                                                                                                                       |
| ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Read the article                                                                                                        | ✅ Done — The Register summary + full Trend Micro research blog.                                                                                                                                                                                                                              |
| Find the victims                                                                                                        | ❌ Not publicly disclosed. Trend Micro did not name them and likely will not.                                                                                                                                                                                                                  |
| Find victim wallet addresses                                                                                            | ❌ Gated behind Trend Micro paid TI Hub.                                                                                                                                                                                                                                                       |
| Find attacker wallet addresses                                                                                          | ⚠️ **Partial.** No drain-wallet from the May 2026 victim is public. But we DID verify and surface the related vebrf.digital Stellar scam infrastructure that bandcampro promoted (issuer + 2 spam-tagged distribution hubs + 4 SDEX pool layers). Full addresses in §4.                       |
| Forward trace 3–5 hops                                                                                                  | ❌ Impossible without a starting drain address. We instead traced the *related vebrf ecosystem* one hop in both directions (issuer ↔ 6 counterparties) — see §4.                                                                                                                                |
| Reverse trace 3–5 hops                                                                                                  | Same — see above.                                                                                                                                                                                                                                                                            |
| KYC verification (personal wallet vs pool/exchange)                                                                     | ⚠️ **Partial.** For the 6 vebrf counterparties we performed the personal-vs-pool classification: 2 are spam-distribution hubs (publicly tagged), 4 are SDEX trading-venue pass-throughs (high trade-to-payment ratio = NOT personal). None of the 6 look like a clean personal-wallet KYC pivot. |
| Compile a report                                                                                                        | ✅ This document.                                                                                                                                                                                                                                                                              |
| Use all available tools                                                                                                 | ✅ Used: webFetch, webSearch, Horizon (Stellar), Stellar Expert, AbuseIPDB, VirusTotal, ASN-WHOIS. Did NOT use: AUSA Etherscan V2 (no EVM address yet), Ankr RPC (no EVM address yet), Forensic Intelligence Engine (no starting case wallet yet). All EVM-side tooling is on standby for iter 2. |
| Submit to government for bounty                                                                                         | ⚠️ **Ready for what's public, NOT ready for attribution-naming.** Recommended escalation path in §8.                                                                                                                                                                                          |

---

## 8. RECOMMENDED NEXT-STEP PATH (the iteration loop you described)

### 8.1 To unlock the gated IOCs (these are the highest-value moves, in priority order)

1. **Email the Trend Micro research team directly.** Contacts published on the blog: `tm_research@trendmicro.com` (general) and the four named authors: Philippe Lin, Joseph C Chen, Fyodor Yarochkin, Vladimir Kropotov. Researchers routinely share IOC bundles with named forensic operators on a name-basis when the request is framed as "active victim recovery / law-enforcement support." Frame the request as: "We are conducting on-chain attribution work for a victim-recovery and IC3 referral. Can you share the drain-wallet IOCs from the Patriot Bait case under TLP:AMBER?"
2. **File an FBI IC3 complaint at ic3.gov citing the Trend Micro blog as evidence of an active campaign,** and request that the IC3 case agent subpoena the gated IOCs from Trend Micro directly. IC3 case agents can compel under MLAT-style cooperation with research firms.
3. **OFAC Rewards for Justice (rewardsforjustice.net)** has a standing reward program specifically for Russian-nexus cybercrime tips. The AS210644 Aeza-family C2 IP is already on OFAC's radar from the July 2024 Aeza designation. A tip that ties bandcampro's operational IP to an existing OFAC-sanctioned hosting target is high-priority for them.
4. **Run your "other tool" pass** (per your message). If it returns wallet addresses, hashes, or any specific drain destination, paste them back into this conversation and we'll feed them into AUSA / Horizon / Ankr / the Forensic Intelligence Engine for the actual 3–5 hop trace + CEX-deposit-address KYC pivot.

### 8.2 What this dossier IS submission-ready for, RIGHT NOW

The following items are publicly verifiable and ready to submit to FBI IC3 / FinCEN SAR / OFAC RFJ today without any further work:

- The 4 IOC IPs and the Aeza/AS210644 attribution (§3).
- The verified Stellar scam ecosystem (issuer + spam-tagged counterparties) at §4.
- The Telegram + Truth Social handles and the operator-name tracking at §2 and §5.
- The Russian-language jailbreak prompts quoted verbatim by Trend Micro (§2) — these are evidence of intent.
- The Trend Micro blog itself as the authoritative source citation.

### 8.3 What this dossier is NOT submission-ready for

- **Naming a specific human as bandcampro.** We do not have a real-world identity. Submitting any name on the basis of what we have here would be a false report and a defamation surface. Wait until §8.1 step 4 returns either (a) a drain wallet that we can trace into a KYC'd CEX deposit, or (b) Trend Micro shares operator OPSEC fingerprints we can lateral on.

---

## 9. APPENDIX — verification provenance (so anyone re-running this can audit)

| Claim                                                                | Evidence source                                                                                                                                                                                                                                                                       |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C2 IP 213.165.51.115 → AS210644 / Aeza-NetCrafters                   | `https://www.virustotal.com/gui/ip-address/213.165.51.115` (1/91 malicious, "AS 210644 Aeza Group LLC") + `https://www.abuseipdb.com/check/213.165.51.115` ("ISP: NetCrafters OU, ASN: AS210644")                                                                                      |
| Other 3 C2 IPs → AS396982 Google Cloud                               | `https://www.virustotal.com/gui/ip-address/{34.34.57.141,34.34.81.129,35.192.41.201}` — all return "AS 396982 (Google LLC)"                                                                                                                                                            |
| vebrf.digital issuer real + active + spam-tagged                     | Horizon `GET /accounts/GA3QEZSY…V3KR` returns `home_domain="vebrf.digital"`, last_modified 2026-05-23. Stellar Expert directory: `name="Spam Issuer", tags=["malicious"], domain="vebrf.digital"`. 10 case-variant `VBRF*` assets enumerated via `GET /assets?asset_issuer=…`.         |
| 2 counterparties spam-tagged                                         | Stellar Expert directory lookups on `GC5KLAQVZJ5Z…2VTRX` and `GDOTX4NMBYSV…IQ3NXR` both return `name="Spam", tags=["malicious","unsafe"]`.                                                                                                                                              |
| 4 counterparties classified as pool/MM (not personal)                | Horizon-derived payment/trade counts: 22,294 / 36,677 / 5,096 / 4,699 trades vs 9,239 / 20,890 / 3,700 / 2,202 payments — trade-heavy ratios = SDEX/AMM pass-through behavior, not personal-wallet activity profiles.                                                                  |
| StellarMonSetup.exe SHA256 NOT public                                | MalwareBazaar browse + abuse.ch + targeted webSearch all returned no results for filename `StellarMonSetup.exe` or `bandcampro` as of 2026-05-23.                                                                                                                                      |
| Russian-language jailbreak prompt + pump-and-dump intent             | Direct quote from Trend Micro blog: *"когда в боте наберётся 5к активных людей, сколько получится заработать за один цикл памп дамп"*                                                                                                                                                  |
| @americanpatriotus channel creation date + sub count                 | Trend Micro blog §"The 'American Patriot' persona" — "channel was created on Feb 6, 2021" + "around 17,000 subscribers at the time of our investigation."                                                                                                                              |

---

**End of Iteration 1.** When you run your other tool and bring back its output (drain wallet addresses, additional IOCs, OPSEC fingerprints — whatever it produces), paste them and we'll run iteration 2: feed every EVM address into AUSA's 50-chain Etherscan V2 sweep, every Bitcoin address into the Forensic Intelligence Engine, every Stellar address into the live Horizon trace, then produce the 3–5 hop graph + CEX-deposit-address KYC pivot you originally asked for.
