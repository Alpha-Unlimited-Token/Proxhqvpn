// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Router, type Request, type Response } from "express";
import fs from "fs";
import path from "path";
import { insertNodeEnrollmentToken } from "../../repositories/nodeEnrollmentRepository";
import { createEnrollmentToken } from "../../lib/node-enrollment";
import { requireAdmin } from "../_auth";
import { registerAdminRoute } from "../registerAdminRoute";
import { criticalRateLimit, highRiskRateLimit } from "../../middlewares/riskRateLimit";
import capabilityAuditRouter from "../capability-audit";
import auditChainRouter from "../audit-chain";
import nodeHealthSummaryRouter from "../node-health-summary";
import siemDlqRouter from "../siem-dlq";

import nodesRouter from "../nodes";
import beaconsRouter from "../beacons";
import silkwebRouter from "../silkweb";
import firewallRouter from "../firewall";
import monitorRouter from "../monitor";
import terminalRouter from "../terminal";
import sqlRouter from "../sqlquery";
import deceptionRouter from "../deception";
import labTargetsRouter from "../lab-targets";
import nodeEnrollV2Router from "../node-enroll-v2";
import nodeTrustRouter from "../node-trust";
import adminUsersRouter from "../admin-users";
import employeesRouter from "../employees";
import setupRouter from "../setup";
import controlPlaneRouter from "../control-plane";
import policySimulationRouter from "../policy-simulation";
import executiveReportsRouter from "../executive-reports";
import productionScorecardRouter from "../production-scorecard";
import platformMaturityRouter from "../platform-maturity";
import selfAuditRouter from "../self-audit";

import webauthnfido2adminenforcementRouter from "../webauthn-fido2-admin-enforcement";
import mfapolicyengineRouter from "../mfa-policy-engine";
import deviceposturecollectionRouter from "../device-posture-collection";
import endpointcompliancescoringRouter from "../endpoint-compliance-scoring";
import manageddeviceenrollmentRouter from "../managed-device-enrollment";
import certificatebounddeviceidentityRouter from "../certificate-bound-device-identity";
import adminsessionreauthenticationRouter from "../admin-session-re-authentication";
import privilegedaccessapprovalworkflowRouter from "../privileged-access-approval-workflow";
import temporaryaccessgrantsRouter from "../temporary-access-grants";
import breakglassapprovalrecordsRouter from "../break-glass-approval-records";
import identityproviderriskingestionRouter from "../identity-provider-risk-ingestion";
import impossibletraveldetectorv2Router from "../impossible-travel-detector-v2";
import userbehavioranalyticsv2Router from "../user-behavior-analytics-v2";
import devicebehavioranalyticsv2Router from "../device-behavior-analytics-v2";
import riskbasedaccessmiddlewareRouter from "../risk-based-access-middleware";
import tenantlevelsecuritypoliciesRouter from "../tenant-level-security-policies";
import pertenantloginpolicyRouter from "../per-tenant-login-policy";
import pertenantdevicepolicyRouter from "../per-tenant-device-policy";
import adminactionapprovalqueueRouter from "../admin-action-approval-queue";
import privilegedcommandapprovalRouter from "../privileged-command-approval";
import sessionrecordingmetadataRouter from "../session-recording-metadata";
import adminactivitytimelineRouter from "../admin-activity-timeline";
import useraccessreviewworkflowRouter from "../user-access-review-workflow";
import dormantaccountdetectionRouter from "../dormant-account-detection";
import identitygovernancedashboardbackendRouter from "../identity-governance-dashboard-backend";
import sdwanpolicyfoundationRouter from "../sd-wan-policy-foundation";
import trafficsteeringpolicyengineRouter from "../traffic-steering-policy-engine";
import qosclassificationRouter from "../qos-classification";
import bandwidthpriorityclassesRouter from "../bandwidth-priority-classes";
import regionalrouterestrictionsv2Router from "../regional-route-restrictions-v2";
import multicloudgatewayregistryRouter from "../multi-cloud-gateway-registry";
import edgegatewaylifecycleRouter from "../edge-gateway-lifecycle";
import bgpautomationadapterRouter from "../bgp-automation-adapter";
import dynamicrouteadvertisementsRouter from "../dynamic-route-advertisements";
import routehealthtelemetryRouter from "../route-health-telemetry";
import routeoptimizationv2Router from "../route-optimization-v2";
import multihoproutescoringRouter from "../multi-hop-route-scoring";
import perapproutepolicyRouter from "../per-app-route-policy";
import pertenantvpnpolicyRouter from "../per-tenant-vpn-policy";
import vpnsessionledgerRouter from "../vpn-session-ledger";
import tunnelreplayprotectionRouter from "../tunnel-replay-protection";
import keyrotationschedulerRouter from "../key-rotation-scheduler";
import nodecertificaterotationRouter from "../node-certificate-rotation";
import nodetonodetrustgraphRouter from "../node-to-node-trust-graph";
import nodedriftdetectionRouter from "../node-drift-detection";
import nodeautorepairworkerRouter from "../node-auto-repair-worker";
import nodereplacementplannerRouter from "../node-replacement-planner";
import fleetcapacityplannerv2Router from "../fleet-capacity-planner-v2";
import globalnetworktopologyapiRouter from "../global-network-topology-api";
import networkoperationsdashboardbackendRouter from "../network-operations-dashboard-backend";
import opentelemetrybackendtracingRouter from "../opentelemetry-backend-tracing";
import opentelemetryfrontendtracingRouter from "../opentelemetry-frontend-tracing";
import servicedependencymapRouter from "../service-dependency-map";
import requestlatencyslosRouter from "../request-latency-slos";
import apierrorbudgetengineRouter from "../api-error-budget-engine";
import uptimemonitorregistryRouter from "../uptime-monitor-registry";
import syntheticmonitoringjobsRouter from "../synthetic-monitoring-jobs";
import regionalhealthchecksRouter from "../regional-health-checks";
import alertroutingpoliciesRouter from "../alert-routing-policies";
import pagerwebhooknotificationadapterRouter from "../pager-webhook-notification-adapter";
import incidentlifecycleserviceRouter from "../incident-lifecycle-service";
import incidentpostmortemserviceRouter from "../incident-postmortem-service";
import slareportingRouter from "../sla-reporting";
import slodashboardbackendRouter from "../slo-dashboard-backend";
import infrastructureeventnormalizationRouter from "../infrastructure-event-normalization";
import fleethealthtimelineRouter from "../fleet-health-timeline";
import logcorrelationidseverywhereRouter from "../log-correlation-ids-everywhere";
import distributedtracesearchRouter from "../distributed-trace-search";
import slowquerydetectorRouter from "../slow-query-detector";
import databasehealthscoreRouter from "../database-health-score";
import queuelagscoreRouter from "../queue-lag-score";
import workerhealthscoreRouter from "../worker-health-score";
import releasehealthscoreRouter from "../release-health-score";
import operationalreadinessdashboardRouter from "../operational-readiness-dashboard";
import sreweeklyreportgeneratorRouter from "../sre-weekly-report-generator";
import aisocanalystserviceinterfaceRouter from "../ai-soc-analyst-service-interface";
import incidentsummarizerRouter from "../incident-summarizer";
import alertdeduplicationengineRouter from "../alert-deduplication-engine";
import alertclusteringRouter from "../alert-clustering";
import rootcauseanalysisengineRouter from "../root-cause-analysis-engine";
import threathuntingquerybuilderRouter from "../threat-hunting-query-builder";
import threathuntingschedulerRouter from "../threat-hunting-scheduler";
import autotriagerulesRouter from "../auto-triage-rules";
import aigeneratedinvestigationtimelineRouter from "../ai-generated-investigation-timeline";
import aiplaybookrecommendationRouter from "../ai-playbook-recommendation";
const router = Router();

router.get("/setup-script", requireAdmin, (req: Request, res: Response) => {
  const replitDomain =
    process.env.REPLIT_DEV_DOMAIN ||
    process.env.REPLIT_DOMAINS?.split(",")[0] ||
    "";

  const apiBase = replitDomain
    ? `https://${replitDomain}/api`
    : `https://${req.headers.host}/api`;

  const region = (req.query.region as string) || "Unknown";

  const script = `#!/bin/bash
# ProxhqVPN Node Setup Script
# Installs WireGuard + daemon on a fresh Ubuntu/Debian VPS
#
# REQUIRED: set ENROLL_TOKEN before running:
#   1. In admin panel → Nodes → Node Enrollment → Generate Token
#   2. ENROLL_TOKEN=<token> bash setup.sh
#
# Tokens are single-use and expire in 15 minutes.

API="${apiBase}"
REGION="${region}"

die() { echo ""; echo "ERROR: $1"; echo "Setup failed. Fix the error above and re-run."; exit 1; }
ok()  { echo "  OK"; }

echo ""
echo "========================================"
echo "   ProxhqVPN Node Setup"
echo "   Region: $REGION"
echo "========================================"
echo ""

echo "[0/5] Waiting for system to be ready..."
sleep 5
systemctl is-active --quiet cloud-init-local 2>/dev/null && sleep 10
ok

echo "[1/5] Installing WireGuard..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq 2>&1 | tail -1 || true
apt-get install -y wireguard wireguard-tools openvpn curl python3 iptables 2>&1 | grep -E "^(Err|W:|E:)" || true
which wg > /dev/null 2>&1 || die "WireGuard failed to install. Try: apt-get install wireguard"
ok

echo "[2/5] Generating WireGuard keys..."
SERVER_PRIVKEY=$(wg genkey) || die "Failed to generate WireGuard private key"
SERVER_PUBKEY=$(echo "$SERVER_PRIVKEY" | wg pubkey) || die "Failed to derive public key"
echo "  Public key: $SERVER_PUBKEY"
ok

echo "[3/5] Detecting public IP..."
PUBLIC_IP=$(curl -sf --max-time 8 https://api.ipify.org 2>/dev/null) \\
  || PUBLIC_IP=$(curl -sf --max-time 8 https://ipinfo.io/ip 2>/dev/null) \\
  || PUBLIC_IP=$(curl -sf --max-time 8 https://icanhazip.com 2>/dev/null)
[ -z "$PUBLIC_IP" ] && die "Could not detect public IP — check internet connectivity"
echo "  IP: $PUBLIC_IP"
ok

echo "[4/5] Registering node with ProxhqVPN..."
[ -z "$ENROLL_TOKEN" ] && die "ENROLL_TOKEN is required. Generate one in the admin panel → Nodes → Node Enrollment."
PAYLOAD='{"token":"'"$ENROLL_TOKEN"'","nodeId":"'"$HOSTNAME"'","publicKey":"'"$SERVER_PUBKEY"'","region":"'"$REGION"'","publicIp":"'"$PUBLIC_IP"'"}'
RESPONSE=$(curl -sf --max-time 15 -X POST "$API/node-enrollment/claim" \\
  -H "Content-Type: application/json" \\
  -d "$PAYLOAD") || die "Could not reach ProxhqVPN API at $API/node-enrollment/claim"
[ -z "$RESPONSE" ] && die "Empty response from API — enrollment token may be expired or already used"
NODE_ID=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['nodeId'])") || die "Bad API response: $RESPONSE"
SERVER_VPN_IP=$(echo "$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['serverVpnIp'])")
echo "  Node ID: $NODE_ID | VPN IP: $SERVER_VPN_IP"
ok

echo "[5/5] Configuring WireGuard..."
mkdir -p /etc/wireguard
cat > /etc/wireguard/wg0.conf << WGEOF
[Interface]
Address = \${SERVER_VPN_IP}/24
ListenPort = 51820
PrivateKey = \${SERVER_PRIVKEY}
PostUp = iptables -A FORWARD -i %i -j ACCEPT; iptables -A FORWARD -o %i -j ACCEPT; iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
PostDown = iptables -D FORWARD -i %i -j ACCEPT; iptables -D FORWARD -o %i -j ACCEPT; iptables -t nat -D POSTROUTING -o eth0 -j MASQUERADE
WGEOF
chmod 600 /etc/wireguard/wg0.conf
grep -q "net.ipv4.ip_forward=1" /etc/sysctl.conf || echo "net.ipv4.ip_forward=1" >> /etc/sysctl.conf
sysctl -w net.ipv4.ip_forward=1 -q
systemctl enable wg-quick@wg0 2>/dev/null || true
systemctl restart wg-quick@wg0 || die "WireGuard failed to start — check /etc/wireguard/wg0.conf"
ok

echo ""
echo "========================================"
echo "  Setup Complete!"
echo ""
echo "  Node ID  : $NODE_ID"
echo "  Region   : $REGION"
echo "  Public IP: $PUBLIC_IP"
echo "  VPN IP   : $SERVER_VPN_IP"
echo ""
echo "  Node is now online and reporting"
echo "  Check your dashboard in 30 seconds"
echo "========================================"
echo ""
`;

  res.setHeader("Content-Type", "text/plain");
  res.send(script);
});

registerAdminRoute(router, "/nodes", "admin.write", nodesRouter);
registerAdminRoute(router, "/beacons", "admin.read", beaconsRouter);
registerAdminRoute(router, "/silkweb", "admin.read", silkwebRouter);
registerAdminRoute(router, "/firewall", "admin.write", firewallRouter);
registerAdminRoute(router, "/monitor", "admin.read", monitorRouter);
registerAdminRoute(router, "/terminal", "terminal.exec", criticalRateLimit, terminalRouter);
registerAdminRoute(router, "/sql", "sql.exec", criticalRateLimit, sqlRouter);
registerAdminRoute(router, "/deception", "admin.write", deceptionRouter);
registerAdminRoute(router, "/lab-targets", "admin.write", labTargetsRouter);

router.post("/node-enrollment-token", requireAdmin, async (req: Request, res: Response) => {
  const { token, tokenHash, expiresAt } = createEnrollmentToken();
  const region = (req.body?.region as string) ?? null;

  await insertNodeEnrollmentToken({
    tokenHash,
    createdBy: (req as any).auth?.userId ?? "admin",
    region,
    expiresAt,
  });

  res.json({ token, expiresAt, region });
});

registerAdminRoute(router, "/node-enrollment", "admin.write", nodeEnrollV2Router);
registerAdminRoute(router, "/node-trust", "admin.write", nodeTrustRouter);
registerAdminRoute(router, "/admin/users", "admin.write", adminUsersRouter);
registerAdminRoute(router, "/employees", "admin.write", employeesRouter);
registerAdminRoute(router, "/setup", "admin.write", setupRouter);
registerAdminRoute(router, "/capability-audit", "admin.read", highRiskRateLimit, capabilityAuditRouter);
registerAdminRoute(router, "/audit-chain", "admin.read", highRiskRateLimit, auditChainRouter);
registerAdminRoute(router, "/control-plane", "admin.read", highRiskRateLimit, controlPlaneRouter);
registerAdminRoute(router, "/policy-simulation", "admin.read", highRiskRateLimit, policySimulationRouter);
registerAdminRoute(router, "/executive-reports", "admin.read", highRiskRateLimit, executiveReportsRouter);
registerAdminRoute(router, "/production-scorecard", "admin.read", highRiskRateLimit, productionScorecardRouter);
registerAdminRoute(router, "/platform-maturity", "admin.read", highRiskRateLimit, platformMaturityRouter);
registerAdminRoute(router, "/self-audit", "admin.read", highRiskRateLimit, selfAuditRouter);

registerAdminRoute(router, "/webauthn-fido2-admin-enforcement", "admin.read", highRiskRateLimit, webauthnfido2adminenforcementRouter);
registerAdminRoute(router, "/mfa-policy-engine", "admin.read", highRiskRateLimit, mfapolicyengineRouter);
registerAdminRoute(router, "/device-posture-collection", "admin.read", highRiskRateLimit, deviceposturecollectionRouter);
registerAdminRoute(router, "/endpoint-compliance-scoring", "admin.read", highRiskRateLimit, endpointcompliancescoringRouter);
registerAdminRoute(router, "/managed-device-enrollment", "admin.read", highRiskRateLimit, manageddeviceenrollmentRouter);
registerAdminRoute(router, "/certificate-bound-device-identity", "admin.write", highRiskRateLimit, certificatebounddeviceidentityRouter);
registerAdminRoute(router, "/admin-session-re-authentication", "admin.write", highRiskRateLimit, adminsessionreauthenticationRouter);
registerAdminRoute(router, "/privileged-access-approval-workflow", "admin.write", highRiskRateLimit, privilegedaccessapprovalworkflowRouter);
registerAdminRoute(router, "/temporary-access-grants", "admin.write", highRiskRateLimit, temporaryaccessgrantsRouter);
registerAdminRoute(router, "/break-glass-approval-records", "admin.write", highRiskRateLimit, breakglassapprovalrecordsRouter);
registerAdminRoute(router, "/identity-provider-risk-ingestion", "admin.read", highRiskRateLimit, identityproviderriskingestionRouter);
registerAdminRoute(router, "/impossible-travel-detector-v2", "admin.read", highRiskRateLimit, impossibletraveldetectorv2Router);
registerAdminRoute(router, "/user-behavior-analytics-v2", "admin.read", highRiskRateLimit, userbehavioranalyticsv2Router);
registerAdminRoute(router, "/device-behavior-analytics-v2", "admin.read", highRiskRateLimit, devicebehavioranalyticsv2Router);
registerAdminRoute(router, "/risk-based-access-middleware", "admin.read", highRiskRateLimit, riskbasedaccessmiddlewareRouter);
registerAdminRoute(router, "/tenant-level-security-policies", "command_center.write", highRiskRateLimit, tenantlevelsecuritypoliciesRouter);
registerAdminRoute(router, "/per-tenant-login-policy", "admin.read", highRiskRateLimit, pertenantloginpolicyRouter);
registerAdminRoute(router, "/per-tenant-device-policy", "admin.read", highRiskRateLimit, pertenantdevicepolicyRouter);
registerAdminRoute(router, "/admin-action-approval-queue", "admin.write", highRiskRateLimit, adminactionapprovalqueueRouter);
registerAdminRoute(router, "/privileged-command-approval", "admin.write", highRiskRateLimit, privilegedcommandapprovalRouter);
registerAdminRoute(router, "/session-recording-metadata", "admin.read", highRiskRateLimit, sessionrecordingmetadataRouter);
registerAdminRoute(router, "/admin-activity-timeline", "admin.read", highRiskRateLimit, adminactivitytimelineRouter);
registerAdminRoute(router, "/user-access-review-workflow", "admin.read", highRiskRateLimit, useraccessreviewworkflowRouter);
registerAdminRoute(router, "/dormant-account-detection", "admin.read", highRiskRateLimit, dormantaccountdetectionRouter);
registerAdminRoute(router, "/identity-governance-dashboard-backend", "admin.read", highRiskRateLimit, identitygovernancedashboardbackendRouter);
registerAdminRoute(router, "/sd-wan-policy-foundation", "admin.write", highRiskRateLimit, sdwanpolicyfoundationRouter);
registerAdminRoute(router, "/traffic-steering-policy-engine", "admin.write", highRiskRateLimit, trafficsteeringpolicyengineRouter);
registerAdminRoute(router, "/qos-classification", "admin.write", highRiskRateLimit, qosclassificationRouter);
registerAdminRoute(router, "/bandwidth-priority-classes", "admin.write", highRiskRateLimit, bandwidthpriorityclassesRouter);
registerAdminRoute(router, "/regional-route-restrictions-v2", "admin.write", highRiskRateLimit, regionalrouterestrictionsv2Router);
registerAdminRoute(router, "/multi-cloud-gateway-registry", "admin.read", highRiskRateLimit, multicloudgatewayregistryRouter);
registerAdminRoute(router, "/edge-gateway-lifecycle", "admin.read", highRiskRateLimit, edgegatewaylifecycleRouter);
registerAdminRoute(router, "/bgp-automation-adapter", "admin.read", highRiskRateLimit, bgpautomationadapterRouter);
registerAdminRoute(router, "/dynamic-route-advertisements", "admin.read", highRiskRateLimit, dynamicrouteadvertisementsRouter);
registerAdminRoute(router, "/route-health-telemetry", "admin.read", highRiskRateLimit, routehealthtelemetryRouter);
registerAdminRoute(router, "/route-optimization-v2", "admin.read", highRiskRateLimit, routeoptimizationv2Router);
registerAdminRoute(router, "/multi-hop-route-scoring", "admin.read", highRiskRateLimit, multihoproutescoringRouter);
registerAdminRoute(router, "/per-app-route-policy", "admin.read", highRiskRateLimit, perapproutepolicyRouter);
registerAdminRoute(router, "/per-tenant-vpn-policy", "admin.read", highRiskRateLimit, pertenantvpnpolicyRouter);
registerAdminRoute(router, "/vpn-session-ledger", "admin.read", highRiskRateLimit, vpnsessionledgerRouter);
registerAdminRoute(router, "/tunnel-replay-protection", "admin.read", highRiskRateLimit, tunnelreplayprotectionRouter);
registerAdminRoute(router, "/key-rotation-scheduler", "admin.read", highRiskRateLimit, keyrotationschedulerRouter);
registerAdminRoute(router, "/node-certificate-rotation", "admin.read", highRiskRateLimit, nodecertificaterotationRouter);
registerAdminRoute(router, "/node-to-node-trust-graph", "admin.read", highRiskRateLimit, nodetonodetrustgraphRouter);
registerAdminRoute(router, "/node-drift-detection", "admin.read", highRiskRateLimit, nodedriftdetectionRouter);
registerAdminRoute(router, "/node-auto-repair-worker", "admin.read", highRiskRateLimit, nodeautorepairworkerRouter);
registerAdminRoute(router, "/node-replacement-planner", "admin.read", highRiskRateLimit, nodereplacementplannerRouter);
registerAdminRoute(router, "/fleet-capacity-planner-v2", "admin.read", highRiskRateLimit, fleetcapacityplannerv2Router);
registerAdminRoute(router, "/global-network-topology-api", "admin.read", highRiskRateLimit, globalnetworktopologyapiRouter);
registerAdminRoute(router, "/network-operations-dashboard-backend", "admin.read", highRiskRateLimit, networkoperationsdashboardbackendRouter);
registerAdminRoute(router, "/opentelemetry-backend-tracing", "admin.read", highRiskRateLimit, opentelemetrybackendtracingRouter);
registerAdminRoute(router, "/opentelemetry-frontend-tracing", "admin.read", highRiskRateLimit, opentelemetryfrontendtracingRouter);
registerAdminRoute(router, "/service-dependency-map", "admin.read", highRiskRateLimit, servicedependencymapRouter);
registerAdminRoute(router, "/request-latency-slos", "admin.read", highRiskRateLimit, requestlatencyslosRouter);
registerAdminRoute(router, "/api-error-budget-engine", "admin.read", highRiskRateLimit, apierrorbudgetengineRouter);
registerAdminRoute(router, "/uptime-monitor-registry", "admin.read", highRiskRateLimit, uptimemonitorregistryRouter);
registerAdminRoute(router, "/synthetic-monitoring-jobs", "admin.read", highRiskRateLimit, syntheticmonitoringjobsRouter);
registerAdminRoute(router, "/regional-health-checks", "admin.read", highRiskRateLimit, regionalhealthchecksRouter);
registerAdminRoute(router, "/alert-routing-policies", "admin.read", highRiskRateLimit, alertroutingpoliciesRouter);
registerAdminRoute(router, "/pager-webhook-notification-adapter", "admin.read", highRiskRateLimit, pagerwebhooknotificationadapterRouter);
registerAdminRoute(router, "/incident-lifecycle-service", "command_center.write", highRiskRateLimit, incidentlifecycleserviceRouter);
registerAdminRoute(router, "/incident-postmortem-service", "command_center.write", highRiskRateLimit, incidentpostmortemserviceRouter);
registerAdminRoute(router, "/sla-reporting", "admin.read", highRiskRateLimit, slareportingRouter);
registerAdminRoute(router, "/slo-dashboard-backend", "admin.read", highRiskRateLimit, slodashboardbackendRouter);
registerAdminRoute(router, "/infrastructure-event-normalization", "admin.read", highRiskRateLimit, infrastructureeventnormalizationRouter);
registerAdminRoute(router, "/fleet-health-timeline", "admin.read", highRiskRateLimit, fleethealthtimelineRouter);
registerAdminRoute(router, "/log-correlation-ids-everywhere", "admin.read", highRiskRateLimit, logcorrelationidseverywhereRouter);
registerAdminRoute(router, "/distributed-trace-search", "admin.read", highRiskRateLimit, distributedtracesearchRouter);
registerAdminRoute(router, "/slow-query-detector", "admin.read", highRiskRateLimit, slowquerydetectorRouter);
registerAdminRoute(router, "/database-health-score", "admin.read", highRiskRateLimit, databasehealthscoreRouter);
registerAdminRoute(router, "/queue-lag-score", "admin.read", highRiskRateLimit, queuelagscoreRouter);
registerAdminRoute(router, "/worker-health-score", "admin.read", highRiskRateLimit, workerhealthscoreRouter);
registerAdminRoute(router, "/release-health-score", "admin.read", highRiskRateLimit, releasehealthscoreRouter);
registerAdminRoute(router, "/operational-readiness-dashboard", "admin.read", highRiskRateLimit, operationalreadinessdashboardRouter);
registerAdminRoute(router, "/sre-weekly-report-generator", "admin.read", highRiskRateLimit, sreweeklyreportgeneratorRouter);
registerAdminRoute(router, "/ai-soc-analyst-service-interface", "command_center.write", highRiskRateLimit, aisocanalystserviceinterfaceRouter);
registerAdminRoute(router, "/incident-summarizer", "command_center.write", highRiskRateLimit, incidentsummarizerRouter);
registerAdminRoute(router, "/alert-deduplication-engine", "command_center.write", highRiskRateLimit, alertdeduplicationengineRouter);
registerAdminRoute(router, "/alert-clustering", "command_center.write", highRiskRateLimit, alertclusteringRouter);
registerAdminRoute(router, "/root-cause-analysis-engine", "command_center.write", highRiskRateLimit, rootcauseanalysisengineRouter);
registerAdminRoute(router, "/threat-hunting-query-builder", "command_center.write", highRiskRateLimit, threathuntingquerybuilderRouter);
registerAdminRoute(router, "/threat-hunting-scheduler", "command_center.write", highRiskRateLimit, threathuntingschedulerRouter);
registerAdminRoute(router, "/auto-triage-rules", "command_center.write", highRiskRateLimit, autotriagerulesRouter);
registerAdminRoute(router, "/ai-generated-investigation-timeline", "command_center.write", highRiskRateLimit, aigeneratedinvestigationtimelineRouter);
registerAdminRoute(router, "/ai-playbook-recommendation", "command_center.write", highRiskRateLimit, aiplaybookrecommendationRouter);

import saferemediationapprovalgateRouter from "../safe-remediation-approval-gate";
import automatedremediationexecutorRouter from "../automated-remediation-executor";
import remediationrollbackrecordsRouter from "../remediation-rollback-records";
import falsepositivefeedbackloopRouter from "../false-positive-feedback-loop";
import detectionqualityscoringRouter from "../detection-quality-scoring";
import detectiondriftmonitoringRouter from "../detection-drift-monitoring";
import socanalystnotesserviceRouter from "../soc-analyst-notes-service";
import casenarrativegeneratorRouter from "../case-narrative-generator";
import executivesecuritysummarygeneratorv2Router from "../executive-security-summary-generator-v2";
import threatmodelgeneratorRouter from "../threat-model-generator";
import attacksimulationplannerRouter from "../attack-simulation-planner";
import purpleteamexercisetrackerRouter from "../purple-team-exercise-tracker";
import cyberrangescenarioregistryRouter from "../cyber-range-scenario-registry";
import socmaturityscoringRouter from "../soc-maturity-scoring";
import autonomoussocdashboardbackendRouter from "../autonomous-soc-dashboard-backend";
import enterpriseonboardingbackendRouter from "../enterprise-onboarding-backend";
import enterpriseonboardingfrontendRouter from "../enterprise-onboarding-frontend";
import tenantadminconsoleshellRouter from "../tenant-admin-console-shell";
import tenantsettingsserviceRouter from "../tenant-settings-service";
import tenantauditportalRouter from "../tenant-audit-portal";
import tenantsecurityscoreRouter from "../tenant-security-score";
import customertrustportalfrontendRouter from "../customer-trust-portal-frontend";
import complianceevidenceportalRouter from "../compliance-evidence-portal";
import auditexportdownloadserviceRouter from "../audit-export-download-service";
import reportschedulingRouter from "../report-scheduling";
import emailreportdeliveryadapterRouter from "../email-report-delivery-adapter";
import mspmodefoundationRouter from "../msp-mode-foundation";
import resellermodefoundationRouter from "../reseller-mode-foundation";
import partnerportalbackendRouter from "../partner-portal-backend";
import whitelabelbrandingsettingsRouter from "../white-label-branding-settings";
import customdomainmanagementRouter from "../custom-domain-management";
import tenantspecificthemesRouter from "../tenant-specific-themes";
import tenantspecificlegaldocsRouter from "../tenant-specific-legal-docs";
import enterpriseinvoicerecordsRouter from "../enterprise-invoice-records";
import usagebasedbillingreconciliationRouter from "../usage-based-billing-reconciliation";
import seatmanagementuibackendRouter from "../seat-management-ui-backend";
import licenseexpirationnotificationsRouter from "../license-expiration-notifications";
import renewalworkflowRouter from "../renewal-workflow";
import customersuccesshealthscoreRouter from "../customer-success-health-score";
import customeroperationsdashboardRouter from "../customer-operations-dashboard";
import cqrsreadmodelfoundationRouter from "../cqrs-read-model-foundation";
import eventreplayserviceRouter from "../event-replay-service";
import projectionworkerRouter from "../projection-worker";
import crossregioneventreplicationadapterRouter from "../cross-region-event-replication-adapter";
import multiregionfailoverplannerRouter from "../multi-region-failover-planner";
import databaseshardadapterRouter from "../database-shard-adapter";
import tenantdatapartitionstrategyRouter from "../tenant-data-partition-strategy";
import archivestorageadapterRouter from "../archive-storage-adapter";
import coldstorageexportRouter from "../cold-storage-export";
import restoredrillautomationRouter from "../restore-drill-automation";
import configdriftdetectorRouter from "../config-drift-detector";
import runtimeconfigapprovalworkflowRouter from "../runtime-config-approval-workflow";
import featureflagaudithistoryRouter from "../feature-flag-audit-history";
import saferolloutguardrailsRouter from "../safe-rollout-guardrails";
import canaryanalysisautomationRouter from "../canary-analysis-automation";
import automatedrollbackdecisionengineRouter from "../automated-rollback-decision-engine";
import releaseartifactverificationRouter from "../release-artifact-verification";
import sbomgenerationRouter from "../sbom-generation";
import dependencyvulnerabilitygateRouter from "../dependency-vulnerability-gate";
import containerimagesigningRouter from "../container-image-signing";
import infrastructureascodevalidationRouter from "../infrastructure-as-code-validation";
import secretsrotationschedulerRouter from "../secrets-rotation-scheduler";
import productionreadinessv2Router from "../production-readiness-v2";
import enterprisematurityscorev2Router from "../enterprise-maturity-score-v2";
import finalplatformselfauditandzippackagingRouter from "../final-platform-self-audit-and-zip-packaging";
import validationRouter from "../validation";
import trustCenterAdminRouter from "../trust-center-admin";

registerAdminRoute(router, "/safe-remediation-approval-gate", "admin.write", highRiskRateLimit, saferemediationapprovalgateRouter);
registerAdminRoute(router, "/automated-remediation-executor", "admin.read", highRiskRateLimit, automatedremediationexecutorRouter);
registerAdminRoute(router, "/remediation-rollback-records", "admin.write", highRiskRateLimit, remediationrollbackrecordsRouter);
registerAdminRoute(router, "/false-positive-feedback-loop", "admin.read", highRiskRateLimit, falsepositivefeedbackloopRouter);
registerAdminRoute(router, "/detection-quality-scoring", "admin.read", highRiskRateLimit, detectionqualityscoringRouter);
registerAdminRoute(router, "/detection-drift-monitoring", "admin.read", highRiskRateLimit, detectiondriftmonitoringRouter);
registerAdminRoute(router, "/soc-analyst-notes-service", "command_center.write", highRiskRateLimit, socanalystnotesserviceRouter);
registerAdminRoute(router, "/case-narrative-generator", "admin.read", highRiskRateLimit, casenarrativegeneratorRouter);
registerAdminRoute(router, "/executive-security-summary-generator-v2", "command_center.write", highRiskRateLimit, executivesecuritysummarygeneratorv2Router);
registerAdminRoute(router, "/threat-model-generator", "command_center.write", highRiskRateLimit, threatmodelgeneratorRouter);
registerAdminRoute(router, "/attack-simulation-planner", "admin.read", highRiskRateLimit, attacksimulationplannerRouter);
registerAdminRoute(router, "/purple-team-exercise-tracker", "admin.read", highRiskRateLimit, purpleteamexercisetrackerRouter);
registerAdminRoute(router, "/cyber-range-scenario-registry", "command_center.write", highRiskRateLimit, cyberrangescenarioregistryRouter);
registerAdminRoute(router, "/soc-maturity-scoring", "command_center.write", highRiskRateLimit, socmaturityscoringRouter);
registerAdminRoute(router, "/autonomous-soc-dashboard-backend", "command_center.write", highRiskRateLimit, autonomoussocdashboardbackendRouter);
registerAdminRoute(router, "/enterprise-onboarding-backend", "admin.read", highRiskRateLimit, enterpriseonboardingbackendRouter);
registerAdminRoute(router, "/enterprise-onboarding-frontend", "admin.read", highRiskRateLimit, enterpriseonboardingfrontendRouter);
registerAdminRoute(router, "/tenant-admin-console-shell", "admin.read", highRiskRateLimit, tenantadminconsoleshellRouter);
registerAdminRoute(router, "/tenant-settings-service", "admin.read", highRiskRateLimit, tenantsettingsserviceRouter);
registerAdminRoute(router, "/tenant-audit-portal", "admin.read", highRiskRateLimit, tenantauditportalRouter);
registerAdminRoute(router, "/tenant-security-score", "command_center.write", highRiskRateLimit, tenantsecurityscoreRouter);
registerAdminRoute(router, "/customer-trust-portal-frontend", "admin.read", highRiskRateLimit, customertrustportalfrontendRouter);
registerAdminRoute(router, "/compliance-evidence-portal", "admin.read", highRiskRateLimit, complianceevidenceportalRouter);
registerAdminRoute(router, "/audit-export-download-service", "admin.read", highRiskRateLimit, auditexportdownloadserviceRouter);
registerAdminRoute(router, "/report-scheduling", "admin.read", highRiskRateLimit, reportschedulingRouter);
registerAdminRoute(router, "/email-report-delivery-adapter", "admin.read", highRiskRateLimit, emailreportdeliveryadapterRouter);
registerAdminRoute(router, "/msp-mode-foundation", "admin.read", highRiskRateLimit, mspmodefoundationRouter);
registerAdminRoute(router, "/reseller-mode-foundation", "admin.read", highRiskRateLimit, resellermodefoundationRouter);
registerAdminRoute(router, "/partner-portal-backend", "admin.read", highRiskRateLimit, partnerportalbackendRouter);
registerAdminRoute(router, "/white-label-branding-settings", "admin.read", highRiskRateLimit, whitelabelbrandingsettingsRouter);
registerAdminRoute(router, "/custom-domain-management", "admin.read", highRiskRateLimit, customdomainmanagementRouter);
registerAdminRoute(router, "/tenant-specific-themes", "admin.read", highRiskRateLimit, tenantspecificthemesRouter);
registerAdminRoute(router, "/tenant-specific-legal-docs", "admin.read", highRiskRateLimit, tenantspecificlegaldocsRouter);
registerAdminRoute(router, "/enterprise-invoice-records", "admin.read", highRiskRateLimit, enterpriseinvoicerecordsRouter);
registerAdminRoute(router, "/usage-based-billing-reconciliation", "admin.read", highRiskRateLimit, usagebasedbillingreconciliationRouter);
registerAdminRoute(router, "/seat-management-ui-backend", "admin.read", highRiskRateLimit, seatmanagementuibackendRouter);
registerAdminRoute(router, "/license-expiration-notifications", "admin.read", highRiskRateLimit, licenseexpirationnotificationsRouter);
registerAdminRoute(router, "/renewal-workflow", "admin.read", highRiskRateLimit, renewalworkflowRouter);
registerAdminRoute(router, "/customer-success-health-score", "admin.read", highRiskRateLimit, customersuccesshealthscoreRouter);
registerAdminRoute(router, "/customer-operations-dashboard", "admin.read", highRiskRateLimit, customeroperationsdashboardRouter);
registerAdminRoute(router, "/cqrs-read-model-foundation", "admin.read", highRiskRateLimit, cqrsreadmodelfoundationRouter);
registerAdminRoute(router, "/event-replay-service", "admin.read", highRiskRateLimit, eventreplayserviceRouter);
registerAdminRoute(router, "/projection-worker", "admin.read", highRiskRateLimit, projectionworkerRouter);
registerAdminRoute(router, "/cross-region-event-replication-adapter", "admin.read", highRiskRateLimit, crossregioneventreplicationadapterRouter);
registerAdminRoute(router, "/multi-region-failover-planner", "admin.write", highRiskRateLimit, multiregionfailoverplannerRouter);
registerAdminRoute(router, "/database-shard-adapter", "admin.read", highRiskRateLimit, databaseshardadapterRouter);
registerAdminRoute(router, "/tenant-data-partition-strategy", "admin.read", highRiskRateLimit, tenantdatapartitionstrategyRouter);
registerAdminRoute(router, "/archive-storage-adapter", "admin.read", highRiskRateLimit, archivestorageadapterRouter);
registerAdminRoute(router, "/cold-storage-export", "admin.read", highRiskRateLimit, coldstorageexportRouter);
registerAdminRoute(router, "/restore-drill-automation", "admin.write", highRiskRateLimit, restoredrillautomationRouter);
registerAdminRoute(router, "/config-drift-detector", "admin.read", highRiskRateLimit, configdriftdetectorRouter);
registerAdminRoute(router, "/runtime-config-approval-workflow", "admin.write", highRiskRateLimit, runtimeconfigapprovalworkflowRouter);
registerAdminRoute(router, "/feature-flag-audit-history", "admin.read", highRiskRateLimit, featureflagaudithistoryRouter);
registerAdminRoute(router, "/safe-rollout-guardrails", "admin.read", highRiskRateLimit, saferolloutguardrailsRouter);
registerAdminRoute(router, "/canary-analysis-automation", "admin.write", highRiskRateLimit, canaryanalysisautomationRouter);
registerAdminRoute(router, "/automated-rollback-decision-engine", "admin.write", highRiskRateLimit, automatedrollbackdecisionengineRouter);
registerAdminRoute(router, "/release-artifact-verification", "admin.write", highRiskRateLimit, releaseartifactverificationRouter);
registerAdminRoute(router, "/sbom-generation", "admin.read", highRiskRateLimit, sbomgenerationRouter);
registerAdminRoute(router, "/dependency-vulnerability-gate", "admin.write", highRiskRateLimit, dependencyvulnerabilitygateRouter);
registerAdminRoute(router, "/container-image-signing", "admin.write", highRiskRateLimit, containerimagesigningRouter);
registerAdminRoute(router, "/infrastructure-as-code-validation", "admin.read", highRiskRateLimit, infrastructureascodevalidationRouter);
registerAdminRoute(router, "/secrets-rotation-scheduler", "admin.write", highRiskRateLimit, secretsrotationschedulerRouter);
registerAdminRoute(router, "/production-readiness-v2", "admin.read", highRiskRateLimit, productionreadinessv2Router);
registerAdminRoute(router, "/enterprise-maturity-score-v2", "admin.read", highRiskRateLimit, enterprisematurityscorev2Router);
registerAdminRoute(router, "/final-platform-self-audit-and-zip-packaging", "admin.read", highRiskRateLimit, finalplatformselfauditandzippackagingRouter);
registerAdminRoute(router, "/validation", "admin.read", highRiskRateLimit, validationRouter);
registerAdminRoute(router, "/trust-center", "admin.write", highRiskRateLimit, trustCenterAdminRouter);
registerAdminRoute(router, "/node-health-summary", "admin.read", highRiskRateLimit, nodeHealthSummaryRouter);
registerAdminRoute(router, "/siem-dlq", "admin.write", highRiskRateLimit, siemDlqRouter);

export default router;
