// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Lab Targets — authorized IPs/hostnames for security tools (sqlmap, nmap, os-cmd).
// NOTHING in the platform may execute offensive tools against an IP unless it
// appears here with active=true and expires_at in the future (or null).
import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const labTargetsTable = pgTable("lab_targets", {
  id:           serial("id").primaryKey(),
  ip:           text("ip").notNull(),
  hostname:     text("hostname"),
  description:  text("description").notNull(),
  authorizedBy: text("authorized_by").notNull(), // Clerk userId of admin who added it
  authorizedAt: timestamp("authorized_at").defaultNow().notNull(),
  expiresAt:    timestamp("expires_at"),         // null = no expiry
  active:       boolean("active").notNull().default(true),
  createdAt:    timestamp("created_at").defaultNow().notNull(),
});
