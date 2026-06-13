// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import crypto, { randomUUID } from "crypto";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { publishPlatformEvent } from "../lib/event-bus";

export function fingerprintCertificate(pem: string) {
  return crypto.createHash("sha256").update(pem, "utf8").digest("hex");
}

export async function registerCertificate(input: {
  name: string;
  subject: string;
  pem: string;
  issuer?: string | null;
  serialNumber?: string | null;
  notBefore?: Date | null;
  notAfter?: Date | null;
  metadata?: Record<string, unknown>;
}) {
  const id = randomUUID();
  const fingerprint = fingerprintCertificate(input.pem);

  await db.execute(sql`
    INSERT INTO certificates
      (id, name, subject, issuer, serial_number, fingerprint_sha256, not_before, not_after, metadata)
    VALUES
      (${id}, ${input.name}, ${input.subject}, ${input.issuer ?? null}, ${input.serialNumber ?? null}, ${fingerprint}, ${input.notBefore?.toISOString() ?? null}, ${input.notAfter?.toISOString() ?? null}, ${JSON.stringify(input.metadata ?? {})}::jsonb)
  `);

  await publishPlatformEvent({
    type: "certificate.registered",
    subject: input.subject,
    severity: "info",
    payload: { certificateId: id, fingerprint },
  });

  return { id, fingerprint };
}

export async function listExpiringCertificates(days = 30) {
  const result: any = await db.execute(sql`
    SELECT *
    FROM certificates
    WHERE status = 'active'
      AND not_after IS NOT NULL
      AND not_after <= NOW() + (${days} || ' days')::interval
    ORDER BY not_after ASC
  `);

  return result.rows ?? [];
}
