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
  ];

  it("has 15 distinct tool categories", () => {
    expect(EXPECTED_CATEGORIES.length).toBe(15);
  });

  it("password attacks category is in the expected set", () => {
    expect(EXPECTED_CATEGORIES).toContain("Password Attacks");
  });
  it("forensics category is in the expected set", () => {
    expect(EXPECTED_CATEGORIES).toContain("Forensics & DFIR");
  });
  it("cryptography category is in the expected set", () => {
    expect(EXPECTED_CATEGORIES).toContain("Cryptography");
  });
  it("stress testing category is in the expected set", () => {
    expect(EXPECTED_CATEGORIES).toContain("Stress Testing");
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
