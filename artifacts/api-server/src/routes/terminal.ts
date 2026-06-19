// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Router } from "express";
import { getAuth } from "@clerk/express";
import { checkSsrf } from "../lib/ssrfGuard";
import { z } from "zod";
import { asyncHandler } from "../middlewares/asyncHandler";
import {
  validateRequest,
  getValidatedBody,
  getValidatedParams,
} from "../middlewares/validateRequest";
import {
  terminalExecBodySchema,
  terminalJobParamsSchema,
  sshConnectBodySchema,
  sshSessionParamsSchema,
  sshExecBodySchema,
  httpRequestBodySchema,
  portScanBodySchema,
  sshSftpLsBodySchema,
  sshSftpReadBodySchema,
} from "../schemas/terminalSchemas";
import { Client as SshClient } from "ssh2";
import type { ConnectConfig, SFTPWrapper } from "ssh2";
import { randomUUID } from "crypto";
import { verifyBreakGlassToken } from "../lib/break-glass";
import {
  getHardBlockReason,
  hasShellChain,
  isAllowedCommand,
  TERMINAL_OUTPUT_LIMIT,
  TERMINAL_STDERR_LIMIT,
} from "../lib/terminal-policy";
import { auditTerminalEvent } from "../lib/terminal-audit";
import {
  createTerminalJob,
  createSshTerminalJob,
  getTerminalJob,
  listTerminalJobs,
} from "../lib/terminal-jobs";
import { requireAdmin } from "../middlewares/requireAdmin";

const router = Router();

// ─── Audit log ───────────────────────────────────────────────────────────────
const AUDIT_LOG_MAX = 500;
const auditLog: { ts: string; cmd: string; exitCode: number; ip: string }[] = [];

function pushAuditLog(entry: { ts: string; cmd: string; exitCode: number; ip: string }): void {
  auditLog.push(entry);
  if (auditLog.length > AUDIT_LOG_MAX) auditLog.shift();
}

// ─── GET audit log — admin only ───────────────────────────────────────────────
router.get("/audit-log", requireAdmin, (_req, res) => {
  res.json({ log: auditLog.slice(-200), total: auditLog.length });
});

// ─── POST exec — enqueues a terminal job, returns 202 + jobId ────────────────
router.post(
  "/exec",
  validateRequest({ body: terminalExecBodySchema }),
  asyncHandler(async (req, res) => {
    const body = getValidatedBody<typeof terminalExecBodySchema>(req);

  const cmd = body.command.trim();
  const clientIp = req.ip ?? "unknown";
  const actor = getActor(req);

  const blockReason = getHardBlockReason(cmd);
  if (blockReason) {
    await auditTerminalEvent({
      actor,
      action: "terminal.job_blocked",
      result: "deny",
      ip: clientIp,
      command: cmd,
      metadata: { reason: blockReason },
    });
    return res.status(403).json({ command: cmd, stderr: blockReason, exitCode: 1, blocked: true });
  }

  if (hasShellChain(cmd)) {
    await auditTerminalEvent({
      actor,
      action: "terminal.job_blocked",
      result: "deny",
      ip: clientIp,
      command: cmd,
      metadata: { reason: "shell_chain" },
    });
    return res.status(403).json({ command: cmd, stderr: "BLOCKED: Shell chain injection detected.", exitCode: 1, blocked: true });
  }

  if (!body.ghostMode && !isAllowedCommand(cmd)) {
    return res.status(403).json({ command: cmd, stderr: "Permission denied. Command is not allowlisted.", exitCode: 1, blocked: true });
  }

  if (body.ghostMode) {
    const token = String(req.headers["x-break-glass-token"] ?? "");

    if (!verifyBreakGlassToken(token)) {
      await auditTerminalEvent({
        actor,
        action: "terminal.break_glass_failed",
        result: "deny",
        ip: clientIp,
        command: cmd,
      });
      return res.status(403).json({ error: "Ghost mode requires a valid break-glass token" });
    }

    await auditTerminalEvent({
      actor,
      action: "terminal.break_glass_authorized",
      result: "allow",
      ip: clientIp,
      command: cmd,
    });
  }

  const job = createTerminalJob({
    ownerUserId: actor,
    command: cmd,
    ghostMode: body.ghostMode,
    timeout: body.timeout,
  });

  await auditTerminalEvent({
    actor,
    action: body.ghostMode ? "terminal.ghost_job_created" : "terminal.job_created",
    result: "allow",
    ip: clientIp,
    command: cmd,
    metadata: { jobId: job.id },
  });

  res.status(202).json({
    jobId: job.id,
    status: job.status,
    createdAt: job.createdAt,
    pollUrl: `/api/terminal/jobs/${job.id}`,
  });
  }),
);

// ─── GET /jobs — list caller's jobs (latest 100) ──────────────────────────────
router.get(
  "/jobs",
  asyncHandler(async (req, res) => {
    const actor = getActor(req);
    res.json({ jobs: await listTerminalJobs(actor) });
  }),
);

// ─── GET /jobs/:jobId — poll a specific job ───────────────────────────────────
router.get(
  "/jobs/:jobId",
  validateRequest({ params: terminalJobParamsSchema }),
  asyncHandler(async (req, res) => {
    const actor = getActor(req);
    const params = getValidatedParams<typeof terminalJobParamsSchema>(req);
    const job = await getTerminalJob(actor, params.jobId);
    if (!job) return res.status(404).json({ error: "Job not found" });
    return res.json({ job });
  }),
);

// ─── GET /jobs/:jobId/stream — SSE stream of job status (C-5) ─────────────────
router.get(
  "/jobs/:jobId/stream",
  asyncHandler(async (req, res) => {
    const actor  = getActor(req);
    const jobId  = String(req.params.jobId ?? "");
    if (!jobId) return res.status(400).json({ error: "Missing jobId" });

    const job = await getTerminalJob(actor, jobId);
    if (!job) return res.status(404).json({ error: "Job not found" });

    res.setHeader("content-type",  "text/event-stream");
    res.setHeader("cache-control", "no-cache");
    res.setHeader("x-accel-buffering", "no");
    res.flushHeaders();

    const sendEvent = (data: object) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    sendEvent({ type: "connected", jobId });

    let lastStatus = "";
    const intervalId = setInterval(async () => {
      try {
        const current = await getTerminalJob(actor, jobId);
        if (!current) {
          clearInterval(intervalId);
          sendEvent({ type: "error", message: "Job not found" });
          res.end();
          return;
        }

        if (current.status !== lastStatus) {
          lastStatus = current.status;
          sendEvent({ type: "update", job: current });
        }

        if (current.status === "completed" || current.status === "failed") {
          clearInterval(intervalId);
          sendEvent({ type: "complete", job: current });
          res.end();
        }
      } catch {
        clearInterval(intervalId);
        res.end();
      }
    }, 500);

    req.on("close", () => {
      clearInterval(intervalId);
    });
  }),
);

// ─── POST http-request (direct outbound HTTP from server) ────────────────────
router.post(
  "/http-request",
  validateRequest({ body: httpRequestBodySchema }),
  asyncHandler(async (req, res) => {
    const body = getValidatedBody<typeof httpRequestBodySchema>(req);

    // SSRF Protection: block requests to private/internal/metadata IP ranges
    const ssrf = await checkSsrf(body.url, true);
    if (ssrf.blocked) {
      return res.status(403).json({ error: `SSRF blocked: ${ssrf.reason}` });
    }

    const startMs = Date.now();
    const nodeFetch = (await import("node-fetch")).default;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), body.timeout);

    try {
      // Redirect SSRF re-validation: manually follow redirects so each hop is
      // checked against the SSRF guard — prevents open-redirect chains that bypass
      // the initial check and land on an internal/metadata address.
      let currentUrl = body.url;
      let resp: Awaited<ReturnType<typeof nodeFetch>>;
      const MAX_REDIRECTS = 5;
      let redirectCount = 0;

      while (true) {
        resp = await nodeFetch(currentUrl, {
          method: body.method,
          headers: { "User-Agent": "ProxhqVPN/3.0 curl/8.0", ...body.headers },
          body: body.data,
          redirect: "manual",
          signal: controller.signal as any,
        });

        const location = resp.headers.get("location");

        if (
          body.followRedirects &&
          location &&
          [301, 302, 303, 307, 308].includes(resp.status) &&
          redirectCount < MAX_REDIRECTS
        ) {
          const absLocation = new URL(location, currentUrl).toString();
          const hopCheck = await checkSsrf(absLocation, true);

          if (hopCheck.blocked) {
            return res.status(403).json({
              error: `SSRF blocked on redirect hop ${redirectCount + 1}: ${hopCheck.reason}`,
            });
          }

          currentUrl = absLocation;
          redirectCount++;
          continue;
        }

        break;
      }

      const responseText = await resp.text();
      const responseHeaders: Record<string, string> = {};
      resp.headers.forEach((v, k) => { responseHeaders[k] = v; });

      return res.json({
        url: body.url,
        status: resp.status,
        statusText: resp.statusText,
        headers: responseHeaders,
        body: responseText.slice(0, 50_000),
        bodySize: responseText.length,
        durationMs: Date.now() - startMs,
        redirected: resp.redirected,
        finalUrl: resp.url,
      });
    } catch (err: any) {
      return res.json({
        url: body.url,
        status: 0,
        statusText: "Connection failed",
        headers: {},
        body: "",
        bodySize: 0,
        durationMs: Date.now() - startMs,
        error: err.message,
      });
    } finally {
      clearTimeout(timer);
    }
  }),
);

// ─── GET port-scan (basic TCP connect scan) ────────────────────────────────
router.post(
  "/port-scan",
  validateRequest({ body: portScanBodySchema }),
  asyncHandler(async (req, res) => {
    const body = getValidatedBody<typeof portScanBodySchema>(req);

    // SSRF Protection: block port scans against private/internal IP ranges
    const ssrf = await checkSsrf(body.host, false);
    if (ssrf.blocked) {
      return res.status(403).json({ error: `SSRF blocked: ${ssrf.reason}` });
    }

    const net = await import("net");
    const results: { port: number; open: boolean; banner?: string }[] = [];

    await Promise.all(
      body.ports.map(
        (port) =>
          new Promise<void>((resolve) => {
            const sock = new net.Socket();
            let open = false;
            let banner = "";

            sock.setTimeout(body.timeout);
            sock.connect(port, body.host, () => { open = true; });
            sock.on("data", (d: Buffer) => {
              banner = d.toString("utf8", 0, 200).replace(/\r?\n/g, " ").trim();
              sock.destroy();
            });
            sock.on("timeout", () => sock.destroy());
            sock.on("error", () => sock.destroy());
            sock.on("close", () => {
              results.push({ port, open, ...(banner ? { banner } : {}) });
              resolve();
            });
          }),
      ),
    );

    results.sort((a, b) => a.port - b.port);

    return res.json({
      host: body.host,
      scannedAt: new Date().toISOString(),
      openPorts: results.filter((r) => r.open).length,
      results,
    });
  }),
);

// ─── SSH Session Manager ──────────────────────────────────────────────────────

interface SshSession {
  id: string;
  ownerUserId: string;
  host: string;
  port: number;
  username: string;
  connectedAt: string;
  lastUsedAt: number;
  client: SshClient;
  sftp: SFTPWrapper | null;
  label: string;
}

const sshSessions = new Map<string, SshSession>();

function getActor(req: any): string {
  return getAuth(req).userId ?? "unknown";
}

function getOwnedSession(req: any, sessionId: string): SshSession | null {
  const session = sshSessions.get(sessionId);
  const actor = getActor(req);

  if (!session) return null;
  if (session.ownerUserId !== actor) return null;

  session.lastUsedAt = Date.now();
  return session;
}

function runSshCommand(
  session: SshSession,
  command: string,
  timeout: number,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      resolve({ stdout: "", stderr: "Command timed out", exitCode: 124 });
    }, timeout);

    session.client.exec(command, (err, stream) => {
      if (err) {
        clearTimeout(timer);
        return resolve({ stdout: "", stderr: err.message, exitCode: 1 });
      }

      let stdout = "";
      let stderr = "";

      stream.on("data", (chunk: Buffer) => {
        stdout += chunk.toString();
      });

      stream.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      stream.on("close", (code: number) => {
        clearTimeout(timer);
        resolve({ stdout, stderr, exitCode: code ?? 0 });
      });

      stream.on("error", (streamError: Error) => {
        clearTimeout(timer);
        resolve({ stdout, stderr: streamError.message, exitCode: 1 });
      });
    });
  });
}

const SSH_IDLE_TIMEOUT_MS    = 15 * 60_000;   // 15-minute idle cutoff
const SSH_MAX_DURATION_MS    = 60 * 60_000;   // 1-hour hard cap regardless of activity

setInterval(() => {
  const now        = Date.now();
  const idleCutoff = now - SSH_IDLE_TIMEOUT_MS;

  for (const [sessionId, session] of sshSessions.entries()) {
    const idleTooLong      = session.lastUsedAt < idleCutoff;
    const connectedTooLong = (now - new Date(session.connectedAt).getTime()) > SSH_MAX_DURATION_MS;
    if (idleTooLong || connectedTooLong) {
      try { session.client.end(); } catch { /* ignore cleanup errors */ }
      sshSessions.delete(sessionId);
    }
  }
}, 5 * 60_000);

// Helper: get SFTP subsystem for a session (lazy init)
function getSftp(session: SshSession): Promise<SFTPWrapper> {
  if (session.sftp) return Promise.resolve(session.sftp);
  return new Promise((resolve, reject) => {
    session.client.sftp((err, sftp) => {
      if (err) return reject(err);
      session.sftp = sftp;
      resolve(sftp);
    });
  });
}

// POST /api/terminal/ssh/connect
router.post(
  "/ssh/connect",
  validateRequest({ body: sshConnectBodySchema }),
  asyncHandler(async (req, res) => {
    const body = getValidatedBody<typeof sshConnectBodySchema>(req);

    if (!body.password && !body.privateKey) {
      return res.status(400).json({ error: "Provide either password or privateKey" });
    }

    // SSRF guard — block private/metadata ranges
    const ssrf = await checkSsrf(body.host, false);
    if (ssrf.blocked) {
      return res.status(403).json({ error: `SSRF blocked: ${ssrf.reason}` });
    }

    const sessionId = randomUUID();
    const client = new SshClient();

    const cfg: ConnectConfig = {
      host: body.host,
      port: body.port,
      username: body.username,
      readyTimeout: body.timeout,
      ...(body.password ? { password: body.password } : {}),
      ...(body.privateKey
        ? {
            privateKey: body.privateKey,
            ...(body.passphrase ? { passphrase: body.passphrase } : {}),
          }
        : {}),
    };

    try {
      await new Promise<void>((resolve, reject) => {
        client.on("ready", () => {
          sshSessions.set(sessionId, {
            id: sessionId,
            ownerUserId: getActor(req),
            host: body.host,
            port: body.port,
            username: body.username,
            connectedAt: new Date().toISOString(),
            lastUsedAt: Date.now(),
            client,
            sftp: null,
            label: body.label ?? `${body.username}@${body.host}`,
          });
          resolve();
        });
        client.on("error", reject);
        client.connect(cfg);
      });
    } catch (err: any) {
      return res.status(400).json({ error: `SSH connection failed: ${err.message}` });
    }

    return res.json({
      sessionId,
      host: body.host,
      port: body.port,
      username: body.username,
      connectedAt: new Date().toISOString(),
    });
  }),
);

// GET /api/terminal/ssh/sessions
router.get("/ssh/sessions", (req, res) => {
  const actor = getActor(req);
  const list = [...sshSessions.values()]
    .filter((s) => s.ownerUserId === actor)
    .map((s) => ({
      id: s.id,
      host: s.host,
      port: s.port,
      username: s.username,
      label: s.label,
      connectedAt: s.connectedAt,
    }));
  res.json({ sessions: list });
});

// DELETE /api/terminal/ssh/sessions/:id
router.delete(
  "/ssh/sessions/:id",
  validateRequest({ params: sshSessionParamsSchema }),
  (req, res) => {
    const params = getValidatedParams<typeof sshSessionParamsSchema>(req);
    const session = getOwnedSession(req, params.id);

    if (!session) {
      return res.status(404).json({ error: "Session not found or not owned by current user" });
    }

    try { session.client.end(); } catch { /* ignore */ }
    sshSessions.delete(params.id);

    return res.json({ ok: true });
  },
);

// POST /api/terminal/ssh/exec  — enqueue a job and return 202
router.post(
  "/ssh/exec",
  validateRequest({ body: sshExecBodySchema }),
  asyncHandler(async (req, res) => {
    const body = getValidatedBody<typeof sshExecBodySchema>(req);

    const session = getOwnedSession(req, body.sessionId);

    if (!session) {
      return res.status(404).json({
        error: "Session not found or not owned by current user",
      });
    }

    const blockReason = getHardBlockReason(body.command);

    if (blockReason) {
      await auditTerminalEvent({
        actor: getActor(req),
        action: "terminal.ssh_job_blocked",
        result: "deny",
        ip: req.ip ?? "unknown",
        command: body.command,
        metadata: {
          sessionId: body.sessionId,
          host: session.host,
          username: session.username,
          reason: blockReason,
        },
      });

      return res.status(403).json({
        error: blockReason,
        blocked: true,
      });
    }

    const job = createSshTerminalJob({
      ownerUserId: getActor(req),
      command: body.command,
      timeout: body.timeout,
      sessionId: body.sessionId,
      host: session.host,
      username: session.username,
      run: (command, timeout) => runSshCommand(session, command, timeout),
    });

    await auditTerminalEvent({
      actor: getActor(req),
      action: "terminal.ssh_job_created",
      result: "allow",
      ip: req.ip ?? "unknown",
      command: body.command,
      metadata: {
        jobId: job.id,
        sessionId: body.sessionId,
        host: session.host,
        username: session.username,
      },
    });

    return res.status(202).json({
      jobId: job.id,
      status: job.status,
      createdAt: job.createdAt,
      pollUrl: `/api/terminal/jobs/${job.id}`,
    });
  }),
);

// POST /api/terminal/ssh/sftp/ls  — list directory
router.post(
  "/ssh/sftp/ls",
  validateRequest({ body: sshSftpLsBodySchema }),
  asyncHandler(async (req, res) => {
    const body = getValidatedBody<typeof sshSftpLsBodySchema>(req);

    const session = getOwnedSession(req, body.sessionId);
    if (!session) {
      return res.status(404).json({ error: "Session not found or not owned by current user" });
    }

    const sftp = await getSftp(session);
    const entries = await new Promise<any[]>((resolve, reject) => {
      sftp.readdir(body.path, (err, list) => {
        if (err) return reject(err);
        resolve(
          list.map((e) => ({
            name: e.filename,
            longname: e.longname,
            isDir: (e.attrs.mode! & 0o170000) === 0o040000,
            isSymlink: (e.attrs.mode! & 0o170000) === 0o120000,
            size: e.attrs.size ?? 0,
            mode: (e.attrs.mode ?? 0).toString(8),
            mtime: e.attrs.mtime ?? 0,
          })),
        );
      });
    });

    return res.json({ path: body.path, entries });
  }),
);

// POST /api/terminal/ssh/sftp/read  — read a file (capped at 512 KB)
router.post(
  "/ssh/sftp/read",
  validateRequest({ body: sshSftpReadBodySchema }),
  asyncHandler(async (req, res) => {
    const body = getValidatedBody<typeof sshSftpReadBodySchema>(req);

    const session = getOwnedSession(req, body.sessionId);
    if (!session) {
      return res.status(404).json({ error: "Session not found or not owned by current user" });
    }

    const MAX_BYTES = 512 * 1024;
    const sftp = await getSftp(session);
    const content = await new Promise<string>((resolve, reject) => {
      const chunks: Buffer[] = [];
      const stream = sftp.createReadStream(body.path, { start: 0, end: MAX_BYTES });
      stream.on("data", (chunk: Buffer) => { chunks.push(chunk); });
      stream.on("end", () => {
        const buf = Buffer.concat(chunks);
        resolve(body.encoding === "base64" ? buf.toString("base64") : buf.toString("utf8"));
      });
      stream.on("error", reject);
    });

    return res.json({
      path: body.path,
      content,
      encoding: body.encoding,
      truncated: content.length >= MAX_BYTES,
    });
  }),
);

// ─── Remote Screen Capture & Input Control ────────────────────────────────────
// Uses scrot/import for screenshots and xdotool for mouse/keyboard injection.
// All commands run over the existing SSH session — no extra daemon needed.

// Helper: run a raw SSH command and return stdout (no audit log, internal use)
function sshRun(session: SshSession, cmd: string, timeoutMs = 8000): Promise<{ stdout: Buffer; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ stdout: Buffer.alloc(0), stderr: "timeout", exitCode: 124 }), timeoutMs);
    session.client.exec(cmd, { env: { DISPLAY: ":0" } }, (err, stream) => {
      if (err) { clearTimeout(timer); return resolve({ stdout: Buffer.alloc(0), stderr: err.message, exitCode: 1 }); }
      const chunks: Buffer[] = [];
      let stderr = "";
      stream.on("data", (d: Buffer) => chunks.push(d));
      stream.stderr.on("data", (d: Buffer) => { stderr += d.toString(); });
      stream.on("close", (code: number) => {
        clearTimeout(timer);
        resolve({ stdout: Buffer.concat(chunks), stderr, exitCode: code ?? 0 });
      });
    });
  });
}

// POST /api/terminal/ssh/screen/capture
// Returns a base64-encoded JPEG of the remote desktop.
// Tries: scrot → import (ImageMagick) → ffmpeg fallback
router.post("/ssh/screen/capture", async (req, res) => {
  const body = z.object({
    sessionId: z.string().uuid(),
    quality: z.number().min(10).max(95).optional().default(55),
    display: z.string().max(8).optional().default(":0"),
  }).parse(req.body);

  const session = getOwnedSession(req, body.sessionId);
  if (!session) return res.status(404).json({ error: "Session not found or not owned by current user" });

  const q = body.quality;
  const disp = body.display;
  const ts = Date.now();
  const tmpPng = `/tmp/proxhq_screen_${ts}.jpg`;

  // Try scrot first (lightweight), fall back to import (ImageMagick)
  const captureCmd =
    `DISPLAY=${disp} scrot --quality ${q} ${tmpPng} 2>/dev/null && base64 -w 0 ${tmpPng} && rm -f ${tmpPng}` +
    ` || (DISPLAY=${disp} import -window root -quality ${q} ${tmpPng} 2>/dev/null && base64 -w 0 ${tmpPng} && rm -f ${tmpPng})` +
    ` || (DISPLAY=${disp} ffmpeg -y -f x11grab -i ${disp} -vframes 1 -q:v 5 ${tmpPng} 2>/dev/null && base64 -w 0 ${tmpPng} && rm -f ${tmpPng})`;

  const result = await sshRun(session, captureCmd, 10000);

  if (result.exitCode !== 0 || result.stdout.length === 0) {
    return res.status(400).json({
      error: "Screen capture failed. Ensure scrot or ImageMagick is installed on the target machine: sudo apt install scrot",
      stderr: result.stderr.slice(0, 500),
    });
  }

  const b64 = result.stdout.toString("utf8").trim();
  res.json({ image: `data:image/jpeg;base64,${b64}`, capturedAt: new Date().toISOString() });
});

// POST /api/terminal/ssh/screen/info
// Returns screen resolution via xrandr or xdpyinfo
router.post("/ssh/screen/info", async (req, res) => {
  const body = z.object({ sessionId: z.string().uuid(), display: z.string().max(8).optional().default(":0") }).parse(req.body);
  const session = getOwnedSession(req, body.sessionId);
  if (!session) return res.status(404).json({ error: "Session not found or not owned by current user" });

  const r = await sshRun(session,
    `DISPLAY=${body.display} xrandr 2>/dev/null | grep ' connected' | grep -oP '\\d+x\\d+' | head -1` +
    ` || DISPLAY=${body.display} xdpyinfo 2>/dev/null | grep dimensions | awk '{print $2}'`,
    5000
  );
  const raw = r.stdout.toString().trim();
  const match = raw.match(/(\d+)x(\d+)/);
  res.json({ resolution: raw || "unknown", width: match ? parseInt(match[1]) : 1920, height: match ? parseInt(match[2]) : 1080 });
});

// POST /api/terminal/ssh/screen/input
// Accepts mouse move, click, scroll, and key events — executed via xdotool
router.post("/ssh/screen/input", async (req, res) => {
  const EventSchema = z.discriminatedUnion("type", [
    z.object({ type: z.literal("mousemove"), x: z.number().int(), y: z.number().int() }),
    z.object({ type: z.literal("click"),     x: z.number().int(), y: z.number().int(), button: z.number().int().min(1).max(9).optional().default(1) }),
    z.object({ type: z.literal("dblclick"),  x: z.number().int(), y: z.number().int() }),
    z.object({ type: z.literal("scroll"),    x: z.number().int(), y: z.number().int(), delta: z.number() }),
    z.object({ type: z.literal("keydown"),   key: z.string().max(64) }),
    z.object({ type: z.literal("type"),      text: z.string().max(1024) }),
  ]);

  const body = z.object({
    sessionId: z.string().uuid(),
    event: EventSchema,
    display: z.string().max(8).optional().default(":0"),
  }).parse(req.body);

  const session = getOwnedSession(req, body.sessionId);
  if (!session) return res.status(404).json({ error: "Session not found or not owned by current user" });

  const ev = body.event;
  const disp = `DISPLAY=${body.display}`;
  let cmd = "";

  if (ev.type === "mousemove") {
    cmd = `${disp} xdotool mousemove --sync ${ev.x} ${ev.y}`;
  } else if (ev.type === "click") {
    cmd = `${disp} xdotool mousemove --sync ${ev.x} ${ev.y} click ${ev.button}`;
  } else if (ev.type === "dblclick") {
    cmd = `${disp} xdotool mousemove --sync ${ev.x} ${ev.y} click --repeat 2 --delay 50 1`;
  } else if (ev.type === "scroll") {
    const btn = ev.delta > 0 ? 4 : 5; // 4=up 5=down
    const repeats = Math.min(Math.abs(Math.round(ev.delta / 100)), 10);
    cmd = `${disp} xdotool click --repeat ${repeats} --delay 20 ${btn}`;
  } else if (ev.type === "keydown") {
    // Map common browser key names to xdotool key names
    const keyMap: Record<string, string> = {
      Enter: "Return", Backspace: "BackSpace", Delete: "Delete",
      ArrowLeft: "Left", ArrowRight: "Right", ArrowUp: "Up", ArrowDown: "Down",
      Tab: "Tab", Escape: "Escape", " ": "space",
      Control: "ctrl", Shift: "shift", Alt: "alt", Meta: "super",
      F1:"F1",F2:"F2",F3:"F3",F4:"F4",F5:"F5",F6:"F6",F7:"F7",F8:"F8",F9:"F9",F10:"F10",F11:"F11",F12:"F12",
      Home:"Home", End:"End", PageUp:"Page_Up", PageDown:"Page_Down",
    };
    const xkey = keyMap[ev.key] ?? ev.key;
    cmd = `${disp} xdotool key --clearmodifiers "${xkey}"`;
  } else if (ev.type === "type") {
    // Escape for shell safety — no shell injection via type
    const safe = ev.text.replace(/'/g, "'\\''");
    cmd = `${disp} xdotool type --clearmodifiers --delay 10 '${safe}'`;
  }

  if (!cmd) return res.status(400).json({ error: "Unknown event type" });

  const r = await sshRun(session, cmd, 5000);
  res.json({ ok: r.exitCode === 0, stderr: r.stderr.slice(0, 200) });
});

export default router;
