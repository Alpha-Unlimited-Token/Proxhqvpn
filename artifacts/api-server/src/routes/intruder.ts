/**
 * Intruder — Burp Suite Intruder equivalent
 * Accepts an HTTP request template with §marker§ positions and a payload list,
 * sends each fuzzed variant from the server, returns comparison results.
 */
import { Router, Request, Response } from "express";
import { z } from "zod";
import https from "https";
import http from "http";
import { URL } from "url";

const router = Router();

const IntruderSchema = z.object({
  method:    z.enum(["GET","POST","PUT","PATCH","DELETE","HEAD","OPTIONS"]),
  urlTemplate: z.string().url(),
  headers:   z.record(z.string()).default({}),
  bodyTemplate: z.string().optional(),
  payloads:  z.array(z.string()).min(1).max(100),
  timeoutMs: z.number().int().min(500).max(15000).default(8000),
  verifySsl: z.boolean().default(false),
  marker:    z.string().default("§FUZZ§"),
});

const MAX_BODY = 200_000;

function substitute(template: string, marker: string, payload: string): string {
  return template.split(marker).join(payload);
}

function doRequest(opts: {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string;
  verifySsl: boolean;
  timeoutMs: number;
}): Promise<{ statusCode: number; headers: Record<string, string>; body: string; timingMs: number }> {
  return new Promise((resolve, reject) => {
    const t0 = Date.now();
    let parsed: URL;
    try { parsed = new URL(opts.url); } catch { return reject(new Error("Invalid URL")); }
    const isHttps = parsed.protocol === "https:";
    const mod = isHttps ? https : http;
    const reqHeaders: Record<string, string> = {
      "User-Agent": "ProxhqVPN-Intruder/1.0",
      "Accept": "*/*",
      "Accept-Encoding": "identity",
      ...opts.headers,
    };
    if (opts.body) reqHeaders["Content-Length"] = Buffer.byteLength(opts.body).toString();

    const req = mod.request({
      method: opts.method,
      hostname: parsed.hostname,
      port: parsed.port ? Number(parsed.port) : (isHttps ? 443 : 80),
      path: parsed.pathname + parsed.search,
      headers: reqHeaders,
      rejectUnauthorized: opts.verifySsl,
      timeout: opts.timeoutMs,
    }, (res) => {
      const chunks: Buffer[] = [];
      let size = 0;
      res.on("data", (c: Buffer) => {
        size += c.length;
        if (size <= MAX_BODY) chunks.push(c);
      });
      res.on("end", () => {
        const hdrs: Record<string, string> = {};
        for (const [k, v] of Object.entries(res.headers)) {
          hdrs[k] = Array.isArray(v) ? v.join(", ") : (v ?? "");
        }
        resolve({
          statusCode: res.statusCode ?? 0,
          headers: hdrs,
          body: Buffer.concat(chunks).toString("utf8").slice(0, MAX_BODY),
          timingMs: Date.now() - t0,
        });
      });
      res.on("error", reject);
    });

    req.on("timeout", () => { req.destroy(); reject(new Error("Request timed out")); });
    req.on("error", reject);
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

router.post("/api/intruder/run", async (req: Request, res: Response) => {
  const parsed = IntruderSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }
  const { method, urlTemplate, headers, bodyTemplate, payloads, timeoutMs, verifySsl, marker } = parsed.data;

  const results: {
    payload: string;
    statusCode: number;
    timingMs: number;
    bodyLength: number;
    body: string;
    error?: string;
  }[] = [];

  for (const payload of payloads) {
    const url  = substitute(urlTemplate, marker, encodeURIComponent(payload));
    const body = bodyTemplate ? substitute(bodyTemplate, marker, payload) : undefined;
    const hdrs: Record<string, string> = {};
    for (const [k, v] of Object.entries(headers)) {
      hdrs[k] = substitute(v, marker, payload);
    }

    try {
      const r = await doRequest({ method, url, headers: hdrs, body, verifySsl, timeoutMs });
      results.push({
        payload,
        statusCode: r.statusCode,
        timingMs: r.timingMs,
        bodyLength: Buffer.byteLength(r.body, "utf8"),
        body: r.body.slice(0, 5000),
      });
    } catch (err: unknown) {
      results.push({
        payload,
        statusCode: 0,
        timingMs: 0,
        bodyLength: 0,
        body: "",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  res.json({ results });
});

export default router;
