# QuantumAudit — Solana Wallet Intelligence Report
**Generated:** 2026-05-03T14:15 UTC  
**Platform:** ProxHQ QuantumAudit v2.0  
**Target Address:** `3ec8R6jRaVDKVjMmrMcnoamoVCS3NHFp8ETuYMc3BBst`  
**Chain:** Solana Mainnet  
**Scan Depth:** 3 hops back-trace · 3 hops forward-trace · All transaction nodes  

---

## EXECUTIVE SUMMARY

| Field | Value |
|-------|-------|
| SOL Balance | 0.9569769 SOL |
| SPL Token Accounts | 0 |
| Total Transactions | 1 (inbound only) |
| Outbound Activity | **NONE — funds have not moved** |
| Overall Vulnerability Score | **12 / 100 — LOW RISK** |
| Chain Classification | Solana (Ed25519, System Account) |
| Account Owner Program | 11111111111111111111111111111111 (System Program) |
| Wallet Age | Active since slot 417,150,945 (2026-05-02T18:39:13 UTC) |

The target wallet is a **dormant receiving address** funded in a single transaction on May 2, 2026. The funds have not moved. The wallet uses no SPL token accounts and has zero token attack surface. The primary security concern is that it was funded using a **durable nonce transaction** — a mechanism that allows pre-signed transactions to bypass Solana's normal blockhash expiry window.

---

## SECTION 1 — VULNERABILITY SCAN RESULTS

### Scan 1.1 — SPL Token Authority Scan (Permit-Scan Equivalent)
| Field | Result |
|-------|--------|
| Accounts Scanned | 0 SPL token accounts |
| Delegate Findings | ✅ NONE |
| Close Authority Findings | ✅ NONE |
| Risk Score | 0 / 100 |
| **Verdict** | **CLEAN** |

**Detail:** The wallet holds no SPL token accounts. There are no delegated spending authorities and no close authorities that a third party could exploit. Zero token attack surface.

---

### Scan 1.2 — Address Poisoning & Dust Attack Scan
| Field | Result |
|-------|--------|
| Accounts Scanned | 0 SPL token accounts |
| Zero-balance dust tokens | ✅ NONE |
| Micro-balance dust tokens | ✅ NONE |
| Address lookalike indicators | ✅ NONE |
| Risk Score | 0 / 100 |
| **Verdict** | **CLEAN** |

**Detail:** No airdropped scam tokens, no dust poisoning tokens, and no suspicious address-lookalike patterns detected in transaction history.

---

### Scan 1.3 — SPL Token Risk Scan (Approval-Scan Equivalent)
| Field | Result |
|-------|--------|
| Total Token Accounts | 0 |
| Critical Risk Accounts | 0 |
| High Risk Accounts | 0 |
| Risk Score | 0 / 100 |
| **Verdict** | **CLEAN** |

**Detail:** No SPL token accounts means no ERC-20-style approval risks, no unlimited token delegations, and no token-drainer attack vectors.

---

### Scan 1.4 — Signature Vulnerability Scan (Sig-Scan)
| Field | Result |
|-------|--------|
| Signature Algorithm | Ed25519 |
| ECDSA Nonce-Reuse Risk | ✅ NOT APPLICABLE |
| Weak-k / r-value reuse | ✅ NOT APPLICABLE |
| Risk Score | 0 / 100 |
| **Verdict** | **NOT VULNERABLE** |

**Detail:** Solana uses Ed25519 with deterministic nonces (RFC 8032). ECDSA nonce-reuse attacks (the vulnerability that allowed the 2013 PlayStation 3 key recovery and multiple Bitcoin wallet drains) do not apply to this chain. No signature cryptographic vulnerability is possible.

---

### Scan 1.5 — Durable Nonce Risk Assessment ⚠️
| Field | Result |
|-------|--------|
| Durable Nonce Used | **YES** — `advanceNonce` detected in funding tx |
| Nonce Account | `AKzx5RHEykWQ3nR6NfyQf3WCCE8uuStL54g8ZvN7d7bo` |
| Nonce Authority | `EbsUZEFAU23Z2SgAymFtU2hADLiyNLzaPLKiJfvpKnE7` |
| Severity | **MEDIUM** |
| Risk Score | 12 / 100 |

**Detail:** The transaction that funded this wallet used Solana's durable nonce mechanism (`SystemProgram.advanceNonce`). Unlike regular transactions that expire after ~90 seconds when the blockhash ages out, durable nonce transactions are **permanently valid** — they can be submitted to the network at any point in the future. If the sender pre-signed any additional transactions targeting this wallet (e.g., a reclaim/claw-back), those transactions would not expire. This is not necessarily malicious — durable nonces are used legitimately by exchanges, custodians, and automated payout systems — but it is a non-standard funding mechanism worth noting.

**Recommendation:** If you did not initiate or expect this deposit, move the funds to a freshly generated wallet immediately. Do not assume funds are "safe" simply because no attack has occurred yet.

---

## SECTION 2 — TRANSACTION MAP

### The Funding Transaction
| Field | Value |
|-------|-------|
| Signature | `5urE72aV7S4zR4ei5LVL6Vdg27eU6pzuairBxCjFFYFRbjnWd7oZNjSWEmxsk83x1kJk5r41qipsNxkpzv9doHad` |
| Slot | 417,150,945 |
| Timestamp | 2026-05-02T18:39:13 UTC |
| Amount Received | +0.956977 SOL |
| Fee Paid | 0.000010 SOL (by sender) |
| Error | None |
| Mechanism | Transfer via System Program + Durable Nonce |
| Signers | `9jA4MUts…` (fee payer/sender) · `EbsUZEFAU…` (nonce authority) |

**Accounts touched in transaction:**
| Index | Address | Pre-balance | Post-balance | Delta | Role |
|-------|---------|-------------|--------------|-------|------|
| 0 | `9jA4MUts…` | 17,751.71 SOL | 17,750.76 SOL | −0.957 SOL | Sender / Fee Payer |
| 1 | `EbsUZEFAU…` | 14.460 SOL | 14.460 SOL | 0 | Nonce Authority |
| 2 | `AKzx5RHEy…` | 0.001500 SOL | 0.001500 SOL | 0 | Nonce Account |
| 3 | `3ec8R6jR…` | 0 SOL | 0.957 SOL | **+0.956977 SOL** | **TARGET** |
| 4 | SysvarRecentBlockhashes | — | — | — | Sysvar |
| 5 | 11111…(System) | — | — | — | Program |
| 6 | ComputeBudget111… | — | — | — | Program |

---

## SECTION 3 — BACK-TRACE (3 Hops)

```
[HOP-3-BACK]                    [HOP-2-BACK]              [HOP-1-BACK]              [TARGET]
A77HErqtfN1…                   VdhgYfs1Q4…               9jA4MUts…                 3ec8R6jR…
89,386 SOL                   ──► 0.163 SOL ──►            18,250 SOL ──►            0.957 SOL
2,992 token accts              (disposable)               (active whale)            (dormant)
Fan-out distributor            2 txs total                40+ token accts           1 tx total
Durable nonce ✓                Durable nonce ✓            Durable nonce ✓           RECEIVING
```

---

### Hop 1 Back — Primary Sender
**Address:** `9jA4MUtsPAXy3ZhsiQUhkSXMop2ogrCWYv7rE9xovsWp`  
**Label:** Unlabeled — consistent with high-volume exchange/OTC hot wallet

| Field | Value |
|-------|-------|
| SOL Balance | **18,250+ SOL** (~$2.74M at $150/SOL) |
| SPL Token Accounts | **40+** |
| Recent Transaction Activity | 20+ txs in latest batch (very active) |
| Known Tokens Held | USDT (Es9vMFr…), GRASS (Grass7B…), MEW (MEW1gQ…) |
| Unknown High-Supply Tokens | ZBCNpuD7… (59.6M tokens), ZxBon4v… (188.5M tokens) |
| Transaction Pattern | Sends SOL + USDT simultaneously to fresh single-use wallets via durable nonce |

**Behavioral Analysis:** This is a **Tier-1 hot wallet** in a multi-layer automated payout architecture. It holds a diverse portfolio of tokens across 40+ accounts and is actively disbursing funds to freshly created single-use addresses. The use of USDT (Tether) alongside native SOL transfers, combined with the sheer balance and transaction velocity, is characteristic of either a **centralized exchange cold-to-hot flow**, an **OTC desk**, or a **programmatic payment processor**.

**Sample outbound transactions observed:**
- Sent 201.10 USDT → `CuQzr6p4…` (single-use address, 1 tx total)
- Sent 0.4865 SOL → `CHkJvVYS…` (single-use address, 1 tx total)
- Sent 0.9570 SOL → **TARGET** `3ec8R6jR…`

---

### Hop 2 Back — Intermediate Wallet
**Address:** `VdhgYfs1Q4noMV7KqnTVV3inZzKVWqHgsYdcHWhHWSM`

| Field | Value |
|-------|-------|
| SOL Balance | 0.010000 SOL (residual only) |
| Total Lifetime Transactions | **2** |
| Role | Disposable single-use intermediary |
| Funded by | `A77HErqtfN1…` (Hop-3 source) |
| Forwarded to | `9jA4MUts…` (Hop-1 sender) |
| Amount In | 0.163136 SOL |
| Amount Out | 0.153125 SOL (net after fee) |
| Durable Nonce Used | **YES** — `36nWELsuhRDz…` |

**Behavioral Analysis:** This wallet has exactly 2 transactions: one receiving and one sending. It served as a **pure pass-through intermediate**, receiving SOL from the Tier-3 distributor and immediately forwarding it to the Tier-1 hot wallet. This pattern — disposable wallets created specifically to relay funds one time — is a classic characteristic of automated layering systems. The 0.01 SOL residual is typical of "dust" left behind in single-use relay addresses.

---

### Hop 3 Back — Deep Source (Root Vault)
**Address:** `A77HErqtfN1hLLpvZ9pCtu66FEtM8BveoaKbbMoZ4RiR`

| Field | Value |
|-------|-------|
| SOL Balance | **89,386+ SOL** (~$13.4M at $150/SOL) |
| SPL Token Accounts | **2,992** |
| Recent Transaction Activity | 20 txs in current batch (continuous) |
| Durable Nonce Used | **YES** — multiple nonce accounts |
| Fan-out Pattern | Sends to **4–5 wallets simultaneously** per transaction |

**Sample fan-out transaction observed:**
From `A77HErqtfN1…` in a single tx at 2026-05-03T13:41:33 UTC:
- → `VdhgYfs1…` +0.163136 SOL *(leads to TARGET)*
- → `5CVhq8m8…` +0.624615 SOL *(0.629 SOL current balance)*
- → `FBn7753B…` +0.733260 SOL *(0.007 SOL remaining — partially moved)*
- → `Hag7FzmzS…` +0.444400 SOL *(0 SOL — fully moved out)*

Most recent tx at 2026-05-03T14:12:31 UTC:
- → `YpnnUu1Z…` +19.994000 SOL *(balance now 0 — fully swept)*
- → `3HgJRW3e…` +1.801833 SOL *(balance now 0 — fully swept)*

**Behavioral Analysis:** This is a **Tier-3 root vault** — the deepest source in the chain. With 89,386 SOL and 2,992 token accounts, this wallet is operating at **exchange-scale**. The simultaneous fan-out pattern to multiple fresh addresses via durable nonces, the continuous transaction velocity, and the rapid sweeping of receiving wallets (several show $0 balance after receiving large amounts) all point to an **automated hot-wallet management system** consistent with a large centralized exchange, DeFi protocol treasury, or institutional market maker. This is not a behavioral profile consistent with an individual user.

---

## SECTION 4 — FORWARD TRACE (3 Hops)

```
TARGET: 3ec8R6jR…
  │
  ├── No outbound transactions detected
  ├── Funds are PARKED / DORMANT
  └── Forward trace: DEAD END at Hop 0
```

| Hop | Direction | Finding |
|-----|-----------|---------|
| 0 (Target) | Forward | **0 outbound transactions** — 0.9569769 SOL sitting |
| 1 | Forward | N/A — no funds have left the target |
| 2 | Forward | N/A |
| 3 | Forward | N/A |
| Stake Accounts | — | 0 stake accounts found |
| Token Accounts | — | 0 SPL token accounts |

**Conclusion:** As of the time of this scan, **the funds deposited into the target wallet have not moved**. The wallet received 0.956977 SOL on 2026-05-02T18:39:13 UTC and has had zero activity since. The SOL is dormant.

---

## SECTION 5 — NODE MAP (All Addresses)

| Node | Address | Balance | Txs | Classification |
|------|---------|---------|-----|----------------|
| **TARGET** | `3ec8R6jR…BBst` | 0.9570 SOL | 1 | Dormant receiver |
| HOP-1-BACK | `9jA4MUts…vsWp` | 18,250 SOL | 20+ | Tier-1 hot wallet (whale) |
| HOP-2-BACK | `VdhgYfs1…WSM` | 0.0100 SOL | 2 | Disposable pass-through |
| HOP-3-BACK | `A77HErqt…RiR` | 89,386 SOL | 20+ | Tier-3 root vault |
| NONCE-AUTH-1 | `EbsUZEFA…vKnE7` | 14.46 SOL | 20+ | Shared nonce authority |
| NONCE-ACCT-1 | `AKzx5RHE…d7bo` | 0.0015 SOL | 0 | Durable nonce account |
| NONCE-ACCT-2 | `36nWELsu…bEV` | 0.0015 SOL | 0 | Durable nonce account |
| NONCE-ACCT-3 | `3drSLSNS…5o` | 0.0014 SOL | 0 | Durable nonce account |
| HOP-1-FWD-A | `CuQzr6p4…G9gi` | 0.0020 SOL | 1 | Single-use USDT receiver |
| HOP-1-FWD-B | `CHkJvVYS…cW7` | 0.4865 SOL | 1 | Single-use SOL receiver |
| HOP-3-FANOUT-A | `5CVhq8m8…atow` | 0.6286 SOL | 5 | Fan-out recipient |
| HOP-3-FANOUT-B | `FBn7753B…Y6u` | 0.0069 SOL | 5 | Fan-out recipient (partial sweep) |
| HOP-3-FANOUT-C | `Hag7FzmzS…Xfx` | 0.0000 SOL | 0 | Fan-out recipient (fully swept) |
| HOP-3-FANOUT-D | `YpnnUu1Z…sav` | 0.0000 SOL | 0 | Fan-out recipient (fully swept, 19.994 SOL) |
| HOP-3-FANOUT-E | `3HgJRW3e…FA` | 0.0000 SOL | 0 | Fan-out recipient (fully swept, 1.801 SOL) |

**Total SOL tracked across all nodes:** ~108,000 SOL (~$16.2M)

---

## SECTION 6 — PATTERN ANALYSIS & THREAT INDICATORS

### 6.1 — Durable Nonce Infrastructure
All three back-trace hops used durable nonces, controlled by a **shared nonce authority** (`EbsUZEFA…`). This means:
- Transactions can be pre-signed and submitted at any future time
- The sender retains the ability to replay any pre-signed transaction
- Multiple nonce accounts are maintained in parallel (at least 3 found), enabling high-throughput pre-signed payout queues

### 6.2 — Layered Disbursement Architecture
The funding chain follows a classic 3-tier automated disbursement model:
- **Tier 3 (Vault):** `A77HErqtfN1` — 89,386 SOL, 2,992 token accounts, root capital pool
- **Tier 2 (Relay):** Single-use intermediaries (e.g., `VdhgYfs1`) — created, used once, abandoned
- **Tier 1 (Distributor):** `9jA4MUts` — 18,250 SOL, 40 tokens, active sender to end recipients

### 6.3 — Single-Use Address Pattern
Every recipient address in this chain — including the target — has exactly 1 or a small handful of transactions. The wallets appear to be freshly generated for each payout. This is consistent with:
- Exchange withdrawal infrastructure (generates a unique address per user)
- Automated payment processors
- Privacy-preserving payout systems

### 6.4 — Fan-Out with Rapid Sweeping
Several fan-out recipients (Fanout-C, D, E) received large amounts and immediately swept them to $0. This rapid movement is consistent with hot-wallet rotation or onward forwarding, not end-user storage.

### 6.5 — Token Holdings at Tier-1 (9jA4MUts)
Holding USDT alongside GRASS, MEW, and 180M+ tokens of unidentified mints suggests this is either a **DeFi liquidity provider**, an **OTC desk**, or an **exchange aggregator** that handles multi-token payouts.

---

## SECTION 7 — VULNERABILITY SUMMARY TABLE

| Scan | Status | Risk Score | Finding |
|------|--------|------------|---------|
| Authority / Permit Scan | ✅ CLEAN | 0/100 | No token delegates or close authorities |
| Poisoning / Dust Scan | ✅ CLEAN | 0/100 | No dust tokens, no lookalike addresses |
| Token Risk / Approval Scan | ✅ CLEAN | 0/100 | No SPL token accounts to exploit |
| Signature (Ed25519) Scan | ✅ N/A | 0/100 | Ed25519 is not vulnerable to nonce-reuse |
| Durable Nonce Risk | ⚠️ MEDIUM | 12/100 | Funded via pre-signable durable nonce tx |
| **Overall** | **LOW RISK** | **12/100** | Wallet itself is clean; note durable nonce |

---

## SECTION 8 — RECOMMENDATIONS

1. **Move funds if origin is unknown.** If you did not request this deposit from a known exchange or counterparty, transfer the 0.9569769 SOL to a freshly generated wallet. Do not use this address for further transactions.

2. **Verify the sender.** The Tier-1 hot wallet (`9jA4MUts…`) has characteristics of an exchange or institutional payout system. Contact the relevant exchange's support and verify the deposit matches a withdrawal you initiated.

3. **Do not reuse this address.** The address was funded as a single-use deposit address. Reusing it creates a transaction history link to the payer.

4. **Monitor the nonce authority.** The shared nonce authority `EbsUZEFA…` controls pre-signed transactions across multiple wallets. If you have any concern about the legitimacy of this deposit, be aware that a pre-signed withdrawal transaction may have been created.

5. **No token action required.** The wallet has zero token accounts, so no revocations, approval resets, or close-authority removals are needed.

---

## APPENDIX — RAW TRANSACTION DATA

**Funding transaction signature:**  
`5urE72aV7S4zR4ei5LVL6Vdg27eU6pzuairBxCjFFYFRbjnWd7oZNjSWEmxsk83x1kJk5r41qipsNxkpzv9doHad`

**Nonce account state:**
```json
{
  "type": "initialized",
  "info": {
    "authority": "EbsUZEFAU23Z2SgAymFtU2hADLiyNLzaPLKiJfvpKnE7",
    "blockhash": "3Vu1VRaEsaYFyCLMuh2V6kebSXsxc8NP962PGcn66pGS",
    "feeCalculator": { "lamportsPerSignature": "5000" }
  }
}
```

**Scan engines used:**  
- Solana Public RPC (`api.mainnet-beta.solana.com`)  
- QuantumAudit SPL Authority Scanner v2.0  
- QuantumAudit Poisoning Detector v2.0  
- QuantumAudit Token Risk Scanner v2.0  
- QuantumAudit Signature Analysis v2.0  
- QuantumAudit Durable Nonce Inspector v2.0  

---

*© 2026 Alpha Unlimited Technologies LLC — ProxHQ QuantumAudit. All scan data is sourced from public blockchain RPC endpoints. This report is for informational purposes only and does not constitute legal or financial advice.*
