// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useEffect, useRef, useState, useCallback } from "react";
import { useListNodes } from "@workspace/api-client-react";

export type LifecycleState = "stable" | "decaying" | "growing";

export interface LiveNode {
  id: number;
  name: string;
  layer: string;
  ipAddress: string;
  region: string;
  listenPort: number;
  latencyMs: number;
  status: string;
  hopIndex: number;
  hasBeacon: boolean;
  hasSpider: boolean;
  hasWorm: boolean;
  publicKey: string;
  generation: number;
}

interface NodeLifecycleState {
  nodes: LiveNode[];
  lifecycleMap: Record<number, LifecycleState>;
  currentRotatingId: number | null;
  rotationLog: Array<{ id: number; oldIp: string; newIp: string; name: string; ts: number }>;
}

const DECAY_MS = 850;
const GROW_MS = 650;
const INTERVAL_MS = 3000;

export function useNodeLifecycle() {
  const { data: apiData, refetch } = useListNodes(undefined, { query: { refetchInterval: 30_000 } as any });

  const [state, setState] = useState<NodeLifecycleState>({
    nodes: [],
    lifecycleMap: {},
    currentRotatingId: null,
    rotationLog: [],
  });

  const cursorRef = useRef(0);
  const inProgressRef = useRef(false);
  const initializedRef = useRef(false);
  const nodesRef = useRef<LiveNode[]>([]);

  useEffect(() => {
    if (!apiData?.nodes || initializedRef.current) return;
    const live: LiveNode[] = (apiData.nodes as any[]).map((n, i) => ({
      id: n.id,
      name: n.name,
      layer: n.layer,
      ipAddress: n.ipAddress,
      region: n.region,
      listenPort: n.listenPort,
      latencyMs: n.latencyMs,
      status: n.status,
      hopIndex: n.hopIndex,
      hasBeacon: n.hasBeacon ?? true,
      hasSpider: n.hasSpider ?? true,
      hasWorm: n.hasWorm ?? true,
      publicKey: n.publicKey ?? "",
      generation: 1,
    }));
    nodesRef.current = live;
    setState((prev) => ({
      ...prev,
      nodes: live,
      lifecycleMap: Object.fromEntries(live.map((n) => [n.id, "stable" as LifecycleState])),
    }));
    initializedRef.current = true;
  }, [apiData]);

  const rotateNext = useCallback(async () => {
    if (inProgressRef.current || nodesRef.current.length === 0) return;
    inProgressRef.current = true;

    const nodes = nodesRef.current;
    const idx = cursorRef.current % nodes.length;
    cursorRef.current = (cursorRef.current + 1) % nodes.length;
    const target = nodes[idx];

    setState((prev) => ({
      ...prev,
      currentRotatingId: target.id,
      lifecycleMap: { ...prev.lifecycleMap, [target.id]: "decaying" },
    }));

    await new Promise((r) => setTimeout(r, DECAY_MS));

    try {
      const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
      const res = await fetch(`${BASE}/api/nodes/${target.id}/replace`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const fresh = await res.json();

      const updatedNode: LiveNode = {
        id: fresh.id,
        name: fresh.name,
        layer: fresh.layer,
        ipAddress: fresh.ipAddress,
        region: fresh.region,
        listenPort: fresh.listenPort,
        latencyMs: fresh.latencyMs,
        status: fresh.status ?? "active",
        hopIndex: fresh.hopIndex,
        hasBeacon: fresh.hasBeacon ?? true,
        hasSpider: fresh.hasSpider ?? true,
        hasWorm: fresh.hasWorm ?? true,
        publicKey: fresh.publicKey ?? "",
        generation: (target.generation ?? 1) + 1,
      };

      nodesRef.current = nodesRef.current.map((n) => (n.id === target.id ? updatedNode : n));

      setState((prev) => ({
        ...prev,
        nodes: prev.nodes.map((n) => (n.id === target.id ? updatedNode : n)),
        lifecycleMap: { ...prev.lifecycleMap, [target.id]: "growing" },
        rotationLog: [
          { id: target.id, oldIp: target.ipAddress, newIp: fresh.ipAddress, name: fresh.name, ts: Date.now() },
          ...prev.rotationLog.slice(0, 19),
        ],
      }));

      await new Promise((r) => setTimeout(r, GROW_MS));

      setState((prev) => ({
        ...prev,
        currentRotatingId: null,
        lifecycleMap: { ...prev.lifecycleMap, [target.id]: "stable" },
      }));
    } catch {
      setState((prev) => ({
        ...prev,
        currentRotatingId: null,
        lifecycleMap: { ...prev.lifecycleMap, [target.id]: "stable" },
      }));
    }

    inProgressRef.current = false;
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      rotateNext();
    }, INTERVAL_MS);
    return () => clearInterval(timer);
  }, [rotateNext]);

  return {
    nodes: state.nodes,
    lifecycleMap: state.lifecycleMap,
    currentRotatingId: state.currentRotatingId,
    rotationLog: state.rotationLog,
  };
}
