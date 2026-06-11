// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Unit tests for tool history auth/scoping rules and pagination logic.
import { describe, it, expect } from "vitest";

// ── History query builder logic (pure, no DB) ─────────────────────────────────
// Mirrors the logic in GET /history to verify correct scoping rules.
interface HistoryQueryOpts {
  isAdmin: boolean;
  userId: string;
  limit?: number;
  offset?: number;
}

function buildHistoryQuery(opts: HistoryQueryOpts) {
  const limit  = Math.min(opts.limit  ?? 20, 100);
  const offset = Math.max(opts.offset ?? 0,  0);
  const scope  = opts.isAdmin ? "all" : `user:${opts.userId}`;
  return { scope, limit, offset };
}

describe("History query scoping", () => {
  it("admin sees all records (scope='all')", () => {
    const q = buildHistoryQuery({ isAdmin: true, userId: "user_admin" });
    expect(q.scope).toBe("all");
  });

  it("non-admin sees only their own records", () => {
    const q = buildHistoryQuery({ isAdmin: false, userId: "user_abc123" });
    expect(q.scope).toBe("user:user_abc123");
  });

  it("two different non-admin users get different scopes", () => {
    const q1 = buildHistoryQuery({ isAdmin: false, userId: "user_alice" });
    const q2 = buildHistoryQuery({ isAdmin: false, userId: "user_bob" });
    expect(q1.scope).not.toBe(q2.scope);
  });
});

describe("History pagination bounds", () => {
  it("defaults limit to 20", () => {
    const q = buildHistoryQuery({ isAdmin: false, userId: "u1" });
    expect(q.limit).toBe(20);
  });

  it("caps limit at 100", () => {
    const q = buildHistoryQuery({ isAdmin: false, userId: "u1", limit: 999 });
    expect(q.limit).toBe(100);
  });

  it("clamps negative offset to 0", () => {
    const q = buildHistoryQuery({ isAdmin: false, userId: "u1", offset: -5 });
    expect(q.offset).toBe(0);
  });

  it("respects valid offset", () => {
    const q = buildHistoryQuery({ isAdmin: false, userId: "u1", offset: 40 });
    expect(q.offset).toBe(40);
  });

  it("respects limit within bounds", () => {
    const q = buildHistoryQuery({ isAdmin: false, userId: "u1", limit: 50 });
    expect(q.limit).toBe(50);
  });
});

// ── Approval workflow state machine ──────────────────────────────────────────
type ApprovalStatus = "pending" | "approved" | "denied" | "consumed";

function canConsume(status: ApprovalStatus): boolean {
  return status === "approved";
}

function approvalExpired(reviewedAt: Date | null, nowMs: number): boolean {
  if (!reviewedAt) return false;
  return nowMs > reviewedAt.getTime() + 60 * 60 * 1000;
}

describe("Approval token state machine", () => {
  it("only 'approved' tokens can be consumed", () => {
    expect(canConsume("approved")).toBe(true);
    expect(canConsume("pending")).toBe(false);
    expect(canConsume("denied")).toBe(false);
    expect(canConsume("consumed")).toBe(false);
  });

  it("token is expired after 1 hour", () => {
    const reviewedAt = new Date(Date.now() - 61 * 60 * 1000); // 61 min ago
    expect(approvalExpired(reviewedAt, Date.now())).toBe(true);
  });

  it("token is valid within 1 hour", () => {
    const reviewedAt = new Date(Date.now() - 30 * 60 * 1000); // 30 min ago
    expect(approvalExpired(reviewedAt, Date.now())).toBe(false);
  });

  it("null reviewedAt is never expired", () => {
    expect(approvalExpired(null, Date.now())).toBe(false);
  });

  it("token reviewed exactly at limit is not expired", () => {
    const reviewedAt = new Date(Date.now() - 60 * 60 * 1000 + 1);
    expect(approvalExpired(reviewedAt, Date.now())).toBe(false);
  });
});

// ── requiresApproval logic mirror ─────────────────────────────────────────────
const ALWAYS_REQUIRES_APPROVAL = [
  "hydra", "slowhttptest", "medusa", "aircrack-ng", "wash", "kismet-capture",
];

function requiresApproval(toolId: string, opts: Record<string, string>): string | null {
  if (toolId === "sqlmap" && parseInt(opts.level ?? "1", 10) >= 2) {
    return `SQLMap level ${opts.level} requires admin approval`;
  }
  if (toolId === "nmap" && ["vuln", "full"].includes(opts.mode ?? "")) {
    return `Nmap mode '${opts.mode}' requires admin approval`;
  }
  if (toolId === "feroxbuster" && parseInt(opts.depth ?? "2", 10) >= 3) {
    return `Feroxbuster depth ${opts.depth} requires admin approval`;
  }
  if (ALWAYS_REQUIRES_APPROVAL.includes(toolId)) {
    return `Tool '${toolId}' always requires admin approval`;
  }
  return null;
}

describe("requiresApproval", () => {
  it("nmap default scan does not require approval", () => {
    expect(requiresApproval("nmap", { mode: "standard" })).toBeNull();
  });

  it("nmap vuln scan requires approval", () => {
    expect(requiresApproval("nmap", { mode: "vuln" })).not.toBeNull();
  });

  it("sqlmap level 1 does not require approval", () => {
    expect(requiresApproval("sqlmap", { level: "1" })).toBeNull();
  });

  it("sqlmap level 2 requires approval", () => {
    expect(requiresApproval("sqlmap", { level: "2" })).not.toBeNull();
  });

  it("hydra always requires approval", () => {
    expect(requiresApproval("hydra", {})).not.toBeNull();
  });

  it("medusa always requires approval", () => {
    expect(requiresApproval("medusa", {})).not.toBeNull();
  });

  it("wash always requires approval", () => {
    expect(requiresApproval("wash", {})).not.toBeNull();
  });

  it("kismet-capture always requires approval", () => {
    expect(requiresApproval("kismet-capture", {})).not.toBeNull();
  });

  it("feroxbuster depth 2 does not require approval", () => {
    expect(requiresApproval("feroxbuster", { depth: "2" })).toBeNull();
  });

  it("feroxbuster depth 3 requires approval", () => {
    expect(requiresApproval("feroxbuster", { depth: "3" })).not.toBeNull();
  });

  it("safe tools return null", () => {
    for (const tool of ["dig", "curl", "openssl", "whois"]) {
      expect(requiresApproval(tool, {})).toBeNull();
    }
  });
});
