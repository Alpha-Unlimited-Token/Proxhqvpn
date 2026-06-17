// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Router } from "express";
import { spawn, execSync } from "child_process";
import { z } from "zod";
import os from "os";
import path from "path";
import fs from "fs";
import { requireVerifiedAsset } from "../lib/verified-assets";

const router = Router();
const SQLMAP_PY = "/home/runner/workspace/tools/sqlmap/sqlmap.py";
const NMAP_BIN = (() => {
  try { return execSync("which nmap").toString().trim(); } catch { return "nmap"; }
})();

interface ScanState {
  output: string[];
  portOutput: string[];
  done: boolean;
  portDone: boolean;
  exitCode: number | null;
  portExitCode: number | null;
  pid: number | null;
  portPid: number | null;
  startedAt: string;
  config: Record<string, unknown>;
}

const activeScans = new Map<string, ScanState>();

// ── GET /api/sqlmap/status ────────────────────────────────────────────────────
router.get("/status", (_req, res) => {
  try {
    const out = execSync(`python3 ${SQLMAP_PY} --version 2>&1`).toString().trim();
    const version = out.split("\n")[0];
    res.json({ installed: true, version, path: SQLMAP_PY });
  } catch {
    res.json({ installed: false, version: null, path: null });
  }
});

// ── POST /api/sqlmap/scan ─────────────────────────────────────────────────────
router.post("/scan", async (req, res) => {
  const body = z.object({
    url: z.string().url("Must be a valid URL"),
    level: z.number().min(1).max(5).default(1),
    risk: z.number().min(1).max(3).default(1),
    dbms: z.string().optional(),
    dumpAll: z.boolean().default(false),
    forms: z.boolean().default(false),
    crawl: z.number().min(0).max(50).default(0),
    fullCrawl: z.boolean().default(false),
    portScan: z.boolean().default(false),
    torEnabled: z.boolean().default(false),
    randomAgent: z.boolean().default(true),
    batch: z.boolean().default(true),
  }).parse(req.body);

  const userId = (req as any).auth?.userId ?? "unknown";
  await requireVerifiedAsset(userId, body.url, req);

  const scanId = `scan_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const outDir = path.join(os.tmpdir(), `sqlmap_${scanId}`);
  fs.mkdirSync(outDir, { recursive: true });

  // ── Build sqlmap args ──
  const args = [
    SQLMAP_PY,
    "-u", body.url,
    "--level", String(body.level),
    "--risk", String(body.risk),
    "--output-dir", outDir,
    "--no-logging",
  ];
  if (body.batch)       args.push("--batch");
  if (body.forms)       args.push("--forms");
  if (body.randomAgent) args.push("--random-agent");
  if (body.dumpAll)     args.push("--dump-all");
  if (body.torEnabled)  args.push("--tor", "--tor-type=SOCKS5", "--tor-port=9050", "--check-tor");
  if (body.dbms)        args.push("--dbms", body.dbms);

  const crawlDepth = body.fullCrawl ? 10 : body.crawl;
  if (crawlDepth > 0) {
    args.push("--crawl", String(crawlDepth));
    // Full crawl: also follow links in scope and parse all forms
    if (body.fullCrawl) {
      args.push("--crawl-exclude", "logout|signout|exit");
      if (!body.forms) args.push("--forms");
    }
  }

  const state: ScanState = {
    output: [],
    portOutput: [],
    done: false,
    portDone: !body.portScan,
    exitCode: null,
    portExitCode: null,
    pid: null,
    portPid: null,
    startedAt: new Date().toISOString(),
    config: body as unknown as Record<string, unknown>,
  };
  activeScans.set(scanId, state);

  // ── Launch sqlmap ──
  const sqlmapProc = spawn("python3", args, {
    env: { ...process.env, PYTHONUNBUFFERED: "1" },
    detached: false,
  });
  state.pid = sqlmapProc.pid ?? null;

  sqlmapProc.stdout.on("data", (d) => {
    state.output.push(...d.toString().split("\n").filter(Boolean));
  });
  sqlmapProc.stderr.on("data", (d) => {
    state.output.push(...d.toString().split("\n").filter(Boolean));
  });
  sqlmapProc.on("close", (code) => {
    state.done = true;
    state.exitCode = code;
    state.pid = null;
  });

  // ── Launch nmap (parallel) ──
  if (body.portScan) {
    try {
      const { hostname } = new URL(body.url);
      state.portOutput.push(`[PORT SCAN] Starting nmap against ${hostname}...`);
      const nmapProc = spawn(NMAP_BIN, [
        "-sV",           // version detection
        "--open",        // show only open ports
        "-T4",           // aggressive timing
        "--top-ports", "1000",  // top 1000 ports
        "-Pn",           // skip host discovery
        hostname,
      ]);
      state.portPid = nmapProc.pid ?? null;

      nmapProc.stdout.on("data", (d) => {
        state.portOutput.push(...d.toString().split("\n").filter(Boolean));
      });
      nmapProc.stderr.on("data", (d) => {
        const lines = d.toString().split("\n").filter(Boolean);
        state.portOutput.push(...lines.map((l: string) => `[nmap] ${l}`));
      });
      nmapProc.on("close", (code) => {
        state.portDone = true;
        state.portExitCode = code;
        state.portPid = null;
        state.portOutput.push(`[PORT SCAN] Complete (exit ${code})`);
      });
    } catch (err: any) {
      state.portOutput.push(`[PORT SCAN] Failed to resolve host: ${err.message}`);
      state.portDone = true;
    }
  }

  // Clean up after 2 hours
  setTimeout(() => activeScans.delete(scanId), 2 * 60 * 60 * 1000);

  res.status(202).json({ scanId, message: "Scan started" });
});

// ── GET /api/sqlmap/scan/:scanId ──────────────────────────────────────────────
router.get("/scan/:scanId", (req, res) => {
  const scan = activeScans.get(req.params.scanId);
  if (!scan) return res.status(404).json({ error: "Scan not found or expired" });
  res.json({
    scanId: req.params.scanId,
    output: scan.output,
    portOutput: scan.portOutput,
    done: scan.done,
    portDone: scan.portDone,
    exitCode: scan.exitCode,
    startedAt: scan.startedAt,
    config: scan.config,
  });
});

// ── DELETE /api/sqlmap/scan/:scanId — cancel ──────────────────────────────────
router.delete("/scan/:scanId", (req, res) => {
  const scan = activeScans.get(req.params.scanId);
  if (!scan) return res.status(404).json({ error: "Scan not found" });

  if (scan.pid) {
    try { process.kill(scan.pid, "SIGTERM"); } catch {}
  }
  if (scan.portPid) {
    try { process.kill(scan.portPid, "SIGTERM"); } catch {}
  }
  scan.done = true;
  scan.portDone = true;
  scan.output.push("[SCAN CANCELLED BY USER]");
  activeScans.delete(req.params.scanId);
  res.json({ cancelled: true });
});

// ── GET /api/sqlmap/scan/:scanId/report — download full report ────────────────
router.get("/scan/:scanId/report", (req, res) => {
  const scan = activeScans.get(req.params.scanId);
  if (!scan) return res.status(404).json({ error: "Scan not found or expired" });

  const fmt = (req.query.format as string) ?? "html";
  const cfg = scan.config as any;
  const vulnerable = scan.output.some(l => /vulnerable|injection point found/i.test(l));
  const openPorts = scan.portOutput.filter(l => /^\d+\/tcp\s+open/i.test(l));
  const now = new Date().toISOString();

  if (fmt === "json") {
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="proxhqvpn-scan-${req.params.scanId}.json"`);
    return res.json({
      reportType: "ProxhqVPN Vulnerability Scan Report",
      generatedAt: now,
      scanId: req.params.scanId,
      target: cfg.url,
      config: cfg,
      result: vulnerable ? "VULNERABLE" : "CLEAN",
      sqlmapOutput: scan.output,
      portScan: scan.portOutput,
      openPorts,
    });
  }

  // Default: HTML report
  const statusColor = vulnerable ? "#ff4141" : "#00ff88";
  const statusText  = vulnerable ? "⚠ SQL INJECTION VULNERABILITY DETECTED" : "✓ No SQL Injection Vulnerabilities Found";

  const esc = (s: string) => s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  const lineColor = (l: string) => {
    if (/\[ERROR\]/i.test(l))   return "#ff6b6b";
    if (/\[WARNING\]/i.test(l)) return "#ffd93d";
    if (/vulnerable|found/i.test(l)) return "#ff4141";
    if (/\[INFO\]/i.test(l))    return "#a8a8b3";
    if (/\[SUCCESS\]/i.test(l)) return "#00ff88";
    return "#6b7280";
  };
  const renderLine = (l: string) => `<div style="color:${lineColor(l)};font-size:12px;line-height:1.6;">${esc(l)}</div>`;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>ProxhqVPN Scan Report — ${esc(cfg.url ?? "")}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #0a0f0c; color: #e0e0e0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 40px; max-width: 960px; margin: 0 auto; }
    h1 { font-size: 24px; color: #00ff88; margin-bottom: 4px; }
    .subtitle { color: #555; font-size: 13px; margin-bottom: 32px; }
    .badge { display: inline-block; font-size: 14px; font-weight: 700; padding: 8px 20px; border-radius: 8px; border: 1px solid ${statusColor}40; color: ${statusColor}; background: ${statusColor}10; margin-bottom: 28px; }
    .card { background: #0d1a11; border: 1px solid #1a2e20; border-radius: 12px; padding: 24px; margin-bottom: 24px; }
    .card h2 { font-size: 14px; color: #00ff8880; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 16px; }
    .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #1a2e20; font-size: 13px; }
    .row:last-child { border-bottom: none; }
    .label { color: #6b7280; }
    .value { color: #e0e0e0; font-family: monospace; text-align: right; max-width: 60%; word-break: break-all; }
    .terminal { background: #060c08; border-radius: 8px; padding: 16px; font-family: 'Courier New', monospace; overflow-x: auto; }
    .port-open { color: #00ff88; font-weight: 600; }
    footer { margin-top: 40px; text-align: center; font-size: 11px; color: #333; }
    @media print { body { background: white; color: black; } .card { border-color: #ccc; } }
  </style>
</head>
<body>
  <h1>ProxhqVPN Vulnerability Scan Report</h1>
  <div class="subtitle">ALPHA UNLIMITED TECHNOLOGIES LLC · Generated ${now}</div>
  <div class="badge">${statusText}</div>

  <div class="card">
    <h2>Scan Configuration</h2>
    ${[
      ["Target URL", cfg.url ?? "—"],
      ["Scan ID", req.params.scanId],
      ["Started At", scan.startedAt],
      ["Scan Depth (Level)", `${cfg.level} — ${["","Basic","Standard","Deep","Extended","Maximum"][cfg.level] ?? ""}`],
      ["Risk Level", `${cfg.risk} — ${["","Safe","Moderate","Aggressive"][cfg.risk] ?? ""}`],
      ["Form Scanning", cfg.forms ? "Enabled" : "Disabled"],
      ["Browser Disguise", cfg.randomAgent ? "Enabled" : "Disabled"],
      ["Page Crawl", cfg.fullCrawl ? "Full Site Crawl" : cfg.crawl > 0 ? `Depth ${cfg.crawl}` : "Disabled"],
      ["Port Scan", cfg.portScan ? "Enabled (nmap top-1000)" : "Disabled"],
      ["Database Type", cfg.dbms || "Auto-detect"],
    ].map(([l, v]) => `<div class="row"><span class="label">${l}</span><span class="value">${esc(String(v))}</span></div>`).join("")}
  </div>

  ${openPorts.length > 0 ? `
  <div class="card">
    <h2>Open Ports Discovered</h2>
    <div class="terminal">
      ${openPorts.map(l => `<div class="port-open">${esc(l)}</div>`).join("")}
    </div>
  </div>` : ""}

  ${scan.portOutput.length > 0 ? `
  <div class="card">
    <h2>Port Scan Full Output (nmap)</h2>
    <div class="terminal">
      ${scan.portOutput.map(renderLine).join("")}
    </div>
  </div>` : ""}

  <div class="card">
    <h2>SQL Injection Scan Output (SQLMap)</h2>
    <div class="terminal">
      ${scan.output.length > 0 ? scan.output.map(renderLine).join("") : '<div style="color:#333;">No output captured.</div>'}
    </div>
  </div>

  <footer>
    ProxhqVPN · ALPHA UNLIMITED TECHNOLOGIES LLC · Only test systems you own or have permission to test.
  </footer>
</body>
</html>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="proxhqvpn-scan-${req.params.scanId}.html"`);
  res.send(html);
});

export default router;
