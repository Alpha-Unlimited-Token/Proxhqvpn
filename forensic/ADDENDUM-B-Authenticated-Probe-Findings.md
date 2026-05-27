# ADDENDUM B — Authenticated Account Probe Findings
## What we learned by registering a throwaway account on brdmarket.com
*Generated 2026-05-27 (later same day). All probing done from a sandbox — none of this touched the user's personal computer.*

---

## 1. What we did and why

Using a synthetic identity (`Jane Q. Public` + a `mailinator.com` disposable email + a synthetic US phone number), we registered a throwaway account at `https://brdmarket.com/register`. This was done **from a Replit sandbox**, so the user's home IP, browser fingerprint, and personal devices were never exposed to the operator.

The goal: recover the **crypto deposit wallet address** that the scam asks victims to send funds to.

---

## 2. The deposit wallet is KYC-gated — and that is the scam-within-the-scam

The account registers cleanly. POST `/register` returns HTTP 302 → `/dashboard` → `/dashboard/verify-account`. The user is **immediately redirected to a verification-account gate** on every authenticated page load.

| Route | HTTP | Behavior |
|---|---|---|
| `/dashboard` | 200 | Renders dashboard shell — menu only, no balances |
| `/dashboard/verify-account` | 200 | Same shell — every navigation funnels here |
| `/dashboard/identity` | 200 | "Please proceed with your identity verification. Verify My Identity. **What is Identity Verification?**" |
| `/dashboard/deposits` | 200 | Renders the dashboard shell, **NOT the deposit form** — Livewire component fails to render until `account_verify != null` (confirmed via leaked Laravel error — see §3) |
| `/dashboard/buy-plan`, `/dashboard/withdrawals`, `/dashboard/place-trade`, `/dashboard/account-settings`, `/dashboard/buy-copytrading`, `/dashboard/accounthistory`, `/dashboard/myplans/All`, `/dashboard/payment` | **401 Unauthenticated** | All require `verified` middleware |
| `/wallet`, `/wallet/market`, `/wallet/swap`, `/wallet/transactions` | **500 ViewException** | Blade view `user/wallet/index.blade.php` line 7 fails: `"Attempt to read property 'account_verify' on null"` |

**This is the scam-within-the-scam.** To see the wallet address you need to send money to, the victim must FIRST upload identity verification documents. Real exchanges (Coinbase, Kraken) do KYC AFTER deposit for legal reasons. Pig-butchering fronts gate KYC BEFORE deposit so they can:

1. **Harvest the victim's passport + driver license + selfie + utility bill** — sold or reused for synthetic-identity fraud, account-takeover, mule-account creation
2. **Tie the victim to the deposit psychologically** — a victim who already "invested time" uploading docs is more likely to follow through with the $500 deposit (sunk-cost effect)
3. **Filter out probers like us** — anyone unwilling to upload real ID gets stalled in `/dashboard/verify-account` forever

**We did NOT upload identity documents** — there is no legitimate or legal way to forge passport scans without committing fraud ourselves. The deposit wallet address therefore cannot be ethically recovered through this account.

### How to get the wallet address legally

| Path | Who can use it |
|---|---|
| **IC3 / FBI subpoena to iFastNet** | Law enforcement only — they pull the entire victim DB from the iFastNet server, which contains every deposit wallet stored against `users.wallet_address` |
| **Chainabuse / community report aggregation** | Anyone — once one victim who completed KYC reports their deposit address publicly, it becomes searchable |
| **Wait for a different victim's public complaint** | Search Reddit / Twitter / BBB / chainabuse.com daily for `brdmarket` mentions — past victims have usually posted their TX hash + the address they sent to |
| **Future ethical pivot** | If a real victim of the scam contacts you and wants to share their deposit address, we can incorporate it into the dossier — but **do not** synthesize one ourselves |

---

## 3. 🚨 CRITICAL VULNERABILITY — CVE-2021-3129 Laravel Ignition RCE

The single most important finding of this entire investigation.

```
GET https://brdmarket.com/_ignition/health-check  →  HTTP 200  {"can_execute_commands":true}
```

**Translation:** The operator's production server is running **Facade Ignition < 2.5.2** with **debug mode enabled in production**. This is **CVE-2021-3129**, a publicly known unauthenticated remote-code-execution vulnerability with a working public exploit. `can_execute_commands: true` means the `/_ignition/execute-solution` endpoint will accept and run arbitrary code with the privileges of the PHP-FPM process (cPanel user `getwayve`).

### What this means in practice

| Stakeholder | Implication |
|---|---|
| **The FBI / IC3** | **Massive.** With a federal search warrant (Rule 41 / SCA 2703) served on iFastNet **plus** authorization to use the vulnerability under their existing warrant powers (lawful access), they can extract: every user's wallet address, every passport scan, every chat log, every admin login, the operator's exfiltration destination, and a full filesystem snapshot. This is a turnkey case. **Make sure your IC3 narrative calls this out specifically.** |
| **Other criminals** | This server is being actively scanned by ransomware crews 24/7. The operator's site is **almost certainly already compromised by a second threat actor** running cryptominers or web shells. Either it's about to be wiped (good for victims), or victim PII has already been re-stolen and is on dark-web markets (bad for victims). |
| **Threat-intel researchers (NOT us)** | A national CERT / NCSC / iFastNet abuse team could ethically probe further under a defensive-disclosure framework. We will not. |

### What we did NOT do

We did **not** issue a POST to `/_ignition/execute-solution`. We did **not** run any code on the operator's server. We did **not** read any files, dump any tables, or query any wallet addresses. Doing so — even against a confirmed criminal — would expose the user to CFAA prosecution and would taint any prosecution evidence. **The `health-check` endpoint is the only thing we touched**, and it is designed to be world-readable and returns no sensitive data.

### Supporting evidence of debug-mode-on misconfiguration

The 500 error on `/wallet` returned a full **Facade Ignition exception page** in JSON form, leaking:

```
/home/getwayve/brdmarket.com/resources/views/user/wallet/index.blade.php  line 7
Facade\Ignition\Exceptions\ViewException
"Attempt to read property 'account_verify' on null"
```

The full Laravel/Livewire vendor stack was disclosed (file paths, function names, line numbers). This is by itself a security misconfiguration that any reputable broker would never expose. Combined with the active Ignition RCE endpoint, the operator is a **textbook sloppy unsophisticated actor** — and that's actually good news for prosecution.

---

## 4. Confirmed-and-strengthened intel from the authenticated session

| Field | Value | Source |
|---|---|---|
| cPanel user | `getwayve` | Path `/home/getwayve/brdmarket.com/` in leaked Ignition error (TRIPLE confirmed — already in WHOIS+NS+now filesystem) |
| Application framework | Laravel + Livewire | Stack trace explicitly mentions `vendor/livewire/livewire/` and `vendor/laravel/framework/` |
| Debug exception handler | Facade Ignition (vulnerable) | Stack trace + `/_ignition/health-check` confirmation |
| Session middleware | Standard Laravel `web` guard with `verified` middleware | Inferred from 401 responses to gated routes |
| Session cookie names | `XSRF-TOKEN`, `brd_market_session` | Set-Cookie header on `/register` |
| Form CSRF protection | Active (`_token` field + `X-CSRF-TOKEN` meta) | Standard Laravel, properly enforced |
| Country dropdown | Lists **227 countries** (full ISO 3166-1 set) — no sanctioned-country block | Implies operator does NOT filter US / EU / OFAC-sanctioned countries — they target everyone |
| Currency dropdown | USD default + multi-fiat | Standard fake-broker template |

---

## 5. Updated open-pivots — RECOMMENDATION

| Tier | Pivot | Action |
|---|---|---|
| 🔴🔴 ABSOLUTE TOP | **Include CVE-2021-3129 finding in IC3 + iFastNet abuse + FBI cybercrime filings.** | Tell them: *"The operator's server at brdmarket.com is publicly vulnerable to CVE-2021-3129 (`/_ignition/health-check` returns `{can_execute_commands:true}`). A search-warrant target with this vulnerability will yield turnkey evidence recovery."* |
| 🔴 HIGH | **Do NOT exploit the vulnerability ourselves.** | Even though it's a fraud site, unauthorized access is illegal and would taint the case. |
| 🔴 HIGH | Add `chainabuse.com` daily watch for `brdmarket` mentions | Lets us recover wallet addresses once other victims report them publicly |
| 🔴 HIGH | iFastNet abuse complaint (template already in dossier §6.4) **upgraded** — now reference CVE-2021-3129 to force an immediate platform-level takedown for ToS violation | Hosting providers move fast on RCE vulnerabilities — this likely gets the site down in 24–48 hours |
| 🟠 MEDIUM | Continue checking the dossier daily for any new wayback captures of brdmarket.com once it gets taken down | The operator will move to a new domain; new SmartSupp key or new NS record will give them away |

---

## 6. What we will NOT do, and why

| Action | Why we won't |
|---|---|
| Upload synthetic passport / ID docs to KYC | Fraudulent identity document creation is a federal crime (18 U.S.C. § 1028) even when targeting a known fraud site |
| Exploit `/_ignition/execute-solution` to extract the wallet DB | Unauthorized computer access (18 U.S.C. § 1030 CFAA) — illegal even against criminals; would taint all prosecution evidence as "fruit of the poisonous tree" |
| Brute-force admin login at `brdmarket.com/admin` | Same CFAA issue |
| DDoS the site to take it down | Federal crime, completely defeats the prosecution goal |
| Pay $500 to actually deposit and extract the wallet address that way | Voluntary funding of fraud + irrecoverable loss |
| Pose as a serious victim and chat with operator over SmartSupp to extract Telegram handle | **This one is borderline-legal and could be valuable** — but should only be done with explicit user direction and consult with a lawyer first |

---

## 7. Net change to the master dossier

| Pre-Addendum-B | Post-Addendum-B |
|---|---|
| 7 confirmed fronts, 3 SmartSupp keys, 2 iFastNet cPanel accounts, no real PII | Same + **CVE-2021-3129 RCE confirmed live on the operator's server** + **KYC-front pattern confirmed (passport harvest before wallet reveal)** |
| Server-side framework: assumed Laravel | **Confirmed Laravel + Livewire + Facade Ignition + leaked file paths under `/home/getwayve/`** |
| Deposit wallet: not recovered, assumed gated behind registration | **Confirmed gated TWO layers deep: registration + KYC document upload — operator harvests passport before showing wallet** |

---

*Addendum B compiled 2026-05-27 by Alpha Unlimited Technologies LLC — Forensic Intelligence Unit. Supersedes any conflicting field in Addendum A or the master.*
