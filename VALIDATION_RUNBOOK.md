# Validation Framework Runbook

**Version:** 1.0.0 | **Owner:** Alpha Unlimited Technologies LLC Security Team

---

## Initial Setup

### 1. Apply the database migration

```bash
# Via the migration script (idempotent):
cd lib/db && DATABASE_URL=$DATABASE_URL tsx ../../scripts/src/migrate.ts

# Or run the SQL directly:
psql $DATABASE_URL < lib/db/migrations/301_continuous_validation_framework.sql
```

### 2. Seed default targets

```bash
DATABASE_URL=$DATABASE_URL pnpm run validation:seed
```

### 3. Enable the continuous validation worker

Set the environment variable in your deployment:
```
PROXHQ_ENABLE_CONTINUOUS_VALIDATION=1
```

The worker will then process due `validation_schedules` every 60 seconds.

### 4. Create your first schedule (via UI or API)

```bash
# Via API (requires admin Clerk session):
curl -X POST /api/admin/validation/schedules \
  -H "Content-Type: application/json" \
  -d '{"targetId":"<uuid>","runType":"uptime","intervalMinutes":5}'
```

---

## Running a One-Off Check

```bash
# Via CLI script:
pnpm run validation:run -- --run-type uptime --target-name proxhqvpn-homepage

# Via API:
curl -X POST /api/admin/validation/runs \
  -H "Content-Type: application/json" \
  -d '{"targetId":"<uuid>","runType":"tls"}'
# Returns: { "runId": "...", "status": "queued" }

# Poll for result:
curl /api/admin/validation/runs/<runId>
```

---

## Exporting a Report

```bash
pnpm run validation:export
# Writes: VALIDATION_REPORT.json and VALIDATION_REPORT.md
```

---

## Verifying Hash Chain Integrity

```sql
-- Check chain continuity (previous_hash of run N should match result_hash of run N-1):
SELECT
  id,
  run_type,
  result_hash,
  previous_hash,
  started_at
FROM validation_runs
ORDER BY started_at
LIMIT 50;
```

---

## Adding a New Target

1. POST `/api/admin/validation/targets` with `owned_by` set
2. To enable security scans: `allow_security_scans: true` (ZAP/trivy/semgrep)
3. To enable load tests: `allow_load_tests: true` (k6)
4. **Verify ownership** before enabling security scans

---

## Installing Optional External Tools

### OWASP ZAP
```bash
snap install zaproxy --classic
# or: download from https://www.zaproxy.org/download/
```

### Trivy
```bash
apt-get install trivy
# or: curl -sfL https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/install.sh | sh
```

### Semgrep
```bash
pip install semgrep
```

### k6
```bash
snap install k6
# or: https://grafana.com/docs/k6/latest/get-started/installation/
```

---

## Resolving Findings

```bash
# Via API:
curl -X POST /api/admin/validation/findings/<id>/resolve

# Via dashboard: Validation → Findings tab → Resolve button
```

---

## Alerts and SIEM

Manual validation runs emit a SIEM event via `shipSecurityEvent()`. Platform events are published via `publishPlatformEvent("validation.run.completed")`. Connect your SIEM webhook via `SIEM_WEBHOOK_URL` env var.
