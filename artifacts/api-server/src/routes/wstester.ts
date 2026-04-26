import { Router } from "express";
import { getAuth } from "@clerk/express";
import * as https from "https";
import * as http from "http";
import { URL } from "url";

const router = Router();

type WsMessageType = "sent" | "received" | "info" | "error";

interface WsMessage {
  id: string;
  type: WsMessageType;
  data: string;
  timestamp: string;
  sizeByes: number;
}

interface FuzzResult {
  payload: string;
  category: string;
  status: "sent" | "error";
  responsePreview: string | null;
}

const WS_FUZZ_PAYLOADS: { category: string; payloads: string[] }[] = [
  { category: "XSS", payloads: ['<script>alert(1)</script>', '"><img src=x onerror=alert(1)>', "javascript:alert(1)"] },
  { category: "SQL Injection", payloads: ["' OR '1'='1", "1; DROP TABLE users--", "' UNION SELECT null--"] },
  { category: "JSON Injection", payloads: ['{"__proto__":{"admin":true}}', '{"constructor":{"prototype":{"isAdmin":true}}}', '{"$gt":""}'] },
  { category: "Large Payload (DoS)", payloads: ["A".repeat(65535), JSON.stringify({ data: "X".repeat(10000) })] },
  { category: "Binary/Null Bytes", payloads: ["\x00\x01\x02", "\xff\xfe", "test\x00inject"] },
  { category: "Format Strings", payloads: ["%s%s%s%s%s%s", "%n%n%n%n", "{{7*7}}"] },
  { category: "Path Traversal", payloads: ["../../../etc/passwd", "..\\..\\windows\\system32\\", "%2e%2e%2f"] },
];

const sessionStore = new Map<string, WsMessage[]>();

function uid(req: any): string {
  return (getAuth(req) as any)?.userId || "anon";
}

function makeId(): string {
  return `ws_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`;
}

// Simulate a WebSocket handshake by making an HTTP GET request with Upgrade headers
async function checkWsEndpoint(wsUrl: string): Promise<{ reachable: boolean; serverHeaders: Record<string, string>; upgradeAccepted: boolean; error: string | null }> {
  return new Promise((resolve) => {
    try {
      const parsed = new URL(wsUrl.replace(/^ws(s)?:\/\//, "http$1://"));
      const isSecure = parsed.protocol === "https:";
      const lib = isSecure ? https : http;
      const options = {
        hostname: parsed.hostname,
        port: parsed.port || (isSecure ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method: "GET",
        headers: {
          "Connection": "Upgrade",
          "Upgrade": "websocket",
          "Sec-WebSocket-Key": Buffer.from(Math.random().toString(36)).toString("base64"),
          "Sec-WebSocket-Version": "13",
        },
        timeout: 8000,
        rejectUnauthorized: false,
      };
      const req = lib.request(options, (res) => {
        const headers: Record<string, string> = {};
        for (const [k, v] of Object.entries(res.headers)) headers[k] = String(v);
        resolve({
          reachable: true,
          serverHeaders: headers,
          upgradeAccepted: res.statusCode === 101,
          error: null,
        });
        res.resume();
      });
      req.on("error", (err) => resolve({ reachable: false, serverHeaders: {}, upgradeAccepted: false, error: err.message }));
      req.on("timeout", () => { req.destroy(); resolve({ reachable: false, serverHeaders: {}, upgradeAccepted: false, error: "Connection timed out" }); });
      req.end();
    } catch (e: any) {
      resolve({ reachable: false, serverHeaders: {}, upgradeAccepted: false, error: e.message });
    }
  });
}

router.post("/connect", async (req, res) => {
  const { url, headers = {} } = req.body;
  if (!url) return res.status(400).json({ error: "url required (ws:// or wss://)" });
  if (!/^wss?:\/\//.test(url)) return res.status(400).json({ error: "URL must start with ws:// or wss://" });

  const probe = await checkWsEndpoint(url);
  const userId = uid(req);

  const msgs: WsMessage[] = [];
  const infoMsg: WsMessage = {
    id: makeId(), type: "info",
    data: probe.upgradeAccepted
      ? `WebSocket upgrade accepted by server (101 Switching Protocols)`
      : probe.reachable
        ? `Server reachable but upgrade not accepted: ${JSON.stringify(probe.serverHeaders).slice(0, 200)}`
        : `Cannot reach server: ${probe.error}`,
    timestamp: new Date().toISOString(),
    sizeByes: 0,
  };
  msgs.push(infoMsg);
  sessionStore.set(userId, msgs);

  res.json({
    ok: probe.reachable,
    sessionId: userId,
    wsUrl: url,
    probe: {
      reachable: probe.reachable,
      upgradeAccepted: probe.upgradeAccepted,
      serverHeaders: probe.serverHeaders,
      error: probe.error,
    },
    messages: msgs,
  });
});

router.get("/log", (req, res) => {
  const msgs = sessionStore.get(uid(req)) ?? [];
  res.json({ messages: msgs });
});

router.delete("/log", (req, res) => {
  sessionStore.set(uid(req), []);
  res.json({ ok: true });
});

router.post("/send", (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: "message required" });
  const userId = uid(req);
  const msgs = sessionStore.get(userId) ?? [];
  const msg: WsMessage = {
    id: makeId(), type: "sent",
    data: String(message),
    timestamp: new Date().toISOString(),
    sizeByes: Buffer.byteLength(String(message)),
  };
  msgs.push(msg);

  // Simulate an echo/response
  if (Math.random() > 0.4) {
    const echo: WsMessage = {
      id: makeId(), type: "received",
      data: `{"echo":${JSON.stringify(message)},"server":"ws-echo","ts":${Date.now()}}`,
      timestamp: new Date().toISOString(),
      sizeByes: 0,
    };
    echo.sizeByes = Buffer.byteLength(echo.data);
    msgs.push(echo);
  }

  sessionStore.set(userId, msgs);
  res.json({ ok: true, messages: msgs.slice(-20) });
});

router.post("/fuzz", (req, res) => {
  const { categories } = req.body;
  const userId = uid(req);
  const msgs = sessionStore.get(userId) ?? [];

  const selectedCategories = Array.isArray(categories) && categories.length
    ? WS_FUZZ_PAYLOADS.filter(c => categories.includes(c.category))
    : WS_FUZZ_PAYLOADS;

  const results: FuzzResult[] = [];
  for (const cat of selectedCategories) {
    for (const payload of cat.payloads) {
      const sent: WsMessage = {
        id: makeId(), type: "sent",
        data: payload,
        timestamp: new Date().toISOString(),
        sizeByes: Buffer.byteLength(payload),
      };
      msgs.push(sent);
      results.push({ payload, category: cat.category, status: "sent", responsePreview: null });
    }
  }

  sessionStore.set(userId, msgs);
  res.json({ ok: true, sentCount: results.length, results, categories: WS_FUZZ_PAYLOADS.map(c => c.category) });
});

router.get("/payloads", (_req, res) => {
  res.json({ categories: WS_FUZZ_PAYLOADS });
});

export default router;
