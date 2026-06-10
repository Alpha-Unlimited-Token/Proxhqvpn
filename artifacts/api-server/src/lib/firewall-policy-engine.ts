export type FirewallAction   = "allow" | "deny";
export type FirewallProtocol = "tcp" | "udp" | "icmp" | "any";

export interface FirewallPolicyRule {
  id: string;
  priority: number;
  action: FirewallAction;
  direction: "inbound" | "outbound";
  protocol: FirewallProtocol;
  source?: string;
  destination?: string;
  port?: number | string;
  description?: string;
}

export interface CompileResult {
  nftables:     string[];
  iptables:     string[];
  wireguardAcl: Array<Record<string, unknown>>;
  warnings:     string[];
}

function proto(rule: FirewallPolicyRule) {
  return rule.protocol === "any" ? "" : rule.protocol;
}

export function compileFirewallPolicy(rules: FirewallPolicyRule[]): CompileResult {
  const sorted   = [...rules].sort((a, b) => a.priority - b.priority);
  const warnings: string[] = [];
  const nftables: string[] = [];
  const iptables: string[] = [];
  const wireguardAcl: Array<Record<string, unknown>> = [];

  for (const r of sorted) {
    if (r.action === "allow" && !r.source && !r.destination && !r.port) {
      warnings.push(`Rule ${r.id} allows any-any traffic — consider narrowing scope`);
    }
    const verdict = r.action === "allow" ? "accept" : "drop";
    const chain   = r.direction === "inbound" ? "input" : "output";
    const p       = proto(r);
    const portExpr = r.port ? `${p ? p + " " : ""}dport ${r.port}` : "";
    const srcExpr  = r.source      ? `ip saddr ${r.source}`      : "";
    const dstExpr  = r.destination ? `ip daddr ${r.destination}` : "";
    const parts    = [srcExpr, dstExpr, portExpr].filter(Boolean).join(" ");
    nftables.push(
      `add rule inet proxhq ${chain} ${parts} ${verdict} comment "${r.id}"`
    );
    iptables.push(
      `-A ${r.direction === "inbound" ? "INPUT" : "OUTPUT"} -p ${r.protocol === "any" ? "all" : r.protocol}` +
      `${r.source      ? ` -s ${r.source}`      : ""}` +
      `${r.destination ? ` -d ${r.destination}` : ""}` +
      `${r.port        ? ` --dport ${r.port}`   : ""}` +
      ` -j ${r.action === "allow" ? "ACCEPT" : "DROP"}` +
      ` -m comment --comment "${r.id}"`
    );
    wireguardAcl.push({
      id: r.id, action: r.action, source: r.source, destination: r.destination,
      port: r.port, protocol: r.protocol,
    });
  }
  return { nftables, iptables, wireguardAcl, warnings };
}

export function findRuleConflicts(rules: FirewallPolicyRule[]): string[] {
  const conflicts: string[] = [];
  for (let i = 0; i < rules.length; i++) {
    for (let j = i + 1; j < rules.length; j++) {
      const a = rules[i], b = rules[j];
      const sameScope =
        a.direction   === b.direction   &&
        a.protocol    === b.protocol    &&
        a.source      === b.source      &&
        a.destination === b.destination &&
        String(a.port ?? "") === String(b.port ?? "");
      if (sameScope && a.action !== b.action) {
        conflicts.push(`Rule "${a.id}" (${a.action}) conflicts with "${b.id}" (${b.action})`);
      }
    }
  }
  return conflicts;
}
