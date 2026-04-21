import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import fs from "fs";
import path from "path";
import healthRouter from "./health";
import meRouter from "./me";
import nodesRouter from "./nodes";
import beaconsRouter from "./beacons";
import silkwebRouter from "./silkweb";
import firewallRouter from "./firewall";
import monitorRouter from "./monitor";
import terminalRouter from "./terminal";
import sqlRouter from "./sqlquery";
import proxyBrowserRouter from "./proxybrowser";
import killswitchRouter from "./killswitch";
import leaksRouter from "./leaks";
import threatintelRouter from "./threatintel";
import splittunnelRouter from "./splittunnel";
import obfuscationRouter from "./obfuscation";
import securityauditRouter from "./securityaudit";
import daemonRouter from "./daemon";
import vpnCoexistRouter from "./vpncoexist";
import vpnGateRouter from "./vpngate";
import devicesRouter from "./devices";
import dnsShieldRouter from "./dnsshield";
import smartDnsRouter from "./smartdns";
import routerConfigRouter from "./routerconfig";
import stripeRouter from "./stripe";
import wireguardRouter from "./wireguard";
import daemonInboundRouter from "./daemon-inbound";
import sqlmapRouter from "./sqlmap";

const router: IRouter = Router();

// Public routes
router.use(healthRouter);

// Daemon inbound — authenticated via PSK header (not Clerk), public route
router.use("/daemon-inbound", daemonInboundRouter);

// Public daemon download — serves proxhqd.py for deployment to VPN nodes
router.get("/daemon-download", (_req: Request, res: Response) => {
  const filePath = path.resolve(process.cwd(), "../../tools/proxhqd.py");
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "Daemon file not found" });
  }
  res.setHeader("Content-Type", "text/plain");
  res.setHeader("Content-Disposition", "attachment; filename=proxhqd.py");
  res.send(fs.readFileSync(filePath, "utf-8"));
});

// Auth guard — all routes below require a valid Clerk session
const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  next();
};
router.use(requireAuth);

// Admin guard — checks is_admin flag in DB
export const requireAdmin = async (req: Request, res: Response, next: NextFunction) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user?.isAdmin) return res.status(403).json({ error: "Forbidden: admin only" });
  next();
};

router.use("/me",             meRouter);
router.use("/nodes",          nodesRouter);
router.use("/beacons",        beaconsRouter);
router.use("/silkweb",        silkwebRouter);
router.use("/firewall",       firewallRouter);
router.use("/monitor",        monitorRouter);
router.use("/terminal",       terminalRouter);
router.use("/sql",            sqlRouter);
router.use("/proxy-browser",  proxyBrowserRouter);
router.use("/killswitch",     killswitchRouter);
router.use("/leaks",          leaksRouter);
router.use("/threatintel",    threatintelRouter);
router.use("/split-tunnel",   splittunnelRouter);
router.use("/obfuscation",    obfuscationRouter);
router.use("/security-audit", securityauditRouter);
router.use("/daemon",         daemonRouter);
router.use("/vpn-coexist",    vpnCoexistRouter);
router.use("/vpngate",        vpnGateRouter);
router.use("/devices",        devicesRouter);
router.use("/dns-shield",     dnsShieldRouter);
router.use("/smart-dns",      smartDnsRouter);
router.use("/router-config",  routerConfigRouter);

// Stripe routes — require auth (enforced above)
router.use("/stripe",         stripeRouter);
router.use("/wireguard",      wireguardRouter);
router.use("/sqlmap",         sqlmapRouter);

export default router;
