// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Deception Engine schema — admin-only. Stores full attacker fingerprints
// captured by honeypot endpoints, fake banners, and tarpit connections.
import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";

export const deceptionEventsTable = pgTable("deception_events", {
  id:                 serial("id").primaryKey(),
  sessionId:          text("session_id").notNull(),
  attackerIp:         text("attacker_ip").notNull(),
  attackerPort:       text("attacker_port"),
  honeypotService:    text("honeypot_service").notNull(),   // ssh | http | ftp | smtp | telnet | rdp | generic
  honeypotEndpoint:   text("honeypot_endpoint"),
  requestMethod:      text("request_method"),
  requestPath:        text("request_path"),
  requestHeaders:     text("request_headers"),              // JSON string
  requestBody:        text("request_body"),                 // first 4096 bytes
  userAgent:          text("user_agent"),
  referer:            text("referer"),
  acceptLanguage:     text("accept_language"),
  asn:                text("asn"),
  asnOrg:             text("asn_org"),
  country:            text("country"),
  city:               text("city"),
  isp:                text("isp"),
  ttlEstimate:        integer("ttl_estimate"),
  osFingerprint:      text("os_fingerprint"),               // passive OS from TTL/headers
  isTorExit:          boolean("is_tor_exit").default(false),
  isVpn:              boolean("is_vpn").default(false),
  threatScore:        integer("threat_score").default(0),   // 0-100
  fakeBannerServed:   text("fake_banner_served"),           // which fake banner was returned
  tarpitDurationMs:   integer("tarpit_duration_ms"),
  payloadHex:         text("payload_hex"),                  // hex dump of raw body
  capturedCreds:      text("captured_creds"),               // any attempted auth strings
  scanPatterns:       text("scan_patterns"),                // JSON: detected tool signatures
  tags:               text("tags"),                         // JSON array of labels
  notes:              text("notes"),
  sessionStart:       timestamp("session_start").defaultNow().notNull(),
  lastActivity:       timestamp("last_activity").defaultNow().notNull(),
});

export const deceptionBannersTable = pgTable("deception_banners", {
  id:           serial("id").primaryKey(),
  name:         text("name").notNull(),
  serviceType:  text("service_type").notNull(),  // ssh | http | ftp | smtp | telnet | rdp
  bannerContent:text("banner_content").notNull(),
  headersJson:  text("headers_json"),            // JSON: HTTP response headers to inject
  delayMs:      integer("delay_ms").default(0),
  isActive:     boolean("is_active").default(true).notNull(),
  createdAt:    timestamp("created_at").defaultNow().notNull(),
});

export type InsertDeceptionEvent  = typeof deceptionEventsTable.$inferInsert;
export type DeceptionEvent        = typeof deceptionEventsTable.$inferSelect;
export type InsertDeceptionBanner = typeof deceptionBannersTable.$inferInsert;
export type DeceptionBanner       = typeof deceptionBannersTable.$inferSelect;
