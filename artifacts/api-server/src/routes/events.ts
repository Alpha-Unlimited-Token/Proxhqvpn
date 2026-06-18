// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// GET /api/events/stream — SSE endpoint for real-time security event push.
// Authenticated clients subscribe here; workers call broadcastSecurityEvent().

import { Router }      from "express";
import { getAuth }     from "@clerk/express";
import crypto          from "crypto";
import { asyncHandler } from "../middlewares/asyncHandler";
import { requireAuth }  from "./_auth";
import { registerSseClient, getSseClientCount } from "../lib/sse-event-bus";
import { db }           from "@workspace/db";
import { usersTable }   from "@workspace/db";
import { eq }           from "drizzle-orm";

const router = Router();

// GET /api/events/stream
// Opens an SSE stream for the authenticated user.
// Receives:
//   event: connected  — on connect
//   event: security   — security broadcasts (adminOnly events only sent to admins)
//   event: user       — per-user notifications
//   : heartbeat       — SSE comment every 25s
router.get(
  "/stream",
  requireAuth,
  asyncHandler(async (req, res) => {
    const { userId } = getAuth(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    // Determine admin status for fanout filtering
    const [user] = await db
      .select({ isAdmin: usersTable.isAdmin })
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);

    const isAdmin  = !!(user?.isAdmin);
    const connId   = crypto.randomUUID();

    registerSseClient(connId, userId, isAdmin, res);
    // Response is held open — do not end it here
  }),
);

// GET /api/events/status — admin: how many SSE clients are connected
router.get("/status", asyncHandler(async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  const [user] = await db.select({ isAdmin: usersTable.isAdmin }).from(usersTable).where(eq(usersTable.id, userId));
  if (!user?.isAdmin) return res.status(403).json({ error: "Forbidden" });
  res.json({ connectedClients: getSseClientCount() });
}));

export default router;
