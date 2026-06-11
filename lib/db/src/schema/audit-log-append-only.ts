// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Drizzle ORM schema for the append-only, tamper-evident audit log.
// The underlying table has an immutable trigger (prevent_audit_update_delete)
// that blocks UPDATE and DELETE at the database level — this table is insert-only.
// Matches migration: migrations/20260609_ztna_schema.sql

import { pgTable, bigserial, text, jsonb, timestamp } from "drizzle-orm/pg-core";

export const auditLogAppendOnlyTable = pgTable("audit_log_append_only", {
  seq:       bigserial("seq", { mode: "number" }).primaryKey(),
  tenantId:  text("tenant_id"),
  actor:     text("actor").notNull(),
  action:    text("action").notNull(),
  resource:  text("resource").notNull(),
  result:    text("result").notNull(),
  metadata:  jsonb("metadata").notNull().default({}),
  ip:        text("ip"),
  prevHash:  text("prev_hash").notNull(),
  hash:      text("hash").notNull(),
  signature: text("signature").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AuditLogEntry = typeof auditLogAppendOnlyTable.$inferSelect;
export type InsertAuditLogEntry = typeof auditLogAppendOnlyTable.$inferInsert;
