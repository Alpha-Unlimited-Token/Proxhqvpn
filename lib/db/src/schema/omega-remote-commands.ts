import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";

export const remoteCommandsTable = pgTable("omega_remote_commands", {
  id: serial("id").primaryKey(),
  hostId: integer("host_id").notNull(),
  commandType: text("command_type").notNull(),
  params: text("params").notNull().default(""),
  status: text("status").notNull().default("sent"),
  result: text("result").notNull().default(""),
  executedAt: timestamp("executed_at").defaultNow().notNull(),
});

export type OmegaRemoteCommand = typeof remoteCommandsTable.$inferSelect;
export type InsertOmegaRemoteCommand = typeof remoteCommandsTable.$inferInsert;
