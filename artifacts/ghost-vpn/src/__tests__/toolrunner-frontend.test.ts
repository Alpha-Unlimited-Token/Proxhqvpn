// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Tool Runner frontend unit tests
import { describe, it, expect } from "vitest";

// ── Category color mapping completeness ───────────────────────────────────────
describe("Tool category color map", () => {
  const CATEGORY_COLORS: Record<string, string> = {
    "Network Scanning":         "text-blue-400   border-blue-500/30   bg-blue-900/10",
    "Vulnerability Scanning":   "text-red-400    border-red-500/30    bg-red-900/10",
    "Injection Testing":        "text-orange-400 border-orange-500/30 bg-orange-900/10",
    "Fuzzing":                  "text-yellow-400 border-yellow-500/30 bg-yellow-900/10",
    "Subdomain Enumeration":    "text-cyan-400   border-cyan-500/30   bg-cyan-900/10",
    "HTTP Probing":             "text-[#00ff88]  border-[#00ff88]/30  bg-[#00ff88]/5",
    "DNS":                      "text-purple-400 border-purple-500/30 bg-purple-900/10",
    "SSL / TLS":                "text-pink-400   border-pink-500/30   bg-pink-900/10",
    "HTTP Client":              "text-sky-400    border-sky-500/30    bg-sky-900/10",
    "OSINT":                    "text-amber-400  border-amber-500/30  bg-amber-900/10",
    "Network":                  "text-teal-400   border-teal-500/30   bg-teal-900/10",
    "Password Attacks":         "text-rose-400   border-rose-500/30   bg-rose-900/10",
    "Forensics & DFIR":         "text-indigo-400 border-indigo-500/30 bg-indigo-900/10",
    "Cryptography":             "text-violet-400 border-violet-500/30 bg-violet-900/10",
    "Stress Testing":           "text-orange-400 border-orange-500/30 bg-orange-900/10",
  };

  it("has 15 categories in color map", () => {
    expect(Object.keys(CATEGORY_COLORS).length).toBe(15);
  });

  it("all original categories still have color entries", () => {
    const original = [
      "Network Scanning", "Vulnerability Scanning", "Injection Testing",
      "Fuzzing", "Subdomain Enumeration", "HTTP Probing", "DNS",
      "SSL / TLS", "HTTP Client", "OSINT", "Network",
    ];
    for (const cat of original) {
      expect(CATEGORY_COLORS).toHaveProperty(cat);
    }
  });

  it("new categories have color entries", () => {
    const newCats = ["Password Attacks", "Forensics & DFIR", "Cryptography", "Stress Testing"];
    for (const cat of newCats) {
      expect(CATEGORY_COLORS).toHaveProperty(cat);
    }
  });
});

// ── ToolHistory pagination ─────────────────────────────────────────────────────
describe("ToolHistory pagination logic", () => {
  it("first page has offset 0", () => {
    const page = 0;
    const limit = 20;
    expect(page * limit).toBe(0);
  });
  it("second page has offset 20", () => {
    const page = 1;
    const limit = 20;
    expect(page * limit).toBe(20);
  });
  it("shows Next button only if jobs.length === limit", () => {
    const jobs = Array(20).fill({});
    const LIMIT = 20;
    expect(jobs.length < LIMIT).toBe(false);
    expect(jobs.length === LIMIT).toBe(true);
  });
  it("hides Next button when fewer than limit results", () => {
    const jobs = Array(5).fill({});
    const LIMIT = 20;
    expect(jobs.length < LIMIT).toBe(true);
  });
});

// ── ToolScope validation ───────────────────────────────────────────────────────
describe("ToolScope — scope type display", () => {
  const TYPE_COLORS: Record<string, string> = {
    ip:     "text-blue-400   border-blue-500/30   bg-blue-900/10",
    cidr:   "text-purple-400 border-purple-500/30 bg-purple-900/10",
    domain: "text-cyan-400   border-cyan-500/30   bg-cyan-900/10",
    url:    "text-green-400  border-green-500/30  bg-green-900/10",
  };

  it("has all 4 scope types in color map", () => {
    expect(Object.keys(TYPE_COLORS)).toContain("ip");
    expect(Object.keys(TYPE_COLORS)).toContain("cidr");
    expect(Object.keys(TYPE_COLORS)).toContain("domain");
    expect(Object.keys(TYPE_COLORS)).toContain("url");
  });
});

// ── NodeHealth stale detection ─────────────────────────────────────────────────
describe("NodeHealth — stale detection logic", () => {
  const STALE_THRESHOLD_MS = 5 * 60 * 1000;

  function isStale(lastSeen: string): boolean {
    return Date.now() - new Date(lastSeen).getTime() > STALE_THRESHOLD_MS;
  }

  it("marks node stale if last seen >5 minutes ago", () => {
    const sixMinsAgo = new Date(Date.now() - 6 * 60 * 1000).toISOString();
    expect(isStale(sixMinsAgo)).toBe(true);
  });
  it("marks node fresh if last seen <5 minutes ago", () => {
    const twoMinsAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    expect(isStale(twoMinsAgo)).toBe(false);
  });
  it("marks node stale exactly at threshold boundary +1ms", () => {
    const justOver = new Date(Date.now() - STALE_THRESHOLD_MS - 1).toISOString();
    expect(isStale(justOver)).toBe(true);
  });
});

// ── ToolApprovals status filter ────────────────────────────────────────────────
describe("ToolApprovals — filter logic", () => {
  const approvals = [
    { id: "1", status: "pending" },
    { id: "2", status: "approved" },
    { id: "3", status: "rejected" },
    { id: "4", status: "pending" },
  ];

  it("filter 'all' returns all items", () => {
    const f = "all";
    const result = f === "all" ? approvals : approvals.filter(a => a.status === f);
    expect(result.length).toBe(4);
  });
  it("filter 'pending' returns 2 items", () => {
    const result = approvals.filter(a => a.status === "pending");
    expect(result.length).toBe(2);
  });
  it("filter 'approved' returns 1 item", () => {
    const result = approvals.filter(a => a.status === "approved");
    expect(result.length).toBe(1);
  });
  it("filter 'rejected' returns 1 item", () => {
    const result = approvals.filter(a => a.status === "rejected");
    expect(result.length).toBe(1);
  });
  it("pendingCount computed correctly", () => {
    const pendingCount = approvals.filter(a => a.status === "pending").length;
    expect(pendingCount).toBe(2);
  });
});

// ── timeSince formatting ───────────────────────────────────────────────────────
describe("NodeHealth — timeSince formatting", () => {
  function timeSince(ts: string): string {
    const seconds = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  }

  it("shows seconds for recent timestamps", () => {
    const ts = new Date(Date.now() - 30 * 1000).toISOString();
    expect(timeSince(ts)).toMatch(/s ago$/);
  });
  it("shows minutes for 2-minute-old timestamps", () => {
    const ts = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    expect(timeSince(ts)).toBe("2m ago");
  });
  it("shows hours for 3-hour-old timestamps", () => {
    const ts = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    expect(timeSince(ts)).toBe("3h ago");
  });
  it("shows days for 2-day-old timestamps", () => {
    const ts = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
    expect(timeSince(ts)).toBe("2d ago");
  });
});
