// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.

export const TERMINAL_OUTPUT_LIMIT = 2 * 1024 * 1024;
export const TERMINAL_STDERR_LIMIT = 256 * 1024;

export const HARD_BLOCKED_COMMANDS: RegExp[] = [
  /\brm\s+-[rf]{1,3}\s+\/(?!\s*tmp)/i,
  /\bmkfs\b/i,
  /\bdd\s+if=\/dev\/(sd|hd|vd|nvme)/i,
  /\bformat\s+[cdefg]:/i,
  /\b(passwd|chpasswd)\b/i,
  /\bsudo\s+(su|bash|sh)\b/i,
  />\s*\/etc\/(passwd|shadow|sudoers)/i,
  /\bshutdown\b|\breboot\b|\bhalt\b/i,
  /\bsystemctl\s+(stop|disable|mask)\s+(ssh|sshd|network)/i,
  /\biptables\s+-F\s*$/i,
  /\bkillall\s+-9\s+/i,
  /\/dev\/null.*&&\s*rm/i,
  /\becho\s+.*>>\s*\/etc\/crontab/i,
  /\bchmod\s+[0-7]*7[0-7]*\s+\//i,
];

export const SHELL_CHAIN_BLOCKED: RegExp[] = [
  /`[^`]{1,300}`/,
  /\$\([^)]{1,300}\)/,
  /\$\{[^}]{1,300}\}/,
  /;\s*\S/,
  /&&\s*\S/,
  /\|\|\s*\S/,
  /\|\s*(?:bash|sh|python|perl|ruby|nc|netcat|socat)/i,
  />\s*\/(?!tmp\/)/,
  />>/,
  /2>&1\s*>\s*\//,
  /\beval\s*['"`(]/i,
  /\bexec\s+['"`\-]/i,
  /\bsource\s+\//i,
  /\.\s+\//,
];

export const ALLOWED_COMMAND_STARTS: string[] = [
  // Network recon & scanning
  "nmap", "masscan", "netdiscover", "arp-scan",
  // HTTP clients
  "curl", "wget", "httpie", "http ",
  // DNS/WHOIS
  "dig", "nslookup", "host ", "whois", "drill",
  // Routing & interfaces
  "ip ", "ifconfig", "route", "ss ", "netstat",
  // WireGuard
  "wg ", "wg-quick",
  // Firewall inspection
  "iptables -L", "iptables -S", "iptables -n", "ip6tables -L",
  "nft list", "ufw status",
  // Connectivity testing
  "ping", "ping6", "traceroute", "tracepath", "mtr",
  // SSL/TLS
  "openssl", "certbot",
  // System info (read-only)
  "uname", "hostname", "hostnamectl", "uptime", "who", "w ", "id ",
  "whoami", "date", "cal",
  "df ", "free ", "vmstat", "iostat", "top -bn", "htop", "ps ",
  "ls ", "ll ", "la ", "pwd", "echo", "cat ", "head ", "tail ",
  "find /tmp", "find /var/log", "find /etc/wireguard",
  // Scripting/execution (limited)
  "python3 -c", "python -c", "node -e", "node --eval",
  // File read (not write)
  "cat /etc/os-release", "cat /proc/version", "cat /proc/cpuinfo",
  "cat /etc/wireguard", "cat /var/log/",
  // nc/netcat (outbound checks)
  "nc -zv", "nc -w", "netcat -zv",
  // SSH (non-interactive)
  "ssh -o BatchMode", "ssh -T",
  // Process info
  "lsof -i", "lsof -n",
  // Package queries (read-only)
  "dpkg -l", "rpm -qa", "apt list",
  // Crypto/keys
  "wg genkey", "wg pubkey", "openssl genrsa", "openssl rsa",
  "openssl x509", "openssl s_client", "openssl verify",
  // ProxhqVPN specific
  "ghostnet", "python3 tun_daemon",
  // Packet capture (read-only, no credential scanners)
  "tcpdump -i", "tshark -i",
  // General utilities
  "env", "printenv", "which", "whereis", "type",
  "base64", "xxd", "hexdump",
  "awk", "sed ", "grep ", "cut ", "sort ", "uniq ", "wc ",
  "jq ", "tr ", "xargs ",
];

export function getHardBlockReason(command: string): string | null {
  for (const pattern of HARD_BLOCKED_COMMANDS) {
    if (pattern.test(command)) {
      return `BLOCKED: destructive operation matched policy ${pattern.source}`;
    }
  }
  return null;
}

export function hasShellChain(command: string): boolean {
  return SHELL_CHAIN_BLOCKED.some((pattern) => pattern.test(command));
}

export function isAllowedCommand(command: string): boolean {
  const lower = command.trim().toLowerCase();
  return ALLOWED_COMMAND_STARTS.some((start) =>
    lower.startsWith(start.toLowerCase()),
  );
}

export function truncateTerminalOutput(value: string, limit: number): string {
  if (value.length <= limit) return value;
  return value.slice(-limit);
}
