// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useState } from "react";

import { useListHosts } from "@workspace/omega-api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MessageSquareWarning, Send, RefreshCw, Info, AlertTriangle, XCircle, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type SentMsg = { id: number; hostId: number; title: string; body: string; iconType: string; buttonType: string; status: string; sentAt: string };

const ICONS = [
  { value: "info",     label: "Information", icon: Info,           cls: "text-blue-400" },
  { value: "warn",     label: "Warning",     icon: AlertTriangle,  cls: "text-yellow-400" },
  { value: "error",    label: "Error",       icon: XCircle,        cls: "text-red-400" },
  { value: "question", label: "Question",    icon: CheckCircle,    cls: "text-green-400" },
];

const BUTTONS = ["ok", "ok-cancel", "yes-no", "yes-no-cancel", "abort-retry-ignore", "retry-cancel"];

async function fetchMessages(hostId: number): Promise<SentMsg[]> {
  const r = await fetch(`${BASE}/api/messages/${hostId}`);
  if (!r.ok) throw new Error("Failed");
  return r.json();
}

async function sendMessage(hostId: number, title: string, body: string, iconType: string, buttonType: string) {
  const r = await fetch(`${BASE}/api/messages/${hostId}/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, body, iconType, buttonType }),
  });
  if (!r.ok) throw new Error("Failed");
  return r.json();
}

export default function MessageManager() {
  const [selectedHostId, setSelectedHostId] = useState<number | null>(null);
  const [title, setTitle] = useState("Alert");
  const [body, setBody] = useState("");
  const [iconType, setIconType] = useState("info");
  const [buttonType, setButtonType] = useState("ok");
  const { data: hosts } = useListHosts();
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: messages, isLoading, refetch } = useQuery({
    queryKey: ["messages", selectedHostId],
    queryFn: () => fetchMessages(selectedHostId!),
    enabled: !!selectedHostId,
  });

  const sendMut = useMutation({
    mutationFn: () => sendMessage(selectedHostId!, title, body, iconType, buttonType),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["messages", selectedHostId] });
      setBody("");
      toast({ title: "Message sent to remote host" });
    },
  });

  const selectedIcon = ICONS.find(i => i.value === iconType)!;
  const IconComp = selectedIcon.icon;

  return (
    
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <MessageSquareWarning className="h-7 w-7 text-primary" /> Message Manager
            </h1>
            <p className="text-muted-foreground mt-1">Send popup message boxes to remote hosts.</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={selectedHostId?.toString() ?? ""} onValueChange={v => setSelectedHostId(parseInt(v))}>
              <SelectTrigger className="w-[200px]"><SelectValue placeholder="Select a host..." /></SelectTrigger>
              <SelectContent>
                {hosts?.map(h => (
                  <SelectItem key={h.id} value={h.id.toString()}>
                    <span className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full inline-block ${h.status === "online" ? "bg-green-500" : h.status === "offline" ? "bg-red-500" : "bg-gray-500"}`} />
                      {h.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedHostId && (
              <Button variant="outline" size="icon" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {!selectedHostId ? (
          <Card className="border-border bg-card/40">
            <CardContent className="py-16 text-center text-muted-foreground">Select a host to send messages.</CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="bg-card/40 border-border">
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground">Compose Message</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground/60 mb-1 block">Title</label>
                  <Input value={title} onChange={e => setTitle(e.target.value)} className="bg-black/20 border-border/50 font-mono" placeholder="Message title..." />
                </div>

                <div>
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground/60 mb-1 block">Message Body</label>
                  <Textarea value={body} onChange={e => setBody(e.target.value)} className="bg-black/20 border-border/50 font-mono min-h-[100px] resize-none" placeholder="Enter message text..." />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground/60 mb-1 block">Icon</label>
                    <div className="grid grid-cols-2 gap-1">
                      {ICONS.map(ic => {
                        const IC = ic.icon;
                        return (
                          <button
                            key={ic.value}
                            onClick={() => setIconType(ic.value)}
                            className={`flex items-center gap-1.5 px-2 py-1.5 rounded border text-xs font-mono transition-colors ${iconType === ic.value ? "border-primary bg-primary/10 text-primary" : "border-border/50 hover:border-border"}`}
                          >
                            <IC className={`h-3 w-3 ${ic.cls}`} />
                            {ic.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground/60 mb-1 block">Buttons</label>
                    <div className="space-y-1">
                      {BUTTONS.map(b => (
                        <button
                          key={b}
                          onClick={() => setButtonType(b)}
                          className={`w-full text-left px-2 py-1 rounded border text-xs font-mono transition-colors ${buttonType === b ? "border-primary bg-primary/10 text-primary" : "border-border/50 hover:border-border"}`}
                        >
                          {b}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="border border-border/50 rounded-md p-3 bg-black/20">
                  <p className="text-[10px] text-muted-foreground/60 mb-2 uppercase tracking-wider">Preview</p>
                  <div className="flex items-start gap-2">
                    <IconComp className={`h-5 w-5 shrink-0 ${selectedIcon.cls}`} />
                    <div>
                      <p className="font-bold text-sm font-mono">{title || "Untitled"}</p>
                      <p className="text-sm text-muted-foreground font-mono">{body || "(empty message)"}</p>
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground/50 mt-2">Buttons: [{buttonType}]</p>
                </div>

                <Button
                  className="w-full bg-primary text-black hover:bg-primary/90"
                  disabled={!body.trim() || sendMut.isPending}
                  onClick={() => sendMut.mutate()}
                >
                  <Send className="h-4 w-4 mr-2" />
                  {sendMut.isPending ? "Sending..." : "Send Message"}
                </Button>
              </CardContent>
            </Card>

            <Card className="bg-card/40 border-border">
              <CardHeader>
                <CardTitle className="text-sm text-muted-foreground">Sent Messages</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-muted/20 rounded animate-pulse" />)}</div>
                ) : !messages || messages.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground text-sm">No messages sent yet.</div>
                ) : (
                  <div className="space-y-2 max-h-[480px] overflow-y-auto">
                    {messages.map(m => {
                      const ic = ICONS.find(i => i.value === m.iconType) ?? ICONS[0];
                      const IC = ic.icon;
                      return (
                        <div key={m.id} className="flex items-start gap-2 p-2 rounded border border-border/30 hover:bg-muted/10">
                          <IC className={`h-4 w-4 shrink-0 mt-0.5 ${ic.cls}`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-mono text-sm font-medium truncate">{m.title}</p>
                              <Badge variant="outline" className="text-[9px] shrink-0">{m.buttonType}</Badge>
                            </div>
                            <p className="font-mono text-xs text-muted-foreground truncate">{m.body}</p>
                            <p className="text-[10px] text-muted-foreground/50">{new Date(m.sentAt).toLocaleString()}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    
  );
}
