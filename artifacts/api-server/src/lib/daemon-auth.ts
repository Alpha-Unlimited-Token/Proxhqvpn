// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Per-node HMAC-SHA256 daemon authentication with replay protection.
// Audit finding: Single shared PSK with no replay resistance — Critical severity.
// Fix: per-node secret, timestamp window, nonce dedup, body hash in canonical string.
import crypto from "crypto";
import type { Request, Response, NextFunction } from "express";

const MAX_SKEW_MS = 5 * 60_000; // 5 minutes clock skew tolerance
const NONCE_TTL_MS = MAX_SKEW_MS * 2;

// In-memory nonce store — survives for the life of the process.
// Each entry: nonce → expiry timestamp. Cleaned lazily on each request.
const seen = new Map<string, number>();

function cleanSeen(now: number): void {
  for (const [k, exp] of seen) {
    if (exp < now) seen.delete(k);
  }
}

/**
 * Returns an Express middleware that authenticates daemon node requests using
 * per-node HMAC-SHA256 with replay protection.
 *
 * Required headers on every daemon request:
 *   X-Node-ID        — the node's registered identifier (e.g. "node-63")
 *   X-Daemon-TS      — Unix epoch milliseconds (must be within MAX_SKEW_MS of server)
 *   X-Daemon-Nonce   — random UUID or 32+ hex chars (must be unique per node per window)
 *   X-Daemon-Sig     — base64url HMAC-SHA256 over the canonical string (see below)
 *
 * Canonical string (joined with "\n"):
 *   METHOD\nURL\nTIMESTAMP_MS\nNONCE\nSHA256(rawBody)
 *
 * The node secret is looked up via getNodeSecret(nodeId). Return null to reject unknown nodes.
 *
 * Requires raw body buffering middleware:
 *   app.use(express.json({ verify: (req: any, _res, buf) => { req.rawBody = buf; } }));
 */
export function verifyDaemonHmac(
  getNodeSecret: (nodeId: string) => Promise<string | null>
) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const nodeId = String(req.header("x-node-id") ?? "").trim();
    const tsRaw  = req.header("x-daemon-ts") ?? "";
    const nonce  = String(req.header("x-daemon-nonce") ?? "").trim();
    const sig    = String(req.header("x-daemon-signature") ?? "").trim();

    if (!nodeId || !tsRaw || !nonce || !sig) {
      res.status(401).json({ error: "Missing daemon authentication headers" });
      return;
    }

    const ts = Number(tsRaw);
    if (!Number.isFinite(ts) || ts <= 0) {
      res.status(401).json({ error: "Invalid X-Daemon-TS value" });
      return;
    }

    const now = Date.now();
    if (Math.abs(now - ts) > MAX_SKEW_MS) {
      res.status(401).json({ error: "Stale daemon request — clock skew too large" });
      return;
    }

    if (nonce.length < 16) {
      res.status(401).json({ error: "Nonce too short (min 16 chars)" });
      return;
    }

    cleanSeen(now);
    const replayKey = `${nodeId}:${nonce}`;
    if (seen.has(replayKey)) {
      res.status(401).json({ error: "Replay detected — nonce already used" });
      return;
    }

    const secret = await getNodeSecret(nodeId);
    if (!secret) {
      res.status(401).json({ error: "Unknown daemon node" });
      return;
    }

    // Hash the raw request body so the signature covers the payload
    const rawBody: Buffer = (req as any).rawBody ?? Buffer.alloc(0);
    const bodyHash = crypto.createHash("sha256").update(rawBody).digest("hex");

    // Canonical string — all fields separated by newlines
    const canonical = [
      req.method.toUpperCase(),
      req.originalUrl,
      String(ts),
      nonce,
      bodyHash,
    ].join("\n");

    const expected = crypto
      .createHmac("sha256", secret)
      .update(canonical)
      .digest("base64url");

    // Timing-safe comparison — pad to same length to avoid length oracle
    const sigBuf      = Buffer.from(sig.padEnd(expected.length, "\0"), "utf8");
    const expectedBuf = Buffer.from(expected.padEnd(sig.length, "\0"), "utf8");
    if (
      sigBuf.length !== expectedBuf.length ||
      !crypto.timingSafeEqual(sigBuf, expectedBuf)
    ) {
      res.status(401).json({ error: "Invalid daemon signature" });
      return;
    }

    // Mark nonce as used until it expires
    seen.set(replayKey, now + NONCE_TTL_MS);

    // Attach authenticated node ID for downstream handlers
    (req as any).daemonNodeId = nodeId;
    next();
  };
}

/**
 * Helper: generate the HMAC a node should send. Use in tests and node setup scripts.
 */
export function signDaemonRequest(opts: {
  method: string;
  url: string;
  body: string | Buffer;
  nodeSecret: string;
  nodeId: string;
}): { nodeId: string; ts: number; nonce: string; signature: string } {
  const ts = Date.now();
  const nonce = crypto.randomBytes(16).toString("hex");
  const bodyHash = crypto.createHash("sha256").update(opts.body).digest("hex");
  const canonical = [
    opts.method.toUpperCase(),
    opts.url,
    String(ts),
    nonce,
    bodyHash,
  ].join("\n");
  const signature = crypto
    .createHmac("sha256", opts.nodeSecret)
    .update(canonical)
    .digest("base64url");
  return { nodeId: opts.nodeId, ts, nonce, signature };
}
