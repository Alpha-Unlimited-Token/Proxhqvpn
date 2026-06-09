#!/usr/bin/env bash
set -euo pipefail
CONFIG_URL=${1:?config zip URL required}
EXPECTED_SHA256=${2:?expected sha256 required}
TMP=$(mktemp -d)
curl --proto '=https' --tlsv1.2 -fsSL "$CONFIG_URL" -o "$TMP/configs.zip"
echo "$EXPECTED_SHA256  $TMP/configs.zip" | sha256sum -c -
apt-get update && apt-get install -y wireguard unzip nftables
unzip -q "$TMP/configs.zip" -d "$TMP/configs"
install -d -m 700 /etc/wireguard
install -m 600 "$TMP/configs"/*.conf /etc/wireguard/
cat >/etc/nftables.d/proxhqvpn-killswitch.nft <<'NFT'
table inet proxhqvpn { chain output { type filter hook output priority 0; policy accept; oifname != "wg0" ip daddr != 127.0.0.0/8 meta l4proto { tcp, udp } reject } }
NFT
systemctl enable --now nftables
echo "Linux installer complete. Enable selected tunnel with: wg-quick up <name>"
