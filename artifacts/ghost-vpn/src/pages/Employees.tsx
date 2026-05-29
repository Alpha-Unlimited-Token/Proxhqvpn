// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  Users, UserPlus, Trash2, Loader2, BadgeCheck,
  Mail, Clock, User, AlertCircle, Shield,
  RefreshCw, FileText, Award, ChevronDown, ChevronUp,
  Pencil, Check, X, ToggleLeft, ToggleRight, Inbox,
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
  isAmbassador: boolean;
  ambassadorPromoCode: string | null;
}

interface PendingAmbassador {
  id: number;
  name: string;
  bio: string | null;
  promo_code: string;
  status: string;
  contact_email: string | null;
  referral_count: number;
  created_at: string;
}

function formatDate(iso: string) {
  try { return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }); }
  catch { return iso; }
}

interface EditRowProps {
  emp: Employee;
  onSaved: () => void;
  onCancel: () => void;
}

function EditRow({ emp, onSaved, onCancel }: EditRowProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [displayName, setDisplayName] = useState(emp.displayName ?? "");
  const [note, setNote] = useState(emp.note ?? "");
  const [isAdminEmployee, setIsAdminEmployee] = useState(emp.isAdminEmployee);
  const [isAmbassador, setIsAmbassador] = useState(emp.isAmbassador);
  const [promoCode, setPromoCode] = useState(emp.ambassadorPromoCode ?? "");

  const save = async () => {
    setSaving(true);
    try {
      const r = await fetch(`${BASE}/api/employees/${emp.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: displayName.trim() || null,
          note: note.trim() || null,
          isAdminEmployee,
          isAmbassador,
          ambassadorPromoCode: isAmbassador ? (promoCode.trim().toUpperCase() || null) : null,
        }),
      });
      const d = await r.json();
      if (!r.ok) { toast({ title: d.error ?? "Save failed", variant: "destructive" }); return; }
      toast({ title: "Employee updated" });
      onSaved();
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border border-primary/30 rounded p-4 bg-primary/5 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-[8px] text-primary/40 font-mono uppercase block mb-1">Display Name</label>
          <input value={displayName} onChange={e => setDisplayName(e.target.value)}
            className="w-full bg-black border border-primary/20 text-primary text-xs font-mono px-2 py-1.5 focus:outline-none focus:border-primary/50 rounded" />
        </div>
        <div>
          <label className="text-[8px] text-primary/40 font-mono uppercase block mb-1">Internal Note</label>
          <input value={note} onChange={e => setNote(e.target.value)}
            className="w-full bg-black border border-primary/20 text-primary text-xs font-mono px-2 py-1.5 focus:outline-none focus:border-primary/50 rounded" />
        </div>
      </div>

      {/* Access level toggles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setIsAdminEmployee(v => !v)}
          className={`flex items-center gap-2 px-3 py-2 rounded border text-xs font-mono transition-colors ${
            isAdminEmployee
              ? "bg-yellow-900/20 border-yellow-500/40 text-yellow-400"
              : "bg-black border-primary/15 text-primary/40 hover:border-primary/30"
          }`}
        >
          {isAdminEmployee
            ? <ToggleRight className="w-4 h-4" />
            : <ToggleLeft className="w-4 h-4" />}
          Employee Admin Access
        </button>

        <button
          type="button"
          onClick={() => setIsAmbassador(v => !v)}
          className={`flex items-center gap-2 px-3 py-2 rounded border text-xs font-mono transition-colors ${
            isAmbassador
              ? "bg-orange-900/20 border-orange-500/40 text-orange-400"
              : "bg-black border-primary/15 text-primary/40 hover:border-primary/30"
          }`}
        >
          {isAmbassador
            ? <ToggleRight className="w-4 h-4" />
            : <ToggleLeft className="w-4 h-4" />}
          Ambassador Program
        </button>
      </div>

      {/* Promo code — only shown when ambassador is on */}
      {isAmbassador && (
        <div>
          <label className="text-[8px] text-orange-400/70 font-mono uppercase block mb-1">
            Ambassador Promo Code <span className="text-primary/30">(uppercase alphanumeric)</span>
          </label>
          <input
            value={promoCode}
            onChange={e => setPromoCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").substring(0, 20))}
            placeholder="e.g. CHARLIE10"
            className="w-full bg-black border border-orange-500/25 text-orange-300 text-xs font-mono px-2 py-1.5 focus:outline-none focus:border-orange-400/50 rounded uppercase"
          />
          <p className="text-[9px] text-primary/30 font-mono mt-1">
            This code will be active in the ambassador program immediately. Customers can enter it at checkout for a discount.
          </p>
        </div>
      )}

      <div className="flex items-center gap-3 pt-1">
        <button onClick={save} disabled={saving}
          className="flex items-center gap-2 text-[10px] font-mono text-black bg-primary hover:bg-primary/80 disabled:opacity-50 px-4 py-2 rounded transition-colors">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
          {saving ? "Saving…" : "Save Changes"}
        </button>
        <button onClick={onCancel}
          className="text-[9px] font-mono text-primary/40 hover:text-primary transition-colors flex items-center gap-1">
          <X className="w-3 h-3" /> Cancel
        </button>
      </div>
    </div>
  );
}

export default function Employees() {
  const { toast } = useToast();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading]     = useState(true);
  const [adding, setAdding]       = useState(false);
  const [deleting, setDeleting]   = useState<number | null>(null);
  const [showForm, setShowForm]   = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [email, setEmail]           = useState("");
  const [displayName, setDispName]  = useState("");
  const [note, setNote]             = useState("");
  const [isAdminEmp, setIsAdminEmp] = useState(false);
  const [isAmb, setIsAmb]           = useState(false);
  const [promoCode, setPromoCode]   = useState("");

  // Pending ambassador applications
  const [pendingAmbs, setPendingAmbs]         = useState<PendingAmbassador[]>([]);
  const [pendingLoading, setPendingLoading]   = useState(true);
  const [approvingId, setApprovingId]         = useState<number | null>(null);
  const [rejectingId, setRejectingId]         = useState<number | null>(null);
  const [notifyEmails, setNotifyEmails]       = useState<Record<number, string>>({});

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

  const loadPending = useCallback(async () => {
    setPendingLoading(true);
    try {
      const r = await fetch(`${BASE}/api/ambassadors/admin/all`, { credentials: "include" });
      if (!r.ok) { setPendingAmbs([]); return; }
      const data: PendingAmbassador[] = await r.json();
      setPendingAmbs(Array.isArray(data) ? data.filter(a => a.status === "pending") : []);
    } catch {
      setPendingAmbs([]);
    } finally {
      setPendingLoading(false);
    }
  }, []);

  const approveAmb = async (amb: PendingAmbassador) => {
    setApprovingId(amb.id);
    try {
      const notifyEmail = notifyEmails[amb.id]?.trim() || amb.contact_email || "";
      const r = await fetch(`${BASE}/api/ambassadors/admin/${amb.id}/status`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "approved", notifyEmail: notifyEmail || undefined }),
      });
      const d = await r.json();
      if (!r.ok) { toast({ title: d.error ?? "Failed to approve", variant: "destructive" }); return; }
      toast({
        title: `${amb.name} approved!`,
        description: d.emailSent ? `Welcome email sent to ${notifyEmail}` : "No email address — status updated",
      });
      loadPending();
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setApprovingId(null);
    }
  };

  const rejectAmb = async (amb: PendingAmbassador) => {
    if (!confirm(`Reject ${amb.name}'s ambassador application?`)) return;
    setRejectingId(amb.id);
    try {
      const r = await fetch(`${BASE}/api/ambassadors/admin/${amb.id}/status`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "rejected" }),
      });
      if (!r.ok) { const d = await r.json(); toast({ title: d.error ?? "Failed to reject", variant: "destructive" }); return; }
      toast({ title: `${amb.name}'s application rejected` });
      loadPending();
    } catch {
      toast({ title: "Network error", variant: "destructive" });
    } finally {
      setRejectingId(null);
    }
  };

  useEffect(() => { load(); loadPending(); }, [load, loadPending]);

  const add = async () => {
    if (!email.trim()) { toast({ title: "Email is required", variant: "destructive" }); return; }
    if (isAmb && !promoCode.trim()) { toast({ title: "Promo code is required when enabling ambassador", variant: "destructive" }); return; }
    setAdding(true);
    try {
      const r = await fetch(`${BASE}/api/employees`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          displayName: displayName.trim() || undefined,
          note: note.trim() || undefined,
          isAdminEmployee: isAdminEmp,
          isAmbassador: isAmb,
          ambassadorPromoCode: isAmb ? promoCode.trim().toUpperCase() : undefined,
        }),
      });
      const d = await r.json();
      if (!r.ok) { toast({ title: d.error ?? "Failed to add", variant: "destructive" }); return; }
      toast({ title: "Employee added", description: `${d.email} now has full complimentary access` });
      setEmail(""); setDispName(""); setNote(""); setIsAdminEmp(false); setIsAmb(false); setPromoCode(""); setShowForm(false);
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
          Employees listed here receive <strong>complimentary full access</strong> — WireGuard, all VPN features,
          Alpha Toolkit, and every Pro-tier feature — automatically, with no billing required.
          You can also give employees <strong>Admin</strong> or <strong>Ambassador</strong> access from each employee's edit panel.
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

          {/* Toggles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button type="button" onClick={() => setIsAdminEmp(v => !v)}
              className={`flex items-center gap-2 px-3 py-2 rounded border text-xs font-mono transition-colors ${
                isAdminEmp ? "bg-yellow-900/20 border-yellow-500/40 text-yellow-400" : "bg-black border-primary/15 text-primary/40 hover:border-primary/30"
              }`}>
              {isAdminEmp ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
              Employee Admin Access
            </button>
            <button type="button" onClick={() => setIsAmb(v => !v)}
              className={`flex items-center gap-2 px-3 py-2 rounded border text-xs font-mono transition-colors ${
                isAmb ? "bg-orange-900/20 border-orange-500/40 text-orange-400" : "bg-black border-primary/15 text-primary/40 hover:border-primary/30"
              }`}>
              {isAmb ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
              Ambassador Program
            </button>
          </div>

          {isAmb && (
            <div>
              <label className="text-[8px] text-orange-400/70 font-mono uppercase block mb-1">Ambassador Promo Code *</label>
              <input value={promoCode}
                onChange={e => setPromoCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").substring(0, 20))}
                placeholder="e.g. CHARLIE10"
                className="w-full bg-black border border-orange-500/25 text-orange-300 text-xs font-mono px-2 py-1.5 focus:outline-none focus:border-orange-400/50 rounded uppercase" />
            </div>
          )}

          <div className="flex items-center gap-3">
            <button onClick={add} disabled={adding}
              className="flex items-center gap-2 text-[10px] font-mono text-black bg-primary hover:bg-primary/80 disabled:opacity-50 px-4 py-2 rounded transition-colors">
              {adding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
              {adding ? "Adding…" : "Grant Access"}
            </button>
            <button onClick={() => { setShowForm(false); setEmail(""); setDispName(""); setNote(""); setIsAdminEmp(false); setIsAmb(false); setPromoCode(""); }}
              className="text-[9px] font-mono text-primary/40 hover:text-primary transition-colors">
              Cancel
            </button>
          </div>
          <div className="flex items-start gap-2 text-[9px] font-mono text-yellow-400/70 border border-yellow-500/15 rounded px-2 py-1.5">
            <AlertCircle className="w-3 h-3 mt-0.5 shrink-0" />
            Access is granted immediately. The employee must sign in with this exact email address.
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
            {employees.length} employee{employees.length !== 1 ? "s" : ""} · click edit to change access level or ambassador code
          </div>
          {employees.map(emp => (
            <div key={emp.id} className="border border-primary/15 hover:border-primary/25 rounded transition-colors">
              {editingId === emp.id ? (
                <div className="p-4">
                  <EditRow emp={emp} onSaved={() => { setEditingId(null); load(); }} onCancel={() => setEditingId(null)} />
                </div>
              ) : (
                <div className="p-4 flex items-start gap-4">
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
                      {emp.isAmbassador && (
                        <span className="flex items-center gap-1 text-[8px] text-orange-400 border border-orange-500/25 bg-orange-900/10 px-1.5 py-0.5 rounded font-mono">
                          <Award className="w-2.5 h-2.5" /> AMBASSADOR{emp.ambassadorPromoCode ? ` · ${emp.ambassadorPromoCode}` : ""}
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

                  {/* Actions */}
                  <div className="shrink-0 flex items-center gap-2">
                    <button onClick={() => setEditingId(emp.id)}
                      className="flex items-center gap-1.5 text-[9px] font-mono text-primary/50 hover:text-primary border border-primary/15 hover:border-primary/35 px-2.5 py-1.5 rounded transition-colors">
                      <Pencil className="w-3 h-3" /> Edit
                    </button>
                    <button onClick={() => remove(emp)} disabled={deleting === emp.id}
                      className="flex items-center gap-1.5 text-[9px] font-mono text-red-400/50 hover:text-red-400 border border-red-500/10 hover:border-red-500/30 px-2.5 py-1.5 rounded transition-colors disabled:opacity-40">
                      {deleting === emp.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                      Remove
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pending Ambassador Applications */}
      <div className="border border-orange-500/25 rounded p-4 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Inbox className="w-4 h-4 text-orange-400" />
            <span className="text-[10px] font-bold text-orange-400 uppercase tracking-widest">Pending Ambassador Applications</span>
            {pendingAmbs.length > 0 && (
              <span className="text-[8px] font-mono text-black bg-orange-400 rounded-full px-1.5 py-0.5 font-bold">{pendingAmbs.length}</span>
            )}
          </div>
          <button onClick={loadPending} className="flex items-center gap-1 text-[9px] font-mono text-primary/40 hover:text-primary border border-primary/15 hover:border-primary/30 px-2.5 py-1 rounded transition-colors">
            <RefreshCw className="w-3 h-3" /> Refresh
          </button>
        </div>

        {pendingLoading ? (
          <div className="flex items-center gap-2 text-[9px] font-mono text-primary/40 py-2">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading applications…
          </div>
        ) : pendingAmbs.length === 0 ? (
          <div className="text-[9px] font-mono text-primary/30 py-2">No pending applications.</div>
        ) : (
          <div className="space-y-2">
            {pendingAmbs.map(amb => (
              <div key={amb.id} className="border border-orange-500/15 rounded p-3 space-y-2 bg-orange-900/5">
                <div className="flex items-start gap-3 flex-wrap">
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[11px] font-bold text-orange-300 font-mono">{amb.name}</span>
                      <span className="text-[8px] font-mono text-orange-400/60 border border-orange-500/20 px-1.5 py-0.5 rounded tracking-widest">{amb.promo_code}</span>
                    </div>
                    {amb.bio && <div className="text-[9px] font-mono text-primary/50">{amb.bio}</div>}
                    <div className="text-[8px] font-mono text-primary/30">Applied {formatDate(amb.created_at)}</div>
                  </div>
                </div>

                {/* Email input + action buttons */}
                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    type="email"
                    value={notifyEmails[amb.id] ?? amb.contact_email ?? ""}
                    onChange={e => setNotifyEmails(prev => ({ ...prev, [amb.id]: e.target.value }))}
                    placeholder="Email to notify on approval"
                    className="flex-1 min-w-[200px] bg-black border border-orange-500/20 text-orange-200 text-[10px] font-mono px-2 py-1.5 focus:outline-none focus:border-orange-400/50 rounded"
                  />
                  <button
                    onClick={() => approveAmb(amb)}
                    disabled={approvingId === amb.id}
                    className="flex items-center gap-1.5 text-[9px] font-mono text-black bg-green-400 hover:bg-green-300 disabled:opacity-50 px-3 py-1.5 rounded transition-colors font-bold">
                    {approvingId === amb.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                    Approve
                  </button>
                  <button
                    onClick={() => rejectAmb(amb)}
                    disabled={rejectingId === amb.id}
                    className="flex items-center gap-1.5 text-[9px] font-mono text-red-400/70 hover:text-red-400 border border-red-500/20 hover:border-red-500/40 disabled:opacity-50 px-3 py-1.5 rounded transition-colors">
                    {rejectingId === amb.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info box */}
      <div className="border border-primary/10 rounded p-3 space-y-1.5 text-[9px] font-mono text-primary/83">
        <div className="flex items-center gap-1.5 text-primary font-bold uppercase text-[8px] tracking-widest">
          <Shield className="w-3 h-3" /> Access Level Guide
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2">
          <div className="border border-green-500/20 rounded p-2 space-y-1">
            <div className="flex items-center gap-1 text-green-400 font-bold text-[8px] uppercase"><BadgeCheck className="w-3 h-3" /> Full Access</div>
            <div className="text-primary/50">All VPN features, Alpha Toolkit, Command Center Pro — no subscription required.</div>
          </div>
          <div className="border border-yellow-500/20 rounded p-2 space-y-1">
            <div className="flex items-center gap-1 text-yellow-400 font-bold text-[8px] uppercase"><Shield className="w-3 h-3" /> Employee Admin</div>
            <div className="text-primary/50">Can access admin pages (dashboard, nodes, firewall, terminal, DB) — below owner level.</div>
          </div>
          <div className="border border-orange-500/20 rounded p-2 space-y-1">
            <div className="flex items-center gap-1 text-orange-400 font-bold text-[8px] uppercase"><Award className="w-3 h-3" /> Ambassador</div>
            <div className="text-primary/50">Listed on the ambassador page with their own promo code. 10% commission on referrals.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
