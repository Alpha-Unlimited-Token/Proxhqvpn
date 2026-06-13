import { Router } from "express";
import { z } from "zod";
import { getAuth } from "@clerk/express";
import { asyncHandler } from "../middlewares/asyncHandler";
import {
  validateRequest,
  getValidatedBody,
  getValidatedQuery,
} from "../middlewares/validateRequest";
import {
  createKeyRotationScheduler,
  listKeyRotationScheduler,
} from "../services/keyRotationSchedulerService";

const router = Router();

const createSchema = z.object({
  tenantId: z.string().uuid().nullable().optional(),
  userId: z.string().nullable().optional(),
  subject: z.string().nullable().optional(),
  metadata: z.record(z.unknown()).default({}),
});

const listSchema = z.object({
  tenantId: z.string().uuid().nullable().optional(),
  userId: z.string().nullable().optional(),
  limit: z.coerce.number().min(1).max(500).default(100),
});

router.post(
  "/",
  validateRequest({ body: createSchema }),
  asyncHandler(async (req, res) => {
    const body = getValidatedBody<typeof createSchema>(req);
    const { userId } = getAuth(req);

    const result = await createKeyRotationScheduler({
      ...body,
      createdBy: userId ?? "system",
    });

    res.status(201).json(result);
  }),
);

router.get(
  "/",
  validateRequest({ query: listSchema }),
  asyncHandler(async (req, res) => {
    const query = getValidatedQuery<typeof listSchema>(req);
    res.json({ items: await listKeyRotationScheduler(query) });
  }),
);

export default router;
