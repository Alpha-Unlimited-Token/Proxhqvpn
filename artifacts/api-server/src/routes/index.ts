// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import { requireAdmin as _requireAdmin } from "../middlewares/requireAdmin";
import { requireAccess } from "../middlewares/requireAccess";
import { requireCommandCenter } from "../middlewares/requireCommandCenter";
import { requireDeviceTrust } from "../middlewares/requireDeviceTrust";
import { createEnrollmentToken } from "../lib/node-enrollment";
import { daemonIpBanMiddleware } from "../app";
import fs from "fs";
import path from "path";
// crypto was used by the old inline requireAuth — now handled by lib/internal-auth.ts via app.ts
// keeping the import removed to avoid unused-import warnings
import healthRouter from "./health";
import anonRouter from "./anon";
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
import cryptoPaymentsRouter from "./crypto-payments";
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
import commandGovernanceRouter from "./command-governance";
import accountSecurityCenterRouter from "./account-security-center";
import dependencyMapRouter from "./dependency-map";
import ambassadorsRouter from "./ambassadors";
import wireguardRouter from "./wireguard";
import daemonInboundRouter from "./daemon-inbound";
import nodeProvisionRouter from "./node-provision";
import sqlmapRouter from "./sqlmap";
import toolRunnerRouter from "./toolrunner";
import alphaRouter from "./alpha";
import httpProbeRouter from "./httpprobe";
import intruderRouter from "./intruder";
import dirFuzzerRouter from "./dirfuzzer";
import subdomainScanRouter from "./subdomainscan";
import employeesRouter from "./employees";
import threatProtectionRouter from "./threatprotection";
import setupRouter from "./setup";
import updatesRouter from "./updates";
import ghostTraceRouter from "./ghosttrace";
import attackChainRouter from "./attackchain";
import networkMonitorRouter from "./networkmonitor";
import vpnTrackerRouter from "./vpntracker";
import dnsSinkholeRouter from "./dnssinkhole";
import siemRouter from "./siem";
import osintRouter from "./osint";
import usernameIntelRouter from "./usernameintel";
import canaryRouter from "./canary";
import exploitImportRouter from "./exploitimport";
import wafRouter from "./waf";
import wafBypassRouter from "./wafbypass";
import omnistrikeRouter from "./omnistrike";
import socialAccountRouter from "./social-account";
import pqcRouter from "./pqc";
import daitaRouter from "./daita";
import darkwebRouter from "./darkweb";
import altidRouter from "./altid";
import iprotatorRouter from "./iprotator";
import sslTlsRouter from "./ssltls";
import jwtAnalyzerRouter from "./jwtanalyzer";
import iacScanRouter from "./iacscan";
import interceptorRouter from "./interceptor";
import apiTesterRouter from "./apitester";
import gpsSpoofRouter from "./gpsspoof";
import portForwardRouter from "./portforward";
import dedicatedIpRouter from "./dedicatedip";
import meshnetRouter from "./meshnet";
import dataBrokerRouter from "./databroker";
import firewallNextRouter from "./firewall-next";
import firewallMilitaryRouter from "./firewall-military";
import oastTesterRouter from "./oasttester";
import oastServerRouter from "./oastserver";
import depScannerRouter from "./depscanner";
import tokenSequencerRouter from "./tokensequencer";
import wsTesterRouter from "./wstester";
import sastRouter from "./sast";
import cveSearchRouter from "./cvesearch";
import notificationsRouter from "./notifications";
import quantumAuditRouter from "./quantum-audit";
import aiSecurityRouter from "./ai-security";
import sqliScannerRouter from "./sqli-scanner";
import adminUsersRouter from "./admin-users";
import imAutomationRouter from "./imautomation";
import redteamScanRouter from "./redteamscan";
import omegaAgentRouter from "./omega/agent";
import ghostTrapRouter from "./ghosttrap";
import deceptionRouter from "./deception";
import firewallAdvancedRouter from "./firewall-advanced";
import ztnaRouter from "./ztna";
import nodeEnrollV2Router from "./node-enroll-v2";
import firewallPolicyV2Router from "./firewall-policy-v2";
import nodeTrustRouter from "./node-trust";
import securityScoreRouter from "./security-score";
import driftMonitorRouter from "./drift-monitor";
import governanceRouter from "./governance";
import eventGraphRouter from "./event-graph";

const router: IRouter = Router();

// Public routes
router.use(healthRouter);

// Public IP detection — returns the caller's IP as seen by the server.
// No auth required; used by the frontend to auto-whitelist the user's current IP.
router.get("/my-ip", (req: Request, res: Response) => {
  const forwarded = req.headers["x-forwarded-for"];
  const ip =
    (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    req.ip ||
    "unknown";
  res.json({ ip });
});

// Public update manifests — electron-updater reads these without auth
// Admin sub-routes (/publish, /admin) are protected inside the router
router.use("/updates", updatesRouter);

// Public version check — used by the Downloads page "Check for Updates" button
// (alias of /updates/check so both web users and standalone users hit the same path)
router.get("/update/check", (_req, res) => {
  res.redirect(307, "/api/updates/check");
});

// Daemon inbound — authenticated via PSK header (not Clerk), public route
// daemonIpBanMiddleware is applied HERE ONLY — not globally — so normal Clerk
// 401s on other routes never count toward the brute-force threshold.
router.use("/daemon-inbound", daemonIpBanMiddleware, daemonInboundRouter);

// Canary token trigger — public, must fire even without auth
router.get("/t/:tokenId", (req, res, next) => {
  req.url = `/trigger/${req.params.tokenId}`;
  (canaryRouter as any).handle(req, res, next);
});
router.get("/t/:tokenId/pixel.gif", (req, res, next) => {
  req.url = `/trigger/${req.params.tokenId}/pixel.gif`;
  (canaryRouter as any).handle(req, res, next);
});
router.get("/t/:tokenId/redirect", (req, res, next) => {
  req.url = `/trigger/${req.params.tokenId}/redirect`;
  (canaryRouter as any).handle(req, res, next);
});

// Omega agent — public, receives callbacks from JS agents deployed on test sites
// Must allow cross-origin (agents run on external domains)
router.use("/omega-agent", omegaAgentRouter);

// C2 ingest — public, receives callbacks from deployed red-team payloads cross-origin
router.post("/redteam-scan/c2/ingest", (req, res, next) => {
  req.url = "/c2/ingest";
  (redteamScanRouter as any).handle(req, res, next);
});
router.options("/redteam-scan/c2/ingest", (req, res, next) => {
  req.url = "/c2/ingest";
  (redteamScanRouter as any).handle(req, res, next);
});

// Ghost Trap lure + beacon endpoints — public (attackers must reach these without auth)
// /lure/* = platform honeypot endpoints
// /u/:token/lure/* = per-user honeypot endpoints (attributed via userToken)
// /beacon/* = tracking pixel / JS callback (fired by attacker browsers)
router.use("/ghost-trap", (req, res, next) => {
  if (
    req.path.startsWith("/lure") ||
    req.path.startsWith("/u/") ||
    req.path.startsWith("/beacon/")
  ) return (ghostTrapRouter as any).handle(req, res, next);
  next();
});

// Warrant canary — public transparency endpoint
router.get("/warrant-canary", (req, res, next) => {
  req.url = `/warrant-canary`;
  (canaryRouter as any).handle(req, res, next);
});

// Node auto-provision — PSK protected, public (no Clerk)
router.use("/node-provision", nodeProvisionRouter);

// Public daemon download — serves proxhqd.py for deployment to VPN nodes
// Protected: requires admin auth since it could expose internal tooling
router.get("/daemon-download", _requireAdmin, (_req: Request, res: Response) => {
  const filePath = path.resolve(process.cwd(), "../../tools/proxhqd.py");
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "Daemon file not found" });
  }
  res.setHeader("Content-Type", "text/plain");
  res.setHeader("Content-Disposition", "attachment; filename=proxhqd.py");
  res.send(fs.readFileSync(filePath, "utf-8"));
});

// Node setup script — returns a bash installer for new VPN servers
// Admin-only. Uses one-time enrollment tokens instead of long-lived PSK.
// Get a token first: POST /api/node-enrollment/tokens → then set ENROLL_TOKEN env var.
router.get("/setup-script", _requireAdmin, (req: Request, res: Response) => {
  const replitDomain = process.env.REPLIT_DEV_DOMAIN || process.env.REPLIT_DOMAINS?.split(",")[0] || "";
  const apiBase = replitDomain ? `https://${replitDomain}/api` : `https://${req.headers.host}/api`;
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

die() { echo ""; echo "ERROR: \$1"; echo "Setup failed. Fix the error above and re-run."; exit 1; }
ok()  { echo "  OK"; }

echo ""
echo "========================================"
echo "   ProxhqVPN Node Setup"
echo "   Region: \$REGION"
echo "========================================"
echo ""

# Wait for cloud-init to finish (new servers need this)
echo "[0/7] Waiting for system to be ready..."
sleep 5
systemctl is-active --quiet cloud-init-local 2>/dev/null && sleep 10
ok

# 1. Install WireGuard
echo "[1/7] Installing WireGuard..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq 2>&1 | tail -1 || true
apt-get install -y wireguard wireguard-tools openvpn curl python3 iptables 2>&1 | grep -E "^(Err|W:|E:)" || true
which wg > /dev/null 2>&1 || die "WireGuard failed to install. Try: apt-get install wireguard"
ok

# 2. Generate WireGuard keys
echo "[2/7] Generating WireGuard keys..."
SERVER_PRIVKEY=\$(wg genkey) || die "Failed to generate WireGuard private key"
SERVER_PUBKEY=\$(echo "\$SERVER_PRIVKEY" | wg pubkey) || die "Failed to derive public key"
echo "  Public key: \$SERVER_PUBKEY"
ok

# 3. Get public IP
echo "[3/7] Detecting public IP..."
PUBLIC_IP=\$(curl -sf --max-time 8 https://api.ipify.org 2>/dev/null) \\
  || PUBLIC_IP=\$(curl -sf --max-time 8 https://ipinfo.io/ip 2>/dev/null) \\
  || PUBLIC_IP=\$(curl -sf --max-time 8 https://icanhazip.com 2>/dev/null)
[ -z "\$PUBLIC_IP" ] && die "Could not detect public IP — check internet connectivity"
echo "  IP: \$PUBLIC_IP"
ok

# 4. Register with ProxhqVPN
echo "[4/7] Registering node with ProxhqVPN..."
[ -z "\$ENROLL_TOKEN" ] && die "ENROLL_TOKEN is required. Generate one in the admin panel → Nodes → Node Enrollment."
PAYLOAD='{"token":"'"\$ENROLL_TOKEN"'","nodeId":"'"\$HOSTNAME"'","publicKey":"'"\$SERVER_PUBKEY"'","region":"'"\$REGION"'","publicIp":"'"\$PUBLIC_IP"'"}'
RESPONSE=\$(curl -sf --max-time 15 -X POST "\$API/node-enrollment/claim" \\
  -H "Content-Type: application/json" \\
  -d "\$PAYLOAD") || die "Could not reach ProxhqVPN API at \$API/node-enrollment/claim"
[ -z "\$RESPONSE" ] && die "Empty response from API — enrollment token may be expired or already used"
NODE_ID=\$(echo "\$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['nodeId'])") || die "Bad API response: \$RESPONSE"
SERVER_VPN_IP=\$(echo "\$RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['serverVpnIp'])")
echo "  Node ID: \$NODE_ID | VPN IP: \$SERVER_VPN_IP"
ok

# 5. Create wg0.conf
echo "[5/7] Configuring WireGuard..."
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

# 6. Download daemon
echo "[6/7] Installing ProxhqVPN daemon..."
curl -sf --max-time 15 "\$API/daemon-download" -o /usr/local/bin/proxhqd.py || die "Failed to download daemon from \$API/daemon-download"
chmod +x /usr/local/bin/proxhqd.py
ok

# 7. Install systemd service
echo "[7/7] Starting daemon service..."
cat > /etc/systemd/system/proxhqd.service << SVCEOF
[Unit]
Description=ProxhqVPN Daemon
After=network.target wg-quick@wg0.service
Wants=wg-quick@wg0.service

[Service]
ExecStart=/usr/bin/python3 /usr/local/bin/proxhqd.py --api \${API} --node-id \${NODE_ID}
Restart=always
RestartSec=30
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
SVCEOF
systemctl daemon-reload
systemctl enable proxhqd
systemctl restart proxhqd
ok

echo ""
echo "========================================"
echo "  Setup Complete!"
echo ""
echo "  Node ID  : \$NODE_ID"
echo "  Region   : \$REGION"
echo "  Public IP: \$PUBLIC_IP"
echo "  VPN IP   : \$SERVER_VPN_IP"
echo ""
echo "  Node is now online and reporting"
echo "  Check your dashboard in 30 seconds"
echo "========================================"
echo ""
`;

  res.setHeader("Content-Type", "text/plain");
  res.send(script);
});

// Anonymous account routes — public (create + auth require no Clerk session)
router.use("/anon", anonRouter);

// Ambassador routes — public (browse list + promo lookup require no auth)
// Individual protected endpoints inside check auth themselves via getAuth()
router.use("/ambassadors",    ambassadorsRouter);

// Stripe routes — must be PUBLIC so the pricing page works without login.
// The individual handlers call getAuth() themselves for checkout/portal/subscription.
router.use("/stripe",         stripeRouter);
router.use("/payments/crypto", cryptoPaymentsRouter);
router.use("/notifications",  notificationsRouter);

// Auth guard — all routes below require a valid Clerk session.
// The internalBypass flag is set by internalSecretBypass middleware in app.ts
// (loopback-only in production, Origin-blocked for browser requests).
const requireAuth = (req: Request, res: Response, next: NextFunction) => {
  if ((req as any).internalBypass) return next();
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  next();
};
router.use(requireAuth);

// Admin guard — checks is_admin flag in DB (re-exported from shared middleware)
export const requireAdmin = _requireAdmin;

router.use("/me",               meRouter);
router.use("/account-security", requireAccess, accountSecurityCenterRouter);

// ── Admin-only routes ──────────────────────────────────────────────────────
// Every route below requires an authenticated admin account.
router.use("/nodes",          requireAdmin, nodesRouter);
router.use("/beacons",        requireAdmin, beaconsRouter);
router.use("/silkweb",        requireAdmin, silkwebRouter);
router.use("/firewall",       requireAdmin, firewallRouter);
router.use("/monitor",        requireAdmin, monitorRouter);
router.use("/terminal",       requireAdmin, terminalRouter);
router.use("/sql",            requireAdmin, sqlRouter);

// (stripe, crypto payments, notifications are registered above requireAuth — see public section)

// ── VPN Basic routes — any active subscription (vpn OR command_center) ──────
router.use("/killswitch",     requireAccess, killswitchRouter);
router.use("/leaks",          requireAccess, leaksRouter);
router.use("/split-tunnel",   requireAccess, splittunnelRouter);
router.use("/obfuscation",    requireAccess, obfuscationRouter);
router.use("/daemon",         requireAccess, daemonRouter);
router.use("/vpn-coexist",    requireAccess, vpnCoexistRouter);
router.use("/vpngate",        requireAccess, vpnGateRouter);
router.use("/devices",        requireAccess, devicesRouter);
router.use("/dns-shield",     requireAccess, dnsShieldRouter);
router.use("/smart-dns",      requireAccess, smartDnsRouter);
router.use("/router-config",  requireAccess, routerConfigRouter);
router.use("/wireguard",      requireAccess, requireDeviceTrust, wireguardRouter);
router.use("/threat-protection", requireAccess, threatProtectionRouter);
// Onion Browser (Tor) — included in VPN Basic; users can Tor over VPN or standalone
router.use("/proxy-browser",  requireAccess, proxyBrowserRouter);

// ── Privacy Suite — new features closing the gap with top-5 VPNs ────────────
router.use("/pqc",        requireAccess, pqcRouter);        // Post-Quantum Encryption
router.use("/daita",      requireAccess, daitaRouter);      // Defense Against AI Traffic Analysis
router.use("/darkweb",    requireAccess, darkwebRouter);    // Dark Web Breach Monitor
router.use("/altid",      requireAccess, altidRouter);      // Alternative Identity Generator
router.use("/iprotator",  requireAccess, iprotatorRouter);  // IP Rotator

router.use("/cve",            requireAccess, cveSearchRouter);         // CVE search proxy (avoids client-side CORS)

// ── Command Center Pro routes — requires command_center tier (or admin/employee)
router.use("/threatintel",     requireCommandCenter, threatintelRouter);
router.use("/security-audit",  requireCommandCenter, securityauditRouter);
router.use("/sqlmap",          requireCommandCenter, sqlmapRouter);
router.use("/tool-runner",     requireCommandCenter, toolRunnerRouter);
router.use("/alpha",           requireCommandCenter, alphaRouter);
router.use("/http-probe",      requireCommandCenter, httpProbeRouter);
router.use("/dir-fuzzer",      requireCommandCenter, dirFuzzerRouter);
router.use("/subdomain-scan",  requireCommandCenter, subdomainScanRouter);
router.use("/intruder",        requireCommandCenter, intruderRouter);
router.use("/ghost-trap",       requireAccess,        ghostTrapRouter);
router.use("/fw",              requireAccess,        firewallAdvancedRouter);
router.use("/ghost-trace",      requireCommandCenter, ghostTraceRouter);
router.use("/attack-chain",    requireCommandCenter, attackChainRouter);
router.use("/network-monitor", requireAccess,        networkMonitorRouter);
router.use("/vpn-tracker",    requireCommandCenter,  vpnTrackerRouter);
router.use("/dns-sinkhole",    requireAccess,        dnsSinkholeRouter);
router.use("/siem",            requireCommandCenter, siemRouter);
router.use("/osint",           requireCommandCenter, osintRouter);
router.use("/username-intel",  requireCommandCenter, usernameIntelRouter);
router.use("/canary",          requireCommandCenter, canaryRouter);
router.use("/exploit-import",  requireCommandCenter, exploitImportRouter);
router.use("/waf",             requireCommandCenter, wafRouter);
router.use("/waf-bypass",      requireCommandCenter, wafBypassRouter);
router.use("/omnistrike",      requireCommandCenter, omnistrikeRouter);
// ── Deception Engine — OWNER / ADMIN ONLY — regular users never see this ───
router.use("/deception",       requireAdmin,         deceptionRouter);
router.use("/social-account",  requireCommandCenter, socialAccountRouter);
router.use("/ssl-tls",         requireCommandCenter, sslTlsRouter);
router.use("/jwt-analyzer",    requireCommandCenter, jwtAnalyzerRouter);
router.use("/iac-scan",        requireCommandCenter, iacScanRouter);
router.use("/interceptor",     requireCommandCenter, interceptorRouter);
router.use("/api-tester",      requireCommandCenter, apiTesterRouter);
// ── Dev Security Gap-Closers vs Burp Suite / ZAP / Snyk ─────────────────
router.use("/oast-tester",     requireCommandCenter, oastTesterRouter);
// Real OAST callback server — /api/oast/cb/:token is PUBLIC (payloads fire here)
router.use("/oast/cb",         oastServerRouter);
router.use("/oast",            requireCommandCenter, oastServerRouter);
router.use("/dep-scanner",     requireCommandCenter, depScannerRouter);
router.use("/token-seq",       requireCommandCenter, tokenSequencerRouter);
router.use("/ws-tester",       requireCommandCenter, wsTesterRouter);
router.use("/sast",            requireCommandCenter, sastRouter);
router.use("/quantum-audit",       requireCommandCenter, quantumAuditRouter);
router.use("/command-governance",  requireCommandCenter, commandGovernanceRouter);
router.use("/dependency-map",      requireCommandCenter, dependencyMapRouter);
router.use("/ai-security",     requireCommandCenter, aiSecurityRouter);
router.use("/sqli-scanner",    requireCommandCenter, sqliScannerRouter);
router.use("/im-auto",         requireCommandCenter, imAutomationRouter);
router.use("/redteam-scan",    requireCommandCenter, redteamScanRouter);
// ── VPN Gap-Closers vs NordVPN / Mullvad / Surfshark / ExpressVPN ────────
router.use("/gps-spoof",       requireAccess, gpsSpoofRouter);
router.use("/port-forward",    requireAccess, portForwardRouter);
router.use("/dedicated-ip",    requireAccess, dedicatedIpRouter);
router.use("/meshnet",         requireAccess, meshnetRouter);
router.use("/data-broker",     requireAccess, dataBrokerRouter);
router.use("/fwn",             requireAccess, firewallNextRouter);
router.use("/fwm",             requireAccess, firewallMilitaryRouter);

// ── ZTNA / Zero Trust ─────────────────────────────────────────────────────
router.use("/ztna",           requireAccess, ztnaRouter);

// ── Admin-only routes ─────────────────────────────────────────────────────
// Legacy enrollment token endpoint — new callers should use /api/node-enrollment/tokens
router.post("/node-enrollment-token", _requireAdmin, async (req: Request, res: Response) => {
  const { token, tokenHash, expiresAt } = createEnrollmentToken();
  const region = (req.body?.region as string) ?? null;
  await db.execute(
    sql`INSERT INTO node_enrollment_tokens (token_hash, created_by, region, expires_at)
        VALUES (${tokenHash}, ${(req as any).auth?.userId ?? "admin"}, ${region}, ${expiresAt.toISOString()})`
  );
  res.json({ token, expiresAt, region });
});

// ── Deep Audit A+ Routes ─────────────────────────────────────────────────────
router.use("/node-enrollment",         _requireAdmin,       nodeEnrollV2Router);
router.use("/firewall-v2",             requireCommandCenter, firewallPolicyV2Router);
router.use("/node-trust",              _requireAdmin,        nodeTrustRouter);
router.use("/security-score",          requireAccess,        securityScoreRouter);
router.use("/drift-monitor",           requireCommandCenter, driftMonitorRouter);
router.use("/governance",              requireCommandCenter, governanceRouter);
router.use("/events",                  requireCommandCenter, eventGraphRouter);
router.get("/config-lifecycle-events", requireAccess, async (req: Request, res: Response) => {
  const userId = (req as any).auth?.userId ?? "unknown";
  const { getConfigLifecycleHistory } = await import("../lib/config-lifecycle");
  const events = await getConfigLifecycleHistory(userId, 100);
  res.json({ events });
});

router.use("/admin/users",    requireAdmin, adminUsersRouter);
router.use("/employees",      requireAdmin, employeesRouter);
router.use("/setup",          requireAdmin, setupRouter);

export default router;
