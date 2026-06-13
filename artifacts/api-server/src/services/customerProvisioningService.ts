// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { createTenant } from "./tenantService";
import { createBillingAccount } from "./billingService";
import { createLicense } from "./licenseService";
import { publishPlatformEvent } from "../lib/event-bus";

export async function provisionCustomer(input: {
  name: string;
  slug: string;
  ownerUserId: string;
  billingEmail?: string | null;
  licenseKey?: string | null;
  plan?: string;
}) {
  const tenant = await createTenant({
    name: input.name,
    slug: input.slug,
    createdBy: input.ownerUserId,
  });

  const billing = await createBillingAccount({
    tenantId: tenant.tenantId,
    userId: input.ownerUserId,
    billingEmail: input.billingEmail,
  });

  let license: { id: string } | null = null;

  if (input.licenseKey) {
    license = await createLicense({
      tenantId: tenant.tenantId,
      userId: input.ownerUserId,
      licenseKey: input.licenseKey,
      plan: input.plan ?? "enterprise",
    });
  }

  await publishPlatformEvent({
    type: "customer.provisioned",
    actor: input.ownerUserId,
    subject: tenant.tenantId,
    severity: "info",
    payload: {
      billingAccountId: billing.id,
      licenseId: license?.id ?? null,
      plan: input.plan ?? "enterprise",
    },
  });

  return {
    tenantId: tenant.tenantId,
    billingAccountId: billing.id,
    licenseId: license?.id ?? null,
  };
}
