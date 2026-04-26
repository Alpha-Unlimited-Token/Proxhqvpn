import { Router } from "express";

const router = Router();

type Severity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";

interface SastRule {
  ruleId: string;
  title: string;
  severity: Severity;
  cwe: string;
  description: string;
  remediation: string;
  pattern: RegExp;
  languages: string[];
}

interface SastFinding {
  ruleId: string;
  title: string;
  severity: Severity;
  cwe: string;
  description: string;
  remediation: string;
  line: number;
  column: number;
  snippet: string;
}

const SAST_RULES: SastRule[] = [
  {
    ruleId: "SEC-001", title: "SQL Injection via string concatenation",
    severity: "CRITICAL", cwe: "CWE-89",
    description: "Constructing SQL queries by concatenating user input allows attackers to manipulate query logic.",
    remediation: "Use parameterized queries or prepared statements. Never concatenate user input into SQL strings.",
    pattern: /(?:query|sql|db\.execute|cursor\.execute)\s*\(.*(?:\+|\$\{|%s|%d|format\(|f"|f').*\)/gi,
    languages: ["javascript", "typescript", "python", "php", "java"],
  },
  {
    ruleId: "SEC-002", title: "Hardcoded secret / credential",
    severity: "CRITICAL", cwe: "CWE-798",
    description: "Hardcoded secrets in source code are exposed to anyone with repository access.",
    remediation: "Use environment variables or a secrets manager. Never commit credentials to version control.",
    pattern: /(?:password|secret|api_key|apikey|token|passwd|pwd)\s*[:=]\s*['"][^'"]{6,}['"]/gi,
    languages: ["javascript", "typescript", "python", "java", "go", "ruby", "php"],
  },
  {
    ruleId: "SEC-003", title: "Command Injection via exec/shell",
    severity: "CRITICAL", cwe: "CWE-78",
    description: "Passing unsanitized input to shell execution functions enables command injection.",
    remediation: "Never pass user input to exec/shell functions. Use safe APIs with argument arrays instead.",
    pattern: /(?:exec|execSync|spawn|shell_exec|system|os\.system|subprocess\.call)\s*\([^)]*(?:\+|\$\{|%|format)/gi,
    languages: ["javascript", "typescript", "python", "php", "ruby"],
  },
  {
    ruleId: "SEC-004", title: "Cross-Site Scripting (XSS) via innerHTML",
    severity: "HIGH", cwe: "CWE-79",
    description: "Setting innerHTML with unsanitized user input allows script injection in the victim's browser.",
    remediation: "Use textContent instead of innerHTML. Sanitize HTML with DOMPurify before using innerHTML.",
    pattern: /\.innerHTML\s*=\s*(?!['"`][^'"]+['"`])/gi,
    languages: ["javascript", "typescript"],
  },
  {
    ruleId: "SEC-005", title: "eval() with dynamic input",
    severity: "CRITICAL", cwe: "CWE-95",
    description: "eval() executes arbitrary JavaScript. Using it with dynamic input enables code injection.",
    remediation: "Never use eval() with user-controlled input. Refactor to use safe alternatives.",
    pattern: /\beval\s*\(/gi,
    languages: ["javascript", "typescript"],
  },
  {
    ruleId: "SEC-006", title: "Insecure random number generation",
    severity: "MEDIUM", cwe: "CWE-338",
    description: "Math.random() is not cryptographically secure and must not be used for security-sensitive values.",
    remediation: "Use crypto.randomBytes() (Node.js), secrets module (Python), or crypto/rand (Go) for security tokens.",
    pattern: /Math\.random\s*\(\)/gi,
    languages: ["javascript", "typescript"],
  },
  {
    ruleId: "SEC-007", title: "Path Traversal via unsanitized file path",
    severity: "HIGH", cwe: "CWE-22",
    description: "Reading files with user-controlled paths allows attackers to traverse directories and read arbitrary files.",
    remediation: "Resolve and validate file paths. Ensure resolved path starts with the expected base directory.",
    pattern: /(?:readFile|readFileSync|open|fopen)\s*\([^)]*(?:req\.|request\.|params\.|query\.)/gi,
    languages: ["javascript", "typescript", "python", "php"],
  },
  {
    ruleId: "SEC-008", title: "Prototype Pollution risk",
    severity: "HIGH", cwe: "CWE-1321",
    description: "Deep merge or recursive assignment without property filtering can pollute Object.prototype.",
    remediation: "Reject keys like '__proto__', 'constructor', 'prototype' in merge/assign operations. Use Object.create(null).",
    pattern: /\b(?:merge|deepMerge|assign|extend)\s*\([^)]*\)/gi,
    languages: ["javascript", "typescript"],
  },
  {
    ruleId: "SEC-009", title: "JWT verified without algorithm check",
    severity: "HIGH", cwe: "CWE-347",
    description: "Accepting 'alg:none' or not validating the algorithm claim allows forged JWTs.",
    remediation: "Always specify allowed algorithms explicitly. Never accept 'none' as a valid algorithm.",
    pattern: /jwt\.verify\s*\([^,]+,\s*[^,]+\s*\)/gi,
    languages: ["javascript", "typescript"],
  },
  {
    ruleId: "SEC-010", title: "CORS wildcard origin",
    severity: "MEDIUM", cwe: "CWE-942",
    description: "Setting Access-Control-Allow-Origin to '*' with credentials allows cross-origin request forgery.",
    remediation: "Restrict CORS to specific trusted origins. Never use wildcard with credentials enabled.",
    pattern: /Access-Control-Allow-Origin['":\s]+\*/gi,
    languages: ["javascript", "typescript", "python", "java"],
  },
  {
    ruleId: "SEC-011", title: "Pickle deserialization (Python)",
    severity: "CRITICAL", cwe: "CWE-502",
    description: "Python's pickle.loads() can execute arbitrary code when deserializing attacker-controlled data.",
    remediation: "Never deserialize pickle data from untrusted sources. Use JSON or protobuf instead.",
    pattern: /pickle\.loads?\s*\(/gi,
    languages: ["python"],
  },
  {
    ruleId: "SEC-012", title: "YAML unsafe load (Python)",
    severity: "HIGH", cwe: "CWE-502",
    description: "yaml.load() without Loader can execute arbitrary Python via YAML tags.",
    remediation: "Use yaml.safe_load() instead of yaml.load().",
    pattern: /yaml\.load\s*\(/gi,
    languages: ["python"],
  },
  {
    ruleId: "SEC-013", title: "XML external entity (XXE) risk",
    severity: "HIGH", cwe: "CWE-611",
    description: "Parsing XML from untrusted sources without disabling DTD/external entities enables XXE attacks.",
    remediation: "Set FEATURE_EXTERNAL_GENERAL_ENTITIES=false and FEATURE_EXTERNAL_PARAMETER_ENTITIES=false.",
    pattern: /(?:DocumentBuilder|SAXParser|XMLReader|etree\.parse|xml\.dom)\s*\(/gi,
    languages: ["java", "python", "php"],
  },
  {
    ruleId: "SEC-014", title: "Weak hashing algorithm (MD5/SHA1)",
    severity: "MEDIUM", cwe: "CWE-327",
    description: "MD5 and SHA1 are cryptographically broken and must not be used for security-sensitive hashing.",
    remediation: "Use SHA-256 or better for integrity checks. Use bcrypt/argon2/scrypt for passwords.",
    pattern: /(?:md5|sha1|sha-1)\s*\(/gi,
    languages: ["javascript", "typescript", "python", "java", "php", "ruby"],
  },
  {
    ruleId: "SEC-015", title: "Debug/development code left in production",
    severity: "LOW", cwe: "CWE-489",
    description: "Debug logging or console output may leak sensitive data in production environments.",
    remediation: "Remove or gate debug statements behind environment checks. Use a structured logger with levels.",
    pattern: /console\.(log|debug|info|warn|error)\s*\([^)]*(?:password|secret|token|key|auth)/gi,
    languages: ["javascript", "typescript"],
  },
];

function detectLanguage(filename: string, content: string): string {
  const ext = filename.toLowerCase().split(".").pop() ?? "";
  const extMap: Record<string, string> = {
    js: "javascript", ts: "typescript", jsx: "javascript", tsx: "typescript",
    py: "python", php: "php", java: "java", go: "go", rb: "ruby",
    cs: "csharp", cpp: "cpp", c: "c",
  };
  if (extMap[ext]) return extMap[ext];
  if (content.includes("def ") && content.includes(":")) return "python";
  if (content.includes("func ") && content.includes("package ")) return "go";
  if (content.includes("<?php")) return "php";
  return "javascript";
}

router.post("/scan", (req, res) => {
  const { filename = "code.js", content } = req.body;
  if (!content?.trim()) return res.status(400).json({ error: "content required" });

  const language = detectLanguage(filename, content);
  const lines = content.split("\n");
  const findings: SastFinding[] = [];

  const rules = SAST_RULES.filter(r => r.languages.includes(language) || r.languages.includes("*"));

  for (const rule of rules) {
    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const line = lines[lineNum];
      let match: RegExpExecArray | null;
      rule.pattern.lastIndex = 0;
      while ((match = rule.pattern.exec(line)) !== null) {
        findings.push({
          ruleId: rule.ruleId,
          title: rule.title,
          severity: rule.severity,
          cwe: rule.cwe,
          description: rule.description,
          remediation: rule.remediation,
          line: lineNum + 1,
          column: match.index + 1,
          snippet: line.trim().slice(0, 120),
        });
        if (!rule.pattern.global) break;
      }
    }
  }

  const summary = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, INFO: 0 };
  for (const f of findings) summary[f.severity]++;

  res.json({
    filename,
    language,
    linesScanned: lines.length,
    totalFindings: findings.length,
    summary,
    findings,
    rulesApplied: rules.length,
    scannedAt: new Date().toISOString(),
  });
});

router.get("/rules", (_req, res) => {
  res.json({
    rules: SAST_RULES.map(r => ({
      ruleId: r.ruleId,
      title: r.title,
      severity: r.severity,
      cwe: r.cwe,
      languages: r.languages,
    })),
    total: SAST_RULES.length,
  });
});

export default router;
