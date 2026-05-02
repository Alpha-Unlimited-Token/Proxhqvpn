// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Router } from "express";
import { getAuth } from "@clerk/express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import crypto from "crypto";

/** Normalize db.execute() result — returns plain array for simple queries, {rows} for complex aggregates */
function toRows(result: unknown): any[] {
  if (Array.isArray(result)) return result;
  const r = result as any;
  if (r && Array.isArray(r.rows)) return r.rows;
  return [];
}

async function isAdminUser(userId: string): Promise<boolean> {
  const [user] = await db.select({ isAdmin: usersTable.isAdmin }).from(usersTable).where(eq(usersTable.id, userId));
  return user?.isAdmin === true;
}

const router = Router();

// ── Ensure tables exist (idempotent) ──────────────────────────────────────────
async function ensureAmbassadorTables() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS ambassadors (
      id                   SERIAL PRIMARY KEY,
      user_id              TEXT NOT NULL UNIQUE,
      name                 TEXT NOT NULL,
      bio                  TEXT,
      promo_code           TEXT NOT NULL UNIQUE,
      avatar_url           TEXT,
      social_urls          JSONB DEFAULT '{}',
      status               TEXT NOT NULL DEFAULT 'pending',
      total_earnings_cents INTEGER NOT NULL DEFAULT 0,
      created_at           TIMESTAMP DEFAULT NOW()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS ambassador_videos (
      id             SERIAL PRIMARY KEY,
      ambassador_id  INTEGER NOT NULL REFERENCES ambassadors(id) ON DELETE CASCADE,
      title          TEXT NOT NULL,
      description    TEXT,
      video_url      TEXT NOT NULL,
      embed_url      TEXT,
      sort_order     INTEGER NOT NULL DEFAULT 0,
      created_at     TIMESTAMP DEFAULT NOW()
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS ambassador_referrals (
      id                     SERIAL PRIMARY KEY,
      ambassador_id          INTEGER NOT NULL REFERENCES ambassadors(id) ON DELETE CASCADE,
      customer_user_id       TEXT NOT NULL,
      stripe_session_id      TEXT,
      stripe_subscription_id TEXT,
      plan                   TEXT,
      amount_cents           INTEGER NOT NULL DEFAULT 0,
      commission_cents       INTEGER NOT NULL DEFAULT 0,
      paid_out               BOOLEAN NOT NULL DEFAULT FALSE,
      created_at             TIMESTAMP DEFAULT NOW()
    )
  `);
}

// Run table init on startup
ensureAmbassadorTables().catch(console.error);

// ── Helpers ───────────────────────────────────────────────────────────────────
function extractEmbedUrl(url: string): string | null {
  if (!url) return null;
  // YouTube
  const ytMatch =
    url.match(/youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/) ||
    url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/) ||
    url.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/);
  if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;

  // Vimeo
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;

  // Loom
  const loomMatch = url.match(/loom\.com\/share\/([a-zA-Z0-9]+)/);
  if (loomMatch) return `https://www.loom.com/embed/${loomMatch[1]}`;

  return null;
}

function sanitizePromoCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, "").substring(0, 12);
}

// ── GET /api/ambassadors — public list (approved only) ────────────────────────
router.get("/", async (_req, res) => {
  try {
    const result = await db.execute(sql`
      SELECT a.id, a.name, a.bio, a.promo_code, a.avatar_url, a.social_urls,
             a.status, a.total_earnings_cents, a.created_at,
             COALESCE(
               JSON_AGG(
                 JSON_BUILD_OBJECT(
                   'id', v.id,
                   'title', v.title,
                   'description', v.description,
                   'videoUrl', v.video_url,
                   'embedUrl', v.embed_url
                 ) ORDER BY v.sort_order, v.created_at
               ) FILTER (WHERE v.id IS NOT NULL),
               '[]'::json
             ) AS videos
      FROM ambassadors a
      LEFT JOIN ambassador_videos v ON v.ambassador_id = a.id
      WHERE a.status = 'approved'
      GROUP BY a.id
      ORDER BY a.created_at ASC
    `);
    // db.execute returns either a plain array or an object with .rows depending on query complexity
    const rows: any[] = Array.isArray(result) ? result : ((result as any).rows ?? []);
    const ambassadors = rows.map((r: any) => ({
      id:                 r.id,
      name:               r.name,
      bio:                r.bio,
      promoCode:          r.promo_code,
      avatarUrl:          r.avatar_url,
      socialUrls:         r.social_urls ?? {},
      status:             r.status,
      totalEarningsCents: r.total_earnings_cents,
      createdAt:          r.created_at,
      videos:             r.videos ?? [],
    }));
    return res.json(ambassadors);
  } catch (err: any) {
    console.error("ambassadors GET /", err);
    return res.status(500).json({ error: "Failed to list ambassadors" });
  }
});

// ── GET /api/ambassadors/promo/:code — look up by promo code (used at checkout)
router.get("/promo/:code", async (req, res) => {
  try {
    const code = sanitizePromoCode(req.params.code);
    const rows = toRows(await db.execute(sql`
      SELECT id, name, promo_code, status FROM ambassadors WHERE promo_code = ${code} LIMIT 1
    `));
    const r = rows[0];
    if (!r) return res.status(404).json({ error: "Promo code not found" });
    return res.json({ id: r.id, name: r.name, promoCode: r.promo_code, status: r.status });
  } catch {
    return res.status(500).json({ error: "Lookup failed" });
  }
});

// ── POST /api/ambassadors/apply — apply to become ambassador ──────────────────
router.post("/apply", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const { name, bio, promoCode, avatarUrl, socialUrls } = req.body as {
    name: string; bio?: string; promoCode: string; avatarUrl?: string; socialUrls?: Record<string, string>;
  };
  if (!name?.trim()) return res.status(400).json({ error: "name is required" });
  if (!promoCode?.trim()) return res.status(400).json({ error: "promoCode is required" });

  const code = sanitizePromoCode(promoCode);
  if (code.length < 3) return res.status(400).json({ error: "promoCode must be at least 3 characters" });

  try {
    // Check if already an ambassador
    const existing = toRows(await db.execute(sql`SELECT id FROM ambassadors WHERE user_id = ${userId} LIMIT 1`));
    if (existing.length > 0) return res.status(400).json({ error: "You have already applied" });

    // Check promo code uniqueness
    const codeCheck = toRows(await db.execute(sql`SELECT id FROM ambassadors WHERE promo_code = ${code} LIMIT 1`));
    if (codeCheck.length > 0) return res.status(400).json({ error: "Promo code already taken — choose a different one" });

    const rows = toRows(await db.execute(sql`
      INSERT INTO ambassadors (user_id, name, bio, promo_code, avatar_url, social_urls, status)
      VALUES (${userId}, ${name.trim()}, ${bio?.trim() || null}, ${code}, ${avatarUrl?.trim() || null}, ${JSON.stringify(socialUrls || {})}::jsonb, 'pending')
      RETURNING id, name, promo_code, status
    `));
    const r = rows[0];
    return res.status(201).json({ ok: true, ambassador: { id: r.id, name: r.name, promoCode: r.promo_code, status: r.status } });
  } catch (err: any) {
    if (err.message?.includes("unique")) return res.status(400).json({ error: "Promo code already taken" });
    console.error("ambassadors POST /apply", err);
    return res.status(500).json({ error: "Application failed" });
  }
});

// ── GET /api/ambassadors/me — get own profile ─────────────────────────────────
router.get("/me", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  try {
    const rows = toRows(await db.execute(sql`
      SELECT a.id, a.name, a.bio, a.promo_code, a.avatar_url, a.social_urls,
             a.status, a.total_earnings_cents, a.created_at
      FROM ambassadors a WHERE a.user_id = ${userId} LIMIT 1
    `));
    const r = rows[0];
    if (!r) return res.status(404).json({ error: "Not an ambassador" });

    const videos = toRows(await db.execute(sql`
      SELECT id, title, description, video_url, embed_url, sort_order
      FROM ambassador_videos WHERE ambassador_id = ${r.id}
      ORDER BY sort_order, created_at
    `));
    const referrals = toRows(await db.execute(sql`
      SELECT id, customer_user_id, stripe_session_id, stripe_subscription_id,
             plan, amount_cents, commission_cents, paid_out, created_at
      FROM ambassador_referrals WHERE ambassador_id = ${r.id}
      ORDER BY created_at DESC LIMIT 100
    `));

    return res.json({
      id:                 r.id,
      name:               r.name,
      bio:                r.bio,
      promoCode:          r.promo_code,
      avatarUrl:          r.avatar_url,
      socialUrls:         r.social_urls ?? {},
      status:             r.status,
      totalEarningsCents: r.total_earnings_cents,
      createdAt:          r.created_at,
      videos:             videos.map((v: any) => ({
        id:          v.id,
        title:       v.title,
        description: v.description,
        videoUrl:    v.video_url,
        embedUrl:    v.embed_url,
        sortOrder:   v.sort_order,
      })),
      referrals: referrals.map((ref: any) => ({
        id:                   ref.id,
        customerUserId:       ref.customer_user_id,
        stripeSessionId:      ref.stripe_session_id,
        stripeSubscriptionId: ref.stripe_subscription_id,
        plan:                 ref.plan,
        amountCents:          ref.amount_cents,
        commissionCents:      ref.commission_cents,
        paidOut:              ref.paid_out,
        createdAt:            ref.created_at,
      })),
    });
  } catch (err: any) {
    console.error("ambassadors GET /me", err);
    return res.status(500).json({ error: "Failed to load profile" });
  }
});

// ── PATCH /api/ambassadors/me — update bio/avatar/social ─────────────────────
router.patch("/me", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const { bio, avatarUrl, socialUrls } = req.body as {
    bio?: string; avatarUrl?: string; socialUrls?: Record<string, string>;
  };

  try {
    const rows = toRows(await db.execute(sql`SELECT id FROM ambassadors WHERE user_id = ${userId} LIMIT 1`));
    const r = rows[0];
    if (!r) return res.status(404).json({ error: "Not an ambassador" });

    await db.execute(sql`
      UPDATE ambassadors
      SET bio        = COALESCE(${bio?.trim() ?? null}, bio),
          avatar_url = COALESCE(${avatarUrl?.trim() ?? null}, avatar_url),
          social_urls = CASE WHEN ${socialUrls !== undefined}::boolean THEN ${JSON.stringify(socialUrls || {})}::jsonb ELSE social_urls END
      WHERE id = ${r.id}
    `);
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: "Update failed" });
  }
});

// ── POST /api/ambassadors/me/videos — add a video ────────────────────────────
router.post("/me/videos", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const { title, description, videoUrl } = req.body as {
    title?: string; description?: string; videoUrl?: string;
  };
  if (!title?.trim()) return res.status(400).json({ error: "title is required" });
  if (!videoUrl?.trim()) return res.status(400).json({ error: "videoUrl is required" });

  try {
    const rows = toRows(await db.execute(sql`SELECT id FROM ambassadors WHERE user_id = ${userId} LIMIT 1`));
    const r = rows[0];
    if (!r) return res.status(404).json({ error: "Not an ambassador" });

    const embedUrl = extractEmbedUrl(videoUrl.trim());
    const inserted = toRows(await db.execute(sql`
      INSERT INTO ambassador_videos (ambassador_id, title, description, video_url, embed_url)
      VALUES (${r.id}, ${title.trim()}, ${description?.trim() || null}, ${videoUrl.trim()}, ${embedUrl})
      RETURNING id, title, description, video_url, embed_url, sort_order, created_at
    `));
    const v = inserted[0];
    return res.status(201).json({
      ok: true,
      video: {
        id: v.id, title: v.title, description: v.description,
        videoUrl: v.video_url, embedUrl: v.embed_url, sortOrder: v.sort_order,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ error: "Failed to add video" });
  }
});

// ── DELETE /api/ambassadors/me/videos/:id ─────────────────────────────────────
router.delete("/me/videos/:id", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  try {
    const amb = toRows(await db.execute(sql`SELECT id FROM ambassadors WHERE user_id = ${userId} LIMIT 1`));
    const r = amb[0];
    if (!r) return res.status(404).json({ error: "Not an ambassador" });

    await db.execute(sql`
      DELETE FROM ambassador_videos WHERE id = ${Number(req.params.id)} AND ambassador_id = ${r.id}
    `);
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: "Delete failed" });
  }
});

// ── POST /api/ambassadors/record-referral — called after successful checkout ──
// Body: { sessionId, promoCode, plan, amountCents }
router.post("/record-referral", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const { sessionId, promoCode, subscriptionId, plan, amountCents } = req.body as {
    sessionId?: string; promoCode?: string; subscriptionId?: string; plan?: string; amountCents?: number;
  };
  if (!promoCode) return res.json({ ok: true, skipped: "no promo code" });

  try {
    const code = sanitizePromoCode(promoCode);
    const rows = toRows(await db.execute(sql`
      SELECT id FROM ambassadors WHERE promo_code = ${code} AND status = 'approved' LIMIT 1
    `));
    const amb = rows[0];
    if (!amb) return res.json({ ok: true, skipped: "invalid promo code" });

    // Prevent duplicate referrals for same customer+session
    const dupCheck = toRows(await db.execute(sql`
      SELECT id FROM ambassador_referrals
      WHERE ambassador_id = ${amb.id} AND customer_user_id = ${userId}
        AND (stripe_session_id = ${sessionId || null} OR stripe_session_id IS NULL)
      LIMIT 1
    `));
    if (dupCheck.length > 0) return res.json({ ok: true, skipped: "already recorded" });

    const amount       = amountCents || 0;
    const commission   = Math.floor(amount * 0.10); // 10%

    await db.execute(sql`
      INSERT INTO ambassador_referrals
        (ambassador_id, customer_user_id, stripe_session_id, stripe_subscription_id, plan, amount_cents, commission_cents)
      VALUES
        (${amb.id}, ${userId}, ${sessionId || null}, ${subscriptionId || null}, ${plan || null}, ${amount}, ${commission})
    `);

    // Update ambassador total earnings
    await db.execute(sql`
      UPDATE ambassadors SET total_earnings_cents = total_earnings_cents + ${commission} WHERE id = ${amb.id}
    `);

    return res.json({ ok: true, ambassadorId: amb.id, commission });
  } catch (err: any) {
    console.error("record-referral error", err);
    return res.status(500).json({ error: "Failed to record referral" });
  }
});

// ── Admin: GET /api/ambassadors/admin/all — list all incl. pending ────────────
router.get("/admin/all", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  if (!await isAdminUser(userId)) return res.status(403).json({ error: "Forbidden: admin only" });

  try {
    const result = await db.execute(sql`
      SELECT a.*, COUNT(r.id)::int AS referral_count
      FROM ambassadors a
      LEFT JOIN ambassador_referrals r ON r.ambassador_id = a.id
      GROUP BY a.id ORDER BY a.created_at DESC
    `);
    return res.json(toRows(result));
  } catch {
    return res.status(500).json({ error: "Failed" });
  }
});

// ── Admin: PATCH /api/ambassadors/admin/:id/status — approve/reject ───────────
router.patch("/admin/:id/status", async (req, res) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });
  if (!await isAdminUser(userId)) return res.status(403).json({ error: "Forbidden: admin only" });

  const { status } = req.body as { status: string };
  if (!["approved", "rejected", "pending"].includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }
  try {
    await db.execute(sql`UPDATE ambassadors SET status = ${status} WHERE id = ${Number(req.params.id)}`);
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: "Update failed" });
  }
});

export default router;
