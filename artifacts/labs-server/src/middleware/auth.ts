// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Labs Server Auth — admin-only enforcement for offensive security tools.
// Every labs route requires both a valid Clerk session AND the admin email list.

import { getAuth } from "@clerk/express";
import { createClerkClient } from "@clerk/express";
import type { Request, Response, NextFunction } from "express";

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY ?? "",
});

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

export async function requireLabsAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const { userId } = getAuth(req);

  if (!userId) {
    res.status(401).json({
      error:  "Unauthorized — valid Clerk session required.",
      code:   "LABS_AUTH_REQUIRED",
    });
    return;
  }

  try {
    const user  = await clerkClient.users.getUser(userId);
    const email = user.emailAddresses.find(e => e.id === user.primaryEmailAddressId)?.emailAddress
                  ?? user.emailAddresses[0]?.emailAddress
                  ?? "";

    if (!ADMIN_EMAILS.includes(email)) {
      res.status(403).json({
        error:  "Labs access requires administrator privileges.",
        code:   "LABS_ADMIN_REQUIRED",
        hint:   "These offensive tools are restricted to platform administrators.",
      });
      return;
    }

    (req as any).labsUser = { userId, email };
    next();
  } catch {
    res.status(403).json({
      error: "Could not verify admin status — try again.",
      code:  "LABS_AUTH_VERIFY_FAILED",
    });
  }
}
