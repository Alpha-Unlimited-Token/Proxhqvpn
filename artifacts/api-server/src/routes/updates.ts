// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Router, type Request, type Response } from "express";
import { requireAdmin } from "../middlewares/requireAdmin";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import multer from "multer";

const router = Router();

// Persistent storage for update manifests and installer files
const UPDATES_DIR = path.resolve(process.cwd(), "../../updates-store");
const CONFIG_FILE = path.join(UPDATES_DIR, "versions.json");
const FILES_DIR = path.join(UPDATES_DIR, "files");

// Ensure directories exist
if (!fs.existsSync(UPDATES_DIR)) fs.mkdirSync(UPDATES_DIR, { recursive: true });
if (!fs.existsSync(FILES_DIR)) fs.mkdirSync(FILES_DIR, { recursive: true });

// Multer for installer uploads (up to 500MB)
const upload = multer({
  dest: FILES_DIR,
  limits: { fileSize: 500 * 1024 * 1024 },
});

type Platform = "win" | "mac" | "linux";

interface VersionEntry {
  version: string;
  releaseDate: string;
  url: string;           // full download URL
  sha512: string;
  size: number;
  filename: string;
  storedLocally: boolean;
}

interface VersionsConfig {
  win?: VersionEntry;
  mac?: VersionEntry;
  linux?: VersionEntry;
}

function readConfig(): VersionsConfig {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
  } catch {
    return {};
  }
}

function writeConfig(data: VersionsConfig) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2));
}

function sha512File(filePath: string): string {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash("sha512").update(buf).digest("base64");
}

function getBaseUrl(req: Request): string {
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers.host;
  return `${proto}://${host}`;
}

// ── Public: serve update manifests ──────────────────────────────────────────

// Windows: GET /api/updates/win/latest.yml
router.get("/win/latest.yml", (req: Request, res: Response) => {
  const cfg = readConfig();
  const entry = cfg.win;
  if (!entry) return res.status(404).send("# No update published yet\n");

  const downloadUrl = entry.storedLocally
    ? `${getBaseUrl(req)}/api/updates/download/${encodeURIComponent(entry.filename)}`
    : entry.url;

  const yaml = `version: ${entry.version}\nfiles:\n  - url: ${downloadUrl}\n    sha512: ${entry.sha512}\n    size: ${entry.size}\npath: ${downloadUrl}\nsha512: ${entry.sha512}\nreleaseDate: '${entry.releaseDate}'\n`;
  res.setHeader("Content-Type", "text/yaml");
  res.send(yaml);
});

// macOS: GET /api/updates/mac/latest-mac.yml
router.get("/mac/latest-mac.yml", (req: Request, res: Response) => {
  const cfg = readConfig();
  const entry = cfg.mac;
  if (!entry) return res.status(404).send("# No update published yet\n");

  const downloadUrl = entry.storedLocally
    ? `${getBaseUrl(req)}/api/updates/download/${encodeURIComponent(entry.filename)}`
    : entry.url;

  const yaml = `version: ${entry.version}\nfiles:\n  - url: ${downloadUrl}\n    sha512: ${entry.sha512}\n    size: ${entry.size}\npath: ${downloadUrl}\nsha512: ${entry.sha512}\nreleaseDate: '${entry.releaseDate}'\n`;
  res.setHeader("Content-Type", "text/yaml");
  res.send(yaml);
});

// Linux: GET /api/updates/linux/latest-linux.yml
router.get("/linux/latest-linux.yml", (req: Request, res: Response) => {
  const cfg = readConfig();
  const entry = cfg.linux;
  if (!entry) return res.status(404).send("# No update published yet\n");

  const downloadUrl = entry.storedLocally
    ? `${getBaseUrl(req)}/api/updates/download/${encodeURIComponent(entry.filename)}`
    : entry.url;

  const yaml = `version: ${entry.version}\nfiles:\n  - url: ${downloadUrl}\n    sha512: ${entry.sha512}\n    size: ${entry.size}\npath: ${downloadUrl}\nsha512: ${entry.sha512}\nreleaseDate: '${entry.releaseDate}'\n`;
  res.setHeader("Content-Type", "text/yaml");
  res.send(yaml);
});

// Installer file download
router.get("/download/:filename", (req: Request, res: Response) => {
  const filename = path.basename(String(req.params.filename));
  const filePath = path.join(FILES_DIR, filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: "File not found" });
  res.download(filePath, filename);
});

// ── Public: current version info (used by app to show "update available") ──
router.get("/info", (_req: Request, res: Response) => {
  const cfg = readConfig();
  res.json(cfg);
});

// ── Admin: publish update by uploading installer file ───────────────────────
router.post(
  "/publish/upload",
  requireAdmin,
  upload.single("installer"),
  async (req: Request, res: Response) => {
    try {
      const { version, platform } = req.body as { version: string; platform: string };
      const file = (req as any).file;

      if (!version || !platform || !file) {
        return res.status(400).json({ error: "version, platform, and installer file are required" });
      }

      const validPlatforms: Platform[] = ["win", "mac", "linux"];
      if (!validPlatforms.includes(platform as Platform)) {
        return res.status(400).json({ error: "platform must be win, mac, or linux" });
      }

      // Rename uploaded file to its original name
      const originalName = file.originalname as string;
      const destPath = path.join(FILES_DIR, originalName);
      fs.renameSync(file.path, destPath);

      const sha512 = sha512File(destPath);
      const size = fs.statSync(destPath).size;
      const releaseDate = new Date().toISOString().split("T")[0];

      const cfg = readConfig();
      (cfg as any)[platform] = {
        version,
        releaseDate,
        filename: originalName,
        url: "",
        sha512,
        size,
        storedLocally: true,
      } as VersionEntry;
      writeConfig(cfg);

      res.json({ ok: true, version, platform, sha512, size, filename: originalName });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

// ── Admin: publish update by providing an external download URL ─────────────
router.post("/publish/url", requireAdmin, async (req: Request, res: Response) => {
  try {
    const { version, platform, url, sha512, size } = req.body as {
      version: string;
      platform: string;
      url: string;
      sha512: string;
      size: number;
    };

    if (!version || !platform || !url || !sha512) {
      return res.status(400).json({ error: "version, platform, url, and sha512 are required" });
    }

    const validPlatforms: Platform[] = ["win", "mac", "linux"];
    if (!validPlatforms.includes(platform as Platform)) {
      return res.status(400).json({ error: "platform must be win, mac, or linux" });
    }

    const filename = url.split("/").pop() || `ProxhqVPN-${version}-${platform}`;
    const releaseDate = new Date().toISOString().split("T")[0];

    const cfg = readConfig();
    (cfg as any)[platform] = {
      version,
      releaseDate,
      filename,
      url,
      sha512,
      size: Number(size) || 0,
      storedLocally: false,
    } as VersionEntry;
    writeConfig(cfg);

    res.json({ ok: true, version, platform });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Admin: get current published versions ────────────────────────────────────
router.get("/admin/versions", requireAdmin, (_req: Request, res: Response) => {
  res.json(readConfig());
});

// ── Admin: delete a platform's update entry ──────────────────────────────────
router.delete("/admin/:platform", requireAdmin, (req: Request, res: Response) => {
  const { platform } = req.params as { platform: Platform };
  const cfg = readConfig();
  if ((cfg as any)[platform]) {
    const entry = (cfg as any)[platform] as VersionEntry;
    if (entry.storedLocally) {
      const filePath = path.join(FILES_DIR, entry.filename);
      try { fs.unlinkSync(filePath); } catch {}
    }
    delete (cfg as any)[platform];
    writeConfig(cfg);
  }
  res.json({ ok: true });
});

// ── Public: version check endpoint (used by web app "Check for Updates" button)
// Returns the latest published version and changelog so the Downloads page
// can show "up to date" vs "update available" without needing the standalone server.
const CURRENT_VERSION   = "2.1.0";
const CURRENT_RELEASE_DATE = "2026-06-06";
const CURRENT_CHANGELOG = [
  "⚔ Counter Attack tab on Ghost Trap — live interactive tools to counter captured hackers",
  "Counter Attack: TCP port scanner across 24 attacker-relevant ports (C2, reverse shells, Tor, attack proxies)",
  "Counter Attack: OSINT Deep Dive — reverse DNS, live geo, ISP/ASN, auto-generated abuse report contacts",
  "Counter Attack: Canary Beacon Injector — 6 beacon types (Pixel, JS fingerprint, Fake AWS Key, JWT, DNS, SQL OOB)",
  "Counter Attack: External tool launchers (Ghost Chain, Subdomain Scout, OSINT Recon, Threat Intel)",
  "Counter Attack: 5-phase counter-attack playbook (Harvest → Fingerprint → Active Connection → Per-Attack Techniques → Report)",
  "Counter Attack: Per-attack-type counter cards (SQLi, XSS, CMDi, auth brute, LFI, recon scanner)",
  "Ghost Trap honeypot — personal device & website modes with instant law-enforcement incident reports",
  "Canary Tokens — 12 token types including AWS Key, Redirect URL, SQL Token, PowerShell, PDF, Slack Webhook",
  "Kill Switch — full IPv6 leak protection with ip6tables mirroring",
  "DNS Sinkhole — Pi-hole style per-category blocking (Ads/Trackers/Malware/Phishing/Cryptomining/Botnet/Adult)",
  "Network Monitor — real-time traffic flow analysis across all 60 VPN nodes",
  "Security Event Log (SIEM) — unified event timeline with severity filtering",
  "OSINT Recon — DNS, TLS, HTTP headers, email security, ASN fingerprinting",
  "QuantumAudit — standalone blockchain security auditing for classical + post-quantum vulnerabilities",
  "Signature Mining Engine — 5-engine parallel ECDSA key recovery and blockchain intelligence suite",
  "JWT Analyzer — JWKS injection, X5U, Embedded JWK, kid SQL/path injection, Claim Escalation attacks",
  "Subdomain Scanner — 9 passive OSINT sources (crt.sh, AlienVault OTX, HackerTarget, URLScan.io, Wayback, AnubisDB, RapidDNS, ThreatCrowd, BufferOver)",
  "Directory Fuzzer — recursive scanning depth 3 with response-size filtering",
  "Security hardening: SSRF guard, DB index layer, pool limits, spawn hardening",
];

router.get("/check", (_req, res) => {
  res.json({
    version: CURRENT_VERSION,
    releaseDate: CURRENT_RELEASE_DATE,
    changelog: CURRENT_CHANGELOG,
  });
});

export default router;
