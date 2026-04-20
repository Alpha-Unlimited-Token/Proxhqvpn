import { pgTable, serial, text, integer, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";

export const dnsRuleTypeEnum = pgEnum("dns_rule_type", ["block", "allow"]);
export const dnsCategoryEnum = pgEnum("dns_category", ["ads", "trackers", "malware", "adult", "custom"]);

export const dnsShieldRulesTable = pgTable("dns_shield_rules", {
  id: serial("id").primaryKey(),
  domain: text("domain").notNull(),
  ruleType: dnsRuleTypeEnum("rule_type").notNull().default("block"),
  category: dnsCategoryEnum("category").notNull().default("custom"),
  enabled: boolean("enabled").notNull().default(true),
  hitCount: integer("hit_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const dnsShieldConfigTable = pgTable("dns_shield_config", {
  id: serial("id").primaryKey(),
  enabled: boolean("enabled").notNull().default(false),
  blockAds: boolean("block_ads").notNull().default(true),
  blockTrackers: boolean("block_trackers").notNull().default(true),
  blockMalware: boolean("block_malware").notNull().default(true),
  blockAdult: boolean("block_adult").notNull().default(false),
  dohEnabled: boolean("doh_enabled").notNull().default(false),
  dohProvider: text("doh_provider").notNull().default("cloudflare"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type InsertDnsShieldRule = typeof dnsShieldRulesTable.$inferInsert;
export type DnsShieldRule = typeof dnsShieldRulesTable.$inferSelect;
export type DnsShieldConfig = typeof dnsShieldConfigTable.$inferSelect;
