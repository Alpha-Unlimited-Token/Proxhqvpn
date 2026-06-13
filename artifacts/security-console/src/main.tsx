// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import React from "react";
import ReactDOM from "react-dom/client";
import { ClerkProvider } from "@clerk/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router, Route, Switch, Redirect } from "wouter";

import OmegaOverview from "../../ghost-vpn/src/pages/omega/dashboard";
import OmegaHosts from "../../ghost-vpn/src/pages/omega/hosts";
import OmegaHostDetails from "../../ghost-vpn/src/pages/omega/host-details";
import OmegaEvents from "../../ghost-vpn/src/pages/omega/events";

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const securityApiBase = import.meta.env.VITE_SECURITY_API_BASE;

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");
}

if (!securityApiBase) {
  throw new Error("Missing VITE_SECURITY_API_BASE");
}

const queryClient = new QueryClient();

function Guard({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-black text-white">
      <div className="border-b border-red-500/20 bg-red-950/20 px-4 py-2 text-xs uppercase tracking-widest text-red-300">
        Security Console — Isolated Admin Deployment
      </div>
      {children}
    </div>
  );
}

function App() {
  return (
    <ClerkProvider publishableKey={clerkPubKey}>
      <QueryClientProvider client={queryClient}>
        <Router>
          <Guard>
            <Switch>
              <Route path="/">
                <Redirect to="/omega-dashboard" />
              </Route>

              <Route path="/omega-dashboard">
                <OmegaOverview />
              </Route>

              <Route path="/omega-hosts">
                <OmegaHosts />
              </Route>

              <Route path="/omega-hosts/:id">
                <OmegaHostDetails />
              </Route>

              <Route path="/omega-events">
                <OmegaEvents />
              </Route>

              <Route>
                <div className="p-8 font-mono text-sm text-red-300">
                  404 — Security console route not found
                </div>
              </Route>
            </Switch>
          </Guard>
        </Router>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
