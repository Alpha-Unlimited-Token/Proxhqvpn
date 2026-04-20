import { Router } from "express";
import { spawn } from "child_process";
import { z } from "zod";

const router = Router();
const SQLMAP = "python3 /home/runner/workspace/tools/sqlmap/sqlmap.py";
const activeScans = new Map<string, { output: string[]; done: boolean; exitCode: number | null }>();

router.get("/status", (_req, res) => {
  try {
    const { execSync } = require("child_process");
    const out = execSync(`python3 /home/runner/workspace/tools/sqlmap/sqlmap.py --version 2>&1`).toString().trim();
    const version = out.split("\n")[0];
    res.json({ installed: true, version, path: "/home/runner/workspace/tools/sqlmap/sqlmap.py" });
  } catch {
    res.json({ installed: false, version: null, path: null });
  }
});

router.post("/scan", async (req, res) => {
  const body = z.object({
    url: z.string().url("Must be a valid URL"),
    level: z.number().min(1).max(5).default(1),
    risk: z.number().min(1).max(3).default(1),
    dbms: z.string().optional(),
    dumpAll: z.boolean().default(false),
    forms: z.boolean().default(false),
    crawl: z.number().min(0).max(3).default(0),
    torEnabled: z.boolean().default(false),
    randomAgent: z.boolean().default(true),
    batch: z.boolean().default(true),
  }).parse(req.body);

  const scanId = `scan_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  const args = [
    "/home/runner/workspace/tools/sqlmap/sqlmap.py",
    "-u", body.url,
    "--level", String(body.level),
    "--risk", String(body.risk),
    "--output-dir", `/tmp/sqlmap_${scanId}`,
  ];

  if (body.batch)       args.push("--batch");
  if (body.forms)       args.push("--forms");
  if (body.randomAgent) args.push("--random-agent");
  if (body.dumpAll)     args.push("--dump-all");
  if (body.torEnabled)  args.push("--tor");
  if (body.dbms)        args.push("--dbms", body.dbms);
  if (body.crawl > 0)   args.push("--crawl", String(body.crawl));
  args.push("--no-logging");

  activeScans.set(scanId, { output: [], done: false, exitCode: null });

  const proc = spawn("python3", args, { env: { ...process.env } });

  proc.stdout.on("data", (d) => {
    const lines = d.toString().split("\n").filter(Boolean);
    const scan = activeScans.get(scanId);
    if (scan) scan.output.push(...lines);
  });

  proc.stderr.on("data", (d) => {
    const lines = d.toString().split("\n").filter(Boolean);
    const scan = activeScans.get(scanId);
    if (scan) scan.output.push(...lines);
  });

  proc.on("close", (code) => {
    const scan = activeScans.get(scanId);
    if (scan) { scan.done = true; scan.exitCode = code; }
    setTimeout(() => activeScans.delete(scanId), 30 * 60 * 1000);
  });

  res.status(202).json({ scanId, message: "Scan started" });
});

router.get("/scan/:scanId", (req, res) => {
  const scan = activeScans.get(req.params.scanId);
  if (!scan) return res.status(404).json({ error: "Scan not found or expired" });
  res.json({ scanId: req.params.scanId, output: scan.output, done: scan.done, exitCode: scan.exitCode });
});

router.delete("/scan/:scanId", (req, res) => {
  activeScans.delete(req.params.scanId);
  res.json({ deleted: true });
});

export default router;
