import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";

export const keystrokesTable = pgTable("omega_keystrokes", {
  id: serial("id").primaryKey(),
  hostId: integer("host_id").notNull(),
  windowTitle: text("window_title").notNull().default("Unknown"),
  text: text("text").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type OmegaKeystroke = typeof keystrokesTable.$inferSelect;
export type InsertOmegaKeystroke = typeof keystrokesTable.$inferInsert;
