// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { pgTable, serial, text, integer, real, timestamp, bigint } from "drizzle-orm/pg-core";

export const tunnelQualityMetricsTable = pgTable("tunnel_quality_metrics", {
  id:          serial("id").primaryKey(),
  userId:      text("user_id").notNull(),
  configId:    integer("config_id").notNull(),
  nodeId:      integer("node_id").notNull(),
  latencyMs:   real("latency_ms"),
  packetLoss:  real("packet_loss"),
  jitterMs:    real("jitter_ms"),
  bytesSent:   bigint("bytes_sent", { mode: "number" }).notNull().default(0),
  bytesRecv:   bigint("bytes_recv", { mode: "number" }).notNull().default(0),
  handshakeAt: timestamp("handshake_at"),
  measuredAt:  timestamp("measured_at").defaultNow().notNull(),
});

export type InsertTunnelQualityMetric = typeof tunnelQualityMetricsTable.$inferInsert;
export type TunnelQualityMetric       = typeof tunnelQualityMetricsTable.$inferSelect;
