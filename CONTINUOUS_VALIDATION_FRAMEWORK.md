# ProxhqVPN Continuous Validation Framework

**Version:** 1.0.0 | **Owner:** Alpha Unlimited Technologies LLC | **Classification:** Internal

---

## Overview

The Continuous Validation Framework (CVF) runs automated security, infrastructure, VPN, uptime, and performance checks against ProxhqVPN-owned systems on a continuous schedule. All results are stored in PostgreSQL, hash-chained for tamper evidence, and exposed via admin APIs and a public Trust Center summary.

**Key guarantees:**

- Only ProxhqVPN-owned assets are tested — never third-party IPs or customer systems
- All targets require explicit allowlisting in `validation_targets`
- Security scans require `allow_security_scans=true` per target
- Load tests require `allow_load_tests=true` per target
- Every result is SHA3-256 hash-chained to the previous run
- Raw output is sanitized before storage (secrets/keys redacted)
- Public Trust Center API exposes only a safe summary — no raw findings

---

## Database Schema

| Table | Purpose |
|-------|---------|
| `validation_targets` | Allowlisted ProxhqVPN-owned targets |
| `validation_runs` | Individual test run results with hash chain |
| `validation_findings` | Individual findings from runs |
| `validation_schedules` | Scheduled run intervals per target/type |
| `validation_trust_snapshots` | Periodic scorecard snapshots |

---

## Validation Runner Types

| Run Type | Tool | Requires External Tool |
|----------|------|----------------------|
| `uptime` | Built-in HTTP | No |
| `tls` | Built-in TLS | No |
| `headers` | Built-in HTTP | No |
| `wireguard` | DB query | No |
| `synthetic` | Built-in HTTP | No |
| `dependency` | pnpm audit | No (pnpm available) |
| `zap` | OWASP ZAP | Yes — install zaproxy |
| `trivy` | Trivy | Yes — install trivy |
| `semgrep` | Semgrep | Yes — pip install semgrep |
| `k6` | Grafana k6 | Yes — install k6 |

Runners for external tools return `status=error` with install instructions if the tool is not available — they never silently skip.

---

## Worker

The `continuous-validation-worker` processes due schedules every 60 seconds.

**Enable with:**
```bash
PROXHQ_ENABLE_CONTINUOUS_VALIDATION=1
```

The worker uses `clusterSingleton=true` to prevent double-execution in multi-instance deployments.

---

## Hash Chain

Every `validation_run` record includes:

- `result_hash` — SHA3-256 of canonical `{ runId, targetId, runType, toolName, status, score, startedAt, summary, previousHash }`
- `previous_hash` — the `result_hash` of the last completed run

To verify integrity:
```sql
SELECT id, run_type, result_hash, previous_hash, started_at
FROM validation_runs
ORDER BY started_at;
```

---

## API Endpoints

All validation API routes require admin authentication (`admin.read` / `admin.write` capabilities via Clerk).

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/validation/targets` | List allowlisted targets |
| POST | `/api/admin/validation/targets` | Register new target |
| GET | `/api/admin/validation/runs` | List runs (filter by type/status) |
| GET | `/api/admin/validation/runs/:id` | Get single run with hash |
| POST | `/api/admin/validation/runs` | Trigger manual run |
| GET | `/api/admin/validation/findings` | List open findings |
| POST | `/api/admin/validation/findings/:id/resolve` | Resolve a finding |
| GET | `/api/admin/validation/scorecard` | Current trust scorecard |
| GET | `/api/admin/validation/trust-snapshot` | Snapshot history |
| POST | `/api/admin/validation/schedules` | Create schedule |
| GET | `/api/trust-center/validation-summary` | **Public** — safe summary only |

---

## Scorecard Composition

| Metric | Max Score | Degrades When |
|--------|-----------|---------------|
| Uptime | 20 | < 99% uptime in 24h |
| TLS/Certificate | 15 | TLS check fails or cert expires < 30d |
| Security Scans | 25 | Critical/high findings in last 7d |
| WireGuard Nodes | 25 | < 90% nodes healthy in last hour |

Status mapping: ≥90% → `trusted` | ≥70% → `warning` | <70% → `failed`
