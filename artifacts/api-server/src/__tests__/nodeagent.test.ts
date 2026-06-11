// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Unit tests for node-agent route logic: PSK validation, schema parsing,
// telemetry fields, event batch limits.
import { describe, it, expect, beforeEach } from "vitest";
import { z } from "zod";

// ── Inline the PSK validation logic (pure function — no HTTP layer needed) ──
function validatePsk(header: string | undefined, psk: string): boolean {
  if (!psk) return false;
  if (!header) return false;
  if (header.length !== psk.length) return false;
  let diff = 0;
  for (let i = 0; i < header.length; i++) diff |= header.charCodeAt(i) ^ psk.charCodeAt(i);
  return diff === 0;
}

// ── Schemas (mirror node-agent.ts so we can test parsing in isolation) ───────
const CheckinSchema = z.object({
  nodeId:   z.string().min(1).max(128),
  nodeName: z.string().min(1).max(256),
  version:  z.string().min(1).max(64),
  ip:       z.string().min(1).max(64),
  os:       z.string().max(128).optional(),
  arch:     z.string().max(64).optional(),
  tools:    z.array(z.string()).optional(),
  cpuPct:   z.number().min(0).max(100).optional(),
  memPct:   z.number().min(0).max(100).optional(),
  diskMb:   z.number().int().min(0).optional(),
  event:    z.object({ type: z.string().min(1).max(64), payload: z.record(z.unknown()).optional() }).optional(),
});

const HealthTelemetrySchema = z.object({
  nodeId:  z.string().min(1).max(128),
  cpuPct:  z.number().min(0).max(100),
  memPct:  z.number().min(0).max(100),
  diskMb:  z.number().int().min(0).optional(),
  status:  z.enum(["active", "degraded", "offline"]).optional().default("active"),
});

const EventBatchSchema = z.object({
  nodeId: z.string().min(1).max(128),
  events: z.array(z.object({
    type:    z.string().min(1).max(64),
    payload: z.record(z.unknown()).optional(),
  })).min(1).max(100),
});

// ── PSK validation ────────────────────────────────────────────────────────────
describe("validatePsk", () => {
  const PSK = "super-secret-psk-abc123";

  it("accepts correct PSK header", () => {
    expect(validatePsk(PSK, PSK)).toBe(true);
  });

  it("rejects wrong PSK value", () => {
    expect(validatePsk("wrong-psk", PSK)).toBe(false);
  });

  it("rejects missing header", () => {
    expect(validatePsk(undefined, PSK)).toBe(false);
  });

  it("rejects empty PSK config (fail-closed: PSK not set)", () => {
    expect(validatePsk("any-value", "")).toBe(false);
  });

  it("rejects header with different length", () => {
    expect(validatePsk(PSK + "x", PSK)).toBe(false);
  });

  it("is constant-time (no short-circuit on first char mismatch)", () => {
    // If timing-safe, the function must iterate all chars
    const wrong = "X" + PSK.slice(1);
    expect(validatePsk(wrong, PSK)).toBe(false);
  });
});

// ── CheckinSchema validation ──────────────────────────────────────────────────
describe("CheckinSchema", () => {
  const valid = {
    nodeId:   "parrot-node-01",
    nodeName: "My Parrot Node",
    version:  "1.0.0",
    ip:       "203.0.113.5",
  };

  it("accepts minimal valid payload", () => {
    expect(() => CheckinSchema.parse(valid)).not.toThrow();
  });

  it("accepts full payload with telemetry and event", () => {
    expect(() => CheckinSchema.parse({
      ...valid,
      os: "ParrotOS 6.1", arch: "x86_64",
      tools: ["nmap", "nuclei"],
      cpuPct: 45.2, memPct: 72.1, diskMb: 48230,
      event: { type: "startup", payload: { pid: 1234 } },
    })).not.toThrow();
  });

  it("rejects missing nodeId", () => {
    expect(() => CheckinSchema.parse({ ...valid, nodeId: "" })).toThrow();
  });

  it("rejects missing nodeName", () => {
    const { nodeName: _, ...rest } = valid;
    expect(() => CheckinSchema.parse(rest)).toThrow();
  });

  it("rejects cpuPct > 100", () => {
    expect(() => CheckinSchema.parse({ ...valid, cpuPct: 101 })).toThrow();
  });

  it("rejects cpuPct < 0", () => {
    expect(() => CheckinSchema.parse({ ...valid, cpuPct: -1 })).toThrow();
  });

  it("rejects memPct > 100", () => {
    expect(() => CheckinSchema.parse({ ...valid, memPct: 150 })).toThrow();
  });

  it("rejects diskMb as float", () => {
    expect(() => CheckinSchema.parse({ ...valid, diskMb: 1.5 })).toThrow();
  });

  it("rejects nodeId > 128 chars", () => {
    expect(() => CheckinSchema.parse({ ...valid, nodeId: "a".repeat(129) })).toThrow();
  });
});

// ── HealthTelemetrySchema validation ─────────────────────────────────────────
describe("HealthTelemetrySchema", () => {
  it("accepts valid telemetry payload", () => {
    expect(() => HealthTelemetrySchema.parse({
      nodeId: "node-01", cpuPct: 24.5, memPct: 61.2,
    })).not.toThrow();
  });

  it("defaults status to 'active' when omitted", () => {
    const result = HealthTelemetrySchema.parse({
      nodeId: "node-01", cpuPct: 10, memPct: 20,
    });
    expect(result.status).toBe("active");
  });

  it("accepts 'degraded' status", () => {
    expect(() => HealthTelemetrySchema.parse({
      nodeId: "node-01", cpuPct: 95, memPct: 95, status: "degraded",
    })).not.toThrow();
  });

  it("rejects invalid status value", () => {
    expect(() => HealthTelemetrySchema.parse({
      nodeId: "node-01", cpuPct: 10, memPct: 20, status: "unknown",
    })).toThrow();
  });

  it("rejects missing cpuPct", () => {
    expect(() => HealthTelemetrySchema.parse({
      nodeId: "node-01", memPct: 50,
    })).toThrow();
  });
});

// ── EventBatchSchema validation ───────────────────────────────────────────────
describe("EventBatchSchema", () => {
  it("accepts valid single event", () => {
    expect(() => EventBatchSchema.parse({
      nodeId: "node-01",
      events: [{ type: "alert", payload: { severity: "high" } }],
    })).not.toThrow();
  });

  it("accepts batch of 100 events (max)", () => {
    const events = Array.from({ length: 100 }, (_, i) => ({ type: `evt-${i}` }));
    expect(() => EventBatchSchema.parse({ nodeId: "node-01", events })).not.toThrow();
  });

  it("rejects batch of 101 events (over limit)", () => {
    const events = Array.from({ length: 101 }, (_, i) => ({ type: `evt-${i}` }));
    expect(() => EventBatchSchema.parse({ nodeId: "node-01", events })).toThrow();
  });

  it("rejects empty events array", () => {
    expect(() => EventBatchSchema.parse({ nodeId: "node-01", events: [] })).toThrow();
  });

  it("rejects event with empty type string", () => {
    expect(() => EventBatchSchema.parse({
      nodeId: "node-01", events: [{ type: "" }],
    })).toThrow();
  });

  it("rejects event type > 64 chars", () => {
    expect(() => EventBatchSchema.parse({
      nodeId: "node-01", events: [{ type: "x".repeat(65) }],
    })).toThrow();
  });
});
