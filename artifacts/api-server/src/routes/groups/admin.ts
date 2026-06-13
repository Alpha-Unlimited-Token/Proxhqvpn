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

import nodesRouter from "../nodes";
import beaconsRouter from "../beacons";
import silkwebRouter from "../silkweb";
import firewallRouter from "../firewall";
import monitorRouter from "../monitor";
import terminalRouter from "../terminal";
import sqlRouter from "../sqlquery";
import deceptionRouter from "../deception";
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

const router = Router();

router.get("/daemon-download", requireAdmin, (_req: Request, res: Response) => {
  const filePath = path.resolve(process.cwd(), "../../tools/proxhqd.py");

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "Daemon file not found" });
  }

  res.setHeader("Content-Type", "text/plain");
  res.setHeader("Content-Disposition", "attachment; filename=proxhqd.py");
  res.send(fs.readFileSync(filePath, "utf-8"));
});

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

echo "[0/7] Waiting for system to be ready..."
sleep 5
systemctl is-active --quiet cloud-init-local 2>/dev/null && sleep 10
ok

echo "[1/7] Installing WireGuard..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq 2>&1 | tail -1 || true
apt-get install -y wireguard wireguard-tools openvpn curl python3 iptables 2>&1 | grep -E "^(Err|W:|E:)" || true
which wg > /dev/null 2>&1 || die "WireGuard failed to install. Try: apt-get install wireguard"
ok

echo "[2/7] Generating WireGuard keys..."
SERVER_PRIVKEY=$(wg genkey) || die "Failed to generate WireGuard private key"
SERVER_PUBKEY=$(echo "$SERVER_PRIVKEY" | wg pubkey) || die "Failed to derive public key"
echo "  Public key: $SERVER_PUBKEY"
ok

echo "[3/7] Detecting public IP..."
PUBLIC_IP=$(curl -sf --max-time 8 https://api.ipify.org 2>/dev/null) \\
  || PUBLIC_IP=$(curl -sf --max-time 8 https://ipinfo.io/ip 2>/dev/null) \\
  || PUBLIC_IP=$(curl -sf --max-time 8 https://icanhazip.com 2>/dev/null)
[ -z "$PUBLIC_IP" ] && die "Could not detect public IP — check internet connectivity"
echo "  IP: $PUBLIC_IP"
ok

echo "[4/7] Registering node with ProxhqVPN..."
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

echo "[6/7] Installing ProxhqVPN daemon..."
curl -sf --max-time 15 "$API/daemon-download" -o /usr/local/bin/proxhqd.py || die "Failed to download daemon from $API/daemon-download"
chmod +x /usr/local/bin/proxhqd.py
ok

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

export default router;
