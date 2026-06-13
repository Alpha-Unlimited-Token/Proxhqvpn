# FIREWALL_WIREGUARD_GHOST_WIRING.md
**ProxhqVPN — Firewall + WireGuard + Ghost Node Wiring Reference**
**Date:** 2026-06-13 | **Author:** Alpha Unlimited Technologies LLC

---

## Overview

This document describes how the real VPN WireGuard mesh (`wg0`), Ghost Node decoy interface (`wg-ghost0`), and host firewall work together to ensure complete traffic isolation.

---

## Network Interface Layout

```
┌────────────────────────────────────────────────────────┐
│  Vultr VPS                                              │
│                                                          │
│  eth0 (Internet)                                         │
│    │                                                     │
│    ├── wg0 (Production WireGuard, routing table 0)      │
│    │     └── Customer VPN tunnels                        │
│    │                                                     │
│    └── wg-ghost0 (Decoy WireGuard, routing table 100)   │
│          └── Attacker bait traffic → Ghost Trap engine  │
│                                                          │
│  RULE: wg-ghost0 ←X→ wg0 (hard DROP in nftables)      │
└────────────────────────────────────────────────────────┘
```

---

## nftables Isolation Rules

```nft
#!/usr/sbin/nft -f

table ip proxhq_isolation {

  # ── Chain: forward — block ghost <→ real traffic ─────
  chain forward {
    type filter hook forward priority 0;
    policy accept;

    # Block all traffic from ghost interface to real VPN
    iifname "wg-ghost0" oifname "wg0"  drop comment "ghost→real blocked";
    iifname "wg0"       oifname "wg-ghost0" drop comment "real→ghost blocked";

    # Block ghost from reaching LAN/management
    iifname "wg-ghost0" oifname "eth0"  drop comment "ghost→internet direct blocked";

    # Allow ghost only to loopback (Ghost Trap engine is local)
    iifname "wg-ghost0" ip daddr 127.0.0.1 accept comment "ghost→trap engine allowed";
  }

  # ── Chain: input — rate limit ghost connections ───────
  chain input {
    type filter hook input priority 0;
    policy accept;

    # Rate limit inbound on ghost WireGuard port
    iifname "eth0" udp dport 51821 limit rate 100/second burst 200 packets accept;
    iifname "eth0" udp dport 51821 drop comment "ghost port rate limited";
  }

  # ── Chain: output — block ghost from making outbound connections ──
  chain output {
    type filter hook output priority 0;
    policy accept;

    # Block outbound TCP/UDP from ghost interface (tarpitting only, no responses that escape)
    oifname "wg-ghost0" ip protocol tcp reject comment "no outbound TCP from ghost";
    oifname "wg-ghost0" ip protocol udp drop  comment "no outbound UDP from ghost";
  }
}
```

---

## WireGuard Interface Configuration

### Production Interface (wg0)
```ini
[Interface]
Address = 10.8.0.1/24
ListenPort = 51820
PrivateKey = <stored in /dev/shm/proxhqvpn/wg0.key — RAM only>
Table = off   # ProxhqVPN manages routing manually

PostUp = ip rule add from 10.8.0.0/24 table 200
PostUp = ip route add default via <gateway> table 200
PostDown = ip rule del from 10.8.0.0/24 table 200
```

### Ghost Decoy Interface (wg-ghost0)
```ini
[Interface]
# Decoy interface — NOT connected to any real peer
Address = 10.99.0.1/24
ListenPort = 51821            # Different port from production wg0
PrivateKey = <random 32 bytes, not a real key>
Table = 100                   # Isolated routing table — no default route
DNS = 127.0.0.1               # DNS points only to local (no external DNS from ghost)

# No [Peer] sections — ghost accepts handshakes and logs them, never forwards
```

---

## iptables Alternative (if nftables not available)

```bash
# Block ghost → real forwarding
iptables -I FORWARD -i wg-ghost0 -o wg0    -j DROP
iptables -I FORWARD -i wg0     -o wg-ghost0 -j DROP
iptables -I FORWARD -i wg-ghost0 -o eth0    -j DROP

# Log ghost inbound for monitoring
iptables -I INPUT -i eth0 -p udp --dport 51821 -j LOG --log-prefix "GHOST-INBOUND: "
iptables -I INPUT -i eth0 -p tcp --dport 80    -j LOG --log-prefix "GHOST-HTTP: "

# ATR rule: NEVER block WireGuard FORWARD chain
# The ATR (Automated Threat Response) system must never insert DROP rules
# that match dport 51820 in the FORWARD chain — this would break customer VPN tunnels.
# ATR rules must only target the INPUT chain or specific source IPs.
```

---

## Ghost Trap → Firewall Integration

When Ghost Trap auto-blocks an attacker IP, it writes to `ghost_blocked_sources`. The node daemon reads this and applies:

```bash
# Block single IP
nft add rule ip proxhq_isolation input ip saddr <attacker_ip> drop

# Block CIDR range
nft add rule ip proxhq_isolation input ip saddr <cidr> drop

# For iptables:
iptables -I INPUT -s <attacker_ip> -j DROP
```

---

## Policy Push Flow

```
Dashboard (admin)
    │
    └── POST /api/ghost-nodes/:id/policies  (create policy)
            │
            └── ghostNodePolicyService.createPolicy()
                    │
                    └── POST /api/daemon-inbound/ghost-policy  (daemon callback)
                            │
                            └── Node daemon receives policy JSON
                                    │
                                    ├── Updates nftables decoy rules
                                    ├── Updates wg-ghost0 config
                                    └── Acknowledges via heartbeat
```

---

## Security Invariants

| Invariant | Enforcement |
|-----------|------------|
| wg-ghost0 cannot reach wg0 | nftables FORWARD DROP rule |
| wg-ghost0 cannot make outbound TCP | nftables OUTPUT REJECT |
| Ghost node cannot reach customer VPN IPs | Routing table isolation (table 100 has no route to 10.8.0.0/24) |
| ATR never blocks wg0 FORWARD | Code comment + monitoring alert if iptables rule matches port 51820 FORWARD |
| Ghost WireGuard keys are NOT real keys | Generated as `crypto.randomBytes(32)` — not valid Curve25519 key pairs |
