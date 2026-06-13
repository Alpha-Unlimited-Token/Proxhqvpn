# VULTR_NODE_DAEMON_INSTALL_GUIDE.md
**ProxhqVPN — Vultr Node Daemon (proxhqd) Installation Guide**
**Date:** 2026-06-13 | **Author:** Alpha Unlimited Technologies LLC

---

## Overview

The `proxhqd` daemon runs on each Vultr VPS and handles:
- WireGuard key management (RAM-only, `/dev/shm`)
- Ghost Node deception policy application
- Ghost Trap event shipping
- Real-time heartbeat to backend API
- Honeypot interface isolation

---

## Prerequisites

| Requirement | Version |
|-------------|---------|
| Ubuntu | 22.04 LTS or 24.04 LTS |
| WireGuard | Kernel module (built-in Ubuntu 22+) |
| nftables | 1.0+ |
| Python | 3.10+ (for tun_daemon.py) |
| curl | Any modern version |
| systemd | ≥ 245 |

---

## Quick Install (Standard Node)

```bash
#!/bin/bash
# Run as root on the Vultr instance

# 1. System update
apt-get update && apt-get upgrade -y
apt-get install -y wireguard nftables python3 python3-pip curl jq fail2ban ufw

# 2. Download ProxhqVPN daemon
curl -fsSL https://your-api-domain/api/setup/download/proxhqd -o /usr/local/bin/proxhqd
chmod +x /usr/local/bin/proxhqd

# 3. Create config directory
mkdir -p /etc/proxhqvpn
mkdir -p /var/log/proxhqvpn
mkdir -p /dev/shm/proxhqvpn  # RAM-only WireGuard key storage

# 4. Create node.env
cat > /etc/proxhqvpn/node.env << EOF
PROXHQ_NODE_ID=<your_node_id>
PROXHQ_NODE_AGENT_PSK=<NODE_AGENT_PSK_value>
PROXHQ_BACKEND_URL=https://your-api-domain
PROXHQ_LOG_LEVEL=standard
PROXHQ_GHOST_NODE_ENABLED=false
PROXHQ_WG_INTERFACE=wg0
EOF
chmod 600 /etc/proxhqvpn/node.env

# 5. Install systemd service
cat > /etc/systemd/system/proxhqd.service << 'EOF'
[Unit]
Description=ProxhqVPN Node Daemon
After=network.target wg-quick@wg0.service
Requires=network.target

[Service]
Type=simple
User=root
EnvironmentFile=/etc/proxhqvpn/node.env
ExecStart=/usr/local/bin/proxhqd
Restart=always
RestartSec=15
StandardOutput=append:/var/log/proxhqvpn/proxhqd.log
StandardError=append:/var/log/proxhqvpn/proxhqd.log
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable proxhqd
systemctl start proxhqd
```

---

## Ghost Node Daemon Extension

For Vultr instances designated as Ghost Nodes, additionally configure:

```bash
# Set ghost node mode in node.env
echo "PROXHQ_GHOST_NODE_ENABLED=true" >> /etc/proxhqvpn/node.env
echo "PROXHQ_GHOST_NODE_ID=<ghost_node_id>" >> /etc/proxhqvpn/node.env
echo "PROXHQ_HONEYPOT_PSK=<HONEYPOT_PSK_value>" >> /etc/proxhqvpn/node.env

# Create ghost WireGuard interface (isolated from wg0)
ip link add dev wg-ghost0 type wireguard
ip address add 10.99.0.1/24 dev wg-ghost0
ip link set wg-ghost0 up

# Apply isolation: ghost0 traffic cannot reach wg0 or LAN
nft add table ip ghost_isolation
nft add chain ip ghost_isolation forward { type filter hook forward priority 0 \; }
nft add rule ip ghost_isolation forward iifname "wg-ghost0" oifname "wg0" drop
nft add rule ip ghost_isolation forward iifname "wg0" oifname "wg-ghost0" drop

# Save nftables config
nft list ruleset > /etc/nftables.conf
systemctl enable nftables
```

---

## RAM-Only WireGuard Key Architecture

WireGuard private keys are stored **only in RAM** — never on disk:

```bash
# Keys are stored in /dev/shm (tmpfs — cleared on reboot)
# The daemon fetches keys via:
# POST /api/daemon-inbound/wg-key
# with PSK header: x-node-agent-psk: <NODE_AGENT_PSK>

# Verify key is RAM-only (should not appear in any disk file):
grep -r "PRIVATE KEY" /etc/wireguard/ 2>/dev/null  # should be empty
ls -la /dev/shm/proxhqvpn/  # keys live here
```

---

## Daemon Heartbeat Format

The daemon sends heartbeats to:
```
POST /api/node-agent/health
Headers: x-node-agent-psk: <PSK>
Body: {
  "nodeId": "...",
  "cpuPct": 23.4,
  "memPct": 41.2,
  "diskMb": 8432,
  "deceptionCapable": true,    # ghost node flag
  "ghostNodeId": 5,            # optional
  "policyVersion": 3           # current policy version
}
```

---

## Log Locations

| Log | Path |
|-----|------|
| Main daemon | `/var/log/proxhqvpn/proxhqd.log` |
| WireGuard | `journalctl -u wg-quick@wg0` |
| Ghost daemon | `journalctl -u proxhqd-ghost` |
| nftables | `/var/log/proxhqvpn/nftables.log` |

---

## Security Hardening (Mandatory)

```bash
# SSH key-only authentication
sed -i 's/PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl restart ssh

# UFW firewall baseline
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp      # SSH (restrict to your IP after setup)
ufw allow 51820/udp   # WireGuard
ufw allow 51821/udp   # Ghost WireGuard (if ghost node)
ufw enable

# fail2ban for SSH brute force
systemctl enable fail2ban
systemctl start fail2ban

# Disable unused services
systemctl disable apache2 2>/dev/null || true
systemctl disable nginx 2>/dev/null || true
```

---

## Vultr-Specific Notes

- **Snapshot isolation**: Create a Vultr snapshot BEFORE installing the ghost node daemon
- **Private network**: Add the instance to a Vultr private network — ghost node traffic should never leave the datacenter's internal network
- **Block storage**: WireGuard keys must NOT be stored on Vultr block storage (only `/dev/shm`)
- **Firewall rules**: Set up Vultr firewall groups to restrict inbound to port 51820/UDP and 22/TCP from your management IP only
