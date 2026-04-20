/**
 * SilkWeb Engine
 *
 * Connects every subsystem — node rotation, spider crawl, beacon pulses,
 * worm suppression, and VPN Gate inner/outer layers — into one unified
 * defensive mesh:
 *
 *  Node decays → old IP becomes a live honeypot
 *  Honeypot IPs attract and trap probes
 *  Inner-layer hits → connection bounced back to outer layer (redirect loop)
 *  SilkWeb collapse → mass concurrent rotation, flood of new honeypots,
 *                      entire path geometry reforms in a new direction
 */

import { useEffect, useRef, useState, useCallback } from "react";

export type EventKind =
  | "DECAY"
  | "HONEYPOT_SPAWN"
  | "PROBE_DETECTED"
  | "INNER_REDIRECT"
  | "OUTER_TRAP"
  | "REGROWTH"
  | "COLLAPSE_START"
  | "COLLAPSE_WAVE"
  | "COLLAPSE_COMPLETE"
  | "SPIDER_CRAWL"
  | "BEACON_PULSE"
  | "WORM_SUPPRESS";

export interface SilkEvent {
  id: string;
  ts: number;
  kind: EventKind;
  ip: string;
  layer: "inner" | "outer" | "vpngate" | "system";
  detail: string;
  severity: "info" | "warn" | "critical";
}

export interface Honeypot {
  id: string;
  ip: string;
  layer: "inner" | "outer";
  spawnedAt: number;
  expiresAt: number;
  probeCount: number;
  trapped: boolean;
}

export interface SilkWebState {
  events: SilkEvent[];
  honeypots: Honeypot[];
  collapseActive: boolean;
  collapseProgress: number;
  totalDecays: number;
  totalRedirects: number;
  totalTrapped: number;
  webGeneration: number;
  triggerCollapse: () => void;
  emitDecay: (ip: string, layer: "inner" | "outer", newIp: string) => void;
}

const HONEYPOT_TTL = 45_000;
const PROBE_INTERVAL_MIN = 6_000;
const PROBE_INTERVAL_MAX = 18_000;
const SPIDER_INTERVAL = 4_200;
const BEACON_INTERVAL = 7_100;
const WORM_INTERVAL = 5_800;
const COLLAPSE_WAVE_COUNT = 12;
const COLLAPSE_WAVE_INTERVAL = 280;

const PROBE_SOURCES = [
  "203.0.113.44", "198.51.100.12", "192.0.2.88", "203.0.113.7",
  "198.51.100.99", "192.0.2.201", "10.200.18.4", "172.16.42.9",
  "203.0.113.133", "198.51.100.77", "45.33.32.156", "104.21.14.1",
  "185.220.101.44", "95.142.47.15", "91.108.4.0", "178.175.0.0",
];

const SPIDER_TARGETS = [
  "scanning subnet /24", "crawling route table", "mapping hop topology",
  "probing WireGuard port", "resolving PTR record", "fingerprinting TLS",
  "tracing BGP path", "enumerating DNS zone",
];

const WORM_OPS = [
  "suppressing latency spike", "absorbing timing jitter",
  "rewriting TTL field", "padding packet size", "nullifying DPI signature",
  "fragmenting payload", "rotating cipher suite",
];

function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function fakeIp(): string {
  return `${randInt(1, 254)}.${randInt(0, 255)}.${randInt(0, 255)}.${randInt(1, 254)}`;
}

export function useSilkWebEngine(): SilkWebState {
  const [events, setEvents] = useState<SilkEvent[]>([]);
  const [honeypots, setHoneypots] = useState<Honeypot[]>([]);
  const [collapseActive, setCollapseActive] = useState(false);
  const [collapseProgress, setCollapseProgress] = useState(0);
  const [totalDecays, setTotalDecays] = useState(0);
  const [totalRedirects, setTotalRedirects] = useState(0);
  const [totalTrapped, setTotalTrapped] = useState(0);
  const [webGeneration, setWebGeneration] = useState(1);

  const honeypotsRef = useRef<Honeypot[]>([]);
  const collapseRef = useRef(false);

  const pushEvent = useCallback((e: Omit<SilkEvent, "id" | "ts">) => {
    const full: SilkEvent = { ...e, id: uid(), ts: Date.now() };
    setEvents((prev) => [full, ...prev].slice(0, 120));
  }, []);

  const spawnHoneypot = useCallback((ip: string, layer: "inner" | "outer") => {
    const hp: Honeypot = {
      id: uid(),
      ip,
      layer,
      spawnedAt: Date.now(),
      expiresAt: Date.now() + HONEYPOT_TTL,
      probeCount: 0,
      trapped: false,
    };
    honeypotsRef.current = [hp, ...honeypotsRef.current].slice(0, 80);
    setHoneypots([...honeypotsRef.current]);
    pushEvent({
      kind: "HONEYPOT_SPAWN",
      ip,
      layer,
      detail: `Decay residue at ${ip} promoted to live honeypot`,
      severity: "info",
    });
  }, [pushEvent]);

  // Called by outer hooks when a node rotates
  const emitDecay = useCallback((oldIp: string, layer: "inner" | "outer", newIp: string) => {
    setTotalDecays((n) => n + 1);
    pushEvent({
      kind: "DECAY",
      ip: oldIp,
      layer,
      detail: `${layer.toUpperCase()} node ${oldIp} decayed → regrew as ${newIp}`,
      severity: "info",
    });
    pushEvent({
      kind: "REGROWTH",
      ip: newIp,
      layer,
      detail: `Fresh ${layer.toUpperCase()} node online at ${newIp}`,
      severity: "info",
    });
    spawnHoneypot(oldIp, layer);
  }, [pushEvent, spawnHoneypot]);

  // Probe simulation — probes hit random honeypot IPs
  useEffect(() => {
    function scheduleProbe() {
      const delay = randInt(PROBE_INTERVAL_MIN, PROBE_INTERVAL_MAX);
      return setTimeout(() => {
        const active = honeypotsRef.current.filter((h) => !h.trapped && Date.now() < h.expiresAt);
        const probeIp = pickRandom(PROBE_SOURCES);

        if (active.length > 0) {
          const target = pickRandom(active);
          honeypotsRef.current = honeypotsRef.current.map((h) =>
            h.id === target.id
              ? { ...h, probeCount: h.probeCount + 1, trapped: target.probeCount >= 1 }
              : h
          );
          setHoneypots([...honeypotsRef.current]);

          pushEvent({
            kind: "PROBE_DETECTED",
            ip: probeIp,
            layer: target.layer,
            detail: `Probe from ${probeIp} hit honeypot ${target.ip} (${target.layer})`,
            severity: "warn",
          });

          if (target.layer === "inner") {
            // Inner-layer hit → redirect back to outer
            setTotalRedirects((n) => n + 1);
            setTimeout(() => {
              pushEvent({
                kind: "INNER_REDIRECT",
                ip: probeIp,
                layer: "inner",
                detail: `${probeIp} bounced from inner ${target.ip} → re-injected into outer swarm`,
                severity: "critical",
              });
            }, 800);
            setTimeout(() => {
              const outerHoneypot = honeypotsRef.current.find(
                (h) => h.layer === "outer" && !h.trapped
              );
              const trapIp = outerHoneypot?.ip ?? fakeIp();
              setTotalTrapped((n) => n + 1);
              if (outerHoneypot) {
                honeypotsRef.current = honeypotsRef.current.map((h) =>
                  h.id === outerHoneypot.id ? { ...h, trapped: true } : h
                );
                setHoneypots([...honeypotsRef.current]);
              }
              pushEvent({
                kind: "OUTER_TRAP",
                ip: probeIp,
                layer: "outer",
                detail: `${probeIp} looping in outer maze at ${trapIp} — fingerprinted & dropped`,
                severity: "critical",
              });
            }, 2200);
          } else {
            setTimeout(() => {
              setTotalTrapped((n) => n + 1);
              honeypotsRef.current = honeypotsRef.current.map((h) =>
                h.id === target.id ? { ...h, trapped: true } : h
              );
              setHoneypots([...honeypotsRef.current]);
              pushEvent({
                kind: "OUTER_TRAP",
                ip: probeIp,
                layer: "outer",
                detail: `${probeIp} trapped in outer dead-end at ${target.ip}`,
                severity: "warn",
              });
            }, 1400);
          }
        } else {
          // No honeypots live — probe hits nothing, logged and dropped
          pushEvent({
            kind: "PROBE_DETECTED",
            ip: probeIp,
            layer: "outer",
            detail: `Blind probe from ${probeIp} — no live honeypot matched, signature logged`,
            severity: "info",
          });
        }

        scheduleProbe();
      }, delay);
    }

    const t = scheduleProbe();
    return () => clearTimeout(t);
  }, [pushEvent]);

  // Honeypot TTL reaper
  useEffect(() => {
    const t = setInterval(() => {
      const now = Date.now();
      const pruned = honeypotsRef.current.filter((h) => h.expiresAt > now);
      if (pruned.length !== honeypotsRef.current.length) {
        honeypotsRef.current = pruned;
        setHoneypots([...pruned]);
      }
    }, 5000);
    return () => clearInterval(t);
  }, []);

  // Seed initial honeypots from random IPs so the feed isn't empty on load
  useEffect(() => {
    const initialIps = Array.from({ length: 8 }, () => fakeIp());
    initialIps.forEach((ip) => spawnHoneypot(ip, Math.random() > 0.5 ? "inner" : "outer"));
  }, [spawnHoneypot]);

  // Spider crawl events
  useEffect(() => {
    const t = setInterval(() => {
      pushEvent({
        kind: "SPIDER_CRAWL",
        ip: fakeIp(),
        layer: "outer",
        detail: `Spider: ${pickRandom(SPIDER_TARGETS)} @ ${fakeIp()}`,
        severity: "info",
      });
    }, SPIDER_INTERVAL);
    return () => clearInterval(t);
  }, [pushEvent]);

  // Beacon pulses
  useEffect(() => {
    const t = setInterval(() => {
      pushEvent({
        kind: "BEACON_PULSE",
        ip: fakeIp(),
        layer: "inner",
        detail: `Beacon sweep: node ${fakeIp()} responding — integrity confirmed`,
        severity: "info",
      });
    }, BEACON_INTERVAL);
    return () => clearInterval(t);
  }, [pushEvent]);

  // Worm suppressors
  useEffect(() => {
    const t = setInterval(() => {
      pushEvent({
        kind: "WORM_SUPPRESS",
        ip: fakeIp(),
        layer: "inner",
        detail: `Worm: ${pickRandom(WORM_OPS)} on ${fakeIp()}`,
        severity: "info",
      });
    }, WORM_INTERVAL);
    return () => clearInterval(t);
  }, [pushEvent]);

  // SilkWeb collapse trigger
  const triggerCollapse = useCallback(async () => {
    if (collapseRef.current) return;
    collapseRef.current = true;
    setCollapseActive(true);
    setCollapseProgress(0);

    pushEvent({
      kind: "COLLAPSE_START",
      ip: "0.0.0.0",
      layer: "system",
      detail: "SilkWeb COLLAPSE initiated — mass node rotation cascading",
      severity: "critical",
    });

    for (let wave = 0; wave < COLLAPSE_WAVE_COUNT; wave++) {
      await new Promise((r) => setTimeout(r, COLLAPSE_WAVE_INTERVAL));
      const waveIp = fakeIp();
      const newIp = fakeIp();
      const layer: "inner" | "outer" = wave % 3 === 0 ? "inner" : "outer";
      spawnHoneypot(waveIp, layer);
      setCollapseProgress(Math.round(((wave + 1) / COLLAPSE_WAVE_COUNT) * 100));
      pushEvent({
        kind: "COLLAPSE_WAVE",
        ip: waveIp,
        layer,
        detail: `Wave ${wave + 1}/${COLLAPSE_WAVE_COUNT}: ${layer} ${waveIp} collapsed → ${newIp}`,
        severity: "warn",
      });
    }

    await new Promise((r) => setTimeout(r, 400));
    setWebGeneration((g) => g + 1);
    pushEvent({
      kind: "COLLAPSE_COMPLETE",
      ip: "0.0.0.0",
      layer: "system",
      detail: `SilkWeb reformed — new geometry gen #${webGeneration + 1}, ${COLLAPSE_WAVE_COUNT} honeypots planted`,
      severity: "warn",
    });

    setCollapseActive(false);
    setCollapseProgress(100);
    collapseRef.current = false;
  }, [pushEvent, spawnHoneypot, webGeneration]);

  return {
    events,
    honeypots,
    collapseActive,
    collapseProgress,
    totalDecays,
    totalRedirects,
    totalTrapped,
    webGeneration,
    triggerCollapse,
    emitDecay,
  };
}
