import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { getAuth } from "@clerk/express";
import healthRouter from "./health";
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

const router: IRouter = Router();

// Public routes
router.use(healthRouter);

// Auth guard — all routes below require a valid Clerk session
const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  next();
};
router.use(requireAuth);

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

export default router;
