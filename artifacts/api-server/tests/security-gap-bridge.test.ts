// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Security gap bridge tests — RBAC, device trust, audit ledger, request signing.
// Port of gap bridge test suite (proxhq_top3_bridge/tests/security.test.ts).
import { describe, expect, it } from "vitest";
import { can, requirePermission, parseRole, rolesWithPermission } from "../lib/rbac";
import { evaluateDeviceTrust } from "../lib/device-trust";
import { AuditLedger, appendAuditEvent, verifyChain } from "../lib/audit-chain";

// ── RBAC ─────────────────────────────────────────────────────────────────────

describe("rbac", () => {
  it("owner has all permissions", () => {
    expect(can("owner", "vpn:read")).toBe(true);
    expect(can("owner", "audit:export")).toBe(true);
    expect(can("owner", "admin:write")).toBe(true);
    expect(can("owner", "billing:read")).toBe(true);
    expect(can("owner", "incident:write")).toBe(true);
  });

  it("support cannot export audit log", () => {
    expect(can("support", "audit:export")).toBe(false);
    expect(can("support", "audit:read")).toBe(false);
    expect(can("support", "admin:write")).toBe(false);
  });

  it("auditor can read and export audit but cannot write", () => {
    expect(can("auditor", "audit:read")).toBe(true);
    expect(can("auditor", "audit:export")).toBe(true);
    expect(can("auditor", "vpn:write")).toBe(false);
    expect(can("auditor", "admin:write")).toBe(false);
  });

  it("network_admin can write VPN config but not audit", () => {
    expect(can("network_admin", "vpn:write")).toBe(true);
    expect(can("network_admin", "peer:write")).toBe(true);
    expect(can("network_admin", "audit:read")).toBe(false);
    expect(can("network_admin", "billing:read")).toBe(false);
  });

  it("user only gets vpn:read and ztna:posture", () => {
    expect(can("user", "vpn:read")).toBe(true);
    expect(can("user", "ztna:posture")).toBe(true);
    expect(can("user", "vpn:write")).toBe(false);
    expect(can("user", "peer:read")).toBe(false);
  });

  it("requirePermission throws 403 for insufficient role", () => {
    expect(() => requirePermission("support", "audit:export")).toThrow();
    try {
      requirePermission("support", "admin:write");
    } catch (e: any) {
      expect(e.statusCode).toBe(403);
    }
  });

  it("requirePermission does not throw for allowed role", () => {
    expect(() => requirePermission("owner", "admin:write")).not.toThrow();
  });

  it("parseRole handles unknown values safely", () => {
    expect(parseRole("hacker")).toBe("user");
    expect(parseRole(undefined)).toBe("user");
    expect(parseRole("auditor")).toBe("auditor");
  });

  it("rolesWithPermission returns correct set", () => {
    const roles = rolesWithPermission("audit:export");
    expect(roles).toContain("owner");
    expect(roles).toContain("auditor");
    expect(roles).not.toContain("user");
    expect(roles).not.toContain("support");
  });
});

// ── Device Trust ──────────────────────────────────────────────────────────────

describe("device trust", () => {
  const cleanDevice = {
    os: "ubuntu-22.04",
    diskEncrypted: true,
    firewallEnabled: true,
    edrHealthy: true,
    jailbrokenOrRooted: false,
    lastPatchAgeDays: 0,
    certificateValid: true,
    ipReputation: "good" as const,
  };

  it("perfect device scores 100 and is allowed", () => {
    const r = evaluateDeviceTrust(cleanDevice);
    expect(r.score).toBe(100);
    expect(r.allow).toBe(true);
    expect(r.reasons).toHaveLength(0);
  });

  it("rooted device is immediately denied", () => {
    const r = evaluateDeviceTrust({ ...cleanDevice, jailbrokenOrRooted: true });
    expect(r.allow).toBe(false);
    expect(r.score).toBeLessThan(75);
    expect(r.reasons.some(s => s.includes("rooted") || s.includes("jailbreak"))).toBe(true);
  });

  it("invalid certificate denies access", () => {
    const r = evaluateDeviceTrust({ ...cleanDevice, certificateValid: false });
    expect(r.allow).toBe(false);
    expect(r.score).toBe(60);
  });

  it("bad IP reputation alone does not block if device is otherwise clean", () => {
    const r = evaluateDeviceTrust({ ...cleanDevice, ipReputation: "bad" });
    expect(r.score).toBe(60);
    expect(r.allow).toBe(false);
  });

  it("missing disk encryption and EDR pushes below threshold", () => {
    const r = evaluateDeviceTrust({ ...cleanDevice, diskEncrypted: false, edrHealthy: false });
    expect(r.score).toBe(55);
    expect(r.allow).toBe(false);
  });

  it("stale patches penalize proportionally", () => {
    const r7w = evaluateDeviceTrust({ ...cleanDevice, lastPatchAgeDays: 37 });
    const r14w = evaluateDeviceTrust({ ...cleanDevice, lastPatchAgeDays: 44 });
    expect(r14w.score).toBeLessThan(r7w.score);
  });

  it("score never goes below zero", () => {
    const r = evaluateDeviceTrust({
      os: "android",
      diskEncrypted: false,
      firewallEnabled: false,
      edrHealthy: false,
      jailbrokenOrRooted: true,
      lastPatchAgeDays: 365,
      certificateValid: false,
      ipReputation: "bad",
    });
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.allow).toBe(false);
  });
});

// ── Audit Ledger ──────────────────────────────────────────────────────────────

describe("audit ledger — class", () => {
  it("chains SHA3-256 hashes across entries", () => {
    const ledger = new AuditLedger("test-secret-32-bytes-padded-here");
    const a = ledger.append({ actor: "user:1", action: "vpn:connect", resource: "node:63", result: "allow" });
    const b = ledger.append({ actor: "user:1", action: "vpn:disconnect", resource: "node:63", result: "allow" });
    const c = ledger.append({ actor: "admin:1", action: "audit:export", resource: "audit_log", result: "allow" });

    expect(b.prevHash).toBe(a.hash);
    expect(c.prevHash).toBe(b.hash);
    expect(a.hash).not.toBe(b.hash);
    expect(a.seq).toBe(1);
    expect(b.seq).toBe(2);
    expect(c.seq).toBe(3);
  });

  it("each entry has a valid HMAC-SHA512 signature", () => {
    const ledger = new AuditLedger("test-secret-32-bytes-padded-here");
    const entry = ledger.append({ actor: "u", action: "a", resource: "r", result: "allow" });
    expect(entry.sig).toBeTruthy();
    expect(entry.sig.length).toBeGreaterThan(60);
  });

  it("genesis hash is GENESIS by default", () => {
    const ledger = new AuditLedger("key");
    const first = ledger.append({ actor: "u", action: "login", resource: "session", result: "allow" });
    expect(first.prevHash).toBe("GENESIS");
  });
});

describe("audit ledger — chain verification", () => {
  it("accepts a valid chain", () => {
    const ledger = new AuditLedger("verify-secret");
    const entries = [
      ledger.append({ actor: "u1", action: "a", resource: "r", result: "allow" }),
      ledger.append({ actor: "u1", action: "b", resource: "r", result: "allow" }),
      ledger.append({ actor: "u2", action: "c", resource: "r", result: "deny" }),
    ];
    const result = verifyChain(entries, "GENESIS");
    expect(result.valid).toBe(true);
  });

  it("detects tampering with a hash", () => {
    const ledger = new AuditLedger("verify-secret");
    const entries = [
      ledger.append({ actor: "u", action: "a", resource: "r", result: "allow" }),
      ledger.append({ actor: "u", action: "b", resource: "r", result: "allow" }),
    ];
    // Tamper: mutate a hash mid-chain
    const tampered = [
      { ...entries[0], hash: "0000000000000000000000000000000000000000000000000000000000000000" },
      entries[1],
    ];
    const result = verifyChain(tampered, "GENESIS");
    expect(result.valid).toBe(false);
  });
});

describe("singleton appendAuditEvent", () => {
  it("increments seq and chains prevHash", () => {
    const e1 = appendAuditEvent({ actor: "sys", action: "boot", resource: "server" });
    const e2 = appendAuditEvent({ actor: "sys", action: "ready", resource: "server" });
    expect(e2.prevHash).toBe(e1.hash);
    expect(e2.seq).toBeGreaterThan(e1.seq);
  });
});
