// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Router } from "express";
import { checkSsrf } from "../lib/ssrfGuard";
import { exec, spawn } from "child_process";
import { promisify } from "util";
import { z } from "zod";

const execAsync = promisify(exec);
const router = Router();

// ─── Audit log ───────────────────────────────────────────────────────────────
const auditLog: { ts: string; cmd: string; exitCode: number; ip: string }[] = [];

// ─── Hard-blocked dangerous patterns (system-destructive operations) ─────────
const HARD_BLOCKED: RegExp[] = [
  /\brm\s+-[rf]{1,3}\s+\/(?!\s*tmp)/i,    // rm -rf / (allow /tmp)
  /\bmkfs\b/i,
  /\bdd\s+if=\/dev\/(sd|hd|vd|nvme)/i,
  /\bformat\s+[cdefg]:/i,                  // Windows format
  /\b(passwd|chpasswd)\b/i,               // password changes
  /\bsudo\s+(su|bash|sh)\b/i,
  />\s*\/etc\/(passwd|shadow|sudoers)/i,
  /\bshutdown\b|\breboot\b|\bhalt\b/i,
  /\bsystemctl\s+(stop|disable|mask)\s+(ssh|sshd|network)/i,
  /\biptables\s+-F\s*$/i,                 // flush all rules with no args
  /\bkillall\s+-9\s+/i,
  /\/dev\/null.*&&\s*rm/i,
  /\becho\s+.*>>\s*\/etc\/crontab/i,
  /\bchmod\s+[0-7]*7[0-7]*\s+\//i,        // chmod 777 /
];

// ─── Allowed commands (broad categories for a security research terminal) ────
const ALLOWED_STARTS: string[] = [
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
  "bash -c 'curl", "bash -c 'dig", "bash -c 'nmap",
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
  // Security tools
  "nikto", "sqlmap --level=1", "hydra -I",
  "tcpdump -i", "tshark -i",
  // General utilities
  "env", "printenv", "which", "whereis", "type",
  "base64", "xxd", "hexdump",
  "awk", "sed ", "grep ", "cut ", "sort ", "uniq ", "wc ",
  "jq ", "tr ", "xargs ",
];

function isBlocked(cmd: string): string | null {
  for (const pat of HARD_BLOCKED) {
    if (pat.test(cmd)) return `BLOCKED: Destructive operation detected — "${pat.source}"`;
  }
  return null;
}

function isAllowed(cmd: string): boolean {
  const lower = cmd.trim().toLowerCase();
  return ALLOWED_STARTS.some(s => lower.startsWith(s.toLowerCase()));
}

// ─── GET audit log ────────────────────────────────────────────────────────────
router.get("/audit-log", (_req, res) => {
  res.json({ log: auditLog.slice(-200), total: auditLog.length });
});

// ─── POST exec ───────────────────────────────────────────────────────────────
router.post("/exec", async (req, res) => {
  const body = z.object({
    command: z.string().max(1000),
    shell: z.enum(["bash", "sh", "cmd", "powershell"]).optional().default("bash"),
    ghostMode: z.boolean().optional().default(false),
    timeout: z.number().min(1000).max(60000).optional().default(15000),
  }).parse(req.body);

  const cmd = body.command.trim();
  const executedAt = new Date().toISOString();
  const clientIp = req.ip ?? "unknown";

  // Hard block — always enforced
  const blockReason = isBlocked(cmd);
  if (blockReason) {
    auditLog.push({ ts: executedAt, cmd, exitCode: -1, ip: clientIp });
    return res.json({ command: cmd, stdout: "", stderr: blockReason, exitCode: 1, executedAt, blocked: true });
  }

  // ProxhqVPN mode bypasses allowlist (full shell access)
  if (!body.ghostMode && !isAllowed(cmd)) {
    const allowed = ALLOWED_STARTS.slice(0, 20).join(", ") + "...";
    return res.json({
      command: cmd,
      stdout: "",
      stderr: `Permission denied. Enable GHOST MODE for unrestricted shell, or use one of: ${allowed}\n\nHint: 'curl https://...', 'nmap', 'dig', 'openssl s_client', 'python3 -c' are all allowed.`,
      exitCode: 1,
      executedAt,
      blocked: false,
    });
  }

  try {
    const { stdout, stderr } = await execAsync(cmd, {
      timeout: body.timeout,
      maxBuffer: 1024 * 1024 * 4, // 4MB
      shell: "/bin/bash",
      env: { ...process.env, HOME: process.env.HOME ?? "/tmp" },
    });
    auditLog.push({ ts: executedAt, cmd, exitCode: 0, ip: clientIp });
    res.json({ command: cmd, stdout: stdout || "", stderr: stderr || "", exitCode: 0, executedAt, ghostMode: body.ghostMode });
  } catch (err: any) {
    auditLog.push({ ts: executedAt, cmd, exitCode: err.code ?? 1, ip: clientIp });
    res.json({
      command: cmd,
      stdout: err.stdout || "",
      stderr: err.stderr || err.message || "Command failed",
      exitCode: typeof err.code === "number" ? err.code : 1,
      executedAt,
      ghostMode: body.ghostMode,
    });
  }
});

// ─── POST http-request (direct outbound HTTP from server) ────────────────────
router.post("/http-request", async (req, res) => {
  const body = z.object({
    url: z.string().url(),
    method: z.enum(["GET","POST","PUT","DELETE","HEAD","OPTIONS","PATCH"]).default("GET"),
    headers: z.record(z.string()).optional().default({}),
    data: z.string().optional(),
    followRedirects: z.boolean().optional().default(true),
    verifySsl: z.boolean().optional().default(true),
    timeout: z.number().min(500).max(30000).optional().default(10000),
  }).parse(req.body);

  // SSRF Protection: block requests to private/internal/metadata IP ranges
  const ssrf = await checkSsrf(body.url, true);
  if (ssrf.blocked) {
    return res.status(403).json({ error: `SSRF blocked: ${ssrf.reason}` });
  }

  const startMs = Date.now();
  try {
    const nodeFetch = (await import("node-fetch")).default;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), body.timeout);

    const resp = await nodeFetch(body.url, {
      method: body.method,
      headers: { "User-Agent": "ProxhqVPN/3.0 curl/8.0", ...body.headers },
      body: body.data,
      redirect: body.followRedirects ? "follow" : "manual",
      signal: controller.signal as any,
    });
    clearTimeout(timer);

    const responseText = await resp.text();
    const responseHeaders: Record<string, string> = {};
    resp.headers.forEach((v, k) => { responseHeaders[k] = v; });

    res.json({
      url: body.url,
      status: resp.status,
      statusText: resp.statusText,
      headers: responseHeaders,
      body: responseText.slice(0, 50000),
      bodySize: responseText.length,
      durationMs: Date.now() - startMs,
      redirected: resp.redirected,
      finalUrl: resp.url,
    });
  } catch (err: any) {
    res.json({
      url: body.url,
      status: 0,
      statusText: "Connection failed",
      headers: {},
      body: "",
      bodySize: 0,
      durationMs: Date.now() - startMs,
      error: err.message,
    });
  }
});

// ─── GET port-scan (basic TCP connect scan) ────────────────────────────────
router.post("/port-scan", async (req, res) => {
  const body = z.object({
    host: z.string().min(1).max(253),
    ports: z.array(z.number().min(1).max(65535)).max(50),
    timeout: z.number().min(100).max(5000).optional().default(1500),
  }).parse(req.body);

  // SSRF Protection: block port scans against private/internal IP ranges
  const ssrf = await checkSsrf(body.host, false);
  if (ssrf.blocked) {
    return res.status(403).json({ error: `SSRF blocked: ${ssrf.reason}` });
  }

  const net = await import("net");
  const results: { port: number; open: boolean; banner?: string }[] = [];

  await Promise.all(
    body.ports.map(port =>
      new Promise<void>(resolve => {
        const sock = new net.Socket();
        let open = false;
        let banner = "";
        sock.setTimeout(body.timeout);
        sock.connect(port, body.host, () => { open = true; });
        sock.on("data", d => { banner = d.toString("utf8", 0, 200).replace(/\r?\n/g, " ").trim(); sock.destroy(); });
        sock.on("timeout", () => sock.destroy());
        sock.on("error", () => sock.destroy());
        sock.on("close", () => { results.push({ port, open, ...(banner ? { banner } : {}) }); resolve(); });
      })
    )
  );

  results.sort((a, b) => a.port - b.port);
  res.json({
    host: body.host,
    scannedAt: new Date().toISOString(),
    openPorts: results.filter(r => r.open).length,
    results,
  });
});

export default router;
