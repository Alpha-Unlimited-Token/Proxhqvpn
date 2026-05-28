// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { employeesTable } from "@workspace/db/schema";
import { eq, ilike } from "drizzle-orm";
import { z } from "zod";
import { requireAdmin } from "../middlewares/requireAdmin";

const router = Router();

const SEED_EMPLOYEES = [
  {
    email: "charliechris1982@gmail.com",
    displayName: "Charlie Chris",
    note: "Founding employee — full access",
    addedByEmail: "admin",
    isAmbassador: true,
    ambassadorPromoCode: "CHARLIE10",
    isAdminEmployee: true,
  },
  {
    email: "cartowplayer@gmail.com",
    displayName: "Employee Admin",
    note: "Employee admin — platform access below owner level",
    addedByEmail: "alphaunlimitedtechnologies@gmail.com",
    isAmbassador: true,
    ambassadorPromoCode: "CARTOW10",
    isAdminEmployee: true,
  },
  {
    email: "goontv2018@gmail.com",
    displayName: "GoonTV",
    note: "Employee admin & ambassador",
    addedByEmail: "alphaunlimitedtechnologies@gmail.com",
    isAmbassador: true,
    ambassadorPromoCode: "GOONTV10",
    isAdminEmployee: true,
  },
];

export async function seedEmployees() {
  for (const emp of SEED_EMPLOYEES) {
    await db
      .insert(employeesTable)
      .values(emp)
      .onConflictDoUpdate({
        target: employeesTable.email,
        set: {
          isAmbassador: emp.isAmbassador ?? false,
          ambassadorPromoCode: emp.ambassadorPromoCode ?? null,
          isAdminEmployee: emp.isAdminEmployee ?? false,
          displayName: emp.displayName ?? null,
          note: emp.note ?? null,
        },
      });
  }
}

/** Returns the employee row (including ambassador fields) if found, else null */
export async function getEmployeeByEmail(email: string | null | undefined) {
  if (!email) return null;
  const rows = await db
    .select()
    .from(employeesTable)
    .where(ilike(employeesTable.email, email.trim()));
  return rows[0] ?? null;
}

export async function isEmployeeEmail(email: string | null | undefined): Promise<boolean> {
  if (!email) return false;
  const rows = await db
    .select({ id: employeesTable.id })
    .from(employeesTable)
    .where(ilike(employeesTable.email, email.trim()));
  return rows.length > 0;
}

router.get("/", requireAdmin, async (_req, res) => {
  const rows = await db
    .select()
    .from(employeesTable)
    .orderBy(employeesTable.addedAt);
  res.json(rows);
});

router.post("/", requireAdmin, async (req, res) => {
  const body = z.object({
    email:               z.string().email(),
    displayName:         z.string().max(80).optional(),
    note:                z.string().max(300).optional(),
    isAdminEmployee:     z.boolean().optional(),
    isAmbassador:        z.boolean().optional(),
    ambassadorPromoCode: z.string().max(20).regex(/^[A-Z0-9]*$/, "Uppercase alphanumeric only").optional(),
  }).safeParse(req.body);

  if (!body.success) return res.status(400).json({ error: "Invalid input", details: body.error.issues });

  const { userId } = getAuth(req);
  const addedByEmail = (req as any).adminEmail ?? userId ?? "admin";

  try {
    const [row] = await db
      .insert(employeesTable)
      .values({
        email:               body.data.email.toLowerCase().trim(),
        displayName:         body.data.displayName ?? null,
        note:                body.data.note ?? null,
        addedByEmail,
        isAdminEmployee:     body.data.isAdminEmployee ?? false,
        isAmbassador:        body.data.isAmbassador ?? false,
        ambassadorPromoCode: body.data.ambassadorPromoCode ?? null,
      })
      .returning();
    res.status(201).json(row);
  } catch (err: any) {
    if (err.code === "23505") return res.status(409).json({ error: "Employee with that email already exists" });
    throw err;
  }
});

router.patch("/:id", requireAdmin, async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const body = z.object({
    displayName:         z.string().max(80).optional(),
    note:                z.string().max(300).optional(),
    isAdminEmployee:     z.boolean().optional(),
    isAmbassador:        z.boolean().optional(),
    ambassadorPromoCode: z.string().max(20).regex(/^[A-Z0-9]*$/, "Uppercase alphanumeric only").optional().nullable(),
  }).safeParse(req.body);

  if (!body.success) return res.status(400).json({ error: "Invalid input", details: body.error.issues });

  const updates: Record<string, unknown> = {};
  if (body.data.displayName         !== undefined) updates.displayName         = body.data.displayName;
  if (body.data.note                !== undefined) updates.note                = body.data.note;
  if (body.data.isAdminEmployee     !== undefined) updates.isAdminEmployee     = body.data.isAdminEmployee;
  if (body.data.isAmbassador        !== undefined) updates.isAmbassador        = body.data.isAmbassador;
  if (body.data.ambassadorPromoCode !== undefined) updates.ambassadorPromoCode = body.data.ambassadorPromoCode;

  if (Object.keys(updates).length === 0) return res.status(400).json({ error: "No fields to update" });

  const { eq: eqFn } = await import("drizzle-orm");
  const [row] = await db
    .update(employeesTable)
    .set(updates as any)
    .where(eqFn(employeesTable.id, id))
    .returning();

  if (!row) return res.status(404).json({ error: "Employee not found" });
  res.json(row);
});

router.delete("/:id", requireAdmin, async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const [row] = await db
    .delete(employeesTable)
    .where(eq(employeesTable.id, id))
    .returning();

  if (!row) return res.status(404).json({ error: "Employee not found" });
  res.json({ ok: true, deleted: row });
});

export default router;
