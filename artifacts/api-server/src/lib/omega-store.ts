// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Shared in-memory state for the Omega agent system.
// Token → hostId mapping. Screenshot base64 by screenshot DB id.
// These are intentionally ephemeral — agent scripts regenerated if server restarts.

import crypto from "crypto";

export const agentTokens = new Map<string, number>(); // token → hostId
export const screenshotData = new Map<number, string>(); // screenshotId → base64 dataUrl

export function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function tokenForHost(hostId: number): string {
  // Return existing token or create new one
  for (const [tok, id] of agentTokens.entries()) {
    if (id === hostId) return tok;
  }
  const token = generateToken();
  agentTokens.set(token, hostId);
  return token;
}

export function resolveToken(token: string): number | null {
  const id = agentTokens.get(token);
  return id !== undefined ? id : null;
}
