/**
 * Address Poisoning Detector
 * ===========================
 * Attackers send near-zero-value transfers FROM vanity addresses whose first
 * and last hex chars match the victim's address. When the victim copies from
 * their history they paste the poisoned address instead of the real one.
 *
 * Detection algorithm:
 *  1. Fetch recent incoming transfers to the address
 *  2. For each sender, compute similarity score vs the target address
 *  3. Flag: prefix match ≥6 chars OR suffix match ≥6 chars
 *  4. Also flag: zero/dust value transfers from unknown addresses
 *  5. Cluster look-alike senders to surface coordinated campaigns
 */

import { ethers } from "ethers";
import { logger } from "../logger";

const BLOCKSCOUT_BASES: Record<string, string> = {
  ethereum: "https://eth.blockscout.com",
  polygon:  "https://polygon.blockscout.com",
  bsc:      "https://bsc.blockscout.com",
  arbitrum: "https://arbitrum.blockscout.com",
  optimism: "https://optimism.blockscout.com",
};

let _lastReq = 0;
async function rateFetch(url: string): Promise<Response> {
  const gap = 300 - (Date.now() - _lastReq);
  if (gap > 0) await new Promise(r => setTimeout(r, gap));
  _lastReq = Date.now();
  return fetch(url, {
    headers: { "Accept": "application/json", "User-Agent": "QuantumAudit/1.0" },
    signal: AbortSignal.timeout(12_000),
  });
}

export interface PoisoningFinding {
  type:         "address_lookalike" | "dust_spam" | "zero_transfer" | "vanity_cluster";
  severity:     "critical" | "high" | "medium" | "low";
  poisonAddress: string;       // the attacker's vanity address
  realAddress:   string;       // the target (victim) address
  txHash:        string;
  blockNumber:   number;
  timestamp:     string;
  valueEth:      number;
  prefixMatch:   number;       // how many leading chars match (0x excluded)
  suffixMatch:   number;       // how many trailing chars match
  similarityPct: number;       // 0-100
  detail:        string;
  remediation:   string;
}

export interface PoisoningCluster {
  pattern:       string;       // shared prefix/suffix pattern
  addresses:     string[];
  txCount:       number;
}

export interface PoisoningScanResult {
  address:     string;
  chain:       string;
  scannedTxs:  number;
  findings:    PoisoningFinding[];
  clusters:    PoisoningCluster[];
  summary:     string;
  riskScore:   number;
  durationMs:  number;
}

function normalize(addr: string): string {
  return addr.toLowerCase().replace(/^0x/, "");
}

function prefixMatch(a: string, b: string): number {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}

function suffixMatch(a: string, b: string): number {
  let i = 0;
  while (i < a.length && i < b.length && a[a.length - 1 - i] === b[b.length - 1 - i]) i++;
  return i;
}

function computeSimilarity(target: string, candidate: string): { prefix: number; suffix: number; pct: number } {
  const t = normalize(target);
  const c = normalize(candidate);
  const pre = prefixMatch(t, c);
  const suf = suffixMatch(t, c);
  // Total matched chars / total chars
  const pct = Math.min(100, Math.round(((pre + suf) / t.length) * 100));
  return { prefix: pre, suffix: suf, pct };
}

async function fetchIncomingTxs(address: string, base: string, limit = 400): Promise<any[]> {
  const txs: any[] = [];
  let cursor: string | null = null;
  const checksum = ethers.getAddress(address);

  for (let page = 0; page < 8; page++) {
    const url = cursor
      ? `${base}/api/v2/addresses/${checksum}/transactions?filter=to&page_token=${encodeURIComponent(cursor)}`
      : `${base}/api/v2/addresses/${checksum}/transactions?filter=to`;
    try {
      const res = await rateFetch(url);
      if (!res.ok) break;
      const data = await res.json() as { items?: any[]; next_page_params?: any };
      const items = data.items ?? [];
      txs.push(...items);
      if (txs.length >= limit || !data.next_page_params) break;
      cursor = `${data.next_page_params.block_number}_${data.next_page_params.index}`;
    } catch { break; }
  }

  // Also fetch token transfers (zero-value ERC-20 dust transfers are the most common vector)
  try {
    const url = `${base}/api/v2/addresses/${checksum}/token-transfers?filter=to`;
    const res = await rateFetch(url);
    if (res.ok) {
      const data = await res.json() as { items?: any[] };
      for (const item of data.items ?? []) {
        txs.push({
          hash:         item.tx_hash,
          from:         { hash: item.from?.hash ?? "" },
          block_number: item.block_number,
          timestamp:    item.timestamp,
          value:        "0",
          _tokenTransfer: true,
          _tokenValue:  item.total?.value ?? "0",
          _token:       item.token?.symbol ?? "?",
        });
      }
    }
  } catch { /* ignore */ }

  return txs.slice(0, limit);
}

export async function detectAddressPoisoning(address: string, chain = "ethereum"): Promise<PoisoningScanResult> {
  const t0 = Date.now();
  const findings: PoisoningFinding[] = [];
  const base = BLOCKSCOUT_BASES[chain] ?? BLOCKSCOUT_BASES.ethereum;

  let txs: any[] = [];
  try {
    txs = await fetchIncomingTxs(address, base, 500);
  } catch (err) {
    logger.warn({ err, address }, "poisoning-scanner: tx fetch failed");
  }

  const targetNorm = normalize(address);

  for (const tx of txs) {
    const sender: string = (tx.from?.hash ?? tx.from ?? "").toLowerCase();
    if (!sender || sender === address.toLowerCase()) continue;

    const rawValue = tx.value ?? tx._tokenValue ?? "0";
    const valueEth = Number(BigInt(rawValue || "0")) / 1e18;
    const isDust   = valueEth < 0.001;
    const isZero   = valueEth === 0;

    const { prefix, suffix, pct } = computeSimilarity(address, sender);

    const blockNum = Number(tx.block_number ?? tx.blockNumber ?? 0);
    const ts       = tx.timestamp ?? tx.timeStamp ?? "";

    // Primary detection: address looks like target
    if (prefix >= 5 || suffix >= 5 || pct >= 60) {
      const sev: "critical" | "high" | "medium" = prefix >= 7 || suffix >= 7 ? "critical" : prefix >= 5 || suffix >= 5 ? "high" : "medium";
      findings.push({
        type:          "address_lookalike",
        severity:      sev,
        poisonAddress: sender,
        realAddress:   address,
        txHash:        tx.hash ?? "",
        blockNumber:   blockNum,
        timestamp:     ts,
        valueEth,
        prefixMatch:   prefix,
        suffixMatch:   suffix,
        similarityPct: pct,
        detail:        `Lookalike address ${sender} shares ${prefix} leading + ${suffix} trailing chars with your address (${pct}% similarity). ${isDust ? "Dust/zero-value transfer — classic address poisoning pattern." : ""} Copying this address from your history would send funds to the attacker.`,
        remediation:   "Never copy addresses from your transaction history. Always use your address book or verify the full address character-by-character. Use ENS or address book labels for trusted addresses.",
      });
    } else if (isZero || isDust) {
      // Low-value spam from unknown address — lower severity
      if (findings.filter(f => f.type === "dust_spam").length < 10) {
        findings.push({
          type:          "dust_spam",
          severity:      "low",
          poisonAddress: sender,
          realAddress:   address,
          txHash:        tx.hash ?? "",
          blockNumber:   blockNum,
          timestamp:     ts,
          valueEth,
          prefixMatch:   prefix,
          suffixMatch:   suffix,
          similarityPct: pct,
          detail:        `Dust transfer (${valueEth} ETH) from ${sender}. Could be airdrop spam used to track wallet activity or a poisoning attempt.`,
          remediation:   "Ignore unknown dust transfers. Do not interact with unknown airdropped tokens as they may trigger approval exploits on interaction.",
        });
      }
    }
  }

  // Cluster analysis: group look-alike senders by shared prefix/suffix pattern
  const clusters: PoisoningCluster[] = [];
  const lookalikes = findings.filter(f => f.type === "address_lookalike");
  if (lookalikes.length > 1) {
    // Group by first 6 chars of poison address
    const groups = new Map<string, PoisoningFinding[]>();
    for (const f of lookalikes) {
      const key = f.poisonAddress.slice(0, 8);
      const arr = groups.get(key) ?? [];
      arr.push(f);
      groups.set(key, arr);
    }
    for (const [pattern, group] of groups) {
      if (group.length >= 2) {
        clusters.push({
          pattern,
          addresses: [...new Set(group.map(f => f.poisonAddress))],
          txCount:   group.length,
        });
      }
    }
  }

  const critCount = findings.filter(f => f.severity === "critical").length;
  const highCount  = findings.filter(f => f.severity === "high").length;
  const riskScore  = Math.min(100, critCount * 30 + highCount * 20 + findings.length * 3);

  const summary = findings.length === 0
    ? `No address poisoning attempts detected in ${txs.length} transactions scanned.`
    : `Found ${findings.length} poisoning indicator(s) in ${txs.length} transactions. ${critCount} critical lookalike addresses detected — do NOT copy addresses from your history.`;

  logger.info({ address, chain, findings: findings.length, txs: txs.length }, "poisoning-scanner complete");

  return {
    address, chain,
    scannedTxs: txs.length,
    findings,
    clusters,
    summary,
    riskScore,
    durationMs: Date.now() - t0,
  };
}
