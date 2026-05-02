// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
/**
 * Cross-Engine Intelligence Pool
 * ════════════════════════════════
 * A singleton, in-memory shared state that ALL five engines read from and write
 * to during a scan session. This is the central nervous system of the cross-engine
 * wiring — any engine can deposit intelligence for any other engine to consume.
 *
 * Data flows implemented here:
 *
 *   E1 → E3   r-collision addresses (same k used by multiple wallets)
 *   E1 → E3   all unique signing addresses from each block window
 *   E1 → E4   nonce-reuse addresses for peel-chain tracing
 *   E1 → pool raw r/s/z signature data for cross-engine nonce-reuse checks
 *
 *   E2 → E3   ETH addresses extracted from leaked-key page context
 *   E2 → E4   addresses derived from any private key found on the web
 *   E2 → pool rs_pair finds → cross-engine nonce-reuse detection
 *
 *   E3 → E2   source URLs (GitHub, Pastebin) from each finding
 *   E3 → E4   addresses derived from found private keys
 *   E3 → E1   raw_address / address findings → targeted block re-scan
 *
 *   E4 → E3   every hop's outgoingAddresses → OSINT on downstream wallets
 *   E4 → E1   nonceReuseAddresses at hops → targeted E1 deep-scan
 *   E4 → pool hop rValues → cross-engine nonce-reuse comparison
 */

import { ethers } from "ethers";
import { logger  } from "../logger";

// ── Types ─────────────────────────────────────────────────────────────────────

/** A raw ECDSA signature contribution from any engine, keyed by r-value. */
export interface SigEntry {
  r:          string;   // hex, 0x-prefixed, 64 chars
  s:          string;   // hex, 0x-prefixed, 64 chars
  z?:         string;   // msgHash (optional — may not be known from web finds)
  address?:   string;   // signer address if known
  txHash?:    string;
  url?:       string;
  source:     "e1_block" | "e2_web" | "e3_osint" | "e4_peel";
  discoveredAt: string;
}

/** A cross-engine nonce-reuse candidate — two sigs sharing the same r. */
export interface CrossNonceCandidate {
  r:         string;
  entries:   SigEntry[];
  addresses: string[];
  detectedAt: string;
}

// ── Pool ──────────────────────────────────────────────────────────────────────

export interface CrossEnginePool {
  // ── Address queues ──────────────────────────────────────────────────────────
  /** Addresses for Engine 3 (OSINT) to research. Any engine can add here. */
  pendingOsintAddresses:      Set<string>;
  /** Addresses for Engine 4 (Peel Chain) to trace. Any engine can add here. */
  pendingPeelAddresses:       Set<string>;
  /** Addresses for Engine 1 to deep-scan (targeted, not rolling-window). */
  pendingE1TargetedAddresses: Set<string>;
  /**
   * Addresses for the Multi-Chain Engine to scan on their native blockchain.
   * Key = address, Value = detected chain ID (or "auto" to let engine detect).
   * All non-EVM addresses (BTC, LTC, DOGE, SOL, etc.) land here.
   */
  pendingMultiChainAddresses: Map<string, string>;
  /**
   * TX hashes queued for Engine 0 (TX Hash ECDSA Extractor).
   * Each hash is fetched, its ECDSA (r,s,z) extracted, and nonce-reuse checked.
   */
  pendingTxHashes: string[];
  /** Progress counters for the tx hash engine. */
  txHashProgress: { total: number; processed: number; keysFound: number };

  // ── URL queue ───────────────────────────────────────────────────────────────
  /** URLs for Engine 2 (Web Spider) to crawl. Any engine can add here. */
  pendingSpiderUrls: string[];
  /** Already visited URLs — dedup guard. */
  visitedSpiderUrls: Set<string>;

  // ── r-value signature registry ──────────────────────────────────────────────
  /** r → [SigEntry, …] — all known sigs for a given r-value, across all engines. */
  rValueSigs:         Map<string, SigEntry[]>;
  /** r → Set<address> — which addresses have used this r-value. */
  rValueAddresses:    Map<string, Set<string>>;
  /** Newly detected cross-engine nonce-reuse candidates since last drain. */
  crossNonceCandidates: CrossNonceCandidate[];

  // ── Results ─────────────────────────────────────────────────────────────────
  /** All private keys confirmed by any engine. Deduplicated. */
  confirmedPrivateKeys: Set<string>;
  /** OSINT keywords — augmented as new addresses/domains are found. */
  osintKeywords:        Set<string>;

  // ── Telemetry ────────────────────────────────────────────────────────────────
  stats: {
    e1ToE3:  number;  // addresses fed E1 → E3
    e1ToE4:  number;  // addresses fed E1 → E4
    e2ToE3:  number;  // addresses fed E2 → E3
    e2ToE4:  number;  // addresses fed E2 → E4
    e2ToPool:number;  // rs_pairs deposited from E2
    e3ToE2:  number;  // URLs fed E3 → E2
    e3ToE4:  number;  // addresses fed E3 → E4
    e3ToE1:  number;  // addresses fed E3 → E1
    e4ToE3:  number;  // addresses fed E4 → E3
    e4ToE1:  number;  // addresses fed E4 → E1
    e4ToPool:number;  // r-values deposited from E4
    crossNonceChecks: number;
    crossNonceHits:   number;
  };
}

// ── Singleton ─────────────────────────────────────────────────────────────────

let _pool: CrossEnginePool | null = null;

export function getCrossEnginePool(): CrossEnginePool {
  if (!_pool) {
    _pool = {
      pendingOsintAddresses:       new Set(),
      pendingPeelAddresses:        new Set(),
      pendingE1TargetedAddresses:  new Set(),
      pendingMultiChainAddresses:  new Map(),
      pendingTxHashes:             [],
      txHashProgress:              { total: 0, processed: 0, keysFound: 0 },
      pendingSpiderUrls:           [],
      visitedSpiderUrls:          new Set(),
      rValueSigs:                 new Map(),
      rValueAddresses:            new Map(),
      crossNonceCandidates:       [],
      confirmedPrivateKeys:       new Set(),
      osintKeywords:              new Set([
        "ethereum private key", "0x private key", "wallet seed",
        "metamask seed", "privateKey 0x", "nonce reuse",
        "ecdsa signature", "wallet mnemonic",
      ]),
      stats: {
        e1ToE3: 0, e1ToE4: 0,
        e2ToE3: 0, e2ToE4: 0, e2ToPool: 0,
        e3ToE2: 0, e3ToE4: 0, e3ToE1: 0,
        e4ToE3: 0, e4ToE1: 0, e4ToPool: 0,
        crossNonceChecks: 0, crossNonceHits: 0,
      },
    };
  }
  return _pool;
}

/** Hard-reset the pool (call when starting a completely fresh run). */
export function resetCrossEnginePool(): void {
  _pool = null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const ETH_ADDR_RE = /\b(0x[0-9a-fA-F]{40})\b/g;
const N = BigInt("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141");

/** Derive an Ethereum address from a private key hex string. Returns null on failure. */
export function deriveAddress(privKeyHex: string): string | null {
  try {
    const hex = privKeyHex.startsWith("0x") ? privKeyHex : "0x" + privKeyHex;
    return new ethers.Wallet(hex).address.toLowerCase();
  } catch { return null; }
}

/** Return true if the hex value looks like a valid secp256k1 private key. */
export function looksLikePrivKey(hex: string): boolean {
  try {
    const n = BigInt(hex.startsWith("0x") ? hex : "0x" + hex);
    return n > 0n && n < N;
  } catch { return false; }
}

/** Extract ETH addresses (0x + 40 hex chars) from a text snippet. */
export function extractAddressesFromText(text: string): string[] {
  const found = new Set<string>();
  for (const m of text.matchAll(ETH_ADDR_RE)) {
    found.add(m[1].toLowerCase());
  }
  return [...found];
}

/**
 * Register a signature entry and detect cross-engine nonce reuse.
 * Returns a CrossNonceCandidate if the r-value is now shared by ≥2 entries.
 */
export function registerSig(
  pool:  CrossEnginePool,
  entry: SigEntry,
): CrossNonceCandidate | null {
  const r = entry.r.toLowerCase();

  const sigList = pool.rValueSigs.get(r) ?? [];
  sigList.push(entry);
  pool.rValueSigs.set(r, sigList);

  const addrSet = pool.rValueAddresses.get(r) ?? new Set<string>();
  if (entry.address) addrSet.add(entry.address.toLowerCase());
  pool.rValueAddresses.set(r, addrSet);

  pool.stats.crossNonceChecks++;

  if (sigList.length >= 2) {
    // Look for two entries from DIFFERENT sources or addresses — that's a cross-engine collision
    const sources = new Set(sigList.map(e => e.source));
    const addrs   = new Set(sigList.map(e => e.address).filter(Boolean));
    const isInteresting = sources.size > 1 || addrs.size > 1;

    if (isInteresting) {
      pool.stats.crossNonceHits++;
      const candidate: CrossNonceCandidate = {
        r,
        entries:    sigList,
        addresses:  [...addrSet],
        detectedAt: new Date().toISOString(),
      };
      // Only add if not already registered
      const alreadyExists = pool.crossNonceCandidates.some(c => c.r === r);
      if (!alreadyExists) {
        pool.crossNonceCandidates.push(candidate);
        logger.info(
          { r: r.slice(0, 18), sources: [...sources], addrs: [...addrs].slice(0, 3) },
          "Cross-engine nonce reuse candidate detected",
        );
      }
      return candidate;
    }
  }
  return null;
}

// ── E1 output → pool ──────────────────────────────────────────────────────────

import type { SigMinerResult } from "./signature-miner";

/**
 * Process Engine 1 output and deposit into the cross-engine pool.
 * Returns counts of items fed to each downstream engine.
 */
export function feedE1ToPool(result: SigMinerResult, pool: CrossEnginePool): {
  toE3: number; toE4: number; sigsRegistered: number;
} {
  let toE3 = 0; let toE4 = 0; let sigsReg = 0;

  // ── All unique signing addresses → E3 (OSINT)
  for (const addr of Object.keys(result.sigsByAddress)) {
    if (!pool.pendingOsintAddresses.has(addr)) {
      pool.pendingOsintAddresses.add(addr.toLowerCase());
      toE3++;
    }
  }
  pool.stats.e1ToE3 += toE3;

  // ── r-collision addresses → E3 (these wallets share a k-nonce — high priority OSINT)
  for (const col of result.rCollisions) {
    for (const addr of col.addresses) {
      pool.pendingOsintAddresses.add(addr.toLowerCase());
      // Also add their address strings as extra OSINT keywords
      pool.osintKeywords.add(addr.toLowerCase());
    }
  }

  // ── Nonce-reuse addresses → E4 (Peel Chain)
  const nonceAddrs = result.findings
    .filter(f => f.attackType === "nonce_reuse" && f.address)
    .map(f => f.address!.toLowerCase());
  for (const a of nonceAddrs) {
    if (!pool.pendingPeelAddresses.has(a)) {
      pool.pendingPeelAddresses.add(a);
      toE4++;
    }
  }
  pool.stats.e1ToE4 += toE4;

  // ── All signatures → r-value registry for cross-engine nonce detection
  for (const [addr, sigs] of Object.entries(result.sigsByAddress)) {
    for (const sig of sigs) {
      const candidate = registerSig(pool, {
        r: sig.r, s: sig.s, z: sig.z,
        address: addr.toLowerCase(),
        txHash:  sig.txHash,
        source:  "e1_block",
        discoveredAt: new Date().toISOString(),
      });
      sigsReg++;
      // If new cross-engine candidate detected, feed those addresses to E3 + E4
      if (candidate) {
        for (const ca of candidate.addresses) {
          pool.pendingOsintAddresses.add(ca);
          pool.pendingPeelAddresses.add(ca);
        }
      }
    }
  }

  // ── Confirmed private keys
  for (const f of result.findings) {
    if (f.privateKey) pool.confirmedPrivateKeys.add(f.privateKey);
  }

  return { toE3, toE4, sigsRegistered: sigsReg };
}

// ── E2 output → pool ──────────────────────────────────────────────────────────

import type { WebSpiderResult } from "./web-sig-spider";

/**
 * Process Engine 2 output and deposit into the cross-engine pool.
 */
export function feedE2ToPool(result: WebSpiderResult, pool: CrossEnginePool): {
  toE3: number; toE4: number; sigsRegistered: number;
} {
  let toE3 = 0; let toE4 = 0; let sigsReg = 0;

  for (const f of result.finds) {
    // ── Private key hex finds → derive address → E3 + E4
    if (f.kind === "private_key_hex" || f.kind === "private_key_wif") {
      if (looksLikePrivKey(f.value)) {
        const addr = deriveAddress(f.value);
        if (addr) {
          pool.pendingOsintAddresses.add(addr);
          pool.pendingPeelAddresses.add(addr);
          pool.osintKeywords.add(addr);
          pool.confirmedPrivateKeys.add(f.value);
          toE3++; toE4++;
        }
      }
    }

    // ── rs_pair finds → register in r-value pool for cross nonce-reuse check
    if (f.kind === "rs_pair") {
      // value is "r|s" or the raw r value (depends on regex capture)
      // Try to split: format from regex: full match contains r and s
      const parts = f.value.split(/[,;|]/);
      if (parts.length >= 2) {
        const [r, s] = parts;
        if (r?.length >= 64 && s?.length >= 64) {
          const candidate = registerSig(pool, {
            r: r.startsWith("0x") ? r : "0x" + r,
            s: s.startsWith("0x") ? s : "0x" + s,
            url:    f.url,
            source: "e2_web",
            discoveredAt: f.discoveredAt,
          });
          sigsReg++;
          pool.stats.e2ToPool++;
          if (candidate) {
            for (const ca of candidate.addresses) {
              pool.pendingOsintAddresses.add(ca);
              pool.pendingPeelAddresses.add(ca);
            }
          }
        }
      }
    }

    // ── Full ECDSA signature (128 hex chars) → extract r, s → pool
    if (f.kind === "ecdsa_signature") {
      try {
        const hex = f.value.startsWith("0x") ? f.value.slice(2) : f.value;
        if (hex.length >= 128) {
          const r = "0x" + hex.slice(0, 64);
          const s = "0x" + hex.slice(64, 128);
          registerSig(pool, { r, s, url: f.url, source: "e2_web", discoveredAt: f.discoveredAt });
          sigsReg++;
          pool.stats.e2ToPool++;
        }
      } catch {}
    }

    // ── Extract ETH addresses from context text → E3 + E4
    const ctxAddrs = extractAddressesFromText(f.context ?? "");
    for (const addr of ctxAddrs) {
      if (!pool.pendingOsintAddresses.has(addr)) {
        pool.pendingOsintAddresses.add(addr);
        toE3++;
      }
    }
  }

  pool.stats.e2ToE3 += toE3;
  pool.stats.e2ToE4 += toE4;

  return { toE3, toE4, sigsRegistered: sigsReg };
}

// ── E3 output → pool ──────────────────────────────────────────────────────────

import type { OsintResult } from "./osint-sig-spider";

/**
 * Process Engine 3 (OSINT) output and deposit into the cross-engine pool.
 */
export function feedE3ToPool(result: OsintResult, pool: CrossEnginePool): {
  toE2: number; toE4: number; toE1: number;
} {
  let toE2 = 0; let toE4 = 0; let toE1 = 0;

  for (const f of result.findings) {
    // ── Source URLs → E2 (crawl the exact place the key was leaked)
    if (f.url && !pool.visitedSpiderUrls.has(f.url)) {
      pool.pendingSpiderUrls.push(f.url);
      pool.visitedSpiderUrls.add(f.url);
      toE2++;
      pool.stats.e3ToE2++;
    }

    // ── Private key findings → derive address → E4 (peel chain)
    if (f.kind === "private_key" && f.value) {
      const addr = f.address ?? deriveAddress(f.value);
      if (addr) {
        pool.pendingPeelAddresses.add(addr.toLowerCase());
        toE4++;
        pool.stats.e3ToE4++;
        pool.confirmedPrivateKeys.add(f.value);
      }
    }

    // ── raw_address / address findings → E1 targeted deep-scan
    if ((f.kind === "raw_address" || f.kind === "suspicious_data") && f.address) {
      pool.pendingE1TargetedAddresses.add(f.address.toLowerCase());
      toE1++;
      pool.stats.e3ToE1++;
    }
    // Also: any finding with a known address → E1 targeted scan
    if (f.address && (f.kind === "private_key" || f.kind === "ecdsa_sig")) {
      pool.pendingE1TargetedAddresses.add(f.address.toLowerCase());
    }

    // ── ECDSA sig findings → r-value pool
    if (f.kind === "ecdsa_sig") {
      try {
        const hex = f.value.startsWith("0x") ? f.value.slice(2) : f.value;
        if (hex.length >= 128) {
          const r = "0x" + hex.slice(0, 64);
          const s = "0x" + hex.slice(64, 128);
          registerSig(pool, {
            r, s,
            address: f.address,
            url:     f.url,
            txHash:  f.txHash,
            source:  "e3_osint",
            discoveredAt: f.discoveredAt,
          });
        }
      } catch {}
    }
  }

  return { toE2, toE4, toE1 };
}

// ── E4 output → pool ──────────────────────────────────────────────────────────

import type { PeelChainResult } from "./peel-chain-tracer";

/**
 * Process Engine 4 (Peel Chain) output and deposit into the cross-engine pool.
 */
export function feedE4ToPool(result: PeelChainResult, pool: CrossEnginePool): {
  toE3: number; toE1: number; sigsRegistered: number;
} {
  let toE3 = 0; let toE1 = 0; let sigsReg = 0;

  for (const hop of result.hops) {
    // ── Every outgoing address at each hop → E3 (OSINT on fund recipients)
    for (const addr of hop.outgoingAddresses) {
      if (!pool.pendingOsintAddresses.has(addr.toLowerCase())) {
        pool.pendingOsintAddresses.add(addr.toLowerCase());
        pool.osintKeywords.add(addr.toLowerCase());
        toE3++;
      }
    }

    // ── Each hop's r-values → r-value pool (cross-engine nonce check)
    for (const rHex of hop.rValues) {
      registerSig(pool, {
        r:       rHex,
        s:       "0x" + "00".repeat(32), // s unknown from peel chain — just register r
        address: hop.address.toLowerCase(),
        source:  "e4_peel",
        discoveredAt: new Date().toISOString(),
      });
      sigsReg++;
      pool.stats.e4ToPool++;
    }
  }

  // ── Nonce-reuse addresses at any hop → E1 targeted deep-scan
  for (const addr of result.nonceReuseAddresses) {
    if (!pool.pendingE1TargetedAddresses.has(addr.toLowerCase())) {
      pool.pendingE1TargetedAddresses.add(addr.toLowerCase());
      toE1++;
      pool.stats.e4ToE1++;
    }
  }

  pool.stats.e4ToE3 += toE3;

  // ── Confirmed private keys
  for (const k of result.privateKeysFound) {
    pool.confirmedPrivateKeys.add(k);
  }

  return { toE3, toE1, sigsRegistered: sigsReg };
}

// ── Drain helpers (called before each engine run) ─────────────────────────────

/** Drain up to `limit` OSINT addresses and return them. */
export function drainOsintAddresses(pool: CrossEnginePool, limit = 30): string[] {
  const addrs = [...pool.pendingOsintAddresses].slice(0, limit);
  for (const a of addrs) pool.pendingOsintAddresses.delete(a);
  return addrs;
}

/** Drain up to `limit` peel-chain addresses and return them. */
export function drainPeelAddresses(pool: CrossEnginePool, limit = 5): string[] {
  const addrs = [...pool.pendingPeelAddresses].slice(0, limit);
  for (const a of addrs) pool.pendingPeelAddresses.delete(a);
  return addrs;
}

/** Drain up to `limit` E1-targeted addresses and return them. */
export function drainE1TargetedAddresses(pool: CrossEnginePool, limit = 20): string[] {
  const addrs = [...pool.pendingE1TargetedAddresses].slice(0, limit);
  for (const a of addrs) pool.pendingE1TargetedAddresses.delete(a);
  return addrs;
}

/** Drain up to `limit` spider URLs and return them. */
export function drainSpiderUrls(pool: CrossEnginePool, limit = 30): string[] {
  const fresh = pool.pendingSpiderUrls
    .filter(u => !pool.visitedSpiderUrls.has(u))
    .slice(0, limit);
  pool.pendingSpiderUrls = pool.pendingSpiderUrls.filter(u => !fresh.includes(u));
  for (const u of fresh) pool.visitedSpiderUrls.add(u);
  return fresh;
}

/** Drain all cross-nonce candidates since last call. */
export function drainCrossNonceCandidates(pool: CrossEnginePool): CrossNonceCandidate[] {
  const out = [...pool.crossNonceCandidates];
  pool.crossNonceCandidates = [];
  return out;
}

/**
 * Drain up to `limit` multi-chain addresses from the pool.
 * Returns array of [address, chainId] tuples.
 */
export function drainMultiChainAddresses(
  pool: CrossEnginePool, limit = 10
): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  for (const [addr, chain] of pool.pendingMultiChainAddresses.entries()) {
    out.push([addr, chain]);
    pool.pendingMultiChainAddresses.delete(addr);
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * Drain up to `limit` tx hashes from the pending queue.
 */
export function drainTxHashes(pool: CrossEnginePool, limit = 20): string[] {
  const batch = pool.pendingTxHashes.splice(0, limit);
  return batch;
}

/** Pool telemetry summary string for logging. */
export function poolSummary(pool: CrossEnginePool): string {
  const s   = pool.stats;
  const txp = pool.txHashProgress;
  return [
    `osintQ=${pool.pendingOsintAddresses.size}`,
    `peelQ=${pool.pendingPeelAddresses.size}`,
    `e1Q=${pool.pendingE1TargetedAddresses.size}`,
    `multiChainQ=${pool.pendingMultiChainAddresses.size}`,
    `txHashQ=${pool.pendingTxHashes.length}(${txp.processed}/${txp.total} done,keys=${txp.keysFound})`,
    `urlQ=${pool.pendingSpiderUrls.length}`,
    `rValues=${pool.rValueSigs.size}`,
    `crossNonceHits=${s.crossNonceHits}`,
    `confirmedKeys=${pool.confirmedPrivateKeys.size}`,
    `flows=[E1→E3:${s.e1ToE3} E1→E4:${s.e1ToE4} E2→E3:${s.e2ToE3} E2→E4:${s.e2ToE4}`,
    ` E3→E2:${s.e3ToE2} E3→E4:${s.e3ToE4} E3→E1:${s.e3ToE1}`,
    ` E4→E3:${s.e4ToE3} E4→E1:${s.e4ToE1}]`,
  ].join(" ");
}
