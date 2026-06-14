// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { pgTable, text, timestamp, jsonb, unique } from "drizzle-orm/pg-core";

export const platformEventsTable = pgTable("platform_events", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  actor: text("actor"),
  subject: text("subject"),
  severity: text("severity").notNull().default("info"),
  payload: jsonb("payload").notNull().default({}),
  processedAt: timestamp("processed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const controlPlaneInstancesTable = pgTable(
  "control_plane_instances",
  {
    id: text("id").primaryKey(),
    instanceId: text("instance_id").notNull(),
    region: text("region"),
    hostname: text("hostname").notNull(),
    role: text("role").notNull(),
    status: text("status").notNull().default("active"),
    metadata: jsonb("metadata").notNull().default({}),
    lastHeartbeatAt: timestamp("last_heartbeat_at").notNull().defaultNow(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [unique("control_plane_instances_instance_id_key").on(t.instanceId)],
);
