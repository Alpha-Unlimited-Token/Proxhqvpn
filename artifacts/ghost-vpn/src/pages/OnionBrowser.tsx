import { useState, useRef, useEffect, useCallback } from "react";
import {
  useGetProxyBrowserConfig,
  useSaveProxyBrowserConfig,
  useProxyFetch,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Globe,
  ArrowLeft,
  ArrowRight,
  RotateCcw,
  X,
  Shield,
  Lock,
  Settings,
  Layers,
  Wifi,
  WifiOff,
  ChevronRight,
  Home,
  Bookmark,
  AlertTriangle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type ProxyMode = "direct" | "ghostnet-onion" | "tor-gateway" | "double-layer";

interface HistoryEntry {
  url: string;
  title: string;
}

const MODE_LABELS: Record<ProxyMode, string> = {
  direct: "Direct",
  "ghostnet-onion": "GhostNet Onion",
  "tor-gateway": "Tor Gateway",
  "double-layer": "Double Layer",
};

const MODE_COLORS: Record<ProxyMode, string> = {
  direct: "text-yellow-500",
  "ghostnet-onion": "text-primary",
  "tor-gateway": "text-purple-400",
  "double-layer": "text-cyan-400",
};

const DEFAULT_BOOKMARKS = [
  { label: "DuckDuckGo (Onion)", url: "https://duckduckgogg42xjoc72x3sjasowoarfbgcmvfimaftt6twagswzczad.onion" },
  { label: "DuckDuckGo", url: "https://duckduckgo.com" },
  { label: "Ahmia (Onion Search)", url: "http://ahmia.fi" },
  { label: "Wikipedia", url: "https://en.wikipedia.org/wiki/Tor_%28network%29" },
  { label: "Check Tor IP", url: "https://check.torproject.org" },
];

function OnionLayer({
  label,
  index,
  total,
  active,
}: {
  label: string;
  index: number;
  total: number;
  active: boolean;
}) {
  const isFirst = index === 0;
  const isLast = index === total - 1;
  return (
    <div className="flex items-center gap-1 min-w-0">
      <div
        className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-mono border transition-all duration-300 truncate max-w-[140px] ${
          active
            ? isFirst
              ? "bg-primary/10 border-primary/50 text-primary"
              : isLast
              ? "bg-green-900/20 border-green-500/40 text-green-400"
              : "bg-purple-900/20 border-purple-500/30 text-purple-300"
            : "border-gray-700 text-gray-600"
        }`}
        title={label}
      >
        {isFirst ? (
          <Shield className="w-3 h-3 flex-shrink-0" />
        ) : isLast ? (
          <Globe className="w-3 h-3 flex-shrink-0" />
        ) : (
          <Lock className="w-3 h-3 flex-shrink-0" />
        )}
        <span className="truncate">{label}</span>
      </div>
      {!isLast && (
        <ChevronRight
          className={`w-3 h-3 flex-shrink-0 ${active ? "text-primary/60" : "text-gray-700"}`}
        />
      )}
    </div>
  );
}

export default function OnionBrowser() {
  const { toast } = useToast();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const [url, setUrl] = useState("https://duckduckgo.com");
  const [inputUrl, setInputUrl] = useState("https://duckduckgo.com");
  const [mode, setMode] = useState<ProxyMode>("ghostnet-onion");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [iframeContent, setIframeContent] = useState<string>("");
  const [currentLayers, setCurrentLayers] = useState<string[]>([]);
  const [currentTitle, setCurrentTitle] = useState("");
  const [timing, setTiming] = useState<number | null>(null);
  const [statusCode, setStatusCode] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [socks5Host, setSocks5Host] = useState("127.0.0.1");
  const [socks5Port, setSocks5Port] = useState("9050");
  const [showBookmarks, setShowBookmarks] = useState(false);

  const { data: config } = useGetProxyBrowserConfig({ query: { refetchInterval: 30000 } as any });
  const saveConfig = useSaveProxyBrowserConfig();
  const fetchUrl = useProxyFetch();

  useEffect(() => {
    if (config) {
      setMode(config.mode as ProxyMode);
      setSocks5Host(config.socks5Host);
      setSocks5Port(String(config.socks5Port));
    }
  }, [config]);

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === "ghost-navigate") {
        navigateTo(e.data.url);
      } else if (e.data?.type === "ghost-loaded") {
        setUrl(e.data.url);
        setInputUrl(e.data.url);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [mode]);

  const navigateTo = useCallback(
    async (targetUrl: string, fromHistory = false) => {
      setIsLoading(true);
      setCurrentLayers([]);

      try {
        const result = await fetchUrl.mutateAsync({
          data: { url: targetUrl, mode },
        });

        setIframeContent(result.html ?? "");
        setCurrentLayers(result.layers ?? []);
        setTiming(result.timing ?? null);
        setStatusCode(result.statusCode ?? null);
        setCurrentTitle(result.title ?? targetUrl);
        setUrl(result.finalUrl ?? targetUrl);
        setInputUrl(result.finalUrl ?? targetUrl);

        if (!fromHistory) {
          const newEntry: HistoryEntry = {
            url: result.finalUrl ?? targetUrl,
            title: result.title ?? targetUrl,
          };
          setHistory((prev) => {
            const sliced = prev.slice(0, historyIndex + 1);
            return [...sliced, newEntry];
          });
          setHistoryIndex((prev) => prev + 1);
        }

        if (result.error) {
          toast({
            title: "Connection Issue",
            description: result.error,
            variant: "destructive",
          });
        }
      } catch (err: any) {
        toast({
          title: "Navigation failed",
          description: err.message ?? "Unknown error",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    },
    [mode, historyIndex, fetchUrl, toast]
  );

  const handleGo = () => {
    let target = inputUrl.trim();
    if (!target) return;
    navigateTo(target);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleGo();
  };

  const handleBack = () => {
    if (historyIndex <= 0) return;
    const newIndex = historyIndex - 1;
    setHistoryIndex(newIndex);
    navigateTo(history[newIndex].url, true);
  };

  const handleForward = () => {
    if (historyIndex >= history.length - 1) return;
    const newIndex = historyIndex + 1;
    setHistoryIndex(newIndex);
    navigateTo(history[newIndex].url, true);
  };

  const handleReload = () => {
    if (url) navigateTo(url);
  };

  const handleStop = () => {
    setIsLoading(false);
  };

  const handleSaveConfig = () => {
    saveConfig.mutate(
      {
        data: {
          mode,
          socks5Host,
          socks5Port: Number(socks5Port),
        },
      },
      {
        onSuccess: () => {
          toast({ title: "Proxy config saved" });
          setShowSettings(false);
        },
        onError: () => {
          toast({ title: "Failed to save config", variant: "destructive" });
        },
      }
    );
  };

  const canBack = historyIndex > 0;
  const canForward = historyIndex < history.length - 1;

  const modeColor = MODE_COLORS[mode];
  const torActive = mode === "tor-gateway" || mode === "double-layer";
  const ghostActive = mode === "ghostnet-onion" || mode === "double-layer";

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] gap-0">
      <div className="flex items-center gap-2 px-1 pb-2">
        <Layers className="w-5 h-5 text-primary" />
        <h2 className="text-xl font-bold tracking-tighter uppercase">
          GhostNet Onion Browser
        </h2>
        <Badge
          variant="outline"
          className={`ml-2 font-mono text-xs ${modeColor} border-current`}
        >
          {MODE_LABELS[mode]}
        </Badge>
        {torActive && (
          <Badge variant="outline" className="text-purple-400 border-purple-400/50 text-xs">
            TOR
          </Badge>
        )}
        {ghostActive && (
          <Badge variant="outline" className="text-primary border-primary/50 text-xs">
            GHOST
          </Badge>
        )}
      </div>

      <Card className="bg-black border-primary/20 flex flex-col flex-1 overflow-hidden">
        <div className="flex items-center gap-1 px-2 py-2 border-b border-primary/10 bg-black/60">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-primary/60 hover:text-primary"
            onClick={handleBack}
            disabled={!canBack}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-primary/60 hover:text-primary"
            onClick={handleForward}
            disabled={!canForward}
          >
            <ArrowRight className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-primary/60 hover:text-primary"
            onClick={isLoading ? handleStop : handleReload}
          >
            {isLoading ? <X className="w-4 h-4" /> : <RotateCcw className="w-4 h-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-primary/60 hover:text-primary"
            onClick={() => { setInputUrl("https://duckduckgo.com"); navigateTo("https://duckduckgo.com"); }}
          >
            <Home className="w-4 h-4" />
          </Button>

          <div className="flex-1 flex items-center gap-1 bg-black border border-primary/20 rounded px-2 h-8">
            {torActive ? (
              <Lock className="w-3 h-3 text-purple-400 flex-shrink-0" />
            ) : (
              <Globe className="w-3 h-3 text-primary/50 flex-shrink-0" />
            )}
            <Input
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              onKeyDown={handleKeyDown}
              className="border-0 bg-transparent h-6 text-xs font-mono text-primary p-0 focus-visible:ring-0 flex-1"
              placeholder="Enter URL or .onion address..."
            />
          </div>

          <Button
            size="sm"
            className="h-7 text-xs px-3 bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20"
            onClick={handleGo}
            disabled={isLoading}
          >
            {isLoading ? "LOADING..." : "GO"}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-primary/60 hover:text-primary"
            onClick={() => setShowBookmarks(!showBookmarks)}
          >
            <Bookmark className="w-4 h-4" />
          </Button>

          <Select value={mode} onValueChange={(v) => setMode(v as ProxyMode)}>
            <SelectTrigger className="h-7 w-36 text-xs border-primary/20 bg-black text-primary font-mono">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-black border-primary/30">
              <SelectItem value="direct" className="text-xs font-mono text-yellow-500">Direct</SelectItem>
              <SelectItem value="ghostnet-onion" className="text-xs font-mono text-primary">GhostNet Onion</SelectItem>
              <SelectItem value="tor-gateway" className="text-xs font-mono text-purple-400">Tor Gateway</SelectItem>
              <SelectItem value="double-layer" className="text-xs font-mono text-cyan-400">Double Layer</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-primary/60 hover:text-primary"
            onClick={() => setShowSettings(!showSettings)}
          >
            <Settings className="w-4 h-4" />
          </Button>
        </div>

        {showBookmarks && (
          <div className="flex flex-wrap gap-2 px-3 py-2 border-b border-primary/10 bg-black/40">
            {DEFAULT_BOOKMARKS.map((bm) => (
              <button
                key={bm.url}
                onClick={() => { setShowBookmarks(false); navigateTo(bm.url); }}
                className="text-xs font-mono text-primary/70 hover:text-primary border border-primary/20 hover:border-primary/50 rounded px-2 py-1 transition-colors"
              >
                {bm.label}
              </button>
            ))}
          </div>
        )}

        {showSettings && (
          <div className="flex items-center gap-4 px-3 py-2 border-b border-primary/10 bg-black/60 text-xs font-mono">
            <span className="text-primary/50">SOCKS5 HOST:</span>
            <Input
              value={socks5Host}
              onChange={(e) => setSocks5Host(e.target.value)}
              className="h-6 w-32 text-xs border-primary/20 bg-black text-primary font-mono"
            />
            <span className="text-primary/50">PORT:</span>
            <Input
              value={socks5Port}
              onChange={(e) => setSocks5Port(e.target.value)}
              className="h-6 w-20 text-xs border-primary/20 bg-black text-primary font-mono"
            />
            <Button
              size="sm"
              className="h-6 text-xs px-2 bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20"
              onClick={handleSaveConfig}
            >
              SAVE
            </Button>
            <span className="text-primary/40 ml-2">
              Tor default: 127.0.0.1:9050 · Tor Browser: 127.0.0.1:9150
            </span>
          </div>
        )}

        {currentLayers.length > 0 && (
          <div className="flex items-center gap-0 px-3 py-1.5 border-b border-primary/10 bg-black/40 overflow-x-auto">
            <span className="text-xs font-mono text-primary/40 mr-2 flex-shrink-0">ROUTE:</span>
            {currentLayers.map((layer, i) => (
              <OnionLayer
                key={i}
                label={layer}
                index={i}
                total={currentLayers.length}
                active={!isLoading}
              />
            ))}
          </div>
        )}

        <CardContent className="flex-1 p-0 relative overflow-hidden">
          {!iframeContent && !isLoading && (
            <NewTabPage onNavigate={navigateTo} mode={mode} />
          )}

          {isLoading && (
            <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-10">
              <div className="relative mb-6">
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="absolute rounded-full border border-primary/40 animate-ping"
                    style={{
                      width: `${(i + 1) * 40}px`,
                      height: `${(i + 1) * 40}px`,
                      top: `${-(i * 20)}px`,
                      left: `${-(i * 20)}px`,
                      animationDelay: `${i * 0.2}s`,
                      animationDuration: "2s",
                    }}
                  />
                ))}
                <Layers className="w-8 h-8 text-primary relative z-10" />
              </div>
              <p className="text-primary font-mono text-sm tracking-widest">ROUTING THROUGH {MODE_LABELS[mode].toUpperCase()}...</p>
              <p className="text-primary/40 font-mono text-xs mt-2">Encrypting and tunneling request</p>
            </div>
          )}

          {iframeContent && (
            <iframe
              ref={iframeRef}
              srcDoc={iframeContent}
              className="w-full h-full border-0"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              title="GhostNet Onion Browser"
            />
          )}
        </CardContent>

        <div className="flex items-center justify-between px-3 py-1 border-t border-primary/10 bg-black/60 text-xs font-mono">
          <div className="flex items-center gap-3">
            {torActive ? (
              <span className="flex items-center gap-1 text-purple-400">
                <Wifi className="w-3 h-3" /> Tor SOCKS5 {socks5Host}:{socks5Port}
              </span>
            ) : ghostActive ? (
              <span className="flex items-center gap-1 text-primary">
                <Shield className="w-3 h-3" /> GhostNet Multi-hop Active
              </span>
            ) : (
              <span className="flex items-center gap-1 text-yellow-500">
                <WifiOff className="w-3 h-3" /> Direct (no proxy)
              </span>
            )}
            {statusCode !== null && (
              <span className={statusCode < 400 ? "text-green-500" : "text-red-500"}>
                HTTP {statusCode}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-primary/40">
            {timing !== null && <span>{timing}ms</span>}
            {currentTitle && (
              <span className="truncate max-w-xs text-primary/30">{currentTitle}</span>
            )}
          </div>
        </div>
      </Card>

      {(mode === "tor-gateway" || mode === "double-layer") && (
        <div className="flex items-center gap-2 mt-2 px-1 text-xs font-mono text-yellow-500/70">
          <AlertTriangle className="w-3 h-3" />
          <span>
            Tor mode requires Tor daemon running locally ({socks5Host}:{socks5Port}).
            Install from{" "}
            <a
              href="https://www.torproject.org/download/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-yellow-500"
            >
              torproject.org
            </a>
            . For maximum protection, also enable Tor Browser and chain it via Double Layer mode.
          </span>
        </div>
      )}
    </div>
  );
}

function NewTabPage({
  onNavigate,
  mode,
}: {
  onNavigate: (url: string) => void;
  mode: ProxyMode;
}) {
  const modeInfo: Record<
    ProxyMode,
    { color: string; description: string; icon: React.ReactNode; layers: string[] }
  > = {
    direct: {
      color: "text-yellow-500",
      description: "Direct connection — no proxy, no anonymization. Use for speed only.",
      icon: <WifiOff className="w-5 h-5 text-yellow-500" />,
      layers: ["Your Device", "Destination"],
    },
    "ghostnet-onion": {
      color: "text-primary",
      description:
        "Routes through GhostNet's multi-hop relay network with IP rotation and encryption.",
      icon: <Shield className="w-5 h-5 text-primary" />,
      layers: ["Your Device", "GhostNet Relay ×7", "Destination"],
    },
    "tor-gateway": {
      color: "text-purple-400",
      description:
        "Routes through Tor's 3-hop onion network via SOCKS5. Requires Tor daemon (port 9050).",
      icon: <Lock className="w-5 h-5 text-purple-400" />,
      layers: ["Your Device", "Entry Guard", "Middle Relay", "Exit Node", "Destination"],
    },
    "double-layer": {
      color: "text-cyan-400",
      description:
        "Maximum protection: GhostNet multi-hop → Tor network. Slowest but most anonymous.",
      icon: <Layers className="w-5 h-5 text-cyan-400" />,
      layers: ["Your Device", "GhostNet ×3", "Tor Entry", "Tor Middle", "Tor Exit", "Destination"],
    },
  };

  const info = modeInfo[mode];

  return (
    <div className="h-full bg-black flex flex-col items-center justify-center p-8 gap-8">
      <div className="text-center">
        <div className="flex justify-center mb-4 relative">
          {[60, 90, 120, 150].map((size, i) => (
            <div
              key={i}
              className="absolute rounded-full border border-primary/10"
              style={{
                width: `${size}px`,
                height: `${size}px`,
                top: `${-size / 2 + 12}px`,
                left: `${-size / 2 + 12}px`,
              }}
            />
          ))}
          <div className={`relative z-10 ${info.color}`}>{info.icon}</div>
        </div>
        <div className="mt-16">
          <p className="text-primary font-bold font-mono tracking-widest text-lg mb-1">
            GHOSTNET ONION BROWSER
          </p>
          <p className={`text-xs font-mono ${info.color} mb-2`}>
            MODE: {mode.toUpperCase().replace(/-/g, " ")}
          </p>
          <p className="text-primary/40 text-xs font-mono max-w-sm">{info.description}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 justify-center max-w-lg">
        <p className="w-full text-center text-xs font-mono text-primary/30 mb-1">QUICK ACCESS</p>
        {DEFAULT_BOOKMARKS.map((bm) => (
          <button
            key={bm.url}
            onClick={() => onNavigate(bm.url)}
            className="text-xs font-mono text-primary/60 hover:text-primary border border-primary/20 hover:border-primary/60 rounded px-3 py-2 transition-all hover:bg-primary/5"
          >
            {bm.label}
          </button>
        ))}
      </div>

      <div className="max-w-lg w-full">
        <p className="text-xs font-mono text-primary/30 mb-2 text-center">ROUTING CHAIN</p>
        <div className="flex items-center justify-center gap-1 flex-wrap">
          {info.layers.map((layer, i) => (
            <div key={i} className="flex items-center gap-1">
              <span
                className={`text-xs font-mono px-2 py-0.5 rounded border ${
                  i === 0
                    ? "border-primary/40 text-primary bg-primary/5"
                    : i === info.layers.length - 1
                    ? "border-green-500/40 text-green-400 bg-green-900/10"
                    : `border-current/30 ${info.color} bg-current/5`
                }`}
              >
                {layer}
              </span>
              {i < info.layers.length - 1 && (
                <ChevronRight className="w-3 h-3 text-primary/30" />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
