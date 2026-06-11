// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/Dashboard";
import Nodes from "@/pages/Nodes";
import Attackers from "@/pages/Attackers";
import Sessions from "@/pages/Sessions";
import Commands from "@/pages/Commands";
import Files from "@/pages/Files";
import IOCs from "@/pages/IOCs";
import Alerts from "@/pages/Alerts";
import Layout from "@/components/Layout";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 15_000,
    },
  },
});

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/nodes" component={Nodes} />
        <Route path="/attackers" component={Attackers} />
        <Route path="/sessions" component={Sessions} />
        <Route path="/commands" component={Commands} />
        <Route path="/files" component={Files} />
        <Route path="/iocs" component={IOCs} />
        <Route path="/alerts" component={Alerts} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
