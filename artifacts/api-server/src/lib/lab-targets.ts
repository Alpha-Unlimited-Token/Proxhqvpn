// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// requireLabTarget — safety gate that MUST be called before any exec(sqlmap/nmap/os-cmd)
// against an external IP. Throws 403 if the IP is not in the lab_targets whitelist.
import { db } from "@workspace/db";
import { labTargetsTable } from "@workspace/db/schema";
import { and, eq, or, isNull, gt } from "drizzle-orm";

/**
 * Checks whether `ip` is an authorized lab scan target.
 * Returns the record if authorized, throws a 403-tagged error if not.
 */
export async function requireLabTarget(ip: string): Promise<typeof labTargetsTable.$inferSelect> {
  const now = new Date();
  const [target] = await db
    .select()
    .from(labTargetsTable)
    .where(
      and(
        eq(labTargetsTable.ip, ip),
        eq(labTargetsTable.active, true),
        or(isNull(labTargetsTable.expiresAt), gt(labTargetsTable.expiresAt, now)),
      ),
    )
    .limit(1);

  if (!target) {
    const err = new Error(
      `Forbidden: ${ip} is not an authorized lab target. Add it via Admin → Lab Targets before running offensive tools.`,
    ) as Error & { statusCode: number };
    err.statusCode = 403;
    throw err;
  }

  return target;
}
