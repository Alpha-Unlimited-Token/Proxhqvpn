import { Router, type IRouter } from "express";
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

const router: IRouter = Router();

router.use(healthRouter);
router.use("/nodes",         nodesRouter);
router.use("/beacons",       beaconsRouter);
router.use("/silkweb",       silkwebRouter);
router.use("/firewall",      firewallRouter);
router.use("/monitor",       monitorRouter);
router.use("/terminal",      terminalRouter);
router.use("/sql",           sqlRouter);
router.use("/proxy-browser", proxyBrowserRouter);
router.use("/killswitch",    killswitchRouter);
router.use("/leaks",         leaksRouter);
router.use("/threatintel",   threatintelRouter);
router.use("/split-tunnel",  splittunnelRouter);
router.use("/obfuscation",   obfuscationRouter);

export default router;
