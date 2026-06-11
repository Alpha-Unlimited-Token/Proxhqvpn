// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useState, useEffect } from "react";
import { Server, Wifi, WifiOff, RefreshCw, AlertTriangle, Loader2, Terminal, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const API = "/api/tool-runner";
const STALE_THRESHOLD_MS = 5 * 60 * 1000;

interface NodeAgent {
  nodeId: string;
  nodeName: string;
  version: string;
  ip: string;
  os: string | null;
  arch: string | null;
  toolsJson: string[] | null;
  status: string;
  lastSeenAt: string;
  createdAt: string;
}

function isStale(lastSeen: string): boolean {
  return Date.now() - new Date(lastSeen).getTime() > STALE_THRESHOLD_MS;
}

function timeSince(ts: string): string {
  const seconds = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export default function NodeHealth() {
  const [nodes, setNodes]     = useState<NodeAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  async function loadNodes() {
    setLoading(true);
    try {
      const r = await fetch(`${API}/node-agents`, { credentials: "include" });
      if (!r.ok) {
        const d = await r.json();
        throw new Error(d.error ?? "Failed to load node agents");
      }
      setNodes(await r.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadNodes(); }, []);

  const onlineCount = nodes.filter(n => !isStale(n.lastSeenAt)).length;

  return (
    <div className="p-4 md:p-6 space-y-5 font-mono min-h-screen">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Server className="w-5 h-5 text-[#00ff88]" />
            <h1 className="text-lg font-bold text-primary tracking-tight">Node Agent Health</h1>
            <Badge className="text-[9px] border-[#00ff88]/30 bg-[#00ff88]/10 text-[#00ff88] font-mono uppercase tracking-widest px-1.5">
              {onlineCount}/{nodes.length} online
            </Badge>
          </div>
          <p className="text-xs text-primary/40 max-w-xl leading-relaxed">
            Remote Parrot OS node agents — real-time health, tool availability, and check-in status.
          </p>
        </div>
        <button onClick={loadNodes} className="flex items-center gap-1.5 text-xs border border-primary/20 text-primary/50 hover:text-primary px-3 py-1.5 rounded-sm transition-colors">
          <RefreshCw className="w-3 h-3" /> Refresh
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Nodes", value: nodes.length, color: "text-primary" },
          { label: "Online", value: onlineCount, color: "text-[#00ff88]" },
          { label: "Stale (>5m)", value: nodes.length - onlineCount, color: "text-yellow-400" },
          { label: "Unique OS", value: new Set(nodes.map(n => n.os).filter(Boolean)).size, color: "text-cyan-400" },
        ].map(stat => (
          <div key={stat.label} className="border border-primary/10 rounded-sm p-3 bg-black/20">
            <div className={`text-xl font-bold font-mono ${stat.color}`}>{stat.value}</div>
            <div className="text-[10px] text-primary/30 mt-0.5 font-mono uppercase tracking-wide">{stat.label}</div>
          </div>
        ))}
      </div>

      {error && (
        <div className="border border-red-500/30 bg-red-900/10 text-red-400 text-xs p-3 rounded-sm flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />{error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-primary/40 text-sm py-12 justify-center">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading node agents...
        </div>
      ) : nodes.length === 0 ? (
        <div className="border border-primary/10 rounded-sm p-12 text-center">
          <Server className="w-10 h-10 text-primary/10 mx-auto mb-3" />
          <div className="text-sm text-primary/25">No node agents registered</div>
          <div className="text-xs text-primary/15 mt-2 max-w-sm mx-auto">
            Deploy the ProxhqVPN node agent on a Parrot OS machine and configure NODE_AGENT_PSK to connect.
          </div>
          <div className="mt-4 border border-primary/10 rounded-sm p-3 text-left text-[10px] font-mono text-primary/30 max-w-sm mx-auto">
            <div className="text-[#00ff88]/60 mb-1"># Quick-start (Parrot OS):</div>
            <div>curl -s /api/node-agent/install.sh | NODE_AGENT_PSK=YOUR_PSK bash</div>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {nodes.map(node => {
            const stale = isStale(node.lastSeenAt);
            const isExp = expanded === node.nodeId;
            const toolCount = node.toolsJson?.length ?? 0;
            return (
              <div key={node.nodeId}
                className={`border rounded-sm overflow-hidden ${stale ? "border-yellow-500/20" : "border-primary/10"}`}>
                <div className="flex items-center gap-3 p-3 cursor-pointer hover:bg-primary/3 transition-colors"
                  onClick={() => setExpanded(isExp ? null : node.nodeId)}>
                  {stale
                    ? <WifiOff className="w-4 h-4 text-yellow-400 shrink-0" />
                    : <Wifi className="w-4 h-4 text-[#00ff88] shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-primary font-mono">{node.nodeName}</span>
                      <span className="text-[9px] text-primary/40 font-mono">{node.nodeId}</span>
                    </div>
                    <div className="text-[10px] text-primary/30 font-mono">
                      {node.ip} {node.os && `· ${node.os}`} {node.arch && `(${node.arch})`}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-primary/40 font-mono shrink-0">
                    <Package className="w-3 h-3" />{toolCount} tools
                  </div>
                  <span className="text-[9px] font-mono text-primary/30 border border-primary/10 px-1.5 py-px shrink-0">
                    v{node.version}
                  </span>
                  <span className={`text-[10px] font-mono shrink-0 ${stale ? "text-yellow-400" : "text-[#00ff88]"}`}>
                    {timeSince(node.lastSeenAt)}
                  </span>
                </div>

                {isExp && (
                  <div className="border-t border-primary/10 p-4 space-y-3 bg-black/20">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-[10px] font-mono">
                      <div><span className="text-primary/30 uppercase">Node ID:</span><br /><span className="text-primary/70">{node.nodeId}</span></div>
                      <div><span className="text-primary/30 uppercase">IP:</span><br /><span className="text-primary/70">{node.ip}</span></div>
                      <div><span className="text-primary/30 uppercase">Version:</span><br /><span className="text-primary/70">{node.version}</span></div>
                      <div><span className="text-primary/30 uppercase">OS:</span><br /><span className="text-primary/70">{node.os ?? "Unknown"}</span></div>
                      <div><span className="text-primary/30 uppercase">Arch:</span><br /><span className="text-primary/70">{node.arch ?? "Unknown"}</span></div>
                      <div><span className="text-primary/30 uppercase">Last Seen:</span><br /><span className="text-primary/70">{new Date(node.lastSeenAt).toLocaleString()}</span></div>
                    </div>
                    {node.toolsJson && node.toolsJson.length > 0 && (
                      <div>
                        <div className="text-[9px] text-primary/20 uppercase tracking-widest mb-2">Installed Tools ({toolCount})</div>
                        <div className="flex flex-wrap gap-1">
                          {node.toolsJson.map(t => (
                            <span key={t} className="text-[9px] border border-[#00ff88]/20 text-[#00ff88]/60 px-1.5 py-px font-mono">{t}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Check-in docs */}
      <div className="border border-primary/10 rounded-sm p-4 bg-black/10">
        <div className="text-[10px] text-primary/30 uppercase tracking-widest font-mono mb-3 flex items-center gap-2">
          <Terminal className="w-3 h-3" />Node Agent Check-in API
        </div>
        <pre className="text-[10px] text-primary/50 font-mono leading-relaxed overflow-x-auto whitespace-pre-wrap">{`# POST /api/node-agent/checkin
# Header: x-node-agent-psk: <NODE_AGENT_PSK>
{
  "nodeId":   "parrot-node-01",
  "nodeName": "My Parrot Node",
  "version":  "1.0.0",
  "ip":       "203.0.113.5",
  "os":       "ParrotOS 6.1",
  "arch":     "x86_64",
  "tools":    ["nmap", "nuclei", "sqlmap", "ffuf"],
  "event":    { "type": "startup", "payload": {} }
}`}</pre>
      </div>
    </div>
  );
}
