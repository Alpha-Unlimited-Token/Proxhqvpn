// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Layout } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink } from "lucide-react";

const BASE = typeof window !== "undefined"
  ? window.location.origin.replace("/omega-dashboard", "")
  : "";

const PROXHQ_BASE = `${BASE}/ghost-vpn`;

type Tool = {
  name: string;
  path: string;
  description: string;
  tier: "basic" | "pro" | "admin" | "both";
  category: string;
};

const TOOLS: Tool[] = [
  // VPN Core
  { name: "Dashboard", path: "/dashboard", description: "Live stats, node feed, intrusion alerts", tier: "both", category: "VPN Core" },
  { name: "VPN Nodes", path: "/nodes", description: "60-node swarm grid with lifecycle animations", tier: "admin", category: "VPN Core" },
  { name: "WireGuard Config", path: "/wireguard", description: "Per-node WireGuard config generator", tier: "both", category: "VPN Core" },
  { name: "Devices", path: "/devices", description: "WireGuard device registry + QR config", tier: "both", category: "VPN Core" },
  { name: "Kill Switch", path: "/kill-switch", description: "OS-level kill switch with IPv6 protection", tier: "basic", category: "VPN Core" },
  { name: "Split Tunneling", path: "/split-tunnel", description: "Per-IP/CIDR/port routing rules", tier: "basic", category: "VPN Core" },
  { name: "Obfuscation", path: "/obfuscation", description: "DPI bypass: obfs4, Shadowsocks, V2Ray, Meek", tier: "basic", category: "VPN Core" },
  { name: "VPN Coexistence", path: "/vpn-coexist", description: "Run alongside NordVPN, Tailscale, ZeroTier", tier: "pro", category: "VPN Core" },
  { name: "IP Rotator", path: "/ip-rotator", description: "Auto-cycle exit IP on schedule", tier: "pro", category: "VPN Core" },
  { name: "Smart DNS", path: "/smart-dns", description: "DNS-only routing for TVs and consoles", tier: "basic", category: "VPN Core" },
  { name: "Router Config", path: "/router-config", description: "OpenWRT / DD-WRT / pfSense config gen", tier: "basic", category: "VPN Core" },
  // Privacy
  { name: "Proxy & Tor", path: "/proxy", description: "Tor Browser, SOCKS5, port knocking docs", tier: "basic", category: "Privacy" },
  { name: "Onion Browser", path: "/onion-browser", description: "Proxied browser: Tor, Double, Custom SOCKS", tier: "basic", category: "Privacy" },
  { name: "Leak Detection", path: "/leaks", description: "DNS, IPv6, WebRTC leak detection suite", tier: "basic", category: "Privacy" },
  { name: "DNS Sinkhole", path: "/dns-sinkhole", description: "Pi-hole style DNS blocking", tier: "basic", category: "Privacy" },
  { name: "DNS Shield", path: "/dns-shield", description: "DNS-over-HTTPS + block lists", tier: "basic", category: "Privacy" },
  { name: "DAITA", path: "/daita", description: "Defense against AI traffic analysis", tier: "pro", category: "Privacy" },
  { name: "Post-Quantum", path: "/post-quantum", description: "ML-KEM / ML-DSA post-quantum VPN crypto", tier: "pro", category: "Privacy" },
  { name: "Alt Identity", path: "/alt-identity", description: "Generate complete alternative personas", tier: "pro", category: "Privacy" },
  // Defense
  { name: "Firewall", path: "/firewall", description: "iptables rules + IP blocklist across all nodes", tier: "admin", category: "Defense" },
  { name: "Beacon Alerts", path: "/beacons", description: "Spider / worm / beacon alert table", tier: "admin", category: "Defense" },
  { name: "SilkWeb", path: "/silkweb", description: "SVG chord topology + trapped entities", tier: "admin", category: "Defense" },
  { name: "Ghost Trap", path: "/ghost-trap", description: "7-stage counter-intel + Manual IP Investigator", tier: "pro", category: "Defense" },
  { name: "Ghost Trace", path: "/ghost-trace", description: "WireGuard peer behavioral analysis & C2 detection", tier: "pro", category: "Defense" },
  { name: "Canary Tokens", path: "/canary", description: "Invisible tracking tripwires: URL, DNS, email, PDF", tier: "pro", category: "Defense" },
  { name: "SIEM", path: "/siem", description: "Unified security event timeline", tier: "pro", category: "Defense" },
  { name: "Threat Intel", path: "/threat-intel", description: "IP reputation, Tor exits, threat feeds", tier: "basic", category: "Defense" },
  { name: "Network Monitor", path: "/network-monitor", description: "Real-time flow table, protocol breakdown, PCAP", tier: "basic", category: "Defense" },
  { name: "Dark Web Monitor", path: "/dark-web", description: "Breach monitoring: email, passwords, wallets", tier: "basic", category: "Defense" },
  // Offense / Recon
  { name: "OSINT Recon", path: "/osint", description: "DNS, TLS, HTTP headers, ASN, risk scoring", tier: "pro", category: "Offense / Recon" },
  { name: "Ghost Chain", path: "/ghost-chain", description: "200+ exploit techniques + attack chain builder", tier: "pro", category: "Offense / Recon" },
  { name: "HTTP Probe", path: "/http-probe", description: "Custom HTTP request builder + response inspector", tier: "pro", category: "Offense / Recon" },
  { name: "Subdomain Scout", path: "/subdomains", description: "9-source passive OSINT subdomain enumeration", tier: "pro", category: "Offense / Recon" },
  { name: "JWT Analyzer", path: "/jwt-analyzer", description: "alg:none, RS256→HS256, jku/x5u, kid injection", tier: "pro", category: "Offense / Recon" },
  { name: "SSL/TLS Analyzer", path: "/ssl-tls", description: "Certificate, cipher suites, known CVE detection", tier: "pro", category: "Offense / Recon" },
  { name: "WAF Analyzer", path: "/waf", description: "25+ WAF vendor detection + bypass generator", tier: "pro", category: "Offense / Recon" },
  { name: "IaC Scanner", path: "/iac-scan", description: "Terraform, K8s, Dockerfile misconfiguration scan", tier: "pro", category: "Offense / Recon" },
  { name: "Username Intel", path: "/username-intel", description: "OSINT username search across 100+ platforms", tier: "pro", category: "Offense / Recon" },
  // Admin
  { name: "Terminal", path: "/terminal", description: "4-tab shell: Shell, HTTP Client, Port Scan, Audit Log", tier: "admin", category: "Admin" },
  { name: "SQL Interface", path: "/sql", description: "3-mode SQL: Local DB, External DB, HTTP API", tier: "admin", category: "Admin" },
  { name: "System Monitor", path: "/monitor", description: "CPU, RAM, network, WireGuard metrics", tier: "admin", category: "Admin" },
  { name: "Security Audit", path: "/security-audit", description: "TLS inspector, HTTP header grader, WHOIS", tier: "admin", category: "Admin" },
  // Blockchain
  { name: "QuantumAudit", path: "/quantum-audit", description: "Smart contract security auditing", tier: "pro", category: "Blockchain" },
  { name: "Signature Miner", path: "/quantum-audit/sig-miner", description: "5-engine ECDSA nonce-reuse + key recovery", tier: "pro", category: "Blockchain" },
];

const CATEGORIES = ["VPN Core", "Privacy", "Defense", "Offense / Recon", "Admin", "Blockchain"];

const TIER_COLORS: Record<string, string> = {
  basic: "bg-green-900/60 text-green-300 border-green-700",
  pro: "bg-red-900/60 text-red-300 border-red-700",
  admin: "bg-amber-900/60 text-amber-300 border-amber-700",
  both: "bg-blue-900/60 text-blue-300 border-blue-700",
};

const TIER_LABELS: Record<string, string> = {
  basic: "VPN Basic",
  pro: "CC Pro",
  admin: "Admin",
  both: "All Tiers",
};

export default function ProxhqTools() {
  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">ProxhqVPN Platform Tools</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Direct links to every tool in the ProxhqVPN platform. Click any card to open the tool.
          </p>
        </div>

        {CATEGORIES.map(cat => {
          const tools = TOOLS.filter(t => t.category === cat);
          return (
            <div key={cat}>
              <h2 className="text-sm font-semibold text-primary uppercase tracking-widest mb-3 border-b border-border pb-1">
                {cat}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {tools.map(tool => (
                  <a
                    key={tool.path}
                    href={`${PROXHQ_BASE}${tool.path}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block group"
                  >
                    <Card className="bg-card/50 border-primary/20 hover:border-primary/60 hover:bg-card transition-all cursor-pointer h-full">
                      <CardHeader className="pb-1 pt-3 px-4">
                        <div className="flex items-start justify-between gap-2">
                          <CardTitle className="text-sm font-semibold group-hover:text-primary transition-colors">
                            {tool.name}
                          </CardTitle>
                          <div className="flex items-center gap-1 shrink-0">
                            <Badge className={`text-[10px] px-1.5 py-0 border ${TIER_COLORS[tool.tier]}`}>
                              {TIER_LABELS[tool.tier]}
                            </Badge>
                            <ExternalLink className="w-3 h-3 text-muted-foreground group-hover:text-primary transition-colors" />
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="px-4 pb-3">
                        <p className="text-xs text-muted-foreground leading-relaxed">{tool.description}</p>
                        <p className="text-[10px] text-primary/40 mt-1 font-mono">{tool.path}</p>
                      </CardContent>
                    </Card>
                  </a>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Layout>
  );
}
