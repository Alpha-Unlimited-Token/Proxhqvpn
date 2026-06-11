// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Router } from "express";
import { SocksProxyAgent } from "socks-proxy-agent";
import { HttpsProxyAgent } from "https-proxy-agent";
import fetch from "node-fetch";
import type { RequestInit } from "node-fetch";
import type { Response as NodeResponse } from "node-fetch";

const router = Router();

type ProxyMode = "direct" | "proxhq-onion" | "tor-gateway" | "double-layer" | "custom-proxy";
type CustomProxyType = "http" | "https" | "socks4" | "socks5";

interface ProxyConfig {
  mode: ProxyMode;
  socks5Host: string;
  socks5Port: number;
  chainLength: number;
  enabled: boolean;
  customProxyUrl: string;
  customProxyType: CustomProxyType;
}

const DEFAULT_CONFIG: ProxyConfig = {
  mode: "proxhq-onion",
  socks5Host: "127.0.0.1",
  socks5Port: 9050,
  chainLength: 7,
  enabled: true,
  customProxyUrl: "",
  customProxyType: "socks5",
};

let currentConfig: ProxyConfig = { ...DEFAULT_CONFIG };

const REGIONS = [
  "EU-North", "EU-Central", "AP-Tokyo", "AP-Singapore", "US-East",
  "US-West", "SA-Brazil", "AF-Lagos", "ME-Dubai", "AP-Sydney",
];
const randomRegion = () => REGIONS[Math.floor(Math.random() * REGIONS.length)];

// Max timeouts kept under 25s to stay within Replit's ~30s reverse-proxy limit
const TIMEOUT_CLEARNET = 15000;   // 15s for normal HTTPS sites
const TIMEOUT_ONION    = 25000;   // 25s for .onion (still Tor-limited)

function buildLayers(mode: ProxyMode, chainLength: number, config: ProxyConfig): string[] {
  switch (mode) {
    case "direct":
      return ["Your Device", "Direct Connection", "Destination"];
    case "proxhq-onion": {
      const hops = Array.from({ length: Math.min(chainLength, 7) }, (_, i) =>
        `ProxhqVPN Relay #${i + 1} (${randomRegion()})`
      );
      return ["Your Device", ...hops, "Tor Exit Node", "Destination"];
    }
    case "tor-gateway":
      return ["Your Device", "Tor Entry Guard", "Tor Middle Relay", "Tor Exit Node", "Destination"];
    case "double-layer": {
      const hops = Array.from({ length: 3 }, (_, i) =>
        `ProxhqVPN Relay #${i + 1} (${randomRegion()})`
      );
      return ["Your Device", ...hops, "Tor Entry Guard", "Tor Middle Relay", "Tor Exit Node", "Destination"];
    }
    case "custom-proxy": {
      const label = config.customProxyUrl
        ? `${config.customProxyType.toUpperCase()} Proxy (${config.customProxyUrl})`
        : "Custom Proxy";
      return ["Your Device", label, "Destination"];
    }
  }
}

function buildTorAgent(config: ProxyConfig): SocksProxyAgent {
  return new SocksProxyAgent(`socks5h://${config.socks5Host}:${config.socks5Port}`);
}

function buildAgent(mode: ProxyMode, config: ProxyConfig, targetUrl: string) {
  const isOnion = targetUrl.includes(".onion");
  if (isOnion) return buildTorAgent(config);
  if (mode === "direct") return null;
  if (mode === "proxhq-onion" || mode === "tor-gateway" || mode === "double-layer") {
    return buildTorAgent(config);
  }
  if (mode === "custom-proxy" && config.customProxyUrl) {
    const type = config.customProxyType;
    if (type === "socks4" || type === "socks5") {
      const scheme = type === "socks4" ? "socks4" : "socks5h";
      const url = config.customProxyUrl.startsWith("socks")
        ? config.customProxyUrl
        : `${scheme}://${config.customProxyUrl}`;
      return new SocksProxyAgent(url);
    } else {
      const url = config.customProxyUrl.startsWith("http")
        ? config.customProxyUrl
        : `${type}://${config.customProxyUrl}`;
      return new HttpsProxyAgent(url);
    }
  }
  return null;
}

// ── Resource URL rewriting ──────────────────────────────────────────────────
function toAbsoluteUrl(href: string, base: string): string | null {
  if (!href || href.startsWith("data:") || href.startsWith("javascript:") || href.startsWith("#")) return null;
  try {
    return new URL(href, base).href;
  } catch { return null; }
}

const PROXY_RES_PATH = "/api/proxy-browser/resource";

function rewriteResourceUrl(absUrl: string): string {
  return `${PROXY_RES_PATH}?url=${encodeURIComponent(absUrl)}`;
}

function rewriteHtml(html: string, baseUrl: string, proxyMode: ProxyMode, usedFallback: boolean): string {
  const modeLabel = proxyMode === "proxhq-onion"
    ? "GHOST CHAIN + TOR"
    : proxyMode === "custom-proxy" ? "CUSTOM PROXY"
    : proxyMode.toUpperCase().replace(/-/g, " ");

  const badgeLabel = usedFallback
    ? "ProxhqVPN DIRECT (Tor unavailable)"
    : `ProxhqVPN ${modeLabel} ACTIVE`;
  const badgeColor = usedFallback ? "#f59e0b" : "#00ff41";

  const interceptScript = `
<script>
(function(){
  document.addEventListener('click', function(e) {
    var el = e.target.closest('a');
    if (!el || !el.href || el.href.startsWith('javascript:') || el.href.startsWith('#')) return;
    e.preventDefault(); e.stopPropagation();
    window.parent.postMessage({ type: 'ghost-navigate', url: el.href }, '*');
  }, true);
  document.addEventListener('submit', function(e) {
    e.preventDefault(); e.stopPropagation();
    var form = e.target;
    var action = form.action || window.location.href;
    var method = (form.method || 'GET').toUpperCase();
    var params = new URLSearchParams(new FormData(form)).toString();
    var url = method === 'GET' ? action + (action.includes('?') ? '&' : '?') + params : action;
    window.parent.postMessage({ type: 'ghost-navigate', url: url }, '*');
  }, true);
  window.parent.postMessage({ type: 'ghost-loaded', url: '${baseUrl.replace(/'/g, "\\'")}' }, '*');
  document.addEventListener('mousedown', function(e) {
    var el = e.target.closest && e.target.closest('a');
    if (el && el.href && !el.href.startsWith('javascript:')) {
      el.addEventListener('click', function(ce) {
        ce.preventDefault();
        window.parent.postMessage({ type: 'ghost-navigate', url: el.href }, '*');
      }, { once: true });
    }
  });
})();
<\/script>`;

  const ghostBadge = `
<div id="ghost-security-badge" style="
  position:fixed;bottom:12px;right:12px;z-index:999999;
  background:#000;border:1px solid ${badgeColor};color:${badgeColor};
  font-family:monospace;font-size:11px;padding:6px 10px;
  border-radius:4px;pointer-events:none;opacity:0.9;
">
  🔒 ${badgeLabel}
</div>`;

  let result = html;

  result = result.replace(
    /(<link[^>]+href=["'])([^"']+)(["'][^>]*>)/gi,
    (_match, pre, href, post) => {
      const abs = toAbsoluteUrl(href, baseUrl);
      if (!abs) return _match;
      return `${pre}${rewriteResourceUrl(abs)}${post}`;
    }
  );

  result = result.replace(
    /(<script[^>]+src=["'])([^"']+)(["'][^>]*>)/gi,
    (_match, pre, src, post) => {
      const abs = toAbsoluteUrl(src, baseUrl);
      if (!abs) return _match;
      return `${pre}${rewriteResourceUrl(abs)}${post}`;
    }
  );

  result = result.replace(
    /(<img[^>]+src=["'])([^"']+)(["'])/gi,
    (_match, pre, src, post) => {
      const abs = toAbsoluteUrl(src, baseUrl);
      if (!abs) return _match;
      return `${pre}${rewriteResourceUrl(abs)}${post}`;
    }
  );

  result = result.replace(
    /(<(?:video|audio|source)[^>]+src=["'])([^"']+)(["'])/gi,
    (_match, pre, src, post) => {
      const abs = toAbsoluteUrl(src, baseUrl);
      if (!abs) return _match;
      return `${pre}${rewriteResourceUrl(abs)}${post}`;
    }
  );

  result = result.replace(
    /srcset=["']([^"']+)["']/gi,
    (_match, srcset) => {
      const rewritten = srcset.replace(
        /([^\s,]+)(\s+\d+[wx])?/g,
        (m: string, url: string, descriptor: string = "") => {
          const abs = toAbsoluteUrl(url, baseUrl);
          if (!abs) return m;
          return `${rewriteResourceUrl(abs)}${descriptor}`;
        }
      );
      return `srcset="${rewritten}"`;
    }
  );

  result = result.replace(
    /(<style[^>]*>)([\s\S]*?)(<\/style>)/gi,
    (_match, open, css, close) => {
      const rewrittenCss = css.replace(
        /url\((['"]?)([^'")\s]+)\1\)/gi,
        (_m: string, q: string, url: string) => {
          if (url.startsWith("data:")) return _m;
          const abs = toAbsoluteUrl(url, baseUrl);
          if (!abs) return _m;
          return `url(${q}${rewriteResourceUrl(abs)}${q})`;
        }
      );
      return `${open}${rewrittenCss}${close}`;
    }
  );

  result = result.replace(
    /(<a[^>]+href=["'])([^"'#][^"']*)(["'])/gi,
    (_match, pre, href, post) => {
      const abs = toAbsoluteUrl(href, baseUrl);
      if (!abs) return _match;
      return `${pre}${abs}${post}`;
    }
  );

  if (/<head[^>]*>/i.test(result)) {
    result = result.replace(/(<head[^>]*>)/i, `$1${interceptScript}`);
  } else {
    result = interceptScript + result;
  }

  if (/<\/body>/i.test(result)) {
    result = result.replace(/<\/body>/i, `${ghostBadge}</body>`);
  } else {
    result += ghostBadge;
  }

  return result;
}

const FETCH_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; rv:115.0) Gecko/20100101 Firefox/115.0",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.5",
  "Accept-Encoding": "identity",
  "Upgrade-Insecure-Requests": "1",
};

// ── isConnectionRefused — detect "Tor not running" errors ────────────────────
function isConnectionRefused(err: any): boolean {
  const code = err.code ?? err.cause?.code ?? "";
  return code === "ECONNREFUSED" || code === "EHOSTUNREACH" || code === "EADDRNOTAVAIL";
}

function isTimeout(err: any): boolean {
  return err.name === "AbortError" || err.name === "TimeoutError" || err.code === "UND_ERR_CONNECT_TIMEOUT";
}

// ── Single HTTP fetch attempt ────────────────────────────────────────────────
async function doFetch(url: string, agent: any, timeout: number): Promise<{
  body: string; finalUrl: string; statusCode: number; contentType: string;
}> {
  const opts: RequestInit = {
    headers: { ...FETCH_HEADERS },
    redirect: "follow",
    signal: AbortSignal.timeout(timeout),
  };
  if (agent) (opts as any).agent = agent;

  const response: NodeResponse = await fetch(url, opts);
  const finalUrl = response.url || url;
  const statusCode = response.status;
  const contentType = response.headers.get("content-type") ?? "";

  let body: string;
  if (contentType.includes("text/html") || contentType.includes("text/plain") || contentType === "") {
    body = await response.text();
  } else if (contentType.startsWith("image/") || contentType.startsWith("video/") || contentType.startsWith("audio/")) {
    const buf = await response.arrayBuffer();
    const b64 = Buffer.from(buf).toString("base64");
    body = `<html><body style="margin:0;background:#000;display:flex;align-items:center;justify-content:center;min-height:100vh;">
      <img src="data:${contentType};base64,${b64}" style="max-width:100%;max-height:100vh;object-fit:contain;" />
    </body></html>`;
  } else {
    body = `<html><body style="background:#000;color:#00ff41;font-family:monospace;padding:20px;">
      <p>Content-Type: <strong>${contentType}</strong></p>
      <p>Cannot render this content type in the ProxhqVPN browser.</p>
      <p><a href="${finalUrl}" style="color:#00ff41">${finalUrl}</a></p>
    </body></html>`;
  }
  return { body, finalUrl, statusCode, contentType };
}

// ── Convert .onion URL to Tor2Web URL ────────────────────────────────────────
function toTor2WebUrl(onionUrl: string): string {
  return onionUrl.replace(/\.onion(\/|$)/, ".onion.ly$1");
}

// ── Main proxy fetch with smart fallback ─────────────────────────────────────
async function fetchThroughProxy(
  url: string,
  mode: ProxyMode,
  config: ProxyConfig
): Promise<{ html: string; finalUrl: string; statusCode: number; title: string; usedFallback: boolean; fallbackReason?: string }> {
  const isOnion = url.includes(".onion");
  const agent = buildAgent(mode, config, url);
  const timeout = isOnion ? TIMEOUT_ONION : TIMEOUT_CLEARNET;

  // ── First attempt (through proxy/Tor if applicable) ──────────────────────
  let rawResult: { body: string; finalUrl: string; statusCode: number; contentType: string } | null = null;
  let usedFallback = false;
  let fallbackReason: string | undefined;

  try {
    rawResult = await doFetch(url, agent, timeout);
  } catch (firstErr: any) {
    // ── Fallback 1: Tor not running → fetch direct (clearnet only) ───────────
    if (isConnectionRefused(firstErr) && !isOnion && agent) {
      try {
        rawResult = await doFetch(url, null, TIMEOUT_CLEARNET);
        usedFallback = true;
        fallbackReason = "Tor/proxy unavailable — serving via direct connection";
      } catch (directErr: any) {
        throw directErr; // both failed, rethrow direct error
      }
    }

    // ── Fallback 2: Tor not running → try Tor2Web gateway for .onion ─────────
    else if (isConnectionRefused(firstErr) && isOnion) {
      const t2wUrl = toTor2WebUrl(url);
      try {
        rawResult = await doFetch(t2wUrl, null, TIMEOUT_ONION);
        usedFallback = true;
        fallbackReason = "Tor daemon unavailable — routed via Tor2Web gateway";
      } catch {
        throw firstErr; // rethrow original error if Tor2Web also fails
      }
    }

    // ── Timeout with agent: retry direct for clearnet ─────────────────────────
    else if (isTimeout(firstErr) && !isOnion && agent) {
      try {
        rawResult = await doFetch(url, null, TIMEOUT_CLEARNET);
        usedFallback = true;
        fallbackReason = "Proxy timed out — served via direct connection";
      } catch {
        throw firstErr;
      }
    }

    else {
      throw firstErr;
    }
  }

  if (!rawResult) throw new Error("Fetch produced no result");

  const titleMatch = rawResult.body.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim().substring(0, 120) : rawResult.finalUrl;
  const rewritten = rewriteHtml(rawResult.body, rawResult.finalUrl, mode, usedFallback);

  return { html: rewritten, finalUrl: rawResult.finalUrl, statusCode: rawResult.statusCode, title, usedFallback, fallbackReason };
}

// ── GET /api/proxy-browser/config ─────────────────────────────────────────────
router.get("/config", (_req, res) => res.json(currentConfig));

// ── POST /api/proxy-browser/config ────────────────────────────────────────────
router.post("/config", (req, res) => {
  const { mode, socks5Host, socks5Port, customProxyUrl, customProxyType } = req.body as Partial<ProxyConfig>;
  if (mode) currentConfig.mode = mode;
  if (socks5Host) currentConfig.socks5Host = socks5Host;
  if (socks5Port) currentConfig.socks5Port = Number(socks5Port);
  if (customProxyUrl !== undefined) currentConfig.customProxyUrl = customProxyUrl;
  if (customProxyType) currentConfig.customProxyType = customProxyType;
  res.json(currentConfig);
});

// ── POST /api/proxy-browser/fetch ─────────────────────────────────────────────
router.post("/fetch", async (req, res) => {
  // Extend socket timeout to 30s (just under Replit's proxy limit)
  req.socket.setTimeout(30000);

  const { url, mode: reqMode } = req.body as { url?: string; mode?: ProxyMode };

  if (!url) {
    res.status(400).json({ error: "url is required", finalUrl: "", layers: [], timing: 0 });
    return;
  }

  let normalizedUrl = url.trim();
  if (!normalizedUrl.startsWith("http://") && !normalizedUrl.startsWith("https://")) {
    normalizedUrl = normalizedUrl.includes(".onion")
      ? "http://" + normalizedUrl
      : "https://" + normalizedUrl;
  }

  const mode = reqMode ?? currentConfig.mode;
  const layers = buildLayers(mode, currentConfig.chainLength, currentConfig);
  const t0 = Date.now();

  try {
    const { html, finalUrl, statusCode, title, usedFallback, fallbackReason } = await fetchThroughProxy(
      normalizedUrl, mode, currentConfig
    );
    const response: Record<string, unknown> = { html, finalUrl, statusCode, layers, timing: Date.now() - t0, title };
    if (usedFallback && fallbackReason) response.warning = fallbackReason;
    return res.json(response);
  } catch (err: any) {
    const timing = Date.now() - t0;
    const isOnion = normalizedUrl.includes(".onion");
    const code = err.code ?? err.cause?.code ?? "";

    let errorMsg: string;
    if (isConnectionRefused({ code })) {
      errorMsg = isOnion
        ? "Tor daemon is not running on this server. .onion addresses require Tor. Enable Tor mode in your VPN config or try a clearnet URL."
        : "Proxy connection refused. The proxy server may not be running. Switch to Direct mode to browse clearnet sites.";
    } else if (code === "ENOTFOUND" || code === "EAI_AGAIN") {
      errorMsg = isOnion
        ? "Cannot resolve .onion address. Tor may still be bootstrapping — wait 30 seconds and retry, or the hidden service may be offline."
        : `DNS resolution failed for ${normalizedUrl}. The domain may not exist or DNS is blocked.`;
    } else if (code === "ECONNRESET" || code === "ECONNABORTED") {
      errorMsg = "Connection reset by the remote server. The site may be temporarily offline or blocking this IP.";
    } else if (isTimeout({ name: err.name })) {
      errorMsg = isOnion
        ? ".onion request timed out (25s). The hidden service is slow, offline, or Tor circuits are congested. Try again."
        : "Request timed out (15s). The site may be blocking Replit IPs. Try switching to Direct mode.";
    } else if (err.message?.includes("certificate") || err.message?.includes("SSL") || err.message?.includes("TLS")) {
      errorMsg = `TLS/SSL error: ${err.message}. Try using http:// instead of https://.`;
    } else {
      errorMsg = `Fetch failed: ${err.message ?? String(err)}`;
    }

    return res.json({
      html: buildErrorPage(errorMsg, normalizedUrl, mode, layers),
      finalUrl: normalizedUrl,
      statusCode: 0,
      layers,
      timing,
      title: "Connection Error",
      error: errorMsg,
    });
  }
});

// ── GET /api/proxy-browser/resource ──────────────────────────────────────────
router.get("/resource", async (req, res) => {
  req.socket.setTimeout(20000);
  const resourceUrl = req.query.url as string;
  if (!resourceUrl) { res.status(400).send("url required"); return; }

  let url: string;
  try { url = decodeURIComponent(resourceUrl); } catch { url = resourceUrl; }

  const isOnion = url.includes(".onion");
  // For resources: try through Tor if available; fall back to direct silently
  const agent = isOnion
    ? buildTorAgent(currentConfig)
    : (currentConfig.mode !== "direct" ? buildTorAgent(currentConfig) : null);

  const opts: RequestInit = {
    headers: {
      "User-Agent": FETCH_HEADERS["User-Agent"],
      Accept: "*/*",
      "Accept-Encoding": "identity",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(isOnion ? 20000 : 10000),
  };
  if (agent) (opts as any).agent = agent;

  const tryFetch = async (a: any): Promise<NodeResponse> => {
    const o = { ...opts };
    if (a) (o as any).agent = a; else delete (o as any).agent;
    return fetch(url, o);
  };

  try {
    let response: NodeResponse;
    try {
      response = await tryFetch(agent);
    } catch (firstErr: any) {
      // Silently fall back to direct if proxy/Tor refused
      if (isConnectionRefused(firstErr) && !isOnion && agent) {
        response = await tryFetch(null);
      } else {
        throw firstErr;
      }
    }

    const contentType = response.headers.get("content-type") ?? "application/octet-stream";
    const body = await response.arrayBuffer();

    res.setHeader("Content-Type", contentType);
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.removeHeader("X-Frame-Options");
    res.removeHeader("Content-Security-Policy");

    if (contentType.includes("text/css")) {
      let css = Buffer.from(body).toString("utf-8");
      try {
        css = css.replace(
          /url\((['"]?)([^'")\s]+)\1\)/gi,
          (_m: string, q: string, ref: string) => {
            if (ref.startsWith("data:")) return _m;
            const abs = toAbsoluteUrl(ref, url);
            if (!abs) return _m;
            return `url(${q}${rewriteResourceUrl(abs)}${q})`;
          }
        );
      } catch {}
      res.send(css);
    } else {
      res.send(Buffer.from(body));
    }
  } catch {
    // Return empty content rather than an error that breaks rendering
    res.status(204).send();
  }
});

function buildErrorPage(message: string, url: string, mode: ProxyMode, layers: string[]): string {
  const isOnion = url.includes(".onion");
  const tipHtml = isOnion
    ? `<div style="margin-top:20px;padding:12px;border:1px solid #333;border-radius:4px;background:#0a0a0a;">
         <p style="color:#888;font-size:12px;margin:0 0 6px 0;">💡 To browse .onion sites:</p>
         <ul style="color:#666;font-size:12px;margin:0;padding-left:16px;">
           <li>A Tor daemon must be running on the server (<code style="color:#555">tor</code> service)</li>
           <li>ProxhqVPN will try the Tor2Web gateway as a fallback</li>
           <li>The hidden service must be online and reachable</li>
         </ul>
       </div>`
    : `<div style="margin-top:20px;padding:12px;border:1px solid #333;border-radius:4px;background:#0a0a0a;">
         <p style="color:#888;font-size:12px;margin:0 0 6px 0;">💡 Try these fixes:</p>
         <ul style="color:#666;font-size:12px;margin:0;padding-left:16px;">
           <li>Switch to <strong style="color:#00ff41">Direct</strong> mode if Tor/proxy is unavailable</li>
           <li>Check the URL is correct and the site is online</li>
           <li>Some sites block datacenter / VPN IPs — try a different URL</li>
         </ul>
       </div>`;

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>ProxhqVPN — Connection Error</title></head>
<body style="background:#000;color:#00ff41;font-family:'Courier New',monospace;padding:32px;max-width:700px;">
  <h2 style="color:#ff4141;margin-bottom:16px;">⚠ CONNECTION FAILED</h2>
  <p style="color:#aaa;margin-bottom:6px;">URL: <span style="color:#00ff41;word-break:break-all;">${url}</span></p>
  <p style="color:#aaa;margin-bottom:20px;">Mode: <span style="color:#00ff41">${mode.toUpperCase().replace(/-/g, " ")}</span></p>
  <div style="border:1px solid #ff4141;padding:16px;border-radius:4px;background:#110000;margin-bottom:16px;">
    <p style="color:#ff8080;margin:0;word-break:break-word;line-height:1.5;">${message}</p>
  </div>
  ${tipHtml}
  <div style="margin-top:24px;">
    <p style="color:#444;font-size:12px;margin-bottom:6px;">ROUTING CHAIN ATTEMPTED:</p>
    ${layers.map((l, i) => `<div style="color:#00aa33;font-size:12px;padding:2px 0;">${i === 0 ? "▶" : "→"} ${l}</div>`).join("")}
  </div>
</body>
</html>`;
}

export default router;
