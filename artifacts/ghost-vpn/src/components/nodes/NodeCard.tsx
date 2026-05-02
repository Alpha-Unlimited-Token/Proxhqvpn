// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useEffect, useRef, useState } from "react";
import type { LifecycleState, LiveNode } from "@/hooks/useNodeLifecycle";
import { Shield, Cpu, Wifi } from "lucide-react";

interface Props {
  node: LiveNode;
  lifecycle: LifecycleState;
  isActive?: boolean;
}

function SpiderIndicator() {
  return (
    <div className="flex items-center gap-1.5">
      <div className="spider-orbit-container shrink-0">
        <div className="spider-dot" />
        <div className="spider-dot-trail" />
      </div>
      <span className="text-[9px] text-primary/60 uppercase tracking-wider">SPIDER</span>
    </div>
  );
}

function BeaconIndicator() {
  return (
    <div className="flex items-center gap-1.5">
      <div className="beacon-container shrink-0">
        <div className="beacon-core" />
        <div className="beacon-ring" />
        <div className="beacon-ring beacon-ring-2" />
        <div className="beacon-ring beacon-ring-3" />
      </div>
      <span className="text-[9px] text-cyan-400/70 uppercase tracking-wider">BEACON</span>
    </div>
  );
}

function WormIndicator() {
  return (
    <div className="flex items-center gap-1.5">
      <div className="worm-container shrink-0">
        <div className="worm-track">
          <div className="worm-dot" />
          <div className="worm-dot worm-dot-2" />
        </div>
      </div>
      <span className="text-[9px] text-yellow-400/70 uppercase tracking-wider">WORM</span>
    </div>
  );
}

function IpDisplay({ ip, flickering }: { ip: string; flickering: boolean }) {
  const parts = ip.split(".");
  return (
    <span className={`font-mono text-xs text-primary ${flickering ? "node-ip-flicker" : ""}`}>
      {parts.map((p, i) => (
        <span key={i}>
          {i > 0 && <span className="text-primary/30">.</span>}
          {p}
        </span>
      ))}
    </span>
  );
}

export function NodeCard({ node, lifecycle, isActive }: Props) {
  const [showScan, setShowScan] = useState(false);
  const prevLifecycle = useRef<LifecycleState>("stable");

  useEffect(() => {
    if (prevLifecycle.current === "growing" && lifecycle === "stable") {
      setShowScan(true);
      const t = setTimeout(() => setShowScan(false), 700);
      return () => clearTimeout(t);
    }
    if (lifecycle === "growing") {
      setShowScan(true);
      const t = setTimeout(() => setShowScan(false), 700);
      prevLifecycle.current = lifecycle;
      return () => clearTimeout(t);
    }
    prevLifecycle.current = lifecycle;
    return;
  }, [lifecycle]);

  const isOuter = node.layer === "outer";
  const layerColor = isOuter ? "text-primary border-primary/30" : "text-cyan-400 border-cyan-400/30";
  const borderGlow = lifecycle === "decaying"
    ? "border-red-500/60 shadow-[0_0_12px_rgba(255,0,0,0.3)]"
    : lifecycle === "growing"
    ? "border-primary/80 shadow-[0_0_16px_rgba(0,255,0,0.35)]"
    : isActive
    ? "border-primary/50 shadow-[0_0_8px_rgba(0,255,0,0.15)]"
    : "border-primary/15 hover:border-primary/30";

  const animClass = lifecycle === "decaying"
    ? "node-decaying"
    : lifecycle === "growing"
    ? "node-growing"
    : "";

  return (
    <div
      className={`
        relative bg-black border rounded-none p-3 flex flex-col gap-2 overflow-hidden
        transition-shadow duration-300
        ${borderGlow} ${animClass}
      `}
    >
      {showScan && <div className="node-scan-bar" />}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className={`text-[9px] border px-1 py-0.5 uppercase tracking-wider shrink-0 ${layerColor}`}>
            {isOuter ? "OUT" : "IN"}
          </span>
          <span className="font-mono text-[10px] text-primary/80 truncate">{node.name}</span>
        </div>
        <span className={`text-[9px] font-mono ${node.status === "active" ? "text-primary" : "text-primary/30"}`}>
          {node.status === "active" ? "LIVE" : "DOWN"}
        </span>
      </div>

      <div className="flex items-center justify-between">
        <IpDisplay ip={node.ipAddress} flickering={lifecycle === "decaying"} />
        <span className="text-[10px] font-mono text-primary/50">{node.latencyMs.toFixed(1)}ms</span>
      </div>

      <div className="flex items-center justify-between text-[10px] font-mono">
        <span className="text-primary/40 truncate">{node.region}</span>
        <span className="text-primary/30">HOP.{String(node.hopIndex).padStart(2, "0")}</span>
      </div>

      <div className="border-t border-primary/10 pt-2 flex items-center justify-between gap-1">
        {node.hasSpider && <SpiderIndicator />}
        {node.hasBeacon && <BeaconIndicator />}
        {node.hasWorm && <WormIndicator />}
      </div>

      <div className="flex items-center justify-between text-[9px] font-mono text-primary/25">
        <span>GEN.{node.generation}</span>
        <span>:{node.listenPort}</span>
      </div>

      {lifecycle !== "stable" && (
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute inset-0 opacity-10"
            style={{
              background: lifecycle === "decaying"
                ? "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,0,0,0.3) 2px, rgba(255,0,0,0.3) 3px)"
                : "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,0,0.15) 2px, rgba(0,255,0,0.15) 3px)",
            }}
          />
        </div>
      )}
    </div>
  );
}
