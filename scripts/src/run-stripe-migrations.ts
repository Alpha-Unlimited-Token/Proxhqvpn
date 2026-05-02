// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { runMigrations } from "stripe-replit-sync";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL required");

console.log("Running Stripe schema migrations...");
await runMigrations({ databaseUrl } as any);
console.log("Stripe schema migrations complete.");
