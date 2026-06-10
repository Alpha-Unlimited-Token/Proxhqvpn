import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import fetch from "node-fetch";

const router = Router();

async function checkPostgres(): Promise<"ok" | "error"> {
  try {
    await db.execute(sql`SELECT 1`);
    return "ok";
  } catch {
    return "error";
  }
}

async function checkExternal(url: string): Promise<"ok" | "error" | "unconfigured"> {
  if (!url) return "unconfigured";
  try {
    const r = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(3000) });
    return r.ok ? "ok" : "error";
  } catch {
    return "error";
  }
}

router.get("/graph", async (_req: Request, res: Response) => {
  const [dbStatus, stripeStatus, clerkStatus] = await Promise.all([
    checkPostgres(),
    checkExternal(process.env.STRIPE_SECRET_KEY ? "https://api.stripe.com/v1" : ""),
    checkExternal(process.env.CLERK_SECRET_KEY ? "https://api.clerk.com/v1/health" : ""),
  ]);

  res.json({
    nodes: [
      { id: "api",      label: "API Server",             status: "ok" },
      { id: "db",       label: "PostgreSQL",              status: dbStatus },
      { id: "wireguard",label: "WireGuard Nodes",         status: "unknown" },
      { id: "daemon",   label: "Node Daemon",             status: "unknown" },
      { id: "firewall", label: "Firewall Control Plane",  status: "unknown" },
      { id: "stripe",   label: "Stripe Billing",          status: stripeStatus },
      { id: "clerk",    label: "Clerk Auth",              status: clerkStatus },
    ],
    edges: [
      ["api", "db"],
      ["api", "wireguard"],
      ["wireguard", "daemon"],
      ["api", "firewall"],
      ["api", "stripe"],
      ["api", "clerk"],
    ],
  });
});

export default router;
