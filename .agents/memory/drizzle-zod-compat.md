---
name: drizzle-zod + zod v3 incompatibility
description: createInsertSchema from drizzle-zod returns Zod v4 types; using z.infer<> from "zod" (v3) against them causes TS2344 type constraint errors at compile time.
---

## The Rule
Do NOT use `import { z } from "zod/v4"` (project rule: always use `"zod"` not `"zod/v4"`).
Do NOT use `z.infer<typeof insertXyzSchema>` when `insertXyzSchema` comes from `createInsertSchema()` (drizzle-zod).

**Why:** drizzle-zod internally uses Zod v4 types. The workspace uses Zod v3 as `"zod"`. The two ZodType generics are structurally incompatible, causing TS2344: "Type X does not satisfy the constraint ZodType<any,any,any>".

**How to apply:**
- Remove `import { createInsertSchema } from "drizzle-zod"` from lib schema files.
- Remove `import { z } from "zod"` / `"zod/v4"` from pure schema files if only used for type inference.
- Replace `z.infer<typeof insertXyzSchema>` with `typeof xyzTable.$inferInsert`.
- Replace `z.infer<typeof selectXyzSchema>` with `typeof xyzTable.$inferSelect`.
- If you need runtime Zod validation in route handlers, define the schema inline in the handler file using `import { z } from "zod"` (v3) — not derived from drizzle-zod.
