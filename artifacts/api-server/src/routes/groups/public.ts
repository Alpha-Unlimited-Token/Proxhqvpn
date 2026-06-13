// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Router, type Request, type Response } from "express";
import healthRouter from "../health";
import updatesRouter from "../updates";
import anonRouter from "../anon";
import ambassadorsRouter from "../ambassadors";
import stripeRouter from "../stripe";
import cryptoPaymentsRouter from "../crypto-payments";
import notificationsRouter from "../notifications";
import canaryRouter from "../canary";
import ghostTrapRouter from "../ghosttrap";
import omegaAgentRouter from "../omega/agent";
import daemonInboundRouter from "../daemon-inbound";
import nodeProvisionRouter from "../node-provision";
import nodeAgentRouter from "../node-agent";
import honeypotRouter from "../honeypot";
import walletTxRouter from "../wallet-tx";
import walletIntelRouter from "../wallet-intel";
import { daemonIpBanMiddleware } from "../../app";

const router = Router();

router.use(healthRouter);

router.get("/my-ip", (req: Request, res: Response) => {
  const forwarded = req.headers["x-forwarded-for"];

  const ip =
    (Array.isArray(forwarded) ? forwarded[0] : forwarded)
      ?.split(",")[0]
      ?.trim() ||
    req.socket?.remoteAddress ||
    req.ip ||
    "unknown";

  res.json({ ip });
});

router.use("/updates", updatesRouter);

router.get("/update/check", (_req, res) => {
  res.redirect(307, "/api/updates/check");
});

router.use("/daemon-inbound", daemonIpBanMiddleware, daemonInboundRouter);

router.get("/t/:tokenId", (req, res, next) => {
  req.url = `/trigger/${req.params.tokenId}`;
  (canaryRouter as any).handle(req, res, next);
});

router.get("/t/:tokenId/pixel.gif", (req, res, next) => {
  req.url = `/trigger/${req.params.tokenId}/pixel.gif`;
  (canaryRouter as any).handle(req, res, next);
});

router.get("/t/:tokenId/redirect", (req, res, next) => {
  req.url = `/trigger/${req.params.tokenId}/redirect`;
  (canaryRouter as any).handle(req, res, next);
});

router.use("/omega-agent", omegaAgentRouter);

router.use("/ghost-trap", (req, res, next) => {
  if (
    req.path.startsWith("/lure") ||
    req.path.startsWith("/u/") ||
    req.path.startsWith("/beacon/")
  ) {
    return (ghostTrapRouter as any).handle(req, res, next);
  }

  next();
});

router.get("/warrant-canary", (req, res, next) => {
  req.url = "/warrant-canary";
  (canaryRouter as any).handle(req, res, next);
});

router.use("/node-provision", nodeProvisionRouter);
router.use("/node-agent", nodeAgentRouter);

router.post("/honeypot/ingest", (req, res, next) => {
  req.url = "/ingest";
  (honeypotRouter as any).handle(req, res, next);
});

router.use("/wallet", walletTxRouter);
router.use("/wallet-intel", walletIntelRouter);

router.use("/anon", anonRouter);
router.use("/ambassadors", ambassadorsRouter);
router.use("/stripe", stripeRouter);
router.use("/payments/crypto", cryptoPaymentsRouter);
router.use("/notifications", notificationsRouter);

export default router;
