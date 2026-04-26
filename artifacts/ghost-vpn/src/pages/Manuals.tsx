// Copyright © 2025 ALPHA UNLIMITED TECHNOLOGIES LLC — legal@alphauntechnologies.com
// ProxhqVPN Manuals Download Center — subscription-gated comprehensive guides
import React, { useState } from "react";
import { PageSEO } from "@/components/PageSEO";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen, Download, Shield, Wifi, Terminal, Database,
  Search, Zap, Globe, Lock, Eye, Radio, Award,
  Gamepad2, FileText, Network, Cpu, Server, Settings,
  CheckCircle2, ChevronDown, ChevronUp, BookMarked,
} from "lucide-react";

// ── Manual Definitions ────────────────────────────────────────────────────────
type Manual = {
  id: string;
  title: string;
  subtitle: string;
  version: string;
  pages: number;
  icon: React.ElementType;
  iconColor: string;
  tier: "basic" | "pro" | "both";
  content: string;
};

const MANUALS: Manual[] = [
  // ── VPN BASICS ────────────────────────────────────────────────────────────
  {
    id: "vpn-getting-started",
    title: "ProxhqVPN: Getting Started",
    subtitle: "Installation, first connection, and account setup",
    version: "3.2",
    pages: 24,
    icon: Wifi,
    iconColor: "text-green-400",
    tier: "both",
    content: `ProxhqVPN Getting Started Guide
Version 3.2 — Copyright © 2025 ALPHA UNLIMITED TECHNOLOGIES LLC
legal@alphauntechnologies.com | proxhqvpn.com

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TABLE OF CONTENTS

1. Account Setup & Subscription
2. Platform Installation
3. First VPN Connection
4. WireGuard Configuration
5. Kill Switch Setup
6. DNS Protection
7. Device Management
8. Troubleshooting Common Issues

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. ACCOUNT SETUP & SUBSCRIPTION

  Visit proxhqvpn.com and click "Sign Up."
  Choose your subscription:
    • VPN Basic — $6.99/month or $59.99/year
      Full WireGuard VPN, Kill Switch, DNS Shield, Onion Browser,
      Split Tunneling, SmartDNS, 15+ server locations.
    • Command Center Pro — $39.99/month or $349.99/year
      Everything in VPN Basic + full security toolkit:
      OmniStrike, WAF Analyzer, Social Breach Tester, Bug Bounty Hub,
      OSINT Recon, Ghost Chain, SIEM, Canary Tokens, and more.

  Sign in with Google SSO or email/password via Clerk.

2. PLATFORM INSTALLATION

  Web Dashboard (no install required):
    Navigate to proxhqvpn.com after signing in.

  WireGuard Desktop Client:
    1. Go to My VPN → Download App in the sidebar.
    2. Download for Windows, macOS, or Linux.
    3. Import the .conf file from WireGuard Config page.

  Mobile (iOS/Android):
    Install the official WireGuard app from App Store / Google Play.
    Scan the QR code from your WireGuard Config page.

3. FIRST VPN CONNECTION

  1. Navigate to My VPN in the sidebar.
  2. Select a server region from the dropdown.
  3. Click "Connect."
  4. Verify: the IP shown changes to the VPN server's IP.
  5. Run a leak test (Leak Test in sidebar) to confirm no leaks.

4. WIREGUARD CONFIGURATION

  Your WireGuard config is generated automatically. To view it:
  1. Go to WireGuard Config in the sidebar.
  2. Copy the config text or scan the QR code.
  3. Import into the WireGuard client on your device.

  Protocol: WireGuard (UDP 51820)
  Encryption: AES-256-GCM + ChaCha20-Poly1305
  Key exchange: Curve25519

5. KILL SWITCH SETUP

  The Kill Switch blocks ALL traffic if the VPN drops.
  1. Go to Kill Switch in the sidebar.
  2. Enable "Kill Switch."
  3. Your IP is auto-detected and whitelisted so you keep remote access.
  4. Test: disconnect VPN — all traffic should stop.

6. DNS PROTECTION

  Two layers of DNS protection:
  a) DNS Shield — Encrypts DNS queries and uses custom resolvers.
     Enable at: DNS Protection → DNS Shield.
  b) DNS Sinkhole — Blocks 100k+ ad/tracker/malware domains.
     Enable at: DNS Sinkhole (Command Center Pro only).

7. DEVICE MANAGEMENT

  Add up to 5 devices per subscription.
  1. Go to My Devices in the sidebar.
  2. Click "Add Device."
  3. Name the device and generate its WireGuard config.
  4. Import the config on each device.

8. TROUBLESHOOTING

  Can't connect:
  → Check that port UDP 51820 is not blocked by your firewall.
  → Try a different server region.
  → Re-generate WireGuard keys from WireGuard Config page.

  DNS leaks detected:
  → Enable DNS Shield.
  → Set your DNS server to 10.8.0.1 (VPN gateway).

  Slow speeds:
  → Switch to a geographically closer server.
  → Try ChaCha20-Poly1305 cipher if on mobile.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Copyright © 2025 ALPHA UNLIMITED TECHNOLOGIES LLC
All rights reserved. Unauthorized distribution prohibited.`,
  },
  {
    id: "wireguard-advanced",
    title: "WireGuard Advanced Configuration",
    subtitle: "Multi-hop, split tunneling, obfuscation, and router setup",
    version: "2.1",
    pages: 32,
    icon: Settings,
    iconColor: "text-blue-400",
    tier: "both",
    content: `WireGuard Advanced Configuration Manual
Version 2.1 — Copyright © 2025 ALPHA UNLIMITED TECHNOLOGIES LLC

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TABLE OF CONTENTS

1. Split Tunneling
2. VPN Gate (Double-Hop)
3. Obfuscation / Stealth Protocol
4. Router Setup (OpenWRT / pfSense)
5. SmartDNS Configuration
6. VPN Coexistence (running two VPNs)
7. Onion Browser (Tor over VPN)
8. IP Exposure Scanner

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. SPLIT TUNNELING

  Route only specific apps or IP ranges through the VPN.

  To configure:
  1. Go to Split Tunneling in the sidebar.
  2. "Exclude mode" — all traffic through VPN EXCEPT listed apps/IPs.
  3. "Include mode" — only listed apps/IPs go through VPN.

  Common use cases:
  • Route all traffic EXCEPT your local printer IP.
  • Route only gaming traffic to reduce lag.
  • Bypass VPN for banking apps that block VPNs.

2. VPN GATE (DOUBLE-HOP)

  Route your traffic through an additional VPN Gate server for
  a second anonymity hop:

  You → ProxhqVPN → VPN Gate Server → Internet

  1. Go to VPN Gate in the sidebar.
  2. Filter by country, speed, or protocol.
  3. Click "Connect via Gate" on any server.
  4. Your traffic is now double-encrypted.

3. OBFUSCATION / STEALTH PROTOCOL

  Hide VPN traffic from deep packet inspection (DPI):
  1. Go to Stealth Protocol in the sidebar.
  2. Enable "XOR Obfuscation" or "HTTPS Tunnel."
  3. Use when on restricted networks (corporate, hotel WiFi, countries
     that block VPN protocols).

4. ROUTER SETUP

  Set up ProxhqVPN on your router to protect your entire network.

  OpenWRT:
  1. Install WireGuard: opkg install wireguard-tools kmod-wireguard
  2. Download your .conf from WireGuard Config page.
  3. Copy to /etc/wireguard/wg0.conf
  4. wg-quick up wg0

  pfSense:
  1. System → Package Manager → Install WireGuard.
  2. VPN → WireGuard → Import your .conf.
  3. Enable and add interface to your LAN rules.

5. SMARTDNS CONFIGURATION

  SmartDNS resolves geo-blocked content without routing all traffic
  through the VPN (faster than full VPN for streaming):

  1. Go to Smart DNS in the sidebar.
  2. Copy the DNS IP shown.
  3. Set your device/router DNS to this IP.
  4. Flush DNS cache: ipconfig /flushdns (Windows) or
     dscacheutil -flushcache (macOS).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Copyright © 2025 ALPHA UNLIMITED TECHNOLOGIES LLC`,
  },
  // ── SECURITY TOOLS ───────────────────────────────────────────────────────
  {
    id: "omnistrike-manual",
    title: "OmniStrike Penetration Testing Suite",
    subtitle: "Full guide to all 13 attack modules, phases, and post-exploitation",
    version: "4.0",
    pages: 48,
    icon: Zap,
    iconColor: "text-red-400",
    tier: "pro",
    content: `OmniStrike Penetration Testing Suite — User Manual
Version 4.0 — Copyright © 2025 ALPHA UNLIMITED TECHNOLOGIES LLC
Command Center Pro Feature

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

IMPORTANT: Only use OmniStrike against targets you own or have
explicit written permission to test. Unauthorized use may violate
the Computer Fraud and Abuse Act (CFAA) and equivalent laws.
ALPHA UNLIMITED TECHNOLOGIES LLC assumes no liability.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TABLE OF CONTENTS

1. Overview & Architecture
2. Attack Modules (13 categories)
3. Orchestration Modes (Salvo / Chain / Custom)
4. Phase Chain Execution (6 phases)
5. QuantumBreach & ShadowVector Advanced Modules
6. Post-Exploitation (ExploitDesktop)
7. Stealth & Tamper Settings
8. Interpreting Results & CVSS Scoring
9. Exporting Reports
10. OmniStrike + Bug Bounty Integration

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. OVERVIEW & ARCHITECTURE

  OmniStrike is a full-stack automated penetration testing platform
  embedded directly in ProxhqVPN Command Center Pro. It routes all
  traffic through your VPN tunnel for maximum anonymity.

  Backend: Express API at /api/omnistrike
  Rate limit: 5 scans per minute per IP
  All scans run server-side (not in your browser)

2. ATTACK MODULES

  SQL Injection (sqli)
    Techniques: Boolean-blind, UNION-based, time-based, error-based,
    stacked queries. Tests all URL parameters, POST body fields,
    and JSON API parameters.
    Detection: Response length diff, time delay (>3s), error strings.

  XSS (xss)
    Reflected and DOM-based cross-site scripting.
    Payload encoding: HTML entity, URL encode, Unicode, double encode.
    Tests: URL params, form fields, JSON fields, headers.

  LFI / Path Traversal (lfi)
    File inclusion and directory traversal.
    Paths tested: /etc/passwd, /etc/shadow, /proc/self/environ,
    .env files, wp-config.php, and 15+ other sensitive paths.
    PHP wrappers: php://filter, php://input, data://

  Command Injection (cmdi)
    OS command chaining: ; | && || backtick newline
    Payloads for Linux and Windows targets.
    Detection: Response contains command output (uid, hostname, etc.)

  SSRF (ssrf)
    Server-side request forgery probing internal IPs, localhost,
    cloud metadata (169.254.169.254), and custom internal URLs.

  XXE (xxe)
    XML external entity injection via file:// and HTTP entities.
    Tests XML API endpoints and file upload endpoints.

  SSTI (ssti)
    Server-side template injection for Jinja2, Twig, Freemarker,
    Python/Ruby engines. Detection: mathematical expression evaluation.

  Header Injection (headers)
    Host header, X-Forwarded-For, X-Original-URL, X-Rewrite-URL.
    Used to bypass access controls and auth restrictions.

  CORS Misconfiguration (cors)
    Tests for permissive Access-Control-Allow-Origin across
    multiple crafted origins. Detects credentials=true + wildcard.

  Auth Brute Force (auth)
    Default credentials against /login, /admin, /wp-login, /api/auth.
    Uses a curated list of 100+ default credential pairs.

  NoSQL Injection (nosql)
    MongoDB operator injection: $ne, $gt, $regex, $where.
    Tests JSON API endpoints.

  QuantumBreach (quantumbreach)
    Cache poisoning, GraphQL introspection + injection, CRLF injection,
    Mass assignment, JWT algorithm confusion (alg:none, RS256→HS256),
    Timing side-channel attacks, Open redirect chains, Quantum-weak
    cryptographic implementation detection.

  ShadowVector (shadowvector)
    Novel/unreported vectors:
    • Ghost Param Injection — hidden parameters in REST paths
    • Path Desync — HTTP/1 vs HTTP/2 desync attacks
    • Prototype Pollution — __proto__ contamination in APIs
    • Schema Oracle — type confusion via partial responses
    • Temporal Race Attack — TOCTOU race conditions in auth

3. ORCHESTRATION MODES

  Salvo Mode: Run all selected modules simultaneously against the
  target. Best for quick coverage. Uses one scan ID.

  Chain Mode (Recommended): Run modules in 6 sequential phases.
  Phase 1 findings inform Phase 2 parameters. Most thorough.

  Custom Mode: Select and order modules manually. Useful for
  targeted testing of a specific vulnerability class.

4. PHASE CHAIN EXECUTION

  Phase 1 — Recon (cors, headers):
    Fingerprint CORS policy and auth-bypass headers. Low-noise.

  Phase 2 — Auth & Access (auth, lfi, xxe):
    Default credentials, file inclusion, XML entity injection.

  Phase 3 — Injection (sqli, nosql, ssrf):
    Database injection and server-side request forgery.

  Phase 4 — Code Execution (cmdi, ssti):
    OS command injection and template engine exploitation.

  Phase 5 — Client-Side (xss):
    Cross-site scripting for session hijacking.

  Phase 6 — Advanced Sweep (quantumbreach, shadowvector):
    Novel unreported vectors and advanced attack patterns.

5. POST-EXPLOITATION (EXPLOITDESKTOP)

  When OmniStrike confirms a Remote Code Execution vulnerability,
  ExploitDesktop activates. It provides:

  File Browser:
  • Browse the target server's filesystem
  • View file contents (configs, .env, SSH keys, etc.)
  • List directory permissions

  Terminal:
  • Execute OS commands on the compromised server
  • Pre-loaded with 20+ recon commands (id, env, netstat, etc.)
  • Automatic sensitive data extraction

  Auto-Recon:
  • Automatically runs 20 post-exploitation commands
  • Extracts: credentials, SSH keys, env vars, SUID binaries,
    running processes, cron jobs, network interfaces

6. STEALTH & TAMPER SETTINGS

  Tamper Level (1-5):
    1 = Raw payloads (fastest, most detectable)
    5 = Maximum encoding/obfuscation (slowest, most evasive)

  Stealth Mode:
    Adds random delays between requests (500ms-3s).
    Randomizes User-Agent on each request.
    Reduces concurrent requests.

  Full Auto:
    After a vulnerability is confirmed, automatically enters
    post-exploitation and runs the full recon suite.

7. INTERPRETING RESULTS

  Severity Ratings:
  CRITICAL — Confirmed RCE, SQLi with data extraction, Account takeover
  HIGH — Confirmed injection, SSRF internal access, IDOR
  MEDIUM — CORS with credentials, XSS reflected, Info disclosure
  LOW — Missing headers, error messages, non-exploitable issues

  CVSS Scoring: All findings are scored using CVSSv3.1 base metrics.

8. EXPORTING REPORTS

  Click "Export Report" (JSON or Markdown) in the scan results panel.
  The report includes:
  • Executive summary
  • All findings with CVSS scores
  • Working payloads and URLs
  • Evidence (response excerpts)
  • Remediation recommendations

9. OMNISTRIKE + BUG BOUNTY INTEGRATION

  Use OmniStrike with Bug Bounty Hub:
  1. Select a program in Bug Bounty Hub.
  2. Click "Open OmniStrike."
  3. Enter an in-scope target domain.
  4. Select appropriate modules (check program out-of-scope first!).
  5. Export findings and use the Report Generator.

  ALWAYS ensure your target is in-scope before scanning.
  Register with the bug bounty program before any testing.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Copyright © 2025 ALPHA UNLIMITED TECHNOLOGIES LLC`,
  },
  {
    id: "waf-analyzer-manual",
    title: "WAF Analyzer",
    subtitle: "Web Application Firewall detection, fingerprinting, and bypass testing",
    version: "1.4",
    pages: 18,
    icon: Shield,
    iconColor: "text-blue-400",
    tier: "pro",
    content: `WAF Analyzer Manual
Version 1.4 — Copyright © 2025 ALPHA UNLIMITED TECHNOLOGIES LLC
Command Center Pro Feature

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TABLE OF CONTENTS

1. What is WAF Analyzer?
2. WAF Detection Engine
3. Bypass Testing Suite
4. Supported WAF Vendors
5. Interpreting Results
6. Integration with OmniStrike

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. WHAT IS WAF ANALYZER?

  WAF Analyzer detects, fingerprints, and tests bypasses for Web
  Application Firewalls protecting a target URL. It helps security
  researchers understand what protections are in place and identify
  potential bypass techniques.

2. WAF DETECTION ENGINE

  The analyzer sends a series of probe requests:
  • Benign baseline request (establishes fingerprint)
  • Common attack payloads (SQL, XSS, path traversal)
  • Header manipulation probes

  Detection signals:
  • HTTP 403/406/429 on attack payloads (baseline returns 200)
  • WAF-specific headers: X-Sucuri-ID, CF-RAY, X-CDN, etc.
  • Response body markers: Cloudflare, ModSecurity, Akamai blocks
  • Response timing anomalies

3. BYPASS TESTING SUITE

  After WAF detection, the bypass suite tests:

  Encoding Bypasses:
  • Double URL encoding (%25 instead of %)
  • Unicode normalization (ＳＱＬ instead of SQL)
  • HTML entity encoding
  • Base64 + decode() wrappers

  Case Manipulation:
  • Mixed case: SeLeCt, UnIoN
  • Keyword splitting: UN/**/ION, SE/**/LECT

  HTTP-level Bypasses:
  • Chunked transfer encoding
  • HTTP parameter pollution (same param twice)
  • Content-Type confusion (JSON in form-encoded)
  • Large payload fragmentation

4. SUPPORTED WAF VENDORS

  Detection signatures for 25+ WAFs including:
  Cloudflare, AWS WAF, Akamai, Imperva Incapsula, Sucuri,
  ModSecurity, F5 BIG-IP ASM, Barracuda, Fortinet FortiWeb,
  Radware AppWall, Wallarm, Fastly, Nginx + ModSec, CloudFront.

5. INTERPRETING RESULTS

  WAF Detected + Bypasses Found:
  → Report these bypasses to the target's bug bounty program.
  → CVSS for WAF bypass varies: typically Medium (4.0-6.9).

  WAF Detected, No Bypasses:
  → WAF is properly configured. Document the protection.

  No WAF Detected:
  → Target may be unprotected. Prioritize injection testing.

6. INTEGRATION WITH OMNISTRIKE

  When a WAF is detected, OmniStrike automatically increases
  tamper level to 5 and uses the detected bypass techniques
  as payload wrappers for all subsequent module runs.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Copyright © 2025 ALPHA UNLIMITED TECHNOLOGIES LLC`,
  },
  {
    id: "social-breach-manual",
    title: "Social & Game Account Breach Tester",
    subtitle: "Authorized account security audit for 80+ platforms",
    version: "1.2",
    pages: 28,
    icon: Gamepad2,
    iconColor: "text-purple-400",
    tier: "pro",
    content: `Social & Game Account Breach Tester — User Manual
Version 1.2 — Copyright © 2025 ALPHA UNLIMITED TECHNOLOGIES LLC
Command Center Pro Feature

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

LEGAL NOTICE: This tool is for authorized security testing only.
Only test accounts you own or have explicit written permission to
audit. Unauthorized credential testing is illegal under the CFAA,
GDPR, and equivalent laws worldwide.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TABLE OF CONTENTS

1. Overview
2. Platform Categories (80+ platforms)
3. Auto vs Manual Login Strategies
4. Session Management
5. Proxy Browser Usage
6. Security Testing Use Cases
7. Session Cleanup

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. OVERVIEW

  The Social & Game Account Breach Tester helps you:
  • Verify your own account security on 80+ platforms
  • Test whether compromised credentials actually work
  • Audit login flows for security research and bug bounties
  • Maintain authenticated sessions through a built-in proxy browser

  All login attempts and proxy traffic are routed through your
  ProxhqVPN tunnel.

2. PLATFORM CATEGORIES

  Social Media Tab (35+ platforms):
  Facebook, Instagram, Twitter/X, TikTok, Snapchat, Threads,
  LinkedIn, Pinterest, Reddit, Discord, Telegram, Signal, Slack,
  WhatsApp, YouTube, Twitch, Kick, Rumble, GitHub, GitLab, and more.

  Gaming Launchers Tab (10+ platforms):
  Steam (RSA-encrypted login), Epic Games, GOG Galaxy, Blizzard
  Battle.net, Ubisoft Connect, Origin/EA, Activision, Rockstar,
  HoYoverse (Genshin/HSR), Warframe, Path of Exile, Nexon.

  Game Titles Tab (15+ games):
  Roblox, Minecraft, Fortnite (via Epic), Valorant (via Riot),
  League of Legends (via Riot), Call of Duty, Apex Legends (via EA),
  GTA Online (via Rockstar), Overwatch 2 (via Blizzard), and more.

  Legacy Systems Tab (10+ platforms):
  Xbox Live (manual flow), PlayStation Network, Nintendo,
  2K Games, Konami ID, Sega/Atlus, NCSoft (Blade & Soul), and more.

3. AUTO vs MANUAL LOGIN STRATEGIES

  Auto (automated):
  • Platform: Discord, Instagram, Steam, Epic, GOG, Reddit, GitHub,
    Twitch, Roblox
  • How: The backend sends the correct API calls and decrypts
    challenge responses (e.g., Steam RSA encryption) automatically.
  • Result: Full session cookies returned if credentials are valid.

  Manual:
  • Platform: Facebook, Twitter, TikTok, Xbox, PlayStation, etc.
  • How: The proxy browser loads the platform's actual login page.
    You enter credentials in the real login form, which is
    intercepted and proxied through the backend session.
  • Use for platforms with heavy bot detection or OAuth flows.

4. SESSION MANAGEMENT

  After login, sessions are maintained in the backend session store
  (4-hour TTL). Sessions survive page navigation in the app.

  To view active sessions: Scroll to "Active Sessions" in the tool.
  To close a session: Click the × next to any session entry.

  Sessions persist for 4 hours from last activity. After that,
  re-authenticate if needed.

5. PROXY BROWSER USAGE

  The proxy browser embeds the platform page with:
  • All cookies automatically injected
  • All links rewritten through the proxy
  • Navigation history (back/forward)
  • The "BREACH ACTIVE" indicator showing the audit is in progress

  Navigation bar:
  • Type a URL manually to navigate to a specific page
  • Back/Forward buttons follow full session history
  • Refresh reloads the current page with updated session cookies

6. SECURITY TESTING USE CASES

  a) Credential Verification (for your own accounts):
     Test whether leaked credentials from a data breach work on
     any of your registered accounts.

  b) Login Flow Audit (for developers):
     Test your own application's login security by pointing the
     tool at your staging environment.

  c) Session Security Testing:
     After login, test whether the platform properly invalidates
     sessions on password change, logout, etc.

  d) Bug Bounty Authentication Testing:
     Use with your own test accounts on programs that allow
     authentication testing in their scope.

7. SESSION CLEANUP

  Sessions automatically expire after 4 hours. To manually clean up:
  1. Click the × next to each active session.
  2. Or wait for the 4-hour automatic cleanup.

  Note: The backend session store is in-memory only. Sessions are
  cleared when the API server restarts.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Copyright © 2025 ALPHA UNLIMITED TECHNOLOGIES LLC`,
  },
  {
    id: "bug-bounty-hub-manual",
    title: "Bug Bounty Research Hub",
    subtitle: "Complete guide to authorized security research across 19 major programs",
    version: "1.0",
    pages: 22,
    icon: Award,
    iconColor: "text-yellow-400",
    tier: "pro",
    content: `Bug Bounty Research Hub — User Manual
Version 1.0 — Copyright © 2025 ALPHA UNLIMITED TECHNOLOGIES LLC
Command Center Pro Feature

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TABLE OF CONTENTS

1. Overview of Bug Bounty Programs
2. Supported Programs (19 programs)
3. Program Scope & Out-of-Scope Rules
4. Testing Methodology per Platform
5. OmniStrike Integration
6. Report Generator
7. Best Practices for Researchers

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. OVERVIEW

  The Bug Bounty Research Hub is a comprehensive reference and
  tooling center for authorized security research across major
  gaming, social, and developer platforms.

  CRITICAL RULE: You MUST register with the bug bounty platform
  (HackerOne, Bugcrowd, etc.) and read the full program policy
  BEFORE any testing. Testing without registration may result in
  legal action even if you find valid vulnerabilities.

2. SUPPORTED PROGRAMS (19 programs)

  Console / Gaming:
  • PlayStation / Sony — HackerOne — Up to $50,000
  • Xbox / Microsoft — MSRC — Up to $60,000
  • Epic Games — HackerOne — Up to $20,000
  • Steam / Valve — HackerOne — Up to $30,000 (invite)
  • Riot Games — HackerOne — Up to $25,000
  • Blizzard / Activision — HackerOne — Up to $20,000
  • Bungie (Destiny 2) — HackerOne — Up to $15,000
  • EA / Electronic Arts — Bugcrowd — Up to $15,000
  • Ubisoft Connect — Intigriti — Up to $20,000
  • Roblox — HackerOne — Up to $10,000
  • Nintendo — Email program — Case-by-case

  Social & Streaming:
  • Meta (Facebook/Instagram/WhatsApp) — Meta Whitehat — Up to $750,000
  • Google / YouTube — Google VRP — Up to $500,000
  • Discord — HackerOne — Up to $10,000
  • Reddit — HackerOne — Up to $10,000
  • GitHub — HackerOne — Up to $30,000
  • Twitch — HackerOne — Up to $15,000
  • Twitter / X — HackerOne — Up to $20,000
  • Spotify — HackerOne — Up to $10,000

3. PROGRAM SCOPE

  Each program in the Hub shows:
  • In-Scope: what assets and features you can test
  • Out-of-Scope: what you MUST NOT test

  Common out-of-scope items across all programs:
  • Social engineering or phishing
  • Denial of service attacks
  • Physical attacks on infrastructure
  • Issues requiring jailbroken/modified devices
  • Previously reported vulnerabilities

4. TESTING METHODOLOGY

  Each program includes a step-by-step testing guide:
  a) Set up test accounts specific to the platform
  b) Configure Burp Suite or OWASP ZAP to proxy the platform
  c) Map API endpoints using the app and documentation
  d) Test each endpoint for access control (IDOR) with two test accounts
  e) Check OAuth/token flows for open redirect, CSRF, leakage
  f) Document every finding with full request/response

5. OMNISTRIKE INTEGRATION

  From any program page, click "Launch in OmniStrike."
  OmniStrike will open pre-configured for that platform's domain.

  IMPORTANT: Only use OmniStrike on endpoints you're authorized to
  test and that are explicitly in-scope for the program. Always
  test on your own test accounts — never on other users' accounts.

6. REPORT GENERATOR

  The built-in Report Generator creates professional disclosure
  reports in HackerOne format:

  1. Select severity (Critical/High/Medium/Low)
  2. Enter the vulnerability type (e.g., "IDOR on user profile API")
  3. Enter the affected endpoint URL
  4. Describe the vulnerability and its impact
  5. Provide step-by-step reproduction steps
  6. Click "Copy Report" to copy to clipboard
  7. Paste directly into your HackerOne/Bugcrowd report

7. BEST PRACTICES

  DO:
  ✓ Register with the program before ANY testing
  ✓ Use your own test accounts exclusively
  ✓ Test in staging environments when available
  ✓ Report immediately if you accidentally access real user data
  ✓ Follow responsible disclosure timelines

  DON'T:
  ✗ Test out-of-scope assets (even if vulnerable)
  ✗ Use automated scanners without checking program rules
  ✗ Access, download, or store any real user data
  ✗ Disclose publicly before the program's disclosure deadline
  ✗ Submit duplicate reports

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Copyright © 2025 ALPHA UNLIMITED TECHNOLOGIES LLC`,
  },
  {
    id: "osint-recon-manual",
    title: "OSINT Recon Engine",
    subtitle: "15+ passive intelligence sources and recon methodology",
    version: "2.3",
    pages: 20,
    icon: Search,
    iconColor: "text-cyan-400",
    tier: "pro",
    content: `OSINT Recon Engine — User Manual
Version 2.3 — Copyright © 2025 ALPHA UNLIMITED TECHNOLOGIES LLC
Command Center Pro Feature

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TABLE OF CONTENTS

1. Overview
2. Intelligence Sources (15+)
3. Running a Recon
4. Interpreting Results
5. Integration with Bug Bounty Hub

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. OVERVIEW

  The OSINT Recon Engine queries 15+ passive intelligence sources
  in parallel to build a comprehensive profile of a target domain.
  All queries are routed through your ProxhqVPN tunnel.

  Use OSINT for: reconnaissance before authorized penetration testing,
  bug bounty target research, and infrastructure mapping.

2. INTELLIGENCE SOURCES

  Threat & IP Intelligence:
  • Shodan — Internet-wide banner scanning data
  • Censys — Certificate transparency + banner data
  • AbuseIPDB — IP abuse reports and scores
  • GreyNoise — Background scan classification
  • AlienVault OTX — Open threat exchange indicators
  • VirusTotal — URL/IP/domain reputation

  Domain & Certificate Intelligence:
  • Certificate Transparency Logs — Subdomains via CT log search
  • SecurityTrails — Historical DNS, subdomains, IPs
  • DNSDumpster — DNS record enumeration
  • Whois / RDAP — Registrant, nameservers, creation date

  Data Breach Intelligence:
  • HaveIBeenPwned — Email address breach history
  • IntelX — Deep/dark web mention search

  Web & Code Intelligence:
  • Wayback Machine — Historical snapshots of web pages
  • Google Dorking — Targeted search operator queries
  • GitHub Code Search — Leaked secrets in public repositories

3. RUNNING A RECON

  1. Navigate to OSINT Recon in the sidebar.
  2. Enter a target: domain, IP address, or email address.
  3. Select which intelligence sources to query.
  4. Click "Start Recon."
  5. Results appear as each source responds (parallel queries).

4. INTERPRETING RESULTS

  High-value findings for bug bounty:
  • Open ports/services on unexpected hosts (Shodan/Censys)
  • Subdomains not listed in the main scope (CT logs)
  • Leaked API keys in public GitHub repositories
  • Old web application versions with known CVEs (Wayback)
  • Email addresses exposed in breaches (HIBP)

5. INTEGRATION WITH BUG BOUNTY HUB

  Use OSINT Recon as the first step of bug bounty research:
  1. Enter the program's main domain.
  2. Map all subdomains and services.
  3. Cross-reference with program scope.
  4. Prioritize in-scope assets for further testing with OmniStrike.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Copyright © 2025 ALPHA UNLIMITED TECHNOLOGIES LLC`,
  },
  {
    id: "canary-tokens-manual",
    title: "Canary Token Generator",
    subtitle: "Invisible tripwires: HTTP, DNS, document, and AWS fake key tokens",
    version: "1.8",
    pages: 16,
    icon: Radio,
    iconColor: "text-amber-400",
    tier: "pro",
    content: `Canary Token Generator — User Manual
Version 1.8 — Copyright © 2025 ALPHA UNLIMITED TECHNOLOGIES LLC
Command Center Pro Feature

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TABLE OF CONTENTS

1. What are Canary Tokens?
2. Token Types
3. Creating a Token
4. Deploying Tokens
5. Alert Configuration
6. Forensic Data Collected
7. Use Cases

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. WHAT ARE CANARY TOKENS?

  Canary Tokens are invisible tripwires that alert you the instant
  someone accesses a resource — a URL, DNS name, document, or
  fake AWS credential. They are used to detect:
  • Unauthorized access to internal systems
  • Data exfiltration (when hidden in documents)
  • Network intruders probing fake services
  • Insider threats accessing sensitive fake files

2. TOKEN TYPES

  HTTP Token:
  • A unique URL that triggers an alert when visited
  • Deploy in HTML pages, emails, wikis, or chat messages
  • Captures: IP, user agent, referrer, timestamp, geolocation

  DNS Token:
  • A unique hostname that triggers on DNS lookup
  • Works even through firewalls that block HTTP
  • Captures: DNS resolver IP, timestamp

  Document Token (Word/PDF):
  • Embed in a Word or PDF document
  • Triggers when the document is opened (pings home)
  • Captures: opener IP, timezone, software version

  AWS Fake Key Token:
  • Fake AWS access key/secret that alerts on use
  • Plant in code repositories, config files, or backups
  • Captures: AWS region, caller IP, service called

3. CREATING A TOKEN

  1. Go to Canary Tokens in the sidebar.
  2. Select token type.
  3. Enter a memo (what this token monitors).
  4. Enter your alert email.
  5. Click "Generate Token."
  6. Copy the token URL/hostname/credentials.

4. DEPLOYING TOKENS

  HTTP Token — deployment examples:
  • <img src="https://proxhqvpn.com/t/[TOKEN_ID]" width="1" height="1">
  • Hidden in HTML pages, email newsletters, wiki pages
  • In Slack/Discord messages in sensitive channels

  DNS Token:
  • Add as a hostname in a config file: db.host=[TOKEN_DNS]
  • Use as a "fake" internal hostname in documentation

  Document Token:
  • Name the file something enticing: "Q4_Payroll_2025.docx"
  • Place in shared drives, backups, or sent to test recipients

  AWS Fake Key:
  • Commit to a test repository
  • Add to a .env file in a shared codebase
  • Leave in a "forgotten" backup folder

5. ALERT CONFIGURATION

  Alerts are sent via email and displayed in the Beacon Alerts
  dashboard (Admin only).

6. FORENSIC DATA COLLECTED

  Each alert includes:
  • Source IP address
  • Geolocation (city, country, ISP)
  • HTTP headers (User-Agent, Accept-Language, etc.)
  • Timestamp (UTC)
  • Token memo (what it was monitoring)

7. USE CASES

  Security Team Monitoring:
  • Place tokens in sensitive folders — any access triggers alert.

  Penetration Test Detection:
  • Include tokens in scope — alerts confirm the test is active.

  Data Exfiltration Detection:
  • Embed in sensitive documents — if exfiltrated and opened, alerts.

  Honeypot Integration:
  • Deploy tokens alongside SilkWeb decoy services for
    comprehensive attacker tracking.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Copyright © 2025 ALPHA UNLIMITED TECHNOLOGIES LLC`,
  },
  {
    id: "siem-manual",
    title: "SIEM — Security Event Log",
    subtitle: "Unified event aggregation, correlation, and incident response",
    version: "2.0",
    pages: 14,
    icon: Database,
    iconColor: "text-emerald-400",
    tier: "pro",
    content: `SIEM Security Event Log — User Manual
Version 2.0 — Copyright © 2025 ALPHA UNLIMITED TECHNOLOGIES LLC
Command Center Pro Feature

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TABLE OF CONTENTS

1. Overview
2. Event Sources
3. Filtering & Searching
4. Severity Levels
5. Alert Correlation
6. Export & Reporting

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. OVERVIEW

  The SIEM (Security Information and Event Management) dashboard
  aggregates security events from all ProxhqVPN systems into a
  single, searchable, real-time event log.

2. EVENT SOURCES

  WireGuard Events:
  • Peer connections and disconnections
  • New device handshakes
  • Key rotation events

  SilkWeb Honeypot Events:
  • Decoy service probe attempts
  • Scanner fingerprints
  • Credential stuffing attempts

  Firewall Events:
  • Blocked connection attempts
  • Port scan detections
  • GeoIP-based blocks

  DNS Sinkhole Events:
  • Malware domain resolution attempts
  • Tracker block counts
  • C2 beacon detections

  Authentication Events:
  • Failed login attempts
  • Successful authentications
  • Session anomalies

  Canary Token Events:
  • Token trigger alerts
  • Forensic data from each alert

3. FILTERING & SEARCHING

  Filter by:
  • Event source (WireGuard / Honeypot / Firewall / DNS / Auth / Canary)
  • Severity (Critical / High / Medium / Low / Info)
  • Time range (Last hour / 24h / 7d / 30d / Custom)
  • IP address or hostname
  • Free text search

4. SEVERITY LEVELS

  Critical: Active breach, RCE attempt, data exfiltration detected
  High: Successful credential attack, honeypot compromise
  Medium: Repeated scan attempts, brute force (stopped by rate limit)
  Low: Port scans, DNS block, probe attempts
  Info: Normal authentication events, connection logs

5. ALERT CORRELATION

  The SIEM automatically correlates related events:
  • IP seen in multiple event sources within 60 minutes → Linked
  • Same IP in firewall block + honeypot hit → Coordinated attack flag
  • Auth failure spike → Brute force alert

6. EXPORT & REPORTING

  Export events as:
  • JSON (machine-readable for SIEM integrations)
  • CSV (for spreadsheet analysis)
  • PDF (for incident reports)

  Automated daily and weekly reports can be configured in Settings.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Copyright © 2025 ALPHA UNLIMITED TECHNOLOGIES LLC`,
  },
  {
    id: "employee-procedures",
    title: "Employee Procedures & Platform Administration",
    subtitle: "Admin tools, employee access, audit logs, and platform operations",
    version: "1.5",
    pages: 20,
    icon: Terminal,
    iconColor: "text-green-400",
    tier: "both",
    content: `Employee Procedures & Platform Administration
Version 1.5 — Copyright © 2025 ALPHA UNLIMITED TECHNOLOGIES LLC
INTERNAL USE ONLY — DO NOT DISTRIBUTE

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TABLE OF CONTENTS

1. Employee Access System
2. Admin Dashboard Overview
3. Terminal — Remote Server Shell
4. SQL Interface — Direct Database Access
5. Node Management — VPN Server Fleet
6. SilkWeb Honeypot Administration
7. Firewall Rule Management
8. System Monitor
9. Audit Trail & Compliance
10. Incident Response Procedures

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. EMPLOYEE ACCESS SYSTEM

  Employee accounts receive full Command Center Pro access.
  Admin accounts receive additional access to:
  • Terminal (rate-limited: 20 commands/minute)
  • Direct SQL interface (30 queries/minute)
  • Node management (add/remove VPN servers)
  • SilkWeb honeypot control
  • Firewall rule management

  Granting Employee Access:
  1. Admin → Employee Access in the sidebar.
  2. Enter the employee's registered email address.
  3. Click "Add Employee."
  4. Employee receives access on next sign-in.

  Revoking Access:
  1. Find the employee in the Employee Access list.
  2. Click "Remove" next to their entry.
  3. Access is revoked immediately.

2. ADMIN DASHBOARD OVERVIEW

  The Dashboard shows:
  • Active subscriptions (VPN Basic + Command Center Pro counts)
  • Monthly recurring revenue
  • Active VPN connections
  • Recent security events
  • Platform health metrics

3. TERMINAL — REMOTE SERVER SHELL

  The Terminal provides shell access to VPN nodes.
  IMPORTANT: All commands are logged with timestamps and the
  admin's user ID. The audit log is immutable.

  Rate limit: 20 commands per minute.
  Prohibited: rm -rf /, shutdown, reboot (require confirmation).

  Common admin commands:
  wg show              — Show WireGuard interface status
  systemctl status     — Check service status
  journalctl -n 100    — View system logs
  df -h                — Check disk usage
  free -h              — Check memory usage

4. SQL INTERFACE — DIRECT DATABASE ACCESS

  Provides direct PostgreSQL query access.
  Rate limit: 30 queries per minute.
  All queries are logged.

  NEVER run:
  DROP TABLE, TRUNCATE, DELETE without WHERE clause
  UPDATE without WHERE clause
  Any query modifying the subscriptions or payments tables directly

5. NODE MANAGEMENT

  Add a VPN Server Node:
  1. Admin → VPN Servers.
  2. Click "Add Node."
  3. Enter the server's public IP and region.
  4. Copy the setup script and run it on the server:
     curl -sSL [setup_script_url] | bash
  5. The node registers automatically.

  Remove a Node:
  1. Click the node in the VPN Servers list.
  2. Click "Remove Node."
  3. All active connections on this node are migrated automatically.

6. SILKWEB HONEYPOT ADMINISTRATION

  SilkWeb deploys decoy services to lure and fingerprint attackers.

  Decoy services available:
  • Fake SSH server (logs all connection attempts + credentials)
  • Fake web admin panel (/admin, /phpmyadmin, /wp-admin)
  • Fake database port (3306/5432 with fake responses)
  • Fake FTP server

  Alerts: All honeypot hits appear in SIEM and Beacon Alerts.

10. INCIDENT RESPONSE PROCEDURES

  Suspected breach detected:
  1. Check SIEM for the triggering event and IP.
  2. Block the attacker IP in Firewall.
  3. Review all events from that IP in the last 24 hours.
  4. If VPN node is compromised: Remove node, revoke all keys.
  5. Document incident in the admin notes field.
  6. Notify legal@alphauntechnologies.com within 24 hours.

  Data breach:
  1. Immediately revoke all compromised keys/tokens.
  2. Notify affected users within 72 hours (GDPR requirement).
  3. Contact legal@alphauntechnologies.com immediately.
  4. Do not discuss breach details on public channels.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INTERNAL DOCUMENT — DO NOT DISTRIBUTE
Copyright © 2025 ALPHA UNLIMITED TECHNOLOGIES LLC`,
  },
];

// ── Category grouping ─────────────────────────────────────────────────────────
const CATEGORIES = [
  {
    label: "VPN & Privacy",
    color: "text-green-400",
    border: "border-green-900",
    bg: "bg-green-950/20",
    ids: ["vpn-getting-started", "wireguard-advanced"],
  },
  {
    label: "Command Center Pro — Security Tools",
    color: "text-red-400",
    border: "border-red-900",
    bg: "bg-red-950/20",
    ids: ["omnistrike-manual", "waf-analyzer-manual", "social-breach-manual", "bug-bounty-hub-manual"],
  },
  {
    label: "Intelligence & Monitoring",
    color: "text-cyan-400",
    border: "border-cyan-900",
    bg: "bg-cyan-950/20",
    ids: ["osint-recon-manual", "canary-tokens-manual", "siem-manual"],
  },
  {
    label: "Employee & Administration",
    color: "text-amber-400",
    border: "border-amber-900",
    bg: "bg-amber-950/20",
    ids: ["employee-procedures"],
  },
];

function downloadManual(manual: Manual) {
  const blob = new Blob([manual.content], { type: "text/plain; charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `proxhqvpn-${manual.id}-v${manual.version}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadAll() {
  MANUALS.forEach((m, i) => {
    setTimeout(() => downloadManual(m), i * 300);
  });
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function Manuals() {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [downloaded, setDownloaded] = useState<Set<string>>(new Set());

  const handleDownload = (manual: Manual) => {
    downloadManual(manual);
    setDownloaded(prev => new Set([...prev, manual.id]));
  };

  const toggle = (id: string) => setExpandedId(prev => prev === id ? null : id);

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-gray-100 p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      <PageSEO
        title="ProxhqVPN Manuals — ALPHA UNLIMITED TECHNOLOGIES LLC"
        description="Download comprehensive user manuals for every ProxhqVPN feature."
      />

      {/* Header */}
      <div>
        <div className="flex flex-wrap items-center gap-3 mb-2">
          <BookMarked className="h-7 w-7 text-green-400" />
          <h1 className="text-2xl font-black text-white">ProxhqVPN Manuals</h1>
          <Badge className="bg-green-900 text-green-300 border-green-700">{MANUALS.length} Manuals</Badge>
          <Badge className="bg-blue-900 text-blue-300 border-blue-700">Subscriber Access</Badge>
        </div>
        <p className="text-gray-400 text-sm max-w-2xl">
          Complete documentation for every feature of the ProxhqVPN platform. Available exclusively to active subscribers. All manuals are downloadable as plain text for offline reference.
        </p>

        {/* Download all */}
        <div className="mt-4 flex flex-wrap gap-3">
          <button onClick={downloadAll}
            className="flex items-center gap-2 text-sm font-bold bg-green-900 hover:bg-green-800 border border-green-700 text-green-300 px-4 py-2 rounded-lg transition-colors">
            <Download className="h-4 w-4" /> Download All Manuals
          </button>
          <div className="flex items-center gap-2 bg-amber-950/30 border border-amber-900/50 rounded-lg px-4 py-2 text-xs text-amber-400">
            <FileText className="h-3.5 w-3.5 shrink-0" />
            <span>Copyright © 2025 ALPHA UNLIMITED TECHNOLOGIES LLC — For authorized subscribers only</span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Manuals", value: MANUALS.length, icon: BookOpen, color: "text-green-400" },
          { label: "Total Pages", value: MANUALS.reduce((s, m) => s + m.pages, 0), icon: FileText, color: "text-blue-400" },
          { label: "VPN Manuals", value: MANUALS.filter(m => m.tier === "both").length, icon: Wifi, color: "text-cyan-400" },
          { label: "Pro Manuals", value: MANUALS.filter(m => m.tier === "pro").length, icon: Shield, color: "text-red-400" },
        ].map(s => (
          <div key={s.label} className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center gap-3">
            <s.icon className={`h-5 w-5 ${s.color} shrink-0`} />
            <div>
              <div className="text-xl font-black text-white">{s.value}</div>
              <div className="text-xs text-gray-500">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Manuals by category */}
      {CATEGORIES.map(cat => {
        const catManuals = cat.ids.map(id => MANUALS.find(m => m.id === id)!).filter(Boolean);
        return (
          <div key={cat.label} className={`border ${cat.border} ${cat.bg} rounded-xl overflow-hidden`}>
            <div className="px-5 py-3 border-b border-gray-800/50">
              <h2 className={`text-sm font-black uppercase tracking-wider ${cat.color}`}>{cat.label}</h2>
            </div>
            <div className="divide-y divide-gray-800/50">
              {catManuals.map(manual => {
                const isExpanded = expandedId === manual.id;
                const isDownloaded = downloaded.has(manual.id);
                return (
                  <div key={manual.id} className="p-4">
                    <div className="flex items-start gap-4">
                      <div className="shrink-0 mt-1">
                        <manual.icon className={`h-5 w-5 ${manual.iconColor}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <h3 className="text-sm font-bold text-white">{manual.title}</h3>
                          <Badge className="text-[9px] bg-gray-800 text-gray-400 border-gray-700">v{manual.version}</Badge>
                          <Badge className={`text-[9px] ${manual.tier === "pro" ? "bg-red-900 text-red-300 border-red-800" : "bg-blue-900 text-blue-300 border-blue-800"}`}>
                            {manual.tier === "pro" ? "Command Center Pro" : "All Plans"}
                          </Badge>
                          <span className="text-[10px] text-gray-600">{manual.pages} pages</span>
                        </div>
                        <p className="text-xs text-gray-400">{manual.subtitle}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button onClick={() => toggle(manual.id)}
                          className="text-xs text-gray-500 hover:text-white transition-colors flex items-center gap-1">
                          {isExpanded ? <><ChevronUp className="h-3.5 w-3.5" />Preview</> : <><ChevronDown className="h-3.5 w-3.5" />Preview</>}
                        </button>
                        <button onClick={() => handleDownload(manual)}
                          className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors ${isDownloaded ? "bg-green-950 text-green-400 border-green-800" : "bg-gray-800 hover:bg-gray-700 text-white border-gray-700"}`}>
                          {isDownloaded ? <><CheckCircle2 className="h-3.5 w-3.5" />Downloaded</> : <><Download className="h-3.5 w-3.5" />Download</>}
                        </button>
                      </div>
                    </div>

                    {/* Preview pane */}
                    {isExpanded && (
                      <div className="mt-3 bg-black rounded-lg border border-gray-800 overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800">
                          <span className="text-[10px] font-mono text-gray-500 uppercase tracking-wider">Manual Preview — {manual.title}</span>
                          <button onClick={() => handleDownload(manual)}
                            className="flex items-center gap-1 text-[10px] text-green-400 hover:text-green-300 transition-colors">
                            <Download className="h-3 w-3" /> Download Full Manual
                          </button>
                        </div>
                        <pre className="font-mono text-[10px] text-gray-300 p-4 overflow-x-auto max-h-72 overflow-y-auto leading-relaxed whitespace-pre-wrap">
                          {manual.content.slice(0, 2000)}{manual.content.length > 2000 ? "\n\n[...continued in full manual download...]" : ""}
                        </pre>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Legal footer */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-xs text-gray-500">
        <p className="font-bold text-gray-400 mb-1">ProxhqVPN Manuals — Distribution Notice</p>
        <p>These manuals are proprietary documentation of ALPHA UNLIMITED TECHNOLOGIES LLC. They are provided exclusively to active ProxhqVPN subscribers for personal reference. Redistribution, reproduction, or sharing outside of your organization is strictly prohibited.</p>
        <p className="mt-2">For support: <span className="text-green-400">legal@alphauntechnologies.com</span> | proxhqvpn.com</p>
      </div>
    </div>
  );
}
