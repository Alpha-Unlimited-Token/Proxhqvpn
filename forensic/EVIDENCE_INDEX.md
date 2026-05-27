# BRD Market Master Dossier — Evidence Index
## Updated 2026-05-27 (Addendum C + TikTok screenshots added)

## Primary documents
- `BRD-Market-MASTER-Dossier.md` — full case dossier
- `ADDENDUM-A-Cross-Reference-Findings.md` — 7 confirmed sister fraud fronts
- `ADDENDUM-B-Authenticated-Probe-Findings.md` — authenticated post-registration probe + CVE-2021-3129 RCE
- `ADDENDUM-C-KYC-Form-Definitive-Evidence.md` — live capture proving ID-upload requirement, zero email verification

## Primary direct evidence — victim screenshots
- `tiktok_conversation_screenshots/INDEX.md` — chain-of-custody index
- `tiktok_conversation_screenshots/01..13_TikTok_BigTrap_*.png` — 13 chronological screenshots of the live TikTok conversation with suspect alias "BigTrap" on 2026-05-27 between 09:29 and 12:13 local time

## Authenticated platform evidence
- `authenticated_probe_evidence/` — HTML captures from inside throwaway accounts on brdmarket.com
- `authenticated_probe_evidence/kyc_form_live_capture.html` — live HTML of the KYC form

## Infrastructure intel
- `iocs.json`, `iocs_master.json` — indicators of compromise
- `crt_*.json` — certificate transparency findings
- `pivots/` — DNS and infrastructure pivots
- `register_probe/` — registration probe artifacts and account credentials

## Total contents
54+ files. See full ZIP at the project root.

---

## On-Chain Wallet Evidence (added 2026-05-27)

| Artifact | Location | Notes |
|---|---|---|
| `ADDENDUM-E-On-Chain-Wallet-Trace.md` | root + `whistleblower/` | Full multi-hop forensic trace (forward 3 hops, backward 2 hops) |
| `tiktok_conversation_screenshots/15_…WALLET_HANDOVER.png` | conversation folder | Wallet handover frame, 2026-05-27 17:12 UTC |
| `tiktok_conversation_screenshots/16_…WALLET_CONFIRM.png` | conversation folder | Wallet re-quote + "this is the address" confirmation |
| `wallet_trace_raw_evidence/blockstream_address.json` | wallet_trace_raw_evidence | Target address profile (Blockstream Esplora) |
| `wallet_trace_raw_evidence/blockstream_txs.json` | wallet_trace_raw_evidence | Full 6-tx history with vin/vout (Blockstream) |
| `wallet_trace_raw_evidence/mempool_address.json` | wallet_trace_raw_evidence | Corroborating profile (Mempool.space) |
| `wallet_trace_raw_evidence/blockchain_info.json` | wallet_trace_raw_evidence | Corroborating profile (Blockchain.info) |
| `wallet_trace_raw_evidence/hops/addr_1MBdc….json` | wallet_trace_raw_evidence/hops | Cashout consolidator full address record |
| `wallet_trace_raw_evidence/hops/addr_1DLeNAps….json` | wallet_trace_raw_evidence/hops | Hop-2 forward target #1 (1.10M BTC lifetime) |
| `wallet_trace_raw_evidence/hops/addr_12XZMdaA….json` | wallet_trace_raw_evidence/hops | Hop-2 forward target #2 (1.17M BTC lifetime) |
| `wallet_trace_raw_evidence/hops/addr_1GrwDkr3….json` | wallet_trace_raw_evidence/hops | Hop-2 forward target #3 (11.97M BTC lifetime) |
| `wallet_trace_raw_evidence/hops/_funding_txs_raw.json` | wallet_trace_raw_evidence/hops | The 3 inbound funding txs (full vin/vout) |
| `wallet_trace_raw_evidence/hops/_backward_hop2.json` | wallet_trace_raw_evidence/hops | Backward-trace hop-2 origin map |
| `wallet_trace_raw_evidence/hops/_backward_profiles.json` | wallet_trace_raw_evidence/hops | Backward-trace hop-1 address profiles |
| `wallet_trace_raw_evidence/hops/_forward_hop3_addrs.json` | wallet_trace_raw_evidence/hops | 2,478 hop-3 addresses discovered (terminal — converges into normal exchange flow) |

**Key on-chain findings**:
- Target wallet balance: **0.00 BTC** (already swept)
- Lifetime throughput: 0.01722303 BTC (~$1,500)
- 100+ sibling burner wallets identified via fan-out pattern
- Forward terminus: 3 CEX hot wallets (1.1M / 1.17M / 11.97M BTC lifetime each)
- Backward origin: `bc1qujgkx8ldfqw2r2f4hn644n83y7uwue5vsf3rrx` (1,805 BTC / 543 txs)
- Two clean subpoena targets identified for KYC unmasking

