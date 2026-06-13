// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Firewall Surface Manifest — canonical description of the ProxhqVPN firewall subsystem hierarchy.
// Used by the Firewall Core dashboard, governance API, and dependency map.

export interface FirewallSubsystem {
  id:           string;
  name:         string;
  description:  string;
  apiPrefix:    string;
  dashPath:     string;
  tier:         "enterprise" | "admin";
  riskLevel:    "medium" | "high" | "critical";
  capabilities: string[];
  tableGroups:  string[];
  status:       "active" | "beta" | "planned";
}

export interface FirewallManifest {
  version:     string;
  subsystems:  FirewallSubsystem[];
  generatedAt: string;
}

export const FIREWALL_SUBSYSTEMS: FirewallSubsystem[] = [
  {
    id:          "core",
    name:        "Firewall Core",
    description: "Monolithic rule engine — IDS/IPS, blocklist, security events, iptables export, ATR, NodeSync hardening.",
    apiPrefix:   "/api/firewall",
    dashPath:    "/firewall",
    tier:        "admin",
    riskLevel:   "high",
    capabilities: [
      "Stateful packet inspection",
      "IP blocklist (permanent + expiring)",
      "IDS/IPS pattern matching (100+ signatures)",
      "iptables rule export (IPv4 + IPv6)",
      "Automated Threat Response (ATR)",
      "Node hardening script (NodeSync)",
      "Firewall traffic decisions audit log",
      "Threat feed sync (Feodo, Abuse.ch, CINS)",
    ],
    tableGroups: [
      "firewall_rules",
      "firewall_blacklist",
      "firewall_security_events",
      "firewall_traffic_decisions",
    ],
    status: "active",
  },
  {
    id:          "advanced",
    name:        "Firewall Advanced",
    description: "pfSense/OPNsense/Suricata gap-filler — aliases, schedules, NAT, QoS, WAN groups, TLS fingerprints, WAF.",
    apiPrefix:   "/api/fw",
    dashPath:    "/firewall",
    tier:        "enterprise",
    riskLevel:   "high",
    capabilities: [
      "Alias manager (host/network/port/geo/URL-table)",
      "Time-based scheduling rules",
      "NAT rule engine (port-forward, outbound, 1:1)",
      "QoS / traffic shaping (HFSC, PRIQ, CBQ)",
      "WAN failover groups",
      "TLS fingerprinting (JA3/JA3S)",
      "DNS security events",
      "WAF event log + suppression rules",
      "Proxy rules (transparent, explicit)",
    ],
    tableGroups: [
      "firewall_aliases",
      "firewall_schedules",
      "firewall_nat_rules",
      "firewall_qos_rules",
      "firewall_wan_groups",
      "tls_fingerprints",
      "dns_security_events",
      "waf_events",
      "waf_suppression_rules",
      "firewall_proxy_rules",
    ],
    status: "active",
  },
  {
    id:          "next",
    name:        "Firewall Next-Gen",
    description: "2024–2025 research features — eBPF/XDP, QUIC, ETA, ECH, DoH, lateral movement, RPKI, AI-generated rules.",
    apiPrefix:   "/api/fwn",
    dashPath:    "/firewall",
    tier:        "enterprise",
    riskLevel:   "high",
    capabilities: [
      "eBPF/XDP rule engine (xdp/tc/cgroup_skb/socket_filter)",
      "QUIC protocol event tracking",
      "Encrypted Traffic Analysis (ETA)",
      "Encrypted Client Hello (ECH) inspection",
      "DNS-over-HTTPS (DoH) monitoring",
      "Lateral movement detection",
      "NetFlow v9 / IPFIX record ingestion",
      "Supply chain alert scanning",
      "AI-generated rule suggestions",
      "RPKI/BGP origin validation",
      "Deception port honeypots",
      "GeoIP block/allow rules",
    ],
    tableGroups: [
      "ebpf_rules",
      "quic_events",
      "eta_flows",
      "ech_events",
      "doh_events",
      "lateral_events",
      "netflow_records",
      "supply_chain_alerts",
      "ai_generated_rules",
      "rpki_checks",
      "deception_ports",
      "deception_triggers",
      "geoip_rules",
    ],
    status: "active",
  },
  {
    id:          "military",
    name:        "Firewall Military-Grade",
    description: "NSA/DARPA research + Spybot-inspired hardening — SELinux, AppArmor, SBOM, nftables, MLS, immunization, rootkit scanning.",
    apiPrefix:   "/api/fwm",
    dashPath:    "/firewall",
    tier:        "enterprise",
    riskLevel:   "critical",
    capabilities: [
      "GhostTrap loopback deception (tarpit + labyrinth)",
      "SELinux context management + denial log",
      "AppArmor profile engine + event log",
      "SBOM component tracking + CVE overlay",
      "auditd rule engine + event log",
      "nftables rule sets + named sets",
      "Kernel hardening (sysctl + grsecurity flags)",
      "MLS (Multi-Level Security) policy enforcement",
      "Zero-trust network segments",
      "Hosts file immunization (malware domains)",
      "Tracking domain blocklist",
      "Anti-telemetry firewall rules",
      "Startup entry auditor",
      "Rootkit scanner + findings log",
      "Secure file shredder (DoD 5220.22-M)",
      "PUP signature library",
      "Registry monitor (Windows remote)",
      "IP quarantine + quarantine settings",
    ],
    tableGroups: [
      "ghost_trap_loop_sessions", "ghost_trap_probes", "ghost_trap_config",
      "labyrinth_paths", "tarpit_drain",
      "selinux_contexts", "selinux_denials",
      "apparmor_profiles", "apparmor_events",
      "sbom_components", "sbom_vulns",
      "auditd_rules", "auditd_events",
      "nftables_rules", "nftables_sets",
      "kernel_hardening",
      "mls_policies",
      "zt_segments",
      "hosts_immunization",
      "tracking_domains",
      "anti_telemetry",
      "startup_entries",
      "rootkit_scans", "rootkit_findings",
      "shredder_jobs",
      "pup_signatures",
      "registry_monitor",
      "quarantine_entries", "quarantine_settings",
    ],
    status: "active",
  },
  {
    id:          "policy",
    name:        "Policy Engine v2",
    description: "Declarative policy compiler — version-controlled policies, simulation, rollback, threat-intel integration.",
    apiPrefix:   "/api/firewall-v2",
    dashPath:    "/firewall-compiler",
    tier:        "enterprise",
    riskLevel:   "high",
    capabilities: [
      "Version-controlled policy repository (Git-style)",
      "Policy compiler (declarative → iptables/nftables/eBPF)",
      "Dry-run simulation (traffic match testing)",
      "One-click rollback to any version",
      "Threat-intel rule injection (auto-block known IOCs)",
      "Policy diff viewer",
      "Compliance export (PCI-DSS, HIPAA, NIST)",
    ],
    tableGroups: [
      "firewall_policy_versions",
      "firewall_policy_rules",
      "firewall_policy_simulations",
    ],
    status: "active",
  },
];

export function getFirewallManifest(): FirewallManifest {
  return {
    version:     "2.0.0",
    subsystems:  FIREWALL_SUBSYSTEMS,
    generatedAt: new Date().toISOString(),
  };
}

export function getFirewallCapabilityCount(): number {
  return FIREWALL_SUBSYSTEMS.reduce((sum, s) => sum + s.capabilities.length, 0);
}

export function getFirewallTableCount(): number {
  return FIREWALL_SUBSYSTEMS.reduce((sum, s) => sum + s.tableGroups.length, 0);
}
