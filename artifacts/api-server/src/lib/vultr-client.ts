// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Vultr API v2 client — thin wrapper around api.vultr.com/v2.
// Requires VULTR_API_KEY environment variable.
// Used only for read operations and firewall management — never destroys instances.

const BASE = "https://api.vultr.com/v2";

function apiKey(): string {
  const k = process.env.VULTR_API_KEY;
  if (!k) throw new Error("VULTR_API_KEY environment variable is not set");
  return k;
}

async function vultrFetch<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
      ...(opts.headers ?? {}),
    },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Vultr API ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

export interface VultrInstance {
  id: string;
  region: string;
  plan: string;
  main_ip: string;
  vcpu_count: number;
  ram: number;
  disk: number;
  status: string;           // "active" | "pending" | "suspended" | "resizing"
  power_status: string;     // "running" | "stopped"
  server_status: string;    // "ok" | "locked" | "installingbooting" | "none"
  label: string;
  hostname: string;
  date_created: string;
  tag: string;
  tags: string[];
}

export interface VultrListResponse<T> {
  instances?: T[];
  meta: { total: number; links: { next: string; prev: string } };
}

/** List all instances on this Vultr account (paginated, auto-follows cursors). */
export async function listInstances(): Promise<VultrInstance[]> {
  const all: VultrInstance[] = [];
  let cursor = "";
  do {
    const qs = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
    const data = await vultrFetch<VultrListResponse<VultrInstance>>(`/instances${qs}`);
    all.push(...(data.instances ?? []));
    cursor = data.meta?.links?.next ?? "";
  } while (cursor);
  return all;
}

/** Get a single instance by ID. */
export async function getInstance(id: string): Promise<VultrInstance> {
  const data = await vultrFetch<{ instance: VultrInstance }>(`/instances/${id}`);
  return data.instance;
}

export interface VultrFirewallGroup {
  id: string;
  description: string;
  date_created: string;
  date_modified: string;
  instance_count: number;
  rule_count: number;
  max_rule_count: number;
}

export interface VultrFirewallRule {
  id: number;
  type: string;
  action: string;
  protocol: string;
  port: string;
  subnet: string;
  subnet_size: number;
  source: string;
  notes: string;
}

/** List all firewall groups. */
export async function listFirewallGroups(): Promise<VultrFirewallGroup[]> {
  const data = await vultrFetch<{ firewall_groups: VultrFirewallGroup[] }>("/firewalls");
  return data.firewall_groups ?? [];
}

/** List rules for a firewall group. */
export async function listFirewallRules(groupId: string): Promise<VultrFirewallRule[]> {
  const data = await vultrFetch<{ firewall_rules: VultrFirewallRule[] }>(`/firewalls/${groupId}/rules`);
  return data.firewall_rules ?? [];
}

/** Map Vultr region code to human-readable label (best-effort). */
export function regionLabel(code: string): string {
  const map: Record<string, string> = {
    lax: "Los Angeles", lhr: "London", ord: "Chicago", nrt: "Tokyo",
    ewr: "New Jersey", mia: "Miami", atl: "Atlanta", dfw: "Dallas",
    sea: "Seattle", ams: "Amsterdam", fra: "Frankfurt", par: "Paris",
    syd: "Sydney", sgp: "Singapore", yto: "Toronto", sao: "Sao Paulo",
    icn: "Seoul", bom: "Mumbai", mel: "Melbourne", mad: "Madrid",
    waw: "Warsaw", man: "Manchester", sto: "Stockholm",
  };
  return map[code] ?? code.toUpperCase();
}
