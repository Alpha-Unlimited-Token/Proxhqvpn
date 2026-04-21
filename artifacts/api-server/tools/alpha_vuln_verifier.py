#!/usr/bin/env python3
"""
Alpha Vulnerability Verifier™ v1.0.0
(C) 2026 Alpha Unlimited Technologies LLC — All Rights Reserved
Proprietary and Confidential

Reads an Alpha External Scanner™ HTML report and actively verifies each
finding — probing every exposed surface to show EXACTLY what an attacker
would see. Outputs a full exposure report with all accessible data.

AUTHORIZED USE ONLY — Run this tool exclusively against systems you own
or have explicit written authorization to test.

Usage:
  python3 alpha_vuln_verifier.py report.html
  python3 alpha_vuln_verifier.py report.html -o ~/Desktop
  python3 alpha_vuln_verifier.py report.html --target https://mysite.com
  python3 alpha_vuln_verifier.py  (interactive mode)

No external dependencies — stdlib only.
"""

import os
import sys
import re
import json
import ssl
import socket
import time
import argparse
import urllib.request
import urllib.parse
import urllib.error
import html
from datetime import datetime
from pathlib import Path
from collections import OrderedDict

VERSION = "2.0.0"
TIMEOUT = 10
MAX_RESPONSE = 50000

BANNER = """
\033[33m╔══════════════════════════════════════════════════════════════╗
║   Alpha Vulnerability Verifier™ v{ver:<25s}║
║   (C) 2026 Alpha Unlimited Technologies LLC                  ║
║   Proprietary and Confidential                               ║
║                                                              ║
║   Verify Findings → Show All Exposed Data                    ║
║   Read-Only Security Assessment Tool                         ║
╚══════════════════════════════════════════════════════════════╝\033[0m
""".format(ver=VERSION)

WARNING = """
\033[91m  ╔══════════════════════════════════════════════════════════╗
  ║  WARNING: AUTHORIZED USE ONLY                            ║
  ║  Run ONLY against systems you OWN or have WRITTEN        ║
  ║  authorization to test. Unauthorized use is illegal.     ║
  ╚══════════════════════════════════════════════════════════╝\033[0m
"""

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE


def decode_html(text):
    text = html.unescape(text)
    text = re.sub(r'<[^>]+>', '', text)
    return text.strip()


def safe_request(url, method="GET", headers=None, data=None, timeout=TIMEOUT):
    if not headers:
        headers = {}
    headers.setdefault("User-Agent", "Alpha-Verifier/1.0")
    try:
        req = urllib.request.Request(url, method=method, headers=headers, data=data)
        resp = urllib.request.urlopen(req, timeout=timeout, context=ctx)
        body = resp.read(MAX_RESPONSE)
        resp_headers = dict(resp.headers)
        return {
            "status": resp.status,
            "headers": resp_headers,
            "body": body.decode("utf-8", errors="replace"),
            "url": resp.url,
            "error": None,
        }
    except urllib.error.HTTPError as e:
        body = ""
        try:
            body = e.read(MAX_RESPONSE).decode("utf-8", errors="replace")
        except:
            pass
        return {
            "status": e.code,
            "headers": dict(e.headers) if e.headers else {},
            "body": body,
            "url": url,
            "error": str(e),
        }
    except Exception as e:
        return {
            "status": 0,
            "headers": {},
            "body": "",
            "url": url,
            "error": str(e),
        }


def port_probe(host, port, timeout=5):
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(timeout)
        result = sock.connect_ex((host, port))
        if result == 0:
            try:
                sock.send(b"\r\n")
                banner = sock.recv(1024).decode("utf-8", errors="replace")
            except:
                banner = ""
            sock.close()
            return {"open": True, "banner": banner.strip()}
        sock.close()
        return {"open": False, "banner": ""}
    except Exception as e:
        return {"open": False, "banner": "", "error": str(e)}


def ssl_probe(host, port=443):
    results = {}
    try:
        probe_ctx = ssl.create_default_context()
        conn = probe_ctx.wrap_socket(socket.socket(), server_hostname=host)
        conn.settimeout(TIMEOUT)
        conn.connect((host, port))
        cert = conn.getpeercert()
        cipher = conn.cipher()
        version = conn.version()
        conn.close()

        results["valid"] = True
        results["version"] = version
        results["cipher"] = f"{cipher[0]} {cipher[2]}bits" if cipher else "unknown"
        results["subject"] = dict(x[0] for x in cert.get("subject", []))
        results["issuer"] = dict(x[0] for x in cert.get("issuer", []))
        results["serial"] = cert.get("serialNumber", "")
        results["not_before"] = cert.get("notBefore", "")
        results["not_after"] = cert.get("notAfter", "")
        results["san"] = [entry[1] for entry in cert.get("subjectAltName", [])]
    except ssl.SSLCertVerificationError as e:
        results["valid"] = False
        results["error"] = str(e)
        try:
            bad_ctx = ssl.create_default_context()
            bad_ctx.check_hostname = False
            bad_ctx.verify_mode = ssl.CERT_NONE
            conn2 = bad_ctx.wrap_socket(socket.socket(), server_hostname=host)
            conn2.settimeout(TIMEOUT)
            conn2.connect((host, port))
            der = conn2.getpeercert(True)
            cipher = conn2.cipher()
            version = conn2.version()
            conn2.close()
            results["version"] = version
            results["cipher"] = f"{cipher[0]} {cipher[2]}bits" if cipher else "unknown"
            if der:
                cert2 = ssl.DER_cert_to_PEM_cert(der)
                results["pem_cert_preview"] = cert2[:500]
        except:
            pass
    except Exception as e:
        results["valid"] = False
        results["error"] = str(e)
    return results


class ReportFinding:
    def __init__(self):
        self.finding_id = ""
        self.category = ""
        self.title = ""
        self.severity = ""
        self.cwe = ""
        self.description = ""
        self.evidence = ""
        self.response_data = ""
        self.fix = ""


def parse_report(html_path):
    with open(html_path, "r", encoding="utf-8", errors="replace") as fh:
        content = fh.read()

    target_m = re.search(r'Target:\s*<span[^>]*>(.*?)</span>', content)
    target = decode_html(target_m.group(1)) if target_m else ""

    findings = []
    for block_m in re.finditer(
        r'<div class="finding"[^>]*>(.*?)</div>\s*(?=<div class="finding"|<h2|<div style="text-align:center)',
        content, re.DOTALL
    ):
        block = block_m.group(1)
        f = ReportFinding()

        fid = re.search(r'\[([A-Z\-]+\d+(?:-\d+)?)\]', block)
        if fid:
            f.finding_id = fid.group(1)

        cat_title = re.search(
            r'\[' + re.escape(f.finding_id) + r'\].*?\[([^\]]+)\]\s*(.*?)</span>',
            block, re.DOTALL
        )
        if cat_title:
            f.category = cat_title.group(1)
            f.title = decode_html(cat_title.group(2))

        badge = re.search(r'class="badge"[^>]*>(.*?)</span>', block)
        if badge:
            f.severity = decode_html(badge.group(1)).strip()

        cwe_m = re.search(r'(CWE-\d+)', block)
        if cwe_m:
            f.cwe = cwe_m.group(1)

        desc = re.search(r'font-size:13px[^>]*>(.*?)</div>', block, re.DOTALL)
        if desc:
            f.description = decode_html(desc.group(1))

        ev = re.search(r'<pre>(.*?)</pre>', block, re.DOTALL)
        if ev:
            f.evidence = decode_html(ev.group(1))

        resp = re.search(r'<details>.*?<pre[^>]*>(.*?)</pre>\s*</details>', block, re.DOTALL)
        if resp:
            f.response_data = decode_html(resp.group(1))

        fix = re.search(r'<strong>Fix:</strong>\s*(.*?)</div>', block, re.DOTALL)
        if fix:
            f.fix = decode_html(fix.group(1))

        findings.append(f)

    return target, findings


class VulnVerifier:

    def __init__(self, target, findings, verbose=True):
        self.target = target.rstrip("/")
        self.findings = findings
        self.verbose = verbose
        parsed = urllib.parse.urlparse(self.target)
        self.hostname = parsed.hostname or ""
        self.scheme = parsed.scheme or "https"
        self.base = f"{self.scheme}://{self.hostname}"
        self.results = []
        self.stats = {"start": 0, "end": 0, "verified": 0, "exposed": 0, "total": 0, "false_positives": 0}
        self.cdn_info = {"detected": False, "name": None, "evidence": [], "homepage_length": 0}

    def _detect_cdn(self):
        try:
            resp = safe_request(self.target)
            if resp["error"] and resp["status"] == 0:
                return
            self.cdn_info["homepage_length"] = len(resp.get("body", ""))
            h_lower = {k.lower(): str(v) for k, v in resp.get("headers", {}).items()}
            cdn_signals = [
                ("cf-ray",         "Cloudflare"),
                ("cf-cache-status","Cloudflare"),
                ("server",         {"cloudflare": "Cloudflare", "pws": "Pantheon (PWS)",
                                    "fastly": "Fastly", "akamaighost": "Akamai",
                                    "varnish": "Fastly/Varnish", "amazons3": "AWS S3",
                                    "cloudfront": "AWS CloudFront", "nginx-cdn": "CDN"}),
                ("x-served-by",    "Fastly"),
                ("x-cache",        "CDN cache layer"),
                ("x-amz-cf-id",    "AWS CloudFront"),
                ("x-akamai-transformed", "Akamai"),
                ("x-fastly-request-id", "Fastly"),
                ("x-px",           "Pantheon"),
                ("x-pantheon-styx-hostname", "Pantheon"),
                ("x-vercel-id",    "Vercel"),
                ("x-nf-request-id","Netlify"),
                ("x-ws-request-id","Pantheon (PWS)"),
            ]
            detected_names = []
            for header, mapping in cdn_signals:
                if header in h_lower:
                    val = h_lower[header].lower()
                    if isinstance(mapping, dict):
                        for needle, name in mapping.items():
                            if needle in val:
                                detected_names.append(name)
                                self.cdn_info["evidence"].append(f"{header}: {h_lower[header][:80]}")
                    else:
                        detected_names.append(mapping)
                        self.cdn_info["evidence"].append(f"{header}: {h_lower[header][:80]}")
            via = h_lower.get("via", "").lower()
            if "cloudflare" in via or "varnish" in via or "akamai" in via:
                detected_names.append("Proxy via header")
                self.cdn_info["evidence"].append(f"via: {h_lower['via'][:80]}")
            if detected_names:
                seen = []
                for n in detected_names:
                    if n not in seen:
                        seen.append(n)
                self.cdn_info["detected"] = True
                self.cdn_info["name"] = " + ".join(seen)
        except Exception as e:
            self.cdn_info["evidence"].append(f"detect error: {e}")

    def run(self):
        self.stats["start"] = time.time()
        self.stats["total"] = len(self.findings)

        print(f"\n  Target:     {self.target}")
        print(f"  Hostname:   {self.hostname}")
        print(f"  Findings:   {len(self.findings)} to verify")

        print(f"  CDN check:  ", end="", flush=True)
        self._detect_cdn()
        if self.cdn_info["detected"]:
            print(f"\033[33m{self.cdn_info['name']}\033[0m  (port/SSRF probes will be cross-checked)")
        else:
            print("\033[32mnone\033[0m")
        print()

        for i, f in enumerate(self.findings, 1):
            print(f"  [{i:2d}/{len(self.findings)}] Verifying [{f.finding_id}] {f.title}...", end="", flush=True)
            try:
                result = self._verify_finding(f)
                self.results.append(result)
                if result.get("false_positive"):
                    self.stats["false_positives"] += 1
                    print(f" \033[33mFALSE POSITIVE\033[0m ({result.get('false_positive_reason','')[:60]})")
                elif result.get("verified"):
                    self.stats["verified"] += 1
                    if result.get("exposed_data"):
                        self.stats["exposed"] += 1
                    print(f" \033[91mEXPOSED\033[0m")
                else:
                    print(f" \033[32msafe\033[0m")
            except Exception as e:
                self.results.append({
                    "finding": f.__dict__,
                    "verified": False,
                    "error": str(e),
                    "exposed_data": None,
                })
                print(f" \033[33merror\033[0m")

        self._run_extra_recon()

        self.stats["end"] = time.time()
        return self.results

    def _verify_finding(self, f):
        cat = f.category.lower()
        title = f.title.lower()
        evidence = f.evidence.lower()

        result = {
            "finding": {
                "id": f.finding_id,
                "category": f.category,
                "title": f.title,
                "severity": f.severity,
                "cwe": f.cwe,
                "description": f.description,
                "original_evidence": f.evidence,
            },
            "verified": False,
            "exposed_data": None,
            "details": {},
        }

        if "ssl" in cat or "tls" in cat or "certificate" in title:
            result = self._verify_ssl(f, result)
        elif "database" in cat or "port" in cat.lower() or "db" in cat.lower():
            result = self._verify_port(f, result)
        elif "security header" in cat or "header" in cat.lower():
            result = self._verify_headers(f, result)
        elif "csp" in cat:
            result = self._verify_csp(f, result)
        elif "hsts" in cat:
            result = self._verify_hsts(f, result)
        elif "information disclosure" in cat or "server" in title:
            result = self._verify_info_disclosure(f, result)
        elif "ssrf" in cat or "metadata" in title:
            result = self._verify_ssrf_metadata(f, result)
        elif "sql injection" in cat or "sqli" in title:
            result = self._verify_sqli(f, result)
        elif "email" in cat or "email" in title:
            result = self._verify_email_injection(f, result)
        elif "rate" in cat or "rate" in title:
            result = self._verify_rate_limiting(f, result)
        elif "mime" in cat or "content-type" in title:
            result = self._verify_mime(f, result)
        elif "mixed content" in cat or "mixed" in title:
            result = self._verify_mixed_content(f, result)
        elif "security.txt" in cat or "security.txt" in title:
            result = self._verify_security_txt(f, result)
        elif "cors" in cat:
            result = self._verify_cors(f, result)
        elif "cookie" in cat:
            result = self._verify_cookies(f, result)
        elif "file" in cat or "backup" in cat or "log" in cat or "exposed" in title:
            result = self._verify_file_exposure(f, result)
        elif "method" in cat or "put" in title or "delete" in title:
            result = self._verify_http_methods(f, result)
        elif "api" in cat:
            result = self._verify_api_exposure(f, result)
        elif "clickjack" in cat or "frame" in cat:
            result = self._verify_clickjacking(f, result)
        else:
            result = self._verify_generic(f, result)

        return result

    def _verify_ssl(self, f, result):
        data = ssl_probe(self.hostname)
        result["verified"] = True
        result["details"] = data
        exposed = {}
        if not data.get("valid"):
            err = data.get("error", "Certificate invalid")
            exposed["ssl_error"] = err
            trust_store_signals = [
                "unable to get local issuer certificate",
                "self-signed certificate in certificate chain",
                "ca md too weak",
            ]
            if any(sig in err.lower() for sig in trust_store_signals):
                pem = data.get("pem_cert_preview", "") or ""
                trusted_ca_keywords = ["sectigo", "let's encrypt", "letsencrypt",
                                       "digicert", "globalsign", "comodo", "amazon",
                                       "google trust services", "isrg", "cloudflare",
                                       "entrust", "godaddy", "buypass", "actalis"]
                if pem and any(k in pem.lower() for k in trusted_ca_keywords):
                    result["false_positive"] = True
                    result["false_positive_reason"] = (
                        "Cert is from a trusted public CA — scanner's local trust store "
                        "is missing the intermediate CA"
                    )
                    exposed["verdict"] = "FALSE POSITIVE — cert is valid in browsers; scanner trust store issue"
        if data.get("version"):
            exposed["tls_version"] = data["version"]
        if data.get("cipher"):
            exposed["cipher_suite"] = data["cipher"]
        if data.get("subject"):
            exposed["cert_subject"] = data["subject"]
        if data.get("issuer"):
            exposed["cert_issuer"] = data["issuer"]
        if data.get("serial"):
            exposed["cert_serial"] = data["serial"]
        if data.get("not_before"):
            exposed["cert_valid_from"] = data["not_before"]
        if data.get("not_after"):
            exposed["cert_expires"] = data["not_after"]
        if data.get("san"):
            exposed["alt_names"] = data["san"]
        if data.get("pem_cert_preview"):
            exposed["raw_cert_pem"] = data["pem_cert_preview"]
        result["exposed_data"] = exposed
        return result

    def _verify_port(self, f, result):
        port_m = re.search(r'(\d+)', f.evidence)
        if not port_m:
            port_m = re.search(r'(\d{2,5})', f.title)
        if not port_m:
            return result

        port = int(port_m.group(1))
        probe = port_probe(self.hostname, port)
        result["verified"] = probe["open"]
        result["details"] = {"port": port, "probe": probe}
        if probe["open"]:
            db_ports = {3306, 5432, 1433, 27017, 6379, 9200, 5984, 8529, 9042, 11211}
            if (self.cdn_info["detected"]
                and not probe["banner"]
                and port in db_ports):
                result["false_positive"] = True
                result["false_positive_reason"] = (
                    f"Behind {self.cdn_info['name']} — CDN edge accepts TCP on all ports "
                    f"but no real service is exposed (no banner returned)"
                )
                result["exposed_data"] = {
                    "port": port,
                    "status": "OPEN at CDN edge — NOT a real database exposure",
                    "service_banner": "No banner — Cloudflare/CDN swallows the connection",
                    "cdn_detected": self.cdn_info["name"],
                    "cdn_evidence": self.cdn_info["evidence"][:6],
                    "verdict": "FALSE POSITIVE — origin database is not actually exposed",
                }
                return result

            exposed = {
                "port": port,
                "status": "OPEN — Accessible from internet",
                "service_banner": probe["banner"] if probe["banner"] else "No banner (service listening but silent)",
            }
            svc_map = {
                3306: "MySQL", 5432: "PostgreSQL", 1433: "MSSQL",
                27017: "MongoDB", 6379: "Redis", 9200: "Elasticsearch",
                5984: "CouchDB", 8529: "ArangoDB", 9042: "Cassandra",
            }
            if port in svc_map:
                exposed["identified_service"] = svc_map[port]
                exposed["risk"] = f"Direct {svc_map[port]} access from internet — attacker can attempt authentication"

            if probe["banner"]:
                ver = re.search(r'(\d+\.\d+[\.\d]*)', probe["banner"])
                if ver:
                    exposed["detected_version"] = ver.group(1)

            result["exposed_data"] = exposed
        return result

    def _verify_headers(self, f, result):
        resp = safe_request(self.target)
        if resp["error"] and resp["status"] == 0:
            return result

        result["verified"] = True
        headers = resp["headers"]
        exposed = {
            "all_response_headers": headers,
            "missing_security_headers": [],
        }

        security_headers = {
            "Strict-Transport-Security": "HSTS",
            "Content-Security-Policy": "CSP",
            "X-Content-Type-Options": "MIME sniffing protection",
            "X-Frame-Options": "Clickjacking protection",
            "Referrer-Policy": "Referrer leakage protection",
            "Permissions-Policy": "Browser feature restrictions",
            "X-Permitted-Cross-Domain-Policies": "Cross-domain policy",
        }

        h_lower = {k.lower(): v for k, v in headers.items()}
        for header, purpose in security_headers.items():
            if header.lower() not in h_lower:
                exposed["missing_security_headers"].append(f"{header} ({purpose})")

        if "server" in h_lower:
            exposed["server_version"] = h_lower["server"]
        if "x-powered-by" in h_lower:
            exposed["powered_by"] = h_lower["x-powered-by"]
        if "via" in h_lower:
            exposed["proxy_info"] = h_lower["via"]
        if "x-aspnet-version" in h_lower:
            exposed["aspnet_version"] = h_lower["x-aspnet-version"]

        result["exposed_data"] = exposed
        return result

    def _verify_csp(self, f, result):
        resp = safe_request(self.target)
        if resp["error"] and resp["status"] == 0:
            return result

        result["verified"] = True
        h_lower = {k.lower(): v for k, v in resp["headers"].items()}
        csp = h_lower.get("content-security-policy", "")

        exposed = {"csp_value": csp, "weaknesses": []}

        if not csp:
            exposed["weaknesses"].append("NO CSP — Any script can execute on this page")
        else:
            if "'unsafe-inline'" in csp:
                exposed["weaknesses"].append("unsafe-inline: Inline scripts allowed — XSS payloads execute directly")
            if "'unsafe-eval'" in csp:
                exposed["weaknesses"].append("unsafe-eval: eval() allowed — code injection via string-to-code")
            if "data:" in csp:
                exposed["weaknesses"].append("data: URIs allowed — Can embed executable content via data: URLs")
            if "*" in csp:
                exposed["weaknesses"].append("Wildcard (*): Scripts loadable from ANY domain")

            directives = {}
            for part in csp.split(";"):
                part = part.strip()
                if " " in part:
                    key, val = part.split(" ", 1)
                    directives[key] = val
            exposed["parsed_directives"] = directives

        result["exposed_data"] = exposed
        return result

    def _verify_hsts(self, f, result):
        resp = safe_request(self.target)
        if resp["error"] and resp["status"] == 0:
            return result

        result["verified"] = True
        h_lower = {k.lower(): v for k, v in resp["headers"].items()}
        hsts = h_lower.get("strict-transport-security", "")

        exposed = {"hsts_value": hsts, "issues": []}
        if not hsts:
            exposed["issues"].append("NO HSTS — Browser accepts HTTP downgrade attacks")
        else:
            age_m = re.search(r'max-age=(\d+)', hsts)
            if age_m:
                age = int(age_m.group(1))
                exposed["max_age_seconds"] = age
                exposed["max_age_days"] = round(age / 86400, 1)
                if age < 31536000:
                    exposed["issues"].append(f"max-age too short ({age}s = {round(age/86400)}d), should be 1 year+")
            if "includesubdomains" not in hsts.lower():
                exposed["issues"].append("Missing includeSubDomains — subdomains not protected")
            if "preload" not in hsts.lower():
                exposed["issues"].append("Missing preload — not eligible for browser HSTS preload list")

        result["exposed_data"] = exposed
        return result

    def _verify_info_disclosure(self, f, result):
        resp = safe_request(self.target)
        if resp["error"] and resp["status"] == 0:
            return result

        result["verified"] = True
        headers = resp["headers"]
        h_lower = {k.lower(): v for k, v in headers.items()}

        exposed = {"leaked_info": {}}

        for key in ["server", "x-powered-by", "x-aspnet-version", "x-generator",
                     "x-drupal-cache", "x-varnish", "via", "x-cache", "x-request-id",
                     "x-runtime", "x-version", "x-backend-server"]:
            if key in h_lower:
                exposed["leaked_info"][key] = h_lower[key]

        tech_patterns = [
            (r'(PHP/[\d.]+)', "PHP Version"),
            (r'(Apache/[\d.]+)', "Apache Version"),
            (r'(nginx/[\d.]+)', "Nginx Version"),
            (r'(Microsoft-IIS/[\d.]+)', "IIS Version"),
            (r'(Express)', "Express.js"),
            (r'(PWS/[\d.]+)', "PWS Version"),
        ]
        server = h_lower.get("server", "")
        for pat, name in tech_patterns:
            m = re.search(pat, server, re.IGNORECASE)
            if m:
                exposed["leaked_info"][name] = m.group(1)

        html_body = resp["body"][:10000]
        html_leaks = []
        for pat, name in [
            (r'<!--.*?version[:\s]*([\d.]+).*?-->', "HTML comment version"),
            (r'<meta name="generator" content="([^"]+)"', "Generator meta tag"),
            (r'wp-content/', "WordPress detected"),
            (r'/wp-includes/', "WordPress includes"),
        ]:
            m = re.search(pat, html_body, re.IGNORECASE)
            if m:
                html_leaks.append(f"{name}: {m.group(0)[:100]}")
        if html_leaks:
            exposed["html_leaks"] = html_leaks

        result["exposed_data"] = exposed
        return result

    def _verify_ssrf_metadata(self, f, result):
        metadata_urls = [
            ("AWS EC2 Metadata", f"{self.target}/?url=http://169.254.169.254/latest/meta-data/"),
            ("GCP Metadata", f"{self.target}/?url=http://metadata.google.internal/computeMetadata/v1/"),
            ("Azure Metadata", f"{self.target}/?url=http://169.254.169.254/metadata/instance"),
        ]

        result["verified"] = True
        exposed = {"metadata_probes": []}
        any_real_metadata = False

        for name, url in metadata_urls:
            resp = safe_request(url)
            probe_data = {
                "service": name,
                "url": url,
                "status": resp["status"],
                "response_length": len(resp["body"]),
            }
            if resp["status"] == 200 and len(resp["body"]) > 0:
                body = resp["body"]
                meta_indicators = ["ami-id", "instance-id", "local-ipv4", "public-ipv4",
                                   "security-credentials", "iam", "project-id", "access-token",
                                   "hostname", "instance-type"]
                found = [ind for ind in meta_indicators if ind in body.lower()]
                if found:
                    probe_data["metadata_found"] = True
                    probe_data["indicators"] = found
                    probe_data["response_preview"] = body[:2000]
                    any_real_metadata = True
                else:
                    probe_data["metadata_found"] = False
                    probe_data["response_preview"] = body[:500]
                    hp_len = self.cdn_info.get("homepage_length", 0)
                    if hp_len > 0 and abs(len(body) - hp_len) < max(200, hp_len * 0.02):
                        probe_data["matches_homepage"] = True
            exposed["metadata_probes"].append(probe_data)

        if not any_real_metadata:
            homepage_matches = sum(1 for p in exposed["metadata_probes"] if p.get("matches_homepage"))
            if homepage_matches >= 2:
                result["false_positive"] = True
                result["false_positive_reason"] = (
                    "All 3 cloud metadata probes returned the regular homepage "
                    "(server ignores ?url= parameter — no SSRF)"
                )
                exposed["verdict"] = (
                    "FALSE POSITIVE — server returned the homepage for all metadata probes "
                    "(no metadata indicators found, response length matches homepage)"
                )
                result["exposed_data"] = exposed
                return result

        result["exposed_data"] = exposed
        return result

    def _verify_sqli(self, f, result):
        page_path = ""
        path_m = re.search(r'on\s+(/[^\s]+)', f.title, re.IGNORECASE)
        if path_m:
            page_path = path_m.group(1)

        if not page_path:
            path_m = re.search(r'(/[a-zA-Z0-9/\-_]+)', f.evidence)
            if path_m:
                page_path = path_m.group(1)

        test_url = f"{self.base}{page_path}" if page_path else self.target

        probes = [
            ("Single quote", f"{test_url}?id=%27"),
            ("OR 1=1", f"{test_url}?id=1%20OR%201%3D1--"),
            ("UNION SELECT", f"{test_url}?id=%27%20UNION%20SELECT%20NULL--"),
        ]

        result["verified"] = True
        exposed = {"sqli_probes": [], "page": page_path or "/"}

        sql_errors = [
            "sql syntax", "mysql", "sqlite", "postgresql", "oracle",
            "syntax error", "unclosed quotation", "unterminated",
            "odbc", "ole db", "sql server", "database error",
            "warning:", "fatal error", "pg_query", "mysql_",
            "you have an error in your sql", "supplied argument",
        ]

        for name, url in probes:
            resp = safe_request(url)
            probe_data = {
                "test": name,
                "url": url,
                "status": resp["status"],
                "response_length": len(resp["body"]),
            }
            body_lower = resp["body"].lower()
            found_errors = [err for err in sql_errors if err in body_lower]
            if found_errors:
                probe_data["sql_errors_detected"] = found_errors
                probe_data["vulnerable"] = True
                probe_data["response_preview"] = resp["body"][:3000]
            else:
                probe_data["vulnerable"] = False

            exposed["sqli_probes"].append(probe_data)

        result["exposed_data"] = exposed
        return result

    def _verify_email_injection(self, f, result):
        test_url = f"{self.target}/contact"
        payloads = [
            ("Newline BCC", {"email": "test@test.com\r\nBcc:probe@test.com", "message": "test"}),
            ("Newline CC", {"email": "test@test.com\r\nCc:probe@test.com", "message": "test"}),
        ]

        result["verified"] = True
        exposed = {"email_injection_probes": []}

        for name, data in payloads:
            encoded = urllib.parse.urlencode(data).encode()
            resp = safe_request(test_url, method="POST", data=encoded,
                               headers={"Content-Type": "application/x-www-form-urlencoded"})
            probe = {
                "test": name,
                "status": resp["status"],
                "response_length": len(resp["body"]),
            }
            if resp["status"] in (200, 302) and "error" not in resp["body"].lower()[:500]:
                probe["potentially_vulnerable"] = True
            else:
                probe["potentially_vulnerable"] = False
            exposed["email_injection_probes"].append(probe)

        result["exposed_data"] = exposed
        return result

    def _verify_rate_limiting(self, f, result):
        result["verified"] = True
        exposed = {"requests": [], "rate_limited": False}

        for i in range(5):
            resp = safe_request(self.target)
            entry = {
                "request_num": i + 1,
                "status": resp["status"],
                "headers": {},
            }
            for key in ["x-ratelimit-limit", "x-ratelimit-remaining", "x-ratelimit-reset",
                         "retry-after", "ratelimit-limit", "ratelimit-remaining"]:
                val = resp["headers"].get(key)
                if val:
                    entry["headers"][key] = val
                    exposed["rate_limited"] = True
            exposed["requests"].append(entry)

        if not exposed["rate_limited"]:
            exposed["risk"] = "No rate limiting detected — brute force, credential stuffing, and DDoS attacks not mitigated"

        result["exposed_data"] = exposed
        return result

    def _verify_mime(self, f, result):
        resp = safe_request(self.target)
        if resp["error"] and resp["status"] == 0:
            return result

        result["verified"] = True
        h_lower = {k.lower(): v for k, v in resp["headers"].items()}
        ct = h_lower.get("content-type", "")
        xcto = h_lower.get("x-content-type-options", "")

        exposed = {
            "content_type": ct,
            "x_content_type_options": xcto or "MISSING",
            "issues": [],
        }
        if "charset" not in ct.lower():
            exposed["issues"].append("No charset in Content-Type — encoding-based XSS possible")
        if not xcto:
            exposed["issues"].append("No X-Content-Type-Options — browser MIME sniffing enabled")

        result["exposed_data"] = exposed
        return result

    def _verify_mixed_content(self, f, result):
        resp = safe_request(self.target)
        if resp["error"] and resp["status"] == 0:
            return result

        result["verified"] = True
        body = resp["body"]
        http_resources = re.findall(r'(?:src|href|action)=["\']?(http://[^"\'>\s]+)', body, re.IGNORECASE)

        exposed = {
            "http_resources_found": len(http_resources),
            "resources": http_resources[:50],
        }
        if http_resources:
            exposed["risk"] = "HTTP resources on HTTPS page — content can be intercepted and modified by attacker"

        result["exposed_data"] = exposed
        return result

    def _verify_security_txt(self, f, result):
        paths = ["/.well-known/security.txt", "/security.txt"]
        result["verified"] = True
        exposed = {"checked_paths": []}

        for path in paths:
            resp = safe_request(f"{self.base}{path}")
            entry = {"path": path, "status": resp["status"]}
            if resp["status"] == 200 and resp["body"]:
                entry["found"] = True
                entry["content"] = resp["body"][:2000]
            else:
                entry["found"] = False
            exposed["checked_paths"].append(entry)

        result["exposed_data"] = exposed
        return result

    def _verify_cors(self, f, result):
        origins = [
            "https://evil-attacker.com",
            "null",
            self.target,
        ]
        result["verified"] = True
        exposed = {"cors_probes": []}

        for origin in origins:
            resp = safe_request(self.target, headers={"Origin": origin})
            acao = resp["headers"].get("Access-Control-Allow-Origin", "")
            acac = resp["headers"].get("Access-Control-Allow-Credentials", "")

            probe = {
                "origin_sent": origin,
                "acao_returned": acao,
                "acac_returned": acac,
            }
            if acao == "*":
                probe["issue"] = "Wildcard CORS — any domain can read responses"
            elif acao == origin and origin == "https://evil-attacker.com":
                probe["issue"] = "Origin reflected — attacker domain accepted"
                if acac.lower() == "true":
                    probe["issue"] += " WITH credentials — full cross-origin data theft possible"
            exposed["cors_probes"].append(probe)

        result["exposed_data"] = exposed
        return result

    def _verify_cookies(self, f, result):
        resp = safe_request(self.target)
        result["verified"] = True
        raw_cookies = resp["headers"].get("Set-Cookie", "")

        exposed = {"cookies": []}
        if raw_cookies:
            for cookie_str in raw_cookies.split(","):
                cookie_str = cookie_str.strip()
                if not cookie_str:
                    continue
                cookie_info = {
                    "raw": cookie_str[:300],
                    "flags": [],
                    "missing_flags": [],
                }
                lower = cookie_str.lower()
                for flag in ["secure", "httponly", "samesite"]:
                    if flag in lower:
                        cookie_info["flags"].append(flag)
                    else:
                        cookie_info["missing_flags"].append(flag)
                exposed["cookies"].append(cookie_info)

        result["exposed_data"] = exposed
        return result

    def _verify_file_exposure(self, f, result):
        file_path = ""
        path_m = re.search(r'(/[^\s"\'<>]+)', f.evidence)
        if path_m:
            file_path = path_m.group(1)
        if not file_path:
            path_m = re.search(r'Exposed:\s*([^\s]+)', f.evidence)
            if path_m:
                file_path = "/" + path_m.group(1).lstrip("/")
        if not file_path:
            for kw in [".bak", ".log", ".env", ".git", ".npmrc", "config", "package.json",
                        "wp-config", ".htaccess", ".htpasswd", "debug"]:
                if kw in f.title.lower() or kw in f.evidence.lower():
                    fname = re.search(r'[\w\-./]+' + re.escape(kw) + r'[\w.]*', f.evidence + " " + f.title)
                    if fname:
                        file_path = "/" + fname.group(0).lstrip("/")
                        break

        if not file_path:
            return result

        url = f"{self.base}{file_path}"
        resp = safe_request(url)

        result["verified"] = resp["status"] == 200
        exposed = {
            "file": file_path,
            "url": url,
            "status": resp["status"],
            "content_type": resp["headers"].get("Content-Type", ""),
            "content_length": len(resp["body"]),
        }

        if resp["status"] == 200 and resp["body"]:
            exposed["content_preview"] = resp["body"][:5000]

            sensitive_patterns = [
                (r'password\s*[=:]\s*\S+', "Password found"),
                (r'api[_-]?key\s*[=:]\s*\S+', "API key found"),
                (r'secret\s*[=:]\s*\S+', "Secret found"),
                (r'token\s*[=:]\s*\S+', "Token found"),
                (r'(mysql|postgres|mongodb)://[^\s"]+', "Database connection string"),
                (r'aws_access_key_id\s*[=:]\s*\S+', "AWS access key"),
                (r'private[_-]?key', "Private key reference"),
            ]
            found_secrets = []
            for pat, name in sensitive_patterns:
                if re.search(pat, resp["body"], re.IGNORECASE):
                    found_secrets.append(name)
            if found_secrets:
                exposed["secrets_detected"] = found_secrets

        result["exposed_data"] = exposed
        return result

    def _verify_http_methods(self, f, result):
        methods = ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "TRACE"]
        result["verified"] = True
        exposed = {"method_responses": []}

        for method in methods:
            resp = safe_request(self.target, method=method)
            entry = {
                "method": method,
                "status": resp["status"],
                "allowed": resp["status"] not in (405, 501, 0),
            }
            if method == "OPTIONS":
                allow = resp["headers"].get("Allow", "")
                if allow:
                    entry["allow_header"] = allow
                acam = resp["headers"].get("Access-Control-Allow-Methods", "")
                if acam:
                    entry["cors_methods"] = acam
            if method == "TRACE" and resp["status"] == 200:
                entry["risk"] = "TRACE enabled — Cross-Site Tracing (XST) attack possible"
                entry["response_preview"] = resp["body"][:1000]
            exposed["method_responses"].append(entry)

        result["exposed_data"] = exposed
        return result

    def _verify_api_exposure(self, f, result):
        api_path = ""
        path_m = re.search(r'(/api/[^\s"\'<>]+)', f.evidence + " " + f.title)
        if path_m:
            api_path = path_m.group(1)
        if not api_path:
            for kw in ["openapi", "swagger", "api-docs", "graphql"]:
                if kw in f.title.lower() or kw in f.evidence.lower():
                    api_path = "/" + kw + ".json"
                    break
        if not api_path:
            path_m = re.search(r'Exposed:\s*(/[^\s]+)', f.evidence)
            if path_m:
                api_path = path_m.group(1)

        if not api_path:
            return result

        url = f"{self.base}{api_path}"
        resp = safe_request(url)

        result["verified"] = resp["status"] == 200
        exposed = {
            "endpoint": api_path,
            "url": url,
            "status": resp["status"],
            "content_type": resp["headers"].get("Content-Type", ""),
        }

        if resp["status"] == 200 and resp["body"]:
            exposed["content_preview"] = resp["body"][:5000]
            try:
                parsed = json.loads(resp["body"])
                if isinstance(parsed, dict):
                    exposed["json_keys"] = list(parsed.keys())[:50]
                    if "paths" in parsed:
                        exposed["api_endpoints_found"] = list(parsed["paths"].keys())[:100]
                    if "info" in parsed:
                        exposed["api_info"] = parsed["info"]
            except:
                pass

        result["exposed_data"] = exposed
        return result

    def _verify_clickjacking(self, f, result):
        resp = safe_request(self.target)
        result["verified"] = True
        h_lower = {k.lower(): v for k, v in resp["headers"].items()}

        exposed = {
            "x_frame_options": h_lower.get("x-frame-options", "MISSING"),
            "csp_frame_ancestors": "",
        }
        csp = h_lower.get("content-security-policy", "")
        fa = re.search(r"frame-ancestors\s+([^;]+)", csp)
        if fa:
            exposed["csp_frame_ancestors"] = fa.group(1).strip()
        else:
            exposed["csp_frame_ancestors"] = "MISSING"

        if exposed["x_frame_options"] == "MISSING" and exposed["csp_frame_ancestors"] == "MISSING":
            exposed["risk"] = "Page can be framed by any domain — clickjacking attacks possible"

        result["exposed_data"] = exposed
        return result

    def _verify_generic(self, f, result):
        resp = safe_request(self.target)
        result["verified"] = True
        result["exposed_data"] = {
            "status": resp["status"],
            "headers": resp["headers"],
            "response_preview": resp["body"][:2000],
            "note": f"Generic verification for: {f.category} / {f.title}",
        }
        return result

    def _run_extra_recon(self):
        print(f"\n  \033[33m── DEEP SERVER-SIDE RECONNAISSANCE ──\033[0m\n")

        print(f"  \033[33m[Phase 1/8]\033[0m Standard files...", flush=True)
        standard_paths = [
            "/robots.txt", "/sitemap.xml", "/humans.txt",
            "/.well-known/security.txt", "/security.txt",
            "/favicon.ico", "/crossdomain.xml", "/clientaccesspolicy.xml",
            "/.well-known/openid-configuration", "/.well-known/assetlinks.json",
            "/.well-known/apple-app-site-association", "/.well-known/change-password",
            "/.well-known/dnt-policy.txt", "/.well-known/host-meta",
            "/.well-known/host-meta.json", "/.well-known/jwks.json",
        ]
        accessible_files = []
        for path in standard_paths:
            resp = safe_request(f"{self.base}{path}")
            if resp["status"] == 200 and resp["body"]:
                print(f"    [+] {path} — {len(resp['body'])} bytes")
                accessible_files.append({
                    "path": path,
                    "status": resp["status"],
                    "content_type": resp["headers"].get("Content-Type", ""),
                    "size_bytes": len(resp["body"]),
                    "full_content": resp["body"][:10000],
                    "all_headers": resp["headers"],
                })

        print(f"  \033[33m[Phase 2/8]\033[0m Sensitive files & configs...", flush=True)
        sensitive_paths = [
            "/.env", "/.env.local", "/.env.production", "/.env.development",
            "/.env.backup", "/.env.old", "/.env.bak", "/env.js", "/env.json",
            "/.git/config", "/.git/HEAD", "/.git/logs/HEAD", "/.gitignore",
            "/.svn/entries", "/.svn/wc.db",
            "/.htaccess", "/.htpasswd", "/.user.ini", "/php.ini",
            "/web.config", "/web.config.bak", "/applicationHost.config",
            "/wp-config.php", "/wp-config.php.bak", "/wp-config.php.old",
            "/wp-config.php.save", "/wp-config.php.swp", "/wp-config.php~",
            "/config.php", "/config.php.bak", "/config.yml", "/config.yaml",
            "/config.json", "/config.js", "/config.ini", "/config.xml",
            "/configuration.php", "/settings.php", "/settings.py",
            "/database.yml", "/database.json", "/db.json", "/db.sqlite3",
            "/package.json", "/package-lock.json", "/composer.json",
            "/composer.lock", "/Gemfile", "/Gemfile.lock", "/requirements.txt",
            "/Pipfile", "/Pipfile.lock", "/yarn.lock", "/pnpm-lock.yaml",
            "/.npmrc", "/.yarnrc", "/.babelrc", "/tsconfig.json",
            "/webpack.config.js", "/vite.config.js", "/next.config.js",
            "/Makefile", "/Dockerfile", "/docker-compose.yml",
            "/.dockerignore", "/Procfile", "/Vagrantfile",
            "/server.xml", "/tomcat-users.xml", "/context.xml",
            "/phpinfo.php", "/info.php", "/test.php", "/pi.php",
            "/debug.log", "/error.log", "/access.log", "/app.log",
            "/npm-debug.log", "/yarn-error.log",
            "/dump.sql", "/backup.sql", "/database.sql", "/db.sql",
            "/backup.zip", "/backup.tar.gz", "/site.tar.gz",
            "/id_rsa", "/id_rsa.pub", "/.ssh/authorized_keys",
            "/server.key", "/server.crt", "/server.pem",
            "/admin/", "/administrator/", "/cpanel/", "/phpmyadmin/",
            "/adminer.php", "/adminer/",
            "/wp-admin/", "/wp-login.php", "/wp-json/wp/v2/users",
            "/api/", "/api/v1/", "/api/v2/", "/api/config",
            "/api/users", "/api/admin", "/api/debug", "/api/status",
            "/api/health", "/api/info", "/api/version", "/api/env",
            "/graphql", "/graphiql", "/_graphql",
            "/swagger.json", "/swagger.yaml", "/swagger-ui/",
            "/openapi.json", "/openapi.yaml", "/api-docs/", "/api-docs",
            "/v1/api-docs", "/v2/api-docs", "/v3/api-docs",
            "/actuator", "/actuator/health", "/actuator/info",
            "/actuator/env", "/actuator/beans", "/actuator/mappings",
            "/actuator/configprops", "/actuator/metrics",
            "/_debug", "/debug/", "/debug/vars", "/debug/pprof/",
            "/server-status", "/server-info", "/status",
            "/.DS_Store", "/Thumbs.db",
            "/error", "/errors", "/404", "/500",
            "/login", "/signin", "/signup", "/register",
            "/logout", "/forgot-password", "/reset-password",
            "/console", "/shell", "/terminal",
            "/cgi-bin/", "/cgi-bin/test-cgi",
            "/index.html.bak", "/index.php.bak", "/index.html~",
            "/main.js", "/app.js", "/bundle.js", "/vendor.js",
            "/manifest.json", "/browserconfig.xml", "/site.webmanifest",
        ]
        sensitive_files = []
        seen = set(p for p in standard_paths)
        for path in sensitive_paths:
            if path in seen:
                continue
            seen.add(path)
            resp = safe_request(f"{self.base}{path}", timeout=4)
            if resp["status"] == 200 and resp["body"]:
                size = len(resp["body"])
                print(f"    \033[91m[+] {path} — {size} bytes ACCESSIBLE\033[0m")
                entry = {
                    "path": path,
                    "status": resp["status"],
                    "content_type": resp["headers"].get("Content-Type", ""),
                    "size_bytes": size,
                    "all_headers": resp["headers"],
                    "full_content": resp["body"][:15000],
                }
                secrets = []
                body = resp["body"]
                secret_pats = [
                    (r'(?:password|passwd|pwd)\s*[=:]\s*["\']?([^\s"\'<>]{3,})', "Password"),
                    (r'(?:api[_-]?key|apikey)\s*[=:]\s*["\']?([^\s"\'<>]{8,})', "API Key"),
                    (r'(?:secret|secret[_-]?key)\s*[=:]\s*["\']?([^\s"\'<>]{8,})', "Secret Key"),
                    (r'(?:token|auth[_-]?token|access[_-]?token)\s*[=:]\s*["\']?([^\s"\'<>]{8,})', "Token"),
                    (r'(?:mysql|postgres|postgresql|mongodb|redis|mssql)://[^\s"\'<>]+', "Database Connection String"),
                    (r'(?:aws[_-]?access[_-]?key[_-]?id)\s*[=:]\s*["\']?([A-Z0-9]{16,})', "AWS Access Key"),
                    (r'(?:aws[_-]?secret[_-]?access[_-]?key)\s*[=:]\s*["\']?([^\s"\'<>]{30,})', "AWS Secret Key"),
                    (r'AKIA[0-9A-Z]{16}', "AWS Key ID (AKIA...)"),
                    (r'(?:private[_-]?key|priv[_-]?key)', "Private Key Reference"),
                    (r'-----BEGIN (?:RSA |DSA |EC )?PRIVATE KEY-----', "PEM Private Key"),
                    (r'-----BEGIN CERTIFICATE-----', "PEM Certificate"),
                    (r'(?:smtp|mail)[_-]?(?:password|pass|user|host)\s*[=:]\s*\S+', "Mail Config"),
                    (r'(?:stripe|paypal|braintree)[_-]?(?:secret|key|token)\s*[=:]\s*\S+', "Payment Key"),
                    (r'(?:sk_live|pk_live|sk_test|pk_test)_[a-zA-Z0-9]+', "Stripe Key"),
                    (r'(?:sendgrid|twilio|slack|discord)[_-]?(?:api|key|token|secret)\s*[=:]\s*\S+', "Service Key"),
                    (r'(?:ghp_|gho_|ghu_|ghs_|ghr_)[a-zA-Z0-9]{36,}', "GitHub Token"),
                    (r'xox[bpors]-[a-zA-Z0-9\-]+', "Slack Token"),
                ]
                for pat, name in secret_pats:
                    matches = re.findall(pat, body, re.IGNORECASE)
                    if matches:
                        for m in matches[:3]:
                            val = m if isinstance(m, str) else m[0] if m else ""
                            secrets.append({"type": name, "value_preview": val[:80]})
                if secrets:
                    entry["secrets_found"] = secrets

                sensitive_files.append(entry)

        print(f"  \033[33m[Phase 3/8]\033[0m Full homepage analysis...", flush=True)
        homepage_data = {}
        resp = safe_request(self.target)
        if resp["status"] in (200, 301, 302):
            body = resp["body"]
            homepage_data["status"] = resp["status"]
            homepage_data["all_headers"] = resp["headers"]
            homepage_data["page_size_bytes"] = len(body)
            homepage_data["page_title"] = ""
            title_m = re.search(r'<title[^>]*>(.*?)</title>', body, re.DOTALL | re.IGNORECASE)
            if title_m:
                homepage_data["page_title"] = decode_html(title_m.group(1))

            meta_tags = {}
            for m in re.finditer(r'<meta\s+([^>]+?)/?>', body, re.IGNORECASE):
                attrs = m.group(1)
                name_m = re.search(r'(?:name|property)\s*=\s*["\']([^"\']+)["\']', attrs, re.IGNORECASE)
                content_m = re.search(r'content\s*=\s*["\']([^"\']*)["\']', attrs, re.IGNORECASE)
                if name_m and content_m:
                    meta_tags[name_m.group(1)] = content_m.group(1)[:500]
            homepage_data["meta_tags"] = meta_tags

            all_links = list(set(re.findall(r'href=["\']([^"\'#]+)["\']', body, re.IGNORECASE)))
            homepage_data["all_links"] = sorted(all_links[:200])
            homepage_data["internal_links"] = [l for l in all_links if l.startswith("/") or self.hostname in l][:100]
            homepage_data["external_links"] = [l for l in all_links
                if l.startswith("http") and self.hostname not in l][:100]

            all_scripts = list(set(re.findall(r'<script[^>]*src=["\']([^"\']+)["\']', body, re.IGNORECASE)))
            homepage_data["loaded_scripts"] = all_scripts[:50]

            all_styles = list(set(re.findall(r'<link[^>]*href=["\']([^"\']+\.css[^"\']*)["\']', body, re.IGNORECASE)))
            homepage_data["loaded_stylesheets"] = all_styles[:30]

            all_images = list(set(re.findall(r'<img[^>]*src=["\']([^"\']+)["\']', body, re.IGNORECASE)))
            homepage_data["images"] = all_images[:50]

            forms = re.findall(r'<form[^>]*>(.*?)</form>', body, re.DOTALL | re.IGNORECASE)
            form_data = []
            for form_html in forms[:10]:
                form_info = {}
                action_m = re.search(r'action=["\']([^"\']*)["\']', form_html, re.IGNORECASE)
                method_m = re.search(r'method=["\']([^"\']*)["\']', form_html, re.IGNORECASE)
                form_info["action"] = action_m.group(1) if action_m else ""
                form_info["method"] = method_m.group(1) if method_m else "GET"
                inputs = []
                for inp in re.finditer(r'<input[^>]*>', form_html, re.IGNORECASE):
                    inp_attrs = inp.group(0)
                    inp_name = re.search(r'name=["\']([^"\']+)["\']', inp_attrs)
                    inp_type = re.search(r'type=["\']([^"\']+)["\']', inp_attrs)
                    inp_val = re.search(r'value=["\']([^"\']*)["\']', inp_attrs)
                    inputs.append({
                        "name": inp_name.group(1) if inp_name else "",
                        "type": inp_type.group(1) if inp_type else "text",
                        "value": inp_val.group(1)[:100] if inp_val else "",
                    })
                form_info["inputs"] = inputs
                form_data.append(form_info)
            homepage_data["forms"] = form_data

            inline_scripts = re.findall(r'<script(?:\s[^>]*)?>(?!\s*$)(.*?)</script>', body, re.DOTALL | re.IGNORECASE)
            js_vars = []
            for script in inline_scripts[:20]:
                for pat in [
                    r'(?:var|let|const)\s+(\w+)\s*=\s*["\']([^"\']{1,200})["\']',
                    r'(?:window|document)\[?\.(\w+)\]?\s*=\s*["\']([^"\']{1,200})["\']',
                    r'(\w+(?:Key|Token|Secret|Api|Config|Url|Endpoint|Host|Port))\s*[=:]\s*["\']([^"\']{1,200})["\']',
                ]:
                    for m in re.finditer(pat, script, re.IGNORECASE):
                        js_vars.append({"variable": m.group(1), "value": m.group(2)[:200]})
            homepage_data["inline_js_variables"] = js_vars[:50]

            comments = re.findall(r'<!--(.*?)-->', body, re.DOTALL)
            html_comments = [c.strip()[:300] for c in comments if c.strip() and len(c.strip()) > 3]
            homepage_data["html_comments"] = html_comments[:30]

            emails_found = list(set(re.findall(r'[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}', body)))
            homepage_data["emails_found"] = emails_found[:20]

            phone_numbers = list(set(re.findall(r'[\+]?[(]?\d{1,4}[)]?[-\s./]?\d{1,4}[-\s./]?\d{1,9}', body)))
            phone_numbers = [p for p in phone_numbers if len(p) >= 7]
            homepage_data["phone_numbers_found"] = phone_numbers[:20]

            print(f"    [+] Title: {homepage_data['page_title'][:60]}")
            print(f"    [+] {len(meta_tags)} meta tags, {len(all_links)} links, {len(all_scripts)} scripts")
            print(f"    [+] {len(form_data)} forms, {len(html_comments)} comments, {len(js_vars)} JS vars")
            if emails_found:
                print(f"    \033[91m[+] Emails exposed: {', '.join(emails_found[:5])}\033[0m")

        print(f"  \033[33m[Phase 4/8]\033[0m DNS & network info...", flush=True)
        dns_info = {}
        try:
            ips = socket.getaddrinfo(self.hostname, None)
            dns_info["resolved_ips"] = list(set(addr[4][0] for addr in ips))
            dns_info["address_families"] = list(set(str(addr[0]) for addr in ips))
            print(f"    [+] IPs: {', '.join(dns_info['resolved_ips'])}")
        except Exception as e:
            dns_info["error"] = str(e)

        for ip in dns_info.get("resolved_ips", [])[:3]:
            try:
                reverse = socket.gethostbyaddr(ip)
                dns_info.setdefault("reverse_dns", {})[ip] = {
                    "hostname": reverse[0],
                    "aliases": reverse[1],
                }
                print(f"    [+] Reverse DNS {ip}: {reverse[0]}")
            except:
                pass

        try:
            import struct
            mx_records = []
            for rtype in ["MX", "NS", "TXT", "A", "AAAA", "CNAME"]:
                try:
                    answers = socket.getaddrinfo(self.hostname, None)
                    if rtype == "A":
                        dns_info["a_records"] = [a[4][0] for a in answers if a[0] == socket.AF_INET]
                    elif rtype == "AAAA":
                        dns_info["aaaa_records"] = [a[4][0] for a in answers if a[0] == socket.AF_INET6]
                except:
                    pass
        except:
            pass

        print(f"  \033[33m[Phase 5/8]\033[0m Technology fingerprinting...", flush=True)
        tech_info = {"detected_technologies": [], "server_info": {}}
        resp = safe_request(self.target)
        if resp["headers"]:
            h = resp["headers"]
            h_lower = {k.lower(): v for k, v in h.items()}

            tech_headers = {
                "server": "Web Server",
                "x-powered-by": "Application Framework",
                "x-aspnet-version": "ASP.NET Version",
                "x-aspnetmvc-version": "ASP.NET MVC Version",
                "x-generator": "Generator",
                "x-drupal-cache": "Drupal Cache",
                "x-varnish": "Varnish Cache",
                "x-cache": "CDN/Cache Layer",
                "x-cdn": "CDN Provider",
                "via": "Proxy/CDN",
                "x-amz-cf-id": "AWS CloudFront",
                "x-amz-request-id": "AWS Request",
                "cf-ray": "Cloudflare",
                "x-vercel-id": "Vercel",
                "x-render-origin-server": "Render",
                "x-heroku-queue-depth": "Heroku",
                "x-firebase-hosting": "Firebase",
                "x-github-request-id": "GitHub Pages",
                "x-served-by": "Served By",
                "x-backend-server": "Backend Server",
                "x-runtime": "Runtime Duration",
                "x-request-id": "Request Tracking ID",
                "x-correlation-id": "Correlation ID",
                "x-trace-id": "Trace ID",
                "x-debug-token": "Debug Token",
                "x-envoy-upstream-service-time": "Envoy Proxy",
                "x-kong-upstream-latency": "Kong API Gateway",
            }
            for hdr, label in tech_headers.items():
                if hdr in h_lower:
                    tech_info["server_info"][label] = h_lower[hdr]
                    tech_info["detected_technologies"].append(f"{label}: {h_lower[hdr]}")
                    print(f"    [+] {label}: {h_lower[hdr][:60]}")

            for cookie_str in h_lower.get("set-cookie", "").split(","):
                cookie_lower = cookie_str.lower()
                for name, tech in [
                    ("phpsessid", "PHP"), ("jsessionid", "Java/Tomcat"),
                    ("asp.net_sessionid", "ASP.NET"), ("ci_session", "CodeIgniter"),
                    ("laravel_session", "Laravel"), ("_rails_", "Ruby on Rails"),
                    ("connect.sid", "Express.js/Node.js"), ("django", "Django"),
                    ("flask", "Flask"), ("wp-settings", "WordPress"),
                ]:
                    if name in cookie_lower:
                        tech_info["detected_technologies"].append(f"Session Cookie: {tech}")
                        print(f"    [+] Session: {tech}")

            body = resp["body"][:20000]
            body_techs = [
                (r'wp-content|wp-includes|wordpress', "WordPress"),
                (r'drupal\.settings|Drupal\.', "Drupal"),
                (r'joomla', "Joomla"),
                (r'magento|Mage\.', "Magento"),
                (r'shopify', "Shopify"),
                (r'wix\.com', "Wix"),
                (r'squarespace', "Squarespace"),
                (r'react|__NEXT_DATA__|_next/', "React/Next.js"),
                (r'ng-version|angular', "Angular"),
                (r'vue\.js|__vue__', "Vue.js"),
                (r'svelte', "Svelte"),
                (r'jquery', "jQuery"),
                (r'bootstrap', "Bootstrap"),
                (r'tailwindcss|tailwind', "Tailwind CSS"),
                (r'cloudflare', "Cloudflare"),
                (r'google-analytics|gtag|ga\.js', "Google Analytics"),
                (r'facebook.*pixel|fbq\(', "Facebook Pixel"),
                (r'hotjar', "Hotjar"),
                (r'sentry', "Sentry"),
                (r'recaptcha', "Google reCAPTCHA"),
                (r'stripe\.js|Stripe\(', "Stripe"),
            ]
            for pat, tech in body_techs:
                if re.search(pat, body, re.IGNORECASE):
                    if tech not in [t.split(":")[0] for t in tech_info["detected_technologies"]]:
                        tech_info["detected_technologies"].append(tech)
                        print(f"    [+] Detected: {tech}")

        print(f"  \033[33m[Phase 6/8]\033[0m Sitemap URL extraction...", flush=True)
        sitemap_data = {"urls_found": [], "total_urls": 0}
        resp = safe_request(f"{self.base}/sitemap.xml")
        if resp["status"] == 200 and resp["body"]:
            urls = re.findall(r'<loc>(.*?)</loc>', resp["body"])
            sitemap_data["total_urls"] = len(urls)
            sitemap_data["urls_found"] = urls[:200]
            lastmods = re.findall(r'<lastmod>(.*?)</lastmod>', resp["body"])
            if lastmods:
                sitemap_data["last_modified_dates"] = lastmods[:50]
            print(f"    [+] {len(urls)} URLs in sitemap")

            sitemaps = re.findall(r'<sitemap>\s*<loc>(.*?)</loc>', resp["body"])
            if sitemaps:
                sitemap_data["sub_sitemaps"] = sitemaps[:20]
                print(f"    [+] {len(sitemaps)} sub-sitemaps found")
                for sub_url in sitemaps[:5]:
                    sub_resp = safe_request(sub_url)
                    if sub_resp["status"] == 200:
                        sub_urls = re.findall(r'<loc>(.*?)</loc>', sub_resp["body"])
                        sitemap_data["total_urls"] += len(sub_urls)
                        sitemap_data["urls_found"].extend(sub_urls[:100])
                        print(f"    [+] Sub-sitemap: {len(sub_urls)} URLs")

        print(f"  \033[33m[Phase 7/8]\033[0m Robots.txt analysis...", flush=True)
        robots_data = {"disallowed": [], "allowed": [], "sitemaps": [], "crawl_delay": None}
        resp = safe_request(f"{self.base}/robots.txt")
        if resp["status"] == 200 and resp["body"]:
            for line in resp["body"].splitlines():
                line = line.strip()
                if line.lower().startswith("disallow:"):
                    path = line.split(":", 1)[1].strip()
                    if path:
                        robots_data["disallowed"].append(path)
                elif line.lower().startswith("allow:"):
                    path = line.split(":", 1)[1].strip()
                    if path:
                        robots_data["allowed"].append(path)
                elif line.lower().startswith("sitemap:"):
                    robots_data["sitemaps"].append(line.split(":", 1)[1].strip())
                elif line.lower().startswith("crawl-delay:"):
                    robots_data["crawl_delay"] = line.split(":", 1)[1].strip()
            print(f"    [+] {len(robots_data['disallowed'])} disallowed, {len(robots_data['allowed'])} allowed")

            hidden_paths_found = []
            for path in robots_data["disallowed"][:30]:
                if path == "/" or path == "/*":
                    continue
                test_path = path.rstrip("*").rstrip("$")
                if not test_path or test_path == "/":
                    continue
                check = safe_request(f"{self.base}{test_path}", timeout=5)
                if check["status"] == 200:
                    hidden_paths_found.append({
                        "path": test_path,
                        "status": check["status"],
                        "content_type": check["headers"].get("Content-Type", ""),
                        "size_bytes": len(check["body"]),
                        "content_preview": check["body"][:3000],
                    })
                    print(f"    \033[91m[+] Disallowed but ACCESSIBLE: {test_path} ({len(check['body'])} bytes)\033[0m")
            robots_data["disallowed_but_accessible"] = hidden_paths_found

        print(f"  \033[33m[Phase 8/8]\033[0m Common ports scan...", flush=True)
        port_scan = {}
        ports_to_check = [
            (21, "FTP"), (22, "SSH"), (23, "Telnet"), (25, "SMTP"),
            (53, "DNS"), (80, "HTTP"), (110, "POP3"), (143, "IMAP"),
            (443, "HTTPS"), (445, "SMB"), (587, "SMTP-TLS"),
            (993, "IMAPS"), (995, "POP3S"), (1433, "MSSQL"),
            (1521, "Oracle"), (2082, "cPanel"), (2083, "cPanel-SSL"),
            (2086, "WHM"), (2087, "WHM-SSL"), (3000, "Node/Dev"),
            (3306, "MySQL"), (3389, "RDP"), (5432, "PostgreSQL"),
            (5900, "VNC"), (5984, "CouchDB"), (6379, "Redis"),
            (8000, "Dev Server"), (8080, "HTTP-Alt"), (8443, "HTTPS-Alt"),
            (8888, "Alt HTTP"), (9090, "Admin"), (9200, "Elasticsearch"),
            (9300, "ES-Transport"), (11211, "Memcached"),
            (27017, "MongoDB"), (27018, "MongoDB-Alt"),
        ]
        for port, svc in ports_to_check:
            probe = port_probe(self.hostname, port, timeout=2)
            if probe["open"]:
                port_scan[port] = {
                    "service": svc,
                    "status": "OPEN",
                    "banner": probe["banner"][:200] if probe["banner"] else "",
                }
                print(f"    \033[91m[+] Port {port}/{svc} — OPEN{' — ' + probe['banner'][:40] if probe['banner'] else ''}\033[0m")

        self.results.append({
            "finding": {"id": "RECON-001", "category": "Server Reconnaissance",
                         "title": "Standard & Well-Known Files", "severity": "INFO"},
            "verified": True,
            "exposed_data": {"accessible_files": accessible_files},
        })
        self.results.append({
            "finding": {"id": "RECON-002", "category": "Server Reconnaissance",
                         "title": "Sensitive Files & Configuration Exposure", "severity": "HIGH"},
            "verified": bool(sensitive_files),
            "exposed_data": {
                "total_accessible": len(sensitive_files),
                "files": sensitive_files,
            },
        })
        self.results.append({
            "finding": {"id": "RECON-003", "category": "Server Reconnaissance",
                         "title": "Full Homepage Analysis", "severity": "INFO"},
            "verified": True,
            "exposed_data": homepage_data,
        })
        self.results.append({
            "finding": {"id": "RECON-004", "category": "Server Reconnaissance",
                         "title": "DNS & Network Information", "severity": "INFO"},
            "verified": True,
            "exposed_data": dns_info,
        })
        self.results.append({
            "finding": {"id": "RECON-005", "category": "Server Reconnaissance",
                         "title": "Technology Fingerprint", "severity": "INFO"},
            "verified": True,
            "exposed_data": tech_info,
        })
        self.results.append({
            "finding": {"id": "RECON-006", "category": "Server Reconnaissance",
                         "title": "Sitemap & URL Inventory", "severity": "INFO"},
            "verified": True,
            "exposed_data": sitemap_data,
        })
        self.results.append({
            "finding": {"id": "RECON-007", "category": "Server Reconnaissance",
                         "title": "Robots.txt Analysis & Hidden Paths", "severity": "MEDIUM"},
            "verified": True,
            "exposed_data": robots_data,
        })
        self.results.append({
            "finding": {"id": "RECON-008", "category": "Server Reconnaissance",
                         "title": "Full Port Scan Results", "severity": "HIGH" if port_scan else "INFO"},
            "verified": bool(port_scan),
            "exposed_data": {
                "open_ports": port_scan,
                "total_open": len(port_scan),
                "total_scanned": len(ports_to_check),
            },
        })
        if sensitive_files:
            self.stats["exposed"] += 1
        if port_scan:
            self.stats["exposed"] += 1


class ExposureReportGenerator:

    def __init__(self, target, results, stats):
        self.target = target
        self.results = results
        self.stats = stats

    def generate_json(self, output_path):
        data = {
            "tool": f"Alpha Vulnerability Verifier™ v{VERSION}",
            "copyright": "(C) 2026 Alpha Unlimited Technologies LLC",
            "target": self.target,
            "generated": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "duration": f"{self.stats['end'] - self.stats['start']:.1f}s",
            "summary": {
                "total_findings": self.stats["total"],
                "verified_exposed": self.stats["verified"],
                "with_data": self.stats["exposed"],
            },
            "results": self.results,
        }
        with open(output_path, "w", encoding="utf-8") as fh:
            json.dump(data, fh, indent=2, ensure_ascii=False, default=str)
        return output_path

    def generate_text(self, output_path):
        lines = []
        lines.append("=" * 72)
        lines.append("  ALPHA VULNERABILITY VERIFIER™ — FULL EXPOSURE REPORT")
        lines.append("  (C) 2026 Alpha Unlimited Technologies LLC")
        lines.append("=" * 72)
        lines.append(f"\n  TARGET:     {self.target}")
        lines.append(f"  DATE:       {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"  DURATION:   {self.stats['end'] - self.stats['start']:.1f}s")
        lines.append(f"  FINDINGS:   {self.stats['total']} checked")
        lines.append(f"  EXPOSED:    {self.stats['verified']} verified")
        lines.append(f"  WITH DATA:  {self.stats['exposed']} with exposed information\n")

        for r in self.results:
            f = r.get("finding", {})
            fid = f.get("id", "?")
            title = f.get("title", "Unknown")
            severity = f.get("severity", "?")
            verified = r.get("verified", False)

            lines.append("─" * 72)
            status = "\033[91mEXPOSED\033[0m" if verified else "\033[32mSAFE\033[0m"
            lines.append(f"  [{fid}] {title}")
            lines.append(f"  Severity: {severity} | Verified: {'YES — EXPOSED' if verified else 'NO — Not confirmed'}")

            exposed = r.get("exposed_data")
            if exposed:
                lines.append(f"  ┌─ EXPOSED DATA ─────────────────────────────────")
                lines.append(self._format_exposed(exposed, indent=4))
                lines.append(f"  └─────────────────────────────────────────────────")
            lines.append("")

        lines.append("=" * 72)
        lines.append(f"  END OF REPORT — {self.stats['verified']} exposures verified")
        lines.append("=" * 72)

        text = "\n".join(lines)
        with open(output_path, "w", encoding="utf-8") as fh:
            fh.write(re.sub(r'\033\[\d+m', '', text))

        print(text)
        return output_path

    def _format_exposed(self, data, indent=4):
        pad = " " * indent
        lines = []
        if isinstance(data, dict):
            for key, val in data.items():
                if isinstance(val, dict):
                    lines.append(f"{pad}{key}:")
                    lines.append(self._format_exposed(val, indent + 4))
                elif isinstance(val, list):
                    lines.append(f"{pad}{key}:")
                    for item in val[:30]:
                        if isinstance(item, dict):
                            lines.append(self._format_exposed(item, indent + 4))
                            lines.append(f"{pad}    ---")
                        else:
                            lines.append(f"{pad}    - {str(item)[:200]}")
                else:
                    val_str = str(val)
                    if len(val_str) > 200:
                        val_str = val_str[:200] + "..."
                    lines.append(f"{pad}{key}: {val_str}")
        return "\n".join(lines)

    def generate_html(self, output_path):
        findings_html = []
        for r in self.results:
            f = r.get("finding", {})
            verified = r.get("verified", False)
            false_pos = r.get("false_positive", False)
            fp_reason = r.get("false_positive_reason", "")
            exposed = r.get("exposed_data", {})
            sev = f.get("severity", "INFO")
            sev_colors = {"CRITICAL": "#ff2222", "HIGH": "#ff8800", "MEDIUM": "#ffcc00",
                          "LOW": "#4488ff", "INFO": "#888888"}
            color = sev_colors.get(sev, "#888")
            border_color = "#9333ea" if false_pos else color

            if false_pos:
                status_badge = (f'<span style="background:#9333ea33;color:#c084fc;padding:2px 8px;'
                               f'border-radius:8px;font-size:11px;font-weight:bold;">FALSE POSITIVE</span>')
            elif verified:
                status_badge = (f'<span style="background:#ff222233;color:#ff2222;padding:2px 8px;'
                               f'border-radius:8px;font-size:11px;font-weight:bold;">EXPOSED</span>')
            else:
                status_badge = (f'<span style="background:#4ade8033;color:#4ade80;padding:2px 8px;'
                               f'border-radius:8px;font-size:11px;">SAFE</span>')

            fp_banner = ""
            if false_pos:
                fp_banner = (f'<div style="background:#9333ea22;border:1px solid #9333ea55;'
                            f'color:#e9d5ff;padding:8px 10px;border-radius:4px;font-size:11px;'
                            f'margin:6px 0;"><strong>Why this is a false positive:</strong> '
                            f'{html.escape(fp_reason)}</div>')

            exposed_html = ""
            if exposed:
                exposed_json = json.dumps(exposed, indent=2, ensure_ascii=False, default=str)
                exposed_html = f'<pre style="background:#050505;padding:10px;border-radius:4px;font-size:11px;color:#ccc;max-height:400px;overflow:auto;white-space:pre-wrap;word-break:break-all;">{html.escape(exposed_json)}</pre>'

            findings_html.append(f"""
<div style="background:#111;border-left:4px solid {border_color};padding:14px 16px;margin:8px 0;border-radius:4px;{'opacity:0.85;' if false_pos else ''}">
<div style="display:flex;justify-content:space-between;align-items:flex-start;">
<div><span style="color:#555;font-family:monospace;font-size:11px;">[{html.escape(f.get('id',''))}]</span>
<span style="font-weight:bold;color:{color};font-size:14px;{'text-decoration:line-through;opacity:0.6;' if false_pos else ''}">{html.escape(f.get('title',''))}</span></div>
<div>{status_badge} <span style="background:{color}22;color:{color};padding:2px 8px;border-radius:8px;font-size:11px;margin-left:4px;">{sev}</span></div>
</div>
<div style="color:#888;font-size:12px;margin:6px 0;">{html.escape(f.get('description','') or f.get('category',''))}</div>
{fp_banner}
{f'<details><summary style="color:#d4a017;font-size:12px;cursor:pointer;">View Exposed Data</summary>{exposed_html}</details>' if exposed_html else ''}
</div>""")

        elapsed = self.stats["end"] - self.stats["start"]
        page = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Alpha Exposure Report — {html.escape(self.target)}</title>
<style>
*{{box-sizing:border-box;}}
body{{background:#0a0a0a;color:#e0e0e0;font-family:'Segoe UI',system-ui,Arial,sans-serif;padding:0;margin:0;line-height:1.6;}}
.wrap{{max-width:1400px;margin:0 auto;padding:20px;}}
pre{{background:#050505;padding:10px;border-radius:4px;font-size:11px;overflow-x:auto;white-space:pre-wrap;word-break:break-all;color:#888;margin:6px 0;max-height:400px;overflow-y:auto;}}
details>summary{{cursor:pointer;padding:4px 0;}}
details>summary:hover{{color:#d4a017;}}
</style>
</head>
<body>
<div class="wrap">
<div style="text-align:center;border-bottom:2px solid #d4a017;padding-bottom:18px;margin-bottom:24px;">
<div style="font-size:10px;color:#d4a017;letter-spacing:5px;margin-bottom:6px;">ALPHA UNLIMITED TECHNOLOGIES LLC — PROPRIETARY AND CONFIDENTIAL</div>
<h1 style="margin:0;font-size:26px;">Alpha Vulnerability Exposure Report</h1>
<div style="color:#888;font-size:14px;margin:6px 0;">Target: <span style="color:#4ade80;font-family:monospace;">{html.escape(self.target)}</span></div>
<div style="color:#555;font-size:12px;">Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} | Duration: {elapsed:.1f}s | Findings: {self.stats['total']} | Exposed: {self.stats['verified']} | False Positives: {self.stats['false_positives']}</div>
{f'<div style="color:#c084fc;font-size:11px;margin-top:6px;">CDN/Proxy Detected: <strong>{html.escape(self.cdn_info["name"] or "")}</strong> — port and SSRF probes cross-checked</div>' if self.cdn_info["detected"] else ''}
</div>
<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:8px;margin:16px 0;">
<div style="background:#111;padding:14px 10px;border-radius:8px;text-align:center;border:1px solid #222;">
<div style="font-size:26px;font-weight:bold;color:#88ccff;">{self.stats['total']}</div><div style="color:#888;font-size:11px;">Findings Checked</div></div>
<div style="background:#111;padding:14px 10px;border-radius:8px;text-align:center;border:1px solid #ff2222;">
<div style="font-size:26px;font-weight:bold;color:#ff2222;">{self.stats['verified']}</div><div style="color:#888;font-size:11px;">Verified Exposed</div></div>
<div style="background:#111;padding:14px 10px;border-radius:8px;text-align:center;border:1px solid #ff8800;">
<div style="font-size:26px;font-weight:bold;color:#ff8800;">{self.stats['exposed']}</div><div style="color:#888;font-size:11px;">With Exposed Data</div></div>
<div style="background:#111;padding:14px 10px;border-radius:8px;text-align:center;border:1px solid #9333ea;">
<div style="font-size:26px;font-weight:bold;color:#c084fc;">{self.stats['false_positives']}</div><div style="color:#888;font-size:11px;">False Positives Filtered</div></div>
</div>
{''.join(findings_html)}
<div style="text-align:center;border-top:1px solid #222;padding:20px 0;margin-top:40px;">
<div style="color:#d4a017;font-size:12px;">Alpha Vulnerability Verifier™ v{VERSION}</div>
<div style="color:#555;font-size:11px;">(C) 2026 Alpha Unlimited Technologies LLC — All Rights Reserved</div>
</div>
</div></body></html>"""

        with open(output_path, "w", encoding="utf-8") as fh:
            fh.write(page)
        return output_path


def run_verification(html_path, target_override=None, output_dir="."):
    html_path = os.path.expanduser(html_path)
    output_dir = os.path.expanduser(output_dir)

    if not os.path.isfile(html_path):
        print(f"  \033[31mERROR:\033[0m File not found: {html_path}")
        return

    target, findings = parse_report(html_path)
    if target_override:
        target = target_override

    if not target:
        print("  \033[31mERROR:\033[0m Could not determine target from report.")
        return

    print(f"\n  Loaded {len(findings)} findings from report")

    verifier = VulnVerifier(target, findings)
    results = verifier.run()

    os.makedirs(output_dir, exist_ok=True)
    safe = re.sub(r'[^\w\-.]', '_', target.replace("https://", "").replace("http://", "").rstrip("/"))
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")

    reporter = ExposureReportGenerator(target, results, verifier.stats)

    json_path = os.path.join(output_dir, f"exposure_{safe}_{ts}.json")
    reporter.generate_json(json_path)
    print(f"\n  \033[32m[JSON]\033[0m {json_path}")

    txt_path = os.path.join(output_dir, f"exposure_{safe}_{ts}.txt")
    reporter.generate_text(txt_path)
    print(f"  \033[32m[TXT]\033[0m  {txt_path}")

    html_path_out = os.path.join(output_dir, f"exposure_{safe}_{ts}.html")
    reporter.generate_html(html_path_out)
    print(f"  \033[32m[HTML]\033[0m {html_path_out}")

    elapsed = verifier.stats["end"] - verifier.stats["start"]
    print(f"""
  \033[33m┌──────────────────────────────────────────────────┐
  │  VERIFICATION COMPLETE                             │
  ├──────────────────────────────────────────────────┤\033[0m
  │  Findings checked:  {verifier.stats['total']:>4}                           │
  │  \033[91mVerified exposed:   {verifier.stats['verified']:>4}\033[0m                           │
  │  \033[91mWith exposed data:  {verifier.stats['exposed']:>4}\033[0m                           │
  │  Duration:          {elapsed:>5.1f}s                         │
  \033[33m└──────────────────────────────────────────────────┘\033[0m
""")


def run_interactive():
    print(BANNER)
    print(WARNING)

    confirm = input("  Do you have authorization to test this target? [y/N]: ").strip().lower()
    if confirm != "y":
        print("  Aborted. Only test systems you own or have written authorization for.")
        return

    html_path = input("\n  Path to scan report HTML: ").strip()
    if not html_path or not os.path.isfile(os.path.expanduser(html_path)):
        print(f"  \033[31mERROR:\033[0m File not found: {html_path}")
        return

    override = input("  Override target URL (leave blank to use from report): ").strip()
    out_dir = input("  Output directory [current]: ").strip() or "."

    run_verification(html_path, target_override=override or None, output_dir=out_dir)


def main():
    parser = argparse.ArgumentParser(
        description="Alpha Vulnerability Verifier™ — Verify and expose all accessible data from scan findings",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python3 alpha_vuln_verifier.py report.html
  python3 alpha_vuln_verifier.py report.html -o ~/Desktop
  python3 alpha_vuln_verifier.py report.html --target https://mysite.com
  python3 alpha_vuln_verifier.py  (interactive mode)
        """)
    parser.add_argument("report", nargs="?", help="Path to Alpha Scan HTML report")
    parser.add_argument("-o", "--output", default=".", help="Output directory")
    parser.add_argument("--target", help="Override target URL from report")

    args = parser.parse_args()
    if not args.report:
        run_interactive()
        return

    print(BANNER)
    print(WARNING)
    run_verification(args.report, target_override=args.target, output_dir=args.output)


if __name__ == "__main__":
    main()
