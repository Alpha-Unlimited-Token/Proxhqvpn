// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
/**
 * Multi-chain address detector
 * Detects chain family from address format so callers don't need to specify it.
 */

export type ChainFamily = "evm" | "bitcoin" | "litecoin" | "dogecoin" | "bitcoincash" | "solana" | "unknown";

export interface AddressInfo {
  family:  ChainFamily;
  chain:   string;        // canonical chain id
  address: string;        // normalized address
  valid:   boolean;
  reason?: string;
}

export function detectAddress(raw: string): AddressInfo {
  const s = raw.trim();

  // EVM: 0x + 40 hex chars
  if (/^0x[0-9a-fA-F]{40}$/.test(s)) {
    return { family: "evm", chain: "ethereum", address: s.toLowerCase(), valid: true };
  }

  // Bitcoin mainnet — P2PKH (1…), P2SH (3…), bech32 (bc1q…), Taproot (bc1p…)
  if (/^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(s) || /^bc1[qp][a-z0-9]{6,87}$/i.test(s)) {
    return { family: "bitcoin", chain: "bitcoin", address: s, valid: true };
  }

  // Litecoin — L…, M…, ltc1…
  if (/^[LM][a-km-zA-HJ-NP-Z1-9]{26,33}$/.test(s) || /^ltc1[qp][a-z0-9]{6,87}$/i.test(s)) {
    return { family: "litecoin", chain: "litecoin", address: s, valid: true };
  }

  // Dogecoin — D…
  if (/^D[a-km-zA-HJ-NP-Z1-9]{33}$/.test(s)) {
    return { family: "dogecoin", chain: "dogecoin", address: s, valid: true };
  }

  // Bitcoin Cash — bitcoincash:q… or q…
  if (/^(bitcoincash:)?[qp][a-z0-9]{41}$/.test(s)) {
    const addr = s.startsWith("bitcoincash:") ? s : `bitcoincash:${s}`;
    return { family: "bitcoincash", chain: "bitcoincash", address: addr, valid: true };
  }

  // Solana — base58, 32–44 chars (no 0/O/I/l ambiguous chars)
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(s)) {
    return { family: "solana", chain: "solana", address: s, valid: true };
  }

  return { family: "unknown", chain: "unknown", address: s, valid: false, reason: "Unrecognized address format" };
}

export function isEvmChain(chain: string): boolean {
  return ["ethereum", "polygon", "bsc", "arbitrum", "optimism", "base", "avalanche", "fantom"].includes(chain);
}

export function isUtxoChain(chain: string): boolean {
  return ["bitcoin", "litecoin", "dogecoin", "bitcoincash"].includes(chain);
}
