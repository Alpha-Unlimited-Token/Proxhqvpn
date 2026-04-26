import { Router } from "express";
import * as tls from "tls";
import * as https from "https";
import * as net from "net";

const router = Router();

interface CertInfo {
  subject: Record<string, string>;
  issuer: Record<string, string>;
  validFrom: string;
  validTo: string;
  daysRemaining: number;
  fingerprint: string;
  serialNumber: string;
  subjectAltNames: string[];
  selfSigned: boolean;
}

interface TlsResult {
  host: string;
  port: number;
  grade: string;
  score: number;
  protocol: string;
  cert: CertInfo | null;
  ciphers: string[];
  supportedProtocols: { version: string; supported: boolean }[];
  vulnerabilities: { id: string; name: string; severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW"; description: string; vulnerable: boolean }[];
  hsts: boolean;
  ocspStapling: boolean;
  error?: string;
  scannedAt: string;
}

function parseDN(dn: string): Record<string, string> {
  const out: Record<string, string> = {};
  dn.split("/").filter(Boolean).forEach(part => {
    const idx = part.indexOf("=");
    if (idx > 0) out[part.slice(0, idx)] = part.slice(idx + 1);
  });
  return out;
}

function gradeFromScore(score: number): string {
  if (score >= 90) return "A+";
  if (score >= 80) return "A";
  if (score >= 70) return "B";
  if (score >= 60) return "C";
  if (score >= 50) return "D";
  return "F";
}

async function checkProtocol(host: string, port: number, version: "TLSv1" | "TLSv1.1" | "TLSv1.2" | "TLSv1.3"): Promise<boolean> {
  return new Promise((resolve) => {
    const minMax: Record<string, { minVersion?: tls.SecureVersion; maxVersion?: tls.SecureVersion }> = {
      "TLSv1":   { minVersion: "TLSv1",   maxVersion: "TLSv1" },
      "TLSv1.1": { minVersion: "TLSv1.1", maxVersion: "TLSv1.1" },
      "TLSv1.2": { minVersion: "TLSv1.2", maxVersion: "TLSv1.2" },
      "TLSv1.3": { minVersion: "TLSv1.3", maxVersion: "TLSv1.3" },
    };
    const opts = minMax[version];
    const socket = tls.connect({ host, port, servername: host, rejectUnauthorized: false, timeout: 4000, ...opts }, () => {
      socket.destroy();
      resolve(true);
    });
    socket.on("error", () => resolve(false));
    socket.on("timeout", () => { socket.destroy(); resolve(false); });
  });
}

async function checkHsts(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const req = https.request({ host, port, path: "/", method: "HEAD", timeout: 4000, rejectUnauthorized: false }, (res) => {
      resolve(!!res.headers["strict-transport-security"]);
    });
    req.on("error", () => resolve(false));
    req.on("timeout", () => { req.destroy(); resolve(false); });
    req.end();
  });
}

router.post("/scan", async (req, res) => {
  const { host, port: rawPort } = req.body as { host?: string; port?: number };
  if (!host || typeof host !== "string") return res.status(400).json({ error: "host required" });

  const cleanHost = host.replace(/^https?:\/\//, "").split("/")[0];
  const port = Number(rawPort) || 443;

  const result: TlsResult = {
    host: cleanHost,
    port,
    grade: "F",
    score: 0,
    protocol: "",
    cert: null,
    ciphers: [],
    supportedProtocols: [],
    vulnerabilities: [],
    hsts: false,
    ocspStapling: false,
    scannedAt: new Date().toISOString(),
  };

  // Main TLS connection to grab cert + cipher
  await new Promise<void>((resolve) => {
    const socket = tls.connect({
      host: cleanHost, port, servername: cleanHost,
      rejectUnauthorized: false, timeout: 8000,
      minVersion: "TLSv1" as tls.SecureVersion,
    }, () => {
      result.protocol = socket.getProtocol() || "";
      result.ciphers = [socket.getCipher()?.name || ""].filter(Boolean);

      const cert = socket.getPeerCertificate(true);
      if (cert && cert.subject) {
        const now = Date.now();
        const validTo = new Date(cert.valid_to);
        const validFrom = new Date(cert.valid_from);
        const selfSigned = cert.issuer?.CN === cert.subject?.CN;
        const altNames: string[] = [];
        const san = (cert as any).subjectaltname || "";
        san.split(",").forEach((s: string) => {
          const v = s.trim().replace(/^DNS:/, "");
          if (v) altNames.push(v);
        });

        result.cert = {
          subject: cert.subject as unknown as Record<string, string>,
          issuer: cert.issuer as unknown as Record<string, string>,
          validFrom: validFrom.toISOString(),
          validTo: validTo.toISOString(),
          daysRemaining: Math.floor((validTo.getTime() - now) / 86400000),
          fingerprint: cert.fingerprint || "",
          serialNumber: cert.serialNumber || "",
          subjectAltNames: altNames,
          selfSigned,
        };
      }
      socket.destroy();
      resolve();
    });
    socket.on("error", () => resolve());
    socket.on("timeout", () => { socket.destroy(); resolve(); });
  });

  if (!result.cert && !result.protocol) {
    return res.json({ ...result, error: "Could not connect to host" });
  }

  // Protocol support checks
  const [v1, v11, v12, v13] = await Promise.all([
    checkProtocol(cleanHost, port, "TLSv1"),
    checkProtocol(cleanHost, port, "TLSv1.1"),
    checkProtocol(cleanHost, port, "TLSv1.2"),
    checkProtocol(cleanHost, port, "TLSv1.3"),
  ]);

  result.supportedProtocols = [
    { version: "TLS 1.0", supported: v1 },
    { version: "TLS 1.1", supported: v11 },
    { version: "TLS 1.2", supported: v12 },
    { version: "TLS 1.3", supported: v13 },
  ];

  // HSTS check
  result.hsts = await checkHsts(cleanHost, port);

  // Vulnerability checks
  const weakCipher = result.ciphers.some(c =>
    /RC4|DES|3DES|EXPORT|NULL|anon/i.test(c)
  );
  const cert = result.cert;

  result.vulnerabilities = [
    {
      id: "POODLE", name: "POODLE (SSL 3.0 Downgrade)",
      severity: "HIGH", description: "SSLv3 allows POODLE attack — padding oracle on degraded legacy encryption.",
      vulnerable: v1,
    },
    {
      id: "BEAST", name: "BEAST (TLS 1.0 CBC)",
      severity: "HIGH", description: "TLS 1.0 with CBC ciphers is susceptible to the BEAST attack.",
      vulnerable: v1,
    },
    {
      id: "SWEET32", name: "SWEET32 (64-bit block cipher)",
      severity: "MEDIUM", description: "3DES and Blowfish use 64-bit blocks vulnerable to birthday attacks.",
      vulnerable: result.ciphers.some(c => /3DES|DES-CBC3/i.test(c)),
    },
    {
      id: "WEAK_CIPHER", name: "Weak Cipher Suite",
      severity: "HIGH", description: "RC4, NULL, EXPORT, or anonymous cipher suites detected.",
      vulnerable: weakCipher,
    },
    {
      id: "EXPIRED_CERT", name: "Expired Certificate",
      severity: "CRITICAL", description: "The server certificate has expired.",
      vulnerable: !!cert && cert.daysRemaining < 0,
    },
    {
      id: "EXPIRING_CERT", name: "Certificate Expiring Soon",
      severity: "MEDIUM", description: "Certificate expires within 30 days.",
      vulnerable: !!cert && cert.daysRemaining >= 0 && cert.daysRemaining < 30,
    },
    {
      id: "SELF_SIGNED", name: "Self-Signed Certificate",
      severity: "HIGH", description: "Certificate is self-signed and will not be trusted by browsers.",
      vulnerable: !!cert && cert.selfSigned,
    },
    {
      id: "NO_HSTS", name: "Missing HSTS Header",
      severity: "MEDIUM", description: "Strict-Transport-Security header not set — allows downgrade attacks.",
      vulnerable: !result.hsts,
    },
    {
      id: "TLS12_ABSENT", name: "TLS 1.2 Not Supported",
      severity: "HIGH", description: "TLS 1.2 is the minimum acceptable version for modern security.",
      vulnerable: !v12,
    },
  ];

  // Scoring
  let score = 100;
  if (!v13 && !v12) score -= 30;
  else if (!v13) score -= 5;
  if (v1) score -= 20;
  if (v11) score -= 10;
  if (weakCipher) score -= 25;
  if (!result.hsts) score -= 10;
  if (cert) {
    if (cert.daysRemaining < 0) score -= 30;
    else if (cert.daysRemaining < 30) score -= 15;
    if (cert.selfSigned) score -= 20;
  } else {
    score -= 40;
  }
  score = Math.max(0, Math.min(100, score));
  result.score = score;
  result.grade = gradeFromScore(score);

  res.json(result);
});

export default router;
