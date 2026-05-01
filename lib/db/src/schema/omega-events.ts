import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const eventsTable = pgTable("omega_events", {
  id: serial("id").primaryKey(),
  hostId: integer("host_id"),
  hostIp: text("host_ip"),
  hostLabel: text("host_label"),
  category: text("category").notNull(),
  action: text("action").notNull(),
  details: text("details"),
  severity: text("severity").notNull().default("info"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertEventSchema = createInsertSchema(eventsTable).omit({ id: true, createdAt: true });
export type OmegaEvent = typeof eventsTable.$inferSelect;
export type InsertOmegaEvent = z.infer<typeof insertEventSchema>;
