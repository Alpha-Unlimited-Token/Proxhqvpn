const SECRET_KEY_PATTERNS = [
  /private.?key/i,
  /recovered.?key/i,
  /secret/i,
  /token/i,
  /password/i,
  /mnemonic/i,
  /seed/i,
  /priv.?key/i,
  /xprv/i,
];

const HEX_PRIVATE_KEY_RE = /^(0x)?[a-f0-9]{64,}$/i;
const WIF_RE = /^[5KLc][1-9A-HJ-NP-Za-km-z]{50,51}$/;

export function redactSecrets<T>(value: T, depth = 0): T {
  if (depth > 10) return value; // cycle guard
  if (value == null) return value;
  if (typeof value === "string") {
    if (HEX_PRIVATE_KEY_RE.test(value)) return "[REDACTED]" as unknown as T;
    if (WIF_RE.test(value)) return "[REDACTED]" as unknown as T;
    return value;
  }
  if (Array.isArray(value)) return value.map(v => redactSecrets(v, depth + 1)) as unknown as T;
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SECRET_KEY_PATTERNS.some(p => p.test(k))
        ? "[REDACTED]"
        : redactSecrets(v, depth + 1);
    }
    return out as unknown as T;
  }
  return value;
}

export function redactMiddleware() {
  return (_req: unknown, res: any, next: () => void) => {
    const originalJson = res.json.bind(res);
    res.json = (body: unknown) => originalJson(redactSecrets(body));
    next();
  };
}
