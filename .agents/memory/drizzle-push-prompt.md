---
name: drizzle-kit push interactive prompt
description: drizzle-kit push stalls on an interactive rename prompt when omega_* tables exist in the DB; workaround is direct SQL.
---

When adding new Drizzle schema tables in this workspace, `pnpm --filter @workspace/db run push` and `push-force` both stall waiting for interactive terminal input. The prompt asks whether each new table is a rename of an existing `omega_*` table. Neither Enter nor `--force` skips it in non-TTY bash.

**Why:** The DB has legacy omega_* tables that drizzle-kit interprets as rename candidates for any newly-named table.

**How to apply:** For any new schema table, bypass drizzle-kit entirely and create the table with direct SQL via `executeSql`:

```sql
CREATE TABLE IF NOT EXISTS my_new_table (
  id SERIAL PRIMARY KEY,
  ...
);
CREATE INDEX IF NOT EXISTS idx_my_new_table_field ON my_new_table(field);
```

Also create any required enums first using `DO $$ BEGIN IF NOT EXISTS ... END $$`.

After creating via SQL, still add the Drizzle schema definition to `lib/db/src/schema/*.ts` (and ensure the schema file is re-exported from `schema/index.ts`), then run `pnpm run typecheck:libs` to emit updated `.d.ts` files. The Drizzle ORM will work correctly — it reads the live DB schema at runtime.
