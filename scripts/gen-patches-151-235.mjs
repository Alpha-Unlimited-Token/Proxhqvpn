#!/usr/bin/env node
/**
 * Generates Patches 151–235: migrations, services, routes.
 * Run: node scripts/gen-patches-151-235.mjs
 */
import fs from "fs";
import path from "path";

const MIGRATIONS_DIR = "lib/db/migrations";
const SERVICES_DIR = "artifacts/api-server/src/services";
const ROUTES_DIR = "artifacts/api-server/src/routes";

// [num, slug, title, capability, ?overrideCreateFn, ?overrideListFn, ?overrideServiceFile]
const PATCHES = [
  [151,"webauthn-fido2-admin-enforcement","WebAuthn/FIDO2 admin enforcement","admin.read"],
  [152,"mfa-policy-engine","MFA policy engine","admin.read"],
  [153,"device-posture-collection","Device posture collection","admin.read"],
  [154,"endpoint-compliance-scoring","Endpoint compliance scoring","admin.read"],
  [155,"managed-device-enrollment","Managed-device enrollment","admin.read"],
  [156,"certificate-bound-device-identity","Certificate-bound device identity","admin.write"],
  [157,"admin-session-re-authentication","Admin session re-authentication","admin.write"],
  [158,"privileged-access-approval-workflow","Privileged access approval workflow","admin.write"],
  [159,"temporary-access-grants","Temporary access grants","admin.write"],
  [160,"break-glass-approval-records","Break-glass approval records","admin.write"],
  [161,"identity-provider-risk-ingestion","Identity provider risk ingestion","admin.read"],
  [162,"impossible-travel-detector-v2","Impossible-travel detector v2","admin.read"],
  [163,"user-behavior-analytics-v2","User behavior analytics v2","admin.read"],
  [164,"device-behavior-analytics-v2","Device behavior analytics v2","admin.read"],
  [165,"risk-based-access-middleware","Risk-based access middleware","admin.read"],
  [166,"tenant-level-security-policies","Tenant-level security policies","command_center.write"],
  [167,"per-tenant-login-policy","Per-tenant login policy","admin.read"],
  [168,"per-tenant-device-policy","Per-tenant device policy","admin.read"],
  [169,"admin-action-approval-queue","Admin action approval queue","admin.write"],
  [170,"privileged-command-approval","Privileged command approval","admin.write"],
  [171,"session-recording-metadata","Session recording metadata","admin.read"],
  [172,"admin-activity-timeline","Admin activity timeline","admin.read"],
  [173,"user-access-review-workflow","User access review workflow","admin.read"],
  [174,"dormant-account-detection","Dormant account detection","admin.read"],
  [175,"identity-governance-dashboard-backend","Identity governance dashboard backend","admin.read"],
  [176,"sd-wan-policy-foundation","SD-WAN policy foundation","admin.write"],
  [177,"traffic-steering-policy-engine","Traffic steering policy engine","admin.write"],
  [178,"qos-classification","QoS classification","admin.write"],
  [179,"bandwidth-priority-classes","Bandwidth priority classes","admin.write"],
  [180,"regional-route-restrictions-v2","Regional route restrictions v2","admin.write"],
  [181,"multi-cloud-gateway-registry","Multi-cloud gateway registry","admin.read"],
  [182,"edge-gateway-lifecycle","Edge gateway lifecycle","admin.read"],
  [183,"bgp-automation-adapter","BGP automation adapter","admin.read"],
  [184,"dynamic-route-advertisements","Dynamic route advertisements","admin.read"],
  [185,"route-health-telemetry","Route health telemetry","admin.read"],
  [186,"route-optimization-v2","Route optimization v2","admin.read"],
  [187,"multi-hop-route-scoring","Multi-hop route scoring","admin.read"],
  [188,"per-app-route-policy","Per-app route policy","admin.read"],
  [189,"per-tenant-vpn-policy","Per-tenant VPN policy","admin.read"],
  [190,"vpn-session-ledger","VPN session ledger","admin.read"],
  [191,"tunnel-replay-protection","Tunnel replay protection","admin.read"],
  [192,"key-rotation-scheduler","Key rotation scheduler","admin.read"],
  [193,"node-certificate-rotation","Node certificate rotation","admin.read"],
  [194,"node-to-node-trust-graph","Node-to-node trust graph","admin.read"],
  [195,"node-drift-detection","Node drift detection","admin.read"],
  [196,"node-auto-repair-worker","Node auto-repair worker","admin.read"],
  [197,"node-replacement-planner","Node replacement planner","admin.read"],
  [198,"fleet-capacity-planner-v2","Fleet capacity planner v2","admin.read"],
  [199,"global-network-topology-api","Global network topology API","admin.read"],
  [200,"network-operations-dashboard-backend","Network operations dashboard backend","admin.read"],
  [201,"opentelemetry-backend-tracing","OpenTelemetry backend tracing","admin.read"],
  [202,"opentelemetry-frontend-tracing","OpenTelemetry frontend tracing","admin.read"],
  [203,"service-dependency-map","Service dependency map","admin.read"],
  [204,"request-latency-slos","Request latency SLOs","admin.read"],
  [205,"api-error-budget-engine","API error budget engine","admin.read"],
  [206,"uptime-monitor-registry","Uptime monitor registry","admin.read"],
  [207,"synthetic-monitoring-jobs","Synthetic monitoring jobs","admin.read"],
  [208,"regional-health-checks","Regional health checks","admin.read"],
  [209,"alert-routing-policies","Alert routing policies","admin.read"],
  [210,"pager-webhook-notification-adapter","Pager/webhook notification adapter","admin.read"],
  [211,"incident-lifecycle-service","Incident lifecycle service","command_center.write","createIncidentLifecycle","listIncidentLifecycle","incidentLifecycleServiceService"],
  [212,"incident-postmortem-service","Incident postmortem service","command_center.write","createIncidentPostmortem","listIncidentPostmortem","incidentPostmortemServiceService"],
  [213,"sla-reporting","SLA reporting","admin.read"],
  [214,"slo-dashboard-backend","SLO dashboard backend","admin.read"],
  [215,"infrastructure-event-normalization","Infrastructure event normalization","admin.read"],
  [216,"fleet-health-timeline","Fleet health timeline","admin.read"],
  [217,"log-correlation-ids-everywhere","Log correlation IDs everywhere","admin.read"],
  [218,"distributed-trace-search","Distributed trace search","admin.read"],
  [219,"slow-query-detector","Slow query detector","admin.read"],
  [220,"database-health-score","Database health score","admin.read"],
  [221,"queue-lag-score","Queue lag score","admin.read"],
  [222,"worker-health-score","Worker health score","admin.read"],
  [223,"release-health-score","Release health score","admin.read"],
  [224,"operational-readiness-dashboard","Operational readiness dashboard","admin.read"],
  [225,"sre-weekly-report-generator","SRE weekly report generator","admin.read"],
  [226,"ai-soc-analyst-service-interface","AI SOC analyst service interface","command_center.write","createAiSocAnalystInterface","listAiSocAnalystInterface","aiSocAnalystServiceInterfaceService"],
  [227,"incident-summarizer","Incident summarizer","command_center.write"],
  [228,"alert-deduplication-engine","Alert deduplication engine","command_center.write"],
  [229,"alert-clustering","Alert clustering","command_center.write"],
  [230,"root-cause-analysis-engine","Root-cause analysis engine","command_center.write"],
  [231,"threat-hunting-query-builder","Threat hunting query builder","command_center.write"],
  [232,"threat-hunting-scheduler","Threat hunting scheduler","command_center.write"],
  [233,"auto-triage-rules","Auto-triage rules","command_center.write"],
  [234,"ai-generated-investigation-timeline","AI-generated investigation timeline","command_center.write"],
  [235,"ai-playbook-recommendation","AI playbook recommendation","command_center.write"],
];

/** slug → PascalCase */
function toPascal(slug) {
  return slug.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join("");
}

/** Generate files for one patch */
function generatePatch([num, slug, title, capability, overrideCreate, overrideList, overrideServiceFile]) {
  const pascal = toPascal(slug);
  const serviceFile = overrideServiceFile ?? `${pascal.charAt(0).toLowerCase()}${pascal.slice(1)}Service`;
  const inputType = `${pascal}ServiceInput`;
  const createFn = overrideCreate ?? `create${pascal}`;
  const listFn   = overrideList   ?? `list${pascal}`;
  const tableName = `patch_${num}_${slug.replace(/-/g, "_")}`;
  const idxPrefix = `idx_${tableName}`;
  const numStr    = String(num);
  const eventType = `patch.${num}.${slug}.created`;

  // ── Migration ──────────────────────────────────────────────────────────────
  const migration = `-- Patch ${num}: ${title}
CREATE TABLE IF NOT EXISTS ${tableName} (
  id UUID PRIMARY KEY,
  tenant_id UUID,
  user_id TEXT,
  subject TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ${idxPrefix}_tenant_status
  ON ${tableName}(tenant_id, status);

CREATE INDEX IF NOT EXISTS ${idxPrefix}_user_created
  ON ${tableName}(user_id, created_at DESC);
`;

  // ── Service ────────────────────────────────────────────────────────────────
  const service = `import { randomUUID } from "crypto";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { publishPlatformEvent } from "../lib/event-bus";
import { writeAuditEvent } from "../repositories/auditRepository";

export type ${inputType} = {
  tenantId?: string | null;
  userId?: string | null;
  subject?: string | null;
  createdBy?: string | null;
  metadata?: Record<string, unknown>;
};

export async function ${createFn}(
  input: ${inputType},
) {
  const id = randomUUID();

  await db.execute(sql\`
    INSERT INTO ${tableName}
      (id, tenant_id, user_id, subject, metadata, created_by)
    VALUES
      (\${id}, \${input.tenantId ?? null}, \${input.userId ?? null}, \${input.subject ?? null}, \${JSON.stringify(input.metadata ?? {})}::jsonb, \${input.createdBy ?? null})
  \`);

  await publishPlatformEvent({
    type: "${eventType}",
    actor: input.createdBy ?? input.userId ?? undefined,
    subject: input.subject ?? id,
    severity: "info",
    payload: { id, patch: ${numStr}, title: "${title}" },
  });

  await writeAuditEvent({
    actor: input.createdBy ?? input.userId ?? "system",
    action: "${eventType}",
    resource: "${slug}",
    result: "allow",
    metadata: { id, ...input.metadata },
  });

  return { id };
}

export async function ${listFn}(
  input: { tenantId?: string | null; userId?: string | null; limit?: number } = {},
) {
  const result: any = await db.execute(sql\`
    SELECT *
    FROM ${tableName}
    WHERE (\${input.tenantId ?? null} IS NULL OR tenant_id = \${input.tenantId ?? null})
      AND (\${input.userId ?? null} IS NULL OR user_id = \${input.userId ?? null})
    ORDER BY created_at DESC
    LIMIT \${input.limit ?? 100}
  \`);

  return result.rows ?? [];
}
`;

  // ── Route ──────────────────────────────────────────────────────────────────
  const route = `import { Router } from "express";
import { z } from "zod";
import { getAuth } from "@clerk/express";
import { asyncHandler } from "../middlewares/asyncHandler";
import {
  validateRequest,
  getValidatedBody,
  getValidatedQuery,
} from "../middlewares/validateRequest";
import {
  ${createFn},
  ${listFn},
} from "../services/${serviceFile}";

const router = Router();

const createSchema = z.object({
  tenantId: z.string().uuid().nullable().optional(),
  userId: z.string().nullable().optional(),
  subject: z.string().nullable().optional(),
  metadata: z.record(z.unknown()).default({}),
});

const listSchema = z.object({
  tenantId: z.string().uuid().nullable().optional(),
  userId: z.string().nullable().optional(),
  limit: z.coerce.number().min(1).max(500).default(100),
});

router.post(
  "/",
  validateRequest({ body: createSchema }),
  asyncHandler(async (req, res) => {
    const body = getValidatedBody<typeof createSchema>(req);
    const { userId } = getAuth(req);

    const result = await ${createFn}({
      ...body,
      createdBy: userId ?? "system",
    });

    res.status(201).json(result);
  }),
);

router.get(
  "/",
  validateRequest({ query: listSchema }),
  asyncHandler(async (req, res) => {
    const query = getValidatedQuery<typeof listSchema>(req);
    res.json({ items: await ${listFn}(query) });
  }),
);

export default router;
`;

  return { num, slug, pascal, title, capability, serviceFile, createFn, listFn, migration, service, route };
}

// ── Main ─────────────────────────────────────────────────────────────────────

const patches = PATCHES.map(generatePatch);

// Write migration, service, route files
for (const p of patches) {
  const migPath = path.join(MIGRATIONS_DIR, `${p.num}_${p.slug.replace(/-/g,"_")}.sql`);
  const svcPath = path.join(SERVICES_DIR, `${p.serviceFile}.ts`);
  const rtPath  = path.join(ROUTES_DIR, `${p.slug}.ts`);

  if (!fs.existsSync(migPath)) fs.writeFileSync(migPath, p.migration, "utf8");
  if (!fs.existsSync(svcPath)) fs.writeFileSync(svcPath, p.service, "utf8");
  if (!fs.existsSync(rtPath))  fs.writeFileSync(rtPath, p.route, "utf8");
}

console.log(`✅ Generated ${patches.length} migration/service/route files`);

// ── Append to services/index.ts ──────────────────────────────────────────────
const indexPath = "artifacts/api-server/src/services/index.ts";
const existingIndex = fs.readFileSync(indexPath, "utf8");
const newExports = patches
  .filter(p => !existingIndex.includes(`./${p.serviceFile}`))
  .map(p => `export * from "./${p.serviceFile}";`)
  .join("\n");

if (newExports) {
  fs.appendFileSync(indexPath, "\n" + newExports + "\n", "utf8");
  console.log(`✅ Appended ${patches.filter(p => !existingIndex.includes(`./${p.serviceFile}`)).length} exports to services/index.ts`);
}

// ── Append imports + registerAdminRoute calls to admin.ts ────────────────────
const adminPath = "artifacts/api-server/src/routes/groups/admin.ts";
let adminContent = fs.readFileSync(adminPath, "utf8");

const importLines = patches
  .filter(p => !adminContent.includes(`from "../${p.slug}"`))
  .map(p => `import ${p.slug.replace(/-/g,"")}Router from "../${p.slug}";`)
  .join("\n");

const mountLines = patches
  .filter(p => !adminContent.includes(`"/${p.slug}"`))
  .map(p => `registerAdminRoute(router, "/${p.slug}", "${p.capability}", highRiskRateLimit, ${p.slug.replace(/-/g,"")}Router);`)
  .join("\n");

if (importLines) {
  // Insert imports before the blank line + `const router = Router();`
  adminContent = adminContent.replace(
    /(\nconst router = Router\(\);)/,
    `\n${importLines}$1`
  );
}

if (mountLines) {
  adminContent = adminContent.replace(
    /\nexport default router;/,
    `\n${mountLines}\n\nexport default router;`
  );
}

fs.writeFileSync(adminPath, adminContent, "utf8");
console.log("✅ Updated admin.ts");

// ── Append to routeCapabilities.ts ───────────────────────────────────────────
const capPath = "artifacts/api-server/src/routes/routeCapabilities.ts";
let capContent = fs.readFileSync(capPath, "utf8");

const capLines = patches
  .filter(p => !capContent.includes(`"/${p.slug}"`))
  .map(p => `  { mountPath: "/${p.slug}", capability: "${p.capability}" },`)
  .join("\n");

if (capLines) {
  capContent = capContent.replace(
    /(\n];)/,
    `\n${capLines}$1`
  );
  fs.writeFileSync(capPath, capContent, "utf8");
  console.log("✅ Updated routeCapabilities.ts");
}

console.log("🎉 Patches 151–235 generation complete.");
