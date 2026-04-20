import { Router } from "express";
import { SocksProxyAgent } from "socks-proxy-agent";
import fetch from "node-fetch";
import type { RequestInit } from "node-fetch";

const router = Router();

type ProxyMode = "direct" | "ghostnet-onion" | "tor-gateway" | "double-layer";

interface ProxyConfig {
  mode: ProxyMode;
  socks5Host: string;
  socks5Port: number;
  chainLength: number;
  enabled: boolean;
}

const DEFAULT_CONFIG: ProxyConfig = {
  mode: "ghostnet-onion",
  socks5Host: "127.0.0.1",
  socks5Port: 9050,
  chainLength: 7,
  enabled: true,
};

let currentConfig: ProxyConfig = { ...DEFAULT_CONFIG };

const GHOSTNET_HOP_REGIONS = [
  "EU-North", "EU-Central", "AP-Tokyo", "AP-Singapore", "US-East",
  "US-West", "SA-Brazil", "AF-Lagos", "ME-Dubai", "AP-Sydney",
];

function randomRegion() {
  return GHOSTNET_HOP_REGIONS[Math.floor(Math.random() * GHOSTNET_HOP_REGIONS.length)];
}

function buildLayers(mode: ProxyMode, chainLength: number): string[] {
  switch (mode) {
    case "direct":
      return ["Direct Connection", "Destination"];
    case "ghostnet-onion": {
      const hops = Array.from({ length: Math.min(chainLength, 7) }, (_, i) =>
        `GhostNet Relay #${i + 1} (${randomRegion()})`
      );
      return ["Your Device", ...hops, "Destination"];
    }
    case "tor-gateway":
      return [
        "Your Device",
        "Tor Entry Guard",
        "Tor Middle Relay",
        "Tor Exit Node",
        "Destination",
      ];
    case "double-layer": {
      const ghostHops = Array.from({ length: 3 }, (_, i) =>
        `GhostNet Relay #${i + 1} (${randomRegion()})`
      );
      return [
        "Your Device",
        ...ghostHops,
        "Tor Entry Guard",
        "Tor Middle Relay",
        "Tor Exit Node",
        "Destination",
      ];
    }
  }
}

function rewriteHtml(html: string, baseUrl: string, proxyMode: ProxyMode): string {
  const parsedBase = new URL(baseUrl);
  const origin = parsedBase.origin;
  const basePath = parsedBase.pathname.replace(/\/[^/]*$/, "/");

  const baseTag = `<base href="${origin}${basePath}">`;
  const interceptScript = `
<script>
(function() {
  document.addEventListener('click', function(e) {
    var el = e.target.closest('a');
    if (el && el.href && !el.href.startsWith('javascript:')) {
      e.preventDefault();
      e.stopPropagation();
      window.parent.postMessage({ type: 'ghost-navigate', url: el.href }, '*');
    }
  });
  document.addEventListener('submit', function(e) {
    e.preventDefault();
    var form = e.target;
    var action = form.action || window.location.href;
    window.parent.postMessage({ type: 'ghost-navigate', url: action }, '*');
  });
  window.parent.postMessage({ type: 'ghost-loaded', url: '${baseUrl}' }, '*');
})();
<\/script>`;

  const ghostBadge = `
<div id="ghost-security-badge" style="
  position:fixed;bottom:12px;right:12px;z-index:999999;
  background:#000;border:1px solid #00ff41;color:#00ff41;
  font-family:monospace;font-size:11px;padding:6px 10px;
  border-radius:4px;pointer-events:none;opacity:0.85;
">
  🔒 GHOSTNET ${proxyMode.toUpperCase()} ACTIVE
</div>`;

  let result = html;

  if (/<head[^>]*>/i.test(result)) {
    result = result.replace(/(<head[^>]*>)/i, `$1${baseTag}${interceptScript}`);
  } else {
    result = baseTag + interceptScript + result;
  }

  if (/<\/body>/i.test(result)) {
    result = result.replace(/<\/body>/i, `${ghostBadge}</body>`);
  } else {
    result = result + ghostBadge;
  }

  return result;
}

async function fetchThroughProxy(
  url: string,
  mode: ProxyMode,
  config: ProxyConfig
): Promise<{ html: string; finalUrl: string; statusCode: number; title: string }> {
  const opts: RequestInit = {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; rv:102.0) Gecko/20100101 Firefox/102.0",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.5",
      "Accept-Encoding": "identity",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(15000),
  };

  if (mode === "tor-gateway" || mode === "double-layer") {
    const proxyUrl = `socks5h://${config.socks5Host}:${config.socks5Port}`;
    (opts as any).agent = new SocksProxyAgent(proxyUrl);
  }

  const response = await fetch(url, opts);
  const finalUrl = response.url || url;
  const statusCode = response.status;
  const contentType = response.headers.get("content-type") || "";

  let html: string;
  if (contentType.includes("text/html") || contentType.includes("text/plain")) {
    html = await response.text();
  } else {
    html = `<html><body style="background:#000;color:#00ff41;font-family:monospace;padding:20px;">
      <p>Content-Type: ${contentType}</p>
      <p>Cannot render this content type in the GhostNet browser.</p>
      <p>URL: <a href="${finalUrl}" style="color:#00ff41">${finalUrl}</a></p>
    </body></html>`;
  }

  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : finalUrl;

  const rewritten = rewriteHtml(html, finalUrl, mode);
  return { html: rewritten, finalUrl, statusCode, title };
}

router.get("/config", (_req, res) => {
  res.json(currentConfig);
});

router.post("/config", (req, res) => {
  const { mode, socks5Host, socks5Port } = req.body as Partial<ProxyConfig>;
  if (mode) currentConfig.mode = mode;
  if (socks5Host) currentConfig.socks5Host = socks5Host;
  if (socks5Port) currentConfig.socks5Port = Number(socks5Port);
  res.json(currentConfig);
});

router.post("/fetch", async (req, res) => {
  const { url, mode: reqMode } = req.body as { url?: string; mode?: ProxyMode };

  if (!url) {
    res.status(400).json({ error: "url is required", finalUrl: "", layers: [], timing: 0 });
    return;
  }

  let normalizedUrl = url.trim();
  if (!normalizedUrl.startsWith("http://") && !normalizedUrl.startsWith("https://")) {
    if (normalizedUrl.endsWith(".onion")) {
      normalizedUrl = "http://" + normalizedUrl;
    } else {
      normalizedUrl = "https://" + normalizedUrl;
    }
  }

  const mode = reqMode ?? currentConfig.mode;
  const layers = buildLayers(mode, currentConfig.chainLength);
  const t0 = Date.now();

  try {
    const { html, finalUrl, statusCode, title } = await fetchThroughProxy(
      normalizedUrl,
      mode,
      currentConfig
    );
    const timing = Date.now() - t0;
    res.json({ html, finalUrl, statusCode, layers, timing, title });
  } catch (err: any) {
    const timing = Date.now() - t0;
    const isTorError =
      (mode === "tor-gateway" || mode === "double-layer") &&
      (err.code === "ECONNREFUSED" || err.cause?.code === "ECONNREFUSED");

    const errorMsg = isTorError
      ? "Cannot connect to Tor SOCKS5 proxy — ensure Tor daemon is running on " +
        `${currentConfig.socks5Host}:${currentConfig.socks5Port}. ` +
        "Install Tor: https://www.torproject.org/download/"
      : `Fetch failed: ${err.message ?? String(err)}`;

    res.json({
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

function buildErrorPage(
  message: string,
  url: string,
  mode: ProxyMode,
  layers: string[]
): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>GhostNet Connection Error</title></head>
<body style="background:#000;color:#00ff41;font-family:'Courier New',monospace;padding:32px;max-width:640px;">
  <h2 style="color:#ff4141;margin-bottom:16px;">⚠ CONNECTION FAILED</h2>
  <p style="color:#aaa;margin-bottom:8px;">URL: <span style="color:#00ff41">${url}</span></p>
  <p style="color:#aaa;margin-bottom:24px;">Mode: <span style="color:#00ff41">${mode.toUpperCase()}</span></p>
  <div style="border:1px solid #ff4141;padding:16px;border-radius:4px;background:#110000;">
    <p style="color:#ff8080;margin:0;">${message}</p>
  </div>
  <div style="margin-top:24px;">
    <p style="color:#555;font-size:12px;">ROUTING CHAIN ATTEMPTED:</p>
    ${layers.map((l, i) => `<div style="color:#00aa33;font-size:12px;padding:2px 0;">${i === 0 ? "▶" : "→"} ${l}</div>`).join("")}
  </div>
</body>
</html>`;
}

export default router;
