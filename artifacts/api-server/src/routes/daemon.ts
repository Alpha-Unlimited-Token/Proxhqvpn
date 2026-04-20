import { Router, type Request, type Response } from "express";

const router = Router();

const DAEMON_URL = process.env.GHOSTNET_DAEMON_URL || "http://127.0.0.1:7475";
const TIMEOUT_MS = 3000;

async function proxyToDaemon(
  method: "GET" | "POST",
  path: string,
  body?: unknown
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${DAEMON_URL}${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    const offline = msg.includes("fetch failed") || msg.includes("ECONNREFUSED") || msg.includes("abort");
    return {
      ok: false,
      status: offline ? 503 : 500,
      data: {
        error: offline
          ? "PROXHQ daemon is not running. Start it with: sudo python3 proxhqd.py --mode server --psk YOUR_PSK"
          : msg,
        daemon_url: DAEMON_URL,
        running: false,
      },
    };
  } finally {
    clearTimeout(timer);
  }
}

// GET /api/daemon/status
router.get("/status", async (_req: Request, res: Response) => {
  const r = await proxyToDaemon("GET", "/status");
  res.status(r.status).json(r.data);
});

// GET /api/daemon/peers
router.get("/peers", async (_req: Request, res: Response) => {
  const r = await proxyToDaemon("GET", "/peers");
  res.status(r.status).json(r.data);
});

// GET /api/daemon/logs
router.get("/logs", async (_req: Request, res: Response) => {
  const r = await proxyToDaemon("GET", "/logs");
  res.status(r.status).json(r.data);
});

// GET /api/daemon/connections
router.get("/connections", async (_req: Request, res: Response) => {
  const r = await proxyToDaemon("GET", "/connections");
  res.status(r.status).json(r.data);
});

// POST /api/daemon/stop
router.post("/stop", async (_req: Request, res: Response) => {
  const r = await proxyToDaemon("POST", "/stop");
  res.status(r.status).json(r.data);
});

// POST /api/daemon/killswitch/on
router.post("/killswitch/on", async (_req: Request, res: Response) => {
  const r = await proxyToDaemon("POST", "/killswitch/on");
  res.status(r.status).json(r.data);
});

// POST /api/daemon/killswitch/off
router.post("/killswitch/off", async (_req: Request, res: Response) => {
  const r = await proxyToDaemon("POST", "/killswitch/off");
  res.status(r.status).json(r.data);
});

// POST /api/daemon/dns/protect
router.post("/dns/protect", async (_req: Request, res: Response) => {
  const r = await proxyToDaemon("POST", "/dns/protect");
  res.status(r.status).json(r.data);
});

// POST /api/daemon/dns/restore
router.post("/dns/restore", async (_req: Request, res: Response) => {
  const r = await proxyToDaemon("POST", "/dns/restore");
  res.status(r.status).json(r.data);
});

// POST /api/daemon/splittunnel/add  body: {cidr, bypass}
router.post("/splittunnel/add", async (req: Request, res: Response) => {
  const r = await proxyToDaemon("POST", "/splittunnel/add", req.body);
  res.status(r.status).json(r.data);
});

// POST /api/daemon/splittunnel/remove  body: {cidr}
router.post("/splittunnel/remove", async (req: Request, res: Response) => {
  const r = await proxyToDaemon("POST", "/splittunnel/remove", req.body);
  res.status(r.status).json(r.data);
});

// POST /api/daemon/rotate
router.post("/rotate", async (_req: Request, res: Response) => {
  const r = await proxyToDaemon("POST", "/rotate");
  res.status(r.status).json(r.data);
});

// GET /api/daemon/ping  — quick liveness check (no daemon needed)
router.get("/ping", (_req: Request, res: Response) => {
  res.json({
    daemon_url: DAEMON_URL,
    message: "API server is up. Use /api/daemon/status to check if the daemon is running.",
  });
});

export default router;
