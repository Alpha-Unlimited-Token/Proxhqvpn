// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { pgTable, text, jsonb, timestamp, index } from "drizzle-orm/pg-core";

export const ipEnrichmentCacheTable = pgTable("ip_enrichment_cache", {
  ip:         text("ip").primaryKey(),
  data:       jsonb("data").notNull(),
  enrichedAt: timestamp("enriched_at").notNull().defaultNow(),
}, (t) => [
  index("ip_enrichment_cache_enriched_idx").on(t.enrichedAt),
]);

export type IpEnrichmentCache = typeof ipEnrichmentCacheTable.$inferSelect;
