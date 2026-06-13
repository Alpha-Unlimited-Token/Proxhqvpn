// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// TLS runner — checks certificate expiry, issuer, and basic handshake.
import tls from "tls";
import { URL } from "url";
import type { ValidationTarget } from "../services/validationTargetService";

export interface TlsResult {
  status: "passed" | "failed" | "warning" | "error";
  score: number;
  maxScore: number;
  message: string;
  toolName: string;
  toolVersion: string;
  rawOutput: Record<string, unknown>;
}

function tlsCheck(host: string, port: number): Promise<{
  valid: boolean;
  subject: string;
  issuer: string;
  validFrom: string;
  validTo: string;
  daysRemaining: number;
  protocol: string;
}> {
  return new Promise((resolve, reject) => {
    const socket = tls.connect({ host, port, servername: host, rejectUnauthorized: false }, () => {
      const cert = socket.getPeerCertificate();
      const protocol = socket.getProtocol() ?? "unknown";
      socket.destroy();

      if (!cert || !cert.subject) {
        reject(new Error("No certificate received"));
        return;
      }

      const validTo    = new Date(cert.valid_to);
      const validFrom  = new Date(cert.valid_from);
      const now        = new Date();
      const daysRemaining = Math.floor((validTo.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      resolve({
        valid:         now >= validFrom && now <= validTo,
        subject:       (Array.isArray(cert.subject.CN) ? cert.subject.CN[0] : cert.subject.CN) ?? JSON.stringify(cert.subject),
        issuer:        (Array.isArray(cert.issuer?.O) ? cert.issuer!.O![0] : cert.issuer?.O) ?? (Array.isArray(cert.issuer?.CN) ? cert.issuer!.CN![0] : cert.issuer?.CN) ?? "Unknown",
        validFrom:     (Array.isArray(cert.valid_from) ? cert.valid_from[0] : cert.valid_from) ?? "",
        validTo:       (Array.isArray(cert.valid_to)   ? cert.valid_to[0]   : cert.valid_to)   ?? "",
        daysRemaining,
        protocol,
      });
    });
    socket.setTimeout(10_000, () => { socket.destroy(); reject(new Error("TLS connection timed out")); });
    socket.on("error", reject);
  });
}

export async function runTlsCheck(target: ValidationTarget): Promise<TlsResult> {
  const url  = target.url ?? (target.host ? `https://${target.host}` : null);
  const host = target.host ?? (url ? new URL(url).hostname : null);
  const port = target.port ?? 443;

  if (!host) {
    return { status: "error", score: 0, maxScore: 100, message: "Target has no host/URL", toolName: "tls-runner", toolVersion: "1.0.0", rawOutput: {} };
  }

  try {
    const info = await tlsCheck(host, port);
    const issues: string[] = [];
    if (!info.valid)                issues.push("Certificate is expired or not yet valid");
    if (info.daysRemaining < 14)    issues.push(`Certificate expires in ${info.daysRemaining} days`);
    if (info.daysRemaining < 30)    issues.push(`Certificate expires soon (${info.daysRemaining} days)`);
    if (info.protocol === "TLSv1" || info.protocol === "TLSv1.1") issues.push(`Weak protocol: ${info.protocol}`);

    const score  = issues.length === 0 ? 100 : info.daysRemaining < 14 ? 0 : 60;
    const status = issues.length === 0 ? "passed" : info.daysRemaining < 14 || !info.valid ? "failed" : "warning";

    return {
      status,
      score,
      maxScore:    100,
      message:     issues.length > 0 ? issues.join("; ") : `Valid TLS via ${info.protocol}, expires in ${info.daysRemaining} days`,
      toolName:    "tls-runner",
      toolVersion: "1.0.0",
      rawOutput:   { host, port, ...info, issues },
    };
  } catch (err: any) {
    return {
      status:      "error",
      score:       0,
      maxScore:    100,
      message:     `TLS check failed: ${err.message ?? "unknown"}`,
      toolName:    "tls-runner",
      toolVersion: "1.0.0",
      rawOutput:   { host, port, error: err.message },
    };
  }
}
