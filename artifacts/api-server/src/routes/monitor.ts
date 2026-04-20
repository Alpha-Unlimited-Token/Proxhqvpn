import { Router } from "express";
import { exec } from "child_process";
import { promisify } from "util";
import os from "os";

const execAsync = promisify(exec);
const router = Router();

function randomBetween(min: number, max: number) {
  return Math.round((Math.random() * (max - min) + min) * 10) / 10;
}

const PROCESSES = ["wireguard", "ghostnet", "node", "nginx", "sshd", "systemd", "tor", "wg-quick"];
const STATES = ["ESTABLISHED", "LISTEN", "TIME_WAIT", "CLOSE_WAIT"];
const PROTOCOLS = ["TCP", "UDP", "WireGuard"] as const;

function makeConnection(id: number) {
  const proto = PROTOCOLS[Math.floor(Math.random() * PROTOCOLS.length)];
  const localPort = [51820, 51821, 8080, 443, 80, 22, 9050][Math.floor(Math.random() * 7)];
  const remoteIp = `${randomBetween(1, 255)}.${randomBetween(0, 255)}.${randomBetween(0, 255)}.${randomBetween(1, 254)}`;
  return {
    id: String(id),
    localAddress: `0.0.0.0:${localPort}`,
    remoteAddress: `${remoteIp}:${Math.floor(Math.random() * 60000) + 1024}`,
    protocol: proto,
    state: STATES[Math.floor(Math.random() * STATES.length)],
    process: PROCESSES[Math.floor(Math.random() * PROCESSES.length)],
    pid: Math.floor(Math.random() * 9000) + 1000,
    nodeId: Math.random() > 0.5 ? Math.floor(Math.random() * 60) + 1 : undefined,
  };
}

router.get("/connections", async (req, res) => {
  const count = Math.floor(Math.random() * 12) + 8;
  const connections = Array.from({ length: count }, (_, i) => makeConnection(i + 1));
  res.json({ connections, total: connections.length });
});

router.get("/stats", async (req, res) => {
  const cpus = os.cpus();
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const uptimeSecs = os.uptime();
  const hours = Math.floor(uptimeSecs / 3600);
  const mins = Math.floor((uptimeSecs % 3600) / 60);

  // Try to get real CPU usage; fall back to simulated
  let cpuPercent = randomBetween(15, 55);
  try {
    const { stdout } = await execAsync("top -bn1 | grep 'Cpu(s)' | awk '{print $2}' | cut -d'%' -f1");
    const parsed = parseFloat(stdout.trim());
    if (!isNaN(parsed)) cpuPercent = parsed;
  } catch {}

  res.json({
    cpuPercent,
    memoryPercent: Math.round((usedMem / totalMem) * 100 * 10) / 10,
    memoryUsedMb: Math.round(usedMem / 1024 / 1024),
    memoryTotalMb: Math.round(totalMem / 1024 / 1024),
    networkInMbps: randomBetween(2, 80),
    networkOutMbps: randomBetween(1, 40),
    uptime: `${hours}h ${mins}m`,
    platform: `${os.platform()} ${os.arch()}`,
    activeUsers: Math.floor(Math.random() * 4) + 1,
    wireguardTunnels: Math.floor(Math.random() * 50) + 10,
  });
});

export default router;
