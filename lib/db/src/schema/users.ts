import { pgTable, serial, text, timestamp, boolean } from "drizzle-orm/pg-core";

export const usersTable = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  isAdmin: boolean("is_admin").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const employeesTable = pgTable("employees", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  displayName: text("display_name"),
  note: text("note"),
  addedByEmail: text("added_by_email"),
  addedAt: timestamp("added_at").defaultNow().notNull(),
});
