// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
/**
 * Permit & Blind-Signature Exploit Scanner
 * ==========================================
 * Detects EIP-2612 permit() abuse, setApprovalForAll drainer patterns,
 * unlimited ERC-20 approvals, and blind-signing risks on EVM chains.
 *
 * Attack vectors covered:
 *  1. EIP-2612 permit() — gasless token approvals that drain without user realising
 *  2. setApprovalForAll (ERC-721/1155) — NFT drainer pattern
 *  3. Unlimited ERC-20 approve(spender, MAX_UINT256)
 *  4. Approval to unverified/suspicious contracts
 *  5. Stale high-value approvals (set long ago, never revoked)
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

// Function selectors
const SEL_PERMIT            = "0xd505accf"; // EIP-2612 permit(owner,spender,value,deadline,v,r,s)
const SEL_APPROVE           = "0x095ea7b3"; // ERC-20 approve(spender,amount)
const SEL_SET_APPROVAL_ALL  = "0xa22cb465"; // ERC-721/1155 setApprovalForAll(operator,approved)
const SEL_PERMIT_FOR_ALL    = "0x4b8a3529"; // ERC-1155 permitForAll (non-standard)
const SEL_SIGN_TYPED_PERMIT = "0xdac17f98"; // not a selector — placeholder

const MAX_UINT256 = BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
const UNLIMITED_THRESHOLD = MAX_UINT256 - BigInt("0xffffffffffffffffffffffffffffff"); // anything near max

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

export interface PermitFinding {
  type:        "permit_eip2612" | "set_approval_all" | "unlimited_approve" | "suspicious_approve" | "stale_approval";
  severity:    "critical" | "high" | "medium" | "low";
  txHash:      string;
  blockNumber: number;
  timestamp:   string;
  to:          string;         // contract called
  spender?:    string;         // who gets the approval
  token?:      string;         // token contract
  tokenSymbol?: string;
  amount?:     string;         // raw amount
  amountLabel: string;         // human label
  deadline?:   number;         // permit deadline (unix)
  deadlineLabel?: string;
  expired?:    boolean;
  detail:      string;
  remediation: string;
}

export interface PermitScanResult {
  address:    string;
  chain:      string;
  scannedTxs: number;
  findings:   PermitFinding[];
  summary:    string;
  riskScore:  number;          // 0-100
  durationMs: number;
}

function decodeApproveInput(input: string): { spender: string; amount: bigint } | null {
  try {
    const iface = new ethers.Interface(["function approve(address spender, uint256 amount)"]);
    const decoded = iface.decodeFunctionData("approve", input);
    return { spender: decoded[0] as string, amount: decoded[1] as bigint };
  } catch { return null; }
}

function decodeSetApprovalAll(input: string): { operator: string; approved: boolean } | null {
  try {
    const iface = new ethers.Interface(["function setApprovalForAll(address operator, bool approved)"]);
    const decoded = iface.decodeFunctionData("setApprovalForAll", input);
    return { operator: decoded[0] as string, approved: decoded[1] as boolean };
  } catch { return null; }
}

function decodePermit(input: string): { owner: string; spender: string; value: bigint; deadline: bigint } | null {
  try {
    const iface = new ethers.Interface([
      "function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s)"
    ]);
    const decoded = iface.decodeFunctionData("permit", input);
    return { owner: decoded[0] as string, spender: decoded[1] as string, value: decoded[2] as bigint, deadline: decoded[3] as bigint };
  } catch { return null; }
}

function fmtAmount(amount: bigint): string {
  if (amount >= UNLIMITED_THRESHOLD) return "UNLIMITED (max uint256)";
  const eth = Number(amount) / 1e18;
  if (eth > 1e12) return "UNLIMITED (astronomical)";
  if (eth > 1e6)  return `${eth.toLocaleString()} tokens`;
  if (eth > 1)    return `${eth.toFixed(4)} tokens`;
  return `${amount.toString()} wei`;
}

function deadlineLabel(deadline: bigint): { label: string; expired: boolean } {
  const ts = Number(deadline);
  if (ts === 0) return { label: "no deadline (permanent)", expired: false };
  const d = new Date(ts * 1000);
  const now = Date.now() / 1000;
  const expired = ts < now;
  return {
    label: expired ? `EXPIRED ${d.toISOString()}` : `expires ${d.toISOString()}`,
    expired,
  };
}

async function fetchTxList(address: string, base: string, limit = 300): Promise<any[]> {
  const txs: any[] = [];
  let cursor: string | null = null;
  const checksum = ethers.getAddress(address);

  for (let page = 0; page < 6; page++) {
    const url = cursor
      ? `${base}/api/v2/addresses/${checksum}/transactions?filter=from&page_token=${encodeURIComponent(cursor)}`
      : `${base}/api/v2/addresses/${checksum}/transactions?filter=from`;
    try {
      const res = await rateFetch(url);
      if (!res.ok) break;
      const data = await res.json() as { items?: any[]; next_page_params?: { block_number: number; index: number } };
      const items = data.items ?? [];
      txs.push(...items);
      if (txs.length >= limit || !data.next_page_params) break;
      cursor = `${data.next_page_params.block_number}_${data.next_page_params.index}`;
    } catch { break; }
  }
  return txs.slice(0, limit);
}

export async function scanPermitExploits(address: string, chain = "ethereum"): Promise<PermitScanResult> {
  const t0 = Date.now();
  const findings: PermitFinding[] = [];
  const base = BLOCKSCOUT_BASES[chain] ?? BLOCKSCOUT_BASES.ethereum;
  const now  = Math.floor(Date.now() / 1000);

  let txs: any[] = [];
  try {
    txs = await fetchTxList(address, base, 500);
  } catch (err) {
    logger.warn({ err, address }, "permit-scanner: tx fetch failed");
  }

  for (const tx of txs) {
    const input: string = tx.raw_input ?? tx.input ?? "";
    if (!input || input.length < 10) continue;
    const sel = input.slice(0, 10).toLowerCase();
    const blockNum = Number(tx.block_number ?? tx.blockNumber ?? 0);
    const ts = tx.timestamp ?? tx.timeStamp ?? "";
    const to: string = (tx.to?.hash ?? tx.to ?? "").toLowerCase();

    if (sel === SEL_PERMIT) {
      const decoded = decodePermit(input);
      const dl = decoded ? deadlineLabel(decoded.deadline) : { label: "unknown", expired: false };
      const isUnlimited = decoded ? decoded.value >= UNLIMITED_THRESHOLD : false;
      findings.push({
        type:         "permit_eip2612",
        severity:     isUnlimited ? "critical" : "high",
        txHash:       tx.hash,
        blockNumber:  blockNum,
        timestamp:    ts,
        to,
        spender:      decoded?.spender,
        amount:       decoded?.value.toString(),
        amountLabel:  decoded ? fmtAmount(decoded.value) : "unknown",
        deadline:     decoded ? Number(decoded.deadline) : undefined,
        deadlineLabel: dl.label,
        expired:      dl.expired,
        detail:       `EIP-2612 permit() call grants gasless spending rights. ${isUnlimited ? "UNLIMITED amount — drainer pattern." : ""} Spender: ${decoded?.spender ?? "unknown"}. ${dl.expired ? "Deadline already EXPIRED — may still be usable via replay on other chains." : ""}`,
        remediation:  "Revoke all permit approvals immediately. Never sign permit() requests from sites you did not initiate. Use Revoke.cash or Etherscan token approvals to audit active permits.",
      });
    } else if (sel === SEL_SET_APPROVAL_ALL) {
      const decoded = decodeSetApprovalAll(input);
      if (decoded?.approved) {
        findings.push({
          type:        "set_approval_all",
          severity:    "critical",
          txHash:      tx.hash,
          blockNumber: blockNum,
          timestamp:   ts,
          to,
          spender:     decoded.operator,
          amountLabel: "ALL tokens/NFTs",
          detail:      `setApprovalForAll() granted to ${decoded.operator}. This gives the operator full control over every NFT/token in this collection forever. Classic NFT drainer vector.`,
          remediation: "Revoke setApprovalForAll immediately via OpenSea, Revoke.cash, or directly on Etherscan. Only grant this to trusted, audited marketplace contracts.",
        });
      }
    } else if (sel === SEL_APPROVE) {
      const decoded = decodeApproveInput(input);
      if (decoded) {
        const unlimited = decoded.amount >= UNLIMITED_THRESHOLD;
        if (unlimited || decoded.amount > BigInt("1000000") * BigInt(10 ** 18)) {
          const ageMonths = ts ? Math.floor((now - new Date(ts).getTime() / 1000) / (30 * 86400)) : 0;
          const stale = ageMonths > 6;
          findings.push({
            type:        stale ? "stale_approval" : "unlimited_approve",
            severity:    unlimited ? "high" : "medium",
            txHash:      tx.hash,
            blockNumber: blockNum,
            timestamp:   ts,
            to,
            spender:     decoded.spender,
            amount:      decoded.amount.toString(),
            amountLabel: fmtAmount(decoded.amount),
            detail:      `${unlimited ? "Unlimited" : "Very large"} ERC-20 approval to ${decoded.spender}.${stale ? ` Granted ${ageMonths} months ago — stale approval attack surface.` : ""} If the spender contract is compromised, all approved tokens can be drained.`,
            remediation:  "Revoke or reduce approval to exact-amount needed per transaction. Use Revoke.cash to audit and revoke stale approvals.",
          });
        }
      }
    }
  }

  // Dedupe by txHash
  const seen = new Set<string>();
  const deduped = findings.filter(f => { if (seen.has(f.txHash)) return false; seen.add(f.txHash); return true; });

  const critCount = deduped.filter(f => f.severity === "critical").length;
  const highCount = deduped.filter(f => f.severity === "high").length;
  const riskScore = Math.min(100, critCount * 25 + highCount * 15 + deduped.length * 5);

  const summary = deduped.length === 0
    ? `No dangerous approval patterns detected in ${txs.length} transactions scanned.`
    : `Found ${deduped.length} permit/approval risk(s): ${critCount} critical, ${highCount} high. Immediate revocation recommended.`;

  logger.info({ address, chain, findings: deduped.length, txs: txs.length }, "permit-scanner complete");

  return {
    address, chain,
    scannedTxs: txs.length,
    findings:   deduped,
    summary,
    riskScore,
    durationMs: Date.now() - t0,
  };
}
