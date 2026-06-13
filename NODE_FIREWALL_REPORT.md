# NODE_FIREWALL_REPORT.md
**Generated:** 2026-06-13  
**Scope:** Firewall architecture — derived from repository code, scripts, and DB schema  
**Note:** Live iptables/nftables/ufw rule state on actual Vultr VMs cannot be read from Replit.

---

## §1 — Firewall Architecture Overview

ProxhqVPN implements three separate firewall layers:

| Layer | Where | Mechanism |
|---|---|---|
| Application firewall | API server (Express) | Blocked IPs table, rate limits, Clerk auth |
| WireGuard routing firewall | Node level | iptables FORWARD chain rules |
| OS host firewall | Vultr VM | ufw/iptables/nftables (deployed via scripts) |

---

## §2 — Application-Layer Firewall (from `routes/firewall.ts` + `lib/firewall-surface.ts`)

### Database tables
| Table | Purpose |
|---|---|
| `blocked_ips` | IP blocklist — auto-blocked by Ghost Trap, manual admin blocks |
| `firewall_rules` | Named inbound/outbound rules |
| `firewall_connection_queue` | Connection queue for rule enforcement |
| `firewall_traffic_decisions` | Per-IP traffic decision log |

### API endpoints
| Method | Route | Description |
|---|---|---|
| GET | /api/firewall/rules | List all firewall rules |
| POST | /api/firewall/rules | Create rule |
| DELETE | /api/firewall/rules/:id | Delete rule |
| GET | /api/firewall/blocklist | Get blocked IPs |
| POST | /api/firewall/block | Add IP to blocklist |
| DELETE | /api/firewall/block/:ip | Unblock IP |
| GET | /api/firewall/export | Export iptables ruleset |
| POST | /api/firewall/sync | Sync rules to nodes |
| GET | /api/firewall/node-hardening | Download node hardening script |

### Auto-blocking triggers
Ghost Trap probes (`ghosttrap.ts`) auto-block an attacker IP after `autoBlockAfter` probe hits (default: 5). This writes to `blocked_ips` table.

---

## §3 — WireGuard Firewall (from `routes/daemon-inbound.ts`)

### Firewall rule export for node daemons
Daemons poll `GET /api/daemon-inbound/firewall-rules` to fetch current rules.

**Rule structure delivered to nodes:**
```json
{
  "rules": [
    { "ip": "1.2.3.4", "action": "DROP", "reason": "ghost_trap_auto_block" },
    ...
  ],
  "suricataRules": "...",
  "ebpfRules": [...],
  "exportedAt": "...",
  "hash": "sha256-hash-of-ruleset"
}
```

### ATR (Adaptive Traffic Routing) safety constraint
**IMPORTANT:** The ATR/firewall sync code in `routes/daemon-inbound.ts` **never inserts rules into the WireGuard FORWARD chain** that could block VPN customer traffic. Firewall rules are applied to INPUT/OUTPUT chains only, or to a dedicated `PROXHQ_BLOCK` chain that is separate from the WireGuard `FORWARD` chain.

### Suricata IPS rules
`GET /api/daemon-inbound/suricata-rules` — exports Suricata alert/drop rules for IDS integration. Format: standard Suricata EVE/rule syntax.

### eBPF/XDP rules
`GET /api/daemon-inbound/ebpf-rules` — exports XDP rules for high-performance packet filtering at network driver level.

---

## §4 — OS Host Firewall (from `standalone/scripts/harden-ubuntu-stig.sh`)

### Expected state after hardening script runs

```bash
# UFW default policy
ufw default deny incoming
ufw default allow outgoing
ufw default deny forward

# Allowed inbound
ufw allow 22/tcp    # SSH (key-only)
ufw allow 51820/udp # WireGuard
ufw allow 80/tcp    # HTTP (if web node)
ufw allow 443/tcp   # HTTPS (if web node)

# Enabled
ufw enable
```

### sysctl network hardening (expected)
```
net.ipv4.ip_forward = 1            # Required for VPN routing
net.ipv4.conf.all.rp_filter = 1    # Reverse path filtering
net.ipv4.conf.default.rp_filter = 1
net.ipv4.tcp_syncookies = 1         # SYN flood protection
net.ipv4.conf.all.accept_redirects = 0
net.ipv4.conf.all.send_redirects = 0
net.ipv6.conf.all.accept_redirects = 0
net.ipv4.conf.all.accept_source_route = 0
net.ipv6.conf.all.accept_source_route = 0
kernel.randomize_va_space = 2      # ASLR
kernel.dmesg_restrict = 1
kernel.kptr_restrict = 2
```

---

## §5 — Firewall Rule Sync Protocol (from `daemon-inbound.ts`)

### Sync handshake
1. Node daemon calls `GET /api/daemon-inbound/firewall-rules` (PSK-authenticated)
2. API returns current ruleset + SHA-256 hash
3. Node applies rules, then calls `POST /api/daemon-inbound/fw-sync-ack` with `{ nodeId, hash, appliedAt }`
4. API updates `nodes.fwSyncedAt` and `nodes.fwSyncHash`

### Sync verification
The `nodes.fwSyncHash` field can be compared to the expected hash to detect:
- Nodes that haven't synced recently
- Nodes with stale/different rules
- Nodes that failed to apply the latest policy

---

## §6 — IPS Event Reporting (from `daemon-inbound.ts`)

Nodes report intrusion detection events via `POST /api/daemon-inbound/ips-event`:

```json
{
  "nodeId": 1,
  "sourceIp": "1.2.3.4",
  "destPort": 22,
  "protocol": "TCP",
  "signature": "SSH brute-force",
  "severity": "high",
  "action": "blocked",
  "raw": "..."
}
```

Events are stored and forwarded to SIEM.

---

## §7 — DDoS / Adaptive Response (from `daemon-inbound.ts`)

`POST /api/daemon-inbound/ddos-report` — nodes report DDoS patterns:
- Source IP/CIDRs
- PPS (packets per second)
- Bps (bytes per second)
- Attack type classification
- Rate-limit or block recommendation

---

## §8 — Gaps and Recommendations

| Gap | Severity | Detail |
|---|---|---|
| No `authorized_lab_target` gate on SQLmap | CRITICAL | silkweb.ts runs sqlmap against external attacker IPs — see NODE_SECURITY_GAPS.md |
| Auto-SQLmap in daemon-inbound honeypot-hit | CRITICAL | Lines 447-480 — automated outbound scanning against unknown IPs |
| No firewall rule validation on sync | HIGH | Node daemon accepts firewall ruleset without verifying API server identity (no mTLS client cert check) |
| No FORWARD chain isolation for honeypot | HIGH | Honeypot traffic and production WG traffic use same interface — decoy isolation not enforced at firewall layer |
| Vultr cloud firewall not managed | MEDIUM | Vultr-level firewall rules (separate from VM iptables) not automated |
| IPv6 kill switch incomplete | MEDIUM | IPv6 firewall rules generated in killswitch.ts but not pushed to node daemons |

---

*© 2026 ALPHA UNLIMITED TECHNOLOGIES LLC — CONFIDENTIAL AUDIT*
