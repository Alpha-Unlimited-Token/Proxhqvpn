// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { pgTable, serial, integer, text, real, timestamp } from "drizzle-orm/pg-core";

export const networkTrafficBaselineTable = pgTable("network_traffic_baseline", {
  id:            serial("id").primaryKey(),
  nodeId:        integer("node_id").notNull(),
  metric:        text("metric").notNull(),
  hourOfWeek:    integer("hour_of_week").notNull(),
  baselineValue: real("baseline_value").notNull(),
  stddevValue:   real("stddev_value").notNull().default(0),
  sampleCount:   integer("sample_count").notNull().default(0),
  lastUpdated:   timestamp("last_updated").defaultNow().notNull(),
});

export type InsertNetworkTrafficBaseline = typeof networkTrafficBaselineTable.$inferInsert;
export type NetworkTrafficBaseline       = typeof networkTrafficBaselineTable.$inferSelect;
