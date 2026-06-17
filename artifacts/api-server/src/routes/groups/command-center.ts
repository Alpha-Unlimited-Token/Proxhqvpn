// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Router } from "express";
import { requireCapability } from "../../middlewares/requireCapability";
import { registerCommandCenterRoute } from "../registerCommandCenterRoute";
import realtimeRouter from "../realtime";
import ghostNodeRouter from "../ghost-node";
import ghostRoutingRouter from "../ghost-routing";

import threatintelRouter from "../threatintel";
import securityauditRouter from "../securityaudit";
import httpProbeRouter from "../httpprobe";
import ghostTraceRouter from "../ghosttrace";
import attackChainRouter from "../attackchain";
import vpnTrackerRouter from "../vpntracker";
import siemRouter from "../siem";
import osintRouter from "../osint";
import usernameIntelRouter from "../usernameintel";
import canaryRouter from "../canary";
import wafRouter from "../waf";
import sslTlsRouter from "../ssltls";
import jwtAnalyzerRouter from "../jwtanalyzer";
import iacScanRouter from "../iacscan";
import apiTesterRouter from "../apitester";
import depScannerRouter from "../depscanner";
import wsTesterRouter from "../wstester";
import sastRouter from "../sast";
import commandGovernanceRouter from "../command-governance";
import dependencyMapRouter from "../dependency-map";
import aiSecurityRouter from "../ai-security";
import firewallPolicyV2Router from "../firewall-policy-v2";
import driftMonitorRouter from "../drift-monitor";
import governanceRouter from "../governance";
import eventGraphRouter from "../event-graph";
import serviceBusRouter from "../service-bus";
import deviceTrustRouter from "../device-trust";
import firewallCoreRouter from "../firewall-core";
import securityGraphRouter from "../security-graph";
import securityDashboardV2Router from "../security-dashboard-v2";
import securityReportsRouter from "../security-reports";
import complianceReportsRouter from "../compliance-reports";
import aiThreatRouter from "../ai-threat-analysis";
import detectionSignaturesRouter from "../detection-signatures";

const router = Router();

router.use("/threatintel", requireCapability("command_center.read"), threatintelRouter);
registerCommandCenterRoute(router, "/security-audit", "command_center.write", securityauditRouter);

registerCommandCenterRoute(router, "/http-probe", "command_center.write", httpProbeRouter);
router.use("/ghost-trace", requireCapability("command_center.read"), ghostTraceRouter);
router.use("/attack-chain", requireCapability("command_center.write"), attackChainRouter);
router.use("/vpn-tracker", requireCapability("command_center.read"), vpnTrackerRouter);
router.use("/siem", requireCapability("command_center.read"), siemRouter);
router.use("/osint", requireCapability("command_center.write"), osintRouter);
router.use("/username-intel", requireCapability("command_center.write"), usernameIntelRouter);
router.use("/canary", requireCapability("command_center.write"), canaryRouter);
registerCommandCenterRoute(router, "/waf", "command_center.write", wafRouter);
router.use("/ssl-tls", requireCapability("command_center.write"), sslTlsRouter);
router.use("/jwt-analyzer", requireCapability("command_center.write"), jwtAnalyzerRouter);
router.use("/iac-scan", requireCapability("command_center.write"), iacScanRouter);
router.use("/api-tester", requireCapability("command_center.write"), apiTesterRouter);
router.use("/dep-scanner", requireCapability("command_center.write"), depScannerRouter);
router.use("/ws-tester", requireCapability("command_center.write"), wsTesterRouter);
registerCommandCenterRoute(router, "/sast", "command_center.write", sastRouter);
router.use("/command-governance", requireCapability("command_center.read"), commandGovernanceRouter);
router.use("/dependency-map", requireCapability("command_center.read"), dependencyMapRouter);
router.use("/ai-security", requireCapability("command_center.write"), aiSecurityRouter);
router.use("/firewall-v2", requireCapability("command_center.write"), firewallPolicyV2Router);
router.use("/drift-monitor", requireCapability("command_center.read"), driftMonitorRouter);
router.use("/governance", requireCapability("command_center.read"), governanceRouter);
router.use("/events", requireCapability("command_center.read"), eventGraphRouter);
router.use("/service-bus", requireCapability("command_center.read"), serviceBusRouter);
router.use("/device-trust", requireCapability("command_center.write"), deviceTrustRouter);
router.use("/firewall-core", requireCapability("command_center.write"), firewallCoreRouter);
registerCommandCenterRoute(router, "/security-graph", "command_center.read", securityGraphRouter);
registerCommandCenterRoute(router, "/security-dashboard-v2", "command_center.read", securityDashboardV2Router);
registerCommandCenterRoute(router, "/security-reports", "command_center.read", securityReportsRouter);
registerCommandCenterRoute(router, "/realtime", "command_center.read", realtimeRouter);

router.use("/ghost-nodes", requireCapability("command_center.write"), ghostNodeRouter);
router.use("/ghost-nodes/exit", ghostRoutingRouter);

registerCommandCenterRoute(router, "/compliance-reports", "command_center.read", complianceReportsRouter);
registerCommandCenterRoute(router, "/ai-threat", "command_center.read", aiThreatRouter);
router.use("/detection-signatures", requireCapability("command_center.write"), detectionSignaturesRouter);

export default router;
