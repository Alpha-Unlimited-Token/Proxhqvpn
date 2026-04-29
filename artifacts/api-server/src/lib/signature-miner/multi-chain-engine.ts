/**
 * Multi-Chain Engine
 * ══════════════════
 * The unified entry point for analysing any wallet address regardless of chain.
 *
 * Given an address string it:
 *   1. Auto-detects the blockchain from the address format
 *   2. Routes to the correct chain adapter (EVM, Bitcoin-family, Solana, Monero)
 *   3. Fetches all available transaction signatures from that chain's block explorer
 *   4. Runs nonce-reuse detection + any chain-specific attack checks
 *   5. Returns normalised MultiChainFinding records
 *
 * Supported chains and their detection:
 *   0x[40 hex]           → Ethereum / EVM (Polygon, BSC, Arbitrum, Optimism, Avalanche, Base, Fantom)
 *   T[33 base58]         → Tron (EVM-compatible secp256k1)
 *   1/3/bc1…             → Bitcoin  (secp256k1, DER-encoded)
 *   L/M/ltc1…            → Litecoin (secp256k1, DER-encoded)
 *   D[33]                → Dogecoin (secp256k1, DER-encoded)
 *   bitcoincash:q/p[41]  → Bitcoin Cash
 *   [32-44 base58]       → Solana   (Ed25519)
 *   4[93 base58]         → Monero   (ring signatures — detection only)
 */

import { logger } from "../logger";
import {
  detectChain, familyLabel, CHAINS,
  type ChainId, type SigRecord,
} from "./chain-adapter";
import { bitcoinAdapter, litecoinAdapter, dogecoinAdapter, bitcoinCashAdapter } from "./adapters/bitcoin-adapter";
import { solanaAdapter } from "./adapters/solana-adapter";
import { evmAdapters } from "./adapters/evm-adapter";
import type { ChainAdapter } from "./chain-adapter";

// ── Finding type ──────────────────────────────────────────────────────────────

export interface MultiChainFinding {
  address:           string;
  chain:             ChainId;
  chainName:         string;
  chainFamily:       string;
  attackType:        "nonce_reuse" | "weak_k" | "r_collision" | "ed25519_nonce_reuse" | "low_s_bias";
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
    case "bitcoin":      return bitcoinAdapter;
    case "litecoin":     return litecoinAdapter;
    case "dogecoin":     return dogecoinAdapter;
    case "bitcoincash":  return bitcoinCashAdapter;
    case "solana":       return solanaAdapter;
    case "ethereum":
    case "polygon":
    case "bsc":
    case "arbitrum":
    case "optimism":
    case "avalanche":
    case "base":
    case "fantom":
    case "tron":
      return evmAdapters[chain] ?? evmAdapters.ethereum;
    case "monero":
      return null; // ring signatures — no nonce-reuse recovery possible
    default:
      return null;
  }
}

// ── Weak-k bias detector (works for any secp256k1 sig set) ───────────────────

function detectWeakKBias(sigs: SigRecord[]): number {
  // r values with many leading zeros suggest k was biased toward small values
  if (sigs.length < 5) return 0;
  const leadingZeros = sigs.filter(s => s.r.startsWith("00")).length;
  return leadingZeros / sigs.length;
}

// ── Low-s bias detector ───────────────────────────────────────────────────────
// secp256k1 curve order n / 2 — s values below this indicate canonical form was enforced

const HALF_N = BigInt("0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0");

function detectLowSBias(sigs: SigRecord[]): number {
  if (sigs.length < 5) return 0;
  const lowS = sigs.filter(s => {
    try { return BigInt("0x" + s.s) < HALF_N; } catch { return false; }
  }).length;
  return lowS / sigs.length;
}

// ── EVM chain refiner ─────────────────────────────────────────────────────────
// For EVM addresses (0x…) we can't determine the specific chain from the address alone.
// We try Ethereum first (most likely), then escalate to other EVM chains if no sigs found.

const EVM_CHAIN_ORDER: ChainId[] = ["ethereum", "polygon", "bsc", "arbitrum", "optimism", "avalanche", "base", "fantom", "tron"];

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

// ── Main scanner ──────────────────────────────────────────────────────────────

export interface MultiChainScanResult {
  address:      string;
  chain:        ChainId;
  chainName:    string;
  chainFamily:  string;
  sigsFound:    number;
  findings:     MultiChainFinding[];
  error?:       string;
  scanMs:       number;
}

/**
 * Scan a single wallet address for signature vulnerabilities.
 * Auto-detects chain, fetches sigs, runs all checks.
 */
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

  if (detectedChain === "monero") {
    return {
      address, chain: "monero", chainName: "Monero", chainFamily: "Monero/RingCT",
      sigsFound: 0, findings: [],
      error: "Monero uses ring signatures — nonce-reuse recovery not applicable",
      scanMs: Date.now() - t0,
    };
  }

  try {
    let sigs: SigRecord[];
    let resolvedChain: ChainId = detectedChain;

    if (detectedChain === "ethereum") {
      // Try all EVM chains in order until we find transactions
      const { sigs: evmSigs, chain } = await fetchEvmSigsAcrossChains(address, maxTx);
      sigs = evmSigs;
      resolvedChain = chain;
    } else {
      const adapter = getAdapter(detectedChain);
      sigs = adapter ? await adapter.fetchSignatures(address, maxTx) : [];
    }

    const resolvedAdapter = getAdapter(resolvedChain);
    const rawFindings     = resolvedAdapter ? resolvedAdapter.checkNonceReuse(address, sigs) : [];
    const findings: MultiChainFinding[] = rawFindings.map(f => ({
      address,
      chain:           resolvedChain,
      chainName:       CHAINS[resolvedChain].name,
      chainFamily:     familyLabel(resolvedChain),
      attackType:      f.recoveredPrivKey ? "nonce_reuse" : "nonce_reuse",
      sharedR:         f.sharedR,
      txHash1:         f.sig1.txHash,
      txHash2:         f.sig2.txHash,
      recoveredPrivKey: f.recoveredPrivKey,
      recoveredK:      f.recoveredK,
      confidence:      f.confidence,
      detail:          f.detail,
      sigsAnalysed:    sigs.length,
      discoveredAt:    new Date().toISOString(),
    }));

    // Additional statistical checks
    const weakBias = detectWeakKBias(sigs);
    const lowS     = detectLowSBias(sigs);

    if (weakBias > 0.2 && sigs.length >= 10) {
      findings.push({
        address, chain: resolvedChain,
        chainName:  CHAINS[resolvedChain].name,
        chainFamily: familyLabel(resolvedChain),
        attackType:  "weak_k",
        sharedR:     "",
        txHash1:     sigs[0]?.txHash ?? "",
        txHash2:     "",
        confidence:  weakBias,
        detail:      `${Math.round(weakBias * 100)}% of signatures show leading-zero r-values — possible biased k generation (${sigs.length} sigs analysed)`,
        sigsAnalysed: sigs.length,
        discoveredAt: new Date().toISOString(),
      });
    }

    if (lowS < 0.3 && sigs.length >= 10) {
      findings.push({
        address, chain: resolvedChain,
        chainName:  CHAINS[resolvedChain].name,
        chainFamily: familyLabel(resolvedChain),
        attackType:  "low_s_bias",
        sharedR:     "",
        txHash1:     sigs[0]?.txHash ?? "",
        txHash2:     "",
        confidence:  0.6,
        detail:      `Only ${Math.round(lowS * 100)}% of s-values are below n/2 — non-canonical s distribution may indicate non-standard signing implementation`,
        sigsAnalysed: sigs.length,
        discoveredAt: new Date().toISOString(),
      });
    }

    logger.info({ address, chain: resolvedChain, sigsFound: sigs.length, findingsCount: findings.length }, "MultiChainEngine: scan complete");

    return {
      address, chain: resolvedChain,
      chainName:   CHAINS[resolvedChain].name,
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

/**
 * Scan a batch of addresses concurrently (with a concurrency cap).
 */
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
