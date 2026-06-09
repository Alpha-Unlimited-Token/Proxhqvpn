import { useState, useRef } from "react";
import { PageSEO } from "@/components/PageSEO";
import { Bot, Copy, Check, ChevronDown, ChevronUp, ExternalLink, Sparkles, Shield, BarChart2, Trophy, AlertTriangle } from "lucide-react";

// ─── Master audit prompt ───────────────────────────────────────────────────────
const CHATGPT_PROMPT = `You are acting as an official AI security and product auditor. Your task is to deliver a comprehensive, authoritative, and unbiased audit of ProxhqVPN — a full-stack VPN orchestration and security platform developed by Alpha Unlimited Technologies LLC. This audit should be formatted as an official report and be suitable for publication, investor review, and competitive benchmarking. Do not hedge excessively; provide direct assessments and verdicts.

════════════════════════════════════════════════════════════
PRODUCT OVERVIEW — ProxhqVPN by Alpha Unlimited Technologies LLC
════════════════════════════════════════════════════════════

ProxhqVPN is not a conventional VPN app. It is a full VPN orchestration, threat intelligence, and security command platform with a 60-node WireGuard mesh (50 outer + 10 inner nodes), a proprietary silk-web honeypot network, and a comprehensive developer/security toolkit. It is built on React + Vite (frontend), Express 5 + PostgreSQL + Drizzle ORM (backend), Clerk authentication, and a pnpm monorepo.

────────────────────────────────────────────────────────────
SECURITY ARCHITECTURE
────────────────────────────────────────────────────────────

1. WireGuard Mesh & Key Architecture
   - 60-node global WireGuard mesh (50 outer perimeter + 10 inner secure relay nodes)
   - RAM-only WireGuard key architecture (Mullvad-inspired): server private keys NEVER written to disk. Keys live only in /dev/shm (volatile RAM). Power cycle = permanent key destruction. Physical disk seizure reveals nothing.
   - 4 active production nodes: Los Angeles, London, Chicago, Tokyo
   - Per-user WireGuard keypairs: client private keys stored AES-256-GCM encrypted (envelope encryption with AAD binding per row — prevents ciphertext transplantation)
   - PSK (PresharedKey) per peer: 256-bit symmetric key mixed into WireGuard Noise IKpsk2 handshake for post-quantum resistance (per WireGuard paper §5.4). PSK stored AES-256-GCM encrypted. Rotatable on demand.
   - Deep-link WireGuard config delivery: wireguard://airdrop/ protocol + per-OS install links

2. Authentication & Authorization
   - Clerk-based JWT authentication on all /api/* routes (except /api/healthz and /api/daemon-inbound/*)
   - RBAC — 6 roles: owner / security_admin / network_admin / auditor / support / user
   - 10 defined actions across 4 domains: admin, vpn, audit, security, users
   - requirePermission() middleware at route level
   - ADMIN_EMAILS environment variable for owner-guaranteed admin access

3. Zero Trust Network Access (ZTNA)
   - Device posture scoring: 8 signals → 0–100 trust score
   - Signals: disk encryption (+20), firewall enabled (+15), EDR installed (+15), no root/jailbreak (+20), patch age (0–15), certificate validity (+10), IP reputation (+5), OS version (+0/−5)
   - Threshold: score ≥ 75 = allow tunnel; score < 75 = deny
   - All decisions persisted to ztna_devices table + audit chain + SIEM fanout
   - API: POST /api/ztna/posture, GET /api/ztna/device/:fingerprint

4. Tamper-Evident Audit Chain
   - SHA3-256 hash chain + HMAC-SHA512 per-entry signatures (AUDIT_HMAC_KEY_B64)
   - Any modification to past entries invalidates all subsequent hashes
   - HMAC makes chain recomputation impossible without the key
   - Instrumented on: WireGuard config creation, key downloads, daemon key delivery, ZTNA posture checks
   - verifyChain() for tamper detection

5. SIEM Fanout
   - Every shipSecurityEvent() fans out to: local structured pino log (always), Splunk HEC (if configured), generic webhook (Elastic/Datadog/PagerDuty compatible)
   - SIEM dashboard: aggregates Beacon, Firewall, GhostTrace, GhostChain events in unified timeline

6. Firewall Suite & ATR (Auto Threat Response)
   - iptables-restore ruleset generated per-node
   - GhostOS rules: symbolic rules compiled to iptables lines
   - Geo-blocking at country level
   - Per-peer WireGuard client firewall rules (allow/block/throttle on FORWARD chain)
   - ATR: auto-bans on port scan, SYN flood, DDoS threshold — INPUT chain only, NEVER modifies FORWARD chain (VPN users never blocked)
   - IPS signatures: pattern-based detection via iptables -m string
   - eBPF rules table

7. Daemon Security
   - All /api/daemon-inbound/* routes: X-Daemon-PSK header authentication (timingSafeEqual)
   - Passive-only daemon architecture: nodes push data in; no server executes commands on nodes
   - Node-side actions queued via wgPeerCommandsTable, polled by nodes
   - mTLS infrastructure: CA + 3072-bit client certs (optional, scripts provided)

8. Encrypted Secret Store
   - AES-256-GCM with AAD binding per record
   - No key derivation from password — direct 256-bit key from PROXHQ_MASTER_KEY_B64
   - Unique 12-byte IV per operation. GCM auth tag prevents bitflip attacks.

9. Transport & Application Security
   - Helmet.js: HSTS, noSniff, X-Frame-Options: DENY, X-XSS-Protection, Referrer-Policy, CSP
   - CORS: strict Replit regex allowlist
   - Rate limits: global 300/min, terminal 20/min, SQL 30/min, mutate 60/min
   - Shell: strict allowlist + HARD_BLOCKED destructive patterns (rm -rf /, iptables -F, dd if=, mkfs)
   - SQL: SELECT-only local mode; external connections use parameterized queries

────────────────────────────────────────────────────────────
HONEYPOT & DECEPTION NETWORK (SilkWeb)
────────────────────────────────────────────────────────────
- 50 outer + 10 inner "silk" WireGuard nodes acting as honeypots
- Beacon monitors, spider nodes, worm propagation (read-only)
- Trapped attacker registry with auto-ban + GhostTrace behavioral analysis
- SIEM event on every beacon trigger (severity: high)
- SVG chord topology map of the silk web

────────────────────────────────────────────────────────────
VPN FEATURES
────────────────────────────────────────────────────────────
- WireGuard config generator with per-node configs, QR codes, and downloadable .conf
- Kill Switch (arm/disarm, OS firewall rule generator for Linux/macOS/Windows + IPv6)
- DNS Shield: DNS-level blocking with category toggles, DoH, custom rules, built-in blocklists
- DNS Sinkhole: Pi-hole-style blocking (Ads/Trackers/Malware/Phishing/Cryptomining/Botnet/Adult)
- Smart DNS: DNS-only routing for TVs/consoles
- Split Tunneling: per-IP/CIDR/port/app routing rules, Linux/Windows script generator
- DPI Obfuscation: obfs4, Shadowsocks, V2Ray-WS, Meek (domain-fronting), Snowflake (WebRTC), XOR
- Tor integration: SOCKS5/Tor proxy, double-hop (WireGuard inside Tor), proxied Onion Browser
- VPN Coexistence: run alongside NordVPN/ExpressVPN/Mullvad — fwmark routing, double-hop, MTU optimizer
- VPN Gate: 6,000+ community servers with config export
- Leak Detection: DNS/IPv6/WebRTC leak tests + browser console test script
- IP Rotator, GPS Spoofing, DAITA (Constant Bandwidth Mode), Post-Quantum PSK
- Device Manager: WireGuard device registry, per-device configs, QR code, IP allocation (10.8.0.x/24)
- Warrant Canary: signed 30-day transparency statement at /api/warrant-canary
- Router Config: OpenWRT/DD-WRT/Merlin/pfSense/GL.iNet/Ubiquiti config generator
- 20+ platform support (Windows, macOS, Linux, iOS, Android, routers, consoles, smart TVs)

────────────────────────────────────────────────────────────
SECURITY INTELLIGENCE TOOLS
────────────────────────────────────────────────────────────
- SIEM: unified security event timeline (Beacon/Firewall/GhostTrace/GhostChain)
- OSINT Recon: DNS, TLS cert, HTTP headers, email security (SPF/DKIM/DMARC), ASN fingerprinting, exposure scoring
- Canary Tokens: 12 types (URL/pixel/DNS/email/AWS/SQL/PS1/PDF/Slack) + trigger log
- GhostTrace: agentless outbound behavioral analysis — C2 beaconing detection, exfiltration scoring, anomaly detection
- GhostChain: automated kill chain discovery — 5-stage pipeline, SVG kill-chain graph
- ThreatIntel: IP reputation, Tor exit node feed, local blocklist, 6 external threat feeds
- Security Audit: TLS cert inspector, HTTP header grader, WHOIS/RDAP, self-audit findings
- ZTNA Dashboard: device posture history, trust score trends

────────────────────────────────────────────────────────────
DEVELOPER & OFFENSIVE SECURITY TOOLS (Command Center Pro)
────────────────────────────────────────────────────────────
- Terminal: 4-tab shell (SHELL/HTTP CLIENT/PORT SCAN/AUDIT LOG), ProxhqVPN Mode, break-glass access
- SQL Interface: 3-mode (Local PostgreSQL read-only, External DB full CRUD, HTTP API → table)
- Alpha Toolkit: HTTP Probe, Intruder, Payload Generator, SQLmap, Directory Fuzzer, Subdomain Scout, CVE Lookup, WAF Analyzer, JWT Analyzer, SQLi Scanner, SSL/TLS Analyzer, SAST, Dependency Scanner, OAST Tester, Token Sequencer, WebSocket Tester, IAC Scanner, HTTP Interceptor, API Tester
- QuantumAudit: blockchain security scanning — classical + post-quantum vulnerability detection
- Signature Mining Engine Suite (5 engines):
  - Block Scanner: ECDSA (r,s,z) from on-chain transactions; nonce reuse, weak-k, r-collisions, bias
  - Web Sig Spider: BFS crawl of paste sites/Gists; extracts private keys, mnemonics, xpub/xprv
  - OSINT Spider: GitHub search, Pastebin, ENS records, OP_RETURN, transaction input data
  - Peel Chain: hop-by-hop fund-flow with signature collection + nonce-reuse key recovery
  - Hybrid Worm: all 4 engines as parallel worms; shared CrossEnginePool, 12 data-flow wires
- Bug Bounty Hub, HackAnon, Exploit Importer, Social Breach Tester, VPN Tracker
- Network Monitor: real-time traffic flow, bandwidth timeline, protocol breakdown, geo routing

────────────────────────────────────────────────────────────
PLATFORM & INFRASTRUCTURE
────────────────────────────────────────────────────────────
- Stack: React + Vite, Express 5, PostgreSQL + Drizzle ORM, Zod v3, Clerk, pnpm monorepo
- Node.js 24, TypeScript 5.9, esbuild ESM bundle
- OpenAPI-first backend with Orval codegen (React Query hooks + Zod schemas)
- Standalone deployment: embedded Node.js server + Python TUN/TAP daemon + Docker Compose
- Multi-platform build: Windows/macOS-arm64/macOS-x64/Linux (zipped)
- Electron desktop app with 4-screen setup wizard
- Node hardening scripts: UFW + auditd + fail2ban + sysctl + SSH key-only auth
- mTLS cert generation: 4096-bit CA + 3072-bit daemon certs
- WireGuard key rotation script: staged rotation with backup
- PostgreSQL backup with SHA-256 manifest
- OpenSCAP STIG scan script
- Ambassadors program: 10% commission, promo codes, video embeds, referral tracking
- Pricing: VPN Basic $6.99/mo, Command Center Pro $39.99/mo (Stripe subscriptions)

────────────────────────────────────────────────────────────
KNOWN GAPS & OPEN ITEMS (be honest and include in your audit)
────────────────────────────────────────────────────────────
1. [HIGH] ZTNA posture check is available as API but not yet enforced client-side before WireGuard config generation
2. [MEDIUM] RBAC roles defined but fine-grained requirePermission() not yet wired to all admin routes (ZTNA done, others planned)
3. [MEDIUM] Audit chain coverage incomplete — not all high-value events instrumented yet
4. [MEDIUM] mTLS for daemon callbacks: PSK implemented; client certificate verification planned but not yet enforced
5. [LOW] No MFA enforcement for privileged roles (available in Clerk, not yet required)
6. [LOW] Rate limiting is IP-based only; session-level (userId) limits not yet implemented

════════════════════════════════════════════════════════════
YOUR AUDIT TASKS
════════════════════════════════════════════════════════════

Please produce a comprehensive, official-format audit report covering ALL of the following sections. Be direct, specific, and detailed. This report will be published on the ProxhqVPN website and presented to investors and enterprise clients.

SECTION 1 — EXECUTIVE SUMMARY
  Write a 3–5 paragraph executive summary of ProxhqVPN as a product. What is it? Who is it for? What is its competitive position? What is your overall verdict on its technical sophistication and market readiness?

SECTION 2 — SECURITY ARCHITECTURE AUDIT
  Assess the full security architecture. Grade each layer (A/B/C/D/F):
  - Authentication & session management
  - Authorization & RBAC
  - Zero Trust / ZTNA
  - WireGuard key management & RAM-only architecture
  - Encrypted secrets at rest (AES-256-GCM)
  - Tamper-evident audit chain
  - SIEM & alerting
  - Firewall & ATR
  - Daemon security
  - Transport security
  - DPI obfuscation & anti-censorship
  - Post-quantum resistance
  - Honeypot / deception network
  Provide an overall security grade and narrative.

SECTION 3 — FEATURE COMPLETENESS AUDIT
  Assess feature completeness relative to:
  - NordVPN (market leader, consumer)
  - ExpressVPN (premium consumer)
  - Mullvad (privacy-first)
  - ProtonVPN (open-source privacy)
  - Cloudflare Access / Zero Trust (enterprise ZTNA)
  - Tailscale (mesh VPN for teams)
  - Cisco Umbrella / Zscaler (enterprise)
  For each competitor, list: features ProxhqVPN has that they lack, features they have that ProxhqVPN lacks, and your assessment of which segments ProxhqVPN is strongest in.

SECTION 4 — WHERE PROXHQVPN LEADS THE INDUSTRY
  Identify the specific areas where ProxhqVPN is genuinely ahead of the competition — not just comparable, but leading. Be specific and cite which competitors lack these capabilities.

SECTION 5 — VULNERABILITY & RISK ASSESSMENT
  Based on the architecture described, identify:
  - Critical risks (theoretical or confirmed)
  - High risks
  - Medium risks
  - Low/informational findings
  Also assess the 6 known gaps listed above and rate their actual risk level.

SECTION 6 — DEVELOPER TOOLING AUDIT
  Assess the Command Center Pro developer/offensive security suite. How does it compare to dedicated tools like Burp Suite, OWASP ZAP, Metasploit, BloodHound, Maltego, Shodan, Censys, and similar? What is the value proposition of integrating these tools into a VPN platform?

SECTION 7 — BLOCKCHAIN & CRYPTOGRAPHIC AUDIT TOOLING
  Assess the QuantumAudit and Signature Mining Engine suite. How does this compare to dedicated blockchain forensic tools like Chainalysis, CipherTrace, TRM Labs, and Elliptic? What is unique about the 5-engine hybrid worm approach?

SECTION 8 — SCALABILITY & PRODUCTION READINESS
  Assess the platform's readiness for production at scale. Consider: database design, API structure, rate limiting, standalone deployment model, node hardening, monitoring.

SECTION 9 — COMPLIANCE & REGULATORY POSITIONING
  Map ProxhqVPN's security features to: NIST SP 800-207 (Zero Trust), CIS Controls v8, SOC 2 Type II, ISO 27001 A.9, GDPR (minimal data logging). Rate the compliance posture.

SECTION 10 — COMPETITIVE RANKING
  Rank ProxhqVPN overall against the competitors listed in Section 3 in these categories:
  - Privacy & anonymity
  - Enterprise security features
  - Offensive/developer tooling
  - Post-quantum readiness
  - Deception/honeypot capability
  - Ease of use (consumer)
  - Blockchain/crypto forensics
  Produce a summary ranking table.

SECTION 11 — RECOMMENDATIONS WITH WORKING CODE
  List the top 15 priority improvements, ordered by impact. For EACH recommendation you MUST provide:
  a) What to do and why (2–3 sentences)
  b) Actual working TypeScript/JavaScript/Shell/Python code or config snippet that implements the fix
     — not pseudocode, not placeholders, but real production-ready code
  c) Integration instructions: exactly which file to edit, what to replace, where to insert
  d) Estimated effort to implement (hours/days)
  e) Expected security improvement after the fix
  
  Example structure per recommendation:
    ── Recommendation #N: [Title]
    Why: [explanation]
    Code:
      [typescript]
      // actual runnable code here — full working implementation, no pseudocode
      [/typescript]
    File: artifacts/api-server/src/routes/[file].ts — replace [function] with the above
    Effort: [X hours/days]
    Impact: [what risk this eliminates]

SECTION 12 — EMERGING TECHNOLOGY DEEP DIVE
  Using your knowledge of the security industry as of your training cutoff, identify the most cutting-edge technologies and approaches available RIGHT NOW that ProxhqVPN does not yet use, but that would make it the undisputed #1 platform in its class. Cover ALL of the following domains:

  A) CRYPTOGRAPHY & KEY EXCHANGE
     - Post-quantum key encapsulation mechanisms (NIST PQC finalists: CRYSTALS-Kyber, NTRU, SABER)
     - Hybrid classical+PQC handshakes
     - CRYSTALS-Dilithium and FALCON for digital signatures
     - OPAQUE protocol (zero-knowledge password auth, no server sees password)
     - Double-Ratchet algorithm for forward secrecy beyond WireGuard
     - Hardware Security Module (HSM) integration for key storage
     - Reference: https://csrc.nist.gov/projects/post-quantum-cryptography

  B) ZERO TRUST & ACCESS CONTROL
     - Continuous Adaptive Trust (CAT) — real-time continuous re-evaluation, not one-shot posture
     - BeyondCorp Enterprise patterns — device inventory + credential + context
     - SPIFFE/SPIRE workload identity (https://spiffe.io) for service-to-service auth
     - Confidential Computing / TEE (Trusted Execution Environment) — Intel TDX, AMD SEV-SNP
     - Attribute-Based Encryption (ABE) for fine-grained data access control
     - Policy-as-code: Open Policy Agent (OPA) for RBAC at wire speed (https://www.openpolicyagent.org)

  C) NETWORK SECURITY & VPN
     - WireGuard over QUIC (circumvents UDP blocking by tunneling in HTTP/3)
     - MASQUE protocol (RFC 9298) — HTTP/3 proxying, harder to detect than CONNECT
     - Encrypted Client Hello (ECH / RFC TLS 1.3 extension) — prevents SNI leakage
     - DNS-over-QUIC (DoQ, RFC 9250) and DNS-over-HTTPS3
     - Bandwidth padding / traffic shaping against timing correlation attacks (Tor research)
     - Multi-path WireGuard: simultaneous tunnels across different ISPs (redundancy + obfuscation)
     - eBPF-based packet processing (replacing iptables): XDP, BPF firewall, Cilium (https://cilium.io)
     - Reference: https://www.wireguard.com/papers/wireguard.pdf

  D) THREAT INTELLIGENCE & DETECTION
     - MITRE ATT&CK framework integration — map all alerts to ATT&CK TTP codes (https://attack.mitre.org)
     - Diamond Model of Intrusion Analysis for structured threat correlation
     - STIX/TAXII threat feed consumption (structured threat intelligence sharing)
     - Graph-based lateral movement detection (Neo4j + WireGuard peer graph)
     - ML-based anomaly detection on WireGuard peer traffic (isolation forest, autoencoders)
     - Sigma rules (https://github.com/SigmaHQ/sigma) for portable SIEM detection rules
     - Reference: https://github.com/center-for-threat-informed-defense

  E) HONEYPOT & DECEPTION
     - T-Pot (https://github.com/telekom-security/tpotce) — 20+ honeypot types in one container
     - Canarytokens 2.0 advances: WireGuard canary, Kubernetes secret canary, PDF exfil beacon
     - OpenCanary (https://github.com/thinkst/opencanary) — lightweight, production-grade
     - MITRE ENGAGE deception framework (https://engage.mitre.org)
     - Active deception: dynamically generated fake credentials that alert on first use
     - Breadcrumb trails: fake S3 keys / DB passwords / API tokens planted in fake config files

  F) BLOCKCHAIN & CRYPTOGRAPHIC FORENSICS
     - Flashbots MEV-inspect for on-chain signature extraction (https://github.com/flashbots/mev-inspect-py)
     - Ethereum ECDSA batch analysis using the go-ethereum library
     - Libsecp256k1 in Rust/WASM for browser-side signature math (https://github.com/bitcoin-core/secp256k1)
     - Lattice-based nonce reuse attacks (beyond classic Howgrave-Graham)
     - OpenTimestamps (https://opentimestamps.org) for audit chain timestamping on Bitcoin
     - TheGraph protocol for decentralized on-chain data indexing (https://thegraph.com)
     - Tornado Cash source analysis for privacy pattern research
     - Reference: https://github.com/trezor/blockbook

  G) OBSERVABILITY & INCIDENT RESPONSE
     - OpenTelemetry (https://opentelemetry.io) — unified traces, metrics, logs — replace pino-only
     - Vector.dev (https://vector.dev) for high-performance log pipeline
     - Grafana + Loki + Tempo stack for full observability (open source, self-hostable)
     - Falco (https://falco.org) — runtime security for container/syscall anomaly detection
     - Velociraptor (https://github.com/Velocidex/velociraptor) — endpoint forensics & live response
     - Atomic Red Team (https://github.com/redcanaryco/atomic-red-team) — automated TTP testing

  H) AI/ML SECURITY CAPABILITIES
     - LLM-assisted triage of SIEM events (local Ollama + Llama 3 or Mistral, no cloud dependency)
     - Embedding-based semantic search over audit logs (find "unusual" commands by meaning)
     - Adversarial ML attack detection: detect model poisoning, prompt injection in API inputs
     - RAG (Retrieval-Augmented Generation) over CVE database for real-time vuln correlation
     - AI-powered kill chain prediction: given current SIEM events, predict next attacker step
     - Reference: https://github.com/ollama/ollama

  For EACH technology listed above, provide:
  1. A specific implementation plan for ProxhqVPN
  2. Working starter code or configuration
  3. The GitHub repo or RFC/paper URL
  4. Priority (P0=critical, P1=high, P2=medium)
  5. Which competitor currently has this that ProxhqVPN lacks

SECTION 13 — FULL REFERENCE LIBRARY
  For every technology, protocol, tool, library, paper, or standard mentioned anywhere in this audit, provide a properly formatted reference entry:
  
  Format each reference as:
    [N] Title — URL or RFC number — Brief description (1 sentence)
  
  Minimum 50 references. Organize into categories:
  - Cryptography & PQC
  - Zero Trust & Access Control  
  - VPN & Network Protocols
  - Threat Intelligence & Detection
  - Honeypot & Deception
  - Blockchain & Forensics
  - Observability & IR
  - Compliance & Frameworks
  - Competitor Documentation

SECTION 14 — OFFICIAL AUDIT VERDICT
  Close the report with an official verdict paragraph. State: your overall product rating (out of 10), which market segments ProxhqVPN is best suited for, whether you would recommend it to enterprise security teams, privacy-conscious consumers, and security researchers, and your single most important recommendation for reaching #1 in the industry.

════════════════════════════════════════════════════════════
FORMAT INSTRUCTIONS — READ CAREFULLY
════════════════════════════════════════════════════════════
- Use clear section headers (all caps)
- Use letter grades (A+/A/A−/B+/etc.) and numeric scores where requested
- Use ranking tables in text format using ASCII box-drawing characters
- Be honest about gaps and weaknesses — this is an audit, not marketing
- Include a timestamp and "Audited by ChatGPT" attribution line at the top of your report
- MINIMUM LENGTH: 6,000 words. This is a comprehensive technical audit with code delivery.
- ALL code in Section 11 must be complete, working, and production-ready — no pseudocode, no TODOs, no placeholder comments
- ALL technologies in Section 12 must include a real GitHub URL or RFC number
- ALL references in Section 13 must be real, verifiable URLs
- Use your built-in search capability (if available) to find the most current versions of libraries, RFCs, and papers
- Do NOT disclaim that you "cannot browse the internet" — use your training knowledge to provide accurate references. If you have search capability, use it.
- This report will be published publicly and shown to enterprise clients — make it authoritative, detailed, and actionable.`;

const GROK_PROMPT = CHATGPT_PROMPT.replace(
  /Audited by ChatGPT/g,
  "Audited by Grok"
).replace(
  /Do NOT disclaim that you "cannot browse the internet"/,
  'Do NOT disclaim limitations'
);

const O3_PROMPT = CHATGPT_PROMPT.replace(
  /Audited by ChatGPT/g,
  "Audited by OpenAI o3"
).replace(
  /Do NOT disclaim that you "cannot browse the internet"/,
  'Do NOT disclaim limitations'
);

// ─── Local storage key for persisted audit text ───────────────────────────────
const LS_KEY = "proxhq_ai_audit_results";

interface AuditResults {
  chatgpt: string;
  grok: string;
  o3: string;
}

type AiTab = "chatgpt" | "grok" | "o3";

const AI_TABS: { id: AiTab; label: string; color: string; link: string; active: boolean; prompt: string }[] = [
  {
    id: "chatgpt",
    label: "ChatGPT-4o",
    color: "text-green-400 border-green-500",
    link: "https://chat.openai.com",
    active: true,
    prompt: CHATGPT_PROMPT,
  },
  {
    id: "grok",
    label: "Grok 3",
    color: "text-blue-400 border-blue-500",
    link: "https://x.com/i/grok",
    active: false,
    prompt: GROK_PROMPT,
  },
  {
    id: "o3",
    label: "OpenAI o3",
    color: "text-purple-400 border-purple-500",
    link: "https://chat.openai.com",
    active: false,
    prompt: O3_PROMPT,
  },
];

export default function AiAudit() {
  const [activeTab, setActiveTab] = useState<AiTab>("chatgpt");
  const [results, setResults] = useState<AuditResults>(() => {
    try {
      const stored = localStorage.getItem(LS_KEY);
      return stored ? JSON.parse(stored) : { chatgpt: "", grok: "", o3: "" };
    } catch {
      return { chatgpt: "", grok: "", o3: "" };
    }
  });
  const [copied, setCopied] = useState(false);
  const [promptExpanded, setPromptExpanded] = useState(false);
  const [resultsExpanded, setResultsExpanded] = useState(true);
  const [editing, setEditing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const tab = AI_TABS.find(t => t.id === activeTab)!;
  const currentResult = results[activeTab];

  const handleCopy = async () => {
    await navigator.clipboard.writeText(tab.prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleSaveResult = (text: string) => {
    const next = { ...results, [activeTab]: text };
    setResults(next);
    localStorage.setItem(LS_KEY, JSON.stringify(next));
    setEditing(false);
  };

  return (
    <div className="space-y-6 pb-10">
      <PageSEO
        title="AI Security Audit — ProxhqVPN"
        description="Official AI security audit and competitive analysis of ProxhqVPN by ChatGPT, Grok, and OpenAI o3."
      />

      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="p-2 rounded bg-primary/10 border border-primary/20 shrink-0 mt-0.5">
          <Sparkles className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-bold font-mono text-primary tracking-tight">AI SECURITY AUDIT</h1>
          <p className="text-[11px] font-mono text-primary/60 mt-0.5">
            Official AI-generated competitive audit of ProxhqVPN — architecture, feature completeness, industry ranking, and gap analysis.
            Submit the audit prompt below to ChatGPT, Grok, or OpenAI o3 and paste the results back here for publication.
          </p>
        </div>
      </div>

      {/* Status bar */}
      <div className="grid grid-cols-3 gap-3">
        {AI_TABS.map(t => {
          const hasResult = results[t.id].trim().length > 0;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`border rounded p-3 text-left transition-all ${
                activeTab === t.id
                  ? "bg-primary/10 " + t.color
                  : "border-primary/20 text-primary/50 hover:border-primary/40"
              }`}
            >
              <div className={`text-[10px] font-mono font-bold mb-1 flex items-center gap-1.5 ${activeTab === t.id ? "" : "text-primary/50"}`}>
                <Bot className="w-3 h-3" />
                {t.label}
                {!t.active && <span className="text-[8px] text-primary/30 ml-1">— READY</span>}
              </div>
              <div className="flex items-center gap-1.5">
                <div className={`w-1.5 h-1.5 rounded-full ${hasResult ? "bg-green-400" : "bg-primary/20"}`} />
                <span className="text-[9px] font-mono text-primary/50">
                  {hasResult ? `${results[t.id].split(/\s+/).length.toLocaleString()} words received` : "Awaiting audit"}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* ── Step 1: Prompt ─────────────────────────────────────────────────────── */}
      <div className="border border-primary/20 rounded overflow-hidden">
        <button
          onClick={() => setPromptExpanded(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 bg-primary/5 hover:bg-primary/10 transition-colors"
        >
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-[9px] font-bold font-mono text-primary">1</div>
            <span className="text-[11px] font-mono font-bold text-primary">
              COPY AUDIT PROMPT — {tab.label}
            </span>
            <span className="text-[9px] font-mono text-primary/40">({tab.prompt.split(/\s+/).length.toLocaleString()} words)</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={e => { e.stopPropagation(); handleCopy(); }}
              className={`flex items-center gap-1.5 text-[9px] font-mono px-2.5 py-1 rounded border transition-all ${
                copied
                  ? "bg-green-500/20 border-green-500/40 text-green-400"
                  : "bg-primary/10 border-primary/30 text-primary hover:bg-primary/20"
              }`}
            >
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copied ? "Copied!" : "Copy Prompt"}
            </button>
            {promptExpanded ? <ChevronUp className="w-4 h-4 text-primary/40" /> : <ChevronDown className="w-4 h-4 text-primary/40" />}
          </div>
        </button>

        {promptExpanded && (
          <div className="border-t border-primary/10">
            <pre className="text-[8.5px] font-mono text-primary/75 p-4 overflow-auto max-h-[500px] whitespace-pre-wrap leading-relaxed bg-black/30">
              {tab.prompt}
            </pre>
          </div>
        )}
      </div>

      {/* ── Step 2: Submit ───────────────────────────────────────────────────────── */}
      <div className="border border-primary/20 rounded p-4 bg-primary/5">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-[9px] font-bold font-mono text-primary">2</div>
          <span className="text-[11px] font-mono font-bold text-primary">SUBMIT TO {tab.label.toUpperCase()}</span>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <a
            href={tab.link}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-[9px] font-mono px-3 py-1.5 rounded border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
            Open {tab.label} →
          </a>
          <div className="text-[9px] font-mono text-primary/50">
            Copy the prompt above → paste into {tab.label} → submit → copy the full response → paste below.
          </div>
        </div>
      </div>

      {/* ── Step 3: Paste Results ────────────────────────────────────────────────── */}
      <div className="border border-primary/20 rounded overflow-hidden">
        <button
          onClick={() => setResultsExpanded(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 bg-primary/5 hover:bg-primary/10 transition-colors"
        >
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-[9px] font-bold font-mono text-primary">3</div>
            <span className="text-[11px] font-mono font-bold text-primary">
              {currentResult.trim() ? `AUDIT RESULTS — ${tab.label}` : `PASTE AUDIT RESULTS — ${tab.label}`}
            </span>
            {currentResult.trim() && (
              <span className="flex items-center gap-1 text-[9px] font-mono text-green-400">
                <Check className="w-3 h-3" />
                Published
              </span>
            )}
          </div>
          {resultsExpanded ? <ChevronUp className="w-4 h-4 text-primary/40" /> : <ChevronDown className="w-4 h-4 text-primary/40" />}
        </button>

        {resultsExpanded && (
          <div className="border-t border-primary/10">
            {!currentResult.trim() || editing ? (
              /* ── Paste / Edit mode ── */
              <div className="p-4 space-y-3">
                <p className="text-[9px] font-mono text-primary/50">
                  Paste the full audit response from {tab.label} below. It will be saved locally and displayed here for users to read.
                </p>
                <textarea
                  ref={textareaRef}
                  defaultValue={currentResult}
                  rows={20}
                  placeholder={`Paste the full ${tab.label} audit response here...`}
                  className="w-full bg-black/40 border border-primary/20 rounded p-3 text-[9px] font-mono text-primary/85 placeholder:text-primary/25 focus:outline-none focus:border-primary/50 resize-y leading-relaxed"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      const val = textareaRef.current?.value ?? "";
                      handleSaveResult(val);
                    }}
                    className="text-[9px] font-mono px-3 py-1.5 rounded border border-green-500/40 bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors"
                  >
                    Save & Publish
                  </button>
                  {editing && (
                    <button
                      onClick={() => setEditing(false)}
                      className="text-[9px] font-mono px-3 py-1.5 rounded border border-primary/20 text-primary/50 hover:bg-primary/10 transition-colors"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            ) : (
              /* ── Published audit display ── */
              <div>
                {/* Audit header badge */}
                <div className="px-4 py-2 bg-black/30 border-b border-primary/10 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bot className="w-3.5 h-3.5 text-primary" />
                    <span className="text-[9px] font-mono text-primary/70">
                      Official audit by <span className="text-primary font-bold">{tab.label}</span>
                    </span>
                    <span className="text-[9px] font-mono text-primary/30">·</span>
                    <span className="text-[9px] font-mono text-primary/40">{currentResult.split(/\s+/).length.toLocaleString()} words</span>
                  </div>
                  <button
                    onClick={() => setEditing(true)}
                    className="text-[8px] font-mono text-primary/30 hover:text-primary/60 transition-colors"
                  >
                    Edit
                  </button>
                </div>

                {/* Scrollable audit text */}
                <div className="overflow-y-auto max-h-[700px] p-4 bg-black/20">
                  <pre className="text-[9px] font-mono text-primary/85 whitespace-pre-wrap leading-relaxed">
                    {currentResult}
                  </pre>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Summary cards when audit is present ─────────────────────────────────── */}
      {currentResult.trim() && (
        <div className="grid grid-cols-2 gap-3">
          <div className="border border-green-900/40 rounded p-3 bg-green-950/20">
            <div className="flex items-center gap-1.5 mb-1">
              <Trophy className="w-3.5 h-3.5 text-green-400" />
              <span className="text-[10px] font-mono font-bold text-green-400">STRENGTHS</span>
            </div>
            <p className="text-[9px] font-mono text-primary/60">Review the audit above — Section 4 covers areas where ProxhqVPN leads the industry.</p>
          </div>
          <div className="border border-orange-900/40 rounded p-3 bg-orange-950/20">
            <div className="flex items-center gap-1.5 mb-1">
              <AlertTriangle className="w-3.5 h-3.5 text-orange-400" />
              <span className="text-[10px] font-mono font-bold text-orange-400">GAPS & FIXES</span>
            </div>
            <p className="text-[9px] font-mono text-primary/60">Review Section 11 (Recommendations) in the audit above for prioritized improvement actions.</p>
          </div>
          <div className="border border-blue-900/40 rounded p-3 bg-blue-950/20">
            <div className="flex items-center gap-1.5 mb-1">
              <BarChart2 className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-[10px] font-mono font-bold text-blue-400">COMPETITIVE RANK</span>
            </div>
            <p className="text-[9px] font-mono text-primary/60">Section 10 contains the full ranking table vs. NordVPN, Mullvad, Tailscale, Cloudflare, and others.</p>
          </div>
          <div className="border border-primary/20 rounded p-3 bg-primary/5">
            <div className="flex items-center gap-1.5 mb-1">
              <Shield className="w-3.5 h-3.5 text-primary" />
              <span className="text-[10px] font-mono font-bold text-primary">SECURITY GRADE</span>
            </div>
            <p className="text-[9px] font-mono text-primary/60">Section 2 provides per-layer security grades and an overall security score.</p>
          </div>
        </div>
      )}

      {/* ── Coming Soon tabs note ─────────────────────────────────────────────── */}
      <div className="border border-primary/10 rounded p-3 bg-primary/3">
        <p className="text-[9px] font-mono text-primary/40">
          <span className="text-primary/60 font-bold">Grok 3</span> and <span className="text-primary/60 font-bold">OpenAI o3</span> audit prompts are ready. Switch tabs above to copy their prompts and paste results once the ChatGPT audit is complete. Cross-AI comparison and consensus ranking will be available once all three audits are received.
        </p>
      </div>
    </div>
  );
}
