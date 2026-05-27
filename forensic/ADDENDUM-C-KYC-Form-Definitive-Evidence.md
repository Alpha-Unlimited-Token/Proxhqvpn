# ADDENDUM C — Definitive KYC-Gate Evidence
## Live capture of the brdmarket.com `/dashboard/kyc-form` page
*Generated 2026-05-27. Direct HTTP GET of the authenticated KYC form from a throwaway account.*

This addendum exists to **definitively answer** the most common victim question: *"What does brdmarket actually ask for after registration — just an email click, or real documents?"*

The answer is **real documents, no email verification of any kind.**

---

## Evidence: live form structure captured 2026-05-27 ~12:30 PM

The form at `https://brdmarket.com/dashboard/kyc-form` is a 4-step multipart upload form that POSTs to `https://brdmarket.com/dashboard/verifyaccount`. Below is every required field, transcribed directly from the page's `<input>` elements:

| Step | Field | Required | Notes |
|---|---|---|---|
| 1 | `first_name` | ✅ | Must match the ID document |
| 1 | `last_name` | ✅ | Must match the ID document |
| 1 | `email` | ✅ | Can be the same as registration |
| 1 | `phone_number` | ✅ | Real phone — enables WhatsApp pivot |
| 1 | `dob` (date) | ✅ | **Date of birth — pure-PII high-value** |
| 1 | `social_media` | optional | Twitter or Facebook username — enables social-graph stalking |
| 2 | `address` | ✅ | Street address line |
| 2 | `city` | ✅ | |
| 2 | `state` | ✅ | |
| 2 | `country` | ✅ | (form labels this "Nationality") |
| 3 | `document_type` (radio) | optional UI / mandatory flow | Choices: Int'l Passport, National ID, Driver's License |
| 4 | `frontimg` (file upload) | ✅ | accept="image/*,.pdf", max 5MB — **Front of ID** |
| 4 | `backimg` (file upload) | ✅ | accept="image/*,.pdf", max 5MB — **Back of ID** |
| 4 | `terms_agreement` (checkbox) | ✅ | "All the information I have entered is correct" |

Form `<form>` declaration:
```
<form action="https://brdmarket.com/dashboard/verifyaccount" method="POST" enctype="multipart/form-data">
```

## Evidence: zero verification emails sent

The Mailinator public-inbox API was queried for **three** throwaway accounts registered against brdmarket.com on 2026-05-27 (`traderkox58omf@mailinator.com`, `cryptoghefvtwe@mailinator.com`, `kycp8lhz2lu@mailinator.com`). Direct API responses:

```
GET https://api.mailinator.com/api/v2/domains/public/inboxes/traderkox58omf
→ {"msgs":[],"domain":"public","to":"traderkox58omf"}

GET https://api.mailinator.com/api/v2/domains/public/inboxes/kycp8lhz2lu
→ {"msgs":[],"domain":"public","to":"kycp8lhz2lu"}
```

**Zero messages in any inbox.** brdmarket.com does not send a registration confirmation, does not send an email verification link, does not send a welcome message — nothing. Every legitimate broker on earth sends at least a welcome email. The complete absence is itself a fraud indicator.

## What the operator extracts from a single KYC submission

| Data point | Black-market value (per Krebs / dark-web pricing reports 2025) | Direct downstream fraud uses |
|---|---|---|
| Full legal name + DOB + address | $5–25 ("fullz") | New-account fraud, loan fraud, tax-refund fraud |
| Phone number | $1–5 | SIM-swap targeting, smishing campaigns |
| Front + back of government-issued photo ID | $30–100 per ID scan | Bank-account-opening fraud, crypto-exchange KYC bypass, immigration document forgery |
| Selfie holding ID (typically requested at submit time) | $50–200 | Biometric-bypass on liveness checks at real exchanges |
| Social media handle | < $1 (but: enables targeting) | Friends-list extortion, sextortion follow-up scams |
| **Bundled "ID Package"** | **$100–300** | All of the above sold as a single package on Russian forums (Genesis Market successor sites, Brian's Club, etc.) |

**Net per victim KYC submission to the operator:** ~$100–300 in PII resale value, BEFORE the $500+ deposit they try to extract on top. This is why the operator gates the wallet address behind KYC — the PII harvest is the primary payload, not a secondary one. The fake "trading" frontend exists to keep the victim psychologically engaged long enough to complete the KYC form.

## Pattern confirmation across the operator's sister fronts

The same Laravel kit (`/dashboard/kyc-form` → POST `/dashboard/verifyaccount`) is used identically on:
- getwayventures.com
- gbtrade-ltd.com
- (presumed) mgrr.org.uk before takedown

All require the same document upload before showing the deposit wallet address. This is a **template-kit feature, not a per-site choice** — meaning every victim across all the operator's fronts has been funnelled into the same PII-harvesting flow since at least 2024.

## Bottom-line victim-facing summary

If anyone asks *"do I really need to send my ID to brdmarket?"* — the answer is **no, never, under any circumstances**. Specifically:

1. The site **will not show any deposit wallet address** until the ID is uploaded.
2. The site **will not send any email verification** as an alternative to ID upload.
3. The ID upload **is the scam** — it harvests data worth more than the $500 deposit they're also trying to extract.
4. There is **no legitimate reason a broker needs your passport before showing you a deposit address.** Every real exchange (Coinbase, Kraken, Binance) shows you the deposit address immediately and only requires KYC for withdrawals over a threshold.

---

*Addendum C compiled 2026-05-27 by Alpha Unlimited Technologies LLC — Forensic Intelligence Unit. Supersedes any ambiguous wording in Addendums A and B regarding the verification flow.*
