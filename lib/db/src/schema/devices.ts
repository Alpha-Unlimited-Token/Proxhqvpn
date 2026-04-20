import { pgTable, serial, text, integer, boolean, real, timestamp, pgEnum } from "drizzle-orm/pg-core";

export const deviceTypeEnum = pgEnum("device_type", [
  "windows", "macos", "linux", "ios", "android",
  "android-tv", "fire-tv", "apple-tv", "smart-tv",
  "router", "browser", "other"
]);
export const deviceStatusEnum = pgEnum("device_status", ["active", "inactive", "blocked"]);

export const devicesTable = pgTable("devices", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: deviceTypeEnum("type").notNull().default("other"),
  publicKey: text("public_key"),
  assignedIp: text("assigned_ip").notNull().default(""),
  allowedIps: text("allowed_ips").notNull().default("0.0.0.0/0, ::/0"),
  status: deviceStatusEnum("status").notNull().default("active"),
  dataUsedMb: real("data_used_mb").notNull().default(0),
  lastSeen: timestamp("last_seen"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type InsertDevice = typeof devicesTable.$inferInsert;
export type Device = typeof devicesTable.$inferSelect;
