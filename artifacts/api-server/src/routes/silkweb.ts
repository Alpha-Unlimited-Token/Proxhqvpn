import { Router } from "express";
import { db } from "@workspace/db";
import { silkWebTable, silkRoutesTable, trappedAttackersTable, nodesTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import crypto from "crypto";

const router = Router();

async function ensureWeb() {
  const webs = await db.select().from(silkWebTable).orderBy(sql`created_at DESC`).limit(1);
  if (webs.length > 0) return webs[0];

  const nodes = await db.select().from(nodesTable);
  const genId = crypto.randomUUID().substring(0, 8).toUpperCase();
  const totalRoutes = Math.min(nodes.length * 2, 200);
  const deadEnds = Math.floor(totalRoutes * 0.4);

  const [web] = await db.insert(silkWebTable).values({
    generationId: genId,
    totalRoutes,
    deadEndRoutes: deadEnds,
    activeHighways: Math.floor(totalRoutes * 0.3),
    intersections: Math.floor(totalRoutes * 0.2),
    createdAt: new Date(),
  }).returning();

  if (nodes.length >= 2) {
    const routeValues = [];
    for (let i = 0; i < Math.min(totalRoutes, 50); i++) {
      const from = nodes[Math.floor(Math.random() * nodes.length)];
      const to = nodes[Math.floor(Math.random() * nodes.length)];
      if (from.id !== to.id) {
        const routeTypes = ["highway", "dead_end", "decoy", "collapse_zone"];
        routeValues.push({
          webId: web.id,
          fromNodeId: from.id,
          toNodeId: to.id,
          routeType: i < deadEnds ? "dead_end" : routeTypes[Math.floor(Math.random() * routeTypes.length)],
          isActive: true,
        });
      }
    }
    if (routeValues.length > 0) {
      await db.insert(silkRoutesTable).values(routeValues);
    }
  }

  return web;
}

router.get("/", async (req, res) => {
  const web = await ensureWeb();
  const routes = await db.select().from(silkRoutesTable).where(eq(silkRoutesTable.webId, web.id));
  res.json({ ...web, routes });
});

router.post("/collapse", async (req, res) => {
  await db.delete(silkRoutesTable);
  await db.delete(silkWebTable);

  const nodes = await db.select().from(nodesTable);
  const genId = crypto.randomUUID().substring(0, 8).toUpperCase();
  const totalRoutes = Math.min(nodes.length * 2, 200);
  const deadEnds = Math.floor(totalRoutes * 0.4);

  const [web] = await db.insert(silkWebTable).values({
    generationId: genId,
    totalRoutes,
    deadEndRoutes: deadEnds,
    activeHighways: Math.floor(totalRoutes * 0.35),
    intersections: Math.floor(totalRoutes * 0.25),
    lastCollapsedAt: new Date(),
    createdAt: new Date(),
  }).returning();

  if (nodes.length >= 2) {
    const routeValues = [];
    for (let i = 0; i < Math.min(totalRoutes, 50); i++) {
      const from = nodes[Math.floor(Math.random() * nodes.length)];
      const to = nodes[Math.floor(Math.random() * nodes.length)];
      if (from.id !== to.id) {
        routeValues.push({
          webId: web.id,
          fromNodeId: from.id,
          toNodeId: to.id,
          routeType: i < deadEnds ? "dead_end" : ["highway", "decoy", "collapse_zone"][Math.floor(Math.random() * 3)],
          isActive: true,
        });
      }
    }
    if (routeValues.length > 0) {
      await db.insert(silkRoutesTable).values(routeValues);
    }
  }

  const routes = await db.select().from(silkRoutesTable).where(eq(silkRoutesTable.webId, web.id));
  res.json({ ...web, routes });
});

router.get("/trapped", async (req, res) => {
  const attackers = await db.select().from(trappedAttackersTable).orderBy(sql`trapped_at DESC`);
  res.json({ attackers, total: attackers.length });
});

export default router;
