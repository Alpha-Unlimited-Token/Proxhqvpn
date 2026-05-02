// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useEffect, useRef, useState, useCallback } from "react";
import type { LifecycleState, LiveNode } from "./useNodeLifecycle";

const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
const DECAY_MS = 850;
const GROW_MS = 650;
const INTERVAL_MS = 3200;

interface VpgServer {
  ip: string;
  score: number;
  ping: number;
  speedMbps: number;
  country: string;
  countryCode: string;
  sessions: number;
  logType: string;
  operator: string;
  hasOvpn: boolean;
}

function ipToId(ip: string): number {
  return ip.split(".").reduce((acc, octet, i) => acc + parseInt(octet) * Math.pow(256, 3 - i), 0) >>> 0;
}

function serverToNode(s: VpgServer, hopIndex: number, generation = 1): LiveNode {
  return {
    id: ipToId(s.ip),
    name: `VPG-${s.countryCode}-${s.ip.split(".").pop()}`,
    layer: "inner",
    ipAddress: s.ip,
    region: s.country,
    listenPort: 1194,
    latencyMs: s.ping,
    status: "active",
    hopIndex,
    hasBeacon: true,
    hasSpider: true,
    hasWorm: true,
    publicKey: "",
    generation,
  };
}

export interface VpnGateInnerState {
  nodes: LiveNode[];
  lifecycleMap: Record<number, LifecycleState>;
  currentRotatingId: number | null;
  rotationLog: Array<{ id: number; oldIp: string; newIp: string; name: string; ts: number }>;
  isReady: boolean;
  poolSize: number;
  activeCount: number;
}

export function useVpnGateInner(): VpnGateInnerState {
  const [nodes, setNodes] = useState<LiveNode[]>([]);
  const [lifecycleMap, setLifecycleMap] = useState<Record<number, LifecycleState>>({});
  const [currentRotatingId, setCurrentRotatingId] = useState<number | null>(null);
  const [rotationLog, setRotationLog] = useState<
    Array<{ id: number; oldIp: string; newIp: string; name: string; ts: number }>
  >([]);
  const [isReady, setIsReady] = useState(false);
  const [poolSize, setPoolSize] = useState(0);

  const poolRef = useRef<VpgServer[]>([]);
  const nodesRef = useRef<LiveNode[]>([]);
  const replacementCursorRef = useRef(0);
  const inProgressRef = useRef(false);
  const initializedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    async function loadPool() {
      try {
        const res = await fetch(`${BASE}/api/vpngate/veil?limit=2000`);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        const incoming: VpgServer[] = data.servers ?? [];
        if (incoming.length === 0 || cancelled) return;

        poolRef.current = incoming;
        setPoolSize(incoming.length);

        if (!initializedRef.current) {
          // Activate ALL pool nodes as inner nodes
          const active = incoming.map((s, i) => serverToNode(s, i + 1));
          nodesRef.current = active;
          replacementCursorRef.current = 0;
          setNodes(active);
          setLifecycleMap(
            Object.fromEntries(active.map((n) => [n.id, "stable" as LifecycleState]))
          );
          initializedRef.current = true;
          setIsReady(true);
        } else {
          // On re-fetch: diff incoming vs current — rotate in any new IPs
          const currentIps = new Set(nodesRef.current.map((n) => n.ipAddress));
          const freshServers = incoming.filter((s) => !currentIps.has(s.ip));
          if (freshServers.length > 0) {
            // Queue fresh IPs at the front of the replacement pool
            poolRef.current = [...freshServers, ...incoming.filter((s) => currentIps.has(s.ip))];
            replacementCursorRef.current = 0;
          }
        }
      } catch {}
    }

    loadPool();
    const refresh = setInterval(loadPool, 5 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(refresh);
    };
  }, []);

  const rotateNext = useCallback(async () => {
    if (inProgressRef.current || nodesRef.current.length === 0 || poolRef.current.length === 0) return;
    inProgressRef.current = true;

    const current = nodesRef.current;
    // Pick a random active node to rotate out
    const targetIdx = Math.floor(Math.random() * current.length);
    const target = current[targetIdx];

    setCurrentRotatingId(target.id);
    setLifecycleMap((prev) => ({ ...prev, [target.id]: "decaying" }));
    await new Promise((r) => setTimeout(r, DECAY_MS));

    // Pull next replacement from pool, cycling through
    const pool = poolRef.current;
    const cursor = replacementCursorRef.current % pool.length;
    replacementCursorRef.current = (replacementCursorRef.current + 1) % pool.length;
    const replacement = pool[cursor];

    // Skip if replacement IP is already active (avoid duplicates)
    const activeIps = new Set(nodesRef.current.map((n) => n.ipAddress));
    let finalReplacement = replacement;
    let searchOffset = 1;
    while (activeIps.has(finalReplacement.ip) && searchOffset < pool.length) {
      finalReplacement = pool[(cursor + searchOffset) % pool.length];
      searchOffset++;
    }

    const newNode = serverToNode(finalReplacement, target.hopIndex, (target.generation ?? 1) + 1);
    const updatedNodes = current.map((n) => (n.id === target.id ? newNode : n));
    nodesRef.current = updatedNodes;

    setNodes(updatedNodes);
    setLifecycleMap((prev) => {
      const next = { ...prev };
      delete next[target.id];
      next[newNode.id] = "growing";
      return next;
    });

    if (target.ipAddress !== newNode.ipAddress) {
      setRotationLog((prev) => [
        {
          id: newNode.id,
          oldIp: target.ipAddress,
          newIp: newNode.ipAddress,
          name: newNode.name,
          ts: Date.now(),
        },
        ...prev.slice(0, 49),
      ]);
    }

    await new Promise((r) => setTimeout(r, GROW_MS));
    setCurrentRotatingId(null);
    setLifecycleMap((prev) => ({ ...prev, [newNode.id]: "stable" }));
    inProgressRef.current = false;
  }, []);

  useEffect(() => {
    if (!isReady) return;
    const timer = setInterval(rotateNext, INTERVAL_MS);
    return () => clearInterval(timer);
  }, [isReady, rotateNext]);

  return {
    nodes,
    lifecycleMap,
    currentRotatingId,
    rotationLog,
    isReady,
    poolSize,
    activeCount: nodes.length,
  };
}
