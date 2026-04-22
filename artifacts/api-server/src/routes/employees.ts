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
    email: z.string().email(),
    displayName: z.string().max(80).optional(),
    note: z.string().max(300).optional(),
  }).safeParse(req.body);

  if (!body.success) return res.status(400).json({ error: "Invalid input", details: body.error.issues });

  const { userId } = getAuth(req);
  const addedByEmail = (req as any).adminEmail ?? userId ?? "admin";

  try {
    const [row] = await db
      .insert(employeesTable)
      .values({
        email: body.data.email.toLowerCase().trim(),
        displayName: body.data.displayName ?? null,
        note: body.data.note ?? null,
        addedByEmail,
      })
      .returning();
    res.status(201).json(row);
  } catch (err: any) {
    if (err.code === "23505") return res.status(409).json({ error: "Employee with that email already exists" });
    throw err;
  }
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
