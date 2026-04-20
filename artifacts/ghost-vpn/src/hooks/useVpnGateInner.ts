import { useEffect, useRef, useState, useCallback } from "react";
import type { LifecycleState, LiveNode } from "./useNodeLifecycle";

const BASE = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
const DECAY_MS = 850;
const GROW_MS = 650;
const INTERVAL_MS = 3200;
const INNER_COUNT = 10;

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
}

export function useVpnGateInner(): VpnGateInnerState {
  const [nodes, setNodes] = useState<LiveNode[]>([]);
  const [lifecycleMap, setLifecycleMap] = useState<Record<number, LifecycleState>>({});
  const [currentRotatingId, setCurrentRotatingId] = useState<number | null>(null);
  const [rotationLog, setRotationLog] = useState<Array<{ id: number; oldIp: string; newIp: string; name: string; ts: number }>>([]);
  const [isReady, setIsReady] = useState(false);
  const [poolSize, setPoolSize] = useState(0);

  const poolRef = useRef<VpgServer[]>([]);
  const nodesRef = useRef<LiveNode[]>([]);
  const cursorRef = useRef(INNER_COUNT);
  const inProgressRef = useRef(false);
  const initializedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    async function loadPool() {
      try {
        const res = await fetch(`${BASE}/api/vpngate/veil?limit=200`);
        if (!res.ok || cancelled) return;
        const data = await res.json();
        const pool: VpgServer[] = data.servers ?? [];
        if (pool.length === 0 || cancelled) return;
        poolRef.current = pool;
        setPoolSize(pool.length);
        if (!initializedRef.current) {
          const initial = pool.slice(0, INNER_COUNT).map((s, i) => serverToNode(s, i + 1));
          nodesRef.current = initial;
          setNodes(initial);
          setLifecycleMap(Object.fromEntries(initial.map((n) => [n.id, "stable" as LifecycleState])));
          cursorRef.current = INNER_COUNT;
          initializedRef.current = true;
          setIsReady(true);
        }
      } catch {}
    }
    loadPool();
    const refresh = setInterval(loadPool, 5 * 60 * 1000);
    return () => { cancelled = true; clearInterval(refresh); };
  }, []);

  const rotateNext = useCallback(async () => {
    if (inProgressRef.current || nodesRef.current.length === 0 || poolRef.current.length === 0) return;
    inProgressRef.current = true;

    const pool = poolRef.current;
    const currentNodes = nodesRef.current;
    const targetIdx = Math.floor(Math.random() * currentNodes.length);
    const target = currentNodes[targetIdx];

    setCurrentRotatingId(target.id);
    setLifecycleMap((prev) => ({ ...prev, [target.id]: "decaying" }));
    await new Promise((r) => setTimeout(r, DECAY_MS));

    const cursor = cursorRef.current % pool.length;
    cursorRef.current = (cursorRef.current + 1) % pool.length;
    const replacement = pool[cursor];
    const newNode = serverToNode(replacement, target.hopIndex, (target.generation ?? 1) + 1);

    const updatedNodes = currentNodes.map((n) => (n.id === target.id ? newNode : n));
    nodesRef.current = updatedNodes;

    setNodes(updatedNodes);
    setLifecycleMap((prev) => {
      const next = { ...prev };
      delete next[target.id];
      next[newNode.id] = "growing";
      return next;
    });
    setRotationLog((prev) => [
      { id: newNode.id, oldIp: target.ipAddress, newIp: newNode.ipAddress, name: newNode.name, ts: Date.now() },
      ...prev.slice(0, 19),
    ]);

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

  return { nodes, lifecycleMap, currentRotatingId, rotationLog, isReady, poolSize };
}
