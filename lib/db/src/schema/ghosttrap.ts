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
  browserLang: text("browser_lang"),
  screenSize:  text("screen_size"),
  timezone:    text("timezone"),
});

export const ghostTrapConfigTable = pgTable("ghost_trap_config", {
  id:              serial("id").primaryKey(),
  userId:          text("user_id").notNull().default("platform"), // "platform" or Clerk userId
  userToken:       text("user_token").unique(),                   // secret hex token for per-user lure URLs
  enabled:         boolean("enabled").notNull().default(true),
  tarpitMinMs:     integer("tarpit_min_ms").notNull().default(1500),
  tarpitMaxMs:     integer("tarpit_max_ms").notNull().default(8000),
  autoBlockAfter:  integer("auto_block_after").notNull().default(5),
  silkTrapAfter:   integer("silk_trap_after").notNull().default(3),
  fakeSiteName:    text("fake_site_name").notNull().default("AdminPanel v2.1"),
  fakeDbVersion:   text("fake_db_version").notNull().default("MySQL 5.7.39-log"),
  updatedAt:       timestamp("updated_at").defaultNow().notNull(),
});

export type GhostTrapProbe  = typeof ghostTrapProbesTable.$inferSelect;
export type GhostTrapBeacon = typeof ghostTrapBeaconsTable.$inferSelect;
export type GhostTrapConfig = typeof ghostTrapConfigTable.$inferSelect;
