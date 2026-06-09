// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { pgTable, serial, text, integer, boolean, timestamp, pgEnum, jsonb, real } from "drizzle-orm/pg-core";

export const firewallDirectionEnum = pgEnum("firewall_direction", ["inbound", "outbound", "both"]);
export const firewallActionEnum = pgEnum("firewall_action", ["allow", "deny", "drop", "reject", "masquerade", "log"]);
export const firewallProtocolEnum = pgEnum("firewall_protocol", ["tcp", "udp", "icmp", "any"]);
export const firewallModeEnum = pgEnum("firewall_mode", ["stealth", "strict", "standard", "learning"]);

export const firewallRulesTable = pgTable("firewall_rules", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  direction: firewallDirectionEnum("direction").notNull(),
  action: firewallActionEnum("action").notNull(),
  protocol: firewallProtocolEnum("protocol").notNull(),
  sourceIp: text("source_ip"),
  sourcePort: text("source_port"),
  destIp: text("dest_ip"),
  destPort: text("dest_port"),
  priority: integer("priority").notNull().default(100),
  enabled: boolean("enabled").notNull().default(true),
  hitCount: integer("hit_count").notNull().default(0),
  description: text("description"),
  isIspMasquerade: boolean("is_isp_masquerade").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const firewallStatusTable = pgTable("firewall_status", {
  id: serial("id").primaryKey(),
  enabled: boolean("enabled").notNull().default(true),
  mode: firewallModeEnum("mode").notNull().default("stealth"),
  packetsBlocked: integer("packets_blocked").notNull().default(0),
  packetsAllowed: integer("packets_allowed").notNull().default(0),
  ispMasqueradeActive: boolean("isp_masquerade_active").notNull().default(true),
  localhostHidden: boolean("localhost_hidden").notNull().default(true),
  dnsMasked: boolean("dns_masked").notNull().default(true),
  lastUpdated: timestamp("last_updated").defaultNow().notNull(),
});

export const blockedIpsTable = pgTable("blocked_ips", {
  id: serial("id").primaryKey(),
  ip: text("ip").notNull(),
  reason: text("reason").notNull(),
  autoBlocked: boolean("auto_blocked").notNull().default(false),
  hitCount: integer("hit_count").notNull().default(1),
  blockedAt: timestamp("blocked_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"),
});

// ── IPS Signature Engine ───────────────────────────────────────────────────
export const firewallIpsSignaturesTable = pgTable("firewall_ips_signatures", {
  id: serial("id").primaryKey(),
  sid: text("sid").notNull().unique(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  severity: text("severity").notNull(),
  pattern: text("pattern").notNull(),
  patternType: text("pattern_type").notNull().default("signature"),
  description: text("description"),
  cveId: text("cve_id"),
  references: text("references"),
  enabled: boolean("enabled").notNull().default(true),
  hitCount: integer("hit_count").notNull().default(0),
  action: text("action").notNull().default("drop"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Deep Packet Inspection Rules ───────────────────────────────────────────
export const firewallDpiRulesTable = pgTable("firewall_dpi_rules", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  pattern: text("pattern").notNull(),
  patternType: text("pattern_type").notNull(),
  action: text("action").notNull().default("block"),
  enabled: boolean("enabled").notNull().default(true),
  hitCount: integer("hit_count").notNull().default(0),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Geo-IP Blocking ────────────────────────────────────────────────────────
export const firewallGeoBlocksTable = pgTable("firewall_geo_blocks", {
  id: serial("id").primaryKey(),
  countryCode: text("country_code").notNull().unique(),
  countryName: text("country_name").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  hitCount: integer("hit_count").notNull().default(0),
  blockedAt: timestamp("blocked_at").defaultNow().notNull(),
});

// ── Threat Intelligence Feeds ──────────────────────────────────────────────
export const firewallThreatFeedsTable = pgTable("firewall_threat_feeds", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  feedType: text("feed_type").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  autoSync: boolean("auto_sync").notNull().default(true),
  lastSyncedAt: timestamp("last_synced_at"),
  entryCount: integer("entry_count").notNull().default(0),
  status: text("status").notNull().default("pending"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Security Zones ─────────────────────────────────────────────────────────
export const firewallZonesTable = pgTable("firewall_zones", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  trustLevel: text("trust_level").notNull(),
  interfaces: text("interfaces"),
  description: text("description"),
  inboundPolicy: text("inbound_policy").notNull().default("deny"),
  outboundPolicy: text("outbound_policy").notNull().default("allow"),
  color: text("color").notNull().default("#00ff88"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── FQDN / Domain-Based Rules ──────────────────────────────────────────────
export const firewallFqdnRulesTable = pgTable("firewall_fqdn_rules", {
  id: serial("id").primaryKey(),
  domain: text("domain").notNull(),
  action: text("action").notNull(),
  direction: text("direction").notNull().default("both"),
  priority: integer("priority").notNull().default(100),
  enabled: boolean("enabled").notNull().default(true),
  hitCount: integer("hit_count").notNull().default(0),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── GhostOS™ ProxhqOS SymScript™ Rules ────────────────────────────────────
// Proprietary symbolic firewall command language — unknown to standard attack tools
export const firewallGhostOsRulesTable = pgTable("firewall_ghostos_rules", {
  id: serial("id").primaryKey(),
  symbolicRule: text("symbolic_rule").notNull(),
  description: text("description"),
  compiledIptables: text("compiled_iptables"),
  compiledNftables: text("compiled_nftables"),
  ruleType: text("rule_type").notNull().default("symscript"),
  enabled: boolean("enabled").notNull().default(true),
  hitCount: integer("hit_count").notNull().default(0),
  lastTriggeredAt: timestamp("last_triggered_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── GhostOS™ Transcriber Log ───────────────────────────────────────────────
export const firewallTranscriberLogTable = pgTable("firewall_transcriber_log", {
  id: serial("id").primaryKey(),
  inputText: text("input_text").notNull(),
  inputFormat: text("input_format").notNull().default("english"),
  outputSymscript: text("output_symscript").notNull(),
  compiledIptables: text("compiled_iptables"),
  applied: boolean("applied").notNull().default(false),
  appliedAt: timestamp("applied_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Connection Approval Queue ──────────────────────────────────────────────────
// Inbound connections that require user approval before being allowed, blocked, or trapped.
// Populated by the WAF, GhostTrap, or any detection system. The frontend polls this
// table and shows a popup asking the user: Allow | Block | Trap.
export const firewallConnectionQueueTable = pgTable("firewall_connection_queue", {
  id:            serial("id").primaryKey(),
  ip:            text("ip").notNull(),
  sourcePort:    integer("source_port"),
  destPort:      integer("dest_port"),
  protocol:      text("protocol").notNull().default("tcp"),
  detectedFrom:  text("detected_from").notNull().default("waf"),  // waf | ghosttrap | beacon | ips | manual
  attackType:    text("attack_type"),
  anomalyScore:  integer("anomaly_score").notNull().default(0),
  payload:       text("payload"),
  userAgent:     text("user_agent"),
  geoCountry:    text("geo_country"),
  geoIsp:        text("geo_isp"),
  reason:        text("reason"),
  status:        text("status").notNull().default("pending"),  // pending | approved | blocked | trapped | dismissed
  resolvedBy:    text("resolved_by"),
  resolvedAt:    timestamp("resolved_at"),
  expiresAt:     timestamp("expires_at"),  // auto-dismiss after this time if not resolved
  createdAt:     timestamp("created_at").defaultNow().notNull(),
});

// ─────────────────────────────────────────────────────────────────────────────
// ── pfSense / OPNsense / IPFire Gap Features ─────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

// ── Alias Manager (pfSense/OPNsense) ─────────────────────────────────────────
// Named reusable groups of hosts, networks, or ports for use in firewall rules.
export const firewallAliasTypeEnum = pgEnum("firewall_alias_type", ["host", "network", "port", "url_table", "geo"]);
export const firewallAliasesTable = pgTable("firewall_aliases", {
  id:          serial("id").primaryKey(),
  name:        text("name").notNull().unique(),
  type:        firewallAliasTypeEnum("type").notNull(),
  description: text("description"),
  entries:     text("entries").notNull(),          // newline-separated IPs, CIDRs, ports, or URLs
  resolvedIps: text("resolved_ips"),               // cached DNS-resolved IPs (JSON array string)
  lastResolved: timestamp("last_resolved"),
  hitCount:    integer("hit_count").notNull().default(0),
  enabled:     boolean("enabled").notNull().default(true),
  createdAt:   timestamp("created_at").defaultNow().notNull(),
});

// ── Schedule-Based Rules (pfSense/OPNsense/IPFire) ───────────────────────────
// Time-gated firewall rule activation — block social media 09:00-17:00, etc.
export const firewallSchedulesTable = pgTable("firewall_schedules", {
  id:          serial("id").primaryKey(),
  name:        text("name").notNull().unique(),
  description: text("description"),
  daysOfWeek:  text("days_of_week").notNull().default("1,2,3,4,5"), // comma-sep: 0=Sun..6=Sat
  timeStart:   text("time_start").notNull().default("09:00"),        // HH:MM
  timeEnd:     text("time_end").notNull().default("17:00"),          // HH:MM
  timezone:    text("timezone").notNull().default("UTC"),
  ruleIds:     text("rule_ids"),                   // JSON array of firewall rule IDs this schedule applies to
  enabled:     boolean("enabled").notNull().default(true),
  createdAt:   timestamp("created_at").defaultNow().notNull(),
});

// ── NAT / Port Forwarding Rules (pfSense/OPNsense) ───────────────────────────
export const natTypeEnum = pgEnum("nat_type", ["port_forward", "nat_1to1", "outbound", "npt"]);
export const firewallNatRulesTable = pgTable("firewall_nat_rules", {
  id:          serial("id").primaryKey(),
  name:        text("name").notNull(),
  natType:     natTypeEnum("nat_type").notNull().default("port_forward"),
  enabled:     boolean("enabled").notNull().default(true),
  protocol:    text("protocol").notNull().default("tcp"),
  interface:   text("interface").notNull().default("WAN"),
  srcIp:       text("src_ip"),                    // source IP/alias (blank = any)
  srcPort:     text("src_port"),
  destIp:      text("dest_ip"),                   // external/destination IP
  destPort:    text("dest_port"),                 // external port
  natIp:       text("nat_ip").notNull(),           // internal target IP
  natPort:     text("nat_port"),                  // internal port (blank = same as dest)
  description: text("description"),
  hitCount:    integer("hit_count").notNull().default(0),
  priority:    integer("priority").notNull().default(100),
  createdAt:   timestamp("created_at").defaultNow().notNull(),
});

// ── Traffic Shaping / QoS (pfSense/OPNsense/IPFire) ─────────────────────────
export const qosActionEnum = pgEnum("qos_action", ["limit", "priority", "guarantee", "drop"]);
export const firewallQosRulesTable = pgTable("firewall_qos_rules", {
  id:             serial("id").primaryKey(),
  name:           text("name").notNull(),
  description:    text("description"),
  direction:      text("direction").notNull().default("both"),     // inbound|outbound|both
  protocol:       text("protocol").notNull().default("any"),
  srcIp:          text("src_ip"),
  destIp:         text("dest_ip"),
  destPort:       text("dest_port"),
  action:         qosActionEnum("action").notNull().default("limit"),
  bandwidthKbps:  integer("bandwidth_kbps"),                       // max Kbps (null = unlimited)
  burstKbps:      integer("burst_kbps"),                          // burst ceiling
  priority:       integer("priority").notNull().default(5),        // 1=highest..8=lowest
  queue:          text("queue").notNull().default("default"),
  enabled:        boolean("enabled").notNull().default(true),
  hitCount:       integer("hit_count").notNull().default(0),
  createdAt:      timestamp("created_at").defaultNow().notNull(),
});

// ── WAN Load Balancing / Failover Groups (pfSense/OPNsense) ──────────────────
export const wanGroupModeEnum = pgEnum("wan_group_mode", ["failover", "load_balance", "round_robin"]);
export const firewallWanGroupsTable = pgTable("firewall_wan_groups", {
  id:          serial("id").primaryKey(),
  name:        text("name").notNull(),
  description: text("description"),
  mode:        wanGroupModeEnum("mode").notNull().default("failover"),
  interfaces:  text("interfaces").notNull(),   // JSON: [{iface, gateway, weight, priority}]
  triggerLevel: text("trigger_level").notNull().default("packetloss"), // packetloss|latency|down
  enabled:     boolean("enabled").notNull().default(true),
  createdAt:   timestamp("created_at").defaultNow().notNull(),
});

// ─────────────────────────────────────────────────────────────────────────────
// ── Snort / Suricata Gap Features ────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────

// ── Portscan Detection Events (Snort sfPortscan / Suricata) ──────────────────
export const portScanTypeEnum = pgEnum("port_scan_type", ["syn", "fin", "xmas", "null", "ack", "udp", "window", "maimon", "connect", "slow"]);
export const portScanEventsTable = pgTable("port_scan_events", {
  id:           serial("id").primaryKey(),
  sourceIp:     text("source_ip").notNull(),
  destIp:       text("dest_ip"),
  scanType:     portScanTypeEnum("scan_type").notNull(),
  portsProbed:  text("ports_probed"),          // JSON array of ports
  portCount:    integer("port_count").notNull().default(0),
  tcpFlags:     text("tcp_flags"),             // e.g. "SYN", "FIN|URG|PSH"
  packetCount:  integer("packet_count").notNull().default(0),
  durationMs:   integer("duration_ms"),
  blocked:      boolean("blocked").notNull().default(false),
  geoCountry:   text("geo_country"),
  geoIsp:       text("geo_isp"),
  addedToBlock: boolean("added_to_block").notNull().default(false),
  detectedAt:   timestamp("detected_at").defaultNow().notNull(),
});

// ── JA3/JA3S TLS Fingerprints (Suricata / Zeek) ──────────────────────────────
// JA3 fingerprints TLS Client Hello; JA3S fingerprints the Server Hello.
// Malware families have distinctive JA3 hashes regardless of domain.
export const ja3VerdictEnum = pgEnum("ja3_verdict", ["malicious", "suspicious", "clean", "unknown"]);
export const tlsFingerprintsTable = pgTable("tls_fingerprints", {
  id:           serial("id").primaryKey(),
  ja3Hash:      text("ja3_hash").notNull().unique(),
  ja3String:    text("ja3_string"),            // full TLS params string
  ja3sHash:     text("ja3s_hash"),             // server-side fingerprint
  verdict:      ja3VerdictEnum("verdict").notNull().default("unknown"),
  malwareFamily: text("malware_family"),       // e.g. "Cobalt Strike", "Emotet", "Trickbot"
  description:  text("description"),
  sniSeen:      text("sni_seen"),              // JSON array of SNI hostnames seen
  action:       text("action").notNull().default("alert"),  // alert|block|allow
  source:       text("source").notNull().default("manual"), // manual|feed|auto
  hitCount:     integer("hit_count").notNull().default(0),
  firstSeen:    timestamp("first_seen").defaultNow().notNull(),
  lastSeen:     timestamp("last_seen").defaultNow().notNull(),
});

// ── DNS Security Monitor (Snort/Suricata/IPFire) ─────────────────────────────
// Detects DGA domains, DNS tunneling, suspicious query patterns.
export const dnsVerdictEnum = pgEnum("dns_verdict", ["clean", "dga", "tunneling", "malware", "phishing", "suspicious"]);
export const dnsSecurityEventsTable = pgTable("dns_security_events", {
  id:            serial("id").primaryKey(),
  queryName:     text("query_name").notNull(),
  queryType:     text("query_type").notNull().default("A"),  // A|AAAA|MX|TXT|NS|PTR|CNAME
  sourceIp:      text("source_ip"),
  responseCode:  text("response_code").notNull().default("NOERROR"), // NOERROR|NXDOMAIN|SERVFAIL
  resolvedIp:    text("resolved_ip"),
  verdict:       dnsVerdictEnum("verdict").notNull().default("clean"),
  dgaScore:      integer("dga_score").notNull().default(0),      // 0-100: DGA likelihood
  tunnelingScore: integer("tunneling_score").notNull().default(0), // 0-100: tunneling likelihood
  entropy:       integer("entropy_x100").notNull().default(0),   // Shannon entropy * 100
  labelCount:    integer("label_count").notNull().default(1),    // subdomain depth
  queryLength:   integer("query_length").notNull().default(0),
  blocked:       boolean("blocked").notNull().default(false),
  detectedAt:    timestamp("detected_at").defaultNow().notNull(),
});

// ── WAF Alert Suppression / Threshold Rules (Snort/Suricata) ────────────────
// Suppress noisy rules or threshold them to only alert after N hits in T seconds.
export const suppressTypeEnum = pgEnum("suppress_type", ["suppress", "threshold", "rate_filter"]);
export const suppressTrackEnum = pgEnum("suppress_track", ["by_src", "by_dst", "by_rule", "global"]);
export const wafSuppressionRulesTable = pgTable("waf_suppression_rules", {
  id:          serial("id").primaryKey(),
  name:        text("name").notNull(),
  type:        suppressTypeEnum("type").notNull().default("suppress"),
  track:       suppressTrackEnum("track").notNull().default("by_src"),
  trackValue:  text("track_value"),            // IP, CIDR, or blank for global
  wafRuleId:   integer("waf_rule_id"),         // suppress a specific WAF rule ID
  ruleName:    text("rule_name"),              // or by rule name pattern
  attackType:  text("attack_type"),            // or suppress entire attack category
  count:       integer("count").notNull().default(5),      // threshold: fire after N events
  seconds:     integer("seconds").notNull().default(60),   // within T seconds
  description: text("description"),
  enabled:     boolean("enabled").notNull().default(true),
  suppressUntil: timestamp("suppress_until"), // temporary suppress expiry
  createdAt:   timestamp("created_at").defaultNow().notNull(),
});

// ── IPFire / Suricata: Web Proxy / Content Filter Rules ──────────────────────
export const proxyActionEnum = pgEnum("proxy_action", ["allow", "block", "redirect", "strip_ssl"]);
export const firewallProxyRulesTable = pgTable("firewall_proxy_rules", {
  id:          serial("id").primaryKey(),
  name:        text("name").notNull(),
  description: text("description"),
  matchType:   text("match_type").notNull().default("domain"),   // domain|url|regex|category|mime
  matchValue:  text("match_value").notNull(),
  action:      proxyActionEnum("action").notNull().default("block"),
  redirectUrl: text("redirect_url"),           // for redirect action
  categories:  text("categories"),             // JSON: ["ads","malware","adult","social"]
  applyToIps:  text("apply_to_ips"),          // JSON: restrict rule to specific source IPs
  enabled:     boolean("enabled").notNull().default(true),
  hitCount:    integer("hit_count").notNull().default(0),
  priority:    integer("priority").notNull().default(100),
  createdAt:   timestamp("created_at").defaultNow().notNull(),
});

// ════════════════════════════════════════════════════════════════════════════
// ── 2024-2025 NEXT-GEN FIREWALL TECHNOLOGIES ─────────────────────────────
// ════════════════════════════════════════════════════════════════════════════

// ── 1. eBPF / XDP Rule Engine ─────────────────────────────────────────────
export const ebpfProgramTypeEnum = pgEnum("ebpf_program_type", ["xdp","tc","cgroup_skb","socket_filter"]);
export const ebpfActionEnum      = pgEnum("ebpf_action",       ["drop","pass","redirect","tx","log","rate_limit"]);
export const ebpfHookEnum        = pgEnum("ebpf_hook",         ["ingress","egress","both"]);
export const ebpfRulesTable = pgTable("ebpf_rules", {
  id:           serial("id").primaryKey(),
  name:         text("name").notNull(),
  description:  text("description"),
  programType:  ebpfProgramTypeEnum("program_type").notNull().default("xdp"),
  hook:         ebpfHookEnum("hook").notNull().default("ingress"),
  iface:        text("iface").notNull().default("eth0"),
  priority:     integer("priority").notNull().default(100),
  enabled:      boolean("enabled").notNull().default(true),
  matchSrcIp:   text("match_src_ip"),
  matchDstIp:   text("match_dst_ip"),
  matchSrcPort: integer("match_src_port"),
  matchDstPort: integer("match_dst_port"),
  matchProto:   text("match_proto"),          // tcp|udp|icmp|any
  matchFlags:   jsonb("match_flags"),         // { syn, ack, fin, rst, ... }
  action:       ebpfActionEnum("action").notNull().default("drop"),
  redirectIface:text("redirect_iface"),
  rateLimit:    integer("rate_limit_pps"),    // packets per second for rate_limit action
  statsPackets: integer("stats_packets").notNull().default(0),
  statsBytes:   integer("stats_bytes").notNull().default(0),
  lastHit:      timestamp("last_hit"),
  createdAt:    timestamp("created_at").defaultNow().notNull(),
});

// ── 2. QUIC / HTTP3 Inspector ─────────────────────────────────────────────
export const quicActionEnum = pgEnum("quic_action", ["allow","block","log","throttle"]);
export const quicEventsTable = pgTable("quic_events", {
  id:           serial("id").primaryKey(),
  srcIp:        text("src_ip").notNull(),
  dstIp:        text("dst_ip").notNull(),
  srcPort:      integer("src_port"),
  dstPort:      integer("dst_port").notNull().default(443),
  sni:          text("sni"),
  connectionId: text("connection_id"),
  quicVersion:  text("quic_version"),
  echDetected:  boolean("ech_detected").notNull().default(false),
  action:       quicActionEnum("action").notNull().default("log"),
  bytesIn:      integer("bytes_in").notNull().default(0),
  bytesOut:     integer("bytes_out").notNull().default(0),
  detectedAt:   timestamp("detected_at").defaultNow().notNull(),
});

// ── 3. Encrypted Traffic Analyzer (ETA) ──────────────────────────────────
export const etaClassEnum = pgEnum("eta_class", ["streaming","vpn","c2_beacon","malware","browsing","voip","gaming","p2p","encrypted_dns","unknown"]);
export const etaFlowsTable = pgTable("eta_flows", {
  id:             serial("id").primaryKey(),
  srcIp:          text("src_ip").notNull(),
  dstIp:          text("dst_ip").notNull(),
  dstPort:        integer("dst_port"),
  protocol:       text("protocol").notNull().default("tcp"),
  packetCount:    integer("packet_count").notNull().default(0),
  byteCount:      integer("byte_count").notNull().default(0),
  avgPacketSize:  real("avg_packet_size"),
  maxPacketSize:  integer("max_packet_size"),
  minPacketSize:  integer("min_packet_size"),
  byteEntropy:    real("byte_entropy"),         // Shannon entropy 0-8
  iatMeanMs:      real("iat_mean_ms"),          // Inter-arrival time mean
  iatStdMs:       real("iat_std_ms"),           // Inter-arrival time std dev
  burstCount:     integer("burst_count"),       // Number of burst events
  classification: etaClassEnum("classification").notNull().default("unknown"),
  confidencePct:  real("confidence_pct"),
  action:         text("action").notNull().default("log"),
  flowStart:      timestamp("flow_start").defaultNow().notNull(),
  flowEnd:        timestamp("flow_end"),
});

// ── 4. ECH Policy Engine ─────────────────────────────────────────────────
export const echActionEnum = pgEnum("ech_action", ["allow","block","log","alert"]);
export const echEventsTable = pgTable("ech_events", {
  id:                 serial("id").primaryKey(),
  srcIp:              text("src_ip").notNull(),
  dstIp:              text("dst_ip").notNull(),
  dstPort:            integer("dst_port").notNull().default(443),
  outerSni:           text("outer_sni"),          // ECH public_name (not the real SNI)
  echConfigId:        integer("ech_config_id"),
  clientHelloType:    text("client_hello_type"),  // "outer" | "inner"
  tlsVersion:         text("tls_version"),
  action:             echActionEnum("action").notNull().default("log"),
  detectedAt:         timestamp("detected_at").defaultNow().notNull(),
});

// ── 5. DoH / DoT Enforcer ─────────────────────────────────────────────────
export const dohResolverTypeEnum = pgEnum("doh_resolver_type", ["doh","dot","doq","doh3"]);
export const dohActionEnum       = pgEnum("doh_action",        ["allow","block","redirect","log"]);
export const dohEventsTable = pgTable("doh_events", {
  id:           serial("id").primaryKey(),
  srcIp:        text("src_ip").notNull(),
  resolverIp:   text("resolver_ip").notNull(),
  resolverName: text("resolver_name"),
  resolverType: dohResolverTypeEnum("resolver_type").notNull().default("doh"),
  queryDomain:  text("query_domain"),
  responseCode: integer("response_code"),
  action:       dohActionEnum("action").notNull().default("log"),
  detectedAt:   timestamp("detected_at").defaultNow().notNull(),
});

// ── 6. Lateral Movement Detector ─────────────────────────────────────────
export const lateralTechniqueEnum = pgEnum("lateral_technique", [
  "smb_scan","rdp_scan","ssh_scan","winrm","ldap_enum",
  "kerberoasting","wmi","psexec","dcom","pass_the_hash",
  "credential_spray","port_sweep","mimikatz_pattern",
]);
export const lateralSeverityEnum = pgEnum("lateral_severity", ["low","medium","high","critical"]);
export const lateralEventsTable = pgTable("lateral_events", {
  id:            serial("id").primaryKey(),
  srcIp:         text("src_ip").notNull(),
  dstIp:         text("dst_ip").notNull(),
  dstPort:       integer("dst_port"),
  protocol:      text("protocol").notNull().default("tcp"),
  technique:     lateralTechniqueEnum("technique").notNull(),
  severity:      lateralSeverityEnum("severity").notNull().default("medium"),
  action:        text("action").notNull().default("alert"),    // alert|block
  confidencePct: real("confidence_pct"),
  indicators:    jsonb("indicators"),     // { portsScanned, packetsPerSec, ... }
  autoBlocked:   boolean("auto_blocked").notNull().default(false),
  detectedAt:    timestamp("detected_at").defaultNow().notNull(),
});

// ── 7. NetFlow / IPFIX Collector ─────────────────────────────────────────
export const netflowAnomalyEnum = pgEnum("netflow_anomaly", ["none","top_talker","port_sweep","data_exfil","beaconing","ddos","protocol_abuse"]);
export const netflowRecordsTable = pgTable("netflow_records", {
  id:           serial("id").primaryKey(),
  srcIp:        text("src_ip").notNull(),
  dstIp:        text("dst_ip").notNull(),
  srcPort:      integer("src_port"),
  dstPort:      integer("dst_port"),
  protocol:     text("protocol").notNull().default("tcp"),
  packets:      integer("packets").notNull().default(0),
  bytes:        integer("bytes").notNull().default(0),
  durationMs:   integer("duration_ms"),
  tcpFlags:     text("tcp_flags"),      // hex string: "0x002" = SYN
  tos:          integer("tos"),
  srcAs:        integer("src_as"),      // BGP AS number
  dstAs:        integer("dst_as"),
  anomalyScore: real("anomaly_score").notNull().default(0),
  anomalyType:  netflowAnomalyEnum("anomaly_type").notNull().default("none"),
  flowStart:    timestamp("flow_start").defaultNow().notNull(),
  flowEnd:      timestamp("flow_end"),
});

// ── 8. Supply Chain Guard ─────────────────────────────────────────────────
export const supplyChainAlertTypeEnum = pgEnum("supply_chain_alert_type", ["new_destination","cert_change","unexpected_protocol","data_exfil","unexpected_port","dns_change"]);
export const supplyChainSeverityEnum  = pgEnum("supply_chain_severity",   ["low","medium","high","critical"]);
export const supplyChainAlertsTable = pgTable("supply_chain_alerts", {
  id:               serial("id").primaryKey(),
  monitoredProcess: text("monitored_process").notNull(),
  srcIp:            text("src_ip"),
  dstIp:            text("dst_ip"),
  dstDomain:        text("dst_domain"),
  dstPort:          integer("dst_port"),
  alertType:        supplyChainAlertTypeEnum("alert_type").notNull(),
  severity:         supplyChainSeverityEnum("severity").notNull().default("medium"),
  baselineId:       text("baseline_id"),
  details:          text("details"),
  action:           text("action").notNull().default("alert"),
  detectedAt:       timestamp("detected_at").defaultNow().notNull(),
});

// ── 9. AI Rule Builder ────────────────────────────────────────────────────
export const aiGeneratedRulesTable = pgTable("ai_generated_rules", {
  id:           serial("id").primaryKey(),
  inputText:    text("input_text").notNull(),
  generatedRule:jsonb("generated_rule"),   // structured rule object
  ruleType:     text("rule_type"),         // block|allow|rate_limit|redirect|alert
  confidence:   real("confidence_pct"),
  approved:     boolean("approved").notNull().default(false),
  applied:      boolean("applied").notNull().default(false),
  createdAt:    timestamp("created_at").defaultNow().notNull(),
});

// ── 10. RPKI / BGP Route Guard ────────────────────────────────────────────
export const rpkiStatusEnum = pgEnum("rpki_status", ["valid","invalid","not_found","error"]);
export const rpkiChecksTable = pgTable("rpki_checks", {
  id:                serial("id").primaryKey(),
  prefix:            text("prefix").notNull(),
  asn:               integer("asn"),
  validatedOriginAsn:integer("validated_origin_asn"),
  maxLength:         integer("max_length"),
  status:            rpkiStatusEnum("status").notNull().default("not_found"),
  roaCount:          integer("roa_count").notNull().default(0),
  invalidReasons:    text("invalid_reasons"),
  checkedAt:         timestamp("checked_at").defaultNow().notNull(),
});

// ── 11. Deception Layer ───────────────────────────────────────────────────
export const deceptionProtocolEnum = pgEnum("deception_protocol", ["tcp","udp"]);
export const deceptionPortsTable = pgTable("deception_ports", {
  id:               serial("id").primaryKey(),
  port:             integer("port").notNull(),
  protocol:         deceptionProtocolEnum("protocol").notNull().default("tcp"),
  serviceEmulation: text("service_emulation").notNull().default("generic"),  // ssh|http|ftp|smb|rdp|generic
  banner:           text("banner"),
  enabled:          boolean("enabled").notNull().default(true),
  autoBlacklist:    boolean("auto_blacklist").notNull().default(true),
  triggerCount:     integer("trigger_count").notNull().default(0),
  lastTriggered:    timestamp("last_triggered"),
  createdAt:        timestamp("created_at").defaultNow().notNull(),
});
export const deceptionTriggersTable = pgTable("deception_triggers", {
  id:           serial("id").primaryKey(),
  portId:       integer("port_id").notNull().references(() => deceptionPortsTable.id, { onDelete:"cascade" }),
  srcIp:        text("src_ip").notNull(),
  srcPort:      integer("src_port"),
  userAgent:    text("user_agent"),
  payloadHex:   text("payload_hex"),
  bytesReceived:integer("bytes_received").notNull().default(0),
  autoBlocked:  boolean("auto_blocked").notNull().default(false),
  detectedAt:   timestamp("detected_at").defaultNow().notNull(),
});

// ── 12. Geo-IP Firewall ───────────────────────────────────────────────────
export const geoipActionEnum = pgEnum("geoip_action", ["block","allow","monitor","redirect","tarpit"]);
export const geoipRulesTable = pgTable("geoip_rules", {
  id:          serial("id").primaryKey(),
  countryCode: text("country_code").notNull(),     // ISO 3166-1 alpha-2
  countryName: text("country_name").notNull(),
  continent:   text("continent"),
  action:      geoipActionEnum("action").notNull().default("block"),
  enabled:     boolean("enabled").notNull().default(true),
  hitCount:    integer("hit_count").notNull().default(0),
  lastHit:     timestamp("last_hit"),
  description: text("description"),
  createdAt:   timestamp("created_at").defaultNow().notNull(),
});

export type InsertFirewallRule    = typeof firewallRulesTable.$inferInsert;
export type FirewallRule          = typeof firewallRulesTable.$inferSelect;
export type FirewallStatus        = typeof firewallStatusTable.$inferSelect;
export type BlockedIp             = typeof blockedIpsTable.$inferSelect;
export type IpsSignature          = typeof firewallIpsSignaturesTable.$inferSelect;
export type DpiRule               = typeof firewallDpiRulesTable.$inferSelect;
export type GeoBlock              = typeof firewallGeoBlocksTable.$inferSelect;
export type ThreatFeed            = typeof firewallThreatFeedsTable.$inferSelect;
export type FirewallZone          = typeof firewallZonesTable.$inferSelect;
export type FqdnRule              = typeof firewallFqdnRulesTable.$inferSelect;
export type GhostOsRule           = typeof firewallGhostOsRulesTable.$inferSelect;
export type TranscriberLog        = typeof firewallTranscriberLogTable.$inferSelect;
export type ConnectionQueueEntry  = typeof firewallConnectionQueueTable.$inferSelect;
export type FirewallAlias         = typeof firewallAliasesTable.$inferSelect;
export type FirewallSchedule      = typeof firewallSchedulesTable.$inferSelect;
export type NatRule               = typeof firewallNatRulesTable.$inferSelect;
export type QosRule               = typeof firewallQosRulesTable.$inferSelect;
export type WanGroup              = typeof firewallWanGroupsTable.$inferSelect;
export type PortScanEvent         = typeof portScanEventsTable.$inferSelect;
export type TlsFingerprint        = typeof tlsFingerprintsTable.$inferSelect;
export type DnsSecurityEvent      = typeof dnsSecurityEventsTable.$inferSelect;
export type WafSuppressionRule    = typeof wafSuppressionRulesTable.$inferSelect;
export type ProxyRule             = typeof firewallProxyRulesTable.$inferSelect;

// ═══════════════════════════════════════════════════════════════════════════
// ── MILITARY-GRADE + SPYBOT-INSPIRED FEATURES ────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

// ── 1. SELinux MAC Engine ──────────────────────────────────────────────────
export const selinuxModeEnum    = pgEnum("selinux_mode",   ["enforcing","permissive","disabled"]);
export const selinuxTypeEnum    = pgEnum("selinux_type",   ["targeted","minimum","mls"]);
export const selinuxContextsTable = pgTable("selinux_contexts", {
  id:        serial("id").primaryKey(),
  domain:    text("domain").notNull(),
  type:      text("type").notNull(),
  role:      text("role").notNull().default("system_r"),
  level:     text("level").default("s0"),
  mode:      selinuxModeEnum("mode").notNull().default("enforcing"),
  enabled:   boolean("enabled").notNull().default(true),
  policy:    text("policy"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export const selinuxDenialsTable = pgTable("selinux_denials", {
  id:          serial("id").primaryKey(),
  avcMessage:  text("avc_message").notNull(),
  sourceType:  text("source_type").notNull(),
  targetType:  text("target_type").notNull(),
  targetClass: text("target_class").notNull(),
  permission:  text("permission").notNull(),
  pid:         integer("pid"),
  comm:        text("comm"),
  path:        text("path"),
  denied:      boolean("denied").notNull().default(true),
  detectedAt:  timestamp("detected_at").defaultNow().notNull(),
});

// ── 2. AppArmor Profile Manager ────────────────────────────────────────────
export const apparmorModeEnum = pgEnum("apparmor_mode", ["enforce","complain","disabled","audit"]);
export const apparmorProfilesTable = pgTable("apparmor_profiles", {
  id:          serial("id").primaryKey(),
  name:        text("name").notNull(),
  executable:  text("executable").notNull(),
  mode:        apparmorModeEnum("mode").notNull().default("enforce"),
  profileText: text("profile_text"),
  denialCount: integer("denial_count").notNull().default(0),
  enabled:     boolean("enabled").notNull().default(true),
  createdAt:   timestamp("created_at").defaultNow().notNull(),
  lastEvent:   timestamp("last_event"),
});
export const apparmorEventsTable = pgTable("apparmor_events", {
  id:          serial("id").primaryKey(),
  profileName: text("profile_name").notNull(),
  operation:   text("operation").notNull(),
  requested:   text("requested_mask"),
  denied:      text("denied_mask"),
  fsuid:       integer("fsuid"),
  ouid:        integer("ouid"),
  name:        text("name"),
  action:      text("action").notNull().default("denied"),
  detectedAt:  timestamp("detected_at").defaultNow().notNull(),
});

// ── 3. SBOM / NVD CVE Scanner ──────────────────────────────────────────────
export const sbomComponentsTable = pgTable("sbom_components", {
  id:           serial("id").primaryKey(),
  name:         text("name").notNull(),
  version:      text("version").notNull(),
  ecosystem:    text("ecosystem").notNull(), // npm, pip, apt, cargo, gem
  purl:         text("purl"),
  license:      text("license"),
  cveCount:     integer("cve_count").notNull().default(0),
  criticalCves: integer("critical_cves").notNull().default(0),
  highCves:     integer("high_cves").notNull().default(0),
  riskScore:    integer("risk_score").notNull().default(0),
  scannedAt:    timestamp("scanned_at").defaultNow().notNull(),
});
export const sbomVulnsTable = pgTable("sbom_vulns", {
  id:          serial("id").primaryKey(),
  componentId: integer("component_id").notNull(),
  cveId:       text("cve_id").notNull(),
  severity:    text("severity").notNull(), // critical/high/medium/low
  cvssScore:   real("cvss_score"),
  description: text("description"),
  fixedIn:     text("fixed_in"),
  publishedAt: timestamp("published_at"),
  createdAt:   timestamp("created_at").defaultNow().notNull(),
});

// ── 4. auditd Syscall Auditing ─────────────────────────────────────────────
export const auditdRulesTable = pgTable("auditd_rules", {
  id:         serial("id").primaryKey(),
  ruleText:   text("rule_text").notNull(),
  ruleType:   text("rule_type").notNull().default("syscall"), // syscall/file/exit/always
  syscall:    text("syscall"),
  arch:       text("arch").default("b64"),
  action:     text("action").notNull().default("always,exit"), // always,exit | always,entry | never
  fields:     text("fields"),  // -F uid=0 etc
  key:        text("key"),
  enabled:    boolean("enabled").notNull().default(true),
  priority:   integer("priority").notNull().default(100),
  createdAt:  timestamp("created_at").defaultNow().notNull(),
});
export const auditdEventsTable = pgTable("auditd_events", {
  id:          serial("id").primaryKey(),
  type:        text("type").notNull(), // SYSCALL, EXECVE, PROCTITLE, PATH
  syscall:     text("syscall"),
  pid:         integer("pid"),
  uid:         integer("uid"),
  gid:         integer("gid"),
  auid:        integer("auid"),
  comm:        text("comm"),
  exe:         text("exe"),
  key:         text("key"),
  success:     boolean("success"),
  rawMessage:  text("raw_message"),
  severity:    text("severity").notNull().default("info"),
  detectedAt:  timestamp("detected_at").defaultNow().notNull(),
});

// ── 5. nftables Rule Engine ────────────────────────────────────────────────
export const nftablesChainEnum = pgEnum("nftables_chain", ["input","output","forward","prerouting","postrouting"]);
export const nftablesActionEnum = pgEnum("nftables_action", ["accept","drop","reject","log","jump","goto","masquerade","dnat","snat","counter"]);
export const nftablesRulesTable = pgTable("nftables_rules", {
  id:         serial("id").primaryKey(),
  table:      text("table").notNull().default("filter"),
  chain:      nftablesChainEnum("chain").notNull().default("input"),
  priority:   integer("priority").notNull().default(0),
  matchSrcIp: text("match_src_ip"),
  matchDstIp: text("match_dst_ip"),
  matchSrcPort: integer("match_src_port"),
  matchDstPort: integer("match_dst_port"),
  matchProto: text("match_proto"),
  matchIface: text("match_iface"),
  setName:    text("set_name"),   // reference to an nftables set
  action:     nftablesActionEnum("action").notNull().default("drop"),
  counter:    boolean("counter").notNull().default(true),
  comment:    text("comment"),
  enabled:    boolean("enabled").notNull().default(true),
  pktCount:   integer("pkt_count").notNull().default(0),
  byteCount:  integer("byte_count").notNull().default(0),
  createdAt:  timestamp("created_at").defaultNow().notNull(),
});
export const nftablesSetsTable = pgTable("nftables_sets", {
  id:        serial("id").primaryKey(),
  name:      text("name").notNull().unique(),
  type:      text("type").notNull().default("ipv4_addr"), // ipv4_addr/ipv6_addr/inet_proto/inet_service
  flags:     text("flags"),   // interval, timeout, etc
  elements:  text("elements").array(), // array of entries
  timeout:   integer("timeout"),       // seconds, for dynamic sets
  comment:   text("comment"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── 6. Kernel Hardening Monitor ───────────────────────────────────────────
export const kernelParamStatusEnum = pgEnum("kernel_param_status", ["secure","warning","critical","unknown"]);
export const kernelHardeningTable = pgTable("kernel_hardening", {
  id:           serial("id").primaryKey(),
  paramPath:    text("param_path").notNull().unique(), // /proc/sys/kernel/dmesg_restrict
  paramName:    text("param_name").notNull(),
  currentValue: text("current_value"),
  recommendedValue: text("recommended_value").notNull(),
  status:       kernelParamStatusEnum("status").notNull().default("unknown"),
  category:     text("category").notNull().default("kernel"), // kernel/net/fs/vm/user
  description:  text("description"),
  mitigation:   text("mitigation"),
  cve:          text("cve"),
  checkedAt:    timestamp("checked_at").defaultNow().notNull(),
});

// ── 7. MLS / Bell-LaPadula Classification Engine ──────────────────────────
export const mlsLevelEnum = pgEnum("mls_level", ["unclassified","confidential","secret","top_secret","sci"]);
export const mlsPoliciesTable = pgTable("mls_policies", {
  id:          serial("id").primaryKey(),
  subjectLabel: text("subject_label").notNull(),  // user/process
  objectLabel:  text("object_label").notNull(),   // file/resource
  subjectLevel: mlsLevelEnum("subject_level").notNull().default("unclassified"),
  objectLevel:  mlsLevelEnum("object_level").notNull().default("unclassified"),
  canRead:     boolean("can_read").notNull().default(false),
  canWrite:    boolean("can_write").notNull().default(false),
  canExecute:  boolean("can_execute").notNull().default(false),
  bellLapadura: boolean("bell_lapadula").notNull().default(true), // enforce no-read-up/no-write-down
  bibaModel:   boolean("biba_model").notNull().default(false),    // integrity model
  description: text("description"),
  createdAt:   timestamp("created_at").defaultNow().notNull(),
});

// ── 8. Zero Trust Microsegmentation ───────────────────────────────────────
export const ztActionEnum = pgEnum("zt_action", ["allow","deny","inspect","alert"]);
export const ztSegmentsTable = pgTable("zt_segments", {
  id:          serial("id").primaryKey(),
  name:        text("name").notNull(),
  description: text("description"),
  srcLabel:    text("src_label").notNull(),   // workload identity / namespace
  dstLabel:    text("dst_label").notNull(),
  srcIpRange:  text("src_ip_range"),
  dstIpRange:  text("dst_ip_range"),
  ports:       integer("ports").array(),
  protocols:   text("protocols").array(),
  action:      ztActionEnum("action").notNull().default("deny"),
  mTls:        boolean("mtls").notNull().default(true),
  jwtRequired: boolean("jwt_required").notNull().default(true),
  enabled:     boolean("enabled").notNull().default(true),
  violationCount: integer("violation_count").notNull().default(0),
  createdAt:   timestamp("created_at").defaultNow().notNull(),
});

// ── 9. Hosts File Immunizer (Spybot) ──────────────────────────────────────
export const hostsImmunizationTable = pgTable("hosts_immunization", {
  id:        serial("id").primaryKey(),
  domain:    text("domain").notNull().unique(),
  category:  text("category").notNull().default("malware"), // malware/tracking/ads/phishing/telemetry/c2
  source:    text("source"),   // StevenBlack, Spybot, custom, etc
  redirectTo: text("redirect_to").notNull().default("0.0.0.0"),
  enabled:   boolean("enabled").notNull().default(true),
  hitCount:  integer("hit_count").notNull().default(0),
  addedAt:   timestamp("added_at").defaultNow().notNull(),
});

// ── 10. Tracking Domain Blocker (Spybot) ──────────────────────────────────
export const trackingDomainsTable = pgTable("tracking_domains", {
  id:        serial("id").primaryKey(),
  domain:    text("domain").notNull().unique(),
  vendor:    text("vendor"),    // Google, Meta, Amazon, etc
  category:  text("category").notNull(), // analytics/pixel/fingerprint/session_replay/ad_network
  cookieName: text("cookie_name"),
  blocked:   boolean("blocked").notNull().default(true),
  hitCount:  integer("hit_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── 11. Anti-Telemetry Firewall (Spybot Anti-Beacon) ──────────────────────
export const telemetryVendorEnum = pgEnum("telemetry_vendor", ["microsoft","google","apple","amazon","meta","adobe","mozilla","samsung","sony","valve"]);
export const antiTelemetryTable = pgTable("anti_telemetry", {
  id:        serial("id").primaryKey(),
  domain:    text("domain"),
  ipRange:   text("ip_range"),
  vendor:    telemetryVendorEnum("vendor").notNull().default("microsoft"),
  service:   text("service"),   // "Windows Update Telemetry", "Google Analytics" etc
  blocked:   boolean("blocked").notNull().default(true),
  iptablesRule: text("iptables_rule"),
  hitCount:  integer("hit_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── 12. Startup Process Auditor (Spybot) ──────────────────────────────────
export const startupRiskEnum = pgEnum("startup_risk", ["clean","suspicious","malicious","unknown"]);
export const startupEntriesTable = pgTable("startup_entries", {
  id:         serial("id").primaryKey(),
  name:       text("name").notNull(),
  command:    text("command").notNull(),
  location:   text("location").notNull(), // systemd/crontab/init.d/rc.local/autorun etc
  enabled:    boolean("enabled").notNull().default(true),
  risk:       startupRiskEnum("risk").notNull().default("unknown"),
  riskReason: text("risk_reason"),
  hash:       text("hash"),   // SHA256 of executable
  signature:  text("signature"), // code signing status
  scannedAt:  timestamp("scanned_at").defaultNow().notNull(),
});

// ── 13. Rootkit Scanner (Spybot RootAlyzer) ───────────────────────────────
export const rootkitSeverityEnum = pgEnum("rootkit_severity", ["critical","high","medium","low","clean"]);
export const rootkitScansTable = pgTable("rootkit_scans", {
  id:           serial("id").primaryKey(),
  scanType:     text("scan_type").notNull().default("full"), // full/quick/memory/network
  totalChecks:  integer("total_checks").notNull().default(0),
  findings:     integer("findings").notNull().default(0),
  criticalCount: integer("critical_count").notNull().default(0),
  status:       text("status").notNull().default("running"), // running/complete/failed
  startedAt:    timestamp("started_at").defaultNow().notNull(),
  completedAt:  timestamp("completed_at"),
});
export const rootkitFindingsTable = pgTable("rootkit_findings", {
  id:          serial("id").primaryKey(),
  scanId:      integer("scan_id").notNull(),
  type:        text("type").notNull(), // hidden_process/hidden_port/hidden_file/kernel_module/ld_preload/hooks
  description: text("description").notNull(),
  location:    text("location"),
  severity:    rootkitSeverityEnum("severity").notNull().default("medium"),
  details:     jsonb("details"),
  detectedAt:  timestamp("detected_at").defaultNow().notNull(),
});

// ── 14. Secure File Shredder (Spybot) ─────────────────────────────────────
export const shredderMethodEnum = pgEnum("shredder_method", ["dod_5220","gutmann","nist_800_88","random_1pass","zeros_1pass","prng_3pass"]);
export const shredderJobsTable = pgTable("shredder_jobs", {
  id:        serial("id").primaryKey(),
  path:      text("path").notNull(),
  method:    shredderMethodEnum("method").notNull().default("dod_5220"),
  passes:    integer("passes").notNull().default(3),
  fileSizeBytes: integer("file_size_bytes"),
  status:    text("status").notNull().default("pending"), // pending/running/complete/failed
  script:    text("script"),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

// ── 15. PUP / Adware Signature Database (Spybot) ──────────────────────────
export const pupRiskEnum = pgEnum("pup_risk", ["critical","high","medium","low"]);
export const pupSignaturesTable = pgTable("pup_signatures", {
  id:          serial("id").primaryKey(),
  name:        text("name").notNull(),
  category:    text("category").notNull(), // adware/pup/spyware/browser_hijacker/rogue_av/toolbar/crypto_miner
  description: text("description"),
  indicators:  jsonb("indicators"),  // file paths, registry keys, process names, domains
  risk:        pupRiskEnum("risk").notNull().default("medium"),
  detections:  integer("detections").notNull().default(0),
  lastSeen:    timestamp("last_seen"),
  createdAt:   timestamp("created_at").defaultNow().notNull(),
});

// ── 16. Registry Key Monitor (Spybot) ─────────────────────────────────────
export const registryMonitorTable = pgTable("registry_monitor", {
  id:           serial("id").primaryKey(),
  keyPath:      text("key_path").notNull(),        // e.g. HKLM\Software\Microsoft\Windows\CurrentVersion\Run
  valueName:    text("value_name"),
  expectedValue: text("expected_value"),           // null = should not exist
  currentValue:  text("current_value"),
  changed:      boolean("changed").notNull().default(false),
  deleted:      boolean("deleted").notNull().default(false),
  category:     text("category").notNull().default("autorun"), // autorun/browser/services/policy
  risk:         text("risk").notNull().default("medium"),
  checkedAt:    timestamp("checked_at").defaultNow().notNull(),
});

// ── 17. File Quarantine Engine ─────────────────────────────────────────────
export const quarantineStatusEnum = pgEnum("quarantine_status", ["quarantined","deleted","restored","allowed","review_pending"]);
export const quarantineSeverityEnum = pgEnum("quarantine_severity", ["critical","high","medium","low","clean"]);
export const quarantineThreatEnum = pgEnum("quarantine_threat", ["malware","ransomware","trojan","spyware","adware","pup","exploit","dropper","cryptominer","rootkit","keylogger","worm","virus","phishing","suspicious","unknown"]);

export const quarantineEntriesTable = pgTable("quarantine_entries", {
  id:              serial("id").primaryKey(),
  fileName:        text("file_name").notNull(),
  originalPath:    text("original_path").notNull(),
  quarantinePath:  text("quarantine_path").notNull(),
  downloadedFrom:  text("downloaded_from"),             // URL or null
  fileHash:        text("file_hash"),                   // SHA-256
  fileSizeBytes:   integer("file_size_bytes"),
  mimeType:        text("mime_type"),
  threatType:      quarantineThreatEnum("threat_type"),
  threatName:      text("threat_name"),                 // e.g. "Trojan.GenericKD.48398221"
  severity:        quarantineSeverityEnum("severity").notNull().default("medium"),
  scanEngine:      text("scan_engine").notNull().default("ProxhqScan"),
  detectionReason: text("detection_reason"),
  status:          quarantineStatusEnum("status").notNull().default("quarantined"),
  userNote:        text("user_note"),
  detectedAt:      timestamp("detected_at").defaultNow().notNull(),
  reviewedAt:      timestamp("reviewed_at"),
});

export const quarantineSettingsTable = pgTable("quarantine_settings", {
  id:                  serial("id").primaryKey(),
  containerPath:       text("container_path").notNull().default("/var/proxhq/quarantine"),
  scanOnDownload:      boolean("scan_on_download").notNull().default(true),
  scanOnOpen:          boolean("scan_on_open").notNull().default(true),
  autoQuarantine:      boolean("auto_quarantine").notNull().default(true),
  maxContainerSizeMb:  integer("max_container_size_mb").notNull().default(2048),
  retentionDays:       integer("retention_days").notNull().default(30),
  notifyOnDetection:   boolean("notify_on_detection").notNull().default(true),
  scanArchives:        boolean("scan_archives").notNull().default(true),
  scanMacros:          boolean("scan_macros").notNull().default(true),
  updatedAt:           timestamp("updated_at").defaultNow().notNull(),
});

// ── ProxhqAV Antivirus Engine ──────────────────────────────────────────────
export const avSigTypeEnum    = pgEnum("av_sig_type",    ["sha256","sha1","md5","ssdeep","imphash","tlsh"]);
export const avThreatEnum     = pgEnum("av_threat_type", ["ransomware","trojan","worm","virus","spyware","adware","rootkit","dropper","loader","exploit","keylogger","banker","stealer","rat","backdoor","botnet","miner","pup","webshell","fileless","lolbin","cobalt_strike","metasploit","unknown"]);
export const avSeverityEnum   = pgEnum("av_severity",    ["critical","high","medium","low","informational"]);
export const avIocTypeEnum    = pgEnum("av_ioc_type",    ["ip","cidr","domain","url","sha256","md5","sha1","filename","mutex","registry","email","useragent"]);
export const avScanStatusEnum = pgEnum("av_scan_status", ["running","complete","failed","cancelled"]);

export const avSignaturesTable = pgTable("av_signatures", {
  id:           serial("id").primaryKey(),
  hashType:     avSigTypeEnum("hash_type").notNull().default("sha256"),
  hashValue:    text("hash_value").notNull(),
  threatType:   avThreatEnum("threat_type").notNull(),
  malwareFamily:text("malware_family").notNull(),
  malwareName:  text("malware_name").notNull(),
  severity:     avSeverityEnum("severity").notNull(),
  source:       text("source").notNull().default("ProxhqAV"),
  description:  text("description"),
  firstSeen:    text("first_seen"),
  cveIds:       text("cve_ids"),
  tags:         text("tags"),
  enabled:      boolean("enabled").notNull().default(true),
  hitCount:     integer("hit_count").notNull().default(0),
  addedAt:      timestamp("added_at").defaultNow().notNull(),
});

export const avIocTable = pgTable("av_ioc_entries", {
  id:           serial("id").primaryKey(),
  iocType:      avIocTypeEnum("ioc_type").notNull(),
  value:        text("value").notNull(),
  threatType:   avThreatEnum("threat_type").notNull(),
  malwareFamily:text("malware_family"),
  severity:     avSeverityEnum("severity").notNull(),
  confidence:   integer("confidence").notNull().default(80),   // 0-100
  source:       text("source").notNull(),
  description:  text("description"),
  firstSeen:    text("first_seen"),
  lastSeen:     text("last_seen"),
  tags:         text("tags"),
  enabled:      boolean("enabled").notNull().default(true),
  hitCount:     integer("hit_count").notNull().default(0),
  addedAt:      timestamp("added_at").defaultNow().notNull(),
});

export const avYaraRulesTable = pgTable("av_yara_rules", {
  id:           serial("id").primaryKey(),
  name:         text("name").notNull(),
  ruleText:     text("rule_text").notNull(),
  description:  text("description"),
  malwareFamily:text("malware_family"),
  author:       text("author").notNull().default("ProxhqAV"),
  tags:         text("tags"),
  severity:     avSeverityEnum("severity").notNull().default("high"),
  enabled:      boolean("enabled").notNull().default(true),
  matchCount:   integer("match_count").notNull().default(0),
  addedAt:      timestamp("added_at").defaultNow().notNull(),
});

export const avScanHistoryTable = pgTable("av_scan_history", {
  id:              serial("id").primaryKey(),
  scanTarget:      text("scan_target").notNull(),
  scanType:        text("scan_type").notNull().default("file"),   // file/memory/network/full
  status:          avScanStatusEnum("status").notNull().default("complete"),
  enginesUsed:     text("engines_used"),
  totalChecks:     integer("total_checks").notNull().default(0),
  findings:        integer("findings").notNull().default(0),
  criticalFindings:integer("critical_findings").notNull().default(0),
  detectedThreats: text("detected_threats"),
  scanDurationMs:  integer("scan_duration_ms"),
  startedAt:       timestamp("started_at").defaultNow().notNull(),
});

export const avLolbinTable = pgTable("av_lolbin_catalog", {
  id:          serial("id").primaryKey(),
  binaryName:  text("binary_name").notNull(),
  fullPath:    text("full_path"),
  os:          text("os").notNull().default("windows"),
  category:    text("category").notNull(),
  description: text("description"),
  attkTechnique: text("attk_technique"),
  maliciousCmd:text("malicious_cmd"),
  detectionRule:text("detection_rule"),
  riskLevel:   text("risk_level").notNull().default("high"),
});

export const avRansomExtTable = pgTable("av_ransomware_extensions", {
  id:           serial("id").primaryKey(),
  extension:    text("extension").notNull(),
  family:       text("family").notNull(),
  firstSeen:    text("first_seen"),
  ransomNote:   text("ransom_note"),
  decryptable:  boolean("decryptable").notNull().default(false),
  active:       boolean("active").notNull().default(true),
});

// ── Automatic Threat Response (ATR) ────────────────────────────────────────
export const atrActionEnum = pgEnum("atr_action", ["block","trap","block_and_trap","notify"]);
export const atrScopeEnum  = pgEnum("atr_scope",  ["global","category","signature"]);

export const firewallAtrPoliciesTable = pgTable("firewall_atr_policies", {
  id:             serial("id").primaryKey(),
  name:           text("name").notNull(),
  scope:          atrScopeEnum("scope").notNull().default("category"),
  category:       text("category"),
  sid:            text("sid"),
  triggerCount:   integer("trigger_count").notNull().default(1),
  windowSecs:     integer("window_secs").notNull().default(300),
  action:         atrActionEnum("action").notNull().default("block"),
  cooldownMins:   integer("cooldown_mins").notNull().default(60),
  enabled:        boolean("enabled").notNull().default(true),
  triggeredCount: integer("triggered_count").notNull().default(0),
  createdAt:      timestamp("created_at").defaultNow().notNull(),
});

export const firewallAtrEventsTable = pgTable("firewall_atr_events", {
  id:                serial("id").primaryKey(),
  policyId:          integer("policy_id").notNull(),
  policyName:        text("policy_name").notNull(),
  sourceIp:          text("source_ip").notNull(),
  nodeId:            integer("node_id").notNull(),
  sid:               text("sid"),
  triggerHits:       integer("trigger_hits").notNull().default(1),
  action:            text("action").notNull(),
  trappedAttackerId: integer("trapped_attacker_id"),
  blockedIpId:       integer("blocked_ip_id"),
  triggeredAt:       timestamp("triggered_at").defaultNow().notNull(),
  resolvedAt:        timestamp("resolved_at"),
});

// ── Per-WireGuard-Peer Firewall Rules ──────────────────────────────────────
export const firewallPeerRulesTable = pgTable("firewall_peer_rules", {
  id:           serial("id").primaryKey(),
  name:         text("name").notNull(),
  publicKey:    text("public_key").notNull(),
  deviceName:   text("device_name"),
  nodeId:       integer("node_id"),
  action:       text("action").notNull().default("block"),
  throttleKbps: integer("throttle_kbps"),
  reason:       text("reason"),
  enabled:      boolean("enabled").notNull().default(true),
  hitCount:     integer("hit_count").notNull().default(0),
  lastHit:      timestamp("last_hit"),
  expiresAt:    timestamp("expires_at"),
  createdAt:    timestamp("created_at").defaultNow().notNull(),
});

// ── Adaptive DDoS Auto-Response ────────────────────────────────────────────
export const firewallDdosConfigTable = pgTable("firewall_ddos_config", {
  id:              serial("id").primaryKey(),
  enabled:         boolean("enabled").notNull().default(true),
  thresholdPps:    integer("threshold_pps").notNull().default(5000),
  windowSecs:      integer("window_secs").notNull().default(10),
  action:          text("action").notNull().default("rate_limit"),
  rateLimitPps:    integer("rate_limit_pps").notNull().default(100),
  autoUnblockMins: integer("auto_unblock_mins").notNull().default(30),
  updatedAt:       timestamp("updated_at").defaultNow().notNull(),
});

export const firewallDdosEventsTable = pgTable("firewall_ddos_events", {
  id:           serial("id").primaryKey(),
  sourceIp:     text("source_ip").notNull(),
  nodeId:       integer("node_id").notNull(),
  peakPps:      integer("peak_pps").notNull(),
  durationSecs: integer("duration_secs"),
  actionTaken:  text("action_taken").notNull(),
  blockedAt:    timestamp("blocked_at").defaultNow().notNull(),
  unblockAt:    timestamp("unblock_at"),
  resolvedAt:   timestamp("resolved_at"),
});

// ── User Connection Approval System ────────────────────────────────────────
export const promptDecisionEnum = pgEnum("prompt_decision", ["pending","allow_once","allow_always","block_always","dismissed"]);

export const firewallConnectionPromptsTable = pgTable("firewall_connection_prompts", {
  id:          serial("id").primaryKey(),
  userId:      text("user_id").notNull(),
  sourceIp:    text("source_ip").notNull(),
  destIp:      text("dest_ip"),
  destPort:    text("dest_port"),
  protocol:    text("protocol").notNull().default("tcp"),
  reason:      text("reason").notNull(),
  threatLevel: text("threat_level").notNull().default("medium"),  // "low"|"medium"|"high"|"critical"
  patternKey:  text("pattern_key").notNull(),                      // canonical dedup key
  decision:    promptDecisionEnum("decision").notNull().default("pending"),
  metadata:    jsonb("metadata"),
  createdAt:   timestamp("created_at").defaultNow().notNull(),
  resolvedAt:  timestamp("resolved_at"),
});

export const firewallUserDecisionsTable = pgTable("firewall_user_decisions", {
  id:          serial("id").primaryKey(),
  userId:      text("user_id").notNull(),
  patternKey:  text("pattern_key").notNull(),
  patternType: text("pattern_type").notNull().default("ip"),       // "ip"|"ip_port"|"cidr"
  decision:    text("decision").notNull(),                          // "allow"|"block"
  label:       text("label"),
  sourceIp:    text("source_ip"),
  destPort:    text("dest_port"),
  protocol:    text("protocol"),
  hitCount:    integer("hit_count").notNull().default(0),
  notes:       text("notes"),
  createdAt:   timestamp("created_at").defaultNow().notNull(),
  lastSeenAt:  timestamp("last_seen_at").defaultNow().notNull(),
});

// ── Traffic Bridge — VPN peer traffic flagging & admin approval ─────────────
export const trafficDecisionStatusEnum = pgEnum("traffic_decision_status", ["pending","approved","denied","expired"]);

export const firewallTrafficDecisionsTable = pgTable("firewall_traffic_decisions", {
  id:              serial("id").primaryKey(),
  peerPublicKey:   text("peer_public_key"),
  peerDeviceName:  text("peer_device_name"),
  peerIp:          text("peer_ip").notNull(),   // VPN client 10.8.0.x assigned IP
  destIp:          text("dest_ip").notNull(),
  destPort:        integer("dest_port"),
  destDomain:      text("dest_domain"),
  protocol:        text("protocol").notNull().default("tcp"),
  nodeId:          integer("node_id").notNull(),
  flagReason:      text("flag_reason").notNull(),  // "ips_match"|"geo_blocked_dest"|"c2_pattern"|"new_destination"|"ddos_source"
  flagSid:         text("flag_sid"),
  status:          trafficDecisionStatusEnum("status").notNull().default("pending"),
  appliedToNode:   boolean("applied_to_node").notNull().default(false),
  expiresInHours:  integer("expires_in_hours").default(24),
  decidedAt:       timestamp("decided_at"),
  expiresAt:       timestamp("expires_at"),
  createdAt:       timestamp("created_at").defaultNow().notNull(),
});
