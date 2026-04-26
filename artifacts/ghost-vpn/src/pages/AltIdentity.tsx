import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  User, RefreshCw, Copy, Save, Trash2, Zap,
  Mail, Phone, MapPin, Briefcase, Calendar, Lock, Info,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const api  = (path: string, opts?: RequestInit) =>
  fetch(`${BASE}/api/altid${path}`, { credentials: "include", headers: { "Content-Type": "application/json" }, ...opts }).then(r => r.json());

interface Identity {
  id: string; gender: string; firstName: string; lastName: string; fullName: string;
  username: string; email: string; phone: string; dob: string; age: number;
  address: string; city: string; state: string; zip: string;
  occupation: string; password: string; generatedAt: string; note: string;
}

function CopyField({ label, value, icon: Icon }: { label: string; value: string; icon?: any }) {
  const { toast } = useToast();
  const copy = () => { navigator.clipboard.writeText(value); toast({ title: `${label} Copied`, description: value.length > 30 ? value.slice(0, 30) + "…" : value }); };
  return (
    <div className="flex items-center gap-2 group border-b border-primary/8 pb-2 last:border-0 last:pb-0">
      {Icon && <Icon className="w-3 h-3 text-primary/30 shrink-0" />}
      <div className="flex-1 min-w-0">
        <div className="text-[8px] font-mono text-primary/30 uppercase tracking-widest">{label}</div>
        <div className="text-[10px] font-mono text-primary truncate">{value}</div>
      </div>
      <button onClick={copy} className="shrink-0 text-primary/15 hover:text-primary/60 transition-colors opacity-0 group-hover:opacity-100">
        <Copy className="w-3 h-3" />
      </button>
    </div>
  );
}

export default function AltIdentity() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [current, setCurrent] = useState<Identity | null>(null);

  const { data: savedData } = useQuery<{ identities: Identity[] }>({
    queryKey: ["altid-saved"],
    queryFn: () => api("/saved"),
  });

  const generate = useMutation({
    mutationFn: () => api("/generate"),
    onSuccess: (d) => setCurrent(d.identity),
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const saveId = useMutation({
    mutationFn: (id: Identity) => api("/saved", { method: "POST", body: JSON.stringify(id) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["altid-saved"] }); toast({ title: "Identity Saved" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteId = useMutation({
    mutationFn: (id: string) => api(`/saved/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["altid-saved"] }); toast({ title: "Identity Deleted" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const copyAll = (identity: Identity) => {
    const text = `Name: ${identity.fullName}
Username: ${identity.username}
Email: ${identity.email}
Phone: ${identity.phone}
DOB: ${identity.dob} (age ${identity.age})
Address: ${identity.address}, ${identity.city}, ${identity.state} ${identity.zip}
Occupation: ${identity.occupation}
Password: ${identity.password}`;
    navigator.clipboard.writeText(text);
    toast({ title: "Identity Copied", description: "All fields copied to clipboard" });
  };

  const saved = savedData?.identities ?? [];

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold tracking-tighter uppercase flex items-center gap-2">
            <User className="w-6 h-6" /> Alternative Identity
          </h2>
          <p className="text-sm text-primary/50 mt-1 font-mono">
            Generate fake personas to protect your real identity when signing up to online services
          </p>
        </div>
        <Badge variant="outline" className="text-xs font-mono border-primary/30 text-primary/50">
          {saved.length} SAVED
        </Badge>
      </div>

      {/* Privacy notice */}
      <div className="border border-primary/20 bg-primary/3 p-3 flex items-start gap-3">
        <Info className="w-3.5 h-3.5 text-primary/40 shrink-0 mt-0.5" />
        <p className="text-[10px] font-mono text-primary/40 leading-relaxed">
          Generated identities are for <strong className="text-primary/60">privacy protection only</strong> — use when a website demands unnecessary personal data. Do not use for fraud, impersonation, or any illegal activity. All data is randomly generated and does not correspond to real people.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left: Generator */}
        <div className="space-y-4">
          <Button
            onClick={() => generate.mutate()}
            disabled={generate.isPending}
            className="w-full bg-primary text-black hover:bg-primary/90 font-mono uppercase tracking-widest h-12"
          >
            {generate.isPending ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />}
            GENERATE NEW IDENTITY
          </Button>

          {current && (
            <div className="border border-primary/20 bg-black p-4 space-y-3">
              {/* Identity header */}
              <div className="flex items-center gap-3 pb-3 border-b border-primary/15">
                <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <User className="w-5 h-5 text-primary/50" />
                </div>
                <div>
                  <div className="text-sm font-mono font-bold text-primary">{current.fullName}</div>
                  <div className="text-[9px] font-mono text-primary/40 uppercase">{current.occupation} · {current.gender}</div>
                </div>
              </div>

              {/* Fields */}
              <div className="space-y-2">
                <CopyField label="Username"   value={current.username}                                    icon={User} />
                <CopyField label="Email"       value={current.email}                                       icon={Mail} />
                <CopyField label="Password"    value={current.password}                                    icon={Lock} />
                <CopyField label="Phone"       value={current.phone}                                       icon={Phone} />
                <CopyField label="Date of Birth" value={`${current.dob} (age ${current.age})`}            icon={Calendar} />
                <CopyField label="Address"     value={`${current.address}, ${current.city}, ${current.state} ${current.zip}`} icon={MapPin} />
                <CopyField label="Occupation"  value={current.occupation}                                  icon={Briefcase} />
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-2 border-t border-primary/10">
                <button onClick={() => copyAll(current)}
                  className="flex-1 flex items-center justify-center gap-1.5 text-[9px] font-mono py-1.5 border border-primary/30 text-primary/60 hover:text-primary hover:border-primary/60 transition-colors">
                  <Copy className="w-3 h-3" /> COPY ALL
                </button>
                <button onClick={() => saveId.mutate(current)} disabled={saveId.isPending}
                  className="flex-1 flex items-center justify-center gap-1.5 text-[9px] font-mono py-1.5 border border-primary/40 text-primary/70 hover:text-primary hover:border-primary/70 transition-colors disabled:opacity-40">
                  <Save className="w-3 h-3" /> SAVE
                </button>
              </div>

              <div className="text-[8px] font-mono text-primary/20 text-right">
                Generated {format(new Date(current.generatedAt), "HH:mm:ss")}
              </div>
            </div>
          )}

          {!current && (
            <div className="border border-primary/10 p-8 flex flex-col items-center gap-3 text-center">
              <User className="w-8 h-8 text-primary/15" />
              <div className="text-[10px] font-mono text-primary/25 uppercase tracking-widest">Press generate to create a fake identity</div>
            </div>
          )}
        </div>

        {/* Right: Saved identities */}
        <div className="space-y-4">
          <div className="border border-primary/20 bg-black p-4 space-y-3">
            <div className="text-[10px] font-mono text-primary/40 tracking-widest">SAVED IDENTITIES ({saved.length})</div>
            {saved.length > 0 ? (
              <div className="space-y-2 max-h-[500px] overflow-auto">
                {saved.map(id => (
                  <div key={id.id} className="border border-primary/10 p-3 group hover:border-primary/25 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-[10px] font-mono font-bold text-primary">{id.fullName}</div>
                        <div className="text-[9px] font-mono text-primary/40 truncate">{id.email}</div>
                        <div className="text-[8px] font-mono text-primary/25">{id.occupation} · {id.city}, {id.state}</div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => setCurrent(id)}
                          className="text-[8px] font-mono text-primary/30 hover:text-primary border border-primary/15 hover:border-primary/40 px-1.5 py-0.5 transition-colors opacity-0 group-hover:opacity-100">
                          VIEW
                        </button>
                        <button onClick={() => copyAll(id)}
                          className="text-primary/15 hover:text-primary/50 transition-colors opacity-0 group-hover:opacity-100">
                          <Copy className="w-3 h-3" />
                        </button>
                        <button onClick={() => deleteId.mutate(id.id)}
                          className="text-primary/15 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-[10px] font-mono text-primary/20 py-6 text-center">No saved identities</div>
            )}
          </div>

          {/* Tips */}
          <div className="border border-primary/10 p-4 space-y-2">
            <div className="text-[9px] font-mono text-primary/35 tracking-widest font-bold">BEST PRACTICES</div>
            {[
              "Use a unique email for each service — forward from a real account later",
              "Use the generated password in a password manager, then change it after signup",
              "Use a VOIP number (Google Voice, Skype) to match the generated phone",
              "Never use these identities for financial transactions or government services",
            ].map(tip => (
              <div key={tip} className="text-[9px] font-mono text-primary/30 flex gap-1.5">
                <span className="text-primary/40 shrink-0">→</span> {tip}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
