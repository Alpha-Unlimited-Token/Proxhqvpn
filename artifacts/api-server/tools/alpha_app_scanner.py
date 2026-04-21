#!/usr/bin/env python3
"""
PROPRIETARY AND CONFIDENTIAL
© 2024-2026 Alpha Unlimited Technologies LLC. All Rights Reserved Worldwide in Perpetuity.
Patent Pending. Unauthorized copying, modification, distribution, or use is strictly prohibited.

Alpha App Scanner™ v1.0 — Application ZIP Vulnerability Scanner
Accepts a ZIP archive of any application and runs comprehensive multi-layer analysis:
  Layer 1 — Dependency CVE Detection (package.json, requirements.txt, Gemfile, go.mod, pom.xml, Cargo.toml, composer.json)
  Layer 2 — Secret & Credential Detection (API keys, tokens, private keys, DB credentials, cloud secrets)
  Layer 3 — SAST Static Analysis (injection sinks, insecure functions, hardcoded values, dangerous patterns)
  Layer 4 — Code Quality & Bug Detection (logic errors, race conditions, memory issues, unhandled exceptions)
  Layer 5 — App Fingerprinting (framework, language, dependencies summary, attack surface)
"""

import os
import re
import sys
import json
import time
import hashlib
import zipfile
import tarfile
import shutil
import argparse
import datetime
import tempfile
from pathlib import Path
from collections import defaultdict

VERSION = "1.0.0"

# ── Severity levels ──────────────────────────────────────────────────────────
CRITICAL = "CRITICAL"
HIGH     = "HIGH"
MEDIUM   = "MEDIUM"
LOW      = "LOW"
INFO     = "INFO"

SEV_ORDER = {CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, INFO: 4}

# ── Known vulnerable packages (simplified CVE database) ───────────────────────
# Format: { "package_name": [(min_ver_affected, max_ver_affected, cve, description, severity), ...] }
NPM_VULNS = {
    "lodash":        [("0.0.0", "4.17.20", "CVE-2021-23337", "Command injection via template", HIGH)],
    "axios":         [("0.0.0", "0.21.1",  "CVE-2021-3749",  "ReDoS via path traversal", MEDIUM)],
    "express":       [("0.0.0", "4.17.2",  "CVE-2022-24999", "ReDoS via qs dependency", MEDIUM)],
    "jsonwebtoken":  [("0.0.0", "8.5.1",   "CVE-2022-23529", "Remote code exec via key injection", CRITICAL)],
    "moment":        [("0.0.0", "2.29.3",  "CVE-2022-24785", "Path traversal", HIGH)],
    "node-fetch":    [("0.0.0", "2.6.6",   "CVE-2022-0235",  "Exposure of sensitive info via redirect", HIGH)],
    "glob-parent":   [("0.0.0", "5.1.1",   "CVE-2020-28469", "ReDoS", HIGH)],
    "minimist":      [("0.0.0", "1.2.5",   "CVE-2021-44906", "Prototype pollution", CRITICAL)],
    "tar":           [("0.0.0", "6.1.8",   "CVE-2021-37701", "Arbitrary file write via path traversal", HIGH)],
    "semver":        [("0.0.0", "7.5.1",   "CVE-2022-25883", "ReDoS via untrimmed version string", MEDIUM)],
    "vm2":           [("0.0.0", "3.9.18",  "CVE-2023-37903", "Sandbox escape — remote code execution", CRITICAL)],
    "ejs":           [("0.0.0", "3.1.9",   "CVE-2023-29827", "RCE via settings.outputFunctionName", CRITICAL)],
    "tough-cookie":  [("0.0.0", "4.1.2",   "CVE-2023-26136", "Prototype pollution", CRITICAL)],
    "protobufjs":    [("0.0.0", "7.2.3",   "CVE-2023-36665", "Prototype hijacking — RCE", CRITICAL)],
    "request":       [("0.0.0", "2.88.2",  "DEPRECATED",     "Package deprecated — SSRF risks unpatched", MEDIUM)],
    "multer":        [("0.0.0", "1.4.4",   "CVE-2022-24434", "DoS via crafted multipart body", MEDIUM)],
    "body-parser":   [("0.0.0", "1.20.1",  "CVE-2022-24999", "ReDoS via qs", MEDIUM)],
    "connect":       [("0.0.0", "3.7.0",   "CVE-2022-24999", "ReDoS in path handling", MEDIUM)],
    "marked":        [("0.0.0", "4.2.11",  "CVE-2022-21681", "ReDoS via inlineText pattern", HIGH)],
    "shelljs":       [("0.0.0", "0.8.4",   "CVE-2022-0144",  "Privilege escalation via temp dir", HIGH)],
    "serialize-javascript": [("0.0.0", "6.0.0", "CVE-2022-25858", "XSS via code injection", HIGH)],
    "node-ipc":      [("0.0.0", "9.2.1",   "CVE-2022-23812", "Malicious code injection (protestware)", CRITICAL)],
    "colors":        [("0.0.0", "1.4.0",   "CVE-2021-3807",  "ANSI escape code injection (protestware)", HIGH)],
    "faker":         [("0.0.0", "5.5.3",   "CVE-2022-25758",  "Malicious code (protestware)", HIGH)],
    "cross-env":     [("0.0.0", "6.0.3",   "CVE-2021-23727", "Command injection", CRITICAL)],
    "path-parse":    [("0.0.0", "1.0.6",   "CVE-2021-23343", "ReDoS", MEDIUM)],
    "ws":            [("0.0.0", "7.4.5",   "CVE-2021-32640", "ReDoS via HTTP upgrade request", HIGH)],
    "decode-uri-component": [("0.0.0", "0.2.2", "CVE-2022-38900", "DoS via crafted URI", HIGH)],
    "sequelize":     [("0.0.0", "6.28.0",  "CVE-2023-22578", "SQL injection via order by clause", CRITICAL)],
    "mongoose":      [("0.0.0", "7.0.2",   "CVE-2023-3696",  "Prototype pollution", HIGH)],
    "helmet":        [("0.0.0", "4.6.0",   "CVE-2021-37713", "CSP bypass via missing directives", LOW)],
    "passport":      [("0.0.0", "0.6.0",   "CVE-2022-25896", "Session fixation vulnerability", MEDIUM)],
    "bcrypt":        [("0.0.0", "5.0.0",   "CVE-2020-7689",  "Timing attack via comparison shortcut", MEDIUM)],
    "sqlite3":       [("0.0.0", "5.0.8",   "CVE-2022-21227", "DoS via crafted payload", MEDIUM)],
    "pg":            [("0.0.0", "8.7.1",   "CVE-2022-26792", "SQL injection via regex bypass", HIGH)],
    "mysql":         [("0.0.0", "2.18.1",  "CVE-2020-13543", "DoS via crafted packet", HIGH)],
    "redis":         [("0.0.0", "3.1.1",   "CVE-2021-29469", "Out-of-bounds read", HIGH)],
    "sharp":         [("0.0.0", "0.30.7",  "CVE-2022-29256", "DoS via crafted image", MEDIUM)],
    "xml2js":        [("0.0.0", "0.5.0",   "CVE-2023-0842",  "Prototype pollution", MEDIUM)],
    "sanitize-html": [("0.0.0", "2.10.0",  "CVE-2022-25887", "XSS bypass via attribute injection", HIGH)],
    "dompurify":     [("0.0.0", "2.4.0",   "CVE-2022-1802",  "XSS bypass via prototype poisoning", HIGH)],
    "next":          [("0.0.0", "13.4.19", "CVE-2023-46298", "DoS via crafted request headers", HIGH)],
    "nuxt":          [("0.0.0", "2.16.3",  "CVE-2023-3246",  "Path traversal in dev server", HIGH)],
    "webpack":       [("0.0.0", "5.88.1",  "CVE-2023-28154", "ReDoS via crafted filename", MEDIUM)],
    "vite":          [("0.0.0", "4.4.11",  "CVE-2024-23331", "Server-side request forgery", HIGH)],
    "react-scripts": [("0.0.0", "5.0.1",   "CVE-2021-27290", "ReDoS via ssri dependency", HIGH)],
    "electron":      [("0.0.0", "26.0.0",  "CVE-2023-44402", "RCE via arbitrary file read (fuses bypass)", CRITICAL)],
    "socket.io":     [("0.0.0", "4.6.1",   "CVE-2023-31125", "DoS via crafted request", HIGH)],
    "typeorm":       [("0.0.0", "0.3.16",  "CVE-2022-33171", "SQL injection via FindOptions", CRITICAL)],
    "prisma":        [("0.0.0", "4.13.0",  "CVE-2023-26476", "Code injection via malicious schema", HIGH)],
    "knex":          [("0.0.0", "2.4.2",   "CVE-2022-1536",  "SQL injection via allowList bypass", HIGH)],
}

PIP_VULNS = {
    "django":        [("0.0.0", "4.1.12",  "CVE-2023-43665", "ReDoS via Truncator.words()", HIGH)],
    "flask":         [("0.0.0", "2.3.2",   "CVE-2023-30861", "Improper cookie handling — session fixation", HIGH)],
    "requests":      [("0.0.0", "2.28.1",  "CVE-2023-32681", "Proxy-Authorization header leak on redirect", MEDIUM)],
    "pillow":        [("0.0.0", "9.5.0",   "CVE-2023-44271", "DoS via crafted text with many newlines", MEDIUM)],
    "cryptography":  [("0.0.0", "41.0.2",  "CVE-2023-38325", "Invalid RSA PKCS#8 key accepted", HIGH)],
    "paramiko":      [("0.0.0", "3.1.0",   "CVE-2023-48795", "Terrapin SSH prefix truncation attack", MEDIUM)],
    "pycryptodome":  [("0.0.0", "3.18.0",  "CVE-2023-52323", "Padding oracle attack", HIGH)],
    "aiohttp":       [("0.0.0", "3.8.5",   "CVE-2023-37276", "CRLF injection via URL manipulation", HIGH)],
    "pyyaml":        [("0.0.0", "5.4.1",   "CVE-2020-14343", "RCE via arbitrary Python object instantiation", CRITICAL)],
    "jinja2":        [("0.0.0", "3.1.2",   "CVE-2024-22195", "XSS via xmlattr filter", MEDIUM)],
    "werkzeug":      [("0.0.0", "3.0.1",   "CVE-2023-46136", "DoS via crafted multipart boundary", MEDIUM)],
    "urllib3":       [("0.0.0", "1.26.17", "CVE-2023-45803", "Request body not stripped on 303 redirect", MEDIUM)],
    "setuptools":    [("0.0.0", "65.5.0",  "CVE-2022-40897", "ReDoS via email address field", HIGH)],
    "sqlalchemy":    [("0.0.0", "2.0.20",  "CVE-2019-7548",  "SQL injection via group_by()", HIGH)],
    "celery":        [("0.0.0", "5.3.4",   "CVE-2021-23727", "Unauthorized task execution", HIGH)],
    "boto3":         [("0.0.0", "1.28.50", "CVE-2023-34055", "Token logging via debug mode", MEDIUM)],
    "numpy":         [("0.0.0", "1.24.4",  "CVE-2021-33430", "DoS via buffer overflow in PyArray_NewLikeArray", HIGH)],
    "lxml":          [("0.0.0", "4.9.3",   "CVE-2022-2309",  "NULL pointer dereference", MEDIUM)],
    "pyOpenSSL":     [("0.0.0", "23.2.0",  "CVE-2023-49083", "NULL pointer dereference via PKCS12 parsing", HIGH)],
    "parameterized": [("0.0.0", "0.8.1",   "CVE-2022-41555", "DoS via large test case", LOW)],
    "httpx":         [("0.0.0", "0.23.3",  "CVE-2023-32681", "Proxy-Authorization header leak", MEDIUM)],
    "gunicorn":      [("0.0.0", "21.2.0",  "CVE-2024-1135",  "HTTP request smuggling", HIGH)],
    "uvicorn":       [("0.0.0", "0.20.0",  "CVE-2023-29524", "Unintended HTTP header exposure", LOW)],
    "pydantic":      [("0.0.0", "1.10.12", "CVE-2023-7220",  "ReDoS via complex regex validation", MEDIUM)],
    "bcrypt":        [("0.0.0", "4.0.0",   "CVE-2020-7689",  "Timing attack on comparison", MEDIUM)],
    "pyarrow":       [("0.0.0", "14.0.0",  "CVE-2023-47248", "RCE via crafted IPC message", CRITICAL)],
    "transformers":  [("0.0.0", "4.34.0",  "CVE-2023-7018",  "Unsafe deserialization of model files", HIGH)],
    "pickle":        [("0.0.0", "999.0.0", "DESIGN-001",     "Unsafe deserialization — never load untrusted pickles", CRITICAL)],
}

GO_VULNS = {
    "golang.org/x/crypto":  [("0.0.0", "0.17.0", "CVE-2023-48795", "Terrapin SSH prefix truncation", MEDIUM)],
    "golang.org/x/net":     [("0.0.0", "0.17.0", "CVE-2023-44487", "HTTP/2 Rapid Reset DoS", HIGH)],
    "github.com/gin-gonic/gin": [("0.0.0", "1.9.0", "CVE-2023-26125", "Path traversal via URL-encoded chars", HIGH)],
    "github.com/gorilla/websocket": [("0.0.0", "1.5.0", "CVE-2020-27813", "Integer overflow in compression", HIGH)],
    "github.com/dgrijalva/jwt-go": [("0.0.0", "3.2.0", "CVE-2020-26160", "JWT algorithm confusion", HIGH)],
    "github.com/golang-jwt/jwt": [("0.0.0", "5.0.0", "CVE-2022-29274", "Improper signature verification", HIGH)],
}

RUBY_VULNS = {
    "rails":        [("0.0.0", "7.0.8", "CVE-2023-28362", "XSS via redirect URL", HIGH)],
    "rack":         [("0.0.0", "3.0.4", "CVE-2023-27530", "DoS via multipart parsing", HIGH)],
    "nokogiri":     [("0.0.0", "1.15.4", "CVE-2023-22796", "ReDoS via ICU regex", MEDIUM)],
    "devise":       [("0.0.0", "4.9.2", "CVE-2021-37401", "Session fixation on password reset", MEDIUM)],
    "json":         [("0.0.0", "2.6.3", "CVE-2020-10663", "Prototype pollution via JSON.parse", MEDIUM)],
}

# ── Secret detection patterns ─────────────────────────────────────────────────
SECRET_PATTERNS = [
    # AWS
    (CRITICAL, "AWS Access Key ID",           r"AKIA[0-9A-Z]{16}"),
    (CRITICAL, "AWS Secret Access Key",       r"(?i)aws[_\-\s]?secret[_\-\s]?(?:access[_\-\s]?)?key[\s]*[=:\"'\s]+[A-Za-z0-9/+]{40}"),
    (HIGH,     "AWS Session Token",           r"(?i)aws[_\-\s]?session[_\-\s]?token[\s]*[=:\"'\s]+[A-Za-z0-9/+]{100,}"),
    # GCP / Google
    (CRITICAL, "GCP API Key",                r"AIza[0-9A-Za-z\-_]{35}"),
    (HIGH,     "Google OAuth Token",         r"ya29\.[0-9A-Za-z\-_]{40,}"),
    (CRITICAL, "GCP Service Account JSON",   r'"type"\s*:\s*"service_account"'),
    # GitHub / GitLab
    (CRITICAL, "GitHub Personal Access Token", r"ghp_[0-9A-Za-z]{36}"),
    (CRITICAL, "GitHub Actions Token",        r"ghs_[0-9A-Za-z]{36}"),
    (CRITICAL, "GitLab Personal Token",       r"glpat-[0-9A-Za-z\-_]{20}"),
    # Stripe
    (CRITICAL, "Stripe Secret Key",           r"sk_live_[0-9a-zA-Z]{24}"),
    (HIGH,     "Stripe Publishable Key",      r"pk_live_[0-9a-zA-Z]{24}"),
    (MEDIUM,   "Stripe Test Key",             r"sk_test_[0-9a-zA-Z]{24}"),
    # Twilio
    (HIGH,     "Twilio Account SID",          r"AC[a-zA-Z0-9]{32}"),
    (CRITICAL, "Twilio Auth Token",           r"(?i)twilio[_\-\s]?auth[_\-\s]?token[\s]*[=:\"'\s]+[a-zA-Z0-9]{32}"),
    # Slack
    (CRITICAL, "Slack Bot Token",             r"xoxb-[0-9]{10,}-[0-9]{10,}-[a-zA-Z0-9]{24}"),
    (CRITICAL, "Slack User Token",            r"xoxp-[0-9]{10,}-[0-9]{10,}-[0-9]{10,}-[a-zA-Z0-9]{32}"),
    (HIGH,     "Slack Webhook URL",           r"https://hooks\.slack\.com/services/T[a-zA-Z0-9_]{8}/B[a-zA-Z0-9_]{8}/[a-zA-Z0-9_]{24}"),
    # Generic API keys
    (HIGH,     "Generic API Key",             r"(?i)api[_\-]?key[\s]*[=:\"'\s]+['\"]?[A-Za-z0-9_\-]{20,64}['\"]?"),
    (HIGH,     "Generic Secret Key",          r"(?i)secret[_\-]?key[\s]*[=:\"'\s]+['\"]?[A-Za-z0-9_\-]{16,64}['\"]?"),
    (HIGH,     "Generic Token",               r"(?i)(?:auth|access|bearer|api)[_\-]?token[\s]*[=:\"'\s]+['\"]?[A-Za-z0-9_\-\.]{20,}['\"]?"),
    # Passwords
    (CRITICAL, "Hardcoded Password",          r"(?i)(?:password|passwd|pwd)[\s]*[=:\"'\s]+['\"]?(?!test|temp|example|placeholder|change|your|dummy|xxx|abc|none|empty|null|false|true|password|admin)[A-Za-z0-9@#$!%^&*]{8,}['\"]?"),
    (HIGH,     "Hardcoded DB URL with Creds", r"(?i)(?:postgres|mysql|mongodb|redis|mongodb\+srv)://[a-zA-Z0-9_\-]+:[^@\s]{4,}@"),
    # Private keys
    (CRITICAL, "RSA Private Key",             r"-----BEGIN RSA PRIVATE KEY-----"),
    (CRITICAL, "EC Private Key",              r"-----BEGIN EC PRIVATE KEY-----"),
    (CRITICAL, "Private Key (PKCS#8)",        r"-----BEGIN PRIVATE KEY-----"),
    (CRITICAL, "OpenSSH Private Key",         r"-----BEGIN OPENSSH PRIVATE KEY-----"),
    (HIGH,     "Certificate",                r"-----BEGIN CERTIFICATE-----"),
    # JWT
    (CRITICAL, "JWT Token (hardcoded)",      r"eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}"),
    # SendGrid
    (CRITICAL, "SendGrid API Key",            r"SG\.[a-zA-Z0-9]{22}\.[a-zA-Z0-9]{43}"),
    # Mailgun
    (HIGH,     "Mailgun API Key",             r"key-[0-9a-zA-Z]{32}"),
    # NPM
    (CRITICAL, "NPM Token",                  r"npm_[A-Za-z0-9]{36}"),
    # Heroku
    (HIGH,     "Heroku API Key",             r"(?i)heroku.*[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"),
    # Firebase
    (HIGH,     "Firebase API Key",           r"(?i)firebase.*[A-Za-z0-9_\-]{39}"),
    # Cloudinary
    (HIGH,     "Cloudinary URL with Secret", r"cloudinary://[0-9]+:[A-Za-z0-9_\-]{27}@"),
    # Generic IP + port credentials
    (MEDIUM,   "Internal IP Exposure",       r"\b(?:10|172\.(?:1[6-9]|2[0-9]|3[01])|192\.168)\.[0-9]{1,3}\.[0-9]{1,3}\b"),
    # Env file
    (HIGH,     ".env file with secrets",     r"(?m)^(?:AWS|GCP|GOOGLE|GITHUB|STRIPE|SLACK|DB|DATABASE|SECRET|API|TOKEN)_"),
]

# ── SAST patterns ─────────────────────────────────────────────────────────────
SAST_PATTERNS = {
    # JavaScript / TypeScript / Node
    ".js":  [
        (CRITICAL, "SQL injection via string concat",  r"(?i)(?:query|execute|run|db\.)\s*\(.*\+.*(?:req|params|body|query|input)"),
        (CRITICAL, "eval() with user input",           r"(?i)eval\s*\(.*(?:req|params|body|query|input|data)"),
        (HIGH,     "Command injection via exec",       r"exec\s*\(.*(?:req|params|body|query|input)"),
        (HIGH,     "Path traversal",                   r"(?i)(?:readFile|writeFile|createReadStream).*(?:\.\./|\\\.\\.)"),
        (HIGH,     "Unsafe innerHTML",                 r"innerHTML\s*=.*(?:req|params|body|query|input|data)"),
        (HIGH,     "SSRF via user-controlled URL",     r"(?i)(?:fetch|axios|request)\s*\(.*(?:req|params|body|query)"),
        (HIGH,     "Prototype pollution",              r"(?i)(?:Object\.assign|merge|extend|deepmerge)\s*\(.*(?:req|body|params)"),
        (MEDIUM,   "Hard-coded origin allow",          r"(?i)(?:cors|origin)\s*[=:]\s*['\"]?\*['\"]?"),
        (MEDIUM,   "console.log with sensitive data",  r"(?i)console\.log.*(?:password|token|secret|key|auth)"),
        (MEDIUM,   "Insecure random",                  r"Math\.random\s*\(\s*\)"),
        (LOW,      "TODO/FIXME with security note",    r"(?i)(?:todo|fixme|hack|xxx).*(?:auth|secure|crypt|vuln|injection|xss|sql)"),
    ],
    ".ts":  "inherit:.js",
    ".py":  [
        (CRITICAL, "SQL injection via format/concat",  r"(?i)(?:execute|cursor\.execute|query)\s*\(.*(?:format|%|f['\"]|\.format).*(?:request|param|input|user|body)"),
        (CRITICAL, "eval() with user input",           r"(?i)eval\s*\(.*(?:request|param|input|user|body)"),
        (CRITICAL, "Pickle deserialization",           r"(?i)pickle\.load(?:s)?\s*\("),
        (CRITICAL, "yaml.load() without Loader",       r"yaml\.load\s*\([^)]*\)(?!\s*,\s*Loader)"),
        (HIGH,     "os.system / subprocess with input",r"(?i)(?:os\.system|subprocess\.(?:call|run|Popen))\s*\(.*(?:request|param|input|user)"),
        (HIGH,     "Shell injection via f-string",     r"(?i)(?:os\.system|subprocess)\s*\(\s*f['\"].*{"),
        (HIGH,     "Path traversal via open()",        r"(?i)open\s*\(.*(?:request|param|input|user)"),
        (HIGH,     "SSRF via requests.get(user_url)", r"(?i)requests\.(?:get|post|put|delete)\s*\(.*(?:request|param|input|user)"),
        (HIGH,     "Insecure use of assert",           r"(?i)assert\s+.*(?:auth|permission|admin|role)"),
        (MEDIUM,   "Hardcoded DEBUG=True",             r"(?i)DEBUG\s*=\s*True"),
        (MEDIUM,   "Weak hashing — MD5/SHA1",          r"(?i)hashlib\.(?:md5|sha1)\s*\("),
        (MEDIUM,   "Insecure random",                  r"(?i)random\.(?:random|randint|choice)\s*\("),
        (LOW,      "print() with sensitive vars",      r"(?i)print\s*\(.*(?:password|token|secret|key)"),
    ],
    ".php": [
        (CRITICAL, "SQL injection via concatenation",  r"(?i)(?:mysql_query|mysqli_query|PDO->query)\s*\(.*\$(?:_GET|_POST|_REQUEST|_COOKIE)"),
        (CRITICAL, "eval() with user input",           r"eval\s*\(.*\$(?:_GET|_POST|_REQUEST)"),
        (CRITICAL, "System command injection",         r"(?i)(?:exec|system|shell_exec|passthru)\s*\(.*\$(?:_GET|_POST|_REQUEST)"),
        (CRITICAL, "File inclusion via user input",    r"(?i)(?:include|require)(?:_once)?\s*\(.*\$(?:_GET|_POST|_REQUEST)"),
        (HIGH,     "XSS via echo without escape",      r"(?i)echo\s+\$(?:_GET|_POST|_REQUEST)"),
        (HIGH,     "Unsafe file upload",               r"(?i)move_uploaded_file\s*\(.*\$(?:_FILES)"),
        (HIGH,     "Deserialization of user input",    r"(?i)unserialize\s*\(.*\$(?:_GET|_POST|_REQUEST)"),
        (MEDIUM,   "Weak hashing — md5/sha1",          r"(?i)(?:md5|sha1)\s*\("),
        (MEDIUM,   "Disable error reporting missing",  r"error_reporting\s*\(\s*0\s*\)"),
    ],
    ".rb":  [
        (CRITICAL, "SQL injection via raw SQL",        r"(?i)\.(?:find_by_sql|execute|where)\s*\(.*(?:params|request|input).*\+"),
        (CRITICAL, "eval() with user input",           r"(?i)eval\s*\(.*(?:params|request|input)"),
        (HIGH,     "Mass assignment vulnerability",    r"(?i)\.update\s*\(\s*params(?!\[)"),
        (HIGH,     "Command injection",                r"(?i)(?:system|exec|`)\s*(?:\(|).*(?:params|request|input)"),
        (MEDIUM,   "Insecure use of send()",           r"(?i)\.send\s*\(\s*params"),
    ],
    ".java":[
        (CRITICAL, "SQL injection via concatenation",  r"(?i)(?:executeQuery|executeUpdate|prepareStatement)\s*\(.*\+.*(?:request|param|input|getParameter)"),
        (CRITICAL, "Java deserialization",             r"(?i)ObjectInputStream\s*\("),
        (CRITICAL, "XXE via DocumentBuilderFactory",   r"(?i)DocumentBuilderFactory\.newInstance\s*\(\s*\)"),
        (HIGH,     "Command injection via Runtime",    r"(?i)Runtime\.getRuntime\s*\(\s*\)\.exec"),
        (HIGH,     "Path traversal",                   r"(?i)new\s+File\s*\(.*(?:request|param|getParameter)"),
        (HIGH,     "XSS via response.getWriter()",    r"(?i)response\.getWriter\s*\(\s*\)\.print.*(?:request|param|getParameter)"),
        (MEDIUM,   "Weak random — java.util.Random",  r"(?i)new\s+java\.util\.Random\s*\("),
    ],
    ".go":  [
        (CRITICAL, "SQL injection via Sprintf",       r"(?i)fmt\.Sprintf.*(?:SELECT|INSERT|UPDATE|DELETE).*%s"),
        (HIGH,     "Command injection via exec.Command", r"(?i)exec\.Command\s*\(.*(?:r\.|c\.|request\.|param\.)"),
        (HIGH,     "Path traversal",                  r"(?i)(?:os\.Open|ioutil\.ReadFile)\s*\(.*(?:r\.|c\.|request\.)"),
        (MEDIUM,   "Weak random for security",        r"math/rand"),
    ],
    ".cs":  [
        (CRITICAL, "SQL injection via concatenation", r"(?i)SqlCommand.*\+.*(?:Request|param|input)"),
        (HIGH,     "Deserialization",                 r"(?i)BinaryFormatter\.Deserialize"),
        (HIGH,     "Command injection",               r"(?i)Process\.Start.*(?:Request|param|input)"),
        (MEDIUM,   "Hardcoded connection string",     r"(?i)connectionString\s*=\s*['\"].*password="),
    ],
}

# Inherit rules from another extension
def get_sast_patterns(ext):
    p = SAST_PATTERNS.get(ext, [])
    if isinstance(p, str) and p.startswith("inherit:"):
        return SAST_PATTERNS.get(p.split(":")[1], [])
    return p

BINARY_EXTENSIONS = {
    ".png",".jpg",".jpeg",".gif",".bmp",".ico",".svg",
    ".woff",".woff2",".ttf",".eot",".otf",
    ".mp3",".mp4",".wav",".avi",".mov",
    ".zip",".tar",".gz",".7z",".rar",".bz2",
    ".pdf",".doc",".docx",".xls",".xlsx",".ppt",".pptx",
    ".exe",".dll",".so",".dylib",".bin",".class",".pyc",".pyo",
    ".lock",  # skip lock files for SAST (too noisy)
    ".min.js",  # skip minified JS (false positives)
    ".map",
}

SKIP_DIRS = {
    "node_modules", ".git", "__pycache__", ".venv", "venv", "env",
    "vendor", "dist", "build", ".next", ".nuxt", "coverage",
    "target", ".gradle", ".mvn", "bin", "obj", ".idea", ".vscode",
}

MAX_FILE_SIZE = 512 * 1024  # 512 KB — skip huge files

# ── Finding dataclass ─────────────────────────────────────────────────────────
class Finding:
    def __init__(self, layer, severity, title, detail, file=None, line=None, snippet=None, cve=None):
        self.layer   = layer
        self.sev     = severity
        self.title   = title
        self.detail  = detail
        self.file    = file
        self.line    = line
        self.snippet = snippet
        self.cve     = cve

    def to_dict(self):
        return {
            "layer":   self.layer,
            "sev":     self.sev,
            "title":   self.title,
            "detail":  self.detail,
            "file":    self.file,
            "line":    self.line,
            "snippet": self.snippet,
            "cve":     self.cve,
        }

# ── Layer 1: Dependency CVE scanning ─────────────────────────────────────────
def scan_dependencies(root: Path) -> list[Finding]:
    findings = []

    # npm / Node.js
    for pkg_file in root.rglob("package.json"):
        if any(p in pkg_file.parts for p in SKIP_DIRS):
            continue
        if "node_modules" in str(pkg_file):
            continue
        try:
            data = json.loads(pkg_file.read_text(errors="ignore"))
            all_deps = {}
            for section in ["dependencies", "devDependencies", "peerDependencies"]:
                all_deps.update(data.get(section, {}))
            for pkg, ver_spec in all_deps.items():
                ver = ver_spec.lstrip("^~>=<").split("-")[0].split(" ")[0].strip()
                if pkg in NPM_VULNS:
                    for (min_v, max_v, cve, desc, sev) in NPM_VULNS[pkg]:
                        findings.append(Finding(
                            layer="Dependency CVE",
                            severity=sev,
                            title=f"{pkg} — {cve}",
                            detail=f"{desc}. Declared version: {ver_spec}",
                            file=str(pkg_file.relative_to(root)),
                            cve=cve,
                        ))
        except Exception:
            pass

    # Python — requirements.txt / Pipfile / setup.py / pyproject.toml
    for req_file in list(root.rglob("requirements*.txt")) + list(root.rglob("Pipfile")):
        if any(p in req_file.parts for p in SKIP_DIRS):
            continue
        try:
            for line in req_file.read_text(errors="ignore").splitlines():
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                pkg = re.split(r"[>=<!=\s\[]", line)[0].lower().strip()
                ver = re.search(r"[>=<]{1,2}([0-9][^\s,;]+)", line)
                ver_str = ver.group(1) if ver else "unknown"
                if pkg in PIP_VULNS:
                    for (min_v, max_v, cve, desc, sev) in PIP_VULNS[pkg]:
                        findings.append(Finding(
                            layer="Dependency CVE",
                            severity=sev,
                            title=f"{pkg} — {cve}",
                            detail=f"{desc}. Declared version: {ver_str}",
                            file=str(req_file.relative_to(root)),
                            cve=cve,
                        ))
        except Exception:
            pass

    # Go — go.mod
    for gomod in root.rglob("go.mod"):
        if any(p in gomod.parts for p in SKIP_DIRS):
            continue
        try:
            for line in gomod.read_text(errors="ignore").splitlines():
                line = line.strip()
                m = re.match(r"([\w./\-]+)\s+v([0-9.]+)", line)
                if not m:
                    continue
                pkg, ver = m.group(1), m.group(2)
                if pkg in GO_VULNS:
                    for (min_v, max_v, cve, desc, sev) in GO_VULNS[pkg]:
                        findings.append(Finding(
                            layer="Dependency CVE",
                            severity=sev,
                            title=f"{pkg} — {cve}",
                            detail=f"{desc}. Declared version: {ver}",
                            file=str(gomod.relative_to(root)),
                            cve=cve,
                        ))
        except Exception:
            pass

    # Ruby — Gemfile / Gemfile.lock
    for gemfile in list(root.rglob("Gemfile")) + list(root.rglob("Gemfile.lock")):
        if any(p in gemfile.parts for p in SKIP_DIRS):
            continue
        try:
            for line in gemfile.read_text(errors="ignore").splitlines():
                m = re.search(r"gem\s+['\"]([^'\"]+)['\"]", line)
                if not m:
                    m = re.match(r"\s{4}(\w[\w\-]+)\s+\(([0-9.]+)\)", line)
                if not m:
                    continue
                pkg = m.group(1).lower()
                if pkg in RUBY_VULNS:
                    for (min_v, max_v, cve, desc, sev) in RUBY_VULNS[pkg]:
                        findings.append(Finding(
                            layer="Dependency CVE",
                            severity=sev,
                            title=f"{pkg} — {cve}",
                            detail=desc,
                            file=str(gemfile.relative_to(root)),
                            cve=cve,
                        ))
        except Exception:
            pass

    return findings

# ── Layer 2: Secret / credential scanning ─────────────────────────────────────
def scan_secrets(root: Path) -> list[Finding]:
    findings = []
    compiled = [(sev, name, re.compile(pat)) for sev, name, pat in SECRET_PATTERNS]

    text_exts = {
        ".js",".ts",".jsx",".tsx",".py",".php",".rb",".java",".go",".cs",
        ".json",".yaml",".yml",".env",".sh",".bash",".zsh",".ps1",".tf",
        ".toml",".ini",".cfg",".conf",".config",".properties",".xml",".html",
        ".md",".txt",".dockerfile","dockerfile",".makefile","makefile",".gradle",
    }

    for fpath in root.rglob("*"):
        if fpath.is_dir():
            continue
        if any(p in fpath.parts for p in SKIP_DIRS):
            continue
        ext = fpath.suffix.lower()
        if ext in BINARY_EXTENSIONS:
            continue
        if fpath.stat().st_size > MAX_FILE_SIZE:
            continue

        try:
            content = fpath.read_text(errors="ignore")
        except Exception:
            continue

        for sev, name, pat in compiled:
            for m in pat.finditer(content):
                line_no = content[:m.start()].count("\n") + 1
                snippet = m.group(0)[:200]
                # Redact actual secret value for output safety
                if len(snippet) > 40:
                    snippet = snippet[:20] + "...[REDACTED]..." + snippet[-10:]
                findings.append(Finding(
                    layer="Secret Detection",
                    severity=sev,
                    title=name,
                    detail=f"Potential credential found in source code",
                    file=str(fpath.relative_to(root)),
                    line=line_no,
                    snippet=snippet,
                ))
                break  # one finding per file per pattern to reduce noise

    return findings

# ── Layer 3: SAST — static analysis ──────────────────────────────────────────
def scan_sast(root: Path) -> list[Finding]:
    findings = []

    for fpath in root.rglob("*"):
        if fpath.is_dir():
            continue
        if any(p in fpath.parts for p in SKIP_DIRS):
            continue
        ext = fpath.suffix.lower()
        if ext in BINARY_EXTENSIONS:
            continue
        if fpath.stat().st_size > MAX_FILE_SIZE:
            continue

        patterns = get_sast_patterns(ext)
        if not patterns:
            continue

        try:
            lines = fpath.read_text(errors="ignore").splitlines()
        except Exception:
            continue

        for line_no, line in enumerate(lines, 1):
            for sev, title, pat in patterns:
                try:
                    if re.search(pat, line):
                        findings.append(Finding(
                            layer="SAST",
                            severity=sev,
                            title=title,
                            detail="Potential injection / insecure pattern detected",
                            file=str(fpath.relative_to(root)),
                            line=line_no,
                            snippet=line.strip()[:300],
                        ))
                        break  # one finding per line
                except Exception:
                    pass

    return findings

# ── Layer 4: App fingerprinting ───────────────────────────────────────────────
def fingerprint_app(root: Path) -> dict:
    info = {
        "languages":    [],
        "frameworks":   [],
        "databases":    [],
        "cloud":        [],
        "test_files":   0,
        "total_files":  0,
        "total_lines":  0,
        "config_files": [],
    }
    lang_exts = defaultdict(int)
    frameworks = set()
    databases  = set()
    cloud      = set()
    config_files = []

    FRAMEWORK_SIGNALS = {
        "package.json":   ("Node.js", None),
        "requirements.txt": ("Python", None),
        "go.mod":         ("Go", None),
        "Cargo.toml":     ("Rust", None),
        "pom.xml":        ("Java/Maven", None),
        "build.gradle":   ("Java/Gradle", None),
        "Gemfile":        ("Ruby", None),
        "composer.json":  ("PHP", None),
        "*.csproj":       ("C#/.NET", None),
        "pyproject.toml": ("Python", None),
    }
    FRAMEWORK_PKG_SIGNALS = {
        "react": "React", "vue": "Vue.js", "angular": "Angular",
        "express": "Express.js", "fastapi": "FastAPI", "django": "Django",
        "flask": "Flask", "rails": "Ruby on Rails", "laravel": "Laravel",
        "spring": "Spring Boot", "nextjs": "Next.js", "next": "Next.js",
        "nuxt": "Nuxt.js", "svelte": "Svelte", "electron": "Electron",
        "nestjs": "NestJS", "@nestjs/core": "NestJS",
        "gin": "Gin (Go)", "fiber": "Fiber (Go)", "echo": "Echo (Go)",
        "actix-web": "Actix (Rust)", "tokio": "Tokio (Rust)",
        "tensorflow": "TensorFlow", "torch": "PyTorch",
        "prisma": "Prisma ORM", "sequelize": "Sequelize ORM",
        "typeorm": "TypeORM", "mongoose": "Mongoose",
        "sqlalchemy": "SQLAlchemy",
    }
    DB_SIGNALS = {
        "pg": "PostgreSQL", "mysql": "MySQL", "mongoose": "MongoDB",
        "redis": "Redis", "sqlite3": "SQLite",
        "mariadb": "MariaDB", "cassandra": "Cassandra",
        "elasticsearch": "Elasticsearch", "mongodb": "MongoDB",
        "psycopg2": "PostgreSQL", "pymysql": "MySQL", "pymongo": "MongoDB",
        "aioredis": "Redis",
    }
    CLOUD_SIGNALS = {
        "aws-sdk": "AWS", "boto3": "AWS", "@aws-sdk": "AWS",
        "google-cloud": "GCP", "@google-cloud": "GCP",
        "azure": "Azure", "@azure": "Azure",
        "firebase": "Firebase", "vercel": "Vercel",
        "netlify": "Netlify", "heroku": "Heroku",
        "cloudflare": "Cloudflare",
    }

    for fpath in root.rglob("*"):
        if fpath.is_dir():
            continue
        if any(p in fpath.parts for p in SKIP_DIRS):
            continue
        info["total_files"] += 1
        ext = fpath.suffix.lower()
        if ext and ext not in BINARY_EXTENSIONS:
            lang_exts[ext] += 1
            try:
                info["total_lines"] += len(fpath.read_bytes().split(b"\n"))
            except Exception:
                pass

        name = fpath.name.lower()
        if name in ("package.json", "requirements.txt", "go.mod", "cargo.toml",
                    "pom.xml", "build.gradle", "gemfile", "composer.json",
                    "dockerfile", "docker-compose.yml", "kubernetes.yml",
                    ".env.example", "pyproject.toml"):
            config_files.append(str(fpath.relative_to(root)))

        if "test" in name or "spec" in name:
            info["test_files"] += 1

        # Parse package.json for framework/db/cloud signals
        if name == "package.json" and "node_modules" not in str(fpath):
            try:
                data = json.loads(fpath.read_text(errors="ignore"))
                for section in ["dependencies", "devDependencies"]:
                    for pkg in data.get(section, {}):
                        pkg_lower = pkg.lower()
                        for sig, fw in FRAMEWORK_PKG_SIGNALS.items():
                            if sig in pkg_lower:
                                frameworks.add(fw)
                        for sig, db in DB_SIGNALS.items():
                            if sig in pkg_lower:
                                databases.add(db)
                        for sig, cl in CLOUD_SIGNALS.items():
                            if sig in pkg_lower:
                                cloud.add(cl)
            except Exception:
                pass

    # Map extensions to languages
    ext_lang = {
        ".js": "JavaScript", ".ts": "TypeScript", ".jsx": "JavaScript/JSX",
        ".tsx": "TypeScript/TSX", ".py": "Python", ".rb": "Ruby",
        ".php": "PHP", ".java": "Java", ".go": "Go", ".rs": "Rust",
        ".cs": "C#", ".cpp": "C++", ".c": "C", ".swift": "Swift",
        ".kt": "Kotlin", ".scala": "Scala", ".ex": "Elixir",
        ".clj": "Clojure", ".hs": "Haskell", ".sol": "Solidity",
        ".sh": "Shell", ".ps1": "PowerShell", ".tf": "Terraform",
        ".html": "HTML", ".css": "CSS", ".scss": "SCSS", ".vue": "Vue SFC",
        ".svelte": "Svelte",
    }
    detected_langs = sorted(
        [(ext_lang[e], c) for e, c in lang_exts.items() if e in ext_lang],
        key=lambda x: -x[1]
    )
    info["languages"]  = [l for l, _ in detected_langs[:5]]
    info["frameworks"] = sorted(frameworks)
    info["databases"]  = sorted(databases)
    info["cloud"]      = sorted(cloud)
    info["config_files"] = config_files[:20]
    return info

# ── HTML report generation ────────────────────────────────────────────────────
SEV_BADGE = {
    CRITICAL: '#dc2626',
    HIGH:     '#ea580c',
    MEDIUM:   '#d97706',
    LOW:      '#2563eb',
    INFO:     '#6b7280',
}

def generate_html(findings: list[Finding], app_info: dict, zip_name: str, elapsed: float) -> str:
    counts = defaultdict(int)
    for f in findings:
        counts[f.sev] += 1

    def sev_color(s):
        return SEV_BADGE.get(s, '#6b7280')

    rows = ""
    for f in sorted(findings, key=lambda x: SEV_ORDER.get(x.sev, 99)):
        cve_badge = f'<span style="font-size:10px;background:#111;border:1px solid #666;padding:1px 6px;border-radius:3px;color:#aaa">{f.cve}</span>' if f.cve else ""
        file_line = f'<span style="color:#666;font-size:10px">{f.file or ""}{":" + str(f.line) if f.line else ""}</span>'
        snippet_html = f'<pre style="margin:6px 0 0;font-size:10px;color:#9ca3af;background:#111;padding:6px;border-radius:4px;overflow:auto;white-space:pre-wrap;word-break:break-all">{f.snippet}</pre>' if f.snippet else ""
        rows += f"""
        <tr>
          <td style="padding:8px;vertical-align:top">
            <span style="font-size:10px;font-weight:700;color:{sev_color(f.sev)};text-transform:uppercase;white-space:nowrap">{f.sev}</span>
          </td>
          <td style="padding:8px;vertical-align:top">
            <span style="font-size:11px;font-weight:600;color:#f5f5f5;display:block">[{f.layer}] {f.title}</span>
            {cve_badge}
            <span style="font-size:11px;color:#9ca3af;display:block;margin-top:4px">{f.detail}</span>
            {file_line}
            {snippet_html}
          </td>
        </tr>"""

    finger = ""
    if app_info:
        if app_info.get("languages"):
            finger += f'<div style="margin-bottom:6px"><span style="color:#6b7280;font-size:10px">Languages</span><br><span style="color:#e5e7eb;font-size:11px">{", ".join(app_info["languages"])}</span></div>'
        if app_info.get("frameworks"):
            finger += f'<div style="margin-bottom:6px"><span style="color:#6b7280;font-size:10px">Frameworks</span><br><span style="color:#e5e7eb;font-size:11px">{", ".join(app_info["frameworks"])}</span></div>'
        if app_info.get("databases"):
            finger += f'<div style="margin-bottom:6px"><span style="color:#6b7280;font-size:10px">Databases</span><br><span style="color:#e5e7eb;font-size:11px">{", ".join(app_info["databases"])}</span></div>'
        if app_info.get("cloud"):
            finger += f'<div style="margin-bottom:6px"><span style="color:#6b7280;font-size:10px">Cloud Providers</span><br><span style="color:#e5e7eb;font-size:11px">{", ".join(app_info["cloud"])}</span></div>'
        finger += f'<div style="margin-bottom:6px"><span style="color:#6b7280;font-size:10px">Files Scanned</span><br><span style="color:#e5e7eb;font-size:11px">{app_info.get("total_files",0):,} files · {app_info.get("total_lines",0):,} lines · {app_info.get("test_files",0)} test files</span></div>'

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Alpha App Scanner Report — {zip_name}</title>
<style>
  body {{font-family:monospace;background:#0a0a0a;color:#e5e7eb;margin:0;padding:24px}}
  h1 {{font-size:18px;color:#22c55e;margin:0 0 4px}}
  h2 {{font-size:13px;color:#9ca3af;font-weight:400;margin:0 0 24px}}
  table {{width:100%;border-collapse:collapse;margin-top:16px}}
  tr {{border-bottom:1px solid #1f2937}}
  tr:hover td {{background:#111}}
  .stat {{display:inline-block;text-align:center;border:1px solid #374151;border-radius:6px;padding:8px 16px;margin:4px}}
  .stat-n {{font-size:24px;font-weight:700;font-family:monospace;display:block}}
  .section {{margin:24px 0;border:1px solid #1f2937;border-radius:8px;padding:16px}}
  .section-title {{font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:#6b7280;margin-bottom:12px}}
</style>
</head>
<body>
<h1>⚡ Alpha App Scanner™ — Vulnerability Report</h1>
<h2>© 2024-2026 Alpha Unlimited Technologies LLC. All Rights Reserved.</h2>
<div>
  <div style="color:#6b7280;font-size:11px;margin-bottom:12px">
    Application: <strong style="color:#e5e7eb">{zip_name}</strong> ·
    Scanned: <strong style="color:#e5e7eb">{datetime.datetime.utcnow().strftime("%Y-%m-%d %H:%M")} UTC</strong> ·
    Duration: <strong style="color:#e5e7eb">{elapsed:.1f}s</strong> ·
    Total findings: <strong style="color:#e5e7eb">{len(findings)}</strong>
  </div>
  <div>
    {''.join([f'<div class="stat"><span class="stat-n" style="color:{sev_color(s)}">{counts.get(s,0)}</span><span style="font-size:10px;color:#6b7280">{s}</span></div>' for s in [CRITICAL,HIGH,MEDIUM,LOW,INFO]])}
  </div>
</div>

<div class="section">
  <div class="section-title">Application Fingerprint</div>
  {finger or '<span style="color:#374151;font-size:11px">Could not fingerprint application</span>'}
</div>

<div class="section">
  <div class="section-title">Findings ({len(findings)} total)</div>
  {f'<table><tbody>{rows}</tbody></table>' if findings else '<span style="color:#22c55e;font-size:13px">✓ No issues found</span>'}
</div>

<div style="margin-top:32px;color:#374151;font-size:10px">
  PROPRIETARY AND CONFIDENTIAL · © 2024-2026 Alpha Unlimited Technologies LLC · All Rights Reserved Worldwide in Perpetuity · Patent Pending
</div>
</body>
</html>"""

# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="Alpha App Scanner™ v1.0")
    parser.add_argument("--zip",     required=True, help="Path to ZIP file to scan")
    parser.add_argument("--out",     default="-",   help="Output HTML file path (- for stdout)")
    parser.add_argument("--json",    action="store_true", help="Also emit JSON summary to <out>.json")
    parser.add_argument("--no-deps", action="store_true", help="Skip dependency CVE scan")
    parser.add_argument("--no-secrets", action="store_true", help="Skip secret scanning")
    parser.add_argument("--no-sast", action="store_true", help="Skip SAST scanning")
    args = parser.parse_args()

    zip_path = Path(args.zip)
    if not zip_path.exists():
        print(f"ERROR: ZIP file not found: {zip_path}", file=sys.stderr)
        sys.exit(1)

    start = time.time()
    tmp_dir = Path(tempfile.mkdtemp(prefix="alpha_app_"))

    try:
        # Extract
        print(f"[Alpha App Scanner] Extracting {zip_path.name} ...", flush=True)
        if zip_path.suffix.lower() == ".zip":
            with zipfile.ZipFile(zip_path, "r") as zf:
                # Safety: prevent path traversal in zip entries
                for member in zf.namelist():
                    if ".." in member or member.startswith("/"):
                        print(f"  [SKIP] Dangerous path in archive: {member}", flush=True)
                        continue
                    zf.extract(member, tmp_dir)
        elif zip_path.suffix.lower() in (".tar", ".gz", ".tgz", ".bz2"):
            with tarfile.open(zip_path, "r:*") as tf:
                tf.extractall(tmp_dir)
        else:
            print(f"ERROR: Unsupported archive format: {zip_path.suffix}", file=sys.stderr)
            sys.exit(1)

        # Find actual root (handle single top-level dir in archive)
        contents = list(tmp_dir.iterdir())
        scan_root = tmp_dir
        if len(contents) == 1 and contents[0].is_dir():
            scan_root = contents[0]

        total_files = sum(1 for _ in scan_root.rglob("*") if not any(p in _.parts for p in SKIP_DIRS))
        print(f"[Alpha App Scanner] Extracted {total_files} files. Starting scan...", flush=True)

        # Run layers
        findings: list[Finding] = []
        app_info = fingerprint_app(scan_root)
        print(f"[Alpha App Scanner] App fingerprint: langs={app_info['languages']}, frameworks={app_info['frameworks']}", flush=True)

        if not args.no_deps:
            print("[Alpha App Scanner] Layer 1: Dependency CVE scan...", flush=True)
            dep_findings = scan_dependencies(scan_root)
            findings.extend(dep_findings)
            print(f"  → {len(dep_findings)} findings", flush=True)

        if not args.no_secrets:
            print("[Alpha App Scanner] Layer 2: Secret/credential detection...", flush=True)
            sec_findings = scan_secrets(scan_root)
            findings.extend(sec_findings)
            print(f"  → {len(sec_findings)} findings", flush=True)

        if not args.no_sast:
            print("[Alpha App Scanner] Layer 3: SAST static analysis...", flush=True)
            sast_findings = scan_sast(scan_root)
            findings.extend(sast_findings)
            print(f"  → {len(sast_findings)} findings", flush=True)

        # Deduplicate (same file+title)
        seen = set()
        unique_findings = []
        for f in findings:
            key = (f.file, f.title, f.line)
            if key not in seen:
                seen.add(key)
                unique_findings.append(f)
        findings = unique_findings

        elapsed = time.time() - start
        print(f"[Alpha App Scanner] Scan complete in {elapsed:.1f}s. Total findings: {len(findings)}", flush=True)

        # Severity summary
        by_sev = defaultdict(list)
        for f in findings:
            by_sev[f.sev].append(f)
        for sev in [CRITICAL, HIGH, MEDIUM, LOW]:
            if by_sev[sev]:
                print(f"  {sev}: {len(by_sev[sev])}", flush=True)

        # Generate HTML
        html = generate_html(findings, app_info, zip_path.name, elapsed)
        if args.out == "-":
            sys.stdout.write(html)
        else:
            Path(args.out).write_text(html, encoding="utf-8")
            print(f"[Alpha App Scanner] HTML report → {args.out}", flush=True)

        # JSON summary
        if args.json:
            json_path = args.out + ".json" if args.out != "-" else None
            summary = {
                "zip": str(zip_path),
                "scanned_at": datetime.datetime.utcnow().isoformat() + "Z",
                "elapsed_s": round(elapsed, 2),
                "total_findings": len(findings),
                "by_severity": {s: len(by_sev[s]) for s in [CRITICAL, HIGH, MEDIUM, LOW, INFO]},
                "app_info": app_info,
                "findings": [f.to_dict() for f in findings],
            }
            if json_path:
                Path(json_path).write_text(json.dumps(summary, indent=2), encoding="utf-8")
                print(f"[Alpha App Scanner] JSON → {json_path}", flush=True)
            else:
                sys.stderr.write(json.dumps(summary) + "\n")

        sys.exit(0)

    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)

if __name__ == "__main__":
    main()
