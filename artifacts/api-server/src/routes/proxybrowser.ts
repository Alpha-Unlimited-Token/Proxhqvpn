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

// Build the SOCKS5h agent (hostname resolution on proxy side — required for .onion)
function buildTorAgent(config: ProxyConfig): SocksProxyAgent {
  return new SocksProxyAgent(`socks5h://${config.socks5Host}:${config.socks5Port}`);
}

function buildAgent(mode: ProxyMode, config: ProxyConfig, targetUrl: string) {
  const isOnion = targetUrl.includes(".onion");

  // .onion addresses ALWAYS go through Tor regardless of mode
  if (isOnion) return buildTorAgent(config);

  if (mode === "direct") return null;

  // ALL non-direct modes route through Tor SOCKS5h
  // (proxhq-onion adds relay branding but transport is always Tor)
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

function rewriteHtml(html: string, baseUrl: string, proxyMode: ProxyMode): string {
  const parsedBase = new URL(baseUrl);
  const origin = parsedBase.origin;
  const basePath = parsedBase.pathname.replace(/\/[^/]*$/, "/");

  // Intercept script injected into every page
  const interceptScript = `
<script>
(function(){
  // Intercept all navigation
  document.addEventListener('click', function(e) {
    var el = e.target.closest('a');
    if (!el || !el.href || el.href.startsWith('javascript:') || el.href.startsWith('#')) return;
    e.preventDefault();
    e.stopPropagation();
    window.parent.postMessage({ type: 'ghost-navigate', url: el.href }, '*');
  }, true);
  document.addEventListener('submit', function(e) {
    e.preventDefault();
    e.stopPropagation();
    var form = e.target;
    var action = form.action || window.location.href;
    var method = (form.method || 'GET').toUpperCase();
    var params = new URLSearchParams(new FormData(form)).toString();
    var url = method === 'GET' ? action + (action.includes('?') ? '&' : '?') + params : action;
    window.parent.postMessage({ type: 'ghost-navigate', url: url }, '*');
  }, true);
  window.parent.postMessage({ type: 'ghost-loaded', url: '${baseUrl.replace(/'/g, "\\'")}' }, '*');
  // Make links inside shadow DOM work
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

  const modeLabel = proxyMode === "proxhq-onion"
    ? "GHOST CHAIN + TOR"
    : proxyMode === "custom-proxy" ? "CUSTOM PROXY"
    : proxyMode.toUpperCase().replace(/-/g, " ");

  const ghostBadge = `
<div id="ghost-security-badge" style="
  position:fixed;bottom:12px;right:12px;z-index:999999;
  background:#000;border:1px solid #00ff41;color:#00ff41;
  font-family:monospace;font-size:11px;padding:6px 10px;
  border-radius:4px;pointer-events:none;opacity:0.85;
">
  🔒 ProxhqVPN ${modeLabel} ACTIVE
</div>`;

  let result = html;

  // Rewrite CSS link hrefs
  result = result.replace(
    /(<link[^>]+href=["'])([^"']+)(["'][^>]*>)/gi,
    (match, pre, href, post) => {
      // Only rewrite stylesheets and other resources, not canonical/alternate
      const abs = toAbsoluteUrl(href, baseUrl);
      if (!abs) return match;
      // Only rewrite cross-origin resources or all for consistency
      return `${pre}${rewriteResourceUrl(abs)}${post}`;
    }
  );

  // Rewrite script srcs
  result = result.replace(
    /(<script[^>]+src=["'])([^"']+)(["'][^>]*>)/gi,
    (match, pre, src, post) => {
      const abs = toAbsoluteUrl(src, baseUrl);
      if (!abs) return match;
      return `${pre}${rewriteResourceUrl(abs)}${post}`;
    }
  );

  // Rewrite img srcs
  result = result.replace(
    /(<img[^>]+src=["'])([^"']+)(["'])/gi,
    (match, pre, src, post) => {
      const abs = toAbsoluteUrl(src, baseUrl);
      if (!abs) return match;
      return `${pre}${rewriteResourceUrl(abs)}${post}`;
    }
  );

  // Rewrite video/audio/source srcs
  result = result.replace(
    /(<(?:video|audio|source)[^>]+src=["'])([^"']+)(["'])/gi,
    (match, pre, src, post) => {
      const abs = toAbsoluteUrl(src, baseUrl);
      if (!abs) return match;
      return `${pre}${rewriteResourceUrl(abs)}${post}`;
    }
  );

  // Rewrite srcset attributes
  result = result.replace(
    /srcset=["']([^"']+)["']/gi,
    (match, srcset) => {
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

  // Rewrite CSS url() references inside <style> tags
  result = result.replace(
    /(<style[^>]*>)([\s\S]*?)(<\/style>)/gi,
    (match, open, css, close) => {
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

  // Fix all a[href] to be absolute so our interceptor can forward them
  result = result.replace(
    /(<a[^>]+href=["'])([^"'#][^"']*)(["'])/gi,
    (match, pre, href, post) => {
      const abs = toAbsoluteUrl(href, baseUrl);
      if (!abs) return match;
      return `${pre}${abs}${post}`;
    }
  );

  // Inject intercept script at top of <head>
  if (/<head[^>]*>/i.test(result)) {
    result = result.replace(/(<head[^>]*>)/i, `$1${interceptScript}`);
  } else {
    result = interceptScript + result;
  }

  // Inject security badge before </body>
  if (/<\/body>/i.test(result)) {
    result = result.replace(/<\/body>/i, `${ghostBadge}</body>`);
  } else {
    result += ghostBadge;
  }

  return result;
}

const FETCH_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; rv:115.0) Gecko/20100101 Firefox/115.0",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.5",
  "Accept-Encoding": "identity",
  "Upgrade-Insecure-Requests": "1",
};

async function fetchThroughProxy(
  url: string,
  mode: ProxyMode,
  config: ProxyConfig
): Promise<{ html: string; finalUrl: string; statusCode: number; title: string }> {
  const isOnion = url.includes(".onion");
  const agent = buildAgent(mode, config, url);
  const timeout = isOnion || agent ? 45000 : 15000;

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

  let html: string;
  if (contentType.includes("text/html") || contentType.includes("text/plain") || contentType === "") {
    html = await response.text();
  } else if (contentType.startsWith("image/") || contentType.startsWith("video/") || contentType.startsWith("audio/")) {
    const buf = await response.arrayBuffer();
    const b64 = Buffer.from(buf).toString("base64");
    html = `<html><body style="margin:0;background:#000;display:flex;align-items:center;justify-content:center;min-height:100vh;">
      <img src="data:${contentType};base64,${b64}" style="max-width:100%;max-height:100vh;object-fit:contain;" />
    </body></html>`;
  } else {
    html = `<html><body style="background:#000;color:#00ff41;font-family:monospace;padding:20px;">
      <p>Content-Type: <strong>${contentType}</strong></p>
      <p>Cannot render this content type in the ProxhqVPN browser.</p>
      <p><a href="${finalUrl}" style="color:#00ff41">${finalUrl}</a></p>
    </body></html>`;
  }

  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim().substring(0, 100) : finalUrl;
  const rewritten = rewriteHtml(html, finalUrl, mode);
  return { html: rewritten, finalUrl, statusCode, title };
}

// ── GET /api/proxy-browser/config ────────────────────────────────────────────
router.get("/config", (_req, res) => res.json(currentConfig));

// ── POST /api/proxy-browser/config ───────────────────────────────────────────
router.post("/config", (req, res) => {
  const { mode, socks5Host, socks5Port, customProxyUrl, customProxyType } = req.body as Partial<ProxyConfig>;
  if (mode) currentConfig.mode = mode;
  if (socks5Host) currentConfig.socks5Host = socks5Host;
  if (socks5Port) currentConfig.socks5Port = Number(socks5Port);
  if (customProxyUrl !== undefined) currentConfig.customProxyUrl = customProxyUrl;
  if (customProxyType) currentConfig.customProxyType = customProxyType;
  res.json(currentConfig);
});

// ── POST /api/proxy-browser/fetch ────────────────────────────────────────────
router.post("/fetch", async (req, res) => {
  const { url, mode: reqMode } = req.body as { url?: string; mode?: ProxyMode };

  if (!url) {
    res.status(400).json({ error: "url is required", finalUrl: "", layers: [], timing: 0 });
    return;
  }

  let normalizedUrl = url.trim();
  if (!normalizedUrl.startsWith("http://") && !normalizedUrl.startsWith("https://")) {
    // .onion sites: use http (Tor handles transport security)
    normalizedUrl = normalizedUrl.includes(".onion")
      ? "http://" + normalizedUrl
      : "https://" + normalizedUrl;
  }

  const mode = reqMode ?? currentConfig.mode;
  const layers = buildLayers(mode, currentConfig.chainLength, currentConfig);
  const t0 = Date.now();

  try {
    const { html, finalUrl, statusCode, title } = await fetchThroughProxy(
      normalizedUrl, mode, currentConfig
    );
    return res.json({ html, finalUrl, statusCode, layers, timing: Date.now() - t0, title });
  } catch (err: any) {
    const timing = Date.now() - t0;
    const isOnion = normalizedUrl.includes(".onion");
    const code = err.code ?? err.cause?.code ?? "";

    let errorMsg: string;
    if (code === "ECONNREFUSED") {
      errorMsg = "Tor SOCKS5 proxy refused connection — the Tor daemon may still be starting up. Please wait 30 seconds and try again.";
    } else if (isOnion && (code === "ENOTFOUND" || code === "EAI_AGAIN" || err.message?.includes("ENOTFOUND"))) {
      errorMsg = "Cannot resolve .onion address via Tor. The Tor daemon may still be bootstrapping (takes ~30s on first start). If this persists, the hidden service may be offline.";
    } else if (code === "ECONNRESET" || code === "ECONNABORTED") {
      errorMsg = "Connection was reset by the remote server. The site may be temporarily offline or blocking Tor exit nodes.";
    } else if (err.name === "AbortError" || err.name === "TimeoutError") {
      errorMsg = isOnion
        ? "Request timed out — .onion sites can take up to 45 seconds via Tor. The hidden service may be slow or offline."
        : "Request timed out after 45 seconds. The destination may be unreachable through the proxy.";
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

// ── GET /api/proxy-browser/resource — proxy a single resource (CSS/JS/image) through Tor ──
router.get("/resource", async (req, res) => {
  const resourceUrl = req.query.url as string;
  if (!resourceUrl) { res.status(400).send("url required"); return; }

  let url: string;
  try { url = decodeURIComponent(resourceUrl); } catch { url = resourceUrl; }

  const isOnion = url.includes(".onion");
  const agent = isOnion ? buildTorAgent(currentConfig)
    : (currentConfig.mode !== "direct" ? buildTorAgent(currentConfig) : null);

  const opts: RequestInit = {
    headers: {
      "User-Agent": FETCH_HEADERS["User-Agent"],
      Accept: "*/*",
      "Accept-Encoding": "identity",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(isOnion ? 30000 : 10000),
  };
  if (agent) (opts as any).agent = agent;

  try {
    const response = await fetch(url, opts);
    const contentType = response.headers.get("content-type") ?? "application/octet-stream";
    const body = await response.arrayBuffer();

    // Strip security headers that would block rendering
    res.setHeader("Content-Type", contentType);
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.removeHeader("X-Frame-Options");
    res.removeHeader("Content-Security-Policy");
    // Rewrite CSS url() references if this is a stylesheet
    if (contentType.includes("text/css")) {
      let css = Buffer.from(body).toString("utf-8");
      try {
        const cssBase = url;
        css = css.replace(
          /url\((['"]?)([^'")\s]+)\1\)/gi,
          (_m: string, q: string, ref: string) => {
            if (ref.startsWith("data:")) return _m;
            const abs = toAbsoluteUrl(ref, cssBase);
            if (!abs) return _m;
            return `url(${q}${rewriteResourceUrl(abs)}${q})`;
          }
        );
      } catch {}
      res.send(css);
    } else {
      res.send(Buffer.from(body));
    }
  } catch (err: any) {
    res.status(502).send(`/* ProxhqVPN: resource fetch failed: ${err.message} */`);
  }
});

function buildErrorPage(message: string, url: string, mode: ProxyMode, layers: string[]): string {
  const isOnion = url.includes(".onion");
  const hint = isOnion
    ? `<p style="margin-top:16px;color:#888;font-size:12px;">
        ℹ️ .onion addresses require Tor. The ProxhqVPN server routes all modes through Tor.
        If this is your first request, wait ~30 seconds for Tor to fully bootstrap.
      </p>`
    : "";

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>ProxhqVPN — Connection Error</title></head>
<body style="background:#000;color:#00ff41;font-family:'Courier New',monospace;padding:32px;max-width:680px;">
  <h2 style="color:#ff4141;margin-bottom:16px;">⚠ CONNECTION FAILED</h2>
  <p style="color:#aaa;margin-bottom:8px;">URL: <span style="color:#00ff41;word-break:break-all;">${url}</span></p>
  <p style="color:#aaa;margin-bottom:24px;">Mode: <span style="color:#00ff41">${mode.toUpperCase().replace(/-/g, " ")}</span></p>
  <div style="border:1px solid #ff4141;padding:16px;border-radius:4px;background:#110000;">
    <p style="color:#ff8080;margin:0;word-break:break-word;">${message}</p>
  </div>
  ${hint}
  <div style="margin-top:24px;">
    <p style="color:#555;font-size:12px;margin-bottom:8px;">ROUTING CHAIN ATTEMPTED:</p>
    ${layers.map((l, i) => `<div style="color:#00aa33;font-size:12px;padding:2px 0;">${i === 0 ? "▶" : "→"} ${l}</div>`).join("")}
  </div>
</body>
</html>`;
}

export default router;
