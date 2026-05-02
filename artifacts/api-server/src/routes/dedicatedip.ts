// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Router } from "express";
import { getAuth } from "@clerk/express";

const router = Router();

interface DedicatedIp {
  id: string;
  ip: string;
  city: string;
  country: string;
  region: string;
  assignedAt: string;
  plan: "monthly" | "annual";
  expiresAt: string;
  active: boolean;
}

// Simulated IP pool — in production would be real VPN server IPs
const IP_POOL = [
  { city: "New York",     country: "US", region: "Americas",     ip: "198.51.100.14" },
  { city: "Los Angeles",  country: "US", region: "Americas",     ip: "203.0.113.47" },
  { city: "Chicago",      country: "US", region: "Americas",     ip: "192.0.2.83" },
  { city: "London",       country: "GB", region: "Europe",       ip: "198.51.100.201" },
  { city: "Frankfurt",    country: "DE", region: "Europe",       ip: "203.0.113.156" },
  { city: "Amsterdam",    country: "NL", region: "Europe",       ip: "192.0.2.212" },
  { city: "Paris",        country: "FR", region: "Europe",       ip: "198.51.100.78" },
  { city: "Tokyo",        country: "JP", region: "Asia-Pacific", ip: "203.0.113.243" },
  { city: "Singapore",    country: "SG", region: "Asia-Pacific", ip: "192.0.2.139" },
  { city: "Sydney",       country: "AU", region: "Asia-Pacific", ip: "198.51.100.95" },
  { city: "Toronto",      country: "CA", region: "Americas",     ip: "203.0.113.61" },
  { city: "São Paulo",    country: "BR", region: "Americas",     ip: "192.0.2.178" },
];

const assignmentStore = new Map<string, DedicatedIp>();
const assignedIps = new Set<string>();

function uid(req: any): string {
  return (getAuth(req) as any)?.userId || "anon";
}

router.get("/pool", (_req, res) => {
  const available = IP_POOL.filter(p => !assignedIps.has(p.ip));
  res.json({ pool: available, total: IP_POOL.length, available: available.length });
});

router.get("/current", (req, res) => {
  const assignment = assignmentStore.get(uid(req));
  res.json({ assignment: assignment ?? null });
});

router.post("/assign", (req, res) => {
  const userId = uid(req);
  if (assignmentStore.has(userId)) {
    return res.status(409).json({ error: "You already have a dedicated IP. Release it first." });
  }

  const { city, plan = "monthly" } = req.body;
  if (!["monthly", "annual"].includes(plan)) {
    return res.status(400).json({ error: "plan must be 'monthly' or 'annual'" });
  }

  const slot = city
    ? IP_POOL.find(p => p.city === city && !assignedIps.has(p.ip))
    : IP_POOL.find(p => !assignedIps.has(p.ip));

  if (!slot) {
    return res.status(409).json({ error: city ? `No IPs available in ${city}` : "No IPs currently available" });
  }

  const expiresAt = new Date();
  expiresAt.setMonth(expiresAt.getMonth() + (plan === "annual" ? 12 : 1));

  const assignment: DedicatedIp = {
    id: `dip_${Date.now().toString(36)}`,
    ip: slot.ip,
    city: slot.city,
    country: slot.country,
    region: slot.region,
    assignedAt: new Date().toISOString(),
    plan: plan as "monthly" | "annual",
    expiresAt: expiresAt.toISOString(),
    active: true,
  };

  assignmentStore.set(userId, assignment);
  assignedIps.add(slot.ip);
  res.json({ ok: true, assignment });
});

router.delete("/release", (req, res) => {
  const userId = uid(req);
  const assignment = assignmentStore.get(userId);
  if (!assignment) return res.status(404).json({ error: "No dedicated IP to release" });
  assignedIps.delete(assignment.ip);
  assignmentStore.delete(userId);
  res.json({ ok: true });
});

export default router;
