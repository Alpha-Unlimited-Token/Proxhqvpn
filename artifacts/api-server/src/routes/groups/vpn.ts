// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Router } from "express";
import { requireCapability } from "../../middlewares/requireCapability";
import { requireDeviceTrust } from "../../middlewares/requireDeviceTrust";
import { registerVpnRoute } from "../registerVpnRoute";

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
registerVpnRoute(router, "/account-security", "vpn.read", accountSecurityCenterRouter);

registerVpnRoute(router, "/killswitch", "vpn.write", killswitchRouter);
registerVpnRoute(router, "/leaks", "vpn.read", leaksRouter);
registerVpnRoute(router, "/split-tunnel", "vpn.write", splittunnelRouter);
registerVpnRoute(router, "/obfuscation", "vpn.write", obfuscationRouter);
registerVpnRoute(router, "/daemon", "vpn.write", daemonRouter);
registerVpnRoute(router, "/vpn-coexist", "vpn.write", vpnCoexistRouter);
registerVpnRoute(router, "/vpngate", "vpn.write", vpnGateRouter);
registerVpnRoute(router, "/devices", "vpn.write", devicesRouter);
registerVpnRoute(router, "/dns-shield", "vpn.write", dnsShieldRouter);
registerVpnRoute(router, "/smart-dns", "vpn.write", smartDnsRouter);
registerVpnRoute(router, "/router-config", "vpn.write", routerConfigRouter);

// WireGuard requires device trust in addition to capability — kept manual
router.use(
  "/wireguard",
  requireCapability("vpn.write"),
  requireDeviceTrust,
  wireguardRouter,
);

registerVpnRoute(router, "/threat-protection", "vpn.read", threatProtectionRouter);
registerVpnRoute(router, "/proxy-browser", "vpn.read", proxyBrowserRouter);

registerVpnRoute(router, "/pqc", "vpn.read", pqcRouter);
registerVpnRoute(router, "/daita", "vpn.read", daitaRouter);
registerVpnRoute(router, "/darkweb", "vpn.read", darkwebRouter);
registerVpnRoute(router, "/altid", "vpn.read", altidRouter);
registerVpnRoute(router, "/iprotator", "vpn.write", iprotatorRouter);

registerVpnRoute(router, "/cve", "vpn.read", cveSearchRouter);
registerVpnRoute(router, "/ghost-trap", "vpn.write", ghostTrapRouter);
registerVpnRoute(router, "/fw", "vpn.write", firewallAdvancedRouter);
registerVpnRoute(router, "/network-monitor", "vpn.read", networkMonitorRouter);
registerVpnRoute(router, "/dns-sinkhole", "vpn.write", dnsSinkholeRouter);

registerVpnRoute(router, "/gps-spoof", "vpn.write", gpsSpoofRouter);
registerVpnRoute(router, "/port-forward", "vpn.write", portForwardRouter);
registerVpnRoute(router, "/dedicated-ip", "vpn.write", dedicatedIpRouter);
registerVpnRoute(router, "/meshnet", "vpn.write", meshnetRouter);
registerVpnRoute(router, "/data-broker", "vpn.read", dataBrokerRouter);
registerVpnRoute(router, "/fwn", "vpn.write", firewallNextRouter);
registerVpnRoute(router, "/fwm", "vpn.write", firewallMilitaryRouter);

registerVpnRoute(router, "/ztna", "vpn.write", ztnaRouter);
registerVpnRoute(router, "/security-score", "vpn.read", securityScoreRouter);
registerVpnRoute(router, "/attack-intel", "vpn.read", attackIntelRouter);
registerVpnRoute(router, "/honeypot", "vpn.write", honeypotRouter);

export default router;
