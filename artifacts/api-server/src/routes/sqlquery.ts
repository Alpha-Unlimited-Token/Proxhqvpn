// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Router } from "express";
import crypto from "crypto";
import { pool } from "@workspace/db";
import { z } from "zod";
import { Pool as PgPool, type PoolConfig } from "pg";
import { checkSsrfPostgres } from "../lib/ssrfGuard";

const router = Router();

// ─── Local DB: SELECT-only safeguards ────────────────────────────────────────
const READONLY_RE   = /^\s*(select|with|explain|show|describe|\\\w)/i;
const BLOCKED_LOCAL = /\b(insert|update|delete|drop|truncate|alter|create|grant|revoke|exec|execute|call|pg_read_file|pg_ls_dir|lo_import|lo_export|copy)\b/i;

// MySQL version-conditional comments (/*!50001 ... */) can hide payloads that
// bypass keyword filters on non-MySQL databases if left intact.
// We strip all comment styles before analysis: --, /**/, and /*!...*/.
function stripSqlComments(q: string): string {
  return q
    .replace(/\/\*![\s\S]*?\*\//g, " ")   // MySQL conditional: /*!50001 payload */
    .replace(/\/\*[\s\S]*?\*\//g, " ")     // Block comments: /* ... */
    .replace(/--[^\n]*/g, " ")             // Line comments: -- comment
    .replace(/#[^\n]*/g, " ")              // MySQL hash comments: # comment
    .replace(/\s+/g, " ")
    .trim();
}

// MySQL inline-comment obfuscation: keywords split by /**/ e.g. SE/**/LECT
const MYSQL_INLINE_COMMENT_INJECTION_RE = /\b\w+\/\*\*?\/\w+\b/;

function hasInlineCommentInjection(q: string): boolean {
  return MYSQL_INLINE_COMMENT_INJECTION_RE.test(q);
}

// ─── External connection pool store ──────────────────────────────────────────
interface ExtConn {
  id: string;
  label: string;
  pgPool: PgPool;
  connString: string;
  dbType: string;
  connectedAt: string;
  queryCount: number;
  lastUsed: string;
}

const extConns = new Map<string, ExtConn>();

function maskConnString(s: string): string {
  return s.replace(/\/\/([^:@]+):([^@]+)@/, "//$1:****@");
}

// ─── C-3: SIGTERM/SIGINT cleanup — drain all external pool connections ────────
async function cleanupAllExtConns(): Promise<void> {
  for (const conn of extConns.values()) {
    await conn.pgPool.end().catch(() => {});
  }
  extConns.clear();
}

process.once("SIGTERM", () => { void cleanupAllExtConns(); });
process.once("SIGINT",  () => { void cleanupAllExtConns(); });

// ─── LOCAL DB QUERY ───────────────────────────────────────────────────────────
router.post("/query", async (req, res) => {
  const body = z.object({
    query: z.string().max(4000),
    limit: z.number().max(1000).optional().default(100),
  }).parse(req.body);

  // Detect inline-comment obfuscation on raw input BEFORE stripping (e.g. SE/**/LECT)
  if (hasInlineCommentInjection(body.query)) {
    return res.json({
      query: body.query, rows: [], columns: [], rowCount: 0, executionTimeMs: 0,
      error: "Inline comment injection pattern detected in query.",
    });
  }

  const query = stripSqlComments(body.query.trim());
  const start = Date.now();

  if (!READONLY_RE.test(query)) {
    return res.json({
      query, rows: [], columns: [], rowCount: 0, executionTimeMs: 0,
      error: "Only SELECT queries are permitted on the local database. Use an external connection for write operations.",
    });
  }

  if (BLOCKED_LOCAL.test(query)) {
    return res.json({
      query, rows: [], columns: [], rowCount: 0, executionTimeMs: 0,
      error: "Blocked keyword detected in local-DB query.",
    });
  }

  const limitedQuery = /\blimit\b/i.test(query) ? query : `${query} LIMIT ${body.limit}`;

  try {
    const result = await pool.query(limitedQuery);
    res.json({ query: limitedQuery, rows: result.rows, columns: result.fields.map(f => f.name), rowCount: result.rows.length, executionTimeMs: Date.now() - start });
  } catch (err: any) {
    res.json({ query: limitedQuery, rows: [], columns: [], rowCount: 0, executionTimeMs: Date.now() - start, error: err.message });
  }
});

// ─── CONNECT to external PostgreSQL ──────────────────────────────────────────
router.post("/connect", async (req, res) => {
  const body = z.object({
    connectionString: z.string().min(10).max(1000),
    label: z.string().max(80).optional().default("External DB"),
    dbType: z.enum(["postgresql", "mysql", "sqlite"]).optional().default("postgresql"),
    ssl: z.boolean().optional().default(false),
  }).parse(req.body);

  const id = crypto.randomUUID().replace(/-/g, "").slice(0, 16);

  // Enforce connection limit
  if (extConns.size >= 10) {
    return res.status(429).json({ error: "Max 10 external connections. Disconnect one first." });
  }

  if (body.dbType !== "postgresql") {
    return res.status(400).json({ error: `${body.dbType} connections are not yet supported. Only PostgreSQL connection strings are supported (postgresql://user:pass@host:5432/db).` });
  }

  // SSRF Protection: reject connection strings that point to internal/metadata IPs
  const ssrf = await checkSsrfPostgres(body.connectionString);
  if (ssrf.blocked) {
    return res.status(403).json({ error: `SSRF blocked: ${ssrf.reason}` });
  }

  let pgPool: PgPool;
  try {
    const cfg: PoolConfig = {
      connectionString: body.connectionString,
      max: 3,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    };
    if (body.ssl) {
      // Default: verify the server certificate to prevent MitM attacks.
      // rejectUnauthorized is intentionally set to true. If the user's DB
      // uses a self-signed cert they must pass allowSelfSigned: true explicitly.
      (cfg as any).ssl = { rejectUnauthorized: !(body as any).allowSelfSigned };
    }
    pgPool = new PgPool(cfg);

    // Test the connection
    const client = await pgPool.connect();
    await client.query("SELECT 1");
    client.release();
  } catch (err: any) {
    return res.status(400).json({ error: `Connection failed: ${err.message}` });
  }

  const conn: ExtConn = {
    id,
    label: body.label ?? "External DB",
    pgPool,
    connString: maskConnString(body.connectionString),
    dbType: body.dbType,
    connectedAt: new Date().toISOString(),
    queryCount: 0,
    lastUsed: new Date().toISOString(),
  };
  extConns.set(id, conn);

  res.status(201).json({
    id,
    label: conn.label,
    connString: conn.connString,
    dbType: conn.dbType,
    connectedAt: conn.connectedAt,
    status: "connected",
  });
});

// ─── LIST external connections ────────────────────────────────────────────────
router.get("/connections", (_req, res) => {
  const list = [...extConns.values()].map(c => ({
    id: c.id, label: c.label, connString: c.connString, dbType: c.dbType,
    connectedAt: c.connectedAt, queryCount: c.queryCount, lastUsed: c.lastUsed,
  }));
  res.json({ connections: list, count: list.length });
});

// ─── DISCONNECT external connection ─────────────────────────────────────────
router.delete("/connections/:id", async (req, res) => {
  const conn = extConns.get(req.params.id);
  if (!conn) return res.status(404).json({ error: "Connection not found" });
  await conn.pgPool.end().catch(() => {});
  extConns.delete(req.params.id);
  res.json({ disconnected: req.params.id });
});

// ─── EXTERNAL QUERY (full SQL, all statements allowed) ───────────────────────
router.post("/external-query", async (req, res) => {
  const body = z.object({
    connectionId: z.string(),
    query: z.string().min(1).max(10000),
    limit: z.number().max(5000).optional().default(500),
  }).parse(req.body);

  const conn = extConns.get(body.connectionId);
  if (!conn) return res.status(404).json({ error: "Connection not found. Create one via POST /api/sql/connect." });

  const start = Date.now();
  const rawQuery = body.query.trim();

  // Auto-inject LIMIT for SELECT queries without one
  const autoLimited =
    /^\s*select\b/i.test(rawQuery) && !/\blimit\b/i.test(rawQuery)
      ? `${rawQuery} LIMIT ${body.limit}`
      : rawQuery;

  try {
    conn.lastUsed = new Date().toISOString();
    conn.queryCount += 1;

    const result = await conn.pgPool.query(autoLimited);
    const isSelect = Array.isArray(result.rows);

    res.json({
      query:          autoLimited,
      rows:           result.rows ?? [],
      columns:        result.fields?.map(f => f.name) ?? [],
      rowCount:       result.rowCount ?? result.rows?.length ?? 0,
      executionTimeMs: Date.now() - start,
      command:        result.command,
      connectionId:   body.connectionId,
      connectionLabel: conn.label,
    });
  } catch (err: any) {
    res.json({
      query: autoLimited, rows: [], columns: [], rowCount: 0,
      executionTimeMs: Date.now() - start,
      error: err.message,
      connectionId: body.connectionId,
    });
  }
});

// ─── SCHEMA EXPLORER ─────────────────────────────────────────────────────────
router.get("/schema/:connectionId", async (req, res) => {
  const conn = extConns.get(req.params.connectionId);
  if (!conn) return res.status(404).json({ error: "Connection not found" });

  try {
    const tables = await conn.pgPool.query(`
      SELECT table_schema, table_name, table_type
      FROM information_schema.tables
      WHERE table_schema NOT IN ('pg_catalog','information_schema')
      ORDER BY table_schema, table_name
    `);

    const columns = await conn.pgPool.query(`
      SELECT table_name, column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema NOT IN ('pg_catalog','information_schema')
      ORDER BY table_name, ordinal_position
    `);

    res.json({
      tables: tables.rows,
      columns: columns.rows,
      connectionId: req.params.connectionId,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ─── QUICK HTTP QUERY via URL (SQL over HTTP API endpoints) ──────────────────
router.post("/http-query", async (req, res) => {
  const body = z.object({
    url: z.string().url(),
    method: z.enum(["GET","POST","PUT","PATCH","DELETE"]).default("GET"),
    headers: z.record(z.string()).optional().default({}),
    payload: z.any().optional(),
    timeout: z.number().min(500).max(30000).optional().default(10000),
  }).parse(req.body);

  const startMs = Date.now();
  try {
    const nodeFetch = (await import("node-fetch")).default;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), body.timeout);

    const resp = await nodeFetch(body.url, {
      method: body.method,
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "ProxhqVPN-SQL/3.0",
        ...body.headers,
      },
      body: body.payload ? JSON.stringify(body.payload) : undefined,
      signal: controller.signal as any,
    });
    clearTimeout(timer);

    let data: any;
    const ct = resp.headers.get("content-type") ?? "";
    const text = await resp.text();
    try { data = JSON.parse(text); } catch { data = text; }

    const cols = Array.isArray(data)
      ? (data.length > 0 ? Object.keys(data[0]) : [])
      : (typeof data === "object" && data ? Object.keys(data) : ["response"]);

    const rows = Array.isArray(data) ? data : [{ response: typeof data === "string" ? data : JSON.stringify(data) }];

    res.json({
      url: body.url,
      status: resp.status,
      statusText: resp.statusText,
      rows,
      columns: cols,
      rowCount: rows.length,
      executionTimeMs: Date.now() - startMs,
      raw: text.slice(0, 5000),
    });
  } catch (err: any) {
    res.json({
      url: body.url, status: 0, statusText: "Failed",
      rows: [], columns: [], rowCount: 0,
      executionTimeMs: Date.now() - startMs,
      error: err.message,
    });
  }
});

export default router;
