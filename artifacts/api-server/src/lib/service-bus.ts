// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Internal Service Bus — lightweight in-process pub/sub event routing.
// All internal modules publish typed events here; the Global Event Graph
// subscribes and correlates them cross-system.

export type EventChannel =
  | "beacon.alert"
  | "firewall.block"
  | "firewall.rule_change"
  | "ztna.posture_check"
  | "ztna.deny"
  | "wireguard.config_issued"
  | "wireguard.config_revoked"
  | "node.trust_change"
  | "node.status_change"
  | "drift.detected"
  | "drift.remediated"
  | "siem.event"
  | "ghost_trace.anomaly"
  | "ghost_chain.kill_chain"
  | "canary.triggered"
  | "threat_intel.ioc_match"
  | "audit.chain_entry"
  | "session.login"
  | "session.logout"
  | "firewall.escalate_ghost_trap"
  | "ghost_trap.escalate_ghost_node"
  | "ghost_node.escalate_firewall";

export interface BusEvent<T = unknown> {
  channel: EventChannel;
  payload: T;
  timestamp: string;
  source: string;
}

type Subscriber<T = unknown> = (event: BusEvent<T>) => void;

class ServiceBus {
  private subscribers = new Map<EventChannel, Set<Subscriber>>();
  private recentEvents: BusEvent[] = [];
  private readonly MAX_HISTORY = 500;

  subscribe<T = unknown>(channel: EventChannel, fn: Subscriber<T>): () => void {
    if (!this.subscribers.has(channel)) {
      this.subscribers.set(channel, new Set());
    }
    this.subscribers.get(channel)!.add(fn as Subscriber);
    return () => this.subscribers.get(channel)?.delete(fn as Subscriber);
  }

  subscribeAll(fn: Subscriber): () => void {
    const unsubs: Array<() => void> = [];
    for (const ch of this.allChannels()) {
      unsubs.push(this.subscribe(ch, fn));
    }
    return () => unsubs.forEach(u => u());
  }

  publish<T = unknown>(channel: EventChannel, payload: T, source = "api-server"): void {
    const event: BusEvent<T> = {
      channel,
      payload,
      timestamp: new Date().toISOString(),
      source,
    };
    const subs = this.subscribers.get(channel);
    if (subs) {
      for (const fn of subs) {
        try { fn(event as BusEvent); } catch { /* never let a subscriber crash the bus */ }
      }
    }
    this.recentEvents.push(event as BusEvent);
    if (this.recentEvents.length > this.MAX_HISTORY) {
      this.recentEvents.shift();
    }
  }

  getRecent(limit = 100, channel?: EventChannel): BusEvent[] {
    const events = channel
      ? this.recentEvents.filter(e => e.channel === channel)
      : this.recentEvents;
    return events.slice(-limit);
  }

  getStats(): Record<EventChannel, number> {
    const stats = {} as Record<EventChannel, number>;
    for (const ch of this.allChannels()) stats[ch] = 0;
    for (const e of this.recentEvents) stats[e.channel] = (stats[e.channel] ?? 0) + 1;
    return stats;
  }

  private allChannels(): EventChannel[] {
    return [
      "beacon.alert", "firewall.block", "firewall.rule_change",
      "ztna.posture_check", "ztna.deny", "wireguard.config_issued",
      "wireguard.config_revoked", "node.trust_change", "node.status_change",
      "drift.detected", "drift.remediated", "siem.event",
      "ghost_trace.anomaly", "ghost_chain.kill_chain", "canary.triggered",
      "threat_intel.ioc_match", "audit.chain_entry", "session.login",
      "session.logout",
      "firewall.escalate_ghost_trap", "ghost_trap.escalate_ghost_node",
      "ghost_node.escalate_firewall",
    ];
  }
}

export const bus = new ServiceBus();
