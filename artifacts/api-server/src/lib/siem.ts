// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// SIEM integration module — gap bridge from ChatGPT audit.
// Supports Splunk HEC, generic HTTP SIEM, and local structured log fallback.

import { logger } from "./logger";

export interface SiemEvent {
  actor: string;
  action: string;
  resource: string;
  result: "allow" | "deny" | "error";
  ip?: string;
  metadata?: Record<string, unknown>;
  severity?: "low" | "medium" | "high" | "critical";
}

// ── Splunk HTTP Event Collector ───────────────────────────────────────────────

const SPLUNK_HEC_URL   = process.env.SPLUNK_HEC_URL ?? "";
const SPLUNK_HEC_TOKEN = process.env.SPLUNK_HEC_TOKEN ?? "";
const SPLUNK_INDEX     = process.env.SPLUNK_INDEX ?? "proxhqvpn";

export async function sendToSplunk(event: SiemEvent): Promise<void> {
  if (!SPLUNK_HEC_URL || !SPLUNK_HEC_TOKEN) return; // Not configured — silent skip

  const payload = JSON.stringify({
    time: Date.now() / 1000,
    sourcetype: "proxhqvpn:audit",
    index: SPLUNK_INDEX,
    event,
  });

  try {
    const resp = await fetch(SPLUNK_HEC_URL, {
      method: "POST",
      headers: {
        authorization: `Splunk ${SPLUNK_HEC_TOKEN}`,
        "content-type": "application/json",
      },
      body: payload,
      signal: AbortSignal.timeout(5000),
    });
    if (!resp.ok) {
      logger.warn({ status: resp.status }, "Splunk HEC delivery failed");
    }
  } catch (err) {
    logger.warn({ err }, "Splunk HEC unreachable — event not shipped");
  }
}

// ── Generic HTTP SIEM webhook (Elastic, QRadar, Datadog, custom) ─────────────

const SIEM_WEBHOOK_URL    = process.env.SIEM_WEBHOOK_URL ?? "";
const SIEM_WEBHOOK_TOKEN  = process.env.SIEM_WEBHOOK_TOKEN ?? "";

export async function sendToSiemWebhook(event: SiemEvent): Promise<void> {
  if (!SIEM_WEBHOOK_URL) return;

  try {
    const resp = await fetch(SIEM_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(SIEM_WEBHOOK_TOKEN ? { authorization: `Bearer ${SIEM_WEBHOOK_TOKEN}` } : {}),
        "x-proxhqvpn-source": "audit",
      },
      body: JSON.stringify({ ts: new Date().toISOString(), ...event }),
      signal: AbortSignal.timeout(5000),
    });
    if (!resp.ok) {
      logger.warn({ status: resp.status }, "SIEM webhook delivery failed");
    }
  } catch (err) {
    logger.warn({ err }, "SIEM webhook unreachable — event not shipped");
  }
}

// ── Unified ship function — sends to all configured destinations ──────────────

/**
 * Ship a security event to all configured SIEM destinations.
 * Always falls back to structured local log — never throws.
 * Call this for every security-relevant action: key access, posture checks,
 * admin actions, daemon auth, ghost mode, firewall changes.
 */
export async function shipSecurityEvent(event: SiemEvent): Promise<void> {
  // Always log locally first (never lose events due to SIEM outage)
  logger.info({ siem: true, ...event }, "security_event");

  // Ship to all configured destinations in parallel — failures are warned, not thrown
  await Promise.allSettled([
    sendToSplunk(event),
    sendToSiemWebhook(event),
  ]);
}
