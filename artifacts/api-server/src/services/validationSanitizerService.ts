// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Redacts secrets from validation run output before storing.

const REDACT_PATTERNS: [RegExp, string][] = [
  // Private keys
  [/-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END[\s\S]*?PRIVATE KEY-----/gi, "[REDACTED_PRIVATE_KEY]"],
  // WireGuard private keys (base64, 44 chars)
  [/\b[A-Za-z0-9+/]{43}=\b/g, "[REDACTED_WG_KEY]"],
  // Bearer tokens
  [/Bearer\s+[A-Za-z0-9\-._~+/]+=*/gi, "Bearer [REDACTED]"],
  // Authorization headers
  [/(Authorization|x-api-key|x-auth-token|x-session|cookie)\s*:\s*\S+/gi, "$1: [REDACTED]"],
  // JWT-shaped tokens
  [/eyJ[A-Za-z0-9\-_]+\.eyJ[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_.+/=]+/g, "[REDACTED_JWT]"],
  // Database URLs
  [/postgres(?:ql)?:\/\/[^@]*@[^\s"']+/gi, "postgres://[REDACTED]@[REDACTED]"],
  [/mysql:\/\/[^@]*@[^\s"']+/gi, "mysql://[REDACTED]@[REDACTED]"],
  // Generic secrets/passwords
  [/(password|passwd|secret|token|api_key|apikey|access_key|private_key)\s*[:=]\s*["']?[^\s"',}]+["']?/gi, "$1=[REDACTED]"],
  // AWS-style keys
  [/AKIA[0-9A-Z]{16}/g, "[REDACTED_AWS_ACCESS_KEY]"],
  [/[0-9a-zA-Z/+]{40}/g, "[POSSIBLE_SECRET_REDACTED]"],
  // Session IDs
  [/(PHPSESSID|JSESSIONID|connect\.sid)\s*=\s*[A-Za-z0-9%._-]+/gi, "$1=[REDACTED]"],
  // IPv4 private addresses — keep public IPs, redact internal
  [/\b(10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3})\b/g, "[INTERNAL_IP]"],
];

function redactString(input: string): string {
  let out = input;
  for (const [pattern, replacement] of REDACT_PATTERNS) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

export function sanitizeValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return redactString(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.map(sanitizeValue);
  if (typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const lk = k.toLowerCase();
      const isSensitiveKey = [
        "password", "passwd", "secret", "token", "apikey", "api_key",
        "private_key", "privatekey", "authorization", "cookie", "session",
        "access_key", "wg_private", "wireguard_private",
      ].some(s => lk.includes(s));

      result[k] = isSensitiveKey ? "[REDACTED]" : sanitizeValue(v);
    }
    return result;
  }
  return value;
}

export function sanitizeOutput(raw: unknown): unknown {
  return sanitizeValue(raw);
}
