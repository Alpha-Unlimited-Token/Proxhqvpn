# Parrot OS Tool Library — Feature Map
## © 2026 Alpha Unlimited Technologies LLC

**Version:** 2.0 (post-audit hardening)  
**Last Updated:** 2026-06-11

---

## Architecture Overview

```
ghost-vpn (React+Vite)           api-server (Express 5)           PostgreSQL
─────────────────────────────    ──────────────────────────────   ─────────────────
/tool-runner      → ToolRunner   POST /api/tool-runner/run        tool_jobs
/tool-history     → ToolHistory  GET  /api/tool-runner/history    tool_outputs
/tool-scope       → ToolScope    GET/POST /api/tool-runner/scopes tool_target_scopes
/scan-scheduler   → ScanSched    GET/POST /api/tool-runner/sched  tool_jobs (scheduled)
/tool-approvals   → ToolApprovals GET/POST /api/tool-runner/approvals tool_approvals
/node-health      → NodeHealth   GET  /api/tool-runner/node-agents node_agent_health
                                 POST /api/node-agent/checkin      node_agent_events
```

---

## Tool Registry (19 tools post-hardening)

### Network Scanning
| Tool | Binary | Modes | Timeout | Risk |
|------|--------|-------|---------|------|
| Nmap | nmap | quick/default/version/vuln/full/ping/udp | 120s | HIGH (vuln/full require approval) |

### Vulnerability Scanning
| Tool | Binary | Modes | Timeout | Risk |
|------|--------|-------|---------|------|
| Nuclei | nuclei | exposures/cves/vulns/misconfig/default-logins/tech/network | 180s | HIGH (cves/vulnerabilities require approval) |

### Injection Testing
| Tool | Binary | Levels | Timeout | Risk |
|------|--------|--------|---------|------|
| SQLMap | python3 (sqlmap) | 1-5 / risk 1-3 | 180s | HIGH (level≥2 require approval) |

### Fuzzing
| Tool | Binary | Modes | Timeout | Risk |
|------|--------|-------|---------|------|
| ffuf | ffuf | dir/param/vhost/post | 120s | MEDIUM |
| Gobuster | gobuster | dir/dns/vhost | 120s | MEDIUM |
| Feroxbuster | feroxbuster | recursive | 180s | HIGH (depth≥3 require approval) |

### Subdomain Enumeration
| Tool | Binary | Options | Timeout | Risk |
|------|--------|---------|---------|------|
| Subfinder | subfinder | all-sources toggle | 120s | LOW |

### HTTP Probing
| Tool | Binary | Modes | Timeout | Risk |
|------|--------|-------|---------|------|
| httpx | httpx | standard/full/screenshot/cdn | 60s | LOW |

### DNS
| Tool | Binary | Record Types | Timeout | Risk |
|------|--------|-------------|---------|------|
| dig | dig | ANY/A/AAAA/MX/TXT/NS/CNAME/PTR/SOA/AXFR | 30s | LOW |

### SSL/TLS
| Tool | Binary | Modes | Timeout | Risk |
|------|--------|-------|---------|------|
| OpenSSL | openssl | cert/chain/ciphers/tls13/tls12/tls11 | 30s | LOW |

### HTTP Client
| Tool | Binary | Methods | Timeout | Risk |
|------|--------|---------|---------|------|
| cURL | curl | GET/POST/PUT/DELETE/HEAD/OPTIONS/PATCH | 30s | LOW |

### OSINT
| Tool | Binary | Options | Timeout | Risk |
|------|--------|---------|---------|------|
| WHOIS | whois | custom resolver | 20s | LOW |

### Network
| Tool | Binary | Options | Timeout | Risk |
|------|--------|---------|---------|------|
| Ping | ping | count/size | 30s | LOW |
| Traceroute | traceroute | max-hops | 60s | LOW |

### Password Attacks (NEW)
| Tool | Binary | Modes | Timeout | Risk |
|------|--------|-------|---------|------|
| Hydra | hydra | SSH/FTP/HTTP-POST/RDP | 120s | HIGH (requires scope) |
| John the Ripper | john | wordlist/incremental | 120s | MEDIUM |

### Forensics & DFIR (NEW)
| Tool | Binary | Modes | Timeout | Risk |
|------|--------|-------|---------|------|
| Volatility 3 | vol | info/psscan/netscan/cmdline | 120s | LOW |
| Binwalk | binwalk | scan/extract/entropy | 60s | LOW |

### Cryptography (NEW)
| Tool | Binary | Modes | Timeout | Risk |
|------|--------|-------|---------|------|
| GPG | gpg | sign/verify/encrypt/decrypt/keyinfo | 30s | LOW |
| Hashcat | hashcat | benchmark/hash-identify | 60s | MEDIUM |

### Stress Testing (NEW)
| Tool | Binary | Modes | Timeout | Risk |
|------|--------|-------|---------|------|
| hping3 | hping3 | ping/syn/udp/count | 60s | HIGH (requires scope) |
| Slowhttptest | slowhttptest | slowloris/slowbody/slowread | 60s | HIGH (requires approval) |

---

## Security Controls Map

### Target Validation Pipeline
```
POST /run
  │
  ├─ 1. SSRF Block — reject RFC1918, loopback, link-local, cloud metadata
  ├─ 2. Scope Check — target must match a user's registered tool_target_scope
  ├─ 3. High-Risk Approval Check — if REQUIRES_APPROVAL → create tool_approvals, return 202
  ├─ 4. GeoIP Enrichment — resolve target IP → country/ASN/city via geoip-lite
  ├─ 5. Concurrency Check — reject if user already has ≥3 active jobs
  ├─ 6. Field Validation — Zod schema + numeric clamping
  ├─ 7. Audit Log — appendAuditEvent({ actor, action: "tool_runner.run", resource: toolId })
  └─ 8. DB Persist — insert into tool_jobs
```

### Approval Workflow
```
High-risk tool run →
  tool_approvals INSERT (status: pending) →
    Admin notified (SIEM event) →
      GET /tool-runner/approvals (admin sees queue) →
        POST /approve|reject →
          If approved: job is created and returns jobId
          If rejected: user sees rejection reason
```

### Node Agent Architecture
```
Remote Parrot OS node →
  POST /api/node-agent/checkin (PSK: NODE_AGENT_PSK) →
    node_agent_health UPSERT (nodeId, version, ip, os, tools) →
      node_agent_events INSERT →
        GET /api/tool-runner/node-agents (admin view) →
          NodeHealth page shows live status grid
```

---

## Database Tables

| Table | Purpose | PK | Key Columns |
|-------|---------|-----|-------------|
| tool_jobs | Persisted scan job records | uuid | user_id, tool_id, target, status, exit_code, geo_json |
| tool_outputs | Chunked output storage | serial | job_id, chunk_index, text |
| tool_target_scopes | User-declared scan scopes | serial | user_id, scope_type, scope_value, approved_by |
| tool_approvals | Pending high-risk approvals | uuid | job_id, user_id, tool_id, target, status, risk_level |
| node_agent_health | Node agent check-in records | text (node_id) | version, ip, os, tools_json, last_seen_at |
| node_agent_events | Node agent events | serial | node_id, event_type, payload |

---

## Frontend Pages Map

| Route | Component | Auth Required | Description |
|-------|-----------|---------------|-------------|
| /tool-runner | ToolRunner | CommandCenter | Main tool run UI (existing, hardened) |
| /tool-history | ToolHistory | CommandCenter | Paginated job history with output viewer |
| /tool-scope | ToolScope | CommandCenter | Manage scan target allowlist |
| /scan-scheduler | ScanScheduler | CommandCenter | Schedule recurring scans |
| /tool-approvals | ToolApprovals | Admin only | Review and act on pending approvals |
| /node-health | NodeHealth | CommandCenter | Remote node agent status grid |
| /parrot-tools | ParrotTools | Basic | Static Parrot OS tool catalog (existing) |

---

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/tool-runner/tools | CC | List tools with install status |
| POST | /api/tool-runner/run | CC | Start a tool run |
| GET | /api/tool-runner/stream/:jobId | CC | SSE live output stream |
| DELETE | /api/tool-runner/kill/:jobId | CC | Kill running job |
| GET | /api/tool-runner/jobs | CC | List active in-process jobs |
| GET | /api/tool-runner/history | CC | Paginated DB job history |
| GET | /api/tool-runner/history/:jobId | CC | Single job detail + output |
| GET | /api/tool-runner/scopes | CC | List user's target scopes |
| POST | /api/tool-runner/scopes | CC | Add a target scope |
| DELETE | /api/tool-runner/scopes/:id | CC | Remove a target scope |
| GET | /api/tool-runner/approvals | Admin | List pending approvals |
| POST | /api/tool-runner/approvals/:id/approve | Admin | Approve a scan request |
| POST | /api/tool-runner/approvals/:id/reject | Admin | Reject a scan request |
| GET | /api/tool-runner/node-agents | CC | List node agent health records |
| POST | /api/tool-runner/evidence/:jobId | CC | Export evidence ZIP |
| POST | /api/node-agent/checkin | PSK | Node agent check-in (public/PSK) |
