// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";

export const canaryTokensTable = pgTable("canary_tokens", {
  id: serial("id").primaryKey(),
  tokenId: text("token_id").notNull().unique(),
  tokenType: text("token_type").notNull(),
  label: text("label").notNull(),
  createdBy: text("created_by").notNull(),
  memo: text("memo"),
  triggerCount: integer("trigger_count").notNull().default(0),
  lastTriggeredAt: timestamp("last_triggered_at"),
  lastTriggeredIp: text("last_triggered_ip"),
  lastTriggeredUserAgent: text("last_triggered_user_agent"),
  active: boolean("active").notNull().default(true),
  alertEmail: text("alert_email"),
  metadataJson: text("metadata_json"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const canaryTriggersTable = pgTable("canary_triggers", {
  id: serial("id").primaryKey(),
  tokenId: text("token_id").notNull(),
  triggeredAt: timestamp("triggered_at").defaultNow().notNull(),
  sourceIp: text("source_ip"),
  userAgent: text("user_agent"),
  referer: text("referer"),
  headers: text("headers"),
  geoCountry: text("geo_country"),
  geoCity: text("geo_city"),
  geoOrg: text("geo_org"),
  geoAsn: text("geo_asn"),
  reverseDns: text("reverse_dns"),
  cfRay: text("cf_ray"),
  acceptLanguage: text("accept_language"),
});

export type CanaryToken = typeof canaryTokensTable.$inferSelect;
export type CanaryTrigger = typeof canaryTriggersTable.$inferSelect;
export type InsertCanaryToken = typeof canaryTokensTable.$inferInsert;
