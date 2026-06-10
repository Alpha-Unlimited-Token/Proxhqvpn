import crypto from "crypto";

export function createEnrollmentToken(): { token: string; tokenHash: string; expiresAt: Date } {
  const token = `pxn_${crypto.randomBytes(32).toString("base64url")}`;
  const tokenHash = hashEnrollmentToken(token);
  const expiresAt = new Date(Date.now() + 15 * 60_000); // 15-minute window
  return { token, tokenHash, expiresAt };
}

export function hashEnrollmentToken(token: string): string {
  return crypto.createHash("sha256").update(token, "utf8").digest("hex");
}

export function safeCompareHash(a: string, b: string): boolean {
  const ab = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}
