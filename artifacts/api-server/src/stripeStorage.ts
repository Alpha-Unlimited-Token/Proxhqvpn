import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";

export class StripeStorage {
  async getUser(id: string) {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
    return user ?? null;
  }

  async upsertUser(id: string, email?: string) {
    const [user] = await db
      .insert(usersTable)
      .values({ id, email })
      .onConflictDoUpdate({ target: usersTable.id, set: { email } })
      .returning();
    return user;
  }

  async updateUserStripeInfo(userId: string, info: { stripeCustomerId?: string; stripeSubscriptionId?: string }) {
    const [user] = await db
      .update(usersTable)
      .set(info)
      .where(eq(usersTable.id, userId))
      .returning();
    return user;
  }

  async listProductsWithPrices() {
    const result = await db.execute(sql`
      SELECT
        p.id            AS product_id,
        p.name          AS product_name,
        p.description   AS product_description,
        p.active        AS product_active,
        p.metadata      AS product_metadata,
        pr.id           AS price_id,
        pr.unit_amount,
        pr.currency,
        pr.recurring,
        pr.active       AS price_active,
        pr.metadata     AS price_metadata
      FROM stripe.products p
      LEFT JOIN stripe.prices pr ON pr.product = p.id AND pr.active = true
      WHERE p.active = true
      ORDER BY p.id, pr.unit_amount
    `);
    return result.rows;
  }

  async getSubscription(subscriptionId: string) {
    const result = await db.execute(sql`SELECT * FROM stripe.subscriptions WHERE id = ${subscriptionId}`);
    return result.rows[0] ?? null;
  }

  /**
   * Returns "vpn" | "command_center" | null for the given subscription.
   * Looks at the product linked to the first subscription item and reads
   * its metadata.tier field.
   */
  async getSubscriptionTier(subscriptionId: string): Promise<"vpn" | "command_center" | null> {
    try {
      // Extract product ID from subscription items JSONB
      const result = await db.execute(sql`
        SELECT p.metadata->>'tier' AS tier
        FROM stripe.subscriptions s
        JOIN stripe.products p
          ON p.id = (s.items->'data'->0->'price'->>'product')
        WHERE s.id = ${subscriptionId}
        LIMIT 1
      `);
      const row = result.rows[0] as any;
      if (row?.tier === "vpn" || row?.tier === "command_center") return row.tier;

      // Fallback: also try plan column (older Stripe format)
      const fallback = await db.execute(sql`
        SELECT p.metadata->>'tier' AS tier
        FROM stripe.subscriptions s
        JOIN stripe.prices pr ON pr.id = s.plan
        JOIN stripe.products p ON p.id = pr.product
        WHERE s.id = ${subscriptionId}
        LIMIT 1
      `);
      const fb = fallback.rows[0] as any;
      if (fb?.tier === "vpn" || fb?.tier === "command_center") return fb.tier;

      // Last resort: if subscribed but tier unknown, treat as command_center
      // (covers legacy "ProxhqVPN" all-in-one product from before the split)
      const sub = await this.getSubscription(subscriptionId);
      if (sub?.status === "active" || sub?.status === "trialing") return "command_center";

      return null;
    } catch {
      return null;
    }
  }
}

export const stripeStorage = new StripeStorage();
