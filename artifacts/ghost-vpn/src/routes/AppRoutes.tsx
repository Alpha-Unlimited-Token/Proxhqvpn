// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Slim route orchestrator — each domain is in its own module.
import { Suspense } from "react";
import { Switch } from "wouter";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LazyFallback } from "./LazyFallback";
import { PublicRoutes } from "./publicRoutes";
import { VpnRoutes } from "./vpnRoutes";
import { CommandCenterRoutes } from "./commandCenterRoutes";
import { AdminRoutes } from "./adminRoutes";
import { NotFoundRoute } from "./NotFoundRoute";

export function AppRoutes() {
  return (
    <TooltipProvider>
      <Suspense fallback={<LazyFallback />}>
        <Switch>
          {PublicRoutes()}
          {VpnRoutes()}
          {CommandCenterRoutes()}
          {AdminRoutes()}
          <NotFoundRoute />
        </Switch>
      </Suspense>
      <Toaster />
    </TooltipProvider>
  );
}
