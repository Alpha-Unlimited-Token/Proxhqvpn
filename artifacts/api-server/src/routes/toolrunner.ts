// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Router } from "express";
import { spawn, type ChildProcess } from "child_process";
import { z } from "zod";
import { randomUUID } from "crypto";
import { existsSync } from "fs";

const router = Router();

const LOCAL_BIN = "/home/runner/.local/bin";
const WORDLIST  = "/home/runner/.local/wordlists/common.txt";
const SQLMAP_BIN = "/home/runner/workspace/.pythonlibs/bin/sqlmap";
const PYTHON_BIN = "/home/runner/workspace/.pythonlibs/bin/python3";
const TOOL_PATH  = `${LOCAL_BIN}:/nix/store/y5jbq5pim10v7z92rgk92wmq6zzwaiar-nmap-7.97/bin:${process.env.PATH ?? "/usr/bin:/bin"}`;

// ── Tool registry ─────────────────────────────────────────────────────────────
interface ToolDef {
  id: string;
  name: string;
  binary: string;
  category: string;
  description: string;
  fields: FieldDef[];
  buildArgs: (opts: Record<string, string>) => string[];
  timeoutMs: number;
  warning?: string;
}

interface FieldDef {
  id: string;
  label: string;
  type: "text" | "select" | "number" | "checkbox";
  placeholder?: string;
  defaultValue?: string;
  options?: { value: string; label: string }[];
  required?: boolean;
  hint?: string;
}

function toolBin(name: string): string {
  if (name === "sqlmap") return PYTHON_BIN;
  if (name === "nmap")   return "nmap";
  return `${LOCAL_BIN}/${name}`;
}

function isInstalled(tool: ToolDef): boolean {
  if (tool.binary === "sqlmap") return existsSync(SQLMAP_BIN);
  if (tool.binary === "nmap")   return true;
  if (["curl","dig","whois","openssl","ping","traceroute"].includes(tool.binary)) return true;
  return existsSync(`${LOCAL_BIN}/${tool.binary}`);
}

const TOOLS: ToolDef[] = [
  // ── Network Scanning ────────────────────────────────────────────────────────
  {
    id: "nmap",
    name: "Nmap",
    binary: "nmap",
    category: "Network Scanning",
    description: "Network discovery, port scanning, service/version detection and script-based vulnerability detection.",
    timeoutMs: 120_000,
    fields: [
      { id: "target", label: "Target (IP, hostname or CIDR)", type: "text", placeholder: "192.168.1.1 or example.com or 10.0.0.0/24", required: true },
      { id: "ports",  label: "Ports", type: "text", placeholder: "80,443,8080 or 1-1000 (blank = top 1000)", defaultValue: "" },
      { id: "mode",   label: "Scan Mode", type: "select", defaultValue: "quick", options: [
        { value: "quick",   label: "Quick (-T4 -F top 100 ports)" },
        { value: "default", label: "Default (-T4 top 1000 ports)" },
        { value: "version", label: "Version + Scripts (-sV -sC)" },
        { value: "vuln",    label: "Vulnerability Scripts (--script vuln)" },
        { value: "full",    label: "Full Port Scan (-p-)" },
        { value: "ping",    label: "Ping Sweep (-sn)" },
        { value: "udp",     label: "UDP Top 100 (-sU)" },
      ]},
      { id: "extra", label: "Extra Flags", type: "text", placeholder: "--open -oN /tmp/out.txt", defaultValue: "" },
    ],
    buildArgs(o) {
      const modeFlags: Record<string, string[]> = {
        quick:   ["-T4", "-F"],
        default: ["-T4"],
        version: ["-T4", "-sV", "-sC"],
        vuln:    ["-T4", "-sV", "--script", "vuln"],
        full:    ["-T4", "-p-"],
        ping:    ["-sn"],
        udp:     ["-sU", "--top-ports", "100"],
      };
      const args = [...(modeFlags[o.mode] ?? modeFlags.default)];
      if (o.ports?.trim()) args.push("-p", o.ports.trim());
      if (o.extra?.trim()) args.push(...o.extra.trim().split(/\s+/));
      args.push(o.target.trim());
      return args;
    },
  },

  // ── Web Vulnerability Scanning ───────────────────────────────────────────────
  {
    id: "nuclei",
    name: "Nuclei",
    binary: "nuclei",
    category: "Vulnerability Scanning",
    description: "Fast, template-based vulnerability scanner covering CVEs, misconfigs, exposures, and OWASP Top 10.",
    timeoutMs: 180_000,
    fields: [
      { id: "target", label: "Target URL", type: "text", placeholder: "https://example.com", required: true },
      { id: "templates", label: "Template Category", type: "select", defaultValue: "exposures", options: [
        { value: "exposures",           label: "Exposures (files, configs, tokens)" },
        { value: "cves",                label: "CVEs" },
        { value: "vulnerabilities",     label: "Vulnerabilities" },
        { value: "misconfiguration",    label: "Misconfigurations" },
        { value: "default-logins",      label: "Default Logins" },
        { value: "technologies",        label: "Technology Detection" },
        { value: "network",             label: "Network" },
      ]},
      { id: "severity", label: "Minimum Severity", type: "select", defaultValue: "medium", options: [
        { value: "info",     label: "Info" },
        { value: "low",      label: "Low" },
        { value: "medium",   label: "Medium" },
        { value: "high",     label: "High" },
        { value: "critical", label: "Critical" },
      ]},
      { id: "rateLimit", label: "Rate Limit (req/s)", type: "number", defaultValue: "50", placeholder: "50" },
    ],
    buildArgs(o) {
      return [
        "-u", o.target.trim(),
        "-t", o.templates,
        "-severity", o.severity,
        "-rate-limit", o.rateLimit || "50",
        "-timeout", "10",
        "-no-color",
        "-stats",
      ];
    },
  },

  // ── SQL Injection ────────────────────────────────────────────────────────────
  {
    id: "sqlmap",
    name: "SQLMap",
    binary: "sqlmap",
    category: "Injection Testing",
    description: "Automatic SQL injection detection and exploitation — tests GET/POST parameters, cookies, headers.",
    timeoutMs: 180_000,
    warning: "Only use against systems you own or have written permission to test.",
    fields: [
      { id: "url",   label: "Target URL", type: "text", placeholder: "https://example.com/page?id=1", required: true },
      { id: "level", label: "Test Level (1-5)", type: "select", defaultValue: "1", options: [
        { value: "1", label: "1 — Basic (fastest)" },
        { value: "2", label: "2 — Common payloads" },
        { value: "3", label: "3 — Extended (recommended)" },
        { value: "4", label: "4 — Deep" },
        { value: "5", label: "5 — Maximum (slowest)" },
      ]},
      { id: "risk", label: "Risk Level (1-3)", type: "select", defaultValue: "1", options: [
        { value: "1", label: "1 — Safe (no data modification)" },
        { value: "2", label: "2 — Slightly risky" },
        { value: "3", label: "3 — Risky (heavy OR-based)" },
      ]},
      { id: "technique", label: "Injection Technique", type: "select", defaultValue: "BEUSTQ", options: [
        { value: "BEUSTQ", label: "All techniques" },
        { value: "B",      label: "Boolean-based" },
        { value: "E",      label: "Error-based" },
        { value: "U",      label: "Union-based" },
        { value: "T",      label: "Time-based blind" },
      ]},
      { id: "dbms", label: "DBMS (optional)", type: "select", defaultValue: "", options: [
        { value: "",           label: "Auto-detect" },
        { value: "MySQL",      label: "MySQL" },
        { value: "PostgreSQL", label: "PostgreSQL" },
        { value: "Microsoft SQL Server", label: "MSSQL" },
        { value: "Oracle",     label: "Oracle" },
        { value: "SQLite",     label: "SQLite" },
      ]},
      { id: "data",    label: "POST Data", type: "text", placeholder: "username=test&password=test", defaultValue: "" },
      { id: "cookie",  label: "Cookie", type: "text", placeholder: "PHPSESSID=abc123", defaultValue: "" },
      { id: "headers", label: "Extra Headers", type: "text", placeholder: "Authorization: Bearer xxx", defaultValue: "" },
    ],
    buildArgs(o) {
      const args = [SQLMAP_BIN, "-u", o.url.trim(), `--level=${o.level}`, `--risk=${o.risk}`, `--technique=${o.technique}`, "--batch", "--no-logging"];
      if (o.dbms)    args.push(`--dbms=${o.dbms}`);
      if (o.data)    args.push("--data", o.data.trim());
      if (o.cookie)  args.push("--cookie", o.cookie.trim());
      if (o.headers) args.push("-H", o.headers.trim());
      return args;
    },
  },

  // ── Directory / Path Fuzzing ──────────────────────────────────────────────────
  {
    id: "ffuf",
    name: "ffuf",
    binary: "ffuf",
    category: "Fuzzing",
    description: "Fast web fuzzer — directory discovery, parameter fuzzing, vhost enumeration.",
    timeoutMs: 120_000,
    fields: [
      { id: "url",      label: "URL (use FUZZ as placeholder)", type: "text", placeholder: "https://example.com/FUZZ", required: true },
      { id: "mode",     label: "Fuzzing Mode", type: "select", defaultValue: "dir", options: [
        { value: "dir",    label: "Directory / Path" },
        { value: "param",  label: "GET Parameter" },
        { value: "vhost",  label: "Virtual Host" },
        { value: "post",   label: "POST Body" },
      ]},
      { id: "wordlist", label: "Wordlist", type: "select", defaultValue: WORDLIST, options: [
        { value: WORDLIST, label: "Common (built-in, 4700 words)" },
      ]},
      { id: "matchCodes", label: "Match HTTP Codes", type: "text", placeholder: "200,301,302,403", defaultValue: "200,301,302,403" },
      { id: "filterSize", label: "Filter Response Size (bytes, optional)", type: "text", placeholder: "0", defaultValue: "" },
      { id: "threads",  label: "Threads", type: "number", defaultValue: "50" },
      { id: "timeout",  label: "Timeout per request (s)", type: "number", defaultValue: "10" },
    ],
    buildArgs(o) {
      let url = o.url.trim();
      if (o.mode === "param" && !url.includes("FUZZ"))   url += "?q=FUZZ";
      if (o.mode === "vhost")                             url = url.replace(/\/.*/, "");
      if (o.mode === "post" && !url.includes("FUZZ"))     url = url + " (POST)";
      const args = ["-u", url, "-w", `${o.wordlist}:FUZZ`, "-t", o.threads || "50",
        "-timeout", o.timeout || "10", "-mc", o.matchCodes || "200,301,302,403", "-no-color"];
      if (o.filterSize?.trim()) args.push("-fs", o.filterSize.trim());
      if (o.mode === "vhost") args.push("-H", "Host: FUZZ");
      if (o.mode === "post")  args.push("-X", "POST", "-d", "data=FUZZ");
      return args;
    },
  },

  {
    id: "gobuster",
    name: "Gobuster",
    binary: "gobuster",
    category: "Fuzzing",
    description: "Directory, DNS, and vhost brute-forcer using Go concurrency.",
    timeoutMs: 120_000,
    fields: [
      { id: "mode",     label: "Mode", type: "select", defaultValue: "dir", options: [
        { value: "dir",   label: "Directory / File Brute-force" },
        { value: "dns",   label: "DNS Subdomain Enumeration" },
        { value: "vhost", label: "Virtual Host Discovery" },
      ]},
      { id: "target",   label: "Target (URL or domain)", type: "text", placeholder: "https://example.com or example.com", required: true },
      { id: "wordlist", label: "Wordlist", type: "select", defaultValue: WORDLIST, options: [
        { value: WORDLIST, label: "Common (built-in, 4700 words)" },
      ]},
      { id: "threads",  label: "Threads", type: "number", defaultValue: "50" },
      { id: "extensions", label: "Extensions (dir mode)", type: "text", placeholder: "php,html,js,txt", defaultValue: "php,html,js,txt" },
      { id: "statusCodes", label: "Status Codes", type: "text", placeholder: "200,301,302,403", defaultValue: "200,301,302,403" },
    ],
    buildArgs(o) {
      const target = o.target.trim();
      const args = [o.mode, "-w", o.wordlist, "-t", o.threads || "50", "--no-color"];
      if (o.mode === "dir") {
        args.push("-u", target, "-x", o.extensions || "php,html,js,txt", "-s", o.statusCodes || "200,301,302,403");
      } else if (o.mode === "dns") {
        args.push("-d", target.replace(/^https?:\/\//, ""));
      } else if (o.mode === "vhost") {
        args.push("-u", target);
      }
      return args;
    },
  },

  {
    id: "feroxbuster",
    name: "Feroxbuster",
    binary: "feroxbuster",
    category: "Fuzzing",
    description: "Recursive content discovery tool — auto-recurses into discovered directories up to configurable depth.",
    timeoutMs: 180_000,
    fields: [
      { id: "url",      label: "Target URL", type: "text", placeholder: "https://example.com", required: true },
      { id: "depth",    label: "Recursion Depth", type: "select", defaultValue: "2", options: [
        { value: "1", label: "1 — No recursion" },
        { value: "2", label: "2 — One level deep" },
        { value: "3", label: "3 — Two levels deep" },
        { value: "4", label: "4 — Full recursion" },
      ]},
      { id: "wordlist", label: "Wordlist", type: "select", defaultValue: WORDLIST, options: [
        { value: WORDLIST, label: "Common (built-in, 4700 words)" },
      ]},
      { id: "threads",  label: "Threads", type: "number", defaultValue: "50" },
      { id: "filterStatus", label: "Filter Status Codes", type: "text", placeholder: "404,400", defaultValue: "404,400" },
      { id: "extensions", label: "Extensions", type: "text", placeholder: "php,html,txt,js", defaultValue: "php,html,txt,js" },
    ],
    buildArgs(o) {
      return [
        "-u", o.url.trim(),
        "-w", o.wordlist,
        "--depth", o.depth || "2",
        "--threads", o.threads || "50",
        "--filter-status", o.filterStatus || "404,400",
        "--extensions", o.extensions || "php,html,txt,js",
        "--no-state",
        "--quiet",
      ];
    },
  },

  // ── Subdomain Enumeration ─────────────────────────────────────────────────────
  {
    id: "subfinder",
    name: "Subfinder",
    binary: "subfinder",
    category: "Subdomain Enumeration",
    description: "Passive subdomain enumeration using 40+ OSINT sources (crt.sh, AlienVault, Shodan, etc.).",
    timeoutMs: 120_000,
    fields: [
      { id: "domain",  label: "Domain", type: "text", placeholder: "example.com", required: true },
      { id: "timeout", label: "Timeout (s)", type: "number", defaultValue: "30" },
      { id: "allSources", label: "All Sources", type: "checkbox", defaultValue: "false", hint: "Enable all passive sources (slower)" },
    ],
    buildArgs(o) {
      const args = ["-d", o.domain.trim(), "-timeout", o.timeout || "30", "-silent", "-oJ"];
      if (o.allSources === "true") args.push("-all");
      return args;
    },
  },

  // ── HTTP Probing ──────────────────────────────────────────────────────────────
  {
    id: "httpx",
    name: "httpx",
    binary: "httpx",
    category: "HTTP Probing",
    description: "HTTP probe tool — detects status codes, titles, technologies, TLS, headers and web server fingerprints.",
    timeoutMs: 60_000,
    fields: [
      { id: "target", label: "Target URL(s) — comma separated", type: "text", placeholder: "https://example.com,https://api.example.com", required: true },
      { id: "probes", label: "Probe Options", type: "select", defaultValue: "standard", options: [
        { value: "standard",   label: "Standard (status, title, server)" },
        { value: "full",       label: "Full (tech detect, TLS, headers, JARM)" },
        { value: "screenshot", label: "Content Body Extract" },
        { value: "cdn",        label: "CDN Detection" },
      ]},
      { id: "followRedirects", label: "Follow Redirects", type: "checkbox", defaultValue: "true" },
      { id: "timeout", label: "Timeout (s)", type: "number", defaultValue: "10" },
    ],
    buildArgs(o) {
      const targets = o.target.split(",").map((t: string) => t.trim()).filter(Boolean);
      const baseArgs = ["-no-color", "-timeout", o.timeout || "10"];
      if (o.followRedirects === "true") baseArgs.push("-follow-redirects");
      const probeArgs: Record<string, string[]> = {
        standard:   ["-status-code", "-title", "-web-server", "-content-length"],
        full:       ["-status-code", "-title", "-web-server", "-tech-detect", "-tls-grab", "-jarm", "-hash", "md5"],
        screenshot: ["-status-code", "-title", "-body-preview", "200"],
        cdn:        ["-status-code", "-title", "-cdn"],
      };
      const args = [...baseArgs, ...(probeArgs[o.probes] ?? probeArgs.standard)];
      for (const t of targets) args.push("-u", t);
      return args;
    },
  },

  // ── DNS Tools ─────────────────────────────────────────────────────────────────
  {
    id: "dig",
    name: "dig",
    binary: "dig",
    category: "DNS",
    description: "DNS lookup tool — A, AAAA, MX, TXT, NS, CNAME, PTR and full zone transfer attempts.",
    timeoutMs: 30_000,
    fields: [
      { id: "domain", label: "Domain", type: "text", placeholder: "example.com", required: true },
      { id: "type",   label: "Record Type", type: "select", defaultValue: "ANY", options: [
        { value: "ANY",   label: "ANY — All records" },
        { value: "A",     label: "A — IPv4" },
        { value: "AAAA",  label: "AAAA — IPv6" },
        { value: "MX",    label: "MX — Mail" },
        { value: "TXT",   label: "TXT — Text (SPF/DKIM/DMARC)" },
        { value: "NS",    label: "NS — Name Servers" },
        { value: "CNAME", label: "CNAME — Canonical Name" },
        { value: "PTR",   label: "PTR — Reverse DNS" },
        { value: "SOA",   label: "SOA — Start of Authority" },
        { value: "AXFR",  label: "AXFR — Zone Transfer" },
      ]},
      { id: "resolver", label: "Resolver (optional)", type: "text", placeholder: "8.8.8.8 or 1.1.1.1", defaultValue: "" },
    ],
    buildArgs(o) {
      const args: string[] = [];
      if (o.resolver?.trim()) args.push(`@${o.resolver.trim()}`);
      args.push(o.domain.trim(), o.type);
      if (o.type !== "AXFR") args.push("+noall", "+answer", "+additional");
      return args;
    },
  },

  // ── SSL / TLS Inspection ──────────────────────────────────────────────────────
  {
    id: "openssl",
    name: "OpenSSL",
    binary: "openssl",
    category: "SSL / TLS",
    description: "TLS handshake analysis, certificate inspection, cipher enumeration, and protocol downgrade tests.",
    timeoutMs: 30_000,
    fields: [
      { id: "host", label: "Host", type: "text", placeholder: "example.com", required: true },
      { id: "port", label: "Port", type: "number", defaultValue: "443" },
      { id: "mode", label: "Mode", type: "select", defaultValue: "cert", options: [
        { value: "cert",    label: "Certificate Details" },
        { value: "chain",   label: "Full Certificate Chain" },
        { value: "ciphers", label: "Cipher Suites" },
        { value: "tls13",   label: "TLS 1.3 Test" },
        { value: "tls12",   label: "TLS 1.2 Test" },
        { value: "tls11",   label: "TLS 1.1 Test (deprecated)" },
      ]},
    ],
    buildArgs(o) {
      const target = `${o.host.trim()}:${o.port || 443}`;
      const modeArgs: Record<string, string[]> = {
        cert:    ["s_client", "-connect", target, "-showcerts"],
        chain:   ["s_client", "-connect", target, "-showcerts", "-verify", "5"],
        ciphers: ["ciphers", "-v"],
        tls13:   ["s_client", "-connect", target, "-tls1_3"],
        tls12:   ["s_client", "-connect", target, "-tls1_2"],
        tls11:   ["s_client", "-connect", target, "-tls1_1"],
      };
      return modeArgs[o.mode] ?? modeArgs.cert;
    },
  },

  // ── HTTP Client ───────────────────────────────────────────────────────────────
  {
    id: "curl",
    name: "cURL",
    binary: "curl",
    category: "HTTP Client",
    description: "Full-featured HTTP client — headers, redirects, cookies, auth, custom methods, TLS inspection.",
    timeoutMs: 30_000,
    fields: [
      { id: "url",     label: "URL", type: "text", placeholder: "https://example.com", required: true },
      { id: "method",  label: "Method", type: "select", defaultValue: "GET", options: [
        { value: "GET", label: "GET" }, { value: "POST", label: "POST" },
        { value: "PUT", label: "PUT" }, { value: "DELETE", label: "DELETE" },
        { value: "HEAD", label: "HEAD" }, { value: "OPTIONS", label: "OPTIONS" },
        { value: "PATCH", label: "PATCH" },
      ]},
      { id: "data",    label: "POST Body", type: "text", placeholder: '{"key":"value"} or form=data', defaultValue: "" },
      { id: "headers", label: "Headers (one per line)", type: "text", placeholder: "Authorization: Bearer xxx\nContent-Type: application/json", defaultValue: "" },
      { id: "insecure", label: "Skip TLS Verification", type: "checkbox", defaultValue: "false" },
      { id: "redirects", label: "Follow Redirects", type: "checkbox", defaultValue: "true" },
      { id: "timeout", label: "Timeout (s)", type: "number", defaultValue: "30" },
    ],
    buildArgs(o) {
      const args = ["-v", "-X", o.method, "--max-time", o.timeout || "30"];
      if (o.redirects === "true") args.push("-L");
      if (o.insecure === "true") args.push("-k");
      if (o.data?.trim()) args.push("-d", o.data.trim());
      for (const h of (o.headers || "").split("\n").map((x: string) => x.trim()).filter(Boolean)) {
        args.push("-H", h);
      }
      args.push(o.url.trim());
      return args;
    },
  },

  // ── WHOIS ─────────────────────────────────────────────────────────────────────
  {
    id: "whois",
    name: "WHOIS",
    binary: "whois",
    category: "OSINT",
    description: "Domain and IP registration info — registrar, name servers, creation date, ASN, abuse contact.",
    timeoutMs: 20_000,
    fields: [
      { id: "target", label: "Domain or IP", type: "text", placeholder: "example.com or 1.2.3.4", required: true },
      { id: "server", label: "WHOIS Server (optional)", type: "text", placeholder: "whois.verisign-grs.com", defaultValue: "" },
    ],
    buildArgs(o) {
      const args: string[] = [];
      if (o.server?.trim()) args.push("-h", o.server.trim());
      args.push(o.target.trim());
      return args;
    },
  },

  // ── Ping / Connectivity ────────────────────────────────────────────────────────
  {
    id: "ping",
    name: "Ping",
    binary: "ping",
    category: "Network",
    description: "ICMP echo test — latency, packet loss, host reachability.",
    timeoutMs: 30_000,
    fields: [
      { id: "host",  label: "Host or IP", type: "text", placeholder: "example.com or 8.8.8.8", required: true },
      { id: "count", label: "Packet Count", type: "number", defaultValue: "10" },
      { id: "size",  label: "Packet Size (bytes)", type: "number", defaultValue: "56" },
    ],
    buildArgs(o) {
      return ["-c", o.count || "10", "-s", o.size || "56", o.host.trim()];
    },
  },
];

// ── Running jobs map ──────────────────────────────────────────────────────────
interface Job {
  proc: ChildProcess;
  lines: string[];
  done: boolean;
  exitCode: number | null;
  listeners: ((line: string) => void)[];
  toolId: string;
  startedAt: string;
}
const jobs = new Map<string, Job>();

// ── GET /tools — list all tools with installed status ─────────────────────────
router.get("/tools", (_req, res) => {
  res.json(TOOLS.map(t => ({
    id: t.id,
    name: t.name,
    binary: t.binary,
    category: t.category,
    description: t.description,
    fields: t.fields,
    installed: isInstalled(t),
    warning: t.warning ?? null,
    timeoutMs: t.timeoutMs,
  })));
});

// ── POST /run — start a tool run ──────────────────────────────────────────────
const RunSchema = z.object({
  toolId: z.string(),
  opts:   z.record(z.string()),
});

router.post("/run", (req, res) => {
  const { toolId, opts } = RunSchema.parse(req.body);
  const tool = TOOLS.find(t => t.id === toolId);
  if (!tool) return res.status(404).json({ error: "Unknown tool: " + toolId });
  if (!isInstalled(tool)) return res.status(400).json({ error: `Tool '${tool.name}' is not installed on this server.` });

  // Validate required fields
  for (const f of tool.fields) {
    if (f.required && !opts[f.id]?.trim()) {
      return res.status(400).json({ error: `Field '${f.label}' is required.` });
    }
  }

  const jobId = randomUUID();
  const args   = tool.buildArgs(opts);
  const binary = tool.binary === "sqlmap" ? PYTHON_BIN : (tool.binary === "nmap" ? "nmap" : `${LOCAL_BIN}/${tool.binary}`);
  const allArgs = tool.binary === "sqlmap" ? args : args;

  const proc = spawn(binary, allArgs, {
    env: { ...process.env, PATH: TOOL_PATH, HOME: process.env.HOME ?? "/tmp" },
    stdio: ["ignore", "pipe", "pipe"],
    timeout: tool.timeoutMs,
  });

  const job: Job = {
    proc,
    lines: [`[proxhqvpn] Running: ${binary} ${allArgs.join(" ")}\n`],
    done: false,
    exitCode: null,
    listeners: [],
    toolId,
    startedAt: new Date().toISOString(),
  };
  jobs.set(jobId, job);

  function emit(line: string) {
    job.lines.push(line);
    for (const l of job.listeners) l(line);
  }

  proc.stdout.on("data", (d: Buffer) => emit(d.toString()));
  proc.stderr.on("data", (d: Buffer) => emit(`[stderr] ${d.toString()}`));
  proc.on("close", code => {
    job.done     = true;
    job.exitCode = code;
    emit(`\n[proxhqvpn] Process exited with code ${code ?? "?"}\n`);
    // Clean up after 5 min
    setTimeout(() => jobs.delete(jobId), 300_000);
  });
  proc.on("error", err => {
    job.done     = true;
    job.exitCode = 1;
    emit(`[proxhqvpn] Error: ${err.message}\n`);
  });

  res.json({ jobId, command: `${binary} ${allArgs.join(" ")}` });
});

// ── GET /stream/:jobId — SSE stream ──────────────────────────────────────────
router.get("/stream/:jobId", (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: "Job not found or expired" });

  res.setHeader("Content-Type",  "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection",    "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  function send(data: string) {
    res.write(`data: ${JSON.stringify({ text: data })}\n\n`);
  }

  // Replay buffered lines
  for (const line of job.lines) send(line);

  if (job.done) {
    res.write(`data: ${JSON.stringify({ done: true, exitCode: job.exitCode })}\n\n`);
    res.end();
    return;
  }

  const listener = (line: string) => send(line);
  job.listeners.push(listener);

  job.proc.on("close", (code) => {
    res.write(`data: ${JSON.stringify({ done: true, exitCode: code })}\n\n`);
    res.end();
  });

  req.on("close", () => {
    const idx = job.listeners.indexOf(listener);
    if (idx !== -1) job.listeners.splice(idx, 1);
  });
});

// ── DELETE /kill/:jobId ────────────────────────────────────────────────────────
router.delete("/kill/:jobId", (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: "Job not found" });
  if (job.done) return res.json({ ok: true, message: "Already completed" });
  try {
    job.proc.kill("SIGTERM");
    setTimeout(() => { if (!job.done) job.proc.kill("SIGKILL"); }, 3000);
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /jobs — list active jobs ──────────────────────────────────────────────
router.get("/jobs", (_req, res) => {
  const list = [];
  for (const [id, j] of jobs.entries()) {
    list.push({ jobId: id, toolId: j.toolId, startedAt: j.startedAt, done: j.done, exitCode: j.exitCode });
  }
  res.json(list);
});

export default router;
