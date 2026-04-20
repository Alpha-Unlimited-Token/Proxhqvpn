import { useState, useCallback } from "react";
import { Database, Play, Plus, Trash2, Globe, Table, RefreshCw, Link, Unlink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { TableBody, TableCell, TableHead, TableHeader, TableRow, Table as UITable } from "@/components/ui/table";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

type Mode = "local" | "external" | "http";

interface ExtConn { id: string; label: string; connString: string; dbType: string; connectedAt: string; queryCount: number; lastUsed: string }
interface Schema { tables: { table_schema: string; table_name: string; table_type: string }[]; columns: { table_name: string; column_name: string; data_type: string }[] }

export default function SqlInterface() {
  const { toast }         = useToast();
  const [mode, setMode]   = useState<Mode>("local");
  const [query, setQuery] = useState("SELECT * FROM nodes LIMIT 10;");
  const [result, setResult] = useState<any>(null);
  const [running, setRunning] = useState(false);

  // External connection state
  const [connections, setConnections] = useState<ExtConn[]>([]);
  const [selectedConn, setSelectedConn] = useState<string>("");
  const [newConnStr, setNewConnStr] = useState("postgresql://user:password@host:5432/database");
  const [newConnLabel, setNewConnLabel] = useState("Remote DB");
  const [newConnSsl, setNewConnSsl] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [schema, setSchema] = useState<Schema | null>(null);
  const [schemaVisible, setSchemaVisible] = useState(false);

  // HTTP query state
  const [httpUrl, setHttpUrl] = useState("https://api.example.com/data");
  const [httpMethod, setHttpMethod] = useState("GET");
  const [httpPayload, setHttpPayload] = useState("");
  const [httpHeaders, setHttpHeaders] = useState('{"Authorization": "Bearer TOKEN"}');

  const loadConnections = useCallback(async () => {
    try {
      const r = await fetch(`${BASE}/api/sql/connections`);
      const d = await r.json();
      setConnections(d.connections ?? []);
    } catch { }
  }, []);

  const connect = async () => {
    if (!newConnStr.trim()) return;
    setConnecting(true);
    try {
      const r = await fetch(`${BASE}/api/sql/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ connectionString: newConnStr, label: newConnLabel, ssl: newConnSsl }),
      });
      const d = await r.json();
      if (r.ok) {
        toast({ title: `Connected: ${d.label}`, description: `Connection ID: ${d.id}` });
        await loadConnections();
        setSelectedConn(d.id);
        setMode("external");
      } else {
        toast({ title: "Connection failed", description: d.error, variant: "destructive" });
      }
    } finally { setConnecting(false); }
  };

  const disconnect = async (id: string) => {
    await fetch(`${BASE}/api/sql/connections/${id}`, { method: "DELETE" });
    toast({ title: "Disconnected" });
    if (selectedConn === id) { setSelectedConn(""); setMode("local"); }
    loadConnections();
  };

  const loadSchema = async (connId: string) => {
    try {
      const r = await fetch(`${BASE}/api/sql/schema/${connId}`);
      const d = await r.json();
      setSchema(d);
      setSchemaVisible(true);
    } catch { }
  };

  const execQuery = async () => {
    if (!query.trim()) return;
    setRunning(true);
    setResult(null);
    const t0 = Date.now();
    try {
      if (mode === "local") {
        const r = await fetch(`${BASE}/api/sql/query`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query }),
        });
        setResult(await r.json());
      } else if (mode === "external" && selectedConn) {
        const r = await fetch(`${BASE}/api/sql/external-query`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ connectionId: selectedConn, query }),
        });
        setResult(await r.json());
      } else if (mode === "http") {
        let parsedHeaders: Record<string, string> = {};
        try { parsedHeaders = JSON.parse(httpHeaders); } catch { }
        let payload: any;
        try { payload = JSON.parse(httpPayload); } catch { payload = httpPayload || undefined; }
        const r = await fetch(`${BASE}/api/sql/http-query`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: httpUrl, method: httpMethod, headers: parsedHeaders, payload }),
        });
        setResult(await r.json());
      }
    } catch (e: any) {
      setResult({ error: e.message, executionTimeMs: Date.now() - t0, rows: [], columns: [] });
    } finally { setRunning(false); }
  };

  return (
    <div className="h-full flex flex-col gap-3 min-h-0">
      {/* Header */}
      <div className="border border-primary/10 bg-black/20 rounded-sm px-3 py-2 flex items-center justify-between flex-wrap gap-2 shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold tracking-tighter uppercase flex items-center gap-2">
            <Database className="w-5 h-5" /> SQL Interface
          </h2>
          <Badge variant="outline" className={`font-mono text-xs ${mode === "local" ? "text-primary/50 border-primary/20" : mode === "external" ? "text-green-400 border-green-400/50" : "text-blue-400 border-blue-400/50"}`}>
            {mode === "local" ? "LOCAL DB" : mode === "external" ? `EXTERNAL (${connections.find(c=>c.id===selectedConn)?.label ?? "?"})` : "HTTP API"}
          </Badge>
        </div>
        <Button onClick={execQuery} disabled={running || (mode==="external" && !selectedConn)}
          className="bg-primary text-black hover:bg-primary/80 font-mono text-xs h-8">
          <Play className={`w-3 h-3 mr-1.5 ${running ? "animate-spin" : ""}`} />
          {running ? "EXECUTING..." : "EXECUTE"}
        </Button>
      </div>

      {/* Mode switcher + connection manager */}
      <div className="flex gap-3 shrink-0 flex-wrap">
        <div className="flex border border-primary/20 text-[10px] font-mono">
          {([["local","LOCAL DB"],["external","EXTERNAL DB"],["http","HTTP API"]] as const).map(([v,l]) => (
            <button key={v} onClick={() => { setMode(v); if (v==="external") loadConnections(); }}
              className={`px-3 py-1.5 ${mode===v ? "bg-primary text-black" : "text-primary/60 hover:text-primary"}`}>{l}</button>
          ))}
        </div>
        {mode === "local" && (
          <span className="text-[10px] font-mono text-primary/30 flex items-center">SELECT queries only on local PROXHQ database</span>
        )}
        {mode === "external" && (
          <div className="flex items-center gap-2 flex-wrap">
            {connections.map(c => (
              <div key={c.id} className={`flex items-center gap-1.5 px-2 py-1 border text-[9px] font-mono cursor-pointer ${selectedConn===c.id ? "border-green-500/50 text-green-400 bg-green-900/10" : "border-primary/20 text-primary/50 hover:border-primary/40"}`}
                onClick={() => setSelectedConn(c.id)}>
                <Database className="w-3 h-3" />
                <span>{c.label}</span>
                <span className="text-primary/30">({c.queryCount}q)</span>
                <button onClick={e => { e.stopPropagation(); loadSchema(c.id); }} className="text-primary/30 hover:text-primary ml-1" title="Schema">
                  <Table className="w-2.5 h-2.5" />
                </button>
                <button onClick={e => { e.stopPropagation(); disconnect(c.id); }} className="text-red-400/50 hover:text-red-400 ml-0.5">
                  <Unlink className="w-2.5 h-2.5" />
                </button>
              </div>
            ))}
            {connections.length === 0 && <span className="text-[10px] font-mono text-primary/30">No connections. Add one below.</span>}
          </div>
        )}
      </div>

      {/* External connection form */}
      {mode === "external" && (
        <div className="border border-primary/10 bg-black/30 rounded-sm p-3 flex items-center gap-2 flex-wrap shrink-0">
          <Link className="w-3 h-3 text-primary/40 flex-shrink-0" />
          <Input value={newConnStr} onChange={e => setNewConnStr(e.target.value)}
            placeholder="postgresql://user:pass@host:5432/db" className="border-primary/20 bg-black/50 text-primary font-mono text-[10px] h-7 flex-1 min-w-64" />
          <Input value={newConnLabel} onChange={e => setNewConnLabel(e.target.value)}
            placeholder="Label" className="border-primary/20 bg-black/50 text-primary font-mono text-[10px] h-7 w-28" />
          <label className="flex items-center gap-1.5 text-[9px] font-mono text-primary/50 cursor-pointer">
            <input type="checkbox" checked={newConnSsl} onChange={e => setNewConnSsl(e.target.checked)} className="scale-75" />
            SSL
          </label>
          <Button onClick={connect} disabled={connecting} variant="outline"
            className="h-7 text-[10px] font-mono border-green-500/30 text-green-400 hover:bg-green-900/20">
            <Plus className="w-3 h-3 mr-1" /> {connecting ? "CONNECTING..." : "CONNECT"}
          </Button>
        </div>
      )}

      {/* HTTP API config */}
      {mode === "http" && (
        <div className="border border-primary/10 bg-black/30 rounded-sm p-3 flex items-center gap-2 flex-wrap shrink-0">
          <Globe className="w-3 h-3 text-primary/40 flex-shrink-0" />
          <div className="flex border border-primary/20 text-[9px] font-mono shrink-0">
            {["GET","POST","PUT","DELETE"].map(m => (
              <button key={m} onClick={() => setHttpMethod(m)}
                className={`px-2 py-1 ${httpMethod===m ? "bg-primary text-black" : "text-primary/60 hover:text-primary"}`}>{m}</button>
            ))}
          </div>
          <Input value={httpUrl} onChange={e => setHttpUrl(e.target.value)}
            placeholder="https://api.example.com/endpoint" className="border-primary/20 bg-black/50 text-primary font-mono text-[10px] h-7 flex-1" />
          <Input value={httpHeaders} onChange={e => setHttpHeaders(e.target.value)}
            placeholder='Headers JSON {"Auth": "Bearer ..."}' className="border-primary/20 bg-black/50 text-primary font-mono text-[10px] h-7 w-56" />
          {httpMethod !== "GET" && (
            <Input value={httpPayload} onChange={e => setHttpPayload(e.target.value)}
              placeholder='Payload JSON {"key": "val"}' className="border-primary/20 bg-black/50 text-primary font-mono text-[10px] h-7 w-48" />
          )}
        </div>
      )}

      <div className="flex-1 flex flex-col min-h-0 gap-3">
        {/* Query editor */}
        {mode !== "http" && (
          <div className="h-36 border border-primary/20 bg-black flex flex-col shrink-0">
            <div className="flex items-center justify-between px-3 py-1 border-b border-primary/10">
              <span className="text-[9px] font-mono text-primary/30 uppercase">
                {mode === "local" ? "SQL — SELECT only" : "SQL — Full access (INSERT/UPDATE/DELETE/DDL)"}
              </span>
              {mode !== "local" && (
                <span className="text-[9px] font-mono text-yellow-400/60">⚠ Full SQL permitted on external connections</span>
              )}
            </div>
            <textarea
              className="flex-1 bg-transparent p-3 text-primary font-mono text-sm resize-none focus:outline-none"
              value={query}
              onChange={e => setQuery(e.target.value)}
              spellCheck={false}
              placeholder={mode === "local" ? "SELECT * FROM nodes LIMIT 10;" : "SELECT * FROM users;\nINSERT INTO logs (msg) VALUES ('test');\nDROP TABLE IF EXISTS temp_table;"}
            />
          </div>
        )}

        {/* Schema panel */}
        {schemaVisible && schema && (
          <div className="border border-primary/10 bg-black/40 rounded-sm p-3 max-h-40 overflow-auto shrink-0">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[9px] font-mono text-primary/40 uppercase tracking-widest">Schema Explorer</span>
              <button onClick={() => setSchemaVisible(false)} className="text-[9px] font-mono text-primary/30 hover:text-primary">CLOSE</button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1.5">
              {schema.tables.map((t, i) => {
                const cols = schema.columns.filter(c => c.table_name === t.table_name);
                return (
                  <div key={i} className="border border-primary/10 p-1.5 text-[9px] font-mono cursor-pointer hover:border-primary/30"
                    onClick={() => setQuery(`SELECT * FROM "${t.table_schema}"."${t.table_name}" LIMIT 50;`)}>
                    <div className="text-primary font-bold truncate">{t.table_name}</div>
                    <div className="text-primary/40">{cols.slice(0, 4).map(c => c.column_name).join(", ")}{cols.length > 4 ? "..." : ""}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Results */}
        <div className="flex-1 border border-primary/20 bg-black overflow-hidden flex flex-col min-h-0">
          {!result && !running && (
            <div className="flex-1 flex items-center justify-center text-primary/20 font-mono text-sm">
              [ EXECUTE A QUERY TO SEE RESULTS ]
            </div>
          )}
          {running && (
            <div className="flex-1 flex items-center justify-center text-primary/40 font-mono text-xs gap-2">
              <RefreshCw className="w-4 h-4 animate-spin" /> Executing...
            </div>
          )}
          {result && !running && (
            <>
              <div className="px-3 py-2 border-b border-primary/10 bg-primary/5 flex items-center gap-3 flex-wrap shrink-0">
                {result.error ? (
                  <span className="text-red-400 text-xs font-mono">{result.error}</span>
                ) : (
                  <>
                    <Badge variant="outline" className="text-green-400 border-green-400/50 font-mono text-[9px]">
                      {result.rowCount ?? result.rows?.length ?? 0} ROWS
                    </Badge>
                    {result.executionTimeMs !== undefined && (
                      <span className="text-[9px] font-mono text-primary/40">{result.executionTimeMs}ms</span>
                    )}
                    {result.command && <span className="text-[9px] font-mono text-primary/40">CMD: {result.command}</span>}
                    {result.connectionLabel && <span className="text-[9px] font-mono text-primary/40">via {result.connectionLabel}</span>}
                    {result.url && <span className="text-[9px] font-mono text-primary/40">{result.status} {result.statusText}</span>}
                  </>
                )}
              </div>
              {!result.error && result.columns?.length > 0 && (
                <div className="flex-1 overflow-auto">
                  <UITable>
                    <TableHeader>
                      <TableRow className="border-primary/20 hover:bg-transparent">
                        {result.columns.map((col: string) => (
                          <TableHead key={col} className="text-primary/60 text-[10px] font-mono whitespace-nowrap">{col}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(result.rows ?? []).map((row: any, i: number) => (
                        <TableRow key={i} className="border-primary/10 hover:bg-primary/5">
                          {result.columns.map((col: string) => (
                            <TableCell key={col} className="font-mono text-[10px] whitespace-nowrap max-w-xs truncate" title={String(row[col])}>
                              {row[col] === null ? <span className="text-primary/30">null</span> : String(row[col])}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                      {(result.rows?.length === 0) && (
                        <TableRow><TableCell colSpan={result.columns.length} className="text-center py-8 text-primary/30 text-xs font-mono">NO ROWS RETURNED</TableCell></TableRow>
                      )}
                    </TableBody>
                  </UITable>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
