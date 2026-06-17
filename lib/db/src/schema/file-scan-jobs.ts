// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { pgTable, serial, text, integer, jsonb, timestamp } from "drizzle-orm/pg-core";

export const fileScanJobsTable = pgTable("file_scan_jobs", {
  id:            serial("id").primaryKey(),
  userId:        text("user_id").notNull(),
  fileName:      text("file_name").notNull(),
  fileSha256:    text("file_sha256").notNull(),
  filesScanned:  integer("files_scanned").notNull().default(0),
  findingsCount: integer("findings_count").notNull().default(0),
  summary:       jsonb("summary"),
  findings:      jsonb("findings"),
  durationMs:    integer("duration_ms").notNull().default(0),
  createdAt:     timestamp("created_at").defaultNow().notNull(),
});

export type FileScanJob = typeof fileScanJobsTable.$inferSelect;
