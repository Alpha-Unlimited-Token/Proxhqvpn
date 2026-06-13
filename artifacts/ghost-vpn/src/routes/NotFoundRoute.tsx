// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { ProtectedLayout } from "./routeGuards";

export function NotFoundRoute() {
  return (
    <ProtectedLayout>
      <div className="flex items-center justify-center h-64 font-mono text-primary/40 text-sm uppercase tracking-widest">
        404 — Route Not Found
      </div>
    </ProtectedLayout>
  );
}
