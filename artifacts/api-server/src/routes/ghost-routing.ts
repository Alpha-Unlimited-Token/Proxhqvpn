// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Ghost Routing — ephemeral offensive exit node provisioning and management.
// Routes are mounted at /api/ghost-nodes/exit
//
// Privacy model enforced here:
//   • User's real IP is never stored (only their Clerk userId).
//   • Exit IP = ghost node's IP (what websites see, not the user).
//   • WG server private key: in Vultr user-data (ephemeral) + node RAM only.
//   • On /disconnect or /burn: Vultr instance destroyed → RAM cleared.

import { Router } from "express";
import { getAuth } from "@clerk/express";
import { z } from "zod";
import { db } from "@workspace/db";
import { ghostNodeEventsTable, ghostExitSessionsTable } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import {
  provisionGhostExitSession,
  registerNodeCallback,
  getSessionConfig,
  listSessionsForUser,
  destroyExitSession,
  burnAndReprovision,
} from "../services/ghostExitSessionService";
import { appendAuditEvent } from "../lib/audit-chain";
import { shipSecurityEvent } from "../lib/siem";
import { requireRbac } from "../middlewares/requireRbac";

const router = Router();

const VULTR_REGIONS = [
  "lax", "lhr", "ord", "nrt", "ewr", "mia", "atl", "dfw",
  "sea", "ams", "fra", "par", "syd", "sgp", "yto", "sao",
  "icn", "bom", "mel", "mad", "waw", "man", "sto",
] as const;

// ── POST /provision — spin up a fresh ephemeral exit node ─────────────────────
router.post("/provision", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const parsed = z.object({
    region: z.enum(VULTR_REGIONS, {
      errorMap: () => ({ message: `region must be one of: ${VULTR_REGIONS.join(", ")}` }),
    }),
  }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const result = await provisionGhostExitSession({ userId, region: parsed.data.region });

    appendAuditEvent({
      actor:    userId,
      action:   "ghost_exit.provision",
      resource: `ghost_exit_session:${result.sessionId}`,
      metadata: { region: parsed.data.region },
    });
    void shipSecurityEvent({
      actor:    userId,
      action:   "ghost_exit.provision",
      resource: `ghost_exit_session:${result.sessionId}`,
      result:   "allow",
      metadata: { region: parsed.data.region },
    });

    return res.status(201).json(result);
  } catch (err: any) {
    return res.status(502).json({ error: err.message ?? "Provisioning failed" });
  }
});

// ── GET / — list user's recent sessions ──────────────────────────────────────
router.get("/", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  const sessions = await listSessionsForUser(userId);
  return res.json({ sessions });
});

// ── GET /:id — get session status + WG config ────────────────────────────────
router.get("/:id", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const id = req.params.id as string;
  if (!id || id.length < 10) return res.status(400).json({ error: "Invalid session id" });

  const result = await getSessionConfig(id, userId);
  if (!result) return res.status(404).json({ error: "Session not found" });

  return res.json({
    session: {
      id:             result.session.id,
      region:         result.session.region,
      exitIp:         result.session.exitIp,
      status:         result.session.status,
      probeCount:     result.session.probeCount,
      provisionedAt:  result.session.provisionedAt,
      readyAt:        result.session.readyAt,
      connectedAt:    result.session.connectedAt,
      endedAt:        result.session.endedAt,
      destroyedAt:    result.session.destroyedAt,
      burnReason:     result.session.burnReason,
    },
    wgConfig: result.wgConfig,
  });
});

// ── POST /:id/register — called by the Vultr node itself on boot ──────────────
// PSK-authenticated (no Clerk) — this is a machine-to-machine callback.
router.post("/:id/register", async (req, res) => {
  const id = req.params.id as string;
  const psk = req.headers["x-session-psk"] as string | undefined;
  if (!psk) return res.status(401).json({ error: "Missing X-Session-PSK header" });

  const parsed = z.object({
    serverPubkey: z.string().min(40).max(60),
    exitIp:       z.string().ip(),
  }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { ok, reason } = await registerNodeCallback(
    id, psk, parsed.data.exitIp, parsed.data.serverPubkey,
  );
  if (!ok) return res.status(403).json({ error: reason ?? "Registration rejected" });

  return res.json({ ok: true });
});

// ── GET /:id/probes — recent attacker probe events targeting this exit IP ──────
router.get("/:id/probes", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const id = req.params.id as string;

  // Verify session belongs to user
  const [session] = await db.select({
    exitIp:     ghostExitSessionsTable.exitIp,
    ghostNodeId: ghostExitSessionsTable.ghostNodeId,
    probeCount: ghostExitSessionsTable.probeCount,
  })
    .from(ghostExitSessionsTable)
    .where(and(eq(ghostExitSessionsTable.id, id), eq(ghostExitSessionsTable.userId, userId)))
    .limit(1);
  if (!session) return res.status(404).json({ error: "Session not found" });

  // Pull recent events from ghost_node_events for the linked ghost node
  const probes = session.ghostNodeId
    ? await db.select({
        id:          ghostNodeEventsTable.id,
        eventType:   ghostNodeEventsTable.eventType,
        sourceIp:    ghostNodeEventsTable.sourceIp,
        sourcePort:  ghostNodeEventsTable.sourcePort,
        geoCountry:  ghostNodeEventsTable.geoCountry,
        geoCity:     ghostNodeEventsTable.geoCity,
        geoAsn:      ghostNodeEventsTable.geoAsn,
        severity:    ghostNodeEventsTable.severity,
        createdAt:   ghostNodeEventsTable.createdAt,
      })
        .from(ghostNodeEventsTable)
        .where(eq(ghostNodeEventsTable.ghostNodeId, session.ghostNodeId))
        .orderBy(desc(ghostNodeEventsTable.createdAt))
        .limit(100)
    : [];

  return res.json({ probes, probeCount: session.probeCount, exitIp: session.exitIp });
});

// ── POST /:id/disconnect — gracefully end session + destroy Vultr node ─────────
router.post("/:id/disconnect", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  const id = req.params.id as string;

  try {
    await destroyExitSession(id, userId, "disconnect");
    appendAuditEvent({
      actor:    userId,
      action:   "ghost_exit.disconnect",
      resource: `ghost_exit_session:${id}`,
      metadata: {},
    });
    return res.json({ ok: true, message: "Session ended. Vultr instance destroyed. RAM cleared — WireGuard private key is irrecoverably gone." });
  } catch (err: any) {
    return res.status(400).json({ error: err.message ?? "Disconnect failed" });
  }
});

// ── POST /:id/burn — emergency IP rotation: destroy + reprovision same region ──
router.post("/:id/burn", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  const id = req.params.id as string;

  try {
    const result = await burnAndReprovision(id, userId);
    appendAuditEvent({
      actor:    userId,
      action:   "ghost_exit.burn",
      resource: `ghost_exit_session:${id}`,
      metadata: { newSessionId: result.sessionId },
    });
    return res.json({ ok: true, ...result });
  } catch (err: any) {
    return res.status(400).json({ error: err.message ?? "Burn failed" });
  }
});

export default router;
