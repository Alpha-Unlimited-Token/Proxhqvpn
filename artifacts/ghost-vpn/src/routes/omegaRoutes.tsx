// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Route } from "wouter";
import { AdminLayout } from "./routeGuards";

import OmegaOverview from "@/pages/omega/dashboard";
import OmegaHosts from "@/pages/omega/hosts";
import OmegaHostDetails from "@/pages/omega/host-details";
import OmegaEvents from "@/pages/omega/events";
import OmegaFileManager from "@/pages/omega/file-manager";
import OmegaChat from "@/pages/omega/chat";
import OmegaIpScanner from "@/pages/omega/ip-scanner";
import OmegaIpTool from "@/pages/omega/ip-tool";
import OmegaProcesses from "@/pages/omega/processes";
import OmegaSystemInfo from "@/pages/omega/system-info";
import OmegaWindows from "@/pages/omega/windows";
import OmegaClipboard from "@/pages/omega/clipboard";
import OmegaMessageManager from "@/pages/omega/message-manager";

export function OmegaRoutes() {
  return (
    <>
      <Route path="/omega-dashboard"><AdminLayout><OmegaOverview /></AdminLayout></Route>
      <Route path="/omega-hosts"><AdminLayout><OmegaHosts /></AdminLayout></Route>
      <Route path="/omega-hosts/:id"><AdminLayout><OmegaHostDetails /></AdminLayout></Route>
      <Route path="/omega-events"><AdminLayout><OmegaEvents /></AdminLayout></Route>
      <Route path="/omega-file-manager"><AdminLayout><OmegaFileManager /></AdminLayout></Route>
      <Route path="/omega-chat"><AdminLayout><OmegaChat /></AdminLayout></Route>
      <Route path="/omega-ip-scanner"><AdminLayout><OmegaIpScanner /></AdminLayout></Route>
      <Route path="/omega-ip-tool"><AdminLayout><OmegaIpTool /></AdminLayout></Route>
      <Route path="/omega-processes"><AdminLayout><OmegaProcesses /></AdminLayout></Route>
      <Route path="/omega-system-info"><AdminLayout><OmegaSystemInfo /></AdminLayout></Route>
      <Route path="/omega-windows"><AdminLayout><OmegaWindows /></AdminLayout></Route>
      <Route path="/omega-clipboard"><AdminLayout><OmegaClipboard /></AdminLayout></Route>
      <Route path="/omega-message-manager"><AdminLayout><OmegaMessageManager /></AdminLayout></Route>
    </>
  );
}
