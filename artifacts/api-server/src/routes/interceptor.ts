// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Router } from "express";
import * as https from "https";
import * as http from "http";
import { URL } from "url";
import * as crypto from "crypto";

const router = Router();

interface RequestRecord {
  id: string;
  method: string;
  url: string;
  headers: Record<string, string>;
  body: string;
  sentAt: string;
  response: {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    body: string;
    durationMs: number;
  } | null;
  matchReplaceApplied: { from: string; to: string }[];
}

interface MatchRule { from: string; to: string; enabled: boolean }

// In-memory store per user
const historyStore = new Map<string, RequestRecord[]>();
const matchRulesStore = new Map<string, MatchRule[]>();

function userId(req: any): string {
  return (req.auth as any)?.userId || "anon";
}

function applyMatchReplace(text: string, rules: MatchRule[]): { result: string; applied: { from: string; to: string }[] } {
  let result = text;
  const applied: { from: string; to: string }[] = [];
  for (const rule of rules) {
    if (!rule.enabled) continue;
    if (result.includes(rule.from)) {
      result = result.split(rule.from).join(rule.to);
      applied.push({ from: rule.from, to: rule.to });
    }
  }
  return { result, applied };
}

async function sendRequest(method: string, urlStr: string, headers: Record<string, string>, body: string): Promise<{ status: number; statusText: string; headers: Record<string, string>; body: string; durationMs: number }> {
  const parsed = new URL(urlStr);
  const isHttps = parsed.protocol === "https:";
  const port = parsed.port ? Number(parsed.port) : (isHttps ? 443 : 80);
  const t0 = Date.now();

  return new Promise((resolve, reject) => {
    const opts: http.RequestOptions = {
      hostname: parsed.hostname,
      port,
      path: parsed.pathname + parsed.search,
      method: method.toUpperCase(),
      headers: {
        "User-Agent": "ProxhqVPN-Interceptor/1.0",
        ...headers,
      },
      timeout: 15000,
    };
    if (body && !headers["content-length"] && !headers["Content-Length"]) {
      (opts.headers as Record<string, string>)["content-length"] = String(Buffer.byteLength(body));
    }

    const lib = isHttps ? https : http;
    const req = (lib as any).request({ ...opts, rejectUnauthorized: false }, (res: any) => {
      const chunks: Buffer[] = [];
      res.on("data", (d: Buffer) => chunks.push(d));
      res.on("end", () => {
        const rawBody = Buffer.concat(chunks).toString("utf8");
        const resHeaders: Record<string, string> = {};
        Object.entries(res.headers).forEach(([k, v]) => { resHeaders[k] = String(v); });
        resolve({ status: res.statusCode, statusText: res.statusMessage, headers: resHeaders, body: rawBody, durationMs: Date.now() - t0 });
      });
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("Request timed out")); });
    if (body) req.write(body);
    req.end();
  });
}

// GET history
router.get("/history", (req, res) => {
  const uid = userId(req);
  const history = historyStore.get(uid) || [];
  res.json(history.slice(-50).reverse());
});

// DELETE history
router.delete("/history", (req, res) => {
  historyStore.set(userId(req), []);
  res.json({ ok: true });
});

// GET match rules
router.get("/rules", (req, res) => {
  res.json(matchRulesStore.get(userId(req)) || []);
});

// PUT match rules
router.put("/rules", (req, res) => {
  const { rules } = req.body as { rules?: MatchRule[] };
  if (!Array.isArray(rules)) return res.status(400).json({ error: "rules array required" });
  matchRulesStore.set(userId(req), rules);
  res.json({ ok: true, count: rules.length });
});

// Send / replay request
router.post("/send", async (req, res) => {
  const { method, url, headers, body } = req.body as {
    method?: string; url?: string;
    headers?: Record<string, string>; body?: string;
  };
  if (!url || !method) return res.status(400).json({ error: "url and method required" });

  const uid = userId(req);
  const rules = matchRulesStore.get(uid) || [];

  // Apply match & replace to body
  let finalBody = body || "";
  const { result: transformedBody, applied } = applyMatchReplace(finalBody, rules);
  finalBody = transformedBody;

  // Apply match & replace to headers values
  const finalHeaders: Record<string, string> = {};
  Object.entries(headers || {}).forEach(([k, v]) => {
    const { result } = applyMatchReplace(v, rules);
    finalHeaders[k] = result;
  });

  const record: RequestRecord = {
    id: crypto.randomUUID(),
    method: method.toUpperCase(),
    url,
    headers: finalHeaders,
    body: finalBody,
    sentAt: new Date().toISOString(),
    response: null,
    matchReplaceApplied: applied,
  };

  try {
    const response = await sendRequest(method, url, finalHeaders, finalBody);
    record.response = response;
    res.json({ id: record.id, response });
  } catch (e: any) {
    record.response = { status: 0, statusText: e.message, headers: {}, body: "", durationMs: 0 };
    res.status(502).json({ error: e.message, id: record.id });
  } finally {
    const history = historyStore.get(uid) || [];
    history.push(record);
    if (history.length > 200) history.shift();
    historyStore.set(uid, history);
  }
});

// GET single record
router.get("/history/:id", (req, res) => {
  const uid = userId(req);
  const history = historyStore.get(uid) || [];
  const record = history.find(r => r.id === req.params.id);
  if (!record) return res.status(404).json({ error: "not found" });
  res.json(record);
});

export default router;
