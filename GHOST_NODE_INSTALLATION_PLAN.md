# GHOST_NODE_INSTALLATION_PLAN.md
**ProxhqVPN Ghost Node — Defensive Decoy Infrastructure Installation Plan**
**Date:** 2026-06-13 | **Author:** Alpha Unlimited Technologies LLC

---

## Overview

Ghost Nodes are fake WireGuard endpoints presented to network scanners and attackers. They are:
- **Never** connected to real customer VPN tunnels
- **Never** used to route legitimate traffic
- **Always** isolated from the production WireGuard mesh via separate network interfaces

---

## Architecture

```
Internet
   │
   ├── Real VPN Node (wg0) ──────── Customer traffic
   │
   └── Ghost Node Interface (wg-ghost0) ── Attacker decoy traffic
            │
            ▼
      Ghost Trap engine (logs + tarpits)
            │
            ▼
      Backend API (ghost_node_events)
            │
            ▼
      SIEM + Dashboard
```

---

## Step 1: Register Ghost Node in Dashboard

1. Navigate to `/ghost-nodes` (Command Center Pro tier required)
2. Click **Add Ghost Node**
3. Fill in:
   - **Name**: descriptive (e.g., `decoy-la-01`)
   - **Region**: geographic region (e.g., `us-west`)
   - **Public IP**: the real IP of the Vultr instance
   - **Decoy IP** (optional): fake IP shown to scanners (e.g., `10.8.99.1`)
   - **Listen Port**: port the decoy WireGuard interface listens on (default: 51820)
   - **Decoy Public Key**: generate a random 32-byte key (NOT a real WireGuard private key)
   - **Isolation Level**: `full` (recommended — decoy traffic never reaches real nodes)

---

## Step 2: Create Node Policy

1. From the Ghost Nodes page, click the node → **Create Policy**
2. Configure:
   - **Decoy Banners**: JSON array of fake service banner strings (e.g., `OpenSSH_8.9`)
   - **Port Mappings**: `{"22": "SSH", "51820": "WireGuard", "80": "nginx"}`
   - **Isolation Mode**: `full` (complete traffic isolation)
   - **Allow Tarpitting**: `true` — slows down attacker connections
   - **Allow Beacons**: `true` — injects tracking pixels into fake responses
   - **Tarpit Max MS**: 30000 (30 seconds max delay)
   - **Rate Limit**: 30 events/IP/minute
   - **SIEM Fanout**: `true`

---

## Step 3: Install Ghost Node Daemon on Server

SSH into the Vultr instance and run:

```bash
# Download the ghost node daemon installer
curl -O https://your-api-domain/api/ghost-nodes/installer.sh
chmod +x installer.sh
sudo ./installer.sh --node-id <ghost_node_id> --psk <HONEYPOT_PSK>
```

Or manually:

```bash
# 1. Install dependencies
sudo apt-get update && sudo apt-get install -y wireguard nftables curl jq

# 2. Create ghost node config directory
sudo mkdir -p /etc/proxhqvpn/ghost-node
sudo mkdir -p /var/log/proxhqvpn

# 3. Create WireGuard ghost interface
sudo ip link add dev wg-ghost0 type wireguard

# 4. Configure ghost WireGuard (fake keys, isolated routing table)
sudo cat > /etc/proxhqvpn/ghost-node/wg-ghost0.conf << 'EOF'
[Interface]
Address = 10.99.0.1/24
ListenPort = 51820
PrivateKey = <decoy_private_key>
Table = off
EOF

# 5. Apply isolation nftables rules
sudo nft add table ip ghost_trap_isolation
sudo nft add chain ip ghost_trap_isolation forward { type filter hook forward priority 0 \; policy drop \; }
sudo nft add rule ip ghost_trap_isolation forward iifname "wg-ghost0" drop
sudo nft add rule ip ghost_trap_isolation forward oifname "wg-ghost0" drop

# 6. Create the proxhqd ghost daemon service
sudo cat > /etc/systemd/system/proxhqd-ghost.service << 'EOF'
[Unit]
Description=ProxhqVPN Ghost Node Daemon
After=network.target

[Service]
Type=simple
User=root
ExecStart=/usr/local/bin/proxhqd-ghost \
  --node-id <ghost_node_id> \
  --backend-url https://<your-api-domain> \
  --psk <HONEYPOT_PSK>
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable proxhqd-ghost
sudo systemctl start proxhqd-ghost
```

---

## Step 4: Verify Daemon Check-In

From the dashboard:
1. Navigate to `/ghost-nodes`
2. The node status should show **Active** within 60 seconds of daemon start
3. Check the **Events** tab for initial `heartbeat` events

---

## Step 5: Vultr Sync (Optional)

If the node is hosted on Vultr:
1. Set `VULTR_API_KEY` environment variable on the API server
2. Navigate to `/ghost-nodes` → **Sync Vultr**
3. The Vultr instance will be matched by IP and linked to the ghost node record

---

## Security Checklist

- [ ] Ghost node is on a separate network namespace or isolated VLAN
- [ ] `wg-ghost0` traffic is **blocked** from forwarding to `wg0` (production WireGuard)
- [ ] nftables/iptables `DROP` rule applied for ghost interface forward chain
- [ ] Ghost node private key is different from all production WireGuard keys
- [ ] `HONEYPOT_PSK` is set and rotated quarterly
- [ ] Ghost node events fan out to SIEM
- [ ] Isolation mode set to `full`

---

## Supported Node Types

| Node | Decoy Behavior |
|------|---------------|
| WireGuard decoy | Fake WG handshake responses |
| SSH honeypot | Banner probe logging |
| HTTP/S honeypot | Fake admin panel (tarpit) |
| Port scan target | TCP connection logging |
