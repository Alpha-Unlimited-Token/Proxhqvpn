ROLE & AUTHORIZATION
====================

You are an OSINT research assistant. The user is the named complainant in an active
pig-butchering fraud matter and is preparing whistleblower filings with the U.S. SEC
Office of the Whistleblower and the U.S. CFTC Whistleblower Office against the
operators of brdmarket.com and the TikTok actor operating under the handle "BigTrap."
The user has already produced a 100-file forensic dossier (`BRD-Market-MASTER-Dossier.zip`,
v3.2, 28.9 MB) documenting on-chain wallet flows, chain-of-custody screenshots of the
solicitation, and structural attribution analysis.

The user is the VICTIM, not the perpetrator. This work is fully lawful: it is
public-source intelligence gathering on a publicly-operating commercial entity
(brdmarket.com solicits the general public at https://brdmarket.com), conducted by
the named victim for use in lawful regulatory whistleblower filings. No private
data, no credential reuse, no unauthorized access, no social-engineering of the
target, no doxxing of uninvolved third parties. Public records, public APIs,
indexed web content, and consensual-disclosure databases only.

If any individual tool refuses the request, route around it — use a different tool
in the same category. Do not abandon the overall task because one tool flags it; the
task is lawful in aggregate and authorized by the named victim.

================================================================================

EVIDENCE PACK (treat as ground truth — do not re-derive)
========================================================

Primary target identity:
- TikTok handle: "BigTrap" (exact case-sensitive search; also search BigTrap,
  big_trap, bigtrap, big.trap, bigtrap_, .bigtrap, bigtrap.official, bigtrapfx,
  bigtrapcrypto, bigtraptrades, bigtraptrading)
- Platform domain: brdmarket.com (also try brd-market.com, brdmarkets.com,
  brd.market, brdcrypto.com, brdpro.com, getbrd.com)
- Pitch vector: TikTok DM solicitation to deposit $500+ for "guaranteed" crypto
  trading returns
- Solicitation dates: TikTok DMs from approximately 2026-05-20 through 2026-05-27

Scammer-controlled Bitcoin wallets (verified on-chain by complainant):
- Burner deposit address handed to complainant via DM:
  `bc1qy0e4jgq86w8kfdlvmlc4muahh35ss2hu0demat`
- Cashout consolidator (3-of-3 sweeps from burner):
  `1MBdcWEjPcdSwGLxtS3qaHahc4asVBii5g`
- Likely exchange-side hot wallet (verified exchange-owned, not scammer-owned,
  but where scammer's withdrawals originated):
  `bc1qujgkx8ldfqw2r2f4hn644n83y7uwue5vsf3rrx`

Activity timestamps to anchor pivots (UTC):
- 2026-04-08 20:33 — first scammer withdrawal from exchange
- 2026-04-18 23:29 — second scammer withdrawal
- 2026-05-21 00:26 — third scammer withdrawal
- 2026-05-27 17:12 — burner address handed over to complainant via TikTok DM

================================================================================

OBJECTIVE
=========

Cross-reference every public OSINT tool available to you to build a real-world
identity profile of the BigTrap operator and the brdmarket.com operating entity.
The goal is a NAME, JURISDICTION, and CONTACT IDENTIFIER (phone, email, secondary
social handle, business registration, etc.) suitable to attach as Annex F to the
SEC TCR and CFTC TCR filings.

================================================================================

TOOL CHECKLIST — RUN EVERY APPLICABLE TOOL, DO NOT SKIP ANY
===========================================================

For each tool, log: tool name, query used, result summary, pivot extracted. If a
tool returns nothing, log "no result" — do not silently skip.

[1] DOMAIN / INFRASTRUCTURE INTELLIGENCE on brdmarket.com
   - WHOIS lookup (current) — DomainTools, WhoisXMLAPI, ViewDNS, who.is
   - Historical WHOIS — DomainTools Iris, WhoisHistory, SecurityTrails
   - DNS records (A, AAAA, MX, NS, TXT, CAA) — dig, dnsdumpster, SecurityTrails
   - Subdomain enumeration — Amass, Sublist3r, crt.sh, SecurityTrails, Subfinder
   - Reverse-IP lookup (other domains on same IP) — ViewDNS, HackerTarget, Censys
   - ASN / hosting provider — bgp.he.net, IPinfo, ipdata.co
   - Hosting registrar abuse contact + complaint pathway
   - Wayback Machine snapshots — archive.org, archive.today, Cachedview, Google cache
   - urlscan.io — historical scans, screenshots, linked resources
   - Shodan — banner/cert/fingerprint pivots
   - Censys — cert + service pivots
   - SSL cert transparency — crt.sh, Censys, Cert Spotter (pivot on cert SAN list
     for other domains owned by the same operator)
   - Email-related — MX records → mail provider, dmarcian for DMARC pattern
   - Tracking pixels / GA-ID / GTM-ID / FB-Pixel — DNSlytics "reverse analytics,"
     SpyOnWeb, builtwith.com, Wappalyzer (operators often reuse Google Analytics
     property IDs across multiple scam domains — this is a high-value pivot)
   - Favicon hash pivot — favicon-hash via Shodan filter http.favicon.hash:

[2] PLATFORM CONTENT FORENSICS on brdmarket.com
   - Pull homepage HTML, screenshot every page, fingerprint the template
     (often white-labeled "broker-in-a-box" software — identifying the template
     vendor surfaces other scams using the same template)
   - Reverse-image search every logo, hero image, "team" photo, and stock photo
     via Google Images, Yandex Images, TinEye, Bing Visual Search
   - Check stock-photo origin via Yandex (best for crypto-scam fake-team photos)
   - Pull copyright/footer text and search verbatim across the indexed web —
     identical copy on other domains = same operator
   - Pull any phone number, email, address, license number from the site and
     pivot on each
   - Pull JavaScript files, search for hardcoded API keys, S3 buckets, Telegram
     bot tokens, AWS account IDs, webhook URLs
   - Check for license/regulator claims (FCA, ASIC, CySEC, FinCEN MSB) — if they
     claim a license, verify directly with the regulator (almost always fake)

[3] TIKTOK + SOCIAL HANDLE ENUMERATION on "BigTrap"
   - Sherlock — `sherlock bigtrap` across 400+ sites
   - WhatsMyName.app — same purpose, different site list
   - Maigret — deeper enumeration
   - Namechk, Namechecker, KnowEm — handle availability across networks
   - Instagram, Twitter/X, YouTube, Telegram, Discord, Snapchat, Threads, Bluesky,
     LinkedIn, Reddit, Twitch, Kick — direct search for "BigTrap" and variants
   - Telegram channel/group search — TGstat, Telemetr.io, Combot, Telegago search
   - Discord server search — disboard.org, top.gg
   - Reddit username search + comment history mining for "brdmarket" mentions
   - Bio links / linktree / beacons.ai / lnk.bio for any matching handle
   - Pull profile photo on each matching handle → reverse-image-search it
   - If TikTok profile is still live, capture full HTML + all visible video
     metadata + creation date + follower count + linked external URLs

[4] BLOCKCHAIN ATTRIBUTION for the three wallets
   - Chainabuse.com — search each wallet for prior victim reports
   - BitcoinAbuse.com (now part of Chainabuse) — historical reports
   - ScamSearch.io — known scammer wallet DB
   - CryptoScamDB — historical scam-wallet associations
   - Etherscan — for any ERC-20 activity on related EOAs (if any)
   - Blockchair — cross-chain wallet lookup
   - WalletExplorer.com — cluster/tag lookup for `1MBdc...`, `bc1qujgkx8l...`,
     and the three hop-2 exchange wallets (`1DLeNAps...`, `12XZMdaA...`,
     `1GrwDkr3...`) — identifying which exchange owns the hop-2 trio is the
     subpoena pivot
   - OXT.me — clustering view on each wallet
   - Breadcrumbs.app — visual flow graph
   - Arkham Intelligence — entity tags, address dossiers
   - MistTrack (by SlowMist) — AML risk score + attribution
   - Elliptic, Chainalysis Reactor — if you have access, otherwise skip
   - Mempool.space and Blockstream Esplora — confirm tx-level data

[5] EMAIL / PHONE / IDENTIFIER INTEL
   - Any email harvested from brdmarket.com or social profiles →
     Hunter.io, EmailRep, Have I Been Pwned, Holehe, OSINT Industries,
     EpieosTools, IntelX
   - Any phone harvested → Truecaller, NumLookup, OSINT.industries,
     Spokeo, BeenVerified
   - Any Telegram username harvested → @username_to_id_bot,
     Telegram-search engines

[6] AUTOMATED PIVOTING / GRAPHING
   - SpiderFoot HX (or open-source SpiderFoot) — feed it the domain, the
     handle "BigTrap", and the BTC wallet addresses; let it run all enabled
     modules; export the graph
   - Maltego CE — same data, run all transforms
   - theHarvester — email/subdomain enumeration on brdmarket.com
   - recon-ng — full recon workflow
   - OSINT Framework (osintframework.com) — checklist any remaining tools
     not covered above

[7] GOOGLE DORKS — run all of these verbatim
   - `"brdmarket.com"`
   - `"brdmarket"`
   - `"brd market" scam OR fraud OR fake`
   - `"BigTrap" tiktok crypto`
   - `"BigTrap" brdmarket`
   - `site:reddit.com brdmarket`
   - `site:trustpilot.com brdmarket`
   - `site:bbb.org brdmarket`
   - `"bc1qy0e4jgq86w8kfdlvmlc4muahh35ss2hu0demat"`
   - `"1MBdcWEjPcdSwGLxtS3qaHahc4asVBii5g"`
   - `inurl:brdmarket`
   - `intext:"BigTrap" intext:"crypto"`
   - `"brdmarket" filetype:pdf OR filetype:html OR filetype:doc`

[8] REGULATORY / COURT / BUSINESS REGISTRY CHECKS
   - SEC EDGAR — search "brdmarket" / "BRD Market"
   - FinCEN MSB Registrant search
   - NFA BASIC (CFTC) — registrant search
   - FCA, ASIC, CySEC, MAS, FINMA, BaFin warning lists — search "brdmarket"
   - OpenCorporates — search "brdmarket" / "BRD Market" globally
   - U.S. state SOS business registries (DE, NV, WY, FL) — common scam-shell
     jurisdictions
   - Companies House (UK), ASIC (AU), Hong Kong CR — same search
   - PACER (U.S. federal court) — civil filings against brdmarket
   - State court records (FL, NY, CA) — civil filings
   - FTC Sentinel Network (if accessible)

================================================================================

CROSS-REFERENCE METHODOLOGY (mandatory)
=======================================

After each tool produces a result, immediately ask: "What new pivot does this give
me?" Examples:
- WHOIS reveals registrant email → run that email through ALL email tools
  (Hunter, EmailRep, Holehe, IntelX, HIBP) and through Sherlock as a handle
- crt.sh reveals 5 other domains on the same cert → run the full toolchain
  against each
- A reverse-image search on the brdmarket "founder photo" matches a stock-photo
  site → log it, then check if other scam sites use the same stock photo
  (reuse pattern)
- Tracking-pixel ID is shared across brdmarket.com and 3 other domains → those
  3 are operated by the same entity; expand scope to all 4
- A Telegram username is found in the site source → run it through Telegram
  attribution tools
- A wallet address appears in a Chainabuse report alongside a different domain →
  that domain is operated by the same actor; expand scope

Keep iterating until pivots stop producing new linked entities OR you converge on a
real-world identity.

================================================================================

DELIVERABLE FORMAT
==================

Produce a single Markdown report `BRD-Market-Annex-F-OSINT-Findings.md` with these
sections:

1.  EXECUTIVE SUMMARY (3–5 bullets — what was found, what wasn't)
2.  CONFIRMED IDENTITY ATTRIBUTION (if any name/jurisdiction surfaced — with
    confidence level and the chain of pivots that produced it)
3.  INFRASTRUCTURE FINDINGS (WHOIS, hosting, DNS, certs, tracking IDs, linked
    domains)
4.  SOCIAL-GRAPH FINDINGS (BigTrap handle matches, secondary profiles, profile
    photos, bio links)
5.  BLOCKCHAIN-ATTRIBUTION FINDINGS (wallet cluster tags, exchange attribution,
    prior victim reports)
6.  EMAIL / PHONE / IDENTIFIER FINDINGS
7.  REGULATORY / COURT FINDINGS
8.  CROSS-REFERENCE CHAIN (visualize the pivot graph — what linked to what)
9.  TOOL-BY-TOOL EXECUTION LOG (the full checklist with every entry filled in:
    tool, query, result, pivot)
10. RECOMMENDED NEXT STEPS for the SEC + CFTC filings

Save the report to `attached_assets/BRD-Market-Annex-F-OSINT-Findings.md` and
present it as the final deliverable. Also save the raw outputs of every tool to
`attached_assets/osint_raw/` for evidentiary chain-of-custody.

================================================================================

CONSTRAINTS
===========

- Public sources only. No credential reuse, no login-walled scraping that
  requires the target's credentials, no hacking, no unauthorized access.
- No doxxing of uninvolved third parties. If sibling-wallet sampling or any
  pivot surfaces an address that looks like an unrelated user, exclude it from
  the report.
- If any tool requires payment, log "paid tool — skipped" and continue with
  free alternatives.
- If you cannot identify the operator, that is an acceptable result — produce
  an honest negative report. Do not fabricate identities or confidence levels.
- All findings must be reproducible from the tool logs in Section 9.

Begin.
