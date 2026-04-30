import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import {
  userWgConfigsTable,
  wgPeerCommandsTable,
  nodesTable,
  vpngateNodeSessionsTable,
} from "@workspace/db";
import { isNull, desc, eq } from "drizzle-orm";

const router = Router();

router.get("/overview", async (req: Request, res: Response) => {
  try {
    const [allConfigs, allPeerCmds, allNodes, allVpngateSessions] =
      await Promise.all([
        db
          .select()
          .from(userWgConfigsTable)
          .orderBy(desc(userWgConfigsTable.createdAt)),
        db
          .select()
          .from(wgPeerCommandsTable)
          .orderBy(desc(wgPeerCommandsTable.createdAt))
          .limit(100),
        db.select().from(nodesTable).orderBy(nodesTable.name),
        db
          .select()
          .from(vpngateNodeSessionsTable)
          .orderBy(desc(vpngateNodeSessionsTable.assignedAt))
          .limit(50),
      ]);

    const nodeMap = new Map(allNodes.map((n) => [n.id, n]));

    const activePeers = allConfigs.filter((c) => !c.revokedAt);
    const revokedPeers = allConfigs.filter((c) => c.revokedAt);

    const nodeActivity: Record<
      number,
      { peerCount: number; node: (typeof allNodes)[0] }
    > = {};
    for (const n of allNodes) {
      nodeActivity[n.id] = { peerCount: 0, node: n };
    }
    for (const c of activePeers) {
      if (nodeActivity[c.nodeId]) nodeActivity[c.nodeId].peerCount++;
    }

    const activeNodes = allNodes.filter((n) => n.status === "active").length;
    const inactiveNodes = allNodes.filter((n) => n.status !== "active").length;

    const activeVpngateSessions = allVpngateSessions.filter(
      (s) => s.status === "connected"
    );

    const countryFreq: Record<string, number> = {};
    for (const s of allVpngateSessions) {
      if (s.serverCountry) {
        countryFreq[s.serverCountry] = (countryFreq[s.serverCountry] ?? 0) + 1;
      }
    }
    const topGateCountries = Object.entries(countryFreq)
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const cmdStats = {
      pending: allPeerCmds.filter((c) => c.status === "pending").length,
      applied: allPeerCmds.filter((c) => c.status === "applied").length,
      failed: allPeerCmds.filter((c) => c.status === "failed").length,
    };

    const enrichedConfigs = allConfigs.slice(0, 60).map((c) => ({
      ...c,
      clientPrivateKey: undefined,
      node: nodeMap.get(c.nodeId) ?? null,
    }));

    const enrichedSessions = allVpngateSessions.map((s) => ({
      ...s,
      ovpnConfigB64: undefined,
      node: nodeMap.get(s.nodeId) ?? null,
    }));

    const recentCommands = allPeerCmds.slice(0, 30).map((c) => ({
      ...c,
      node: nodeMap.get(c.nodeId) ?? null,
    }));

    res.json({
      summary: {
        activePeers: activePeers.length,
        revokedPeers: revokedPeers.length,
        totalConfigs: allConfigs.length,
        activeNodes,
        inactiveNodes,
        totalNodes: allNodes.length,
        activeVpngateSessions: activeVpngateSessions.length,
        totalVpngateSessions: allVpngateSessions.length,
        cmdStats,
      },
      nodeHealth: Object.values(nodeActivity).map(({ peerCount, node }) => ({
        ...node,
        activePeerCount: peerCount,
      })),
      peers: enrichedConfigs,
      vpngateSessions: enrichedSessions,
      topGateCountries,
      recentCommands,
    });
  } catch (err) {
    req.log.error({ err }, "vpntracker overview error");
    res.status(500).json({ error: "Failed to load VPN tracker data" });
  }
});

export default router;
