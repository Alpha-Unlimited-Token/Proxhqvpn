// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Unit tests for target scope allowlist matching logic (targetAllowlist middleware).
import { describe, it, expect } from "vitest";
import { targetMatchesScope } from "../middlewares/targetAllowlist";

describe("targetMatchesScope — ip", () => {
  it("matches exact IP", () => {
    expect(targetMatchesScope("203.0.113.5", "ip", "203.0.113.5")).toBe(true);
  });

  it("rejects different IP", () => {
    expect(targetMatchesScope("203.0.113.6", "ip", "203.0.113.5")).toBe(false);
  });

  it("matches IP with /prefix notation", () => {
    expect(targetMatchesScope("203.0.113.5/24", "ip", "203.0.113.5")).toBe(true);
  });
});

describe("targetMatchesScope — url", () => {
  it("matches exact URL prefix", () => {
    expect(targetMatchesScope("https://example.com/path", "url", "https://example.com")).toBe(true);
  });

  it("rejects URL with different origin", () => {
    expect(targetMatchesScope("https://evil.com/path", "url", "https://example.com")).toBe(false);
  });

  it("matches root URL", () => {
    expect(targetMatchesScope("https://example.com", "url", "https://example.com")).toBe(true);
  });
});

describe("targetMatchesScope — domain", () => {
  it("matches exact domain", () => {
    expect(targetMatchesScope("example.com", "domain", "example.com")).toBe(true);
  });

  it("matches subdomain", () => {
    expect(targetMatchesScope("api.example.com", "domain", "example.com")).toBe(true);
  });

  it("matches deep subdomain", () => {
    expect(targetMatchesScope("a.b.example.com", "domain", "example.com")).toBe(true);
  });

  it("rejects sibling domain", () => {
    expect(targetMatchesScope("notexample.com", "domain", "example.com")).toBe(false);
  });

  it("strips https:// before comparing", () => {
    expect(targetMatchesScope("https://api.example.com/foo", "domain", "example.com")).toBe(true);
  });

  it("strips port before comparing", () => {
    expect(targetMatchesScope("example.com:8080", "domain", "example.com")).toBe(true);
  });
});

describe("targetMatchesScope — cidr", () => {
  it("matches IP in /24 range", () => {
    expect(targetMatchesScope("10.0.0.50", "cidr", "10.0.0.0/24")).toBe(true);
  });

  it("matches network address itself", () => {
    expect(targetMatchesScope("10.0.0.0", "cidr", "10.0.0.0/24")).toBe(true);
  });

  it("rejects IP outside /24 range", () => {
    expect(targetMatchesScope("10.0.1.50", "cidr", "10.0.0.0/24")).toBe(false);
  });

  it("matches /16 range", () => {
    expect(targetMatchesScope("192.168.5.1", "cidr", "192.168.0.0/16")).toBe(true);
  });

  it("rejects IP outside /16 range", () => {
    expect(targetMatchesScope("192.169.0.1", "cidr", "192.168.0.0/16")).toBe(false);
  });
});

describe("targetMatchesScope — unknown type", () => {
  it("returns false for unknown scope type", () => {
    expect(targetMatchesScope("anything", "wildcard", "anything")).toBe(false);
  });
});

// ── URL origin-confusion bypass tests (round-6 fix) ────────────────────────
// Regression tests for the startsWith-based URL matching that allowed
// "https://example.com.evil.com/path" to pass a scope of "https://example.com"
describe("targetMatchesScope — URL origin-confusion bypass prevention", () => {
  it("rejects URL where scope origin is a prefix of a longer hostname (startsWith bypass)", () => {
    // Attacker submits https://example.com.evil.com — shares example.com prefix but
    // different origin. A startsWith check would wrongly allow this.
    expect(
      targetMatchesScope("https://example.com.evil.com/path", "url", "https://example.com"),
    ).toBe(false);
  });

  it("rejects URL where scope domain appears as a subdirectory path component", () => {
    // Attacker submits https://evil.com/example.com/anything — scope origin check
    // must compare origins (scheme+host+port), not raw string prefixes.
    expect(
      targetMatchesScope("https://evil.com/example.com/anything", "url", "https://example.com"),
    ).toBe(false);
  });

  it("allows legitimate subdirectory paths on the same origin", () => {
    expect(
      targetMatchesScope("https://example.com/api/v2/endpoint", "url", "https://example.com"),
    ).toBe(true);
  });

  it("rejects mismatched scheme even with same host", () => {
    // http:// vs https:// — different origins
    expect(
      targetMatchesScope("http://example.com/path", "url", "https://example.com"),
    ).toBe(false);
  });

  it("rejects mismatched port even with same host", () => {
    expect(
      targetMatchesScope("https://example.com:8443/path", "url", "https://example.com"),
    ).toBe(false);
  });

  it("allows exact origin with trailing slash path", () => {
    expect(
      targetMatchesScope("https://example.com/", "url", "https://example.com"),
    ).toBe(true);
  });
});
