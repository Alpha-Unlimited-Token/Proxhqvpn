import { Router } from "express";
import { getAuth } from "@clerk/express";

const router = Router();

type Ecosystem = "npm" | "pip" | "cargo" | "go" | "maven" | "gem";
type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

interface Dependency {
  name: string;
  version: string;
  ecosystem: Ecosystem;
}

interface VulnAdvisory {
  id: string;
  title: string;
  severity: Severity;
  cvss: number;
  cve: string;
  description: string;
  affectedVersions: string;
  fixedIn: string;
  link: string;
}

interface DepFinding {
  dependency: Dependency;
  advisories: VulnAdvisory[];
}

// Curated vulnerability database (well-known real CVEs)
const VULN_DB: Record<string, VulnAdvisory[]> = {
  "lodash": [{
    id: "GHSA-jf85-cpcp-j695",
    title: "Prototype Pollution in lodash",
    severity: "HIGH", cvss: 7.4, cve: "CVE-2020-8203",
    description: "lodash before 4.17.21 has a prototype pollution vulnerability via the merge, mergeWith, defaultsDeep, and set functions.",
    affectedVersions: "< 4.17.21", fixedIn: "4.17.21",
    link: "https://github.com/advisories/GHSA-jf85-cpcp-j695",
  }],
  "axios": [{
    id: "GHSA-wf5p-g6vw-rhxx",
    title: "Cross-Site Request Forgery in axios",
    severity: "MEDIUM", cvss: 6.5, cve: "CVE-2023-45857",
    description: "axios before 1.6.0 passes CSRF tokens to the wrong host in cross-domain requests.",
    affectedVersions: "< 1.6.0", fixedIn: "1.6.0",
    link: "https://github.com/advisories/GHSA-wf5p-g6vw-rhxx",
  }],
  "log4j": [{
    id: "GHSA-jfh8-c2jp-hdp9",
    title: "Remote Code Execution in Log4j2 (Log4Shell)",
    severity: "CRITICAL", cvss: 10.0, cve: "CVE-2021-44228",
    description: "Apache Log4j2 JNDI lookup feature allows attacker-controlled LDAP/RMI servers to execute arbitrary code.",
    affectedVersions: "< 2.17.1", fixedIn: "2.17.1",
    link: "https://github.com/advisories/GHSA-jfh8-c2jp-hdp9",
  }],
  "log4j-core": [{
    id: "GHSA-jfh8-c2jp-hdp9",
    title: "Remote Code Execution in Log4j2 (Log4Shell)",
    severity: "CRITICAL", cvss: 10.0, cve: "CVE-2021-44228",
    description: "Apache Log4j2 JNDI lookup feature allows attacker-controlled LDAP/RMI servers to execute arbitrary code.",
    affectedVersions: "< 2.17.1", fixedIn: "2.17.1",
    link: "https://github.com/advisories/GHSA-jfh8-c2jp-hdp9",
  }],
  "express": [{
    id: "GHSA-3vf2-whjh-h6p3",
    title: "Open Redirect in express",
    severity: "LOW", cvss: 3.5, cve: "CVE-2024-43796",
    description: "express < 4.20.0 may pass arbitrary open redirects in the Location header.",
    affectedVersions: "< 4.20.0", fixedIn: "4.20.0",
    link: "https://github.com/advisories/GHSA-3vf2-whjh-h6p3",
  }],
  "pillow": [{
    id: "GHSA-44cc-43rp-5947",
    title: "Buffer overflow in Pillow",
    severity: "HIGH", cvss: 8.8, cve: "CVE-2023-44271",
    description: "Pillow before 10.0.1 is vulnerable to an arbitrary file write via heap buffer overflow.",
    affectedVersions: "< 10.0.1", fixedIn: "10.0.1",
    link: "https://github.com/advisories/GHSA-44cc-43rp-5947",
  }],
  "requests": [{
    id: "GHSA-j8r2-6x86-q33q",
    title: "Proxy-Authorization header leaked in cross-origin redirect",
    severity: "MEDIUM", cvss: 6.1, cve: "CVE-2023-32681",
    description: "Requests forwards Proxy-Authorization headers to destination servers on redirect, leaking credentials.",
    affectedVersions: "< 2.31.0", fixedIn: "2.31.0",
    link: "https://github.com/advisories/GHSA-j8r2-6x86-q33q",
  }],
  "djangorestframework": [{
    id: "GHSA-74m5-2c7w-9w3x",
    title: "Cross-Site Scripting in Django REST framework",
    severity: "HIGH", cvss: 7.5, cve: "CVE-2024-21513",
    description: "DRF before 3.15.2 is vulnerable to XSS via the browsable API renderer.",
    affectedVersions: "< 3.15.2", fixedIn: "3.15.2",
    link: "https://github.com/advisories/GHSA-74m5-2c7w-9w3x",
  }],
  "openssl": [{
    id: "GHSA-r9mq-3c9r-fmjq",
    title: "Memory corruption in OpenSSL X.509 verification",
    severity: "CRITICAL", cvss: 9.8, cve: "CVE-2022-3602",
    description: "OpenSSL 3.0.x before 3.0.7 has a buffer overrun in punycode decoding for email address in X.509 certificates.",
    affectedVersions: "3.0.0 - 3.0.6", fixedIn: "3.0.7",
    link: "https://www.openssl.org/news/secadv/20221101.txt",
  }],
  "spring-core": [{
    id: "GHSA-36p3-wjmg-h94x",
    title: "Spring4Shell: RCE in Spring Framework",
    severity: "CRITICAL", cvss: 9.8, cve: "CVE-2022-22965",
    description: "Spring Framework 5.3.0–5.3.17 allows RCE via data binding on JDK 9+ with Tomcat.",
    affectedVersions: "5.3.0 - 5.3.17", fixedIn: "5.3.18",
    link: "https://github.com/advisories/GHSA-36p3-wjmg-h94x",
  }],
  "werkzeug": [{
    id: "GHSA-2g68-c3qc-8985",
    title: "High resource usage in Werkzeug multipart/form-data parsing",
    severity: "HIGH", cvss: 7.5, cve: "CVE-2023-46136",
    description: "Werkzeug <= 3.0.0 multipart uploads can exhaust CPU and memory with crafted requests.",
    affectedVersions: "< 3.0.1", fixedIn: "3.0.1",
    link: "https://github.com/advisories/GHSA-2g68-c3qc-8985",
  }],
  "moment": [{
    id: "GHSA-wc69-rhjr-hc9v",
    title: "ReDoS in moment parseZone",
    severity: "HIGH", cvss: 7.5, cve: "CVE-2022-24785",
    description: "Moment.js < 2.29.4 path traversal in locale loading and ReDoS via crafted date strings.",
    affectedVersions: "< 2.29.4", fixedIn: "2.29.4",
    link: "https://github.com/advisories/GHSA-wc69-rhjr-hc9v",
  }],
  "jsonwebtoken": [{
    id: "GHSA-hjrf-2m68-5959",
    title: "Improper Restriction of Security Token Assignment in jsonwebtoken",
    severity: "HIGH", cvss: 7.6, cve: "CVE-2022-23529",
    description: "jsonwebtoken < 9.0.0 remote attacker can manipulate the secretOrPublicKey object if jwtData.header.alg is forged.",
    affectedVersions: "< 9.0.0", fixedIn: "9.0.0",
    link: "https://github.com/advisories/GHSA-hjrf-2m68-5959",
  }],
  "semver": [{
    id: "GHSA-c2qf-rxjj-qqgw",
    title: "Regular Expression Denial of Service in semver",
    severity: "HIGH", cvss: 7.5, cve: "CVE-2022-25883",
    description: "semver < 7.5.2 vulnerable to ReDoS via long version string input.",
    affectedVersions: "< 7.5.2", fixedIn: "7.5.2",
    link: "https://github.com/advisories/GHSA-c2qf-rxjj-qqgw",
  }],
  "pyyaml": [{
    id: "GHSA-6757-jp84-gxfx",
    title: "Arbitrary code execution in PyYAML",
    severity: "CRITICAL", cvss: 9.8, cve: "CVE-2020-14343",
    description: "PyYAML < 5.4 has a full_load() that can execute arbitrary Python code via YAML tags.",
    affectedVersions: "< 5.4", fixedIn: "5.4",
    link: "https://github.com/advisories/GHSA-6757-jp84-gxfx",
  }],
  "cryptography": [{
    id: "GHSA-3ww4-gg4f-jr7f",
    title: "Bleichenbacher timing oracle in RSA decryption in cryptography",
    severity: "HIGH", cvss: 7.5, cve: "CVE-2023-49083",
    description: "cryptography < 41.0.6 is vulnerable to Bleichenbacher timing oracle attacks on RSA decryption.",
    affectedVersions: "< 41.0.6", fixedIn: "41.0.6",
    link: "https://github.com/advisories/GHSA-3ww4-gg4f-jr7f",
  }],
};

function uid(req: any): string {
  return (getAuth(req) as any)?.userId || "anon";
}

function detectEcosystem(filename: string, content: string): Ecosystem {
  const lower = filename.toLowerCase();
  if (lower === "package.json" || lower === "package-lock.json") return "npm";
  if (lower === "requirements.txt" || lower === "pyproject.toml" || lower === "setup.py") return "pip";
  if (lower === "cargo.toml") return "cargo";
  if (lower === "go.mod" || lower === "go.sum") return "go";
  if (lower === "pom.xml") return "maven";
  if (lower === "gemfile" || lower === "gemfile.lock") return "gem";
  if (content.includes('"dependencies"') || content.includes('"devDependencies"')) return "npm";
  if (content.includes("[dependencies]") && content.includes("version")) return "cargo";
  if (content.includes("<dependency>") && content.includes("<groupId>")) return "maven";
  return "npm";
}

function parseDependencies(content: string, ecosystem: Ecosystem, filename: string): Dependency[] {
  const deps: Dependency[] = [];
  try {
    if (ecosystem === "npm") {
      const json = JSON.parse(content);
      const sections = ["dependencies", "devDependencies", "peerDependencies"];
      for (const sec of sections) {
        const obj = json[sec];
        if (obj && typeof obj === "object") {
          for (const [name, ver] of Object.entries(obj)) {
            deps.push({ name: name.toLowerCase(), version: String(ver).replace(/[\^~>=<]/, ""), ecosystem });
          }
        }
      }
    } else if (ecosystem === "pip") {
      const lines = content.split("\n");
      for (const line of lines) {
        const clean = line.split("#")[0].trim();
        if (!clean) continue;
        const match = clean.match(/^([A-Za-z0-9_-]+)\s*(?:[>=<~!]+\s*([0-9.]+))?/);
        if (match) {
          deps.push({ name: match[1].toLowerCase(), version: match[2] || "unknown", ecosystem });
        }
      }
    } else if (ecosystem === "cargo") {
      const lines = content.split("\n");
      for (const line of lines) {
        const match = line.match(/^([a-z0-9_-]+)\s*=\s*"([0-9.^~]+)"/i);
        if (match) {
          deps.push({ name: match[1].toLowerCase(), version: match[2].replace(/[\^~]/, ""), ecosystem });
        }
      }
    } else if (ecosystem === "maven") {
      const artifactMatches = content.matchAll(/<artifactId>([^<]+)<\/artifactId>[\s\S]*?<version>([^<]+)<\/version>/g);
      for (const m of artifactMatches) {
        deps.push({ name: m[1].toLowerCase(), version: m[2], ecosystem });
      }
    }
  } catch { /* parse error — return what we have */ }
  return deps;
}

function scanForVulns(deps: Dependency[]): DepFinding[] {
  const findings: DepFinding[] = [];
  for (const dep of deps) {
    const advisories = VULN_DB[dep.name];
    if (advisories?.length) {
      findings.push({ dependency: dep, advisories });
    }
  }
  return findings;
}

router.post("/scan", (req, res) => {
  const { filename = "package.json", content } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: "content required" });

  const ecosystem = detectEcosystem(filename, content);
  const deps = parseDependencies(content, ecosystem, filename);
  const findings = scanForVulns(deps);
  const critCount = findings.flatMap(f => f.advisories).filter(a => a.severity === "CRITICAL").length;
  const highCount  = findings.flatMap(f => f.advisories).filter(a => a.severity === "HIGH").length;

  res.json({
    filename,
    ecosystem,
    totalDependencies: deps.length,
    vulnerablePackages: findings.length,
    findings,
    summary: { CRITICAL: critCount, HIGH: highCount, MEDIUM: findings.flatMap(f => f.advisories).filter(a => a.severity === "MEDIUM").length, LOW: findings.flatMap(f => f.advisories).filter(a => a.severity === "LOW").length },
    scannedAt: new Date().toISOString(),
  });
});

router.get("/supported", (_req, res) => {
  res.json({
    ecosystems: [
      { id: "npm",   label: "Node.js / npm",    files: ["package.json", "package-lock.json"] },
      { id: "pip",   label: "Python / pip",     files: ["requirements.txt", "pyproject.toml"] },
      { id: "cargo", label: "Rust / Cargo",     files: ["Cargo.toml"] },
      { id: "maven", label: "Java / Maven",     files: ["pom.xml"] },
    ],
  });
});

export default router;
