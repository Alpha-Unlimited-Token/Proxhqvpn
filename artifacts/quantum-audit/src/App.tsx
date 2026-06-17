// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
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
import SchemeAuditor from "@/pages/SchemeAuditor";
import BatchScan from "@/pages/BatchScan";
import BatchJobs from "@/pages/BatchJobs";
import ThreatScanner from "@/pages/ThreatScanner";
import SpiderCrawler from "@/pages/SpiderCrawler";
import UnifiedScanner from "@/pages/UnifiedScanner";
import ProxyScanner from "@/pages/ProxyScanner";
import SignatureMiner from "@/pages/SignatureMiner";
import AutonomousScan from "@/pages/AutonomousScan";
import KeyRecovery from "@/pages/KeyRecovery";
import WalletScanner from "@/pages/WalletScanner";
import WalletIntel from "@/pages/WalletIntel";
import WalletWebSpider from "@/pages/WalletWebSpider";

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
        <Route path="/scheme-auditor" component={SchemeAuditor} />
        <Route path="/batch-scan" component={BatchScan} />
        <Route path="/batch-jobs" component={BatchJobs} />
        <Route path="/threat-scanner" component={ThreatScanner} />
        <Route path="/spider" component={SpiderCrawler} />
        <Route path="/unified" component={UnifiedScanner} />
        <Route path="/proxy-scanner" component={ProxyScanner} />
        <Route path="/sig-miner" component={SignatureMiner} />
        <Route path="/autonomous" component={AutonomousScan} />
        <Route path="/key-recovery" component={KeyRecovery} />
        <Route path="/wallet-scanner" component={WalletScanner} />
        <Route path="/wallet-intel" component={WalletIntel} />
        <Route path="/wallet-web-spider" component={WalletWebSpider} />
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
