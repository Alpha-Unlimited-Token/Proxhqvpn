import { Router } from "express";
import { db, pool } from "@workspace/db";
import { z } from "zod";

const router = Router();

// Read-only: only SELECT statements allowed
const READONLY_RE = /^\s*(select|with|explain|show)\s/i;
const BLOCKED_RE = /\b(insert|update|delete|drop|truncate|alter|create|grant|revoke|exec|execute|call)\b/i;

router.post("/query", async (req, res) => {
  const body = z.object({
    query: z.string().max(2000),
    limit: z.number().max(500).optional().default(100),
  }).parse(req.body);

  const query = body.query.trim();
  const start = Date.now();

  if (!READONLY_RE.test(query)) {
    return res.json({
      query,
      rows: [],
      columns: [],
      rowCount: 0,
      executionTimeMs: 0,
      error: "Only SELECT queries are permitted in the SQL interface.",
    });
  }

  if (BLOCKED_RE.test(query)) {
    return res.json({
      query,
      rows: [],
      columns: [],
      rowCount: 0,
      executionTimeMs: 0,
      error: "Blocked keyword detected. Only read-only SELECT queries are allowed.",
    });
  }

  // Inject LIMIT if not present
  const limitedQuery = /\blimit\b/i.test(query) ? query : `${query} LIMIT ${body.limit}`;

  try {
    const result = await pool.query(limitedQuery);
    const columns = result.fields.map((f) => f.name);
    const rows = result.rows;
    res.json({
      query: limitedQuery,
      rows,
      columns,
      rowCount: rows.length,
      executionTimeMs: Date.now() - start,
      error: undefined,
    });
  } catch (err: any) {
    res.json({
      query: limitedQuery,
      rows: [],
      columns: [],
      rowCount: 0,
      executionTimeMs: Date.now() - start,
      error: err.message ?? "Query failed",
    });
  }
});

export default router;
