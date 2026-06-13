// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Router } from "express";
import { requireAccess } from "../../middlewares/requireAccess";
import { requireDeviceTrust } from "../../middlewares/requireDeviceTrust";

import meRouter from "../me";
import accountSecurityCenterRouter from "../account-security-center";
import killswitchRouter from "../killswitch";
import leaksRouter from "../leaks";
import splittunnelRouter from "../splittunnel";
import obfuscationRouter from "../obfuscation";
import daemonRouter from "../daemon";
import vpnCoexistRouter from "../vpncoexist";
import vpnGateRouter from "../vpngate";
import devicesRouter from "../devices";
import dnsShieldRouter from "../dnsshield";
import smartDnsRouter from "../smartdns";
import routerConfigRouter from "../routerconfig";
import wireguardRouter from "../wireguard";
import threatProtectionRouter from "../threatprotection";
import proxyBrowserRouter from "../proxybrowser";
import pqcRouter from "../pqc";
import daitaRouter from "../daita";
import darkwebRouter from "../darkweb";
import altidRouter from "../altid";
import iprotatorRouter from "../iprotator";
import cveSearchRouter from "../cvesearch";
import ghostTrapRouter from "../ghosttrap";
import firewallAdvancedRouter from "../firewall-advanced";
import networkMonitorRouter from "../networkmonitor";
import dnsSinkholeRouter from "../dnssinkhole";
import gpsSpoofRouter from "../gpsspoof";
import portForwardRouter from "../portforward";
import dedicatedIpRouter from "../dedicatedip";
import meshnetRouter from "../meshnet";
import dataBrokerRouter from "../databroker";
import firewallNextRouter from "../firewall-next";
import firewallMilitaryRouter from "../firewall-military";
import ztnaRouter from "../ztna";
import securityScoreRouter from "../security-score";
import attackIntelRouter from "../attackintel";
import honeypotRouter from "../honeypot";

const router = Router();

router.use("/me", meRouter);
router.use("/account-security", requireAccess, accountSecurityCenterRouter);

router.use("/killswitch", requireAccess, killswitchRouter);
router.use("/leaks", requireAccess, leaksRouter);
router.use("/split-tunnel", requireAccess, splittunnelRouter);
router.use("/obfuscation", requireAccess, obfuscationRouter);
router.use("/daemon", requireAccess, daemonRouter);
router.use("/vpn-coexist", requireAccess, vpnCoexistRouter);
router.use("/vpngate", requireAccess, vpnGateRouter);
router.use("/devices", requireAccess, devicesRouter);
router.use("/dns-shield", requireAccess, dnsShieldRouter);
router.use("/smart-dns", requireAccess, smartDnsRouter);
router.use("/router-config", requireAccess, routerConfigRouter);
router.use("/wireguard", requireAccess, requireDeviceTrust, wireguardRouter);
router.use("/threat-protection", requireAccess, threatProtectionRouter);
router.use("/proxy-browser", requireAccess, proxyBrowserRouter);

router.use("/pqc", requireAccess, pqcRouter);
router.use("/daita", requireAccess, daitaRouter);
router.use("/darkweb", requireAccess, darkwebRouter);
router.use("/altid", requireAccess, altidRouter);
router.use("/iprotator", requireAccess, iprotatorRouter);

router.use("/cve", requireAccess, cveSearchRouter);
router.use("/ghost-trap", requireAccess, ghostTrapRouter);
router.use("/fw", requireAccess, firewallAdvancedRouter);
router.use("/network-monitor", requireAccess, networkMonitorRouter);
router.use("/dns-sinkhole", requireAccess, dnsSinkholeRouter);

router.use("/gps-spoof", requireAccess, gpsSpoofRouter);
router.use("/port-forward", requireAccess, portForwardRouter);
router.use("/dedicated-ip", requireAccess, dedicatedIpRouter);
router.use("/meshnet", requireAccess, meshnetRouter);
router.use("/data-broker", requireAccess, dataBrokerRouter);
router.use("/fwn", requireAccess, firewallNextRouter);
router.use("/fwm", requireAccess, firewallMilitaryRouter);

router.use("/ztna", requireAccess, ztnaRouter);
router.use("/security-score", requireAccess, securityScoreRouter);
router.use("/attack-intel", requireAccess, attackIntelRouter);
router.use("/honeypot", requireAccess, honeypotRouter);

export default router;
