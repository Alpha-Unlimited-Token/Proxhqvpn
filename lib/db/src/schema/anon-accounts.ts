// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";

export const anonAccountsTable = pgTable("anon_accounts", {
  id: serial("id").primaryKey(),
  accountNumber: text("account_number").notNull().unique(),
  wgPrivateKey: text("wg_private_key"),
  wgPublicKey: text("wg_public_key"),
  assignedIp: text("assigned_ip"),
  assignedNodeId: integer("assigned_node_id"),
  subscriptionExpiresAt: timestamp("subscription_expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type AnonAccount = typeof anonAccountsTable.$inferSelect;
export type InsertAnonAccount = typeof anonAccountsTable.$inferInsert;
