// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";

export const ghostTrapProbesTable = pgTable("ghost_trap_probes", {
  id:            serial("id").primaryKey(),
  probeId:       text("probe_id").notNull().unique(),
  userId:        text("user_id"),                          // null = platform probe; Clerk userId = user probe
  attackerIp:    text("attacker_ip").notNull(),
  attackerPort:  integer("attacker_port"),                 // source TCP port
  attackerUa:    text("attacker_ua"),
  method:        text("method").notNull(),
  endpoint:      text("endpoint").notNull(),
  rawPayload:    text("raw_payload"),
  probeType:     text("probe_type").notNull(),
  attackVector:  text("attack_vector"),
  fakeResponse:  text("fake_response"),
  tarpitMs:      integer("tarpit_ms").notNull().default(0),
  autoBlocked:   boolean("auto_blocked").notNull().default(false),
  silkTrapped:   boolean("silk_trapped").notNull().default(false),
  // Beacon tracking
  beaconId:      text("beacon_id"),
  beaconFired:   boolean("beacon_fired").notNull().default(false),
  beaconFiredAt: timestamp("beacon_fired_at"),
  // Hop chain — full XFF header chain stored as JSON array of IPs
  hopChain:      text("hop_chain"),
  vpnDetected:   boolean("vpn_detected").notNull().default(false),
  torDetected:   boolean("tor_detected").notNull().default(false),
  // Geo/WHOIS enrichment
  geoCountry:    text("geo_country"),
  geoCity:       text("geo_city"),
  geoIsp:        text("geo_isp"),
  geoOrg:        text("geo_org"),
  geoAsn:        text("geo_asn"),
  geoTimezone:   text("geo_timezone"),
  // Request metadata
  referer:       text("referer"),
  probeHeaders:  text("probe_headers"),
  probedAt:      timestamp("probed_at").defaultNow().notNull(),
});

export const ghostTrapBeaconsTable = pgTable("ghost_trap_beacons", {
  id:          serial("id").primaryKey(),
  beaconId:    text("beacon_id").notNull().unique(),
  probeId:     text("probe_id").notNull(),
  userId:      text("user_id"),                            // null = platform; Clerk userId = user
  attackerIp:  text("attacker_ip").notNull(),
  firedAt:     timestamp("fired_at").defaultNow().notNull(),
  firedFromIp: text("fired_from_ip"),
  firedUa:     text("fired_ua"),
  firedHeaders:text("fired_headers"),
});

export const ghostTrapConfigTable = pgTable("ghost_trap_config", {
  id:              serial("id").primaryKey(),
  userId:          text("user_id").notNull().default("platform"), // "platform" or Clerk userId
  userToken:       text("user_token").unique(),                   // secret hex token for per-user lure URLs
  deviceMode:      text("device_mode").notNull().default("personal"), // "personal" | "server"
  userDomain:      text("user_domain"),                           // user's website domain (server mode)
  userDetectedIp:  text("user_detected_ip"),                     // user's detected public IP (personal mode)
  enabled:         boolean("enabled").notNull().default(true),
  tarpitMinMs:     integer("tarpit_min_ms").notNull().default(1500),
  tarpitMaxMs:     integer("tarpit_max_ms").notNull().default(8000),
  autoBlockAfter:  integer("auto_block_after").notNull().default(5),
  silkTrapAfter:   integer("silk_trap_after").notNull().default(3),
  fakeSiteName:    text("fake_site_name").notNull().default("AdminPanel v2.1"),
  fakeDbVersion:   text("fake_db_version").notNull().default("MySQL 5.7.39-log"),
  updatedAt:       timestamp("updated_at").defaultNow().notNull(),
});

// ── Infinite Loop Tarpit Sessions ─────────────────────────────────────────────
// Tracks attackers as they cycle through the multi-stage honeypot state machine.
// Each stage returns increasingly convincing fake data, looping back indefinitely.
export const ghostTrapLoopSessionsTable = pgTable("ghost_trap_loop_sessions", {
  id:                   serial("id").primaryKey(),
  sessionId:            text("session_id").notNull().unique(),
  attackerIp:           text("attacker_ip").notNull(),
  attackerPort:         integer("attacker_port"),
  attackerUa:           text("attacker_ua"),
  stage:                integer("stage").notNull().default(0),
  stageLabel:           text("stage_label").notNull().default("initial_contact"),
  loopCount:            integer("loop_count").notNull().default(0),
  interactionCount:     integer("interaction_count").notNull().default(0),
  totalTarpitMs:        integer("total_tarpit_ms").notNull().default(0),
  triggerType:          text("trigger_type").notNull().default("waf"),  // waf | injection | xss | cmd | recon | manual
  initialPayload:       text("initial_payload"),
  intelligenceJson:     text("intelligence_json"),  // accumulated attack intel as JSON
  fakeSessionToken:     text("fake_session_token"), // the fake JWT/token we gave them
  fakeUsername:         text("fake_username"),      // which fake identity they think they are
  lastStageResponse:    text("last_stage_response"),
  geoCountry:           text("geo_country"),
  geoIsp:               text("geo_isp"),
  autoBlockScheduled:   boolean("auto_block_scheduled").notNull().default(false),
  silkTrapped:          boolean("silk_trapped").notNull().default(false),
  isActive:             boolean("is_active").notNull().default(true),
  lastSeenAt:           timestamp("last_seen_at").defaultNow().notNull(),
  createdAt:            timestamp("created_at").defaultNow().notNull(),
});

// ── Labyrinth Engine — tracks attacker traversal through fake maze endpoints ───
export const labyrinthPathsTable = pgTable("labyrinth_paths", {
  id:              serial("id").primaryKey(),
  sessionId:       text("session_id").notNull(),
  attackerIp:      text("attacker_ip").notNull(),
  pathNode:        text("path_node").notNull(),        // fake endpoint label
  nodeType:        text("node_type").notNull().default("dashboard"), // login/dashboard/api/db/config/files/creds/exfil/trap/reset
  fakeDataServed:  text("fake_data_served"),           // JSON of what we showed them
  delayMs:         integer("delay_ms").notNull().default(0),
  loopIteration:   integer("loop_iteration").notNull().default(0),
  breadcrumb:      text("breadcrumb"),                 // payload/query they submitted
  exitedTo:        text("exited_to"),                  // next node they navigated to
  geoCountry:      text("geo_country"),
  geoIsp:          text("geo_isp"),
  visitedAt:       timestamp("visited_at").defaultNow().notNull(),
});

// ── Tar Pit Drain Engine — escalating delays per attacker connection ───────────
export const tarpitDrainTable = pgTable("tarpit_drain", {
  id:              serial("id").primaryKey(),
  connectionId:    text("connection_id").notNull().unique(),
  attackerIp:      text("attacker_ip").notNull(),
  sessionId:       text("session_id"),
  drainStage:      text("drain_stage").notNull().default("initial"), // initial/slow/crawl/freeze/dead_loop
  currentDelayMs:  integer("current_delay_ms").notNull().default(1500),
  maxDelayMs:      integer("max_delay_ms").notNull().default(120000),  // 2 min max delay
  totalWastedMs:   integer("total_wasted_ms").notNull().default(0),
  hitCount:        integer("hit_count").notNull().default(1),
  lastPayload:     text("last_payload"),
  ghostIntelJson:  text("ghost_intel_json"),   // IP, geo, ISP, DNS, VPN flags as JSON
  loopFeedback:    text("loop_feedback"),       // which fake response last sent
  autoBlocked:     boolean("auto_blocked").notNull().default(false),
  isActive:        boolean("is_active").notNull().default(true),
  firstSeenAt:     timestamp("first_seen_at").defaultNow().notNull(),
  lastSeenAt:      timestamp("last_seen_at").defaultNow().notNull(),
});

// ── ghost_trap_events — unified high-level event log ─────────────────────────
// Provides a single, clean timeline across all trap activities for the dashboard.
export const ghostTrapEventsTable = pgTable("ghost_trap_events", {
  id:           serial("id").primaryKey(),
  eventId:      text("event_id").notNull().unique(),
  userId:       text("user_id"),                          // null = platform event
  eventType:    text("event_type").notNull(),             // probe|beacon|session|block|evidence|rule_match
  severity:     text("severity").notNull().default("info"), // info|warn|high|critical
  sourceIp:     text("source_ip"),
  summary:      text("summary").notNull(),
  detailJson:   text("detail_json"),                     // arbitrary context as JSON
  probeId:      text("probe_id"),                        // link to ghost_trap_probes.probe_id
  sessionId:    text("session_id"),                      // link to ghost_trap_loop_sessions.session_id
  fedToSiem:    boolean("fed_to_siem").notNull().default(false),
  createdAt:    timestamp("created_at").defaultNow().notNull(),
});

// ── ghost_trap_evidence — exportable evidence bundles ────────────────────────
export const ghostTrapEvidenceTable = pgTable("ghost_trap_evidence", {
  id:              serial("id").primaryKey(),
  evidenceId:      text("evidence_id").notNull().unique(),
  userId:          text("user_id").notNull(),
  subjectIp:       text("subject_ip").notNull(),           // attacker IP the evidence relates to
  evidenceType:    text("evidence_type").notNull(),         // dossier|pcap_summary|probe_log|session_log|full_bundle
  format:          text("format").notNull().default("json"), // json|text|zip
  exportedAt:      timestamp("exported_at").defaultNow().notNull(),
  bundleJson:      text("bundle_json"),                    // serialized evidence payload
  probeCount:      integer("probe_count").notNull().default(0),
  sessionCount:    integer("session_count").notNull().default(0),
  sha256:          text("sha256"),                         // hash of bundleJson for chain-of-custody
  notes:           text("notes"),
  createdAt:       timestamp("created_at").defaultNow().notNull(),
});

// ── ghost_blocked_sources — IPs/CIDRs blocked by Ghost Trap ─────────────────
export const ghostBlockedSourcesTable = pgTable("ghost_blocked_sources", {
  id:            serial("id").primaryKey(),
  blockedBy:     text("blocked_by").notNull(),             // Clerk userId or "platform"
  sourceIp:      text("source_ip"),                        // single IP block
  sourceCidr:    text("source_cidr"),                      // CIDR range block
  reason:        text("reason").notNull().default("manual"), // manual|auto_probe|auto_session|rule_match
  probeId:       text("probe_id"),
  sessionId:     text("session_id"),
  severity:      text("severity").notNull().default("high"),
  permanent:     boolean("permanent").notNull().default(false),
  expiresAt:     timestamp("expires_at"),
  notes:         text("notes"),
  active:        boolean("active").notNull().default(true),
  createdAt:     timestamp("created_at").defaultNow().notNull(),
  updatedAt:     timestamp("updated_at").defaultNow().notNull(),
});

export type GhostTrapProbe        = typeof ghostTrapProbesTable.$inferSelect;
export type GhostTrapBeacon       = typeof ghostTrapBeaconsTable.$inferSelect;
export type GhostTrapConfig       = typeof ghostTrapConfigTable.$inferSelect;
export type GhostTrapLoopSession  = typeof ghostTrapLoopSessionsTable.$inferSelect;
export type LabyrinthPath         = typeof labyrinthPathsTable.$inferSelect;
export type TarpitDrain           = typeof tarpitDrainTable.$inferSelect;
export type GhostTrapEvent        = typeof ghostTrapEventsTable.$inferSelect;
export type GhostTrapEvidence     = typeof ghostTrapEvidenceTable.$inferSelect;
export type GhostBlockedSource    = typeof ghostBlockedSourcesTable.$inferSelect;
