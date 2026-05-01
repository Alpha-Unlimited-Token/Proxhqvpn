import { useState, useRef, useEffect } from "react";

import { useListHosts } from "@workspace/omega-api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { MessageSquare, Send, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type ChatMessage = { id: number; hostId: number; direction: string; message: string; createdAt: string };

async function fetchMessages(hostId: number): Promise<ChatMessage[]> {
  const r = await fetch(`${BASE}/api/chat/${hostId}/messages`);
  if (!r.ok) throw new Error("Failed");
  return r.json();
}

async function sendMessage(hostId: number, message: string) {
  const r = await fetch(`${BASE}/api/chat/${hostId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, direction: "out" }),
  });
  if (!r.ok) throw new Error("Failed");
  return r.json();
}

async function clearMessages(hostId: number) {
  await fetch(`${BASE}/api/chat/${hostId}/messages`, { method: "DELETE" });
}

export default function Chat() {
  const [selectedHostId, setSelectedHostId] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const { data: hosts } = useListHosts();
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: messages, isLoading } = useQuery({
    queryKey: ["chat", selectedHostId],
    queryFn: () => fetchMessages(selectedHostId!),
    enabled: !!selectedHostId,
    refetchInterval: 5000,
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMut = useMutation({
    mutationFn: () => sendMessage(selectedHostId!, draft),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chat", selectedHostId] });
      setDraft("");
    },
  });

  const clearMut = useMutation({
    mutationFn: () => clearMessages(selectedHostId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chat", selectedHostId] });
      toast({ title: "Chat cleared" });
    },
  });

  const handleSend = () => {
    if (draft.trim() && selectedHostId) sendMut.mutate();
  };

  const selectedHost = hosts?.find(h => h.id === selectedHostId);

  return (
    
      <div className="space-y-4 flex flex-col h-full">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <MessageSquare className="h-7 w-7 text-primary" /> Chat
            </h1>
            <p className="text-muted-foreground mt-1">Send and receive messages from remote hosts.</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={selectedHostId?.toString() ?? ""} onValueChange={v => setSelectedHostId(parseInt(v))}>
              <SelectTrigger className="w-[200px]"><SelectValue placeholder="Select a host..." /></SelectTrigger>
              <SelectContent>
                {hosts?.map(h => (
                  <SelectItem key={h.id} value={h.id.toString()}>
                    <span className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full inline-block ${h.status==='online'?'bg-green-500':h.status==='offline'?'bg-red-500':'bg-gray-500'}`} />
                      {h.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedHostId && (
              <Button variant="ghost" size="icon" onClick={() => clearMut.mutate()} title="Clear chat">
                <Trash2 className="h-4 w-4 text-muted-foreground" />
              </Button>
            )}
          </div>
        </div>

        {!selectedHostId ? (
          <Card className="border-border bg-card/40 flex-1">
            <CardContent className="py-16 text-center text-muted-foreground">Select a host to open a chat session.</CardContent>
          </Card>
        ) : (
          <Card className="border-border bg-card/40 flex flex-col" style={{ minHeight: "500px" }}>
            <CardHeader className="border-b border-border py-3 px-4">
              <CardTitle className="text-sm font-mono flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${selectedHost?.status==='online'?'bg-green-500 animate-pulse':'bg-red-500'}`} />
                {selectedHost?.label} — {selectedHost?.ip}:{selectedHost?.port}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-4 space-y-3 bg-black/20" style={{ minHeight: "380px", maxHeight: "480px" }}>
              {isLoading ? (
                <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-3/4" />)}</div>
              ) : !messages?.length ? (
                <p className="text-center text-muted-foreground text-sm py-8">No messages yet.</p>
              ) : (
                messages.map(msg => (
                  <div key={msg.id} className={`flex ${msg.direction === "out" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[70%] rounded-lg px-4 py-2 ${
                      msg.direction === "out"
                        ? "bg-primary/20 border border-primary/30 text-foreground"
                        : "bg-muted/50 border border-border text-foreground"
                    }`}>
                      <p className="text-sm font-mono">{msg.message}</p>
                      <p className="text-[10px] text-muted-foreground mt-1 font-mono">
                        {msg.direction === "out" ? "YOU" : selectedHost?.label} • {format(new Date(msg.createdAt), "HH:mm:ss")}
                      </p>
                    </div>
                  </div>
                ))
              )}
              <div ref={bottomRef} />
            </CardContent>
            <div className="border-t border-border p-3 flex gap-2">
              <Input
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSend()}
                placeholder="Type a message..."
                className="font-mono bg-black/30 border-border/50"
                disabled={sendMut.isPending}
              />
              <Button onClick={handleSend} disabled={!draft.trim() || sendMut.isPending} className="gap-2">
                <Send className="h-4 w-4" /> Send
              </Button>
            </div>
          </Card>
        )}
      </div>
    
  );
}
