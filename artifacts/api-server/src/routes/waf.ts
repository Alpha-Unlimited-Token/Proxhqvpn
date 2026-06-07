// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
/**
 * WAF Analyzer — OWASP Rules Engine
 * Copyright © 2024–2026 ALPHA UNLIMITED TECHNOLOGIES LLC
 * All rights reserved. Unauthorized reproduction or distribution prohibited.
 */
import { Router } from "express";
import { db } from "@workspace/db";
import { wafRulesTable, wafEventsTable } from "@workspace/db";
import { eq, sql, desc } from "drizzle-orm";
import { z } from "zod";

const router = Router();

// ── Default OWASP-style rule seeds ────────────────────────────────────────────
const DEFAULT_WAF_RULES = [
  // ── SQLMap Detection ──────────────────────────────────────────────────────
  { name: "SQLMap User-Agent", attackType: "sqlmap" as const, severity: "critical" as const, action: "block" as const, pattern: "sqlmap", target: "ua", description: "Blocks the default SQLMap user-agent string" },
  { name: "SQLMap Version String", attackType: "sqlmap" as const, severity: "critical" as const, action: "block" as const, pattern: "sqlmap\\/\\d+\\.\\d+", target: "ua", description: "Blocks SQLMap version identifiers in UA" },
  { name: "SQLMap UNION SELECT", attackType: "sqlmap" as const, severity: "critical" as const, action: "block" as const, pattern: "(?i)union[\\s+/*]+(?:all[\\s+/*]+)?select", target: "any", description: "UNION-based SQL injection (SQLMap technique)" },
  { name: "SQLMap SLEEP Blind", attackType: "sqlmap" as const, severity: "critical" as const, action: "block" as const, pattern: "(?i)(?:sleep|benchmark|pg_sleep|waitfor\\s+delay)\\s*\\(", target: "any", description: "Time-based blind SQLi (SQLMap SLEEP technique)" },
  { name: "SQLMap Space2Comment Tamper", attackType: "sqlmap" as const, severity: "high" as const, action: "block" as const, pattern: "\\/\\*[^*]*\\*\\/", target: "any", description: "SQL comment obfuscation (space2comment tamper)" },
  { name: "SQLMap CHAR() Encoding", attackType: "sqlmap" as const, severity: "high" as const, action: "block" as const, pattern: "(?i)char\\s*\\(\\s*\\d+", target: "any", description: "CHAR() encoding tamper script (charencode)" },
  { name: "SQLMap Boolean Blind", attackType: "sqlmap" as const, severity: "high" as const, action: "block" as const, pattern: "(?i)'\\s*(?:and|or)\\s+[\\d]+[=><]", target: "any", description: "Boolean-based blind SQLi payloads" },
  { name: "SQLMap Error-Based", attackType: "sqlmap" as const, severity: "high" as const, action: "block" as const, pattern: "(?i)(?:extractvalue|updatexml|geometrycollection|multipoint)\\s*\\(", target: "any", description: "Error-based SQLi extraction functions" },
  { name: "SQLMap Stacked Queries", attackType: "sqlmap" as const, severity: "high" as const, action: "alert" as const, pattern: "(?i);\\s*(?:select|insert|update|delete|drop|exec)", target: "any", description: "Stacked query injection technique" },

  // ── SQL Injection ─────────────────────────────────────────────────────────
  { name: "Classic OR 1=1", attackType: "sqli" as const, severity: "critical" as const, action: "block" as const, pattern: "(?i)'\\s*(?:or|and)\\s+['\"]?\\d+['\"]?\\s*[=<>]", target: "any", description: "Classic OR/AND SQL injection payloads" },
  { name: "SQL DROP TABLE", attackType: "sqli" as const, severity: "critical" as const, action: "block" as const, pattern: "(?i)drop\\s+(?:table|database|schema|index)", target: "any", description: "Destructive SQL DDL commands" },
  { name: "SQL Comment Strip", attackType: "sqli" as const, severity: "high" as const, action: "block" as const, pattern: "(?i)(?:#|--|;\\/\\*)", target: "any", description: "SQL comment injection (comment-out payloads)" },
  { name: "SQL INFORMATION_SCHEMA", attackType: "sqli" as const, severity: "high" as const, action: "block" as const, pattern: "(?i)information_schema\\s*\\.\\s*(?:tables|columns|schemata)", target: "any", description: "Database enumeration via INFORMATION_SCHEMA" },
  { name: "SQL HEX Encoding", attackType: "sqli" as const, severity: "medium" as const, action: "alert" as const, pattern: "(?i)0x[0-9a-f]{4,}", target: "any", description: "Hex-encoded SQL payloads" },
  { name: "SQL EXEC xp_cmdshell", attackType: "sqli" as const, severity: "critical" as const, action: "block" as const, pattern: "(?i)(?:exec|execute)\\s+(?:xp_|sp_)", target: "any", description: "MSSQL stored procedure exploitation" },

  // ── XSS ───────────────────────────────────────────────────────────────────
  { name: "XSS Script Tag", attackType: "xss" as const, severity: "high" as const, action: "block" as const, pattern: "(?i)<\\s*script[^>]*>", target: "any", description: "Inline script tag injection" },
  { name: "XSS Event Handlers", attackType: "xss" as const, severity: "high" as const, action: "block" as const, pattern: "(?i)on(?:error|load|click|mouse|key|focus|blur|change|submit|reset)\\s*=", target: "any", description: "HTML event handler injection (onerror, onload, etc.)" },
  { name: "XSS JavaScript Protocol", attackType: "xss" as const, severity: "high" as const, action: "block" as const, pattern: "(?i)javascript\\s*:", target: "any", description: "javascript: protocol URI injection" },
  { name: "XSS Data URI", attackType: "xss" as const, severity: "medium" as const, action: "alert" as const, pattern: "(?i)data\\s*:\\s*text\\/html", target: "any", description: "data:text/html URI for XSS" },
  { name: "XSS VBScript", attackType: "xss" as const, severity: "medium" as const, action: "block" as const, pattern: "(?i)vbscript\\s*:", target: "any", description: "VBScript URI protocol injection" },
  { name: "XSS Expression CSS", attackType: "xss" as const, severity: "medium" as const, action: "block" as const, pattern: "(?i)expression\\s*\\(", target: "any", description: "CSS expression injection (IE)" },

  // ── LFI / Path Traversal ──────────────────────────────────────────────────
  { name: "Path Traversal ../", attackType: "pathtraversal" as const, severity: "high" as const, action: "block" as const, pattern: "(?:\\.\\.\\/){2,}|(?:\\.\\.\\\\){2,}", target: "url", description: "Directory traversal sequences (../../)" },
  { name: "LFI /etc/passwd", attackType: "lfi" as const, severity: "critical" as const, action: "block" as const, pattern: "(?i)\\/etc\\/(?:passwd|shadow|hosts|sudoers)", target: "any", description: "Linux sensitive file inclusion attempts" },
  { name: "LFI Windows Files", attackType: "lfi" as const, severity: "critical" as const, action: "block" as const, pattern: "(?i)(?:win\\.ini|boot\\.ini|system32\\/|autoexec\\.bat)", target: "any", description: "Windows sensitive file inclusion attempts" },
  { name: "LFI PHP Wrappers", attackType: "lfi" as const, severity: "high" as const, action: "block" as const, pattern: "(?i)php:\\/\\/(?:input|filter|data)", target: "any", description: "PHP stream wrapper abuse (php://filter)" },
  { name: "RFI Remote Include", attackType: "rfi" as const, severity: "critical" as const, action: "block" as const, pattern: "(?i)(?:include|require)(?:_once)?\\s*[\\(\"']\\s*https?:\\/\\/", target: "any", description: "Remote file inclusion via HTTP URL" },

  // ── Command Injection ─────────────────────────────────────────────────────
  { name: "OS Command Chaining", attackType: "cmdi" as const, severity: "critical" as const, action: "block" as const, pattern: "(?:[|;`&]{1,2}|\\$\\()\\s*(?:cat|ls|id|whoami|uname|curl|wget|bash|sh|nc|python|perl)", target: "any", description: "OS command injection via shell chaining" },
  { name: "Command Injection Backtick", attackType: "cmdi" as const, severity: "critical" as const, action: "block" as const, pattern: "`[^`]*(?:cat|ls|id|whoami|passwd)[^`]*`", target: "any", description: "Backtick command substitution injection" },
  { name: "Reverse Shell Patterns", attackType: "cmdi" as const, severity: "critical" as const, action: "block" as const, pattern: "(?i)(?:bash|python|nc|ncat).*(?:-[ei]|/dev/tcp)", target: "any", description: "Reverse shell command patterns" },

  // ── SSRF ──────────────────────────────────────────────────────────────────
  { name: "SSRF Internal IP", attackType: "ssrf" as const, severity: "high" as const, action: "block" as const, pattern: "(?:https?:\\/\\/)?(?:127\\.\\d+\\.\\d+\\.\\d+|10\\.\\d+\\.\\d+\\.\\d+|172\\.(?:1[6-9]|2\\d|3[01])\\.\\d+\\.\\d+|192\\.168\\.\\d+\\.\\d+)", target: "any", description: "SSRF targeting RFC1918 private IP ranges" },
  { name: "SSRF localhost", attackType: "ssrf" as const, severity: "high" as const, action: "block" as const, pattern: "(?i)(?:localhost|127\\.0\\.0\\.1|\\[::1\\]|0\\.0\\.0\\.0)", target: "any", description: "SSRF via localhost/loopback references" },
  { name: "SSRF Cloud Metadata", attackType: "ssrf" as const, severity: "critical" as const, action: "block" as const, pattern: "169\\.254\\.169\\.254|metadata\\.google\\.internal", target: "any", description: "SSRF targeting cloud provider metadata endpoints" },

  // ── XXE ───────────────────────────────────────────────────────────────────
  { name: "XXE DOCTYPE Entity", attackType: "xxe" as const, severity: "critical" as const, action: "block" as const, pattern: "(?i)<!\\s*(?:DOCTYPE|ENTITY)\\s", target: "body", description: "XXE DOCTYPE/ENTITY declaration injection" },
  { name: "XXE External Entity", attackType: "xxe" as const, severity: "critical" as const, action: "block" as const, pattern: "SYSTEM\\s+['\"](?:file|https?|ftp):\\/\\/", target: "body", description: "XXE external entity file/URL reference" },

  // ── SSTI ──────────────────────────────────────────────────────────────────
  { name: "SSTI Template Syntax", attackType: "ssti" as const, severity: "high" as const, action: "block" as const, pattern: "(?:\\{\\{.*?\\}\\}|\\$\\{.*?\\}|\\{%.*?%\\})", target: "any", description: "Server-side template injection syntax (Jinja2, Twig, Freemarker)" },
  { name: "SSTI Python Eval", attackType: "ssti" as const, severity: "critical" as const, action: "block" as const, pattern: "(?i)__class__|__mro__|__subclasses__|__import__", target: "any", description: "Python SSTI class traversal payloads" },
  { name: "SSTI Freemarker RCE", attackType: "ssti" as const, severity: "critical" as const, action: "block" as const, pattern: "(?i)freemarker\\.template\\.utility\\.Execute|freemarker\\.template", target: "any", description: "Freemarker template engine RCE payload" },
  { name: "SSTI Jinja2 os.popen", attackType: "ssti" as const, severity: "critical" as const, action: "block" as const, pattern: "(?i)os\\.popen|os\\.system|subprocess\\.call|subprocess\\.Popen", target: "any", description: "Jinja2/Python template OS execution" },

  // ── NoSQL Injection ───────────────────────────────────────────────────────
  { name: "NoSQL MongoDB Operators", attackType: "sqli" as const, severity: "high" as const, action: "block" as const, pattern: "(?i)\\$(?:ne|gt|gte|lt|lte|in|nin|or|and|not|nor|exists|type|where|regex)", target: "any", description: "MongoDB NoSQL injection operators ($ne, $gt, $where, etc.)" },
  { name: "NoSQL $where JS Injection", attackType: "sqli" as const, severity: "critical" as const, action: "block" as const, pattern: "(?i)\\$where.*function|\\$where.*sleep|\\$where.*this\\.", target: "any", description: "MongoDB $where JavaScript execution injection" },

  // ── Prototype Pollution ───────────────────────────────────────────────────
  { name: "Prototype Pollution __proto__", attackType: "other" as const, severity: "high" as const, action: "block" as const, pattern: "__proto__|constructor\\[prototype\\]|constructor\\.prototype", target: "any", description: "JavaScript prototype pollution via __proto__ or constructor.prototype" },

  // ── CRLF / Header Injection ───────────────────────────────────────────────
  { name: "CRLF Injection", attackType: "other" as const, severity: "high" as const, action: "block" as const, pattern: "%0[dD]%0[aA]|\\\\r\\\\n|%0a|%0d", target: "any", description: "CRLF sequence injection for HTTP response splitting" },
  { name: "CRLF Header Injection", attackType: "other" as const, severity: "high" as const, action: "block" as const, pattern: "(?i)(?:set-cookie|location|content-type).*(?:%0a|%0d|\\\\r|\\\\n)", target: "any", description: "Header injection via CRLF in redirect parameters" },

  // ── HTTP Request Smuggling ────────────────────────────────────────────────
  { name: "Transfer-Encoding Obfuscation", attackType: "other" as const, severity: "high" as const, action: "alert" as const, pattern: "(?i)transfer-encoding\\s*:\\s*(?!chunked|identity)", target: "header", description: "Non-standard Transfer-Encoding value (potential smuggling)" },

  // ── GraphQL Attacks ───────────────────────────────────────────────────────
  { name: "GraphQL Introspection", attackType: "other" as const, severity: "medium" as const, action: "alert" as const, pattern: "(?i)__schema|__type|__typename|IntrospectionQuery", target: "body", description: "GraphQL schema introspection queries" },
  { name: "GraphQL Mutation Attack", attackType: "other" as const, severity: "medium" as const, action: "alert" as const, pattern: "(?i)mutation.*(?:delete|drop|remove|destroy|truncate)", target: "body", description: "Destructive GraphQL mutation operations" },

  // ── WAF Bypass Techniques ─────────────────────────────────────────────────
  { name: "Double URL Encoding", attackType: "other" as const, severity: "medium" as const, action: "alert" as const, pattern: "%25(?:2[0-9a-fA-F]|3[0-9a-fA-F])", target: "url", description: "Double URL encoding (bypasses basic decoders)" },
  { name: "Unicode Fullwidth Chars", attackType: "other" as const, severity: "medium" as const, action: "alert" as const, pattern: "[\\uFF01-\\uFF5E]", target: "any", description: "Unicode fullwidth character injection for WAF bypass" },
  { name: "HTTP Verb Tampering", attackType: "other" as const, severity: "medium" as const, action: "alert" as const, pattern: "(?i)x-http-method-override|x-method-override|x-original-method", target: "header", description: "HTTP method override header (verb tampering)" },
  { name: "IP Spoofing Headers", attackType: "other" as const, severity: "medium" as const, action: "alert" as const, pattern: "(?i)x-forwarded-for:\\s*(?:127\\.0\\.0\\.1|localhost|0\\.0\\.0\\.0|10\\.|192\\.168\\.|172\\.(?:1[6-9]|2[0-9]|3[01])\\.)", target: "header", description: "X-Forwarded-For spoofed to localhost/internal IP" },
  { name: "Admin Path Override", attackType: "other" as const, severity: "high" as const, action: "alert" as const, pattern: "(?i)x-original-url:\\s*\\/admin|x-rewrite-url:\\s*\\/admin", target: "header", description: "Admin path access via X-Original-URL/X-Rewrite-URL" },

  // ── Deserialization ────────────────────────────────────────────────────────
  { name: "Java Serialization Magic Bytes", attackType: "other" as const, severity: "critical" as const, action: "block" as const, pattern: "rO0AB|\\xac\\xed\\x00\\x05", target: "body", description: "Java serialized object magic bytes (rO0AB base64 / 0xAC 0xED raw)" },
  { name: "PHP Object Injection", attackType: "other" as const, severity: "high" as const, action: "block" as const, pattern: "O:\\d+:\"\\w+\":\\d+:\\{", target: "body", description: "PHP serialized object injection pattern O:N:\"ClassName\"" },

  // ── Scanner/Tool Detection ────────────────────────────────────────────────
  { name: "Nikto Scanner", attackType: "other" as const, severity: "medium" as const, action: "alert" as const, pattern: "(?i)nikto", target: "ua", description: "Nikto web vulnerability scanner user-agent" },
  { name: "Nmap Scanner", attackType: "other" as const, severity: "medium" as const, action: "alert" as const, pattern: "(?i)nmap|masscan|zmap", target: "ua", description: "Port scanner user-agent detection" },
  { name: "Burp Suite Scanner", attackType: "other" as const, severity: "medium" as const, action: "alert" as const, pattern: "(?i)burpsuite|burp suite|burp\\s", target: "ua", description: "Burp Suite active scanner user-agent" },
  { name: "OWASP ZAP Scanner", attackType: "other" as const, severity: "medium" as const, action: "alert" as const, pattern: "(?i)owasp\\s*zap|zaproxy|ZAP/", target: "ua", description: "OWASP ZAP proxy scanner user-agent" },
  { name: "Nuclei Scanner", attackType: "other" as const, severity: "medium" as const, action: "alert" as const, pattern: "(?i)nuclei|ProjectDiscovery", target: "ua", description: "Nuclei vulnerability scanner user-agent" },
  { name: "Gobuster/ffuf Scanner", attackType: "other" as const, severity: "medium" as const, action: "alert" as const, pattern: "(?i)gobuster|ffuf|feroxbuster|dirbuster|dirb", target: "ua", description: "Directory fuzzing tool user-agents" },

  // ── Log4Shell / Log4j2 (CVE-2021-44228 and variants) ─────────────────────
  { name: "Log4Shell JNDI LDAP", attackType: "other" as const, severity: "critical" as const, action: "block" as const, pattern: "(?i)\\$\\{jndi:(ldap|ldaps|rmi|dns|iiop|nis|nds|corba)://", target: "any", description: "Log4Shell JNDI injection (CVE-2021-44228) — all protocol variants" },
  { name: "Log4Shell Obfuscated", attackType: "other" as const, severity: "critical" as const, action: "block" as const, pattern: "(?i)\\$\\{(?:lower|upper|:\\-[^}]*):.*jndi|jndi.*(?:%24|%7b|\\$\\{)", target: "any", description: "Log4Shell with case-function and URL-encoded obfuscation bypass" },
  { name: "Log4j Nested Interpolation", attackType: "other" as const, severity: "critical" as const, action: "block" as const, pattern: "\\$\\{\\$\\{|\\$\\{.*\\$\\{.*jndi", target: "any", description: "Nested interpolation Log4j bypass (${${lower:j}ndi:...})" },

  // ── Spring4Shell (CVE-2022-22965) ─────────────────────────────────────────
  { name: "Spring4Shell Class Loader", attackType: "other" as const, severity: "critical" as const, action: "block" as const, pattern: "class\\.module\\.classLoader|class\\.classLoader\\.(?:URLs|parent)", target: "any", description: "Spring4Shell RCE via class loader manipulation (CVE-2022-22965)" },
  { name: "Spring EL Injection", attackType: "ssti" as const, severity: "critical" as const, action: "block" as const, pattern: "(?i)T\\(java\\.lang\\.Runtime\\)\\.getRuntime\\(\\)|Runtime\\.exec|new\\s+ProcessBuilder", target: "any", description: "Spring Expression Language (SpEL) RCE injection" },

  // ── LDAP Injection ────────────────────────────────────────────────────────
  { name: "LDAP Injection Basic", attackType: "sqli" as const, severity: "high" as const, action: "block" as const, pattern: "(?i)\\*\\)\\(|\\)\\(\\*|\\(\\|\\(|\\)\\|\\(.*=.*\\)", target: "any", description: "LDAP query injection via parenthesis and wildcard manipulation" },
  { name: "LDAP Filter Bypass", attackType: "sqli" as const, severity: "high" as const, action: "block" as const, pattern: "(?i)\\(cn=\\*\\)|\\(objectClass=\\*\\)|\\*\\)\\(objectClass=", target: "any", description: "LDAP filter bypass — wildcard objectClass queries" },

  // ── XPath Injection ───────────────────────────────────────────────────────
  { name: "XPath Injection", attackType: "sqli" as const, severity: "high" as const, action: "block" as const, pattern: "(?i)\\bor\\b.*\\b1\\b\\s*=\\s*\\b1\\b.*\\]|\\bselect\\b.*\\bfrom\\b.*xpath|//@|//\\*\\[", target: "any", description: "XPath query injection via boolean conditions and node selection" },

  // ── Server-Side Includes (SSI) ────────────────────────────────────────────
  { name: "SSI Injection", attackType: "cmdi" as const, severity: "high" as const, action: "block" as const, pattern: "<!--\\s*#(?:exec|include|echo|set|if|elif|else|endif|printenv)\\s", target: "any", description: "Server-Side Include injection (exec, include, echo directives)" },

  // ── OGNL Injection (Apache Struts) ────────────────────────────────────────
  { name: "OGNL Expression Injection", attackType: "ssti" as const, severity: "critical" as const, action: "block" as const, pattern: "(?i)%\\{.*@java\\.lang\\.Runtime|#_memberAccess|@ognl\\.OgnlContext|\\$\\{@|%\\{#context", target: "any", description: "OGNL expression injection (Apache Struts CVE-2017-5638, CVE-2013-2251)" },

  // ── PowerShell / Base64 Encoded Payloads ─────────────────────────────────
  { name: "PowerShell Encoded Command", attackType: "cmdi" as const, severity: "critical" as const, action: "block" as const, pattern: "(?i)powershell.*-(?:enc|encodedcommand|e)\\s+[A-Za-z0-9+/=]{20,}", target: "any", description: "PowerShell base64-encoded command execution (-enc / -EncodedCommand)" },
  { name: "PowerShell Download Cradle", attackType: "cmdi" as const, severity: "critical" as const, action: "block" as const, pattern: "(?i)(?:IEX|Invoke-Expression).*(?:Net\\.WebClient|WebRequest|iwr|wget)|System\\.Reflection\\.Assembly.*Load", target: "any", description: "PowerShell download cradle (IEX + WebClient, in-memory assembly load)" },
  { name: "Base64 Encoded Shellcode", attackType: "cmdi" as const, severity: "high" as const, action: "alert" as const, pattern: "(?:[A-Za-z0-9+/]{4}){10,}={0,2}.*(?:bash|sh|exec|eval|system|passthru|popen)", target: "any", description: "Base64 blob followed by common shell execution keywords — likely encoded payload" },

  // ── Host Header Injection ─────────────────────────────────────────────────
  { name: "Host Header Injection", attackType: "ssrf" as const, severity: "high" as const, action: "block" as const, pattern: "(?i)^host:\\s*(?:[^\\r\\n]*@|[^\\r\\n]*#|[^\\r\\n]*\\s)", target: "header", description: "Host header injection via @ character, fragment, or whitespace smuggling" },
  { name: "X-Host Override", attackType: "ssrf" as const, severity: "medium" as const, action: "alert" as const, pattern: "(?i)x-forwarded-host:|x-host:|x-original-host:", target: "header", description: "Host override via proxy headers (X-Forwarded-Host, X-Host, X-Original-Host)" },

  // ── Open Redirect ─────────────────────────────────────────────────────────
  { name: "Open Redirect URL", attackType: "other" as const, severity: "medium" as const, action: "alert" as const, pattern: "(?i)(?:redirect|return_to|next|url|goto|dest|destination|redir|redirect_uri)=(?:https?|ftp|javascript)://(?!(?:localhost|127\\.|10\\.|192\\.168\\.|172\\.))", target: "url", description: "Open redirect via unvalidated redirect URL parameter" },

  // ── Cache Poisoning ───────────────────────────────────────────────────────
  { name: "Cache Poisoning via Header", attackType: "other" as const, severity: "high" as const, action: "alert" as const, pattern: "(?i)x-forwarded-scheme:|x-forwarded-proto:\\s*(?!https?$)|x-rewrite-url:", target: "header", description: "Web cache poisoning via unkeyed HTTP headers (X-Forwarded-Scheme, X-Rewrite-URL)" },

  // ── Null Byte Injection ───────────────────────────────────────────────────
  { name: "Null Byte Injection", attackType: "pathtraversal" as const, severity: "high" as const, action: "block" as const, pattern: "%00|\\x00|\\u0000", target: "any", description: "Null byte injection (file extension bypass, truncation attacks)" },

  // ── Unicode Normalization Attack ──────────────────────────────────────────
  { name: "Unicode Overlong Encoding", attackType: "pathtraversal" as const, severity: "medium" as const, action: "alert" as const, pattern: "%c0%ae|%c0%af|%e0%80%ae|%f0%80%80%ae|%c1%9c", target: "url", description: "Unicode overlong encoding of / and . (WAF bypass via non-canonical encoding)" },

  // ── HTTP Request Smuggling (extended) ─────────────────────────────────────
  { name: "Chunked Encoding Abuse", attackType: "other" as const, severity: "high" as const, action: "alert" as const, pattern: "(?i)transfer-encoding:\\s*chunked.*content-length:|content-length:.*transfer-encoding:\\s*chunked", target: "header", description: "HTTP request smuggling (CL+TE / TE+CL ambiguity)" },
  { name: "HTTP/2 Downgrade Attack", attackType: "other" as const, severity: "medium" as const, action: "alert" as const, pattern: "(?i)upgrade:\\s*h2c|connection:\\s*upgrade.*upgrade:\\s*h2", target: "header", description: "HTTP/2 cleartext upgrade (h2c) smuggling attack" },

  // ── SSRF via Protocol Schemes ─────────────────────────────────────────────
  { name: "SSRF Gopher Protocol", attackType: "ssrf" as const, severity: "critical" as const, action: "block" as const, pattern: "(?i)gopher://|dict://|ftp://(?:(?:127|10|192\\.168|172\\.(?:1[6-9]|2\\d|3[01]))\\.)", target: "any", description: "SSRF via Gopher/Dict/FTP protocols targeting internal resources" },
  { name: "SSRF File Protocol", attackType: "ssrf" as const, severity: "critical" as const, action: "block" as const, pattern: "(?i)file:///(?:etc/passwd|proc/self|windows/win\\.ini|boot\\.ini)", target: "any", description: "SSRF via file:// protocol to read local system files" },
  { name: "SSRF IPv6 Loopback", attackType: "ssrf" as const, severity: "high" as const, action: "block" as const, pattern: "(?i)(?:https?://)?(?:\\[::1\\]|\\[::ffff:127\\.0\\.0\\.1\\]|\\[0:0:0:0:0:0:0:1\\])", target: "any", description: "SSRF via IPv6 loopback address bypass" },

  // ── Java/Python Deserialization ───────────────────────────────────────────
  { name: "Python Pickle Injection", attackType: "other" as const, severity: "critical" as const, action: "block" as const, pattern: "(?i)cos\\.system|csubprocess\\.check_output|cbuiltins\\.exec|cpickle\\.loads", target: "body", description: "Python pickle deserialization RCE (os.system, subprocess, exec opcodes)" },
  { name: "Ruby Marshal Injection", attackType: "other" as const, severity: "high" as const, action: "block" as const, pattern: "\\x04\\x08|\\\\x04\\\\x08", target: "body", description: "Ruby Marshal deserialization magic bytes (0x04 0x08)" },

  // ── DNS Rebinding ──────────────────────────────────────────────────────────
  { name: "DNS Rebinding Pattern", attackType: "ssrf" as const, severity: "high" as const, action: "alert" as const, pattern: "(?i)(?:1\\.1\\.1\\.1|127\\.0\\.0\\.1)\\.nip\\.io|localtest\\.me|vcap\\.me|\\d{1,3}-\\d{1,3}-\\d{1,3}-\\d{1,3}\\.sslip\\.io", target: "any", description: "DNS rebinding via nip.io, sslip.io, vcap.me — maps to internal IPs" },

  // ── WebDAV Abuse ──────────────────────────────────────────────────────────
  { name: "WebDAV PROPFIND Recon", attackType: "other" as const, severity: "medium" as const, action: "alert" as const, pattern: "(?i)^propfind$|^mkcol$|^copy$|^move$|^lock$|^unlock$", target: "any", description: "WebDAV method abuse (PROPFIND/MKCOL/COPY/MOVE) for enumeration or file upload" },

  // ── Kubernetes / Docker API Abuse ─────────────────────────────────────────
  { name: "Kubernetes API Probe", attackType: "other" as const, severity: "high" as const, action: "alert" as const, pattern: "(?i)/api/v1/(?:pods|namespaces|secrets|configmaps)|/apis/apps/v1|kubernetes\\.io", target: "url", description: "Kubernetes API server endpoint enumeration" },
  { name: "Docker API Probe", attackType: "other" as const, severity: "high" as const, action: "alert" as const, pattern: "(?i)/v\\d+\\.\\d+/containers/json|/v\\d+\\.\\d+/images/json|/docker\\.sock", target: "url", description: "Docker daemon API enumeration via socket or TCP" },

  // ── More Command Injection Variants ───────────────────────────────────────
  { name: "Newline Command Injection", attackType: "cmdi" as const, severity: "high" as const, action: "block" as const, pattern: "(?:%0a|%0d|\\\\n|\\\\r)(?:ls|cat|id|whoami|wget|curl|bash|sh|python|perl|ruby|nc)", target: "any", description: "Newline-injected OS command via URL-encoded %0a/%0d or escaped \\n" },
  { name: "IFS Variable Abuse", attackType: "cmdi" as const, severity: "high" as const, action: "block" as const, pattern: "\\$IFS|\\${IFS}|\\$\\(\\$IFS\\)", target: "any", description: "Internal Field Separator ($IFS) abuse to bypass command whitespace filters" },
  { name: "Glob Pattern Injection", attackType: "cmdi" as const, severity: "medium" as const, action: "alert" as const, pattern: "(?:^|[^\\w])/[a-z?*]+/[a-z?*]+(?:sh|bin|bash|python|perl|nc)", target: "any", description: "Shell glob pattern injection (/b?sh, /???/sh) to bypass keyword filters" },

  // ── More Path Traversal Variants ──────────────────────────────────────────
  { name: "Path Traversal Double Encode", attackType: "pathtraversal" as const, severity: "high" as const, action: "block" as const, pattern: "(?:%252e|%252f|%255c){2,}|%2e%2e(?:%2f|%5c)", target: "url", description: "Double URL-encoded path traversal (%252e%252e%252f)" },
  { name: "Windows Path Traversal", attackType: "pathtraversal" as const, severity: "high" as const, action: "block" as const, pattern: "(?i)(?:\\.\\.|%2e%2e)(?:%5c|\\\\|%5C)(?:windows|system32|winnt|program files)", target: "any", description: "Windows-specific path traversal targeting system directories" },

  // ── JSONP / Callback Injection ────────────────────────────────────────────
  { name: "JSONP Callback Injection", attackType: "xss" as const, severity: "medium" as const, action: "alert" as const, pattern: "(?i)(?:callback|jsonp|cb)=(?:alert|eval|document|window|location|<script)", target: "url", description: "JSONP callback parameter injected with XSS/JS payload" },

  // ── Template Injection (additional engines) ───────────────────────────────
  { name: "Velocity Template Injection", attackType: "ssti" as const, severity: "critical" as const, action: "block" as const, pattern: "(?i)#set\\s*\\(|\\$\\{.*class\\.forName|#evaluate|#include.*velocity", target: "any", description: "Apache Velocity template injection (RCE via #set, class.forName)" },
  { name: "Pebble/Groovy Template Injection", attackType: "ssti" as const, severity: "critical" as const, action: "block" as const, pattern: "(?i)\\{\\{.*\\.class\\.forName|groovy\\.lang\\.GroovyShell|new groovy", target: "any", description: "Pebble/Groovy template engine RCE injection" },

  // ── C2 Framework Detection ────────────────────────────────────────────────
  { name: "Cobalt Strike Beacon", attackType: "other" as const, severity: "critical" as const, action: "block" as const, pattern: "(?i)msagent|cobaltstrike|beacon\\.dll|\\x00\\x00\\x00\\x00\\x00\\x00\\x00\\x00\\x00\\x00\\x00\\x00MZRE", target: "any", description: "Cobalt Strike beacon traffic pattern detection" },
  { name: "Sliver C2 Framework", attackType: "other" as const, severity: "critical" as const, action: "block" as const, pattern: "(?i)sliver-implant|sliverd|ghostnet|implant-session", target: "any", description: "Sliver C2 framework implant traffic patterns" },
  { name: "Havoc C2 Framework", attackType: "other" as const, severity: "critical" as const, action: "block" as const, pattern: "(?i)havoc-c2|teamserver.*havoc|demonid:", target: "any", description: "Havoc C2 framework demon implant patterns" },
  { name: "Brute Ratel C4", attackType: "other" as const, severity: "critical" as const, action: "block" as const, pattern: "(?i)brute.ratel|badger.*C4|brc4", target: "any", description: "Brute Ratel C4 commercial implant traffic detection" },

  // ── EternalBlue / SMB ─────────────────────────────────────────────────────
  { name: "SMB EternalBlue Pattern", attackType: "other" as const, severity: "critical" as const, action: "block" as const, pattern: "(?i)\\\\x00\\\\x00\\\\x00\\\\x45\\\\x00|SMBr|\\\\x00SMB|NTLMSSP", target: "body", description: "EternalBlue SMB exploitation pattern (CVE-2017-0144, MS17-010)" },

  // ── ProxyLogon / ProxyShell ───────────────────────────────────────────────
  { name: "ProxyLogon Exchange", attackType: "other" as const, severity: "critical" as const, action: "block" as const, pattern: "(?i)/ecp/(?:y\\.js|default\\.flt|find\\.flt|session\\.flt|auth/current\\.flt)|/autodiscover/autodiscover\\.json\\?@", target: "url", description: "ProxyLogon Exchange Server SSRF+RCE (CVE-2021-26855/26858/27065)" },
  { name: "ProxyShell Exchange", attackType: "other" as const, severity: "critical" as const, action: "block" as const, pattern: "(?i)/autodiscover/autodiscover\\.json\\?@.*powershell|/mapi/nspi/", target: "any", description: "ProxyShell Exchange PowerShell SSRF/RCE (CVE-2021-34473/34523/31207)" },

  // ── Authentication Bypass Patterns ────────────────────────────────────────
  { name: "Auth Bypass Array Injection", attackType: "sqli" as const, severity: "high" as const, action: "block" as const, pattern: "(?i)password\\[\\]|password%5b%5d|username\\[\\]|auth\\[\\]", target: "any", description: "PHP/Node array injection to bypass authentication checks" },
  { name: "Mass Assignment Attack", attackType: "other" as const, severity: "high" as const, action: "alert" as const, pattern: "(?i)(?:isAdmin|is_admin|admin|role|superuser|privilege)\\s*[:=]\\s*(?:true|1|yes|\"admin\")", target: "body", description: "Mass assignment attack — attempting to force admin role via request body" },

  // ── SQL Out-of-Band / DNS Exfiltration ────────────────────────────────────
  { name: "SQL DNS Exfiltration", attackType: "sqli" as const, severity: "critical" as const, action: "block" as const, pattern: "(?i)load_file\\s*\\(|into\\s+outfile|utl_file|dbms_ldap|dbms_http|xp_dirtree|openrowset", target: "any", description: "SQL OOB exfiltration via file functions, UTL_FILE, xp_dirtree, OPENROWSET" },

  // ── Format String Attacks ─────────────────────────────────────────────────
  { name: "C Format String Attack", attackType: "other" as const, severity: "high" as const, action: "block" as const, pattern: "(?:%n|%p|%x){3,}|%\\d+\\$n|%\\d+\\$p", target: "any", description: "C printf-style format string attack (%n/%p/%x/$n)" },

  // ── More Scanner/Tool Detection ───────────────────────────────────────────
  { name: "Acunetix Scanner", attackType: "other" as const, severity: "medium" as const, action: "alert" as const, pattern: "(?i)acunetix|acusensor|acuforum", target: "ua", description: "Acunetix web vulnerability scanner user-agent" },
  { name: "Wapiti Scanner", attackType: "other" as const, severity: "medium" as const, action: "alert" as const, pattern: "(?i)wapiti|python-requests/.*wapiti", target: "ua", description: "Wapiti web application security scanner" },
  { name: "Metasploit Framework", attackType: "other" as const, severity: "critical" as const, action: "block" as const, pattern: "(?i)metasploit|msfconsole|msf-|exploit/(?:multi|unix|windows|linux)/", target: "ua", description: "Metasploit Framework exploit module user-agent" },
  { name: "Shodan Crawler", attackType: "other" as const, severity: "medium" as const, action: "alert" as const, pattern: "(?i)shodan|censys|binaryedge|fofa\\.so", target: "ua", description: "Internet-scanning platform crawlers (Shodan, Censys, BinaryEdge, FOFA)" },
  { name: "Exploit-DB Scan Tool", attackType: "other" as const, severity: "medium" as const, action: "alert" as const, pattern: "(?i)searchsploit|exploitdb|python-pocsuite|xray", target: "ua", description: "Exploit-DB searchsploit, PocSuite, xray scanner user-agents" },

  // ── HTTP Verb Tampering (extended) ────────────────────────────────────────
  { name: "Arbitrary HTTP Method", attackType: "other" as const, severity: "medium" as const, action: "alert" as const, pattern: "(?i)^(?:TRACE|TRACK|CONNECT|PATCH|MERGE|LABEL|CHECKIN|CHECKOUT|SEARCH|UNCHECKOUT)$", target: "any", description: "Uncommon/debug HTTP methods — TRACE (XST), CONNECT tunneling, SEARCH" },

  // ── Clickjacking / Frame Injection ────────────────────────────────────────
  { name: "Iframe src Injection", attackType: "xss" as const, severity: "medium" as const, action: "alert" as const, pattern: "(?i)<iframe[^>]+src\\s*=\\s*[\"']?(?:javascript:|data:|vbscript:)", target: "any", description: "Iframe src injection with JavaScript/data/vbscript URI" },

  // ── Content-Type Mismatch / MIME Sniffing ────────────────────────────────
  { name: "MIME Confusion Attack", attackType: "other" as const, severity: "medium" as const, action: "alert" as const, pattern: "(?i)content-type:\\s*(?:application/octet-stream|text/plain).*<(?:script|html|object|embed)", target: "any", description: "MIME type mismatch — executable content disguised as plain text/binary" },

  // ── Excessively Nested / Malformed JSON ──────────────────────────────────
  { name: "JSON Bomb / Deeply Nested", attackType: "other" as const, severity: "medium" as const, action: "alert" as const, pattern: "(?:\\{[^{}]*){20,}", target: "body", description: "Deeply nested JSON structure (20+ levels) — ReDoS or memory exhaustion" },

  // ── HTTP Parameter Pollution ──────────────────────────────────────────────
  { name: "HTTP Parameter Pollution", attackType: "other" as const, severity: "medium" as const, action: "alert" as const, pattern: "(?:[?&][^=&]+=)[^&]*(?:&\\1)", target: "url", description: "HTTP parameter pollution — same parameter name repeated to bypass filters" },

  // ── Session Fixation / Cookie Injection ───────────────────────────────────
  { name: "Cookie Injection via URL", attackType: "other" as const, severity: "high" as const, action: "block" as const, pattern: "(?i)(?:set-cookie|session[_-]id|phpsessid|jsessionid).*(?:%0d%0a|\\r\\n|%0a)", target: "any", description: "Cookie/session injection via CRLF in cookie-related parameters" },

  // ── EternalBlue / RCE via URL ─────────────────────────────────────────────
  { name: "Shellcode in URL", attackType: "other" as const, severity: "critical" as const, action: "block" as const, pattern: "(?:%u0041|%u4141|\\\\x41\\\\x41\\\\x41|AAAAAAAAAAAAAAAA){8,}", target: "url", description: "Shellcode NOP sled / repeated byte pattern in URL (buffer overflow probing)" },

  // ── JWT Attack Patterns ───────────────────────────────────────────────────
  { name: "JWT Algorithm None", attackType: "other" as const, severity: "critical" as const, action: "block" as const, pattern: "eyJhbGciOiJub25lIn0|eyJhbGciOiAibm9uZSJ9|\"alg\"\\s*:\\s*\"none\"", target: "any", description: "JWT algorithm confusion — 'none' algorithm bypass (signature stripped)" },
  { name: "JWT Kid Path Traversal", attackType: "other" as const, severity: "critical" as const, action: "block" as const, pattern: "(?i)\"kid\"\\s*:\\s*\"(?:\\.\\.|/etc/|/proc/|..%2F)", target: "any", description: "JWT 'kid' header path traversal — reads signing key from filesystem" },

  // ── Zip/Archive Attack ────────────────────────────────────────────────────
  { name: "Zip Slip Path Traversal", attackType: "pathtraversal" as const, severity: "high" as const, action: "block" as const, pattern: "(?i)\\.zip|\\.\\.[\\/\\\\].*\\.(?:php|jsp|asp|sh|py|rb|exe|dll)", target: "any", description: "Zip Slip archive path traversal — extract files outside target directory" },

  // ── XML Billion Laughs ─────────────────────────────────────────────────────
  { name: "XML Billion Laughs (DoS)", attackType: "xxe" as const, severity: "critical" as const, action: "block" as const, pattern: "(?i)<!ENTITY\\s+\\w+\\s+\"[^\"]{1,50}\">[\\s\\S]*<!ENTITY\\s+\\w+\\s+\"(?:&\\w+;){3,}", target: "body", description: "XML Billion Laughs entity expansion DoS attack" },

  // ── Additional SSRF Targets ───────────────────────────────────────────────
  { name: "SSRF AWS IMDSv1", attackType: "ssrf" as const, severity: "critical" as const, action: "block" as const, pattern: "169\\.254\\.169\\.254/(?:latest|1\\.0)/(?:meta-data|user-data|dynamic|api/token)", target: "any", description: "AWS Instance Metadata Service (IMDSv1) SSRF — exposes IAM credentials" },
  { name: "SSRF GCP Metadata", attackType: "ssrf" as const, severity: "critical" as const, action: "block" as const, pattern: "metadata\\.google\\.internal|169\\.254\\.169\\.254/computeMetadata", target: "any", description: "Google Cloud Platform metadata SSRF — exposes service account tokens" },
  { name: "SSRF Azure IMDS", attackType: "ssrf" as const, severity: "critical" as const, action: "block" as const, pattern: "169\\.254\\.169\\.254/metadata/instance|identity/oauth2/token", target: "any", description: "Azure Instance Metadata Service SSRF — exposes managed identity tokens" },
];

// ── Seed default WAF rules (upsert — safe to call repeatedly to add new rules)
router.post("/seed", async (_req, res) => {
  const existing = await db.select({ name: wafRulesTable.name }).from(wafRulesTable);
  const existingNames = new Set(existing.map(r => r.name));
  const toInsert = DEFAULT_WAF_RULES.filter(r => !existingNames.has(r.name));
  if (toInsert.length === 0) return res.json({ message: "All rules already present", total: existing.length });
  const inserted = await db.insert(wafRulesTable).values(
    toInsert.map(r => ({ ...r, hitCount: 0, enabled: true, createdAt: new Date() }))
  ).returning();
  res.json({ seeded: inserted.length, skipped: existingNames.size, total: existingNames.size + inserted.length });
});

// ── Get WAF rules ──────────────────────────────────────────────────────────
router.get("/rules", async (_req, res) => {
  const rules = await db.select().from(wafRulesTable).orderBy(wafRulesTable.attackType, wafRulesTable.severity);
  res.json({ rules, total: rules.length });
});

// ── Create WAF rule ────────────────────────────────────────────────────────
router.post("/rules", async (req, res) => {
  const body = z.object({
    name: z.string(),
    attackType: z.enum(["sqli","xss","lfi","rfi","cmdi","xxe","ssrf","ssti","pathtraversal","sqlmap","ratelimit","other"]),
    severity: z.enum(["critical","high","medium","low","info"]),
    action: z.enum(["block","alert","log","challenge"]).default("block"),
    pattern: z.string(),
    target: z.string().default("any"),
    description: z.string().optional(),
  }).parse(req.body);
  const [rule] = await db.insert(wafRulesTable).values({ ...body, hitCount: 0, enabled: true, createdAt: new Date() }).returning();
  res.status(201).json(rule);
});

// ── Update WAF rule ────────────────────────────────────────────────────────
router.put("/rules/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const body = z.object({
    name: z.string().optional(),
    enabled: z.boolean().optional(),
    action: z.enum(["block","alert","log","challenge"]).optional(),
    severity: z.enum(["critical","high","medium","low","info"]).optional(),
    pattern: z.string().optional(),
    description: z.string().optional(),
  }).parse(req.body);
  const [rule] = await db.update(wafRulesTable).set(body).where(eq(wafRulesTable.id, id)).returning();
  if (!rule) return res.status(404).json({ error: "Rule not found" });
  res.json(rule);
});

// ── Delete WAF rule ────────────────────────────────────────────────────────
router.delete("/rules/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  await db.delete(wafRulesTable).where(eq(wafRulesTable.id, id));
  res.status(204).send();
});

// ── Reset to defaults ──────────────────────────────────────────────────────
router.post("/reset", async (_req, res) => {
  await db.delete(wafRulesTable);
  const inserted = await db.insert(wafRulesTable).values(
    DEFAULT_WAF_RULES.map(r => ({ ...r, hitCount: 0, enabled: true, createdAt: new Date() }))
  ).returning();
  res.json({ seeded: inserted.length });
});

// ── Analyze a request payload for threats ─────────────────────────────────
router.post("/analyze", async (req, res) => {
  const body = z.object({
    method: z.string().default("GET"),
    path: z.string().default("/"),
    headers: z.record(z.string()).default({}),
    body: z.string().default(""),
    sourceIp: z.string().default("0.0.0.0"),
  }).parse(req.body);

  const rules = await db.select().from(wafRulesTable).where(eq(wafRulesTable.enabled, true));
  const hits: Array<{rule: typeof rules[0]; matchedOn: string; payload: string}> = [];
  let anomalyScore = 0;

  const ua = body.headers["user-agent"] || body.headers["User-Agent"] || "";
  const fullRequest = `${body.method} ${body.path} ${JSON.stringify(body.headers)} ${body.body}`;

  for (const rule of rules) {
    let testString = "";
    switch (rule.target) {
      case "ua": testString = ua; break;
      case "url": testString = body.path; break;
      case "body": testString = body.body; break;
      case "header": testString = JSON.stringify(body.headers); break;
      default: testString = fullRequest;
    }
    try {
      const re = new RegExp(rule.pattern, "i");
      const m = testString.match(re);
      if (m) {
        hits.push({ rule, matchedOn: rule.target, payload: m[0].substring(0, 200) });
        const scoreMap: Record<string, number> = { critical: 40, high: 25, medium: 15, low: 5, info: 1 };
        anomalyScore += scoreMap[rule.severity] ?? 10;
        await db.update(wafRulesTable).set({ hitCount: sql`hit_count + 1` }).where(eq(wafRulesTable.id, rule.id));
      }
    } catch { /* invalid regex, skip */ }
  }

  const blocked = hits.some(h => h.rule.action === "block") && anomalyScore >= 25;
  const topHit = hits.sort((a,b) => {
    const sev = { critical:4, high:3, medium:2, low:1, info:0 };
    return (sev[b.rule.severity as keyof typeof sev]||0) - (sev[a.rule.severity as keyof typeof sev]||0);
  })[0];

  if (hits.length > 0) {
    await db.insert(wafEventsTable).values({
      ruleId: topHit?.rule.id,
      ruleName: topHit?.rule.name,
      attackType: topHit?.rule.attackType,
      severity: topHit?.rule.severity,
      action: blocked ? "block" : "alert",
      sourceIp: body.sourceIp,
      method: body.method,
      path: body.path,
      matchedOn: topHit?.matchedOn,
      payload: topHit?.payload,
      blocked,
      anomalyScore,
      detectedAt: new Date(),
    });
  }

  res.json({
    blocked,
    anomalyScore,
    threatLevel: anomalyScore >= 40 ? "critical" : anomalyScore >= 25 ? "high" : anomalyScore >= 10 ? "medium" : anomalyScore > 0 ? "low" : "clean",
    hits: hits.map(h => ({ id: h.rule.id, name: h.rule.name, attackType: h.rule.attackType, severity: h.rule.severity, action: h.rule.action, matchedOn: h.matchedOn, payload: h.payload })),
    totalRulesChecked: rules.length,
  });
});

// ── Get attack event log ───────────────────────────────────────────────────
router.get("/events", async (req, res) => {
  const limit = Math.min(parseInt(String(req.query.limit ?? "100")), 500);
  const events = await db.select().from(wafEventsTable).orderBy(desc(wafEventsTable.detectedAt)).limit(limit);
  res.json({ events, total: events.length });
});

// ── Clear event log ────────────────────────────────────────────────────────
router.delete("/events", async (_req, res) => {
  await db.delete(wafEventsTable);
  res.json({ message: "Event log cleared" });
});

// ── Generate ModSecurity / Nginx WAF config ────────────────────────────────
router.get("/generate-config", async (_req, res) => {
  const rules = await db.select().from(wafRulesTable).where(eq(wafRulesTable.enabled, true));

  const modsecLines = [
    "# ProxhqVPN WAF — ModSecurity Rules",
    "# Generated by ProxhqVPN Security Platform",
    "SecRuleEngine On",
    "SecRequestBodyAccess On",
    "SecResponseBodyAccess On",
    "SecAuditLog /var/log/modsec_audit.log",
    "SecAuditEngine RelevantOnly",
    "",
    "# ── ProxhqVPN Custom WAF Rules ──────────────────",
    ...rules.map((r, i) => [
      ``,
      `# ${r.name} [${r.attackType.toUpperCase()} / ${r.severity.toUpperCase()}]`,
      `SecRule ${r.target === "ua" ? "REQUEST_HEADERS:User-Agent" : r.target === "url" ? "REQUEST_URI" : r.target === "body" ? "REQUEST_BODY" : "ARGS|REQUEST_HEADERS|REQUEST_URI"} "@rx ${r.pattern}"  \\`,
      `    "id:${10000 + i},phase:2,${r.action === "block" ? "deny,status:403" : "log,pass"},msg:'${r.name}'"`,
    ].join("\n")),
  ];

  const nginxLines = [
    "# ProxhqVPN WAF — Nginx + ngx_http_rewrite rules",
    "# Generated by ProxhqVPN Security Platform",
    "# Add to your nginx.conf server {} block",
    "",
    "# ── SQLMap User-Agent Block ─────────────────────",
    `if ($http_user_agent ~* "sqlmap") { return 403; }`,
    "",
    "# ── Limit request rate per IP ───────────────────",
    "limit_req_zone $binary_remote_addr zone=proxhq_waf:10m rate=10r/s;",
    "limit_req zone=proxhq_waf burst=20 nodelay;",
    "limit_req_status 429;",
    "",
    "# ── Block empty User-Agent (common scanner) ──────",
    `if ($http_user_agent = "") { return 403; }`,
    "",
    "# ── Block suspicious query params ───────────────",
    ...rules.filter(r => r.target === "any" || r.target === "url").map(r =>
      `# ${r.name}: pattern escaped — use ModSecurity for full regex matching`
    ),
    "",
    "# ── Limit HTTP methods ──────────────────────────",
    `if ($request_method !~ ^(GET|HEAD|POST|PUT|DELETE|OPTIONS|PATCH)$ ) { return 405; }`,
    "",
    "# ── Block null bytes ────────────────────────────",
    `if ($request_uri ~* "\\x00") { return 400; }`,
  ];

  const apacheLines = [
    "# ProxhqVPN WAF — Apache .htaccess rules",
    "RewriteEngine On",
    "",
    "# Block SQLMap",
    `RewriteCond %{HTTP_USER_AGENT} sqlmap [NC]`,
    `RewriteRule .* - [F,L]`,
    "",
    "# Block common SQL injection patterns",
    `RewriteCond %{QUERY_STRING} (?:union|select|insert|drop|delete)[^a-z] [NC]`,
    `RewriteRule .* - [F,L]`,
    "",
    "# Block path traversal",
    `RewriteCond %{QUERY_STRING} \\.\\.\\/`,
    `RewriteRule .* - [F,L]`,
    "",
    "# Block XSS",
    `RewriteCond %{QUERY_STRING} <script [NC]`,
    `RewriteRule .* - [F,L]`,
  ];

  res.json({
    modsecConfig: modsecLines.join("\n"),
    nginxConfig: nginxLines.join("\n"),
    apacheConfig: apacheLines.join("\n"),
    ruleCount: rules.length,
    exportedAt: new Date().toISOString(),
  });
});

// ── WAF Stats ──────────────────────────────────────────────────────────────
router.get("/stats", async (_req, res) => {
  const events = await db.select().from(wafEventsTable);
  const rules = await db.select().from(wafRulesTable);
  const blocked = events.filter(e => e.blocked).length;
  const byType: Record<string, number> = {};
  for (const e of events) {
    if (e.attackType) byType[e.attackType] = (byType[e.attackType] ?? 0) + 1;
  }
  res.json({
    totalEvents: events.length,
    totalBlocked: blocked,
    totalAlerted: events.length - blocked,
    enabledRules: rules.filter(r => r.enabled).length,
    totalRules: rules.length,
    byAttackType: byType,
    topAttackedPaths: Object.entries(
      events.reduce((acc, e) => { if(e.path) acc[e.path] = (acc[e.path]??0)+1; return acc; }, {} as Record<string,number>)
    ).sort((a,b) => b[1]-a[1]).slice(0,10),
  });
});

export default router;
