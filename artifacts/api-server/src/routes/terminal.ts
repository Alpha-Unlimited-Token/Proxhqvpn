// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Router } from "express";
import { checkSsrf } from "../lib/ssrfGuard";
import { exec, spawn } from "child_process";
import { promisify } from "util";
import { z } from "zod";
import { Client as SshClient } from "ssh2";
import type { ConnectConfig, SFTPWrapper } from "ssh2";
import { randomUUID } from "crypto";

const execAsync = promisify(exec);

// Non-ghost mode command execution via spawn(shell:false) to prevent shell
// metacharacter injection even if the allowlist check is somehow bypassed.
// Simple whitespace tokenizer is sufficient since the allowlist only permits
// known tool invocations that don't use shell quoting.
function spawnCommand(cmd: string, timeoutMs: number): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    const parts = cmd.trim().match(/\S+/g) ?? [];
    const [file, ...args] = parts;
    if (!file) return resolve({ stdout: "", stderr: "Empty command", exitCode: 1 });

    const child = spawn(file, args, {
      shell: false,
      timeout: timeoutMs,
      env: { ...process.env, HOME: process.env.HOME ?? "/tmp" },
    });

    let stdout = "";
    let stderr = "";
    const MAX = 4 * 1024 * 1024; // 4 MB cap
    child.stdout?.on("data", (d: Buffer) => { stdout += d; if (stdout.length > MAX) stdout = stdout.slice(-MAX); });
    child.stderr?.on("data", (d: Buffer) => { stderr += d; if (stderr.length > 512 * 1024) stderr = stderr.slice(-512 * 1024); });
    child.on("close", (code) => resolve({ stdout, stderr, exitCode: code ?? 0 }));
    child.on("error", (err) => resolve({ stdout: "", stderr: err.message, exitCode: 1 }));
  });
}
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

// Shell chain injection patterns that bypass allowlist via command chaining.
// Applied in NON-ghost-mode only. Ghost mode is admin-only and logs everything.
const SHELL_CHAIN_BLOCKED: RegExp[] = [
  /`[^`]{1,300}`/,                 // backtick command substitution
  /\$\([^)]{1,300}\)/,             // $(...) command substitution
  /\$\{[^}]{1,300}\}/,             // ${...} variable expansion used for injection
  /;\s*\S/,                        // ; command separator
  /&&\s*\S/,                       // && conditional chaining
  /\|\|\s*\S/,                     // || conditional chaining
  /\|\s*(?:bash|sh|python|perl|ruby|nc|netcat|socat)/i,  // pipe to shell/interpreter
  />\s*\/(?!tmp\/)/,               // redirect to file outside /tmp
  />>/,                            // append redirect (always dangerous)
  /2>&1\s*>\s*\//,                 // stderr redirect to file
  /\beval\s*['"`(]/i,              // eval injection
  /\bexec\s+['"`\-]/i,             // exec injection
  /\bsource\s+\//i,                // source /path injection
  /\.\s+\//,                       // . /path (dot-source injection)
];

function isBlocked(cmd: string): string | null {
  for (const pat of HARD_BLOCKED) {
    if (pat.test(cmd)) return `BLOCKED: Destructive operation detected — "${pat.source}"`;
  }
  return null;
}

function hasShellChain(cmd: string): boolean {
  return SHELL_CHAIN_BLOCKED.some(pat => pat.test(cmd));
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

  // In non-ghost mode, block shell chain injection even inside allowlisted commands
  if (!body.ghostMode && hasShellChain(cmd)) {
    auditLog.push({ ts: executedAt, cmd, exitCode: -2, ip: clientIp });
    return res.json({ command: cmd, stdout: "", stderr: "BLOCKED: Shell chain injection detected. Enable GHOST MODE for complex pipelines.", exitCode: 1, executedAt, blocked: true });
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

  // Ghost mode (ProxhqVPN Mode) = full outbound shell, admin-only, everything audited.
  // Non-ghost mode = spawn(shell:false) with allowlist — prevents shell metacharacter injection.
  if (body.ghostMode) {
    try {
      const { stdout, stderr } = await execAsync(cmd, {
        timeout: body.timeout,
        maxBuffer: 1024 * 1024 * 4,
        shell: "/bin/bash",
        env: { ...process.env, HOME: process.env.HOME ?? "/tmp" },
      });
      auditLog.push({ ts: executedAt, cmd, exitCode: 0, ip: clientIp });
      res.json({ command: cmd, stdout: stdout || "", stderr: stderr || "", exitCode: 0, executedAt, ghostMode: true });
    } catch (err: any) {
      auditLog.push({ ts: executedAt, cmd, exitCode: err.code ?? 1, ip: clientIp });
      res.json({
        command: cmd,
        stdout: err.stdout || "",
        stderr: err.stderr || err.message || "Command failed",
        exitCode: typeof err.code === "number" ? err.code : 1,
        executedAt,
        ghostMode: true,
      });
    }
  } else {
    // Allowlisted commands use spawn(shell:false) — no shell expansion, no injection risk
    const result = await spawnCommand(cmd, body.timeout);
    auditLog.push({ ts: executedAt, cmd, exitCode: result.exitCode, ip: clientIp });
    res.json({ command: cmd, stdout: result.stdout, stderr: result.stderr, exitCode: result.exitCode, executedAt, ghostMode: false });
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

    // Redirect SSRF re-validation: manually follow redirects so each hop is
    // checked against the SSRF guard — prevents open-redirect chains that bypass
    // the initial check and land on an internal/metadata address.
    let currentUrl = body.url;
    let resp: Awaited<ReturnType<typeof nodeFetch>>;
    const MAX_REDIRECTS = 5;
    let redirectCount = 0;
    while (true) {
      resp = await nodeFetch(currentUrl, {
        method: body.method,
        headers: { "User-Agent": "ProxhqVPN/3.0 curl/8.0", ...body.headers },
        body: body.data,
        redirect: "manual",   // always manual so we can inspect each hop
        signal: controller.signal as any,
      });
      const location = resp.headers.get("location");
      if (
        body.followRedirects &&
        location &&
        [301, 302, 303, 307, 308].includes(resp.status) &&
        redirectCount < MAX_REDIRECTS
      ) {
        // Re-validate the redirect target before following
        const absLocation = new URL(location, currentUrl).toString();
        const hopCheck = await checkSsrf(absLocation, true);
        if (hopCheck.blocked) {
          clearTimeout(timer);
          return res.status(403).json({ error: `SSRF blocked on redirect hop ${redirectCount + 1}: ${hopCheck.reason}` });
        }
        currentUrl = absLocation;
        redirectCount++;
        continue;
      }
      break;
    }
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

// ─── SSH Session Manager ──────────────────────────────────────────────────────

interface SshSession {
  id: string;
  host: string;
  port: number;
  username: string;
  connectedAt: string;
  client: SshClient;
  sftp: SFTPWrapper | null;
  label: string;
}

const sshSessions = new Map<string, SshSession>();

// Helper: get SFTP subsystem for a session (lazy init)
function getSftp(session: SshSession): Promise<SFTPWrapper> {
  if (session.sftp) return Promise.resolve(session.sftp);
  return new Promise((resolve, reject) => {
    session.client.sftp((err, sftp) => {
      if (err) return reject(err);
      session.sftp = sftp;
      resolve(sftp);
    });
  });
}

// POST /api/terminal/ssh/connect
router.post("/ssh/connect", async (req, res) => {
  const body = z.object({
    host: z.string().min(1).max(253),
    port: z.number().min(1).max(65535).optional().default(22),
    username: z.string().min(1).max(64),
    password: z.string().optional(),
    privateKey: z.string().optional(),
    passphrase: z.string().optional(),
    label: z.string().max(64).optional(),
    timeout: z.number().min(2000).max(30000).optional().default(10000),
  }).parse(req.body);

  if (!body.password && !body.privateKey) {
    return res.status(400).json({ error: "Provide either password or privateKey" });
  }

  // SSRF guard — block private/metadata ranges
  const ssrf = await checkSsrf(body.host, false);
  if (ssrf.blocked) {
    return res.status(403).json({ error: `SSRF blocked: ${ssrf.reason}` });
  }

  const sessionId = randomUUID();
  const client = new SshClient();

  const cfg: ConnectConfig = {
    host: body.host,
    port: body.port,
    username: body.username,
    readyTimeout: body.timeout,
    ...(body.password   ? { password: body.password }   : {}),
    ...(body.privateKey ? {
      privateKey: body.privateKey,
      ...(body.passphrase ? { passphrase: body.passphrase } : {}),
    } : {}),
  };

  await new Promise<void>((resolve, reject) => {
    client.on("ready", () => {
      sshSessions.set(sessionId, {
        id: sessionId,
        host: body.host,
        port: body.port,
        username: body.username,
        connectedAt: new Date().toISOString(),
        client,
        sftp: null,
        label: body.label ?? `${body.username}@${body.host}`,
      });
      resolve();
    });
    client.on("error", (err) => reject(err));
    client.connect(cfg);
  }).catch((err: Error) => {
    res.status(400).json({ error: `SSH connection failed: ${err.message}` });
    throw err; // prevent double-send
  });

  res.json({ sessionId, host: body.host, port: body.port, username: body.username, connectedAt: new Date().toISOString() });
});

// GET /api/terminal/ssh/sessions
router.get("/ssh/sessions", (_req, res) => {
  const list = [...sshSessions.values()].map(s => ({
    id: s.id,
    host: s.host,
    port: s.port,
    username: s.username,
    label: s.label,
    connectedAt: s.connectedAt,
  }));
  res.json({ sessions: list });
});

// DELETE /api/terminal/ssh/sessions/:id
router.delete("/ssh/sessions/:id", (req, res) => {
  const session = sshSessions.get(req.params.id);
  if (!session) return res.status(404).json({ error: "Session not found" });
  try { session.client.end(); } catch { /* ignore */ }
  sshSessions.delete(req.params.id);
  res.json({ ok: true });
});

// POST /api/terminal/ssh/exec  — run a command in a session
router.post("/ssh/exec", async (req, res) => {
  const body = z.object({
    sessionId: z.string().uuid(),
    command: z.string().min(1).max(4096),
    timeout: z.number().min(500).max(120000).optional().default(30000),
  }).parse(req.body);

  const session = sshSessions.get(body.sessionId);
  if (!session) return res.status(404).json({ error: "Session not found or disconnected" });

  // Enforce same hard-block patterns even on remote sessions
  const blockReason = isBlocked(body.command);
  if (blockReason) return res.status(403).json({ error: blockReason });

  const executedAt = new Date().toISOString();

  const result = await new Promise<{ stdout: string; stderr: string; exitCode: number }>((resolve) => {
    const timer = setTimeout(() => {
      resolve({ stdout: "", stderr: "Command timed out", exitCode: 124 });
    }, body.timeout);

    session.client.exec(body.command, (err, stream) => {
      if (err) {
        clearTimeout(timer);
        return resolve({ stdout: "", stderr: err.message, exitCode: 1 });
      }
      let stdout = "";
      let stderr = "";
      const MAX = 2 * 1024 * 1024;
      stream.on("data", (d: Buffer) => { stdout += d; if (stdout.length > MAX) stdout = stdout.slice(-MAX); });
      stream.stderr.on("data", (d: Buffer) => { stderr += d; if (stderr.length > 256 * 1024) stderr = stderr.slice(-256 * 1024); });
      stream.on("close", (code: number) => {
        clearTimeout(timer);
        resolve({ stdout, stderr, exitCode: code ?? 0 });
      });
      stream.on("error", (e: Error) => {
        clearTimeout(timer);
        resolve({ stdout, stderr: e.message, exitCode: 1 });
      });
    });
  });

  auditLog.push({ ts: executedAt, cmd: `[SSH:${session.label}] ${body.command}`, exitCode: result.exitCode, ip: req.ip ?? "unknown" });
  res.json({ ...result, command: body.command, executedAt });
});

// POST /api/terminal/ssh/sftp/ls  — list directory
router.post("/ssh/sftp/ls", async (req, res) => {
  const body = z.object({
    sessionId: z.string().uuid(),
    path: z.string().min(1).max(4096).default("/"),
  }).parse(req.body);

  const session = sshSessions.get(body.sessionId);
  if (!session) return res.status(404).json({ error: "Session not found" });

  try {
    const sftp = await getSftp(session);
    const entries = await new Promise<any[]>((resolve, reject) => {
      sftp.readdir(body.path, (err, list) => {
        if (err) return reject(err);
        resolve(list.map(e => ({
          name: e.filename,
          longname: e.longname,
          isDir: (e.attrs.mode! & 0o170000) === 0o040000,
          isSymlink: (e.attrs.mode! & 0o170000) === 0o120000,
          size: e.attrs.size ?? 0,
          mode: (e.attrs.mode ?? 0).toString(8),
          mtime: e.attrs.mtime ?? 0,
        })));
      });
    });
    res.json({ path: body.path, entries });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/terminal/ssh/sftp/read  — read a file (capped at 512 KB)
router.post("/ssh/sftp/read", async (req, res) => {
  const body = z.object({
    sessionId: z.string().uuid(),
    path: z.string().min(1).max(4096),
  }).parse(req.body);

  const session = sshSessions.get(body.sessionId);
  if (!session) return res.status(404).json({ error: "Session not found" });

  const MAX_BYTES = 512 * 1024;
  try {
    const sftp = await getSftp(session);
    const content = await new Promise<string>((resolve, reject) => {
      const chunks: Buffer[] = [];
      let total = 0;
      const stream = sftp.createReadStream(body.path, { start: 0, end: MAX_BYTES });
      stream.on("data", (chunk: Buffer) => { chunks.push(chunk); total += chunk.length; });
      stream.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      stream.on("error", reject);
    });
    res.json({ path: body.path, content, truncated: content.length >= MAX_BYTES });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ─── Remote Screen Capture & Input Control ────────────────────────────────────
// Uses scrot/import for screenshots and xdotool for mouse/keyboard injection.
// All commands run over the existing SSH session — no extra daemon needed.

// Helper: run a raw SSH command and return stdout (no audit log, internal use)
function sshRun(session: SshSession, cmd: string, timeoutMs = 8000): Promise<{ stdout: Buffer; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ stdout: Buffer.alloc(0), stderr: "timeout", exitCode: 124 }), timeoutMs);
    session.client.exec(cmd, { env: { DISPLAY: ":0" } }, (err, stream) => {
      if (err) { clearTimeout(timer); return resolve({ stdout: Buffer.alloc(0), stderr: err.message, exitCode: 1 }); }
      const chunks: Buffer[] = [];
      let stderr = "";
      stream.on("data", (d: Buffer) => chunks.push(d));
      stream.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });
      stream.on("close", (code: number) => {
        clearTimeout(timer);
        resolve({ stdout: Buffer.concat(chunks), stderr, exitCode: code ?? 0 });
      });
    });
  });
}

// POST /api/terminal/ssh/screen/capture
// Returns a base64-encoded JPEG of the remote desktop.
// Tries: scrot → import (ImageMagick) → ffmpeg fallback
router.post("/ssh/screen/capture", async (req, res) => {
  const body = z.object({
    sessionId: z.string().uuid(),
    quality: z.number().min(10).max(95).optional().default(55),
    display: z.string().max(8).optional().default(":0"),
  }).parse(req.body);

  const session = sshSessions.get(body.sessionId);
  if (!session) return res.status(404).json({ error: "Session not found" });

  const q = body.quality;
  const disp = body.display;
  const ts = Date.now();
  const tmpPng = `/tmp/proxhq_screen_${ts}.jpg`;

  // Try scrot first (lightweight), fall back to import (ImageMagick)
  const captureCmd =
    `DISPLAY=${disp} scrot --quality ${q} ${tmpPng} 2>/dev/null && base64 -w 0 ${tmpPng} && rm -f ${tmpPng}` +
    ` || (DISPLAY=${disp} import -window root -quality ${q} ${tmpPng} 2>/dev/null && base64 -w 0 ${tmpPng} && rm -f ${tmpPng})` +
    ` || (DISPLAY=${disp} ffmpeg -y -f x11grab -i ${disp} -vframes 1 -q:v 5 ${tmpPng} 2>/dev/null && base64 -w 0 ${tmpPng} && rm -f ${tmpPng})`;

  const result = await sshRun(session, captureCmd, 10000);

  if (result.exitCode !== 0 || result.stdout.length === 0) {
    return res.status(400).json({
      error: "Screen capture failed. Ensure scrot or ImageMagick is installed on the target machine: sudo apt install scrot",
      stderr: result.stderr.slice(0, 500),
    });
  }

  const b64 = result.stdout.toString("utf8").trim();
  res.json({ image: `data:image/jpeg;base64,${b64}`, capturedAt: new Date().toISOString() });
});

// POST /api/terminal/ssh/screen/info
// Returns screen resolution via xrandr or xdpyinfo
router.post("/ssh/screen/info", async (req, res) => {
  const body = z.object({ sessionId: z.string().uuid(), display: z.string().max(8).optional().default(":0") }).parse(req.body);
  const session = sshSessions.get(body.sessionId);
  if (!session) return res.status(404).json({ error: "Session not found" });

  const r = await sshRun(session,
    `DISPLAY=${body.display} xrandr 2>/dev/null | grep ' connected' | grep -oP '\\d+x\\d+' | head -1` +
    ` || DISPLAY=${body.display} xdpyinfo 2>/dev/null | grep dimensions | awk '{print $2}'`,
    5000
  );
  const raw = r.stdout.toString().trim();
  const match = raw.match(/(\d+)x(\d+)/);
  res.json({ resolution: raw || "unknown", width: match ? parseInt(match[1]) : 1920, height: match ? parseInt(match[2]) : 1080 });
});

// POST /api/terminal/ssh/screen/input
// Accepts mouse move, click, scroll, and key events — executed via xdotool
router.post("/ssh/screen/input", async (req, res) => {
  const EventSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("mousemove"), x: z.number().int(), y: z.number().int() }),
    z.object({ type: z.literal("click"),     x: z.number().int(), y: z.number().int(), button: z.number().int().min(1).max(9).optional().default(1) }),
    z.object({ type: z.literal("dblclick"),  x: z.number().int(), y: z.number().int() }),
    z.object({ type: z.literal("scroll"),    x: z.number().int(), y: z.number().int(), delta: z.number() }),
    z.object({ type: z.literal("keydown"),   key: z.string().max(64) }),
    z.object({ type: z.literal("type"),      text: z.string().max(1024) }),
  ]);

  const body = z.object({
    sessionId: z.string().uuid(),
    event: EventSchema,
    display: z.string().max(8).optional().default(":0"),
  }).parse(req.body);

  const session = sshSessions.get(body.sessionId);
  if (!session) return res.status(404).json({ error: "Session not found" });

  const ev = body.event;
  const disp = `DISPLAY=${body.display}`;
  let cmd = "";

  if (ev.type === "mousemove") {
    cmd = `${disp} xdotool mousemove --sync ${ev.x} ${ev.y}`;
  } else if (ev.type === "click") {
    cmd = `${disp} xdotool mousemove --sync ${ev.x} ${ev.y} click ${ev.button}`;
  } else if (ev.type === "dblclick") {
    cmd = `${disp} xdotool mousemove --sync ${ev.x} ${ev.y} click --repeat 2 --delay 50 1`;
  } else if (ev.type === "scroll") {
    const btn = ev.delta > 0 ? 4 : 5; // 4=up 5=down
    const repeats = Math.min(Math.abs(Math.round(ev.delta / 100)), 10);
    cmd = `${disp} xdotool click --repeat ${repeats} --delay 20 ${btn}`;
  } else if (ev.type === "keydown") {
    // Map common browser key names to xdotool key names
    const keyMap: Record<string, string> = {
      Enter: "Return", Backspace: "BackSpace", Delete: "Delete",
      ArrowLeft: "Left", ArrowRight: "Right", ArrowUp: "Up", ArrowDown: "Down",
      Tab: "Tab", Escape: "Escape", " ": "space",
      Control: "ctrl", Shift: "shift", Alt: "alt", Meta: "super",
      F1:"F1",F2:"F2",F3:"F3",F4:"F4",F5:"F5",F6:"F6",F7:"F7",F8:"F8",F9:"F9",F10:"F10",F11:"F11",F12:"F12",
      Home:"Home", End:"End", PageUp:"Page_Up", PageDown:"Page_Down",
    };
    const xkey = keyMap[ev.key] ?? ev.key;
    cmd = `${disp} xdotool key --clearmodifiers "${xkey}"`;
  } else if (ev.type === "type") {
    // Escape for shell safety — no shell injection via type
    const safe = ev.text.replace(/'/g, "'\\''");
    cmd = `${disp} xdotool type --clearmodifiers --delay 10 '${safe}'`;
  }

  if (!cmd) return res.status(400).json({ error: "Unknown event type" });

  const r = await sshRun(session, cmd, 5000);
  res.json({ ok: r.exitCode === 0, stderr: r.stderr.slice(0, 200) });
});

export default router;
