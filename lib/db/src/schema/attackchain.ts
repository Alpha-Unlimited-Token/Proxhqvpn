import { pgTable, serial, text, integer, boolean, timestamp } from "drizzle-orm/pg-core";

export const attackChainScansTable = pgTable("attack_chain_scans", {
  id: serial("id").primaryKey(),
  target: text("target").notNull(),
  scanStatus: text("scan_status").notNull().default("pending"),
  riskScore: integer("risk_score"),
  summary: text("summary"),
  currentStage: text("current_stage"),
  stagesJson: text("stages_json"),
  chainGraphJson: text("chain_graph_json"),
  createdBy: text("created_by").notNull(),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export const attackChainFindingsTable = pgTable("attack_chain_findings", {
  id: serial("id").primaryKey(),
  scanId: integer("scan_id").notNull(),
  surface: text("surface").notNull(),
  surfaceType: text("surface_type").notNull(),
  findingType: text("finding_type").notNull(),
  severity: text("severity").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  evidence: text("evidence"),
  remediation: text("remediation"),
  chainIdsJson: text("chain_ids_json"),
  businessImpact: text("business_impact"),
  discoveredAt: timestamp("discovered_at").defaultNow().notNull(),
});

export type AttackChainScan = typeof attackChainScansTable.$inferSelect;
export type AttackChainFinding = typeof attackChainFindingsTable.$inferSelect;
export type InsertAttackChainScan = typeof attackChainScansTable.$inferInsert;
export type InsertAttackChainFinding = typeof attackChainFindingsTable.$inferInsert;
