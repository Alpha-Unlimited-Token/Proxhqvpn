import crypto from "crypto";

export interface EnrollmentTokenRecord {
  tokenHash: string;
  region?: string | null;
  expiresAt: Date;
  usedAt?: Date | null;
  createdBy: string;
}

export function createOneTimeEnrollmentToken(createdBy: string, region?: string | null) {
  const token = `pxn_${crypto.randomBytes(32).toString("base64url")}`;
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + 15 * 60_000); // 15-minute window
  const record: EnrollmentTokenRecord = { tokenHash, region: region ?? null, expiresAt, createdBy, usedAt: null };
  return { token, record };
}

export function hashEnrollmentToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/** Short-lived per-node daemon secret issued on enrollment — replaces long-lived PSK */
export function createPerNodeSecret() {
  return `pxs_${crypto.randomBytes(48).toString("base64url")}`;
}

export function timingSafeTokenCompare(a: string, b: string): boolean {
  try {
    const ab = Buffer.from(a, "hex");
    const bb = Buffer.from(b, "hex");
    return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
  } catch {
    return false;
  }
}
