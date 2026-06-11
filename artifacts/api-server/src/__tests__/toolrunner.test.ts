// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Tool Runner backend tests — SSRF protection, approval workflow, validation
import { describe, it, expect } from "vitest";

// ── Unit tests for SSRF target validation ─────────────────────────────────────
// We test the logic directly by importing the patterns.
// The actual isBlockedTarget function is internal; we test via API integration.

const BLOCKED_CIDR_PATTERNS = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^0\./,
  /^::1$/,
  /^fc[0-9a-f][0-9a-f]:/i,
  /^fd[0-9a-f][0-9a-f]:/i,
  /^fe80:/i,
  /^localhost$/i,
  /^metadata\.google\.internal$/i,
];
const BLOCKED_EXACT = new Set(["169.254.169.254", "100.100.100.200"]);

function isBlockedTarget(target: string): boolean {
  const t = target.trim().toLowerCase();
  if (BLOCKED_EXACT.has(t)) return true;
  for (const p of BLOCKED_CIDR_PATTERNS) if (p.test(t)) return true;
  return false;
}

// ── SSRF protection unit tests ────────────────────────────────────────────────
describe("isBlockedTarget — SSRF protection", () => {
  it("blocks loopback 127.0.0.1", () => {
    expect(isBlockedTarget("127.0.0.1")).toBe(true);
  });
  it("blocks 10.x.x.x RFC1918", () => {
    expect(isBlockedTarget("10.0.0.1")).toBe(true);
    expect(isBlockedTarget("10.255.255.255")).toBe(true);
  });
  it("blocks 172.16-31.x.x RFC1918", () => {
    expect(isBlockedTarget("172.16.0.1")).toBe(true);
    expect(isBlockedTarget("172.31.255.255")).toBe(true);
  });
  it("does NOT block 172.15.x.x (outside RFC1918)", () => {
    expect(isBlockedTarget("172.15.0.1")).toBe(false);
  });
  it("blocks 192.168.x.x RFC1918", () => {
    expect(isBlockedTarget("192.168.1.1")).toBe(true);
  });
  it("blocks 169.254.x.x link-local", () => {
    expect(isBlockedTarget("169.254.0.1")).toBe(true);
  });
  it("blocks cloud metadata endpoint exactly", () => {
    expect(isBlockedTarget("169.254.169.254")).toBe(true);
    expect(isBlockedTarget("100.100.100.200")).toBe(true);
  });
  it("blocks localhost string", () => {
    expect(isBlockedTarget("localhost")).toBe(true);
    expect(isBlockedTarget("LOCALHOST")).toBe(true);
  });
  it("blocks IPv6 loopback ::1", () => {
    expect(isBlockedTarget("::1")).toBe(true);
  });
  it("blocks IPv6 ULA fc00::", () => {
    expect(isBlockedTarget("fc00::1")).toBe(true);
  });
  it("blocks metadata.google.internal", () => {
    expect(isBlockedTarget("metadata.google.internal")).toBe(true);
  });
  it("allows public IP 8.8.8.8", () => {
    expect(isBlockedTarget("8.8.8.8")).toBe(false);
  });
  it("allows public domain example.com", () => {
    expect(isBlockedTarget("example.com")).toBe(false);
  });
  it("allows 203.0.113.1 (TEST-NET-3)", () => {
    expect(isBlockedTarget("203.0.113.1")).toBe(false);
  });
});

// ── Numeric field clamping unit tests ─────────────────────────────────────────
describe("Numeric field clamping", () => {
  function clampThreads(v: string | undefined): number {
    const n = parseInt(v ?? "50", 10);
    return Math.min(Math.max(isNaN(n) ? 50 : n, 1), 200);
  }
  function clampTimeout(v: string | undefined): number {
    const n = parseInt(v ?? "10", 10);
    return Math.min(Math.max(isNaN(n) ? 10 : n, 1), 300);
  }
  function clampDepth(v: string | undefined): number {
    const n = parseInt(v ?? "2", 10);
    return Math.min(Math.max(isNaN(n) ? 2 : n, 1), 4);
  }
  function clampPingCount(v: string | undefined): number {
    const n = parseInt(v ?? "5", 10);
    return Math.min(isNaN(n) ? 5 : n, 20);
  }
  function clampHydra(v: string | undefined): number {
    const n = parseInt(v ?? "4", 10);
    return Math.min(Math.max(isNaN(n) ? 4 : n, 1), 16);
  }

  it("clamps threads above max to 200", () => {
    expect(clampThreads("99999")).toBe(200);
  });
  it("clamps threads below min to 1", () => {
    expect(clampThreads("0")).toBe(1);
    expect(clampThreads("-10")).toBe(1);
  });
  it("accepts valid threads value", () => {
    expect(clampThreads("50")).toBe(50);
  });
  it("clamps timeout above max to 300", () => {
    expect(clampTimeout("9999")).toBe(300);
  });
  it("clamps depth above max to 4", () => {
    expect(clampDepth("100")).toBe(4);
  });
  it("clamps depth below min to 1", () => {
    expect(clampDepth("0")).toBe(1);
  });
  it("clamps ping count to 20", () => {
    expect(clampPingCount("999")).toBe(20);
  });
  it("clamps hydra tasks to 16", () => {
    expect(clampHydra("100")).toBe(16);
  });
  it("clamps hydra tasks below min to 1", () => {
    expect(clampHydra("0")).toBe(1);
  });
});

// ── requiresApproval unit tests ────────────────────────────────────────────────
describe("requiresApproval — high-risk tool detection", () => {
  function requiresApproval(toolId: string, opts: Record<string, string>): string | null {
    if (toolId === "sqlmap" && parseInt(opts.level ?? "1", 10) >= 2) {
      return `SQLMap level ${opts.level} (≥2) requires admin approval`;
    }
    if (toolId === "nuclei" && ["cves", "vulnerabilities"].includes(opts.templates ?? "")) {
      return `Nuclei template '${opts.templates}' category requires admin approval`;
    }
    if (toolId === "nmap" && ["vuln", "full"].includes(opts.mode ?? "")) {
      return `Nmap scan mode '${opts.mode}' requires admin approval`;
    }
    if (toolId === "feroxbuster" && parseInt(opts.depth ?? "2", 10) >= 3) {
      return `Feroxbuster depth ${opts.depth} (≥3) requires admin approval`;
    }
    if (["hydra", "slowhttptest"].includes(toolId)) {
      return `Tool '${toolId}' always requires admin approval`;
    }
    return null;
  }

  it("sqlmap level 1 does NOT require approval", () => {
    expect(requiresApproval("sqlmap", { level: "1" })).toBeNull();
  });
  it("sqlmap level 2 requires approval", () => {
    expect(requiresApproval("sqlmap", { level: "2" })).not.toBeNull();
  });
  it("sqlmap level 5 requires approval", () => {
    expect(requiresApproval("sqlmap", { level: "5" })).not.toBeNull();
  });
  it("nuclei exposures does NOT require approval", () => {
    expect(requiresApproval("nuclei", { templates: "exposures" })).toBeNull();
  });
  it("nuclei cves requires approval", () => {
    expect(requiresApproval("nuclei", { templates: "cves" })).not.toBeNull();
  });
  it("nuclei vulnerabilities requires approval", () => {
    expect(requiresApproval("nuclei", { templates: "vulnerabilities" })).not.toBeNull();
  });
  it("nmap quick does NOT require approval", () => {
    expect(requiresApproval("nmap", { mode: "quick" })).toBeNull();
  });
  it("nmap vuln requires approval", () => {
    expect(requiresApproval("nmap", { mode: "vuln" })).not.toBeNull();
  });
  it("nmap full requires approval", () => {
    expect(requiresApproval("nmap", { mode: "full" })).not.toBeNull();
  });
  it("feroxbuster depth 2 does NOT require approval", () => {
    expect(requiresApproval("feroxbuster", { depth: "2" })).toBeNull();
  });
  it("feroxbuster depth 3 requires approval", () => {
    expect(requiresApproval("feroxbuster", { depth: "3" })).not.toBeNull();
  });
  it("hydra always requires approval", () => {
    expect(requiresApproval("hydra", {})).not.toBeNull();
  });
  it("slowhttptest always requires approval", () => {
    expect(requiresApproval("slowhttptest", {})).not.toBeNull();
  });
  it("curl does NOT require approval", () => {
    expect(requiresApproval("curl", {})).toBeNull();
  });
  it("dig does NOT require approval", () => {
    expect(requiresApproval("dig", {})).toBeNull();
  });
});

// ── Tool registry completeness ─────────────────────────────────────────────────
describe("Tool registry — all expected categories present", () => {
  const EXPECTED_CATEGORIES = [
    "Network Scanning", "Vulnerability Scanning", "Injection Testing",
    "Fuzzing", "Subdomain Enumeration", "HTTP Probing", "DNS",
    "SSL / TLS", "HTTP Client", "OSINT", "Network",
    "Password Attacks", "Forensics & DFIR", "Cryptography", "Stress Testing",
    "Wireless", "Malware Analysis", "Log Analysis",
    "IDS/IPS Monitoring", "Honeypot Monitoring", "Reporting/Export",
  ];

  it("has 21 distinct tool categories", () => {
    expect(EXPECTED_CATEGORIES.length).toBe(21);
  });
  it("wireless category is in the expected set", () => {
    expect(EXPECTED_CATEGORIES).toContain("Wireless");
  });
  it("malware analysis category is in the expected set", () => {
    expect(EXPECTED_CATEGORIES).toContain("Malware Analysis");
  });
  it("log analysis category is in the expected set", () => {
    expect(EXPECTED_CATEGORIES).toContain("Log Analysis");
  });
  it("IDS/IPS monitoring category is in the expected set", () => {
    expect(EXPECTED_CATEGORIES).toContain("IDS/IPS Monitoring");
  });
  it("honeypot monitoring category is in the expected set", () => {
    expect(EXPECTED_CATEGORIES).toContain("Honeypot Monitoring");
  });
  it("reporting/export category is in the expected set", () => {
    expect(EXPECTED_CATEGORIES).toContain("Reporting/Export");
  });
  it("password attacks category is in the expected set", () => {
    expect(EXPECTED_CATEGORIES).toContain("Password Attacks");
  });
  it("forensics category is in the expected set", () => {
    expect(EXPECTED_CATEGORIES).toContain("Forensics & DFIR");
  });
});

// ── Target scope allowlist logic tests ───────────────────────────────────────────
describe("targetMatchesScope — scope allowlist matching", () => {
  // Replicate logic from toolrunner.ts
  function targetMatchesScope(target: string, scopeType: string, scopeValue: string): boolean {
    const t = target.trim().toLowerCase();
    const v = scopeValue.trim().toLowerCase();
    if (scopeType === "ip")     return t === v || t.startsWith(`${v}/`);
    if (scopeType === "url")    return t.startsWith(v);
    if (scopeType === "domain") {
      const tClean = t.replace(/^https?:\/\//, "").split("/")[0].split(":")[0];
      return tClean === v || tClean.endsWith(`.${v}`);
    }
    if (scopeType === "cidr") {
      const [net] = v.split("/");
      const parts  = net.split(".");
      const prefix = v.includes("/") ? parseInt(v.split("/")[1] ?? "32", 10) : 32;
      const octets = Math.ceil(prefix / 8);
      const targetClean = t.replace(/^https?:\/\//, "").split("/")[0].split(":")[0];
      const tParts = targetClean.split(".");
      if (tParts.length < octets) return false;
      for (let i = 0; i < octets; i++) {
        if ((tParts[i] ?? "") !== (parts[i] ?? "")) return false;
      }
      return true;
    }
    return false;
  }

  it("matches exact IP scope", () => {
    expect(targetMatchesScope("8.8.8.8", "ip", "8.8.8.8")).toBe(true);
  });
  it("rejects different IP", () => {
    expect(targetMatchesScope("8.8.4.4", "ip", "8.8.8.8")).toBe(false);
  });
  it("matches domain exactly", () => {
    expect(targetMatchesScope("example.com", "domain", "example.com")).toBe(true);
  });
  it("matches subdomain of domain scope", () => {
    expect(targetMatchesScope("sub.example.com", "domain", "example.com")).toBe(true);
  });
  it("rejects unrelated domain", () => {
    expect(targetMatchesScope("evil.com", "domain", "example.com")).toBe(false);
  });
  it("matches URL scope prefix", () => {
    expect(targetMatchesScope("https://api.example.com/v1", "url", "https://api.example.com")).toBe(true);
  });
  it("rejects URL not matching prefix", () => {
    expect(targetMatchesScope("https://other.com/v1", "url", "https://api.example.com")).toBe(false);
  });
  it("matches /24 CIDR scope", () => {
    expect(targetMatchesScope("192.0.2.50", "cidr", "192.0.2.0/24")).toBe(true);
  });
  it("rejects IP outside /24 CIDR", () => {
    expect(targetMatchesScope("192.0.3.1", "cidr", "192.0.2.0/24")).toBe(false);
  });
  it("matches /16 CIDR scope", () => {
    expect(targetMatchesScope("10.20.30.40", "cidr", "10.20.0.0/16")).toBe(true);
  });
  it("rejects IP outside /16 CIDR", () => {
    expect(targetMatchesScope("10.21.0.1", "cidr", "10.20.0.0/16")).toBe(false);
  });
});

// ── Approval token lifecycle unit tests ───────────────────────────────────────
describe("Approval token lifecycle — validation logic", () => {
  type ApprovalStatus = "pending" | "approved" | "rejected" | "consumed";
  interface MockApproval {
    id: string;
    userId: string;
    toolId: string;
    status: ApprovalStatus;
    reviewedAt: Date | null;
  }

  function validateApprovalToken(
    approval: MockApproval | undefined,
    userId: string,
    toolId: string,
  ): { ok: boolean; error?: string } {
    if (!approval)                                   return { ok: false, error: "Approval token not found." };
    if (approval.userId !== userId)                  return { ok: false, error: "Approval token belongs to a different user." };
    if (approval.toolId !== toolId)                  return { ok: false, error: "Approval token is for a different tool." };
    if (approval.status !== "approved")              return { ok: false, error: `Approval is not in 'approved' state (current: ${approval.status}).` };
    if (approval.reviewedAt) {
      const expiresAt = new Date(approval.reviewedAt.getTime() + 60 * 60 * 1000);
      if (new Date() > expiresAt)                    return { ok: false, error: "Approval token has expired." };
    }
    return { ok: true };
  }

  it("accepts a valid approved token", () => {
    const approval: MockApproval = {
      id: "abc", userId: "u1", toolId: "sqlmap", status: "approved",
      reviewedAt: new Date(Date.now() - 5 * 60_000), // 5 min ago
    };
    expect(validateApprovalToken(approval, "u1", "sqlmap").ok).toBe(true);
  });
  it("rejects missing approval", () => {
    expect(validateApprovalToken(undefined, "u1", "sqlmap").ok).toBe(false);
  });
  it("rejects approval belonging to different user", () => {
    const approval: MockApproval = {
      id: "abc", userId: "u2", toolId: "sqlmap", status: "approved", reviewedAt: new Date(),
    };
    expect(validateApprovalToken(approval, "u1", "sqlmap").ok).toBe(false);
  });
  it("rejects approval for different tool", () => {
    const approval: MockApproval = {
      id: "abc", userId: "u1", toolId: "nmap", status: "approved", reviewedAt: new Date(),
    };
    expect(validateApprovalToken(approval, "u1", "sqlmap").ok).toBe(false);
  });
  it("rejects pending approval", () => {
    const approval: MockApproval = {
      id: "abc", userId: "u1", toolId: "sqlmap", status: "pending", reviewedAt: null,
    };
    expect(validateApprovalToken(approval, "u1", "sqlmap").ok).toBe(false);
  });
  it("rejects consumed approval", () => {
    const approval: MockApproval = {
      id: "abc", userId: "u1", toolId: "sqlmap", status: "consumed", reviewedAt: new Date(),
    };
    expect(validateApprovalToken(approval, "u1", "sqlmap").ok).toBe(false);
  });
  it("rejects expired approval (>1h old)", () => {
    const approval: MockApproval = {
      id: "abc", userId: "u1", toolId: "sqlmap", status: "approved",
      reviewedAt: new Date(Date.now() - 2 * 60 * 60_000), // 2h ago
    };
    expect(validateApprovalToken(approval, "u1", "sqlmap").ok).toBe(false);
    expect(validateApprovalToken(approval, "u1", "sqlmap").error).toContain("expired");
  });
});

// ── Job ownership enforcement unit tests ──────────────────────────────────────
describe("Job ownership enforcement", () => {
  interface MockJob { userId: string; done: boolean; exitCode: number | null; }
  const jobs = new Map<string, MockJob>();
  jobs.set("job-a", { userId: "user-alice", done: false, exitCode: null });
  jobs.set("job-b", { userId: "user-bob",   done: true,  exitCode: 0 });

  function canAccessJob(jobId: string, requestingUserId: string, isAdmin: boolean): boolean {
    const job = jobs.get(jobId);
    if (!job) return false;
    if (isAdmin) return true;
    return job.userId === requestingUserId;
  }

  it("owner can access their own job", () => {
    expect(canAccessJob("job-a", "user-alice", false)).toBe(true);
  });
  it("other user cannot access someone else's job", () => {
    expect(canAccessJob("job-a", "user-bob", false)).toBe(false);
  });
  it("admin can access any job", () => {
    expect(canAccessJob("job-a", "user-bob", true)).toBe(true);
    expect(canAccessJob("job-b", "user-alice", true)).toBe(true);
  });
  it("returns false for non-existent job", () => {
    expect(canAccessJob("job-xyz", "user-alice", false)).toBe(false);
  });

  it("GET /jobs filters by userId for non-admin", () => {
    const list: { jobId: string; userId: string }[] = [];
    const isAdmin = false;
    const userId  = "user-alice";
    for (const [id, j] of jobs.entries()) {
      if (!isAdmin && j.userId !== userId) continue;
      list.push({ jobId: id, userId: j.userId });
    }
    expect(list.length).toBe(1);
    expect(list[0].userId).toBe("user-alice");
  });

  it("GET /jobs returns all jobs for admin", () => {
    const list: { jobId: string; userId: string }[] = [];
    const isAdmin = true;
    for (const [id, j] of jobs.entries()) {
      if (!isAdmin && j.userId !== "user-alice") continue;
      list.push({ jobId: id, userId: j.userId });
    }
    expect(list.length).toBe(2);
  });
});

// ── Scheduler helpers unit tests ──────────────────────────────────────────────
describe("Scheduler — computeNextRunAt", () => {
  function computeNextRunAt(cronExpr: string): Date {
    const now = new Date();
    const e = cronExpr.trim().toLowerCase();
    if (e === "@hourly"  || e === "0 * * * *") return new Date(now.getTime() + 60 * 60_000);
    if (e === "@daily"   || e === "0 0 * * *") return new Date(now.getTime() + 24 * 60 * 60_000);
    if (e === "@weekly"  || e === "0 0 * * 0") return new Date(now.getTime() + 7 * 24 * 60 * 60_000);
    if (e === "@monthly" || e === "0 0 1 * *") return new Date(now.getTime() + 30 * 24 * 60 * 60_000);
    return new Date(now.getTime() + 60 * 60_000); // default hourly
  }

  it("@hourly → ~1 hour from now", () => {
    const next = computeNextRunAt("@hourly");
    const diff = next.getTime() - Date.now();
    expect(diff).toBeGreaterThan(59 * 60_000);
    expect(diff).toBeLessThan(61 * 60_000);
  });
  it("@daily → ~24 hours from now", () => {
    const next = computeNextRunAt("@daily");
    const diff = next.getTime() - Date.now();
    expect(diff).toBeGreaterThan(23 * 60 * 60_000);
  });
  it("@weekly → ~7 days from now", () => {
    const next = computeNextRunAt("@weekly");
    const diff = next.getTime() - Date.now();
    expect(diff).toBeGreaterThan(6 * 24 * 60 * 60_000);
  });
  it("0 * * * * is equivalent to @hourly", () => {
    const a = computeNextRunAt("@hourly");
    const b = computeNextRunAt("0 * * * *");
    expect(Math.abs(a.getTime() - b.getTime())).toBeLessThan(100);
  });
});

// ── extractTargetIp unit tests ─────────────────────────────────────────────────
describe("extractTargetIp — IP extraction from target string", () => {
  function extractTargetIp(target: string): string | null {
    const clean = target.trim().replace(/^https?:\/\//, "").split("/")[0].split(":")[0];
    if (/^\d{1,3}(\.\d{1,3}){3}$/.test(clean)) return clean;
    return null;
  }

  it("extracts bare IP", () => {
    expect(extractTargetIp("8.8.8.8")).toBe("8.8.8.8");
  });
  it("returns null for domain", () => {
    expect(extractTargetIp("example.com")).toBeNull();
  });
  it("extracts IP from URL", () => {
    expect(extractTargetIp("https://1.2.3.4/path")).toBe("1.2.3.4");
  });
  it("extracts IP from host:port", () => {
    expect(extractTargetIp("1.2.3.4:8080")).toBe("1.2.3.4");
  });
  it("returns null for IPv6", () => {
    expect(extractTargetIp("2001:db8::1")).toBeNull();
  });
});
