// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";

export const chatMessagesTable = pgTable("omega_chat_messages", {
  id: serial("id").primaryKey(),
  hostId: integer("host_id").notNull(),
  direction: text("direction").notNull().default("out"),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type OmegaChatMessage = typeof chatMessagesTable.$inferSelect;
export type InsertOmegaChatMessage = typeof chatMessagesTable.$inferInsert;
