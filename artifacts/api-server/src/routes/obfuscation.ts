// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Router } from "express";
import crypto from "crypto";

const router = Router();

type ObfsMode = "none" | "obfs4" | "shadowsocks" | "v2ray-ws" | "meek" | "snowflake" | "xor-pad";

interface ObfsConfig {
  mode: ObfsMode;
  enabled: boolean;
  listenPort: number;
  upstreamHost: string;
  upstreamPort: number;
  password: string;
  method: string;
  wsPath: string;
  cert: string;
  iatMode: number;
  updatedAt: string;
}

let config: ObfsConfig = {
  mode:          "none",
  enabled:       false,
  listenPort:    8388,
  upstreamHost:  "127.0.0.1",
  upstreamPort:  51820,
  password:      crypto.randomBytes(16).toString("hex"),
  method:        "chacha20-ietf-poly1305",
  wsPath:        "/proxhq-ws",
  cert:          "",
  iatMode:       0,
  updatedAt:     new Date().toISOString(),
};

const MODE_INFO: Record<ObfsMode, { name: string; description: string; antiDpi: boolean; difficulty: string }> = {
  none:           { name: "No Obfuscation",    description: "Raw WireGuard/VPN traffic. Detectable by DPI.",               antiDpi: false, difficulty: "none" },
  obfs4:          { name: "obfs4",             description: "Tor Project's obfs4 scrambles traffic to resist fingerprinting.", antiDpi: true, difficulty: "moderate" },
  shadowsocks:    { name: "Shadowsocks",       description: "AEAD-encrypted proxy. Widely used to bypass GFW.",              antiDpi: true, difficulty: "easy" },
  "v2ray-ws":     { name: "V2Ray WebSocket",   description: "Tunnels traffic over WebSocket+TLS, looks like normal HTTPS.",   antiDpi: true, difficulty: "moderate" },
  meek:           { name: "Meek",              description: "Domain-fronts traffic via CDN (Cloudflare/Azure/AWS).",          antiDpi: true, difficulty: "advanced" },
  snowflake:      { name: "Snowflake",         description: "Uses WebRTC P2P to bypass censorship via volunteer bridges.",    antiDpi: true, difficulty: "easy" },
  "xor-pad":      { name: "XOR Pad",           description: "Simple XOR byte scrambling. Low overhead, moderate resistance.", antiDpi: false, difficulty: "easy" },
};

function generateShadowsocksConfig(): object {
  return {
    server:      config.upstreamHost,
    server_port: config.listenPort,
    local_address: "127.0.0.1",
    local_port:  1080,
    password:    config.password,
    method:      config.method,
    timeout:     300,
    mode:        "tcp_and_udp",
    fast_open:   true,
  };
}

function generateObfs4Cert(): string {
  const raw = crypto.randomBytes(52);
  return raw.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function generateObfs4Bridges(): string[] {
  const cert = generateObfs4Cert();
  const iat  = config.iatMode;
  return [
    `Bridge obfs4 ${config.upstreamHost}:${config.listenPort} ${crypto.randomBytes(20).toString("hex")} cert=${cert} iat-mode=${iat}`,
    `# Add to torrc:`,
    `UseBridges 1`,
    `ClientTransportPlugin obfs4 exec /usr/bin/obfs4proxy`,
  ];
}

function generateV2RayConfig(): object {
  return {
    inbounds: [{
      port: config.listenPort,
      protocol: "vmess",
      settings: {
        clients: [{ id: crypto.randomUUID(), alterId: 0 }],
      },
      streamSettings: {
        network: "ws",
        wsSettings: { path: config.wsPath },
        security: "tls",
      },
    }],
    outbounds: [{
      protocol: "freedom",
      tag: "direct",
    }],
  };
}

function generateDockerCompose(): string {
  if (config.mode === "shadowsocks") {
    return `services:
  shadowsocks:
    image: shadowsocks/shadowsocks-libev:latest
    restart: unless-stopped
    ports:
      - "${config.listenPort}:${config.listenPort}/tcp"
      - "${config.listenPort}:${config.listenPort}/udp"
    command: >
      ss-server
      -s 0.0.0.0
      -p ${config.listenPort}
      -k "${config.password}"
      -m ${config.method}
      --fast-open
      -u
`;
  }
  if (config.mode === "v2ray-ws") {
    return `services:
  v2ray:
    image: v2fly/v2fly-core:latest
    restart: unless-stopped
    ports:
      - "${config.listenPort}:${config.listenPort}"
    volumes:
      - ./v2ray_config.json:/etc/v2ray/config.json:ro
`;
  }
  return `# No Docker config for mode: ${config.mode}\n# Use the generated config file directly.`;
}

function generateClientConfig(): object {
  switch (config.mode) {
    case "shadowsocks":
      return {
        type: "json",
        filename: "ss_client.json",
        content: generateShadowsocksConfig(),
        install: "ss-local -c ss_client.json",
        proxyPort: 1080,
      };
    case "obfs4":
      return {
        type: "torrc",
        filename: "obfs4_bridges.txt",
        content: generateObfs4Bridges().join("\n"),
        install: "obfs4proxy (install via: apt install obfs4proxy)",
        proxyPort: config.listenPort,
      };
    case "v2ray-ws":
      return {
        type: "json",
        filename: "v2ray_config.json",
        content: generateV2RayConfig(),
        install: "v2ray -config v2ray_config.json",
        proxyPort: config.listenPort,
      };
    case "xor-pad":
      return {
        type: "env",
        filename: "xor.env",
        content: { XOR_KEY: crypto.randomBytes(32).toString("hex"), LISTEN_PORT: config.listenPort, TARGET: `${config.upstreamHost}:${config.upstreamPort}` },
        install: "python3 xor_proxy.py",
        proxyPort: config.listenPort,
      };
    default:
      return { type: "none", note: `No client config needed for mode: ${config.mode}` };
  }
}

router.get("/config", (_req, res) => {
  res.json({ ...config, modeInfo: MODE_INFO[config.mode] });
});

router.get("/modes", (_req, res) => {
  res.json({
    modes: Object.entries(MODE_INFO).map(([id, info]) => ({ id, ...info })),
  });
});

router.put("/config", (req, res) => {
  const { mode, enabled, listenPort, upstreamHost, upstreamPort, password, method, wsPath, iatMode } =
    req.body as Partial<ObfsConfig>;

  if (mode && !(mode in MODE_INFO)) {
    return res.status(400).json({ error: `Invalid mode. Valid: ${Object.keys(MODE_INFO).join(", ")}` });
  }
  if (mode)            config.mode          = mode;
  if (enabled !== undefined) config.enabled = enabled;
  if (listenPort)      config.listenPort    = listenPort;
  if (upstreamHost)    config.upstreamHost  = upstreamHost;
  if (upstreamPort)    config.upstreamPort  = upstreamPort;
  if (password)        config.password      = password;
  if (method)          config.method        = method;
  if (wsPath)          config.wsPath        = wsPath;
  if (iatMode !== undefined) config.iatMode = iatMode;
  config.updatedAt = new Date().toISOString();

  res.json({ ...config, modeInfo: MODE_INFO[config.mode] });
});

router.post("/rotate-password", (_req, res) => {
  config.password  = crypto.randomBytes(16).toString("hex");
  config.updatedAt = new Date().toISOString();
  res.json({ password: config.password, rotatedAt: config.updatedAt });
});

router.get("/generate-server-config", (_req, res) => {
  res.json({
    mode: config.mode,
    serverConfig:   generateClientConfig(),
    dockerCompose:  generateDockerCompose(),
    dpiBypassLevel: MODE_INFO[config.mode].antiDpi ? "high" : "none",
    recommendation: config.mode === "none"
      ? "Enable obfuscation if you're in a censored region or if your VPN is being blocked."
      : `${MODE_INFO[config.mode].name} active — traffic is disguised to evade DPI.`,
  });
});

router.get("/generate-client-config", (_req, res) => {
  res.json(generateClientConfig());
});

router.get("/dpi-test-guide", (_req, res) => {
  res.json({
    tools: [
      { name: "GoodbyeDPI",    platform: "Windows", url: "https://github.com/ValdikSS/GoodbyeDPI",    description: "Passive/active DPI bypass for Windows" },
      { name: "Zapret",        platform: "Linux",   url: "https://github.com/bol-van/zapret",          description: "DPI bypass for Linux routers" },
      { name: "Wireshark",     platform: "All",     url: "https://www.wireshark.org",                  description: "Capture and inspect your own traffic" },
      { name: "nDPI",          platform: "Linux",   url: "https://github.com/ntop/nDPI",               description: "DPI library to check if your traffic is identifiable" },
      { name: "OONI Probe",    platform: "All",     url: "https://ooni.org/install",                   description: "Detect censorship and VPN blocking in your country" },
    ],
    steps: [
      "1. Run Wireshark on your VPN interface (tun0/wg0)",
      "2. Look for consistent packet sizes, timing patterns, or TLS fingerprints",
      "3. If patterns are consistent → DPI can identify your VPN type",
      "4. Enable obfuscation mode (obfs4 or Shadowsocks) to randomize traffic",
      "5. Re-run Wireshark — traffic should now appear as random/TLS",
    ],
  });
});

export default router;
