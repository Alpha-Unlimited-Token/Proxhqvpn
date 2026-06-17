// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { pgTable, serial, text, integer, boolean, real, timestamp } from "drizzle-orm/pg-core";

export const autoscalePolicyTable = pgTable("autoscale_policy", {
  id:                 serial("id").primaryKey(),
  subscribersPerNode: integer("subscribers_per_node").notNull().default(50),
  maxNodes:           integer("max_nodes").notNull().default(500),
  minNodes:           integer("min_nodes").notNull().default(4),
  cooldownMinutes:    integer("cooldown_minutes").notNull().default(30),
  enabled:            boolean("enabled").notNull().default(false),
  updatedAt:          timestamp("updated_at").defaultNow().notNull(),
});

export const autoscaleEventsTable = pgTable("autoscale_events", {
  id:          serial("id").primaryKey(),
  eventType:   text("event_type").notNull(),
  subscribers: integer("subscribers").notNull(),
  nodes:       integer("nodes").notNull(),
  ratio:       real("ratio").notNull(),
  detail:      text("detail"),
  instanceId:  text("instance_id"),
  region:      text("region"),
  createdAt:   timestamp("created_at").defaultNow().notNull(),
});

export type AutoscalePolicy = typeof autoscalePolicyTable.$inferSelect;
export type AutoscaleEvent  = typeof autoscaleEventsTable.$inferSelect;
