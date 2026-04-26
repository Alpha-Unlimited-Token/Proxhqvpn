import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { canaryTokensTable, canaryTriggersTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import crypto from "crypto";

const router = Router();

function makeTokenId() {
  return crypto.randomBytes(12).toString("hex");
}

function buildTokenPayload(tokenId: string, type: string, domain: string) {
  const base = domain || "proxhqvpn.com";
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

function getRealIp(req: Request): string {
  const fwd = req.headers["x-forwarded-for"];
  return (Array.isArray(fwd) ? fwd[0] : fwd)?.split(",")[0]?.trim() || req.socket?.remoteAddress || req.ip || "unknown";
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
  const domain = process.env.REPLIT_DEV_DOMAIN || "proxhqvpn.com";
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

router.get("/trigger/:tokenId", async (req: Request, res: Response) => {
  const tokenId = String(req.params.tokenId);
  const ip = getRealIp(req);
  const ua = req.headers["user-agent"] || "";
  const ref = req.headers["referer"] || "";

  try {
    const [token] = await db.select().from(canaryTokensTable)
      .where(eq(canaryTokensTable.tokenId, tokenId)).limit(1);

    if (token && token.active) {
      await db.insert(canaryTriggersTable).values({
        tokenId,
        sourceIp: ip,
        userAgent: ua,
        referer: ref,
        headers: JSON.stringify({ "user-agent": ua, "referer": ref, "x-forwarded-for": req.headers["x-forwarded-for"] }),
      });

      await db.update(canaryTokensTable).set({
        triggerCount: token.triggerCount + 1,
        lastTriggeredAt: new Date(),
        lastTriggeredIp: ip,
        lastTriggeredUserAgent: ua,
      }).where(eq(canaryTokensTable.tokenId, tokenId));
    }
  } catch {}

  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Content-Type", "image/gif");
  res.send(Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64"));
});

router.get("/trigger/:tokenId/redirect", async (req: Request, res: Response) => {
  const tokenId = String(req.params.tokenId);
  const ip = getRealIp(req);
  const ua = req.headers["user-agent"] || "";
  const ref = req.headers["referer"] || "";
  try {
    const [token] = await db.select().from(canaryTokensTable)
      .where(eq(canaryTokensTable.tokenId, tokenId)).limit(1);
    if (token && token.active) {
      await db.insert(canaryTriggersTable).values({ tokenId, sourceIp: ip, userAgent: ua, referer: ref, headers: JSON.stringify(req.headers) });
      await db.update(canaryTokensTable).set({
        triggerCount: token.triggerCount + 1, lastTriggeredAt: new Date(), lastTriggeredIp: ip, lastTriggeredUserAgent: ua,
      }).where(eq(canaryTokensTable.tokenId, tokenId));
    }
  } catch {}
  res.redirect(302, "https://proxhqvpn.com");
});

router.get("/warrant-canary", (_req: Request, res: Response) => {
  const now = new Date();
  const statement = [
    "PROXHQVPN WARRANT CANARY",
    `Issued: ${now.toUTCString()}`,
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
    "This canary is updated monthly. Removal or absence of this statement implies the canary has been triggered.",
    "",
    "ProxhqVPN — ALPHA UNLIMITED TECHNOLOGIES LLC",
    "https://proxhqvpn.com",
  ];
  res.json({
    status: "active",
    issuedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    statement: statement.join("\n"),
    lines: statement,
    pgpNote: "For cryptographic verification, sign this canary with the ProxhqVPN PGP key.",
    canaryVersion: 1,
  });
});

router.get("/trigger/:tokenId/pixel.gif", async (req: Request, res: Response) => {
  const tokenId = String(req.params.tokenId);
  const ip = getRealIp(req);
  const ua = req.headers["user-agent"] || "";
  const ref = req.headers["referer"] || "";

  try {
    const [token] = await db.select().from(canaryTokensTable)
      .where(eq(canaryTokensTable.tokenId, tokenId)).limit(1);
    if (token && token.active) {
      await db.insert(canaryTriggersTable).values({ tokenId, sourceIp: ip, userAgent: ua, referer: ref });
      await db.update(canaryTokensTable).set({
        triggerCount: token.triggerCount + 1,
        lastTriggeredAt: new Date(),
        lastTriggeredIp: ip,
      }).where(eq(canaryTokensTable.tokenId, tokenId));
    }
  } catch {}
  res.setHeader("Content-Type", "image/gif");
  res.send(Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64"));
});

export default router;
