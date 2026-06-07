// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import Dashboard from "@/pages/dashboard";
import Hosts from "@/pages/hosts";
import HostDetails from "@/pages/host-details";
import Events from "@/pages/events";
import Keylogger from "@/pages/keylogger";
import ScreenCapture from "@/pages/screen-capture";
import FileManager from "@/pages/file-manager";
import Chat from "@/pages/chat";
import IpScanner from "@/pages/ip-scanner";
import IpTool from "@/pages/ip-tool";
import Processes from "@/pages/processes";
import SystemInfo from "@/pages/system-info";
import Windows from "@/pages/windows";
import ClipboardPage from "@/pages/clipboard";
import MessageManager from "@/pages/message-manager";
import RemoteCommands from "@/pages/remote-commands";
import ProxhqTools from "@/pages/proxhq-tools";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/hosts" component={Hosts} />
      <Route path="/hosts/:id" component={HostDetails} />
      <Route path="/events" component={Events} />
      <Route path="/keylogger" component={Keylogger} />
      <Route path="/screen-capture" component={ScreenCapture} />
      <Route path="/file-manager" component={FileManager} />
      <Route path="/chat" component={Chat} />
      <Route path="/ip-scanner" component={IpScanner} />
      <Route path="/ip-tool" component={IpTool} />
      <Route path="/processes" component={Processes} />
      <Route path="/system-info" component={SystemInfo} />
      <Route path="/windows" component={Windows} />
      <Route path="/clipboard" component={ClipboardPage} />
      <Route path="/message-manager" component={MessageManager} />
      <Route path="/remote-commands" component={RemoteCommands} />
      <Route path="/proxhq-tools" component={ProxhqTools} />
      <Route component={NotFound} />
    </Switch>
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
