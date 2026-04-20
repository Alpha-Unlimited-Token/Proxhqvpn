import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { nodesTable } from "./nodes";
import { usersTable } from "./users";

export const userWgConfigsTable = pgTable("user_wg_configs", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().references(() => usersTable.id),
  nodeId: integer("node_id").notNull().references(() => nodesTable.id),
  clientPrivateKey: text("client_private_key").notNull(),
  clientPublicKey: text("client_public_key").notNull(),
  assignedIp: text("assigned_ip").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  revokedAt: timestamp("revoked_at"),
});

export type InsertUserWgConfig = typeof userWgConfigsTable.$inferInsert;
export type UserWgConfig = typeof userWgConfigsTable.$inferSelect;
