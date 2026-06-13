# NODE_INVENTORY_REPORT.md
**Generated:** 2026-06-13  
**Scope:** ProxhqVPN server node inventory — derived from repository code, DB schema, and scripts  
**Important:** This report is code-derived. Replit does not have SSH access to Vultr VMs. Live server state (running processes, actual installed packages, real key material) cannot be verified from here. All "installed" rows describe what the codebase *expects* or *deploys*, not confirmed live state.

---

## §1 — Node Architecture (from DB schema `lib/db/src/schema/nodes.ts`)

```
nodeLayerEnum  : "outer" | "inner"
nodeStatusEnum : "active" | "inactive" | "rotating" | "trapped"
```

| Column | Type | Notes |
|---|---|---|
| id | serial PK | DB row ID |
| name | text | Human label (e.g. "LA-1") |
| layer | enum | outer (50 nodes) / inner (10 nodes) |
| hopIndex | integer | Index within layer (routing order) |
| region | text | e.g. "Los Angeles, CA" / "London, UK" |
| ipAddress | text | VPN-internal IP (10.x.x.x / 172.16.x.x) |
| publicKey | text | WireGuard public key |
| privateKey | text | WireGuard private key — AES-256-GCM encrypted at rest |
| listenPort | integer | WireGuard UDP listen port |
| status | enum | active / inactive / rotating / trapped |
| hasBeacon | boolean | Beacon module enabled |
| hasSpider | boolean | Spider module enabled |
| hasWorm | boolean | Worm module enabled |
| publicIp | text | External public IP (nullable) |
| latencyMs | real | Last measured latency |
| fwSyncedAt | timestamp | Last firewall rule sync |
| fwSyncHash | text | SHA of last synced firewall ruleset |
| ramKeyLoaded | boolean | RAM-only WireGuard key loaded flag |
| ramKeyCheckedAt | timestamp | Last RAM key check |
| wgBaseConfClean | boolean | WireGuard base config clean flag |
| daemonSecret | text | Per-node HMAC shared secret (hex) |
| createdAt | timestamp | Row creation time |

**Planned architecture:** 60-node WireGuard mesh (50 outer + 10 inner). 4 nodes have RAM-only keys (LA/London/Chicago/Tokyo per replit.md).

---

## §2 — Node Agent Check-in System (from `routes/node-agent.ts`)

Nodes are expected to run a Parrot OS agent that calls back to the API server via PSK-authenticated HTTP.

### Enrollment Flow
```
Node agent → POST /api/node-agent/checkin
             x-node-agent-psk: ${NODE_AGENT_PSK}
             body: { nodeId, nodeName, version, ip, os, arch, tools[], cpuPct, memPct, diskMb, event? }

             → upsert into node_agent_health
             → insert into node_agent_events (if event included)
```

### Expected agent-reported fields
| Field | Description |
|---|---|
| nodeId | Unique node identifier string |
| nodeName | Human-readable label |
| version | Agent software version |
| ip | Node's external IP |
| os | OS string (e.g. "Parrot OS 6.1 / Linux 6.6.9") |
| arch | CPU architecture |
| tools | Array of installed tool names |
| cpuPct | CPU utilization % |
| memPct | Memory utilization % |
| diskMb | Disk used MB |

---

## §3 — Node Agent DB Tables (from `lib/db/src/schema/tool-library.ts`)

### `node_agent_health`
| Column | Type | Notes |
|---|---|---|
| nodeId | text PK | Unique node identifier |
| nodeName | text | Human label |
| version | text | Agent version |
| ip | text | Public IP |
| os | text | OS string |
| arch | text | Architecture |
| toolsJson | jsonb | Tools array |
| cpuPct | real | CPU % |
| memPct | real | Memory % |
| diskMb | integer | Disk MB |
| status | text | "active" / "inactive" |
| lastSeenAt | timestamp | Last check-in |

### `node_agent_events`
| Column | Type | Notes |
|---|---|---|
| id | serial PK | |
| nodeId | text FK→node_agent_health | |
| eventType | text | Event category |
| payloadJson | jsonb | Event data |
| createdAt | timestamp | |

---

## §4 — Standalone Daemon (ghostd.py)

**Location:** `standalone/ghostd.py`  
**Version:** 2.0.0  
**Protocol magic:** `GHNT` (0x47 0x48 0x4E 0x54)  
**Protocol version:** 0x02  
**Local REST API:** `http://127.0.0.1:7475`  

### Capabilities
| Feature | Status |
|---|---|
| TUN interface (Linux ghost0 / macOS utun / Windows WinTun) | ✅ Implemented |
| AES-256-GCM encryption | ✅ Implemented |
| X25519 ECDH key exchange + HKDF-SHA256 | ✅ Implemented |
| Per-packet random nonce (replay-safe) | ✅ Implemented |
| Kill switch (iptables / pf / netsh WFP) | ✅ Implemented |
| DNS leak prevention | ✅ Implemented |
| Split tunneling via routing tables | ✅ Implemented |
| Multi-peer round-robin / failover | ✅ Implemented |
| Server / client / local (Tor SOCKS5) modes | ✅ Implemented |
| Structured audit log | ✅ Implemented |

**TUN config:** `ghost0` interface, `10.99.0.0/24`, MTU 1500  
**DNS:** Cloudflare 1.1.1.1 + Quad9 9.9.9.9

---

## §5 — Node Provisioning (from `routes/node-provision.ts` and `routes/node-enroll-v2.ts`)

### Provisioning endpoints
| Method | Path | Description |
|---|---|---|
| POST | /api/node-provision/ | Create node record in DB, generate daemon secret |
| GET | /api/node-provision/status/:nodeId | Retrieve provisioned node status |
| POST | /api/node-enroll-v2/tokens | Generate enrollment token (admin) |
| GET | /api/node-enroll-v2/tokens | List active enrollment tokens |
| POST | /api/node-enroll-v2/claim | Node claims token to self-enroll |

---

## §6 — Honeypot Nodes (from `routes/honeypot.ts` + standalone)

### Standalone honeypot setup
| Component | File | Purpose |
|---|---|---|
| Cowrie SSH honeypot | `standalone/honeypot/configs/cowrie.cfg` | Fake SSH service, captures commands |
| Cowrie user DB | `standalone/honeypot/configs/cowrie-userdb.txt` | Accepted usernames/passwords |
| Suricata IDS | (docker-compose.yml) | Network intrusion detection |
| WireGuard honeypot | `standalone/honeypot/configs/wireguard-honeypot.conf` | Isolated WG interface for honeypot |
| Relay agent | `standalone/honeypot/scripts/relay_agent.py` | Ships Cowrie+Suricata events to `/api/honeypot/ingest` |
| Ansible deploy | `standalone/honeypot/ansible/deploy-honeypot.yml` | Automated deployment playbook |

### Relay agent auth
- `PROXHQ_API_URL` env var
- `HONEYPOT_PSK` env var → sent as `X-Honeypot-PSK` header
- `HONEYPOT_NODE_NAME` env var

---

## §7 — Known Region Configuration (from node data patterns in code)

RAM-only key nodes explicitly documented in replit.md:
| Region | Layer | RAM Keys |
|---|---|---|
| Los Angeles, CA | outer | ✅ |
| London, UK | outer | ✅ |
| Chicago, IL | outer | ✅ |
| Tokyo, Japan | outer | ✅ |

Full 60-node inventory is in the PostgreSQL `nodes` table. To export: run `SELECT id, name, layer, region, status, public_ip, ram_key_loaded, last_seen FROM nodes ORDER BY layer, hop_index;` via `/sql` interface (admin only).

---

## §8 — What Cannot Be Reported From Replit

The following require direct SSH access to Vultr VMs and CANNOT be verified from this repository:

- Actual OS distro/version and kernel on running nodes  
- What packages are actually installed vs expected  
- Live firewall rule state (iptables/nftables/ufw)  
- Live systemd service status  
- Whether daemon is actually running  
- Live WireGuard peer status (`wg show`)  
- Disk usage, real CPU/memory  
- SSH authorized_keys content  
- Audit log state  
- Whether fail2ban is active  
- Network interface assignments  

To collect live data, deploy the node agent on each Vultr VM and check `/api/node-agent/nodes` (admin endpoint).

---

*© 2026 ALPHA UNLIMITED TECHNOLOGIES LLC — CONFIDENTIAL AUDIT*
