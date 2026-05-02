// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Router } from "express";
import { getAuth } from "@clerk/express";
import * as net from "net";

function tcpProbe(host: string, port: number, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let resolved = false;
    const done = (result: boolean) => {
      if (!resolved) { resolved = true; socket.destroy(); resolve(result); }
    };
    socket.setTimeout(timeoutMs);
    socket.on("connect", () => done(true));
    socket.on("error", () => done(false));
    socket.on("timeout", () => done(false));
    socket.connect(port, host);
  });
}

const router = Router();

type Protocol = "TCP" | "UDP" | "TCP+UDP";

interface ForwardRule {
  id: string;
  protocol: Protocol;
  externalPort: number;
  internalPort: number;
  description: string;
  status: "active" | "inactive" | "error";
  createdAt: string;
  lastChecked: string | null;
  reachable: boolean | null;
}

const rulesStore = new Map<string, ForwardRule[]>();

function uid(req: any): string {
  return (getAuth(req) as any)?.userId || "anon";
}

function makeId(): string {
  return `pf_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function isValidPort(p: number): boolean {
  return Number.isInteger(p) && p >= 1 && p <= 65535;
}

router.get("/rules", (req, res) => {
  const rules = rulesStore.get(uid(req)) ?? [];
  res.json({ rules });
});

router.post("/rules", (req, res) => {
  const { protocol = "TCP", externalPort, internalPort, description = "" } = req.body;
  if (!isValidPort(externalPort)) return res.status(400).json({ error: "Invalid external port (1–65535)" });
  if (!isValidPort(internalPort)) return res.status(400).json({ error: "Invalid internal port (1–65535)" });
  if (!["TCP", "UDP", "TCP+UDP"].includes(protocol)) return res.status(400).json({ error: "Protocol must be TCP, UDP, or TCP+UDP" });

  const userId = uid(req);
  const rules = rulesStore.get(userId) ?? [];

  if (rules.some(r => r.externalPort === externalPort)) {
    return res.status(409).json({ error: `External port ${externalPort} already in use` });
  }

  const rule: ForwardRule = {
    id: makeId(),
    protocol: protocol as Protocol,
    externalPort,
    internalPort,
    description: String(description).slice(0, 100),
    status: "active",
    createdAt: new Date().toISOString(),
    lastChecked: null,
    reachable: null,
  };
  rules.push(rule);
  rulesStore.set(userId, rules);
  res.json({ ok: true, rule });
});

router.delete("/rules/:id", (req, res) => {
  const userId = uid(req);
  const rules = rulesStore.get(userId) ?? [];
  const before = rules.length;
  const updated = rules.filter(r => r.id !== req.params.id);
  if (updated.length === before) return res.status(404).json({ error: "Rule not found" });
  rulesStore.set(userId, updated);
  res.json({ ok: true });
});

router.put("/rules/:id/toggle", (req, res) => {
  const userId = uid(req);
  const rules = rulesStore.get(userId) ?? [];
  const rule = rules.find(r => r.id === req.params.id);
  if (!rule) return res.status(404).json({ error: "Rule not found" });
  rule.status = rule.status === "active" ? "inactive" : "active";
  rulesStore.set(userId, rules);
  res.json({ ok: true, rule });
});

router.post("/check/:id", async (req, res) => {
  const userId = uid(req);
  const rules = rulesStore.get(userId) ?? [];
  const rule = rules.find(r => r.id === req.params.id);
  if (!rule) return res.status(404).json({ error: "Rule not found" });

  rule.lastChecked = new Date().toISOString();

  if (rule.status !== "active") {
    rule.reachable = false;
  } else {
    rule.reachable = await tcpProbe("127.0.0.1", rule.externalPort, 3000);
  }

  rulesStore.set(userId, rules);
  res.json({ ok: true, rule });
});

export default router;
