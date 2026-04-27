import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Layout from "@/components/layout/Layout";

import Dashboard from "@/pages/Dashboard";
import NewScan from "@/pages/NewScan";
import ScansList from "@/pages/ScansList";
import ScanDetail from "@/pages/ScanDetail";
import ScanReport from "@/pages/ScanReport";
import VulnerabilitiesList from "@/pages/VulnerabilitiesList";
import QuantumThreats from "@/pages/QuantumThreats";
import PenTest from "@/pages/PenTest";
import LiveScan from "@/pages/LiveScan";
import DeepAnalysis from "@/pages/DeepAnalysis";
import ECDSAScanner from "@/pages/ECDSAScanner";

const queryClient = new QueryClient();

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/scan/new" component={NewScan} />
        <Route path="/scans" component={ScansList} />
        <Route path="/scans/:id" component={ScanDetail} />
        <Route path="/scans/:id/report" component={ScanReport} />
        <Route path="/vulnerabilities" component={VulnerabilitiesList} />
        <Route path="/quantum-threats" component={QuantumThreats} />
        <Route path="/pentest" component={PenTest} />
        <Route path="/live-scan" component={LiveScan} />
        <Route path="/deep-analysis" component={DeepAnalysis} />
        <Route path="/ecdsa-scanner" component={ECDSAScanner} />
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
