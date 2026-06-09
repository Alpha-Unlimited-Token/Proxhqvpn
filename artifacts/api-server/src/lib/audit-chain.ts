// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// HMAC-keyed SHA-256 hash chain for tamper-evident audit logging.
// Audit finding: Audit log admin-bypassable, not keyed, not off-node — High severity.
import crypto from "crypto";

export interface AuditEvent {
  actor: string;     // userId or "daemon:<nodeId>" or "system"
  action: string;    // e.g. "wireguard.key_download", "terminal.ghost_mode_exec"
  resource: string;  // e.g. "user_wg_configs:42", "node:63"
  metadata?: unknown;
  ip?: string;
}

export interface ChainEntry {
  ts: string;
  prevHash: string;
  hash: string;
  sig: string;
  event: AuditEvent;
}

// Genesis hash — override via env for reproducible chain verification
let lastHash: string = process.env.AUDIT_GENESIS_HASH ?? "0".repeat(64);

function auditHmacKey(): Buffer {
  const b64 = process.env.AUDIT_HMAC_KEY_B64 ?? "";
  if (!b64) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("AUDIT_HMAC_KEY_B64 is required in production for keyed audit chain");
    }
    // Dev: deterministic 32-byte key so chain can be verified across restarts
    return Buffer.alloc(32, 0xca);
  }
  const key = Buffer.from(b64, "base64");
  if (key.length !== 32) throw new Error("AUDIT_HMAC_KEY_B64 must decode to 32 bytes");
  return key;
}

/**
 * Append an event to the in-process hash chain and return the signed entry.
 * Call this for every security-relevant action (key downloads, ghost mode execs,
 * daemon auth, config changes, admin actions).
 *
 * The returned entry should be persisted to the DB AND shipped off-node
 * (e.g. via syslog, a WORM object store, or a separate audit DB).
 */
export function appendAuditEvent(event: AuditEvent): ChainEntry {
  const ts = new Date().toISOString();
  const prevHash = lastHash;
  const payload = JSON.stringify({ ts, prevHash, event });
  const hash = crypto.createHash("sha256").update(payload).digest("hex");
  const sig = crypto.createHmac("sha256", auditHmacKey()).update(payload).digest("base64url");
  lastHash = hash;
  return { ts, prevHash, hash, sig, event };
}

/**
 * Verify a chain of entries for continuity and signature integrity.
 * Returns { valid: true } or { valid: false, firstBadIndex: number, reason: string }.
 */
export function verifyChain(
  entries: ChainEntry[],
  genesisHash: string = "0".repeat(64)
): { valid: true } | { valid: false; firstBadIndex: number; reason: string } {
  let expectedPrev = genesisHash;
  const key = auditHmacKey();

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];

    if (entry.prevHash !== expectedPrev) {
      return { valid: false, firstBadIndex: i, reason: `prevHash mismatch at index ${i}` };
    }

    const payload = JSON.stringify({ ts: entry.ts, prevHash: entry.prevHash, event: entry.event });
    const expectedHash = crypto.createHash("sha256").update(payload).digest("hex");
    if (entry.hash !== expectedHash) {
      return { valid: false, firstBadIndex: i, reason: `hash mismatch at index ${i}` };
    }

    const expectedSig = crypto.createHmac("sha256", key).update(payload).digest("base64url");
    const sigA = Buffer.from(entry.sig.padEnd(expectedSig.length, "\0"));
    const sigB = Buffer.from(expectedSig.padEnd(entry.sig.length, "\0"));
    if (sigA.length !== sigB.length || !crypto.timingSafeEqual(sigA, sigB)) {
      return { valid: false, firstBadIndex: i, reason: `HMAC signature invalid at index ${i}` };
    }

    expectedPrev = entry.hash;
  }

  return { valid: true };
}

/** Current tip of the in-process chain (for continuity checks after restart). */
export function currentChainTip(): string {
  return lastHash;
}
