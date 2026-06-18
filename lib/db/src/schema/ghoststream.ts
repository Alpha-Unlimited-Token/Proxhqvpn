// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { pgTable, text, integer, boolean, timestamp, real } from "drizzle-orm/pg-core";

export const ghoststreamProfilesTable = pgTable("ghoststream_profiles", {
  id:               text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  name:             text("name").notNull().unique(),
  description:      text("description").notNull(),
  sizeCdf:          real("size_cdf").array().notNull(),
  iatCdf:           real("iat_cdf").array().notNull(),
  burstMinPackets:  integer("burst_min_packets").notNull().default(2),
  burstMaxPackets:  integer("burst_max_packets").notNull().default(12),
  burstGapMinMs:    integer("burst_gap_min_ms").notNull().default(50),
  burstGapMaxMs:    integer("burst_gap_max_ms").notNull().default(800),
  dummyPps:         real("dummy_pps").notNull().default(0.5),
  holdMinS:         integer("hold_min_s").notNull().default(30),
  holdMaxS:         integer("hold_max_s").notNull().default(120),
  enabled:          boolean("enabled").notNull().default(true),
  createdAt:        timestamp("created_at").defaultNow().notNull(),
});

export const ghoststreamSessionsTable = pgTable("ghoststream_sessions", {
  userId:          text("user_id").notNull(),
  configId:        integer("config_id").notNull(),
  currentProfile:  text("current_profile").notNull(),
  profileUntil:    timestamp("profile_until").notNull(),
  sessionKey:      text("session_key").notNull(),
  morphingEnabled: boolean("morphing_enabled").notNull().default(true),
  createdAt:       timestamp("created_at").defaultNow().notNull(),
});

export type InsertGhostStreamProfile = typeof ghoststreamProfilesTable.$inferInsert;
export type GhostStreamProfile       = typeof ghoststreamProfilesTable.$inferSelect;
export type InsertGhostStreamSession = typeof ghoststreamSessionsTable.$inferInsert;
export type GhostStreamSession       = typeof ghoststreamSessionsTable.$inferSelect;
