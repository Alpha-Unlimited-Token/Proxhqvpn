import { Router } from "express";
import { getAuth, clerkClient } from "@clerk/express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { isEmployeeEmail } from "./employees";
import { eq } from "drizzle-orm";

const router = Router();

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

router.get("/", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const clerkUser = await clerkClient.users.getUser(userId);
  const email =
    clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId)
      ?.emailAddress ?? null;

  const isAdminByEmail = email ? ADMIN_EMAILS.includes(email.toLowerCase()) : false;

  const conflictSet: Record<string, unknown> = { email: email ?? undefined };
  if (isAdminByEmail) conflictSet.isAdmin = true;

  const [dbUser] = await db
    .insert(usersTable)
    .values({ id: userId, email: email ?? undefined, isAdmin: isAdminByEmail })
    .onConflictDoUpdate({ target: usersTable.id, set: conflictSet })
    .returning();

  const isEmployee = email ? await isEmployeeEmail(email) : false;

  return res.json({
    userId,
    email,
    isAdmin: dbUser?.isAdmin ?? isAdminByEmail,
    isEmployee,
  });
});

export default router;
export { ADMIN_EMAILS };
