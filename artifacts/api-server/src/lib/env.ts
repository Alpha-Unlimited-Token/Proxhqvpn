import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().url(),
  SESSION_SECRET: z.string().min(32),
  ALLOWED_ORIGINS: z.string().optional(),
  PROXHQ_MASTER_KEY_B64: z.string().min(44).optional(),
  AUDIT_HMAC_KEY_B64: z.string().min(44).optional(),
  PROXHQ_ENABLE_SECURITY_LAB: z.enum(["0", "1"]).default("0"),
  PROXHQ_ENABLE_OMEGA: z.enum(["0", "1"]).default("0"),
  PROXHQ_PUBLIC_API_BASE_URL: z.string().url().optional(),
  INTERNAL_SERVICE_CIDRS: z.string().default("127.0.0.1/32,::1/128"),
  COMMAND_GOVERNANCE_ENFORCED: z.enum(["0", "1"]).default("1"),
  PROXHQ_LAB_API_BASE_URL: z.string().url().optional(),
});

export type ProxEnv = z.infer<typeof EnvSchema>;

export function loadEnv(): ProxEnv {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid ProxHQ environment: ${details}`);
  }
  const data = parsed.data;
  if (data.NODE_ENV === "production") {
    if (!data.PROXHQ_MASTER_KEY_B64) {
      throw new Error("Production requires PROXHQ_MASTER_KEY_B64 (min 44 chars base64).");
    }
    if (!data.AUDIT_HMAC_KEY_B64) {
      throw new Error("Production requires AUDIT_HMAC_KEY_B64 (min 44 chars base64).");
    }
    if (!data.ALLOWED_ORIGINS || data.ALLOWED_ORIGINS.includes("replit.dev")) {
      console.warn("[ProxHQ] WARN: Production should use strict ALLOWED_ORIGINS without wildcard dev domains.");
    }
    if (data.PROXHQ_ENABLE_SECURITY_LAB === "1") {
      throw new Error("Security lab routes must not run in the production VPN control plane.");
    }
  }
  return data;
}

export const env = (() => {
  try {
    return loadEnv();
  } catch (e) {
    if (process.env.NODE_ENV === "production") throw e;
    console.warn("[ProxHQ] env validation warning:", (e as Error).message);
    return EnvSchema.parse({ ...process.env, DATABASE_URL: process.env.DATABASE_URL ?? "postgresql://localhost/proxhq" });
  }
})();
