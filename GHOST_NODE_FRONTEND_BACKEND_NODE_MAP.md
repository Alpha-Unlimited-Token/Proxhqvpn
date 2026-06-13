# GHOST_NODE_FRONTEND_BACKEND_NODE_MAP.md
**Generated:** 2026-06-13  
**Scope:** Complete map of Ghost Node across every layer — what exists vs. what is needed

---

## §1 — Current State

**Ghost Node does not exist in the codebase.** The following table documents every layer and what was found:

| Layer | Expected Component | Found | File |
|---|---|---|---|
| Frontend page | `/ghost-nodes` dashboard | ❌ NONE | — |
| Frontend route registration | `<Route path="/ghost-nodes">` | ❌ NONE | — |
| Frontend nav link | Sidebar entry "Ghost Nodes" | ❌ NONE | — |
| Frontend status cards | Active decoys, trapped sessions | ❌ NONE | — |
| Frontend event timeline | Ghost Node interaction feed | ❌ NONE | — |
| Frontend controls | Enable/disable, quarantine, export | ❌ NONE | — |
| Backend route file | `ghost-node.ts` | ❌ NONE | — |
| Backend route: GET /api/ghost-nodes | List all ghost nodes | ❌ NONE | — |
| Backend route: GET /api/ghost-nodes/:id | Get single ghost node | ❌ NONE | — |
| Backend route: POST /api/ghost-nodes/:id/enable | Enable ghost node | ❌ NONE | — |
| Backend route: POST /api/ghost-nodes/:id/disable | Disable ghost node | ❌ NONE | — |
| Backend route: GET /api/ghost-nodes/:id/events | Node interaction events | ❌ NONE | — |
| Backend service layer | ghostNodeService | ❌ NONE | — |
| Backend service layer | ghostNodeRoutingService | ❌ NONE | — |
| DB table | ghost_nodes | ❌ NONE | — |
| DB table | ghost_node_events | ❌ NONE | — |
| DB table | ghost_node_routes | ❌ NONE | — |
| DB table | vultr_node_deception_state | ❌ NONE | — |
| Daemon policy | Ghost node config delivery | ❌ NONE | — |
| WireGuard | Decoy WG peers | ❌ NONE | — |
| WireGuard | Isolated ghost interface (wg-ghost0) | ❌ NONE | — |
| Firewall | Routing suspicious IPs to ghost nodes | ❌ NONE | — |
| SIEM | Ghost Node interaction events | ❌ NONE | — |

---

## §2 — What Ghost Node Must Do (Specification)

### Concept
A Ghost Node is a **fake/decoy VPN node** that does not serve real customer traffic. It exists to:
1. Present convincing but false WireGuard endpoint data to reconnaissance scanners
2. Accept connections from attackers/scanners without routing their traffic to the internet
3. Log all interaction metadata (connection attempts, WG handshake data, probe patterns)
4. Feed events to the SIEM and security dashboard
5. Stay completely isolated from the production VPN mesh

### Ghost Node lifecycle
```
Admin creates ghost node → 
  DB record in ghost_nodes (fake IP, fake WG public key, fake region, deception_mode) →
  Policy pushed to real node daemon via /api/daemon-inbound/ghost-policy →
  Real node starts responding to WG probes on behalf of the ghost node →
  Attacker tries to connect → connection logged → 
  ghost_node_events record created →
  SIEM event published →
  Optional: auto-trap into SilkWeb if attacker probes repeatedly
```

### Required Ghost Node states
| State | Meaning |
|---|---|
| active | Responding to probes, logging interactions |
| inactive | Not responding (hidden) |
| quarantined | Admin-locked, not responding, evidence preserved |
| compromised | Attacker made too many attempts — escalated to SilkWeb |

---

## §3 — Required DB Schema (to be created in implementation phase)

### `ghost_nodes` table
```sql
CREATE TABLE ghost_nodes (
  id              SERIAL PRIMARY KEY,
  name            TEXT NOT NULL,          -- e.g. "Ghost-LA-1"
  fake_region     TEXT NOT NULL,          -- e.g. "Los Angeles, CA"
  fake_ip         TEXT NOT NULL,          -- decoy public IP
  fake_port       INTEGER NOT NULL DEFAULT 51820,
  fake_public_key TEXT NOT NULL,          -- fake WG public key
  status          TEXT NOT NULL DEFAULT 'active',  -- active|inactive|quarantined|compromised
  deception_mode  TEXT NOT NULL DEFAULT 'wg_decoy', -- wg_decoy|http_decoy|ssh_decoy
  host_node_id    INTEGER REFERENCES nodes(id),    -- which real node hosts this ghost
  probe_count     INTEGER NOT NULL DEFAULT 0,
  last_probe_at   TIMESTAMPTZ,
  created_by      TEXT NOT NULL,          -- Clerk userId
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### `ghost_node_events` table
```sql
CREATE TABLE ghost_node_events (
  id              SERIAL PRIMARY KEY,
  ghost_node_id   INTEGER REFERENCES ghost_nodes(id),
  attacker_ip     TEXT NOT NULL,
  event_type      TEXT NOT NULL,  -- wg_probe|http_probe|ssh_probe|connection_attempt|handshake_attempt
  raw_data        TEXT,
  geo_country     TEXT,
  geo_isp         TEXT,
  vpn_detected    BOOLEAN DEFAULT false,
  tor_detected    BOOLEAN DEFAULT false,
  hop_chain       TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### `ghost_node_routes` table
```sql
CREATE TABLE ghost_node_routes (
  id              SERIAL PRIMARY KEY,
  ghost_node_id   INTEGER REFERENCES ghost_nodes(id),
  host_node_id    INTEGER REFERENCES nodes(id),
  routing_rule    TEXT NOT NULL,  -- iptables/nftables rule to install on host
  status          TEXT NOT NULL DEFAULT 'pending',  -- pending|applied|failed
  applied_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

## §4 — Required Backend Routes

```
GET    /api/ghost-nodes             List all ghost nodes (security_admin+)
POST   /api/ghost-nodes             Create ghost node (owner only)
GET    /api/ghost-nodes/:id         Get ghost node detail
PATCH  /api/ghost-nodes/:id         Update ghost node config
DELETE /api/ghost-nodes/:id         Delete ghost node
POST   /api/ghost-nodes/:id/enable  Enable ghost node
POST   /api/ghost-nodes/:id/disable Disable ghost node
POST   /api/ghost-nodes/:id/quarantine Quarantine ghost node
GET    /api/ghost-nodes/:id/events  List interaction events
POST   /api/ghost-nodes/:id/export-evidence Export events as ZIP
```

---

## §5 — Required Daemon-Inbound Endpoint

```
GET /api/daemon-inbound/ghost-policy
```
Node daemon polls this to receive the ghost node configuration for its hosted ghost nodes. Returns:
```json
{
  "ghostNodes": [
    {
      "ghostNodeId": 1,
      "fakeIp": "...",
      "fakePort": 51820,
      "fakePublicKey": "...",
      "deceptionMode": "wg_decoy"
    }
  ]
}
```

```
POST /api/daemon-inbound/ghost-event
```
Node daemon reports when a probe was received by a ghost node.

---

## §6 — Required Frontend

**Route:** `/ghost-nodes` (CommandCenter tier — security_admin+ only)

**Components needed:**
- Ghost node grid (status card per ghost node)
- Event timeline (recent attacker probes)
- Create ghost node modal (fake region, fake IP, fake port, host node selection)
- Evidence export button
- Quarantine button

---

*© 2026 ALPHA UNLIMITED TECHNOLOGIES LLC — CONFIDENTIAL AUDIT*
