import { pgTable, serial, text, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";

export const ambassadorsTable = pgTable("ambassadors", {
  id:                  serial("id").primaryKey(),
  userId:              text("user_id").notNull().unique(),
  name:                text("name").notNull(),
  bio:                 text("bio"),
  promoCode:           text("promo_code").notNull().unique(),
  avatarUrl:           text("avatar_url"),
  socialUrls:          jsonb("social_urls").$type<Record<string, string>>().default({}),
  status:              text("status").notNull().default("pending"), // pending | approved | rejected
  totalEarningsCents:  integer("total_earnings_cents").notNull().default(0),
  createdAt:           timestamp("created_at").defaultNow(),
});

export const ambassadorVideosTable = pgTable("ambassador_videos", {
  id:           serial("id").primaryKey(),
  ambassadorId: integer("ambassador_id").notNull(),
  title:        text("title").notNull(),
  description:  text("description"),
  videoUrl:     text("video_url").notNull(),
  embedUrl:     text("embed_url"),
  sortOrder:    integer("sort_order").notNull().default(0),
  createdAt:    timestamp("created_at").defaultNow(),
});

export const ambassadorReferralsTable = pgTable("ambassador_referrals", {
  id:                    serial("id").primaryKey(),
  ambassadorId:          integer("ambassador_id").notNull(),
  customerUserId:        text("customer_user_id").notNull(),
  stripeSessionId:       text("stripe_session_id"),
  stripeSubscriptionId:  text("stripe_subscription_id"),
  plan:                  text("plan"),
  amountCents:           integer("amount_cents").notNull().default(0),
  commissionCents:       integer("commission_cents").notNull().default(0),
  paidOut:               boolean("paid_out").notNull().default(false),
  createdAt:             timestamp("created_at").defaultNow(),
});
