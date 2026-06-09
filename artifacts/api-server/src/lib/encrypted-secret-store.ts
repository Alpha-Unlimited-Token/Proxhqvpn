// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// AES-256-GCM envelope encryption for WireGuard private keys and PSKs stored in DB.
// Audit finding: Plaintext VPN keys/PSKs in DB — Critical severity.
// Fix: AES-256-GCM with AAD (associated authenticated data) per field per row.
import crypto from "crypto";

const MASTER_KEY_B64 = process.env.PROXHQ_MASTER_KEY_B64 ?? "";

if (!MASTER_KEY_B64 && process.env.NODE_ENV === "production") {
  throw new Error(
    "PROXHQ_MASTER_KEY_B64 is required in production. " +
    "Generate with: node -e \"console.log(require('crypto').randomBytes(32).toString('base64'))\""
  );
}

function masterKey(): Buffer {
  if (!MASTER_KEY_B64) {
    // Dev/test only — deterministic dev key, never used in production
    return Buffer.alloc(32, 0xde);
  }
  const key = Buffer.from(MASTER_KEY_B64, "base64");
  if (key.length !== 32) {
    throw new Error("PROXHQ_MASTER_KEY_B64 must decode to exactly 32 bytes (256 bits)");
  }
  return key;
}

/** Encrypt a plaintext secret with AES-256-GCM.
 *  @param plaintext  The secret string to encrypt (WireGuard private key, PSK, etc.)
 *  @param aad        Additional authenticated data binding this ciphertext to its DB row.
 *                    Use format: "table:userId:rowId:fieldName"
 *  @returns          Opaque versioned token safe to store in a text DB column.
 */
export function encryptSecret(plaintext: string, aad: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", masterKey(), iv);
  cipher.setAAD(Buffer.from(aad, "utf8"));
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Format: v1.<iv>.<tag>.<ciphertext> — all base64url, no padding issues
  return `v1.${iv.toString("base64url")}.${tag.toString("base64url")}.${enc.toString("base64url")}`;
}

/** Decrypt a secret token produced by encryptSecret().
 *  Throws if the token is malformed, tampered, or the AAD does not match.
 */
export function decryptSecret(token: string, aad: string): string {
  const parts = token.split(".");
  if (parts.length !== 4 || parts[0] !== "v1") {
    throw new Error(`Bad encrypted secret token format (expected v1.<iv>.<tag>.<ct>, got: ${token.substring(0, 12)}...)`);
  }
  const [, ivB64, tagB64, encB64] = parts;
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    masterKey(),
    Buffer.from(ivB64, "base64url")
  );
  decipher.setAAD(Buffer.from(aad, "utf8"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
  try {
    return Buffer.concat([
      decipher.update(Buffer.from(encB64, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new Error("Secret decryption failed — token tampered or wrong AAD");
  }
}

/** Build a consistent AAD string for a WireGuard config field. */
export function wgConfigAad(userId: string, configId: number, field: "clientPrivateKey" | "pskKey"): string {
  return `user_wg_configs:${userId}:${configId}:${field}`;
}

/** Returns true if a stored value is already encrypted (starts with v1.) */
export function isEncrypted(value: string | null | undefined): boolean {
  return typeof value === "string" && value.startsWith("v1.");
}
