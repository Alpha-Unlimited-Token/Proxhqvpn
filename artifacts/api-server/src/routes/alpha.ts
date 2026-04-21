import { Router } from "express";
import { exec, spawn } from "child_process";
import path from "path";
import fs from "fs";
import os from "os";
import crypto from "crypto";

const router = Router();

const TOOLS_DIR = path.resolve(process.cwd(), "tools");
const SCANNER   = path.join(TOOLS_DIR, "alpha_scanner.py");
const VERIFIER  = path.join(TOOLS_DIR, "alpha_vuln_verifier.py");
const PYTHON    = "/home/runner/workspace/.pythonlibs/bin/python3";

const TOR_PROXY = "socks5h://127.0.0.1:9050";

// ── Job stores ──────────────────────────────────────────────────────────────
type JobStatus = "running" | "complete" | "error" | "cancelled";
type Job = { status: JobStatus; output: string | null; cmd: string; startedAt: number };
const scanJobs:    Map<string, Job>          = new Map();
const verifyJobs:  Map<string, Job>          = new Map();
const scanProcs:   Map<string, import("child_process").ChildProcess> = new Map();
const verifyProcs: Map<string, import("child_process").ChildProcess> = new Map();

// ── Helpers ─────────────────────────────────────────────────────────────────
function torEnv() {
  return {
    ...process.env,
    TORSOCKS_CONF_FILE: "/dev/null",
    http_proxy:  `socks5h://127.0.0.1:9050`,
    https_proxy: `socks5h://127.0.0.1:9050`,
    HTTP_PROXY:  `socks5h://127.0.0.1:9050`,
    HTTPS_PROXY: `socks5h://127.0.0.1:9050`,
    ALL_PROXY:   `socks5h://127.0.0.1:9050`,
  };
}

function torPrefix(useTor: boolean): string {
  return useTor ? "torsocks " : "";
}

function runJob(
  jobs: Map<string, Job>,
  procs: Map<string, import("child_process").ChildProcess>,
  jobId: string,
  cmd: string,
  useTor: boolean,
  timeout = 180000,
) {
  jobs.set(jobId, { status: "running", output: null, cmd, startedAt: Date.now() });

  const env = useTor ? torEnv() : process.env as any;
  const proc = exec(cmd, { timeout, env, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
    procs.delete(jobId);
    // If already marked cancelled, don't overwrite
    if (jobs.get(jobId)?.status === "cancelled") return;
    const raw = [stdout, stderr].filter(Boolean).join("\n").substring(0, 30000);
    jobs.set(jobId, {
      status:    err && !raw ? "error" : "complete",
      output:    raw || (err ? err.message : "No output"),
      cmd,
      startedAt: jobs.get(jobId)!.startedAt,
    });
  });
  procs.set(jobId, proc);
}

// ── Tor status ───────────────────────────────────────────────────────────────
router.get("/tor-status", (_req, res) => {
  exec(
    `curl -s --max-time 8 --socks5-hostname 127.0.0.1:9050 https://check.torproject.org/api/ip`,
    { timeout: 10000 },
    (err, stdout) => {
      if (err || !stdout) return res.json({ connected: false, ip: null });
      try {
        const data = JSON.parse(stdout);
        return res.json({ connected: !!data.IsTor, ip: data.IP ?? null });
      } catch {
        return res.json({ connected: false, ip: null });
      }
    },
  );
});

// ── Universal Scanner ────────────────────────────────────────────────────────
// POST /api/alpha/scan
// Body: { mode, target, targetIp, ports, lang, extraFlags, useTor }
//   mode: "network" | "security" | "exploits" | "all"
router.post("/scan", (req, res) => {
  const {
    mode      = "network",
    target    = "",
    targetIp  = "",
    ports     = "1-10000",
    lang      = "",
    extraFlags = "",
    useTor    = false,
  } = req.body as Record<string, any>;

  const jobId   = crypto.randomUUID().substring(0, 8).toUpperCase();
  const htmlOut = path.join(os.tmpdir(), `alpha-scan-${jobId}.html`);

  // Build arg list
  const args: string[] = [SCANNER];

  if (mode === "network" || mode === "all") {
    if (!targetIp && !target) return res.status(400).json({ error: "targetIp or target is required for network scan" });
  }

  if (mode === "network") {
    args.push("--network-only");
    args.push(`--target-ip`, targetIp || target.replace(/https?:\/\//i, "").split("/")[0]);
    if (ports) args.push("--ports", ports.replace(/[^0-9\-,]/g, "").substring(0, 50));
  } else if (mode === "security") {
    if (!target) return res.status(400).json({ error: "target path required for security scan" });
    args.push("--security-only", target);
  } else if (mode === "exploits") {
    if (!target) return res.status(400).json({ error: "target path required for exploit scan" });
    args.push(target, "--exploits", "--deep");
    if (lang) args.push("--lang", lang);
  } else {
    // all — network + security + exploits
    const safeIp = (targetIp || target.replace(/https?:\/\//i, "").split("/")[0])
      .replace(/[^0-9a-zA-Z.\-:]/g, "").substring(0, 100);
    args.push("--network-only", "--target-ip", safeIp, "--ports", ports.replace(/[^0-9\-,]/g, "").substring(0, 50));
  }

  // Output as HTML — the Vuln Verifier reads this file directly
  args.push("-o", htmlOut);

  const safeExtra = (extraFlags as string).replace(/['"`;]/g, "").substring(0, 100);
  const cmdStr = `${torPrefix(useTor)}${PYTHON} ${args.join(" ")} ${safeExtra}`.trim();

  runJob(scanJobs, scanProcs, jobId, cmdStr, useTor);
  return res.status(202).json({ ok: true, jobId, cmd: cmdStr, mode, htmlOut });
});

// GET /api/alpha/scan/:jobId — poll; returns htmlReady:true once the HTML report file exists
router.get("/scan/:jobId", (req, res) => {
  const job = scanJobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: "Job not found" });
  const htmlFile = path.join(os.tmpdir(), `alpha-scan-${req.params.jobId}.html`);
  const htmlReady = fs.existsSync(htmlFile);
  return res.json({ ...job, htmlReady });
});

// DELETE /api/alpha/scan/:jobId — cancel a running scan
router.delete("/scan/:jobId", (req, res) => {
  const { jobId } = req.params;
  const job  = scanJobs.get(jobId);
  const proc = scanProcs.get(jobId);
  if (!job) return res.status(404).json({ error: "Job not found" });
  if (job.status !== "running") return res.json({ ok: true, status: job.status });

  // Kill the process tree
  if (proc?.pid) {
    try { process.kill(-proc.pid, "SIGKILL"); } catch {}
    try { proc.kill("SIGKILL"); } catch {}
  }
  scanProcs.delete(jobId);
  scanJobs.set(jobId, { ...job, status: "cancelled", output: "Scan stopped by user." });
  return res.json({ ok: true, status: "cancelled" });
});

// GET /api/alpha/scan/:jobId/html — returns the raw HTML report for piping into Vuln Verifier
router.get("/scan/:jobId/html", (req, res) => {
  const htmlFile = path.join(os.tmpdir(), `alpha-scan-${req.params.jobId}.html`);
  if (!fs.existsSync(htmlFile)) return res.status(404).json({ error: "HTML report not ready yet" });
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(fs.readFileSync(htmlFile, "utf-8"));
});

// ── Vuln Verifier ────────────────────────────────────────────────────────────
// POST /api/alpha/verify
// Body: { reportHtml, targetUrl, useTor }
router.post("/verify", async (req, res) => {
  const { reportHtml, targetUrl, useTor = false } = req.body as {
    reportHtml?: string; targetUrl?: string; useTor?: boolean;
  };
  if (!reportHtml) return res.status(400).json({ error: "reportHtml is required" });

  const jobId   = crypto.randomUUID().substring(0, 8).toUpperCase();
  const tmpDir  = path.join(os.tmpdir(), `alpha-verify-${jobId}`);
  fs.mkdirSync(tmpDir, { recursive: true });

  const reportPath = path.join(tmpDir, "report.html");
  fs.writeFileSync(reportPath, reportHtml, "utf-8");

  const args: string[] = [VERIFIER, reportPath, "-o", tmpDir];
  if (targetUrl) args.push("--target", targetUrl.replace(/['"]/g, ""));

  const cmdStr = `${torPrefix(useTor)}${PYTHON} ${args.join(" ")}`.trim();
  runJob(verifyJobs, verifyProcs, jobId, cmdStr, useTor, 240000);

  return res.status(202).json({ ok: true, jobId, cmd: cmdStr, tmpDir });
});

// GET /api/alpha/verify/:jobId — poll + attach result files
router.get("/verify/:jobId", (req, res) => {
  const job = verifyJobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: "Job not found" });

  if (job.status !== "running") {
    const tmpDir = path.join(os.tmpdir(), `alpha-verify-${req.params.jobId}`);
    let jsonResult: any = null;
    let htmlReport: string | null = null;
    try {
      const files = fs.existsSync(tmpDir) ? fs.readdirSync(tmpDir) : [];
      const jf = files.find(f => f.endsWith(".json"));
      const hf = files.find(f => f.startsWith("exposure") && f.endsWith(".html"));
      if (jf) jsonResult  = JSON.parse(fs.readFileSync(path.join(tmpDir, jf), "utf-8"));
      if (hf) htmlReport  = fs.readFileSync(path.join(tmpDir, hf), "utf-8").substring(0, 200000);
    } catch {}
    return res.json({ ...job, jsonResult, htmlReport });
  }

  return res.json(job);
});

export default router;
