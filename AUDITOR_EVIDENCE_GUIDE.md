# Auditor Evidence Guide — Continuous Validation Framework

**Version:** 1.0.0 | **Classification:** Auditor-facing | **Owner:** Alpha Unlimited Technologies LLC

---

## How Data Is Collected

Every validation result in the CVF database comes from one of:

1. **Automated scheduled runs** — `continuous-validation-worker` executes registered runners against allowlisted targets per `validation_schedules`
2. **Admin-triggered manual runs** — POST `/api/admin/validation/runs` by an authenticated admin; emits audit event
3. **No synthetic or mock data** — runners return `status=error` rather than fabricating a result when a tool is unavailable

---

## How Results Are Hashed

Each `validation_run` row contains:

```
result_hash = SHA3-256(canonical_json({
  runId, targetId, runType, toolName,
  status, score, startedAt, summary, previousHash
}))
```

`canonical_json` sorts object keys deterministically before hashing. `previous_hash` links to the previous run's `result_hash`, forming a tamper-evident chain.

**Fallback:** If Node.js `crypto.createHash("sha3-256")` is unavailable (Node < 21), the system falls back to SHA-256 and logs a warning.

---

## How to Reproduce Runs

1. Obtain a target's UUID from `validation_targets` table
2. Trigger a run via `POST /api/admin/validation/runs` with the same `runType`
3. The run will use the same tool (confirmed by `tool_version` column)
4. Compare the new run's `score` and `finding_count` to the original

---

## How to Verify Tool Versions

Every `validation_run` stores `tool_version` at the time of execution. Cross-reference with:

```bash
# uptime-runner, tls-runner, headers-runner, wireguard-validator, synthetic-runner: version "1.0.0" (built-in)
# dependency: "workspace" (pnpm audit)
# zap: execSync("zap.sh -version")
# trivy: execSync("trivy version --format json")
# semgrep: execSync("semgrep --version")
# k6: execSync("k6 version")
```

---

## How to Prove Results Are Not Mock Data

1. **Hash chain** — verify `previous_hash` links form an unbroken chain starting from `"GENESIS"`
2. **Timestamps** — `started_at` and `completed_at` are set by the database server clock (`NOW()`)
3. **`duration_ms`** — computed as `EXTRACT(EPOCH FROM (completed_at - started_at)) * 1000`; synthetic data would have uniform durations
4. **Tool-specific raw output** — `sanitized_output` in each run contains real HTTP response codes, latencies, or tool JSON; audit on request
5. **Audit log** — every manual trigger is in `audit_log_append_only` with SHA3-256 hash chain

---

## Tests That Are Internal Only

| Run Type | Public? | Reason |
|----------|---------|--------|
| `uptime` | Score only | Exposes response time distribution |
| `tls` | Score only | Certificate details are internal |
| `headers` | Score only | Header names are internal |
| `wireguard` | Score only | Node topology is private |
| `synthetic` | Score only | Endpoint structure is internal |
| `zap` | Never | Alert details could aid attackers |
| `trivy` | Never | CVE details are operational data |
| `semgrep` | Never | Code-level findings are confidential |
| `k6` | Never | Load profile reveals capacity limits |
| `dependency` | Never | Vulnerable package names are confidential |

## Summaries That Are Public-Safe

`GET /api/trust-center/validation-summary` returns only:
- Aggregate status (`trusted` / `warning` / `failed`)
- Aggregate score and max
- Uptime percentage (24h)
- Last validation and TLS check timestamps

---

## Evidence Package Request

To request a full evidence package for compliance audits (SOC 2, ISO 27001, etc.), contact:

**Security Team:** alphaunlimitedtechnologies@gmail.com  
**Include:** Audit period, scope, evidence types required

The security team will provide:
- Hash-verified export of `validation_runs` for the audit period
- Chain verification proof
- Tool version attestation
- Redacted findings summary per severity
