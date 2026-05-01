/**
 * Multi-chain Wallet Outgoing Transaction Fetcher
 * ─────────────────────────────────────────────────
 * Primary  : Alchemy alchemy_getAssetTransfers  (requires ALCHEMY_API_KEY)
 * Fallback : Blockscout v2 API                  (free, no key, paginated)
 * Tertiary : Public Ethereum RPC                (nonce-only, no tx list)
 *
 * Provides full pagination so EVERY outgoing transaction is returned.
 */

import { ethers } from "ethers";

// ── Chain registry ─────────────────────────────────────────────────────────────

export interface ChainConfig {
  id:           string;
  label:        string;
  alchemySlug:  string;
  blockscoutBase: string;
  rpcUrl:       string;
  supportsInternal: boolean;
}

export const CHAINS: ChainConfig[] = [
  {
    id: "ethereum",
    label: "Ethereum",
    alchemySlug: "eth-mainnet",
    blockscoutBase: "https://eth.blockscout.com",
    rpcUrl: "https://ethereum.publicnode.com",
    supportsInternal: true,
  },
  {
    id: "polygon",
    label: "Polygon",
    alchemySlug: "polygon-mainnet",
    blockscoutBase: "https://polygon.blockscout.com",
    rpcUrl: "https://polygon.publicnode.com",
    supportsInternal: true,
  },
  {
    id: "arbitrum",
    label: "Arbitrum",
    alchemySlug: "arb-mainnet",
    blockscoutBase: "https://arbitrum.blockscout.com",
    rpcUrl: "https://arbitrum-one.publicnode.com",
    supportsInternal: false,
  },
  {
    id: "optimism",
    label: "Optimism",
    alchemySlug: "opt-mainnet",
    blockscoutBase: "https://optimism.blockscout.com",
    rpcUrl: "https://optimism.publicnode.com",
    supportsInternal: false,
  },
  {
    id: "base",
    label: "Base",
    alchemySlug: "base-mainnet",
    blockscoutBase: "https://base.blockscout.com",
    rpcUrl: "https://base.publicnode.com",
    supportsInternal: false,
  },
  {
    id: "bsc",
    label: "BNB Chain",
    alchemySlug: "",
    blockscoutBase: "https://bsc.blockscout.com",
    rpcUrl: "https://bsc.publicnode.com",
    supportsInternal: false,
  },
];

// Ordered fallback RPC list per chain.
// Ankr requires an API key — excluded. publicnode.com and official RPCs are free.
const RPC_FALLBACKS: Record<string, string[]> = {
  ethereum: [
    "https://ethereum.publicnode.com",
    "https://1rpc.io/eth",
    "https://eth.llamarpc.com",
    "https://cloudflare-eth.com",
  ],
  polygon: [
    "https://polygon.publicnode.com",
    "https://polygon-bor-rpc.publicnode.com",
  ],
  arbitrum: [
    "https://arbitrum-one.publicnode.com",
    "https://arb1.arbitrum.io/rpc",
  ],
  optimism: [
    "https://optimism.publicnode.com",
    "https://mainnet.optimism.io",
  ],
  base: [
    "https://base.publicnode.com",
    "https://mainnet.base.org",
  ],
  bsc: [
    "https://bsc.publicnode.com",
    "https://bsc-dataseed.binance.org",
    "https://bsc-dataseed1.binance.org",
  ],
};

export function getChain(id: string): ChainConfig {
  return CHAINS.find(c => c.id === id) ?? CHAINS[0];
}

// ── Output types ───────────────────────────────────────────────────────────────

export interface OutgoingTx {
  hash:          string;
  blockNumber:   number;
  timestamp:     string;          // ISO 8601
  from:          string;
  to:            string;
  valueEth:      number;
  asset:         string;          // "ETH", "USDC", etc.
  category:      string;          // "external" | "erc20" | "internal" | ...
  nonce:         number | null;
  r:             string | null;   // ECDSA r value (hex)
  s:             string | null;   // ECDSA s value (hex)
  v:             number | null;   // recovery id
  gasPrice:      bigint | null;
  chain:         string;
}

export interface WalletSummary {
  address:       string;
  chain:         string;
  chainLabel:    string;
  nonce:         number;          // canonical outgoing tx count from RPC
  balanceEth:    number;
  outgoingTxs:   OutgoingTx[];
  totalFetched:  number;
  source:        "alchemy" | "blockscout" | "rpc-only";
  error?:        string;
}

// ── Alchemy fetcher (primary) ──────────────────────────────────────────────────

async function alchemyFetchAll(
  address:    string,
  chain:      ChainConfig,
  apiKey:     string,
): Promise<OutgoingTx[]> {
  const url = `https://${chain.alchemySlug}.g.alchemy.com/v2/${apiKey}`;
  const categories = chain.supportsInternal
    ? ["external", "internal", "erc20", "erc721", "erc1155", "specialnft"]
    : ["external", "erc20", "erc721", "erc1155", "specialnft"];

  const all: OutgoingTx[] = [];
  let pageKey: string | undefined;

  do {
    const params: Record<string, unknown> = {
      fromBlock: "0x0",
      toBlock:   "latest",
      fromAddress: address,
      category: categories,
      withMetadata: true,
      excludeZeroValue: false,
      maxCount: "0x3e8",
      ...(pageKey ? { pageKey } : {}),
    };

    const res = await fetch(url, {
      method:  "POST",
      headers: { "content-type": "application/json" },
      body:    JSON.stringify({ jsonrpc: "2.0", id: 1, method: "alchemy_getAssetTransfers", params: [params] }),
      signal:  AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`Alchemy HTTP ${res.status}`);
    const json = await res.json() as { result?: { transfers: AlchemyTransfer[]; pageKey?: string }; error?: { message: string } };
    if (json.error) throw new Error(json.error.message);

    const transfers = json.result?.transfers ?? [];
    pageKey = json.result?.pageKey;

    for (const t of transfers) {
      all.push({
        hash:        t.hash,
        blockNumber: parseInt(t.blockNum, 16),
        timestamp:   t.metadata?.blockTimestamp ?? "",
        from:        (t.from ?? address).toLowerCase(),
        to:          (t.to ?? "").toLowerCase(),
        valueEth:    t.value ?? 0,
        asset:       t.asset ?? "ETH",
        category:    t.category,
        nonce:       null,
        r:           null,
        s:           null,
        v:           null,
        gasPrice:    null,
        chain:       chain.id,
      });
    }
  } while (pageKey);

  return all;
}

interface AlchemyTransfer {
  hash:     string;
  blockNum: string;
  from:     string | null;
  to:       string | null;
  value:    number | null;
  asset:    string | null;
  category: string;
  metadata?: { blockTimestamp?: string };
}

// ── Blockscout fetcher (fallback) ──────────────────────────────────────────────

interface BsTx {
  hash:        string;
  block:       number;
  timestamp:   string;
  from:        { hash: string };
  to:          { hash: string } | null;
  value:       string;
  nonce:       number;
  raw_input?:  string;
  gas_price?:  string;
  type:        number;
}

async function blockscoutFetchAll(
  address:  string,
  chain:    ChainConfig,
  maxPages: number = 1000,        // 1000 × 50 = 50,000 txs (handles high-volume wallets)
): Promise<OutgoingTx[]> {
  const base = chain.blockscoutBase;
  const all: OutgoingTx[] = [];
  let nextPageParams: string | null = null;
  let page = 0;

  while (page < maxPages) {
    const url = nextPageParams
      ? `${base}/api/v2/addresses/${address}/transactions?filter=from&${nextPageParams}`
      : `${base}/api/v2/addresses/${address}/transactions?filter=from`;

    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) break;

    const data = await res.json() as { items: BsTx[]; next_page_params?: Record<string, string> | null };
    const items = data.items ?? [];

    for (const tx of items) {
      if (tx.from?.hash?.toLowerCase() !== address.toLowerCase()) continue;
      all.push({
        hash:        tx.hash,
        blockNumber: tx.block,
        timestamp:   tx.timestamp,
        from:        tx.from.hash.toLowerCase(),
        to:          tx.to?.hash?.toLowerCase() ?? "",
        valueEth:    Number(BigInt(tx.value || "0")) / 1e18,
        asset:       "ETH",
        category:    "external",
        nonce:       tx.nonce,
        r:           null,
        s:           null,
        v:           null,
        gasPrice:    tx.gas_price ? BigInt(tx.gas_price) : null,
        chain:       chain.id,
      });
    }

    if (!data.next_page_params) break;
    nextPageParams = new URLSearchParams(data.next_page_params as Record<string, string>).toString();
    page++;

    await new Promise(r => setTimeout(r, 120)); // polite rate limit
  }

  return all;
}

// ── RPC-level signature enrichment ────────────────────────────────────────────

interface RawTx {
  nonce:    string;
  r:        string;
  s:        string;
  v:        string;
  gasPrice?: string;
  hash?:    string;
}

async function fetchRawTx(hash: string, rpcUrl: string, chainId?: string): Promise<RawTx | null> {
  const endpoints = chainId
    ? [rpcUrl, ...(RPC_FALLBACKS[chainId] ?? []).filter(u => u !== rpcUrl)]
    : [rpcUrl];

  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        method:  "POST",
        headers: { "content-type": "application/json" },
        body:    JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getTransactionByHash", params: [hash] }),
        signal:  AbortSignal.timeout(8_000),
      });
      if (!res.ok) continue;
      const d = await res.json() as { result?: RawTx };
      if (d.result?.r) return d.result;
    } catch { /* try next */ }
  }
  return null;
}

/**
 * Batch-fetch r/s/v for multiple tx hashes in a single JSON-RPC batch call.
 * Returns a map of hash → RawTx. Uses batch JSON-RPC (supported by publicnode, Alchemy, etc.)
 */
async function batchFetchRawTxs(
  hashes:  string[],
  rpcUrl:  string,
  chainId?: string,
): Promise<Map<string, RawTx>> {
  const result = new Map<string, RawTx>();
  if (hashes.length === 0) return result;

  const endpoints = chainId
    ? [rpcUrl, ...(RPC_FALLBACKS[chainId] ?? []).filter(u => u !== rpcUrl)]
    : [rpcUrl];

  const payload = hashes.map((h, i) => ({
    jsonrpc: "2.0", id: i, method: "eth_getTransactionByHash", params: [h],
  }));

  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        method:  "POST",
        headers: { "content-type": "application/json" },
        body:    JSON.stringify(payload),
        signal:  AbortSignal.timeout(20_000),
      });
      if (!res.ok) continue;
      const data = await res.json() as Array<{ id: number; result?: RawTx }>;
      if (!Array.isArray(data)) continue;

      for (const entry of data) {
        if (entry.result?.r) {
          result.set(hashes[entry.id], entry.result);
        }
      }
      if (result.size > 0) break;  // got results — don't try next endpoint
    } catch { /* try next */ }
  }
  return result;
}

/**
 * Enrich a batch of OutgoingTx records with r/s/v/nonce from raw RPC data.
 * Uses batch JSON-RPC (50 per batch, up to `concurrency` simultaneous batches).
 */
export async function enrichWithSignatures(
  txs:         OutgoingTx[],
  chain:       ChainConfig,
  limit:       number = 200,
  batchSize:   number = 50,
  concurrency: number = 8,
): Promise<OutgoingTx[]> {
  const toEnrich = txs.filter(t => t.r === null).slice(0, limit);

  // Chunk into batches
  const chunks: OutgoingTx[][] = [];
  for (let i = 0; i < toEnrich.length; i += batchSize) {
    chunks.push(toEnrich.slice(i, i + batchSize));
  }

  // Process chunks with bounded concurrency
  for (let i = 0; i < chunks.length; i += concurrency) {
    const window = chunks.slice(i, i + concurrency);
    await Promise.all(
      window.map(async chunk => {
        const hashes  = chunk.map(t => t.hash);
        const rawMap  = await batchFetchRawTxs(hashes, chain.rpcUrl, chain.id);
        for (const tx of chunk) {
          const raw = rawMap.get(tx.hash);
          if (!raw) continue;
          tx.nonce    = raw.nonce    ? parseInt(raw.nonce, 16) : tx.nonce;
          tx.r        = raw.r ?? null;
          tx.s        = raw.s ?? null;
          tx.v        = raw.v ? parseInt(raw.v, 16) : null;
          tx.gasPrice = raw.gasPrice ? BigInt(raw.gasPrice) : tx.gasPrice;
        }
      }),
    );
  }
  return txs;
}

// ── Full signature scan (nonce-reuse + r-value dup detection) ─────────────────

export interface FullScanProgress {
  phase:  "listing" | "enriching" | "analyzing" | "done";
  listed: number;
  enriched: number;
  total:  number;
}

export interface FullScanResult {
  address:          string;
  chain:            string;
  chainLabel:       string;
  nonce:            number;
  balanceEth:       number;
  source:           string;
  totalTxsFetched:  number;
  sigsEnriched:     number;
  nonceReuseFound:  boolean;
  nonceReusePairs:  Array<{ nonce: number; hashes: string[] }>;
  rValueDuplicates: RDuplicate[];
  sValueDuplicates: SDuplicate[];
  weakKCandidates:  string[];
  keyRecovered:     string | null;
  summary:          string;
  error:            string | null;
  durationMs:       number;
}

/**
 * Full scan: pages through ALL outgoing txs, batch-fetches every signature,
 * then runs complete nonce-reuse + r/s duplicate analysis.
 *
 * For wallets with tens of thousands of txs this can take several minutes.
 * `enrichLimit` caps how many signatures to fetch (default: all).
 */
export async function fullSignatureScan(
  address:       string,
  chainId:       string = "ethereum",
  enrichLimit:   number = 50_000,
  batchSize:     number = 50,
  concurrency:   number = 10,
): Promise<FullScanResult> {
  const t0    = Date.now();
  const chain = getChain(chainId);

  const { nonce, balanceEth } = await fetchNonceAndBalance(address, chain.rpcUrl, chainId);

  // ── Phase 1: collect ALL outgoing txs from Blockscout ──────────────────────
  let outgoing: OutgoingTx[] = [];
  let source = "blockscout";
  let fetchError: string | null = null;
  try {
    outgoing = await blockscoutFetchAll(address, chain, 2000);
  } catch (e) {
    fetchError = (e as Error).message;
  }

  // ── Phase 1b: nonce-reuse check from Blockscout nonces (free — no extra RPC) ─
  const nonceMap = new Map<number, string[]>();
  for (const tx of outgoing) {
    if (tx.nonce === null) continue;
    const entry = nonceMap.get(tx.nonce) ?? [];
    entry.push(tx.hash);
    nonceMap.set(tx.nonce, entry);
  }
  const nonceReusePairs = [...nonceMap.entries()]
    .filter(([, hashes]) => hashes.length > 1)
    .map(([n, hashes]) => ({ nonce: n, hashes }));
  const nonceReuseFound = nonceReusePairs.length > 0;

  // ── Phase 2: batch-fetch r/s/v for up to enrichLimit txs ───────────────────
  const toEnrich = outgoing.slice(0, enrichLimit);
  const chunks: OutgoingTx[][] = [];
  for (let i = 0; i < toEnrich.length; i += batchSize) {
    chunks.push(toEnrich.slice(i, i + batchSize));
  }

  for (let i = 0; i < chunks.length; i += concurrency) {
    const window = chunks.slice(i, i + concurrency);
    await Promise.all(
      window.map(async chunk => {
        const hashes = chunk.map(t => t.hash);
        const rawMap = await batchFetchRawTxs(hashes, chain.rpcUrl, chainId);
        for (const tx of chunk) {
          const raw = rawMap.get(tx.hash);
          if (!raw) continue;
          tx.nonce    = raw.nonce ? parseInt(raw.nonce, 16) : tx.nonce;
          tx.r        = raw.r ?? null;
          tx.s        = raw.s ?? null;
          tx.v        = raw.v ? parseInt(raw.v, 16) : null;
          tx.gasPrice = raw.gasPrice ? BigInt(raw.gasPrice) : tx.gasPrice;
        }
      }),
    );
  }

  const enriched = outgoing.filter(t => t.r && t.s);

  // ── Phase 3: analyze ────────────────────────────────────────────────────────
  const N_CURVE = BigInt("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141");

  const rMap = new Map<string, OutgoingTx[]>();
  const sMap = new Map<string, OutgoingTx[]>();
  for (const tx of enriched) {
    const r = tx.r!.toLowerCase();
    const s = tx.s!.toLowerCase();
    const rList = rMap.get(r) ?? []; rList.push(tx); rMap.set(r, rList);
    const sList = sMap.get(s) ?? []; sList.push(tx); sMap.set(s, sList);
  }

  const rValueDuplicates: RDuplicate[] = [];
  let keyRecovered: string | null = null;
  function modInv(a: bigint, m: bigint): bigint {
    let [old_r, r_] = [a, m], [old_s, s_] = [1n, 0n];
    while (r_ !== 0n) {
      const q = old_r / r_;
      [old_r, r_] = [r_, old_r - q * r_];
      [old_s, s_] = [s_, old_s - q * s_];
    }
    return ((old_s % m) + m) % m;
  }

  for (const [r, txs] of rMap) {
    if (txs.length < 2) continue;
    const hashes  = txs.map(t => t.hash);
    const zValues = hashes.map(h => { try { return ethers.keccak256(h); } catch { return ""; } });
    rValueDuplicates.push({ r, count: txs.length, hashes, zValues });

    if (!keyRecovered && txs.length >= 2) {
      try {
        const rBig  = BigInt("0x" + r.replace(/^0x/i, ""));
        const s1Big = BigInt(txs[0].s!);
        const s2Big = BigInt(txs[1].s!);
        const z1Big = BigInt(ethers.keccak256(txs[0].hash));
        const z2Big = BigInt(ethers.keccak256(txs[1].hash));
        const k     = ((z1Big - z2Big + N_CURVE) % N_CURVE * modInv((s1Big - s2Big + N_CURVE) % N_CURVE, N_CURVE)) % N_CURVE;
        const priv  = ((s1Big * k - z1Big + N_CURVE) % N_CURVE * modInv(rBig, N_CURVE)) % N_CURVE;
        if (priv > 0n && priv < N_CURVE) {
          const w = new ethers.Wallet("0x" + priv.toString(16).padStart(64, "0"));
          if (w.address.toLowerCase() === address.toLowerCase()) {
            keyRecovered = w.privateKey;
          }
        }
      } catch { /* arithmetic failed */ }
    }
  }

  const sValueDuplicates: SDuplicate[] = [];
  for (const [s, txs] of sMap) {
    if (txs.length < 2) continue;
    sValueDuplicates.push({ s, count: txs.length, hashes: txs.map(t => t.hash) });
  }

  const weakKCandidates = enriched
    .filter(t => { try { return BigInt(t.r!) < BigInt("0x1000000"); } catch { return false; } })
    .map(t => t.hash);

  const vulnCount = rValueDuplicates.length + sValueDuplicates.length + weakKCandidates.length;
  const summary = keyRecovered
    ? `⚠️ CRITICAL: Private key recovered from r-value collision!`
    : nonceReuseFound
    ? `⚠️ Nonce reuse detected on ${nonceReusePairs.length} nonce(s)!`
    : vulnCount > 0
    ? `⚠️ ${vulnCount} signature issue(s) found (${rValueDuplicates.length} r-reuse, ${sValueDuplicates.length} s-reuse, ${weakKCandidates.length} weak-k)`
    : enriched.length === 0
    ? `ℹ️ Could not enrich any signatures from ${outgoing.length} listed txs.`
    : `✅ No reuse detected across ${enriched.length} signatures analyzed.`;

  return {
    address, chain: chainId, chainLabel: chain.label,
    nonce, balanceEth, source,
    totalTxsFetched:  outgoing.length,
    sigsEnriched:     enriched.length,
    nonceReuseFound, nonceReusePairs,
    rValueDuplicates, sValueDuplicates,
    weakKCandidates, keyRecovered,
    summary,
    error: fetchError,
    durationMs: Date.now() - t0,
  };
}

// ── Nonce + balance from public RPC ───────────────────────────────────────────

async function tryRpcNonceAndBalance(
  address: string,
  rpcUrl:  string,
): Promise<{ nonce: number; balanceEth: number } | null> {
  try {
    const [nonceRes, balRes] = await Promise.all([
      fetch(rpcUrl, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_getTransactionCount", params: [address, "latest"] }),
        signal: AbortSignal.timeout(8_000),
      }),
      fetch(rpcUrl, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "eth_getBalance", params: [address, "latest"] }),
        signal: AbortSignal.timeout(8_000),
      }),
    ]);
    if (!nonceRes.ok || !balRes.ok) return null;
    const [nonceJson, balJson] = await Promise.all([nonceRes.json(), balRes.json()]) as [
      { result?: string }, { result?: string }
    ];
    if (!nonceJson.result) return null;
    const nonce      = parseInt(nonceJson.result, 16);
    const balanceEth = Number(BigInt(balJson.result ?? "0x0")) / 1e18;
    return { nonce, balanceEth };
  } catch { return null; }
}

/**
 * Fetch nonce + balance, trying multiple RPC endpoints until a consistent result
 * is returned. Addresses the problem of Cloudflare/LlamaRPC returning nonce=0
 * for high-traffic wallets that exceed their cache TTL.
 */
export async function fetchNonceAndBalance(
  address:  string,
  rpcUrl:   string,
  chainId?: string,
): Promise<{ nonce: number; balanceEth: number }> {
  // Build ordered list: primary first, then chain-specific fallbacks
  const fallbacks = chainId ? (RPC_FALLBACKS[chainId] ?? [rpcUrl]) : [rpcUrl];
  const candidates = [rpcUrl, ...fallbacks.filter(u => u !== rpcUrl)];

  let lastResult: { nonce: number; balanceEth: number } | null = null;

  for (const url of candidates) {
    const result = await tryRpcNonceAndBalance(address, url);
    if (!result) continue;

    // Accept first result that looks meaningful. If nonce = 0, keep trying
    // in case this RPC is stale (but save it as a fallback answer).
    if (lastResult === null) lastResult = result;
    if (result.nonce > 0) return result;   // non-zero nonce is authoritative
  }

  return lastResult ?? { nonce: 0, balanceEth: 0 };
}

// ── Main entry point ──────────────────────────────────────────────────────────

export async function fetchWalletOutgoing(
  address:  string,
  chainId:  string = "ethereum",
  options: {
    alchemyKey?:       string;
    enrichSigs?:       boolean;   // fetch r/s/v for each tx (slower)
    enrichLimit?:      number;    // max txs to enrich with signatures
    maxBlockscoutPages?: number;
  } = {},
): Promise<WalletSummary> {
  const chain       = getChain(chainId);
  const alchemyKey  = options.alchemyKey ?? process.env.ALCHEMY_API_KEY;
  const enrichSigs  = options.enrichSigs ?? false;
  const enrichLimit = options.enrichLimit ?? 200;

  const { nonce, balanceEth } = await fetchNonceAndBalance(address, chain.rpcUrl, chainId);

  let outgoingTxs: OutgoingTx[] = [];
  let source: WalletSummary["source"] = "rpc-only";
  let error: string | undefined;

  if (alchemyKey && chain.alchemySlug) {
    try {
      outgoingTxs = await alchemyFetchAll(address, chain, alchemyKey);
      source = "alchemy";
    } catch (e) {
      error = `Alchemy failed: ${(e as Error).message}`;
    }
  }

  if (source !== "alchemy") {
    try {
      outgoingTxs = await blockscoutFetchAll(address, chain, options.maxBlockscoutPages);
      source = "blockscout";
    } catch (e) {
      error = (error ? error + "; " : "") + `Blockscout failed: ${(e as Error).message}`;
    }
  }

  if (enrichSigs && outgoingTxs.length > 0) {
    await enrichWithSignatures(outgoingTxs, chain, enrichLimit);
  }

  return {
    address,
    chain:        chain.id,
    chainLabel:   chain.label,
    nonce,
    balanceEth,
    outgoingTxs,
    totalFetched: outgoingTxs.length,
    source,
    ...(error ? { error } : {}),
  };
}

// ── ECDSA nonce-reuse analysis ────────────────────────────────────────────────

export interface SignatureReuseResult {
  address:          string;
  chain:            string;
  totalSigs:        number;
  rValueDuplicates: RDuplicate[];
  sValueDuplicates: SDuplicate[];
  keyRecovered:     string | null;  // hex private key if recovery succeeded
  weakKCandidates:  string[];       // tx hashes with suspiciously small k
  summary:          string;
}

export interface RDuplicate {
  r:      string;
  count:  number;
  hashes: string[];
  zValues: string[];
}

export interface SDuplicate {
  s:      string;
  count:  number;
  hashes: string[];
}

const N = BigInt("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141");

function modInverse(a: bigint, m: bigint): bigint {
  let [old_r, r] = [a, m];
  let [old_s, s] = [1n, 0n];
  while (r !== 0n) {
    const q = old_r / r;
    [old_r, r] = [r, old_r - q * r];
    [old_s, s] = [s, old_s - q * s];
  }
  return ((old_s % m) + m) % m;
}

function computeZ(tx: OutgoingTx): bigint | null {
  try {
    const raw = ethers.Transaction.from({
      hash:  tx.hash,
      from:  tx.from,
      to:    tx.to || null,
      nonce: tx.nonce ?? 0,
      value: BigInt(Math.round(tx.valueEth * 1e18)),
      gasLimit: 21000n,
      type: 0,
    });
    const digest = ethers.keccak256(raw.unsignedSerialized);
    return BigInt(digest);
  } catch { return null; }
}

/**
 * Analyze collected signatures for reuse.
 * Input txs must already be enriched with r/s/v values.
 */
export function analyzeSignatures(
  summary: WalletSummary,
): SignatureReuseResult {
  const signed = summary.outgoingTxs.filter(t => t.r && t.s && t.v !== null);

  const rMap = new Map<string, OutgoingTx[]>();
  const sMap = new Map<string, OutgoingTx[]>();

  for (const tx of signed) {
    const r = tx.r!.toLowerCase();
    const s = tx.s!.toLowerCase();
    if (!rMap.has(r)) rMap.set(r, []);
    rMap.get(r)!.push(tx);
    if (!sMap.has(s)) sMap.set(s, []);
    sMap.get(s)!.push(tx);
  }

  const rDups: RDuplicate[] = [];
  let keyRecovered: string | null = null;

  for (const [r, txs] of rMap) {
    if (txs.length < 2) continue;
    const hashes  = txs.map(t => t.hash);
    const zValues = txs.map(t => { try { return ethers.keccak256(t.hash); } catch { return ""; } });
    rDups.push({ r, count: txs.length, hashes, zValues });

    // Attempt key recovery from r-value collision
    if (!keyRecovered && txs.length >= 2) {
      try {
        const rBig  = BigInt("0x" + r.replace(/^0x/i, ""));
        const s1Big = BigInt(txs[0].s!);
        const s2Big = BigInt(txs[1].s!);
        const z1Big = BigInt(ethers.keccak256(txs[0].hash));
        const z2Big = BigInt(ethers.keccak256(txs[1].hash));
        const kNum  = ((z1Big - z2Big + N) % N * modInverse((s1Big - s2Big + N) % N, N)) % N;
        const privKey = ((s1Big * kNum - z1Big + N) % N * modInverse(rBig, N)) % N;
        if (privKey > 0n && privKey < N) {
          const wallet = new ethers.Wallet("0x" + privKey.toString(16).padStart(64, "0"));
          if (wallet.address.toLowerCase() === summary.address.toLowerCase()) {
            keyRecovered = "0x" + privKey.toString(16).padStart(64, "0");
          }
        }
      } catch { /* arithmetic failed */ }
    }
  }

  const sDups: SDuplicate[] = [];
  for (const [s, txs] of sMap) {
    if (txs.length < 2) continue;
    sDups.push({ s, count: txs.length, hashes: txs.map(t => t.hash) });
  }

  // Weak-k detection: r value in bottom 24 bits range (k < 2^24)
  const weakKCandidates = signed
    .filter(t => {
      try { return BigInt(t.r!) < BigInt("0x1000000"); } catch { return false; }
    })
    .map(t => t.hash);

  const vulnCount = rDups.length + sDups.length + weakKCandidates.length;
  const summary_str = keyRecovered
    ? `⚠️  CRITICAL: Private key recovered from r-value collision!`
    : vulnCount > 0
    ? `⚠️  ${vulnCount} potential vulnerability/ies detected (${rDups.length} r-reuse, ${sDups.length} s-reuse, ${weakKCandidates.length} weak-k)`
    : signed.length === 0
    ? `✅  No signatures on-chain — wallet has never broadcast a transaction.`
    : `✅  No reuse detected across ${signed.length} analyzed signatures.`;

  return {
    address:         summary.address,
    chain:           summary.chain,
    totalSigs:       signed.length,
    rValueDuplicates: rDups,
    sValueDuplicates: sDups,
    keyRecovered,
    weakKCandidates,
    summary: summary_str,
  };
}
