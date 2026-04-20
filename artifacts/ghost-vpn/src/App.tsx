import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { Layout } from "./components/layout/Layout";

import Dashboard from "@/pages/Dashboard";
import NodeManager from "@/pages/NodeManager";
import BeaconAlerts from "@/pages/BeaconAlerts";
import SilkWeb from "@/pages/SilkWeb";
import Firewall from "@/pages/Firewall";
import WireGuardConfig from "@/pages/WireGuardConfig";
import SystemMonitor from "@/pages/SystemMonitor";
import Terminal from "@/pages/Terminal";
import SqlInterface from "@/pages/SqlInterface";
import ProxyConfig from "@/pages/ProxyConfig";
import OnionBrowser from "@/pages/OnionBrowser";
import KillSwitch from "@/pages/KillSwitch";
import LeakDetection from "@/pages/LeakDetection";
import ThreatIntel from "@/pages/ThreatIntel";
import SplitTunnel from "@/pages/SplitTunnel";
import Obfuscation from "@/pages/Obfuscation";
import SecurityAudit from "@/pages/SecurityAudit";
import VpnCoexist from "@/pages/VpnCoexist";

const queryClient = new QueryClient();

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/nodes" component={NodeManager} />
        <Route path="/beacons" component={BeaconAlerts} />
        <Route path="/silkweb" component={SilkWeb} />
        <Route path="/firewall" component={Firewall} />
        <Route path="/wireguard" component={WireGuardConfig} />
        <Route path="/monitor" component={SystemMonitor} />
        <Route path="/terminal" component={Terminal} />
        <Route path="/sql" component={SqlInterface} />
        <Route path="/proxy" component={ProxyConfig} />
        <Route path="/onion-browser" component={OnionBrowser} />
        <Route path="/kill-switch" component={KillSwitch} />
        <Route path="/leaks" component={LeakDetection} />
        <Route path="/threat-intel" component={ThreatIntel} />
        <Route path="/split-tunnel" component={SplitTunnel} />
        <Route path="/obfuscation" component={Obfuscation} />
        <Route path="/security-audit" component={SecurityAudit} />
        <Route path="/vpn-coexist" component={VpnCoexist} />
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
