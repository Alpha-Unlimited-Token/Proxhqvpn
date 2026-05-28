// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useState, useEffect, useCallback } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  Users, UserPlus, Shield, Award, RefreshCw, Loader2,
  Search, CheckCircle2, XCircle, Mail, Clock, Crown,
  ChevronDown, ChevronUp, UserCheck, UserX,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface PlatformUser {
  clerkId: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  imageUrl: string | null;
  createdAt: string | null;
  lastSignIn: string | null;
  isAdmin: boolean;
  isEmployee: boolean;
  isAdminEmployee: boolean;
  employeeId: number | null;
  isAmbassador: boolean;
  ambassadorStatus: string | null;
  ambassadorPromoCode: string | null;
  stripeSubscriptionId: string | null;
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }); }
  catch { return iso; }
}

function fmtRelative(iso: string | null) {
  if (!iso) return "never";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return fmtDate(iso);
}

function Badge({ color, label }: { color: string; label: string }) {
  const colors: Record<string, string> = {
    green:  "bg-green-500/15 text-green-400 border-green-500/30",
    orange: "bg-orange-500/15 text-orange-400 border-orange-500/30",
    cyan:   "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
    yellow: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
    gray:   "bg-zinc-700/40 text-zinc-400 border-zinc-600/30",
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-mono border ${colors[color] ?? colors.gray}`}>
      {label}
    </span>
  );
}

interface ActionModalProps {
  user: PlatformUser;
  mode: "employee" | "ambassador";
  onClose: () => void;
  onDone: () => void;
}

function ActionModal({ user, mode, onClose, onDone }: ActionModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [displayName, setDisplayName] = useState(
    [user.firstName, user.lastName].filter(Boolean).join(" ") || ""
  );
  const [note, setNote] = useState("");
  const [promoCode, setPromoCode] = useState(
    (user.firstName ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").substring(0, 8) + "10"
  );
  const [bio, setBio] = useState("");

  const submit = async () => {
    setLoading(true);
    const url = `${BASE}/api/admin/users/${user.clerkId}/make-${mode}`;
    const body = mode === "employee"
      ? { displayName, note }
      : { promoCode: promoCode.toUpperCase(), displayName, bio };

    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = await r.json();
      if (!r.ok) {
        toast({ title: data.error ?? "Failed", variant: "destructive" });
        return;
      }
      toast({ title: mode === "employee" ? "Employee added" : "Ambassador approved", description: user.email ?? user.clerkId });
      onDone();
    } catch {
      toast({ title: "Request failed", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg w-full max-w-md mx-4 p-6 space-y-4">
        <div className="flex items-center gap-3">
          {mode === "employee" ? <Shield className="text-green-400 w-5 h-5" /> : <Award className="text-orange-400 w-5 h-5" />}
          <h2 className="font-mono text-sm font-semibold text-zinc-100 uppercase tracking-widest">
            {mode === "employee" ? "Add as Employee" : "Add as Ambassador"}
          </h2>
        </div>
        <p className="text-xs text-zinc-400 font-mono">{user.email}</p>

        <div className="space-y-3">
          <div>
            <label className="block text-xs text-zinc-400 font-mono mb-1">Display Name</label>
            <input
              className="w-full bg-zinc-800 border border-zinc-600 rounded px-3 py-2 text-sm text-zinc-100 font-mono focus:outline-none focus:border-green-500"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Display name"
            />
          </div>

          {mode === "ambassador" && (
            <>
              <div>
                <label className="block text-xs text-zinc-400 font-mono mb-1">Promo Code <span className="text-zinc-500">(uppercase alphanumeric)</span></label>
                <input
                  className="w-full bg-zinc-800 border border-zinc-600 rounded px-3 py-2 text-sm text-zinc-100 font-mono focus:outline-none focus:border-orange-500 uppercase"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").substring(0, 20))}
                  placeholder="MYCODE10"
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 font-mono mb-1">Bio <span className="text-zinc-500">(optional)</span></label>
                <textarea
                  className="w-full bg-zinc-800 border border-zinc-600 rounded px-3 py-2 text-sm text-zinc-100 font-mono focus:outline-none focus:border-orange-500 resize-none"
                  rows={2}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Short bio..."
                />
              </div>
            </>
          )}

          {mode === "employee" && (
            <div>
              <label className="block text-xs text-zinc-400 font-mono mb-1">Note <span className="text-zinc-500">(optional)</span></label>
              <input
                className="w-full bg-zinc-800 border border-zinc-600 rounded px-3 py-2 text-sm text-zinc-100 font-mono focus:outline-none focus:border-green-500"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Role or notes..."
              />
            </div>
          )}
        </div>

        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-xs font-mono text-zinc-400 border border-zinc-600 rounded hover:border-zinc-400 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={loading}
            className={`flex-1 px-4 py-2 text-xs font-mono font-semibold rounded flex items-center justify-center gap-2 transition-colors ${
              mode === "employee"
                ? "bg-green-600 hover:bg-green-500 text-black"
                : "bg-orange-600 hover:bg-orange-500 text-black"
            } disabled:opacity-50`}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

export default function UserManagement() {
  const { toast } = useToast();
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "subscribers" | "employees" | "ambassadors">("all");
  const [modal, setModal] = useState<{ user: PlatformUser; mode: "employee" | "ambassador" } | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`${BASE}/api/admin/users`, { credentials: "include" });
      if (!r.ok) { toast({ title: "Failed to load users", variant: "destructive" }); return; }
      const data = await r.json();
      setUsers(Array.isArray(data) ? data : []);
    } catch {
      toast({ title: "Request failed", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const removeEmployee = async (user: PlatformUser) => {
    if (!confirm(`Remove ${user.email} as employee?`)) return;
    setRemoving(user.clerkId);
    try {
      const r = await fetch(`${BASE}/api/admin/users/${user.clerkId}/remove-employee`, {
        method: "DELETE", credentials: "include",
      });
      const data = await r.json();
      if (!r.ok) { toast({ title: data.error ?? "Failed", variant: "destructive" }); return; }
      toast({ title: "Employee removed" });
      load();
    } catch {
      toast({ title: "Request failed", variant: "destructive" });
    } finally {
      setRemoving(null);
    }
  };

  const filtered = users.filter((u) => {
    const q = search.toLowerCase();
    const matchQ = !q ||
      (u.email ?? "").toLowerCase().includes(q) ||
      (u.firstName ?? "").toLowerCase().includes(q) ||
      (u.lastName ?? "").toLowerCase().includes(q);

    const matchF =
      filter === "all" ? true :
      filter === "subscribers" ? !!u.stripeSubscriptionId :
      filter === "employees" ? u.isEmployee :
      filter === "ambassadors" ? u.isAmbassador :
      true;

    return matchQ && matchF;
  });

  return (
    <div className="min-h-screen bg-black text-zinc-100 font-mono p-4 md:p-6">
      {modal && (
        <ActionModal
          user={modal.user}
          mode={modal.mode}
          onClose={() => setModal(null)}
          onDone={() => { setModal(null); load(); }}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Users className="text-green-400 w-6 h-6" />
          <div>
            <h1 className="text-sm font-semibold uppercase tracking-widest text-zinc-100">User Management</h1>
            <p className="text-xs text-zinc-500 mt-0.5">All signed-up accounts — manage roles and access</p>
          </div>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 text-xs border border-zinc-700 text-zinc-400 hover:text-zinc-200 rounded transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: "Total Accounts", value: users.length, color: "text-zinc-200" },
          { label: "Subscribers", value: users.filter((u) => u.stripeSubscriptionId).length, color: "text-green-400" },
          { label: "Employees", value: users.filter((u) => u.isEmployee).length, color: "text-cyan-400" },
          { label: "Ambassadors", value: users.filter((u) => u.isAmbassador).length, color: "text-orange-400" },
        ].map((s) => (
          <div key={s.label} className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-zinc-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
          <input
            className="w-full bg-zinc-900 border border-zinc-700 rounded pl-9 pr-3 py-2 text-sm text-zinc-100 font-mono focus:outline-none focus:border-green-500 placeholder:text-zinc-600"
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          {(["all", "subscribers", "employees", "ambassadors"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-2 text-xs rounded capitalize transition-colors ${
                filter === f
                  ? "bg-green-600/20 text-green-400 border border-green-600/40"
                  : "bg-zinc-900 text-zinc-500 border border-zinc-700 hover:text-zinc-300"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* User list */}
      {loading ? (
        <div className="flex items-center justify-center py-20 gap-3 text-zinc-500 text-sm">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading accounts...
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-zinc-600 text-sm">No accounts found</div>
      ) : (
        <div className="space-y-2">
          {filtered.map((u) => {
            const name = [u.firstName, u.lastName].filter(Boolean).join(" ") || null;
            const isExpanded = expanded === u.clerkId;
            return (
              <div key={u.clerkId} className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-lg transition-colors">
                {/* Main row */}
                <div
                  className="flex items-center gap-4 p-4 cursor-pointer"
                  onClick={() => setExpanded(isExpanded ? null : u.clerkId)}
                >
                  {/* Avatar */}
                  <div className="flex-shrink-0 w-9 h-9 rounded-full bg-zinc-800 border border-zinc-700 overflow-hidden flex items-center justify-center">
                    {u.imageUrl
                      ? <img src={u.imageUrl} alt="" className="w-full h-full object-cover" />
                      : <span className="text-xs text-zinc-400">{(u.email ?? "?")[0].toUpperCase()}</span>
                    }
                  </div>

                  {/* Name + email */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm text-zinc-100 truncate">{name ?? u.email ?? u.clerkId}</span>
                      {u.isAdmin && <Badge color="yellow" label="Owner" />}
                      {u.isEmployee && <Badge color="cyan" label={u.isAdminEmployee ? "Admin Employee" : "Employee"} />}
                      {u.isAmbassador && <Badge color="orange" label={`Ambassador${u.ambassadorPromoCode ? ` · ${u.ambassadorPromoCode}` : ""}`} />}
                      {u.stripeSubscriptionId && <Badge color="green" label="Subscriber" />}
                    </div>
                    <div className="text-xs text-zinc-500 mt-0.5 truncate">{u.email ?? "no email"}</div>
                  </div>

                  {/* Dates */}
                  <div className="hidden md:flex flex-col items-end gap-0.5 text-right">
                    <div className="text-xs text-zinc-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Joined {fmtDate(u.createdAt)}
                    </div>
                    <div className="text-xs text-zinc-600">
                      Last seen {fmtRelative(u.lastSignIn)}
                    </div>
                  </div>

                  {isExpanded
                    ? <ChevronUp className="w-4 h-4 text-zinc-500 flex-shrink-0" />
                    : <ChevronDown className="w-4 h-4 text-zinc-500 flex-shrink-0" />
                  }
                </div>

                {/* Expanded actions */}
                {isExpanded && (
                  <div className="border-t border-zinc-800 px-4 py-3 flex flex-wrap gap-2">
                    <div className="flex-1 min-w-0 text-xs text-zinc-500 space-y-1 mb-2 md:mb-0">
                      <div className="flex items-center gap-1.5"><Mail className="w-3 h-3" />{u.email ?? "—"}</div>
                      <div className="flex items-center gap-1.5"><Clock className="w-3 h-3" />Signed up {fmtDate(u.createdAt)}</div>
                      <div className="text-zinc-600 font-mono text-xs mt-0.5">ID: {u.clerkId}</div>
                    </div>
                    <div className="flex flex-wrap gap-2 items-start">
                      {!u.isEmployee && !u.isAdmin && (
                        <button
                          onClick={() => setModal({ user: u, mode: "employee" })}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-cyan-600/15 border border-cyan-600/30 text-cyan-400 hover:bg-cyan-600/25 rounded transition-colors"
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                          Add as Employee
                        </button>
                      )}
                      {u.isEmployee && !u.isAdmin && (
                        <button
                          onClick={() => removeEmployee(u)}
                          disabled={removing === u.clerkId}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-red-600/10 border border-red-600/25 text-red-400 hover:bg-red-600/20 rounded transition-colors disabled:opacity-50"
                        >
                          {removing === u.clerkId ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserX className="w-3.5 h-3.5" />}
                          Remove Employee
                        </button>
                      )}
                      {!u.isAmbassador && (
                        <button
                          onClick={() => setModal({ user: u, mode: "ambassador" })}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-orange-600/15 border border-orange-600/30 text-orange-400 hover:bg-orange-600/25 rounded transition-colors"
                        >
                          <Award className="w-3.5 h-3.5" />
                          Add as Ambassador
                        </button>
                      )}
                      {u.isAmbassador && (
                        <span className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-orange-600/10 border border-orange-600/20 text-orange-500 rounded">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Ambassador · {u.ambassadorPromoCode}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
