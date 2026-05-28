// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Router } from "express";
import { clerkClient } from "@clerk/express";
import { db } from "@workspace/db";
import { usersTable, employeesTable } from "@workspace/db/schema";
import { ambassadorsTable } from "@workspace/db/schema";
import { requireAdmin } from "../middlewares/requireAdmin";
import { sql } from "drizzle-orm";
import { z } from "zod";

const router = Router();

/**
 * GET /api/admin/users
 * Returns all Clerk users enriched with DB role data.
 */
router.get("/", requireAdmin, async (_req, res) => {
  // Fetch up to 500 users from Clerk
  const clerkResponse = await clerkClient.users.getUserList({ limit: 500, orderBy: "-created_at" });
  const clerkUsers = clerkResponse.data ?? clerkResponse ?? [];

  // Pull all DB users, employees, and ambassadors in parallel
  const [dbUsers, dbEmployees, dbAmbassadors] = await Promise.all([
    db.select().from(usersTable),
    db.select().from(employeesTable),
    db.execute(sql`SELECT user_id, name, promo_code, status FROM ambassadors`),
  ]);

  const dbUserMap = new Map(dbUsers.map((u) => [u.id, u]));
  const empMap    = new Map(dbEmployees.map((e) => [e.email.toLowerCase(), e]));
  const ambRows: any[] = Array.isArray(dbAmbassadors)
    ? dbAmbassadors
    : (dbAmbassadors as any).rows ?? [];
  const ambMap    = new Map(ambRows.map((a: any) => [a.user_id as string, a]));

  const result = (clerkUsers as any[]).map((cu) => {
    const primaryEmail =
      cu.emailAddresses?.find((e: any) => e.id === cu.primaryEmailAddressId)
        ?.emailAddress ?? null;
    const dbUser  = dbUserMap.get(cu.id);
    const emp     = primaryEmail ? empMap.get(primaryEmail.toLowerCase()) : undefined;
    const amb     = ambMap.get(cu.id);

    return {
      clerkId:     cu.id,
      email:       primaryEmail,
      firstName:   cu.firstName ?? null,
      lastName:    cu.lastName ?? null,
      imageUrl:    cu.imageUrl ?? null,
      createdAt:   cu.createdAt ? new Date(cu.createdAt).toISOString() : null,
      lastSignIn:  cu.lastSignInAt ? new Date(cu.lastSignInAt).toISOString() : null,
      isAdmin:     dbUser?.isAdmin ?? false,
      isEmployee:  !!emp,
      isAdminEmployee: emp?.isAdminEmployee ?? false,
      employeeId:  emp?.id ?? null,
      isAmbassador: !!amb,
      ambassadorStatus: amb?.status ?? null,
      ambassadorPromoCode: amb?.promo_code ?? null,
      stripeSubscriptionId: dbUser?.stripeSubscriptionId ?? null,
    };
  });

  res.json(result);
});

/**
 * POST /api/admin/users/:clerkId/make-employee
 * Adds user as an employee (by email).
 */
router.post("/:clerkId/make-employee", requireAdmin, async (req, res) => {
  const body = z.object({
    displayName: z.string().max(80).optional(),
    note:        z.string().max(300).optional(),
  }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "Invalid input" });

  const cu = await clerkClient.users.getUser(req.params.clerkId);
  const email =
    cu.emailAddresses?.find((e: any) => e.id === cu.primaryEmailAddressId)
      ?.emailAddress ?? null;
  if (!email) return res.status(400).json({ error: "User has no primary email" });

  const addedBy = (req as any).adminEmail ?? "admin";
  try {
    const [row] = await db
      .insert(employeesTable)
      .values({
        email: email.toLowerCase().trim(),
        displayName: body.data.displayName ?? cu.firstName ?? null,
        note: body.data.note ?? null,
        addedByEmail: addedBy,
      })
      .onConflictDoUpdate({
        target: employeesTable.email,
        set: {
          displayName: body.data.displayName ?? cu.firstName ?? null,
          note: body.data.note ?? null,
        },
      })
      .returning();
    res.status(201).json(row);
  } catch (err: any) {
    throw err;
  }
});

/**
 * POST /api/admin/users/:clerkId/make-ambassador
 * Adds user as an approved ambassador.
 */
router.post("/:clerkId/make-ambassador", requireAdmin, async (req, res) => {
  const body = z.object({
    promoCode:   z.string().min(3).max(20).regex(/^[A-Z0-9]+$/, "Uppercase alphanumeric only"),
    displayName: z.string().max(80).optional(),
    bio:         z.string().max(500).optional(),
  }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: "Invalid input", details: body.error.issues });

  const { clerkId } = req.params;

  try {
    await db.execute(sql`
      INSERT INTO ambassadors (user_id, name, bio, promo_code, status, social_urls)
      VALUES (
        ${clerkId},
        ${body.data.displayName ?? "Ambassador"},
        ${body.data.bio ?? null},
        ${body.data.promoCode.toUpperCase()},
        ${"approved"},
        ${"{}"}::jsonb
      )
      ON CONFLICT (user_id) DO UPDATE
        SET status     = ${"approved"},
            name       = EXCLUDED.name,
            bio        = EXCLUDED.bio,
            promo_code = EXCLUDED.promo_code
    `);
    res.status(201).json({ ok: true, promoCode: body.data.promoCode.toUpperCase() });
  } catch (err: any) {
    if (err.code === "23505") return res.status(409).json({ error: "Promo code already taken — choose a different one" });
    throw err;
  }
});

/**
 * DELETE /api/admin/users/:clerkId/remove-employee
 */
router.delete("/:clerkId/remove-employee", requireAdmin, async (req, res) => {
  const cu = await clerkClient.users.getUser(req.params.clerkId);
  const email =
    cu.emailAddresses?.find((e: any) => e.id === cu.primaryEmailAddressId)
      ?.emailAddress ?? null;
  if (!email) return res.status(400).json({ error: "No email found" });

  const { ilike } = await import("drizzle-orm");
  const [row] = await db
    .delete(employeesTable)
    .where(ilike(employeesTable.email, email))
    .returning();
  if (!row) return res.status(404).json({ error: "Not an employee" });
  res.json({ ok: true });
});

export default router;
