// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Global Event Graph — cross-system event correlation engine.
// Subscribes to the service bus and builds a live graph of correlated events,
// enabling kill-chain reconstruction and cross-system anomaly detection.
// Audit recommendation: add global event graph for cross-system correlation.

import { bus, type BusEvent, type EventChannel } from "./service-bus";

export interface EventNode {
  id: string;
  channel: EventChannel;
  payload: unknown;
  timestamp: string;
  source: string;
  correlationIds: string[];
}

export interface EventEdge {
  from: string;
  to: string;
  relationship: "caused_by" | "follows" | "correlated" | "same_source";
  confidence: number;
}

export interface CorrelatedChain {
  id: string;
  events: EventNode[];
  edges: EventEdge[];
  severity: "low" | "medium" | "high" | "critical";
  pattern: string;
  detectedAt: string;
  description: string;
}

export interface EventGraphSnapshot {
  nodes: EventNode[];
  edges: EventEdge[];
  chains: CorrelatedChain[];
  stats: {
    totalEvents: number;
    correlatedEvents: number;
    activeChainsCount: number;
    topPattern: string | null;
    timeWindowMinutes: number;
  };
}

// ── Correlation rules — define patterns to detect ────────────────────────────

interface CorrelationPattern {
  id: string;
  name: string;
  description: string;
  severity: CorrelatedChain["severity"];
  channels: EventChannel[];
  windowMs: number;
  minEvents: number;
  match: (events: EventNode[]) => boolean;
}

const CORRELATION_PATTERNS: CorrelationPattern[] = [
  {
    id: "ztna_deny_then_wg_config",
    name: "ZTNA Bypass Attempt",
    description: "Device failed ZTNA posture check then attempted WireGuard config issuance",
    severity: "critical",
    channels: ["ztna.deny", "wireguard.config_issued"],
    windowMs: 5 * 60 * 1000,
    minEvents: 2,
    match: (events) =>
      events.some(e => e.channel === "ztna.deny") &&
      events.some(e => e.channel === "wireguard.config_issued"),
  },
  {
    id: "beacon_then_firewall_block",
    name: "Beacon → Firewall Block Sequence",
    description: "Beacon alert followed by firewall block from same source",
    severity: "high",
    channels: ["beacon.alert", "firewall.block"],
    windowMs: 2 * 60 * 1000,
    minEvents: 2,
    match: (events) =>
      events.some(e => e.channel === "beacon.alert") &&
      events.some(e => e.channel === "firewall.block"),
  },
  {
    id: "drift_cascade",
    name: "Configuration Drift Cascade",
    description: "Multiple drift events detected across different components in short window",
    severity: "high",
    channels: ["drift.detected"],
    windowMs: 10 * 60 * 1000,
    minEvents: 3,
    match: (events) => events.filter(e => e.channel === "drift.detected").length >= 3,
  },
  {
    id: "canary_and_ghost_trace",
    name: "Canary Triggered + Ghost Trace Anomaly",
    description: "Canary token trigger coincides with outbound behavioral anomaly",
    severity: "critical",
    channels: ["canary.triggered", "ghost_trace.anomaly"],
    windowMs: 15 * 60 * 1000,
    minEvents: 2,
    match: (events) =>
      events.some(e => e.channel === "canary.triggered") &&
      events.some(e => e.channel === "ghost_trace.anomaly"),
  },
  {
    id: "ioc_and_kill_chain",
    name: "IOC Match → Kill Chain Discovery",
    description: "Threat Intel IOC match followed by kill chain stage detection",
    severity: "critical",
    channels: ["threat_intel.ioc_match", "ghost_chain.kill_chain"],
    windowMs: 30 * 60 * 1000,
    minEvents: 2,
    match: (events) =>
      events.some(e => e.channel === "threat_intel.ioc_match") &&
      events.some(e => e.channel === "ghost_chain.kill_chain"),
  },
  {
    id: "node_trust_drop_and_deny",
    name: "Node Trust Collapse",
    description: "Node trust score dropped below threshold, followed by connection denies",
    severity: "high",
    channels: ["node.trust_change", "ztna.deny"],
    windowMs: 10 * 60 * 1000,
    minEvents: 2,
    match: (events) =>
      events.some(e => e.channel === "node.trust_change" && (e.payload as any)?.action === "degraded") &&
      events.some(e => e.channel === "ztna.deny"),
  },
  {
    id: "firewall_rule_change_and_block_drop",
    name: "Policy Change Causing Service Disruption",
    description: "Firewall rule change followed by critical service blocks",
    severity: "high",
    channels: ["firewall.rule_change", "firewall.block"],
    windowMs: 5 * 60 * 1000,
    minEvents: 2,
    match: (events) =>
      events.some(e => e.channel === "firewall.rule_change") &&
      events.filter(e => e.channel === "firewall.block").length >= 5,
  },
];

// ── Event Graph Engine ────────────────────────────────────────────────────────

class EventGraph {
  private events: EventNode[] = [];
  private edges: EventEdge[] = [];
  private chains: CorrelatedChain[] = [];
  private readonly MAX_EVENTS = 2000;
  private readonly CORRELATION_WINDOW_MS = 30 * 60 * 1000;

  constructor() {
    bus.subscribeAll((event) => this.ingest(event));
  }

  private ingest(event: BusEvent): void {
    const node: EventNode = {
      id: `${event.channel}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      channel: event.channel,
      payload: event.payload,
      timestamp: event.timestamp,
      source: event.source,
      correlationIds: [],
    };

    this.events.push(node);
    if (this.events.length > this.MAX_EVENTS) this.events.shift();

    this.correlate(node);
  }

  private correlate(newNode: EventNode): void {
    const windowStart = new Date(Date.now() - this.CORRELATION_WINDOW_MS).toISOString();
    const recentEvents = this.events.filter(e => e.timestamp >= windowStart);

    for (const pattern of CORRELATION_PATTERNS) {
      const patternWindow = new Date(Date.now() - pattern.windowMs).toISOString();
      const relevant = recentEvents.filter(
        e => pattern.channels.includes(e.channel) && e.timestamp >= patternWindow
      );

      if (relevant.length < pattern.minEvents) continue;
      if (!pattern.match(relevant)) continue;

      const existingChain = this.chains.find(
        c => c.pattern === pattern.id &&
        new Date(Date.now() - pattern.windowMs).toISOString() < c.detectedAt
      );
      if (existingChain) continue;

      const chain: CorrelatedChain = {
        id: `chain-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        events: relevant,
        edges: this.buildEdgesForChain(relevant),
        severity: pattern.severity,
        pattern: pattern.id,
        detectedAt: new Date().toISOString(),
        description: pattern.description,
      };

      this.chains.push(chain);
      if (this.chains.length > 100) this.chains.shift();

      for (const e of relevant) {
        e.correlationIds.push(chain.id);
      }

      bus.publish("siem.event", {
        action: `event_graph.chain_detected`,
        pattern: pattern.name,
        severity: pattern.severity,
        chainId: chain.id,
        eventCount: relevant.length,
      }, "event-graph");
    }

    this.buildEdges(newNode, recentEvents);
  }

  private buildEdgesForChain(events: EventNode[]): EventEdge[] {
    const edges: EventEdge[] = [];
    for (let i = 1; i < events.length; i++) {
      edges.push({
        from: events[i - 1].id,
        to: events[i].id,
        relationship: "follows",
        confidence: 0.8,
      });
    }
    return edges;
  }

  private buildEdges(newNode: EventNode, recentEvents: EventNode[]): void {
    for (const existing of recentEvents) {
      if (existing.id === newNode.id) continue;
      if (existing.source === newNode.source) {
        this.edges.push({
          from: existing.id,
          to: newNode.id,
          relationship: "same_source",
          confidence: 0.9,
        });
      }
    }
    if (this.edges.length > 5000) this.edges.splice(0, this.edges.length - 5000);
  }

  snapshot(windowMinutes = 30): EventGraphSnapshot {
    const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();
    const recentNodes = this.events.filter(e => e.timestamp >= windowStart);
    const recentNodeIds = new Set(recentNodes.map(e => e.id));
    const recentEdges = this.edges.filter(
      e => recentNodeIds.has(e.from) && recentNodeIds.has(e.to)
    );
    const recentChains = this.chains.filter(c => c.detectedAt >= windowStart);

    const patternCounts = new Map<string, number>();
    for (const c of recentChains) {
      patternCounts.set(c.pattern, (patternCounts.get(c.pattern) ?? 0) + 1);
    }
    let topPattern: string | null = null;
    let topCount = 0;
    for (const [pattern, count] of patternCounts) {
      if (count > topCount) { topPattern = pattern; topCount = count; }
    }

    return {
      nodes: recentNodes,
      edges: recentEdges,
      chains: recentChains,
      stats: {
        totalEvents: recentNodes.length,
        correlatedEvents: recentNodes.filter(e => e.correlationIds.length > 0).length,
        activeChainsCount: recentChains.length,
        topPattern,
        timeWindowMinutes: windowMinutes,
      },
    };
  }

  getChains(severity?: CorrelatedChain["severity"]): CorrelatedChain[] {
    return severity
      ? this.chains.filter(c => c.severity === severity)
      : this.chains;
  }
}

export const eventGraph = new EventGraph();
