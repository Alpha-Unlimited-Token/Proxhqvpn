import type { FirewallPolicyRule } from "./firewall-policy-engine";

export interface TrafficSample {
  id: string;
  direction: "inbound" | "outbound";
  protocol: "tcp" | "udp" | "icmp";
  source: string;
  destination: string;
  port?: number;
  service?: string;
  critical?: boolean;
}

export const DEFAULT_TRAFFIC_SAMPLES: TrafficSample[] = [
  { id: "wireguard",   direction: "inbound",  protocol: "udp", source: "0.0.0.0/0", destination: "", port: 51820, service: "WireGuard", critical: true },
  { id: "ssh",         direction: "inbound",  protocol: "tcp", source: "0.0.0.0/0", destination: "", port: 22,    service: "SSH" },
  { id: "https-out",   direction: "outbound", protocol: "tcp", source: "",           destination: "0.0.0.0/0", port: 443, service: "HTTPS" },
  { id: "dns-out",     direction: "outbound", protocol: "udp", source: "",           destination: "0.0.0.0/0", port: 53, service: "DNS" },
  { id: "api-health",  direction: "inbound",  protocol: "tcp", source: "0.0.0.0/0", destination: "", port: 8080, service: "API", critical: true },
];

function ruleMatches(rule: FirewallPolicyRule, t: TrafficSample): boolean {
  if (rule.direction !== t.direction) return false;
  if (rule.protocol !== "any" && rule.protocol !== t.protocol) return false;
  if (rule.port && String(rule.port) !== String(t.port ?? "")) return false;
  if (rule.source && rule.source !== "0.0.0.0/0" && rule.source !== t.source) return false;
  if (rule.destination && rule.destination !== "0.0.0.0/0" && rule.destination !== t.destination) return false;
  return true;
}

export interface SimulationResult {
  affected: Array<{ sample: TrafficSample; rule: FirewallPolicyRule; decision: string }>;
  criticalBlocked: Array<{ sample: TrafficSample; rule: FirewallPolicyRule; decision: string }>;
  riskScore: number;
  deployRecommendation: "allow" | "approval_required" | "block";
}

export function simulateFirewallPolicy(
  rules: FirewallPolicyRule[],
  samples: TrafficSample[] = DEFAULT_TRAFFIC_SAMPLES,
): SimulationResult {
  const sorted   = [...rules].sort((a, b) => a.priority - b.priority);
  const affected = [] as SimulationResult["affected"];

  for (const sample of samples) {
    const rule = sorted.find(r => ruleMatches(r, sample));
    if (rule) affected.push({ sample, rule, decision: rule.action });
  }

  const criticalBlocked = affected.filter(a => a.decision === "deny" && a.sample.critical);
  const riskScore = Math.min(
    100,
    criticalBlocked.length * 25 + affected.filter(a => a.decision === "deny").length * 5,
  );

  return {
    affected,
    criticalBlocked,
    riskScore,
    deployRecommendation: riskScore >= 50 ? "block" : riskScore >= 20 ? "approval_required" : "allow",
  };
}
