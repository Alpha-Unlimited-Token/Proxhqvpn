/**
 * Chain Adapter — Types, Detection & Registry
 * ════════════════════════════════════════════
 * Central registry for all supported blockchains. Each chain has:
 *  - An address regex pattern for auto-detection
 *  - A signature scheme family (secp256k1 / ed25519 / ring)
 *  - An API endpoint for fetching transaction data
 *
 * Supported chains:
 *   EVM family      — Ethereum, Polygon, BSC, Arbitrum, Optimism, Avalanche, Base, Fantom, Tron
 *   Bitcoin family  — Bitcoin, Litecoin, Dogecoin, Bitcoin Cash (all secp256k1)
 *   Solana          — Ed25519
 *   Monero          — Ring signatures (detection only, key recovery not possible)
 */

// ── Chain identifiers ─────────────────────────────────────────────────────────

export type ChainId =
  | "ethereum" | "polygon" | "bsc" | "arbitrum" | "optimism"
  | "avalanche" | "base" | "fantom" | "tron"
  | "bitcoin" | "litecoin" | "dogecoin" | "bitcoincash"
  | "solana"
  | "monero"
  | "unknown";

export type ChainFamily =
  | "evm_secp256k1"       // Ethereum-compatible chains
  | "bitcoin_secp256k1"   // Bitcoin-style chains (DER-encoded ECDSA)
  | "solana_ed25519"      // Solana Ed25519
  | "monero_ring"         // Monero ring signatures (limited support)
  | "unknown";

// ── Chain metadata ────────────────────────────────────────────────────────────

export interface ChainInfo {
  id:         ChainId;
  name:       string;
  ticker:     string;
  family:     ChainFamily;
  rpcUrl?:    string;    // JSON-RPC endpoint
  apiBase?:   string;    // REST block explorer API
  explorerTx?: string;   // https://explorer.../tx/{txHash}
}

export const CHAINS: Record<ChainId, ChainInfo> = {
  ethereum: {
    id: "ethereum", name: "Ethereum", ticker: "ETH", family: "evm_secp256k1",
    rpcUrl:   "https://ethereum.publicnode.com",
    apiBase:  "https://api.etherscan.io/api",
    explorerTx: "https://etherscan.io/tx/",
  },
  polygon: {
    id: "polygon", name: "Polygon", ticker: "MATIC", family: "evm_secp256k1",
    rpcUrl:   "https://polygon-bor-rpc.publicnode.com",
    explorerTx: "https://polygonscan.com/tx/",
  },
  bsc: {
    id: "bsc", name: "BNB Smart Chain", ticker: "BNB", family: "evm_secp256k1",
    rpcUrl:   "https://bsc-rpc.publicnode.com",
    explorerTx: "https://bscscan.com/tx/",
  },
  arbitrum: {
    id: "arbitrum", name: "Arbitrum One", ticker: "ETH", family: "evm_secp256k1",
    rpcUrl:   "https://arbitrum-one-rpc.publicnode.com",
    explorerTx: "https://arbiscan.io/tx/",
  },
  optimism: {
    id: "optimism", name: "Optimism", ticker: "ETH", family: "evm_secp256k1",
    rpcUrl:   "https://optimism-rpc.publicnode.com",
    explorerTx: "https://optimistic.etherscan.io/tx/",
  },
  avalanche: {
    id: "avalanche", name: "Avalanche C-Chain", ticker: "AVAX", family: "evm_secp256k1",
    rpcUrl:   "https://avalanche-c-chain-rpc.publicnode.com/ext/bc/C/rpc",
    explorerTx: "https://snowtrace.io/tx/",
  },
  base: {
    id: "base", name: "Base", ticker: "ETH", family: "evm_secp256k1",
    rpcUrl:   "https://base-rpc.publicnode.com",
    explorerTx: "https://basescan.org/tx/",
  },
  fantom: {
    id: "fantom", name: "Fantom Opera", ticker: "FTM", family: "evm_secp256k1",
    rpcUrl:   "https://fantom-rpc.publicnode.com",
    explorerTx: "https://ftmscan.com/tx/",
  },
  tron: {
    id: "tron", name: "Tron", ticker: "TRX", family: "evm_secp256k1",
    apiBase:  "https://apilist.tronscanapi.com/api",
    explorerTx: "https://tronscan.org/#/transaction/",
  },
  bitcoin: {
    id: "bitcoin", name: "Bitcoin", ticker: "BTC", family: "bitcoin_secp256k1",
    apiBase:  "https://blockstream.info/api",
    explorerTx: "https://blockstream.info/tx/",
  },
  litecoin: {
    id: "litecoin", name: "Litecoin", ticker: "LTC", family: "bitcoin_secp256k1",
    apiBase:  "https://litecoinspace.org/api",
    explorerTx: "https://litecoinspace.org/tx/",
  },
  dogecoin: {
    id: "dogecoin", name: "Dogecoin", ticker: "DOGE", family: "bitcoin_secp256k1",
    apiBase:  "https://dogechain.info/api/v1",
    explorerTx: "https://dogechain.info/tx/",
  },
  bitcoincash: {
    id: "bitcoincash", name: "Bitcoin Cash", ticker: "BCH", family: "bitcoin_secp256k1",
    apiBase:  "https://rest.bch.actinium.org/v2",
    explorerTx: "https://explorer.bitcoin.com/bch/tx/",
  },
  solana: {
    id: "solana", name: "Solana", ticker: "SOL", family: "solana_ed25519",
    rpcUrl:   "https://api.mainnet-beta.solana.com",
    explorerTx: "https://solscan.io/tx/",
  },
  monero: {
    id: "monero", name: "Monero", ticker: "XMR", family: "monero_ring",
    explorerTx: "https://xmrchain.net/tx/",
  },
  unknown: {
    id: "unknown", name: "Unknown", ticker: "?", family: "unknown",
  },
};

// ── Shared signature record (normalised across all chains) ────────────────────

export interface SigRecord {
  r:           string;    // hex (no 0x prefix) — 64 chars for secp256k1, 64 for Ed25519 R
  s:           string;    // hex — 64 chars
  z?:          string;    // message hash / sighash (optional — may require extra RPC call)
  txHash:      string;
  blockHeight?: number;
  sigIndex?:   number;    // for multi-input BTC txs
  raw?:        string;    // original DER or full sig hex
}

// ── Nonce reuse finding ───────────────────────────────────────────────────────

export interface NonceReuseResult {
  address:          string;
  chain:            ChainId;
  sharedR:          string;
  sig1:             SigRecord;
  sig2:             SigRecord;
  recoveredPrivKey?: string;
  recoveredK?:      string;
  confidence:       number;   // 0-1
  detail:           string;
}

// ── Adapter interface ─────────────────────────────────────────────────────────

export interface ChainAdapter {
  chain: ChainInfo;
  /** Returns true if this adapter should handle the given address */
  matchesAddress(addr: string): boolean;
  /** Fetch all known signatures for an address from the chain's block explorer */
  fetchSignatures(address: string, maxTx?: number): Promise<SigRecord[]>;
  /** Detect nonce reuse (matching r-values) across the provided signatures */
  checkNonceReuse(address: string, sigs: SigRecord[]): NonceReuseResult[];
}

// ── Address detection patterns ────────────────────────────────────────────────

const ETH_RE    = /^0x[0-9a-fA-F]{40}$/;
const TRON_RE   = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;
const BTC_RE    = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$|^bc1[ac-hj-np-z02-9]{6,87}$/i;
const LTC_RE    = /^[LM][a-km-zA-HJ-NP-Z1-9]{26,33}$|^ltc1[ac-hj-np-z02-9]{6,87}$/i;
const DOGE_RE   = /^D[5-9A-HJ-NP-Za-km-z]{33}$/;
const BCH_RE    = /^(bitcoincash:)?[qp][0-9a-z]{41}$/i;
const SOL_RE    = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const XMR_RE    = /^4[0-9AB][1-9A-HJ-NP-Za-km-z]{93}$/;

/**
 * Detect which blockchain an address belongs to.
 * Returns "unknown" if no pattern matches.
 */
export function detectChain(addr: string): ChainId {
  const a = addr.trim();
  if (ETH_RE.test(a))   return "ethereum";   // EVM (use generic "ethereum" — caller can refine)
  if (TRON_RE.test(a))  return "tron";
  if (XMR_RE.test(a))   return "monero";
  if (BCH_RE.test(a))   return "bitcoincash";
  if (DOGE_RE.test(a))  return "dogecoin";
  if (LTC_RE.test(a))   return "litecoin";
  if (BTC_RE.test(a))   return "bitcoin";
  // Solana: 44-char base58 not starting with 0x; must come after other base58 chains
  if (SOL_RE.test(a) && a.length >= 32 && a.length <= 44 && !a.startsWith("0x")) return "solana";
  return "unknown";
}

/**
 * Return the display family label for a chain.
 */
export function familyLabel(chain: ChainId): string {
  const info = CHAINS[chain];
  switch (info.family) {
    case "evm_secp256k1":     return "EVM/secp256k1";
    case "bitcoin_secp256k1": return "Bitcoin/secp256k1";
    case "solana_ed25519":    return "Solana/Ed25519";
    case "monero_ring":       return "Monero/RingCT";
    default: return "Unknown";
  }
}

// ── secp256k1 nonce-reuse math (shared by EVM + Bitcoin adapters) ─────────────
// Equation: if r1 == r2 across two sigs (s1, z1) and (s2, z2):
//   k = (z1 - z2) / (s1 - s2)  mod n
//   privKey = (s * k - z) / r  mod n

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

function hexToBig(h: string): bigint {
  const clean = h.replace(/^0x/, "").toLowerCase().padStart(64, "0");
  return BigInt("0x" + clean);
}

function bigToHex(n: bigint): string {
  return n.toString(16).padStart(64, "0");
}

export function recoverPrivKeySecp256k1(
  sig1: SigRecord, sig2: SigRecord
): { privKey: string; k: string } | null {
  if (!sig1.z || !sig2.z) return null;
  try {
    const r  = hexToBig(sig1.r);
    const s1 = hexToBig(sig1.s);
    const s2 = hexToBig(sig2.s);
    const z1 = hexToBig(sig1.z);
    const z2 = hexToBig(sig2.z);
    const ds = ((s1 - s2) % N + N) % N;
    if (ds === 0n) return null;
    const k       = (((z1 - z2) % N + N) % N * modInverse(ds, N)) % N;
    if (k === 0n) return null;
    const privKey = (((s1 * k % N - z1 % N) % N + N) % N * modInverse(r, N)) % N;
    if (privKey === 0n || privKey >= N) return null;
    return { privKey: bigToHex(privKey), k: bigToHex(k) };
  } catch {
    return null;
  }
}

/**
 * Generic secp256k1 nonce-reuse detector — works for ANY chain in the family.
 * Groups sigs by r-value, flags any group with 2+ entries.
 */
export function detectNonceReuseSecp256k1(
  address: string, chain: ChainId, sigs: SigRecord[]
): NonceReuseResult[] {
  const byR = new Map<string, SigRecord[]>();
  for (const sig of sigs) {
    const r = sig.r.toLowerCase().replace(/^0x/, "");
    const list = byR.get(r) ?? [];
    list.push(sig);
    byR.set(r, list);
  }
  const results: NonceReuseResult[] = [];
  for (const [r, group] of byR.entries()) {
    if (group.length < 2) continue;
    const [sig1, sig2] = group;
    const recovered = recoverPrivKeySecp256k1(sig1, sig2);
    results.push({
      address, chain,
      sharedR: r,
      sig1, sig2,
      recoveredPrivKey: recovered?.privKey,
      recoveredK:       recovered?.k,
      confidence:       recovered ? 1.0 : 0.9,
      detail: recovered
        ? `Private key recovered via nonce reuse on ${CHAINS[chain].name} — txs ${sig1.txHash} & ${sig2.txHash}`
        : `Nonce reuse detected (r-value collision) on ${CHAINS[chain].name} — txs ${sig1.txHash} & ${sig2.txHash} (sighash z needed to complete recovery)`,
    });
  }
  return results;
}
