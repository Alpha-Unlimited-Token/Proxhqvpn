/**
 * Autonomous Signature Mining Runner
 * ════════════════════════════════════
 *
 * Self-contained background process that cycles through all 5 engines
 * indefinitely, saving progress every 5 minutes, auto-resuming on restart.
 *
 * Cross-engine wiring (via CrossEnginePool):
 *   E1 → E2  tx-embedded URLs → web spider
 *   E1 → E3  every signing address → OSINT
 *   E1 → E4  nonce-reuse addresses → peel chain
 *   E1 → E4  r-collision addresses → peel chain
 *   E1 → pool raw r/s/z sigs → cross-engine nonce-reuse registry
 *
 *   E2 → E3  derived addresses from found private keys → OSINT
 *   E2 → E4  derived addresses from found private keys → peel chain
 *   E2 → pool rs_pair and full ECDSA sigs → cross-engine nonce registry
 *
 *   E3 → E2  source URLs from every finding → web spider crawl
 *   E3 → E4  derived addresses from private key finds → peel chain
 *   E3 → E1  raw_address / suspicious findings → E1 targeted block scan
 *
 *   E4 → E3  every hop outgoingAddress → OSINT
 *   E4 → E1  nonceReuseAddresses at hops → E1 targeted deep scan
 *   E4 → pool hop r-values → cross-engine nonce registry
 */

import fs   from "fs";
import path from "path";
import { ethers }              from "ethers";
import { logger }              from "../logger";
import { runSignatureMiner }   from "./signature-miner";
import { runWebSigSpider }     from "./web-sig-spider";
import { runOsintSigSpider }   from "./osint-sig-spider";
import { runPeelChainTracer }  from "./peel-chain-tracer";
import {
  getCrossEnginePool,
  resetCrossEnginePool,
  feedE1ToPool,
  feedE2ToPool,
  feedE3ToPool,
  feedE4ToPool,
  drainOsintAddresses,
  drainPeelAddresses,
  drainE1TargetedAddresses,
  drainSpiderUrls,
  drainCrossNonceCandidates,
  poolSummary,
} from "./cross-engine-pool";

// ── Paths ─────────────────────────────────────────────────────────────────────

const CACHE_DIR     = "/home/runner/workspace/proxhq-reports/sig-cache";
const STATE_FILE    = path.join(CACHE_DIR, "autonomous-state.json");
const FINDINGS_FILE = path.join(CACHE_DIR, "autonomous-findings.json");
const LOG_FILE      = path.join(CACHE_DIR, "autonomous-run.log");

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AutonomousFinding {
  engine:      string;
  kind:        string;
  address?:    string;
  privateKey?: string;
  value:       string;
  detail:      string;
  url?:        string;
  txHash?:     string;
  confidence:  number;
  discoveredAt: string;
}

export interface AutonomousState {
  startedAt:            string;
  lastSavedAt:          string;
  lastBlockScanned:     number;
  lowestBlockCovered:   number;
  windowsCompleted:     number;
  osintRunCount:        number;
  peelRunCount:         number;
  hybridRunCount:       number;
  totalFindings:        number;
  recoveredKeys:        string[];
  discoveredAddresses:  string[];
  pendingUrls:          string[];
  pendingPeelAddresses: string[];
  errors:               number;
  rpcBackoffMs:         number;
  running:              boolean;
  pausedAt?:            string;
  statusMessage:        string;
  // Cross-engine telemetry
  crossEngineFlows: {
    e1ToE3: number; e1ToE4: number;
    e2ToE3: number; e2ToE4: number;
    e3ToE2: number; e3ToE4: number; e3ToE1: number;
    e4ToE3: number; e4ToE1: number;
    crossNonceHits: number;
  };
}

export interface AutonomousStatus {
  running:              boolean;
  startedAt:            string | null;
  uptimeHours:          number;
  windowsCompleted:     number;
  totalFindings:        number;
  recoveredKeys:        number;
  lastBlockScanned:     number;
  lowestBlockCovered:   number;
  blocksRemaining:      number;
  osintRuns:            number;
  peelRuns:             number;
  hybridRuns:           number;
  errors:               number;
  pendingUrls:          number;
  statusMessage:        string;
  estimatedBlocksPerHour: number;
  progressPct:          number;
  crossEngineFlows:     AutonomousState["crossEngineFlows"];
  poolStats: {
    osintQueue:    number;
    peelQueue:     number;
    e1Queue:       number;
    urlQueue:      number;
    rValues:       number;
    confirmedKeys: number;
  };
}

// ── Module-level singleton ────────────────────────────────────────────────────

let _state:          AutonomousState | null = null;
let _running         = false;
let _stopRequested   = false;
let _startTime       = 0;
const _recentWindowTimes: number[] = [];
const RPC = process.env.ETH_RPC_URL ?? "https://ethereum.publicnode.com";

// ── Helpers ───────────────────────────────────────────────────────────────────

function ensureDir() {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

function log(msg: string) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  logger.info({ msg }, "AutonomousRunner");
  try { fs.appendFileSync(LOG_FILE, line + "\n"); } catch {}
}

function saveState(findings: AutonomousFinding[]) {
  if (!_state) return;
  ensureDir();
  _state.lastSavedAt = new Date().toISOString();
  _state.totalFindings = findings.length;
  try {
    fs.writeFileSync(STATE_FILE,    JSON.stringify(_state, null, 2));
    fs.writeFileSync(FINDINGS_FILE, JSON.stringify(findings, null, 2));
    log(`State saved — ${findings.length} findings, ${_state.windowsCompleted} windows, block ${_state.lastBlockScanned}`);
  } catch (e) {
    log(`State save error: ${e}`);
  }
}

function loadState(): AutonomousState | null {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const raw = fs.readFileSync(STATE_FILE, "utf-8");
      const s = JSON.parse(raw) as AutonomousState;
      log(`Resuming from saved state — ${s.windowsCompleted} windows, block ${s.lastBlockScanned}`);
      // Ensure crossEngineFlows field exists (for backward-compat with older saves)
      if (!s.crossEngineFlows) {
        s.crossEngineFlows = {
          e1ToE3: 0, e1ToE4: 0, e2ToE3: 0, e2ToE4: 0,
          e3ToE2: 0, e3ToE4: 0, e3ToE1: 0, e4ToE3: 0, e4ToE1: 0,
          crossNonceHits: 0,
        };
      }
      return s;
    }
  } catch {}
  return null;
}

function loadFindings(): AutonomousFinding[] {
  try {
    if (fs.existsSync(FINDINGS_FILE)) {
      return JSON.parse(fs.readFileSync(FINDINGS_FILE, "utf-8")) as AutonomousFinding[];
    }
  } catch {}
  return [];
}

async function sleep(ms: number) {
  return new Promise<void>(r => setTimeout(r, ms));
}

async function withBackoff<T>(
  fn:    () => Promise<T>,
  label: string,
  state: AutonomousState,
): Promise<T | null> {
  let delay = state.rpcBackoffMs;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const result = await fn();
      state.rpcBackoffMs = Math.max(3000, state.rpcBackoffMs - 500);
      return result;
    } catch (e) {
      state.errors++;
      const errMsg = String(e);
      const isRateLimit = errMsg.includes("429") || errMsg.includes("rate") || errMsg.includes("limit");
      if (isRateLimit) state.rpcBackoffMs = Math.min(60_000, state.rpcBackoffMs * 2);
      log(`${label} attempt ${attempt + 1} failed (backoff ${delay}ms): ${errMsg.slice(0, 120)}`);
      await sleep(delay);
      delay = Math.min(60_000, delay * 2);
    }
  }
  log(`${label} — all 4 attempts failed, skipping`);
  return null;
}

// ── Public API ────────────────────────────────────────────────────────────────

export function isRunning(): boolean {
  return _running;
}

export function getAutonomousStatus(): AutonomousStatus {
  const pool = getCrossEnginePool();

  if (!_state) {
    const emptyFlows = {
      e1ToE3: 0, e1ToE4: 0, e2ToE3: 0, e2ToE4: 0,
      e3ToE2: 0, e3ToE4: 0, e3ToE1: 0, e4ToE3: 0, e4ToE1: 0,
      crossNonceHits: 0,
    };
    return {
      running: false, startedAt: null, uptimeHours: 0,
      windowsCompleted: 0, totalFindings: 0, recoveredKeys: 0,
      lastBlockScanned: 0, lowestBlockCovered: 0, blocksRemaining: 0,
      osintRuns: 0, peelRuns: 0, hybridRuns: 0, errors: 0,
      pendingUrls: 0, statusMessage: "Not started",
      estimatedBlocksPerHour: 0, progressPct: 0,
      crossEngineFlows: emptyFlows,
      poolStats: { osintQueue: 0, peelQueue: 0, e1Queue: 0, urlQueue: 0, rValues: 0, confirmedKeys: 0 },
    };
  }

  const uptimeMs    = _startTime ? Date.now() - _startTime : 0;
  const uptimeHours = uptimeMs / 3_600_000;
  const avgWindowMs = _recentWindowTimes.length > 0
    ? _recentWindowTimes.reduce((s, t) => s + t, 0) / _recentWindowTimes.length
    : 60_000;
  const windowsPerHour        = 3_600_000 / avgWindowMs;
  const estimatedBlocksPerHour = Math.round(windowsPerHour * 50);
  const covered    = Math.max(0, _state.lastBlockScanned - _state.lowestBlockCovered);
  const progressPct = Math.min(100, (covered / Math.max(covered, 500_000)) * 100);

  return {
    running:               _running,
    startedAt:             _state.startedAt,
    uptimeHours:           Math.round(uptimeHours * 10) / 10,
    windowsCompleted:      _state.windowsCompleted,
    totalFindings:         _state.totalFindings,
    recoveredKeys:         _state.recoveredKeys.length,
    lastBlockScanned:      _state.lastBlockScanned,
    lowestBlockCovered:    _state.lowestBlockCovered,
    blocksRemaining:       Math.max(0, _state.lowestBlockCovered),
    osintRuns:             _state.osintRunCount,
    peelRuns:              _state.peelRunCount,
    hybridRuns:            _state.hybridRunCount,
    errors:                _state.errors,
    pendingUrls:           _state.pendingUrls.length,
    statusMessage:         _state.statusMessage,
    estimatedBlocksPerHour,
    progressPct:           Math.round(progressPct * 10) / 10,
    crossEngineFlows:      _state.crossEngineFlows,
    poolStats: {
      osintQueue:    pool.pendingOsintAddresses.size,
      peelQueue:     pool.pendingPeelAddresses.size,
      e1Queue:       pool.pendingE1TargetedAddresses.size,
      urlQueue:      pool.pendingSpiderUrls.length,
      rValues:       pool.rValueSigs.size,
      confirmedKeys: pool.confirmedPrivateKeys.size,
    },
  };
}

// Keep legacy export name for existing route code
export { getAutonomousStatus as getStatus };

export function stop() {
  _stopRequested = true;
  if (_state) _state.statusMessage = "Stop requested";
  log("Stop requested by user");
}

// ── Main runner ────────────────────────────────────────────────────────────────

export async function startAutonomousRunner(opts: {
  resumeFromSave?:        boolean;
  windowSize?:            number;
  pauseBetweenWindowsMs?: number;
  pauseBeforeOsintMs?:    number;
  pauseBeforePeelMs?:     number;
  osintEveryNWindows?:    number;
  peelEveryNWindows?:     number;
  hybridEveryNWindows?:   number;
  maxRuntimeMs?:          number;
  githubToken?:           string;
}): Promise<void> {
  if (_running) {
    log("Runner already active — ignoring duplicate start");
    return;
  }

  _running       = true;
  _stopRequested = false;
  _startTime     = Date.now();

  const {
    resumeFromSave        = true,
    windowSize            = 50,
    pauseBetweenWindowsMs = 3_000,
    pauseBeforeOsintMs    = 30_000,
    pauseBeforePeelMs     = 60_000,
    osintEveryNWindows    = 10,
    peelEveryNWindows     = 20,
    hybridEveryNWindows   = 40,
    maxRuntimeMs          = 72 * 3_600_000,
    githubToken,
  } = opts;

  ensureDir();

  // ── Load or create state ──────────────────────────────────────────────────
  let state: AutonomousState;
  let findings: AutonomousFinding[] = [];

  const saved = resumeFromSave ? loadState() : null;
  if (saved) {
    state    = saved;
    findings = loadFindings();
    state.running      = true;
    state.statusMessage = "Resumed from saved state";
  } else {
    resetCrossEnginePool();  // fresh run = fresh pool
    const provider = new ethers.JsonRpcProvider(RPC);
    const latest   = await provider.getBlockNumber();
    state = {
      startedAt:            new Date().toISOString(),
      lastSavedAt:          new Date().toISOString(),
      lastBlockScanned:     latest,
      lowestBlockCovered:   latest,
      windowsCompleted:     0,
      osintRunCount:        0,
      peelRunCount:         0,
      hybridRunCount:       0,
      totalFindings:        0,
      recoveredKeys:        [],
      discoveredAddresses:  [],
      pendingUrls:          [],
      pendingPeelAddresses: [],
      errors:               0,
      rpcBackoffMs:         3_000,
      running:              true,
      statusMessage:        "Starting fresh run",
      crossEngineFlows: {
        e1ToE3: 0, e1ToE4: 0, e2ToE3: 0, e2ToE4: 0,
        e3ToE2: 0, e3ToE4: 0, e3ToE1: 0, e4ToE3: 0, e4ToE1: 0,
        crossNonceHits: 0,
      },
    };
  }
  _state = state;

  const pool = getCrossEnginePool();

  log(`=== Autonomous Runner START (cross-engine wiring active) ===`);
  log(`Starting block: ${state.lastBlockScanned}`);
  log(`Window: ${windowSize} | Pause: ${pauseBetweenWindowsMs}ms | Max: ${maxRuntimeMs/3_600_000}h`);
  log(`OSINT every ${osintEveryNWindows} windows | Peel every ${peelEveryNWindows} | Hybrid every ${hybridEveryNWindows}`);

  let lastSaveTime = Date.now();
  const SAVE_INTERVAL_MS = 5 * 60_000;
  const endTime = _startTime + maxRuntimeMs;

  // ── Main loop ──────────────────────────────────────────────────────────────
  while (!_stopRequested && Date.now() < endTime) {
    const windowStart = state.lowestBlockCovered - windowSize;
    if (windowStart < 0) {
      log("Reached block 0 — wrapping back to latest");
      const provider = new ethers.JsonRpcProvider(RPC);
      const latest = await withBackoff(() => provider.getBlockNumber(), "getBlockNumber", state);
      if (latest) {
        state.lowestBlockCovered = latest;
        state.lastBlockScanned   = latest;
      }
      await sleep(pauseBetweenWindowsMs);
      continue;
    }

    const windowEnd = state.lowestBlockCovered - 1;
    const wStart    = Math.max(0, windowStart);

    // ══════════════════════════════════════════════════════════════════════════
    // ENGINE 1: Block Scanner
    // Inputs from pool: pendingE1TargetedAddresses (from E3 + E4)
    // Outputs to pool:  all signing addresses → E3
    //                   nonce-reuse addresses → E4
    //                   r-collision addresses → E3 + E4
    //                   raw sigs → r-value registry
    //                   tx-embedded URLs → E2 (via pendingUrls)
    // ══════════════════════════════════════════════════════════════════════════
    const tWindowStart = Date.now();

    // Drain any targeted addresses from E3 or E4 — include them in this window
    const e1TargetedAddrs = drainE1TargetedAddresses(pool, 20);
    state.statusMessage = `E1 scanning blocks ${wStart}–${windowEnd}${e1TargetedAddrs.length > 0 ? ` + ${e1TargetedAddrs.length} targeted addrs` : ""}`;
    log(`Window #${state.windowsCompleted + 1}: blocks ${wStart}–${windowEnd}${e1TargetedAddrs.length > 0 ? ` | targeted: ${e1TargetedAddrs.length}` : ""}`);

    const minerResult = await withBackoff(
      () => runSignatureMiner({
        startBlock:    wStart,
        blockCount:    windowSize,
        addresses:     e1TargetedAddrs.length > 0 ? e1TargetedAddrs : undefined,
        detectWeakK:   true,
        detectBias:    true,
        detectPoly:    true,
        rCollision:    true,
        maxTxPerBlock: 0,
      }),
      `Engine1 blocks ${wStart}-${windowEnd}`,
      state,
    );

    if (minerResult) {
      // Collect findings
      for (const f of minerResult.findings) {
        findings.push({
          engine:     "block_scanner",
          kind:       f.attackType,
          address:    f.address,
          privateKey: f.privateKey ?? undefined,
          value:      f.r,
          detail:     f.detail,
          txHash:     f.txHashes?.[0],
          confidence: 0.9,
          discoveredAt: new Date().toISOString(),
        });
        if (f.privateKey && !state.recoveredKeys.includes(f.privateKey)) {
          state.recoveredKeys.push(f.privateKey);
          log(`🔑 KEY RECOVERED (E1): ${f.privateKey.slice(0, 20)}… addr=${f.address}`);
        }
        if (f.address && !state.discoveredAddresses.includes(f.address)) {
          state.discoveredAddresses.push(f.address);
        }
      }

      // Collect tx-embedded URLs → E2
      for (const du of minerResult.discoveredUrls) {
        if (!state.pendingUrls.includes(du.url)) state.pendingUrls.push(du.url);
      }

      // ── Feed E1 output to cross-engine pool ──────────────────────────────
      const e1Flows = feedE1ToPool(minerResult, pool);
      state.crossEngineFlows.e1ToE3 += e1Flows.toE3;
      state.crossEngineFlows.e1ToE4 += e1Flows.toE4;
      if (e1Flows.toE3 > 0 || e1Flows.toE4 > 0) {
        log(`E1→pool: ${e1Flows.toE3} addrs→E3, ${e1Flows.toE4} addrs→E4, ${e1Flows.sigsRegistered} sigs registered`);
      }

      state.lastBlockScanned   = windowEnd;
      state.lowestBlockCovered = wStart;
    }

    state.windowsCompleted++;
    _recentWindowTimes.push(Date.now() - tWindowStart);
    if (_recentWindowTimes.length > 20) _recentWindowTimes.shift();

    // ══════════════════════════════════════════════════════════════════════════
    // ENGINE 2: Web Spider
    // Inputs from pool: state.pendingUrls (from E1 tx-embed) + pool.pendingSpiderUrls (from E3)
    // Outputs to pool:  private key addresses → E3 + E4
    //                   rs_pair finds → r-value registry
    //                   ETH addresses in context → E3
    // ══════════════════════════════════════════════════════════════════════════

    // Merge tx-embedded URLs and E3-sourced URLs
    const e3SpiderUrls = drainSpiderUrls(pool, 15);
    const e1UrlBatch   = state.pendingUrls.splice(0, 15);
    const allSpiderSeeds = [...new Set([...e1UrlBatch, ...e3SpiderUrls])];

    if (allSpiderSeeds.length > 0) {
      state.statusMessage = `E2 crawling ${allSpiderSeeds.length} URLs (${e1UrlBatch.length} from E1, ${e3SpiderUrls.length} from E3)`;
      log(`Engine 2: crawling ${allSpiderSeeds.length} URLs [E1:${e1UrlBatch.length} E3:${e3SpiderUrls.length}]`);

      const spiderResult = await withBackoff(
        () => runWebSigSpider({
          seeds:       allSpiderSeeds,
          maxUrls:     allSpiderSeeds.length * 20,
          maxDepth:    2,
          concurrency: 4,
          jitterMs:    [500, 2000],
        }),
        "Engine2 web spider",
        state,
      );

      if (spiderResult) {
        for (const f of spiderResult.finds) {
          findings.push({
            engine:      "web_spider",
            kind:        f.kind,
            value:       f.value,
            url:         f.url,
            detail:      `${f.kind} at depth ${f.depth}`,
            confidence:  0.8,
            discoveredAt: new Date().toISOString(),
          });
        }

        // ── Feed E2 output to cross-engine pool ───────────────────────────
        const e2Flows = feedE2ToPool(spiderResult, pool);
        state.crossEngineFlows.e2ToE3 += e2Flows.toE3;
        state.crossEngineFlows.e2ToE4 += e2Flows.toE4;
        if (e2Flows.toE3 > 0 || e2Flows.toE4 > 0 || e2Flows.sigsRegistered > 0) {
          log(`E2→pool: ${e2Flows.toE3} addrs→E3, ${e2Flows.toE4} addrs→E4, ${e2Flows.sigsRegistered} sigs`);
        }
      }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ENGINE 3: OSINT Spider — every N windows
    // Inputs from pool: pendingOsintAddresses (from E1, E2, E4)
    //                   osintKeywords (augmented by each engine)
    // Outputs to pool:  source URLs → E2
    //                   private key addresses → E4
    //                   raw_address findings → E1 targeted scan
    // ══════════════════════════════════════════════════════════════════════════
    const shouldRunOsint =
      state.windowsCompleted % osintEveryNWindows === 0 &&
      (pool.pendingOsintAddresses.size > 0 || state.discoveredAddresses.length > 0);

    if (shouldRunOsint) {
      // Drain pool + always include some recent discovered addresses
      const poolAddrs     = drainOsintAddresses(pool, 20);
      const recentAddrs   = state.discoveredAddresses.slice(-10);
      const osintAddrs    = [...new Set([...poolAddrs, ...recentAddrs])];
      const osintKeywords = [...pool.osintKeywords].slice(0, 8);

      state.statusMessage = `E3 OSINT on ${osintAddrs.length} addrs (${poolAddrs.length} from pool, ${recentAddrs.length} recent)`;
      log(`Engine 3: OSINT on ${osintAddrs.length} addresses [pool:${poolAddrs.length} recent:${recentAddrs.length}]`);
      await sleep(pauseBeforeOsintMs);

      const osintResult = await withBackoff(
        () => runOsintSigSpider({
          addresses:      osintAddrs,
          keywords:       osintKeywords,
          githubToken,
          maxTxInputBlocks: 20,
          scanInputData:  true,
          scanEns:        true,
          scanGithub:     true,
          scanPastebin:   true,
        }),
        "Engine3 OSINT",
        state,
      );

      if (osintResult) {
        for (const f of osintResult.findings) {
          findings.push({
            engine:    "osint",
            kind:      f.kind,
            address:   f.address ?? undefined,
            value:     f.value,
            detail:    `[${f.source}] ${f.context.slice(0, 120)}`,
            url:       f.url ?? undefined,
            confidence: f.confidence,
            discoveredAt: new Date().toISOString(),
          });
          if (f.kind === "private_key" && f.value) {
            const addr = f.address ?? null;
            if (addr && !state.recoveredKeys.includes(f.value)) {
              log(`🔑 KEY EXPOSED (E3/OSINT): ${f.value.slice(0, 20)}… found in ${f.source}`);
            }
          }
        }

        // ── Feed E3 output to cross-engine pool ───────────────────────────
        const e3Flows = feedE3ToPool(osintResult, pool);
        state.crossEngineFlows.e3ToE2 += e3Flows.toE2;
        state.crossEngineFlows.e3ToE4 += e3Flows.toE4;
        state.crossEngineFlows.e3ToE1 += e3Flows.toE1;
        if (e3Flows.toE2 > 0 || e3Flows.toE4 > 0 || e3Flows.toE1 > 0) {
          log(`E3→pool: ${e3Flows.toE2} URLs→E2, ${e3Flows.toE4} addrs→E4, ${e3Flows.toE1} addrs→E1`);
        }
        state.osintRunCount++;
      }
    }

    // ══════════════════════════════════════════════════════════════════════════
    // ENGINE 4: Peel Chain Tracer — every N windows
    // Inputs from pool: pendingPeelAddresses (from E1, E2, E3)
    //                   also state.pendingPeelAddresses (legacy nonce-reuse queue)
    // Outputs to pool:  outgoingAddresses → E3
    //                   nonceReuseAddresses → E1 targeted scan
    //                   hop r-values → r-value registry
    // ══════════════════════════════════════════════════════════════════════════
    const poolPeelAddrs  = drainPeelAddresses(pool, 3);
    const legacyPeelAddr = state.pendingPeelAddresses.length > 0
      ? [state.pendingPeelAddresses.shift()!]
      : [];
    const allPeelAddrs = [...new Set([...poolPeelAddrs, ...legacyPeelAddr])];

    const shouldRunPeel =
      state.windowsCompleted % peelEveryNWindows === 0 && allPeelAddrs.length > 0;

    if (shouldRunPeel) {
      state.statusMessage = `E4 peel chain on ${allPeelAddrs.length} addresses`;
      log(`Engine 4: peel chain on ${allPeelAddrs.length} addrs [pool:${poolPeelAddrs.length} legacy:${legacyPeelAddr.length}]`);
      await sleep(pauseBeforePeelMs);

      for (const peelAddr of allPeelAddrs.slice(0, 3)) {
        const peelResult = await withBackoff(
          () => runPeelChainTracer({
            startAddress:     peelAddr,
            maxHops:          8,
            chain:            "ethereum",
            scanSigs:         true,
            correlateAmounts: true,
          }),
          `Engine4 peel ${peelAddr}`,
          state,
        );

        if (peelResult) {
          for (const k of peelResult.privateKeysFound) {
            if (!state.recoveredKeys.includes(k)) {
              state.recoveredKeys.push(k);
              log(`🔑 PEEL KEY (E4): ${k.slice(0, 20)}… from ${peelAddr} (${peelResult.totalHops} hops)`);
            }
            findings.push({
              engine:     "peel_chain",
              kind:       "private_key",
              address:    peelAddr,
              privateKey: k,
              value:      k,
              detail:     `Peel chain trace: ${peelResult.totalHops} hops, riskScore=${peelResult.riskScore}`,
              confidence: 0.99,
              discoveredAt: new Date().toISOString(),
            });
          }

          // Push hop addresses for future peel-chain iterations
          for (const hop of peelResult.hops) {
            if (!state.pendingPeelAddresses.includes(hop.address) &&
                !state.discoveredAddresses.includes(hop.address)) {
              state.pendingPeelAddresses.push(hop.address);
            }
          }

          // ── Feed E4 output to cross-engine pool ──────────────────────────
          const e4Flows = feedE4ToPool(peelResult, pool);
          state.crossEngineFlows.e4ToE3 += e4Flows.toE3;
          state.crossEngineFlows.e4ToE1 += e4Flows.toE1;
          if (e4Flows.toE3 > 0 || e4Flows.toE1 > 0) {
            log(`E4→pool: ${e4Flows.toE3} addrs→E3, ${e4Flows.toE1} addrs→E1, ${e4Flows.sigsRegistered} r-vals`);
          }
          state.peelRunCount++;
        }
      }
    } else if (poolPeelAddrs.length > 0) {
      // Not time for a peel run yet — re-queue the drained addresses
      for (const a of poolPeelAddrs) pool.pendingPeelAddresses.add(a);
    }

    // ── Cross-nonce candidate check ──────────────────────────────────────────
    const crossNonce = drainCrossNonceCandidates(pool);
    if (crossNonce.length > 0) {
      state.crossEngineFlows.crossNonceHits += crossNonce.length;
      for (const c of crossNonce) {
        log(`⚡ CROSS-ENGINE NONCE REUSE: r=${c.r.slice(0, 18)}… addresses=[${c.addresses.join(",")}]`);
        findings.push({
          engine:    "cross_engine",
          kind:      "cross_nonce_reuse",
          value:     c.r,
          detail:    `Cross-engine nonce reuse: r=${c.r.slice(0, 18)}… seen in ${c.entries.length} entries from ${[...new Set(c.entries.map(e => e.source))].join("+")}`,
          confidence: 0.92,
          discoveredAt: c.detectedAt,
        });
        // These addresses are the highest-priority peel chain targets
        for (const addr of c.addresses) {
          pool.pendingPeelAddresses.add(addr);
          pool.pendingE1TargetedAddresses.add(addr);
        }
      }
    }

    // ── Pool telemetry log every 5 windows ───────────────────────────────────
    if (state.windowsCompleted % 5 === 0) {
      log(`Pool: ${poolSummary(pool)}`);
    }

    // ── Auto-save every 5 minutes ────────────────────────────────────────────
    if (Date.now() - lastSaveTime >= SAVE_INTERVAL_MS) {
      saveState(findings);
      lastSaveTime = Date.now();
    }

    // ── Between-window pause ─────────────────────────────────────────────────
    state.statusMessage = `Idle — pool: osint=${pool.pendingOsintAddresses.size} peel=${pool.pendingPeelAddresses.size} urls=${pool.pendingSpiderUrls.length}`;
    await sleep(state.rpcBackoffMs);
  }

  // ── Shutdown ───────────────────────────────────────────────────────────────
  _running = false;
  if (_state) _state.running = false;
  const reason = _stopRequested ? "User stop" : "Max runtime reached";
  log(`=== Autonomous Runner STOPPED — ${reason} ===`);
  log(`Windows: ${state.windowsCompleted} | Findings: ${findings.length} | Keys: ${state.recoveredKeys.length}`);
  log(`Cross-engine flows: ${JSON.stringify(state.crossEngineFlows)}`);
  saveState(findings);
}
