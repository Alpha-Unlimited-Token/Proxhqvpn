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

export const wgPeerCommandsTable = pgTable("wg_peer_commands", {
  id: serial("id").primaryKey(),
  configId: integer("config_id").notNull().references(() => userWgConfigsTable.id),
  nodeId: integer("node_id").notNull().references(() => nodesTable.id),
  userId: text("user_id").notNull(),
  clientPublicKey: text("client_public_key").notNull(),
  assignedIp: text("assigned_ip").notNull(),
  status: text("status").default("pending").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  appliedAt: timestamp("applied_at"),
  errorMessage: text("error_message"),
});

export type WgPeerCommand = typeof wgPeerCommandsTable.$inferSelect;
