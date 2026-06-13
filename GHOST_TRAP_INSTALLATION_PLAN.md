# GHOST_TRAP_INSTALLATION_PLAN.md
**ProxhqVPN Ghost Trap — Defensive Honeypot Installation Plan**
**Date:** 2026-06-13 | **Author:** Alpha Unlimited Technologies LLC

---

## Overview

Ghost Trap is a **purely defensive** honeypot system that:
- Captures attacker request metadata
- Logs evidence with chain-of-custody SHA-256 hashes
- Tarpits attackers (deliberate delays to waste their time)
- Tracks attacker hop chains (VPN/proxy detection)
- Feeds SIEM with structured security events
- **Never** retaliates or scans attacker systems

---

## Ghost Trap Components

| Component | Purpose |
|-----------|---------|
| Lure endpoints | Fake login, admin panel, API, .env endpoints |
| Beacon pixels | 1×1 GIF with tracking ID to detect browser execution |
| Labyrinth engine | Multi-stage fake dashboard that loops infinitely |
| Tarpit drain | Escalating connection delays |
| Evidence exporter | SHA-256 signed JSON evidence bundles |
| Block source | IP/CIDR firewall insertion |
| SIEM fanout | Real-time event shipping to Splunk/webhook |

---

## Step 1: Enable Ghost Trap for Your Account

1. Navigate to `/ghost-trap` (VPN Basic tier or higher)
2. Click **Enable Ghost Trap**
3. Choose device mode:
   - **Personal mode**: enter your public IP — Ghost Trap monitors probes from that IP's vicinity
   - **Server mode**: enter your domain — Ghost Trap monitors inbound probes to your server

---

## Step 2: Deploy Lure URLs

Ghost Trap provides honeypot URLs you can embed anywhere attackers look:

```
# Platform lure endpoints (ready to use):
https://your-api-domain/api/ghost-trap/lure/login
https://your-api-domain/api/ghost-trap/lure/admin
https://your-api-domain/api/ghost-trap/lure/wp-admin
https://your-api-domain/api/ghost-trap/lure/.env
https://your-api-domain/api/ghost-trap/lure/backup.sql

# Per-user attributed lures (tracked to your account):
https://your-api-domain/api/ghost-trap/u/<your_token>/lure/login
```

**Deployment locations:**
- Paste lure URLs in `robots.txt` under Disallow entries
- Add to fake sitemap.xml
- Plant in `.git/config` as fake remote URLs
- Embed in fake documentation files

---

## Step 3: Configure Detection Rules

1. Navigate to `/ghost-trap` → **Rules** tab
2. Add rules:

| Rule Type | Pattern Example | Action |
|-----------|-----------------|--------|
| `path_pattern` | `/wp-admin` | `tarpit` |
| `ua_pattern` | `sqlmap` | `block` |
| `ua_pattern` | `Nikto` | `silk_trap` |
| `ip_cidr` | `185.220.101.0/24` | `block` |
| `header_pattern` | `X-Scanner` | `silk_trap` |

---

## Step 4: Set Up SIEM Integration

```bash
# In api-server environment:
SPLUNK_HEC_URL=https://your-splunk:8088/services/collector
SPLUNK_HEC_TOKEN=your-token
SIEM_WEBHOOK_URL=https://your-webhook-endpoint
```

Ghost Trap will automatically ship `high` and `critical` events to SIEM.

---

## Step 5: Evidence Workflow

When Ghost Trap captures an attacker:

1. Probes appear in **Ghost Trap → Probes** tab
2. Click on an attacker IP → **Generate Evidence Bundle**
3. Evidence bundle is exported as signed JSON:
   - All probes from that IP
   - All loop sessions
   - All beacon fires
   - SHA-256 hash (chain of custody)
4. Download the bundle for law enforcement / abuse team filing

---

## Step 6: Block Attacker Sources

From `/ghost-trap`:
1. Click an attacker IP → **Block Source**
2. Choose: IP block (single) or CIDR block (subnet)
3. Choose: Temporary (expiry) or Permanent
4. The IP is added to `ghost_blocked_sources` table
5. On next Ghost Trap probe from that IP, it is immediately rejected

---

## Tarpit Configuration

| Setting | Default | Recommended |
|---------|---------|-------------|
| `tarpitMinMs` | 1500 | 2000 |
| `tarpitMaxMs` | 8000 | 15000 |
| `autoBlockAfter` | 5 | 3 (aggressive) |
| `silkTrapAfter` | 3 | 2 |

---

## What Ghost Trap Does NOT Do

- ❌ Does NOT scan attacker systems
- ❌ Does NOT run SQLmap against attacker IPs
- ❌ Does NOT execute OS commands on remote hosts
- ❌ Does NOT send data to attacker systems (only receives)
- ❌ Does NOT store PII beyond IP + User-Agent

---

## Privacy Notes

- Attacker IPs are displayed partially redacted in the UI (`x.x.x.***` format)
- Full IPs are stored in DB for evidence and SIEM purposes
- Evidence bundles are only accessible to the user who created them + admins
- Ghost Trap events auto-expire after 90 days (configurable)
