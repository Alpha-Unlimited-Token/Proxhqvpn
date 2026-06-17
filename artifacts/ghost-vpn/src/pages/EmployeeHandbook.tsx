// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { usePersistedState } from "@/hooks/usePersistedState";
import { PageSEO } from "@/components/PageSEO";
import {
  Users, ChevronRight, Shield, Terminal, Database,
  BookOpen, AlertCircle, CheckCircle, Lock,
  Info, Activity, Server, Zap, Eye, Globe,
  Copy, FileText, Settings, Bell, Download,
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
        <h4 className="font-bold text-primary text-[11px] mt-3">Node Security Hardening (Required)</h4>
        <p className="text-[10px] font-mono text-primary/83">After initial setup, all production nodes must run the security hardening script. This is not optional for nodes serving live traffic.</p>
        <ol className="space-y-1.5 text-[10px] font-mono text-primary/83">
          <li><span className="text-primary/30">1.</span> Navigate to <strong>Firewall → NodeSync tab → Full Node Security Hardening Script</strong>.</li>
          <li><span className="text-primary/30">2.</span> Click the download button for the target node (Chicago 61 / London 62 / LA 63 / Tokyo 64).</li>
          <li><span className="text-primary/30">3.</span> Copy the script to the node: <code>scp proxhq-hardening-*.sh root@NODE_IP:/root/</code></li>
          <li><span className="text-primary/30">4.</span> SSH in and run as root: <code>bash proxhq-hardening-*.sh</code></li>
          <li><span className="text-primary/30">5.</span> Verify all 9 services are active: <code>systemctl is-active proxhq-ddos-monitor proxhq-fw-sync proxhq-peer-rules</code></li>
        </ol>
        <Note type="warn">The hardening script disables SSH password auth. Ensure your SSH public key is in ~/.ssh/authorized_keys on the node before running. Use your cloud provider's rescue console if locked out.</Note>
        <h4 className="font-bold text-primary text-[11px] mt-3">RAM-Only WireGuard Keys</h4>
        <p className="text-[10px] font-mono text-primary/83">All 4 active nodes use Mullvad-style RAM-only key architecture. The server private key is never on disk — it's fetched from the API on boot and stored only in <code>/dev/shm/</code>. If a node is rebooted unexpectedly, clients will reconnect automatically once the node re-fetches its key (takes ~5 seconds). If the API is unreachable at boot, WireGuard will not start — check API health first.</p>
        <h4 className="font-bold text-primary text-[11px] mt-3">Node Maintenance</h4>
        <div className="space-y-1.5 text-[10px] font-mono text-primary/83">
          <div>• <strong>Monthly</strong>: Check node uptime and peer count. Replace any node offline for more than 24 hours.</div>
          <div>• <strong>Quarterly</strong>: Update WireGuard and system packages on each node via the Terminal page. Re-run the hardening script after major OS updates.</div>
          <div>• <strong>On compromise</strong>: Immediately disable the node, rotate all keys, provision a replacement. The RAM-only architecture means rebooting the compromised node immediately destroys the WireGuard private key.</div>
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-3">Automated Node Lifecycle Engine</h4>
        <p className="text-[10px] font-mono text-primary/83">The <strong>Lifecycle Engine</strong> runs automatically in the API server background and handles four maintenance tasks without admin intervention:</p>
        <div className="space-y-1.5 text-[10px] font-mono text-primary/83 mt-2">
          {[
            { t: "Delivery Scheduler (every 60s)", d: "Flushes WireGuard peer commands stuck in pending > 5 min. Prevents audit trail bloat when no live daemon is connected. Runs once on startup to clear backlogs." },
            { t: "Decay Detector (every 5min)", d: "Marks active nodes as inactive when they haven't sent a heartbeat in 4 hours. Decayed nodes appear with an orange INACTIVE badge in the Node Manager grid." },
            { t: "Node Rotation Engine (every 15min)", d: "Replaces inactive nodes with fresh identities — new name, IP, WireGuard keys. Up to 5 nodes per pass. If the original node had beacon monitoring, the old IP is auto-converted to a honeypot trap." },
            { t: "VPN Gate Session Reaper (every 5min)", d: "Purges double-hop error sessions older than 30 minutes. Prevents VPN Gate panel from accumulating ghost error rows." },
          ].map(({ t, d }) => (
            <div key={t} className="border border-primary/10 rounded px-2.5 py-2">
              <div className="text-[9px] font-mono font-bold text-primary">{t}</div>
              <div className="text-[9px] font-mono text-primary/70 mt-0.5">{d}</div>
            </div>
          ))}
        </div>
        <p className="text-[10px] font-mono text-primary/83 mt-2">Monitor the engine from <strong>Node Manager → Lifecycle Engine panel</strong> (sidebar). Use "Run Lifecycle Pass" to trigger all schedulers immediately. API: <code>GET /api/nodes/lifecycle</code> · <code>POST /api/nodes/lifecycle/run</code></p>
        <Note type="info">The Lifecycle Engine logs every action to auditEvents with actor="lifecycle_engine" — distinguishable from human admin actions in the audit chain and SIEM.</Note>
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
            { tool: "HTTP Probe", path: "/http-probe", desc: "Craft raw HTTP requests. Inspect full responses. Equivalent to Burp Suite Repeater." },
            { tool: "Ghost Chain Arsenal", path: "/ghost-chain", desc: "200+ categorized exploits with Details tab (CVEs, technique explanation) and PoC code tab. Integrates with HTTP Probe and Intruder." },
            { tool: "OSINT Recon", path: "/osint-recon", desc: "Aggregates 15+ passive intel sources: Shodan, Censys, AbuseIPDB, VirusTotal, GreyNoise, WHOIS, DNSDumpster, crt.sh, HaveIBeenPwned. All VPN-routed." },
            { tool: "GPS Spoofing", path: "/gps-spoof", desc: "Fake your GPS coordinates at the VPN tunnel level. Bypass geo-restricted apps, spoof device location for testing, and mask real physical position." },
            { tool: "WebSocket Tester", path: "/ws-tester", desc: "Connect, intercept, replay, and fuzz WebSocket frames. Equivalent to Burp Suite WebSocket testing. Supports ws:// and wss:// with auth header injection." },
            { tool: "Dependency Scanner", path: "/dep-scanner", desc: "Scan any project directory or package manifest (npm/pip/cargo/go/maven/composer) for known CVEs. Severity-ranked results with remediation guidance." },
            { tool: "QuantumAudit", path: "/quantum-audit/", desc: "Standalone blockchain security auditing platform. Scans smart contracts and DeFi protocols for classical vulnerabilities (reentrancy, oracle manipulation, flash loan) and post-quantum cryptographic weaknesses (ECDSA nonce reuse, weak-k, r-collision, Shor's algorithm exposure). Includes 5-engine Signature Mining suite." },
            { tool: "Sig Miner", path: "/quantum-audit/sig-miner", desc: "5-engine blockchain forensics suite: Block Scanner (on-chain ECDSA extraction), Web Spider (paste site crawl), OSINT Spider (GitHub/Pastebin), Peel Chain (fund-flow tracing), Hybrid Worm (all engines in parallel with shared intelligence pool). Use for authorized blockchain security research." },
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
            { tool: "Ghost Trace", path: "/ghost-trace", desc: "VPN-native agentless behavioral analysis of every WireGuard peer. Detects C2 beaconing (periodic fixed-IP packets), data exfiltration (asymmetric traffic spikes), and malicious destinations (threat feed matches). Per-device 0–100 anomaly score. Score >90 auto-populates Firewall quick-block." },
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
          <div>• <strong>Report Generator</strong> — Auto-fills HackerOne-format disclosure reports with severity, description, and reproduction steps.</div>
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
            { title: "WAF Analyzer", tier: "Pro", desc: "WAF detection, bypass testing suite, 25+ vendor signatures." },
            { title: "Social & Game Breach Tester", tier: "Pro", desc: "Platform coverage, login strategies, session management, SSRF protection." },
            { title: "Bug Bounty Research Hub", tier: "Pro", desc: "19 programs, testing methodology, report generator, best practices." },
            { title: "OSINT Recon Engine", tier: "Pro", desc: "15+ intelligence sources, recon methodology, bug bounty integration." },
            { title: "Canary Token Generator", tier: "Pro", desc: "Token types, deployment strategies, forensic data, use cases." },
            { title: "SIEM Security Event Log", tier: "Pro", desc: "Event sources, filtering, correlation, export and reporting." },
            { title: "Employee Procedures", tier: "All Plans", desc: "Admin tools, node management, incident response, escalation paths." },
            { title: "VPN Privacy Suite Tools", tier: "All Plans", desc: "GPS Spoofing, Port Forwarding, Dedicated IP, Meshnet, Data Broker Opt-Out — setup and usage." },
            { title: "Dev Security Tools v2", tier: "Pro", desc: "OAST Tester, Dependency Scanner, Token Sequencer, WebSocket Tester, SAST Scanner — complete reference." },
            { title: "RAM-Only WireGuard Keys", tier: "All Plans", desc: "Boot sequence, /dev/shm architecture, API endpoint, threat model, troubleshooting." },
            { title: "Node Security Hardening Script", tier: "All Plans", desc: "9 systemd services, pre-run checklist, WireGuard safety guarantee, verification commands." },
            { title: "Advanced Firewall Suite", tier: "All Plans", desc: "ATR auto-response, composite risk score, per-peer rules, DDoS shield, AI optimizer — config & API reference." },
            { title: "Node Lifecycle Engine", tier: "All Plans", desc: "Automated delivery scheduler, decay detector, node rotation, honeypot auto-trigger, and VPN Gate session reaper — full config & API reference." },
            { title: "Attacker Intelligence Console v1.1", tier: "Pro", desc: "Banner Grab tab (NEW) — reads TCP service banners and HTTP headers from attacker IPs. Port presets, quick-action curl/nmap buttons, raw header expansion." },
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
    id: "customer-support", title: "Customer Support Workflow", icon: Globe,
    content: (
      <div className="space-y-3">
        <p>All customer-facing support is handled through <strong>support@proxhqvpn.com</strong>. This section covers how to triage, respond, and escalate support requests efficiently.</p>
        <h4 className="font-bold text-primary text-[11px]">Support Tiers</h4>
        <div className="space-y-2">
          {[
            { tier: "Tier 1 — Self-Service", who: "Customer resolves independently", how: "Direct customers to /guide (User Guide), /downloads (setup guides), /platforms (device setup), or /manuals (downloadable docs). The User Guide covers every feature in detail." },
            { tier: "Tier 2 — Email Support", who: "Employee responds", how: "Check support@proxhqvpn.com. Respond within 24 hours on business days. Use standard response templates below. CC admin on billing disputes." },
            { tier: "Tier 3 — Admin Escalation", who: "Admin resolves", how: "Any security incident, data request (law enforcement), billing dispute >$50, or account compromise suspected. Forward the full email thread with your assessment." },
          ].map(({ tier, who, how }) => (
            <div key={tier} className="border border-primary/10 rounded px-3 py-2">
              <div className="text-[10px] font-mono font-bold text-primary">{tier}</div>
              <div className="text-[9px] font-mono text-primary/60 mb-0.5">{who}</div>
              <div className="text-[9px] font-mono text-primary/83">{how}</div>
            </div>
          ))}
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-3">Common Issues & Responses</h4>
        <div className="space-y-2">
          {[
            { issue: "Can't connect to VPN", steps: "1. Check /api/healthz is responding. 2. Ask customer to re-download WireGuard config from /wireguard. 3. If all nodes failing, check /api/nodes status. 4. Escalate if nodes are down." },
            { issue: "Subscription not activating", steps: "1. Ask for the email used at checkout. 2. Check if Stripe shows the subscription as active (admin Stripe dashboard). 3. If Stripe shows active but platform doesn't, trigger manual webhook replay or manually update DB." },
            { issue: "Missing promo code commission", steps: "1. Ask for the promo code and approximate date. 2. Check ambassadors table in DB for the code. 3. Check ambassador_referrals table for the transaction. 4. If webhook missed, replay from Stripe." },
            { issue: "Command Center tool not working", steps: "1. Check if the API server is healthy (/api/healthz). 2. Check browser console for errors. 3. Ask for exact error message. 4. Reproduce locally. 5. Escalate with reproduction steps." },
            { issue: "Leak test shows IP exposed", steps: "1. Verify kill switch is enabled (/kill-switch). 2. Ask customer OS. 3. For IPv6 leaks: kill switch now includes ip6tables rules — customer needs to re-enable the kill switch to get the IPv6 protection. 4. Walk through the /leaks page DNS/WebRTC/IPv6 tests." },
          ].map(({ issue, steps }) => (
            <div key={issue} className="border border-primary/10 rounded px-3 py-2">
              <div className="text-[10px] font-mono font-bold text-primary mb-1">{issue}</div>
              <div className="text-[9px] font-mono text-primary/75 whitespace-pre-line">{steps}</div>
            </div>
          ))}
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-3">Response Templates</h4>
        <CB label="Connection Issue Template">{`Subject: Re: VPN Connection Issue

Hi [Name],

Thank you for reaching out. Here are the steps to resolve this:

1. Navigate to Settings → Downloads and re-download your WireGuard config
2. Delete the old config from your WireGuard app and import the new one
3. If the issue persists, try switching to a different VPN node — go to /nodes and select one with a green status indicator

Our platform status page is at proxhqvpn.com/api/healthz

If none of these resolve the issue, please reply with:
- Your device OS and version
- A screenshot of the WireGuard connection log

Best,
[Your name]
ProxhqVPN Support | support@proxhqvpn.com`}</CB>
        <Note type="info">All support emails should use <strong>support@proxhqvpn.com</strong> as the reply-to address. Do not use personal email addresses for support correspondence.</Note>
      </div>
    ),
  },
  {
    id: "sales-materials", title: "Sales & Marketing Materials", icon: FileText,
    content: (
      <div className="space-y-4">
        <p>Download these materials for use in employee sales support, partner conversations, and internal training. Do not distribute externally without admin approval.</p>
        {[
          {
            title: "Employee Sales Reference Deck",
            desc: "10-slide HTML presentation covering all ProxhqVPN tiers, features, competitive positioning, and objection handling. For use in sales calls and partner demos.",
            fn: () => {
              const html = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>ProxhqVPN — Sales Reference</title><style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Segoe UI',sans-serif;background:#050f05;color:#e5e5e5}@media print{.slide{page-break-after:always}body{background:#fff;color:#111}}.slide{min-height:100vh;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:60px;border-bottom:2px solid #111;text-align:center}.slide h1{font-size:3em;color:#00ff88;margin-bottom:16px;font-weight:900}.slide h2{font-size:2em;color:#00ff88;margin-bottom:16px}.slide p{font-size:1.05em;color:#bbb;max-width:800px;text-align:left;line-height:1.7}.slide ul{max-width:800px;text-align:left}.slide li{font-size:1em;margin:8px 0;color:#ccc;line-height:1.6}.grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;max-width:900px;text-align:left}.card{background:#0d1f0d;border:1px solid #1a3a1a;padding:20px;border-radius:8px}.card h3{color:#00ff88;margin-bottom:8px}.card p{font-size:.9em;color:#aaa}.tier-badge{display:inline-block;padding:4px 12px;border-radius:4px;font-size:.85em;font-weight:700;margin:4px}.t1{background:#0a3a3a;color:#00ffcc;border:1px solid #00ffcc44}.t2{background:#3a1a0a;color:#ff8800;border:1px solid #ff880044}.t3{background:#1a0a3a;color:#aa66ff;border:1px solid #aa66ff44}</style></head><body>
<div class="slide"><h1>ProxhqVPN</h1><p style="text-align:center;color:#888;font-size:1.2em">ALPHA UNLIMITED TECHNOLOGIES LLC<br><strong style="color:#00ff88">Internal Sales Reference</strong><br><span style="font-size:.8em;color:#555">CONFIDENTIAL — Employees only</span></p></div>
<div class="slide"><h2>Platform Overview</h2><div class="grid"><div class="card"><h3>Privacy & VPN</h3><p>60-node WireGuard mesh, Kill Switch + IPv6, DNS Sinkhole, Tor, VPN Gate (6,000+ nodes), Multi-device, DPI obfuscation</p></div><div class="card"><h3>Defense</h3><p>SilkWeb honeypot, Canary Tokens, Firewall Manager, Ghost Trace (behavioral analysis), Beacon Monitor, SIEM</p></div><div class="card"><h3>Security Research</h3><p>OSINT Recon, Ghost Chain, QuantumAudit, HTTP Probe, CVE Lookup, JWT Analyzer, Dep Scanner, SAST, IaC Scanner, API Tester</p></div><div class="card"><h3>AI & Intelligence</h3><p>SOC Co-Pilot, AI Shield, Code Sentinel, Ghost PenTest, Request Mind</p></div></div></div></div>
<div class="slide"><h2>Pricing Tiers</h2><br><div class="grid" style="grid-template-columns:1fr 1fr 1fr"><div class="card"><div class="tier-badge t1">Recon</div><h3>$6.99/mo</h3><p>VPN Basic — privacy, DNS Sinkhole, smart DNS, kill switch, Tor, all devices</p></div><div class="card"><div class="tier-badge t2">Strike</div><h3>$39.99/mo</h3><p>Command Center Pro — Recon tier + full security toolkit (replaces Burp Suite Pro)</p></div><div class="card"><div class="tier-badge t3">Arsenal</div><h3>Contact Us</h3><p>Elite — WAF Bypass, HTTP Interceptor, QuantumAudit, AI tools, SOC Co-Pilot</p></div></div></div>
<div class="slide"><h2>Command Center Pro vs. Competitors</h2><br><ul><li><strong style="color:#00ff88">vs. NordVPN / ExpressVPN</strong> — No security tools whatsoever; purely VPN/streaming focused</li><li><strong style="color:#00ff88">vs. standalone security tools</strong> — ProxhqVPN bundles defensive security research, OSINT, Ghost Chain, SIEM, QuantumAudit, and full VPN into one platform</li><li><strong style="color:#ff4444">Where ProxhqVPN focuses</strong> — Defensive security research, threat intelligence, VPN privacy, and compliance tooling</li></ul></div>
<div class="slide"><h2>Target Customer Profiles</h2><br><div class="grid"><div class="card"><h3>Security Researcher</h3><p>Bug bounty hunter, CTF player, pen tester. Pain: Burp Suite Pro too expensive. Solution: Strike tier replaces it + adds VPN opsec.</p></div><div class="card"><h3>Developer</h3><p>Needs API testing, secret scanning, dependency audit, IaC security. Pain: Separate tools for each task. Solution: All in one platform, routed through VPN.</p></div><div class="card"><h3>Privacy User</h3><p>Wants no-log VPN + DNS blocker + device-level protection. Pain: VPN + Pi-hole setup is complex. Solution: DNS Sinkhole built-in, one subscription.</p></div><div class="card"><h3>Web3 / Crypto Team</h3><p>Needs smart contract auditing. Pain: Expensive manual audits. Solution: QuantumAudit for classical + post-quantum vulnerability scanning.</p></div></div></div>
<div class="slide"><h2>Common Objections</h2><br><ul><li><strong style="color:#ff8800">"I already use NordVPN"</strong> — ProxhqVPN doesn't replace their existing VPN subscription immediately. Start with the security tools angle: "Do you also pay for Burp Suite separately?" If yes, that's the immediate ROI.</li><li><strong style="color:#ff8800">"The tools seem complicated"</strong> — Every tool has a built-in User Guide (/guide) with step-by-step instructions. The User Guide (/guide) explains every feature in plain English. No prior security experience required.</li><li><strong style="color:#ff8800">"Is it legal?"</strong> — All tools are legal for authorized testing. Legal disclaimers on every page. Comparable to Burp Suite Pro, which is used by every major enterprise security team globally.</li><li><strong style="color:#ff8800">"I'm worried about my data"</strong> — Zero-log policy. Warrant canary at /api/warrant-canary (publicly accessible, cryptographically signed). Hosted by ALPHA UNLIMITED TECHNOLOGIES LLC, a registered LLC.</li></ul></div>
<div class="slide"><h2>Support Channels</h2><br><ul><li><strong style="color:#00ff88">Customer Support</strong>: support@proxhqvpn.com — 24hr response SLA on business days</li><li><strong style="color:#00ff88">Ambassador Support</strong>: ambassadors@proxhqvpn.com — Priority channel for ambassador issues</li><li><strong style="color:#00ff88">Security Reports</strong>: security@proxhqvpn.com — PGP available on request</li><li><strong style="color:#00ff88">Admin / Technical</strong>: admin@proxhqvpn.com — Internal escalation only</li><li><strong style="color:#00ff88">Self-Service</strong>: /guide, /manuals, /platforms, /downloads — comprehensive documentation</li></ul><br><p style="text-align:center;font-size:.9em;color:#555">This deck is CONFIDENTIAL — for employee use only.<br>© 2026 ALPHA UNLIMITED TECHNOLOGIES LLC</p></div>
</body></html>`;
              const blob = new Blob([html], { type: "text/html" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a"); a.href = url; a.download = "proxhqvpn_employee_sales_deck.html"; a.click(); URL.revokeObjectURL(url);
            },
          },
        ].map(({ title, desc, fn }) => (
          <div key={title} className="border border-primary/10 rounded p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="text-[8px] font-mono font-bold text-orange-400 uppercase tracking-widest mb-1">INTERNAL — CONFIDENTIAL</div>
                <div className="text-[11px] font-bold text-primary mb-1">{title}</div>
                <div className="text-[9px] font-mono text-primary/70">{desc}</div>
              </div>
              <button onClick={fn} className="shrink-0 flex items-center gap-1.5 text-[10px] border border-primary/30 text-primary px-3 py-2 hover:bg-primary/10 transition-colors">
                <Download className="w-3 h-3" /> Download
              </button>
            </div>
          </div>
        ))}
        <Note type="warn">Sales materials are for internal and authorized ambassador use only. Do not distribute externally without explicit admin approval.</Note>
      </div>
    ),
  },
  {
    id: "omega-dashboard", title: "Omega Admin Dashboard", icon: Activity,
    content: (
      <div className="space-y-3">
        <p>The <strong>Omega Dashboard</strong> is the administrative analytics and subscriber management interface, accessible at <code>/omega-dashboard/</code>. This is a separate artifact from the main ProxhqVPN app — admin-only access.</p>
        <h4 className="font-bold text-primary text-[11px]">Key Admin Capabilities</h4>
        <div className="space-y-2">
          {[
            { t: "Subscriber Management", d: "View all active subscribers, their plan tier (VPN Basic vs Command Center Pro), billing cycle, join date, Clerk user ID, and subscription status. Filter and search by email, plan, or date." },
            { t: "Revenue Analytics", d: "Monthly Recurring Revenue (MRR), Annual Recurring Revenue (ARR), churn rate, new subscriber trend, plan distribution breakdown. Data sourced live from Stripe API." },
            { t: "Ambassador Program", d: "All ambassador accounts: promo codes, referral counts, commission earned, approval status. Approve pending applications, edit commission rates, and view referral attribution per subscriber." },
            { t: "Employee Management", d: "All employee accounts with their access tier and last login. Add or remove employees. Set access permissions per employee." },
            { t: "User Plan Override", d: "Manually upgrade or downgrade any subscriber's plan tier — used for support cases, extended trials, or correcting Stripe sync issues." },
          ].map(({ t, d }) => (
            <div key={t} className="border border-primary/10 rounded px-3 py-2">
              <div className="text-[10px] font-mono font-bold text-primary">{t}</div>
              <div className="text-[9px] font-mono text-primary/83 mt-0.5">{d}</div>
            </div>
          ))}
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-3">Access</h4>
        <p className="text-[10px] font-mono text-primary/83">Omega Dashboard is only accessible to accounts with <code>isAdmin: true</code> in the employees table. If you cannot access it, contact <a href="mailto:alphaunlimitedtechnologies@gmail.com" className="text-primary hover:underline">alphaunlimitedtechnologies@gmail.com</a> for access provisioning. Do not share the dashboard URL publicly.</p>
        <Note type="warn">All actions in the Omega Dashboard (plan overrides, ambassador approvals, employee additions) are logged. Unauthorized modifications to subscriber data are a security policy violation.</Note>
      </div>
    ),
  },
  {
    id: "quantum-audit-ops", title: "QuantumAudit Operations", icon: Shield,
    content: (
      <div className="space-y-3">
        <p>The <strong>QuantumAudit</strong> platform (<code>/quantum-audit/</code>) is ProxhqVPN's standalone blockchain security auditing system. Employees may use it for authorized blockchain security research and client audit engagements.</p>
        <h4 className="font-bold text-primary text-[11px]">Running a Blockchain Audit</h4>
        <ol className="space-y-1.5 text-[10px] font-mono text-primary/83">
          <li><span className="text-primary/30">1.</span> Navigate to <code>/quantum-audit/</code> → click <strong>New Scan</strong>.</li>
          <li><span className="text-primary/30">2.</span> Enter the smart contract address or protocol URL. Select blockchain (Ethereum, Solana, BNB Chain, Polygon, Arbitrum, etc.).</li>
          <li><span className="text-primary/30">3.</span> Choose scan type: <strong>Quick</strong> (classical vulns only), <strong>Deep</strong> (+ post-quantum cryptographic analysis), or <strong>Full</strong> (all checks + Signature Mining).</li>
          <li><span className="text-primary/30">4.</span> Click <strong>Start Scan</strong>. Scan status is polled every 5 seconds. Most scans complete in 30–120 seconds.</li>
          <li><span className="text-primary/30">5.</span> View findings on the Scan Detail page. Download the full audit report from <strong>View Report</strong>.</li>
        </ol>
        <h4 className="font-bold text-primary text-[11px] mt-3">Vulnerability Categories</h4>
        <div className="grid grid-cols-2 gap-2">
          {[
            { cat: "Classical Blockchain", items: ["Reentrancy attacks", "Flash loan manipulation", "Oracle price manipulation", "Integer overflow/underflow", "Access control failures"] },
            { cat: "Post-Quantum", items: ["ECDSA nonce reuse (private key recovery)", "Weak-k (k < 2^24 brute force)", "R-value collision across txs", "Shor's algorithm exposure (ECDSA)", "MSB/LSB nonce bias detection"] },
          ].map(({ cat, items }) => (
            <div key={cat} className="border border-primary/10 rounded px-2.5 py-2">
              <div className="text-[10px] font-mono font-bold text-primary mb-1">{cat}</div>
              {items.map(i => <div key={i} className="text-[9px] font-mono text-primary/83">• {i}</div>)}
            </div>
          ))}
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-3">Signature Mining Suite</h4>
        <p className="text-[10px] font-mono text-primary/83">The 5-engine Signature Miner (<code>/quantum-audit/sig-miner</code>) is for authorized blockchain forensic research. The <strong>Hybrid Worm Engine</strong> runs all four engines in parallel with a shared Cross-Engine intelligence pool. Only use against blockchains or addresses you are authorized to investigate. All mining sessions are logged.</p>
        <Note type="danger">QuantumAudit findings that reveal recoverable private keys constitute active security vulnerabilities. Handle all key material found during research as strictly confidential and disclose only through proper responsible disclosure channels. Do not use recovered keys for any financial transactions.</Note>
      </div>
    ),
  },
  {
    id: "ghost-trap-ops", title: "Ghost Trap — Operations Guide", icon: Eye,
    content: (
      <div className="space-y-3">
        <p><strong>Ghost Trap</strong> (<code>/ghost-trap</code>) is an active counter-intelligence system. Employees responsible for infrastructure security should review Ghost Trap activity daily and manage the automated response pipeline.</p>
        <h4 className="font-bold text-primary text-[11px]">Daily Review Checklist</h4>
        <ol className="space-y-1.5 text-[10px] font-mono text-primary/83">
          <li><span className="text-primary/30">1.</span> Open Ghost Trap → review <strong>Active Traps</strong> panel for any new attacker sessions active in the last 24 hours.</li>
          <li><span className="text-primary/30">2.</span> For each attacker session: review the Hop Chain visualization to understand which lure they hit and what they requested.</li>
          <li><span className="text-primary/30">3.</span> Check the <strong>Fingerprinting</strong> tab: OS, tool (Nmap/Shodan/Metasploit/Burp), and JA3 hash. Log this for the threat intelligence record.</li>
          <li><span className="text-primary/30">4.</span> Review which <strong>Poisoned Responses</strong> were served. Confirm the embedded canary tokens are active (green status).</li>
          <li><span className="text-primary/30">5.</span> If a canary fired (orange badge on session): the attacker used the poisoned data. Record their real IP from the canary trigger log.</li>
          <li><span className="text-primary/30">6.</span> Confirm the attacker IP is in the <strong>Auto-Block</strong> list. If not, manually add it to the Firewall.</li>
          <li><span className="text-primary/30">7.</span> For repeat attackers (3+ sessions): generate the <strong>Abuse Report Template</strong> and submit to AbuseIPDB and the attacker's ISP.</li>
        </ol>
        <h4 className="font-bold text-primary text-[11px] mt-3">Tarpit Settings</h4>
        <p className="text-[10px] font-mono text-primary/83">Adjust tarpit aggressiveness in Ghost Trap Settings: <strong>Low</strong> (hold 30s), <strong>Medium</strong> (hold 5 min), <strong>High</strong> (hold up to 2 hours). High tarpit mode can significantly degrade attacker scanning throughput but uses more server-side connection resources. Recommended: Medium for production.</p>
        <h4 className="font-bold text-primary text-[11px] mt-3">Manual IP Investigator — Proactive Threat Investigation</h4>
        <p className="text-[10px] font-mono text-primary/83 mb-1">Ghost Trap's Counter-Intel tab includes a <strong>Manual IP Investigator</strong>. Employees performing network monitoring via terminal can paste any suspicious IP address and port directly into Ghost Trap for immediate investigation — no need to wait for the IP to hit a lure first.</p>
        <h4 className="font-bold text-primary text-[10px] mt-2">Proactive Monitoring Workflow</h4>
        <ol className="space-y-1.5 text-[10px] font-mono text-primary/83">
          <li><span className="text-primary/30">1.</span> While monitoring the server, run <code>ss -tnp</code> or <code>netstat -an | grep ESTABLISHED</code> in terminal to see live connections.</li>
          <li><span className="text-primary/30">2.</span> Identify any unexpected external IP connections — especially on non-standard ports (4444, 1337, 31337, 9050).</li>
          <li><span className="text-primary/30">3.</span> Copy the IP and port. Navigate to <strong>Ghost Trap → Counter-Intel → Manual IP Investigator</strong>.</li>
          <li><span className="text-primary/30">4.</span> Paste the IP in the IP field and the port number in the Port field. Click <strong>Investigate</strong>.</li>
          <li><span className="text-primary/30">5.</span> Review: port scan result (OPEN/CLOSED/FILTERED for the exact port you saw), OSINT geo/ISP/ASN, reverse DNS, and abuse contact.</li>
          <li><span className="text-primary/30">6.</span> If scan confirms port is OPEN and ISP is a known hosting provider (Hetzner, DigitalOcean, Vultr, etc.), escalate and add IP to Firewall block list immediately.</li>
          <li><span className="text-primary/30">7.</span> Use the Counter-Beacon Injector to plant tracking tokens for future attribution if the attacker reconnects.</li>
        </ol>
        <Note type="warn">The Poisoned Response data returned to attackers (fake credentials, fake config files) is always synthetic — it passes format validation but is never real. Double-check the Fake Data Templates in settings to ensure no real credentials have been accidentally included in templates.</Note>
      </div>
    ),
  },
  {
    id: "ai-tools-guide", title: "AI Security Tools — Employee Guide", icon: Zap,
    content: (
      <div className="space-y-3">
        <p>The <strong>AI Security Suite</strong> (<code>/ai-security</code>) contains tools for auditing AI/LLM systems. Employees should familiarize themselves with these tools for both internal AI hardening and client engagements.</p>
        <h4 className="font-bold text-primary text-[11px]">Approved Internal Use Cases</h4>
        <div className="space-y-1.5 text-[10px] font-mono text-primary/83">
          <div>• <strong>SOC Copilot</strong> — use daily to generate natural-language summaries of SIEM events and Ghost Trace anomalies. Reduces alert fatigue and speeds triage.</div>
          <div>• <strong>LLM Probe</strong> — test any internal AI tools (chatbots, code assistants) for prompt injection before deploying to production.</div>
          <div>• <strong>AI Shield</strong> — run against any new system prompt before it goes live. The hardened system prompt output should be reviewed and approved by admin.</div>
          <div>• <strong>MCP Auditor</strong> — audit Claude Desktop / VS Code Copilot MCP server configurations when employees report MCP-related tool access anomalies.</div>
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-3">SOC Copilot — Daily Workflow</h4>
        <ol className="space-y-1.5 text-[10px] font-mono text-primary/83">
          <li><span className="text-primary/30">1.</span> Navigate to <strong>AI Security Suite → SOC Copilot</strong>.</li>
          <li><span className="text-primary/30">2.</span> Set the analysis window: Last 24 hours (daily review) or Last 7 days (weekly report).</li>
          <li><span className="text-primary/30">3.</span> Click <strong>Generate Incident Summary</strong>. The AI ingests SIEM events, Ghost Trace anomalies, and firewall blocks.</li>
          <li><span className="text-primary/30">4.</span> Review the output: Critical Incidents, Triage Queue, Recommendations, and Playbook suggestions.</li>
          <li><span className="text-primary/30">5.</span> Escalate any Critical incidents to admin immediately. Archive the summary in the incident log.</li>
        </ol>
        <Note type="info">AI Security Suite outputs are AI-generated summaries and recommendations — they are not authoritative security verdicts. Always verify findings with raw log data before taking action. The SOC Copilot output should be treated as a starting point for investigation, not a final conclusion.</Note>
      </div>
    ),
  },
  {
    id: "canary-token-ops", title: "Canary Token Operations", icon: Bell,
    content: (
      <div className="space-y-3">
        <p>Employees should deploy Canary Tokens on all sensitive internal resources as a standard operating procedure. This section covers the recommended deployment strategy and alert response protocol.</p>
        <h4 className="font-bold text-primary text-[11px]">Recommended Token Deployments</h4>
        <div className="space-y-2">
          {[
            { t: "Admin Credential Documents", d: "Place a URL canary in any document containing admin credentials (even test credentials). If it fires, assume the document was exfiltrated." },
            { t: "Internal Config Files", d: "Embed a DNS canary in any .env, config.yaml, or secrets.json file stored in any shared location. DNS canaries fire even from air-gapped environments." },
            { t: "Customer Data Exports", d: "Any CSV export of customer data should have a SQL canary row embedded. If an attacker dumps your DB and checks the URL, you get their IP immediately." },
            { t: "Employee Offboarding", d: "When an employee leaves, create a URL canary for a plausible resource (e.g. 'admin-panel-access.pdf') and share it with the departing employee's email. If accessed after departure, investigate immediately." },
            { t: "SilkWeb Decoy Services", d: "All SilkWeb fake service responses should include embedded URL and DNS canaries. This links honeypot attacker sessions to real-world IP intelligence." },
          ].map(({ t, d }) => (
            <div key={t} className="border border-primary/10 rounded px-3 py-2">
              <div className="text-[10px] font-mono font-bold text-primary">{t}</div>
              <div className="text-[9px] font-mono text-primary/83 mt-0.5">{d}</div>
            </div>
          ))}
        </div>
        <h4 className="font-bold text-primary text-[11px] mt-3">Alert Response Protocol</h4>
        <ol className="space-y-1.5 text-[10px] font-mono text-primary/83">
          <li><span className="text-primary/30">1.</span> Canary alert received → note the token type and the resource it was protecting.</li>
          <li><span className="text-primary/30">2.</span> Check the enriched data: source IP, reverse DNS, GeoIP, ASN. Is it a known scraper/bot (e.g. Googlebot) or an unexpected actor?</li>
          <li><span className="text-primary/30">3.</span> If unexpected: escalate to admin immediately. Treat the protected resource as compromised.</li>
          <li><span className="text-primary/30">4.</span> Add the attacker IP to the Firewall blocklist. Submit to AbuseIPDB if appropriate.</li>
          <li><span className="text-primary/30">5.</span> Rotate credentials or revoke access for the resource the canary was protecting.</li>
          <li><span className="text-primary/30">6.</span> Deploy a new canary on the replacement resource.</li>
        </ol>
        <Note type="info">All canary trigger logs are visible in the SIEM event log under source "Canary". Filter SIEM by Source = Canary to see all historical trigger events in one view.</Note>
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

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5 text-primary/80" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white leading-tight">Employee Handbook</h1>
            <p className="text-xs text-white/78">ALPHA UNLIMITED TECHNOLOGIES LLC — Internal Operations Guide</p>
          </div>
        </div>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-primary/20 bg-primary/5 text-primary text-[11px] font-mono hover:bg-primary/10 transition-colors shrink-0"
          title="Print or Save as PDF"
        >
          <Download className="w-3.5 h-3.5" />
          Download PDF
        </button>
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
