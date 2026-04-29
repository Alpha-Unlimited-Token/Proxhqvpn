/**
 * Unified Blockchain Scanner Orchestrator
 * ══════════════════════════════════════════
 * Runs all three scanning modules in sequence, feeding each module's
 * output into the next so findings compound across passes.
 *
 * Pipeline:
 *
 *   ┌─────────────────────────────────────────────────────┐
 *   │  Phase 1 (parallel)                                 │
 *   │   ├── ECDSA Bulk Scan  ──┐                          │
 *   │   └── Threat Scanner  ──┤→ combined seed + findings │
 *   └────────────────────────┬─┘                          │
 *                            │                            │
 *   Phase 2: Spider Wave 0 ──┘                            │
 *   (seeds = original targets + high-risk from threat scan)│
 *                            │                            │
 *   Phase 3: Spider Wave 1+  │                            │
 *   (counterparties of seeds,│freq-filtered)              │
 *                            │                            │
 *   Phase 4: Final ECDSA     │                            │
 *   cross-analysis on all    │                            │
 *   spider-harvested sigs    │                            │
 *                            │                            │
 *   Phase 5: Merge + Report ─┘                            │
 *   (deduplicated, ranked, cross-referenced)              │
 *   └─────────────────────────────────────────────────────┘
 *
 * State is persisted to disk after every phase so the run can be
 * resumed if interrupted.
 */

import fs   from "fs";
import path from "path";
import { logger }            from "./logger";
import { bulkScanViaBigQuery, isBigQueryConfigured } from "./ecdsa-analyzer/bigquery-scanner";
import { runThreatScan, type ThreatScanSummary }     from "./threat-scanner/threat-scanner";
import { KnowledgeStore }                            from "./spider/knowledge-store";
import { runSpider, buildSpiderReport, DEFAULT_CONFIG } from "./spider/blockchain-spider";
import type { WalletScanResult }                     from "./ecdsa-analyzer/nonce-recovery";

// ── Types ─────────────────────────────────────────────────────────────────────

export type UnifiedPhase =
  | "idle"
  | "phase1_ecdsa_threat"
  | "phase2_spider_wave0"
  | "phase3_spider_expand"
  | "phase4_final_analysis"
  | "phase5_merge"
  | "complete"
  | "error";

export interface PhaseResult {
  phase:        UnifiedPhase;
  startedAt:    string;
  completedAt?: string;
  durationMs?:  number;
  summary:      string;
  stats:        Record<string, number>;
}

export interface UnifiedScanState {
  runId:           string;
  startedAt:       string;
  completedAt?:    string;
  currentPhase:    UnifiedPhase;
  phasesCompleted: UnifiedPhase[];
  phaseResults:    PhaseResult[];
  running:         boolean;
  error?:          string;
  seedCount:       number;
  config:          UnifiedScanConfig;
  log:             string[];
}

export interface UnifiedFinding {
  source:       "ecdsa" | "threat" | "spider";
  type:         string;
  severity:     "info" | "low" | "medium" | "high" | "critical";
  address:      string;
  title:        string;
  detail:       string;
  txHashes?:    string[];
  extra?:       Record<string, unknown>;
  timestamp:    string;
}

export interface UnifiedReport {
  state:           UnifiedScanState;
  totalAddresses:  number;
  totalSignatures: number;
  findings:        UnifiedFinding[];
  recoveredKeys:   Array<{ address: string; privateKey: string; method: string }>;
  publicKeys:      Record<string, string>;
  topRiskAddresses: Array<{
    address:      string;
    riskScore:    number;
    sources:      string[];
    findings:     number;
    ensName?:     string;
  }>;
  moduleStats: {
    ecdsa:   Record<string, number>;
    threat:  Record<string, number>;
    spider:  Record<string, number>;
  };
}

export interface UnifiedScanConfig {
  skipEcdsa:      boolean;
  skipThreat:     boolean;
  skipSpider:     boolean;
  spiderMaxWave:  number;
  spiderConcurrency: number;
  spiderMinFreq:  number;
  maxAddresses:   number;
}

export const DEFAULT_UNIFIED_CONFIG: UnifiedScanConfig = {
  skipEcdsa:      false,
  skipThreat:     false,
  skipSpider:     false,
  spiderMaxWave:  2,
  spiderConcurrency: 8,
  spiderMinFreq:  2,
  maxAddresses:   50_000,
};

// ── UnifiedScanner class ──────────────────────────────────────────────────────

export class UnifiedScanner {
  private stateFile:  string;
  private reportFile: string;
  private state:      UnifiedScanState;
  private store:      KnowledgeStore;

  constructor(private baseDir: string) {
    fs.mkdirSync(baseDir, { recursive: true });
    this.stateFile  = path.join(baseDir, "unified-state.json");
    this.reportFile = path.join(baseDir, "unified-report.json");
    this.store      = new KnowledgeStore(baseDir);
    this.state      = this.makeInitialState();
  }

  private makeInitialState(): UnifiedScanState {
    return {
      runId:           `run-${Date.now()}`,
      startedAt:       new Date().toISOString(),
      currentPhase:    "idle",
      phasesCompleted: [],
      phaseResults:    [],
      running:         false,
      seedCount:       0,
      config:          DEFAULT_UNIFIED_CONFIG,
      log:             [],
    };
  }

  // ── State persistence ─────────────────────────────────────────────────────

  loadState(): boolean {
    try {
      if (fs.existsSync(this.stateFile)) {
        this.state = JSON.parse(fs.readFileSync(this.stateFile, "utf8")) as UnifiedScanState;
        this.store.load();
        return true;
      }
    } catch {}
    return false;
  }

  private saveState(): void {
    try {
      fs.writeFileSync(this.stateFile, JSON.stringify(this.state, null, 2));
    } catch (err) {
      logger.error({ err }, "Unified scanner: failed to save state");
    }
  }

  private log(msg: string): void {
    const line = `[${new Date().toISOString()}] ${msg}`;
    this.state.log.push(line);
    if (this.state.log.length > 500) this.state.log.shift();
    logger.info(msg);
  }

  reset(): void {
    this.store.reset();
    this.state = this.makeInitialState();
    for (const f of [this.stateFile, this.reportFile]) {
      try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch {}
    }
  }

  getState(): UnifiedScanState {
    return { ...this.state };
  }

  hasReport(): boolean {
    return fs.existsSync(this.reportFile);
  }

  loadReport(): UnifiedReport | null {
    try {
      if (!this.hasReport()) return null;
      return JSON.parse(fs.readFileSync(this.reportFile, "utf8")) as UnifiedReport;
    } catch { return null; }
  }

  // ── Phase helpers ─────────────────────────────────────────────────────────

  private startPhase(phase: UnifiedPhase, summary: string): PhaseResult {
    const r: PhaseResult = { phase, startedAt: new Date().toISOString(), summary, stats: {} };
    this.state.currentPhase = phase;
    this.state.phaseResults.push(r);
    this.log(`=== Phase: ${phase} — ${summary} ===`);
    this.saveState();
    return r;
  }

  private endPhase(result: PhaseResult, stats: Record<string, number>): void {
    result.completedAt = new Date().toISOString();
    result.durationMs  = Date.now() - new Date(result.startedAt).getTime();
    result.stats       = stats;
    this.state.phasesCompleted.push(result.phase);
    this.log(`Phase ${result.phase} complete in ${(result.durationMs / 1000).toFixed(1)}s — ${JSON.stringify(stats)}`);
    this.saveState();
  }

  // ── Main orchestration ────────────────────────────────────────────────────

  async run(
    seeds:  string[],
    config: UnifiedScanConfig = DEFAULT_UNIFIED_CONFIG,
    onProgress?: (state: UnifiedScanState) => void,
  ): Promise<void> {
    if (this.state.running) {
      this.log("Already running — ignoring duplicate start");
      return;
    }

    this.state.running    = true;
    this.state.startedAt  = new Date().toISOString();
    this.state.seedCount  = seeds.length;
    this.state.config     = config;
    this.state.error      = undefined;
    this.state.phasesCompleted = [];
    this.state.phaseResults    = [];
    this.state.log             = [];
    this.saveState();

    const notify = () => onProgress?.(this.getState());

    // Storage for cross-module data
    let ecdsaResults:   WalletScanResult[]  = [];
    let threatSummary:  ThreatScanSummary | null = null;
    let extraSpiderSeeds: string[] = [];

    try {
      // ══════════════════════════════════════════════════════════════════════
      // PHASE 1: ECDSA bulk scan + Threat scan — run in parallel
      // ══════════════════════════════════════════════════════════════════════
      if (!config.skipEcdsa || !config.skipThreat) {
        const p1 = this.startPhase("phase1_ecdsa_threat", "ECDSA nonce-reuse analysis + multi-vector threat scan (parallel)");
        notify();

        const tasks: Promise<void>[] = [];
        let ecdsaDone = 0, ecdsaVuln = 0, ecdsaKeys = 0;
        let threatCritical = 0, threatHigh = 0, threatFindings = 0;

        if (!config.skipEcdsa) {
          tasks.push(
            bulkScanViaBigQuery(
              seeds,
              (done, total) => {
                ecdsaDone = done;
                this.log(`ECDSA: ${done}/${total} addresses`);
                notify();
              },
              (result) => {
                if (result.hasVulnerability) ecdsaVuln++;
                if ((result.recoveredKeys?.length ?? 0) > 0) ecdsaKeys++;
                ecdsaResults.push(result);
              },
              true, // skip ENS — spider handles ENS
            ).then(results => {
              ecdsaResults = results;
              this.log(`ECDSA complete: ${ecdsaVuln} vulnerable, ${ecdsaKeys} keys recovered from ${results.length} addresses`);
            }).catch(err => {
              this.log(`ECDSA phase error (continuing): ${String(err)}`);
            }),
          );
        }

        if (!config.skipThreat) {
          tasks.push(
            runThreatScan(seeds, (phase, pct) => {
              this.log(`Threat: ${phase} (${pct}%)`);
              notify();
            }).then(summary => {
              threatSummary = summary;
              threatCritical = summary.riskBreakdown.critical ?? 0;
              threatHigh     = summary.riskBreakdown.high ?? 0;
              threatFindings = summary.topFindings.length;
              this.log(`Threat scan complete: ${threatCritical} critical, ${threatHigh} high, ${threatFindings} top findings`);

              // Feed high-risk addresses into spider seeds for deeper analysis
              extraSpiderSeeds = summary.highRiskAddresses.map(p => p.address);
              this.log(`Threat scan → ${extraSpiderSeeds.length} high-risk addresses queued as extra spider seeds`);
            }).catch(err => {
              this.log(`Threat scan error (continuing): ${String(err)}`);
            }),
          );
        }

        await Promise.all(tasks);
        this.endPhase(p1, {
          ecdsaAddresses: ecdsaResults.length,
          ecdsaVulnerable: ecdsaVuln,
          ecdsaKeysRecovered: ecdsaKeys,
          threatCritical,
          threatHigh,
          threatFindings,
          extraSpiderSeeds: extraSpiderSeeds.length,
        });
        notify();
      }

      // ══════════════════════════════════════════════════════════════════════
      // PHASE 2: Spider wave 0 — seed addresses + threat-identified hot spots
      // ══════════════════════════════════════════════════════════════════════
      if (!config.skipSpider) {
        const p2 = this.startPhase("phase2_spider_wave0", `Spider wave 0 — crawling ${seeds.length} seeds + ${extraSpiderSeeds.length} threat-flagged addresses`);
        notify();

        // Merge seeds with threat scan extras (dedup)
        const allSeeds = [...new Set([...seeds, ...extraSpiderSeeds])];
        this.log(`Spider seeds total: ${allSeeds.length}`);

        this.store.load();

        let spiderEvents = 0;
        await runSpider(
          this.store,
          allSeeds,
          {
            ...DEFAULT_CONFIG,
            maxWave:        config.spiderMaxWave,
            maxAddresses:   config.maxAddresses,
            concurrency:    config.spiderConcurrency,
            minFrequency:   config.spiderMinFreq,
            resumeIfExists: false,
          },
          (event) => {
            spiderEvents++;
            this.log(`Spider [${event.phase}] wave=${event.wave} visited=${event.visited} sigs=${event.signatures} keys=${event.publicKeys} — ${event.message}`);
            notify();
          },
        );

        const spiderState = this.store.getState();
        this.endPhase(p2, {
          addressesVisited: spiderState.totalVisited,
          signaturesHarvested: spiderState.totalSignatures,
          findingsFromSpider: spiderState.totalFindings,
          publicKeysExtracted: this.store.getPublicKeyMap().size,
          eventsEmitted: spiderEvents,
        });
        notify();
      }

      // ══════════════════════════════════════════════════════════════════════
      // PHASE 3: ECDSA nonce-reuse on spider-discovered addresses
      //  — runs on newly found addresses not in original seed set
      // ══════════════════════════════════════════════════════════════════════
      if (!config.skipEcdsa && !config.skipSpider) {
        const p3 = this.startPhase("phase4_final_analysis", "ECDSA cross-analysis on spider-discovered addresses");
        notify();

        // Find addresses the spider discovered that weren't in the original seed list
        const seedSet = new Set(seeds.map(a => a.toLowerCase()));
        const topDiscovered = this.store
          .getTopAddressesByFreq(500)
          .filter(m => !seedSet.has(m.address) && m.sigCount >= 2)
          .map(m => m.address);

        this.log(`Running ECDSA analysis on ${topDiscovered.length} spider-discovered addresses (≥2 sigs, top by frequency)`);

        let newVuln = 0, newKeys = 0;
        if (topDiscovered.length > 0) {
          await bulkScanViaBigQuery(
            topDiscovered,
            (done, total) => {
              this.log(`ECDSA phase 2: ${done}/${total}`);
              notify();
            },
            (result) => {
              if (result.hasVulnerability) newVuln++;
              if ((result.recoveredKeys?.length ?? 0) > 0) newKeys++;
            },
            true,
          ).catch(err => {
            this.log(`ECDSA phase 2 error (continuing): ${String(err)}`);
          });
        }

        this.endPhase(p3, {
          discoveredAddressesScanned: topDiscovered.length,
          newVulnerabilities: newVuln,
          newKeysRecovered: newKeys,
        });
        notify();
      }

      // ══════════════════════════════════════════════════════════════════════
      // PHASE 4: Merge + unified report
      // ══════════════════════════════════════════════════════════════════════
      const p4 = this.startPhase("phase5_merge", "Building unified report — merging all module findings");
      notify();

      const report = this.buildUnifiedReport(seeds, ecdsaResults, threatSummary);
      fs.writeFileSync(this.reportFile, JSON.stringify(report, null, 2));

      this.endPhase(p4, {
        totalFindings:   report.findings.length,
        recoveredKeys:   report.recoveredKeys.length,
        topRiskAddresses: report.topRiskAddresses.length,
      });

      this.state.currentPhase  = "complete";
      this.state.completedAt   = new Date().toISOString();
      this.state.running       = false;
      this.log(`=== UNIFIED SCAN COMPLETE === findings=${report.findings.length} keys=${report.recoveredKeys.length} addresses=${report.totalAddresses}`);
      this.saveState();
      notify();

    } catch (err) {
      this.state.currentPhase = "error";
      this.state.error        = String(err);
      this.state.running      = false;
      this.log(`FATAL ERROR: ${String(err)}`);
      this.saveState();
      notify();
      throw err;
    }
  }

  // ── Unified report builder ────────────────────────────────────────────────

  private buildUnifiedReport(
    seeds:        string[],
    ecdsaResults: WalletScanResult[],
    threat:       ThreatScanSummary | null,
  ): UnifiedReport {
    const findings: UnifiedFinding[] = [];

    // ── From ECDSA ──────────────────────────────────────────────────────────
    const ecdsaStats: Record<string, number> = {
      totalAddresses: ecdsaResults.length,
      vulnerable: 0, keysRecovered: 0, nonceReusePairs: 0,
    };
    const recoveredKeys: UnifiedReport["recoveredKeys"] = [];

    for (const r of ecdsaResults) {
      if (r.hasVulnerability) ecdsaStats.vulnerable++;

      // Nonce reuse pairs
      for (const pair of r.nonceReusePairs ?? []) {
        ecdsaStats.nonceReusePairs++;
        findings.push({
          source:    "ecdsa",
          type:      "nonce_reuse",
          severity:  "critical",
          address:   r.address,
          title:     "ECDSA nonce reuse detected",
          detail:    `Identical r-value in transactions ${pair.tx1.hash.slice(0,14)}… and ${pair.tx2.hash.slice(0,14)}…`,
          txHashes:  [pair.tx1.hash, pair.tx2.hash],
          extra:     { r: pair.r },
          timestamp: new Date().toISOString(),
        });
      }

      // Recovered private keys
      for (const key of r.recoveredKeys ?? []) {
        ecdsaStats.keysRecovered++;
        recoveredKeys.push({ address: r.address, privateKey: key, method: "ecdsa-nonce-reuse" });
        findings.push({
          source:    "ecdsa",
          type:      "private_key_recovered",
          severity:  "critical",
          address:   r.address,
          title:     "Private key recovered via ECDSA nonce reuse",
          detail:    `Full secp256k1 private key derived from duplicate nonce. Wallet is fully compromised.`,
          extra:     { privateKey: key },
          timestamp: new Date().toISOString(),
        });
      }

      // Advanced findings (signature bias, weak-k, etc.)
      for (const af of r.advancedFindings ?? []) {
        findings.push({
          source:    "ecdsa",
          type:      af.type,
          severity:  af.severity as UnifiedFinding["severity"],
          address:   r.address,
          title:     af.title,
          detail:    af.detail,
          txHashes:  af.txHashes,
          timestamp: new Date().toISOString(),
        });
      }
    }

    // ── From Threat Scan ───────────────────────────────────────────────────
    const threatStats: Record<string, number> = {
      critical: 0, high: 0, medium: 0, topFindings: 0,
    };
    if (threat) {
      threatStats.critical   = threat.riskBreakdown.critical ?? 0;
      threatStats.high       = threat.riskBreakdown.high ?? 0;
      threatStats.medium     = threat.riskBreakdown.medium ?? 0;
      threatStats.topFindings = threat.topFindings.length;

      for (const profile of threat.highRiskAddresses) {
        for (const f of profile.findings) {
          findings.push({
            source:    "threat",
            type:      f.category,
            severity:  f.severity,
            address:   profile.address,
            title:     f.title,
            detail:    f.detail,
            txHashes:  f.txHash ? [f.txHash] : undefined,
            extra:     {
              counterpartyName: f.counterpartyName,
              valueETH:         f.valueETH,
              lossUSD:          f.lossUSD,
            },
            timestamp: f.timestamp ?? new Date().toISOString(),
          });
        }
      }
    }

    // ── From Spider ────────────────────────────────────────────────────────
    const spiderReport  = buildSpiderReport(this.store);
    const spiderStats: Record<string, number> = {
      addressesVisited:  spiderReport.state.totalVisited,
      signaturesHarvested: spiderReport.state.totalSignatures,
      nonceReuseFindings: spiderReport.nonceReuseCount,
      rCollisionFindings: spiderReport.rCollisionCount,
      publicKeysExtracted: Object.keys(spiderReport.publicKeys).length,
    };

    for (const f of spiderReport.findings) {
      // Avoid duplicating keys already found by ECDSA scan
      if (f.type === "nonce_reuse" && findings.some(e => e.source === "ecdsa" && e.address === f.address)) continue;
      findings.push({
        source:    "spider",
        type:      f.type,
        severity:  f.severity as UnifiedFinding["severity"],
        address:   f.address,
        title:     `Spider: ${f.type.replace(/_/g, " ")}`,
        detail:    f.detail,
        txHashes:  f.txHashes,
        extra:     f.extra as Record<string, unknown>,
        timestamp: f.timestamp,
      });
    }

    // Add spider-recovered keys
    for (const key of spiderReport.recoveredKeys) {
      if (!recoveredKeys.some(r => r.privateKey === key)) {
        const addr = spiderReport.findings.find(f => (f.extra as any)?.recoveredKey === key)?.address ?? "unknown";
        recoveredKeys.push({ address: addr, privateKey: key, method: "spider-nonce-reuse" });
      }
    }

    // ── Deduplicate findings ───────────────────────────────────────────────
    const seen = new Set<string>();
    const deduped = findings.filter(f => {
      const key = `${f.source}:${f.type}:${f.address}:${f.txHashes?.[0] ?? f.title}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // ── Build top-risk address list ────────────────────────────────────────
    const addrScores = new Map<string, { score: number; sources: Set<string>; count: number; ens?: string }>();

    const severityWeight = { critical: 80, high: 40, medium: 20, low: 8, info: 2 };
    for (const f of deduped) {
      const a = f.address.toLowerCase();
      const e = addrScores.get(a) ?? { score: 0, sources: new Set(), count: 0 };
      e.score += severityWeight[f.severity] ?? 0;
      e.sources.add(f.source);
      e.count++;
      addrScores.set(a, e);
    }
    // Also pull ENS from spider store
    const topRiskAddresses = [...addrScores.entries()]
      .sort(([, a], [, b]) => b.score - a.score)
      .slice(0, 100)
      .map(([address, data]) => ({
        address,
        riskScore: Math.min(100, data.score),
        sources:   [...data.sources],
        findings:  data.count,
        ensName:   this.store.getEns(address),
      }));

    // Final sort of all findings: severity desc, then source
    const sevOrder = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };
    deduped.sort((a, b) => (sevOrder[b.severity] ?? 0) - (sevOrder[a.severity] ?? 0));

    return {
      state:          this.getState(),
      totalAddresses: seeds.length,
      totalSignatures: spiderReport.state.totalSignatures,
      findings:       deduped,
      recoveredKeys,
      publicKeys:     spiderReport.publicKeys,
      topRiskAddresses,
      moduleStats: {
        ecdsa:  ecdsaStats,
        threat: threatStats,
        spider: spiderStats,
      },
    };
  }
}
