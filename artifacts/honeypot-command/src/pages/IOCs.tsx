// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useState } from "react";
import { useListHoneypotIocs, useCreateHoneypotIoc, useDeleteHoneypotIoc } from "@/hooks/useApi";
import { useQueryClient } from "@tanstack/react-query";
import { getListHoneypotIocsQueryKey } from "@workspace/api-client-react";
import { Database, Plus, Trash2, X, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const IOC_TYPES = ["ip", "domain", "url", "sha256", "md5", "email", "asn", "cidr", "useragent"];

const TYPE_COLORS: Record<string, string> = {
  ip: "bg-destructive/10 text-destructive border-destructive/20",
  domain: "bg-orange-500/10 text-orange-400 border-orange-400/20",
  url: "bg-yellow-500/10 text-yellow-400 border-yellow-400/20",
  sha256: "bg-purple-500/10 text-purple-400 border-purple-400/20",
  md5: "bg-purple-500/10 text-purple-400 border-purple-400/20",
  email: "bg-accent/10 text-accent border-accent/20",
  asn: "bg-primary/10 text-primary border-primary/20",
  cidr: "bg-primary/10 text-primary border-primary/20",
  useragent: "bg-muted text-muted-foreground border-border",
};

function AddIocModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const create = useCreateHoneypotIoc();
  const [form, setForm] = useState({ type: "ip", value: "", description: "", confidence: "80" });

  const submit = async () => {
    if (!form.value) { toast({ title: "Value required", variant: "destructive" }); return; }
    try {
      await create.mutateAsync({ data: { type: form.type, value: form.value, description: form.description || undefined, confidence: Number(form.confidence) || 80 } });
      await qc.invalidateQueries({ queryKey: getListHoneypotIocsQueryKey() });
      toast({ title: "IOC added" });
      onClose();
    } catch {
      toast({ title: "Failed to add IOC", variant: "destructive" });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-card border border-border rounded-lg w-full max-w-md p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-mono font-bold text-primary">Add Indicator of Compromise</h2>
          <button onClick={onClose}><X className="w-4 h-4 text-muted-foreground" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-muted-foreground font-mono mb-1">TYPE</label>
            <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}
              className="w-full bg-input border border-border rounded px-2.5 py-1.5 text-sm font-mono focus:outline-none focus:border-primary">
              {IOC_TYPES.map(t => <option key={t} value={t}>{t.toUpperCase()}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground font-mono mb-1">VALUE</label>
            <input value={form.value} onChange={e => setForm({ ...form, value: e.target.value })}
              placeholder={form.type === "ip" ? "1.2.3.4" : form.type === "sha256" ? "abc123..." : "indicator value"}
              className="w-full bg-input border border-border rounded px-2.5 py-1.5 text-sm font-mono focus:outline-none focus:border-primary" />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground font-mono mb-1">DESCRIPTION</label>
            <input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="Optional description"
              className="w-full bg-input border border-border rounded px-2.5 py-1.5 text-sm font-mono focus:outline-none focus:border-primary" />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground font-mono mb-1">CONFIDENCE (0-100)</label>
            <input type="number" min="0" max="100" value={form.confidence} onChange={e => setForm({ ...form, confidence: e.target.value })}
              className="w-full bg-input border border-border rounded px-2.5 py-1.5 text-sm font-mono focus:outline-none focus:border-primary" />
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-3 py-1.5 text-sm font-mono border border-border rounded hover:bg-muted">Cancel</button>
          <button onClick={submit} disabled={create.isPending}
            className="px-4 py-1.5 text-sm font-mono bg-primary text-primary-foreground rounded hover:opacity-90 disabled:opacity-50">
            {create.isPending ? "Adding..." : "Add IOC"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function IOCs() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string>("");
  const { data: iocs, isLoading } = useListHoneypotIocs(typeFilter ? { type: typeFilter } : undefined);
  const deleteFn = useDeleteHoneypotIoc();

  const del = async (id: number, value: string) => {
    if (!confirm(`Remove IOC "${value}"?`)) return;
    await deleteFn.mutateAsync({ id });
    await qc.invalidateQueries({ queryKey: getListHoneypotIocsQueryKey() });
    toast({ title: "IOC removed" });
  };

  const exportCsv = () => {
    if (!iocs?.length) return;
    const rows = [
      "type,value,confidence,source,description,firstSeen,lastSeen",
      ...(iocs as any[]).map((i: any) =>
        `${i.type},${i.value},${i.confidence},${i.source},"${i.description ?? ""}",${i.firstSeenAt},${i.lastSeenAt}`
      ),
    ];
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "honeypot-iocs.csv";
    a.click();
  };

  return (
    <div className="p-6 space-y-5">
      {showAdd && <AddIocModal onClose={() => setShowAdd(false)} />}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-accent" />
          <h1 className="text-lg font-bold font-mono">Indicators of Compromise</h1>
          {iocs && <span className="text-xs font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded">{iocs.length} total</span>}
        </div>
        <div className="flex gap-2">
          <button onClick={exportCsv} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono border border-border rounded hover:bg-muted">
            <Download className="w-3 h-3" /> Export CSV
          </button>
          <button onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-mono bg-primary text-primary-foreground rounded hover:opacity-90">
            <Plus className="w-4 h-4" /> Add IOC
          </button>
        </div>
      </div>

      {/* Type filter */}
      <div className="flex gap-1.5 flex-wrap">
        <button onClick={() => setTypeFilter("")}
          className={cn("px-2.5 py-1 rounded text-xs font-mono border", !typeFilter ? "bg-primary/10 text-primary border-primary/20" : "border-border text-muted-foreground hover:bg-muted")}>
          ALL
        </button>
        {IOC_TYPES.map(t => (
          <button key={t} onClick={() => setTypeFilter(t === typeFilter ? "" : t)}
            className={cn("px-2.5 py-1 rounded text-xs font-mono border", typeFilter === t ? "bg-primary/10 text-primary border-primary/20" : "border-border text-muted-foreground hover:bg-muted")}>
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-muted-foreground text-sm font-mono animate-pulse">Loading IOCs...</div>
      ) : !iocs?.length ? (
        <div className="border border-dashed border-border rounded-lg py-16 flex flex-col items-center gap-2">
          <Database className="w-10 h-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground font-mono">No IOCs yet.</p>
          <p className="text-xs text-muted-foreground/60">IOCs are auto-generated from attacker activity and payloads.</p>
        </div>
      ) : (
        <div className="border border-border rounded-lg bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono">
              <thead>
                <tr className="bg-muted/30 border-b border-border text-muted-foreground">
                  <th className="px-4 py-2.5 text-left font-normal">TYPE</th>
                  <th className="px-4 py-2.5 text-left font-normal">VALUE</th>
                  <th className="px-4 py-2.5 text-left font-normal">CONFIDENCE</th>
                  <th className="px-4 py-2.5 text-left font-normal">SOURCE</th>
                  <th className="px-4 py-2.5 text-left font-normal">DESCRIPTION</th>
                  <th className="px-4 py-2.5 text-left font-normal">FIRST SEEN</th>
                  <th className="px-4 py-2.5 text-left font-normal w-8"></th>
                </tr>
              </thead>
              <tbody>
                {(iocs as any[]).map((ioc: any) => (
                  <tr key={ioc.id} className="border-b border-border/50 hover:bg-muted/20">
                    <td className="px-4 py-2.5">
                      <span className={cn("px-1.5 py-0.5 rounded border text-[10px]", TYPE_COLORS[ioc.type] ?? "bg-muted text-muted-foreground border-border")}>
                        {ioc.type.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-foreground max-w-xs">
                      <code className="break-all">{ioc.value}</code>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <div className="w-16 bg-muted rounded-full h-1.5">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${ioc.confidence}%` }} />
                        </div>
                        <span className="text-muted-foreground">{ioc.confidence}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{ioc.source}</td>
                    <td className="px-4 py-2.5 text-muted-foreground truncate max-w-[160px]">{ioc.description ?? "—"}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{new Date(ioc.firstSeenAt).toLocaleDateString()}</td>
                    <td className="px-4 py-2.5">
                      <button onClick={() => del(ioc.id, ioc.value)} className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
