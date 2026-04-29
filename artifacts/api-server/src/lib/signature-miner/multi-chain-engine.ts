/**
 * Multi-Chain Engine — Top-20 Blockchain Scanner
 * ════════════════════════════════════════════════
 * The unified entry point for analysing any wallet address regardless of chain.
 *
 * Given an address string it:
 *   1. Auto-detects the blockchain from the address format
 *   2. Routes to the correct chain adapter
 *   3. Fetches all available transaction signatures from that chain's explorer
 *   4. Runs nonce-reuse detection + statistical attack checks
 *   5. Returns normalised MultiChainFinding records
 *
 * ── SUPPORTED CHAINS (Top-20 by usage + laundering prevalence) ───────────────
 *
 *  EVM / secp256k1 (ethers.js):
 *    0x[40hex]  → Ethereum, Polygon, BSC, Arbitrum, Optimism, Avalanche,
 *                 Base, Fantom, Ethereum Classic  (tried in order)
 *    T[33]      → Tron
 *
 *  Bitcoin-family UTXO / secp256k1 DER:
 *    1/3/bc1…   → Bitcoin
 *    L/M/ltc1…  → Litecoin
 *    D[33]      → Dogecoin
 *    bitcoincash:q/p → Bitcoin Cash
 *    X/7[33]    → Dash   (PrivateSend mixing chain)
 *    t1/t3[33]  → Zcash  (transparent — full secp256k1)
 *    zs1/u1[…]  → Zcash  (shielded — detection-only flag)
 *
 *  XRP Ledger / secp256k1 DER:
 *    r[25-34]   → Ripple/XRP
 *
 *  Ed25519 family:
 *    [32-44 b58] → Solana
 *    G[55]       → Stellar (XLM)
 *    addr1[…]    → Cardano (ADA)
 *    *.near/64hex → NEAR Protocol
 *
 *  secp256k1 L1:
 *    cosmos1[38] → Cosmos Hub (ATOM)
 *
 *  Ring / Privacy (detection only):
 *    4[93]       → Monero (XMR)  — ring sigs, no nonce reuse possible
 */

import { logger } from "../logger";
import {
  detectChain, familyLabel, CHAINS,
  type ChainId, type SigRecord,
} from "./chain-adapter";
import { bitcoinAdapter, litecoinAdapter, dogecoinAdapter, bitcoinCashAdapter } from "./adapters/bitcoin-adapter";
import { solanaAdapter } from "./adapters/solana-adapter";
import { evmAdapters } from "./adapters/evm-adapter";
import { xrpAdapter } from "./adapters/xrp-adapter";
import { dashAdapter, zcashAdapter } from "./adapters/utxo-privacy-adapter";
import { stellarAdapter, cardanoAdapter, nearAdapter, cosmosAdapter } from "./adapters/stellar-cardano-adapter";
import type { ChainAdapter } from "./chain-adapter";

// ── Finding type ──────────────────────────────────────────────────────────────

export interface MultiChainFinding {
  address:           string;
  chain:             ChainId;
  chainName:         string;
  chainFamily:       string;
  attackType:        "nonce_reuse" | "weak_k" | "r_collision" | "ed25519_nonce_reuse"
                   | "low_s_bias" | "shielded_detection";
  sharedR:           string;
  txHash1:           string;
  txHash2:           string;
  recoveredPrivKey?: string;
  recoveredK?:       string;
  confidence:        number;
  detail:            string;
  sigsAnalysed:      number;
  discoveredAt:      string;
}

// ── Adapter registry ──────────────────────────────────────────────────────────

function getAdapter(chain: ChainId): ChainAdapter | null {
  switch (chain) {
    // Bitcoin family
    case "bitcoin":       return bitcoinAdapter;
    case "litecoin":      return litecoinAdapter;
    case "dogecoin":      return dogecoinAdapter;
    case "bitcoincash":   return bitcoinCashAdapter;
    // UTXO privacy
    case "dash":          return dashAdapter;
    case "zcash":         return zcashAdapter;
    // XRP
    case "ripple":        return xrpAdapter;
    // Ed25519 family
    case "solana":        return solanaAdapter;
    case "stellar":       return stellarAdapter;
    case "cardano":       return cardanoAdapter;
    case "near":          return nearAdapter;
    // secp256k1 L1
    case "cosmos":        return cosmosAdapter;
    // EVM (resolved via fetchEvmSigsAcrossChains)
    case "ethereum":
    case "polygon":
    case "bsc":
    case "arbitrum":
    case "optimism":
    case "avalanche":
    case "base":
    case "fantom":
    case "ethereum_classic":
    case "tron":
      return evmAdapters[chain] ?? evmAdapters.ethereum;
    // Ring signatures — no adapter
    case "monero":
      return null;
    default:
      return null;
  }
}

// ── Weak-k bias detector ──────────────────────────────────────────────────────

function detectWeakKBias(sigs: SigRecord[]): number {
  if (sigs.length < 5) return 0;
  const leadingZeros = sigs.filter(s => s.r.startsWith("00")).length;
  return leadingZeros / sigs.length;
}

// ── Low-s bias detector ───────────────────────────────────────────────────────

const HALF_N = BigInt("0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0");

function detectLowSBias(sigs: SigRecord[]): number {
  if (sigs.length < 5) return 0;
  const lowS = sigs.filter(s => {
    try { return BigInt("0x" + s.s) < HALF_N; } catch { return false; }
  }).length;
  return lowS / sigs.length;
}

// ── EVM chain refinement ──────────────────────────────────────────────────────
// 0x addresses don't reveal which EVM chain they belong to, so we try them all.

const EVM_CHAIN_ORDER: ChainId[] = [
  "ethereum", "polygon", "bsc", "arbitrum", "optimism",
  "avalanche", "base", "fantom", "ethereum_classic", "tron",
];

async function fetchEvmSigsAcrossChains(
  address: string,
  maxTx = 80,
): Promise<{ sigs: SigRecord[]; chain: ChainId }> {
  for (const chainId of EVM_CHAIN_ORDER) {
    const adapter = evmAdapters[chainId];
    if (!adapter) continue;
    try {
      const sigs = await adapter.fetchSignatures(address, maxTx);
      if (sigs.length > 0) return { sigs, chain: chainId };
    } catch { /* try next */ }
  }
  return { sigs: [], chain: "ethereum" };
}

// ── Zcash shielded detection ──────────────────────────────────────────────────

const ZEC_SHIELDED_RE = /^(zs1|u1)[a-z0-9]{60,}$/;

// ── Main scanner ──────────────────────────────────────────────────────────────

export interface MultiChainScanResult {
  address:     string;
  chain:       ChainId;
  chainName:   string;
  chainFamily: string;
  sigsFound:   number;
  findings:    MultiChainFinding[];
  error?:      string;
  scanMs:      number;
}

export async function scanAddress(
  address: string,
  opts: { maxTx?: number; forceChain?: ChainId } = {}
): Promise<MultiChainScanResult> {
  const t0 = Date.now();
  const { maxTx = 80, forceChain } = opts;
  const detectedChain = forceChain ?? detectChain(address);
  const chainInfo     = CHAINS[detectedChain];

  if (detectedChain === "unknown") {
    return {
      address, chain: "unknown", chainName: "Unknown", chainFamily: "unknown",
      sigsFound: 0, findings: [], error: "Unrecognised address format", scanMs: 0,
    };
  }

  // ── Monero: ring signatures — flag and return ────────────────────────────
  if (detectedChain === "monero") {
    return {
      address, chain: "monero", chainName: "Monero", chainFamily: "Monero/RingCT",
      sigsFound: 0, findings: [{
        address, chain: "monero", chainName: "Monero", chainFamily: "Monero/RingCT",
        attackType: "shielded_detection",
        sharedR: "", txHash1: "", txHash2: "",
        confidence: 1.0,
        detail: "Monero uses RingCT ring signatures — individual ECDSA nonces are cryptographically hidden. Address flagged as likely privacy/mixing layer.",
        sigsAnalysed: 0,
        discoveredAt: new Date().toISOString(),
      }],
      scanMs: Date.now() - t0,
    };
  }

  // ── Zcash shielded: zk-SNARKs — flag and return ──────────────────────────
  if (detectedChain === "zcash" && ZEC_SHIELDED_RE.test(address)) {
    return {
      address, chain: "zcash", chainName: "Zcash (Shielded)", chainFamily: "Zcash/zk-SNARKs",
      sigsFound: 0, findings: [{
        address, chain: "zcash", chainName: "Zcash (Shielded)", chainFamily: "Zcash/zk-SNARKs",
        attackType: "shielded_detection",
        sharedR: "", txHash1: "", txHash2: "",
        confidence: 1.0,
        detail: "Zcash shielded address (Sapling/Orchard) — transactions are zk-SNARK proofs. Transparent-to-shielded laundering hop flagged for investigation.",
        sigsAnalysed: 0,
        discoveredAt: new Date().toISOString(),
      }],
      scanMs: Date.now() - t0,
    };
  }

  try {
    let sigs: SigRecord[];
    let resolvedChain: ChainId = detectedChain;

    if (detectedChain === "ethereum") {
      const { sigs: evmSigs, chain } = await fetchEvmSigsAcrossChains(address, maxTx);
      sigs = evmSigs;
      resolvedChain = chain;
    } else {
      const adapter = getAdapter(detectedChain);
      sigs = adapter ? await adapter.fetchSignatures(address, maxTx) : [];
    }

    const resolvedAdapter = getAdapter(resolvedChain);
    const rawFindings     = resolvedAdapter ? resolvedAdapter.checkNonceReuse(address, sigs) : [];

    const findings: MultiChainFinding[] = rawFindings.map(f => {
      const isEd25519 = chainInfo.family === "generic_ed25519" || chainInfo.family === "solana_ed25519";
      return {
        address,
        chain:           resolvedChain,
        chainName:       CHAINS[resolvedChain]?.name ?? resolvedChain,
        chainFamily:     familyLabel(resolvedChain),
        attackType:      isEd25519 ? "ed25519_nonce_reuse" : "nonce_reuse",
        sharedR:         f.sharedR,
        txHash1:         f.sig1.txHash,
        txHash2:         f.sig2.txHash,
        recoveredPrivKey: f.recoveredPrivKey,
        recoveredK:      f.recoveredK,
        confidence:      f.confidence,
        detail:          f.detail,
        sigsAnalysed:    sigs.length,
        discoveredAt:    new Date().toISOString(),
      };
    });

    // ── Statistical checks (secp256k1 chains only) ──────────────────────────
    if (chainInfo.family === "bitcoin_secp256k1" || chainInfo.family === "evm_secp256k1") {
      const weakBias = detectWeakKBias(sigs);
      const lowS     = detectLowSBias(sigs);

      if (weakBias > 0.2 && sigs.length >= 10) {
        findings.push({
          address, chain: resolvedChain,
          chainName:    CHAINS[resolvedChain]?.name ?? resolvedChain,
          chainFamily:  familyLabel(resolvedChain),
          attackType:   "weak_k",
          sharedR:      "", txHash1: sigs[0]?.txHash ?? "", txHash2: "",
          confidence:   weakBias,
          detail:       `${Math.round(weakBias * 100)}% of signatures show leading-zero r-values — possible biased k generation (${sigs.length} sigs analysed)`,
          sigsAnalysed: sigs.length,
          discoveredAt: new Date().toISOString(),
        });
      }

      if (lowS < 0.3 && sigs.length >= 10) {
        findings.push({
          address, chain: resolvedChain,
          chainName:    CHAINS[resolvedChain]?.name ?? resolvedChain,
          chainFamily:  familyLabel(resolvedChain),
          attackType:   "low_s_bias",
          sharedR:      "", txHash1: sigs[0]?.txHash ?? "", txHash2: "",
          confidence:   0.6,
          detail:       `Only ${Math.round(lowS * 100)}% of s-values are below n/2 — non-canonical s distribution may indicate non-standard signing`,
          sigsAnalysed: sigs.length,
          discoveredAt: new Date().toISOString(),
        });
      }
    }

    logger.info(
      { address, chain: resolvedChain, sigsFound: sigs.length, findings: findings.length },
      "MultiChainEngine: scan complete"
    );

    return {
      address, chain: resolvedChain,
      chainName:   CHAINS[resolvedChain]?.name ?? resolvedChain,
      chainFamily: familyLabel(resolvedChain),
      sigsFound:   sigs.length,
      findings,
      scanMs: Date.now() - t0,
    };
  } catch (err) {
    logger.warn({ address, chain: detectedChain, err: String(err) }, "MultiChainEngine: scan error");
    return {
      address, chain: detectedChain,
      chainName:   chainInfo.name,
      chainFamily: familyLabel(detectedChain),
      sigsFound:   0, findings: [],
      error:  String(err),
      scanMs: Date.now() - t0,
    };
  }
}

export async function scanAddressBatch(
  addresses: string[],
  opts: { maxTx?: number; concurrency?: number } = {}
): Promise<MultiChainScanResult[]> {
  const { concurrency = 4 } = opts;
  const results: MultiChainScanResult[] = [];
  for (let i = 0; i < addresses.length; i += concurrency) {
    const chunk = addresses.slice(i, i + concurrency);
    const batch = await Promise.allSettled(chunk.map(a => scanAddress(a, opts)));
    for (const r of batch) {
      if (r.status === "fulfilled") results.push(r.value);
    }
  }
  return results;
}
