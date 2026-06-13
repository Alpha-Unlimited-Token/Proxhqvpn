# VULTR_NODE_INTEGRATION_REPORT.md
**Generated:** 2026-06-13  
**Scope:** Complete audit of Vultr node integration — what exists, what is required

---

## §1 — Current Vultr Integration Status

**VERDICT: NOT INTEGRATED**

Vultr is mentioned exactly once in the codebase as an ASN org string in a regex pattern:

```typescript
// artifacts/api-server/src/routes/ghosttrap.ts line 38
const DATACENTER_ORG_PATTERNS = [
  /vultr/i,  // ← only occurrence of "vultr" in all .ts/.tsx files
  ...
];
```

This is an IP classification regex used to identify when a probe comes from a Vultr datacenter IP range. It has nothing to do with managing Vultr nodes.

---

## §2 — What Does Not Exist

| Capability | Status |
|---|---|
| Vultr API client (`api.vultr.com/v2`) | ❌ NONE |
| Vultr API key config (`VULTR_API_KEY`) | ❌ NONE |
| Vultr instance creation on node provisioning | ❌ NONE |
| Vultr cloud firewall management | ❌ NONE |
| Vultr instance health check | ❌ NONE |
| Vultr region list from API | ❌ NONE |
| Vultr snapshot/backup | ❌ NONE |
| `vultr_node_deception_state` DB table | ❌ NONE |
| Vultr-specific node deployment automation | ❌ NONE |
| Ansible inventory for Vultr nodes | ❌ NONE |

---

## §3 — How Nodes Are Currently Managed

### Node provisioning (code-level, not infrastructure)
1. Admin calls `POST /api/node-provision/` with node metadata (name, region, layer, etc.)
2. A row is inserted into the `nodes` DB table
3. A WireGuard keypair is generated and stored encrypted in `nodes.privateKey`
4. A `daemonSecret` (HMAC key) is generated and stored in `nodes.daemon_secret`
5. The node's IP, public key, and listen port are set manually

**This only creates a DB record.** It does NOT:
- Create a Vultr VPS
- Configure the OS
- Install WireGuard
- Start any services

### Manual provisioning flow (expected based on scripts)
```
Admin:
  1. Create Vultr VPS manually (dashboard or API)
  2. Note the public IP
  3. Run: ssh root@<ip> "bash <(curl -s install-linux-hardened.sh)"
  4. Configure WireGuard manually or via rotate-wireguard-keys.sh
  5. Start ghostd.py daemon
  6. Call POST /api/node-provision/ to register in DB
  7. Call POST /api/node-agent/checkin via the running agent
```

---

## §4 — Node Inventory (What the DB Schema Can Tell Us)

The `nodes` table is the authoritative record of all VPN nodes. Key fields relevant to Vultr:

| Field | Vultr equivalent | Notes |
|---|---|---|
| name | Instance label | e.g. "LA-1", "London-3" |
| region | Vultr region | e.g. "ewr" (New Jersey), "lhr" (London), "lax" (Los Angeles) |
| public_ip | Instance main IP | External Vultr IPv4 |
| status | Instance power state | "active" ≠ Vultr running (no sync) |
| last_seen | node_agent lastSeenAt | Last agent check-in time |
| ram_key_loaded | Not in Vultr | Tracks RAM-only key state |

**Drift risk:** `nodes.status = "active"` does not mean the Vultr VPS is actually running. If a Vultr VM is powered off, deleted, or migrated, the DB will still show "active" until the node agent stops checking in.

---

## §5 — Identified Vultr Nodes (From Repository Context)

Based on replit.md documentation, 4 nodes have confirmed RAM-only key architecture and are active:

| Region | Layer | Vultr Region Code (inferred) |
|---|---|---|
| Los Angeles, CA | outer | lax |
| London, UK | outer | lhr |
| Chicago, IL | outer | ord |
| Tokyo, Japan | outer | nrt |

Total planned: 60 nodes (50 outer + 10 inner). Actual live count: unknown without live DB query.

To get live count: `SELECT count(*), status FROM nodes GROUP BY status;` via `/sql`.

---

## §6 — Standalone Honeypot Nodes

The honeypot infrastructure is documented in `standalone/honeypot/`:

| File | Content |
|---|---|
| `ansible/deploy-honeypot.yml` | Ansible playbook — deploys Cowrie + Suricata + relay agent |
| `ansible/inventory.ini.example` | Example inventory (fill in actual IPs) |
| `configs/cowrie.cfg` | Cowrie SSH honeypot config |
| `configs/cowrie-userdb.txt` | Accepted credential pairs |
| `configs/wireguard-honeypot.conf` | WireGuard config for isolated honeypot network |
| `scripts/relay_agent.py` | Ships Cowrie + Suricata events to `/api/honeypot/ingest` |
| `docker-compose.yml` | Docker: Cowrie + Suricata + relay agent |

**Relay agent auth:** `PROXHQ_API_URL` + `HONEYPOT_PSK` + `HONEYPOT_NODE_NAME`

Honeypot nodes are separate VMs from VPN nodes — they run Cowrie (fake SSH) and Suricata (IDS), not WireGuard.

---

## §7 — Required Vultr Integration (Recommended for Implementation Phase)

### Minimum viable integration

| Feature | Endpoint | Secret needed |
|---|---|---|
| List instances | GET https://api.vultr.com/v2/instances | VULTR_API_KEY |
| Check instance health | GET https://api.vultr.com/v2/instances/:id | VULTR_API_KEY |
| Get instance IP | GET https://api.vultr.com/v2/instances/:id | VULTR_API_KEY |
| List firewall rules | GET https://api.vultr.com/v2/firewalls | VULTR_API_KEY |
| Update firewall | PUT https://api.vultr.com/v2/firewalls/:id/rules | VULTR_API_KEY |

### Sync architecture
Add a `vultr_instance_id` column to `nodes` table. Periodically reconcile:
- `nodes.status` ↔ Vultr instance power state
- `nodes.public_ip` ↔ Vultr instance main_ip
- `nodes.last_seen` ↔ most recent node_agent checkin

### New env var required
```
VULTR_API_KEY=[TOKEN_REDACTED]
```

### New backend route
```
GET /api/nodes/vultr-sync — reconcile DB with live Vultr instance state (admin only)
```

---

## §8 — `vultr_node_deception_state` Table (Required for Ghost Node)

If Ghost Nodes are implemented, Vultr-specific deception state would be tracked here:

```sql
CREATE TABLE vultr_node_deception_state (
  id              SERIAL PRIMARY KEY,
  vultr_instance_id TEXT,           -- Vultr instance ID (from API)
  node_id         INTEGER REFERENCES nodes(id),
  ghost_node_id   INTEGER REFERENCES ghost_nodes(id),
  decoy_enabled   BOOLEAN DEFAULT false,
  decoy_interface TEXT,             -- e.g. "wg-ghost0"
  last_policy_push TIMESTAMPTZ,
  policy_hash     TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);
```

---

*© 2026 ALPHA UNLIMITED TECHNOLOGIES LLC — CONFIDENTIAL AUDIT*
