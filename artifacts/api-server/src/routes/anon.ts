// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Router, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import { anonAccountsTable, nodesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import crypto from "crypto";

const router = Router();

// ── JWT helpers ──────────────────────────────────────────────────────────────

function createAnonJwt(accountNumber: string): string {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(JSON.stringify({
    sub: `anon:${accountNumber}`,
    iat: now,
    exp: now + 60 * 60 * 24 * 90,
  })).toString("base64url");
  const secret = process.env.SESSION_SECRET ?? "";
  const sig = crypto.createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${sig}`;
}

export function verifyAnonJwt(token: string): string | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [header, payload, sig] = parts;
    const secret = process.env.SESSION_SECRET ?? "";
    const expected = crypto.createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url");
    const sigBuf = Buffer.from(sig);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length) return null;
    if (!crypto.timingSafeEqual(sigBuf, expBuf)) return null;
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (!decoded.sub?.startsWith("anon:")) return null;
    if (decoded.exp < Math.floor(Date.now() / 1000)) return null;
    return decoded.sub.slice(5);
  } catch {
    return null;
  }
}

function requireAnonAuth(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return res.status(401).json({ error: "Anon token required" });
  const number = verifyAnonJwt(auth.slice(7));
  if (!number) return res.status(401).json({ error: "Invalid or expired anon token" });
  (req as any).anonAccountNumber = number;
  return next();
}

// ── Key generation ───────────────────────────────────────────────────────────

function generateAccountNumber(): string {
  return Array.from({ length: 16 }, () => crypto.randomInt(0, 10)).join("");
}

function generateWireGuardKeyPair(): { privateKey: string; publicKey: string } {
  const { privateKey: privObj, publicKey: pubObj } = crypto.generateKeyPairSync("x25519");
  const privateRaw = Buffer.from(privObj.export({ type: "pkcs8", format: "der" })).slice(-32);
  const publicRaw = Buffer.from(pubObj.export({ type: "spki", format: "der" })).slice(-32);
  return {
    privateKey: privateRaw.toString("base64"),
    publicKey: publicRaw.toString("base64"),
  };
}

async function allocateAnonIp(): Promise<string> {
  const existing = await db.select({ ip: anonAccountsTable.assignedIp }).from(anonAccountsTable);
  const usedSet = new Set(existing.map((r) => r.ip).filter(Boolean));
  for (let i = 2; i <= 254; i++) {
    const candidate = `10.3.0.${i}`;
    if (!usedSet.has(candidate)) return candidate;
  }
  throw new Error("No available IPs in 10.3.0.0/24");
}

// ── POST /create ─────────────────────────────────────────────────────────────

router.post("/create", async (_req, res) => {
  const accountNumber = generateAccountNumber();
  const { privateKey, publicKey } = generateWireGuardKeyPair();
  const assignedIp = await allocateAnonIp();
  const subscriptionExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const [node] = await db
    .select({ id: nodesTable.id })
    .from(nodesTable)
    .where(eq(nodesTable.status, "active"))
    .limit(1);

  if (!node) return res.status(503).json({ error: "No active VPN nodes available" });

  await db.insert(anonAccountsTable).values({
    accountNumber,
    wgPrivateKey: privateKey,
    wgPublicKey: publicKey,
    assignedIp,
    assignedNodeId: node.id,
    subscriptionExpiresAt,
  });

  return res.json({
    accountNumber,
    expiresAt: subscriptionExpiresAt.toISOString(),
    trialDays: 30,
  });
});

// ── POST /auth ────────────────────────────────────────────────────────────────

router.post("/auth", async (req, res) => {
  let body: { accountNumber: string };
  try {
    body = z.object({ accountNumber: z.string().regex(/^\d{16}$/) }).parse(req.body);
  } catch {
    return res.status(400).json({ error: "Account number must be exactly 16 digits" });
  }

  const [account] = await db
    .select()
    .from(anonAccountsTable)
    .where(eq(anonAccountsTable.accountNumber, body.accountNumber));

  if (!account) return res.status(401).json({ error: "Account not found" });

  const token = createAnonJwt(account.accountNumber);
  return res.json({
    token,
    expiresAt: account.subscriptionExpiresAt?.toISOString() ?? null,
  });
});

// ── GET /status ───────────────────────────────────────────────────────────────

router.get("/status", requireAnonAuth, async (req, res) => {
  const [account] = await db
    .select()
    .from(anonAccountsTable)
    .where(eq(anonAccountsTable.accountNumber, (req as any).anonAccountNumber));

  if (!account) return res.status(404).json({ error: "Account not found" });

  const now = new Date();
  const isActive = account.subscriptionExpiresAt ? account.subscriptionExpiresAt > now : false;
  const daysRemaining = account.subscriptionExpiresAt
    ? Math.max(0, Math.ceil((account.subscriptionExpiresAt.getTime() - now.getTime()) / 86400000))
    : 0;

  return res.json({
    accountNumber: account.accountNumber,
    expiresAt: account.subscriptionExpiresAt?.toISOString() ?? null,
    isActive,
    daysRemaining,
  });
});

// ── GET /servers ──────────────────────────────────────────────────────────────

router.get("/servers", requireAnonAuth, async (_req, res) => {
  const nodes = await db
    .select({
      id: nodesTable.id,
      name: nodesTable.name,
      region: nodesTable.region,
      ipAddress: nodesTable.ipAddress,
      latencyMs: nodesTable.latencyMs,
      status: nodesTable.status,
    })
    .from(nodesTable)
    .where(eq(nodesTable.status, "active"));

  return res.json({ servers: nodes });
});

// ── GET /wg-config ────────────────────────────────────────────────────────────

router.get("/wg-config", requireAnonAuth, async (req, res) => {
  const [account] = await db
    .select()
    .from(anonAccountsTable)
    .where(eq(anonAccountsTable.accountNumber, (req as any).anonAccountNumber));

  if (!account) return res.status(404).json({ error: "Account not found" });

  const now = new Date();
  if (!account.subscriptionExpiresAt || account.subscriptionExpiresAt < now) {
    return res.status(402).json({ error: "Subscription expired" });
  }
  if (!account.wgPrivateKey || !account.assignedIp || !account.assignedNodeId) {
    return res.status(503).json({ error: "VPN credentials not provisioned" });
  }

  const [node] = await db.select().from(nodesTable).where(eq(nodesTable.id, account.assignedNodeId));
  if (!node) return res.status(503).json({ error: "Assigned node not found" });

  const cfg = [
    `[Interface]`,
    `PrivateKey = ${account.wgPrivateKey}`,
    `Address = ${account.assignedIp}/32`,
    `DNS = 1.1.1.1, 1.0.0.1`,
    ``,
    `[Peer]`,
    `PublicKey = ${node.publicKey}`,
    `AllowedIPs = 0.0.0.0/0, ::/0`,
    `Endpoint = ${node.ipAddress}:51820`,
    `PersistentKeepalive = 25`,
  ].join("\n");

  res.setHeader("Content-Type", "text/plain");
  res.setHeader("Content-Disposition", `attachment; filename="proxhqvpn-anon.conf"`);
  return res.send(cfg);
});

export default router;
