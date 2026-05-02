// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { pgTable, serial, text, integer, boolean, timestamp, pgEnum } from "drizzle-orm/pg-core";

export const wafAttackTypeEnum = pgEnum("waf_attack_type", [
  "sqli", "xss", "lfi", "rfi", "cmdi", "xxe", "ssrf", "ssti", "pathtraversal", "sqlmap", "ratelimit", "other"
]);

export const wafSeverityEnum = pgEnum("waf_severity", ["critical", "high", "medium", "low", "info"]);

export const wafRuleActionEnum = pgEnum("waf_rule_action", ["block", "alert", "log", "challenge"]);

export const wafRulesTable = pgTable("waf_rules", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  attackType: wafAttackTypeEnum("attack_type").notNull(),
  severity: wafSeverityEnum("severity").notNull(),
  action: wafRuleActionEnum("action").notNull().default("block"),
  pattern: text("pattern").notNull(),
  target: text("target").notNull().default("any"),
  enabled: boolean("enabled").notNull().default(true),
  hitCount: integer("hit_count").notNull().default(0),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const wafEventsTable = pgTable("waf_events", {
  id: serial("id").primaryKey(),
  ruleId: integer("rule_id"),
  ruleName: text("rule_name"),
  attackType: text("attack_type"),
  severity: text("severity"),
  action: text("action"),
  sourceIp: text("source_ip"),
  method: text("method"),
  path: text("path"),
  matchedOn: text("matched_on"),
  payload: text("payload"),
  blocked: boolean("blocked").notNull().default(false),
  anomalyScore: integer("anomaly_score").notNull().default(0),
  detectedAt: timestamp("detected_at").defaultNow().notNull(),
});

export type WafRule = typeof wafRulesTable.$inferSelect;
export type InsertWafRule = typeof wafRulesTable.$inferInsert;
export type WafEvent = typeof wafEventsTable.$inferSelect;
