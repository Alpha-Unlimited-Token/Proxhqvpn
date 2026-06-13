// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
/**
 * Token Approval Risk Scanner
 * ============================
 * Audits all active ERC-20 / ERC-721 / ERC-1155 approvals for a wallet
 * to surface high-risk or stale permissions that attackers can exploit.
 *
 * Attack vectors:
 *  - Unlimited allowances left open after a DeFi interaction
 *  - Approvals to deprecated/hacked/unverified contracts
 *  - setApprovalForAll to marketplace contracts that had exploits
 *  - Old approvals no longer needed (stale = attack surface)
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

const RPC_ENDPOINTS: Record<string, string> = {
  ethereum:  "https://ethereum.publicnode.com",
  polygon:   "https://polygon-bor.publicnode.com",
  bsc:       "https://bsc.publicnode.com",
  arbitrum:  "https://arbitrum-one.publicnode.com",
  optimism:  "https://optimism.publicnode.com",
};

const MAX_UINT256 = BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
const UNLIMITED_THRESHOLD = MAX_UINT256 - BigInt("0xffffffffffffffffffffffffffff");

// Known exploited/compromised contracts (Ethereum mainnet)
const KNOWN_BAD_SPENDERS = new Set([
  "0x00000000219ab540356cbb839cbe05303d7705fa", // Beacon deposit (not bad but common mis-approval)
]);

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

export interface ApprovalRecord {
  token:        string;       // token contract address
  tokenSymbol:  string;
  tokenName:    string;
  tokenType:    "ERC-20" | "ERC-721" | "ERC-1155" | "unknown";
  spender:      string;
  allowance:    string;       // raw
  allowanceLabel: string;     // human readable
  isUnlimited:  boolean;
  txHash:       string;
  blockNumber:  number;
  timestamp:    string;
  ageMonths:    number;
  riskLevel:    "critical" | "high" | "medium" | "low" | "safe";
  riskReason:   string;
  remediation:  string;
}

export interface ApprovalScanResult {
  address:     string;
  chain:       string;
  totalFound:  number;
  unlimited:   number;
  stale:       number;
  approvals:   ApprovalRecord[];
  summary:     string;
  riskScore:   number;
  durationMs:  number;
}

function fmtAllowance(amount: bigint, decimals = 18): string {
  if (amount >= UNLIMITED_THRESHOLD) return "UNLIMITED";
  try {
    const formatted = ethers.formatUnits(amount, decimals);
    const num = parseFloat(formatted);
    if (num > 1e12) return "UNLIMITED (astronomical)";
    if (num > 1e6)  return num.toLocaleString(undefined, { maximumFractionDigits: 0 });
    return num.toLocaleString(undefined, { maximumFractionDigits: 4 });
  } catch {
    return amount.toString();
  }
}

function riskLevel(rec: { isUnlimited: boolean; ageMonths: number; spender: string; tokenType: string }): {
  level: "critical" | "high" | "medium" | "low" | "safe";
  reason: string;
} {
  if (KNOWN_BAD_SPENDERS.has(rec.spender.toLowerCase())) {
    return { level: "critical", reason: "Spender is a known exploited or suspicious contract." };
  }
  if (rec.tokenType === "ERC-721" || rec.tokenType === "ERC-1155") {
    if (rec.isUnlimited) return { level: "critical", reason: "setApprovalForAll grants operator full NFT collection control." };
  }
  if (rec.isUnlimited && rec.ageMonths > 12) {
    return { level: "critical", reason: "Unlimited allowance open for over 12 months — highly exploitable stale approval." };
  }
  if (rec.isUnlimited && rec.ageMonths > 3) {
    return { level: "high", reason: "Unlimited allowance open for over 3 months — stale attack surface." };
  }
  if (rec.isUnlimited) {
    return { level: "high", reason: "Unlimited allowance — if spender is compromised, all tokens can be drained." };
  }
  if (rec.ageMonths > 12) {
    return { level: "medium", reason: "Stale approval (12+ months old) — no longer needed, unnecessary risk." };
  }
  if (rec.ageMonths > 6) {
    return { level: "low", reason: "Old approval (6+ months). Review whether still needed." };
  }
  return { level: "safe", reason: "Recent, bounded approval." };
}

async function fetchApprovals(address: string, base: string): Promise<any[]> {
  const checksum = ethers.getAddress(address);
  const results: any[] = [];

  // Blockscout v2: token approvals endpoint
  try {
    const url = `${base}/api/v2/addresses/${checksum}/token-balances`;
    const res = await rateFetch(url);
    if (res.ok) {
      const data = await res.json() as { items?: any[] } | any[];
      const items = Array.isArray(data) ? data : (data.items ?? []);
      // These give us token holdings; we need to cross-reference approvals via logs
    }
  } catch { /* ignore */ }

  // Fetch Approval event logs via Blockscout
  try {
    const url = `${base}/api/v2/addresses/${checksum}/logs?topic=0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925`;
    const res = await rateFetch(url);
    if (res.ok) {
      const data = await res.json() as { items?: any[] };
      for (const log of data.items ?? []) {
        results.push({ ...log, _eventType: "ERC20_Approval" });
      }
    }
  } catch { /* ignore */ }

  // Fetch ApprovalForAll logs
  try {
    const url = `${base}/api/v2/addresses/${checksum}/logs?topic=0x17307eab39ab6107e8899845ad3d59bd9653f200f220920489ca2b5937696c31`;
    const res = await rateFetch(url);
    if (res.ok) {
      const data = await res.json() as { items?: any[] };
      for (const log of data.items ?? []) {
        results.push({ ...log, _eventType: "ApprovalForAll" });
      }
    }
  } catch { /* ignore */ }

  return results;
}

async function fetchTxApprovals(address: string, base: string): Promise<ApprovalRecord[]> {
  const SEL_APPROVE          = "0x095ea7b3";
  const SEL_SET_APPROVAL_ALL = "0xa22cb465";
  const checksum = ethers.getAddress(address);
  const records: ApprovalRecord[] = [];
  const now = Math.floor(Date.now() / 1000);

  let cursor: string | null = null;
  const txs: any[] = [];

  for (let page = 0; page < 8; page++) {
    const url = cursor
      ? `${base}/api/v2/addresses/${checksum}/transactions?filter=from&page_token=${encodeURIComponent(cursor)}`
      : `${base}/api/v2/addresses/${checksum}/transactions?filter=from`;
    try {
      const res = await rateFetch(url);
      if (!res.ok) break;
      const data = await res.json() as { items?: any[]; next_page_params?: any };
      txs.push(...(data.items ?? []));
      if (txs.length >= 400 || !data.next_page_params) break;
      cursor = `${data.next_page_params.block_number}_${data.next_page_params.index}`;
    } catch { break; }
  }

  const seenKeys = new Set<string>();

  for (const tx of txs) {
    const input: string = tx.raw_input ?? tx.input ?? "";
    if (!input || input.length < 10) continue;
    const sel = input.slice(0, 10).toLowerCase();

    const to: string  = (tx.to?.hash ?? tx.to ?? "").toLowerCase();
    const ts: string  = tx.timestamp ?? tx.timeStamp ?? "";
    const bn: number  = Number(tx.block_number ?? tx.blockNumber ?? 0);
    const tsUnix      = ts ? Math.floor(new Date(ts).getTime() / 1000) : now;
    const ageMonths   = Math.floor((now - tsUnix) / (30 * 86400));
    const symbol: string = tx.to?.name ?? tx.to?.token?.symbol ?? "?";

    if (sel === SEL_APPROVE) {
      try {
        const iface = new ethers.Interface(["function approve(address spender, uint256 amount)"]);
        const decoded = iface.decodeFunctionData("approve", input);
        const spender  = (decoded[0] as string).toLowerCase();
        const amount   = decoded[1] as bigint;
        const isUnlimited = amount >= UNLIMITED_THRESHOLD;
        const key = `${to}:${spender}`;
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);
        const { level, reason } = riskLevel({ isUnlimited, ageMonths, spender, tokenType: "ERC-20" });
        records.push({
          token:          to,
          tokenSymbol:    symbol,
          tokenName:      tx.to?.name ?? "",
          tokenType:      "ERC-20",
          spender,
          allowance:      amount.toString(),
          allowanceLabel: fmtAllowance(amount),
          isUnlimited,
          txHash:         tx.hash,
          blockNumber:    bn,
          timestamp:      ts,
          ageMonths,
          riskLevel:      level,
          riskReason:     reason,
          remediation:    isUnlimited
            ? "Revoke this unlimited approval immediately via Revoke.cash or Etherscan token approvals tab."
            : "Review whether this approval is still needed. Revoke if no longer using this protocol.",
        });
      } catch { /* skip malformed */ }
    } else if (sel === SEL_SET_APPROVAL_ALL) {
      try {
        const iface = new ethers.Interface(["function setApprovalForAll(address operator, bool approved)"]);
        const decoded = iface.decodeFunctionData("setApprovalForAll", input);
        const operator = (decoded[0] as string).toLowerCase();
        const approved = decoded[1] as boolean;
        if (!approved) continue; // revocation tx, skip
        const key = `${to}:${operator}:all`;
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);
        const { level, reason } = riskLevel({ isUnlimited: true, ageMonths, spender: operator, tokenType: "ERC-721" });
        records.push({
          token:          to,
          tokenSymbol:    symbol,
          tokenName:      tx.to?.name ?? "",
          tokenType:      "ERC-721",
          spender:        operator,
          allowance:      "ALL",
          allowanceLabel: "ALL (setApprovalForAll)",
          isUnlimited:    true,
          txHash:         tx.hash,
          blockNumber:    bn,
          timestamp:      ts,
          ageMonths,
          riskLevel:      level,
          riskReason:     reason,
          remediation:    "Revoke setApprovalForAll immediately. Only grant this permission when actively trading on a trusted marketplace.",
        });
      } catch { /* skip */ }
    }
  }

  return records;
}

export async function scanTokenApprovals(address: string, chain = "ethereum"): Promise<ApprovalScanResult> {
  const t0 = Date.now();
  const base = BLOCKSCOUT_BASES[chain] ?? BLOCKSCOUT_BASES.ethereum;

  let approvals: ApprovalRecord[] = [];
  try {
    approvals = await fetchTxApprovals(address, base);
  } catch (err) {
    logger.warn({ err, address }, "approval-scanner: failed");
  }

  const unlimited = approvals.filter(a => a.isUnlimited).length;
  const stale     = approvals.filter(a => a.ageMonths > 6).length;
  const critCount = approvals.filter(a => a.riskLevel === "critical").length;
  const highCount = approvals.filter(a => a.riskLevel === "high").length;
  const riskScore = Math.min(100, critCount * 25 + highCount * 15 + unlimited * 10 + stale * 5);

  const summary = approvals.length === 0
    ? "No token approvals found in scanned transactions."
    : `Found ${approvals.length} approval(s): ${unlimited} unlimited, ${stale} stale (6+ months). ${critCount} critical risk.`;

  logger.info({ address, chain, approvals: approvals.length, unlimited, stale }, "approval-scanner complete");

  return {
    address, chain,
    totalFound:  approvals.length,
    unlimited,
    stale,
    approvals:   approvals.sort((a, b) => {
      const order = { critical: 0, high: 1, medium: 2, low: 3, safe: 4 };
      return order[a.riskLevel] - order[b.riskLevel];
    }),
    summary,
    riskScore,
    durationMs:  Date.now() - t0,
  };
}
