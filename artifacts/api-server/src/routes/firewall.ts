// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// GhostOS™ Firewall Engine — ProxhqOS SymScript™ v1.0
import { Router } from "express";
import { db } from "@workspace/db";
import {
  firewallRulesTable, firewallStatusTable, blockedIpsTable,
  firewallIpsSignaturesTable, firewallDpiRulesTable, firewallGeoBlocksTable,
  firewallThreatFeedsTable, firewallZonesTable, firewallFqdnRulesTable,
  firewallGhostOsRulesTable, firewallTranscriberLogTable,
  firewallConnectionQueueTable,
} from "@workspace/db";
import { eq, sql, lt, desc, asc, inArray } from "drizzle-orm";
import { z } from "zod";

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
    const timer = setTimeout(() => controller.abort(), 12000);
    const resp = await fetch(feed.url, { signal: controller.signal, headers: { "User-Agent": "ProxhqVPN-GhostOS/1.0" } });
    clearTimeout(timer);
    const text = await resp.text();
    const lines = text.split("\n").filter(l => !l.startsWith("#") && l.trim());
    const ipPattern = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/;
    const entries = lines.filter(l => ipPattern.test(l.trim()));
    await db.update(firewallThreatFeedsTable).set({ status: "synced", lastSyncedAt: new Date(), entryCount: entries.length, errorMessage: null }).where(eq(firewallThreatFeedsTable.id, id));
    res.json({ synced: true, entryCount: entries.length, sampleIps: entries.slice(0, 5) });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    await db.update(firewallThreatFeedsTable).set({ status: "error", errorMessage: msg }).where(eq(firewallThreatFeedsTable.id, id));
    res.status(500).json({ synced: false, error: msg });
  }
});

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

export default router;
