// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { db } from "@workspace/db";
import { usersTable, employeesTable } from "@workspace/db/schema";
import { eq, ilike } from "drizzle-orm";

export async function findUserById(userId: string) {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  return user ?? null;
}

export async function findEmployeeByEmail(email: string) {
  const [employee] = await db
    .select()
    .from(employeesTable)
    .where(ilike(employeesTable.email, email))
    .limit(1);

  return employee ?? null;
}

export async function isOwnerAdmin(userId: string): Promise<boolean> {
  const user = await findUserById(userId);
  return !!user?.isAdmin;
}

export async function getUserRoleProfile(userId: string) {
  const user = await findUserById(userId);

  if (!user) {
    return {
      user: null,
      employee: null,
      isOwner: false,
      isEmployee: false,
      isAdminEmployee: false,
    };
  }

  const employee = user.email ? await findEmployeeByEmail(user.email) : null;

  return {
    user,
    employee,
    isOwner: !!user.isAdmin,
    isEmployee: !!employee,
    isAdminEmployee: !!employee?.isAdminEmployee,
  };
}
