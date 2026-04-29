/**
 * Ed25519 Family Adapter — Stellar · Cardano · NEAR · Cosmos
 * ════════════════════════════════════════════════════════════
 * All four chains use Ed25519 (or secp256k1 for Cosmos) and are in the
 * top-20 by usage or laundering relevance.
 *
 * Stellar (XLM)  — Ed25519. Horizon REST API. G[55] StrKey.
 *   High-volume stable-coin corridor (USDC, USDT on Stellar).
 *   Frequently used to move funds quickly between exchanges.
 *
 * Cardano (ADA)  — Ed25519 (Shelley era). Koios free public API.
 *   addr1… Shelley bech32 or Ae2… Byron legacy addresses.
 *
 * NEAR Protocol  — Ed25519 implicit (64-hex) or named (*.near).
 *   Rapid growth in DeFi; used in cross-chain bridge exploits.
 *   NEAR RPC + nearblocks.io public API.
 *
 * Cosmos/ATOM    — secp256k1 (amino JSON signing). LCD REST API.
 *   cosmos1… bech32. Used via IBC bridges for inter-chain layering.
 *
 * Attack surface:
 *   Ed25519 nonce reuse (same R in two sigs) → full key recovery possible.
 *   We detect matching 32-byte R values across the fetched signature set.
 *   Cosmos uses the same ECDSA nonce-reuse math as Bitcoin/EVM.
 */

import {
  type ChainAdapter, type SigRecord, type NonceReuseResult,
  detectNonceReuseSecp256k1, CHAINS,
} from "../chain-adapter";

// ── Ed25519 nonce-reuse detector ──────────────────────────────────────────────
// Ed25519 signature: R (32 bytes) || S (32 bytes).
// If two sigs share the same R with different S, the private key is recoverable.
// We store R in sig.r and S in sig.s (same fields as secp256k1 path).

function detectNonceReuseEd25519(
  address: string,
  chainName: string,
  sigs: SigRecord[],
): NonceReuseResult[] {
  const byR = new Map<string, SigRecord[]>();
  for (const sig of sigs) {
    const r = sig.r.toLowerCase();
    const list = byR.get(r) ?? [];
    list.push(sig);
    byR.set(r, list);
  }
  const results: NonceReuseResult[] = [];
  for (const [r, group] of byR.entries()) {
    if (group.length < 2) continue;
    const [sig1, sig2] = group;
    results.push({
      address,
      chain:    "stellar",  // overridden by caller
      sharedR:  r,
      sig1, sig2,
      confidence: 0.95,
      detail: `Ed25519 nonce reuse on ${chainName}: shared R-value detected in txs ${sig1.txHash} & ${sig2.txHash} — private key recovery possible`,
    });
  }
  return results;
}

// ═══════════════════════════════════════════════════════════════════
// STELLAR (XLM)
// ═══════════════════════════════════════════════════════════════════

const XLM_RE = /^G[A-Z2-7]{55}$/;

interface HorizonOp {
  id:            string;
  transaction_hash: string;
  type:          string;
  source_account: string;
}

interface HorizonPage<T> {
  _embedded: { records: T[] };
}

interface HorizonTx {
  hash:          string;
  ledger?:       number;
  signatures?:   string[];   // base64-encoded Ed25519 signatures
}

async function fetchStellarSigs(address: string, maxTx = 80): Promise<SigRecord[]> {
  const base = CHAINS.stellar.apiBase!;
  const url = `${base}/accounts/${address}/transactions?limit=${Math.min(maxTx, 200)}&order=desc`;
  const res = await fetch(url, { signal: AbortSignal.timeout(12_000) });
  if (!res.ok) throw new Error(`Horizon HTTP ${res.status}`);
  const page: HorizonPage<HorizonTx> = await res.json() as HorizonPage<HorizonTx>;

  const sigs: SigRecord[] = [];
  for (const tx of page._embedded?.records ?? []) {
    for (const b64 of tx.signatures ?? []) {
      const buf = Buffer.from(b64, "base64");
      if (buf.length !== 64) continue;
      const r = buf.subarray(0, 32).toString("hex");
      const s = buf.subarray(32, 64).toString("hex");
      sigs.push({ r, s, txHash: tx.hash, blockHeight: tx.ledger, raw: b64 });
    }
  }
  return sigs;
}

export const stellarAdapter: ChainAdapter = {
  chain: CHAINS.stellar,
  matchesAddress(addr) { return XLM_RE.test(addr); },
  async fetchSignatures(address, maxTx = 80) { return fetchStellarSigs(address, maxTx); },
  checkNonceReuse(address, sigs): NonceReuseResult[] {
    return detectNonceReuseEd25519(address, "Stellar", sigs).map(r => ({ ...r, chain: "stellar" as const }));
  },
};

// ═══════════════════════════════════════════════════════════════════
// CARDANO (ADA)
// ═══════════════════════════════════════════════════════════════════

const ADA_RE = /^(addr1[a-z0-9]{50,108}|Ae2[1-9A-HJ-NP-Za-km-z]{50,})$/;

interface KoiosTxItem {
  tx_hash: string;
  block_height?: number;
}

interface KoiosTxUtxo {
  tx_hash: string;
  witnesses?: Array<{ vkey?: string; signature?: string }>;
}

async function fetchCardanoSigs(address: string, maxTx = 80): Promise<SigRecord[]> {
  const base = CHAINS.cardano.apiBase!;

  // Step 1: fetch tx list for address
  const listRes = await fetch(`${base}/address_txs`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify({ _addresses: [address] }),
    signal: AbortSignal.timeout(12_000),
  });
  if (!listRes.ok) throw new Error(`Koios address_txs HTTP ${listRes.status}`);
  const txList: KoiosTxItem[] = await listRes.json() as KoiosTxItem[];
  const hashes = (txList ?? []).slice(0, maxTx).map(t => t.tx_hash);
  if (hashes.length === 0) return [];

  // Step 2: fetch tx UTXOs + witnesses in bulk
  const utxoRes = await fetch(`${base}/tx_utxos`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify({ _tx_hashes: hashes }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!utxoRes.ok) return [];
  const utxos: KoiosTxUtxo[] = await utxoRes.json() as KoiosTxUtxo[];

  const sigs: SigRecord[] = [];
  for (const tx of utxos ?? []) {
    for (const wit of tx.witnesses ?? []) {
      if (!wit.signature || !wit.vkey) continue;
      const buf = Buffer.from(wit.signature, "hex");
      if (buf.length !== 64) continue;
      const r = buf.subarray(0, 32).toString("hex");
      const s = buf.subarray(32, 64).toString("hex");
      sigs.push({ r, s, txHash: tx.tx_hash, raw: wit.signature });
    }
  }
  return sigs;
}

export const cardanoAdapter: ChainAdapter = {
  chain: CHAINS.cardano,
  matchesAddress(addr) { return ADA_RE.test(addr); },
  async fetchSignatures(address, maxTx = 80) { return fetchCardanoSigs(address, maxTx); },
  checkNonceReuse(address, sigs): NonceReuseResult[] {
    return detectNonceReuseEd25519(address, "Cardano", sigs).map(r => ({ ...r, chain: "cardano" as const }));
  },
};

// ═══════════════════════════════════════════════════════════════════
// NEAR PROTOCOL
// ═══════════════════════════════════════════════════════════════════

const NEAR_RE = /^([a-z0-9._-]{2,64}\.near|[0-9a-f]{64})$/;

interface NearBlocksTx {
  transaction_hash: string;
  block?:           { block_height?: number };
  actions?:         Array<{ action: string; method_name?: string }>;
}

interface NearBlocksResp {
  txns?: NearBlocksTx[];
}

interface NearRpcResult {
  result?: {
    transaction?: {
      hash:       string;
      signature?: string;   // ed25519:BASE58 format
    };
  };
}

async function fetchNearSigs(address: string, maxTx = 60): Promise<SigRecord[]> {
  const base = CHAINS.near.apiBase!;

  // Fetch tx list via nearblocks public API
  const listRes = await fetch(
    `${base}/account/${address}/txns?page=1&per_page=${Math.min(maxTx, 50)}`,
    { signal: AbortSignal.timeout(12_000) }
  );
  if (!listRes.ok) throw new Error(`NearBlocks HTTP ${listRes.status}`);
  const data: NearBlocksResp = await listRes.json() as NearBlocksResp;
  const txns = data.txns ?? [];

  const sigs: SigRecord[] = [];
  const rpc = CHAINS.near.rpcUrl!;

  // Fetch each tx signature from NEAR RPC (limited to first 20 to avoid rate limit)
  for (const tx of txns.slice(0, 20)) {
    try {
      const rpcRes = await fetch(rpc, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0", id: "1", method: "tx",
          params: [tx.transaction_hash, address],
        }),
        signal: AbortSignal.timeout(8_000),
      });
      const rpcData: NearRpcResult = await rpcRes.json() as NearRpcResult;
      const sigStr = rpcData.result?.transaction?.signature ?? "";
      // Format: "ed25519:BASE58ENCODED64BYTES"
      if (!sigStr.startsWith("ed25519:")) continue;
      // Decode base58 inline (NEAR uses standard Bitcoin base58 alphabet)
      const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
      const encoded = sigStr.replace("ed25519:", "");
      let n = 0n;
      let valid = true;
      for (const ch of encoded) {
        const idx = B58.indexOf(ch);
        if (idx < 0) { valid = false; break; }
        n = n * 58n + BigInt(idx);
      }
      if (!valid) continue;
      // Convert bigint → Buffer (big-endian, 64 bytes for Ed25519 sig)
      let hex = n.toString(16);
      if (hex.length % 2) hex = "0" + hex;
      const sigBytes = Buffer.from(hex.padStart(128, "0"), "hex");
      if (sigBytes.length !== 64) continue;
      const r = sigBytes.subarray(0, 32).toString("hex");
      const s = sigBytes.subarray(32, 64).toString("hex");
      sigs.push({
        r, s,
        txHash: tx.transaction_hash,
        blockHeight: tx.block?.block_height,
        raw: sigStr,
      });
    } catch { /* skip individual tx errors */ }
  }
  return sigs;
}

export const nearAdapter: ChainAdapter = {
  chain: CHAINS.near,
  matchesAddress(addr) { return NEAR_RE.test(addr); },
  async fetchSignatures(address, maxTx = 60) { return fetchNearSigs(address, maxTx); },
  checkNonceReuse(address, sigs): NonceReuseResult[] {
    return detectNonceReuseEd25519(address, "NEAR Protocol", sigs).map(r => ({ ...r, chain: "near" as const }));
  },
};

// ═══════════════════════════════════════════════════════════════════
// COSMOS / ATOM  (secp256k1 — same math as Bitcoin/EVM)
// ═══════════════════════════════════════════════════════════════════

const COSMOS_RE = /^cosmos1[a-z0-9]{38}$/;

interface CosmosTxsResp {
  tx_responses?: Array<{
    txhash:   string;
    height?:  string;
    tx?: {
      auth_info?: {
        signer_infos?: Array<{
          public_key?: unknown;
        }>;
      };
      signatures?: string[];   // base64 compact secp256k1 sigs [r(32) || s(32)]
    };
  }>;
}

async function fetchCosmosSigs(address: string, maxTx = 60): Promise<SigRecord[]> {
  const base = CHAINS.cosmos.apiBase!;
  const encoded = encodeURIComponent(`message.sender='${address}'`);
  const url = `${base}/cosmos/tx/v1beta1/txs?events=${encoded}&pagination.limit=${Math.min(maxTx, 100)}&order_by=ORDER_BY_DESC`;

  const res = await fetch(url, { signal: AbortSignal.timeout(12_000) });
  if (!res.ok) throw new Error(`Cosmos LCD HTTP ${res.status}`);
  const data: CosmosTxsResp = await res.json() as CosmosTxsResp;

  const sigs: SigRecord[] = [];
  for (const txr of data.tx_responses ?? []) {
    const height = txr.height ? parseInt(txr.height, 10) : undefined;
    for (const b64 of txr.tx?.signatures ?? []) {
      const buf = Buffer.from(b64, "base64");
      if (buf.length !== 64) continue;
      const r = buf.subarray(0, 32).toString("hex");
      const s = buf.subarray(32, 64).toString("hex");
      sigs.push({ r, s, txHash: txr.txhash, blockHeight: height, raw: b64 });
    }
  }
  return sigs;
}

export const cosmosAdapter: ChainAdapter = {
  chain: CHAINS.cosmos,
  matchesAddress(addr) { return COSMOS_RE.test(addr); },
  async fetchSignatures(address, maxTx = 60) { return fetchCosmosSigs(address, maxTx); },
  checkNonceReuse(address, sigs): NonceReuseResult[] {
    // Cosmos uses secp256k1 — same nonce-reuse math
    return detectNonceReuseSecp256k1(address, "cosmos", sigs);
  },
};
