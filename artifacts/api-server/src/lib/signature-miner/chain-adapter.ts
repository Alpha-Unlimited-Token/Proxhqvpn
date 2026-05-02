// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
/**
 * Chain Adapter — Types, Detection & Registry
 * ════════════════════════════════════════════
 * Central registry for all supported blockchains. Each chain has:
 *  - An address regex pattern for auto-detection
 *  - A signature scheme family (secp256k1 / ed25519 / ring)
 *  - An API endpoint for fetching transaction data
 *
 * TOP-20 SUPPORTED CHAINS (by usage + laundering prevalence):
 *   EVM family        — Ethereum, Polygon, BSC, Arbitrum, Optimism, Avalanche,
 *                       Base, Fantom, Ethereum Classic, Tron
 *   Bitcoin family    — Bitcoin, Litecoin, Dogecoin, Bitcoin Cash (secp256k1 DER)
 *   UTXO privacy      — Dash (PrivateSend), Zcash (transparent secp256k1 + shielded detection)
 *   XRP Ledger        — Ripple/XRP (secp256k1 DER, unique StrKey format)
 *   Ed25519 family    — Solana, Stellar, Cardano, NEAR
 *   L1 secp256k1      — Cosmos/ATOM
 *   Privacy rings     — Monero (ring signatures — detection only)
 */

// ── Chain identifiers ─────────────────────────────────────────────────────────

export type ChainId =
  // EVM
  | "ethereum" | "polygon" | "bsc" | "arbitrum" | "optimism"
  | "avalanche" | "base" | "fantom" | "tron" | "ethereum_classic"
  // Bitcoin family (secp256k1 UTXO)
  | "bitcoin" | "litecoin" | "dogecoin" | "bitcoincash"
  // UTXO privacy coins
  | "dash" | "zcash"
  // XRP Ledger
  | "ripple"
  // Ed25519 family
  | "solana" | "stellar" | "cardano" | "near"
  // secp256k1 L1s
  | "cosmos"
  // Ring / privacy
  | "monero"
  | "unknown";

export type ChainFamily =
  | "evm_secp256k1"       // Ethereum-compatible (ethers.js)
  | "bitcoin_secp256k1"   // UTXO chains — DER-encoded ECDSA secp256k1
  | "solana_ed25519"      // Solana Ed25519 (specific)
  | "generic_ed25519"     // XLM, ADA, NEAR — Ed25519 variants
  | "monero_ring"         // Ring signatures (limited)
  | "unknown";

// ── Chain metadata ────────────────────────────────────────────────────────────

export interface ChainInfo {
  id:          ChainId;
  name:        string;
  ticker:      string;
  family:      ChainFamily;
  rpcUrl?:     string;
  apiBase?:    string;
  explorerTx?: string;
}

export const CHAINS: Record<ChainId, ChainInfo> = {
  // ── EVM ────────────────────────────────────────────────────────────────────
  ethereum: {
    id: "ethereum", name: "Ethereum", ticker: "ETH", family: "evm_secp256k1",
    rpcUrl:    "https://ethereum.publicnode.com",
    apiBase:   "https://api.etherscan.io/api",
    explorerTx: "https://etherscan.io/tx/",
  },
  polygon: {
    id: "polygon", name: "Polygon", ticker: "MATIC", family: "evm_secp256k1",
    rpcUrl:    "https://polygon-bor-rpc.publicnode.com",
    explorerTx: "https://polygonscan.com/tx/",
  },
  bsc: {
    id: "bsc", name: "BNB Smart Chain", ticker: "BNB", family: "evm_secp256k1",
    rpcUrl:    "https://bsc-rpc.publicnode.com",
    explorerTx: "https://bscscan.com/tx/",
  },
  arbitrum: {
    id: "arbitrum", name: "Arbitrum One", ticker: "ETH", family: "evm_secp256k1",
    rpcUrl:    "https://arbitrum-one-rpc.publicnode.com",
    explorerTx: "https://arbiscan.io/tx/",
  },
  optimism: {
    id: "optimism", name: "Optimism", ticker: "ETH", family: "evm_secp256k1",
    rpcUrl:    "https://optimism-rpc.publicnode.com",
    explorerTx: "https://optimistic.etherscan.io/tx/",
  },
  avalanche: {
    id: "avalanche", name: "Avalanche C-Chain", ticker: "AVAX", family: "evm_secp256k1",
    rpcUrl:    "https://avalanche-c-chain-rpc.publicnode.com/ext/bc/C/rpc",
    explorerTx: "https://snowtrace.io/tx/",
  },
  base: {
    id: "base", name: "Base", ticker: "ETH", family: "evm_secp256k1",
    rpcUrl:    "https://base-rpc.publicnode.com",
    explorerTx: "https://basescan.org/tx/",
  },
  fantom: {
    id: "fantom", name: "Fantom Opera", ticker: "FTM", family: "evm_secp256k1",
    rpcUrl:    "https://fantom-rpc.publicnode.com",
    explorerTx: "https://ftmscan.com/tx/",
  },
  ethereum_classic: {
    id: "ethereum_classic", name: "Ethereum Classic", ticker: "ETC", family: "evm_secp256k1",
    rpcUrl:    "https://etc.etcdesktop.com",
    explorerTx: "https://etc.blockscout.com/tx/",
  },
  tron: {
    id: "tron", name: "Tron", ticker: "TRX", family: "evm_secp256k1",
    apiBase:   "https://apilist.tronscanapi.com/api",
    explorerTx: "https://tronscan.org/#/transaction/",
  },

  // ── Bitcoin family ─────────────────────────────────────────────────────────
  bitcoin: {
    id: "bitcoin", name: "Bitcoin", ticker: "BTC", family: "bitcoin_secp256k1",
    apiBase:   "https://blockstream.info/api",
    explorerTx: "https://blockstream.info/tx/",
  },
  litecoin: {
    id: "litecoin", name: "Litecoin", ticker: "LTC", family: "bitcoin_secp256k1",
    apiBase:   "https://litecoinspace.org/api",
    explorerTx: "https://litecoinspace.org/tx/",
  },
  dogecoin: {
    id: "dogecoin", name: "Dogecoin", ticker: "DOGE", family: "bitcoin_secp256k1",
    apiBase:   "https://dogechain.info/api/v1",
    explorerTx: "https://dogechain.info/tx/",
  },
  bitcoincash: {
    id: "bitcoincash", name: "Bitcoin Cash", ticker: "BCH", family: "bitcoin_secp256k1",
    apiBase:   "https://rest.bch.actinium.org/v2",
    explorerTx: "https://explorer.bitcoin.com/bch/tx/",
  },

  // ── UTXO privacy coins ─────────────────────────────────────────────────────
  dash: {
    id: "dash", name: "Dash", ticker: "DASH", family: "bitcoin_secp256k1",
    // BlockCypher public API — no key required
    apiBase:   "https://api.blockcypher.com/v1/dash/main",
    explorerTx: "https://insight.dash.org/insight/tx/",
  },
  zcash: {
    id: "zcash", name: "Zcash", ticker: "ZEC", family: "bitcoin_secp256k1",
    // Transparent addresses only — secp256k1 DER sigs recoverable
    // Shielded (zs1/u1) are flagged as detection-only
    apiBase:   "https://api.zcha.in/v2/mainnet",
    explorerTx: "https://zcashblockexplorer.com/transactions/",
  },

  // ── XRP Ledger ─────────────────────────────────────────────────────────────
  ripple: {
    id: "ripple", name: "XRP Ledger", ticker: "XRP", family: "bitcoin_secp256k1",
    // Public XRPL JSON-RPC cluster
    rpcUrl:    "https://xrplcluster.com",
    explorerTx: "https://xrpscan.com/tx/",
  },

  // ── Ed25519 family ─────────────────────────────────────────────────────────
  solana: {
    id: "solana", name: "Solana", ticker: "SOL", family: "solana_ed25519",
    rpcUrl:    "https://api.mainnet-beta.solana.com",
    explorerTx: "https://solscan.io/tx/",
  },
  stellar: {
    id: "stellar", name: "Stellar", ticker: "XLM", family: "generic_ed25519",
    apiBase:   "https://horizon.stellar.org",
    explorerTx: "https://stellar.expert/explorer/public/tx/",
  },
  cardano: {
    id: "cardano", name: "Cardano", ticker: "ADA", family: "generic_ed25519",
    // Koios — free public API, no key required
    apiBase:   "https://api.koios.rest/api/v1",
    explorerTx: "https://cardanoscan.io/transaction/",
  },
  near: {
    id: "near", name: "NEAR Protocol", ticker: "NEAR", family: "generic_ed25519",
    rpcUrl:    "https://rpc.mainnet.near.org",
    apiBase:   "https://api.nearblocks.io/v1",
    explorerTx: "https://nearblocks.io/txns/",
  },

  // ── secp256k1 L1s ──────────────────────────────────────────────────────────
  cosmos: {
    id: "cosmos", name: "Cosmos Hub", ticker: "ATOM", family: "bitcoin_secp256k1",
    apiBase:   "https://cosmos-rest.publicnode.com",
    explorerTx: "https://www.mintscan.io/cosmos/txs/",
  },

  // ── Privacy / Ring signature ────────────────────────────────────────────────
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
  r:            string;    // hex (no 0x prefix) — 64 chars
  s:            string;    // hex — 64 chars
  z?:           string;    // message hash / sighash (optional)
  txHash:       string;
  blockHeight?: number;
  sigIndex?:    number;    // for multi-input BTC/UTX txs
  raw?:         string;    // original DER or full sig hex
}

// ── Nonce reuse finding ───────────────────────────────────────────────────────

export interface NonceReuseResult {
  address:           string;
  chain:             ChainId;
  sharedR:           string;
  sig1:              SigRecord;
  sig2:              SigRecord;
  recoveredPrivKey?: string;
  recoveredK?:       string;
  confidence:        number;
  detail:            string;
}

// ── Adapter interface ─────────────────────────────────────────────────────────

export interface ChainAdapter {
  chain: ChainInfo;
  matchesAddress(addr: string): boolean;
  fetchSignatures(address: string, maxTx?: number): Promise<SigRecord[]>;
  checkNonceReuse(address: string, sigs: SigRecord[]): NonceReuseResult[];
}

// ── Address detection patterns ────────────────────────────────────────────────
// ORDER MATTERS — most specific patterns first, broad catch-alls last.

const ETH_RE     = /^0x[0-9a-fA-F]{40}$/;
const TRON_RE    = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;
const XMR_RE     = /^4[0-9AB][1-9A-HJ-NP-Za-km-z]{93}$/;
// ZEC: transparent t1/t3 (P2PKH/P2SH) — secp256k1 fully recoverable
//      shielded zs1/u1 — detection only
const ZEC_T_RE   = /^t[13][1-9A-HJ-NP-Za-km-z]{33}$/;
const ZEC_S_RE   = /^(zs1|u1)[a-z0-9]{60,}$/;
// DASH: X-prefix P2PKH or 7-prefix P2SH
const DASH_RE    = /^[X7][1-9A-HJ-NP-Za-km-z]{33}$/;
// XRP: r-prefix StrKey (length 25–34)
const XRP_RE     = /^r[1-9A-HJ-NP-Za-km-z]{24,33}$/;
// Stellar: G + 55 base32 (A-Z2-7) = 56 chars
const XLM_RE     = /^G[A-Z2-7]{55}$/;
// Cosmos bech32 hrp variants
const COSMOS_RE  = /^cosmos1[a-z0-9]{38}$/;
// NEAR: named *.near or implicit 64-char lowercase hex
const NEAR_RE    = /^([a-z0-9._-]{2,64}\.near|[0-9a-f]{64})$/;
// Cardano Shelley bech32 (addr1...) or Byron legacy (Ae2...)
const ADA_RE     = /^(addr1[a-z0-9]{50,108}|Ae2[1-9A-HJ-NP-Za-km-z]{50,})$/;
// Bitcoin Cash
const BCH_RE     = /^(bitcoincash:)?[qp][0-9a-z]{41}$/i;
// Dogecoin: D + 33 base58
const DOGE_RE    = /^D[5-9A-HJ-NP-Za-km-z]{33}$/;
// Litecoin: L/M prefix or ltc1 bech32
const LTC_RE     = /^[LM][a-km-zA-HJ-NP-Z1-9]{26,33}$|^ltc1[ac-hj-np-z02-9]{6,87}$/i;
// Bitcoin: 1/3 prefix or bc1 bech32
const BTC_RE     = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$|^bc1[ac-hj-np-z02-9]{6,87}$/i;
// Solana: 32–44 base58, catch-all for Ed25519 pubkeys
const SOL_RE     = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function detectChain(addr: string): ChainId {
  const a = addr.trim();

  // ── Unambiguous prefix / length checks first ─────────────────────────────
  if (ETH_RE.test(a))    return "ethereum";    // EVM (caller refines to specific L2)
  if (TRON_RE.test(a))   return "tron";
  if (XMR_RE.test(a))    return "monero";
  if (ZEC_S_RE.test(a))  return "zcash";       // shielded — detection only
  if (ZEC_T_RE.test(a))  return "zcash";       // transparent — full secp256k1
  if (DASH_RE.test(a))   return "dash";
  if (XRP_RE.test(a))    return "ripple";
  if (XLM_RE.test(a))    return "stellar";
  if (COSMOS_RE.test(a)) return "cosmos";
  if (ADA_RE.test(a))    return "cardano";
  if (NEAR_RE.test(a))   return "near";
  if (BCH_RE.test(a))    return "bitcoincash";
  if (DOGE_RE.test(a))   return "dogecoin";
  if (LTC_RE.test(a))    return "litecoin";
  if (BTC_RE.test(a))    return "bitcoin";
  // Solana: broad base58 catch-all — must come after all other base58 chains
  if (SOL_RE.test(a) && a.length >= 32 && a.length <= 44 && !a.startsWith("0x")) return "solana";

  return "unknown";
}

export function familyLabel(chain: ChainId): string {
  const info = CHAINS[chain];
  switch (info?.family) {
    case "evm_secp256k1":     return "EVM/secp256k1";
    case "bitcoin_secp256k1": return "Bitcoin/secp256k1";
    case "solana_ed25519":    return "Solana/Ed25519";
    case "generic_ed25519":   return "Ed25519";
    case "monero_ring":       return "Monero/RingCT";
    default: return "Unknown";
  }
}

// ── secp256k1 nonce-reuse math ────────────────────────────────────────────────
// Shared by EVM, Bitcoin-family, DASH, ZEC, XRP, Cosmos adapters.
// k = (z1 - z2) / (s1 - s2)  mod n
// privKey = (s*k - z) / r      mod n

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
      address, chain, sharedR: r, sig1, sig2,
      recoveredPrivKey: recovered?.privKey,
      recoveredK:       recovered?.k,
      confidence:       recovered ? 1.0 : 0.9,
      detail: recovered
        ? `Private key recovered via nonce reuse on ${CHAINS[chain].name} — txs ${sig1.txHash} & ${sig2.txHash}`
        : `Nonce reuse (r-collision) on ${CHAINS[chain].name} — txs ${sig1.txHash} & ${sig2.txHash} (sighash needed to complete recovery)`,
    });
  }
  return results;
}
