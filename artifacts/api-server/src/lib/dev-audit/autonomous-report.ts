// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
/**
 * Autonomous Report Engine
 * ========================
 * Orchestrates all 5 exploit engines + wallet scanners across all major chains.
 * Produces a single comprehensive security report with severity rankings.
 * All calls are real live network requests — zero mocked data.
 */

import { runNodeIntel, runAdminScan, runBatchDosTest, runCallAbuseTest, snapshotMempool } from "./exploit-engines";
import { scanNonceBatch } from "./nonce-gap-detector";

// ── Target definitions ──────────────────────────────────────────────────────

export const AUTO_CHAINS = [
  { chain: "Ethereum Mainnet",  url: "https://ethereum.publicnode.com",        id: "eth"  },
  { chain: "BNB Smart Chain",   url: "https://bsc.publicnode.com",             id: "bsc"  },
  { chain: "Polygon Mainnet",   url: "https://polygon-bor.publicnode.com",     id: "poly" },
  { chain: "Arbitrum One",      url: "https://arbitrum-one.publicnode.com",    id: "arb"  },
  { chain: "Optimism",          url: "https://optimism.publicnode.com",        id: "op"   },
  { chain: "Base",              url: "https://base.publicnode.com",            id: "base" },
  { chain: "Avalanche C-Chain", url: "https://avalanche-c-chain.publicnode.com", id: "avax" },
];

export const AUTO_WALLETS = [
  "0x0d5c41c609fe1ec073c3b4fa10949d602ed059bb",
  "0xb98e8eefba0f7476b85cd9716cb5b38a935aa872",
  "0xb01fed2f701695992a4f7ffdb53f3af099e140d7",
  "0xf70da97812cb96acdf810712aa562db8dfa3dbef",
  "0xc600d76b5bfe058d6e52d2c08ceba6c85774f9b6",
  "0xbcd263db9c9ed9215bcb07897f9da582129dd7da",
  "0xea7fc58e112fb3607d8a7694e1f71c6894c72d3c",
  "0xacd1f4e274d1a4bb686a41549a90253cf152dd6d",
  "0xe205e85068704ecf1c3c55b76bcb466ff0798526",
  "0x9b9fd485e94c73af3bc8b9a630c4de7203bc96cb",
  "0x610e10ed49f57591abe16d919b6d15aaf4557237",
  "0xa5cc3e44ed97f8c94df27822c85303a3bd4e8134",
  "0x7aebc630f301f15baddf160103dc3bd8f9baf043",
  "0x487663784c77ba56e32d9fe60485d93c4c319385",
];

// ── Types ────────────────────────────────────────────────────────────────────

export interface ProgressEvent {
  phase:   string;
  chain?:  string;
  pct:     number;
  msg:     string;
  type:    "progress" | "engine-result" | "wallet-result" | "done" | "error";
  data?:   unknown;
}

export interface ChainReport {
  chain:       string;
  url:         string;
  id:          string;
  riskScore:   number;
  nodeIntel:   unknown;
  adminScan:   unknown;
  batchDos:    unknown;
  callAbuse:   unknown;
  mempool:     unknown;
  criticalFindings: string[];
  highFindings:     string[];
  elapsedMs:   number;
  error?:      string;
}

export interface WalletReport {
  address:     string;
  nonceGap:    unknown;
  findings:    { severity: string; title: string; detail: string }[];
  riskScore:   number;
}

export interface AutonomousReport {
  generatedAt:    string;
  scanDurationMs: number;
  totalChains:    number;
  totalWallets:   number;
  overallRisk:    number;
  criticalCount:  number;
  highCount:      number;
  mediumCount:    number;
  chains:         ChainReport[];
  wallets:        WalletReport[];
  topFindings:    { severity: string; chain?: string; wallet?: string; title: string; detail: string }[];
  summary:        string;
}

// ── Severity helpers ─────────────────────────────────────────────────────────

function extractChainFindings(chainReport: Partial<ChainReport>): { critical: string[]; high: string[] } {
  const critical: string[] = [];
  const high: string[] = [];

  const admin = chainReport.adminScan as any;
  if (admin?.criticalExposed?.length) {
    admin.criticalExposed.forEach((m: any) => critical.push(`Admin method exposed: ${m.method} — ${m.attackVector ?? "privilege escalation"}`));
  }
  if (admin?.highExposed?.length) {
    admin.highExposed.forEach((m: any) => high.push(`Privileged method exposed: ${m.method} — ${m.attackVector ?? "data leak"}`));
  }

  const batch = chainReport.batchDos as any;
  if (batch?.riskScore >= 80) critical.push(`Batch DoS: unlimited batching accepted (${batch.batchLimitDetected ?? "no cap"}) — amplification attack vector`);
  else if (batch?.riskScore >= 50) high.push(`Batch DoS: high amplification ratio detected (risk ${batch.riskScore}/100)`);

  const call = chainReport.callAbuse as any;
  if (call?.probes) {
    const accepted = (call.probes as any[]).filter(p => p.accepted && p.severity === "critical");
    if (accepted.length) critical.push(`eth_call abuse: ${accepted.length} critical probe(s) accepted (${accepted.map((p:any)=>p.id).join(", ")})`);
  }

  const mempool = chainReport.mempool as any;
  if (mempool?.frontRunnableCount > 1000) high.push(`Mempool: ${mempool.frontRunnableCount.toLocaleString()} front-runnable DEX swaps exposed in txpool`);

  const intel = chainReport.nodeIntel as any;
  if (intel?.exposedModules?.includes("eth_accounts")) critical.push(`Node: eth_accounts module exposed — potential wallet enumeration`);
  if (intel?.exposedModules?.includes("txpool")) high.push(`Node: txpool module public — transaction ordering attacks possible`);

  return { critical, high };
}

// ── Main orchestrator ────────────────────────────────────────────────────────

export async function runAutonomousReport(
  onProgress: (evt: ProgressEvent) => void,
): Promise<AutonomousReport> {
  const t0 = Date.now();
  let pct = 0;
  const chainReports: ChainReport[] = [];
  const walletReports: WalletReport[] = [];

  const totalSteps = AUTO_CHAINS.length * 5 + 1; // 5 engines × N chains + wallet scan
  const stepPct = 90 / totalSteps;

  // ── Phase 1: RPC Engine Scans (all chains, all 5 engines in parallel per chain) ──
  onProgress({ type: "progress", phase: "init", pct: 2, msg: `Starting autonomous scan — ${AUTO_CHAINS.length} chains × 5 engines + ${AUTO_WALLETS.length} wallets` });

  await Promise.allSettled(
    AUTO_CHAINS.map(async ({ chain, url, id }, ci) => {
      const chainT0 = Date.now();
      onProgress({ type: "progress", phase: "rpc-engines", chain, pct: Math.round(pct + ci * stepPct), msg: `[${chain}] Running all 5 engines in parallel…` });

      let nodeIntel: unknown = null;
      let adminScan: unknown = null;
      let batchDos:  unknown = null;
      let callAbuse: unknown = null;
      let mempool:   unknown = null;

      const [niRes, asRes, bdRes, caRes, mpRes] = await Promise.allSettled([
        runNodeIntel(url),
        runAdminScan(url),
        runBatchDosTest(url),
        runCallAbuseTest(url),
        snapshotMempool(url),
      ]);

      if (niRes.status === "fulfilled") nodeIntel = niRes.value;
      if (asRes.status === "fulfilled") adminScan = asRes.value;
      if (bdRes.status === "fulfilled") batchDos  = bdRes.value;
      if (caRes.status === "fulfilled") callAbuse = caRes.value;
      if (mpRes.status === "fulfilled") mempool   = mpRes.value;

      const partial: Partial<ChainReport> = { chain, url, id, nodeIntel, adminScan, batchDos, callAbuse, mempool };
      const { critical, high } = extractChainFindings(partial);

      // Composite risk score
      const adminScore = (adminScan as any)?.riskScore ?? 0;
      const batchScore = (batchDos  as any)?.riskScore ?? 0;
      const callScore  = (callAbuse as any)?.riskScore ?? 0;
      const mempoolExp = (mempool   as any)?.frontRunnableCount > 500 ? 40 : 20;
      const riskScore  = Math.min(100, Math.round((adminScore * 0.35 + batchScore * 0.25 + callScore * 0.2 + mempoolExp * 0.2)));

      const report: ChainReport = {
        chain, url, id, riskScore,
        nodeIntel, adminScan, batchDos, callAbuse, mempool,
        criticalFindings: critical,
        highFindings:     high,
        elapsedMs: Date.now() - chainT0,
      };

      chainReports.push(report);
      pct = Math.min(88, pct + stepPct * 5);

      onProgress({
        type: "engine-result",
        phase: "rpc-engines",
        chain,
        pct: Math.round(pct),
        msg: `[${chain}] Done — risk ${riskScore}/100 · ${critical.length} critical · ${high.length} high`,
        data: report,
      });
    }),
  );

  // ── Phase 2: Wallet Scans ────────────────────────────────────────────────
  onProgress({ type: "progress", phase: "wallets", pct: 89, msg: `Scanning ${AUTO_WALLETS.length} wallets (nonce gaps, replay, EIP-7702)…` });

  try {
    const nonceResult = await scanNonceBatch(AUTO_WALLETS, "https://ethereum.publicnode.com");

    for (const addr of AUTO_WALLETS) {
      const nonceData = (nonceResult as any)?.results?.find((r: any) => r.address?.toLowerCase() === addr.toLowerCase());
      const findings: WalletReport["findings"] = [];

      if (nonceData) {
        (nonceData.findings ?? []).forEach((f: any) => {
          findings.push({ severity: f.severity, title: f.title, detail: f.description ?? f.detail ?? "" });
        });
      }

      const riskScore = findings.filter(f => f.severity === "critical").length > 0 ? 100
        : findings.filter(f => f.severity === "high").length > 0 ? 75
        : findings.filter(f => f.severity === "medium").length > 0 ? 40
        : findings.length > 0 ? 15 : 0;

      walletReports.push({ address: addr, nonceGap: nonceData, findings, riskScore });
    }
  } catch (e) {
    AUTO_WALLETS.forEach(addr => walletReports.push({ address: addr, nonceGap: null, findings: [], riskScore: 0 }));
  }

  onProgress({ type: "wallet-result", phase: "wallets", pct: 94, msg: `Wallet scan complete — ${walletReports.filter(w => w.findings.length).length} wallets with findings`, data: walletReports });

  // ── Phase 3: Aggregate ───────────────────────────────────────────────────
  onProgress({ type: "progress", phase: "aggregate", pct: 96, msg: "Aggregating all findings into final report…" });

  // Sort chains by risk
  chainReports.sort((a, b) => b.riskScore - a.riskScore);

  const allCritical = chainReports.flatMap(c => c.criticalFindings.map(f => ({ severity: "critical", chain: c.chain, title: f, detail: "" })));
  const allHigh     = chainReports.flatMap(c => c.highFindings.map(f => ({ severity: "high", chain: c.chain, title: f, detail: "" })));
  const walletFinds = walletReports.flatMap(w => w.findings.filter(f => f.severity !== "info").map(f => ({ ...f, wallet: w.address })));

  const topFindings = [
    ...allCritical,
    ...allHigh,
    ...walletFinds.filter(f => f.severity === "critical"),
    ...walletFinds.filter(f => f.severity === "high"),
  ].slice(0, 50);

  const criticalCount = allCritical.length + walletFinds.filter(f => f.severity === "critical").length;
  const highCount     = allHigh.length + walletFinds.filter(f => f.severity === "high").length;
  const mediumCount   = chainReports.flatMap(c => ((c.callAbuse as any)?.probes ?? []).filter((p:any) => p.severity === "medium")).length;
  const overallRisk   = Math.min(100, Math.round(chainReports.reduce((s, c) => s + c.riskScore, 0) / (chainReports.length || 1)));

  const report: AutonomousReport = {
    generatedAt:    new Date().toISOString(),
    scanDurationMs: Date.now() - t0,
    totalChains:    chainReports.length,
    totalWallets:   walletReports.length,
    overallRisk,
    criticalCount,
    highCount,
    mediumCount,
    chains:         chainReports,
    wallets:        walletReports,
    topFindings,
    summary: `Autonomous scan completed in ${((Date.now() - t0) / 1000).toFixed(1)}s. `
      + `Scanned ${chainReports.length} chains and ${walletReports.length} wallets. `
      + `Found ${criticalCount} critical, ${highCount} high, and ${mediumCount} medium severity issues. `
      + `Highest-risk chain: ${chainReports[0]?.chain ?? "N/A"} (${chainReports[0]?.riskScore ?? 0}/100). `
      + `${walletReports.filter(w => w.riskScore > 0).length} wallets have security findings.`,
  };

  onProgress({ type: "done", phase: "complete", pct: 100, msg: "Autonomous scan complete.", data: report });
  return report;
}
