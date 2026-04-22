import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";

export const dnsSinkholeConfigTable = pgTable("dns_sinkhole_config", {
  id: serial("id").primaryKey(),
  enabled: boolean("enabled").notNull().default(true),
  blockAds: boolean("block_ads").notNull().default(true),
  blockTrackers: boolean("block_trackers").notNull().default(true),
  blockMalware: boolean("block_malware").notNull().default(true),
  blockPhishing: boolean("block_phishing").notNull().default(true),
  blockAdult: boolean("block_adult").notNull().default(false),
  blockCryptomining: boolean("block_cryptomining").notNull().default(true),
  blockBotnet: boolean("block_botnet").notNull().default(true),
  totalBlocked: integer("total_blocked").notNull().default(0),
  totalAllowed: integer("total_allowed").notNull().default(0),
  lastUpdated: timestamp("last_updated").defaultNow().notNull(),
});

export const dnsSinkholeCustomRulesTable = pgTable("dns_sinkhole_custom_rules", {
  id: serial("id").primaryKey(),
  domain: text("domain").notNull().unique(),
  action: text("action").notNull().default("block"),
  reason: text("reason"),
  hitCount: integer("hit_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type DnsSinkholeConfig = typeof dnsSinkholeConfigTable.$inferSelect;
export type DnsSinkholeCustomRule = typeof dnsSinkholeCustomRulesTable.$inferSelect;
