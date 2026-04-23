import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  Users, UserPlus, Trash2, Loader2, BadgeCheck,
  Mail, Clock, User, AlertCircle, Shield,
  RefreshCw, FileText,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface Employee {
  id: number;
  email: string;
  displayName: string | null;
  note: string | null;
  addedByEmail: string | null;
  addedAt: string;
  isAdminEmployee: boolean;
}

function formatDate(iso: string) {
  try { return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }); }
  catch { return iso; }
}

export default function Employees() {
  const { toast } = useToast();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading]     = useState(true);
  const [adding, setAdding]       = useState(false);
  const [deleting, setDeleting]   = useState<number | null>(null);
  const [showForm, setShowForm]   = useState(false);

  const [email, setEmail]           = useState("");
  const [displayName, setDispName]  = useState("");
  const [note, setNote]             = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${BASE}/api/employees`, { credentials: "include" });
      if (r.status === 403) { setEmployees([]); setLoading(false); return; }
      const data = await r.json();
      setEmployees(Array.isArray(data) ? data : []);
    } catch {
      toast({ title: "Failed to load employees", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const add = async () => {
    if (!email.trim()) { toast({ title: "Email is required", variant: "destructive" }); return; }
    setAdding(true);
    try {
      const r = await fetch(`${BASE}/api/employees`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), displayName: displayName.trim() || undefined, note: note.trim() || undefined }),
      });
      const d = await r.json();
      if (!r.ok) { toast({ title: d.error ?? "Failed to add", variant: "destructive" }); return; }
      toast({ title: "Employee added", description: `${d.email} now has full complimentary access` });
      setEmail(""); setDispName(""); setNote(""); setShowForm(false);
      load();
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setAdding(false);
    }
  };

  const remove = async (emp: Employee) => {
    if (!confirm(`Remove ${emp.email} as an employee? They will lose complimentary access.`)) return;
    setDeleting(emp.id);
    try {
      const r = await fetch(`${BASE}/api/employees/${emp.id}`, { method: "DELETE", credentials: "include" });
      const d = await r.json();
      if (!r.ok) { toast({ title: d.error ?? "Failed to remove", variant: "destructive" }); return; }
      toast({ title: "Employee removed", description: `${emp.email} access revoked` });
      load();
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="space-y-5 font-mono max-w-3xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-lg font-bold tracking-widest uppercase text-primary flex items-center gap-2">
            <Users className="w-5 h-5" /> Employee Access
          </h1>
          <p className="text-xs text-primary/40 mt-0.5">
            Employees get full ProxhqVPN access at no charge — no subscription required.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="flex items-center gap-1.5 text-[9px] font-mono text-primary/40 hover:text-primary border border-primary/15 hover:border-primary/30 px-3 py-1.5 rounded transition-colors">
            <RefreshCw className="w-3 h-3" /> Refresh
          </button>
          <button onClick={() => setShowForm(v => !v)}
            className="flex items-center gap-2 text-[10px] font-mono text-black bg-primary hover:bg-primary/80 px-4 py-2 rounded transition-colors">
            <UserPlus className="w-3.5 h-3.5" /> Add Employee
          </button>
        </div>
      </div>

      {/* Access policy notice */}
      <div className="flex items-start gap-2 text-[9px] font-mono border border-green-500/20 bg-green-900/10 rounded px-3 py-2 text-green-400/80">
        <BadgeCheck className="w-3.5 h-3.5 mt-0.5 shrink-0 text-green-400" />
        <span>
          Employees listed here receive <strong>complimentary full access</strong> — WireGuard config generation, all VPN features,
          Alpha Toolkit, and every Pro-tier feature — automatically, with no billing required. Access is granted by email address match at login.
        </span>
      </div>

      {/* Add employee form */}
      {showForm && (
        <div className="border border-primary/25 rounded p-4 bg-primary/5 space-y-3">
          <div className="text-[10px] font-mono font-bold text-primary uppercase tracking-widest flex items-center gap-2">
            <UserPlus className="w-3.5 h-3.5" /> New Employee
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[8px] text-primary/40 font-mono uppercase block mb-1">Email Address *</label>
              <input value={email} onChange={e => setEmail(e.target.value)}
                placeholder="employee@example.com"
                className="w-full bg-black border border-primary/20 text-primary text-xs font-mono px-2 py-1.5 focus:outline-none focus:border-primary/50 rounded" />
            </div>
            <div>
              <label className="text-[8px] text-primary/40 font-mono uppercase block mb-1">Display Name (optional)</label>
              <input value={displayName} onChange={e => setDispName(e.target.value)}
                placeholder="First Last"
                className="w-full bg-black border border-primary/20 text-primary text-xs font-mono px-2 py-1.5 focus:outline-none focus:border-primary/50 rounded" />
            </div>
          </div>
          <div>
            <label className="text-[8px] text-primary/40 font-mono uppercase block mb-1">Internal Note (optional)</label>
            <input value={note} onChange={e => setNote(e.target.value)}
              placeholder="Role, department, or reason for access…"
              className="w-full bg-black border border-primary/20 text-primary text-xs font-mono px-2 py-1.5 focus:outline-none focus:border-primary/50 rounded" />
          </div>
          <div className="flex items-center gap-3">
            <button onClick={add} disabled={adding}
              className="flex items-center gap-2 text-[10px] font-mono text-black bg-primary hover:bg-primary/80 disabled:opacity-50 px-4 py-2 rounded transition-colors">
              {adding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
              {adding ? "Adding…" : "Grant Access"}
            </button>
            <button onClick={() => { setShowForm(false); setEmail(""); setDispName(""); setNote(""); }}
              className="text-[9px] font-mono text-primary/40 hover:text-primary transition-colors">
              Cancel
            </button>
          </div>
          <div className="flex items-start gap-2 text-[9px] font-mono text-yellow-400/70 border border-yellow-500/15 rounded px-2 py-1.5">
            <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
            Access is granted immediately. The employee must sign in with this exact email address to receive complimentary access.
          </div>
        </div>
      )}

      {/* Employee list */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-primary/30 font-mono text-sm gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading employees…
        </div>
      ) : employees.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-primary/15 rounded">
          <Users className="w-8 h-8 text-primary/20 mx-auto mb-3" />
          <div className="text-primary/30 font-mono text-xs">No employees yet</div>
          <div className="text-primary/20 font-mono text-[10px] mt-1">Click "Add Employee" to grant complimentary access</div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="text-[8px] font-mono text-primary/30 uppercase tracking-widest px-1">
            {employees.length} employee{employees.length !== 1 ? "s" : ""} · all have full complimentary access
          </div>
          {employees.map(emp => (
            <div key={emp.id}
              className="border border-primary/15 hover:border-primary/25 rounded p-4 flex items-start gap-4 transition-colors">
              {/* Avatar */}
              <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 text-[11px] font-bold text-primary/70 uppercase">
                {(emp.displayName?.[0] ?? emp.email[0]).toUpperCase()}
              </div>

              {/* Details */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {emp.displayName && (
                    <span className="text-[11px] font-bold text-primary font-mono">{emp.displayName}</span>
                  )}
                  <span className="flex items-center gap-1 text-[10px] text-primary/60 font-mono">
                    <Mail className="w-3 h-3" /> {emp.email}
                  </span>
                  <span className="flex items-center gap-1 text-[8px] text-green-400 border border-green-500/25 bg-green-900/10 px-1.5 py-0.5 rounded font-mono">
                    <BadgeCheck className="w-2.5 h-2.5" /> FULL ACCESS
                  </span>
                  {emp.isAdminEmployee && (
                    <span className="flex items-center gap-1 text-[8px] text-yellow-400 border border-yellow-500/25 bg-yellow-900/10 px-1.5 py-0.5 rounded font-mono">
                      <Shield className="w-2.5 h-2.5" /> EMPLOYEE ADMIN
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4 mt-1 flex-wrap">
                  {emp.note && (
                    <span className="flex items-center gap-1 text-[9px] text-primary/40 font-mono">
                      <FileText className="w-3 h-3" /> {emp.note}
                    </span>
                  )}
                  <span className="flex items-center gap-1 text-[9px] text-primary/30 font-mono">
                    <Clock className="w-3 h-3" /> Added {formatDate(emp.addedAt)}
                  </span>
                  {emp.addedByEmail && (
                    <span className="flex items-center gap-1 text-[9px] text-primary/20 font-mono">
                      <User className="w-3 h-3" /> by {emp.addedByEmail}
                    </span>
                  )}
                </div>
              </div>

              {/* Delete */}
              <button onClick={() => remove(emp)} disabled={deleting === emp.id}
                className="shrink-0 flex items-center gap-1.5 text-[9px] font-mono text-red-400/50 hover:text-red-400 border border-red-500/10 hover:border-red-500/30 px-2.5 py-1.5 rounded transition-colors disabled:opacity-40">
                {deleting === emp.id
                  ? <Loader2 className="w-3 h-3 animate-spin" />
                  : <Trash2 className="w-3 h-3" />
                }
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Info box */}
      <div className="border border-primary/10 rounded p-3 space-y-1.5 text-[9px] font-mono text-primary/83">
        <div className="flex items-center gap-1.5 text-primary font-bold uppercase text-[8px] tracking-widest">
          <Shield className="w-3 h-3" /> Employee Handbook — Access & Features
        </div>
        <div className="text-primary/78 mt-1 mb-2 text-[8px]">ALPHA UNLIMITED TECHNOLOGIES LLC — Internal Policy</div>

        <div className="font-bold text-primary/90 text-[8px] uppercase tracking-wider mt-2 mb-1">How Access is Granted</div>
        <div>• Employee emails are matched at login — exact match, case-insensitive.</div>
        <div>• The employee signs in with their Google or email account using the standard ProxhqVPN login page.</div>
        <div>• Access is granted immediately and automatically on their first login after being added to this list.</div>
        <div>• The Pricing/Subscription page shows <span className="text-green-400">Employee — Complimentary</span> instead of asking for payment.</div>

        <div className="font-bold text-primary/90 text-[8px] uppercase tracking-wider mt-3 mb-1">What Employees Get (Full Pro Access)</div>
        <div>• <strong>My VPN</strong> — WireGuard config generation, auto-IP detection banner, QR code for mobile, connection to all nodes.</div>
        <div>• <strong>Kill Switch</strong> — Auto-IP whitelisting with downloadable iptables/pf/netsh rule files for Linux, macOS, and Windows.</div>
        <div>• <strong>WireGuard Config</strong> — Cryptographically signed configs with PostUp/PostDown kill switch hooks pre-baked.</div>
        <div>• <strong>Router Config</strong> — One-click WireGuard configs for OpenWRT, DD-WRT, AsusWRT-Merlin, pfSense, GL.iNet, and Ubiquiti EdgeOS.</div>
        <div>• <strong>VPN Gate</strong> — Double-hop routing through community VPN Gate servers.</div>
        <div>• <strong>Onion Browser</strong> — Built-in Tor browser for .onion addresses and anonymous browsing.</div>
        <div>• <strong>Leak Detection</strong> — IP, DNS, WebRTC, and IPv6 leak tests.</div>
        <div>• <strong>DNS Shield</strong> — DNS-over-HTTPS and DNS-over-TLS configuration.</div>
        <div>• <strong>Split Tunneling</strong> — Per-app and per-CIDR routing rules.</div>
        <div>• <strong>Alpha Toolkit</strong> — Universal Scanner v4.0, Vulnerability Verifier, Web Scraper (all Tor-cloakable). Command Center Pro exclusive.</div>
        <div>• <strong>SQLmap Scanner</strong> — Full SQLmap integration with Tor routing. Command Center Pro exclusive.</div>
        <div>• <strong>SilkWeb Honeypot</strong> — Decoy network management, trapped IP logs, counter-scan interface.</div>
        <div>• <strong>Threat Monitor</strong> — Real-time intrusion alerts from all nodes and honeypots.</div>
        <div>• <strong>Firewall Manager</strong> — iptables/nftables rule management across all VPN nodes.</div>
        <div>• <strong>Remote Terminal</strong> — Web-based shell for VPN node administration.</div>
        <div>• <strong>Security Audit</strong> — Automated self-audit of the ProxhqVPN platform.</div>
        <div>• <strong>Threat Intelligence</strong> — IP reputation, WHOIS, TLS inspection, threat feeds.</div>
        <div>• <strong>VPN Node Manager</strong> — Add, configure, enable/disable VPN server nodes.</div>
        <div>• <strong>Performance Monitor</strong> — Real-time CPU, RAM, bandwidth, and connection metrics per node.</div>

        <div className="font-bold text-primary/90 text-[8px] uppercase tracking-wider mt-3 mb-1">Revoking Access</div>
        <div>• Removing an employee immediately flags them for access revocation.</div>
        <div>• Complimentary access is fully revoked at their next login attempt.</div>
        <div>• Existing active sessions are unaffected until they log out or refresh — for immediate revocation, contact support to invalidate their Clerk session.</div>

        <div className="font-bold text-primary/90 text-[8px] uppercase tracking-wider mt-3 mb-1">Security Policy</div>
        <div>• Employees must not share login credentials or sessions with external parties.</div>
        <div>• Alpha Toolkit, SQLmap, and SilkWeb may only be used against targets the company has written authorization to test.</div>
        <div>• All terminal commands are audit-logged and may be reviewed by management.</div>
        <div>• Report security concerns to <span className="text-primary">support@proxhqvpn.com</span>.</div>
      </div>
    </div>
  );
}
