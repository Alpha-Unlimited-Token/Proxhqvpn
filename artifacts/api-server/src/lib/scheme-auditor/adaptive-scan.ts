// Adaptive scan engine — takes any target (address or tx hash), detects the chain
// automatically using chain-detector, then routes to the correct scanner.
// Returns a unified result including which chain was detected and what math was applied.

import { detectChain, ChainInfo, getScanPlan } from "./chain-detector";
import { scanSolana, recoverEd25519PrivateKey } from "./ed25519-scan";
import { scanPolkadot } from "./polkadot-scan";
import { scanMonero } from "./monero-scan";
import { scanWalletForNonceReuse } from "../ecdsa-analyzer/nonce-recovery";

export type AdaptiveScanResult = {
  target: string;
  detectedChain: ChainInfo;
  alternativeCandidates: ChainInfo[];
  scanPlan: string;
  result: unknown;        // chain-specific scan result
  hasVulnerability: boolean;
  vulnerabilityCount: number;
  executionTimeMs: number;
  scanTimestamp: string;
};

// Maps chain/scheme to the correct secp256k1 chain identifier for existing ECDSA scanner
const SECP256K1_CHAIN_MAP: Record<string, string> = {
  ethereum: "ETH",
  bitcoin: "BTC",
  litecoin: "LTC",
  dogecoin: "DOGE",
  "bitcoin-cash": "BCH",
  "binance-smart-chain": "BSC",
  polygon: "MATIC",
  avalanche: "AVAX",
  arbitrum: "ARB",
  optimism: "OP",
  cosmos: "ETH",    // use ETH ECDSA math, different hash but same nonce-reuse detection
  tezos: "ETH",
};

async function runEd25519Scan(target: string, _chain: ChainInfo): Promise<{ hasVulnerability: boolean; vulnerabilityCount: number; result: unknown }> {
  const result = await scanSolana(target);
  return {
    hasVulnerability: result.hasVulnerability,
    vulnerabilityCount: result.nonceReusePairs.length,
    result,
  };
}

async function runSr25519Scan(target: string, chain: ChainInfo): Promise<{ hasVulnerability: boolean; vulnerabilityCount: number; result: unknown }> {
  const chainKey = chain.chain.includes("kusama") ? "kusama" : "polkadot";
  const result = await scanPolkadot(target, chainKey);
  return {
    hasVulnerability: result.hasVulnerability,
    vulnerabilityCount: result.nonceReusePairs.length,
    result,
  };
}

async function runClsagScan(target: string): Promise<{ hasVulnerability: boolean; vulnerabilityCount: number; result: unknown }> {
  const result = await scanMonero(target);
  return {
    hasVulnerability: result.hasDoubleSpend,
    vulnerabilityCount: result.reuseDetected.length,
    result,
  };
}

async function runSecp256k1Scan(target: string, chain: ChainInfo): Promise<{ hasVulnerability: boolean; vulnerabilityCount: number; result: unknown }> {
  const chainKey = SECP256K1_CHAIN_MAP[chain.chain] ?? "ETH";
  const result = await scanWalletForNonceReuse(target, chainKey as "ETH" | "BTC" | "LTC" | "DOGE" | "BCH");
  const r = result as { hasVulnerability?: boolean; nonceReusePairs?: unknown[] };
  return {
    hasVulnerability: r.hasVulnerability ?? false,
    vulnerabilityCount: r.nonceReusePairs?.length ?? 0,
    result,
  };
}

export async function adaptiveScan(target: string, forceChain?: string): Promise<AdaptiveScanResult> {
  const t0 = Date.now();
  const candidates = detectChain(target);

  if (candidates.length === 0) {
    throw new Error("Could not determine blockchain from input format. Please check the address or transaction hash.");
  }

  let detected = candidates[0];
  const alternatives = candidates.slice(1);

  // Allow caller to override detected chain
  if (forceChain) {
    const forced = candidates.find(c => c.chain === forceChain || c.signatureScheme === forceChain);
    if (forced) detected = forced;
  }

  const scanPlan = getScanPlan(detected);
  let scanRes: { hasVulnerability: boolean; vulnerabilityCount: number; result: unknown };

  switch (detected.signatureScheme) {
    case "ed25519":
      scanRes = await runEd25519Scan(target, detected);
      break;
    case "sr25519-schnorr":
      scanRes = await runSr25519Scan(target, detected);
      break;
    case "clsag":
      scanRes = await runClsagScan(target);
      break;
    case "secp256k1-ecdsa":
    case "p256-ecdsa":
      scanRes = await runSecp256k1Scan(target, detected);
      break;
    default:
      throw new Error(`No scanner available for scheme: ${detected.signatureScheme}`);
  }

  return {
    target,
    detectedChain: detected,
    alternativeCandidates: alternatives,
    scanPlan,
    result: scanRes.result,
    hasVulnerability: scanRes.hasVulnerability,
    vulnerabilityCount: scanRes.vulnerabilityCount,
    executionTimeMs: Date.now() - t0,
    scanTimestamp: new Date().toISOString(),
  };
}
