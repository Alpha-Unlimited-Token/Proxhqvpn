// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
/**
 * HTTP Probe — Burp Suite Repeater equivalent
 * Craft any HTTP request from the server and inspect the raw response.
 */
import { Router } from "express";
import { z } from "zod";
import https from "https";
import http from "http";
import { URL } from "url";

const router = Router();

const ProbeSchema = z.object({
  method:          z.enum(["GET","POST","PUT","PATCH","DELETE","HEAD","OPTIONS","TRACE"]),
  url:             z.string().url(),
  headers:         z.record(z.string()).default({}),
  body:            z.string().optional(),
  followRedirects: z.boolean().default(true),
  maxRedirects:    z.number().int().min(0).max(10).default(5),
  timeoutMs:       z.number().int().min(500).max(30000).default(10000),
  verifySsl:       z.boolean().default(false),
});

type ProbeResult = {
  url: string;
  finalUrl: string;
  statusCode: number;
  statusText: string;
  httpVersion: string;
  timingMs: number;
  redirectChain: { status: number; location: string }[];
  responseHeaders: Record<string, string>;
  body: string;
  bodyBytes: number;
  truncated: boolean;
};

const MAX_BODY = 500_000; // 500 KB max response body

function doRequest(opts: {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string;
  verifySsl: boolean;
  timeoutMs: number;
}): Promise<{ statusCode: number; statusText: string; headers: Record<string, string>; body: string; httpVersion: string }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(opts.url);
    const isHttps = parsed.protocol === "https:";
    const mod = isHttps ? https : http;

    const reqHeaders: Record<string, string> = {
      "User-Agent": "ProxhqVPN-Probe/1.0",
      "Accept": "*/*",
      "Accept-Encoding": "identity",
      ...opts.headers,
    };
    if (opts.body && !reqHeaders["Content-Length"]) {
      reqHeaders["Content-Length"] = Buffer.byteLength(opts.body).toString();
    }

    const req = mod.request(
      {
        method: opts.method,
        hostname: parsed.hostname,
        port: parsed.port || (isHttps ? 443 : 80),
        path: parsed.pathname + parsed.search,
        headers: reqHeaders,
        rejectUnauthorized: opts.verifySsl,
        timeout: opts.timeoutMs,
      },
      (res) => {
        const chunks: Buffer[] = [];
        let totalBytes = 0;
        let truncated = false;
        res.on("data", (chunk: Buffer) => {
          totalBytes += chunk.length;
          if (totalBytes <= MAX_BODY) {
            chunks.push(chunk);
          } else {
            truncated = true;
          }
        });
        res.on("end", () => {
          const respHeaders: Record<string, string> = {};
          for (const [k, v] of Object.entries(res.headers)) {
            respHeaders[k] = Array.isArray(v) ? v.join(", ") : v ?? "";
          }
          resolve({
            statusCode: res.statusCode ?? 0,
            statusText: res.statusMessage ?? "",
            headers: respHeaders,
            body: Buffer.concat(chunks).toString("utf8"),
            httpVersion: `HTTP/${res.httpVersion}`,
          });
        });
        res.on("error", reject);
      }
    );
    req.on("timeout", () => { req.destroy(new Error("Request timed out")); });
    req.on("error", reject);
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

router.post("/", async (req, res) => {
  try {
    const params = ProbeSchema.parse(req.body);
    const start = Date.now();
    const redirectChain: { status: number; location: string }[] = [];

    let currentUrl = params.url;
    let result: Awaited<ReturnType<typeof doRequest>> | null = null;
    let redirectCount = 0;

    while (redirectCount <= params.maxRedirects) {
      result = await doRequest({
        method: params.method,
        url: currentUrl,
        headers: params.headers,
        body: params.body,
        verifySsl: params.verifySsl,
        timeoutMs: params.timeoutMs,
      });

      const isRedirect = [301, 302, 303, 307, 308].includes(result.statusCode);
      if (isRedirect && params.followRedirects && result.headers.location) {
        redirectChain.push({ status: result.statusCode, location: result.headers.location });
        try {
          currentUrl = new URL(result.headers.location, currentUrl).toString();
        } catch {
          break;
        }
        redirectCount++;
        continue;
      }
      break;
    }

    if (!result) { res.status(500).json({ error: "No response" }); return; }

    const bodyBytes = Buffer.byteLength(result.body);
    const truncated = bodyBytes >= MAX_BODY;

    const out: ProbeResult = {
      url: params.url,
      finalUrl: currentUrl,
      statusCode: result.statusCode,
      statusText: result.statusText,
      httpVersion: result.httpVersion,
      timingMs: Date.now() - start,
      redirectChain,
      responseHeaders: result.headers,
      body: result.body.slice(0, MAX_BODY),
      bodyBytes,
      truncated,
    };
    res.json(out);
  } catch (err: any) {
    res.status(400).json({ error: err.message ?? "Probe failed" });
  }
});

export default router;
