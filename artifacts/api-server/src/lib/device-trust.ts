// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Zero Trust device posture scoring — gap bridge from ChatGPT audit.
// Evaluates device signals and produces a trust score + allow/deny decision.
// Score >= 75 → allow; below → deny with reasons list.

export interface DeviceSignals {
  os: string;
  diskEncrypted: boolean;
  firewallEnabled: boolean;
  edrHealthy: boolean;
  jailbrokenOrRooted: boolean;
  lastPatchAgeDays: number;
  certificateValid: boolean;
  ipReputation: "good" | "unknown" | "bad";
}

export interface TrustDecision {
  score: number;
  allow: boolean;
  reasons: string[];        // Penalty reasons — empty when score is perfect
  recommendations: string[]; // Actionable remediation steps
}

const ALLOW_THRESHOLD = 75;

/** Evaluate device trust signals and return a score-based allow/deny decision. */
export function evaluateDeviceTrust(s: DeviceSignals): TrustDecision {
  let score = 100;
  const reasons: string[] = [];
  const recommendations: string[] = [];

  function penalize(points: number, reason: string, fix: string) {
    score -= points;
    reasons.push(reason);
    recommendations.push(fix);
  }

  if (!s.diskEncrypted) {
    penalize(25, "disk encryption disabled",
      "Enable full-disk encryption (BitLocker/FileVault/LUKS) before connecting");
  }

  if (!s.firewallEnabled) {
    penalize(15, "host firewall disabled",
      "Enable the OS host-based firewall (Windows Defender Firewall / pf / ufw)");
  }

  if (!s.edrHealthy) {
    penalize(20, "EDR agent missing or unhealthy",
      "Install/repair endpoint detection and response agent and confirm healthy status");
  }

  if (s.jailbrokenOrRooted) {
    penalize(50, "device is rooted or jailbroken",
      "Factory reset or use a non-rooted device — rooted devices cannot be trusted");
  }

  if (s.lastPatchAgeDays > 30) {
    const extra = Math.min(25, Math.floor((s.lastPatchAgeDays - 30) / 7) * 5);
    penalize(extra,
      `OS patch age ${s.lastPatchAgeDays} days (threshold: 30)`,
      "Apply all pending OS and security updates immediately");
  }

  if (!s.certificateValid) {
    penalize(40, "device certificate invalid or missing",
      "Re-enroll device with the PKI/MDM to obtain a valid device certificate");
  }

  if (s.ipReputation === "bad") {
    penalize(40, "source IP has bad reputation (threat intelligence match)",
      "Connect from a trusted network — do not tunnel from known-malicious IPs");
  } else if (s.ipReputation === "unknown") {
    penalize(10, "source IP reputation unknown",
      "Connect from a corporate/home network with a known clean IP reputation");
  }

  const finalScore = Math.max(0, score);
  return {
    score: finalScore,
    allow: finalScore >= ALLOW_THRESHOLD,
    reasons,
    recommendations,
  };
}

/**
 * Build a minimal DeviceSignals object from HTTP request headers.
 * Nodes/agents send these headers; they are validated server-side.
 * In production, supplement with MDM/EDR API lookups.
 */
export function signalsFromHeaders(headers: Record<string, string | string[] | undefined>): Partial<DeviceSignals> {
  const h = (k: string) => String(headers[k] ?? "").trim().toLowerCase();
  return {
    os:               h("x-device-os") || undefined,
    diskEncrypted:    h("x-device-disk-enc") === "true" ? true : h("x-device-disk-enc") === "false" ? false : undefined,
    firewallEnabled:  h("x-device-fw") === "true" ? true : h("x-device-fw") === "false" ? false : undefined,
    edrHealthy:       h("x-device-edr") === "true" ? true : h("x-device-edr") === "false" ? false : undefined,
    jailbrokenOrRooted: h("x-device-rooted") === "true",
    certificateValid: h("x-device-cert") === "valid" ? true : h("x-device-cert") === "invalid" ? false : undefined,
    ipReputation:     (["good", "unknown", "bad"].includes(h("x-ip-rep")) ? h("x-ip-rep") : undefined) as DeviceSignals["ipReputation"] | undefined,
  };
}
