// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Search, Globe, Key, Zap, Wifi, FileSearch, Code2, Lock, Users, Shield,
  ShieldCheck, Cpu, Phone, Activity, Package, Wrench, ExternalLink, ChevronRight,
  CheckCircle2, ArrowRight, X, GitBranch, BookOpen, Filter,
} from "lucide-react";
import parrotData from "@/data/parrot-tools.json";

const ICON_MAP: Record<string, React.ElementType> = {
  Search, Globe, Key, Zap, Wifi, FileSearch, Code2, Lock, Users, Shield,
  ShieldCheck, Cpu, Phone, Activity, Package, Wrench,
};

const CATEGORY_COLORS: Record<string, string> = {
  "Information Gathering":        "border-cyan-500/30 text-cyan-400 bg-cyan-900/10",
  "Web App Security":             "border-orange-500/30 text-orange-400 bg-orange-900/10",
  "Password Attacks":             "border-red-500/30 text-red-400 bg-red-900/10",
  "Exploitation Frameworks":      "border-red-600/40 text-red-300 bg-red-900/15",
  "Network & Wireless":           "border-blue-500/30 text-blue-400 bg-blue-900/10",
  "Forensics & DFIR":             "border-purple-500/30 text-purple-400 bg-purple-900/10",
  "Reverse Engineering":          "border-pink-500/30 text-pink-400 bg-pink-900/10",
  "Cryptography & Steganography": "border-yellow-500/30 text-yellow-400 bg-yellow-900/10",
  "Social Engineering":           "border-amber-500/30 text-amber-400 bg-amber-900/10",
  "Privacy & Anonymity":          "border-[#00ff88]/30 text-[#00ff88] bg-[#00ff88]/5",
  "Hardening & Defense":          "border-emerald-500/30 text-emerald-400 bg-emerald-900/10",
  "Hardware & IoT":               "border-teal-500/30 text-teal-400 bg-teal-900/10",
  "VoIP & Telephony":             "border-indigo-500/30 text-indigo-400 bg-indigo-900/10",
  "Stress Testing":               "border-rose-500/30 text-rose-400 bg-rose-900/10",
  "Python Libraries":             "border-sky-500/30 text-sky-400 bg-sky-900/10",
  "Libraries & Frameworks":       "border-slate-500/30 text-slate-400 bg-slate-900/10",
  "General Utilities":            "border-primary/20 text-primary/50 bg-primary/3",
};

interface Tool {
  name: string;
  version: string;
  description: string;
  upstream: string | null;
  source: string | null;
  docs: string | null;
  ourTool: { route: string; label: string } | null;
}

const ALL_TOOLS: Array<Tool & { category: string }> = [];
for (const cat of parrotData.categories) {
  const tools = (parrotData.tools as Record<string, Tool[]>)[cat] ?? [];
  for (const t of tools) ALL_TOOLS.push({ ...t, category: cat });
}

function ToolCard({ tool }: { tool: Tool & { category: string } }) {
  const [expanded, setExpanded] = useState(false);
  const color = CATEGORY_COLORS[tool.category] ?? "border-primary/20 text-primary/40 bg-primary/3";
  const colorText = color.match(/text-([^\s]+)/)?.[1] ?? "primary/40";

  return (
    <div className={`border rounded-sm overflow-hidden transition-colors ${tool.ourTool ? "border-[#00ff88]/20 bg-[#00ff88]/2" : "border-primary/10 bg-primary/1"}`}>
      <div
        className="flex items-start gap-3 p-3 cursor-pointer hover:bg-primary/3 transition-colors"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="text-xs font-bold text-primary font-mono">{tool.name}</span>
            {tool.ourTool && (
              <span className="text-[8px] border border-[#00ff88]/40 text-[#00ff88] px-1.5 py-0.5 uppercase bg-[#00ff88]/8 flex items-center gap-1">
                <CheckCircle2 className="w-2 h-2" />Available
              </span>
            )}
            <span className={`text-[8px] border px-1.5 py-0.5 uppercase ${color}`}>{tool.category}</span>
          </div>
          <div className="text-[10px] text-primary/50 leading-relaxed line-clamp-2">{tool.description}</div>
        </div>
        <ChevronRight className={`w-3.5 h-3.5 text-primary/20 shrink-0 mt-0.5 transition-transform ${expanded ? "rotate-90" : ""}`} />
      </div>

      {expanded && (
        <div className="px-3 pb-3 border-t border-primary/8 pt-2.5 space-y-2">
          <div className="text-[10px] text-primary/60 leading-relaxed">{tool.description}</div>
          <div className="flex items-center gap-2 text-[9px] font-mono text-primary/30">
            <span>v{tool.version}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {tool.ourTool && (
              <a
                href={tool.ourTool.route}
                className="flex items-center gap-1.5 text-[10px] border border-[#00ff88]/40 text-[#00ff88] px-2.5 py-1.5 rounded-sm bg-[#00ff88]/8 hover:bg-[#00ff88]/15 transition-colors font-mono"
                onClick={e => e.stopPropagation()}
              >
                <ArrowRight className="w-3 h-3" />
                Open in ProxhqVPN: {tool.ourTool.label}
              </a>
            )}
            {tool.upstream && (
              <a
                href={tool.upstream}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-[10px] border border-primary/15 text-primary/40 px-2 py-1.5 rounded-sm hover:border-primary/30 hover:text-primary/60 transition-colors font-mono"
                onClick={e => e.stopPropagation()}
              >
                <ExternalLink className="w-2.5 h-2.5" />Upstream
              </a>
            )}
            {tool.source && (
              <a
                href={tool.source}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-[10px] border border-primary/15 text-primary/40 px-2 py-1.5 rounded-sm hover:border-primary/30 hover:text-primary/60 transition-colors font-mono"
                onClick={e => e.stopPropagation()}
              >
                <GitBranch className="w-2.5 h-2.5" />Source
              </a>
            )}
            {tool.docs && (
              <a
                href={tool.docs}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-[10px] border border-primary/15 text-primary/40 px-2 py-1.5 rounded-sm hover:border-primary/30 hover:text-primary/60 transition-colors font-mono"
                onClick={e => e.stopPropagation()}
              >
                <BookOpen className="w-2.5 h-2.5" />Docs
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ParrotTools() {
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [showAvailableOnly, setShowAvailableOnly] = useState(false);

  const totalTools = ALL_TOOLS.length;
  const availableCount = ALL_TOOLS.filter(t => t.ourTool).length;

  const filtered = useMemo(() => {
    let tools = ALL_TOOLS;
    if (activeCategory) tools = tools.filter(t => t.category === activeCategory);
    if (showAvailableOnly) tools = tools.filter(t => !!t.ourTool);
    if (search.trim()) {
      const q = search.toLowerCase();
      tools = tools.filter(t =>
        t.name.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q)
      );
    }
    return tools;
  }, [search, activeCategory, showAvailableOnly]);

  const groupedFiltered = useMemo(() => {
    const groups: Record<string, Array<Tool & { category: string }>> = {};
    for (const t of filtered) {
      if (!groups[t.category]) groups[t.category] = [];
      groups[t.category].push(t);
    }
    return groups;
  }, [filtered]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const cat of parrotData.categories) {
      const tools = (parrotData.tools as Record<string, Tool[]>)[cat] ?? [];
      counts[cat] = showAvailableOnly ? tools.filter(t => t.ourTool).length : tools.length;
    }
    return counts;
  }, [showAvailableOnly]);

  return (
    <div className="p-4 md:p-6 space-y-5 font-mono min-h-screen">

      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1 flex-wrap">
          <img src="https://parrotsec.org/favicon.png" className="w-5 h-5 rounded" alt="Parrot" onError={e => (e.currentTarget.style.display = "none")} />
          <h1 className="text-lg font-bold text-primary tracking-tight">Parrot OS Tool Library</h1>
          <Badge className="text-[9px] border-[#00ff88]/30 bg-[#00ff88]/10 text-[#00ff88] font-mono uppercase tracking-widest px-1.5">{totalTools} Tools</Badge>
          <Badge className="text-[9px] border-cyan-400/30 bg-cyan-900/10 text-cyan-400 font-mono uppercase tracking-widest px-1.5">{availableCount} in ProxhqVPN</Badge>
        </div>
        <p className="text-xs text-primary/40 max-w-xl leading-relaxed">
          Complete catalog of all {totalTools} Parrot OS security tools. Tools marked <span className="text-[#00ff88]">Available</span> are built into ProxhqVPN Command Center — click to open them directly.
        </p>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Tools", value: totalTools, color: "text-primary" },
          { label: "Available in Platform", value: availableCount, color: "text-[#00ff88]" },
          { label: "Categories", value: parrotData.categories.length, color: "text-cyan-400" },
          { label: "Coverage", value: `${Math.round((availableCount / totalTools) * 100)}%`, color: "text-orange-400" },
        ].map(s => (
          <div key={s.label} className="border border-primary/10 p-3 rounded-sm bg-primary/2">
            <div className={`text-xl font-bold font-mono ${s.color}`}>{s.value}</div>
            <div className="text-[10px] text-primary/30 uppercase tracking-wide">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Search + filters */}
      <div className="flex flex-col md:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-primary/30" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search tools, descriptions, categories..."
            className="w-full bg-black/40 border border-primary/20 text-primary text-sm font-mono pl-9 pr-3 py-2 focus:outline-none focus:border-[#00ff88]/40 placeholder:text-primary/20 rounded-sm"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-primary/30 hover:text-primary/60">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <Button
          onClick={() => setShowAvailableOnly(v => !v)}
          variant="outline"
          className={`text-xs font-mono border rounded-sm px-3 py-2 transition-colors ${showAvailableOnly ? "border-[#00ff88]/40 text-[#00ff88] bg-[#00ff88]/8" : "border-primary/20 text-primary/40"}`}
        >
          <Filter className="w-3 h-3 mr-1.5" />
          {showAvailableOnly ? "Showing: Available" : "Filter: Available Only"}
        </Button>
        {activeCategory && (
          <Button
            onClick={() => setActiveCategory(null)}
            variant="outline"
            className="text-xs font-mono border border-primary/20 text-primary/40 rounded-sm px-3 py-2"
          >
            <X className="w-3 h-3 mr-1.5" />Clear Filter
          </Button>
        )}
      </div>

      {/* Category pills */}
      <div className="flex flex-wrap gap-1.5">
        {parrotData.categories.map(cat => {
          const count = categoryCounts[cat] ?? 0;
          if (count === 0) return null;
          const color = CATEGORY_COLORS[cat] ?? "border-primary/20 text-primary/40";
          const active = activeCategory === cat;
          const Icon = ICON_MAP[(parrotData.icons as Record<string, string>)[cat]] ?? Wrench;
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(active ? null : cat)}
              className={`flex items-center gap-1.5 text-[10px] border px-2.5 py-1 rounded-sm transition-colors font-mono uppercase tracking-wide ${active ? color + " opacity-100" : "border-primary/15 text-primary/30 hover:border-primary/30 hover:text-primary/50"}`}
            >
              <Icon className="w-3 h-3" />
              {cat}
              <span className="ml-0.5 opacity-60">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Results count */}
      {(search || activeCategory || showAvailableOnly) && (
        <div className="text-[10px] text-primary/30 font-mono">
          Showing {filtered.length} of {totalTools} tools
          {activeCategory && <span> in <span className="text-primary/50">{activeCategory}</span></span>}
          {search && <span> matching <span className="text-primary/50">"{search}"</span></span>}
        </div>
      )}

      {/* Tool grid — grouped by category */}
      {Object.entries(groupedFiltered)
        .sort(([a], [b]) => parrotData.categories.indexOf(a) - parrotData.categories.indexOf(b))
        .map(([cat, tools]) => {
          if (tools.length === 0) return null;
          const color = CATEGORY_COLORS[cat] ?? "border-primary/20 text-primary/40";
          const Icon = ICON_MAP[(parrotData.icons as Record<string, string>)[cat]] ?? Wrench;
          const availInCat = tools.filter(t => t.ourTool).length;
          return (
            <div key={cat} className="space-y-2">
              <div className="flex items-center gap-2 border-b border-primary/10 pb-2">
                <Icon className="w-4 h-4 text-primary/40" />
                <h2 className="text-xs font-bold text-primary uppercase tracking-widest">{cat}</h2>
                <span className={`text-[9px] border px-2 py-0.5 font-mono ${color}`}>{tools.length} tools</span>
                {availInCat > 0 && (
                  <span className="text-[9px] border border-[#00ff88]/30 text-[#00ff88] px-2 py-0.5 font-mono bg-[#00ff88]/5">
                    {availInCat} in platform
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                {tools.map(t => <ToolCard key={t.name} tool={t} />)}
              </div>
            </div>
          );
        })}

      {filtered.length === 0 && (
        <div className="border border-primary/10 p-10 text-center rounded-sm">
          <Search className="w-8 h-8 text-primary/15 mx-auto mb-3" />
          <div className="text-sm text-primary/25">No tools match your search</div>
          <div className="text-xs text-primary/15 mt-1">Try a different keyword or clear filters</div>
        </div>
      )}

      {/* Footer attribution */}
      <div className="border-t border-primary/10 pt-4 text-[10px] text-primary/20 flex items-center gap-3">
        <span>Tool data sourced from</span>
        <a href="https://tools.parrotsec.org/" target="_blank" rel="noreferrer" className="text-primary/40 hover:text-primary/60 flex items-center gap-1">
          tools.parrotsec.org <ExternalLink className="w-2.5 h-2.5" />
        </a>
        <span>·</span>
        <a href="https://parrotsec.gitlab.io/infra/night-watch-json/packages.json" target="_blank" rel="noreferrer" className="text-primary/40 hover:text-primary/60 flex items-center gap-1">
          packages.json <ExternalLink className="w-2.5 h-2.5" />
        </a>
      </div>

    </div>
  );
}
