// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { lazy } from "react";
import { Route } from "wouter";
import { ToolLayout, ProtectedLayout } from "./routeGuards";

import MyVPN from "@/pages/MyVPN";
import KillSwitch from "@/pages/KillSwitch";
import LeakDetection from "@/pages/LeakDetection";
import DnsShield from "@/pages/DnsShield";
import ThreatProtection from "@/pages/ThreatProtection";
import DeviceManager from "@/pages/DeviceManager";
import SplitTunnel from "@/pages/SplitTunnel";
import VpnGate from "@/pages/VpnGate";
import WireGuardConfig from "@/pages/WireGuardConfig";
import Platforms from "@/pages/Platforms";
import Obfuscation from "@/pages/Obfuscation";
import RouterConfig from "@/pages/RouterConfig";
import SmartDns from "@/pages/SmartDns";
import OnionBrowser from "@/pages/OnionBrowser";
import PostQuantum from "@/pages/PostQuantum";
import Daita from "@/pages/Daita";
import DarkWebMonitor from "@/pages/DarkWebMonitor";
import AltIdentity from "@/pages/AltIdentity";
import IpRotator from "@/pages/IpRotator";
import GpsSpoofing from "@/pages/GpsSpoofing";
import PortForwarding from "@/pages/PortForwarding";
import DedicatedIp from "@/pages/DedicatedIp";
import Meshnet from "@/pages/Meshnet";
import DataBrokerScan from "@/pages/DataBrokerScan";
import IpExposure from "@/pages/IpExposure";
import GhostTrap from "@/pages/GhostTrap";
import NetworkMonitor from "@/pages/NetworkMonitor";
import DnsSinkhole from "@/pages/DnsSinkhole";
import ConfigLifecycle from "@/pages/ConfigLifecycle";
import CustomerSecurityDashboard from "@/pages/CustomerSecurityDashboard";
import Manuals from "@/pages/Manuals";

const VpnCoexist = lazy(() => import("@/pages/VpnCoexist"));

export function VpnRoutes() {
  return (
    <>
      <Route path="/my-vpn"><ToolLayout><MyVPN /></ToolLayout></Route>
      <Route path="/kill-switch"><ToolLayout><KillSwitch /></ToolLayout></Route>
      <Route path="/leaks"><ToolLayout><LeakDetection /></ToolLayout></Route>
      <Route path="/dns-shield"><ToolLayout><DnsShield /></ToolLayout></Route>
      <Route path="/threat-protection"><ToolLayout><ThreatProtection /></ToolLayout></Route>
      <Route path="/devices"><ToolLayout><DeviceManager /></ToolLayout></Route>
      <Route path="/split-tunnel"><ToolLayout><SplitTunnel /></ToolLayout></Route>
      <Route path="/vpngate"><ToolLayout><VpnGate /></ToolLayout></Route>
      <Route path="/wireguard"><ToolLayout><WireGuardConfig /></ToolLayout></Route>
      <Route path="/platforms"><ToolLayout><Platforms /></ToolLayout></Route>
      <Route path="/obfuscation"><ToolLayout><Obfuscation /></ToolLayout></Route>
      <Route path="/vpn-coexist"><ToolLayout><VpnCoexist /></ToolLayout></Route>
      <Route path="/router-config"><ToolLayout><RouterConfig /></ToolLayout></Route>
      <Route path="/smart-dns"><ToolLayout><SmartDns /></ToolLayout></Route>
      <Route path="/onion-browser"><ToolLayout><OnionBrowser /></ToolLayout></Route>

      <Route path="/pqc"><ToolLayout><PostQuantum /></ToolLayout></Route>
      <Route path="/daita"><ToolLayout><Daita /></ToolLayout></Route>
      <Route path="/dark-web"><ToolLayout><DarkWebMonitor /></ToolLayout></Route>
      <Route path="/alt-id"><ToolLayout><AltIdentity /></ToolLayout></Route>
      <Route path="/ip-rotator"><ToolLayout><IpRotator /></ToolLayout></Route>

      <Route path="/gps-spoof"><ToolLayout><GpsSpoofing /></ToolLayout></Route>
      <Route path="/port-forward"><ToolLayout><PortForwarding /></ToolLayout></Route>
      <Route path="/dedicated-ip"><ToolLayout><DedicatedIp /></ToolLayout></Route>
      <Route path="/meshnet"><ToolLayout><Meshnet /></ToolLayout></Route>
      <Route path="/data-broker"><ToolLayout><DataBrokerScan /></ToolLayout></Route>

      <Route path="/ip-exposure"><ToolLayout><IpExposure /></ToolLayout></Route>
      <Route path="/ghost-trap"><ToolLayout><GhostTrap /></ToolLayout></Route>
      <Route path="/network-monitor"><ToolLayout><NetworkMonitor /></ToolLayout></Route>
      <Route path="/dns-sinkhole"><ToolLayout><DnsSinkhole /></ToolLayout></Route>
      <Route path="/manuals"><ToolLayout><Manuals /></ToolLayout></Route>

      <Route path="/security-score">
        <ProtectedLayout><CustomerSecurityDashboard /></ProtectedLayout>
      </Route>

      <Route path="/config-lifecycle">
        <ProtectedLayout><ConfigLifecycle /></ProtectedLayout>
      </Route>
    </>
  );
}
