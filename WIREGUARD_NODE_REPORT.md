# WIREGUARD_NODE_REPORT.md
**Generated:** 2026-06-13  
**Scope:** WireGuard configuration architecture — from repository code and DB schema  
**Note:** Actual live `wg show` output cannot be retrieved from Replit.

---

## §1 — WireGuard DB Schema (`lib/db/src/schema/wireguard.ts`)

### `user_wg_configs` table
| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| userId | text FK→users.id | Clerk user ID |
| nodeId | integer FK→nodes.id | Target VPN node |
| privateKey | text | Client WG private key (encrypted) |
| publicKey | text | Client WG public key |
| presharedKey | text | Optional PSK for PQ resistance |
| assignedIp | text | Allocated IP (10.8.0.x/24) |
| dns | text | DNS server to use |
| mtu | integer | MTU setting |
| keepalive | integer | PersistentKeepalive seconds |
| status | text | active / revoked |
| createdAt | timestamp | |
| lastUsedAt | timestamp | |

### `wg_peer_commands` table
| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| configId | integer FK→user_wg_configs | |
| nodeId | integer FK→nodes | Target node |
| command | text | wg set / wg addconf / wg-quick |
| status | text | pending / sent / applied / failed |
| sentAt | timestamp | |
| appliedAt | timestamp | |

### `wireguard_config_fingerprints` table
Stores SHA-256 fingerprints of generated configs for tamper detection and revocation tracking.

---

## §2 — Key Architecture (from `routes/wireguard.ts` + `lib/encrypted-secret-store.ts`)

### RAM-Only Key Architecture
Mullvad-style implementation documented in replit.md:
- Private keys are **never written to disk**
- Keys stored only in `/dev/shm` on Linux (tmpfs — wiped on reboot)
- Keys AES-256-GCM encrypted before being written to DB
- Master key: `PROXHQ_MASTER_KEY_B64` env var
- Key delivery: `POST /api/daemon-inbound/wg-key` (PSK-authenticated)

### Key rotation flow
1. Admin triggers rotation (via `/api/wireguard/rotate` or manually)
2. `standalone/scripts/rotate-wireguard-keys.sh` runs on node
3. Backup existing key to encrypted backup
4. Generate new keypair: `wg genkey | tee /dev/shm/privkey | wg pubkey > /dev/shm/pubkey`
5. New public key pushed to API via `POST /api/daemon-inbound/wg-key`
6. API server updates `nodes.publicKey` and re-encrypts private key envelope
7. Staged rollout: one node at a time, verify peers reconnect before proceeding

### Encryption at rest
```
AES-256-GCM(key=PROXHQ_MASTER_KEY_B64, nonce=random-12-bytes)
  plaintext: WireGuard private key
  ciphertext: stored in nodes.privateKey column
```

---

## §3 — Config Generation (from `routes/wireguard.ts`)

### API endpoints
| Method | Route | Description |
|---|---|---|
| GET | /api/wireguard/nodes | List nodes with WG metadata |
| POST | /api/wireguard/generate | Generate .conf for a user+node pair |
| POST | /api/wireguard/revoke/:configId | Revoke a config |
| GET | /api/wireguard/configs | List user's active configs |
| POST | /api/wireguard/ram-key | Trigger RAM key load on node |
| GET | /api/wireguard/qr/:configId | Generate QR code for mobile |

### Generated config template
```ini
[Interface]
PrivateKey = <CLIENT_PRIVKEY>
Address = 10.8.0.X/24
DNS = 1.1.1.1
MTU = 1420

[Peer]
PublicKey = <NODE_PUBKEY>
PresharedKey = <PSK_IF_ENABLED>
Endpoint = <NODE_PUBLIC_IP>:<NODE_PORT>
AllowedIPs = 0.0.0.0/0, ::/0
PersistentKeepalive = 25
```

### Device IP allocation
Range: `10.8.0.0/24` (from `routes/devices.ts`)  
Allocation: sequential, tracked in `user_wg_configs.assignedIp`  
Collision detection: DB unique constraint on `(node_id, assigned_ip)`

---

## §4 — Ghostd.py VPN Protocol

The standalone daemon uses a custom UDP protocol, not standard WireGuard:

| Parameter | Value |
|---|---|
| TUN interface | ghost0 (Linux) / utun (macOS) / WinTun (Windows) |
| TUN address | 10.99.0.1 |
| Peer address | 10.99.0.2 |
| TUN CIDR | 10.99.0.0/24 |
| Protocol | UDP + custom GHNT framing |
| Encryption | AES-256-GCM |
| Key exchange | X25519 ECDH + HKDF-SHA256 |
| MTU | 1500 |
| Header size | 22 bytes (magic + ver + flags + nonce + payload_len) |
| GCM tag | 16 bytes |

**Note:** ghostd.py is NOT a WireGuard client. It is a separate custom VPN protocol. Standard `wg show` will not show ghostd tunnels. ghostd tunnels appear as `ghost0` / `utun*` interfaces.

---

## §5 — WireGuard Peer Delivery to Nodes

When a user's WG config is generated:
1. `wg_peer_commands` row created with `command = "wg set wg0 peer <pubkey> allowed-ips 10.8.0.X/32"`
2. Node daemon polls `GET /api/daemon-inbound/pending-peers` (PSK-authenticated)
3. Daemon applies `wg set` command
4. Daemon calls `POST /api/daemon-inbound/peer-ack` with `{ nodeId, commandId, success }`
5. `wg_peer_commands.status` updated to "applied"

---

## §6 — Missing WireGuard Integrations

| Gap | Impact |
|---|---|
| No WireGuard peer for honeypot decoy routing | Suspicious traffic cannot be transparently routed to the honeypot via WG policy |
| No per-peer traffic monitoring on nodes | Cannot detect VPN user anomaly at WG layer |
| Ghost Node deception peers not implemented | No fake WG peers exist to misdirect scanners |
| No mTLS verification on daemon-inbound | Node daemons authenticate via PSK only; no client certificate |
| WireGuard interface stats not exported | `wg show` output not piped back to API for dashboard display |

---

## §7 — Node Hardening for WireGuard (from scripts)

### `install-linux-hardened.sh` expects
- WireGuard installed: `apt install wireguard`
- Config at `/etc/wireguard/wg0.conf`
- Kill switch: nftables rules added to `/etc/nftables.conf`
- Service enabled: `systemctl enable wg-quick@wg0`

### `rotate-wireguard-keys.sh`
- Location: `standalone/scripts/rotate-wireguard-keys.sh`
- Does: generates new keypair, backs up old key, updates config, restarts wg-quick

### `generate-ca-and-mtls.sh`
- Generates 4096-bit CA + 3072-bit client cert for daemon mTLS
- Currently NOT used in production (daemon uses PSK-only auth — gap)

---

*© 2026 ALPHA UNLIMITED TECHNOLOGIES LLC — CONFIDENTIAL AUDIT*
