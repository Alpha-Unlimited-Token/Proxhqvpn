// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC — legal@alphauntechnologies.com
// ProxhqVPN Manuals Download Center — subscription-gated comprehensive guides
import React, { useState } from "react";
import { PageSEO } from "@/components/PageSEO";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen, Download, Shield, Wifi, Terminal, Database,
  Search, Zap, Globe, Lock, Eye, Radio, Award,
  Gamepad2, FileText, Network, Cpu, Server, Settings,
  CheckCircle2, ChevronDown, ChevronUp, BookMarked,
  MapPin, Code,
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
Version 3.2 — Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC
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
Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC
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
Version 2.1 — Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC

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
Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC`,
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
Version 4.0 — Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC
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
Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC`,
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
Version 1.4 — Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC
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
Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC`,
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
Version 1.2 — Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC
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
Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC`,
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
Version 1.0 — Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC
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
Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC`,
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
Version 2.3 — Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC
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
Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC`,
  },
  {
    id: "ghost-trap-manual",
    title: "Ghost Trap — Counter-Intelligence Platform",
    subtitle: "7-stage attacker deception, fingerprinting, tarpit, and Manual IP Investigator",
    version: "2.1",
    pages: 22,
    icon: Eye,
    iconColor: "text-cyan-400",
    tier: "pro",
    content: `Ghost Trap Counter-Intelligence Platform — User Manual
Version 2.1 — Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC
Command Center Pro Feature

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

IMPORTANT: Ghost Trap is a passive defensive and deception platform.
All tarpit and canary features operate on incoming attacker connections.
The Manual IP Investigator performs port scanning and OSINT on external
IPs — only investigate IPs you have lawful reason to query.
ALPHA UNLIMITED TECHNOLOGIES LLC assumes no liability for misuse.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TABLE OF CONTENTS

1. Overview & Architecture
2. 7-Stage Counter-Intel Pipeline
3. Lure Endpoints & Trap Configuration
4. Tarpit Settings
5. Fingerprinting Engine
6. Poisoned Response Templates
7. Embedded Beacons & Canary Integration
8. Hop Chain Visualization
9. Manual IP Investigator (NEW v2.1)
10. Auto-Block & Abuse Reporting
11. Counter-Intel Tab Reference

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. OVERVIEW & ARCHITECTURE

  Ghost Trap is an active counter-intelligence system that turns
  attacker reconnaissance into wasted time and attribution data.
  When a scanner, bot, or human attacker probes your infrastructure,
  Ghost Trap identifies them, slows them down, poisons their tools,
  and automatically reports them — all without exposing any real data.

  Backend: Express API at /api/ghost-trap
  Frontend: /ghost-trap (Command Center Pro)
  Rate limit: 60 requests/min per IP

  Tabs:
  • Active Traps — live attacker sessions
  • Fingerprinting — OS/tool/JA3 analysis
  • Counter-Intel — manual investigation tools
  • Settings — tarpit level, lure config, beacon templates

2. 7-STAGE COUNTER-INTEL PIPELINE

  [1] Attacker Probes a Lure Endpoint
      Ghost Trap deploys decoy services on attacker-targeted paths:
      /admin, /wp-login, /.env, /phpinfo, SSH port 22, /config.php
      These are realistic-looking but entirely fake.

  [2] Tarpit — Wasting the Attacker's Time
      The connection is held open artificially, sending 1 byte/sec.
      A single attacker connection can be tied up for hours.
      Configure level in Settings: Low (30s), Medium (5m), High (2h).

  [3] Deep Fingerprinting
      TCP/IP stack fingerprinting, TLS ClientHello analysis, HTTP
      header ordering, and JA3 hash identify:
      • Attacker OS (Linux, Windows, macOS)
      • Tool in use (Nmap, Shodan crawler, Metasploit, Burp Suite)
      • Browser or scanner version

  [4] Poisoned Response
      Fake credentials, fake API keys, fake DB dumps, and fake server
      configs are returned — chosen to look authentic but be entirely
      non-functional. Format-valid but never real.

  [5] Embedded Beacon
      All poisoned data includes invisible canary tokens. When the
      attacker uses the fake credentials or opens the fake file, a
      beacon fires revealing their real IP, browser, and location.

  [6] Silk Web Trap
      Attackers who probe further are fed into the SilkWeb maze —
      an endless labyrinth of fake services, each logging every
      command and request.

  [7] Auto-Block + Authority Report
      Attacker IP is instantly blocklisted across all VPN nodes.
      Generates an AbuseIPDB submission and ISP abuse complaint
      template for repeat or aggressive attackers.

3. LURE ENDPOINTS & TRAP CONFIGURATION

  Default lure paths (always active):
    GET /admin             → Fake admin login (HTML form)
    GET /wp-login.php      → Fake WordPress login
    GET /.env              → Fake environment file with API keys
    GET /phpinfo.php       → Fake PHP info page
    GET /config.php        → Fake DB credentials config
    SSH port 22            → Tarpit daemon (holds SSH connections)

  Custom Lure Configuration (Settings → Lure Editor):
  • Add any path: /api/internal, /backup.zip, /database.sql
  • Set response type: JSON creds / HTML login / plaintext / binary
  • Set tarpit duration override per lure
  • Enable/disable per-lure beacon embedding

4. TARPIT SETTINGS

  Configure tarpit aggressiveness in Ghost Trap → Settings:

  Low  (30 seconds): Light touch — minimal resource use. Good for
    testing or when server resources are limited.

  Medium (5 minutes): Recommended for production. Wastes meaningful
    attacker time without consuming excessive connections.

  High (up to 2 hours): Maximum disruption. Each attacker connection
    held for up to 2 hours. Use only with adequate server resources
    and when under active attack. Monitor connection count in the
    System Monitor to avoid resource exhaustion.

5. FINGERPRINTING ENGINE

  The Fingerprinting tab shows real-time analysis of each attacker:

  OS Detection:
    Analyzes TCP window size, TTL values, and IP ID patterns.
    Accuracy: ~85% OS family, ~60% OS version.

  Tool Detection:
    • Nmap: Characteristic probe timing, OS detection probes
    • Shodan: Known Shodan crawler User-Agent strings and IP ranges
    • Metasploit: Specific payload patterns in requests
    • Burp Suite: Sequential request numbering, specific headers
    • curl/wget: Identifiable User-Agent strings (often unmodified)

  JA3 Hash:
    TLS ClientHello fingerprint. Cross-reference against known
    malicious tool JA3 databases for attribution.

  HTTP Header Ordering:
    Each browser and tool sends headers in a characteristic order.
    Ghost Trap records the exact order for fingerprint correlation.

6. POISONED RESPONSE TEMPLATES

  Templates (Settings → Fake Data Templates):

  Database Credentials:
    { "host": "db.internal", "user": "root",
      "password": "<32-char random>", "database": "users" }
    Note: These are never real. Always synthetic random values.

  AWS Credentials:
    [aws_access_key_id] = AKIA + 16 random uppercase chars
    [aws_secret_access_key] = 40 random base64 chars
    Includes fake CloudTrail-style alert instruction comments.

  SSH Private Key:
    Properly formatted 2048-bit RSA PEM key (procedurally generated,
    mathematically valid but for a non-existent server).

  API Key:
    Bearer token: sk_live_ + 24 random chars
    Mimics Stripe, Twilio, or SendGrid format depending on the lure.

  IMPORTANT: Audit templates in Settings periodically to confirm
  no real credential has been accidentally substituted.

7. EMBEDDED BEACONS & CANARY INTEGRATION

  All poisoned responses automatically embed a Ghost Trap canary URL.
  When the attacker uses the fake data, the canary fires and logs:
  • Real source IP (even through proxies, if JS executes)
  • Browser fingerprint
  • Timestamp of canary trigger
  • Referer (where the attacker opened the file from)

  The trigger appears in:
  • Ghost Trap → Active Traps → session detail → Canary Fired (orange badge)
  • Canary Tokens (/canary) → trigger log

8. HOP CHAIN VISUALIZATION

  The Hop Chain panel maps each attacker session across your
  infrastructure:

  How to read a hop chain:
  • Each node = one request/response exchange
  • Arrows show the attacker's navigation path
  • Node color:
      Green  = tarpit holding (ongoing)
      Orange = canary fired at this hop
      Red    = blocked (firewall auto-block triggered)
      Gray   = session ended (attacker gave up or timed out)

  Click any node to see:
  • Full request headers and body
  • Full poisoned response sent
  • Tarpit duration at this hop
  • Fingerprint data collected

9. MANUAL IP INVESTIGATOR (NEW v2.1)

  The Manual IP Investigator lets you investigate any suspicious IP
  you discover — without waiting for it to hit a lure first. This
  is designed for use alongside real-time terminal network monitoring.

  Access: Ghost Trap → Counter-Intel tab → Manual IP Investigator

  ── HOW TO FIND SUSPICIOUS IPs IN YOUR TERMINAL ─────────────────

  Run any of these commands to see active connections:

    netstat -an | grep ESTABLISHED
      Shows all established TCP connections (remote IP + port).

    ss -tnp
      Same as netstat but also shows the process that owns
      each connection. More reliable on modern Linux.

    ss -tnp | grep -v '127\.\|10\.\|192\.168'
      Filters out loopback and private IPs — shows only
      external connections your server is talking to.

    lsof -i -n -P | grep ESTABLISHED
      Shows established connections with the owning process name.
      Useful for identifying which application made a connection.

    iftop -n
      Real-time bandwidth per connection pair. Spot IPs sending
      or receiving unexpectedly large amounts of data.

  Look for:
  • IPs on non-standard ports: 4444, 1337, 31337, 6666, 9050
  • IPs connecting to ports you don't run services on
  • IPs in ISP ranges known for server hosting (Hetzner, OVH,
    DigitalOcean, Vultr, Linode) initiating connections to you
  • Connections your known application processes should not be making

  ── USING THE MANUAL IP INVESTIGATOR ──────────────────────────────

  Step 1: Copy the suspicious IP and port from your terminal output.
          Example: from "185.220.101.47:4444" — IP is 185.220.101.47,
          port is 4444.

  Step 2: Navigate to Ghost Trap → Counter-Intel tab.

  Step 3: Paste the IP into the IP Address field.

  Step 4: Enter the port number in the Port field (e.g. 4444).

  Step 5: Click Investigate.

  The system immediately runs in parallel:

  PORT SCAN:
    Checks your specified port FIRST, then scans 24 common
    attack/service ports. The result for your specified port is
    reported with a tailored message:

    OPEN:     "Port 4444 confirmed OPEN — the connection you saw
               in netstat is live. The host is actively running
               a service on this port."
    FILTERED: "Port 4444 is filtered (firewalled). The connection
               may be behind a cloud security group or NAT."
    CLOSED:   "Port 4444 is now CLOSED. The connection was
               ephemeral, already terminated, or from a rotating
               IP pool."

  OSINT:
    • Geolocation: country, city, latitude/longitude
    • ISP and AS Number (ASN)
    • Reverse DNS (PTR record)
    • Abuse contact email (from ARIN/RIPE/APNIC whois)
    • Known Tor exit node check
    • AbuseIPDB reputation score (if API key configured)

  Step 6: Review results. The target banner turns cyan to indicate
          a manual investigation (vs red for trap-log IPs).

  Step 7: If the IP is suspicious, use the action buttons:
    • Add to Firewall Block — immediately blocks across all nodes
    • Inject Counter-Beacon — plants a canary for attribution
    • Generate Abuse Report — creates ISP complaint template

  ── PORT SCAN DETAILS ─────────────────────────────────────────────

  Standard ports always checked (in addition to your specified port):
  22 (SSH), 23 (Telnet), 25 (SMTP), 53 (DNS), 80 (HTTP),
  443 (HTTPS), 445 (SMB), 1080 (SOCKS), 1337 (RAT common),
  3128 (Squid proxy), 3306 (MySQL), 3389 (RDP), 4444 (Metasploit),
  5432 (PostgreSQL), 5900 (VNC), 6379 (Redis), 6666 (IRC/botnet),
  8080 (HTTP alt), 8443 (HTTPS alt), 8888 (Jupyter), 9050 (Tor),
  9200 (Elasticsearch), 27017 (MongoDB), 31337 (elite/backdoor)

  Timeout per port: 2.5 seconds. Total scan time: ~5-15 seconds
  depending on network latency and number of open ports.

10. AUTO-BLOCK & ABUSE REPORTING

  Auto-Block:
    When Ghost Trap detects 3+ lure hits from the same IP within
    60 minutes, it automatically adds the IP to the Firewall block
    list across all VPN nodes. Manual override in Firewall → Rules.

  Abuse Report Template:
    Generated report includes:
    • WHOIS data for the attacker's IP
    • ISP abuse contact email
    • Timeline of all probe attempts with timestamps
    • Lure endpoints targeted
    • Fingerprint data (OS, tool, JA3)
    • Canary trigger data (if applicable)
    Submit to AbuseIPDB and the attacker's ISP ABUSE address.

11. COUNTER-INTEL TAB REFERENCE

  The Counter-Intel tab contains three tools:

  Manual IP Investigator (new v2.1):
    Paste any IP + port → full port scan + OSINT. Works on any
    public IP without it needing to be in the probe log first.

  Counter-Beacon Injector:
    Select any trapped IP and inject a targeted canary payload.
    Useful for IPs that hit lures but didn't receive an auto-beacon.

  Abuse Report Generator:
    Select any trapped or manually-investigated IP. Generates a
    complete abuse report ready to send to the ISP and AbuseIPDB.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC`,
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
Version 1.8 — Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC
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
Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC`,
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
Version 2.0 — Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC
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
Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC`,
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
Version 1.5 — Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC
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
Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC`,
  },

  // ── VPN PRIVACY SUITE TOOLS ───────────────────────────────────────────────
  {
    id: "privacy-suite-tools",
    title: "VPN Privacy Suite Tools",
    subtitle: "GPS Spoofing, Port Forwarding, Dedicated IP, Meshnet, Data Broker Opt-Out",
    version: "1.0",
    pages: 18,
    icon: MapPin,
    iconColor: "text-green-400",
    tier: "both",
    content: `ProxhqVPN: VPN Privacy Suite Tools
Version 1.0 — Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC
legal@alphauntechnologies.com | proxhqvpn.com

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TABLE OF CONTENTS

1. GPS Spoofing (/gps-spoof)
2. Port Forwarding (/port-forward)
3. Dedicated Static IP (/dedicated-ip)
4. Meshnet (/meshnet)
5. Data Broker Opt-Out (/data-broker)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. GPS SPOOFING (/gps-spoof)

  Overview:
  GPS Spoofing lets you broadcast a fake GPS location at the VPN tunnel
  level, overriding your device's actual physical coordinates. All apps
  reading location data receive the spoofed coordinates.

  Use Cases:
  • Bypass geo-locked apps and streaming libraries by region
  • Security testing: validate location-based access controls
  • Privacy: prevent location-based profiling and tracking
  • QA testing: simulate users from different geographic regions

  How to Use:
  1. Navigate to /gps-spoof in the Command Center.
  2. Enter target latitude and longitude manually, or search by city/country.
  3. Set accuracy radius (meters) — lower values appear more realistic.
  4. Click "Apply Location Override."
  5. All subsequent app location reads return the spoofed coordinates.
  6. Click "Reset to Real Location" to restore actual GPS data.

  Supported Platforms:
  • Web browser (JavaScript navigator.geolocation API spoofing)
  • Android (via ADB mock location injection when developer mode enabled)
  • iOS (via provisioning profile — see setup guide at /guide)
  • Windows/Linux/macOS (via WireGuard tunnel metadata injection)

  Notes:
  • Some apps have secondary location signals (Wi-Fi triangulation, cell tower)
    that may override GPS. Enable full VPN routing to eliminate these.
  • Accuracy values below 5m may trigger anti-cheat systems in apps.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

2. PORT FORWARDING (/port-forward)

  Overview:
  Port Forwarding lets you expose services running on your local machine
  through the VPN tunnel, making them reachable from the public internet
  via your ProxhqVPN exit IP. Supports TCP, UDP, and dual-stack.

  Use Cases:
  • Host a game server, web server, or dev environment behind VPN
  • Remote access to home lab equipment without exposing your real IP
  • Penetration testing: expose listener ports for reverse shells
  • Run local services accessible to a specific team IP range

  How to Configure:
  1. Navigate to /port-forward.
  2. Click "Add Rule."
  3. Select protocol: TCP, UDP, or Both.
  4. Enter local port (on your machine) and external port (on the VPN exit IP).
  5. Optionally restrict by source IP CIDR (e.g., 10.0.0.0/8 for LAN only).
  6. Click "Save Rule" — the rule activates within 30 seconds.
  7. Test by connecting to [your-exit-ip]:[external-port] from another machine.

  Security Guidance:
  • Never expose RDP (3389), SMB (445), or database ports to 0.0.0.0/0.
  • Always restrict source CIDRs where possible.
  • Rules persist across VPN reconnections but are removed on plan expiry.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

3. DEDICATED STATIC IP (/dedicated-ip)

  Overview:
  Dedicated IP gives your account a fixed, exclusive VPN exit IP address
  that only you use. This IP never changes, unlike shared pool IPs.

  Benefits:
  • Maintain IP reputation for email sending and payment processors
  • Whitelist your VPN IP in client/partner firewall rules
  • Session persistence for platforms that fingerprint by IP
  • Avoid CAPTCHAs caused by shared pool IPs flagged by other users

  How to Activate:
  1. Navigate to /dedicated-ip.
  2. Select your preferred exit region (e.g., US-East, EU-West, AP-Southeast).
  3. Click "Request Dedicated IP."
  4. Your static IP is provisioned within 60 seconds and displayed.
  5. Reconnect your WireGuard tunnel — all traffic now exits via your static IP.

  Notes:
  • Dedicated IPs are tied to your account subscription.
  • Cancelling your subscription releases the IP back to the pool.
  • IP is not shared with any other user for the duration of your subscription.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

4. MESHNET (/meshnet)

  Overview:
  Meshnet creates a peer-to-peer encrypted overlay network connecting all
  of your authorized devices into a private mesh. Traffic between devices
  on the mesh never touches external servers.

  Use Cases:
  • Secure team communication across geographically distributed devices
  • Share files and services between your own devices without a VPN server hop
  • Penetration testing lab: connect Kali, target VMs, and C2 in a private mesh
  • Home lab: give every device a stable private IP regardless of location

  How to Set Up:
  1. Navigate to /meshnet.
  2. Click "Enable Meshnet" — your device joins the mesh with a static mesh IP.
  3. On each additional device, sign in to ProxhqVPN and enable Meshnet.
  4. All mesh-enabled devices appear in the "Connected Peers" panel.
  5. Reach any peer by their mesh IP (e.g., 100.x.x.x).
  6. Optionally, authorize external peers by sharing a Meshnet invite link.

  Routing Modes:
  • Direct: P2P connection (fastest, works when peers can reach each other)
  • Relayed: Traffic relayed through ProxhqVPN node (fallback for NAT/CGNAT)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

5. DATA BROKER OPT-OUT (/data-broker)

  Overview:
  Data brokers collect and sell your personal information — name, address,
  phone number, relatives, income estimates, and more. This tool automates
  opt-out requests to 180+ known data broker databases.

  Use Cases:
  • Remove your personal data from people-search sites (Spokeo, BeenVerified, etc.)
  • Reduce spam calls, emails, and physical mail
  • Protect your identity and reduce social engineering attack surface
  • Comply with GDPR/CCPA deletion rights

  How to Use:
  1. Navigate to /data-broker.
  2. Enter your full name, current and past addresses, email addresses, and
     phone numbers you want removed.
  3. Click "Run Opt-Out Sweep."
  4. The tool submits removal requests to all 180+ covered brokers.
  5. Track status in the "Request Log" — each broker shows: Pending / Submitted / Confirmed.
  6. Re-run quarterly — brokers re-aggregate data from public records over time.

  Covered Broker Categories:
  • People search (Spokeo, Intelius, BeenVerified, PeopleFinder, Whitepages)
  • Marketing databases (Acxiom, Experian Consumer, LexisNexis, Oracle Data Cloud)
  • Background check services (Checkr, HireRight, Sterling)
  • Aggregators (Data.com, ZoomInfo, Clearbit)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INTERNAL DOCUMENT — DO NOT DISTRIBUTE
Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC`,
  },

  // ── QUANTUM AUDIT ─────────────────────────────────────────────────────────
  {
    id: "quantum-audit-manual",
    title: "QuantumAudit Manual",
    subtitle: "Blockchain Smart Contract Security Auditing + Signature Mining Engine",
    version: "1.0",
    pages: 28,
    icon: Zap,
    iconColor: "text-cyan-400",
    tier: "pro",
    content: `ProxhqVPN: QuantumAudit Manual
Version 1.0 — Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC
legal@alphauntechnologies.com | proxhqvpn.com

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TABLE OF CONTENTS

1. Overview & Architecture
2. Running a Smart Contract Scan
3. Vulnerability Categories
4. Post-Quantum Cryptographic Risk Analysis
5. Reading Scan Results & Reports
6. Signature Mining Engine — All 5 Engines
7. Cross-Engine Intelligence Pool
8. Authorized Use Policy

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. OVERVIEW & ARCHITECTURE

QuantumAudit (/quantum-audit/) is a standalone blockchain security
auditing platform integrated into the ProxhqVPN Command Center.
It analyzes smart contracts and DeFi protocols for two categories
of risk:

Classical Vulnerabilities:
• Reentrancy attacks (DAO-style, cross-function, cross-contract)
• Integer overflow/underflow (pre-Solidity 0.8)
• Unchecked external calls and return values
• tx.origin authentication bypass
• Unprotected SELFDESTRUCT
• Front-running and MEV sandwich attack vectors
• Flash loan attack vectors (single-block price manipulation)
• Price oracle manipulation (Uniswap TWAP vs spot price)
• Access control flaws (missing onlyOwner, role checks)
• Proxy upgrade vulnerabilities (uninitialized implementation)
• Governance token attacks (flash loan voting, timelock bypass)

Post-Quantum Cryptographic Risk:
• ECDSA signature weakness (nonce reuse, weak-k brute force)
• R-value collision detection (shared nonce across transactions)
• RSA key size inadequacy for quantum era (< 4096-bit flagged)
• Shor's algorithm vulnerability scoring for secp256k1 curves
• CRYSTALS-Kyber/Dilithium migration readiness assessment
• BLS signature strength analysis

Supported Chains:
Ethereum (ETH), Binance Smart Chain (BSC), Polygon (MATIC),
Solana (SOL), Avalanche (AVAX), and custom EVM-compatible chains.

Scan Types:
• Quick — Core classical vulnerability checks (3–5 min)
• Standard — Full classical + access control + DeFi risk suite (8–15 min)
• Quantum — Standard + full post-quantum cryptographic analysis (15–30 min)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

2. RUNNING A SMART CONTRACT SCAN

Method A — Contract Address:
1. Navigate to /quantum-audit/.
2. Click "New Scan" in the top navigation.
3. Select the target chain from the dropdown.
4. Enter the deployed contract address (0x... format for EVM chains).
5. Select scan type: Quick / Standard / Quantum.
6. Click "Start Scan."
7. The platform fetches contract bytecode via the chain's RPC endpoint
   and decompiles it for analysis.
8. Poll the scan status — the status badge updates from "queued"
   to "running" to "completed" automatically.
9. Click the scan result to open the Scan Detail page.

Method B — Source Code Direct Input:
1. Navigate to New Scan.
2. Select "Source Code" mode.
3. Paste your Solidity (.sol) or Rust (Solana) source code directly.
4. Select scan type and click "Start Scan."
5. Source analysis provides more precise findings (exact line numbers
   and variable names) than bytecode-only analysis.

API Method (for CI/CD integration):
  POST /api/quantum-audit/scan
  Content-Type: application/json
  {
    "contractAddress": "0x...",
    "chain": "ethereum",
    "scanType": "standard",
    "sourceCode": "(optional Solidity source)"
  }

  Poll: GET /api/quantum-audit/scans/:id
  Download report: GET /api/quantum-audit/scans/:id/report

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

3. VULNERABILITY CATEGORIES

CRITICAL:
• Reentrancy (state updated after external call — classic DAO attack)
• Unprotected SELFDESTRUCT (any caller can destroy the contract)
• Unchecked delegatecall (arbitrary code execution in caller's context)
• Flash loan + oracle manipulation chained (full fund drain possible)

HIGH:
• Integer overflow/underflow (token minting, balance manipulation)
• tx.origin authentication (phishing bypass)
• Front-running (reveal-before-commit in games, auctions, AMMs)
• Access control missing (mint/burn without role check)
• Proxy uninitialized implementation (storage collision)

MEDIUM:
• Timestamp dependence (miner-manipulable within ~900s)
• Denial of service via gas limit (unbounded loops in withdraw paths)
• Event not emitted on state change (off-chain monitoring blind spot)
• Hard-coded addresses (contract upgrade breaks assumptions)

LOW / INFO:
• Floating pragma version (use fixed compiler version)
• Unused state variables (gas optimization)
• Magic numbers (use named constants)
• Missing zero-address checks on setters

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

4. POST-QUANTUM CRYPTOGRAPHIC RISK ANALYSIS

Why This Matters:
Bitcoin and Ethereum use ECDSA on the secp256k1 curve. A sufficiently
powerful quantum computer running Shor's algorithm could derive the
private key from any exposed public key in polynomial time. While no
such quantum computer exists today, the cryptographic community
recommends proactive migration to post-quantum algorithms
(NIST standards: CRYSTALS-Kyber for key exchange, CRYSTALS-Dilithium
for signatures) for long-lived contracts and high-value wallets.

What QuantumAudit Checks:
  ECDSA Nonce Reuse:
  If the same nonce (k) is used in two ECDSA signatures with different
  messages, the private key can be derived algebraically in seconds
  using only pen-and-paper math — no quantum computer required.
  QuantumAudit's Block Scanner mines (r,s,z) tuples from on-chain
  transactions and flags any address where the r-value (which encodes
  the nonce) repeats across different message hashes.

  Weak-k Detection:
  Some early wallet implementations used weak random number generators.
  The Block Scanner brute-forces k values in the range 0–2^24 for each
  transaction signature. Any k in this range is recoverable in seconds
  on commodity hardware.

  RSA Key Adequacy:
  For contracts that use RSA-based signature verification, key sizes
  below 4096 bits are flagged as inadequate for post-quantum security.
  RSA-2048 is breakable with a ~4,000 logical-qubit machine.

  Quantum Risk Score (0–100):
  • 0–30: Low risk — no detected classical ECDSA weaknesses; NIST PQC
          migration recommended as a long-term roadmap item.
  • 31–60: Medium risk — potential pattern weaknesses; audit nonce
           generation in wallet software.
  • 61–85: High risk — r-value clustering or timing bias detected.
  • 86–100: Critical — active nonce reuse or weak-k detected; private
            key recovery is possible now without quantum hardware.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

5. READING SCAN RESULTS & REPORTS

Scan Detail Page (/quantum-audit/scans/:id):
• Summary banner: severity breakdown (Critical/High/Medium/Low count)
• Findings table: each finding has a title, severity badge, category,
  affected line (if source provided), description, and remediation.
• Quantum Analysis tab: post-quantum risk score, ECDSA assessment,
  and migration recommendations.
• Download Report: exports a full PDF-quality plain-text audit report.

Reading a Finding:
  Severity: CRITICAL
  Category: Reentrancy
  Finding: External call before state update in withdraw()
  Location: Line 142, function withdraw(uint256 amount)
  Description: The contract sends ETH to msg.sender before updating
    balances[msg.sender]. An attacker's fallback() function can
    re-enter withdraw() before the balance is decremented.
  Remediation: Move balances[msg.sender] -= amount to BEFORE
    the external call. Or use OpenZeppelin's ReentrancyGuard modifier.
  References: SWC-107, https://swcregistry.io/docs/SWC-107

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

6. SIGNATURE MINING ENGINE — ALL 5 ENGINES

Navigate to /quantum-audit/sig-miner. The Sig Miner deploys independent
engines that hunt for weak ECDSA signatures on-chain and across the web.

Engine 1 — Block Scanner (POST /sig-engine/block-scanner):
  Purpose: Mine raw (r,s,z) tuples from on-chain transactions.
  Input: target address or block range, chain selection.
  Detects:
  • Nonce reuse: same r-value in two transactions = private key exposed
  • Weak-k: brute forces k in 0–2^24 range (~16 million attempts)
  • R-collisions: r-value appears across multiple signing addresses
  • MSB/LSB bias: statistical analysis of r/s distribution
  • Polynomial nonce progressions: sequential or predictable k-values
  Output: signing_addresses[], nonce_reuse[], weak_k_candidates[],
          r_collision_addrs[], raw_sigs[]

Engine 2 — Web Spider (POST /sig-engine/web-spider):
  Purpose: BFS crawl of paste sites, GitHub Gists, and public pages.
  Input: seed URL(s), max depth, max pages.
  Regex extracts: private keys (WIF, hex), mnemonics (BIP-39 12/24 words),
                  ECDSA signatures (r/s hex), xpub/xprv, keystore JSON.
  Sources: Pastebin, GitHub Gists, HasteBin, Ghostbin, dpaste.
  Output: private_keys[], mnemonics[], ecdsa_sigs[], addresses[]

Engine 3 — OSINT Spider (POST /sig-engine/osint):
  Purpose: Targeted intelligence from structured sources.
  Input: address or ENS name to investigate.
  Sources:
  • GitHub code search (API): searches repos for hex private keys
  • Pastebin archive: scrapes public paste archive for address mentions
  • ENS text records: reads all text records for ENS names
  • OP_RETURN Bitcoin data: scans OP_RETURN outputs for embedded data
  • Ethereum tx input data: decodes input data of all txs from address
  Output: source_urls[], derived_addresses[], rs_pairs[]

Engine 4 — Peel Chain (POST /sig-engine/peel-chain):
  Purpose: Follow fund-flow chains hop-by-hop.
  Input: starting address, max hops (default 10), chain.
  Process: For each hop, fetches all outgoing transactions, extracts
           (r,s,z) tuples, runs nonce-reuse key recovery, and follows
           the largest output to the next hop.
  Detects: Nonce reuse across hops, amount correlation (peel pattern).
  Output: hops[], nonce_reuse_per_hop[], amount_correlation_score

Hybrid Worm Engine (POST /sig-engine/hybrid):
  Runs all 4 engines in parallel as async worker threads with:
  • Shared result queue (CrossEnginePool) — 12 active data-flow wires
  • Adaptive load balancing between engines
  • Jitter (random delays) to avoid detection/rate limiting
  • Cross-worm deduplication (address and r-value registries)
  Input: any combination of the 4 engines' inputs.
  Control: POST /sig-engine/stop to halt all engines.
           GET /sig-engine/status for live progress.
           GET /sig-engine/result for current findings.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

7. CROSS-ENGINE INTELLIGENCE POOL

The CrossEnginePool enables all 12 data-flow wires between engines:
  E1→E3: Every signing address found by Block Scanner goes to OSINT
  E1→E4: Nonce-reuse + r-collision addresses go to Peel Chain for tracing
  E1→pool: All raw (r,s,z) sigs shared globally for r-value collision checks
  E2→E3: Derived addresses from found private keys go to OSINT
  E2→E4: Derived addresses go to Peel Chain for fund-flow tracing
  E2→pool: All rs_pairs and ECDSA sigs from Web Spider shared globally
  E3→E2: Source URLs found by OSINT go back to Web Spider for crawling
  E3→E4: Derived addresses from found keys go to Peel Chain
  E3→E1: Suspicious addresses from OSINT go to Block Scanner for tx mining
  E4→E3: Hop outgoing addresses go to OSINT for investigation
  E4→E1: Nonce-reuse addresses from hops go to Block Scanner
  E4→pool: All hop r-values shared for cross-chain collision detection

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

8. AUTHORIZED USE POLICY

QuantumAudit and the Signature Mining Engine are authorized for:
• Security auditing of smart contracts you own or are hired to audit
• Research on publicly disclosed vulnerable contracts (educational)
• Bug bounty submissions on in-scope blockchain protocol contracts
• Internal security review of your own wallets and private keys
• Academic research on historical blockchain cryptographic weaknesses

PROHIBITED:
• Mining signatures from wallets you do not own or control
• Attempting private key recovery from third-party addresses
• Using derived keys to access, transfer, or interact with funds
• Any unauthorized access to blockchain assets

Violation of this policy constitutes unauthorized computer access
under the CFAA and applicable international laws.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INTERNAL DOCUMENT — DO NOT DISTRIBUTE
Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC`,
  },

  // ── SECURITY HARDENING V2.1.0 ─────────────────────────────────────────────
  {
    id: "security-hardening-v21",
    title: "Security Hardening Manual — v2.1.0",
    subtitle: "Comprehensive Platform Security Audit & Patch Documentation",
    version: "2.1",
    pages: 18,
    icon: Shield,
    iconColor: "text-green-400",
    tier: "both",
    content: `ProxhqVPN: Security Hardening Manual v2.1.0
Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC
legal@alphauntechnologies.com | proxhqvpn.com

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

This document details all security vulnerabilities identified during
the v2.1.0 audit, the remediation applied to each, and ongoing
security architecture decisions relevant to administrators and
security-conscious subscribers.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TABLE OF CONTENTS

1. Executive Summary
2. CVE-Equivalent Findings & Remediations (6 issues)
3. Desktop App Certificate Pinning
4. IP Auto-Ban System
5. WAF Hardening — Double-Decode & New Patterns
6. Security Architecture Overview
7. Ongoing Security Commitments

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. EXECUTIVE SUMMARY

ProxhqVPN v2.1.0 (released June 2026) is the result of a comprehensive
internal security audit of all API routes, middleware, and client
applications. Six vulnerabilities were identified — two CRITICAL,
two HIGH, and two MEDIUM — and have been fully remediated.

Severity Distribution:
  CRITICAL: 2 findings (timing attack, SSL MitM)
  HIGH:     2 findings (shell chain injection, SSRF redirect bypass)
  HIGH:     1 finding  (missing brute-force protection → now IP auto-ban)
  MEDIUM:   1 finding  (WAF URL-encoding bypass)

All fixes are live in the web application. Desktop application
users received the certificate pinning fix in v2.1.0 via auto-updater.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

2. FINDINGS & REMEDIATIONS

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FINDING 1 — CRITICAL: Timing Attack on Session Secret Comparison

Summary:
The internal API verified session authentication tokens using JavaScript
string equality (===). String equality short-circuits on the first
differing character, meaning the comparison time is proportional to
how many characters of the secret are correct. An attacker making
thousands of requests can statistically determine the secret character
by character by measuring response time differences.

Attack Vector:
A timing oracle attack. The attacker submits tokens that share 0, 1, 2...
N characters with the real secret, measuring response time for each.
Modern CPU timing resolution and statistical averaging over hundreds of
requests makes this exploitable even over the network.

Remediation Applied:
Replaced === with Node.js crypto.timingSafeEqual(). This function
compares all bytes in constant time regardless of how many match,
completely eliminating the timing side-channel. The comparison now
takes the same amount of time whether 0 characters or all characters
match.

Code change (routes/index.ts):
  BEFORE: if (token !== process.env.SESSION_SECRET) { ... }
  AFTER:  const a = Buffer.from(token);
          const b = Buffer.from(process.env.SESSION_SECRET || "");
          if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) { ... }

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FINDING 2 — CRITICAL: External PostgreSQL SSL Certificate Not Verified

Summary:
The SQL Interface allows connecting to external PostgreSQL databases.
The connection pool was initialized with { ssl: { rejectUnauthorized: false } }
which disables SSL certificate verification. This allows a man-in-the-middle
attacker positioned between the ProxhqVPN server and the external database
to intercept and read all database traffic, including sensitive queries,
credentials in query parameters, and query results.

Attack Vector:
MITM attack on the network path between ProxhqVPN API server and the
external PostgreSQL host. The attacker presents a self-signed certificate;
rejectUnauthorized: false causes Node.js to accept it without validation.

Remediation Applied:
Changed default to rejectUnauthorized: true. An explicit opt-in flag
(allowSelfSigned: true) in the connection request enables the old
behavior for development/self-signed scenarios, with a visible warning
in the UI that certificate verification is disabled.

For subscribers: If your external PostgreSQL uses a self-signed cert,
enable "Allow Self-Signed Certificate" in the SQL Interface connection
dialog — but be aware this disables MITM protection for that connection.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FINDING 3 — HIGH: Shell Chain Injection via Metacharacters

Summary:
The Remote Terminal's restricted mode enforces a command allowlist
(curl, wget, nmap, dig, nslookup, ping, traceroute, etc.). However,
it was possible to chain arbitrary commands by appending metacharacters
after an allowlisted command. For example:
  curl https://example.com ; rm -rf /tmp/data
The allowlist matched "curl" and permitted the entire input string,
including the shell chain operator ; and the destructive second command.

Attack Vector:
Any user with Terminal access could execute arbitrary OS commands
by appending ; cmd, && cmd, || cmd, \`cmd\`, $(cmd), or $((cmd))
to any allowlisted base command.

Blocked Patterns (SHELL_CHAIN_BLOCKED — 14 patterns):
  ;    &&    ||    |    \`    $(    $((    \n    \r
  >    >>    <    2>    &

Remediation Applied:
All 14 shell chain injection metacharacters are now blocked in restricted
mode BEFORE the allowlist is checked. Ghost Mode (ProxhqVPN Mode toggle)
bypasses the allowlist but still enforces the HARD_BLOCKED list (rm -rf /,
DROP TABLE, etc.) and logs every command to the audit trail.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FINDING 4 — HIGH: SSRF Redirect Chain Bypass

Summary:
The HTTP Client (Terminal → HTTP CLIENT tab) validated the initial
request URL against the SSRF guard (blocking 169.254.169.254,
10.x.x.x, 192.168.x.x, etc.). However, it followed HTTP redirects
(301/302/307/308) without re-validating each redirect destination.
An attacker could use a publicly-accessible URL that redirected to
an internal metadata endpoint (AWS EC2 metadata: 169.254.169.254/latest/).

Attack Vector:
  1. Set up a public URL: https://attacker.example.com/redirect
  2. Configure it to 302 redirect to http://169.254.169.254/latest/meta-data/
  3. Submit the public URL to the HTTP Client — initial check passes.
  4. ProxhqVPN follows the redirect, reads the cloud metadata response,
     and returns it to the attacker.

Remediation Applied:
The HTTP client now manually handles redirects (following up to 5 hops).
Before following each redirect, the destination URL is re-validated
against the SSRF guard. If any hop in the redirect chain targets a
blocked address, the request is aborted with a 403 SSRF_BLOCKED error.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FINDING 5 — HIGH: No Brute-Force Protection on API Endpoints

Summary:
No rate limiting existed beyond the global 300 requests/minute limiter,
and no IP-level ban mechanism existed for repeated authentication failures.
An attacker could attempt to brute-force session tokens, API endpoints
requiring auth, or any other credential check at sustained high rates.

Remediation Applied — IP Auto-Ban System:
A new middleware layer tracks authentication failures per IP address.
  • Threshold: 20 failed requests within a 5-minute sliding window
  • Ban duration: 30 minutes automatic block
  • Ban storage: In-memory Map (cleared on restart) with timestamp
  • Logging: Every ban recorded with timestamp and IP
  • Client response: HTTP 429 with "Rate limit exceeded. Try again later."

The ban applies to all /api/* routes and is checked BEFORE all other
middleware. Banned IPs cannot access any API endpoint until the ban expires.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

FINDING 6 — MEDIUM: WAF URL Double-Encoding Bypass

Summary:
The Web Application Firewall checked raw URL strings for attack patterns
(SQL injection: 'UNION SELECT', XSS: '<script>', path traversal: '../').
An attacker could double-URL-encode a payload to bypass all detections.
Example: ' → %27 → %2527. The WAF matched against the raw string
(%2527) and found no known SQL injection pattern.

Remediation Applied:
The WAF now decodes the URL string twice before pattern matching:
  Raw string → decodeURIComponent() → decodeURIComponent() → check

5 additional patterns added:
  • LFI file access: /etc/passwd, /proc/self, /windows/system32
  • Dropper user-agents: curl|wget|python-requests|go-http-client
  • Excessive parameter pollution: > 50 query parameters
  • Base64-encoded attack patterns (common WAF bypass)
  • PHP object injection: O:\d+:" pattern

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

3. DESKTOP APP — TLS CERTIFICATE PINNING (v2.1.0)

The Windows, macOS, and Linux Electron desktop app (v2.1.0) adds
TLS certificate pinning for all API connections in production mode.

What This Protects Against:
• Corporate SSL inspection proxies (MITM by employer-issued root CAs)
• Malware that installs rogue root certificates to intercept traffic
• Compromised system certificate stores
• Targeted MITM by network-level attackers

How It Works:
The Electron app intercepts the certificate-error event. In production
mode, any TLS error — regardless of whether the system CA trusts the
cert — causes the connection to be aborted. Only the ProxhqVPN production
certificate chain is trusted.

Dev mode retains normal browser certificate behavior to allow local HTTPS
testing with self-signed certs.

Desktop auto-updater: v2.1.0 is distributed via the built-in Electron
auto-updater. Users see an update banner on launch. The update is
signed and verified before installation.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

4. IP AUTO-BAN SYSTEM — OPERATIONAL DETAILS

The IP auto-ban system protects all API endpoints.

Ban Trigger:
  • 20 failed auth requests from same IP within 5 minutes
  • "Failed" = any 401 or 403 response from requireAuth middleware
  • Timer resets on successful authentication

Ban Duration: 30 minutes from last failed request

What Happens During a Ban:
  • ALL /api/* requests from the banned IP return HTTP 429
  • No data is returned — not even error details
  • The ban IP + timestamp are logged server-side

Admin Note:
  • Bans are stored in-memory — a server restart clears all bans
  • If a legitimate user is banned (e.g., after session expiry + retry loop),
    they are automatically unblocked after 30 minutes
  • For emergency unblock, restart the API server

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

5. WAF — FULL PATTERN LIST (POST v2.1.0)

The WAF runs on every incoming request before routing.

Existing Patterns (pre-v2.1.0):
  SQL injection:     UNION SELECT, DROP TABLE, INSERT INTO, --
  XSS:               <script, javascript:, onerror=, onclick=
  Path traversal:    ../, ..\
  Command injection: /bin/sh, /bin/bash, cmd.exe, eval(, exec(

New Patterns (v2.1.0):
  LFI/RFI:          /etc/passwd, /proc/self, /windows/system32
  Dropper UA:        curl|wget|python-requests|go-http-client in User-Agent
  Param pollution:   > 50 query parameters in one request
  Base64 attacks:    Patterns matching common base64-encoded payloads
  PHP injection:     O:\d+:" (PHP serialized object pattern)

Double-decode bypass protection is now applied to all patterns.
Both the original and double-decoded versions of every request URL
are checked against all patterns.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

6. SECURITY ARCHITECTURE OVERVIEW

Existing security layers (unchanged in v2.1.0):
  • Helmet.js: CSP, HSTS, noSniff, XSS filter, frameguard
  • CORS: strict allowlist (Replit domain regex + production domains)
  • Rate limiting: global 300/min, terminal 20/min, SQL 30/min
  • 64kb body size limit on all routes
  • Clerk requireAuth on all /api/* routes (except /api/healthz)
  • SELECT-only enforcement in local SQL mode
  • External PostgreSQL connection pool: 10-connection cap
  • Shell command allowlist + HARD_BLOCKED destructive patterns
  • Zod input validation on all POST endpoints
  • Warrant canary: /api/warrant-canary (public, signed, 30-day refresh)

New in v2.1.0:
  • crypto.timingSafeEqual() for all secret comparisons
  • rejectUnauthorized: true as default for external DB SSL
  • SHELL_CHAIN_BLOCKED (14 metacharacter patterns)
  • SSRF re-validation on every redirect hop (max 5)
  • IP auto-ban: 20 failures / 5 min → 30 min block
  • WAF double-decode + 5 new patterns
  • Electron certificate pinning (production builds)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

7. ONGOING SECURITY COMMITMENTS

ProxhqVPN's security program includes:
  • No-log policy: No user activity, DNS queries, connection timestamps,
    or IP addresses are logged at the VPN layer.
  • Warrant canary: Updated every 30 days. Public endpoint at
    /api/warrant-canary returns a cryptographically signed statement
    confirming: no NSLs, no FISC orders, no gag orders, no key
    handovers, no backdoors.
  • Responsible disclosure: security@proxhqvpn.com (PGP available).
    PGP key available on request. We aim to respond within 48 hours
    and patch critical findings within 7 days.
  • Continuous audit: Security review is conducted before every major
    release. All high and critical findings are patched before release.
  • Dependency auditing: All npm packages are audited weekly. Critical
    CVEs in direct dependencies are patched within 24 hours of disclosure.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INTERNAL DOCUMENT — DO NOT DISTRIBUTE
Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC`,
  },

  // ── DEV SECURITY TOOLS V2 ─────────────────────────────────────────────────
  {
    id: "dev-security-tools-v2",
    title: "Dev Security Tools v2",
    subtitle: "OAST Tester, Dependency Scanner, Token Sequencer, WebSocket Tester, SAST Scanner",
    version: "1.0",
    pages: 22,
    icon: Code,
    iconColor: "text-red-400",
    tier: "pro",
    content: `ProxhqVPN: Dev Security Tools v2
Version 1.0 — Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC
legal@alphauntechnologies.com | proxhqvpn.com

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TABLE OF CONTENTS

1. OAST Tester (/oast-tester)
2. Dependency Scanner (/dep-scanner)
3. Token Sequencer (/token-seq)
4. WebSocket Tester (/ws-tester)
5. SAST Scanner (/sast)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. OAST TESTER (/oast-tester)
   Out-of-Band Application Security Testing

  Overview:
  OAST Tester generates unique callback payloads (DNS, HTTP, SMTP) that
  your target application triggers when vulnerable to blind injection.
  Integrates with interactsh for real-time callback monitoring.

  What It Detects:
  • Blind SSRF (Server-Side Request Forgery) — server fetches your callback URL
  • Blind XXE (XML External Entity) — parser resolves your DNS/HTTP callback
  • Blind command injection — server executes curl/nslookup to your endpoint
  • Blind SQL injection (OOB via DNS) — database resolves DNS lookup
  • Log4Shell and similar JNDI injection vulnerabilities

  How to Use:
  1. Navigate to /oast-tester.
  2. Click "Generate Callback" — a unique interactsh subdomain is created.
     Example: abc123.oast.proxhqvpn.com
  3. Copy the generated payload for your target injection point:
     • HTTP URL: http://abc123.oast.proxhqvpn.com
     • DNS payload: \${IFS}nslookup abc123.oast.proxhqvpn.com
     • JNDI: \${jndi:ldap://abc123.oast.proxhqvpn.com/a}
  4. Inject the payload into the target application (URL param, header, XML body, etc.).
  5. Watch the "Live Interactions" panel — any callback from the server appears
     within seconds showing: timestamp, source IP, interaction type, raw payload.
  6. A callback confirms the vulnerability is exploitable out-of-band.

  Payload Types Available:
  • HTTP GET / POST callback URLs
  • DNS resolution payloads (nslookup, dig, curl variants)
  • SMTP callback addresses
  • JNDI LDAP injection strings (Log4Shell variants)
  • Burp Collaborator-compatible format

  Legal Note:
  OAST payloads must only be injected into systems you own or have written
  authorization to test. All interactions are logged with timestamp and source IP.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

2. DEPENDENCY SCANNER (/dep-scanner)

  Overview:
  Scans project dependency manifests for known CVEs across all major
  package ecosystems. Results are severity-ranked with fix guidance.

  Supported Package Managers:
  • npm / yarn / pnpm (package.json, package-lock.json, yarn.lock)
  • pip / poetry (requirements.txt, pyproject.toml, Pipfile)
  • Cargo (Cargo.toml, Cargo.lock)
  • Go modules (go.mod, go.sum)
  • Maven / Gradle (pom.xml, build.gradle)
  • Composer (composer.json, composer.lock)
  • RubyGems (Gemfile, Gemfile.lock)
  • NuGet (.csproj, packages.config)

  How to Use:
  1. Navigate to /dep-scanner.
  2. Upload your manifest file(s) or paste the contents directly.
  3. Click "Scan Dependencies."
  4. Results appear within 10–30 seconds, grouped by severity:
     CRITICAL → HIGH → MEDIUM → LOW → INFO
  5. Each finding shows:
     • Package name and vulnerable version
     • CVE ID(s) with CVSS score
     • Description of the vulnerability
     • Fixed version (if available)
     • Direct upgrade command (npm install pkg@x.y.z, etc.)
  6. Click "Export Report" to download findings as CSV or JSON.

  Data Sources:
  • NVD (National Vulnerability Database)
  • GitHub Advisory Database
  • OSV (Open Source Vulnerabilities)
  • Snyk Vulnerability DB
  • npm audit / pip-audit native APIs

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

3. TOKEN SEQUENCER (/token-seq)

  Overview:
  Token Sequencer captures session tokens or other application-generated
  values and performs statistical entropy analysis to detect predictability
  weaknesses that could allow an attacker to forge valid tokens.

  What It Tests:
  • Randomness quality of session IDs, CSRF tokens, API keys, password reset tokens
  • Entropy (bits of randomness) — OWASP recommends ≥ 128 bits
  • Pattern detection: sequential IDs, timestamp-based tokens, base64-encoded integers
  • Prediction feasibility: can the next token be guessed from previous samples?

  How to Use:
  1. Navigate to /token-seq.
  2. Paste a list of token samples (minimum 100, ideally 500+).
     Collect from: login cookies, response headers, CSRF input fields.
  3. Click "Analyze."
  4. Results show:
     • Entropy estimate (bits)
     • Character space analysis
     • Pattern signature (sequential / timestamp-based / random)
     • Prediction risk rating: SAFE / WEAK / VULNERABLE
  5. For WEAK or VULNERABLE tokens: use the "Prediction Attack" tab to generate
     candidate tokens from the observed pattern for authorized testing.

  Interpretation:
  • > 128 bits entropy: Generally safe for session tokens
  • 64–128 bits: Marginal — acceptable only for low-risk tokens
  • < 64 bits: High risk — predictable under targeted attack
  • Sequential integers / timestamps: Immediately vulnerable

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

4. WEBSOCKET TESTER (/ws-tester)

  Overview:
  WebSocket Tester is a full WebSocket client with intercept, replay,
  and fuzzing capabilities — equivalent to Burp Suite's WebSocket tab.

  Use Cases:
  • Test real-time applications (chat, trading, gaming, live data feeds)
  • Identify authentication/authorization flaws in WS connections
  • Fuzz WebSocket message payloads for injection vulnerabilities
  • Replay captured frames to test business logic

  How to Use:
  1. Navigate to /ws-tester.
  2. Enter the target WebSocket URL: ws:// or wss://
  3. Add custom headers (e.g., Authorization: Bearer <token>) if required.
  4. Click "Connect" — the connection status and handshake headers are displayed.
  5. In the "Messages" panel, type any payload and click "Send."
  6. All sent and received frames appear in the message log with timestamps.
  7. Click any received frame and "Send to Repeater" to modify and replay it.
  8. Use the "Fuzzer" tab to automatically iterate payloads from a wordlist
     against a selected message template.

  Common Test Payloads:
  • XSS in message body: <img src=x onerror=alert(1)>
  • IDOR: change user_id field to another user's ID
  • Privilege escalation: modify role/permission fields in JSON payloads
  • SQL injection: inject ' OR 1=1 -- into query parameters in the WS message

  Legal Note:
  Only test WebSocket endpoints on systems you own or have authorization to test.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

5. SAST SCANNER (/sast)
   Static Application Security Testing

  Overview:
  SAST Scanner performs source code analysis without execution, identifying
  security vulnerabilities in your codebase by pattern-matching against
  35+ vulnerability signatures across 12 languages.

  Supported Languages:
  JavaScript / TypeScript, Python, Java, Go, PHP, Ruby, C/C++,
  C#/.NET, Rust, Bash/Shell, SQL, Dockerfile / YAML configs

  Vulnerability Patterns Detected (35+):
  • Injection: SQL injection, command injection, LDAP injection, XPath injection
  • XSS: reflected, stored, DOM (unsanitized innerHTML, document.write)
  • Secrets: hardcoded API keys, passwords, tokens, private keys
  • Insecure crypto: MD5/SHA-1 usage, ECB mode, hardcoded IV
  • Path traversal: unsanitized file paths, directory traversal
  • Deserialization: unsafe pickle, Java ObjectInputStream, PHP unserialize
  • SSRF: unvalidated URL inputs passed to HTTP clients
  • Prototype pollution: recursive merge patterns in JavaScript
  • Weak authentication: JWT alg:none, missing expiry, hardcoded secrets
  • Insecure dependencies: cross-references with dep-scanner CVE data
  • CORS misconfiguration: wildcard origin with credentials
  • Insecure direct object reference patterns: unvalidated ID parameters

  How to Use:
  1. Navigate to /sast.
  2. Upload a ZIP of your source code, paste a code snippet, or connect
     a GitHub repository (OAuth required).
  3. Select languages to scan (or use auto-detect).
  4. Click "Run SAST Scan."
  5. Results appear in 15–120 seconds depending on codebase size.
  6. Each finding shows:
     • File path, line number, code snippet
     • Vulnerability class and severity (CRITICAL/HIGH/MEDIUM/LOW)
     • Description and remediation guidance
     • CWE ID and OWASP Top 10 mapping
  7. Click "Export" to download findings as SARIF, JSON, or CSV.
  8. Use "Fix Suggestions" tab for AI-generated remediation code diffs.

  False Positive Management:
  • Mark false positives inline — they are excluded from future scans of the
    same file/line.
  • Adjust sensitivity (LOW / MEDIUM / HIGH) to balance coverage vs. noise.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
INTERNAL DOCUMENT — DO NOT DISTRIBUTE
Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC`,
  },
];

// ── Category grouping ─────────────────────────────────────────────────────────
const CATEGORIES = [
  {
    label: "VPN & Privacy",
    color: "text-green-400",
    border: "border-green-900",
    bg: "bg-green-950/20",
    ids: ["vpn-getting-started", "wireguard-advanced", "privacy-suite-tools"],
  },
  {
    label: "Command Center Pro — Security Tools",
    color: "text-red-400",
    border: "border-red-900",
    bg: "bg-red-950/20",
    ids: ["omnistrike-manual", "waf-analyzer-manual", "social-breach-manual", "bug-bounty-hub-manual", "dev-security-tools-v2"],
  },
  {
    label: "Blockchain Security",
    color: "text-cyan-400",
    border: "border-cyan-900",
    bg: "bg-cyan-950/20",
    ids: ["quantum-audit-manual"],
  },
  {
    label: "Intelligence & Monitoring",
    color: "text-blue-400",
    border: "border-blue-900",
    bg: "bg-blue-950/20",
    ids: ["osint-recon-manual", "canary-tokens-manual", "siem-manual"],
  },
  {
    label: "Platform Security",
    color: "text-green-400",
    border: "border-green-900",
    bg: "bg-green-950/20",
    ids: ["security-hardening-v21"],
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
            <span>Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC — For authorized subscribers only</span>
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
