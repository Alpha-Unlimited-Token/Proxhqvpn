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
