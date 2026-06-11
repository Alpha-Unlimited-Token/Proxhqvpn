---
name: daemon-inbound per-node HMAC pattern
description: How daemon-inbound.ts authenticates node callbacks using per-node HMAC-SHA256 with replay protection.
---

## The Rule
`daemon-inbound.ts` uses `verifyDaemonHmac()` from `lib/daemon-auth.ts` as the primary auth method.
The shared `DAEMON_PSK` is kept as a legacy fallback for nodes that predate this upgrade.

**Why:** Single shared PSK had no node identity, no replay protection, no body signature — critical audit finding. `verifyDaemonHmac()` provides per-node identity, timestamp window (5 min), nonce dedup, and body hash over a canonical string.

**How to apply:**
- Routing: if `X-Node-ID` header is present → use `perNodeHmacMiddleware`; else → fall back to DAEMON_PSK.
- Node lookup: `getNodeSecret(nodeId)` callback queries `nodesTable.daemonSecret` by `nodesTable.name = nodeId`.
- Secret generation: `crypto.randomBytes(32).toString("hex")` at node creation time, stored in `nodes.daemon_secret` column.
- Required headers for per-node auth: `X-Node-ID`, `X-Daemon-TS` (epoch ms), `X-Daemon-Nonce` (≥16 chars), `X-Daemon-Signature` (base64url HMAC-SHA256).
- Canonical string: `METHOD\nURL\nTIMESTAMP_MS\nNONCE\nSHA256(body)` joined with newlines.
- Raw body buffering: server must have `express.json({ verify: (req, _, buf) => { req.rawBody = buf; } })` for body hash to work.
