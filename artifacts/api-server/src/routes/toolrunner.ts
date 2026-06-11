// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Parrot OS Tool Runner — v2.0 hardened (2026-06-11)
// Security changes: SSRF protection, scope enforcement, approval workflow,
// audit logging, DB persistence, GeoIP enrichment, per-user concurrency limit.
import { Router, type Request, type Response } from "express";
import { spawn, type ChildProcess } from "child_process";
import { z } from "zod";
import { randomUUID } from "crypto";
import { existsSync } from "fs";
import { Writable } from "stream";
import geoip from "geoip-lite";
import archiver from "archiver";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import {
  toolJobsTable, toolTargetScopesTable, toolApprovalsTable,
  nodeAgentHealthTable, nodeAgentEventsTable,
} from "@workspace/db/schema";
import { eq, and, desc, isNull, gte, lte } from "drizzle-orm";
import { appendAuditEvent } from "../lib/audit-chain";
import { requireAdmin } from "../middlewares/requireAdmin";

const router = Router();

const LOCAL_BIN   = "/home/runner/.local/bin";
const WORDLIST    = "/home/runner/.local/wordlists/common.txt";
const SQLMAP_BIN  = "/home/runner/workspace/.pythonlibs/bin/sqlmap";
const PYTHON_BIN  = "/home/runner/workspace/.pythonlibs/bin/python3";
const TOOL_PATH   = `${LOCAL_BIN}:/nix/store/y5jbq5pim10v7z92rgk92wmq6zzwaiar-nmap-7.97/bin:${process.env.PATH ?? "/usr/bin:/bin"}`;

const MAX_CONCURRENT_JOBS = 3;

// ── SSRF / target blocklist ────────────────────────────────────────────────────
// Block RFC1918, loopback, link-local, cloud-metadata, ULA IPv6
const BLOCKED_CIDR_PATTERNS = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^0\./,
  /^::1$/,
  /^fc[0-9a-f][0-9a-f]:/i,
  /^fd[0-9a-f][0-9a-f]:/i,
  /^fe80:/i,
  /^localhost$/i,
  /^metadata\.google\.internal$/i,
];
const BLOCKED_EXACT = new Set(["169.254.169.254", "100.100.100.200"]);

function isBlockedTarget(target: string): boolean {
  const t = target.trim().toLowerCase();
  if (BLOCKED_EXACT.has(t)) return true;
  for (const p of BLOCKED_CIDR_PATTERNS) if (p.test(t)) return true;
  return false;
}

function extractTargetIp(target: string): string | null {
  const clean = target.trim().replace(/^https?:\/\//, "").split("/")[0].split(":")[0];
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(clean)) return clean;
  return null;
}

// ── Tool registry ─────────────────────────────────────────────────────────────
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

function toolBin(name: string): string {
  if (name === "sqlmap")  return PYTHON_BIN;
  if (name === "nmap")    return "nmap";
  return `${LOCAL_BIN}/${name}`;
}

function isInstalled(tool: ToolDef): boolean {
  if (tool.binary === "sqlmap")  return existsSync(SQLMAP_BIN);
  if (tool.binary === "nmap")    return true;
  if (["curl","dig","whois","openssl","ping","traceroute","gpg","john"].includes(tool.binary)) return true;
  return existsSync(`${LOCAL_BIN}/${tool.binary}`);
}

// ── HIGH-RISK approval checker ──────────────────────────────────────────────
function requiresApproval(toolId: string, opts: Record<string, string>): string | null {
  if (toolId === "sqlmap" && parseInt(opts.level ?? "1", 10) >= 2) {
    return `SQLMap level ${opts.level} (≥2) requires admin approval`;
  }
  if (toolId === "nuclei" && ["cves", "vulnerabilities"].includes(opts.templates ?? "")) {
    return `Nuclei template '${opts.templates}' category requires admin approval`;
  }
  if (toolId === "nmap" && ["vuln", "full"].includes(opts.mode ?? "")) {
    return `Nmap scan mode '${opts.mode}' requires admin approval`;
  }
  if (toolId === "feroxbuster" && parseInt(opts.depth ?? "2", 10) >= 3) {
    return `Feroxbuster depth ${opts.depth} (≥3) requires admin approval`;
  }
  if (["hydra", "slowhttptest"].includes(toolId)) {
    return `Tool '${toolId}' always requires admin approval`;
  }
  return null;
}

const TOOLS: ToolDef[] = [
  // ── Network Scanning ──────────────────────────────────────────────────────
  {
    id: "nmap", name: "Nmap", binary: "nmap",
    category: "Network Scanning",
    description: "Network discovery, port scanning, service/version detection and script-based vulnerability detection.",
    timeoutMs: 120_000,
    fields: [
      { id: "target", label: "Target (IP, hostname or CIDR)", type: "text", placeholder: "192.168.1.1 or example.com", required: true },
      { id: "ports",  label: "Ports", type: "text", placeholder: "80,443,8080 or 1-1000 (blank = top 1000)", defaultValue: "" },
      { id: "mode",   label: "Scan Mode", type: "select", defaultValue: "quick", options: [
        { value: "quick",   label: "Quick (-T4 -F top 100 ports)" },
        { value: "default", label: "Default (-T4 top 1000 ports)" },
        { value: "version", label: "Version + Scripts (-sV -sC)" },
        { value: "vuln",    label: "Vulnerability Scripts (requires approval)" },
        { value: "full",    label: "Full Port Scan -p- (requires approval)" },
        { value: "ping",    label: "Ping Sweep (-sn)" },
        { value: "udp",     label: "UDP Top 100 (-sU)" },
      ]},
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
      args.push(o.target.trim());
      return args;
    },
  },

  // ── Vulnerability Scanning ────────────────────────────────────────────────
  {
    id: "nuclei", name: "Nuclei", binary: "nuclei",
    category: "Vulnerability Scanning",
    description: "Fast, template-based vulnerability scanner covering CVEs, misconfigs, exposures, and OWASP Top 10.",
    timeoutMs: 180_000,
    fields: [
      { id: "target",    label: "Target URL", type: "text", placeholder: "https://example.com", required: true },
      { id: "templates", label: "Template Category", type: "select", defaultValue: "exposures", options: [
        { value: "exposures",        label: "Exposures (files, configs, tokens)" },
        { value: "cves",             label: "CVEs (requires approval)" },
        { value: "vulnerabilities",  label: "Vulnerabilities (requires approval)" },
        { value: "misconfiguration", label: "Misconfigurations" },
        { value: "default-logins",   label: "Default Logins" },
        { value: "technologies",     label: "Technology Detection" },
        { value: "network",          label: "Network" },
      ]},
      { id: "severity",  label: "Minimum Severity", type: "select", defaultValue: "medium", options: [
        { value: "info",     label: "Info" },
        { value: "low",      label: "Low" },
        { value: "medium",   label: "Medium" },
        { value: "high",     label: "High" },
        { value: "critical", label: "Critical" },
      ]},
      { id: "rateLimit", label: "Rate Limit (req/s, max 150)", type: "number", defaultValue: "50", placeholder: "50" },
    ],
    buildArgs(o) {
      const rate = Math.min(Math.max(parseInt(o.rateLimit || "50", 10) || 50, 1), 150).toString();
      return ["-u", o.target.trim(), "-t", o.templates, "-severity", o.severity,
        "-rate-limit", rate, "-timeout", "10", "-no-color", "-stats"];
    },
  },

  // ── Injection Testing ──────────────────────────────────────────────────────
  {
    id: "sqlmap", name: "SQLMap", binary: "sqlmap",
    category: "Injection Testing",
    description: "Automatic SQL injection detection — tests GET/POST parameters, cookies, headers.",
    timeoutMs: 180_000,
    warning: "Only use against systems you own or have written permission to test.",
    fields: [
      { id: "url",       label: "Target URL", type: "text", placeholder: "https://example.com/page?id=1", required: true },
      { id: "level",     label: "Test Level (1-5)", type: "select", defaultValue: "1", options: [
        { value: "1", label: "1 — Basic (fastest)" },
        { value: "2", label: "2 — Common payloads (requires approval)" },
        { value: "3", label: "3 — Extended (requires approval)" },
        { value: "4", label: "4 — Deep (requires approval)" },
        { value: "5", label: "5 — Maximum (requires approval)" },
      ]},
      { id: "risk",      label: "Risk Level (1-3)", type: "select", defaultValue: "1", options: [
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
      { id: "dbms",    label: "DBMS (optional)", type: "select", defaultValue: "", options: [
        { value: "",           label: "Auto-detect" },
        { value: "MySQL",      label: "MySQL" },
        { value: "PostgreSQL", label: "PostgreSQL" },
        { value: "Microsoft SQL Server", label: "MSSQL" },
        { value: "Oracle",     label: "Oracle" },
        { value: "SQLite",     label: "SQLite" },
      ]},
      { id: "data",    label: "POST Data",      type: "text", placeholder: "username=test&password=test", defaultValue: "" },
      { id: "cookie",  label: "Cookie",         type: "text", placeholder: "PHPSESSID=abc123", defaultValue: "" },
    ],
    buildArgs(o) {
      const args = [SQLMAP_BIN, "-u", o.url.trim(),
        `--level=${Math.min(parseInt(o.level||"1",10)||1,5)}`,
        `--risk=${Math.min(parseInt(o.risk||"1",10)||1,3)}`,
        `--technique=${o.technique||"BEUSTQ"}`,
        "--batch", "--no-logging"];
      if (o.dbms)   args.push(`--dbms=${o.dbms}`);
      if (o.data)   args.push("--data", o.data.trim());
      if (o.cookie) args.push("--cookie", o.cookie.trim());
      return args;
    },
  },

  // ── Fuzzing ────────────────────────────────────────────────────────────────
  {
    id: "ffuf", name: "ffuf", binary: "ffuf",
    category: "Fuzzing",
    description: "Fast web fuzzer — directory discovery, parameter fuzzing, vhost enumeration.",
    timeoutMs: 120_000,
    fields: [
      { id: "url",        label: "URL (use FUZZ as placeholder)", type: "text", placeholder: "https://example.com/FUZZ", required: true },
      { id: "mode",       label: "Fuzzing Mode", type: "select", defaultValue: "dir", options: [
        { value: "dir",   label: "Directory / Path" },
        { value: "param", label: "GET Parameter" },
        { value: "vhost", label: "Virtual Host" },
        { value: "post",  label: "POST Body" },
      ]},
      { id: "wordlist",   label: "Wordlist", type: "select", defaultValue: WORDLIST, options: [
        { value: WORDLIST, label: "Common (built-in, 4700 words)" },
      ]},
      { id: "matchCodes", label: "Match HTTP Codes", type: "text", placeholder: "200,301,302,403", defaultValue: "200,301,302,403" },
      { id: "filterSize", label: "Filter Response Size (bytes, optional)", type: "text", placeholder: "0", defaultValue: "" },
      { id: "threads",    label: "Threads (max 200)", type: "number", defaultValue: "50" },
    ],
    buildArgs(o) {
      let url = o.url.trim();
      if (o.mode === "param" && !url.includes("FUZZ")) url += "?q=FUZZ";
      if (o.mode === "vhost") url = url.replace(/\/.*/, "");
      const threads = Math.min(Math.max(parseInt(o.threads||"50",10)||50, 1), 200).toString();
      const args = ["-u", url, "-w", `${o.wordlist}:FUZZ`, "-t", threads,
        "-timeout", "10", "-mc", o.matchCodes || "200,301,302,403", "-no-color"];
      if (o.filterSize?.trim()) args.push("-fs", o.filterSize.trim());
      if (o.mode === "vhost") args.push("-H", "Host: FUZZ");
      if (o.mode === "post")  args.push("-X", "POST", "-d", "data=FUZZ");
      return args;
    },
  },

  {
    id: "gobuster", name: "Gobuster", binary: "gobuster",
    category: "Fuzzing",
    description: "Directory, DNS, and vhost brute-forcer using Go concurrency.",
    timeoutMs: 120_000,
    fields: [
      { id: "mode",       label: "Mode", type: "select", defaultValue: "dir", options: [
        { value: "dir",   label: "Directory / File Brute-force" },
        { value: "dns",   label: "DNS Subdomain Enumeration" },
        { value: "vhost", label: "Virtual Host Discovery" },
      ]},
      { id: "target",     label: "Target (URL or domain)", type: "text", placeholder: "https://example.com", required: true },
      { id: "wordlist",   label: "Wordlist", type: "select", defaultValue: WORDLIST, options: [
        { value: WORDLIST, label: "Common (built-in, 4700 words)" },
      ]},
      { id: "threads",    label: "Threads (max 200)", type: "number", defaultValue: "50" },
      { id: "extensions", label: "Extensions (dir mode)", type: "text", placeholder: "php,html,js,txt", defaultValue: "php,html,js,txt" },
      { id: "statusCodes",label: "Status Codes", type: "text", placeholder: "200,301,302,403", defaultValue: "200,301,302,403" },
    ],
    buildArgs(o) {
      const threads = Math.min(Math.max(parseInt(o.threads||"50",10)||50, 1), 200).toString();
      const args = [o.mode, "-w", o.wordlist, "-t", threads, "--no-color"];
      const target = o.target.trim();
      if (o.mode === "dir")  args.push("-u", target, "-x", o.extensions||"php,html,js,txt", "-s", o.statusCodes||"200,301,302,403");
      else if (o.mode === "dns")  args.push("-d", target.replace(/^https?:\/\//, ""));
      else if (o.mode === "vhost") args.push("-u", target);
      return args;
    },
  },

  {
    id: "feroxbuster", name: "Feroxbuster", binary: "feroxbuster",
    category: "Fuzzing",
    description: "Recursive content discovery — auto-recurses into discovered directories.",
    timeoutMs: 180_000,
    fields: [
      { id: "url",          label: "Target URL", type: "text", placeholder: "https://example.com", required: true },
      { id: "depth",        label: "Recursion Depth", type: "select", defaultValue: "2", options: [
        { value: "1", label: "1 — No recursion" },
        { value: "2", label: "2 — One level deep" },
        { value: "3", label: "3 — Two levels deep (requires approval)" },
        { value: "4", label: "4 — Full recursion (requires approval)" },
      ]},
      { id: "wordlist",     label: "Wordlist", type: "select", defaultValue: WORDLIST, options: [
        { value: WORDLIST, label: "Common (built-in, 4700 words)" },
      ]},
      { id: "threads",      label: "Threads (max 200)", type: "number", defaultValue: "50" },
      { id: "filterStatus", label: "Filter Status Codes", type: "text", placeholder: "404,400", defaultValue: "404,400" },
      { id: "extensions",   label: "Extensions", type: "text", placeholder: "php,html,txt,js", defaultValue: "php,html,txt,js" },
    ],
    buildArgs(o) {
      const threads = Math.min(Math.max(parseInt(o.threads||"50",10)||50, 1), 200).toString();
      const depth   = Math.min(Math.max(parseInt(o.depth||"2",10)||2, 1), 4).toString();
      return ["-u", o.url.trim(), "-w", o.wordlist, "--depth", depth,
        "--threads", threads, "--filter-status", o.filterStatus||"404,400",
        "--extensions", o.extensions||"php,html,txt,js", "--no-state", "--quiet"];
    },
  },

  // ── Subdomain Enumeration ─────────────────────────────────────────────────
  {
    id: "subfinder", name: "Subfinder", binary: "subfinder",
    category: "Subdomain Enumeration",
    description: "Passive subdomain enumeration using 40+ OSINT sources (crt.sh, AlienVault, etc.).",
    timeoutMs: 120_000,
    fields: [
      { id: "domain",     label: "Domain", type: "text", placeholder: "example.com", required: true },
      { id: "timeout",    label: "Timeout (s, max 120)", type: "number", defaultValue: "30" },
      { id: "allSources", label: "All Sources", type: "checkbox", defaultValue: "false", hint: "Enable all passive sources (slower)" },
    ],
    buildArgs(o) {
      const timeout = Math.min(Math.max(parseInt(o.timeout||"30",10)||30, 5), 120).toString();
      const args = ["-d", o.domain.trim(), "-timeout", timeout, "-silent", "-oJ"];
      if (o.allSources === "true") args.push("-all");
      return args;
    },
  },

  // ── HTTP Probing ──────────────────────────────────────────────────────────
  {
    id: "httpx", name: "httpx", binary: "httpx",
    category: "HTTP Probing",
    description: "HTTP probe — status codes, titles, technologies, TLS, headers, web server fingerprints.",
    timeoutMs: 60_000,
    fields: [
      { id: "target",         label: "Target URL(s) — comma separated", type: "text", placeholder: "https://example.com,https://api.example.com", required: true },
      { id: "probes",         label: "Probe Options", type: "select", defaultValue: "standard", options: [
        { value: "standard",   label: "Standard (status, title, server)" },
        { value: "full",       label: "Full (tech detect, TLS, headers, JARM)" },
        { value: "screenshot", label: "Content Body Extract" },
        { value: "cdn",        label: "CDN Detection" },
      ]},
      { id: "followRedirects",label: "Follow Redirects", type: "checkbox", defaultValue: "true" },
      { id: "timeout",        label: "Timeout (s, max 60)", type: "number", defaultValue: "10" },
    ],
    buildArgs(o) {
      const timeout = Math.min(Math.max(parseInt(o.timeout||"10",10)||10, 1), 60).toString();
      const base = ["-no-color", "-timeout", timeout];
      if (o.followRedirects === "true") base.push("-follow-redirects");
      const probeArgs: Record<string, string[]> = {
        standard:   ["-status-code", "-title", "-web-server", "-content-length"],
        full:       ["-status-code", "-title", "-web-server", "-tech-detect", "-tls-grab", "-jarm", "-hash", "md5"],
        screenshot: ["-status-code", "-title", "-body-preview", "200"],
        cdn:        ["-status-code", "-title", "-cdn"],
      };
      const args = [...base, ...(probeArgs[o.probes] ?? probeArgs.standard)];
      for (const t of o.target.split(",").map((s: string) => s.trim()).filter(Boolean)) args.push("-u", t);
      return args;
    },
  },

  // ── DNS ────────────────────────────────────────────────────────────────────
  {
    id: "dig", name: "dig", binary: "dig",
    category: "DNS",
    description: "DNS lookup tool — A, AAAA, MX, TXT, NS, CNAME, PTR and zone transfer attempts.",
    timeoutMs: 30_000,
    fields: [
      { id: "domain",   label: "Domain", type: "text", placeholder: "example.com", required: true },
      { id: "type",     label: "Record Type", type: "select", defaultValue: "ANY", options: [
        { value: "ANY",  label: "ANY — All records" }, { value: "A",    label: "A — IPv4" },
        { value: "AAAA", label: "AAAA — IPv6" },       { value: "MX",   label: "MX — Mail" },
        { value: "TXT",  label: "TXT — Text (SPF/DKIM/DMARC)" },
        { value: "NS",   label: "NS — Name Servers" }, { value: "CNAME", label: "CNAME" },
        { value: "PTR",  label: "PTR — Reverse DNS" }, { value: "SOA",  label: "SOA" },
        { value: "AXFR", label: "AXFR — Zone Transfer" },
      ]},
      { id: "resolver", label: "Resolver (optional)", type: "text", placeholder: "8.8.8.8", defaultValue: "" },
    ],
    buildArgs(o) {
      const args: string[] = [];
      if (o.resolver?.trim()) args.push(`@${o.resolver.trim()}`);
      args.push(o.domain.trim(), o.type);
      if (o.type !== "AXFR") args.push("+noall", "+answer", "+additional");
      return args;
    },
  },

  // ── SSL/TLS ────────────────────────────────────────────────────────────────
  {
    id: "openssl", name: "OpenSSL", binary: "openssl",
    category: "SSL / TLS",
    description: "TLS handshake analysis, certificate inspection, cipher enumeration, protocol downgrade tests.",
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
      const port = Math.min(Math.max(parseInt(o.port||"443",10)||443, 1), 65535);
      const target = `${o.host.trim()}:${port}`;
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

  // ── HTTP Client ────────────────────────────────────────────────────────────
  {
    id: "curl", name: "cURL", binary: "curl",
    category: "HTTP Client",
    description: "Full-featured HTTP client — headers, redirects, cookies, auth, custom methods, TLS inspection.",
    timeoutMs: 30_000,
    fields: [
      { id: "url",       label: "URL", type: "text", placeholder: "https://example.com", required: true },
      { id: "method",    label: "Method", type: "select", defaultValue: "GET", options: [
        { value: "GET", label: "GET" },   { value: "POST", label: "POST" },
        { value: "PUT", label: "PUT" },   { value: "DELETE", label: "DELETE" },
        { value: "HEAD", label: "HEAD" }, { value: "OPTIONS", label: "OPTIONS" },
        { value: "PATCH", label: "PATCH" },
      ]},
      { id: "data",      label: "POST Body", type: "text", placeholder: '{"key":"value"}', defaultValue: "" },
      { id: "headers",   label: "Headers (one per line)", type: "text", placeholder: "Authorization: Bearer xxx\nContent-Type: application/json", defaultValue: "" },
      { id: "insecure",  label: "Skip TLS Verification", type: "checkbox", defaultValue: "false" },
      { id: "redirects", label: "Follow Redirects", type: "checkbox", defaultValue: "true" },
      { id: "timeout",   label: "Timeout (s, max 60)", type: "number", defaultValue: "30" },
    ],
    buildArgs(o) {
      const timeout = Math.min(Math.max(parseInt(o.timeout||"30",10)||30, 1), 60).toString();
      const args = ["-v", "-X", o.method, "--max-time", timeout];
      if (o.redirects === "true") args.push("-L");
      if (o.insecure  === "true") args.push("-k");
      if (o.data?.trim()) args.push("-d", o.data.trim());
      for (const h of (o.headers||"").split("\n").map((x: string) => x.trim()).filter(Boolean)) args.push("-H", h);
      args.push(o.url.trim());
      return args;
    },
  },

  // ── OSINT ──────────────────────────────────────────────────────────────────
  {
    id: "whois", name: "WHOIS", binary: "whois",
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

  // ── Network ────────────────────────────────────────────────────────────────
  {
    id: "ping", name: "Ping", binary: "ping",
    category: "Network",
    description: "ICMP echo test — latency, packet loss, host reachability.",
    timeoutMs: 30_000,
    fields: [
      { id: "target", label: "Host / IP", type: "text", placeholder: "example.com or 1.2.3.4", required: true },
      { id: "count",  label: "Ping Count", type: "select", defaultValue: "5", options: [
        { value: "4",  label: "4 packets" }, { value: "5",  label: "5 packets" },
        { value: "10", label: "10 packets" }, { value: "20", label: "20 packets" },
      ]},
    ],
    buildArgs(o) {
      const count = Math.min(parseInt(o.count||"5",10)||5, 20).toString();
      return ["-c", count, o.target.trim()];
    },
  },

  {
    id: "traceroute", name: "Traceroute", binary: "traceroute",
    category: "Network",
    description: "Trace the route to a host — hop-by-hop latency and path discovery.",
    timeoutMs: 60_000,
    fields: [
      { id: "target",  label: "Host / IP", type: "text", placeholder: "example.com", required: true },
      { id: "maxHops", label: "Max Hops", type: "select", defaultValue: "20", options: [
        { value: "10", label: "10 hops" }, { value: "20", label: "20 hops" }, { value: "30", label: "30 hops" },
      ]},
    ],
    buildArgs(o) {
      const hops = Math.min(parseInt(o.maxHops||"20",10)||20, 30).toString();
      return ["-m", hops, o.target.trim()];
    },
  },

  // ── Password Attacks (NEW) ──────────────────────────────────────────────────
  {
    id: "hydra", name: "Hydra", binary: "hydra",
    category: "Password Attacks",
    description: "Online password brute-force — SSH, FTP, HTTP-POST, RDP and 50+ protocols. Requires admin approval.",
    timeoutMs: 120_000,
    warning: "Requires admin approval. Only use against systems you own or have written permission to test.",
    fields: [
      { id: "target",    label: "Target Host / IP", type: "text", placeholder: "192.168.1.100", required: true },
      { id: "protocol",  label: "Protocol", type: "select", defaultValue: "ssh", options: [
        { value: "ssh",       label: "SSH (port 22)" },
        { value: "ftp",       label: "FTP (port 21)" },
        { value: "http-post", label: "HTTP POST form" },
        { value: "rdp",       label: "RDP (port 3389)" },
        { value: "smb",       label: "SMB (port 445)" },
        { value: "telnet",    label: "Telnet (port 23)" },
      ]},
      { id: "userFile",  label: "User", type: "text", placeholder: "admin (single user)", defaultValue: "admin" },
      { id: "passFile",  label: "Password list (comma-sep)", type: "text", placeholder: "password,123456,admin", defaultValue: "password,admin" },
      { id: "tasks",     label: "Parallel tasks (max 16)", type: "number", defaultValue: "4" },
    ],
    buildArgs(o) {
      const tasks = Math.min(Math.max(parseInt(o.tasks||"4",10)||4, 1), 16).toString();
      const passwords = (o.passFile||"password,admin").split(",").map((s: string) => s.trim()).filter(Boolean).join(" ");
      return ["-l", o.userFile||"admin", "-P", `/tmp/hydra_pass_${Date.now()}.txt`,
        "-t", tasks, o.target.trim(), o.protocol];
    },
  },

  {
    id: "john", name: "John the Ripper", binary: "john",
    category: "Password Attacks",
    description: "Offline password hash cracking — wordlist, incremental, and rule-based attacks.",
    timeoutMs: 120_000,
    fields: [
      { id: "hash",   label: "Hash (paste hash string)", type: "text", placeholder: "5f4dcc3b5aa765d61d8327deb882cf99", required: true },
      { id: "format", label: "Hash Format", type: "select", defaultValue: "auto", options: [
        { value: "auto",   label: "Auto-detect" },
        { value: "md5",    label: "MD5" },
        { value: "sha1",   label: "SHA-1" },
        { value: "sha256", label: "SHA-256" },
        { value: "bcrypt", label: "bcrypt" },
        { value: "ntlm",   label: "NTLM" },
      ]},
      { id: "mode", label: "Attack Mode", type: "select", defaultValue: "wordlist", options: [
        { value: "wordlist",     label: "Wordlist" },
        { value: "incremental",  label: "Incremental (brute-force)" },
        { value: "show",         label: "Show cracked hashes" },
      ]},
    ],
    buildArgs(o) {
      const args: string[] = [];
      const hashFile = `/tmp/john_hash_${Date.now()}.txt`;
      if (o.format !== "auto") args.push(`--format=${o.format}`);
      if (o.mode === "wordlist")    args.push(`--wordlist=${WORDLIST}`);
      if (o.mode === "incremental") args.push("--incremental");
      if (o.mode === "show")        args.push("--show");
      args.push(hashFile);
      return args;
    },
  },

  // ── Forensics & DFIR (NEW) ─────────────────────────────────────────────────
  {
    id: "volatility3", name: "Volatility 3", binary: "vol",
    category: "Forensics & DFIR",
    description: "Memory forensics framework — process list, network connections, command history from memory dumps.",
    timeoutMs: 120_000,
    fields: [
      { id: "memFile", label: "Memory Dump File Path (server-side)", type: "text", placeholder: "/tmp/memory.dmp", required: true },
      { id: "plugin",  label: "Plugin", type: "select", defaultValue: "windows.info", options: [
        { value: "windows.info",           label: "windows.info — System info" },
        { value: "windows.psscan",         label: "windows.psscan — Process scan" },
        { value: "windows.netscan",        label: "windows.netscan — Network connections" },
        { value: "windows.cmdline",        label: "windows.cmdline — Command lines" },
        { value: "linux.pslist",           label: "linux.pslist — Linux process list" },
        { value: "linux.netstat",          label: "linux.netstat — Linux network" },
      ]},
    ],
    buildArgs(o) {
      return ["-f", o.memFile.trim(), o.plugin];
    },
  },

  {
    id: "binwalk", name: "Binwalk", binary: "binwalk",
    category: "Forensics & DFIR",
    description: "Firmware analysis — embedded file extraction, entropy analysis, signature scanning.",
    timeoutMs: 60_000,
    fields: [
      { id: "file",    label: "File Path (server-side)", type: "text", placeholder: "/tmp/firmware.bin", required: true },
      { id: "mode",    label: "Mode", type: "select", defaultValue: "scan", options: [
        { value: "scan",    label: "Scan — signature analysis" },
        { value: "extract", label: "Extract — auto-extract files" },
        { value: "entropy", label: "Entropy — randomness analysis" },
      ]},
    ],
    buildArgs(o) {
      const args: string[] = [];
      if (o.mode === "extract") args.push("-e");
      if (o.mode === "entropy") args.push("-E");
      args.push(o.file.trim());
      return args;
    },
  },

  // ── Cryptography (NEW) ─────────────────────────────────────────────────────
  {
    id: "gpg", name: "GPG", binary: "gpg",
    category: "Cryptography",
    description: "GNU Privacy Guard — key management, encryption, signing, and verification.",
    timeoutMs: 30_000,
    fields: [
      { id: "mode",  label: "Mode", type: "select", defaultValue: "keyinfo", options: [
        { value: "keyinfo",   label: "List keys" },
        { value: "genkey",    label: "Generate key pair (batch)" },
        { value: "fingerprint",label: "Show fingerprints" },
        { value: "version",   label: "Version info" },
      ]},
    ],
    buildArgs(o) {
      const modeArgs: Record<string, string[]> = {
        keyinfo:     ["--list-keys", "--keyid-format", "LONG"],
        genkey:      ["--gen-key", "--batch"],
        fingerprint: ["--fingerprint"],
        version:     ["--version"],
      };
      return modeArgs[o.mode] ?? modeArgs.keyinfo;
    },
  },

  {
    id: "hashcat", name: "Hashcat", binary: "hashcat",
    category: "Cryptography",
    description: "World's fastest password recovery utility — GPU-accelerated hash cracking with rules and masks.",
    timeoutMs: 60_000,
    fields: [
      { id: "mode", label: "Mode", type: "select", defaultValue: "benchmark", options: [
        { value: "benchmark",      label: "Benchmark — test GPU/CPU speed" },
        { value: "identify",       label: "Hash-identify — detect hash type" },
      ]},
      { id: "hash", label: "Hash (for identify mode)", type: "text", placeholder: "5f4dcc3b5aa765d61d8327deb882cf99", defaultValue: "" },
    ],
    buildArgs(o) {
      if (o.mode === "identify" && o.hash?.trim()) return ["--identify", o.hash.trim()];
      return ["-b", "--machine-readable"];
    },
  },

  // ── Stress Testing (NEW) ───────────────────────────────────────────────────
  {
    id: "hping3", name: "hping3", binary: "hping3",
    category: "Stress Testing",
    description: "Network stress testing — TCP/UDP/ICMP packet generation, flood testing, firewall probing. Requires approval.",
    timeoutMs: 60_000,
    warning: "Requires admin approval. Use only against test infrastructure you control.",
    fields: [
      { id: "target",   label: "Target Host / IP", type: "text", placeholder: "192.168.1.100", required: true },
      { id: "mode",     label: "Mode", type: "select", defaultValue: "ping", options: [
        { value: "ping", label: "ICMP Ping" },
        { value: "syn",  label: "TCP SYN probe" },
        { value: "udp",  label: "UDP probe" },
      ]},
      { id: "port",     label: "Port (TCP/UDP modes)", type: "number", defaultValue: "80" },
      { id: "count",    label: "Packet count (max 50)", type: "number", defaultValue: "10" },
    ],
    buildArgs(o) {
      const count = Math.min(Math.max(parseInt(o.count||"10",10)||10, 1), 50).toString();
      const port  = Math.min(Math.max(parseInt(o.port||"80",10)||80, 1), 65535).toString();
      if (o.mode === "syn") return ["-S", "-p", port, "-c", count, o.target.trim()];
      if (o.mode === "udp") return ["--udp", "-p", port, "-c", count, o.target.trim()];
      return ["-c", count, o.target.trim()];
    },
  },

  {
    id: "slowhttptest", name: "Slowhttptest", binary: "slowhttptest",
    category: "Stress Testing",
    description: "SlowHTTP DoS simulation — Slowloris, slow body, slow read. Requires admin approval.",
    timeoutMs: 60_000,
    warning: "Requires admin approval. Use only against test infrastructure you control.",
    fields: [
      { id: "target",      label: "Target URL", type: "text", placeholder: "https://example.com", required: true },
      { id: "mode",        label: "Attack Vector", type: "select", defaultValue: "slowloris", options: [
        { value: "slowloris", label: "Slowloris — slow headers" },
        { value: "slowbody",  label: "Slow POST body" },
        { value: "slowread",  label: "Slow read" },
      ]},
      { id: "connections", label: "Connections (max 100)", type: "number", defaultValue: "20" },
      { id: "duration",    label: "Test Duration (s, max 60)", type: "number", defaultValue: "20" },
    ],
    buildArgs(o) {
      const conns    = Math.min(Math.max(parseInt(o.connections||"20",10)||20, 1), 100).toString();
      const duration = Math.min(Math.max(parseInt(o.duration||"20",10)||20, 5), 60).toString();
      const modeFlag: Record<string, string> = { slowloris: "H", slowbody: "B", slowread: "R" };
      return ["-c", conns, "-H", "-t", duration, "-u", o.target.trim()];
    },
  },
];

// ── In-memory job state (mirrors DB for streaming) ──────────────────────────
interface Job {
  proc:      ChildProcess;
  lines:     string[];
  done:      boolean;
  exitCode:  number | null;
  listeners: ((line: string) => void)[];
  toolId:    string;
  userId:    string;
  dbJobId:   string;
  startedAt: string;
}
const jobs = new Map<string, Job>();

// ── GET /tools ─────────────────────────────────────────────────────────────
router.get("/tools", (_req, res) => {
  res.json(TOOLS.map(t => ({
    id: t.id, name: t.name, binary: t.binary, category: t.category,
    description: t.description, fields: t.fields, installed: isInstalled(t),
    warning: t.warning ?? null, timeoutMs: t.timeoutMs,
  })));
});

// ── POST /run ──────────────────────────────────────────────────────────────
const RunSchema = z.object({
  toolId: z.string(),
  opts:   z.record(z.string()),
});

router.post("/run", async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  let body: { toolId: string; opts: Record<string, string> };
  try { body = RunSchema.parse(req.body); } catch (e: any) {
    return res.status(400).json({ error: e.message });
  }
  const { toolId, opts } = body;

  const tool = TOOLS.find(t => t.id === toolId);
  if (!tool) return res.status(404).json({ error: "Unknown tool: " + toolId });
  if (!isInstalled(tool)) return res.status(400).json({ error: `Tool '${tool.name}' is not installed on this server.` });

  // Validate required fields
  for (const f of tool.fields) {
    if (f.required && !opts[f.id]?.trim()) {
      return res.status(400).json({ error: `Field '${f.label}' is required.` });
    }
  }

  // Identify primary target for SSRF check
  const targetField = opts.target ?? opts.url ?? opts.domain ?? opts.host ?? opts.memFile ?? opts.file ?? "";
  if (targetField && isBlockedTarget(targetField)) {
    appendAuditEvent({ actor: userId, action: "tool_runner.blocked_target", resource: toolId,
      result: "deny", metadata: { target: targetField } });
    return res.status(400).json({ error: "Target is in a restricted address range." });
  }

  // Check per-user concurrency
  let activeCount = 0;
  for (const j of jobs.values()) {
    if (j.userId === userId && !j.done) activeCount++;
  }
  if (activeCount >= MAX_CONCURRENT_JOBS) {
    return res.status(429).json({ error: `Max ${MAX_CONCURRENT_JOBS} concurrent jobs per user.` });
  }

  // Check if high-risk approval needed
  const approvalReason = requiresApproval(toolId, opts);
  if (approvalReason) {
    const approvalId = randomUUID();
    try {
      await db.insert(toolApprovalsTable).values({
        id: approvalId, userId, toolId, toolName: tool.name,
        target: targetField, optsJson: opts, riskReason: approvalReason, status: "pending",
      });
    } catch {}
    appendAuditEvent({ actor: userId, action: "tool_runner.approval_requested", resource: toolId,
      result: "deny", metadata: { approvalId, reason: approvalReason } });
    return res.status(202).json({
      status: "pending_approval", approvalId,
      message: `This scan requires admin approval: ${approvalReason}`,
    });
  }

  // GeoIP enrichment
  let geoData: Record<string, unknown> | null = null;
  const targetIp = extractTargetIp(targetField);
  if (targetIp) {
    const geo = geoip.lookup(targetIp);
    if (geo) geoData = { country: geo.country, region: geo.region, city: geo.city, ll: geo.ll };
  }

  // Create DB job record
  const dbJobId = randomUUID();
  try {
    await db.insert(toolJobsTable).values({
      id: dbJobId, userId, toolId, toolName: tool.name, category: tool.category,
      target: targetField || null, optsJson: opts, status: "running",
      geoJson: geoData ?? undefined, startedAt: new Date(),
    });
  } catch {}

  // Build and spawn
  const jobId  = randomUUID();
  const args   = tool.buildArgs(opts);
  const binary = tool.binary === "sqlmap" ? PYTHON_BIN : (tool.binary === "nmap" ? "nmap" : `${LOCAL_BIN}/${tool.binary}`);

  const proc = spawn(binary, args, {
    env:     { ...process.env, PATH: TOOL_PATH, HOME: process.env.HOME ?? "/tmp" },
    stdio:   ["ignore", "pipe", "pipe"],
    timeout: tool.timeoutMs,
  });

  const job: Job = {
    proc, lines: [`[proxhqvpn] Running: ${binary} ${args.join(" ")}\n`],
    done: false, exitCode: null, listeners: [],
    toolId, userId, dbJobId, startedAt: new Date().toISOString(),
  };
  jobs.set(jobId, job);

  appendAuditEvent({ actor: userId, action: "tool_runner.run", resource: toolId,
    result: "allow", metadata: { jobId, dbJobId, target: targetField } });

  function emit(line: string) {
    job.lines.push(line);
    for (const l of job.listeners) l(line);
  }

  proc.stdout.on("data", (d: Buffer) => emit(d.toString()));
  proc.stderr.on("data", (d: Buffer) => emit(`[stderr] ${d.toString()}`));
  proc.on("close", async (code) => {
    job.done     = true;
    job.exitCode = code;
    emit(`\n[proxhqvpn] Process exited with code ${code ?? "?"}\n`);
    const fullOutput = job.lines.join("");
    try {
      await db.update(toolJobsTable)
        .set({ status: code === 0 ? "completed" : "failed", exitCode: code ?? undefined,
          outputText: fullOutput.substring(0, 1_000_000), completedAt: new Date() })
        .where(eq(toolJobsTable.id, dbJobId));
    } catch {}
    setTimeout(() => jobs.delete(jobId), 300_000);
  });
  proc.on("error", async (err) => {
    job.done     = true;
    job.exitCode = 1;
    emit(`[proxhqvpn] Error: ${err.message}\n`);
    try {
      await db.update(toolJobsTable)
        .set({ status: "failed", exitCode: 1, completedAt: new Date() })
        .where(eq(toolJobsTable.id, dbJobId));
    } catch {}
  });

  res.json({ jobId, dbJobId, command: `${binary} ${args.join(" ")}`, geoData });
});

// ── GET /stream/:jobId ─────────────────────────────────────────────────────
router.get("/stream/:jobId", (req: Request, res: Response) => {
  const job = jobs.get(String(req.params.jobId));
  if (!job) return res.status(404).json({ error: "Job not found or expired" });

  res.setHeader("Content-Type",     "text/event-stream");
  res.setHeader("Cache-Control",    "no-cache");
  res.setHeader("Connection",       "keep-alive");
  res.setHeader("X-Accel-Buffering","no");
  res.flushHeaders();

  const send = (data: string) => res.write(`data: ${JSON.stringify({ text: data })}\n\n`);
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

// ── DELETE /kill/:jobId ────────────────────────────────────────────────────
router.delete("/kill/:jobId", (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  const job = jobs.get(String(req.params.jobId));
  if (!job) return res.status(404).json({ error: "Job not found" });
  if (job.done) return res.json({ ok: true, message: "Already completed" });
  try {
    job.proc.kill("SIGTERM");
    setTimeout(() => { if (!job.done) job.proc.kill("SIGKILL"); }, 3000);
    if (userId) appendAuditEvent({ actor: userId, action: "tool_runner.kill", resource: job.toolId,
      result: "allow", metadata: { jobId: req.params.jobId } });
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── GET /jobs — active in-process jobs ────────────────────────────────────
router.get("/jobs", (_req, res) => {
  const list = [];
  for (const [id, j] of jobs.entries()) {
    list.push({ jobId: id, toolId: j.toolId, startedAt: j.startedAt, done: j.done, exitCode: j.exitCode });
  }
  res.json(list);
});

// ── GET /history — paginated DB history ───────────────────────────────────
router.get("/history", async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  const limit  = Math.min(parseInt((req.query.limit  as string) || "20", 10), 100);
  const offset = Math.max(parseInt((req.query.offset as string) || "0",  10), 0);
  try {
    const rows = await db.select()
      .from(toolJobsTable)
      .where(eq(toolJobsTable.userId, userId))
      .orderBy(desc(toolJobsTable.createdAt))
      .limit(limit)
      .offset(offset);
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── GET /history/:jobId ────────────────────────────────────────────────────
router.get("/history/:jobId", async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  try {
    const [row] = await db.select().from(toolJobsTable)
      .where(and(eq(toolJobsTable.id, String(req.params.jobId)), eq(toolJobsTable.userId, userId)));
    if (!row) return res.status(404).json({ error: "Job not found" });
    res.json(row);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── GET /scopes — list user's target scopes ────────────────────────────────
router.get("/scopes", async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  try {
    const rows = await db.select().from(toolTargetScopesTable)
      .where(eq(toolTargetScopesTable.userId, userId))
      .orderBy(desc(toolTargetScopesTable.createdAt));
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

const ScopeSchema = z.object({
  scopeType:  z.enum(["ip", "cidr", "domain", "url"]),
  scopeValue: z.string().min(1).max(500),
  notes:      z.string().max(500).optional(),
});

// ── POST /scopes ───────────────────────────────────────────────────────────
router.post("/scopes", async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  let body: z.infer<typeof ScopeSchema>;
  try { body = ScopeSchema.parse(req.body); } catch (e: any) {
    return res.status(400).json({ error: e.message });
  }
  if (isBlockedTarget(body.scopeValue)) {
    return res.status(400).json({ error: "Scope value is in a restricted address range." });
  }
  try {
    const [row] = await db.insert(toolTargetScopesTable)
      .values({ userId, scopeType: body.scopeType, scopeValue: body.scopeValue, notes: body.notes })
      .returning();
    appendAuditEvent({ actor: userId, action: "tool_runner.scope_add", resource: body.scopeValue, result: "allow" });
    res.json(row);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── DELETE /scopes/:id ─────────────────────────────────────────────────────
router.delete("/scopes/:id", async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  try {
    const scopeId = parseInt(String(req.params.id), 10);
    const scopeIdStr = String(req.params.id);
    await db.delete(toolTargetScopesTable)
      .where(and(eq(toolTargetScopesTable.id, scopeId),
                 eq(toolTargetScopesTable.userId, userId)));
    appendAuditEvent({ actor: userId, action: "tool_runner.scope_remove", resource: scopeIdStr, result: "allow" });
    res.json({ ok: true });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── GET /approvals (admin) ─────────────────────────────────────────────────
router.get("/approvals", requireAdmin, async (_req: Request, res: Response) => {
  try {
    const rows = await db.select().from(toolApprovalsTable)
      .orderBy(desc(toolApprovalsTable.createdAt))
      .limit(100);
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── POST /approvals/:id/approve (admin) ────────────────────────────────────
router.post("/approvals/:id/approve", requireAdmin, async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  try {
    const [row] = await db.update(toolApprovalsTable)
      .set({ status: "approved", reviewedBy: userId ?? "admin", reviewedAt: new Date(),
             notes: req.body?.notes })
      .where(eq(toolApprovalsTable.id, String(req.params.id)))
      .returning();
    if (!row) return res.status(404).json({ error: "Approval not found" });
    appendAuditEvent({ actor: userId ?? "admin", action: "tool_runner.approval_approved",
      resource: row.toolId, result: "allow", metadata: { approvalId: String(req.params.id) } });
    res.json(row);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── POST /approvals/:id/reject (admin) ─────────────────────────────────────
router.post("/approvals/:id/reject", requireAdmin, async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  try {
    const [row] = await db.update(toolApprovalsTable)
      .set({ status: "rejected", reviewedBy: userId ?? "admin", reviewedAt: new Date(),
             notes: req.body?.notes })
      .where(eq(toolApprovalsTable.id, String(req.params.id)))
      .returning();
    if (!row) return res.status(404).json({ error: "Approval not found" });
    appendAuditEvent({ actor: userId ?? "admin", action: "tool_runner.approval_rejected",
      resource: row.toolId, result: "deny", metadata: { approvalId: String(req.params.id) } });
    res.json(row);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── GET /node-agents ───────────────────────────────────────────────────────
router.get("/node-agents", async (_req: Request, res: Response) => {
  try {
    const rows = await db.select().from(nodeAgentHealthTable)
      .orderBy(desc(nodeAgentHealthTable.lastSeenAt));
    res.json(rows);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ── POST /evidence/:jobId — ZIP evidence package ──────────────────────────
router.post("/evidence/:jobId", async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  try {
    const [job] = await db.select().from(toolJobsTable)
      .where(and(eq(toolJobsTable.id, String(req.params.jobId)), eq(toolJobsTable.userId, userId)));
    if (!job) return res.status(404).json({ error: "Job not found" });

    res.setHeader("Content-Type",        "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="evidence-${job.id.substring(0,8)}.zip"`);

    const archive = archiver("zip", { zlib: { level: 6 } });
    archive.pipe(res as unknown as Writable);

    const metadata = {
      jobId: job.id, toolId: job.toolId, toolName: job.toolName, category: job.category,
      target: job.target, status: job.status, exitCode: job.exitCode,
      startedAt: job.startedAt, completedAt: job.completedAt, geoData: job.geoJson,
      exportedAt: new Date().toISOString(), exportedBy: userId,
    };
    archive.append(JSON.stringify(metadata, null, 2), { name: "job-metadata.json" });
    archive.append(job.outputText || "(no output)", { name: "output.txt" });

    if (job.geoJson) {
      archive.append(JSON.stringify(job.geoJson, null, 2), { name: "geo-report.json" });
    }

    const threatSummary = [
      `Threat Intelligence Summary`,
      `Target: ${job.target ?? "N/A"}`,
      `Tool: ${job.toolName}`,
      `Scan Date: ${job.startedAt?.toISOString?.() ?? job.startedAt}`,
      `Exit Code: ${job.exitCode ?? "N/A"}`,
      job.geoJson ? `\nGeoIP: ${JSON.stringify(job.geoJson)}` : "",
    ].join("\n");
    archive.append(threatSummary, { name: "threat-summary.txt" });

    archive.finalize();
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
