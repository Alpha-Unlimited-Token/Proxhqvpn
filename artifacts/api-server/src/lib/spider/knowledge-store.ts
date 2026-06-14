// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
/**
 * Spider Knowledge Store
 * ══════════════════════
 * Persistent, append-safe storage for the adaptive blockchain spider.
 *
 * Stores on disk under <reportsDir>/spider/:
 *   state.json          — visited set, queue, cluster map, address metadata
 *   signatures.jsonl    — one JSON record per signature found (append-only)
 *   ens-cache.json      — ENS name lookups
 *   findings.json       — notable findings (nonce reuse, clusters, public keys)
 *   public-keys.json    — recovered public keys (address → pubkey hex)
 *
 * The store is intentionally file-backed so the spider survives restarts and
 * continues from where it left off with zero duplicate work.
 */

import fs   from "fs";
import path from "path";
import { logger } from "../logger";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface StoredSignature {
  address:     string;
  txHash:      string;
  blockNumber: number;
  nonce:       number;
  r:           string;
  s:           string;
  v:           number;
  z:           string;   // message hash (transaction hash used in signing)
  chainId?:    number;
  timestamp?:  string;
}

export interface AddressMeta {
  address:          string;
  firstSeen:        string;            // ISO timestamp
  lastSeen:         string;
  timesSeenAsCounterparty: number;    // how many other addresses interacted with it
  txCount:          number;           // total txs found
  sigCount:         number;           // signatures extracted
  clusterId?:       string;           // union-find cluster
  ensName?:         string;
  publicKey?:       string;
  interactedWith:   string[];         // up to 20 counterparties
  fromSeed:         boolean;          // true = was in original target list
  wave:             number;           // 0 = seed, 1 = first hop, 2 = second hop…
  notes:            string[];         // accumulated observations
}

export interface SpiderFinding {
  type:        "nonce_reuse" | "r_collision" | "cluster" | "public_key" | "ens" | "anomaly";
  severity:    "info" | "medium" | "high" | "critical";
  address:     string;
  detail:      string;
  txHashes?:   string[];
  extra?:      Record<string, unknown>;
  timestamp:   string;
}

export interface SpiderState {
  startedAt:       string;
  lastCheckpoint:  string;
  totalVisited:    number;
  totalQueued:     number;
  totalSignatures: number;
  totalFindings:   number;
  wavesCompleted:  number;
  currentWave:     number;
  maxWave:         number;
  maxAddresses:    number;
  running:         boolean;
  seedCount:       number;
  // In-memory only — serialised separately
  visitedList:     string[];   // all visited addresses (serialised set)
  queueItems:      QueueItem[];
}

export interface QueueItem {
  address:  string;
  wave:     number;
  priority: number;   // higher = process sooner
}

// ── KnowledgeStore class ──────────────────────────────────────────────────────

export class KnowledgeStore {
  private dir:          string;
  private stateFile:    string;
  private sigFile:      string;
  private ensFile:      string;
  private findingsFile: string;
  private pubKeyFile:   string;
  private metaFile:     string;

  // In-memory caches (written to disk on checkpoint)
  private visited    = new Set<string>();
  private queue      = new Map<string, QueueItem>();      // address → item
  private addressMeta= new Map<string, AddressMeta>();
  private ensCache   = new Map<string, string>();
  private pubKeys    = new Map<string, string>();         // address → uncompressed pubkey hex
  private findings:    SpiderFinding[] = [];
  private state:       SpiderState;

  // Sig JSONL is written directly (never fully buffered in memory)
  private sigStream:   fs.WriteStream | null = null;
  private sigCount     = 0;

  constructor(baseDir: string) {
    this.dir          = path.join(baseDir, "spider");
    this.stateFile    = path.join(this.dir, "state.json");
    this.sigFile      = path.join(this.dir, "signatures.jsonl");
    this.ensFile      = path.join(this.dir, "ens-cache.json");
    this.findingsFile = path.join(this.dir, "findings.json");
    this.pubKeyFile   = path.join(this.dir, "public-keys.json");
    this.metaFile     = path.join(this.dir, "address-meta.json");

    try { fs.mkdirSync(this.dir, { recursive: true }); } catch {}

    this.state = {
      startedAt:       new Date().toISOString(),
      lastCheckpoint:  new Date().toISOString(),
      totalVisited:    0,
      totalQueued:     0,
      totalSignatures: 0,
      totalFindings:   0,
      wavesCompleted:  0,
      currentWave:     0,
      maxWave:         2,
      maxAddresses:    50_000,
      running:         false,
      seedCount:       0,
      visitedList:     [],
      queueItems:      [],
    };
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────────

  load(): boolean {
    try {
      // Load state
      if (fs.existsSync(this.stateFile)) {
        const raw   = fs.readFileSync(this.stateFile, "utf8");
        const saved = JSON.parse(raw) as SpiderState;
        this.state  = saved;
        for (const a of saved.visitedList)    this.visited.add(a);
        for (const q of saved.queueItems)     this.queue.set(q.address, q);
        logger.info({ visited: this.visited.size, queued: this.queue.size }, "Spider: loaded state from disk");
      }
      // Load ENS cache
      if (fs.existsSync(this.ensFile)) {
        const ens = JSON.parse(fs.readFileSync(this.ensFile, "utf8")) as Record<string, string>;
        for (const [k, v] of Object.entries(ens)) this.ensCache.set(k, v);
      }
      // Load address meta
      if (fs.existsSync(this.metaFile)) {
        const meta = JSON.parse(fs.readFileSync(this.metaFile, "utf8")) as Record<string, AddressMeta>;
        for (const [k, v] of Object.entries(meta)) this.addressMeta.set(k, v);
      }
      // Load public keys
      if (fs.existsSync(this.pubKeyFile)) {
        const keys = JSON.parse(fs.readFileSync(this.pubKeyFile, "utf8")) as Record<string, string>;
        for (const [k, v] of Object.entries(keys)) this.pubKeys.set(k, v);
      }
      // Load findings
      if (fs.existsSync(this.findingsFile)) {
        this.findings = JSON.parse(fs.readFileSync(this.findingsFile, "utf8")) as SpiderFinding[];
      }
      // Count existing sigs
      if (fs.existsSync(this.sigFile)) {
        const lines = fs.readFileSync(this.sigFile, "utf8").split("\n").filter(Boolean);
        this.sigCount = lines.length;
        this.state.totalSignatures = this.sigCount;
      }
      return this.visited.size > 0;
    } catch (err) {
      logger.warn({ err }, "Spider: failed to load state — starting fresh");
      return false;
    }
  }

  reset(): void {
    this.visited.clear();
    this.queue.clear();
    this.addressMeta.clear();
    this.ensCache.clear();
    this.pubKeys.clear();
    this.findings = [];
    this.sigCount = 0;
    this.sigStream?.end();
    this.sigStream = null;
    // Remove files
    for (const f of [this.stateFile, this.sigFile, this.ensFile, this.findingsFile, this.pubKeyFile, this.metaFile]) {
      try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch {}
    }
    this.state = {
      startedAt: new Date().toISOString(),
      lastCheckpoint: new Date().toISOString(),
      totalVisited: 0, totalQueued: 0, totalSignatures: 0, totalFindings: 0,
      wavesCompleted: 0, currentWave: 0, maxWave: 2, maxAddresses: 50_000,
      running: false, seedCount: 0, visitedList: [], queueItems: [],
    };
  }

  checkpoint(): void {
    try {
      this.state.lastCheckpoint   = new Date().toISOString();
      this.state.totalVisited     = this.visited.size;
      this.state.totalQueued      = this.queue.size;
      this.state.totalSignatures  = this.sigCount;
      this.state.totalFindings    = this.findings.length;
      this.state.visitedList      = [...this.visited];
      this.state.queueItems       = [...this.queue.values()];

      fs.writeFileSync(this.stateFile,    JSON.stringify(this.state, null, 2));
      fs.writeFileSync(this.ensFile,      JSON.stringify(Object.fromEntries(this.ensCache), null, 2));
      fs.writeFileSync(this.findingsFile, JSON.stringify(this.findings, null, 2));
      fs.writeFileSync(this.pubKeyFile,   JSON.stringify(Object.fromEntries(this.pubKeys), null, 2));
      fs.writeFileSync(this.metaFile,     JSON.stringify(Object.fromEntries(this.addressMeta), null, 2));

      logger.info({
        visited:    this.visited.size,
        queued:     this.queue.size,
        signatures: this.sigCount,
        findings:   this.findings.length,
      }, "Spider: checkpoint saved");
    } catch (err) {
      logger.error({ err }, "Spider: checkpoint failed");
    }
  }

  // ── Visited set ────────────────────────────────────────────────────────────

  isVisited(address: string): boolean {
    return this.visited.has(address.toLowerCase());
  }

  markVisited(address: string): void {
    this.visited.add(address.toLowerCase());
  }

  getVisitedCount(): number {
    return this.visited.size;
  }

  // ── Queue management ───────────────────────────────────────────────────────

  enqueue(address: string, wave: number, priority = 1): void {
    const a = address.toLowerCase();
    if (this.visited.has(a)) return;
    const existing = this.queue.get(a);
    if (existing) {
      // Increase priority if seen again (adaptive learning)
      existing.priority += priority;
      return;
    }
    this.queue.set(a, { address: a, wave, priority });
  }

  dequeueBatch(n: number): QueueItem[] {
    // Sort by priority desc, take top N
    const items = [...this.queue.values()]
      .sort((a, b) => b.priority - a.priority)
      .slice(0, n);
    for (const item of items) this.queue.delete(item.address);
    return items;
  }

  getQueueSize(): number {
    return this.queue.size;
  }

  // ── Address metadata ───────────────────────────────────────────────────────

  touchMeta(address: string, wave: number, fromSeed: boolean): AddressMeta {
    const a = address.toLowerCase();
    let m = this.addressMeta.get(a);
    if (!m) {
      m = {
        address: a, firstSeen: new Date().toISOString(), lastSeen: new Date().toISOString(),
        timesSeenAsCounterparty: 0, txCount: 0, sigCount: 0,
        interactedWith: [], fromSeed, wave, notes: [],
      };
      this.addressMeta.set(a, m);
    } else {
      m.lastSeen = new Date().toISOString();
    }
    return m;
  }

  updateMeta(address: string, patch: Partial<AddressMeta>): void {
    const a = address.toLowerCase();
    const m = this.addressMeta.get(a);
    if (m) Object.assign(m, patch);
  }

  incrementCounterpartyFreq(address: string): void {
    const a = address.toLowerCase();
    const m = this.addressMeta.get(a);
    if (m) m.timesSeenAsCounterparty++;
    // Boost queue priority whenever freq increases
    const q = this.queue.get(a);
    if (q) q.priority++;
  }

  getMeta(address: string): AddressMeta | undefined {
    return this.addressMeta.get(address.toLowerCase());
  }

  getTopAddressesByFreq(n: number): AddressMeta[] {
    return [...this.addressMeta.values()]
      .sort((a, b) => b.timesSeenAsCounterparty - a.timesSeenAsCounterparty)
      .slice(0, n);
  }

  // ── Signature store ────────────────────────────────────────────────────────

  private ensureSigStream(): fs.WriteStream {
    if (!this.sigStream || this.sigStream.destroyed) {
      this.sigStream = fs.createWriteStream(this.sigFile, { flags: "a" });
    }
    return this.sigStream;
  }

  appendSignature(sig: StoredSignature): void {
    const stream = this.ensureSigStream();
    stream.write(JSON.stringify(sig) + "\n");
    this.sigCount++;

    // Update address meta
    const m = this.addressMeta.get(sig.address.toLowerCase());
    if (m) m.sigCount++;
  }

  getSignatureCount(): number {
    return this.sigCount;
  }

  loadSignaturesForAddress(address: string): StoredSignature[] {
    if (!fs.existsSync(this.sigFile)) return [];
    const target = address.toLowerCase();
    const out: StoredSignature[] = [];
    try {
      const lines = fs.readFileSync(this.sigFile, "utf8").split("\n").filter(Boolean);
      for (const line of lines) {
        try {
          const sig = JSON.parse(line) as StoredSignature;
          if (sig.address.toLowerCase() === target) out.push(sig);
        } catch {}
      }
    } catch {}
    return out;
  }

  // Load all signatures for nonce-reuse analysis (streaming, returns Map)
  loadAllSignatures(): Map<string, StoredSignature[]> {
    const result = new Map<string, StoredSignature[]>();
    if (!fs.existsSync(this.sigFile)) return result;
    try {
      const lines = fs.readFileSync(this.sigFile, "utf8").split("\n").filter(Boolean);
      for (const line of lines) {
        try {
          const sig = JSON.parse(line) as StoredSignature;
          const list = result.get(sig.address) ?? [];
          list.push(sig);
          result.set(sig.address, list);
        } catch {}
      }
    } catch {}
    return result;
  }

  // ── ENS cache ──────────────────────────────────────────────────────────────

  setEns(address: string, name: string): void {
    this.ensCache.set(address.toLowerCase(), name);
    const m = this.addressMeta.get(address.toLowerCase());
    if (m) m.ensName = name;
  }

  getEns(address: string): string | undefined {
    return this.ensCache.get(address.toLowerCase());
  }

  hasEns(address: string): boolean {
    return this.ensCache.has(address.toLowerCase());
  }

  // ── Public keys ────────────────────────────────────────────────────────────

  storePublicKey(address: string, pubkeyHex: string): void {
    this.pubKeys.set(address.toLowerCase(), pubkeyHex);
    const m = this.addressMeta.get(address.toLowerCase());
    if (m) m.publicKey = pubkeyHex;
    this.addFinding({
      type: "public_key", severity: "info", address: address.toLowerCase(),
      detail: `Public key extracted: ${pubkeyHex.slice(0, 20)}…`,
      extra: { pubkey: pubkeyHex },
      timestamp: new Date().toISOString(),
    });
  }

  getPublicKey(address: string): string | undefined {
    return this.pubKeys.get(address.toLowerCase());
  }

  getPublicKeyMap(): Map<string, string> {
    return this.pubKeys;
  }

  // ── Findings ───────────────────────────────────────────────────────────────

  addFinding(f: SpiderFinding): void {
    this.findings.push(f);
  }

  getFindings(): SpiderFinding[] {
    return this.findings;
  }

  getFindingsByType(type: SpiderFinding["type"]): SpiderFinding[] {
    return this.findings.filter(f => f.type === type);
  }

  // ── State accessors ────────────────────────────────────────────────────────

  getState(): SpiderState {
    return {
      ...this.state,
      totalVisited:    this.visited.size,
      totalQueued:     this.queue.size,
      totalSignatures: this.sigCount,
      totalFindings:   this.findings.length,
    };
  }

  setRunning(v: boolean): void    { this.state.running = v; }
  setCurrentWave(v: number): void { this.state.currentWave = v; }
  setSeedCount(v: number): void   { this.state.seedCount = v; }
  setMaxWave(v: number): void     { this.state.maxWave = v; }
  setMaxAddresses(v: number): void { this.state.maxAddresses = v; }

  isFull(): boolean {
    return this.visited.size >= this.state.maxAddresses;
  }

  getDir(): string { return this.dir; }
}
