import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";

export const clipboardTable = pgTable("omega_clipboard_entries", {
  id: serial("id").primaryKey(),
  hostId: integer("host_id").notNull(),
  content: text("content").notNull().default(""),
  contentType: text("content_type").notNull().default("text"),
  capturedAt: timestamp("captured_at").defaultNow().notNull(),
});

export type OmegaClipboardEntry = typeof clipboardTable.$inferSelect;
export type InsertOmegaClipboardEntry = typeof clipboardTable.$inferInsert;
