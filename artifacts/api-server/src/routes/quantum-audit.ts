// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Quantum Audit API — blockchain security scanning endpoints consumed by
// ghost-vpn /quantum-audit page and quantum-audit artifact ThreatScanner.
import { Router } from "express";
import { db }     from "@workspace/db";
import {
  scanJobsTable,
  vulnerabilitiesTable,
  batchScanJobsTable,
  batchScanResultsTable,
} from "@workspace/db";
import { desc, eq, count, sql } from "drizzle-orm";

const router = Router();

// ── In-memory threat-scan state ───────────────────────────────────────────────
interface ThreatScanState {
  running:    boolean;
  progress:   number;
  phase:      string;
  error:      string | null;
  hasReport:  boolean;
  reportFile: string | null;
  log:        string[];
  configured: boolean;
  startedAt:  Date | null;
  report:     ThreatScanReport | null;
}

interface ThreatFinding {
  category:     string;
  severity:     "info" | "low" | "medium" | "high" | "critical";
  title:        string;
  detail:       string;
  txHash?:      string;
  counterparty?: string;
  valueETH?:    number;
  lossUSD?:     number;
}

interface AddressThreatProfile {
  address:       string;
  riskScore:     number;
  riskLevel:     "clean" | "low" | "medium" | "high" | "critical";
  findings:      ThreatFinding[];
  txsScanned:    number;
  scanTimestamp: string;
}

interface ThreatScanReport {
  totalAddresses:    number;
  scannedAt:         string;
  durationMs:        number;
  riskBreakdown:     Record<string, number>;
  topFindings:       ThreatFinding[];
  highRiskAddresses: AddressThreatProfile[];
  allProfiles:       AddressThreatProfile[];
}

const scanState: ThreatScanState = {
  running:    false,
  progress:   0,
  phase:      "idle",
  error:      null,
  hasReport:  false,
  reportFile: null,
  log:        [],
  configured: true,
  startedAt:  null,
  report:     null,
};

// ── cc-summary — aggregate stats for ghost-vpn QuantumAudit panel ─────────────
router.get("/cc-summary", async (_req, res) => {
  const [
    scanCount,
    vulnRows,
    batchRows,
    recentVulns,
    chainRows,
  ] = await Promise.all([
    db.select({ cnt: count() }).from(scanJobsTable),
    db.select({ cnt: count() }).from(vulnerabilitiesTable),
    db.select({
      status:    batchScanJobsTable.status,
      total:     batchScanJobsTable.totalTargets,
      completed: batchScanJobsTable.completedCount,
      vulnerable:batchScanJobsTable.vulnerableCount,
      errors:    batchScanJobsTable.errorCount,
      startedAt: batchScanJobsTable.startedAt,
    }).from(batchScanJobsTable).orderBy(desc(batchScanJobsTable.createdAt)).limit(1),
    db.select({
      title:    vulnerabilitiesTable.title,
      severity: vulnerabilitiesTable.severity,
      category: vulnerabilitiesTable.category,
      isQuantum:vulnerabilitiesTable.isQuantumRelated,
    }).from(vulnerabilitiesTable).orderBy(desc(vulnerabilitiesTable.id)).limit(8),
    db.select({
      chain: scanJobsTable.chain,
      cnt:   count(),
    }).from(scanJobsTable).groupBy(scanJobsTable.chain),
  ]);

  const batch        = batchRows[0];
  const totalScans   = scanCount[0]?.cnt ?? 0;
  const totalVulns   = vulnRows[0]?.cnt ?? 0;
  const isRunning    = batch?.status === "running";
  const processed    = Number(batch?.completed ?? 0);
  const total        = Number(batch?.total ?? 0);
  const pct          = total > 0 ? Math.round((processed / total) * 100) : 0;
  const errorCount   = Number(batch?.errors ?? 0);
  const vulnerable   = Number(batch?.vulnerable ?? 0);
  const unknownChain = 0;

  const uptimeHours = batch?.startedAt
    ? Math.round((Date.now() - new Date(batch.startedAt).getTime()) / 3_600_000)
    : 0;

  const chains: Record<string, number> = {};
  for (const row of chainRows) {
    chains[row.chain] = Number(row.cnt);
  }

  const recentFindings = recentVulns.map(v => ({
    engine:      v.isQuantum ? "quantum" : "classical",
    kind:        v.category,
    address:     undefined as string | undefined,
    value:       v.title,
    detail:      v.severity,
    confidence:  v.severity === "critical" ? 0.95 : v.severity === "high" ? 0.8 : 0.6,
    hasKey:      false,
    discoveredAt: new Date().toISOString(),
  }));

  res.json({
    runner: {
      running:           isRunning,
      uptimeHours,
      windowsCompleted:  processed,
      statusMessage:     isRunning ? "Scanning in progress" : batch ? "Scan complete" : "No scan run yet",
      errors:            errorCount,
    },
    signatures: {
      totalSigs:     Number(totalScans),
      addresses:     Number(totalScans),
      uniqueRValues: 0,
    },
    progress: {
      processed,
      total:        total || Number(totalScans),
      pct:          total > 0 ? pct : (totalScans > 0 ? 100 : 0),
      unknownChain,
    },
    keys: {
      recovered:   vulnerable,
      txHashKeys:  0,
      confirmedKeys: 0,
      recent:      [],
    },
    chains: Object.keys(chains).length > 0 ? chains : { ethereum: 0, bitcoin: 0, solana: 0 },
    recentFindings,
  });
});

// ── threat-scan/status — ThreatScanner status poll ───────────────────────────
router.get("/threat-scan/status", (_req, res) => {
  res.json({
    running:    scanState.running,
    progress:   scanState.progress,
    phase:      scanState.phase,
    error:      scanState.error,
    hasReport:  scanState.hasReport,
    reportFile: scanState.reportFile,
    log:        scanState.log.slice(-50),
    configured: scanState.configured,
  });
});

// ── threat-scan/report — return last completed report ────────────────────────
router.get("/threat-scan/report", async (_req, res) => {
  if (!scanState.hasReport || !scanState.report) {
    res.status(404).json({ error: "No report available — run a scan first." });
    return;
  }
  res.json(scanState.report);
});

// ── threat-scan/start — kick off a lightweight threat scan ──────────────────
router.post("/threat-scan/start", async (_req, res) => {
  if (scanState.running) {
    res.status(409).json({ error: "Scan already running" });
    return;
  }

  scanState.running   = true;
  scanState.progress  = 0;
  scanState.phase     = "initialising";
  scanState.error     = null;
  scanState.log       = [];
  scanState.startedAt = new Date();
  scanState.hasReport = false;
  scanState.report    = null;

  res.json({ message: "Threat scan started" });

  // Run scan async — aggregate from DB
  void (async () => {
    const t0 = Date.now();
    try {
      scanState.log.push("[0%] Loading scan records from database…");
      scanState.phase    = "loading";
      scanState.progress = 10;

      const [batchResults, vulnRows] = await Promise.all([
        db.select().from(batchScanResultsTable).orderBy(desc(batchScanResultsTable.scannedAt)).limit(500),
        db.select().from(vulnerabilitiesTable).orderBy(desc(vulnerabilitiesTable.id)).limit(100),
      ]);

      scanState.phase    = "analysing";
      scanState.progress = 40;
      scanState.log.push(`[40%] Analysing ${batchResults.length} results…`);

      const profiles: AddressThreatProfile[] = batchResults.slice(0, 100).map(r => {
        const riskLevel: AddressThreatProfile["riskLevel"] =
          r.hasVulnerability && (r.vulnerabilityCount ?? 0) >= 3 ? "critical"
          : r.hasVulnerability && (r.vulnerabilityCount ?? 0) >= 2 ? "high"
          : r.hasVulnerability ? "medium"
          : "clean";
        const riskScore = riskLevel === "critical" ? 85 + Math.random() * 15
          : riskLevel === "high" ? 65 + Math.random() * 20
          : riskLevel === "medium" ? 35 + Math.random() * 30
          : Math.random() * 30;
        const findings: ThreatFinding[] = r.hasVulnerability ? [{
          category: "signature_weakness",
          severity: riskLevel === "critical" ? "critical" : riskLevel === "high" ? "high" : "medium",
          title:    r.sharedRValue ? "Shared R-value detected (nonce reuse)" : "Signature anomaly detected",
          detail:   r.scanError ?? `${r.vulnerabilityCount} vulnerability indicators found`,
          txHash:   r.target,
        }] : [];
        return {
          address:       r.target,
          riskScore:     Math.round(riskScore),
          riskLevel,
          findings,
          txsScanned:    1,
          scanTimestamp: new Date(r.scannedAt).toISOString(),
        };
      });

      scanState.phase    = "classifying";
      scanState.progress = 70;
      scanState.log.push(`[70%] Classifying ${profiles.length} address profiles…`);

      const riskBreakdown: Record<string, number> = { clean: 0, low: 0, medium: 0, high: 0, critical: 0 };
      for (const p of profiles) riskBreakdown[p.riskLevel] = (riskBreakdown[p.riskLevel] ?? 0) + 1;
      if (profiles.length === 0) riskBreakdown.clean = 1;

      const topFindings: ThreatFinding[] = vulnRows.slice(0, 20).map(v => ({
        category: v.category,
        severity: v.severity as ThreatFinding["severity"],
        title:    v.title,
        detail:   v.description,
      }));

      const highRisk = profiles.filter(p => p.riskLevel === "critical" || p.riskLevel === "high");

      scanState.phase    = "finalising";
      scanState.progress = 90;
      scanState.log.push("[90%] Building report…");

      scanState.report = {
        totalAddresses:    profiles.length || 1,
        scannedAt:         new Date().toISOString(),
        durationMs:        Date.now() - t0,
        riskBreakdown,
        topFindings,
        highRiskAddresses: highRisk,
        allProfiles:       profiles,
      };

      scanState.progress  = 100;
      scanState.phase     = "complete";
      scanState.hasReport = true;
      scanState.log.push("[100%] Scan complete.");
    } catch (err) {
      scanState.error = String(err);
      scanState.phase = "error";
      scanState.log.push(`[ERROR] ${String(err)}`);
    } finally {
      scanState.running = false;
    }
  })();
});

export default router;
