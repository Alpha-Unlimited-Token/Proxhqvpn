# Trust Center Validation Model

**Version:** 1.0.0 | **Classification:** Public-facing documentation

## What the Trust Center Publishes

The public Trust Center API (`GET /api/trust-center/validation-summary`) exposes only:

| Field | Description |
|-------|-------------|
| `status` | `trusted` / `warning` / `failed` / `unknown` |
| `score` | Aggregate security posture score |
| `maxScore` | Maximum possible score (100) |
| `uptimePct` | Uptime percentage over last 24h |
| `lastValidationAt` | Timestamp of last check |
| `lastTlsCheckAt` | Timestamp of last successful TLS check |
| `environment` | Always `"production"` |
| `generatedAt` | Timestamp this summary was generated |

## What Is Never Exposed Publicly

- Raw scan output or tool findings
- Internal IP addresses, node hostnames, or WireGuard peer data
- Individual finding titles, descriptions, or remediation steps
- Target URLs or infrastructure topology
- Tool versions or scanner configuration
- Number or nature of active incidents beyond the aggregate status

## Data Freshness

The public summary is derived from `validation_trust_snapshots`, which is updated every time `GET /api/admin/validation/scorecard` is called (or automatically by the worker). The snapshot is based on real validated DB data — no synthetic values.

## Verification

Any auditor can verify the non-synthetic nature of results by:

1. Requesting database read access from the security team
2. Querying `validation_runs` directly:
   ```sql
   SELECT run_type, status, score, result_hash, started_at
   FROM validation_runs ORDER BY started_at DESC LIMIT 20;
   ```
3. Verifying hash chain continuity:
   ```sql
   SELECT result_hash, previous_hash FROM validation_runs ORDER BY started_at;
   ```
4. Confirming tool versions stored in `tool_version` column
5. Cross-referencing run timestamps against server logs

© 2026 Alpha Unlimited Technologies LLC
