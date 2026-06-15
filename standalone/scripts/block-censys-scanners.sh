#!/bin/bash
  # ============================================================
  # ProxhqVPN — Censys Scanner Hard Block Script
  # Generated: 2026-06-15T03:35:19.601Z
  # Copyright © 2026 Alpha Unlimited Technologies LLC
  # ============================================================
  # Apply on ALL FOUR nodes:
  #   GhostNode-OUT-01-2126  66.42.121.25    NL-Amsterdam
  #   GhostNode-OUT-01-0977  108.61.219.202  NL-Amsterdam
  #   GhostNode-OUT-01-7E2D  45.76.97.51     NL-Amsterdam
  #   GhostNode-OUT-04-D063  192.248.160.69  JP-Osaka
  #
  # Run as root. Persisted via iptables-persistent / netfilter-persistent.
  # ============================================================

  set -euo pipefail

  echo "[*] ProxhqVPN — Censys hard-block applying..."
  echo "[*] 2026-06-15T03:35:19.601Z"

  # ── Create dedicated chain ───────────────────────────────────
  iptables  -N CENSYS_BLOCK 2>/dev/null || iptables  -F CENSYS_BLOCK
  ip6tables -N CENSYS_BLOCK 2>/dev/null || ip6tables -F CENSYS_BLOCK

  # ── Hook chain into INPUT and FORWARD ───────────────────────
  iptables  -C INPUT   -j CENSYS_BLOCK 2>/dev/null || iptables  -I INPUT   1 -j CENSYS_BLOCK
  iptables  -C FORWARD -j CENSYS_BLOCK 2>/dev/null || iptables  -I FORWARD 1 -j CENSYS_BLOCK
  ip6tables -C INPUT   -j CENSYS_BLOCK 2>/dev/null || ip6tables -I INPUT   1 -j CENSYS_BLOCK
  ip6tables -C FORWARD -j CENSYS_BLOCK 2>/dev/null || ip6tables -I FORWARD 1 -j CENSYS_BLOCK

  # ── Block Censys UA via string match (HTTP only) ─────────────
  iptables -C INPUT -m string --string "CensysInspect" --algo bm -j DROP 2>/dev/null || \
    iptables -A INPUT -m string --string "CensysInspect" --algo bm -j DROP
  iptables -C FORWARD -m string --string "CensysInspect" --algo bm -j DROP 2>/dev/null || \
    iptables -A FORWARD -m string --string "CensysInspect" --algo bm -j DROP

  # ── IPv4 Censys subnet blocks ────────────────────────────────
  iptables  -A CENSYS_BLOCK -s 66.132.159.0/24 -j DROP -m comment --comment "Censys-scanner"
iptables  -A CENSYS_BLOCK -s 66.132.148.0/24 -j DROP -m comment --comment "Censys-scanner"
iptables  -A CENSYS_BLOCK -s 66.132.153.0/24 -j DROP -m comment --comment "Censys-scanner"
iptables  -A CENSYS_BLOCK -s 66.132.224.0/24 -j DROP -m comment --comment "Censys-scanner"
iptables  -A CENSYS_BLOCK -s 66.132.186.0/24 -j DROP -m comment --comment "Censys-scanner"
iptables  -A CENSYS_BLOCK -s 66.132.195.0/24 -j DROP -m comment --comment "Censys-scanner"
iptables  -A CENSYS_BLOCK -s 66.132.172.0/24 -j DROP -m comment --comment "Censys-scanner"
iptables  -A CENSYS_BLOCK -s 162.142.125.0/24 -j DROP -m comment --comment "Censys-scanner"
iptables  -A CENSYS_BLOCK -s 167.94.138.0/24 -j DROP -m comment --comment "Censys-scanner"
iptables  -A CENSYS_BLOCK -s 167.94.145.0/24 -j DROP -m comment --comment "Censys-scanner"
iptables  -A CENSYS_BLOCK -s 167.94.146.0/24 -j DROP -m comment --comment "Censys-scanner"
iptables  -A CENSYS_BLOCK -s 167.248.133.0/24 -j DROP -m comment --comment "Censys-scanner"
iptables  -A CENSYS_BLOCK -s 199.45.154.0/24 -j DROP -m comment --comment "Censys-scanner"
iptables  -A CENSYS_BLOCK -s 199.45.155.0/24 -j DROP -m comment --comment "Censys-scanner"
iptables  -A CENSYS_BLOCK -s 206.168.34.0/24 -j DROP -m comment --comment "Censys-scanner"
iptables  -A CENSYS_BLOCK -s 206.168.35.0/24 -j DROP -m comment --comment "Censys-scanner"

  # ── IPv6 Censys subnet blocks ────────────────────────────────
  ip6tables -A CENSYS_BLOCK -s 2602:80d:1000:b0cc:e::/80 -j DROP -m comment --comment "Censys-scanner-v6"
ip6tables -A CENSYS_BLOCK -s 2620:96:e000:b0cc:e::/80 -j DROP -m comment --comment "Censys-scanner-v6"
ip6tables -A CENSYS_BLOCK -s 2602:80d:1003::/112 -j DROP -m comment --comment "Censys-scanner-v6"
ip6tables -A CENSYS_BLOCK -s 2602:80d:1004::/112 -j DROP -m comment --comment "Censys-scanner-v6"

  echo "[+] Censys IPv4 ranges blocked: 16"
  echo "[+] Censys IPv6 ranges blocked: 4"
  echo "[+] Censys user-agent string match active"

  # ── Persist across reboots ───────────────────────────────────
  if command -v netfilter-persistent &>/dev/null; then
    netfilter-persistent save
    echo "[+] Rules persisted via netfilter-persistent"
  elif command -v iptables-save &>/dev/null; then
    iptables-save  > /etc/iptables/rules.v4
    ip6tables-save > /etc/iptables/rules.v6
    echo "[+] Rules saved to /etc/iptables/rules.v4 and rules.v6"
  fi

  # ── nftables equivalent (if using nft instead) ───────────────
  if command -v nft &>/dev/null; then
    echo "[*] Also applying via nftables..."
    nft add table inet proxhq_censys 2>/dev/null || true
    nft add chain inet proxhq_censys input  '{ type filter hook input  priority -10; }' 2>/dev/null || true
    nft add chain inet proxhq_censys forward '{ type filter hook forward priority -10; }' 2>/dev/null || true
    nft add rule inet proxhq_censys input  ip saddr 66.132.159.0/24 drop 2>/dev/null || true
  nft add rule inet proxhq_censys input  ip saddr 66.132.148.0/24 drop 2>/dev/null || true
  nft add rule inet proxhq_censys input  ip saddr 66.132.153.0/24 drop 2>/dev/null || true
  nft add rule inet proxhq_censys input  ip saddr 66.132.224.0/24 drop 2>/dev/null || true
  nft add rule inet proxhq_censys input  ip saddr 66.132.186.0/24 drop 2>/dev/null || true
  nft add rule inet proxhq_censys input  ip saddr 66.132.195.0/24 drop 2>/dev/null || true
  nft add rule inet proxhq_censys input  ip saddr 66.132.172.0/24 drop 2>/dev/null || true
  nft add rule inet proxhq_censys input  ip saddr 162.142.125.0/24 drop 2>/dev/null || true
  nft add rule inet proxhq_censys input  ip saddr 167.94.138.0/24 drop 2>/dev/null || true
  nft add rule inet proxhq_censys input  ip saddr 167.94.145.0/24 drop 2>/dev/null || true
  nft add rule inet proxhq_censys input  ip saddr 167.94.146.0/24 drop 2>/dev/null || true
  nft add rule inet proxhq_censys input  ip saddr 167.248.133.0/24 drop 2>/dev/null || true
  nft add rule inet proxhq_censys input  ip saddr 199.45.154.0/24 drop 2>/dev/null || true
  nft add rule inet proxhq_censys input  ip saddr 199.45.155.0/24 drop 2>/dev/null || true
  nft add rule inet proxhq_censys input  ip saddr 206.168.34.0/24 drop 2>/dev/null || true
  nft add rule inet proxhq_censys input  ip saddr 206.168.35.0/24 drop 2>/dev/null || true
    nft add rule inet proxhq_censys forward ip saddr 66.132.159.0/24 drop 2>/dev/null || true
  nft add rule inet proxhq_censys forward ip saddr 66.132.148.0/24 drop 2>/dev/null || true
  nft add rule inet proxhq_censys forward ip saddr 66.132.153.0/24 drop 2>/dev/null || true
  nft add rule inet proxhq_censys forward ip saddr 66.132.224.0/24 drop 2>/dev/null || true
  nft add rule inet proxhq_censys forward ip saddr 66.132.186.0/24 drop 2>/dev/null || true
  nft add rule inet proxhq_censys forward ip saddr 66.132.195.0/24 drop 2>/dev/null || true
  nft add rule inet proxhq_censys forward ip saddr 66.132.172.0/24 drop 2>/dev/null || true
  nft add rule inet proxhq_censys forward ip saddr 162.142.125.0/24 drop 2>/dev/null || true
  nft add rule inet proxhq_censys forward ip saddr 167.94.138.0/24 drop 2>/dev/null || true
  nft add rule inet proxhq_censys forward ip saddr 167.94.145.0/24 drop 2>/dev/null || true
  nft add rule inet proxhq_censys forward ip saddr 167.94.146.0/24 drop 2>/dev/null || true
  nft add rule inet proxhq_censys forward ip saddr 167.248.133.0/24 drop 2>/dev/null || true
  nft add rule inet proxhq_censys forward ip saddr 199.45.154.0/24 drop 2>/dev/null || true
  nft add rule inet proxhq_censys forward ip saddr 199.45.155.0/24 drop 2>/dev/null || true
  nft add rule inet proxhq_censys forward ip saddr 206.168.34.0/24 drop 2>/dev/null || true
  nft add rule inet proxhq_censys forward ip saddr 206.168.35.0/24 drop 2>/dev/null || true
    nft add rule inet proxhq_censys input  ip6 saddr 2602:80d:1000:b0cc:e::/80 drop 2>/dev/null || true
  nft add rule inet proxhq_censys input  ip6 saddr 2620:96:e000:b0cc:e::/80 drop 2>/dev/null || true
  nft add rule inet proxhq_censys input  ip6 saddr 2602:80d:1003::/112 drop 2>/dev/null || true
  nft add rule inet proxhq_censys input  ip6 saddr 2602:80d:1004::/112 drop 2>/dev/null || true
    nft add rule inet proxhq_censys input tcp dport 80  @th,64,112 0x43656e737973496e7370656374 drop 2>/dev/null || true
    nft list ruleset > /etc/nftables-proxhq-censys.conf
    echo "[+] nftables rules also applied and saved"
  fi

  echo ""
  echo "[✓] CENSYS BLOCK COMPLETE"
  echo "    Subnets blocked : $((16 + 4))"
  echo "    ASNs blocked    : 3 (AS398722 AS398705 AS398324 — enforce at BGP/upstream)"
  echo "    UA blocked      : CensysInspect/1.1"
  echo ""
  echo "NOTE: ASN-level blocks (AS398722, AS398705, AS398324) require BGP"
  echo "      filtering at your upstream provider (Vultr BGP community tags"
  echo "      or prefix-list deny). Contact Vultr support to block these ASNs"
  echo "      at the network edge."
  