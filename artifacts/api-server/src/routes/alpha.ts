// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Router } from "express";
import { exec, spawn } from "child_process";
import path from "path";
import fs from "fs";
import os from "os";
import crypto from "crypto";
import multer from "multer";

const router = Router();

// ── Multer config — accept ZIP / tar.gz uploads up to 100 MB ─────────────────
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, os.tmpdir()),
    filename:    (_req, file, cb) => {
      const id  = crypto.randomUUID().substring(0, 8).toUpperCase();
      const ext = path.extname(file.originalname).toLowerCase() || ".zip";
      cb(null, `alpha-upload-${id}${ext}`);
    },
  }),
  limits: { fileSize: 100 * 1024 * 1024 },  // 100 MB
  fileFilter: (_req, file, cb) => {
    const allowed = [".zip", ".tar", ".gz", ".tgz", ".bz2"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext) || file.mimetype.includes("zip") || file.mimetype.includes("compressed")) {
      cb(null, true);
    } else {
      cb(new Error("Only ZIP and TAR archives are accepted"));
    }
  },
});

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

  // Allow CIDR notation (e.g. 10.0.0.0/24) — permit slash in IP field
  const sanitizeTarget = (raw: string) =>
    raw.replace(/https?:\/\//i, "").replace(/[^0-9a-zA-Z.\-:\/]/g, "").substring(0, 100);

  if (mode === "network") {
    const safeIp = sanitizeTarget(targetIp || target);
    args.push("--network-only");
    args.push(`--target-ip`, safeIp);
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
    const safeIp = sanitizeTarget(targetIp || target);
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

// GET /api/alpha/scan/:jobId/export?format=txt|csv|json
// Parses nmap-style output from the completed scan job into the requested format
router.get("/scan/:jobId/export", (req, res) => {
  const job = scanJobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: "Job not found" });
  if (job.status === "running") return res.status(409).json({ error: "Scan still running" });
  if (!job.output) return res.status(404).json({ error: "No output available" });

  const fmt = (req.query.format as string ?? "txt").toLowerCase();
  const raw = job.output;

  if (fmt === "txt") {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="proxhqvpn-scan-${req.params.jobId}.txt"`);
    return res.send(raw);
  }

  // Parse nmap output into structured records
  // Format: "22/tcp   open  ssh     OpenSSH 8.9p1"
  interface ScanRow { host: string; port: string; protocol: string; state: string; service: string; version: string }
  const rows: ScanRow[] = [];
  let currentHost = "";

  for (const line of raw.split("\n")) {
    const hostMatch = line.match(/^Nmap scan report for (.+)/);
    if (hostMatch) { currentHost = hostMatch[1].trim(); continue; }
    const portMatch = line.match(/^(\d+)\/(tcp|udp)\s+(\S+)\s+(\S+)\s*(.*)/);
    if (portMatch) {
      rows.push({
        host:     currentHost,
        port:     portMatch[1],
        protocol: portMatch[2],
        state:    portMatch[3],
        service:  portMatch[4],
        version:  portMatch[5].trim(),
      });
    }
  }

  if (fmt === "json") {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="proxhqvpn-scan-${req.params.jobId}.json"`);
    return res.json({ jobId: req.params.jobId, generatedAt: new Date().toISOString(), hosts: rows });
  }

  if (fmt === "csv") {
    const header = "host,port,protocol,state,service,version";
    const lines  = rows.map(r =>
      [r.host, r.port, r.protocol, r.state, r.service, `"${r.version.replace(/"/g, '""')}"`].join(",")
    );
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="proxhqvpn-scan-${req.params.jobId}.csv"`);
    return res.send([header, ...lines].join("\n"));
  }

  return res.status(400).json({ error: "format must be txt, csv, or json" });
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

// ── App Scanner ───────────────────────────────────────────────────────────────
const APP_SCANNER    = path.join(TOOLS_DIR, "alpha_app_scanner.py");
const appScanJobs:   Map<string, Job & { htmlOut: string; jsonOut: string; filename: string }> = new Map();

// POST /api/alpha/app-scan  — multipart ZIP upload
router.post("/app-scan", (req, res, next) => {
  upload.single("archive")(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });

    const file = (req as any).file;
    if (!file) return res.status(400).json({ error: "No archive file provided. Send as multipart field 'archive'." });

    const jobId   = crypto.randomUUID().substring(0, 8).toUpperCase();
    const htmlOut = path.join(os.tmpdir(), `alpha-appscan-${jobId}.html`);
    const jsonOut = htmlOut + ".json";

    const args = [
      APP_SCANNER,
      "--zip",  file.path,
      "--out",  htmlOut,
      "--json",
    ];
    const cmdStr = `${PYTHON} ${args.join(" ")}`;

    const job: any = { status: "running", output: null, cmd: cmdStr, startedAt: Date.now(), htmlOut, jsonOut, filename: file.originalname };
    appScanJobs.set(jobId, job);

    exec(cmdStr, { timeout: 300000, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      // Clean up the uploaded zip after scanning
      try { fs.unlinkSync(file.path); } catch {}
      if (appScanJobs.get(jobId)?.status === "cancelled") return;
      const raw = [stdout, stderr].filter(Boolean).join("\n").substring(0, 30000);
      appScanJobs.set(jobId, {
        ...job,
        status:  err && !raw ? "error" : "complete",
        output:  raw || (err ? err.message : "No output"),
      });
    });

    return res.status(202).json({ ok: true, jobId, filename: file.originalname, cmd: cmdStr });
  });
});

// GET /api/alpha/app-scan/:jobId — poll job status
router.get("/app-scan/:jobId", (req, res) => {
  const job = appScanJobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: "Job not found" });
  const htmlReady = fs.existsSync(job.htmlOut);
  const jsonReady = fs.existsSync(job.jsonOut);
  return res.json({ ...job, htmlReady, jsonReady });
});

// GET /api/alpha/app-scan/:jobId/html — download HTML report
router.get("/app-scan/:jobId/html", (req, res) => {
  const job = appScanJobs.get(req.params.jobId);
  if (!job || !fs.existsSync(job.htmlOut)) return res.status(404).json({ error: "HTML report not ready" });
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="app-scan-${req.params.jobId}.html"`);
  res.send(fs.readFileSync(job.htmlOut, "utf-8"));
});

// GET /api/alpha/app-scan/:jobId/json — download JSON summary
router.get("/app-scan/:jobId/json", (req, res) => {
  const job = appScanJobs.get(req.params.jobId);
  if (!job || !fs.existsSync(job.jsonOut)) return res.status(404).json({ error: "JSON report not ready" });
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", `attachment; filename="app-scan-${req.params.jobId}.json"`);
  res.send(fs.readFileSync(job.jsonOut, "utf-8"));
});

// DELETE /api/alpha/app-scan/:jobId — cancel / delete job
router.delete("/app-scan/:jobId", (req, res) => {
  const job = appScanJobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: "Job not found" });
  // Clean up report files
  try { if (fs.existsSync(job.htmlOut)) fs.unlinkSync(job.htmlOut); } catch {}
  try { if (fs.existsSync(job.jsonOut)) fs.unlinkSync(job.jsonOut); } catch {}
  appScanJobs.set(req.params.jobId, { ...job, status: "cancelled", output: "Cancelled by user." });
  return res.json({ ok: true });
});

export default router;
