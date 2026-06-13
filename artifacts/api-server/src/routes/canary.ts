// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { canaryTokensTable, canaryTriggersTable, trappedAttackersTable, nodesTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import crypto from "crypto";
import dns from "dns";
import { sendMail, adminEmails } from "../lib/mailer";
import { platformConfig } from "../config/platform";

const router = Router();

function makeTokenId() {
  return crypto.randomBytes(12).toString("hex");
}

function buildTokenPayload(tokenId: string, type: string, domain: string) {
  const base = domain || platformConfig.APP_URL.replace(/^https?:\/\//, "");
  const callbackUrl = `https://${base}/api/canary/trigger/${tokenId}`;
  switch (type) {
    case "url":
      return { url: callbackUrl, instructions: "Share this URL in documents, emails, or as a honeypot link." };
    case "dns":
      return {
        hostname: `${tokenId}.t.${base}`,
        httpFallback: callbackUrl,
        instructions: `Embed "${tokenId}.t.${base}" as a hostname in documents or configs. HTTP fallback records hits at the callback URL. For full DNS detection, point *.t.${base} to a logging DNS server.`,
      };
    case "email":
      return {
        emailAddress: `canary-${tokenId}@${base}`,
        webBug: `<img src="${callbackUrl}/pixel.gif" width="1" height="1" style="display:none" />`,
        instructions: "Embed the web bug in HTML emails. The email address triggers if forwarded to a mail server.",
      };
    case "file_path":
      return {
        windowsPath: `\\\\${base}\\share\\${tokenId}\\sensitive.docx`,
        linuxPath: `/mnt/shares/${tokenId}/sensitive.docx`,
        smbTrigger: callbackUrl,
        instructions: "Place this UNC path in a document. File access triggers an HTTP callback as a fallback indicator.",
      };
    case "web_bug":
      return {
        imgTag: `<img src="${callbackUrl}/pixel.gif" width="1" height="1" style="display:none" />`,
        iframeTag: `<iframe src="${callbackUrl}" width="1" height="1" style="display:none;border:none;"></iframe>`,
        cssUrl: `background-image: url("${callbackUrl}/pixel.gif");`,
        instructions: "Embed in HTML email, web page, or document. Any HTTP client loading the resource will trigger.",
      };
    case "aws_key":
      return {
        accessKeyId: `AKIA${tokenId.toUpperCase().slice(0, 16)}`,
        secretAccessKey: crypto.randomBytes(20).toString("base64").replace(/[+/=]/g, "").slice(0, 40),
        region: "us-east-1",
        callbackUrl,
        instructions: "Plant these fake AWS credentials in source code, S3 buckets, or config files. Any usage attempt will be logged by AWS CloudTrail. Pair with a real AWS access key alert or use the HTTP callback for instant notification.",
        awsNote: "These are FAKE credentials designed to look real. AWS will reject them — the value is in detection via CloudTrail or GitHub secret scanning alerts.",
      };
    case "redirect":
      return {
        redirectUrl: `${callbackUrl}/redirect`,
        shortUrl: `https://${base}/r/${tokenId}`,
        instructions: "Share this redirect URL in emails or documents. When clicked, the hit is recorded then the user is redirected to a configured destination.",
        htmlSnippet: `<a href="${callbackUrl}/redirect">Click here to access the document</a>`,
      };
    case "sql":
      return {
        sqlPayload: `-- ProxhqVPN Canary Token: ${tokenId}\nSELECT * FROM users WHERE id = '${tokenId}' AND 1=(SELECT CASE WHEN (1=1) THEN 1 ELSE 1/(SELECT 0) END)`,
        oobPayload: `'; EXEC master..xp_dirtree '//${base}/t/${tokenId}/smb'--`,
        httpCallbackEmbedded: callbackUrl,
        instructions: "Embed the canary token ID as a value in your database. If exfiltrated and used in SQL queries, the pattern will be detectable. Use the OOB payload for databases with outbound HTTP/DNS.",
      };
    case "powershell":
      return {
        script: `$r = Invoke-WebRequest -Uri '${callbackUrl}' -UseBasicParsing -Method GET\nWrite-Host "Access logged"`,
        encodedCommand: `powershell -EncodedCommand ${Buffer.from(`$r = Invoke-WebRequest -Uri '${callbackUrl}' -UseBasicParsing; Write-Host done`, "utf16le").toString("base64")}`,
        instructions: "Embed as a PowerShell script in documents, scheduled tasks, or WMI subscriptions. Execution will trigger the callback and record the attacker's IP.",
      };
    case "pdf":
      return {
        callbackUrl,
        instructions: "Create a PDF with an embedded URL action or JavaScript that loads this callback URL when opened. In Adobe Acrobat: Edit > Preferences > Trust Manager should be noted. Best method: embed as a remote resource in PDF /URI action.",
        pdfJsSnippet: `app.launchURL('${callbackUrl}', true);`,
        pdfXmlSnippet: `<pdf:Dictionary><pdf:Array><pdf:Name>S</pdf:Name><pdf:Name>URI</pdf:Name><pdf:String>${callbackUrl}</pdf:String></pdf:Array></pdf:Dictionary>`,
        libreOfficeMethod: "Insert > Header/Footer > use remote image URL pointing to callback",
      };
    case "slack_webhook":
      return {
        webhookUrl: callbackUrl,
        slackPayload: JSON.stringify({ text: `Canary triggered: token ${tokenId}`, username: "Security Alert", icon_emoji: ":ghost:" }),
        instructions: "Use this as a fake Slack webhook URL in config files or documentation. Any POST to this URL will be logged as a trigger. Attackers who find and test webhook URLs will be detected.",
      };
    case "custom":
    default:
      return { url: callbackUrl };
  }
}

// Priority: CF-Connecting-IP (Cloudflare real IP) → X-Forwarded-For → socket address
function getRealIp(req: Request): string {
  const cf = req.headers["cf-connecting-ip"];
  if (cf) return Array.isArray(cf) ? cf[0] : cf;
  const fwd = req.headers["x-forwarded-for"];
  return (Array.isArray(fwd) ? fwd[0] : fwd)?.split(",")[0]?.trim() || req.socket?.remoteAddress || req.ip || "unknown";
}

// Reverse DNS: PTR record lookup — reveals ISP hostname, corporate network, or VPN provider
async function reverseDnsLookup(ip: string): Promise<string | null> {
  if (!ip || ip === "unknown" || ip.startsWith("127.") || ip.startsWith("10.") || ip.startsWith("192.168.") || ip === "::1") return null;
  try {
    const hosts = await dns.promises.reverse(ip);
    return hosts[0] || null;
  } catch {
    return null;
  }
}

// IP geo/org/ASN enrichment via ip-api.com (free, no API key required)
interface IpInfo {
  country: string | null;
  city: string | null;
  org: string | null;
  asn: string | null;
}

async function enrichIp(ip: string): Promise<IpInfo> {
  const empty: IpInfo = { country: null, city: null, org: null, asn: null };
  if (!ip || ip === "unknown" || ip.startsWith("127.") || ip.startsWith("10.") || ip.startsWith("192.168.") || ip === "::1") return empty;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=country,city,org,as`, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return empty;
    const data = await res.json() as { country?: string; city?: string; org?: string; as?: string };
    return {
      country: data.country || null,
      city: data.city || null,
      org: data.org || null,
      asn: data.as || null,
    };
  } catch {
    return empty;
  }
}

// Collect all enrichment data in parallel
async function collectEnrichment(req: Request, ip: string) {
  const [geo, rdns] = await Promise.all([enrichIp(ip), reverseDnsLookup(ip)]);
  return {
    geoCountry: geo.country,
    geoCity: geo.city,
    geoOrg: geo.org,
    geoAsn: geo.asn,
    reverseDns: rdns,
    cfRay: (req.headers["cf-ray"] as string) || null,
    acceptLanguage: (req.headers["accept-language"] as string) || null,
  };
}

// Shared async post-trigger logic: log trigger, auto-trap IP in SilkWeb, email admins.
// Called after the HTTP response is sent so it never blocks the caller.
async function handleTriggerAsync(req: Request, tokenId: string, ip: string, ua: string, ref: string) {
  try {
    const [token] = await db.select().from(canaryTokensTable)
      .where(eq(canaryTokensTable.tokenId, tokenId)).limit(1);
    if (!token || !token.active) return;

    const enrichment = await collectEnrichment(req, ip);

    // 1. Log the trigger
    await db.insert(canaryTriggersTable).values({
      tokenId,
      sourceIp: ip,
      userAgent: ua,
      referer: ref,
      headers: JSON.stringify(req.headers),
      ...enrichment,
    });

    // 2. Update token counters
    await db.update(canaryTokensTable).set({
      triggerCount: token.triggerCount + 1,
      lastTriggeredAt: new Date(),
      lastTriggeredIp: ip,
      lastTriggeredUserAgent: ua,
    }).where(eq(canaryTokensTable.tokenId, tokenId));

    // 3. Auto-trap: create trapped_attackers entry if this IP isn't already there.
    //    entryNodeId is required — use first available node (any node).
    const [existingTrap] = await db.select({ id: trappedAttackersTable.id })
      .from(trappedAttackersTable)
      .where(eq(trappedAttackersTable.ip, ip))
      .limit(1);

    if (!existingTrap) {
      const [node] = await db.select({ id: nodesTable.id, name: nodesTable.name, region: nodesTable.region })
        .from(nodesTable).limit(1);

      if (node) {
        const fp = `CANARY:${token.tokenType}|TOKEN:${tokenId}|IP:${ip}|ORG:${enrichment.geoOrg ?? "?"}|TS:${Date.now()}`;
        await db.insert(trappedAttackersTable).values({
          ip,
          fingerprint: fp,
          entryNodeId: node.id,
          loopCount: 0,
          probeType: `canary_${token.tokenType}`,
          sqlmapStatus: "idle",
          dataCollected: JSON.stringify({
            tokenId,
            tokenType: token.tokenType,
            tokenLabel: token.label,
            country: enrichment.geoCountry,
            city: enrichment.geoCity,
            org: enrichment.geoOrg,
            asn: enrichment.geoAsn,
            reverseDns: enrichment.reverseDns,
            userAgent: ua,
            referer: ref,
          }),
        });
      }
    }

    // 4. Email admin(s)
    const recipients = adminEmails();
    if (recipients.length > 0) {
      const geo = `${enrichment.geoCity ?? ""}${enrichment.geoCity && enrichment.geoCountry ? ", " : ""}${enrichment.geoCountry ?? "Unknown"}`;
      const org = enrichment.geoOrg ?? "Unknown";
      const rdns = enrichment.reverseDns ? `<br><b>Reverse DNS:</b> ${enrichment.reverseDns}` : "";
      await sendMail({
        to: recipients,
        subject: `🚨 Canary Triggered — ${token.tokenType.toUpperCase()} token "${token.label ?? tokenId}"`,
        html: `
          <div style="font-family:monospace;background:#0a0a0a;color:#00ff88;padding:24px;border-radius:8px;">
            <h2 style="color:#ff4444;margin:0 0 16px">⚠ CANARY TOKEN TRIGGERED</h2>
            <table style="border-collapse:collapse;width:100%">
              <tr><td style="padding:4px 12px 4px 0;color:#888">Token</td><td><b>${token.label ?? tokenId}</b> (${token.tokenType})</td></tr>
              <tr><td style="padding:4px 12px 4px 0;color:#888">Source IP</td><td><b style="color:#ff4444">${ip}</b></td></tr>
              <tr><td style="padding:4px 12px 4px 0;color:#888">Location</td><td>${geo}</td></tr>
              <tr><td style="padding:4px 12px 4px 0;color:#888">Org / ASN</td><td>${org}</td></tr>
              <tr><td style="padding:4px 12px 4px 0;color:#888">User Agent</td><td>${ua || "—"}</td></tr>
              <tr><td style="padding:4px 12px 4px 0;color:#888">Referer</td><td>${ref || "—"}</td></tr>
              <tr><td style="padding:4px 12px 4px 0;color:#888">Triggered At</td><td>${new Date().toUTCString()}</td></tr>
            </table>
            ${rdns}
            <hr style="border-color:#222;margin:16px 0">
            <p style="color:#888;font-size:12px;margin:0">IP has been automatically added to SilkWeb Trapped Entities.<br>
            View at <a href="${platformConfig.APP_URL}/silkweb" style="color:#00ff88">${platformConfig.APP_URL.replace(/^https?:\/\//, "")}/silkweb</a></p>
          </div>`,
        text: `Canary triggered!\nToken: ${token.label ?? tokenId} (${token.tokenType})\nSource IP: ${ip}\nLocation: ${geo}\nOrg: ${org}\nUser-Agent: ${ua}\nTime: ${new Date().toUTCString()}`,
      });
    }
  } catch (err: any) {
    // Never propagate — response already sent
  }
}

router.get("/tokens", async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const tokens = await db.select().from(canaryTokensTable)
    .where(eq(canaryTokensTable.createdBy, userId))
    .orderBy(desc(canaryTokensTable.createdAt))
    .limit(50);
  res.json(tokens);
});

router.post("/tokens", async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const { tokenType, label, memo, alertEmail } = req.body as {
    tokenType: string;
    label: string;
    memo?: string;
    alertEmail?: string;
  };

  if (!tokenType || !label) return res.status(400).json({ error: "tokenType and label required" });

  const validTypes = ["url", "dns", "email", "file_path", "web_bug", "aws_key", "redirect", "sql", "powershell", "pdf", "slack_webhook", "custom"];
  if (!validTypes.includes(tokenType)) return res.status(400).json({ error: "Invalid token type" });

  const tokenId = makeTokenId();
  const domain = process.env.REPLIT_DEV_DOMAIN || platformConfig.APP_URL.replace(/^https?:\/\//, "");
  const payload = buildTokenPayload(tokenId, tokenType, domain);

  const [token] = await db.insert(canaryTokensTable).values({
    tokenId,
    tokenType,
    label,
    memo: memo || null,
    alertEmail: alertEmail || null,
    createdBy: userId,
    metadataJson: JSON.stringify(payload),
  }).returning();

  res.json({ ...token, payload });
});

router.delete("/tokens/:id", async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const id = parseInt(String(req.params.id));
  const [token] = await db.select().from(canaryTokensTable).where(eq(canaryTokensTable.id, id)).limit(1);
  if (!token) return res.status(404).json({ error: "Not found" });
  if (token.createdBy !== userId) return res.status(403).json({ error: "Forbidden" });

  await db.delete(canaryTriggersTable).where(eq(canaryTriggersTable.tokenId, token.tokenId));
  await db.delete(canaryTokensTable).where(eq(canaryTokensTable.id, id));
  res.json({ ok: true });
});

router.get("/tokens/:id/triggers", async (req: Request, res: Response) => {
  const { userId } = getAuth(req);
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const id = parseInt(String(req.params.id));
  const [token] = await db.select().from(canaryTokensTable).where(eq(canaryTokensTable.id, id)).limit(1);
  if (!token || token.createdBy !== userId) return res.status(403).json({ error: "Forbidden" });

  const triggers = await db.select().from(canaryTriggersTable)
    .where(eq(canaryTriggersTable.tokenId, token.tokenId))
    .orderBy(desc(canaryTriggersTable.triggeredAt))
    .limit(100);
  res.json(triggers);
});

// Public trigger endpoints — no auth, always respond fast then enrich async

router.get("/trigger/:tokenId", async (req: Request, res: Response) => {
  const tokenId = String(req.params.tokenId);
  const ip = getRealIp(req);
  const ua = req.headers["user-agent"] || "";
  const ref = req.headers["referer"] || "";

  // Respond immediately — never block the caller
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Content-Type", "image/gif");
  res.send(Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64"));

  // Log, auto-trap, and notify after response
  handleTriggerAsync(req, tokenId, ip, ua, ref);
});

router.get("/trigger/:tokenId/redirect", async (req: Request, res: Response) => {
  const tokenId = String(req.params.tokenId);
  const ip = getRealIp(req);
  const ua = req.headers["user-agent"] || "";
  const ref = req.headers["referer"] || "";

  // Redirect immediately — log, trap, and notify after
  res.redirect(302, platformConfig.APP_URL);
  handleTriggerAsync(req, tokenId, ip, ua, ref);
});

router.get("/trigger/:tokenId/pixel.gif", async (req: Request, res: Response) => {
  const tokenId = String(req.params.tokenId);
  const ip = getRealIp(req);
  const ua = req.headers["user-agent"] || "";
  const ref = req.headers["referer"] || "";

  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Content-Type", "image/gif");
  res.send(Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64"));

  // Log, auto-trap, and notify after response
  handleTriggerAsync(req, tokenId, ip, ua, ref);
});

router.get("/warrant-canary", (_req: Request, res: Response) => {
  // Stable 30-day window: issuedAt is always the 1st of the current UTC month.
  // This means all requests within the same month return an identical statement,
  // making hash verification consistent for the full 30-day window.
  const now = new Date();
  const issuedAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
  const expiresAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0));
  const daysRemaining = Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / 86400000));

  const statement = [
    "PROXHQVPN WARRANT CANARY",
    `Issued: ${issuedAt.toUTCString()}`,
    `Expires: ${expiresAt.toUTCString()}`,
    "",
    "As of the date above, ALPHA UNLIMITED TECHNOLOGIES LLC (operating ProxhqVPN) hereby states:",
    "",
    "1. We have NOT received any National Security Letters or Foreign Intelligence Surveillance Court orders.",
    "2. We have NOT received any gag orders that would prevent us from publishing this canary.",
    "3. We have NOT been subject to any secret government searches or seizures of infrastructure.",
    "4. We have NOT turned over user encryption keys or private data to any third party.",
    "5. We have NOT intentionally weakened or backdoored our cryptographic systems.",
    "6. We maintain a strict no-logs policy for all VPN connection data.",
    "",
    "This canary is updated on the 1st of each calendar month (UTC). Removal or non-renewal implies a trigger.",
    "",
    "ProxhqVPN — ALPHA UNLIMITED TECHNOLOGIES LLC",
    platformConfig.APP_URL,
  ];

  const stmtText = statement.join("\n");
  const sha256 = crypto.createHash("sha256").update(stmtText).digest("hex");

  res.json({
    status: "active",
    issuedAt: issuedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    daysRemaining,
    statement: stmtText,
    lines: statement,
    sha256,
    pgpNote: "SHA-256 hash covers the full statement text. Verify each month that the hash matches the content.",
    canaryVersion: 2,
  });
});

export default router;
