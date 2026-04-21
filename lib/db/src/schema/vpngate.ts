import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";

export const vpngateNodeSessionsTable = pgTable("vpngate_node_sessions", {
  id: serial("id").primaryKey(),
  nodeId: integer("node_id").notNull(),
  status: text("status").notNull().default("pending_connect"),
  serverIp: text("server_ip").notNull(),
  serverCountry: text("server_country").notNull(),
  serverCountryCode: text("server_country_code").notNull(),
  ovpnConfigB64: text("ovpn_config_b64").notNull(),
  exitIp: text("exit_ip"),
  errorMessage: text("error_message"),
  assignedAt: timestamp("assigned_at").defaultNow().notNull(),
  connectedAt: timestamp("connected_at"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type VpngateNodeSession = typeof vpngateNodeSessionsTable.$inferSelect;
export type InsertVpngateNodeSession = typeof vpngateNodeSessionsTable.$inferInsert;
