// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Unified Firewall Core — single engine that consolidates:
//   • firewall-policy-engine  (rule compilation → nftables/iptables/wg-acl)
//   • firewall-simulator      (pre-deploy traffic impact simulation)
//   • firewall-next / military variants (extended rule types)
//   • live enforcement decisions (per-packet allow/deny)
// Audit recommendation: consolidate firewall variants into one engine.

import {
  compileFirewallPolicy,
  type FirewallPolicyRule,
  type CompileResult,
} from "./firewall-policy-engine";
import {
  simulateFirewallPolicy,
  type TrafficSample,
  type SimulationResult,
  DEFAULT_TRAFFIC_SAMPLES,
} from "./firewall-simulator";
import { bus } from "./service-bus";

export type { FirewallPolicyRule, CompileResult, TrafficSample, SimulationResult };

// ── Extended rule types (firewall-next / military) ───────────────────────────

export interface GeoRule {
  id: string;
  action: "allow" | "deny";
  countryCodes: string[];
  direction: "inbound" | "outbound";
  description?: string;
}

export interface DpiRule {
  id: string;
  action: "allow" | "deny" | "inspect";
  signatures: string[];
  category?: "malware" | "c2" | "exfil" | "ads" | "custom";
  description?: string;
}

export interface RateLimitRule {
  id: string;
  sourceIp?: string;
  port?: number;
  protocol?: "tcp" | "udp";
  maxConnPerMin: number;
  burstAllowed: number;
}

export interface UnifiedFirewallPolicy {
  id: string;
  name: string;
  version: number;
  createdAt: string;
  rules: FirewallPolicyRule[];
  geoRules: GeoRule[];
  dpiRules: DpiRule[];
  rateLimits: RateLimitRule[];
  defaultAction: "allow" | "deny";
  logDropped: boolean;
  logAllowed: boolean;
}

export interface UnifiedCompileResult extends CompileResult {
  geoTable: string[];
  dpiTable: string[];
  rateLimitTable: string[];
  policyId: string;
  policyVersion: number;
  compiledAt: string;
}

export interface PolicyEvaluation {
  simulation: SimulationResult;
  compilation: UnifiedCompileResult;
  riskLevel: "low" | "medium" | "high" | "critical";
  recommendations: string[];
  approved: boolean;
}

// ── Core engine ──────────────────────────────────────────────────────────────

export class UnifiedFirewallCore {
  private activePolicies = new Map<string, UnifiedFirewallPolicy>();

  loadPolicy(policy: UnifiedFirewallPolicy): void {
    this.activePolicies.set(policy.id, policy);
    bus.publish("firewall.rule_change", {
      policyId: policy.id,
      version: policy.version,
      ruleCount: policy.rules.length,
    }, "unified-firewall-core");
  }

  getPolicy(id: string): UnifiedFirewallPolicy | undefined {
    return this.activePolicies.get(id);
  }

  listPolicies(): UnifiedFirewallPolicy[] {
    return [...this.activePolicies.values()];
  }

  compilePolicy(policy: UnifiedFirewallPolicy): UnifiedCompileResult {
    const base = compileFirewallPolicy(policy.rules);

    const geoTable = policy.geoRules.map(g =>
      `# GEO ${g.id}: ${g.action.toUpperCase()} ${g.direction} from [${g.countryCodes.join(", ")}]`
    );

    const dpiTable = policy.dpiRules.map(d =>
      `# DPI ${d.id}: ${d.action.toUpperCase()} category=${d.category ?? "custom"} sigs=${d.signatures.slice(0, 3).join(",")}${d.signatures.length > 3 ? "…" : ""}`
    );

    const rateLimitTable = policy.rateLimits.map(r =>
      `# RATELIMIT ${r.id}: max ${r.maxConnPerMin}/min burst ${r.burstAllowed}${r.sourceIp ? ` src=${r.sourceIp}` : ""}${r.port ? ` port=${r.port}` : ""}`
    );

    return {
      ...base,
      geoTable,
      dpiTable,
      rateLimitTable,
      policyId:      policy.id,
      policyVersion: policy.version,
      compiledAt:    new Date().toISOString(),
    };
  }

  simulatePolicy(
    policy: UnifiedFirewallPolicy,
    samples: TrafficSample[] = DEFAULT_TRAFFIC_SAMPLES,
  ): SimulationResult {
    return simulateFirewallPolicy(policy.rules, samples);
  }

  evaluatePolicy(
    policy: UnifiedFirewallPolicy,
    samples: TrafficSample[] = DEFAULT_TRAFFIC_SAMPLES,
  ): PolicyEvaluation {
    const simulation  = this.simulatePolicy(policy, samples);
    const compilation = this.compilePolicy(policy);
    const recommendations: string[] = [...compilation.warnings];

    if (policy.defaultAction === "allow") {
      recommendations.push("Default-allow posture detected — consider switching to default-deny");
    }
    if (policy.geoRules.length === 0) {
      recommendations.push("No geo-blocking rules — consider restricting inbound to expected source countries");
    }
    if (policy.dpiRules.length === 0) {
      recommendations.push("No DPI rules — consider adding C2/malware signature inspection");
    }
    if (!policy.logDropped) {
      recommendations.push("Dropped packet logging is disabled — enable for forensic visibility");
    }

    const riskScore = simulation.riskScore;
    const riskLevel: PolicyEvaluation["riskLevel"] =
      riskScore >= 75 ? "critical" :
      riskScore >= 50 ? "high" :
      riskScore >= 25 ? "medium" : "low";

    const approved = riskScore < 50 && simulation.criticalBlocked.length === 0;

    return { simulation, compilation, riskLevel, recommendations, approved };
  }

  /** Real-time packet decision (stateless, first-match rule evaluation). */
  decidePacket(
    policyId: string,
    packet: Pick<TrafficSample, "direction" | "protocol" | "source" | "destination" | "port">,
  ): { action: "allow" | "deny"; matchedRule: string | null; policyDefault: boolean } {
    const policy = this.activePolicies.get(policyId);
    if (!policy) return { action: "deny", matchedRule: null, policyDefault: true };

    const sorted = [...policy.rules].sort((a, b) => a.priority - b.priority);
    for (const rule of sorted) {
      if (rule.direction !== packet.direction) continue;
      if (rule.protocol !== "any" && rule.protocol !== packet.protocol) continue;
      if (rule.port && String(rule.port) !== String(packet.port ?? "")) continue;
      if (rule.source && rule.source !== "0.0.0.0/0" && rule.source !== packet.source) continue;
      if (rule.destination && rule.destination !== "0.0.0.0/0" && rule.destination !== packet.destination) continue;
      if (rule.action === "deny") {
        bus.publish("firewall.block", { policyId, ruleId: rule.id, packet }, "unified-firewall-core");
      }
      return { action: rule.action, matchedRule: rule.id, policyDefault: false };
    }

    return { action: policy.defaultAction, matchedRule: null, policyDefault: true };
  }
}

export const firewallCore = new UnifiedFirewallCore();
