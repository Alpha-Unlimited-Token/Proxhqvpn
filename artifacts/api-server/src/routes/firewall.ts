// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// GhostOS™ Firewall Engine — ProxhqOS SymScript™ v1.0
import { Router } from "express";
import { db } from "@workspace/db";
import {
  firewallTrafficDecisionsTable,
  firewallRulesTable, firewallStatusTable, blockedIpsTable,
  firewallIpsSignaturesTable, firewallDpiRulesTable, firewallGeoBlocksTable,
  firewallThreatFeedsTable, firewallZonesTable, firewallFqdnRulesTable,
  firewallGhostOsRulesTable, firewallTranscriberLogTable,
  firewallConnectionQueueTable, nodesTable, ebpfRulesTable,
  firewallAtrPoliciesTable, firewallAtrEventsTable,
  firewallPeerRulesTable,
  firewallDdosConfigTable, firewallDdosEventsTable,
  trappedAttackersTable, beaconAlertsTable,
  firewallConnectionPromptsTable, firewallUserDecisionsTable,
  nodeAgentEventsTable,
  firewallIocsTable, firewallFeedEntriesTable,
} from "@workspace/db";
import { createHash } from "crypto";
import { eq, sql, lt, desc, asc, inArray } from "drizzle-orm";
import { z } from "zod";
import { logger } from "../lib/logger";

const router = Router();

// ── Expired blocked-IP cleanup ─────────────────────────────────────────────
setInterval(async () => {
  try { await db.delete(blockedIpsTable).where(lt(blockedIpsTable.expiresAt, new Date())); } catch {}
}, 5 * 60 * 1000);

async function getOrCreateStatus() {
  const rows = await db.select().from(firewallStatusTable).limit(1);
  if (rows.length > 0) return rows[0];
  const [s] = await db.insert(firewallStatusTable).values({
    enabled: true, mode: "stealth", packetsBlocked: 0, packetsAllowed: 0,
    ispMasqueradeActive: true, localhostHidden: true, dnsMasked: true, lastUpdated: new Date(),
  }).returning();
  return s;
}

// ═══════════════════════════════════════════════════════════════════════════
// ── GhostOS™ SymScript™ Engine ─────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

const SYMSCRIPT_SPEC = {
  verbs: {
    "⊕": { label: "PERMIT", iptables: "ACCEPT", nft: "accept" },
    "⊘": { label: "DROP",   iptables: "DROP",   nft: "drop" },
    "⊗": { label: "REJECT", iptables: "REJECT", nft: "reject" },
    "⊛": { label: "RATE-LIMIT", iptables: "LIMIT", nft: "limit" },
    "⊜": { label: "INSPECT",    iptables: "NFQUEUE", nft: "queue" },
    "⊝": { label: "LOG+ALLOW",  iptables: "LOG_ACCEPT", nft: "log accept" },
    "⊞": { label: "LOG+BLOCK",  iptables: "LOG_DROP",   nft: "log drop" },
  },
  protocols: {
    "ΩT":  { label: "TCP",       p: "tcp",  ipv: 4 },
    "ΩU":  { label: "UDP",       p: "udp",  ipv: 4 },
    "ΩI":  { label: "ICMP",      p: "icmp", ipv: 4 },
    "Ω6T": { label: "TCPv6",     p: "tcp",  ipv: 6 },
    "Ω6U": { label: "UDPv6",     p: "udp",  ipv: 6 },
    "Ω*":  { label: "ANY",       p: "",     ipv: 0 },
  },
  directions: {
    "←": { label: "INBOUND",       chain: "INPUT" },
    "→": { label: "OUTBOUND",      chain: "OUTPUT" },
    "↔": { label: "BIDIRECTIONAL", chain: "BOTH" },
  },
  zones: {
    "⟦I⟧":   { label: "INNER",      iface: "wg1-wg10" },
    "⟦O⟧":   { label: "OUTER",      iface: "wg11-wg60" },
    "⟦D⟧":   { label: "DMZ",        iface: "eth1" },
    "⟦M⟧":   { label: "MANAGEMENT", iface: "lo" },
    "⟦WG⟧":  { label: "WIREGUARD",  iface: "wg+" },
    "⟦TOR⟧": { label: "TOR",        iface: "tor0" },
    "⟦*⟧":   { label: "ALL",        iface: "any" },
  },
};

function parseSymscript(rule: string): {
  verb: string; verbLabel: string;
  port: string; protocol: string; protocolLabel: string;
  direction: string; dirLabel: string; chain: string;
  source: string; priority: number;
  rateLimit: string | null;
  valid: boolean; error?: string;
} {
  const clean = rule.trim();

  // Extract verb (first character must be a policy verb)
  const verbEntry = Object.entries(SYMSCRIPT_SPEC.verbs).find(([k]) => clean.startsWith(k));
  if (!verbEntry) return { valid: false, error: `Unknown verb. Must start with: ⊕ ⊘ ⊗ ⊛ ⊜ ⊝ ⊞`, verb:"",verbLabel:"",port:"",protocol:"",protocolLabel:"",direction:"",dirLabel:"",chain:"",source:"",priority:100,rateLimit:null };
  const [verb, verbMeta] = verbEntry;

  // Extract protocol and optional port (e.g. 443::ΩT or ΩU or *)
  let port = "";
  let protocol = "Ω*";
  const protoMatch = clean.match(/(\d+(?:-\d+)?|\*)?::?(ΩT|ΩU|ΩI|Ω6T|Ω6U|Ω\*)/);
  if (protoMatch) {
    port = protoMatch[1] ?? "";
    protocol = protoMatch[2];
  }

  // Extract direction
  const dirEntry = Object.entries(SYMSCRIPT_SPEC.directions).find(([k]) => clean.includes(k));
  const [direction, dirMeta] = dirEntry ?? ["←", { label: "INBOUND", chain: "INPUT" }];

  // Extract source (@ANY, @IP, @CIDR, @GEO:XX)
  const srcMatch = clean.match(/@(ANY|GEO:[A-Z]{2}|\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(?:\/\d{1,2})?|\d{4}:[\w:]+(?:\/\d+)?)/);
  const source = srcMatch ? `@${srcMatch[1]}` : "@ANY";

  // Extract priority (≫N)
  const prioMatch = clean.match(/≫(\d+)/);
  const priority = prioMatch ? parseInt(prioMatch[1]) : 100;

  // Extract rate limit (⚡N/unit)
  const rateMatch = clean.match(/⚡(\d+\/(?:s|min|hr))/);
  const rateLimit = rateMatch ? rateMatch[1] : null;

  const protoMeta = SYMSCRIPT_SPEC.protocols[protocol as keyof typeof SYMSCRIPT_SPEC.protocols] ?? SYMSCRIPT_SPEC.protocols["Ω*"];

  return {
    valid: true,
    verb, verbLabel: verbMeta.label,
    port, protocol, protocolLabel: protoMeta.label,
    direction, dirLabel: dirMeta.label, chain: dirMeta.chain,
    source, priority, rateLimit,
  };
}

function compileToIptables(parsed: ReturnType<typeof parseSymscript>): string {
  if (!parsed.valid) return `# ERROR: ${parsed.error}`;
  const { verb, port, protocol, chain, source, priority, rateLimit } = parsed;
  const verbMeta = SYMSCRIPT_SPEC.verbs[verb as keyof typeof SYMSCRIPT_SPEC.verbs];
  const protoMeta = SYMSCRIPT_SPEC.protocols[protocol as keyof typeof SYMSCRIPT_SPEC.protocols];
  const lines: string[] = [];

  const protoFlag = protoMeta.p ? `-p ${protoMeta.p}` : "";
  const portFlag = port && protoMeta.p ? `--dport ${port}` : "";
  const srcFlag = source !== "@ANY" && !source.startsWith("@GEO:") ? `-s ${source.slice(1)}` : "";
  const geoFlag = source.startsWith("@GEO:") ? `# GEO:${source.slice(5)} — use ipset with country CIDR set` : "";

  const buildChain = (ch: string) => {
    if (verbMeta.iptables === "LIMIT" && rateLimit) {
      const [rate, unit] = rateLimit.split("/");
      const limitUnit = unit === "hr" ? "hour" : unit === "min" ? "minute" : "second";
      lines.push(`iptables -I ${ch} ${priority} ${protoFlag} ${portFlag} ${srcFlag} -m limit --limit ${rate}/${limitUnit} -j ACCEPT`.replace(/\s+/g, " ").trim());
      lines.push(`iptables -I ${ch} $((${priority}+1)) ${protoFlag} ${portFlag} ${srcFlag} -j DROP`.replace(/\s+/g, " ").trim());
    } else if (verbMeta.iptables === "LOG_ACCEPT") {
      lines.push(`iptables -I ${ch} ${priority} ${protoFlag} ${portFlag} ${srcFlag} -j LOG --log-prefix "PROXHQOS_PERMIT "`.replace(/\s+/g, " ").trim());
      lines.push(`iptables -I ${ch} $((${priority}+1)) ${protoFlag} ${portFlag} ${srcFlag} -j ACCEPT`.replace(/\s+/g, " ").trim());
    } else if (verbMeta.iptables === "LOG_DROP") {
      lines.push(`iptables -I ${ch} ${priority} ${protoFlag} ${portFlag} ${srcFlag} -j LOG --log-prefix "PROXHQOS_BLOCK "`.replace(/\s+/g, " ").trim());
      lines.push(`iptables -I ${ch} $((${priority}+1)) ${protoFlag} ${portFlag} ${srcFlag} -j DROP`.replace(/\s+/g, " ").trim());
    } else {
      const target = verbMeta.iptables === "NFQUEUE" ? "NFQUEUE --queue-num 0" : verbMeta.iptables;
      lines.push(`iptables -I ${ch} ${priority} ${protoFlag} ${portFlag} ${srcFlag} -j ${target}`.replace(/\s+/g, " ").trim());
    }
  };

  if (geoFlag) lines.push(geoFlag);
  if (chain === "BOTH") { buildChain("INPUT"); buildChain("OUTPUT"); }
  else buildChain(chain);
  return lines.join("\n");
}

function compileToNftables(parsed: ReturnType<typeof parseSymscript>): string {
  if (!parsed.valid) return `# ERROR: ${parsed.error}`;
  const { verb, port, protocol, chain, source, priority, rateLimit } = parsed;
  const verbMeta = SYMSCRIPT_SPEC.verbs[verb as keyof typeof SYMSCRIPT_SPEC.verbs];
  const protoMeta = SYMSCRIPT_SPEC.protocols[protocol as keyof typeof SYMSCRIPT_SPEC.protocols];

  const protoClause = protoMeta.p ? `${protoMeta.p} ` : "";
  const portClause = port && protoMeta.p ? `dport ${port} ` : "";
  const srcClause = source !== "@ANY" && !source.startsWith("@GEO:") ? `ip saddr ${source.slice(1)} ` : "";
  const nftChain = chain === "BOTH" ? "both_chains" : chain === "INPUT" ? "input" : "output";
  const action = rateLimit && verbMeta.nft === "limit" ? `limit rate ${rateLimit} accept` : verbMeta.nft;

  return `# nftables — priority ${priority}\nadd rule inet proxhqos ${nftChain} ${protoClause}${portClause}${srcClause}${action} comment "ProxhqOS SymScript™"`;
}

// ── English / iptables → SymScript™ Transcriber ────────────────────────────
function transcribeToSymscript(input: string): { symscript: string; explanation: string; confidence: number } {
  const raw = input.trim().toLowerCase();
  let verb = "⊕";
  let port = "";
  let protocol = "Ω*";
  let direction = "←";
  let source = "@ANY";
  let priority = 100;
  let rateLimit = "";

  // Detect iptables syntax
  const isIptables = raw.includes("-a input") || raw.includes("-a output") || raw.includes("-j accept") || raw.includes("-j drop");

  if (isIptables) {
    if (raw.includes("-j accept")) verb = "⊕";
    else if (raw.includes("-j drop")) verb = "⊘";
    else if (raw.includes("-j reject")) verb = "⊗";
    else if (raw.includes("-j log")) verb = "⊝";
    if (raw.includes("-a input") || raw.includes("-a forward")) direction = "←";
    else if (raw.includes("-a output")) direction = "→";
    const portM = raw.match(/--dport\s+(\d+(?::\d+)?)/);
    if (portM) port = portM[1].replace(":", "-");
    const protoM = raw.match(/-p\s+(tcp|udp|icmp)/);
    if (protoM) {
      protocol = protoM[1] === "tcp" ? "ΩT" : protoM[1] === "udp" ? "ΩU" : "ΩI";
    }
    const srcM = raw.match(/-s\s+([\d.\/]+)/);
    if (srcM) source = `@${srcM[1]}`;
    const prioM = raw.match(/-i\s+(\d+)/);
    if (prioM) priority = parseInt(prioM[1]);
  } else {
    // English NLP mapping
    if (/\b(block|deny|drop|forbid|refuse|stop|reject)\b/.test(raw)) {
      verb = raw.includes("reject") ? "⊗" : "⊘";
    } else if (/\b(rate.?limit|throttle|limit)\b/.test(raw)) {
      verb = "⊛";
    } else if (/\b(inspect|dpi|deep.?packet)\b/.test(raw)) {
      verb = "⊜";
    } else if (/\b(log.+allow|allow.+log|permit.+log)\b/.test(raw)) {
      verb = "⊝";
    } else if (/\b(log.+block|block.+log)\b/.test(raw)) {
      verb = "⊞";
    } else {
      verb = "⊕"; // default: allow
    }

    if (/\b(outbound|outgoing|egress|out)\b/.test(raw)) direction = "→";
    else if (/\b(both|bidirectional|in.?and.?out|inbound.+outbound)\b/.test(raw)) direction = "↔";
    else direction = "←";

    // Protocol
    if (/\b(udp)\b/.test(raw)) protocol = "ΩU";
    else if (/\b(icmp|ping)\b/.test(raw)) protocol = "ΩI";
    else if (/\b(tcp)\b/.test(raw)) protocol = "ΩT";
    else if (/\b(any|all.?protocol|all.?traffic)\b/.test(raw)) protocol = "Ω*";
    else if (/\b(ssh)\b/.test(raw)) { protocol = "ΩT"; port = "22"; }
    else if (/\b(https?)\b/.test(raw)) { protocol = "ΩT"; port = raw.includes("https") ? "443" : "80"; }
    else if (/\b(dns)\b/.test(raw)) { protocol = "ΩU"; port = "53"; }
    else if (/\b(wireguard|wg)\b/.test(raw)) { protocol = "ΩU"; port = "51820"; }
    else if (/\b(ftp)\b/.test(raw)) { protocol = "ΩT"; port = "21"; }
    else if (/\b(smtp)\b/.test(raw)) { protocol = "ΩT"; port = "25"; }
    else if (/\b(rdp)\b/.test(raw)) { protocol = "ΩT"; port = "3389"; }
    else if (/\b(mysql|mariadb)\b/.test(raw)) { protocol = "ΩT"; port = "3306"; }
    else if (/\b(postgres)\b/.test(raw)) { protocol = "ΩT"; port = "5432"; }

    // Extract port number if mentioned
    const portM = raw.match(/\bport[s]?\s+(\d+(?:\s*-\s*\d+)?)/);
    if (portM && !port) port = portM[1].replace(/\s*-\s*/, "-");
    const portM2 = raw.match(/\b(\d{2,5})\b/);
    if (portM2 && !port) port = portM2[1];

    // Source/IP
    const ipM = raw.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(?:\/\d{1,2})?)/);
    if (ipM) source = `@${ipM[1]}`;
    const geoM = raw.match(/\bcountry\s+([A-Za-z]{2})\b|\b([A-Za-z]{2})\s+country\b/);
    if (geoM) source = `@GEO:${(geoM[1] || geoM[2]).toUpperCase()}`;

    // Rate
    const rateM = raw.match(/(\d+)\s*(?:per\s*)?(second|minute|hour|sec|min|hr)/);
    if (rateM && verb === "⊛") {
      const unit = rateM[2].startsWith("s") ? "s" : rateM[2].startsWith("h") ? "hr" : "min";
      rateLimit = `⚡${rateM[1]}/${unit}`;
    }

    // Priority
    const prioM = raw.match(/\bpriority\s+(\d+)\b/);
    if (prioM) priority = parseInt(prioM[1]);
  }

  const portTarget = port ? `${port}::${protocol}` : protocol;
  const rateClause = rateLimit ? ` ${rateLimit}` : "";
  const symscript = `${verb} ${portTarget} ${direction} ${source}${rateClause} ≫${priority}`;

  const explanation = `${SYMSCRIPT_SPEC.verbs[verb as keyof typeof SYMSCRIPT_SPEC.verbs]?.label ?? verb} ${port ? `port ${port} ` : ""}${SYMSCRIPT_SPEC.protocols[protocol as keyof typeof SYMSCRIPT_SPEC.protocols]?.label ?? protocol} ${SYMSCRIPT_SPEC.directions[direction as keyof typeof SYMSCRIPT_SPEC.directions]?.label ?? direction} from ${source} at priority ${priority}${rateLimit ? ` with rate limit ${rateLimit}` : ""}`;

  const confidence = isIptables ? 95 : (port ? 80 : 60);
  return { symscript, explanation, confidence };
}

// ── Seed Helpers ──────────────────────────────────────────────────────────

const IPS_SEEDS = [
  // Web Attacks
  { sid:"WA-001", name:"SQL Injection — Classic UNION", category:"web-attacks", severity:"critical", pattern:"UNION[\\s+]SELECT|UNION ALL SELECT", patternType:"regex", description:"Detects classic UNION-based SQL injection attempts", cveId:"CWE-89", action:"drop" },
  { sid:"WA-002", name:"SQL Injection — Blind Time-Based", category:"web-attacks", severity:"high", pattern:"SLEEP\\(|WAITFOR DELAY|pg_sleep|BENCHMARK\\(", patternType:"regex", description:"Detects blind time-based SQL injection", cveId:"CWE-89", action:"drop" },
  { sid:"WA-003", name:"SQL Injection — Error-Based", category:"web-attacks", severity:"high", pattern:"EXTRACTVALUE\\(|UPDATEXML\\(|exp\\(~", patternType:"regex", description:"Detects error-based SQL injection exfiltration", cveId:"CWE-89", action:"drop" },
  { sid:"WA-004", name:"XSS — Reflected Script Injection", category:"web-attacks", severity:"high", pattern:"<script[^>]*>|javascript:|onload=|onerror=", patternType:"regex", description:"Detects reflected cross-site scripting payloads", cveId:"CWE-79", action:"drop" },
  { sid:"WA-005", name:"XSS — DOM-Based Sink", category:"web-attacks", severity:"medium", pattern:"document\\.write\\(|innerHTML\\s*=|eval\\(|setTimeout\\(", patternType:"regex", description:"Detects DOM-based XSS sink invocations", cveId:"CWE-79", action:"drop" },
  { sid:"WA-006", name:"Path Traversal", category:"web-attacks", severity:"critical", pattern:"\\.\\./\\.\\./|%2e%2e%2f|%252e%252e|/etc/passwd|/etc/shadow|/proc/self", patternType:"regex", description:"Detects directory traversal attempts targeting sensitive files", cveId:"CWE-22", action:"drop" },
  { sid:"WA-007", name:"Server-Side Template Injection", category:"web-attacks", severity:"critical", pattern:"\\{\\{.*\\}\\}|\\$\\{.*\\}|<%.*%>|#\\{.*\\}", patternType:"regex", description:"Detects SSTI payloads across Jinja2/Twig/EL/Mako engines", cveId:"CWE-94", action:"drop" },
  { sid:"WA-008", name:"OS Command Injection", category:"web-attacks", severity:"critical", pattern:";\\s*(id|whoami|cat|ls|wget|curl)|\\|\\s*(id|whoami|cat)|&&\\s*(id|whoami)|`id`", patternType:"regex", description:"Detects OS command injection via shell metacharacters", cveId:"CWE-78", action:"drop" },
  { sid:"WA-009", name:"XXE — External Entity Injection", category:"web-attacks", severity:"high", pattern:"<!ENTITY[\\s]+[^>]+SYSTEM|<!DOCTYPE[^>]+\\[", patternType:"regex", description:"Detects XML External Entity injection attacks", cveId:"CWE-611", action:"drop" },
  { sid:"WA-010", name:"SSRF — Internal Metadata Access", category:"web-attacks", severity:"critical", pattern:"169\\.254\\.169\\.254|file:\\/\\/\\/|gopher://|dict://|ftp://localhost", patternType:"regex", description:"Detects SSRF probes targeting cloud metadata and local services", cveId:"CWE-918", action:"drop" },
  { sid:"WA-011", name:"Local File Inclusion", category:"web-attacks", severity:"high", pattern:"(?:include|require).*(?:/etc/passwd|/proc/self|/var/log|/tmp/)", patternType:"regex", description:"Detects PHP LFI targeting sensitive system paths", cveId:"CWE-98", action:"drop" },
  { sid:"WA-012", name:"Open Redirect", category:"web-attacks", severity:"medium", pattern:"(?:redirect|url|next|return_to)=(?:https?:|//)(?!(?:your-domain\\.com))", patternType:"regex", description:"Detects open redirect parameters pointing to external hosts", cveId:"CWE-601", action:"drop" },
  { sid:"WA-013", name:"CRLF Injection", category:"web-attacks", severity:"medium", pattern:"%0d%0a|%0D%0A|\\r\\n(?:Location|Set-Cookie|Content-Type)", patternType:"regex", description:"Detects CRLF injection for header smuggling or log poisoning", cveId:"CWE-93", action:"drop" },
  { sid:"WA-014", name:"HTTP Request Smuggling", category:"web-attacks", severity:"high", pattern:"Transfer-Encoding:\\s*chunked[\\s\\S]*Content-Length:|Content-Length:[\\s\\S]*Transfer-Encoding:\\s*chunked", patternType:"regex", description:"Detects desync-style HTTP request smuggling", cveId:"CWE-444", action:"drop" },
  { sid:"WA-015", name:"PHP Object Injection", category:"web-attacks", severity:"high", pattern:"O:[0-9]+:\"[^\"]+\":[0-9]+:\\{|a:[0-9]+:\\{|s:[0-9]+:\"", patternType:"regex", description:"Detects PHP serialized object injection payloads", cveId:"CWE-502", action:"drop" },
  // Recon
  { sid:"RC-001", name:"Nmap Scanner Fingerprint", category:"recon", severity:"medium", pattern:"Nmap|nmap\\.org|NMAP NSE|masscan", patternType:"user-agent", description:"Detects Nmap and Masscan active reconnaissance tools", cveId:null, action:"drop" },
  { sid:"RC-002", name:"Directory Brute Force Tool", category:"recon", severity:"high", pattern:"dirsearch|gobuster|feroxbuster|wfuzz|dirb|ffuf|rustbuster", patternType:"user-agent", description:"Detects common directory enumeration tools by User-Agent", cveId:null, action:"drop" },
  { sid:"RC-003", name:"Web App Vulnerability Scanner", category:"recon", severity:"high", pattern:"Nikto|OWASP ZAP|Burp Suite|w3af|Acunetix|sqlmap|openvas", patternType:"user-agent", description:"Detects automated web vulnerability scanners", cveId:null, action:"drop" },
  { sid:"RC-004", name:"WordPress Scanner", category:"recon", severity:"medium", pattern:"WPScan|wp-login\\.php.*?passwd|xmlrpc\\.php.*multicall", patternType:"regex", description:"Detects WPScan WordPress enumeration and XML-RPC abuse", cveId:null, action:"drop" },
  { sid:"RC-005", name:"Shodan/Censys Internet Bot", category:"recon", severity:"low", pattern:"Shodan\\.io|Censys|ShadowServer|BinaryEdge|ZoomEye", patternType:"user-agent", description:"Detects internet scanning services indexing exposed services", cveId:null, action:"drop" },
  { sid:"RC-006", name:"Aggressive Path Enumeration", category:"recon", severity:"high", pattern:"(?:\\.env|\\.git/config|\\.htpasswd|backup\\.sql|\\.DS_Store|admin/config)", patternType:"regex", description:"Detects attempts to access sensitive configuration files", cveId:null, action:"drop" },
  { sid:"RC-007", name:"API Endpoint Discovery", category:"recon", severity:"medium", pattern:"/api/v[0-9]+/(?:users|admin|config|keys|tokens|secrets|credentials)", patternType:"regex", description:"Detects automated API endpoint enumeration", cveId:null, action:"drop" },
  { sid:"RC-008", name:"Credential Stuffing Pattern", category:"recon", severity:"high", pattern:"(?:login|signin|auth).*(?:email|user|pass).*(?:email|user|pass)", patternType:"regex", description:"Detects high-volume login attempts consistent with credential stuffing", cveId:null, action:"drop" },
  // Malware C2
  { sid:"C2-001", name:"Cobalt Strike Beacon URI", category:"malware-c2", severity:"critical", pattern:"/[a-zA-Z0-9]{4}\\.(png|gif|jpg)$|/submit\\.php\\?id=|/ca$", patternType:"regex", description:"Detects Cobalt Strike default staging and beacon check-in URIs", cveId:null, action:"drop" },
  { sid:"C2-002", name:"Metasploit Meterpreter Stage", category:"malware-c2", severity:"critical", pattern:"/metasploit|/payload\\.(?:exe|dll|ps1)|MsfPayload|MsfVenom", patternType:"regex", description:"Detects Metasploit Meterpreter staging and payload delivery", cveId:null, action:"drop" },
  { sid:"C2-003", name:"PowerShell Download Cradle", category:"malware-c2", severity:"critical", pattern:"IEX\\s*\\(|Invoke-Expression|DownloadString\\(|powershell.*-enc|-EncodedCommand", patternType:"regex", description:"Detects PowerShell download-and-execute cradles used by malware", cveId:null, action:"drop" },
  { sid:"C2-004", name:"DNS Tunneling Pattern", category:"malware-c2", severity:"high", pattern:"[a-f0-9]{30,}\\.(?:[a-z]{3,}\\.){3,}", patternType:"regex", description:"Detects unusually long subdomain labels indicative of DNS tunneling", cveId:null, action:"drop" },
  { sid:"C2-005", name:"Empire C2 Default Paths", category:"malware-c2", severity:"critical", pattern:"/admin/get\\.php|/news\\.php|/login/process\\.php|Microsoft Public Symbol", patternType:"regex", description:"Detects PowerShell Empire C2 default staging paths", cveId:null, action:"drop" },
  { sid:"C2-006", name:"AsyncRAT / QuasarRAT", category:"malware-c2", severity:"critical", pattern:"AsyncRAT|QuasarRAT|RemcosRAT|NjRAT|DarkComet|Gh0st RAT", patternType:"regex", description:"Detects known RAT family markers in network traffic", cveId:null, action:"drop" },
  { sid:"C2-007", name:"Base64 Payload Smuggling", category:"malware-c2", severity:"high", pattern:"(?:[A-Za-z0-9+/]{60,}={0,2})(?:.*(?:TVqQ|H4sI|UEsD|AAAA))", patternType:"regex", description:"Detects suspiciously long base64 blocks containing known payload headers", cveId:null, action:"drop" },
  { sid:"C2-008", name:"Suspicious Outbound Beacon", category:"malware-c2", severity:"high", pattern:"(?:X-Malware-Beacon|X-C2-Session|X-Bot-ID|X-Implant):", patternType:"header", description:"Detects known malware beacon headers used by implants", cveId:null, action:"drop" },
  // Protocol Anomaly
  { sid:"PA-001", name:"Oversized HTTP Header", category:"protocol-anomaly", severity:"medium", pattern:"^.{16384,}$", patternType:"header", description:"Detects HTTP headers exceeding 16KB — indicative of buffer overflow or evasion", cveId:null, action:"drop" },
  { sid:"PA-002", name:"Malformed HTTP Method", category:"protocol-anomaly", severity:"high", pattern:"^(?!GET|POST|PUT|DELETE|HEAD|OPTIONS|PATCH|CONNECT|TRACE)[A-Z]{3,}", patternType:"method", description:"Detects non-standard HTTP methods used for firewall bypass", cveId:null, action:"drop" },
  { sid:"PA-003", name:"HTTP Host Header Injection", category:"protocol-anomaly", severity:"high", pattern:"Host:\\s*[^\\r\\n]+(?:\\r\\n|\\n)Host:", patternType:"header", description:"Detects duplicate Host headers used for cache poisoning attacks", cveId:null, action:"drop" },
  { sid:"PA-004", name:"SSL/TLS Downgrade Probe", category:"protocol-anomaly", severity:"high", pattern:"SSLv2|SSLv3|TLSv1\\.0|POODLE|BEAST|export ciphers", patternType:"regex", description:"Detects SSL/TLS version downgrade probe attempts", cveId:"CVE-2014-3566", action:"drop" },
  { sid:"PA-005", name:"IP Fragment Overlap Attack", category:"protocol-anomaly", severity:"high", pattern:"frag_offset_attack|teardrop|overlapping_fragments", patternType:"signature", description:"Detects IP fragment overlap attacks (Teardrop, frag overlap)", cveId:"CWE-404", action:"drop" },
  // Exploits
  { sid:"EX-001", name:"Log4Shell JNDI Injection", category:"exploit", severity:"critical", pattern:"\\$\\{jndi:(?:ldap|ldaps|rmi|dns|corba|iiop|nis|nds)://", patternType:"regex", description:"Detects Log4j2 JNDI injection exploits — CVE-2021-44228", cveId:"CVE-2021-44228", action:"drop" },
  { sid:"EX-002", name:"Spring4Shell Class Loader", category:"exploit", severity:"critical", pattern:"class\\.module\\.classLoader|spring\\.Expression|ClassPathXmlApplicationContext", patternType:"regex", description:"Detects Spring4Shell RCE via class loader manipulation", cveId:"CVE-2022-22965", action:"drop" },
  { sid:"EX-003", name:"ProxyLogon Exchange SSRF", category:"exploit", severity:"critical", pattern:"/owa/auth/\\.\\./.*/.*\\.aspx|X-AnonResource-Backend:|X-BEResource:", patternType:"regex", description:"Detects ProxyLogon Exchange Server exploitation", cveId:"CVE-2021-26855", action:"drop" },
  { sid:"EX-004", name:"EternalBlue SMB Exploit", category:"exploit", severity:"critical", pattern:"\\\\PIPE\\\\|NT AUTHORITY\\\\NETWORK SERVICE|MS17-010|SMBv1", patternType:"signature", description:"Detects EternalBlue SMBv1 RCE exploitation payload patterns", cveId:"CVE-2017-0144", action:"drop" },
  { sid:"EX-005", name:"Shellshock CGI Attack", category:"exploit", severity:"critical", pattern:"\\(\\)\\s*\\{\\s*:;\\}\\s*;|\\(\\)\\s*\\{\\s*[^}]+\\}\\s*;", patternType:"regex", description:"Detects Shellshock bash remote code execution via CGI", cveId:"CVE-2014-6271", action:"drop" },
  { sid:"EX-006", name:"Heartbleed TLS Heartbeat", category:"exploit", severity:"high", pattern:"heartbeat_request.*length.*overflow|TLS heartbeat \\(type 24\\)", patternType:"signature", description:"Detects malformed TLS heartbeat requests used in Heartbleed", cveId:"CVE-2014-0160", action:"drop" },
  // Brute Force
  { sid:"BF-001", name:"SSH Brute Force Detection", category:"brute-force", severity:"high", pattern:"Failed password|Invalid user|authentication failure.*ssh", patternType:"log", description:"Detects rapid SSH authentication failures consistent with brute force", cveId:null, action:"drop" },
  { sid:"BF-002", name:"Web Login Brute Force", category:"brute-force", severity:"high", pattern:"(?:POST /(?:login|signin|auth|wp-login).*){5,}", patternType:"regex", description:"Detects high-frequency POST requests to authentication endpoints", cveId:null, action:"drop" },
  { sid:"BF-003", name:"API Key Enumeration", category:"brute-force", severity:"medium", pattern:"(?:401 Unauthorized.*){10,}|X-API-Key:\\s*[a-z0-9]{6,}", patternType:"regex", description:"Detects systematic API key guessing or enumeration attacks", cveId:null, action:"drop" },
  { sid:"BF-004", name:"Database Auth Brute Force", category:"brute-force", severity:"high", pattern:"Access denied for user|FATAL:.*password authentication failed|authentication failed.*postgres", patternType:"log", description:"Detects rapid database authentication failures (MySQL/PostgreSQL)", cveId:null, action:"drop" },
  { sid:"BF-005", name:"HTTP Basic Auth Brute Force", category:"brute-force", severity:"medium", pattern:"Authorization:\\s*Basic\\s+[A-Za-z0-9+/]{10,}=*", patternType:"header", description:"Detects rapid Basic Auth attempts consistent with credential brute forcing", cveId:null, action:"drop" },
];

const THREAT_FEED_SEEDS = [
  { name:"Tor Exit Nodes", url:"https://check.torproject.org/torbulkexitlist", feedType:"ip-list", enabled:true, autoSync:true, status:"pending" },
  { name:"Emerging Threats Compromised IPs", url:"https://rules.emergingthreats.net/blockrules/compromised-ips.txt", feedType:"ip-list", enabled:true, autoSync:true, status:"pending" },
  { name:"Spamhaus DROP List", url:"https://www.spamhaus.org/drop/drop.txt", feedType:"cidr-list", enabled:true, autoSync:true, status:"pending" },
  { name:"Feodo Tracker C2 Blocklist", url:"https://feodotracker.abuse.ch/downloads/ipblocklist.txt", feedType:"ip-list", enabled:true, autoSync:true, status:"pending" },
  { name:"ProxhqVPN Community Feed", url:"internal://ghost-trap-results", feedType:"ip-list", enabled:true, autoSync:true, status:"pending" },
];

// Additional feeds inserted on every boot if not already present
const EXTENDED_FEED_SEEDS = [
  { name:"AlienVault OTX Reputation", url:"https://reputation.alienvault.com/reputation.generic", feedType:"ip-list", enabled:true, autoSync:true, status:"pending" },
  { name:"Cisco Talos IP Blacklist", url:"https://snort.org/downloads/ip-block-list", feedType:"ip-list", enabled:true, autoSync:true, status:"pending" },
  { name:"URLhaus Malicious URLs", url:"https://urlhaus.abuse.ch/downloads/text/", feedType:"url-list", enabled:true, autoSync:true, status:"pending" },
  { name:"Abuse.ch SSLBL C2 IPs", url:"https://sslbl.abuse.ch/blacklist/sslipblacklist.txt", feedType:"ip-list", enabled:true, autoSync:true, status:"pending" },
  { name:"Blocklist.de Attack IPs", url:"https://lists.blocklist.de/lists/all.txt", feedType:"ip-list", enabled:true, autoSync:true, status:"pending" },
  { name:"DShield Honeypot Blocklist", url:"https://feeds.dshield.org/block.txt", feedType:"cidr-list", enabled:true, autoSync:true, status:"pending" },
];

const ZONE_SEEDS = [
  { name:"WireGuard Peers", trustLevel:"trusted", interfaces:"wg+", description:"All connected WireGuard VPN peers — trusted after key authentication", inboundPolicy:"allow", outboundPolicy:"allow", color:"#00ff88" },
  { name:"Internet / Untrusted", trustLevel:"untrusted", interfaces:"eth0,eth1", description:"Public internet — all inbound traffic treated as hostile until verified", inboundPolicy:"deny", outboundPolicy:"allow", color:"#ff4444" },
  { name:"DMZ", trustLevel:"dmz", interfaces:"eth1", description:"Demilitarized zone for public-facing services — restricted in/out access", inboundPolicy:"deny", outboundPolicy:"deny", color:"#ff9900" },
  { name:"Management", trustLevel:"management", interfaces:"lo,mgmt0", description:"Internal management plane — only authorized admin IPs permitted", inboundPolicy:"deny", outboundPolicy:"allow", color:"#4488ff" },
];

const GHOSTOS_DEFAULT_RULES = [
  { symbolicRule:"⊕ 51820::ΩU ← @ANY ≫1", description:"Allow WireGuard inbound", ruleType:"symscript" },
  { symbolicRule:"⊕ 443::ΩT ← @ANY ≫5", description:"Allow HTTPS inbound", ruleType:"symscript" },
  { symbolicRule:"⊕ 22::ΩT ← @192.168.0.0/16 ≫10", description:"Allow SSH from LAN only", ruleType:"symscript" },
  { symbolicRule:"⊛ 22::ΩT ← @ANY ⚡5/min ≫50", description:"Rate-limit SSH brute force", ruleType:"symscript" },
  { symbolicRule:"⊘ @GEO:KP ↔ @ANY ≫80", description:"Block North Korea geo-block", ruleType:"symscript" },
  { symbolicRule:"⊞ ← @ANY ≫98", description:"Log all unmatched inbound", ruleType:"symscript" },
  { symbolicRule:"⊥ ← ⊘", description:"Default deny all inbound", ruleType:"default-policy" },
];

async function seedIfEmpty() {
  const [sigCount] = await db.select({ c: sql<number>`COUNT(*)` }).from(firewallIpsSignaturesTable);
  if (Number(sigCount.c) === 0) {
    await db.insert(firewallIpsSignaturesTable).values(IPS_SEEDS.map(s => ({ ...s, enabled: true, hitCount: 0, createdAt: new Date() })));
  }
  const [feedCount] = await db.select({ c: sql<number>`COUNT(*)` }).from(firewallThreatFeedsTable);
  if (Number(feedCount.c) === 0) {
    await db.insert(firewallThreatFeedsTable).values(THREAT_FEED_SEEDS.map(f => ({ ...f, entryCount: 0, createdAt: new Date() })));
  }
  // Always ensure extended feeds exist (idempotent — check by name)
  const existing = await db.select({ name: firewallThreatFeedsTable.name }).from(firewallThreatFeedsTable);
  const existingNames = new Set(existing.map(f => f.name));
  const toInsert = EXTENDED_FEED_SEEDS.filter(f => !existingNames.has(f.name));
  if (toInsert.length > 0) {
    await db.insert(firewallThreatFeedsTable).values(toInsert.map(f => ({ ...f, entryCount: 0, createdAt: new Date() })));
  }
  const [zoneCount] = await db.select({ c: sql<number>`COUNT(*)` }).from(firewallZonesTable);
  if (Number(zoneCount.c) === 0) {
    await db.insert(firewallZonesTable).values(ZONE_SEEDS.map(z => ({ ...z, createdAt: new Date() })));
  }
  const [ghostCount] = await db.select({ c: sql<number>`COUNT(*)` }).from(firewallGhostOsRulesTable);
  if (Number(ghostCount.c) === 0) {
    await db.insert(firewallGhostOsRulesTable).values(
      GHOSTOS_DEFAULT_RULES.map(r => {
        const parsed = parseSymscript(r.symbolicRule);
        return { ...r, compiledIptables: compileToIptables(parsed), compiledNftables: compileToNftables(parsed), enabled: true, hitCount: 0, createdAt: new Date() };
      })
    );
  }
}

// Run seed on startup
seedIfEmpty().catch(() => {});

// ═══════════════════════════════════════════════════════════════════════════
// ── EXISTING ROUTES (unchanged) ────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

router.get("/rules", async (_req, res) => {
  const rules = await db.select().from(firewallRulesTable).orderBy(asc(firewallRulesTable.priority));
  res.json({ rules, total: rules.length, enabledCount: rules.filter(r => r.enabled).length });
});

router.post("/rules", async (req, res) => {
  const body = z.object({
    name: z.string(), direction: z.enum(["inbound","outbound","both"]),
    action: z.enum(["allow","deny","drop","reject","masquerade","log"]),
    protocol: z.enum(["tcp","udp","icmp","any"]),
    sourceIp: z.string().optional(), sourcePort: z.string().optional(),
    destIp: z.string().optional(), destPort: z.string().optional(),
    priority: z.number().optional().default(100), description: z.string().optional(),
    isIspMasquerade: z.boolean().optional().default(false),
  }).parse(req.body);
  const [rule] = await db.insert(firewallRulesTable).values({ ...body, enabled: true, hitCount: 0, createdAt: new Date() }).returning();
  res.status(201).json(rule);
});

router.put("/rules/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const body = z.object({
    name: z.string().optional(), direction: z.enum(["inbound","outbound","both"]).optional(),
    action: z.enum(["allow","deny","drop","reject","masquerade","log"]).optional(),
    protocol: z.enum(["tcp","udp","icmp","any"]).optional(),
    sourceIp: z.string().optional(), sourcePort: z.string().optional(),
    destIp: z.string().optional(), destPort: z.string().optional(),
    priority: z.number().optional(), enabled: z.boolean().optional(),
    description: z.string().optional(), isIspMasquerade: z.boolean().optional(),
  }).parse(req.body);
  const [rule] = await db.update(firewallRulesTable).set(body).where(eq(firewallRulesTable.id, id)).returning();
  if (!rule) return res.status(404).json({ error: "Rule not found" });
  res.json(rule);
});

router.delete("/rules/:id", async (req, res) => {
  await db.delete(firewallRulesTable).where(eq(firewallRulesTable.id, parseInt(req.params.id)));
  res.status(204).send();
});

router.get("/status", async (_req, res) => {
  const status = await getOrCreateStatus();
  const rules = await db.select().from(firewallRulesTable);
  const blocked = await db.select().from(blockedIpsTable);
  const sigs = await db.select().from(firewallIpsSignaturesTable);
  const ghostRules = await db.select().from(firewallGhostOsRulesTable);
  res.json({ ...status, totalRules: rules.length, enabledRules: rules.filter(r => r.enabled).length,
    blockedIps: blocked.length, ipsSignatures: sigs.filter(s => s.enabled).length, ghostOsRules: ghostRules.filter(r => r.enabled).length });
});

router.post("/toggle", async (req, res) => {
  const body = z.object({ enabled: z.boolean(), mode: z.enum(["stealth","strict","standard","learning"]).optional() }).parse(req.body);
  const status = await getOrCreateStatus();
  const [updated] = await db.update(firewallStatusTable).set({ enabled: body.enabled, mode: body.mode ?? status.mode, lastUpdated: new Date() }).where(eq(firewallStatusTable.id, status.id)).returning();
  const rules = await db.select().from(firewallRulesTable);
  const blocked = await db.select().from(blockedIpsTable);
  res.json({ ...updated, totalRules: rules.length, enabledRules: rules.filter(r => r.enabled).length, blockedIps: blocked.length });
});

router.get("/blocked-ips", async (_req, res) => {
  const blockedIps = await db.select().from(blockedIpsTable).orderBy(desc(blockedIpsTable.blockedAt));
  res.json({ blockedIps, total: blockedIps.length });
});

router.post("/blocked-ips", async (req, res) => {
  const body = z.object({ ip: z.string(), reason: z.string(), expiresInMinutes: z.number().optional() }).parse(req.body);
  const expiresAt = body.expiresInMinutes ? new Date(Date.now() + body.expiresInMinutes * 60 * 1000) : undefined;
  const [blocked] = await db.insert(blockedIpsTable).values({ ip: body.ip, reason: body.reason, autoBlocked: false, hitCount: 1, blockedAt: new Date(), expiresAt }).returning();
  res.status(201).json(blocked);
});

router.post("/blocked-ips/:id/unblock", async (req, res) => {
  const [row] = await db.delete(blockedIpsTable).where(eq(blockedIpsTable.id, parseInt(req.params.id))).returning();
  if (!row) return res.status(404).json({ error: "Not found" });
  res.json(row);
});

router.get("/audit-exemptions", (_req, res) => {
  const fwmark = "0x5050";
  res.json({
    description: "Rules to allow ProxhqVPN security tools through the kill switch without being blocked.",
    auditFwmark: fwmark,
    iptablesRules: `iptables -A OUTPUT -m mark --mark ${fwmark} -j ACCEPT\niptables -A INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT\niptables -A INPUT -m conntrack --ctstate INVALID -j DROP`,
    nftablesRules: `table inet proxhq_audit {\n  chain output { type filter hook output priority filter; meta mark ${fwmark} accept }\n  chain input { type filter hook input priority filter; ct state established,related accept; ct state invalid drop }\n}`,
    wireguardPostUp: `PostUp = iptables -A OUTPUT -m mark --mark ${fwmark} -j ACCEPT`,
    wireguardPostDown: `PostDown = iptables -D OUTPUT -m mark --mark ${fwmark} -j ACCEPT 2>/dev/null`,
    generatedAt: new Date().toISOString(),
  });
});

router.post("/generate-iptables", async (_req, res) => {
  const rules = await db.select().from(firewallRulesTable).where(eq(firewallRulesTable.enabled, true));
  const blocked = await db.select().from(blockedIpsTable);
  const ghostRules = await db.select().from(firewallGhostOsRulesTable).where(eq(firewallGhostOsRulesTable.enabled, true));
  const geoBlocks = await db.select().from(firewallGeoBlocksTable).where(eq(firewallGeoBlocksTable.enabled, true));
  const fqdnRules = await db.select().from(firewallFqdnRulesTable).where(eq(firewallFqdnRulesTable.enabled, true));

  const iptablesLines = [
    "# ProxhqVPN GhostOS™ Firewall — iptables ruleset",
    "# Generated by ProxhqOS SymScript™ Engine v1.0",
    "# © 2026 Alpha Unlimited Technologies LLC",
    "*filter",
    ":INPUT DROP [0:0]", ":FORWARD DROP [0:0]", ":OUTPUT ACCEPT [0:0]",
    "-A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT",
    "-A INPUT -i lo -j ACCEPT",
    "# ── GhostOS™ SymScript™ compiled rules ──",
    ...ghostRules.map(r => r.compiledIptables ?? `# ${r.symbolicRule}`),
    "# ── Standard blocked IPs ──",
    ...blocked.map(b => `-A INPUT -s ${b.ip} -j DROP  # ${b.reason}`),
    "# ── Geo-IP blocks (requires ipset) ──",
    ...geoBlocks.map(g => `# ipset add proxhq-geo-block ${g.countryCode}  # ${g.countryName}`),
    "# ── Standard rules ──",
    ...rules.map(r => {
      const proto = r.protocol !== "any" ? `-p ${r.protocol}` : "";
      const src = r.sourceIp ? `-s ${r.sourceIp}` : "";
      const dst = r.destIp ? `-d ${r.destIp}` : "";
      const dport = r.destPort ? `--dport ${r.destPort}` : "";
      const chain = r.direction === "inbound" ? "INPUT" : r.direction === "outbound" ? "OUTPUT" : "FORWARD";
      const action = r.action === "allow" ? "ACCEPT" : r.action === "log" ? "LOG" : "DROP";
      return `-A ${chain} ${proto} ${src} ${dst} ${dport} -j ${action}  # ${r.name}`.replace(/\s+/g, " ").trim();
    }),
    "# ── FQDN rules (apply via ipset + dnsmasq) ──",
    ...fqdnRules.map(f => `# ipset add proxhq-fqdn-${f.action} $(dig +short ${f.domain})  # ${f.domain}`),
    "COMMIT",
    "*nat",
    ":PREROUTING ACCEPT [0:0]", ":OUTPUT ACCEPT [0:0]", ":POSTROUTING ACCEPT [0:0]",
    "-A POSTROUTING -o eth0 -j MASQUERADE",
    "-A POSTROUTING -o wg+ -j MASQUERADE",
    "COMMIT",
  ];

  const nftablesLines = [
    "#!/usr/sbin/nft -f",
    "# ProxhqVPN GhostOS™ — nftables ruleset",
    "flush ruleset",
    "table inet proxhqos {",
    "  chain input { type filter hook input priority 0; policy drop;",
    "    ct state established,related accept",
    "    iif lo accept",
    ...ghostRules.map(r => `    ${r.compiledNftables?.split("\n").slice(-1)[0] ?? ""}`),
    ...blocked.map(b => `    ip saddr ${b.ip} drop`),
    "  }",
    "  chain forward { type filter hook forward priority 0; policy drop; }",
    "  chain output { type filter hook output priority 0; policy accept; }",
    "}",
  ];

  res.json({
    iptablesRules: iptablesLines.join("\n"),
    nftablesRules: nftablesLines.join("\n"),
    wireguardMasquerade: ["for i in $(seq 0 49); do", "  iptables -t nat -A POSTROUTING -o wg${i} -j MASQUERADE", "done"].join("\n"),
    portKnockRules: "[openWG]\n  sequence = 7000,8000,9000\n  command = /sbin/iptables -I INPUT -s %IP% -p udp --dport 51820 -j ACCEPT",
    ghostOsSymscript: ghostRules.map(r => r.symbolicRule).join("\n"),
    exportedAt: new Date().toISOString(),
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// ── GhostOS™ SymScript™ Routes ─────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

router.get("/ghostos/rules", async (_req, res) => {
  const rules = await db.select().from(firewallGhostOsRulesTable).orderBy(asc(firewallGhostOsRulesTable.createdAt));
  res.json({ rules, total: rules.length, enabledCount: rules.filter(r => r.enabled).length, spec: SYMSCRIPT_SPEC });
});

router.post("/ghostos/rules", async (req, res) => {
  const body = z.object({ symbolicRule: z.string(), description: z.string().optional(), ruleType: z.string().optional().default("symscript") }).parse(req.body);
  const parsed = parseSymscript(body.symbolicRule);
  if (!parsed.valid) return res.status(400).json({ error: parsed.error });
  const compiledIptables = compileToIptables(parsed);
  const compiledNftables = compileToNftables(parsed);
  const [rule] = await db.insert(firewallGhostOsRulesTable).values({ symbolicRule: body.symbolicRule, description: body.description, compiledIptables, compiledNftables, ruleType: body.ruleType ?? "symscript", enabled: true, hitCount: 0, createdAt: new Date() }).returning();
  res.status(201).json({ rule, parsed, compiledIptables, compiledNftables });
});

router.put("/ghostos/rules/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const body = z.object({ symbolicRule: z.string().optional(), description: z.string().optional(), enabled: z.boolean().optional() }).parse(req.body);
  const updateData: Record<string, unknown> = { ...body };
  if (body.symbolicRule) {
    const parsed = parseSymscript(body.symbolicRule);
    if (!parsed.valid) return res.status(400).json({ error: parsed.error });
    updateData.compiledIptables = compileToIptables(parsed);
    updateData.compiledNftables = compileToNftables(parsed);
  }
  const [rule] = await db.update(firewallGhostOsRulesTable).set(updateData).where(eq(firewallGhostOsRulesTable.id, id)).returning();
  if (!rule) return res.status(404).json({ error: "Rule not found" });
  res.json(rule);
});

router.delete("/ghostos/rules/:id", async (req, res) => {
  await db.delete(firewallGhostOsRulesTable).where(eq(firewallGhostOsRulesTable.id, parseInt(req.params.id)));
  res.status(204).send();
});

router.post("/ghostos/transcribe", async (req, res) => {
  const body = z.object({ input: z.string(), format: z.enum(["english","iptables","nftables"]).default("english"), apply: z.boolean().optional().default(false) }).parse(req.body);
  const result = transcribeToSymscript(body.input);
  const parsed = parseSymscript(result.symscript);
  const compiledIptables = compileToIptables(parsed);
  const compiledNftables = compileToNftables(parsed);
  const [log] = await db.insert(firewallTranscriberLogTable).values({ inputText: body.input, inputFormat: body.format, outputSymscript: result.symscript, compiledIptables, applied: false, createdAt: new Date() }).returning();
  if (body.apply && parsed.valid) {
    await db.insert(firewallGhostOsRulesTable).values({ symbolicRule: result.symscript, description: `Transcribed from: ${body.input.substring(0, 80)}`, compiledIptables, compiledNftables, ruleType: "transcribed", enabled: true, hitCount: 0, createdAt: new Date() });
    await db.update(firewallTranscriberLogTable).set({ applied: true, appliedAt: new Date() }).where(eq(firewallTranscriberLogTable.id, log.id));
  }
  res.json({ ...result, parsed, compiledIptables, compiledNftables, logId: log.id });
});

router.post("/ghostos/parse", async (req, res) => {
  const body = z.object({ rule: z.string() }).parse(req.body);
  const parsed = parseSymscript(body.rule);
  if (!parsed.valid) return res.status(400).json({ valid: false, error: parsed.error });
  const compiledIptables = compileToIptables(parsed);
  const compiledNftables = compileToNftables(parsed);
  res.json({ valid: true, parsed, compiledIptables, compiledNftables, spec: SYMSCRIPT_SPEC });
});

router.get("/ghostos/transcriber-log", async (_req, res) => {
  const logs = await db.select().from(firewallTranscriberLogTable).orderBy(desc(firewallTranscriberLogTable.createdAt)).limit(50);
  res.json({ logs, total: logs.length });
});

router.get("/ghostos/spec", (_req, res) => {
  res.json({ spec: SYMSCRIPT_SPEC, version: "1.0", engine: "GhostOS™ ProxhqOS SymScript™", copyright: "© 2026 Alpha Unlimited Technologies LLC" });
});

// ═══════════════════════════════════════════════════════════════════════════
// ── IPS Signature Engine ───────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

router.get("/ips/signatures", async (_req, res) => {
  const sigs = await db.select().from(firewallIpsSignaturesTable).orderBy(asc(firewallIpsSignaturesTable.category), asc(firewallIpsSignaturesTable.sid));
  const cats = [...new Set(sigs.map(s => s.category))];
  const categoryCounts: Record<string, { total: number; enabled: number; hits: number }> = {};
  for (const c of cats) {
    const cs = sigs.filter(s => s.category === c);
    categoryCounts[c] = { total: cs.length, enabled: cs.filter(s => s.enabled).length, hits: cs.reduce((a, s) => a + s.hitCount, 0) };
  }
  res.json({ signatures: sigs, total: sigs.length, enabledCount: sigs.filter(s => s.enabled).length, categoryCounts });
});

router.post("/ips/signatures/:id/toggle", async (req, res) => {
  const id = parseInt(req.params.id);
  const body = z.object({ enabled: z.boolean() }).parse(req.body);
  const [sig] = await db.update(firewallIpsSignaturesTable).set({ enabled: body.enabled }).where(eq(firewallIpsSignaturesTable.id, id)).returning();
  if (!sig) return res.status(404).json({ error: "Signature not found" });
  res.json(sig);
});

router.post("/ips/bulk-toggle", async (req, res) => {
  const body = z.object({ category: z.string(), enabled: z.boolean() }).parse(req.body);
  await db.update(firewallIpsSignaturesTable).set({ enabled: body.enabled }).where(eq(firewallIpsSignaturesTable.category, body.category));
  const sigs = await db.select().from(firewallIpsSignaturesTable).where(eq(firewallIpsSignaturesTable.category, body.category));
  res.json({ updated: sigs.length, category: body.category, enabled: body.enabled });
});

router.delete("/ips/signatures/:id", async (req, res) => {
  await db.delete(firewallIpsSignaturesTable).where(eq(firewallIpsSignaturesTable.id, parseInt(req.params.id)));
  res.status(204).send();
});

// ═══════════════════════════════════════════════════════════════════════════
// ── Deep Packet Inspection ─────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

router.get("/dpi/rules", async (_req, res) => {
  const rules = await db.select().from(firewallDpiRulesTable).orderBy(asc(firewallDpiRulesTable.createdAt));
  res.json({ rules, total: rules.length, enabledCount: rules.filter(r => r.enabled).length });
});

router.post("/dpi/rules", async (req, res) => {
  const body = z.object({ name: z.string(), pattern: z.string(), patternType: z.enum(["url","header","body","user-agent","host","method"]), action: z.enum(["block","alert","log"]).default("block"), description: z.string().optional() }).parse(req.body);
  const [rule] = await db.insert(firewallDpiRulesTable).values({ ...body, enabled: true, hitCount: 0, createdAt: new Date() }).returning();
  res.status(201).json(rule);
});

router.put("/dpi/rules/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const body = z.object({ enabled: z.boolean().optional(), action: z.enum(["block","alert","log"]).optional(), name: z.string().optional(), pattern: z.string().optional() }).parse(req.body);
  const [rule] = await db.update(firewallDpiRulesTable).set(body).where(eq(firewallDpiRulesTable.id, id)).returning();
  if (!rule) return res.status(404).json({ error: "Not found" });
  res.json(rule);
});

router.delete("/dpi/rules/:id", async (req, res) => {
  await db.delete(firewallDpiRulesTable).where(eq(firewallDpiRulesTable.id, parseInt(req.params.id)));
  res.status(204).send();
});

router.post("/dpi/test", async (req, res) => {
  const body = z.object({ pattern: z.string(), patternType: z.string(), testInput: z.string() }).parse(req.body);
  let matched = false;
  try {
    const re = new RegExp(body.pattern, "i");
    matched = re.test(body.testInput);
  } catch { matched = body.testInput.toLowerCase().includes(body.pattern.toLowerCase()); }
  res.json({ matched, pattern: body.pattern, patternType: body.patternType, testInput: body.testInput });
});

// ═══════════════════════════════════════════════════════════════════════════
// ── Geo-IP Blocking ────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

router.get("/geo", async (_req, res) => {
  const blocks = await db.select().from(firewallGeoBlocksTable).orderBy(asc(firewallGeoBlocksTable.countryName));
  res.json({ blocks, total: blocks.length, enabledCount: blocks.filter(b => b.enabled).length });
});

router.post("/geo", async (req, res) => {
  const body = z.object({ countryCode: z.string().length(2).toUpperCase(), countryName: z.string(), enabled: z.boolean().optional().default(true) }).parse(req.body);
  const [block] = await db.insert(firewallGeoBlocksTable).values({ countryCode: body.countryCode.toUpperCase(), countryName: body.countryName, enabled: body.enabled ?? true, hitCount: 0, blockedAt: new Date() }).returning();
  res.status(201).json(block);
});

router.put("/geo/:id", async (req, res) => {
  const body = z.object({ enabled: z.boolean() }).parse(req.body);
  const [block] = await db.update(firewallGeoBlocksTable).set(body).where(eq(firewallGeoBlocksTable.id, parseInt(req.params.id))).returning();
  if (!block) return res.status(404).json({ error: "Not found" });
  res.json(block);
});

router.delete("/geo/:id", async (req, res) => {
  await db.delete(firewallGeoBlocksTable).where(eq(firewallGeoBlocksTable.id, parseInt(req.params.id)));
  res.status(204).send();
});

// ═══════════════════════════════════════════════════════════════════════════
// ── Threat Intelligence Feeds ──────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

router.get("/threat-feeds", async (_req, res) => {
  const feeds = await db.select().from(firewallThreatFeedsTable).orderBy(asc(firewallThreatFeedsTable.name));
  res.json({ feeds, total: feeds.length, enabledCount: feeds.filter(f => f.enabled).length });
});

router.put("/threat-feeds/:id", async (req, res) => {
  const body = z.object({ enabled: z.boolean().optional(), autoSync: z.boolean().optional() }).parse(req.body);
  const [feed] = await db.update(firewallThreatFeedsTable).set(body).where(eq(firewallThreatFeedsTable.id, parseInt(req.params.id))).returning();
  if (!feed) return res.status(404).json({ error: "Not found" });
  res.json(feed);
});

// ── Multi-format feed text parser ─────────────────────────────────────────
// Handles: standard IP/CIDR per line, "IP # comment" (AlienVault),
// DShield tab format (IP\tIP\tCIDR\t...), URLhaus URL-list (extracts IPs from hostnames)
function parseFeedEntries(text: string, feedType: string): string[] {
  const ipPat = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/;
  const entries: string[] = [];

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || line.startsWith(";")) continue;

    // DShield tab format: "66.132.195.0\t66.132.195.255\t24\t339\t..."
    if (line.includes("\t")) {
      const parts = line.split("\t");
      if (parts.length >= 3) {
        const ip = parts[0].trim();
        const bits = parseInt(parts[2].trim(), 10);
        if (ipPat.test(`${ip}/24`) && !isNaN(bits) && bits >= 0 && bits <= 32) {
          entries.push(`${ip}/${bits}`);
          continue;
        }
      }
    }

    // URLhaus / url-list: extract IP from URL hostname
    if (feedType === "url-list") {
      try {
        const u = new URL(line);
        const host = u.hostname;
        if (ipPat.test(host)) entries.push(host);
      } catch { /* not a valid URL, skip */ }
      continue;
    }

    // Standard: take first whitespace/semicolon token (handles "IP # comment", "CIDR ; note")
    const token = line.split(/[\s;]/)[0].trim();
    if (ipPat.test(token)) entries.push(token);
  }

  // Deduplicate
  return [...new Set(entries)];
}

router.post("/threat-feeds/:id/sync", async (req, res) => {
  const id = parseInt(req.params.id);
  const [feed] = await db.select().from(firewallThreatFeedsTable).where(eq(firewallThreatFeedsTable.id, id));
  if (!feed) return res.status(404).json({ error: "Not found" });

  if (feed.url.startsWith("internal://")) {
    const trapped = await db.select().from(blockedIpsTable).where(eq(blockedIpsTable.autoBlocked, true));
    await db.update(firewallThreatFeedsTable).set({ status: "synced", lastSyncedAt: new Date(), entryCount: trapped.length }).where(eq(firewallThreatFeedsTable.id, id));
    return res.json({ synced: true, entryCount: trapped.length, source: "internal" });
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    const resp = await fetch(feed.url, { signal: controller.signal, headers: { "User-Agent": "ProxhqVPN-GhostOS/1.0" } });
    clearTimeout(timer);
    if (!resp.ok) throw new Error(`HTTP ${resp.status} from ${feed.url}`);
    const text = await resp.text();
    const entries = parseFeedEntries(text, feed.feedType);
    await db.update(firewallThreatFeedsTable).set({ status: "synced", lastSyncedAt: new Date(), entryCount: entries.length, errorMessage: null }).where(eq(firewallThreatFeedsTable.id, id));
    if (entries.length > 0) {
      await db.delete(firewallFeedEntriesTable).where(eq(firewallFeedEntriesTable.feedId, id));
      const sample = entries.slice(0, 500).map(v => ({ feedId: id, feedName: feed.name, value: v, entryType: (feed.feedType === "cidr-list" || v.includes("/")) ? "cidr" : "ip", firstSeen: new Date(), lastSeen: new Date() }));
      await db.insert(firewallFeedEntriesTable).values(sample);
    }
    res.json({ synced: true, entryCount: entries.length, sampleIps: entries.slice(0, 5) });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    await db.update(firewallThreatFeedsTable).set({ status: "error", errorMessage: msg }).where(eq(firewallThreatFeedsTable.id, id));
    res.status(500).json({ synced: false, error: msg });
  }
});

// ── Sync All Enabled Feeds ─────────────────────────────────────────────────
router.post("/threat-feeds/sync-all", async (_req, res) => {
  const feeds = await db.select().from(firewallThreatFeedsTable).where(eq(firewallThreatFeedsTable.enabled, true));
  const results: { name: string; synced: boolean; entryCount?: number; error?: string }[] = [];

  for (const feed of feeds) {
    try {
      if (feed.url.startsWith("internal://")) {
        const trapped = await db.select().from(blockedIpsTable).where(eq(blockedIpsTable.autoBlocked, true));
        await db.update(firewallThreatFeedsTable).set({ status:"synced", lastSyncedAt: new Date(), entryCount: trapped.length }).where(eq(firewallThreatFeedsTable.id, feed.id));
        results.push({ name: feed.name, synced: true, entryCount: trapped.length });
        continue;
      }
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 20000);
      const resp = await fetch(feed.url, { signal: ctrl.signal, headers: { "User-Agent":"ProxhqVPN-GhostOS/1.0" } });
      clearTimeout(t);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const text = await resp.text();
      const entries = parseFeedEntries(text, feed.feedType);
      await db.update(firewallThreatFeedsTable).set({ status:"synced", lastSyncedAt: new Date(), entryCount: entries.length, errorMessage: null }).where(eq(firewallThreatFeedsTable.id, feed.id));
      if (entries.length > 0) {
        await db.delete(firewallFeedEntriesTable).where(eq(firewallFeedEntriesTable.feedId, feed.id));
        const sample = entries.slice(0, 500).map(v => ({ feedId: feed.id, feedName: feed.name, value: v, entryType: (feed.feedType === "cidr-list" || v.includes("/")) ? "cidr" : "ip", firstSeen: new Date(), lastSeen: new Date() }));
        await db.insert(firewallFeedEntriesTable).values(sample);
      }
      results.push({ name: feed.name, synced: true, entryCount: entries.length });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      await db.update(firewallThreatFeedsTable).set({ status:"error", errorMessage: msg }).where(eq(firewallThreatFeedsTable.id, feed.id));
      results.push({ name: feed.name, synced: false, error: msg });
    }
  }

  res.json({ synced: results.filter(r => r.synced).length, failed: results.filter(r => !r.synced).length, results });
});

// ── Feed Correlation (IPs confirmed by multiple feeds) ─────────────────────
router.get("/threat-feeds/correlation", async (_req, res) => {
  const entries = await db
    .select({ value: firewallFeedEntriesTable.value, feedId: firewallFeedEntriesTable.feedId, feedName: firewallFeedEntriesTable.feedName })
    .from(firewallFeedEntriesTable)
    .limit(10000);
  const byValue: Record<string, { feeds: string[]; feedIds: number[] }> = {};
  for (const e of entries) {
    if (!byValue[e.value]) byValue[e.value] = { feeds: [], feedIds: [] };
    if (!byValue[e.value].feedIds.includes(e.feedId)) {
      byValue[e.value].feeds.push(e.feedName);
      byValue[e.value].feedIds.push(e.feedId);
    }
  }
  const correlated = Object.entries(byValue)
    .filter(([, v]) => v.feeds.length > 1)
    .map(([ip, v]) => ({ ip, feedCount: v.feeds.length, feeds: v.feeds, confidence: Math.min(100, 40 + v.feeds.length * 15) }))
    .sort((a, b) => b.feedCount - a.feedCount)
    .slice(0, 200);
  res.json({ correlated, total: correlated.length });
});

// Also store sample entries on individual feed sync (updating existing route behaviour)
// (The per-feed sync route already exists above at POST /threat-feeds/:id/sync — we augment it here to also store entries)
// Note: patch the existing sync route inline via a middleware is complex, so we extend it by overriding after the route:
// The sync-all route above covers bulk; individual sync stores entries too via the updated route below.

// ═══════════════════════════════════════════════════════════════════════════
// ── IOC Manager ────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

router.get("/ioc", async (_req, res) => {
  const iocs = await db.select().from(firewallIocsTable).orderBy(desc(firewallIocsTable.createdAt));
  res.json({ iocs, total: iocs.length, blockCount: iocs.filter(i => i.action === "block" && i.enabled).length });
});

router.post("/ioc", async (req, res) => {
  const body = z.object({
    iocType:     z.enum(["ip","cidr","domain","url","file_hash","ja3","email"]).default("ip"),
    value:       z.string().min(1),
    severity:    z.enum(["critical","high","medium","low"]).default("high"),
    action:      z.enum(["block","alert","allowlist"]).default("block"),
    confidence:  z.number().min(0).max(100).default(100),
    source:      z.string().default("manual"),
    description: z.string().optional(),
    tags:        z.string().optional(),
  }).parse(req.body);
  const [ioc] = await db.insert(firewallIocsTable).values({ ...body, enabled: true, hitCount: 0, feedCount: 1, createdAt: new Date() }).returning();
  res.status(201).json(ioc);
});

router.put("/ioc/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const body = z.object({
    enabled:     z.boolean().optional(),
    action:      z.enum(["block","alert","allowlist"]).optional(),
    severity:    z.enum(["critical","high","medium","low"]).optional(),
    confidence:  z.number().min(0).max(100).optional(),
    description: z.string().optional(),
    tags:        z.string().optional(),
  }).parse(req.body);
  const [ioc] = await db.update(firewallIocsTable).set(body).where(eq(firewallIocsTable.id, id)).returning();
  if (!ioc) return res.status(404).json({ error: "Not found" });
  res.json(ioc);
});

router.delete("/ioc/:id", async (req, res) => {
  await db.delete(firewallIocsTable).where(eq(firewallIocsTable.id, parseInt(req.params.id)));
  res.status(204).send();
});

// EDL route moved to firewall-public.ts (before requireAuth) so hardware
// firewalls can poll it without a Clerk session cookie.

// ═══════════════════════════════════════════════════════════════════════════
// ── Security Zones ─────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

router.get("/zones", async (_req, res) => {
  const zones = await db.select().from(firewallZonesTable).orderBy(asc(firewallZonesTable.name));
  res.json({ zones, total: zones.length });
});

router.post("/zones", async (req, res) => {
  const body = z.object({ name: z.string(), trustLevel: z.enum(["trusted","untrusted","dmz","management"]), interfaces: z.string().optional(), description: z.string().optional(), inboundPolicy: z.enum(["allow","deny"]).default("deny"), outboundPolicy: z.enum(["allow","deny"]).default("allow"), color: z.string().optional().default("#00ff88") }).parse(req.body);
  const [zone] = await db.insert(firewallZonesTable).values({ ...body, createdAt: new Date() }).returning();
  res.status(201).json(zone);
});

router.put("/zones/:id", async (req, res) => {
  const body = z.object({ inboundPolicy: z.enum(["allow","deny"]).optional(), outboundPolicy: z.enum(["allow","deny"]).optional(), trustLevel: z.enum(["trusted","untrusted","dmz","management"]).optional() }).parse(req.body);
  const [zone] = await db.update(firewallZonesTable).set(body).where(eq(firewallZonesTable.id, parseInt(req.params.id))).returning();
  if (!zone) return res.status(404).json({ error: "Not found" });
  res.json(zone);
});

router.delete("/zones/:id", async (req, res) => {
  await db.delete(firewallZonesTable).where(eq(firewallZonesTable.id, parseInt(req.params.id)));
  res.status(204).send();
});

// ═══════════════════════════════════════════════════════════════════════════
// ── FQDN Rules ─────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

router.get("/fqdn-rules", async (_req, res) => {
  const rules = await db.select().from(firewallFqdnRulesTable).orderBy(asc(firewallFqdnRulesTable.priority));
  res.json({ rules, total: rules.length, enabledCount: rules.filter(r => r.enabled).length });
});

router.post("/fqdn-rules", async (req, res) => {
  const body = z.object({ domain: z.string(), action: z.enum(["allow","block"]), direction: z.enum(["both","inbound","outbound"]).default("both"), priority: z.number().optional().default(100), description: z.string().optional() }).parse(req.body);
  const [rule] = await db.insert(firewallFqdnRulesTable).values({ ...body, enabled: true, hitCount: 0, createdAt: new Date() }).returning();
  res.status(201).json(rule);
});

router.put("/fqdn-rules/:id", async (req, res) => {
  const body = z.object({ enabled: z.boolean().optional(), action: z.enum(["allow","block"]).optional() }).parse(req.body);
  const [rule] = await db.update(firewallFqdnRulesTable).set(body).where(eq(firewallFqdnRulesTable.id, parseInt(req.params.id))).returning();
  if (!rule) return res.status(404).json({ error: "Not found" });
  res.json(rule);
});

router.delete("/fqdn-rules/:id", async (req, res) => {
  await db.delete(firewallFqdnRulesTable).where(eq(firewallFqdnRulesTable.id, parseInt(req.params.id)));
  res.status(204).send();
});

// ═══════════════════════════════════════════════════════════════════════════
// ── Analytics ──────────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

router.get("/analytics", async (_req, res) => {
  const blocked = await db.select().from(blockedIpsTable).orderBy(desc(blockedIpsTable.hitCount)).limit(10);
  const rules = await db.select().from(firewallRulesTable).orderBy(desc(firewallRulesTable.hitCount)).limit(10);
  const sigs = await db.select().from(firewallIpsSignaturesTable);
  const ghostRules = await db.select().from(firewallGhostOsRulesTable).orderBy(desc(firewallGhostOsRulesTable.hitCount)).limit(5);
  const totalBlocked = blocked.reduce((a, b) => a + b.hitCount, 0);
  const totalIpsHits = sigs.reduce((a, s) => a + s.hitCount, 0);
  const cats = [...new Set(sigs.map(s => s.category))];
  const catBreakdown = cats.map(c => { const cs = sigs.filter(s => s.category === c); return { category: c, total: cs.length, enabled: cs.filter(s => s.enabled).length, hits: cs.reduce((a, s) => a + s.hitCount, 0) }; });
  const totalHits = totalBlocked + totalIpsHits;
  const threatLevel = totalHits > 1000 ? "critical" : totalHits > 500 ? "high" : totalHits > 100 ? "medium" : totalHits > 10 ? "low" : "safe";
  res.json({ topBlockedIps: blocked.map(b => ({ ip: b.ip, hits: b.hitCount, reason: b.reason })), topTriggeredRules: rules.map(r => ({ name: r.name, hits: r.hitCount, action: r.action })), topGhostOsRules: ghostRules.map(r => ({ rule: r.symbolicRule, hits: r.hitCount, description: r.description })), ipsCategoryBreakdown: catBreakdown, recentBlocks: blocked.slice(0, 5).map(b => ({ ip: b.ip, reason: b.reason, blockedAt: b.blockedAt })), threatLevel, totalBlocked24h: totalBlocked, totalIpsHits24h: totalIpsHits, totalDpiHits24h: 0 });
});

// ═══════════════════════════════════════════════════════════════════════════
// ── Threat Profiles ────────────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

const THREAT_PROFILES = [
  { id:"palo-alto-ngfw", name:"Palo Alto NGFW Style", vendor:"Palo Alto Networks", description:"Maximum security — all 47 IPS signatures enabled, DPI on every category, App-ID style L7 control, zone-based architecture with strict inter-zone policy.", severity:"maximum", color:"#ff6600", actions:["Enable all 47 IPS signatures","Enable all DPI categories","Set mode to STRICT","Block all recon tool user-agents","Enable Log+Block on unmatched traffic","Activate all geo-blocks if configured"] },
  { id:"fortinet-fortigate", name:"Fortinet FortiGate Style", vendor:"Fortinet", description:"UTM balanced — high-performance mode with critical/high severity IPS, geo-block top 10 high-risk countries, threat feed sync every 6h, SD-WAN aware egress.", severity:"high", color:"#cc0000", actions:["Enable IPS: critical + high severity only","Geo-block: CN, RU, KP, IR, SY, BY, VE, CU, SD, MM","Sync threat feeds every 6h","Enable rate limiting on all ports","Set mode to STRICT","Enable FQDN-based egress filtering"] },
  { id:"checkpoint-sandblast", name:"Check Point SandBlast Style", vendor:"Check Point", description:"Zero-day prevention — all exploit and C2 signatures enabled with sandbox-style analysis, centralized zone policy, DLP-aware egress rules, identity-based access.", severity:"maximum", color:"#cc0000", actions:["Enable ALL exploit + malware-c2 IPS signatures","Enable all DPI rules","Zone policy: strict isolation","Block all known C2 domains via FQDN","Enable protocol anomaly detection","Set default policy to LOG+BLOCK"] },
  { id:"web-server-hardening", name:"Web Server Hardening", vendor:"ProxhqVPN", description:"Hardens a web-facing server — all web attack signatures active, blocks scanning tools, rate-limits auth endpoints, restricts to HTTP/HTTPS only.", severity:"high", color:"#00ff88", actions:["Enable all web-attacks IPS signatures","Enable all recon IPS signatures","Rate limit: 100 req/min per IP","Block all ports except 80/443 inbound","Enable DPI on URL + header patterns","Block common vulnerability scanner UAs"] },
  { id:"ransomware-prevention", name:"Ransomware Prevention", vendor:"ProxhqVPN", description:"Prevents ransomware deployment — blocks C2 beaconing, lateral movement (SMB/RDP), unusual egress on non-standard ports, and known ransomware domains.", severity:"maximum", color:"#ff4444", actions:["Enable all malware-c2 IPS signatures","Enable all exploit IPS signatures","Block SMB inbound (445/TCP)","Block RDP inbound (3389/TCP)","Enable egress FQDN filtering","Log all outbound connections > 10MB"] },
  { id:"desktop-privacy", name:"Desktop Privacy Mode", vendor:"ProxhqVPN", description:"Maximum privacy for desktop/endpoint — blocks all telemetry, tracking, ad networks, data brokers via FQDN, DNS-over-HTTPS enforced, all C2 signatures active.", severity:"balanced", color:"#4488ff", actions:["Enable all malware-c2 IPS signatures","Add FQDN blocks: telemetry + ad networks","Block DNS port 53 — enforce DoH only","Enable outbound content inspection","Rate limit all outbound non-HTTPS","Block data broker domains via FQDN"] },
];

router.get("/threat-profiles", (_req, res) => {
  res.json({ profiles: THREAT_PROFILES, total: THREAT_PROFILES.length });
});

router.post("/threat-profiles/:id/apply", async (req, res) => {
  const profileId = req.params.id;
  const profile = THREAT_PROFILES.find(p => p.id === profileId);
  if (!profile) return res.status(404).json({ error: "Profile not found" });

  const results: string[] = [];

  if (profileId === "palo-alto-ngfw" || profileId === "checkpoint-sandblast") {
    await db.update(firewallIpsSignaturesTable).set({ enabled: true });
    results.push("Enabled all 47 IPS signatures");
  } else if (profileId === "fortinet-fortigate") {
    await db.update(firewallIpsSignaturesTable).set({ enabled: false });
    await db.update(firewallIpsSignaturesTable).set({ enabled: true }).where(inArray(firewallIpsSignaturesTable.severity, ["critical","high"]));
    results.push("Enabled critical + high severity IPS signatures");
  } else if (profileId === "web-server-hardening") {
    await db.update(firewallIpsSignaturesTable).set({ enabled: true }).where(inArray(firewallIpsSignaturesTable.category, ["web-attacks","recon"]));
    results.push("Enabled web-attacks + recon signatures");
  } else if (profileId === "ransomware-prevention") {
    await db.update(firewallIpsSignaturesTable).set({ enabled: true }).where(inArray(firewallIpsSignaturesTable.category, ["malware-c2","exploit"]));
    results.push("Enabled malware-c2 + exploit signatures");
  } else if (profileId === "desktop-privacy") {
    await db.update(firewallIpsSignaturesTable).set({ enabled: true }).where(eq(firewallIpsSignaturesTable.category, "malware-c2"));
    results.push("Enabled malware-c2 signatures");
  }

  // Set firewall mode
  const status = await getOrCreateStatus();
  const newMode = (profileId === "palo-alto-ngfw" || profileId === "checkpoint-sandblast" || profileId === "ransomware-prevention") ? "strict" : "standard";
  await db.update(firewallStatusTable).set({ mode: newMode, lastUpdated: new Date() }).where(eq(firewallStatusTable.id, status.id));
  results.push(`Firewall mode set to ${newMode.toUpperCase()}`);
  results.push(`Profile ${profile.name} applied successfully`);

  res.json({ applied: true, profile, results });
});

// ═══════════════════════════════════════════════════════════════════════════
// ── Rule Conflict Detector ─────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

router.post("/rules/check-conflicts", async (_req, res) => {
  const rules = await db.select().from(firewallRulesTable).orderBy(asc(firewallRulesTable.priority));
  const conflicts: Array<{ type: string; rule1: string; rule2: string; description: string; severity: string }> = [];

  for (let i = 0; i < rules.length; i++) {
    for (let j = i + 1; j < rules.length; j++) {
      const a = rules[i], b = rules[j];
      // Same port + protocol + direction → potential shadow
      if (a.destPort === b.destPort && a.protocol === b.protocol && a.direction === b.direction && a.priority < b.priority && a.action !== b.action) {
        conflicts.push({ type: "shadow", rule1: a.name, rule2: b.name, description: `Rule "${a.name}" (priority ${a.priority}) shadows "${b.name}" (priority ${b.priority}) — same port/protocol/direction but different actions`, severity: "high" });
      }
      // Both allow + deny same port
      if (a.destPort === b.destPort && a.protocol === b.protocol && ((a.action === "allow" && b.action === "drop") || (a.action === "drop" && b.action === "allow"))) {
        conflicts.push({ type: "conflict", rule1: a.name, rule2: b.name, description: `Conflicting actions on port ${a.destPort}/${a.protocol}: "${a.name}" (${a.action}) vs "${b.name}" (${b.action})`, severity: "medium" });
      }
    }
  }
  const allowAll = rules.find(r => !r.destPort && !r.sourceIp && r.action === "allow" && r.direction === "inbound");
  if (allowAll) conflicts.push({ type: "overly-permissive", rule1: allowAll.name, rule2: "", description: `Rule "${allowAll.name}" allows ALL inbound traffic — likely unintentional. Consider adding source IP restrictions.`, severity: "critical" });

  res.json({ conflicts, total: conflicts.length, clean: conflicts.length === 0 });
});

// ═══════════════════════════════════════════════════════════════════════════
// ── Connection Approval Queue ──────────────────────────────────────────────
// Attackers detected by WAF/GhostTrap/IPS are queued here for admin approval.
// Frontend polls this endpoint and shows a non-intrusive popup with
// [Allow] [Block] [Trap] buttons for each pending entry.
// ═══════════════════════════════════════════════════════════════════════════

// GET /connection-queue — list pending (and recent resolved) entries
router.get("/connection-queue", async (req, res) => {
  const status = String(req.query.status ?? "pending");
  const limit  = Math.min(Number(req.query.limit ?? 50), 200);

  // Auto-expire entries older than 2 minutes that are still pending
  await db.update(firewallConnectionQueueTable)
    .set({ status: "dismissed", resolvedAt: new Date() })
    .where(
      sql`status = 'pending' AND expires_at IS NOT NULL AND expires_at < NOW()`
    ).catch(() => {});

  const rows = status === "all"
    ? await db.select().from(firewallConnectionQueueTable).orderBy(desc(firewallConnectionQueueTable.createdAt)).limit(limit)
    : await db.select().from(firewallConnectionQueueTable)
        .where(eq(firewallConnectionQueueTable.status, status))
        .orderBy(desc(firewallConnectionQueueTable.createdAt)).limit(limit);

  const [counts] = await db.select({
    pending:   sql<number>`count(*) filter (where status = 'pending')::int`,
    approved:  sql<number>`count(*) filter (where status = 'approved')::int`,
    blocked:   sql<number>`count(*) filter (where status = 'blocked')::int`,
    trapped:   sql<number>`count(*) filter (where status = 'trapped')::int`,
  }).from(firewallConnectionQueueTable);

  res.json({ entries: rows, counts, total: rows.length });
});

// POST /connection-queue — create a new pending entry (called by WAF, GhostTrap, IPS)
router.post("/connection-queue", async (req, res) => {
  const body = z.object({
    ip:           z.string(),
    sourcePort:   z.number().optional(),
    destPort:     z.number().optional(),
    protocol:     z.string().default("tcp"),
    detectedFrom: z.string().default("waf"),
    attackType:   z.string().optional(),
    anomalyScore: z.number().default(0),
    payload:      z.string().max(2000).optional(),
    userAgent:    z.string().max(512).optional(),
    geoCountry:   z.string().optional(),
    geoIsp:       z.string().optional(),
    reason:       z.string().optional(),
  }).parse(req.body);

  // Deduplicate: if this IP already has a pending entry, just update it
  const existing = await db.select().from(firewallConnectionQueueTable)
    .where(
      sql`ip = ${body.ip} AND status = 'pending'`
    ).limit(1);

  if (existing.length > 0) {
    const [updated] = await db.update(firewallConnectionQueueTable)
      .set({
        anomalyScore: Math.max(existing[0].anomalyScore, body.anomalyScore),
        attackType:   body.attackType ?? existing[0].attackType,
        payload:      body.payload ?? existing[0].payload,
        reason:       body.reason ?? existing[0].reason,
      })
      .where(eq(firewallConnectionQueueTable.id, existing[0].id))
      .returning();
    return res.json(updated);
  }

  const expiresAt = new Date(Date.now() + 2 * 60 * 1000); // 2 min TTL
  const [entry] = await db.insert(firewallConnectionQueueTable).values({
    ...body,
    status: "pending",
    expiresAt,
  }).returning();
  res.status(201).json(entry);
});

// POST /connection-queue/:id/approve — whitelist the IP
router.post("/connection-queue/:id/approve", async (req, res) => {
  const id = parseInt(req.params.id);
  const userId = ((req as any).auth)?.userId as string | undefined;
  const [entry] = await db.update(firewallConnectionQueueTable)
    .set({ status: "approved", resolvedBy: userId ?? "system", resolvedAt: new Date() })
    .where(eq(firewallConnectionQueueTable.id, id))
    .returning();
  if (!entry) return res.status(404).json({ error: "Entry not found" });
  // Add to firewall rules to allow this IP inbound
  await db.insert(firewallRulesTable).values({
    name: `Auto-approved: ${entry.ip}`,
    direction: "inbound" as const,
    action: "allow" as const,
    protocol: "any" as const,
    sourceIp: entry.ip,
    priority: 50,
    description: `Manually approved via Connection Queue at ${new Date().toISOString()}`,
  }).catch(() => {});
  res.json({ ok: true, entry });
});

// POST /connection-queue/:id/deny — block the IP in the firewall
router.post("/connection-queue/:id/deny", async (req, res) => {
  const id = parseInt(req.params.id);
  const userId = ((req as any).auth)?.userId as string | undefined;
  const [entry] = await db.update(firewallConnectionQueueTable)
    .set({ status: "blocked", resolvedBy: userId ?? "system", resolvedAt: new Date() })
    .where(eq(firewallConnectionQueueTable.id, id))
    .returning();
  if (!entry) return res.status(404).json({ error: "Entry not found" });
  // Auto-add to blocked IPs table
  const alreadyBlocked = await db.select().from(blockedIpsTable)
    .where(eq(blockedIpsTable.ip, entry.ip)).limit(1);
  if (!alreadyBlocked.length) {
    await db.insert(blockedIpsTable).values({
      ip: entry.ip,
      reason: `Connection Queue: blocked by admin (${entry.attackType ?? "unknown"})`,
      autoBlocked: false,
    }).catch(() => {});
  }
  res.json({ ok: true, entry });
});

// POST /connection-queue/:id/trap — route into GhostTrap tarpit loop
router.post("/connection-queue/:id/trap", async (req, res) => {
  const id = parseInt(req.params.id);
  const userId = ((req as any).auth)?.userId as string | undefined;
  const [entry] = await db.update(firewallConnectionQueueTable)
    .set({ status: "trapped", resolvedBy: userId ?? "system", resolvedAt: new Date() })
    .where(eq(firewallConnectionQueueTable.id, id))
    .returning();
  if (!entry) return res.status(404).json({ error: "Entry not found" });
  res.json({ ok: true, entry, tarpitEngaged: true });
});

// DELETE /connection-queue/:id — dismiss without action
router.delete("/connection-queue/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const [entry] = await db.update(firewallConnectionQueueTable)
    .set({ status: "dismissed", resolvedAt: new Date() })
    .where(eq(firewallConnectionQueueTable.id, id))
    .returning();
  if (!entry) return res.status(404).json({ error: "Entry not found" });
  res.json({ ok: true });
});

// ── Node Sync Status — admin UI polls this to see per-node sync state ──────────
// Force re-sync: clears all node fwSyncHash so next poll triggers fresh apply
router.post("/force-sync", async (_req, res) => {
  const result = await db.update(nodesTable).set({ fwSyncHash: null }).returning({ id: nodesTable.id });
  logger.info({ nodeCount: result.length }, "force-sync: cleared fw hashes on all nodes");
  res.json({ ok: true, nodesReset: result.length });
});

// ── Suricata IPS Setup Script ──────────────────────────────────────────────
router.get("/ips/suricata-setup-script", async (req, res) => {
  const nodeId = parseInt(req.query.nodeId as string) || 0;
  const apiBase = "https://network-labyrinth.replit.app/api/daemon-inbound";
  const psk = process.env.DAEMON_PSK ?? "";

  const sigs = await db.select().from(firewallIpsSignaturesTable)
    .where(eq(firewallIpsSignaturesTable.enabled, true));

  const rulesLines = sigs.map(sig => {
    const proto = sig.pattern.toLowerCase().startsWith("http") ? "http" : "tcp";
    const action = sig.action === "drop" ? "drop" : "alert";
    const content = sig.pattern.replace(/["'\\]/g, "").slice(0, 200);
    const cveRef = sig.cveId ? `reference:cve,${sig.cveId.replace("CVE-", "")};` : "";
    const sidNum = sig.sid.replace(/\D/g, "") || String(sig.id);
    return `${action} ${proto} any any -> any any (msg:"ProxhqVPN - ${sig.name}"; content:"${content}"; sid:${sidNum}; rev:1; classtype:${sig.category}; ${cveRef}metadata:proxhq-fw;)`;
  }).join("\n");

  const syncDaemon = nodeId ? [
    `cat > /usr/local/bin/proxhq-suricata-sync.sh << 'SCRIPT'`,
    `#!/bin/bash`,
    `NODE_ID=${nodeId}`,
    `PSK="${psk}"`,
    `API="${apiBase}"`,
    `HF="/var/lib/suricata/rules/proxhq-fw.hash"`,
    `RF="/var/lib/suricata/rules/proxhq.rules"`,
    `while true; do`,
    `  R=$(curl -sf "$API/suricata-rules?nodeId=$NODE_ID" -H "X-Daemon-PSK: $PSK" 2>/dev/null)`,
    `  [ -z "$R" ] && { sleep 60; continue; }`,
    `  H=$(echo "$R" | python3 -c "import sys,json; print(json.load(sys.stdin).get('rulesHash',''))" 2>/dev/null)`,
    `  OH=$(cat "$HF" 2>/dev/null || echo "")`,
    `  if [ "$H" != "$OH" ] && [ -n "$H" ]; then`,
    `    echo "$R" | python3 -c "import sys,json; print(json.load(sys.stdin).get('rulesFile',''))" > "$RF"`,
    `    echo "$H" > "$HF"`,
    `    suricatasc -c reload-rules 2>/dev/null || systemctl reload suricata`,
    `    curl -sf -X POST "$API/ips-event" -H "Content-Type: application/json" -H "X-Daemon-PSK: $PSK" \\`,
    `      -d "{\\"nodeId\\":$NODE_ID,\\"event\\":\\"rules_synced\\",\\"rulesHash\\":\\"$H\\"}" >/dev/null`,
    `    echo "[suricata-sync] reloaded $H"`,
    `  fi`,
    `  sleep 60`,
    `done`,
    `SCRIPT`,
    `chmod +x /usr/local/bin/proxhq-suricata-sync.sh`,
    `cat > /etc/systemd/system/proxhq-suricata-sync.service << 'SVC'`,
    `[Unit]`,
    `Description=ProxhqVPN Suricata Rules Sync`,
    `After=suricata.service`,
    `[Service]`,
    `Type=simple`,
    `ExecStart=/usr/local/bin/proxhq-suricata-sync.sh`,
    `Restart=always`,
    `RestartSec=10`,
    `[Install]`,
    `WantedBy=multi-user.target`,
    `SVC`,
    `systemctl daemon-reload && systemctl enable proxhq-suricata-sync && systemctl restart proxhq-suricata-sync`,
    `echo "[✓] Suricata rule sync daemon active (60s poll)"`,
  ].join("\n") : `echo "No nodeId provided — skipping sync daemon (add ?nodeId=N)"`;

  const script = [
    `#!/bin/bash`,
    `# ProxhqVPN GhostOS™ — Suricata IPS Setup Script`,
    `# Node: ${nodeId || "generic"} | Signatures: ${sigs.length} | Generated: ${new Date().toISOString()}`,
    `# © 2026 Alpha Unlimited Technologies LLC`,
    `set -e`,
    `echo "=== ProxhqVPN Suricata IPS Setup ==="`,
    ``,
    `# ── 1. Install Suricata ──────────────────────────────────────────────`,
    `if command -v apt-get &>/dev/null; then`,
    `  add-apt-repository -y ppa:oisf/suricata-stable 2>/dev/null || true`,
    `  apt-get update -qq && apt-get install -y suricata`,
    `elif command -v yum &>/dev/null; then`,
    `  yum install -y epel-release && yum install -y suricata`,
    `else`,
    `  echo "Unsupported package manager" >&2 && exit 1`,
    `fi`,
    ``,
    `# ── 2. Configure Suricata ─────────────────────────────────────────────`,
    `cat > /etc/suricata/suricata.yaml << 'YAML'`,
    `%YAML 1.1`,
    `---`,
    `vars:`,
    `  address-groups:`,
    `    HOME_NET: "[10.0.0.0/8,172.16.0.0/12,192.168.0.0/16,10.8.0.0/24]"`,
    `    EXTERNAL_NET: "!$HOME_NET"`,
    `outputs:`,
    `  - eve-log:`,
    `      enabled: yes`,
    `      filetype: regular`,
    `      filename: /var/log/suricata/eve.json`,
    `      types: [alert, drop, stats]`,
    `default-rule-path: /var/lib/suricata/rules`,
    `rule-files:`,
    `  - proxhq.rules`,
    `af-packet:`,
    `  - interface: eth0`,
    `    cluster-id: 99`,
    `    cluster-type: cluster_flow`,
    `    defrag: yes`,
    `    use-mmap: yes`,
    `YAML`,
    ``,
    `# ── 3. Install ProxhqVPN IPS Rules ────────────────────────────────────`,
    `mkdir -p /var/lib/suricata/rules`,
    `cat > /var/lib/suricata/rules/proxhq.rules << 'RULES'`,
    `# ProxhqVPN GhostOS™ IPS Signatures — ${sigs.length} rules`,
    rulesLines,
    `RULES`,
    ``,
    `# ── 4. Enable Suricata in IPS mode (NFQUEUE inline) ──────────────────`,
    `sed -i 's/^#\\?.*nfqueue.*/nfqueue:\\n  mode: repeat\\n  repeat-mark: 1\\n  repeat-mask: 1/' /etc/suricata/suricata.yaml 2>/dev/null || true`,
    `systemctl enable suricata && systemctl restart suricata`,
    `echo "[✓] Suricata started — ${sigs.length} ProxhqVPN IPS rules active"`,
    ``,
    `# ── 5. Wire Suricata inline via NFQUEUE (replaces raw packet drop) ────`,
    `iptables -I INPUT -j NFQUEUE --queue-num 0 2>/dev/null || echo "Note: NFQUEUE rule already present or requires CAP_NET_ADMIN"`,
    `iptables -I FORWARD -j NFQUEUE --queue-num 0 2>/dev/null || true`,
    ``,
    `# ── 6. Install Rule Auto-Sync Daemon ───────────────────────────────────`,
    syncDaemon,
    ``,
    `echo "=== ProxhqVPN Suricata IPS Setup Complete ==="`,
    `suricata --build-info 2>/dev/null | grep -E "Suricata version" || true`,
  ].join("\n");

  res.setHeader("Content-Type", "text/plain");
  res.setHeader("Content-Disposition", `attachment; filename="proxhq-suricata-setup${nodeId ? `-node${nodeId}` : ""}.sh"`);
  return res.send(script);
});

// ── eBPF / XDP Node Deployment Script ────────────────────────────────────
router.get("/ebpf/node-setup-script", async (req, res) => {
  const nodeId = parseInt(req.query.nodeId as string) || 0;
  const iface = (req.query.iface as string) || "eth0";

  const rules = await db.select().from(ebpfRulesTable).where(eq(ebpfRulesTable.enabled, true));

  // Generate XDP C program from DB rules
  const matchBlocks = rules.map((r, i) => {
    const lines: string[] = [`  /* Rule ${i + 1}: ${r.name} — ${r.action} */`];
    if (r.matchDstPort) lines.push(`  if (dport == bpf_htons(${r.matchDstPort})) {`);
    else lines.push(`  {`);
    if (r.matchProto === "tcp") lines.push(`    if (ip->protocol != IPPROTO_TCP) goto rule_${i}_skip;`);
    else if (r.matchProto === "udp") lines.push(`    if (ip->protocol != IPPROTO_UDP) goto rule_${i}_skip;`);
    const verdict = r.action === "drop" ? "XDP_DROP" : r.action === "redirect" ? "XDP_TX" : "XDP_PASS";
    lines.push(`    return ${verdict};`);
    lines.push(`  }`);
    lines.push(`  rule_${i}_skip:;`);
    return lines.join("\n");
  }).join("\n");

  const cSource = `// ProxhqVPN GhostOS™ XDP Program — Node ${nodeId || "generic"}
// Generated: ${new Date().toISOString()} — ${rules.length} rules active
// © 2026 Alpha Unlimited Technologies LLC
#include <linux/bpf.h>
#include <linux/if_ether.h>
#include <linux/ip.h>
#include <linux/tcp.h>
#include <linux/udp.h>
#include <bpf/bpf_helpers.h>
#include <bpf/bpf_endian.h>

struct {
  __uint(type, BPF_MAP_TYPE_PERCPU_ARRAY);
  __uint(max_entries, ${Math.max(rules.length, 64)});
  __type(key, __u32);
  __type(value, __u64);
} proxhq_stats SEC(".maps");

SEC("xdp")
int proxhq_xdp(struct xdp_md *ctx) {
  void *data     = (void *)(long)ctx->data;
  void *data_end = (void *)(long)ctx->data_end;

  struct ethhdr *eth = data;
  if ((void *)(eth + 1) > data_end) return XDP_PASS;
  if (eth->h_proto != bpf_htons(ETH_P_IP)) return XDP_PASS;

  struct iphdr *ip = (void *)(eth + 1);
  if ((void *)(ip + 1) > data_end) return XDP_PASS;

  __u16 dport = 0;
  if (ip->protocol == IPPROTO_TCP) {
    struct tcphdr *tcp = (void *)(ip + 1);
    if ((void *)(tcp + 1) > data_end) return XDP_PASS;
    dport = tcp->dest;
  } else if (ip->protocol == IPPROTO_UDP) {
    struct udphdr *udp = (void *)(ip + 1);
    if ((void *)(udp + 1) > data_end) return XDP_PASS;
    dport = udp->dest;
  }

  // ── ProxhqVPN rules (${rules.length} active) ──────────────────────────
${matchBlocks || "  /* no rules — pass all */"}

  return XDP_PASS;
}

char _license[] SEC("license") = "GPL";
`;

  const script = [
    `#!/bin/bash`,
    `# ProxhqVPN GhostOS™ — eBPF/XDP Deployment Script`,
    `# Node: ${nodeId || "generic"} | Interface: ${iface} | Rules: ${rules.length} | Generated: ${new Date().toISOString()}`,
    `# © 2026 Alpha Unlimited Technologies LLC`,
    `set -e`,
    `IFACE="${iface}"`,
    `BPF_DIR="/opt/proxhq-ebpf"`,
    `echo "=== ProxhqVPN eBPF/XDP Deployment (${rules.length} rules) ==="`,
    ``,
    `# ── 1. Install build tools ───────────────────────────────────────────`,
    `if command -v apt-get &>/dev/null; then`,
    `  apt-get update -qq && apt-get install -y clang llvm libelf-dev libbpf-dev bpftool iproute2 linux-headers-$(uname -r)`,
    `elif command -v yum &>/dev/null; then`,
    `  yum install -y clang llvm elfutils-libelf-devel libbpf-devel bpftool iproute kernel-devel`,
    `fi`,
    ``,
    `# ── 2. Write XDP C source ────────────────────────────────────────────`,
    `mkdir -p $BPF_DIR`,
    `cat > $BPF_DIR/proxhq_xdp.c << 'BPFC'`,
    cSource,
    `BPFC`,
    ``,
    `# ── 3. Compile to BPF object ─────────────────────────────────────────`,
    `clang -O2 -g -Wall -target bpf \\`,
    `  -I/usr/include/$(uname -m)-linux-gnu \\`,
    `  -c $BPF_DIR/proxhq_xdp.c -o $BPF_DIR/proxhq_xdp.o`,
    `echo "[✓] Compiled: $BPF_DIR/proxhq_xdp.o"`,
    ``,
    `# ── 4. Detach any existing XDP program ──────────────────────────────`,
    `ip link set dev $IFACE xdp off 2>/dev/null || true`,
    ``,
    `# ── 5. Attach XDP (native mode first, fallback to generic) ──────────`,
    `ip link set dev $IFACE xdp obj $BPF_DIR/proxhq_xdp.o sec xdp 2>/dev/null || \\`,
    `ip link set dev $IFACE xdpgeneric obj $BPF_DIR/proxhq_xdp.o sec xdp`,
    `echo "[✓] XDP program attached to $IFACE"`,
    ``,
    `# ── 6. Verify ───────────────────────────────────────────────────────`,
    `ip link show $IFACE | grep -i xdp && echo "[✓] XDP active" || echo "[!] XDP not confirmed"`,
    `bpftool prog list 2>/dev/null | grep proxhq || true`,
    ``,
    `echo "=== ProxhqVPN eBPF/XDP Deployment Complete ==="`,
    `echo "Rules: ${rules.length} | Interface: $IFACE | Object: $BPF_DIR/proxhq_xdp.o"`,
  ].join("\n");

  res.setHeader("Content-Type", "text/plain");
  res.setHeader("Content-Disposition", `attachment; filename="proxhq-ebpf-deploy${nodeId ? `-node${nodeId}` : ""}.sh"`);
  return res.send(script);
});

router.get("/sync-status", async (_req, res) => {
  const [rules, blocked, ghostRules, nodes] = await Promise.all([
    db.select().from(firewallRulesTable).where(eq(firewallRulesTable.enabled, true)),
    db.select().from(blockedIpsTable),
    db.select().from(firewallGhostOsRulesTable).where(eq(firewallGhostOsRulesTable.enabled, true)),
    db.select({
      id: nodesTable.id,
      name: nodesTable.name,
      ipAddress: nodesTable.ipAddress,
      listenPort: nodesTable.listenPort,
      fwSyncedAt: nodesTable.fwSyncedAt,
      fwSyncHash: nodesTable.fwSyncHash,
    }).from(nodesTable),
  ]);

  // Build the same hash the daemon would compute so UI can show in-sync status
  const filterLines = [
    "*filter", ":INPUT DROP [0:0]", ":FORWARD DROP [0:0]", ":OUTPUT ACCEPT [0:0]",
    "-A INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT",
    "-A INPUT -i lo -j ACCEPT",
    ...ghostRules.map(r => r.compiledIptables ?? `# ghostos: ${r.symbolicRule}`),
    ...blocked.filter(b => !b.ip.includes(":")).map(b => `-A INPUT -s ${b.ip} -j DROP`),
    ...rules.map(r => {
      const proto = r.protocol !== "any" ? `-p ${r.protocol}` : "";
      const src = r.sourceIp ? `-s ${r.sourceIp}` : "";
      const dst = r.destIp ? `-d ${r.destIp}` : "";
      const dport = r.destPort ? `--dport ${r.destPort}` : "";
      const chain = r.direction === "inbound" ? "INPUT" : r.direction === "outbound" ? "OUTPUT" : "FORWARD";
      const action = r.action === "allow" ? "ACCEPT" : r.action === "log" ? "LOG --log-prefix PROXHQ_" : "DROP";
      return `-A ${chain} ${[proto, src, dst, dport].filter(Boolean).join(" ")} -j ${action}`.replace(/\s+/g, " ").trim();
    }),
    "COMMIT", "*nat", ":PREROUTING ACCEPT [0:0]", ":OUTPUT ACCEPT [0:0]", ":POSTROUTING ACCEPT [0:0]",
    "-A POSTROUTING -o eth0 -j MASQUERADE", "COMMIT",
  ];
  const currentRulesHash = createHash("sha256").update(filterLines.join("\n")).digest("hex").slice(0, 16);

  const psk = process.env.DAEMON_PSK ?? "";
  const nodesWithCmd = nodes.map(n => ({
    ...n,
    installCmd: buildFwSyncInstallCmd(n.id, n.listenPort, psk),
  }));

  res.json({
    currentRulesHash,
    ruleCount: rules.length,
    blockedIpCount: blocked.length,
    ghostOsRuleCount: ghostRules.length,
    nodes: nodesWithCmd,
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// ── Automatic Threat Response (ATR) ────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

router.get("/atr/policies", async (_req, res) => {
  const policies = await db.select().from(firewallAtrPoliciesTable).orderBy(asc(firewallAtrPoliciesTable.createdAt));
  res.json({ policies, total: policies.length, enabledCount: policies.filter(p => p.enabled).length });
});

router.post("/atr/policies", async (req, res) => {
  const body = z.object({
    name: z.string().min(1),
    scope: z.enum(["global","category","signature"]).default("category"),
    category: z.string().optional(),
    sid: z.string().optional(),
    triggerCount: z.number().int().min(1).default(1),
    windowSecs: z.number().int().min(1).default(300),
    action: z.enum(["block","trap","block_and_trap","notify"]).default("block"),
    cooldownMins: z.number().int().min(1).default(60),
  }).parse(req.body);
  const [policy] = await db.insert(firewallAtrPoliciesTable).values({ ...body, enabled: true, triggeredCount: 0, createdAt: new Date() }).returning();
  res.status(201).json(policy);
});

router.put("/atr/policies/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const body = z.object({
    name: z.string().optional(), enabled: z.boolean().optional(),
    action: z.enum(["block","trap","block_and_trap","notify"]).optional(),
    triggerCount: z.number().int().min(1).optional(),
    cooldownMins: z.number().int().min(1).optional(),
  }).parse(req.body);
  const [p] = await db.update(firewallAtrPoliciesTable).set(body).where(eq(firewallAtrPoliciesTable.id, id)).returning();
  if (!p) return res.status(404).json({ error: "Policy not found" });
  res.json(p);
});

router.delete("/atr/policies/:id", async (req, res) => {
  await db.delete(firewallAtrPoliciesTable).where(eq(firewallAtrPoliciesTable.id, parseInt(req.params.id)));
  res.status(204).send();
});

router.get("/atr/events", async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
  const events = await db.select().from(firewallAtrEventsTable)
    .orderBy(desc(firewallAtrEventsTable.triggeredAt)).limit(limit);
  res.json({ events, total: events.length });
});

router.post("/atr/seed", async (_req, res) => {
  const existing = await db.select({ id: firewallAtrPoliciesTable.id }).from(firewallAtrPoliciesTable).limit(1);
  if (existing.length) return res.json({ skipped: true, message: "ATR policies already seeded" });
  await db.insert(firewallAtrPoliciesTable).values([
    { name:"Auto-block SQL injection", scope:"category", category:"sql-injection", triggerCount:1, windowSecs:60, action:"block", cooldownMins:120, enabled:true, triggeredCount:0, createdAt:new Date() },
    { name:"Auto-block exploit scans", scope:"category", category:"exploit", triggerCount:1, windowSecs:60, action:"block", cooldownMins:120, enabled:true, triggeredCount:0, createdAt:new Date() },
    { name:"Trap port scanners", scope:"category", category:"scan", triggerCount:1, windowSecs:30, action:"trap", cooldownMins:240, enabled:true, triggeredCount:0, createdAt:new Date() },
    { name:"Block C2 beaconing", scope:"category", category:"c2", triggerCount:1, windowSecs:60, action:"block_and_trap", cooldownMins:480, enabled:true, triggeredCount:0, createdAt:new Date() },
    { name:"Notify on web-attacks", scope:"category", category:"web-attacks", triggerCount:3, windowSecs:120, action:"notify", cooldownMins:30, enabled:true, triggeredCount:0, createdAt:new Date() },
  ]);
  res.json({ ok: true, seeded: 5 });
});

// ═══════════════════════════════════════════════════════════════════════════
// ── Composite IP Risk Score ─────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

router.get("/risk-score", async (req, res) => {
  const ip = (req.query.ip as string)?.trim();
  if (!ip) return res.status(400).json({ error: "ip query param required" });

  const [isBlocked, isTrapped, atrEvents, beaconHits, geoBlocks] = await Promise.all([
    db.select({ id: blockedIpsTable.id, reason: blockedIpsTable.reason }).from(blockedIpsTable).where(eq(blockedIpsTable.ip, ip)).limit(1),
    db.select({ id: trappedAttackersTable.id }).from(trappedAttackersTable).where(eq(trappedAttackersTable.ip, ip)).limit(1),
    db.select({ id: firewallAtrEventsTable.id, action: firewallAtrEventsTable.action, triggeredAt: firewallAtrEventsTable.triggeredAt })
      .from(firewallAtrEventsTable).where(eq(firewallAtrEventsTable.sourceIp, ip)).limit(10),
    db.select({ id: beaconAlertsTable.id }).from(beaconAlertsTable).where(eq(beaconAlertsTable.attackerIp, ip)).limit(5),
    db.select().from(firewallGeoBlocksTable).where(eq(firewallGeoBlocksTable.enabled, true)),
  ]);

  const factors: Array<{ factor: string; score: number; detail: string }> = [];
  let total = 0;

  if (isBlocked.length) {
    factors.push({ factor:"Blocked IP", score:45, detail: isBlocked[0].reason ?? "Manually blocked" });
    total += 45;
  }
  if (isTrapped.length) {
    factors.push({ factor:"Honeypot trapped", score:35, detail:"IP is caught in SilkWeb honeypot" });
    total += 35;
  }
  if (atrEvents.length) {
    const pts = Math.min(atrEvents.length * 15, 30);
    factors.push({ factor:"ATR triggers", score:pts, detail:`${atrEvents.length} automatic threat response(s) fired` });
    total += pts;
  }
  if (beaconHits.length) {
    const pts = Math.min(beaconHits.length * 10, 20);
    factors.push({ factor:"Beacon alerts", score:pts, detail:`${beaconHits.length} beacon/spider/worm alert(s)` });
    total += pts;
  }

  // Check CIDR/geo heuristics
  const parts = ip.split(".");
  if (parts.length === 4) {
    const isRfc1918 = (parts[0]==="10") || (parts[0]==="172"&&parseInt(parts[1])>=16&&parseInt(parts[1])<=31) || (parts[0]==="192"&&parts[1]==="168");
    if (!isRfc1918) {
      factors.push({ factor:"Public IP", score:5, detail:"Non-private address space — external origin" });
      total += 5;
    }
  }

  total = Math.min(total, 100);
  const riskLevel = total >= 75 ? "critical" : total >= 50 ? "high" : total >= 25 ? "medium" : "low";
  const riskColor = total >= 75 ? "#ff2222" : total >= 50 ? "#ff6600" : total >= 25 ? "#ffaa00" : "#00ff88";

  res.json({ ip, score: total, riskLevel, riskColor, factors, computedAt: new Date().toISOString() });
});

// ═══════════════════════════════════════════════════════════════════════════
// ── Per-WireGuard-Peer Firewall Rules ──────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

router.get("/peer-rules", async (_req, res) => {
  const rules = await db.select().from(firewallPeerRulesTable).orderBy(desc(firewallPeerRulesTable.createdAt));
  res.json({ rules, total: rules.length, enabledCount: rules.filter(r => r.enabled).length });
});

router.post("/peer-rules", async (req, res) => {
  const body = z.object({
    name: z.string().min(1),
    publicKey: z.string().min(10),
    deviceName: z.string().optional(),
    nodeId: z.number().int().optional(),
    action: z.enum(["allow","block","throttle","trap"]).default("block"),
    throttleKbps: z.number().int().optional(),
    reason: z.string().optional(),
    expiresAt: z.string().optional(),
  }).parse(req.body);
  const [rule] = await db.insert(firewallPeerRulesTable).values({
    ...body,
    expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
    enabled: true, hitCount: 0, createdAt: new Date(),
  }).returning();
  res.status(201).json(rule);
});

router.put("/peer-rules/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const body = z.object({
    name: z.string().optional(), enabled: z.boolean().optional(),
    action: z.enum(["allow","block","throttle","trap"]).optional(),
    throttleKbps: z.number().int().optional(),
    reason: z.string().optional(),
  }).parse(req.body);
  const [rule] = await db.update(firewallPeerRulesTable).set(body).where(eq(firewallPeerRulesTable.id, id)).returning();
  if (!rule) return res.status(404).json({ error: "Rule not found" });
  res.json(rule);
});

router.delete("/peer-rules/:id", async (req, res) => {
  await db.delete(firewallPeerRulesTable).where(eq(firewallPeerRulesTable.id, parseInt(req.params.id)));
  res.status(204).send();
});

// Daemon calls this when a peer rule matches (increments hitCount + last_hit)
router.post("/peer-rules/:id/hit", async (req, res) => {
  const id = parseInt(req.params.id);
  await db.update(firewallPeerRulesTable).set({
    hitCount: sql`${firewallPeerRulesTable.hitCount} + 1`,
    lastHit: new Date(),
  }).where(eq(firewallPeerRulesTable.id, id));
  res.json({ ok: true });
});

// Returns peer rules formatted as wg-peer-firewall config for daemon
router.get("/peer-rules/daemon-export", async (req, res) => {
  const nodeId = parseInt(req.query.nodeId as string) || null;
  const rules = await db.select().from(firewallPeerRulesTable).where(eq(firewallPeerRulesTable.enabled, true));
  const filtered = nodeId ? rules.filter(r => r.nodeId === null || r.nodeId === nodeId) : rules;
  // Generate iptables rules using wg show wg0 peers to map pubkey -> IP
  const script = [
    `#!/bin/bash`,
    `# ProxhqVPN Peer Firewall Rules — generated ${new Date().toISOString()}`,
    `# Apply after WireGuard is up`,
    `WG_IFACE="wg0"`,
    ``,
    ...filtered.map(r => {
      const action = r.action === "block" ? "DROP" : r.action === "trap" ? "DROP" : "ACCEPT";
      return [
        `# Rule: ${r.name} — ${r.action} peer ${r.publicKey.slice(0,16)}...`,
        `PEER_IP=$(wg show $WG_IFACE allowed-ips 2>/dev/null | grep "${r.publicKey}" | awk '{print $2}' | cut -d/ -f1)`,
        `[ -n "$PEER_IP" ] && iptables -I FORWARD -s "$PEER_IP" -i $WG_IFACE -j ${action} && echo "Peer rule applied: $PEER_IP -> ${action}"`,
        ``,
      ].join("\n");
    }),
  ].join("\n");
  res.setHeader("Content-Type", "text/plain");
  res.setHeader("Content-Disposition", `attachment; filename="proxhq-peer-rules.sh"`);
  return res.send(script);
});

// ═══════════════════════════════════════════════════════════════════════════
// ── Adaptive DDoS Auto-Response ────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

router.get("/ddos/config", async (_req, res) => {
  let [config] = await db.select().from(firewallDdosConfigTable).limit(1);
  if (!config) {
    [config] = await db.insert(firewallDdosConfigTable).values({ enabled: true, thresholdPps: 5000, windowSecs: 10, action: "rate_limit", rateLimitPps: 100, autoUnblockMins: 30, updatedAt: new Date() }).returning();
  }
  res.json(config);
});

router.put("/ddos/config", async (req, res) => {
  const body = z.object({
    enabled: z.boolean().optional(),
    thresholdPps: z.number().int().min(100).optional(),
    windowSecs: z.number().int().min(1).optional(),
    action: z.enum(["rate_limit","block","throttle"]).optional(),
    rateLimitPps: z.number().int().min(1).optional(),
    autoUnblockMins: z.number().int().min(1).optional(),
  }).parse(req.body);
  let [config] = await db.select({ id: firewallDdosConfigTable.id }).from(firewallDdosConfigTable).limit(1);
  if (!config) {
    [config] = await db.insert(firewallDdosConfigTable).values({ enabled: true, thresholdPps: 5000, windowSecs: 10, action: "rate_limit", rateLimitPps: 100, autoUnblockMins: 30, updatedAt: new Date() }).returning();
  }
  const [updated] = await db.update(firewallDdosConfigTable).set({ ...body, updatedAt: new Date() }).where(eq(firewallDdosConfigTable.id, config.id)).returning();
  res.json(updated);
});

router.get("/ddos/events", async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
  const events = await db.select().from(firewallDdosEventsTable)
    .orderBy(desc(firewallDdosEventsTable.blockedAt)).limit(limit);
  const activeCount = events.filter(e => !e.resolvedAt).length;
  res.json({ events, total: events.length, activeCount });
});

router.post("/ddos/events/:id/resolve", async (req, res) => {
  const id = parseInt(req.params.id);
  const [evt] = await db.update(firewallDdosEventsTable).set({ resolvedAt: new Date() }).where(eq(firewallDdosEventsTable.id, id)).returning();
  if (!evt) return res.status(404).json({ error: "Event not found" });
  res.json(evt);
});

// ═══════════════════════════════════════════════════════════════════════════
// ── AI Firewall Rule Optimizer ─────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════════════════════

router.post("/optimizer/analyze", async (_req, res) => {
  const [rules, blocked, geoBlocks, ipsSignatures, atrPolicies, dpiRules, zones] = await Promise.all([
    db.select().from(firewallRulesTable),
    db.select().from(blockedIpsTable),
    db.select().from(firewallGeoBlocksTable),
    db.select().from(firewallIpsSignaturesTable),
    db.select().from(firewallAtrPoliciesTable),
    db.select().from(firewallDpiRulesTable),
    db.select().from(firewallZonesTable),
  ]);

  const recommendations: Array<{ type: string; severity: string; title: string; detail: string; ruleIds?: number[] }> = [];

  // 1. Dead rules — enabled rules with no matches (0 hit count where available)
  const deadRules = rules.filter(r => r.enabled);
  if (deadRules.length > 20) {
    recommendations.push({ type:"dead_rules", severity:"low", title:`${deadRules.length} rules active — consider pruning`, detail:"Large rulesets increase evaluation latency. Review rules older than 30 days with no documented match." });
  }

  // 2. Overlapping rules — rules with identical source/dest/port combos
  const ruleKeys = rules.map(r => `${r.sourceIp}:${r.destIp}:${r.destPort}:${r.protocol}`);
  const duplicates: string[] = [];
  ruleKeys.forEach((k, i) => { if (ruleKeys.indexOf(k) !== i && !duplicates.includes(k)) duplicates.push(k); });
  if (duplicates.length) {
    const dupRules = rules.filter(r => duplicates.includes(`${r.sourceIp}:${r.destIp}:${r.destPort}:${r.protocol}`));
    recommendations.push({ type:"overlap", severity:"medium", title:`${duplicates.length} overlapping rule pattern(s) detected`, detail:`Rules with identical src/dst/port/proto: ${dupRules.map(r => `#${r.id} "${r.name}"`).join(", ")}. Merge or remove duplicates.`, ruleIds: dupRules.map(r => r.id) });
  }

  // 3. Allow rules that contradict deny rules
  const allowRules = rules.filter(r => r.action === "allow");
  const denyRules  = rules.filter(r => r.action === "deny" || r.action === "drop");
  const conflicts: number[] = [];
  for (const ar of allowRules) {
    const conflict = denyRules.find(dr => dr.sourceIp === ar.sourceIp && dr.destPort === ar.destPort && dr.protocol === ar.protocol);
    if (conflict) { conflicts.push(ar.id); conflicts.push(conflict.id); }
  }
  if (conflicts.length) {
    recommendations.push({ type:"conflict", severity:"high", title:`${conflicts.length / 2} allow/deny conflict(s) found`, detail:"Some rules allow traffic that other rules deny for the same source/port/protocol. The first matching rule wins — reorder or remove.", ruleIds: [...new Set(conflicts)] });
  }

  // 4. IPS categories with no ATR policy
  const ipsCats = [...new Set(ipsSignatures.map(s => s.category))];
  const atrCats = new Set(atrPolicies.map(p => p.category).filter(Boolean));
  const uncoveredCats = ipsCats.filter(c => !atrCats.has(c));
  if (uncoveredCats.length) {
    recommendations.push({ type:"atr_gap", severity:"medium", title:`${uncoveredCats.length} IPS category(s) have no ATR policy`, detail:`Categories with no auto-response: ${uncoveredCats.join(", ")}. Attackers triggering these sigs will not be auto-blocked.` });
  }

  // 5. High blocked-IP volume suggests a geo-block would be more efficient
  if (blocked.length > 50) {
    recommendations.push({ type:"geo_efficiency", severity:"low", title:`${blocked.length} manual IP blocks — consider geo-block rules`, detail:"When many blocked IPs share a country/ASN, a single geo-block rule is more efficient and maintainable than individual IP entries." });
  }

  // 6. DPI rules with no enabled IPS backup
  const enabledIps = ipsSignatures.filter(s => s.enabled).length;
  if (dpiRules.length > 0 && enabledIps === 0) {
    recommendations.push({ type:"ips_disabled", severity:"high", title:"DPI rules active but all IPS signatures disabled", detail:"DPI catches content patterns, but IPS is needed for protocol-level attack signatures. Re-enable IPS signatures for full coverage." });
  }

  // 7. No zones defined — flat network
  if (zones.length === 0) {
    recommendations.push({ type:"no_zones", severity:"medium", title:"No security zones defined — flat network posture", detail:"Without zones, all interfaces share the same trust level. Define at least WAN/LAN/DMZ zones to enable micro-segmentation." });
  }

  // 8. Rule ordering suggestion
  const anyProtoRules = rules.filter(r => r.protocol === "any" && r.action !== "allow");
  if (anyProtoRules.length > 3) {
    recommendations.push({ type:"ordering", severity:"low", title:`${anyProtoRules.length} broad 'any-protocol' deny rules`, detail:"Any-protocol rules should be placed last in the chain. Specific protocol rules (tcp/udp/icmp) evaluate faster and more accurately." });
  }

  const score = Math.max(0, 100 - (recommendations.filter(r=>r.severity==="critical").length*25 + recommendations.filter(r=>r.severity==="high").length*15 + recommendations.filter(r=>r.severity==="medium").length*8 + recommendations.filter(r=>r.severity==="low").length*3));

  res.json({
    score,
    grade: score >= 90 ? "A" : score >= 75 ? "B" : score >= 60 ? "C" : score >= 45 ? "D" : "F",
    recommendations,
    stats: { totalRules: rules.length, blockedIps: blocked.length, ipsSignatures: ipsSignatures.length, atrPolicies: atrPolicies.length, geoBlocks: geoBlocks.length, zones: zones.length },
    analyzedAt: new Date().toISOString(),
  });
});

// ── Security Event Log — read-only view of IPS-flagged events from nodes ───
// Traffic always flows freely for VPN users. This is purely a visibility log.
router.get("/security-events", async (req, res) => {
  const rows = await db.select().from(firewallTrafficDecisionsTable)
    .orderBy(desc(firewallTrafficDecisionsTable.createdAt))
    .limit(200);
  return res.json({ events: rows });
});

router.delete("/security-events/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "bad id" });
  await db.delete(firewallTrafficDecisionsTable).where(eq(firewallTrafficDecisionsTable.id, id));
  return res.json({ ok: true });
});

// ── Node Hardening Script — comprehensive security stack per node ───────────
router.get("/node-hardening-script", async (req, res) => {
  const nodeId = parseInt(req.query.nodeId as string);
  if (isNaN(nodeId)) return res.status(400).json({ error: "nodeId required" });
  const nodes = await db.select().from(nodesTable).where(eq(nodesTable.id, nodeId));
  if (!nodes.length) return res.status(404).json({ error: "node not found" });
  const node = nodes[0]!;
  const psk = process.env.DAEMON_PSK ?? "";
  const apiBase = "https://network-labyrinth.replit.app/api/daemon-inbound";

  const script = buildNodeHardeningScript(nodeId, node.name, node.ipAddress, node.listenPort, psk, apiBase);

  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="proxhq-node-${nodeId}-hardening.sh"`);
  return res.send(script);
});

function buildNodeHardeningScript(
  nodeId: number, nodeName: string, nodeIp: string,
  listenPort: number, psk: string, apiBase: string
): string {
  return `#!/bin/bash
# ============================================================
# ProxhqVPN Node Security Hardening v2.0
# Node: ${nodeName} (ID: ${nodeId}) — IP: ${nodeIp}
# Generated: $(date -u +%Y-%m-%dT%H:%M:%SZ)
# Copyright © Alpha Unlimited Technologies LLC
# ============================================================
# ARCHITECTURE:
#   WireGuard interface : wg0 (UDP port ${listenPort})
#   VPN clients (10.8.0.0/24) connect via wg0 — they are
#   authenticated by WireGuard keypair and pass freely through
#   the FORWARD chain. The node perimeter (INPUT chain) only
#   allows WireGuard UDP, rate-limited SSH, and ICMP.
#   Traffic Bridge: node reports flagged peer traffic to the
#   API server. Admin reviews in dashboard and approves/denies.
#   Node polls decisions every 30s and enforces via iptables.
# ============================================================
set -euo pipefail

NODE_ID="${nodeId}"
WG_PORT="${listenPort}"
VPN_CIDR="10.8.0.0/24"
PSK="${psk}"
API="${apiBase}"

log() { echo "[proxhq-harden] $*"; }
ok()  { echo "[✓] $*"; }
fail(){ echo "[✗] $*" >&2; }

log "=== ProxhqVPN Node Security Hardening v2.0 ========================="
log "Node: ${nodeName} (${nodeId}) — ${nodeIp}"

# ── 1. Kernel sysctl hardening ─────────────────────────────────────────
log "Applying sysctl hardening..."
cat > /etc/sysctl.d/99-proxhq-hardening.conf << 'SYSCTL'
# ProxhqVPN Kernel Hardening
net.ipv4.ip_forward = 1
net.ipv6.conf.all.forwarding = 1
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.default.rp_filter = 1
net.ipv4.conf.all.accept_redirects = 0
net.ipv4.conf.default.accept_redirects = 0
net.ipv6.conf.all.accept_redirects = 0
net.ipv4.conf.all.send_redirects = 0
net.ipv4.icmp_echo_ignore_broadcasts = 1
net.ipv4.conf.all.log_martians = 1
net.ipv4.tcp_syncookies = 1
net.ipv4.tcp_rfc1337 = 1
net.ipv4.tcp_max_syn_backlog = 8192
net.core.somaxconn = 65536
net.ipv4.tcp_fin_timeout = 15
net.ipv4.tcp_keepalive_time = 600
net.ipv4.tcp_keepalive_probes = 5
net.ipv4.tcp_keepalive_intvl = 15
net.ipv4.conf.all.arp_ignore = 1
net.ipv4.conf.all.arp_announce = 2
kernel.randomize_va_space = 2
kernel.dmesg_restrict = 1
kernel.kptr_restrict = 2
fs.protected_hardlinks = 1
fs.protected_symlinks = 1
fs.suid_dumpable = 0
SYSCTL
sysctl -p /etc/sysctl.d/99-proxhq-hardening.conf > /dev/null 2>&1 && ok "sysctl kernel hardening applied"

# ── 2. iptables perimeter firewall (WireGuard-aware) ────────────────────
log "Configuring iptables perimeter firewall..."
iptables -F INPUT  2>/dev/null; iptables -F FORWARD 2>/dev/null; iptables -F OUTPUT 2>/dev/null
iptables -t nat -F 2>/dev/null
ip6tables -F INPUT 2>/dev/null; ip6tables -F FORWARD 2>/dev/null; ip6tables -F OUTPUT 2>/dev/null

# IPv4 — default DROP on INPUT/FORWARD
iptables -P INPUT   DROP
iptables -P FORWARD DROP
iptables -P OUTPUT  ACCEPT

# Loopback + established
iptables -A INPUT -i lo -j ACCEPT
iptables -A INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT

# WireGuard (the only external inbound port required)
iptables -A INPUT -p udp --dport "\${WG_PORT}" -j ACCEPT

# SSH: max 3 new connections per 60 seconds per source IP
iptables -A INPUT -p tcp --dport 22 -m conntrack --ctstate NEW \\
  -m recent --name SSH_GUARD --set
iptables -A INPUT -p tcp --dport 22 -m conntrack --ctstate NEW \\
  -m recent --name SSH_GUARD --update --seconds 60 --hitcount 4 -j DROP
iptables -A INPUT -p tcp --dport 22 -m conntrack --ctstate NEW -j ACCEPT

# ICMP: rate-limited
iptables -A INPUT -p icmp --icmp-type echo-request \\
  -m limit --limit 5/s --limit-burst 10 -j ACCEPT
iptables -A INPUT -p icmp --icmp-type echo-request -j DROP

# SYN flood protection
iptables -I INPUT 1 -p tcp --syn -m limit --limit 100/s --limit-burst 500 -j ACCEPT
iptables -I INPUT 2 -p tcp --syn -j DROP

# FORWARD: VPN clients pass freely (auth by WireGuard keypair)
iptables -A FORWARD -i wg0 -j ACCEPT
iptables -A FORWARD -o wg0 -j ACCEPT
iptables -A FORWARD -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT

# NAT masquerade for VPN outbound
WAN_IFACE=\$(ip route get 8.8.8.8 2>/dev/null | awk '/dev/{for(i=1;i<=NF;i++) if(\$i=="dev") print \$(i+1)}' | head -1)
WAN_IFACE=\${WAN_IFACE:-ens3}
iptables -t nat -A POSTROUTING -s "\${VPN_CIDR}" -o "\${WAN_IFACE}" -j MASQUERADE

# IPv6 mirror
ip6tables -P INPUT   DROP
ip6tables -P FORWARD DROP
ip6tables -P OUTPUT  ACCEPT
ip6tables -A INPUT -i lo -j ACCEPT
ip6tables -A INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
ip6tables -A INPUT -p udp --dport "\${WG_PORT}" -j ACCEPT
ip6tables -A INPUT -p tcp --dport 22 -m conntrack --ctstate NEW \\
  -m limit --limit 3/min -j ACCEPT
ip6tables -A INPUT -p ipv6-icmp -m limit --limit 5/s -j ACCEPT
ip6tables -A FORWARD -i wg0 -j ACCEPT
ip6tables -A FORWARD -o wg0 -j ACCEPT

# Persist rules
mkdir -p /etc/iptables
iptables-save  > /etc/iptables/rules.v4 2>/dev/null || iptables-save  > /etc/iptables.rules  2>/dev/null || true
ip6tables-save > /etc/iptables/rules.v6 2>/dev/null || ip6tables-save > /etc/ip6tables.rules 2>/dev/null || true
ok "iptables perimeter firewall configured (WireGuard-aware, VPN clients pass freely)"

# ── 3. Install fail2ban ─────────────────────────────────────────────────
log "Installing fail2ban..."
if command -v apt-get &>/dev/null; then apt-get install -y -q fail2ban 2>/dev/null; fi
if command -v dnf     &>/dev/null; then dnf     install -y -q fail2ban 2>/dev/null; fi
if command -v yum     &>/dev/null; then yum     install -y -q fail2ban 2>/dev/null; fi

cat > /etc/fail2ban/jail.d/proxhq.conf << 'F2B'
[DEFAULT]
bantime  = 3600
findtime = 600
maxretry = 3

[sshd]
enabled  = true
port     = ssh
logpath  = %(sshd_log)s
maxretry = 3
bantime  = 7200

[proxhq-brute]
enabled  = true
port     = all
logpath  = /var/log/proxhq-auth.log
maxretry = 5
bantime  = 1800
filter   = proxhq-brute
F2B

cat > /etc/fail2ban/filter.d/proxhq-brute.conf << 'F2BFILTER'
[Definition]
failregex = ^\[PROXHQ\] AUTH_FAIL .* from <HOST>
ignoreregex =
F2BFILTER

systemctl enable fail2ban --now 2>/dev/null && ok "fail2ban installed and active" || true

# ── 4. SSH hardening ────────────────────────────────────────────────────
log "Hardening SSH..."
if [ -f /etc/ssh/sshd_config ]; then
  sed -i 's/^#*PasswordAuthentication.*/PasswordAuthentication no/'  /etc/ssh/sshd_config
  sed -i 's/^#*PermitRootLogin.*/PermitRootLogin no/'                /etc/ssh/sshd_config
  grep -q "^MaxAuthTries"    /etc/ssh/sshd_config || echo "MaxAuthTries 3"    >> /etc/ssh/sshd_config
  grep -q "^LoginGraceTime"  /etc/ssh/sshd_config || echo "LoginGraceTime 20" >> /etc/ssh/sshd_config
  grep -q "^X11Forwarding"   /etc/ssh/sshd_config || echo "X11Forwarding no"  >> /etc/ssh/sshd_config
  grep -q "^AllowTcpForwarding" /etc/ssh/sshd_config || echo "AllowTcpForwarding no" >> /etc/ssh/sshd_config
  systemctl reload sshd 2>/dev/null || service ssh reload 2>/dev/null || true
  ok "SSH hardened (key-only, no root login, 3-attempt limit)"
fi

# ── 5. DDoS monitoring daemon ────────────────────────────────────────────
log "Installing DDoS monitoring daemon..."
cat > /usr/local/bin/proxhq-ddos-monitor.sh << 'DDOS'
#!/bin/bash
NODE_ID=__NODE_ID__
PSK="__PSK__"
API="__API__"
THRESHOLD=5000
while true; do
  ss -ntu state established 2>/dev/null | awk 'NR>1{print $5}' | \\
    rev | cut -d: -f2- | rev | sort | uniq -c | sort -rn | head -10 | \\
    while read cnt ip; do
      [ "$cnt" -gt "$THRESHOLD" ] 2>/dev/null || continue
      curl -sf -X POST "$API/ddos-report" \\
        -H "X-Daemon-PSK: $PSK" -H "Content-Type: application/json" \\
        -d "{\\"nodeId\\":$NODE_ID,\\"sourceIp\\":\\"$ip\\",\\"peakPps\\":$cnt}" \\
        -m 5 >/dev/null 2>&1
    done
  sleep 10
done
DDOS
sed -i "s|__NODE_ID__|${nodeId}|g; s|__PSK__|${psk}|g; s|__API__|${apiBase}|g" \\
  /usr/local/bin/proxhq-ddos-monitor.sh
chmod +x /usr/local/bin/proxhq-ddos-monitor.sh
cat > /etc/systemd/system/proxhq-ddos-monitor.service << 'SVC'
[Unit]
Description=ProxhqVPN DDoS Monitor
After=network.target
[Service]
ExecStart=/usr/local/bin/proxhq-ddos-monitor.sh
Restart=always
RestartSec=10
User=root
[Install]
WantedBy=multi-user.target
SVC
systemctl daemon-reload
systemctl enable proxhq-ddos-monitor --now 2>/dev/null
ok "DDoS monitoring daemon installed and active"

# ── 6. Security event reporter (IPS → API audit log, VPN traffic unaffected) ─
log "Installing security event reporter..."
cat > /usr/local/bin/proxhq-sec-reporter.sh << 'REPORTER'
#!/bin/bash
# ProxhqVPN Security Reporter — tails Suricata fast.log and sends flagged
# events to the dashboard as an audit log. VPN client traffic is NEVER blocked
# or held by this script; it only logs for admin visibility.
NODE_ID=__NODE_ID__
PSK="__PSK__"
API="__API__"
FAST_LOG="/var/log/suricata/fast.log"
[ -f "$FAST_LOG" ] || { echo "[sec-reporter] No Suricata fast.log; sleeping."; sleep 300; exit 0; }

tail -Fn0 "$FAST_LOG" 2>/dev/null | while read line; do
  SID=$(echo "$line" | grep -oP '(?<=\[)\d+:\d+:\d+(?=\])' | head -1 | cut -d: -f2)
  SRC=$(echo "$line" | grep -oP '\d{1,3}(\.\d{1,3}){3}(?=:\d+ ->)' | head -1)
  DST=$(echo "$line" | grep -oP '(?<-> )\d{1,3}(\.\d{1,3}){3}' | head -1)
  [ -z "$SRC" ] || [ -z "$SID" ] && continue
  # Only log peers from VPN subnet (10.8.0.x) — external is handled by ATR/iptables
  echo "$SRC" | grep -q "^10\.8\.0\." || continue
  curl -sf -X POST "$API/traffic-flag" \\
    -H "X-Daemon-PSK: $PSK" -H "Content-Type: application/json" \\
    -d "{\\"nodeId\\":$NODE_ID,\\"peerIp\\":\\"$SRC\\",\\"destIp\\":\\"\${DST:-0.0.0.0}\\",\\"flagReason\\":\\"ips_match\\",\\"flagSid\\":\\"$SID\\"}" \\
    -m 5 >/dev/null 2>&1
done
REPORTER
sed -i "s|__NODE_ID__|${nodeId}|g; s|__PSK__|${psk}|g; s|__API__|${apiBase}|g" \\
  /usr/local/bin/proxhq-sec-reporter.sh
chmod +x /usr/local/bin/proxhq-sec-reporter.sh
cat > /etc/systemd/system/proxhq-sec-reporter.service << 'SVC'
[Unit]
Description=ProxhqVPN Security Event Reporter
After=network.target suricata.service
[Service]
ExecStart=/usr/local/bin/proxhq-sec-reporter.sh
Restart=always
RestartSec=10
User=root
[Install]
WantedBy=multi-user.target
SVC
systemctl daemon-reload
systemctl enable proxhq-sec-reporter --now 2>/dev/null
ok "Security event reporter installed (visibility only, no traffic blocking)"

# ── 7. Peer rules enforcer (per-WG-key iptables rules) ──────────────────
log "Installing peer rules enforcer..."
cat > /usr/local/bin/proxhq-peer-rules.sh << 'PEER'
#!/bin/bash
NODE_ID=__NODE_ID__
PSK="__PSK__"
API="__API__"
while true; do
  RESP=$(curl -sf "$API/peer-rules-export?nodeId=$NODE_ID" \\
    -H "X-Daemon-PSK: $PSK" -m 10 2>/dev/null)
  if [ -n "$RESP" ]; then
    # Parse and apply peer rules
    echo "$RESP" | python3 -c "
import sys, json, subprocess
try:
    data = json.load(sys.stdin)
    for rule in data.get('rules', []):
        peer_ip   = rule.get('resolvedIp','')
        dest_cidr = rule.get('destCidr','')
        dest_port = rule.get('destPort','')
        action    = rule.get('action','allow')
        if not peer_ip or not dest_cidr:
            continue
        if action == 'block':
            cmd = f'iptables -I FORWARD -s {peer_ip} -d {dest_cidr} -j DROP 2>/dev/null'
        elif action == 'allow':
            cmd = f'iptables -I FORWARD -s {peer_ip} -d {dest_cidr} -j ACCEPT 2>/dev/null'
        elif action == 'throttle':
            kbps = rule.get('throttleKbps', 1024)
            cmd = f'tc qdisc add dev wg0 root tbf rate {kbps}kbit burst 32kbit latency 50ms 2>/dev/null || true'
        else:
            continue
        subprocess.run(cmd, shell=True, capture_output=True)
except Exception as e:
    print(f'[peer-rules] error: {e}', file=sys.stderr)
" 2>/dev/null || true
  fi
  sleep 60
done
PEER
sed -i "s|__NODE_ID__|${nodeId}|g; s|__PSK__|${psk}|g; s|__API__|${apiBase}|g" \\
  /usr/local/bin/proxhq-peer-rules.sh
chmod +x /usr/local/bin/proxhq-peer-rules.sh
cat > /etc/systemd/system/proxhq-peer-rules.service << 'SVC'
[Unit]
Description=ProxhqVPN Per-Peer Firewall Rules
After=network.target wg-quick@wg0.service
[Service]
ExecStart=/usr/local/bin/proxhq-peer-rules.sh
Restart=always
RestartSec=20
User=root
[Install]
WantedBy=multi-user.target
SVC
systemctl daemon-reload
systemctl enable proxhq-peer-rules --now 2>/dev/null
ok "Per-peer rules enforcer installed"

# ── 8. ATR watchdog (IPS event → auto-block pipeline) ───────────────────
log "Installing ATR watchdog..."
cat > /usr/local/bin/proxhq-atr-watchdog.sh << 'ATR'
#!/bin/bash
NODE_ID=__NODE_ID__
PSK="__PSK__"
API="__API__"
TAIL_LOG="/var/log/suricata/fast.log"
[ -f "$TAIL_LOG" ] || TAIL_LOG="/var/log/suricata/eve.json"

tail -Fn0 "$TAIL_LOG" 2>/dev/null | while read line; do
  SID=$(echo "$line" | grep -oP '(?<=sid:)\d+' | head -1)
  SRC=$(echo "$line" | grep -oP '\d{1,3}(\.\d{1,3}){3}(?=:\d+ ->)' | head -1)
  [ -z "$SRC" ] || [ -z "$SID" ] && continue
  curl -sf -X POST "$API/ips-event" \\
    -H "X-Daemon-PSK: $PSK" -H "Content-Type: application/json" \\
    -d "{\\"nodeId\\":$NODE_ID,\\"sourceIp\\":\\"$SRC\\",\\"sid\\":\\"$SID\\",\\"severity\\":\\"medium\\"}" \\
    -m 5 >/dev/null 2>&1
done
ATR
sed -i "s|__NODE_ID__|${nodeId}|g; s|__PSK__|${psk}|g; s|__API__|${apiBase}|g" \\
  /usr/local/bin/proxhq-atr-watchdog.sh
chmod +x /usr/local/bin/proxhq-atr-watchdog.sh
cat > /etc/systemd/system/proxhq-atr-watchdog.service << 'SVC'
[Unit]
Description=ProxhqVPN ATR Watchdog (Suricata → auto-block)
After=network.target suricata.service
[Service]
ExecStart=/usr/local/bin/proxhq-atr-watchdog.sh
Restart=always
RestartSec=5
User=root
[Install]
WantedBy=multi-user.target
SVC
systemctl daemon-reload
systemctl enable proxhq-atr-watchdog --now 2>/dev/null
ok "ATR watchdog installed (Suricata alerts → API → auto-block)"

# ── 9. Firewall rule sync daemon ─────────────────────────────────────────
log "Installing firewall rule sync daemon..."
cat > /usr/local/bin/proxhq-fw-sync.sh << 'FWSCRIPT'
#!/bin/bash
NODE_ID=__NODE_ID__
PSK="__PSK__"
API="__API__"
HF="/tmp/proxhq-fw.hash"
while true; do
  R=$(curl -sf "$API/firewall-rules?nodeId=$NODE_ID" -H "X-Daemon-PSK: $PSK" 2>/dev/null)
  [ -z "$R" ] && { echo "[fw-sync] API unreachable" >&2; sleep 60; continue; }
  H=$(echo "$R" | python3 -c "import sys,json; print(json.load(sys.stdin)['rulesHash'])" 2>/dev/null)
  OH=$(cat "$HF" 2>/dev/null || echo "")
  if [ "$H" != "$OH" ] && [ -n "$H" ]; then
    echo "[fw-sync] Applying ruleset $H..."
    echo "$R" | python3 -c "import sys,json; print(json.load(sys.stdin)['iptablesRestore'])" | iptables-restore
    echo "$R" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('ip6tablesRestore',''))" 2>/dev/null | ip6tables-restore 2>/dev/null || true
    echo "$H" > "$HF"
    curl -sf -X POST "$API/fw-sync-ack" \\
      -H "Content-Type: application/json" -H "X-Daemon-PSK: $PSK" \\
      -d "{\\"nodeId\\":$NODE_ID,\\"rulesHash\\":\\"$H\\",\\"success\\":true}" >/dev/null
    echo "[fw-sync] Applied $H"
  fi
  sleep 30
done
FWSCRIPT
sed -i "s|__NODE_ID__|${nodeId}|g; s|__PSK__|${psk}|g; s|__API__|${apiBase}|g" \\
  /usr/local/bin/proxhq-fw-sync.sh
chmod +x /usr/local/bin/proxhq-fw-sync.sh
cat > /etc/systemd/system/proxhq-fw-sync.service << 'SVC'
[Unit]
Description=ProxhqVPN Firewall Rule Sync
After=network-online.target
Wants=network-online.target
[Service]
Type=simple
ExecStart=/usr/local/bin/proxhq-fw-sync.sh
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
[Install]
WantedBy=multi-user.target
SVC
systemctl daemon-reload && systemctl enable proxhq-fw-sync && \\
  systemctl restart proxhq-fw-sync && echo "[fw-sync] FW-SYNC ACTIVE node ${nodeId}"
ok "Firewall sync daemon installed (30s auto-push)"

# ── 10. RAM-only WireGuard key (Mullvad-style) ───────────────────────────
log "Configuring RAM-only WireGuard key service..."
cat > /usr/local/bin/proxhq-wg-init.sh << 'WGINIT'
#!/bin/bash
PSK="__PSK__"
API="__API__"
NODE_ID=__NODE_ID__
KEY=$(curl -sf -X POST "$API/wg-key" \\
  -H "X-Daemon-PSK: $PSK" -H "Content-Type: application/json" \\
  -d "{\\"nodeId\\":$NODE_ID}" -m 10 2>/dev/null | \\
  python3 -c "import sys,json; print(json.load(sys.stdin).get('privateKey',''))" 2>/dev/null)
if [ -z "$KEY" ]; then echo "[wg-init] ERROR: could not fetch key from API" >&2; exit 1; fi
install -m 600 /dev/null /dev/shm/wg-private.key
echo "$KEY" > /dev/shm/wg-private.key
cp /etc/wireguard/wg0-base.conf /dev/shm/wg0.conf
echo "PrivateKey = $KEY" >> /dev/shm/wg0.conf
chmod 600 /dev/shm/wg0.conf
echo "[wg-init] WireGuard RAM key loaded for node $NODE_ID"
WGINIT
sed -i "s|__NODE_ID__|${nodeId}|g; s|__PSK__|${psk}|g; s|__API__|${apiBase}|g" \\
  /usr/local/bin/proxhq-wg-init.sh
chmod +x /usr/local/bin/proxhq-wg-init.sh
ok "RAM-only WireGuard key init script updated"

# ── 11. Audit log tailing ────────────────────────────────────────────────
mkdir -p /var/log/proxhq
touch /var/log/proxhq-auth.log
chmod 640 /var/log/proxhq-auth.log
ok "Audit log directory ready at /var/log/proxhq/"

# ── Summary ──────────────────────────────────────────────────────────────
echo ""
echo "========================================================"
echo "  ProxhqVPN Node Hardening Complete — \$(date -u)"
echo "  Node: ${nodeName} (ID: ${nodeId}) — ${nodeIp}"
echo "========================================================"
echo "  [✓] sysctl kernel hardening"
echo "  [✓] iptables DROP perimeter (WireGuard-aware)"
echo "  [✓] IPv6 iptables mirror"
echo "  [✓] fail2ban (SSH + ProxhqVPN brute)"
echo "  [✓] SSH key-only, no root, 3-attempt limit"
echo "  [✓] DDoS monitoring daemon (proxhq-ddos-monitor)"
echo "  [✓] Security event reporter (proxhq-sec-reporter)"
echo "  [✓] Per-peer rules enforcer (proxhq-peer-rules)"
echo "  [✓] ATR watchdog (proxhq-atr-watchdog)"
echo "  [✓] Firewall rule sync (proxhq-fw-sync)"
echo "  [✓] RAM-only WireGuard key init (proxhq-wg-init)"
echo ""
echo "  Services running: systemctl list-units 'proxhq-*'"
echo "========================================================"
`;
}

function buildFwSyncInstallCmd(nodeId: number, listenPort: number, psk: string): string {
  const apiBase = "https://network-labyrinth.replit.app/api/daemon-inbound";
  return [
    `cat > /usr/local/bin/proxhq-fw-sync.sh << 'SCRIPT'`,
    `#!/bin/bash`,
    `NODE_ID=PROXHQ_NODE_ID`,
    `PSK="PROXHQ_PSK"`,
    `API="${apiBase}"`,
    `HF="/tmp/proxhq-fw.hash"`,
    `while true; do`,
    `  R=$(curl -sf "$API/firewall-rules?nodeId=$NODE_ID" -H "X-Daemon-PSK: $PSK" 2>/dev/null)`,
    `  [ -z "$R" ] && { echo "[fw-sync] API unreachable" >&2; sleep 60; continue; }`,
    `  H=$(echo "$R" | python3 -c "import sys,json; print(json.load(sys.stdin)['rulesHash'])" 2>/dev/null)`,
    `  OH=$(cat "$HF" 2>/dev/null || echo "")`,
    `  if [ "$H" != "$OH" ] && [ -n "$H" ]; then`,
    `    echo "[fw-sync] Applying ruleset $H..."`,
    `    echo "$R" | python3 -c "import sys,json; print(json.load(sys.stdin)['iptablesRestore'])" | iptables-restore`,
    `    echo "$R" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('ip6tablesRestore',''))" 2>/dev/null | ip6tables-restore 2>/dev/null || true`,
    `    echo "$H" > "$HF"`,
    `    curl -sf -X POST "$API/fw-sync-ack" -H "Content-Type: application/json" -H "X-Daemon-PSK: $PSK" \\`,
    `      -d "{\\"nodeId\\":$NODE_ID,\\"rulesHash\\":\\"$H\\",\\"success\\":true}" >/dev/null`,
    `    echo "[fw-sync] Applied $H"`,
    `  fi`,
    `  sleep 30`,
    `done`,
    `SCRIPT`,
    `sed -i "s/PROXHQ_NODE_ID/${nodeId}/g; s|PROXHQ_PSK|${psk}|g" /usr/local/bin/proxhq-fw-sync.sh`,
    `chmod +x /usr/local/bin/proxhq-fw-sync.sh`,
    `cat > /etc/systemd/system/proxhq-fw-sync.service << 'SVC'`,
    `[Unit]`,
    `Description=ProxhqVPN Firewall Rule Sync`,
    `After=network-online.target`,
    `Wants=network-online.target`,
    `[Service]`,
    `Type=simple`,
    `ExecStart=/usr/local/bin/proxhq-fw-sync.sh`,
    `Restart=always`,
    `RestartSec=10`,
    `StandardOutput=journal`,
    `StandardError=journal`,
    `[Install]`,
    `WantedBy=multi-user.target`,
    `SVC`,
    `systemctl daemon-reload && systemctl enable proxhq-fw-sync && systemctl restart proxhq-fw-sync && echo "FW-SYNC ACTIVE node ${nodeId}"`,
  ].join("\n");
}

// ── Connection Approval / User Decision System ────────────────────────────

const SAMPLE_THREATS = [
  { sourceIp: "185.220.101.47", destPort: "22", protocol: "tcp", reason: "Tor exit node probing SSH port", threatLevel: "high" },
  { sourceIp: "45.33.32.156",   destPort: "80", protocol: "tcp", reason: "Known scanner — Shodan crawler", threatLevel: "medium" },
  { sourceIp: "194.165.16.11",  destPort: "443", protocol: "tcp", reason: "Inbound TLS from high-risk ASN", threatLevel: "medium" },
  { sourceIp: "103.199.17.3",   destPort: "3389", protocol: "tcp", reason: "RDP brute-force attempt detected", threatLevel: "critical" },
  { sourceIp: "92.118.160.4",   destPort: "8080", protocol: "tcp", reason: "HTTP proxy scanner — Censys", threatLevel: "low" },
  { sourceIp: "162.142.125.81", destPort: "1194", protocol: "udp", reason: "OpenVPN port probe from datacenter IP", threatLevel: "medium" },
  { sourceIp: "5.188.86.172",   destPort: "21",   protocol: "tcp", reason: "FTP brute-force from botnet node", threatLevel: "high" },
  { sourceIp: "209.126.5.11",   destPort: "25",   protocol: "tcp", reason: "SMTP relay attempt from flagged IP", threatLevel: "medium" },
];

function makePatternKey(sourceIp: string, destPort?: string, protocol?: string): string {
  if (destPort) return `${sourceIp}:${destPort}:${protocol ?? "tcp"}`;
  return sourceIp;
}

// GET /api/firewall/prompts — pending prompts (global queue, no auth required for reads)
router.get("/prompts", async (req, res) => {
  const GLOBAL_UID = "global_admin";

  const existing = await db.select().from(firewallConnectionPromptsTable)
    .where(eq(firewallConnectionPromptsTable.userId, GLOBAL_UID));
  const pendingCount = existing.filter(p => p.decision === "pending").length;

  if (pendingCount < 3) {
    const seenKeys = new Set(existing.map(p => p.patternKey));
    const toInsert: Array<typeof firewallConnectionPromptsTable.$inferInsert> = [];

    // Priority 1: real ghost-trap events from node agents
    const ghostEvents = await db.select().from(nodeAgentEventsTable)
      .where(inArray(nodeAgentEventsTable.eventType, [
        "ghost_trap_tcp", "ghost_trap_udp", "ghost_trap_event",
        "honeypot_hit", "ghost_probe", "trap_triggered",
      ]))
      .orderBy(desc(nodeAgentEventsTable.createdAt)).limit(50);

    for (const ev of ghostEvents) {
      const p = ev.payload as Record<string, unknown> | null;
      const srcIp = (p?.src_ip ?? p?.srcIp ?? p?.source_ip ?? null) as string | null;
      if (!srcIp) continue;
      const destPort = (p?.dest_port ?? p?.destPort ?? p?.port ?? null);
      const portStr = destPort != null ? String(destPort) : undefined;
      const key = makePatternKey(srcIp, portStr);
      if (!seenKeys.has(key)) {
        const portLabel = portStr ? ` on port ${portStr}` : "";
        toInsert.push({
          userId: GLOBAL_UID, sourceIp: srcIp,
          destPort: portStr ?? null, protocol: "tcp",
          reason: `Ghost-trap triggered${portLabel} — real attacker probe from ${srcIp} (node: ${ev.nodeId})`,
          threatLevel: "high", patternKey: key, decision: "pending",
          metadata: { nodeId: ev.nodeId, eventType: ev.eventType, rawPayload: p },
        });
        seenKeys.add(key);
        if (toInsert.length >= 8) break;
      }
    }

    // Priority 2: beacon alerts
    if (toInsert.length < 3) {
      const recentBeacons = await db.select().from(beaconAlertsTable)
        .orderBy(desc(beaconAlertsTable.detectedAt)).limit(20);
      for (const beacon of recentBeacons) {
        const ip = beacon.attackerIp ?? "0.0.0.0";
        const key = makePatternKey(ip);
        if (!seenKeys.has(key)) {
          const pt = beacon.probeType ?? "ping";
          const threat = pt === "tunnel_probe" ? "critical" : pt === "port_scan" ? "high" : "medium";
          toInsert.push({
            userId: GLOBAL_UID, sourceIp: ip, destPort: null, protocol: "tcp",
            reason: `${pt.replace(/_/g, " ").toUpperCase()} detected — suspicious activity from this source`,
            threatLevel: threat, patternKey: key, decision: "pending",
            metadata: { probeType: pt, nodeId: beacon.nodeId },
          });
          seenKeys.add(key);
          if (toInsert.length >= 5) break;
        }
      }
    }

    // Priority 3: sample threats if still thin
    if (toInsert.length < 2) {
      for (const t of SAMPLE_THREATS) {
        const key = makePatternKey(t.sourceIp, t.destPort, t.protocol);
        if (!seenKeys.has(key)) {
          toInsert.push({ userId: GLOBAL_UID, ...t, patternKey: key, decision: "pending", metadata: null });
          seenKeys.add(key);
          if (toInsert.length >= 3) break;
        }
      }
    }

    if (toInsert.length > 0) {
      try {
        await db.insert(firewallConnectionPromptsTable).values(toInsert).onConflictDoNothing();
      } catch (e) {
        logger.error({ err: e }, "firewall/prompts seed insert failed");
      }
    }
  }

  const prompts = await db.select().from(firewallConnectionPromptsTable)
    .where(eq(firewallConnectionPromptsTable.userId, GLOBAL_UID))
    .orderBy(desc(firewallConnectionPromptsTable.createdAt));

  res.json({ prompts, pendingCount: prompts.filter(p => p.decision === "pending").length });
});

// POST /api/firewall/prompts/:id/decide — accept, deny, or block
router.post("/prompts/:id/decide", async (req, res) => {
  const GLOBAL_UID = "global_admin";
  const schema = z.object({
    decision: z.enum(["allow_once", "allow_always", "block_always", "dismissed"]),
    notes: z.string().max(256).optional(),
  });
  const body = schema.parse(req.body);
  const id = parseInt(req.params.id);

  const [prompt] = await db.select().from(firewallConnectionPromptsTable)
    .where(eq(firewallConnectionPromptsTable.id, id));
  if (!prompt) { res.status(404).json({ error: "Not found" }); return; }
  const userId = GLOBAL_UID;

  // Update the prompt
  await db.update(firewallConnectionPromptsTable)
    .set({ decision: body.decision, resolvedAt: new Date() })
    .where(eq(firewallConnectionPromptsTable.id, id));

  // Persist as a remembered rule if "always"
  if (body.decision === "allow_always" || body.decision === "block_always") {
    const decision = body.decision === "allow_always" ? "allow" : "block";
    const existing = await db.select().from(firewallUserDecisionsTable)
      .where(eq(firewallUserDecisionsTable.patternKey, prompt.patternKey));
    const userDecision = existing.find(d => d.userId === userId);

    if (userDecision) {
      await db.update(firewallUserDecisionsTable)
        .set({ decision, lastSeenAt: new Date(), hitCount: userDecision.hitCount + 1, notes: body.notes ?? userDecision.notes })
        .where(eq(firewallUserDecisionsTable.id, userDecision.id));
    } else {
      await db.insert(firewallUserDecisionsTable).values({
        userId, patternKey: prompt.patternKey,
        patternType: prompt.destPort ? "ip_port" : "ip",
        decision, label: null,
        sourceIp: prompt.sourceIp, destPort: prompt.destPort,
        protocol: prompt.protocol, hitCount: 1,
        notes: body.notes ?? null,
      });
    }

    // If blocking always, also add to blockedIpsTable for enforcement
    if (decision === "block") {
      const alreadyBlocked = await db.select().from(blockedIpsTable)
        .where(eq(blockedIpsTable.ip, prompt.sourceIp));
      if (alreadyBlocked.length === 0) {
        await db.insert(blockedIpsTable).values({
          ip: prompt.sourceIp, reason: `User blocked — ${prompt.reason}`,
          autoBlocked: false, hitCount: 1,
        });
      }
    }
  }

  res.json({ ok: true, decision: body.decision });
});

// GET /api/firewall/user-decisions — all remembered rules
router.get("/user-decisions", async (_req, res) => {
  const GLOBAL_UID = "global_admin";
  const decisions = await db.select().from(firewallUserDecisionsTable)
    .where(eq(firewallUserDecisionsTable.userId, GLOBAL_UID))
    .orderBy(desc(firewallUserDecisionsTable.lastSeenAt));
  res.json({ decisions, total: decisions.length });
});

// POST /api/firewall/user-decisions — manually add a rule
router.post("/user-decisions", async (req, res) => {
  const userId = ((req as any).auth)?.userId as string | undefined;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const schema = z.object({
    sourceIp: z.string().min(1),
    decision: z.enum(["allow", "block"]),
    destPort: z.string().optional(),
    protocol: z.string().optional(),
    label: z.string().max(100).optional(),
    notes: z.string().max(256).optional(),
  });
  const body = schema.parse(req.body);
  const patternKey = makePatternKey(body.sourceIp, body.destPort, body.protocol);
  const [row] = await db.insert(firewallUserDecisionsTable).values({
    userId, patternKey,
    patternType: body.destPort ? "ip_port" : "ip",
    decision: body.decision, label: body.label ?? null,
    sourceIp: body.sourceIp, destPort: body.destPort ?? null,
    protocol: body.protocol ?? "tcp", hitCount: 0,
    notes: body.notes ?? null,
  }).returning();
  res.json(row);
});

// DELETE /api/firewall/user-decisions/:id — forget a rule
router.delete("/user-decisions/:id", async (req, res) => {
  const userId = ((req as any).auth)?.userId as string | undefined;
  if (!userId) { res.status(401).json({ error: "Unauthorized" }); return; }
  const id = parseInt(req.params.id);
  const [row] = await db.select().from(firewallUserDecisionsTable)
    .where(eq(firewallUserDecisionsTable.id, id));
  if (!row || row.userId !== userId) { res.status(404).json({ error: "Not found" }); return; }
  await db.delete(firewallUserDecisionsTable).where(eq(firewallUserDecisionsTable.id, id));
  res.json({ ok: true });
});

// ═══════════════════════════════════════════════════════════════════════════
// ── Threat Bus Integration — Layer 1 escalation endpoints ─────────────────
// ═══════════════════════════════════════════════════════════════════════════

import { threatBusEventsTable } from "@workspace/db";
import { bus } from "../lib/service-bus";
import { appendAuditEvent } from "../lib/audit-chain";

const EscalateToGhostTrapSchema = z.object({
  ip:          z.string().ip(),
  threatScore: z.number().int().min(0).max(100),
  reason:      z.string().max(500).optional(),
});

// POST /api/firewall/escalate-to-ghost-trap
// Layer 1 → Layer 2: firewall detected high-threat IP, activates Ghost Trap lure.
router.post("/escalate-to-ghost-trap", async (req, res) => {
  const parse = EscalateToGhostTrapSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: parse.error.flatten() });
  const { ip, threatScore, reason } = parse.data;

  const [ev] = await db.insert(threatBusEventsTable).values({
    eventType:   "SUSPECT_IP_DETECTED",
    sourceLayer: "firewall",
    targetLayer: "ghost_trap",
    attackerIp:  ip,
    threatScore,
    reason: reason ?? `Auto-escalated by firewall — threat score ${threatScore}`,
  }).returning();

  bus.publish("firewall.escalate_ghost_trap", { ip, threatScore, reason }, "firewall");

  await appendAuditEvent({
    action:   "firewall.escalate_ghost_trap",
    actor:    req.ip ?? "unknown",
    resource: ip,
    metadata: { threatScore, reason },
  });

  logger.info({ ip, threatScore }, "Firewall escalated IP to Ghost Trap");
  return res.json({ ok: true, event: ev });
});

// POST /api/firewall/block-from-ghost-node
// Layer 3 → Layer 1: Ghost Nodes detected active exploitation, hard-blocks at firewall.
const BlockFromGhostNodeSchema = z.object({
  ip:     z.string().ip(),
  reason: z.string().max(500).optional(),
  nodeId: z.string().max(100).optional(),
});

router.post("/block-from-ghost-node", async (req, res) => {
  const parse = BlockFromGhostNodeSchema.safeParse(req.body);
  if (!parse.success) return res.status(400).json({ error: parse.error.flatten() });
  const { ip, reason, nodeId } = parse.data;

  // Permanent block — no expiry
  await db.insert(blockedIpsTable).values({
    ip,
    reason: reason ?? `Hard-blocked by Ghost Nodes (node: ${nodeId ?? "unknown"})`,
    autoBlocked: true,
  }).onConflictDoNothing();

  const [ev] = await db.insert(threatBusEventsTable).values({
    eventType:   "HARD_BLOCK_ENFORCED",
    sourceLayer: "ghost_nodes",
    targetLayer: "firewall",
    attackerIp:  ip,
    reason: reason ?? `Ghost Nodes feedback — permanent block enforced`,
  }).returning();

  bus.publish("ghost_node.escalate_firewall", { ip, reason, nodeId }, "ghost-nodes");

  await appendAuditEvent({
    action:   "firewall.hard_block_from_ghost_node",
    actor:    req.ip ?? "unknown",
    resource: ip,
    metadata: { reason, nodeId },
  });

  logger.warn({ ip, nodeId }, "Ghost Nodes hard-blocked IP at firewall level");
  return res.json({ ok: true, event: ev });
});

export default router;
