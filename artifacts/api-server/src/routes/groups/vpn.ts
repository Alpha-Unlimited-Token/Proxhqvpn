// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Router } from "express";
import { requireDeviceTrust } from "../../middlewares/requireDeviceTrust";
import { requireCapability } from "../../middlewares/requireCapability";

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
router.use("/account-security", requireCapability("vpn.read"), accountSecurityCenterRouter);

router.use("/killswitch", requireCapability("vpn.write"), killswitchRouter);
router.use("/leaks", requireCapability("vpn.read"), leaksRouter);
router.use("/split-tunnel", requireCapability("vpn.write"), splittunnelRouter);
router.use("/obfuscation", requireCapability("vpn.write"), obfuscationRouter);
router.use("/daemon", requireCapability("vpn.write"), daemonRouter);
router.use("/vpn-coexist", requireCapability("vpn.write"), vpnCoexistRouter);
router.use("/vpngate", requireCapability("vpn.write"), vpnGateRouter);
router.use("/devices", requireCapability("vpn.write"), devicesRouter);
router.use("/dns-shield", requireCapability("vpn.write"), dnsShieldRouter);
router.use("/smart-dns", requireCapability("vpn.write"), smartDnsRouter);
router.use("/router-config", requireCapability("vpn.write"), routerConfigRouter);
router.use(
  "/wireguard",
  requireCapability("vpn.write"),
  requireDeviceTrust,
  wireguardRouter,
);
router.use("/threat-protection", requireCapability("vpn.read"), threatProtectionRouter);
router.use("/proxy-browser", requireCapability("vpn.read"), proxyBrowserRouter);

router.use("/pqc", requireCapability("vpn.read"), pqcRouter);
router.use("/daita", requireCapability("vpn.read"), daitaRouter);
router.use("/darkweb", requireCapability("vpn.read"), darkwebRouter);
router.use("/altid", requireCapability("vpn.read"), altidRouter);
router.use("/iprotator", requireCapability("vpn.write"), iprotatorRouter);

router.use("/cve", requireCapability("vpn.read"), cveSearchRouter);
router.use("/ghost-trap", requireCapability("vpn.write"), ghostTrapRouter);
router.use("/fw", requireCapability("vpn.write"), firewallAdvancedRouter);
router.use("/network-monitor", requireCapability("vpn.read"), networkMonitorRouter);
router.use("/dns-sinkhole", requireCapability("vpn.write"), dnsSinkholeRouter);

router.use("/gps-spoof", requireCapability("vpn.write"), gpsSpoofRouter);
router.use("/port-forward", requireCapability("vpn.write"), portForwardRouter);
router.use("/dedicated-ip", requireCapability("vpn.write"), dedicatedIpRouter);
router.use("/meshnet", requireCapability("vpn.write"), meshnetRouter);
router.use("/data-broker", requireCapability("vpn.read"), dataBrokerRouter);
router.use("/fwn", requireCapability("vpn.write"), firewallNextRouter);
router.use("/fwm", requireCapability("vpn.write"), firewallMilitaryRouter);

router.use("/ztna", requireCapability("vpn.write"), ztnaRouter);
router.use("/security-score", requireCapability("vpn.read"), securityScoreRouter);
router.use("/attack-intel", requireCapability("vpn.read"), attackIntelRouter);
router.use("/honeypot", requireCapability("vpn.write"), honeypotRouter);

export default router;
