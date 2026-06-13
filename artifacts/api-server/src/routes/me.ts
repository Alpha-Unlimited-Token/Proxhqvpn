// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Router } from "express";
import { getAuth } from "@clerk/express";
import { getUserAccessProfile } from "../services/userAccessService";

const router = Router();

router.get("/", async (req, res) => {
  const { userId } = getAuth(req);

  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const profile = await getUserAccessProfile(userId);

  res.json(profile);
});

export default router;
