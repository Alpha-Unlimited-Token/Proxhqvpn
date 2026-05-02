// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";

export const screenshotsTable = pgTable("omega_screenshots", {
  id: serial("id").primaryKey(),
  hostId: integer("host_id").notNull(),
  label: text("label").notNull().default("Desktop"),
  widthPx: integer("width_px").notNull().default(1920),
  heightPx: integer("height_px").notNull().default(1080),
  sizeKb: integer("size_kb").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type OmegaScreenshot = typeof screenshotsTable.$inferSelect;
export type InsertOmegaScreenshot = typeof screenshotsTable.$inferInsert;
