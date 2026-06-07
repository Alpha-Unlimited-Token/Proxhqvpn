// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { pgTable, serial, text, integer, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";

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
