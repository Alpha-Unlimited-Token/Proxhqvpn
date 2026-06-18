// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Tamper-evident SHA3-256 hash-chain audit ledger with HMAC-SHA512 signing.
// Upgraded from SHA-256 to SHA3-256 per gap bridge audit (2026-06-09).
// Provides: append(), verifyChain(), currentChainTip(), seedChainFromDb(), and AuditLedger class.
import crypto from "crypto";
import { db } from "@workspace/db";
import { auditLogAppendOnlyTable } from "@workspace/db";
import { desc } from "drizzle-orm";

export interface AuditEvent {
  actor: string;       // userId, "daemon:<nodeId>", or "system"
  action: string;      // e.g. "wireguard.key_download", "ztna.posture_check"
  resource: string;    // e.g. "user_wg_configs:42", "device:abc123"
  result?: "allow" | "deny" | "error";
  metadata?: unknown;
  ip?: string;
}

export interface ChainEntry {
  ts: string;
  seq: number;
  prevHash: string;
  hash: string;
  sig: string;
  event: AuditEvent;
}

// In-process chain state — persisted to DB separately by callers
let _seq = 0;
let _prevHash: string = process.env.AUDIT_GENESIS_HASH ?? "GENESIS";

function auditHmacKey(): Buffer {
  const b64 = process.env.AUDIT_HMAC_KEY_B64 ?? "";
  if (!b64) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("AUDIT_HMAC_KEY_B64 is required in production");
    }
    return Buffer.alloc(32, 0xca); // dev-only deterministic key
  }
  const key = Buffer.from(b64, "base64");
  if (key.length !== 32) throw new Error("AUDIT_HMAC_KEY_B64 must decode to 32 bytes");
  return key;
}

/**
 * Append an event to the in-process hash chain and return the signed entry.
 * Uses SHA3-256 for hashing and HMAC-SHA512 for signing.
 * Persist the returned entry to DB and ship to SIEM via siem.ts.
 */
export function appendAuditEvent(event: AuditEvent): ChainEntry {
  const ts = new Date().toISOString();
  const seq = ++_seq;
  const prevHash = _prevHash;

  const recBase = { ts, seq, prevHash, event };
  // Sort keys for deterministic canonical form
  const canonical = JSON.stringify(recBase, Object.keys(recBase).sort() as any);
  const hash = crypto.createHash("sha3-256").update(canonical).digest("hex");
  const sig = crypto.createHmac("sha512", auditHmacKey()).update(hash).digest("base64url");

  _prevHash = hash;
  return { ts, seq, prevHash, hash, sig, event };
}

/**
 * Verify a sequence of chain entries for hash continuity and signature integrity.
 * Returns { valid: true } or { valid: false, firstBadIndex, reason }.
 */
export function verifyChain(
  entries: ChainEntry[],
  genesisHash: string = process.env.AUDIT_GENESIS_HASH ?? "GENESIS",
  signingKey?: string | Buffer,
): { valid: true } | { valid: false; firstBadIndex: number; reason: string } {
  let expectedPrev = genesisHash;
  const key = signingKey !== undefined ? signingKey : auditHmacKey();

  for (let i = 0; i < entries.length; i++) {
    const e = entries[i];

    if (e.prevHash !== expectedPrev) {
      return { valid: false, firstBadIndex: i, reason: `prevHash mismatch at index ${i}` };
    }

    const recBase = { ts: e.ts, seq: e.seq, prevHash: e.prevHash, event: e.event };
    const canonical = JSON.stringify(recBase, Object.keys(recBase).sort() as any);
    const expectedHash = crypto.createHash("sha3-256").update(canonical).digest("hex");
    if (e.hash !== expectedHash) {
      return { valid: false, firstBadIndex: i, reason: `hash mismatch at index ${i}` };
    }

    const expectedSig = crypto.createHmac("sha512", key).update(e.hash).digest("base64url");
    const sigA = Buffer.from(e.sig.padEnd(expectedSig.length, "\0"));
    const sigB = Buffer.from(expectedSig.padEnd(e.sig.length, "\0"));
    if (sigA.length !== sigB.length || !crypto.timingSafeEqual(sigA, sigB)) {
      return { valid: false, firstBadIndex: i, reason: `HMAC signature invalid at index ${i}` };
    }

    expectedPrev = e.hash;
  }

  return { valid: true };
}

/** Current chain tip hash — use as prevHash seed after process restart. */
export function currentChainTip(): string { return _prevHash; }

/**
 * Seed the in-process chain state from the last persisted row in the DB.
 * Call once during server startup — before any appendAuditEvent() calls —
 * so the in-memory chain continues from the last persisted hash rather than
 * restarting from GENESIS on every process restart (which breaks chain continuity).
 */
export async function seedChainFromDb(): Promise<void> {
  try {
    const [last] = await db
      .select()
      .from(auditLogAppendOnlyTable)
      .orderBy(desc(auditLogAppendOnlyTable.seq))
      .limit(1);

    if (last) {
      _seq = last.seq;
      _prevHash = last.hash;
    }
  } catch {
    // Non-fatal: if the table doesn't exist yet (first boot), start from GENESIS
  }
}

/**
 * Class-based ledger for use where multiple independent chains are needed
 * (e.g. per-tenant chains). Uses same SHA3-256 + HMAC-SHA512 scheme.
 */
export class AuditLedger {
  private seq = 0;
  private prevHash: string;

  constructor(
    private readonly signingSecret: string,
    genesisHash = "GENESIS"
  ) {
    this.prevHash = genesisHash;
  }

  append(event: AuditEvent): ChainEntry {
    const ts = new Date().toISOString();
    const seq = ++this.seq;
    const prevHash = this.prevHash;
    const recBase = { ts, seq, prevHash, event };
    const canonical = JSON.stringify(recBase, Object.keys(recBase).sort() as any);
    const hash = crypto.createHash("sha3-256").update(canonical).digest("hex");
    const sig = crypto.createHmac("sha512", this.signingSecret).update(hash).digest("base64url");
    this.prevHash = hash;
    return { ts, seq, prevHash, hash, sig, event };
  }

  tip(): string { return this.prevHash; }
}
