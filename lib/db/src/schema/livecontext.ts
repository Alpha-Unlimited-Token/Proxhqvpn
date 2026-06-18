// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { pgTable, text, integer, boolean, timestamp, real, jsonb, bigserial } from "drizzle-orm/pg-core";

export const livecontextSessionsTable = pgTable("livecontext_sessions", {
  id:             text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId:         text("user_id").notNull(),
  sessionType:    text("session_type").notNull(),
  intentText:     text("intent_text"),
  intentKeywords: text("intent_keywords").array(),
  intentCategory: text("intent_category"),
  startedAt:      timestamp("started_at").defaultNow().notNull(),
  endedAt:        timestamp("ended_at"),
  commandsRun:    integer("commands_run").notNull().default(0),
  queriesRun:     integer("queries_run").notNull().default(0),
  tablesAccessed: text("tables_accessed").array().notNull().default([]),
  commandsBlocked:integer("commands_blocked").notNull().default(0),
  ipsContacted:   text("ips_contacted").array().notNull().default([]),
  filesAccessed:  text("files_accessed").array().notNull().default([]),
  divergenceScore:real("divergence_score").notNull().default(0),
  divergenceFlags:jsonb("divergence_flags").notNull().default([]),
  flaggedAt:      timestamp("flagged_at"),
  reviewRequired: boolean("review_required").notNull().default(false),
  reviewedBy:     text("reviewed_by"),
  reviewedAt:     timestamp("reviewed_at"),
});

export const livecontextEventsTable = pgTable("livecontext_events", {
  id:         bigserial("id", { mode: "number" }).primaryKey(),
  sessionId:  text("session_id").notNull(),
  eventType:  text("event_type").notNull(),
  content:    text("content").notNull(),
  result:     text("result"),
  exitCode:   integer("exit_code"),
  riskWeight: real("risk_weight").notNull().default(0),
  tables:     text("tables").array(),
  ips:        text("ips").array(),
  files:      text("files").array(),
  occurredAt: timestamp("occurred_at").defaultNow().notNull(),
});

export type InsertLiveContextSession = typeof livecontextSessionsTable.$inferInsert;
export type LiveContextSession       = typeof livecontextSessionsTable.$inferSelect;
export type InsertLiveContextEvent   = typeof livecontextEventsTable.$inferInsert;
export type LiveContextEvent         = typeof livecontextEventsTable.$inferSelect;
