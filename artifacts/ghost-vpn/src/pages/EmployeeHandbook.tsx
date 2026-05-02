// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useState } from "react";
import { usePersistedState } from "@/hooks/usePersistedState";
import { PageSEO } from "@/components/PageSEO";
import {
  Users, ChevronRight, Shield, Terminal, Database,
  BookOpen, AlertCircle, CheckCircle, Lock,
  Info, Activity, Server, Zap, Eye, Globe,
  Copy, FileText, Settings, Bell,
} from "lucide-react";

function CB({ children, label }: { children: string; label?: string }) {
  return (
    <div className="my-2">
      {label && <div className="text-[8px] text-primary/30 font-mono uppercase tracking-widest mb-1">{label}</div>}
      <pre className="relative group font-mono text-[10px] bg-black border border-primary/15 rounded p-3 text-green-400/80 overflow-x-auto whitespace-pre-wrap leading-relaxed">
        {children}
        <button onClick={() => navigator.clipboard.writeText(children)}
          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-primary/30 hover:text-primary">
          <Copy className="w-3 h-3" />
        </button>
      </pre>
    </div>
  );
}

function Note({ children, type = "info" }: { children: React.ReactNode; type?: "info" | "warn" | "danger" | "success" }) {
  const s: Record<string, string> = {
    info:    "border-blue-500/20 bg-blue-900/10 text-blue-400/80",
    warn:    "border-yellow-500/20 bg-yellow-900/10 text-yellow-400/80",
    danger:  "border-red-500/20 bg-red-900/10 text-red-400/80",
    success: "border-green-500/20 bg-green-900/10 text-green-400/80",
  };
  const icons: Record<string, React.ElementType> = { info: Info, warn: AlertCircle, danger: AlertCircle, success: CheckCircle };
  const Icon = icons[type];
  return (
    <div className={`flex items-start gap-2 text-[9px] font-mono border rounded px-3 py-2 my-2 ${s[type]}`}>
      <Icon className="w-3 h-3 mt-0.5 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

interface Section { id: string; title: string; icon: React.ElementType; content: React.ReactNode }

const SECTIONS: Section[] = [
  {
    id: "welcome", title: "Welcome & Employee Overview", icon: Users,
    content: (
      <div className="space-y-3">
        <p>Welcome to <strong>ALPHA UNLIMITED TECHNOLOGIES LLC</strong>. This handbook covers your access rights, responsibilities, system usage policies, and operational procedures for the ProxhqVPN platform.</p>
        <p>As an employee, your account is granted <strong>full Command Center Pro access</strong> automatically — no subscription required. Your access is linked to your registered email address and is activated the first time you sign in.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
          {[
            { t: "Full Platform Access", d: "Access to all VPN features, Command Center tools, terminal, database interface, and admin reports." },
            { t: "Ambassador Auto-Enrollment", d: "If your employee profile has a promo code assigned, an ambassador account is automatically created for you." },
            { t: "Audit-Logged Sessions", d: "All terminal commands, database queries, and admin actions are logged with timestamps in the audit trail." },
            { t: "No Data Retention of Customer PII", d: "Employees do not have access to customer passwords, payment card data, or Clerk internal user tokens." },
          ].map(({ t, d }) => (
            <div key={t} className="border border-primary/15 rounded p-3">
              <div className="text-[10px] font-mono font-bold text-primary mb-0.5">{t}</div>
              <div className="text-[9px] text-primary/83 font-mono">{d}</div>
            </div>
          ))}
        </div>
        <Note type="success">Employee access is reviewed quarterly. Keep your registered email address current — access is tied to it, not your name.</Note>
      </div>
    ),
  },
  {
    id: "access", title: "Platform Access & Permissions", icon: Lock,
    content: (
      <div className="space-y-3">
        <p>Employee accounts receive <strong>Command Center Pro-level access</strong> by default. This includes all tools available to paid subscribers plus the ability to view platform health metrics.</p>
        <h4 className="font-bold text-primary text-[11px]">Access Tiers</h4>
        <div className="space-y-2">
          {[
            { tier: "Standard Employee", access: "All VPN features, Command Center Pro tools, system monitor view. Cannot manage users, edit firewall rules, or access the database directly.", color: "text-primary/80" },
            { tier: "Employee + Ambassador", access: "Everything above, plus an auto-created ambassador profile with your assigned promo code and the Ambassador Dashboard.", color: "text-primary/80" },
            { tier: "Admin", access: "Full access including employee management, terminal (rate-limited), direct SQL interface, daemon download, setup scripts, and SilkWeb honeypot control.", color: "text-yellow-400/80" },
          ].map(({ tier, access, color }) => (
            <div key={tier} className="border border-primary/10 rounded px-3 py-2">
              <div className={`text-[10px] font-mono font-bold ${color} mb-0.5`}>{tier}</div>
              <div className="text-[9px] font-mono text-primary/83">{access}</div>
            </div>
          ))}
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-3">How Access is Granted</h4>
        <ol className="space-y-1.5 text-[10px] font-mono text-primary/83">
          <li><span className="text-primary/30">1.</span> Admin adds your email to the Employees list (Admin → Employee Access).</li>
          <li><span className="text-primary/30">2.</span> You sign in with that email via Clerk (Google SSO or email+password).</li>
          <li><span className="text-primary/30">3.</span> The system detects your employee record and activates access. No manual steps needed.</li>
          <li><span className="text-primary/30">4.</span> If you are an ambassador employee, your ambassador profile is created automatically on first sign-in.</li>
        </ol>
        <Note type="warn">Never share your account credentials. If you suspect unauthorized access, change your password immediately and notify the admin.</Note>
      </div>
    ),
  },
  {
    id: "dashboard", title: "Admin Dashboard Overview", icon: Activity,
    content: (
      <div className="space-y-3">
        <p>The <strong>Admin Dashboard</strong> (<code>/dashboard</code>) provides a real-time overview of the ProxhqVPN platform health, subscription metrics, and threat status.</p>
        <h4 className="font-bold text-primary text-[11px]">Key Metrics Displayed</h4>
        <div className="space-y-2">
          {[
            { t: "Active Subscriptions", d: "Total paying subscribers by plan (VPN Basic vs Command Center Pro), broken down by monthly vs annual billing." },
            { t: "VPN Node Status", d: "Live status of all registered VPN nodes — online/offline, peer count, CPU load, bandwidth." },
            { t: "Revenue Summary", d: "Monthly recurring revenue (MRR) and annual revenue pulled from Stripe." },
            { t: "Threat Monitor", d: "Real-time count of intrusion alerts, honeypot hits, and blocked IPs from the last 24 hours." },
            { t: "Ambassador Program", d: "Total active ambassadors, referral count, and commissions paid this month." },
          ].map(({ t, d }) => (
            <div key={t} className="border border-primary/10 rounded px-3 py-2">
              <div className="text-[10px] font-mono font-bold text-primary">{t}</div>
              <div className="text-[9px] font-mono text-primary/83 mt-0.5">{d}</div>
            </div>
          ))}
        </div>
        <Note type="info">Dashboard metrics refresh every 60 seconds automatically. For real-time monitoring, use the System Monitor page (<code>/monitor</code>).</Note>
      </div>
    ),
  },
  {
    id: "nodes", title: "VPN Server Management", icon: Server,
    content: (
      <div className="space-y-3">
        <p>VPN Servers are managed from the <strong>Nodes</strong> page (<code>/nodes</code>). This is an admin-only section. Regular employees can view node status on the Dashboard but cannot add or remove servers.</p>
        <h4 className="font-bold text-primary text-[11px]">Adding a New VPN Server</h4>
        <ol className="space-y-1.5 text-[10px] font-mono text-primary/83">
          <li><span className="text-primary/30">1.</span> Provision a VPS from any cloud provider (Vultr, DigitalOcean, Linode, Hetzner recommended). Minimum: 1 CPU, 512 MB RAM, Ubuntu 22.04.</li>
          <li><span className="text-primary/30">2.</span> In VPN Servers → click <strong>Add Server</strong> → enter region and optional label.</li>
          <li><span className="text-primary/30">3.</span> Click <strong>Get Setup Script</strong> — a bash script is generated with your platform's PSK embedded.</li>
          <li><span className="text-primary/30">4.</span> SSH into the new VPS as root and run the script.</li>
          <li><span className="text-primary/30">5.</span> The node registers itself and appears as Online within 60 seconds.</li>
        </ol>
        <CB label="example: run setup script on new vps">{`ssh root@YOUR_VPS_IP
# Paste and run the setup script generated from VPN Servers page`}</CB>
        <h4 className="font-bold text-primary text-[11px] mt-3">Node Maintenance</h4>
        <div className="space-y-1.5 text-[10px] font-mono text-primary/83">
          <div>• <strong>Monthly</strong>: Check node uptime and peer count. Replace any node offline for more than 24 hours.</div>
          <div>• <strong>Quarterly</strong>: Update WireGuard and system packages on each node via the Terminal page.</div>
          <div>• <strong>On compromise</strong>: Immediately disable the node, rotate all keys, provision a replacement.</div>
        </div>
      </div>
    ),
  },
  {
    id: "terminal", title: "Remote Terminal Usage", icon: Terminal,
    content: (
      <div className="space-y-3">
        <p>The <strong>Terminal</strong> page (<code>/terminal</code>) provides a web-based shell for executing commands on the ProxhqVPN infrastructure. Access is admin-only and rate-limited to 20 commands/minute. Every command is logged in the audit trail.</p>
        <Note type="danger">The Terminal runs commands on live infrastructure. Test in staging first. A wrong command can bring down the VPN for all connected users. When in doubt, ask before running.</Note>
        <h4 className="font-bold text-primary text-[11px]">Authorized Use Cases</h4>
        <div className="space-y-1.5 text-[10px] font-mono text-primary/83">
          <div>• Checking WireGuard peer status and handshake times</div>
          <div>• Restarting the WireGuard service after a config change</div>
          <div>• Viewing system resource usage (CPU, RAM, disk)</div>
          <div>• Updating packages on a node</div>
          <div>• Diagnosing connectivity issues</div>
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-3">Prohibited Commands</h4>
        <div className="space-y-1.5 text-[10px] font-mono text-red-400/80">
          {["rm -rf / or any recursive force delete", "iptables -F (flush all firewall rules)", "Stopping wg-quick@wg0 without a restart plan", "Installing unreviewed third-party software", "Exporting or transmitting customer data"].map(c => (
            <div key={c} className="flex items-start gap-2"><AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />{c}</div>
          ))}
        </div>
        <CB label="safe diagnostic commands">{`wg show                         # WireGuard status
journalctl -u wg-quick@wg0 -n 50  # Recent logs
systemctl status proxhqd        # Daemon status
df -h && free -m                # Disk and RAM
ss -tupn | grep LISTEN          # Listening ports`}</CB>
      </div>
    ),
  },
  {
    id: "security", title: "Security Procedures", icon: Shield,
    content: (
      <div className="space-y-3">
        <p>ProxhqVPN handles customer privacy data. All employees must follow these security procedures at all times.</p>
        <h4 className="font-bold text-primary text-[11px]">Mandatory Security Practices</h4>
        <div className="space-y-2">
          {[
            { t: "Use 2FA on your Clerk account", d: "Enable two-factor authentication in your Clerk account settings. An account without 2FA is a violation of our security policy." },
            { t: "Never exfiltrate customer data", d: "Do not copy, download, or export customer email addresses, subscription data, or account IDs outside the platform." },
            { t: "Report incidents immediately", d: "If you suspect a breach, unauthorized access, or data exposure — stop what you're doing and contact the admin immediately. Do not attempt to fix it silently." },
            { t: "Lock screen policy", d: "Lock your screen whenever you step away from your computer (Win+L / Cmd+Ctrl+Q). Do not leave admin sessions open unattended." },
            { t: "Audit trail review", d: "Admin accounts should review the terminal and SQL audit logs weekly for unauthorized access patterns." },
          ].map(({ t, d }) => (
            <div key={t} className="border border-primary/10 rounded px-3 py-2">
              <div className="text-[10px] font-mono font-bold text-primary">{t}</div>
              <div className="text-[9px] font-mono text-primary/83 mt-0.5">{d}</div>
            </div>
          ))}
        </div>
        <Note type="danger">Unauthorized access to customer data, deliberate sabotage, or sharing admin credentials is grounds for immediate termination and may result in criminal prosecution under the Computer Fraud and Abuse Act (CFAA) and similar laws.</Note>
      </div>
    ),
  },
  {
    id: "support", title: "Customer Support Guidelines", icon: BookOpen,
    content: (
      <div className="space-y-3">
        <p>Employees may be asked to assist with customer support. Follow these guidelines to ensure consistent, professional responses.</p>
        <h4 className="font-bold text-primary text-[11px]">Support Tiers</h4>
        <div className="space-y-2">
          {[
            { t: "Tier 1 — Self-Service", d: "Refer customers to the User Guide (/guide) and Downloads page (/downloads) for setup issues. Most issues are solved by following the platform-specific setup steps." },
            { t: "Tier 2 — Account Issues", d: "Subscription problems, billing disputes, and access issues. Use the Admin Dashboard to verify subscription status. Billing disputes go through Stripe." },
            { t: "Tier 3 — Technical Escalation", d: "Server outages, WireGuard connectivity failures, security incidents. Escalate to admin immediately with full logs." },
          ].map(({ t, d }) => (
            <div key={t} className="border border-primary/10 rounded px-3 py-2">
              <div className="text-[10px] font-mono font-bold text-primary">{t}</div>
              <div className="text-[9px] font-mono text-primary/83 mt-0.5">{d}</div>
            </div>
          ))}
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-3">Support Response Standards</h4>
        <div className="space-y-1.5 text-[10px] font-mono text-primary/83">
          <div>• Respond to support emails within <strong>24 hours</strong> on business days.</div>
          <div>• Always confirm the customer's subscription status before troubleshooting — unsubscribed users should be directed to <code>/pricing</code>.</div>
          <div>• Do not speculate or make promises about future features. Escalate feature requests to admin.</div>
          <div>• For refunds: direct customers to support@proxhqvpn.com — employees cannot initiate refunds directly.</div>
        </div>
        <Note type="info">The ProxhqVPN support email is support@proxhqvpn.com. Ambassador-specific issues go to ambassadors@proxhqvpn.com.</Note>
      </div>
    ),
  },
  {
    id: "silkweb", title: "SilkWeb Honeypot Operations", icon: Eye,
    content: (
      <div className="space-y-3">
        <p>The <strong>SilkWeb honeypot</strong> (<code>/silkweb</code>) is one of ProxhqVPN's most sophisticated security systems. It runs decoy services that attract, log, and fingerprint attackers.</p>
        <h4 className="font-bold text-primary text-[11px]">What SilkWeb Does</h4>
        <div className="space-y-1.5 text-[10px] font-mono text-primary/83">
          <div>• Runs fake SSH, HTTP, MySQL, Redis, and MongoDB services on commonly scanned ports.</div>
          <div>• Logs every connection attempt, command, and payload from attackers.</div>
          <div>• Automatically blocklists attacker IPs across all nodes via the firewall.</div>
          <div>• Optionally counter-scans attackers (via Tor, admin-only) to identify their infrastructure.</div>
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-3">Daily SilkWeb Review</h4>
        <ol className="space-y-1.5 text-[10px] font-mono text-primary/83">
          <li><span className="text-primary/30">1.</span> Open <strong>Threat Monitor</strong> (<code>/beacons</code>) — review new alerts from the last 24 hours.</li>
          <li><span className="text-primary/30">2.</span> For each new alert: classify as <strong>Dismiss</strong> (false positive), <strong>Block</strong> (add to firewall), or <strong>Investigate</strong>.</li>
          <li><span className="text-primary/30">3.</span> IPs already auto-blocked by SilkWeb appear pre-marked — review and confirm.</li>
          <li><span className="text-primary/30">4.</span> For persistent attackers (3+ hits): escalate to admin for Tor-based counter-scan.</li>
        </ol>
        <Note type="warn">Counter-scanning is legally sensitive. Only do this with explicit admin approval and only on IPs that attacked ProxhqVPN infrastructure. Never scan random IPs.</Note>
      </div>
    ),
  },
  {
    id: "tools", title: "Command Center Tools Reference", icon: Zap,
    content: (
      <div className="space-y-3">
        <p>All employees have full Command Center Pro access. Here is a quick reference for the developer security tools.</p>
        <h4 className="font-bold text-primary text-[11px]">Offensive Tools</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[
            { tool: "Alpha Toolkit", path: "/alpha-tools", desc: "Universal scanner (35+ languages, 200+ vuln patterns), vulnerability verifier, and web scraper. All Tor-routable." },
            { tool: "Vulnerability Scanner", path: "/sqlmap", desc: "Full SQLMap integration for automated SQL injection testing across all DBMS types. Tamper scripts + Tor routing." },
            { tool: "HTTP Probe", path: "/http-probe", desc: "Craft raw HTTP requests. Inspect full responses. Equivalent to Burp Suite Repeater." },
            { tool: "Directory Fuzzer", path: "/dir-fuzzer", desc: "Brute-force hidden endpoints, admin panels, backup files, .git, .env. Equivalent to ffuf/gobuster." },
            { tool: "Subdomain Scout", path: "/subdomain-scan", desc: "Certificate transparency log enumeration + DNS brute-force subdomain discovery." },
            { tool: "Intruder", path: "/intruder", desc: "Automated parameter fuzzer — Sniper, Battering Ram, Pitchfork, Cluster Bomb modes (Burp Intruder equivalent)." },
            { tool: "Payload Generator", path: "/payloads", desc: "Pre-built payloads: SQLi, XSS, SSTI, SSRF, XXE, RCE, Path Traversal, Command Injection, WAF bypass, JWT secrets." },
            { tool: "Ghost Chain Arsenal", path: "/ghost-chain", desc: "200+ categorized exploits with Details tab (CVEs, technique explanation) and PoC code tab. Integrates with HTTP Probe and Intruder." },
            { tool: "Exploit Importer", path: "/exploit-import", desc: "Upload Nessus/Burp/ZAP/Nikto/OpenVAS reports. Auto-extracts findings, CVE IDs, severity. Three result tabs: Details · Instructions · PoC Code. Download Full Report as .md." },
            { tool: "OSINT Recon", path: "/osint-recon", desc: "Aggregates 15+ passive intel sources: Shodan, Censys, AbuseIPDB, VirusTotal, GreyNoise, WHOIS, DNSDumpster, crt.sh, HaveIBeenPwned. All VPN-routed." },
            { tool: "GPS Spoofing", path: "/gps-spoof", desc: "Fake your GPS coordinates at the VPN tunnel level. Bypass geo-restricted apps, spoof device location for testing, and mask real physical position." },
            { tool: "OAST Tester", path: "/oast-tester", desc: "Out-of-band application security testing via interactsh. Generate DNS/HTTP/SMTP callback payloads and monitor live hits for blind SSRF, XXE, and injection detection." },
            { tool: "Token Sequencer", path: "/token-seq", desc: "Capture and analyze session tokens for entropy weakness. Perform statistical analysis and attempt prediction attacks on low-entropy token generators." },
            { tool: "WebSocket Tester", path: "/ws-tester", desc: "Connect, intercept, replay, and fuzz WebSocket frames. Equivalent to Burp Suite WebSocket testing. Supports ws:// and wss:// with auth header injection." },
            { tool: "Dependency Scanner", path: "/dep-scanner", desc: "Scan any project directory or package manifest (npm/pip/cargo/go/maven/composer) for known CVEs. Severity-ranked results with remediation guidance." },
          ].map(({ tool, path, desc }) => (
            <div key={tool} className="border border-primary/10 rounded px-2.5 py-2">
              <div className="flex items-center justify-between mb-0.5">
                <div className="text-[10px] font-mono font-bold text-primary">{tool}</div>
                <code className="text-[8px] text-primary/40">{path}</code>
              </div>
              <div className="text-[9px] font-mono text-primary/83">{desc}</div>
            </div>
          ))}
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-3">Defensive / Intelligence Tools</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[
            { tool: "SilkWeb Honeypot", path: "/silkweb", desc: "Deploy decoy services (SSH, HTTP, FTP, RDP). Captures attacker IPs and payloads. Integrates with SIEM." },
            { tool: "Firewall Manager", path: "/firewall", desc: "iptables/nftables rules across all VPN nodes. Block IPs, ports, and protocols with live rule editor." },
            { tool: "Threat Monitor", path: "/beacons", desc: "Real-time intrusion alert stream from all nodes + SilkWeb honeypot hits. Beacon-based persistent monitoring." },
            { tool: "SIEM", path: "/siem", desc: "Unified security event log: WireGuard events, SilkWeb hits, firewall blocks, DNS sinkhole, auth failures. Filter + export CSV/JSON. Alert rules." },
            { tool: "Canary Tokens", path: "/canary-tokens", desc: "Generate invisible tripwires: HTTP URL, DNS, PDF/DOCX, email pixel, fake AWS key, SQL canary row. Alerts on access with IP, GeoIP, browser." },
            { tool: "Threat Intelligence", path: "/threat-intel", desc: "IP reputation (AbuseIPDB/Shodan/GreyNoise), WHOIS, TLS cert inspector, HTTP headers analyzer, live threat feeds." },
            { tool: "CVE Lookup", path: "/cve-search", desc: "Search NVD database by CVE ID or keyword. CVSS score filtering. Critical/High/Medium/Low severity breakdown." },
            { tool: "Security Audit", path: "/security-audit", desc: "Self-audit of ProxhqVPN platform — TLS grade, open ports, WireGuard key strength, firewall rules, CORS, CSP headers." },
            { tool: "Encoder / Decoder", path: "/encoder", desc: "Base64, URL, HTML entity, hex, MD5/SHA-256/SHA-512, HMAC, bcrypt, JWT decode, auto-detect mode." },
            { tool: "Request Comparer", path: "/comparer", desc: "Side-by-side diff of two HTTP requests/responses — Words, Lines, Bytes. Useful for auth bypass and IDOR verification." },
            { tool: "Port Forwarding", path: "/port-forward", desc: "Securely expose internal services through the VPN tunnel. Configure per-device rules, TCP/UDP, and port mapping for remote access and penetration testing environments." },
            { tool: "Dedicated IP", path: "/dedicated-ip", desc: "Assign a static VPN exit IP to your account. Useful for whitelisting in firewalls, maintaining session persistence, and consistent identity in testing engagements." },
            { tool: "Meshnet", path: "/meshnet", desc: "Encrypted peer-to-peer device mesh. Connect all team devices into a private overlay network for secure internal communication without routing through external servers." },
            { tool: "Data Broker Opt-Out", path: "/data-broker", desc: "Remove employee and operator personal data from 180+ data broker databases. Automated submission and status tracking for each broker request." },
            { tool: "SAST Scanner", path: "/sast", desc: "Static application security testing for ProxhqVPN platform code. Identifies vulnerabilities in-repo: hardcoded secrets, injection sinks, insecure dependencies, CORS misconfigurations." },
          ].map(({ tool, path, desc }) => (
            <div key={tool} className="border border-primary/10 rounded px-2.5 py-2">
              <div className="flex items-center justify-between mb-0.5">
                <div className="text-[10px] font-mono font-bold text-primary">{tool}</div>
                <code className="text-[8px] text-primary/40">{path}</code>
              </div>
              <div className="text-[9px] font-mono text-primary/83">{desc}</div>
            </div>
          ))}
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-3">Exploit Importer — Instructions Tab Detail</h4>
        <p className="text-[10px] font-mono text-primary/83">The Exploit Importer's <strong>Instructions Tab</strong> (on each result card) provides a built-in educational guide for every detected vulnerability type. Each guide includes:</p>
        <div className="space-y-1 text-[10px] font-mono text-primary/83 ml-2">
          <div>• <strong>Impact Assessment</strong> — what the vulnerability enables an attacker to do</div>
          <div>• <strong>Tools Required</strong> — exact apt/brew/pip install commands for every tool needed</div>
          <div>• <strong>Prerequisites</strong> — what access or recon must be in place before beginning</div>
          <div>• <strong>Step-by-Step Walkthrough</strong> — numbered commands that work directly in a terminal</div>
          <div>• <strong>How to Verify</strong> — what output confirms the exploit worked</div>
          <div>• <strong>Remediation</strong> — corrected code examples showing the vulnerable vs. safe pattern</div>
          <div>• <strong>References</strong> — PortSwigger, OWASP, NVD links for deeper research</div>
        </div>
        <p className="text-[10px] font-mono text-primary/83 mt-2">Click <strong>Download Full Report</strong> in the results header to export a complete <code>.md</code> file covering all findings — including full guides for each vulnerability type. Use this for client deliverables and internal documentation.</p>
        <Note type="danger">All Command Center tools are for authorized testing only. Never use them against targets you do not own or have explicit written permission to test. Unauthorized use is illegal under the CFAA and Computer Misuse Act.</Note>
      </div>
    ),
  },
  {
    id: "social-breach", title: "Social & Game Breach Tester", icon: Shield,
    content: (
      <div className="space-y-3">
        <p>The Social & Game Account Breach Tester is a Command Center Pro feature that provides an authenticated proxy browser for auditing account security across 80+ platforms. All traffic is VPN-routed.</p>
        <Note type="danger">This tool is for authorized testing only. Employees must only use it against accounts they own or have explicit written permission to audit. Unauthorized credential testing violates the CFAA and is grounds for immediate termination.</Note>
        <h4 className="font-bold text-primary text-[11px]">Platform Coverage</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[
            { cat: "Social Media", count: "35+ platforms", ex: "Instagram, Discord, GitHub, Reddit, Twitter/X, Telegram, LinkedIn" },
            { cat: "Gaming Launchers", count: "10+ platforms", ex: "Steam (RSA login), Epic Games, Blizzard, GOG, Ubisoft, EA/Origin" },
            { cat: "Game Titles", count: "15+ games", ex: "Roblox, Fortnite, Valorant, League of Legends, Apex Legends, GTA" },
            { cat: "Legacy Platforms", count: "10+ platforms", ex: "Xbox Live, PlayStation, Nintendo, 2K, Konami, Sega" },
          ].map(({ cat, count, ex }) => (
            <div key={cat} className="border border-primary/10 rounded px-2.5 py-2">
              <div className="flex items-center justify-between mb-0.5">
                <div className="text-[10px] font-mono font-bold text-primary">{cat}</div>
                <code className="text-[8px] text-primary/40">{count}</code>
              </div>
              <div className="text-[9px] font-mono text-primary/83">{ex}</div>
            </div>
          ))}
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-3">Login Strategies</h4>
        <div className="space-y-1.5 text-[10px] font-mono text-primary/83">
          <div>• <strong>Auto (API-based)</strong> — Discord, Steam (with RSA decryption), Reddit, GitHub, Roblox, Twitch, Instagram, Epic, GOG. Credentials are sent to the platform API and session cookies returned automatically.</div>
          <div>• <strong>Manual (proxy browser)</strong> — All other platforms. The real platform login page is loaded in the embedded proxy browser, credentials are entered normally, and the resulting session is captured.</div>
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-3">Session Management</h4>
        <div className="space-y-1.5 text-[10px] font-mono text-primary/83">
          <div>• Sessions are stored in-memory on the API server with a 4-hour TTL from last activity.</div>
          <div>• The proxy browser injects session cookies automatically into all page loads.</div>
          <div>• Navigation history is tracked with Back/Forward controls and persistent state across sidebar navigation.</div>
          <div>• Sessions can be manually terminated from the Active Sessions panel in the tool.</div>
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-3">Security Hardening</h4>
        <div className="space-y-1.5 text-[10px] font-mono text-primary/83">
          <div>• <strong>SSRF Protection</strong>: All proxy URLs are validated to block private IP ranges (10.x, 192.168.x, 172.16-31.x, 127.x, 169.254.x) and internal hostnames (.local, .internal, localhost, GCP/AWS metadata).</div>
          <div>• <strong>Rate Limiting</strong>: 40 requests/minute per IP on all /api/social-account endpoints.</div>
          <div>• <strong>HTTP/HTTPS only</strong>: Other protocols are rejected at the proxy layer.</div>
        </div>
      </div>
    ),
  },
  {
    id: "bug-bounty", title: "Bug Bounty Research Hub", icon: Shield,
    content: (
      <div className="space-y-3">
        <p>The Bug Bounty Research Hub is a Command Center Pro tool providing a reference center and tooling integration for authorized security research across 19 major gaming, social, and developer platform bug bounty programs.</p>
        <Note type="warn">Employees using the Bug Bounty Hub for personal research must register with the applicable bug bounty platform before any testing. Do not mix work tasks with personal bug bounty activity.</Note>
        <h4 className="font-bold text-primary text-[11px]">Program Coverage</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[
            { program: "PlayStation / Sony", platform: "HackerOne", max: "$50,000" },
            { program: "Xbox / Microsoft (MSRC)", platform: "MSRC", max: "$60,000" },
            { program: "Meta (FB/IG/WA)", platform: "Meta Whitehat", max: "$750,000" },
            { program: "Google / YouTube", platform: "Google VRP", max: "$500,000" },
            { program: "Epic Games", platform: "HackerOne", max: "$20,000" },
            { program: "Steam / Valve", platform: "HackerOne", max: "$30,000" },
            { program: "GitHub", platform: "HackerOne", max: "$30,000" },
            { program: "Discord", platform: "HackerOne", max: "$10,000" },
          ].map(({ program, platform, max }) => (
            <div key={program} className="border border-primary/10 rounded px-2.5 py-2">
              <div className="flex items-center justify-between mb-0.5">
                <div className="text-[10px] font-mono font-bold text-primary">{program}</div>
                <code className="text-[8px] text-green-400">{max}</code>
              </div>
              <div className="text-[9px] font-mono text-primary/83">{platform}</div>
            </div>
          ))}
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-3">Hub Features</h4>
        <div className="space-y-1.5 text-[10px] font-mono text-primary/83">
          <div>• <strong>Program Cards</strong> — Scope, payout table, testing methodology, and link to the official program page for each of 19 programs.</div>
          <div>• <strong>OmniStrike Integration</strong> — "Launch in OmniStrike" button opens OmniStrike pre-configured for the program's target domain.</div>
          <div>• <strong>Report Generator</strong> — Fills in a standard HackerOne-format vulnerability disclosure report. Select severity, enter details, copy with one click.</div>
          <div>• <strong>Platform Filters</strong> — Filter programs by platform (HackerOne, Bugcrowd, MSRC, Google VRP, Intigriti) and payout range.</div>
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-3">Employee Policy on Bug Bounty</h4>
        <div className="space-y-1.5 text-[10px] font-mono text-primary/83">
          <div>• Personal bug bounty research is permitted on personal time using personal equipment.</div>
          <div>• Never use company infrastructure (servers, VPN nodes) for personal bug bounty research without approval.</div>
          <div>• Any findings affecting ProxhqVPN platform itself must be reported to security@proxhqvpn.com immediately, not to an external bounty platform.</div>
        </div>
      </div>
    ),
  },
  {
    id: "manuals", title: "Manuals & Documentation", icon: Shield,
    content: (
      <div className="space-y-3">
        <p>The ProxhqVPN Manuals page (<code>/manuals</code>) provides downloadable plain-text documentation for every platform feature. It is accessible to all active subscribers (VPN Basic and above).</p>
        <h4 className="font-bold text-primary text-[11px]">Available Manuals</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[
            { title: "Getting Started Guide", tier: "All Plans", desc: "Installation, first connection, WireGuard config, Kill Switch, DNS, devices." },
            { title: "WireGuard Advanced Config", tier: "All Plans", desc: "Split tunneling, double-hop, obfuscation, router setup, SmartDNS." },
            { title: "OmniStrike Suite", tier: "Pro", desc: "All 13 attack modules, orchestration modes, post-exploitation, stealth." },
            { title: "WAF Analyzer", tier: "Pro", desc: "WAF detection, bypass testing suite, 25+ vendor signatures." },
            { title: "Social & Game Breach Tester", tier: "Pro", desc: "Platform coverage, login strategies, session management, SSRF protection." },
            { title: "Bug Bounty Research Hub", tier: "Pro", desc: "19 programs, testing methodology, report generator, best practices." },
            { title: "OSINT Recon Engine", tier: "Pro", desc: "15+ intelligence sources, recon methodology, bug bounty integration." },
            { title: "Canary Token Generator", tier: "Pro", desc: "Token types, deployment strategies, forensic data, use cases." },
            { title: "SIEM Security Event Log", tier: "Pro", desc: "Event sources, filtering, correlation, export and reporting." },
            { title: "Employee Procedures", tier: "All Plans", desc: "Admin tools, node management, incident response, escalation paths." },
            { title: "VPN Privacy Suite Tools", tier: "All Plans", desc: "GPS Spoofing, Port Forwarding, Dedicated IP, Meshnet, Data Broker Opt-Out — setup and usage." },
            { title: "Dev Security Tools v2", tier: "Pro", desc: "OAST Tester, Dependency Scanner, Token Sequencer, WebSocket Tester, SAST Scanner — complete reference." },
          ].map(({ title, tier, desc }) => (
            <div key={title} className="border border-primary/10 rounded px-2.5 py-2">
              <div className="flex items-center justify-between mb-0.5">
                <div className="text-[10px] font-mono font-bold text-primary">{title}</div>
                <code className={`text-[8px] ${tier === "Pro" ? "text-red-400" : "text-green-400"}`}>{tier}</code>
              </div>
              <div className="text-[9px] font-mono text-primary/83">{desc}</div>
            </div>
          ))}
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-3">Subscriber Access</h4>
        <div className="space-y-1.5 text-[10px] font-mono text-primary/83">
          <div>• All manuals are accessible to VPN Basic subscribers and above.</div>
          <div>• The page is gated by <code>ToolLayout</code> which requires an active subscription.</div>
          <div>• Downloads are plain text files (.txt) with version numbers in the filename.</div>
          <div>• The "Download All Manuals" button triggers all 12 downloads with staggered 300ms delays to prevent browser blocking.</div>
          <div>• A preview pane (first 2,000 chars) is shown before downloading each manual.</div>
        </div>
        <Note type="info">Manuals are subscriber-proprietary documentation. Do not redistribute or share links to the /manuals page with non-subscribers. Direct any documentation requests to support@proxhqvpn.com.</Note>
      </div>
    ),
  },
  {
    id: "escalation", title: "Escalation & Emergency Procedures", icon: Bell,
    content: (
      <div className="space-y-3">
        <p>In the event of a platform incident, follow this escalation path immediately. Response time matters.</p>
        <h4 className="font-bold text-primary text-[11px]">Incident Severity Levels</h4>
        <div className="space-y-2">
          {[
            { sev: "SEV-1 — Critical", examples: "VPN nodes all offline, data breach suspected, admin credentials compromised.", response: "Contact admin IMMEDIATELY via phone and email. Do not wait for response. Document everything.", color: "text-red-400" },
            { sev: "SEV-2 — High", examples: "Single node offline, Stripe webhook failures, mass customer complaints.", response: "Notify admin within 1 hour. Begin investigation. Document steps taken.", color: "text-orange-400" },
            { sev: "SEV-3 — Medium", examples: "Specific feature unavailable, elevated SilkWeb alert volume, API errors.", response: "Notify admin within 4 hours. Document in the issue tracker.", color: "text-yellow-400" },
            { sev: "SEV-4 — Low", examples: "UI bug, documentation error, cosmetic issue.", response: "Log in the issue tracker at next business opportunity. No immediate notification needed.", color: "text-primary/70" },
          ].map(({ sev, examples, response, color }) => (
            <div key={sev} className="border border-primary/10 rounded px-3 py-2">
              <div className={`text-[10px] font-mono font-bold mb-0.5 ${color}`}>{sev}</div>
              <div className="text-[9px] font-mono text-primary/83 mb-0.5"><strong>Examples:</strong> {examples}</div>
              <div className="text-[9px] font-mono text-primary/83"><strong>Response:</strong> {response}</div>
            </div>
          ))}
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-3">Emergency Contacts</h4>
        <div className="space-y-1.5 text-[10px] font-mono text-primary/83">
          <div>• <strong>Admin / Technical Lead</strong>: admin@proxhqvpn.com</div>
          <div>• <strong>Security Incidents</strong>: security@proxhqvpn.com (PGP available on request)</div>
          <div>• <strong>Customer Support</strong>: support@proxhqvpn.com</div>
        </div>
      </div>
    ),
  },
];

export default function EmployeeHandbook() {
  const [active, setActive] = usePersistedState<string>("handbook-active", "welcome");
  const section = SECTIONS.find(s => s.id === active) ?? SECTIONS[0];

  return (
    <div className="max-w-5xl mx-auto space-y-6 py-2">
      <PageSEO
        title="Employee Handbook — ProxhqVPN"
        description="ALPHA UNLIMITED TECHNOLOGIES LLC employee handbook for ProxhqVPN: platform access, security procedures, tool reference, and escalation policies."
        path="/handbook/employee"
      />

      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
          <Users className="w-5 h-5 text-primary/80" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white leading-tight">Employee Handbook</h1>
          <p className="text-xs text-white/78">ALPHA UNLIMITED TECHNOLOGIES LLC — Internal Operations Guide</p>
        </div>
      </div>

      <Note type="warn">This handbook is confidential and intended solely for authorized ALPHA UNLIMITED TECHNOLOGIES LLC employees. Do not share, copy, or distribute outside the organization.</Note>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
        <div className="lg:col-span-1">
          <div className="bg-[#0d1610] border border-white/[0.07] rounded-2xl p-2 space-y-0.5 sticky top-4">
            {SECTIONS.map(s => {
              const Icon = s.icon;
              const isActive = s.id === active;
              return (
                <button key={s.id} onClick={() => setActive(s.id)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition-all text-[11px] font-mono ${
                    isActive ? "bg-primary/10 text-primary border border-primary/20" : "text-white/78 hover:bg-white/[0.04] hover:text-white/90 border border-transparent"
                  }`}>
                  <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? "text-primary" : "text-white/70"}`} />
                  <span className="leading-snug">{s.title}</span>
                  {isActive && <ChevronRight className="w-3 h-3 ml-auto shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-3">
          <div className="bg-[#0d1610] border border-white/[0.07] rounded-2xl p-6">
            <div className="flex items-center gap-2.5 mb-5 pb-4 border-b border-white/[0.06]">
              {(() => { const Icon = section.icon; return <Icon className="w-4 h-4 text-primary/80 shrink-0" />; })()}
              <h2 className="text-sm font-bold text-white">{section.title}</h2>
            </div>
            <div className="text-[10px] font-mono text-primary/83 leading-relaxed space-y-3">
              {section.content}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
