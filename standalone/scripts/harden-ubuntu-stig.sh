#!/usr/bin/env bash
set -euo pipefail
if [[ $EUID -ne 0 ]]; then echo "Run as root" >&2; exit 1; fi
apt-get update && apt-get install -y ufw auditd audispd-plugins fail2ban unattended-upgrades chrony openscap-scanner
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 443/tcp
ufw --force enable
systemctl enable --now auditd fail2ban chrony unattended-upgrades
cat >/etc/audit/rules.d/proxhqvpn.rules <<'RULES'
-w /etc/wireguard -p wa -k wireguard_config_change
-w /opt/proxhqvpn -p wa -k proxhq_app_change
-w /etc/ssh/sshd_config -p wa -k ssh_config_change
-a always,exit -F arch=b64 -S execve -k command_exec
RULES
augenrules --load
sed -i 's/^#*PasswordAuthentication .*/PasswordAuthentication no/' /etc/ssh/sshd_config
sed -i 's/^#*PermitRootLogin .*/PermitRootLogin no/' /etc/ssh/sshd_config
systemctl reload ssh || true
cat >/etc/sysctl.d/99-proxhqvpn.conf <<'SYSCTL'
net.ipv4.ip_forward=1
net.ipv4.conf.all.rp_filter=1
net.ipv4.conf.default.rp_filter=1
net.ipv4.conf.all.accept_redirects=0
net.ipv4.conf.default.accept_redirects=0
net.ipv6.conf.all.accept_redirects=0
net.ipv6.conf.default.accept_redirects=0
net.ipv4.tcp_syncookies=1
kernel.kptr_restrict=2
kernel.dmesg_restrict=1
fs.protected_hardlinks=1
fs.protected_symlinks=1
SYSCTL
sysctl --system
mkdir -p /var/log/proxhqvpn && chmod 750 /var/log/proxhqvpn
echo "Baseline host hardening complete. Run OpenSCAP and remediate distribution-specific findings next."
