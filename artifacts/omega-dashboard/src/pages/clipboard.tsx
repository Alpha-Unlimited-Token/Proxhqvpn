import { useState } from "react";
import { Layout } from "@/components/layout";
import { useListHosts } from "@workspace/omega-api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Clipboard, RefreshCw, Send, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type ClipEntry = { id: number; hostId: number; content: string; contentType: string; capturedAt: string };

async function fetchClipboard(hostId: number): Promise<ClipEntry[]> {
  const r = await fetch(`${BASE}/api/clipboard/${hostId}`);
  if (!r.ok) throw new Error("Failed");
  return r.json();
}

async function setClipboard(hostId: number, content: string) {
  const r = await fetch(`${BASE}/api/clipboard/${hostId}/set`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  if (!r.ok) throw new Error("Failed");
  return r.json();
}

export default function ClipboardPage() {
  const [selectedHostId, setSelectedHostId] = useState<number | null>(null);
  const [sendText, setSendText] = useState("");
  const { data: hosts } = useListHosts();
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: entries, isLoading, refetch } = useQuery({
    queryKey: ["clipboard", selectedHostId],
    queryFn: () => fetchClipboard(selectedHostId!),
    enabled: !!selectedHostId,
    refetchInterval: 20000,
  });

  const sendMut = useMutation({
    mutationFn: () => setClipboard(selectedHostId!, sendText),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clipboard", selectedHostId] });
      setSendText("");
      toast({ title: "Clipboard updated on remote host" });
    },
  });

  const latest = entries?.[0];

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <Clipboard className="h-7 w-7 text-primary" /> Clipboard Manager
            </h1>
            <p className="text-muted-foreground mt-1">Read and write the clipboard on remote hosts.</p>
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
            <CardContent className="py-16 text-center text-muted-foreground">Select a host to manage its clipboard.</CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="bg-card/40 border-border">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
                  <Download className="h-4 w-4 text-primary" /> Remote Clipboard (Read)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-40 w-full" />
                ) : latest ? (
                  <div className="space-y-3">
                    <div className="bg-black/40 border border-border/50 rounded-md p-4 min-h-[160px] font-mono text-sm whitespace-pre-wrap break-all">
                      {latest.content}
                    </div>
                    <div className="flex justify-between text-[10px] text-muted-foreground/60">
                      <span>TYPE: {latest.contentType.toUpperCase()}</span>
                      <span>{new Date(latest.capturedAt).toLocaleString()}</span>
                    </div>
                    <Button
                      variant="outline" size="sm" className="w-full"
                      onClick={() => { navigator.clipboard.writeText(latest.content); toast({ title: "Copied to local clipboard" }); }}
                    >
                      <Clipboard className="h-3.5 w-3.5 mr-2" /> Copy to Local Clipboard
                    </Button>
                  </div>
                ) : (
                  <div className="h-40 flex items-center justify-center text-muted-foreground text-sm">
                    No clipboard data captured yet.
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-card/40 border-border">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
                  <Send className="h-4 w-4 text-primary" /> Send to Remote Clipboard (Write)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea
                  value={sendText}
                  onChange={e => setSendText(e.target.value)}
                  placeholder="Type text to place in the remote clipboard..."
                  className="min-h-[160px] bg-black/20 border-border/50 font-mono text-sm resize-none"
                />
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">{sendText.length} chars</span>
                  <Button
                    size="sm"
                    disabled={!sendText.trim() || sendMut.isPending}
                    onClick={() => sendMut.mutate()}
                    className="bg-primary text-black hover:bg-primary/90"
                  >
                    <Send className="h-3.5 w-3.5 mr-2" />
                    {sendMut.isPending ? "Sending..." : "Set Remote Clipboard"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {entries && entries.length > 1 && (
              <Card className="bg-card/40 border-border md:col-span-2">
                <CardHeader>
                  <CardTitle className="text-sm text-muted-foreground">Clipboard History</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {entries.slice(1).map(e => (
                      <div key={e.id} className="flex items-start gap-3 p-2 rounded border border-border/30 hover:bg-muted/10">
                        <Clipboard className="h-3.5 w-3.5 text-muted-foreground mt-1 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="font-mono text-xs truncate">{e.content}</p>
                          <p className="text-[10px] text-muted-foreground/50">{new Date(e.capturedAt).toLocaleString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
