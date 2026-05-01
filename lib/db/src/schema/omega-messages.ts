import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";

export const sentMessagesTable = pgTable("omega_sent_messages", {
  id: serial("id").primaryKey(),
  hostId: integer("host_id").notNull(),
  title: text("title").notNull().default(""),
  body: text("body").notNull().default(""),
  iconType: text("icon_type").notNull().default("info"),
  buttonType: text("button_type").notNull().default("ok"),
  status: text("status").notNull().default("sent"),
  sentAt: timestamp("sent_at").defaultNow().notNull(),
});

export type OmegaSentMessage = typeof sentMessagesTable.$inferSelect;
export type InsertOmegaSentMessage = typeof sentMessagesTable.$inferInsert;
