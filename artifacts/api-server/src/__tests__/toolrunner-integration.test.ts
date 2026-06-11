// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Route-level integration tests — POST /run approval gate, scope gate, SSRF,
// audit events, and GET /tools policy-field exposure.
// Uses supertest to drive real HTTP requests through the Express router.

import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express from "express";

// ── Module mocks (hoisted to file top by vitest) ─────────────────────────────

vi.mock("@clerk/express", () => ({
  clerkMiddleware: () => (_r: any, _s: any, n: any) => n(),
  getAuth: vi.fn(() => ({ userId: "test-user-123" })),
}));

vi.mock("@workspace/db", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where:   vi.fn().mockResolvedValue([]),
        orderBy: vi.fn(() => ({ limit: vi.fn().mockResolvedValue([]) })),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn().mockResolvedValue([{ id: "mock-db-id" }]),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn().mockResolvedValue([{ id: "consumed", status: "consumed" }]),
        })),
      })),
    })),
  },
  toolJobsTable:         {},
  toolApprovalsTable:    {},
  toolOutputsTable:      {},
  toolTargetScopesTable: {},
}));

vi.mock("../lib/audit-chain", () => ({
  appendAuditEvent: vi.fn(),
}));

vi.mock("../middlewares/targetAllowlist", () => ({
  checkTargetAllowlist: vi.fn().mockResolvedValue({ allowed: true, reason: "" }),
  targetMatchesScope:   vi.fn(() => true),
  normalizeHost:        vi.fn((s: string) => s),
}));

vi.mock("geoip-lite", () => ({
  default: { lookup: vi.fn(() => null) },
}));

// Make every tool appear installed so the "not installed" 400 guard never fires
// before the approval/scope gate under test.
vi.mock("fs", async () => {
  const actual = await vi.importActual<typeof import("fs")>("fs");
  return { ...actual, existsSync: vi.fn(() => true), writeFileSync: vi.fn() };
});

vi.mock("archiver", () => ({
  default: vi.fn(() => ({
    directory: vi.fn(),
    pipe:      vi.fn(),
    finalize:  vi.fn(),
    on:        vi.fn(),
  })),
}));

// Prevent real process spawning in tests
vi.mock("child_process", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { EventEmitter } = require("events");
  return {
    spawn: vi.fn(() => {
      const proc: any = new EventEmitter();
      proc.stdout  = new EventEmitter();
      proc.stderr  = new EventEmitter();
      proc.pid     = 99_999;
      proc.killed  = false;
      proc.kill    = vi.fn();
      return proc;
    }),
  };
});

// ── Import subjects AFTER mocks ───────────────────────────────────────────────

import toolRunnerRouter from "../routes/toolrunner";
import { checkTargetAllowlist } from "../middlewares/targetAllowlist";
import { appendAuditEvent } from "../lib/audit-chain";
import { getAuth } from "@clerk/express";

// ── Test app factory ─────────────────────────────────────────────────────────

function buildApp() {
  const a = express();
  a.use(express.json());
  a.use("/api/tool-runner", toolRunnerRouter);
  return a;
}

// ── GET /tools — policy field exposure ───────────────────────────────────────

describe("GET /api/tool-runner/tools — policy fields", () => {
  const app = buildApp();

  it("returns 200 with a non-empty array", async () => {
    const res = await request(app).get("/api/tool-runner/tools");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(10);
  });

  it("every tool exposes the four required policy fields with correct types", async () => {
    const res = await request(app).get("/api/tool-runner/tools");
    for (const t of res.body as any[]) {
      expect(["low", "medium", "high", "critical"], `${t.id}: riskLevel`).toContain(t.riskLevel);
      expect(typeof t.alwaysRequiresApproval,  `${t.id}: alwaysRequiresApproval`).toBe("boolean");
      expect(typeof t.requiresInstalledCheck,  `${t.id}: requiresInstalledCheck`).toBe("boolean");
      expect(typeof t.scopeRequired,           `${t.id}: scopeRequired`).toBe("boolean");
    }
  });

  it("hydra: alwaysRequiresApproval=true and riskLevel=critical", async () => {
    const res = await request(app).get("/api/tool-runner/tools");
    const hydra = (res.body as any[]).find((t) => t.id === "hydra");
    expect(hydra).toBeDefined();
    expect(hydra.alwaysRequiresApproval).toBe(true);
    expect(hydra.riskLevel).toBe("critical");
  });

  it("slowhttptest: alwaysRequiresApproval=true and riskLevel=critical", async () => {
    const res = await request(app).get("/api/tool-runner/tools");
    const t = (res.body as any[]).find((t) => t.id === "slowhttptest");
    expect(t?.alwaysRequiresApproval).toBe(true);
    expect(t?.riskLevel).toBe("critical");
  });

  it("john: scopeRequired=false", async () => {
    const res = await request(app).get("/api/tool-runner/tools");
    const john = (res.body as any[]).find((t) => t.id === "john");
    expect(john?.scopeRequired).toBe(false);
  });

  it("nmap: scopeRequired=true", async () => {
    const res = await request(app).get("/api/tool-runner/tools");
    const nmap = (res.body as any[]).find((t) => t.id === "nmap");
    expect(nmap?.scopeRequired).toBe(true);
  });
});

// ── POST /run — auth & basic validation ──────────────────────────────────────

describe("POST /api/tool-runner/run — auth & validation", () => {
  const app = buildApp();

  beforeEach(() => {
    vi.mocked(getAuth).mockReturnValue({ userId: "test-user-123" } as any);
  });

  it("401 when Clerk returns no userId", async () => {
    vi.mocked(getAuth).mockReturnValueOnce({ userId: null } as any);
    const res = await request(app).post("/api/tool-runner/run")
      .send({ toolId: "ping", opts: { target: "8.8.8.8" } });
    expect(res.status).toBe(401);
  });

  it("404 for an unknown toolId", async () => {
    const res = await request(app).post("/api/tool-runner/run")
      .send({ toolId: "no-such-tool-xyz", opts: {} });
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/unknown tool/i);
  });

  it("400 when a required field is missing (ping requires target)", async () => {
    const res = await request(app).post("/api/tool-runner/run")
      .send({ toolId: "ping", opts: {} });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/required|host|ip/i);
  });
});

// ── POST /run — alwaysRequiresApproval gate ───────────────────────────────────

describe("POST /api/tool-runner/run — alwaysRequiresApproval gate", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    app = buildApp();
    vi.mocked(getAuth).mockReturnValue({ userId: "test-user-123" } as any);
    vi.mocked(checkTargetAllowlist).mockResolvedValue({ allowed: true, reason: "" });
  });

  it("hydra without approvedToken → 202 pending_approval", async () => {
    const res = await request(app).post("/api/tool-runner/run").send({
      toolId: "hydra",
      opts:   { target: "203.0.113.5", protocol: "ssh", passFile: "admin,test", userFile: "admin", tasks: "4" },
    });
    expect(res.status).toBe(202);
    expect(res.body.status).toBe("pending_approval");
    expect(typeof res.body.approvalId).toBe("string");
    expect(res.body.message).toMatch(/admin approval/i);
  });

  it("slowhttptest without approvedToken → 202 pending_approval", async () => {
    const res = await request(app).post("/api/tool-runner/run").send({
      toolId: "slowhttptest",
      opts:   { target: "https://203.0.113.5", mode: "slowloris", connections: "50", duration: "10" },
    });
    expect(res.status).toBe(202);
    expect(res.body.status).toBe("pending_approval");
  });

  it("wash without approvedToken → 202 pending_approval", async () => {
    const res = await request(app).post("/api/tool-runner/run").send({
      toolId: "wash",
      opts:   { iface: "wlan0mon", duration: "10" },
    });
    expect(res.status).toBe(202);
    expect(res.body.status).toBe("pending_approval");
  });

  it("hydra approval record is persisted in DB and audit event emitted", async () => {
    const { db } = await import("@workspace/db");
    vi.mocked(appendAuditEvent).mockClear();
    vi.mocked(db.insert).mockClear();

    await request(app).post("/api/tool-runner/run").send({
      toolId: "hydra",
      opts:   { target: "203.0.113.5", protocol: "ssh", passFile: "admin", userFile: "admin", tasks: "4" },
    });

    expect(vi.mocked(db.insert)).toHaveBeenCalled();
    expect(vi.mocked(appendAuditEvent)).toHaveBeenCalledWith(
      expect.objectContaining({
        action:   "tool_runner.approval_requested",
        resource: "hydra",
        result:   "deny",
      }),
    );
  });
});

// ── POST /run — conditional approval gate (per-option escalation) ─────────────

describe("POST /api/tool-runner/run — conditional approval gate", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    app = buildApp();
    vi.mocked(getAuth).mockReturnValue({ userId: "test-user-123" } as any);
    vi.mocked(checkTargetAllowlist).mockResolvedValue({ allowed: true, reason: "" });
  });

  it("sqlmap level≥2 → 202 with SQLMap reason", async () => {
    // sqlmap's required field id is 'url', not 'target'
    const res = await request(app).post("/api/tool-runner/run").send({
      toolId: "sqlmap",
      opts:   { url: "https://203.0.113.5/page?id=1", level: "2", cookie: "" },
    });
    expect(res.status).toBe(202);
    expect(res.body.status).toBe("pending_approval");
    expect(res.body.message).toContain("SQLMap level 2");
  });

  it("nmap vuln mode → 202 pending_approval", async () => {
    const res = await request(app).post("/api/tool-runner/run").send({
      toolId: "nmap",
      opts:   { target: "203.0.113.5", mode: "vuln" },
    });
    expect(res.status).toBe(202);
    expect(res.body.status).toBe("pending_approval");
  });

  it("sqlmap level=1 (default) → NOT a 202 (no approval needed)", async () => {
    // sqlmap's required field id is 'url', not 'target'
    const res = await request(app).post("/api/tool-runner/run").send({
      toolId: "sqlmap",
      opts:   { url: "https://203.0.113.5/page?id=1", level: "1", cookie: "" },
    });
    // Should not be blocked by the approval gate — may be 4xx for other reasons (binary)
    expect(res.status).not.toBe(202);
  });
});

// ── POST /run — scope gate ────────────────────────────────────────────────────

describe("POST /api/tool-runner/run — scope gate", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    app = buildApp();
    vi.mocked(getAuth).mockReturnValue({ userId: "test-user-123" } as any);
    vi.mocked(checkTargetAllowlist).mockResolvedValue({ allowed: true, reason: "" });
  });

  it("422 target_out_of_scope for scopeRequired=true tool", async () => {
    vi.mocked(checkTargetAllowlist).mockResolvedValueOnce({
      allowed: false,
      reason:  "Target 203.0.113.99 is not in your declared scope",
    });
    const res = await request(app).post("/api/tool-runner/run").send({
      toolId: "nmap",
      opts:   { target: "203.0.113.99", mode: "quick" },
    });
    expect(res.status).toBe(422);
    expect(res.body.code).toBe("target_out_of_scope");
  });

  it("emits tool_runner.out_of_scope audit event", async () => {
    vi.mocked(appendAuditEvent).mockClear();
    vi.mocked(checkTargetAllowlist).mockResolvedValueOnce({ allowed: false, reason: "out of scope" });
    await request(app).post("/api/tool-runner/run").send({
      toolId: "nmap",
      opts:   { target: "198.51.100.1", mode: "quick" },
    });
    expect(vi.mocked(appendAuditEvent)).toHaveBeenCalledWith(
      expect.objectContaining({ action: "tool_runner.out_of_scope", result: "deny" }),
    );
  });

  it("john (scopeRequired=false) does NOT call checkTargetAllowlist", async () => {
    vi.mocked(checkTargetAllowlist).mockClear();
    await request(app).post("/api/tool-runner/run").send({
      toolId: "john",
      opts:   { hash: "5f4dcc3b5aa765d61d8327deb882cf99", format: "auto", mode: "wordlist" },
    });
    expect(vi.mocked(checkTargetAllowlist)).not.toHaveBeenCalled();
  });

  it("volatility3 (scopeRequired=false) does NOT call checkTargetAllowlist", async () => {
    vi.mocked(checkTargetAllowlist).mockClear();
    await request(app).post("/api/tool-runner/run").send({
      toolId: "volatility3",
      opts:   { memFile: "/tmp/dump.mem", plugin: "windows.info" },
    });
    expect(vi.mocked(checkTargetAllowlist)).not.toHaveBeenCalled();
  });
});

// ── POST /run — SSRF protection ───────────────────────────────────────────────

describe("POST /api/tool-runner/run — SSRF protection", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    app = buildApp();
    vi.mocked(getAuth).mockReturnValue({ userId: "test-user-123" } as any);
    vi.mocked(appendAuditEvent).mockClear();
  });

  const ssrfTargets = [
    ["127.0.0.1",        "loopback"],
    ["10.0.0.1",         "RFC1918 10.x"],
    ["192.168.1.1",      "RFC1918 192.168"],
    ["172.16.0.1",       "RFC1918 172.16"],
    ["169.254.169.254",  "cloud metadata"],
    ["localhost",        "localhost hostname"],
  ];

  for (const [target, label] of ssrfTargets) {
    it(`400 for ${label} target (${target})`, async () => {
      const res = await request(app).post("/api/tool-runner/run").send({
        toolId: "nmap",
        opts:   { target, mode: "quick" },
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/restricted address range/i);
    });
  }

  it("emits tool_runner.blocked_target audit event for SSRF attempt", async () => {
    await request(app).post("/api/tool-runner/run").send({
      toolId: "nmap",
      opts:   { target: "10.10.10.10", mode: "quick" },
    });
    expect(vi.mocked(appendAuditEvent)).toHaveBeenCalledWith(
      expect.objectContaining({ action: "tool_runner.blocked_target", result: "deny" }),
    );
  });

  it("public IP 203.0.113.5 is NOT blocked", async () => {
    vi.mocked(checkTargetAllowlist).mockResolvedValueOnce({ allowed: true, reason: "" });
    const res = await request(app).post("/api/tool-runner/run").send({
      toolId: "nmap",
      opts:   { target: "203.0.113.5", mode: "quick" },
    });
    expect(res.status).not.toBe(400);
  });
});
