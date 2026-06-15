// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Route } from "wouter";
import { AdminLayout } from "./routeGuards";

import NodeManager from "@/pages/NodeManager";
import BeaconAlerts from "@/pages/BeaconAlerts";
import SilkWeb from "@/pages/SilkWeb";
import Firewall from "@/pages/Firewall";
import SystemMonitor from "@/pages/SystemMonitor";
import Terminal from "@/pages/Terminal";
import SqlInterface from "@/pages/SqlInterface";
import UserManagement from "@/pages/UserManagement";
import Employees from "@/pages/Employees";
import Setup from "@/pages/Setup";
import NodeTrustEngine from "@/pages/NodeTrustEngine";
import AttackerIntelligence from "@/pages/AttackerIntelligence";

export function AdminRoutes() {
  return (
    <>
      <Route path="/admin/ghost-trap"><AdminLayout><AttackerIntelligence /></AdminLayout></Route>
      <Route path="/node-trust"><AdminLayout><NodeTrustEngine /></AdminLayout></Route>
      <Route path="/nodes"><AdminLayout><NodeManager /></AdminLayout></Route>
      <Route path="/beacons"><AdminLayout><BeaconAlerts /></AdminLayout></Route>
      <Route path="/silkweb"><AdminLayout><SilkWeb /></AdminLayout></Route>
      <Route path="/firewall"><AdminLayout><Firewall /></AdminLayout></Route>
      <Route path="/monitor"><AdminLayout><SystemMonitor /></AdminLayout></Route>
      <Route path="/terminal"><AdminLayout><Terminal /></AdminLayout></Route>
      <Route path="/sql"><AdminLayout><SqlInterface /></AdminLayout></Route>
      <Route path="/user-management"><AdminLayout><UserManagement /></AdminLayout></Route>
      <Route path="/employees"><AdminLayout><Employees /></AdminLayout></Route>
      <Route path="/setup"><AdminLayout><Setup /></AdminLayout></Route>
    </>
  );
}
