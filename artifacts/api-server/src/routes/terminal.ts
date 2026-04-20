import { Router } from "express";
import { exec } from "child_process";
import { promisify } from "util";
import { z } from "zod";

const execAsync = promisify(exec);
const router = Router();

// Allowlist of safe command prefixes for this environment
const ALLOWED_PREFIXES = [
  "wg", "wg-quick", "ip route", "ip rule", "ip addr", "ip link",
  "iptables -L", "iptables -S", "nft list",
  "ping -c", "traceroute", "tracepath",
  "ss ", "netstat", "nmap -sn",
  "uname", "hostname", "uptime", "who", "id",
  "ls", "pwd", "echo", "cat /etc/os-release",
  "df ", "free ", "top -bn1", "ps aux",
  "date", "whoami",
  "curl --max-time 5",
  "dig ", "nslookup ", "host ",
  "openssl version", "wg genkey", "wg pubkey",
];

const BLOCKED_PATTERNS = [
  /rm\s+-rf/i, /mkfs/i, /dd\s+if/i, /chmod\s+777/i,
  /passwd/i, /sudo\s+su/i, /curl.*\|\s*bash/i,
  /wget.*\|\s*sh/i, />\s*\/etc/i, /\/etc\/shadow/i,
  /;\s*rm/i, /&&\s*rm/i, /\|\s*sh/i, /\|\s*bash/i,
  /`[^`]*`/, /\$\([^)]*\)/, />\s*\/proc/i, /\/dev\/null.*&&/i,
  /base64\s+--decode/i, /eval\s*\(/i, /exec\s*\(/i,
];

const SHELL_META_RE = /[;&|`$()><{}]/;

function stripShellMeta(cmd: string): string {
  return cmd.replace(/[;&|`$()><{}\\]/g, " ").replace(/\s+/g, " ").trim();
}

function isAllowed(cmd: string): boolean {
  const trimmed = cmd.trim().toLowerCase();
  for (const pat of BLOCKED_PATTERNS) {
    if (pat.test(trimmed)) return false;
  }
  if (SHELL_META_RE.test(cmd)) return false;
  return ALLOWED_PREFIXES.some((p) => trimmed.startsWith(p.toLowerCase()));
}

router.post("/exec", async (req, res) => {
  const body = z.object({
    command: z.string().max(500),
    shell: z.enum(["bash", "sh", "cmd", "powershell"]).optional().default("bash"),
  }).parse(req.body);

  const cmd = body.command.trim();
  const executedAt = new Date().toISOString();

  if (!isAllowed(cmd)) {
    return res.json({
      command: cmd,
      stdout: "",
      stderr: `Permission denied: command not in GhostNet allowed list.\nAllowed: wg, ip route/rule/addr, iptables -L, ping, ss, netstat, uname, hostname, uptime, ls, ps, df, free, date, dig, curl (limited), openssl, nmap -sn`,
      exitCode: 1,
      executedAt,
    });
  }

  try {
    const { stdout, stderr } = await execAsync(cmd, { timeout: 10000, maxBuffer: 1024 * 512 });
    res.json({ command: cmd, stdout: stdout || "", stderr: stderr || "", exitCode: 0, executedAt });
  } catch (err: any) {
    res.json({
      command: cmd,
      stdout: err.stdout || "",
      stderr: err.stderr || err.message || "Command failed",
      exitCode: err.code ?? 1,
      executedAt,
    });
  }
});

export default router;
