// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Central route table — all page imports and <Route> definitions live here.
// App.tsx owns only the ClerkProvider/Router shell.
import React, { lazy, Suspense } from "react";
import { Switch, Route, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useUser } from "@clerk/react";

import { ClerkQueryClientCacheInvalidator } from "@/routes/queryInvalidator";
import { ScrollToTop } from "@/routes/ScrollToTop";
import { SignInPage, SignUpPage } from "@/routes/authScreens";
import { AppLanding } from "@/routes/AppLanding";
import {
  PublicLayout,
  ProtectedLayout,
  ToolLayout,
  CcLayout,
  AdminLayout,
} from "@/routes/routeGuards";

// ── Eager page imports ────────────────────────────────────────────────────────
import Home from "@/pages/Home";
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
import AiAudit from "@/pages/AiAudit";
import AccountSecurityCenter from "@/pages/AccountSecurityCenter";
import CommandGovernance from "@/pages/CommandGovernance";
import DependencyMap from "@/pages/DependencyMap";
import NodeTrustEngine from "@/pages/NodeTrustEngine";
import CustomerSecurityDashboard from "@/pages/CustomerSecurityDashboard";
import FirewallPolicyCompiler from "@/pages/FirewallPolicyCompiler";
import DriftMonitor from "@/pages/DriftMonitor";
import EventGraph from "@/pages/EventGraph";
import ServiceBus from "@/pages/ServiceBus";
import DeviceTrustEngine from "@/pages/DeviceTrustEngine";
import FirewallCore from "@/pages/FirewallCore";
import ConfigLifecycle from "@/pages/ConfigLifecycle";
import VpnGate from "@/pages/VpnGate";
import Platforms from "@/pages/Platforms";
import DeviceManager from "@/pages/DeviceManager";
import SmartDns from "@/pages/SmartDns";
import DnsShield from "@/pages/DnsShield";
import RouterConfig from "@/pages/RouterConfig";
import Account from "@/pages/Account";
import MyVPN from "@/pages/MyVPN";
import AutoSetup from "@/pages/AutoSetup";
import GhostTrap from "@/pages/GhostTrap";
import Pricing from "@/pages/Pricing";
import SqlmapScanner from "@/pages/SqlmapScanner";
import AlphaTools from "@/pages/AlphaTools";
import ToolRunner from "@/pages/ToolRunner";
import ToolHistory from "@/pages/ToolHistory";
import ToolScope from "@/pages/ToolScope";
import ScanScheduler from "@/pages/ScanScheduler";
import ToolApprovals from "@/pages/ToolApprovals";
import NodeHealth from "@/pages/NodeHealth";
import HttpProbe from "@/pages/HttpProbe";
import DirectoryFuzzer from "@/pages/DirectoryFuzzer";
import SubdomainScan from "@/pages/SubdomainScan";
import RedTeamScan from "@/pages/RedTeamScan";
import HackAnon from "@/pages/HackAnon";
import Employees from "@/pages/Employees";
import UserManagement from "@/pages/UserManagement";
import ThreatProtection from "@/pages/ThreatProtection";
import Setup from "@/pages/Setup";
import Ambassadors from "@/pages/Ambassadors";
import AmbassadorApply from "@/pages/AmbassadorApply";
import AmbassadorDashboard from "@/pages/AmbassadorDashboard";
import CheckoutSuccess from "@/pages/CheckoutSuccess";
import Encoder from "@/pages/Encoder";
import Comparer from "@/pages/Comparer";
import PayloadGen from "@/pages/PayloadGen";
import CveSearch from "@/pages/CveSearch";
import Intruder from "@/pages/Intruder";
import IpExposure from "@/pages/IpExposure";
import AmbassadorHandbook from "@/pages/AmbassadorHandbook";
import EmployeeHandbook from "@/pages/EmployeeHandbook";
import GhostTrace from "@/pages/GhostTrace";
import GhostChain from "@/pages/GhostChain";
import NetworkMonitor from "@/pages/NetworkMonitor";
import DnsSinkhole from "@/pages/DnsSinkhole";
import Siem from "@/pages/Siem";
import PostQuantum from "@/pages/PostQuantum";
import Daita from "@/pages/Daita";
import DarkWebMonitor from "@/pages/DarkWebMonitor";
import AltIdentity from "@/pages/AltIdentity";
import IpRotator from "@/pages/IpRotator";
import SslTlsAnalyzer from "@/pages/SslTlsAnalyzer";
import JwtAnalyzer from "@/pages/JwtAnalyzer";
import SqliScanner from "@/pages/SqliScanner";
import IacScanner from "@/pages/IacScanner";
import HttpInterceptor from "@/pages/HttpInterceptor";
import ApiSecurityTester from "@/pages/ApiSecurityTester";
import GpsSpoofing from "@/pages/GpsSpoofing";
import PortForwarding from "@/pages/PortForwarding";
import DedicatedIp from "@/pages/DedicatedIp";
import Meshnet from "@/pages/Meshnet";
import DataBrokerScan from "@/pages/DataBrokerScan";
import OastTester from "@/pages/OastTester";
import OastServer from "@/pages/OastServer";
import WafBypass from "@/pages/WafBypass";
import TransparencyReport from "@/pages/TransparencyReport";
import DepScanner from "@/pages/DepScanner";
import TokenSequencer from "@/pages/TokenSequencer";
import WsTester from "@/pages/WsTester";
import SastAnalyzer from "@/pages/SastAnalyzer";
import QuantumAuditPage from "@/pages/QuantumAudit";
import GhostPentest from "@/pages/GhostPentest";
import DeceptionEngine from "@/pages/DeceptionEngine";
import RequestMind from "@/pages/RequestMind";
import SocCopilot from "@/pages/SocCopilot";
import CodeSentinel from "@/pages/CodeSentinel";
import AgentStrike from "@/pages/AgentStrike";
import LlmProbe from "@/pages/LlmProbe";
import AiShield from "@/pages/AiShield";
import AISecuritySuite from "@/pages/AISecuritySuite";
import VpnTracker from "@/pages/VpnTracker";
import AnonAuth from "@/pages/AnonAuth";
import AnonDashboard from "@/pages/AnonDashboard";
import AnonUpgrade from "@/pages/AnonUpgrade";

// ── Omega C2 pages ────────────────────────────────────────────────────────────
import OmegaOverview from "@/pages/omega/dashboard";
import OmegaHosts from "@/pages/omega/hosts";
import OmegaHostDetails from "@/pages/omega/host-details";
import OmegaEvents from "@/pages/omega/events";
import OmegaKeylogger from "@/pages/omega/keylogger";
import OmegaScreenCapture from "@/pages/omega/screen-capture";
import OmegaFileManager from "@/pages/omega/file-manager";
import OmegaChat from "@/pages/omega/chat";
import OmegaIpScanner from "@/pages/omega/ip-scanner";
import OmegaIpTool from "@/pages/omega/ip-tool";
import OmegaProcesses from "@/pages/omega/processes";
import OmegaSystemInfo from "@/pages/omega/system-info";
import OmegaWindows from "@/pages/omega/windows";
import OmegaClipboard from "@/pages/omega/clipboard";
import OmegaMessageManager from "@/pages/omega/message-manager";
import OmegaRemoteCommands from "@/pages/omega/remote-commands";

// ── Lazy-loaded heavy pages ───────────────────────────────────────────────────
const VpnCoexist      = lazy(() => import("@/pages/VpnCoexist"));
const Downloads       = lazy(() => import("@/pages/Downloads"));
const BrowserExtension = lazy(() => import("@/pages/BrowserExtension"));
const UserGuide       = lazy(() => import("@/pages/UserGuide"));
const ParrotTools     = lazy(() => import("@/pages/ParrotTools"));
const ImAutomation    = lazy(() => import("@/pages/ImAutomation"));
const OsintRecon      = lazy(() => import("@/pages/OsintRecon"));
const UsernameIntel   = lazy(() => import("@/pages/UsernameIntel"));
const CanaryTokens    = lazy(() => import("@/pages/CanaryTokens"));
const ExploitImporter = lazy(() => import("@/pages/ExploitImporter"));
const OmniStrike      = lazy(() => import("@/pages/OmniStrike"));
const WafAnalyzer     = lazy(() => import("@/pages/WafAnalyzer"));
const SocialBreach    = lazy(() => import("@/pages/SocialBreach"));
const BugBountyHub    = lazy(() => import("@/pages/BugBountyHub"));
const Manuals         = lazy(() => import("@/pages/Manuals"));

// ── Shared layout ─────────────────────────────────────────────────────────────
import Layout from "@/components/layout/Layout";

// ─────────────────────────────────────────────────────────────────────────────

const queryClient = new QueryClient();

const LazyFallback = () => (
  <div className="min-h-screen bg-black flex items-center justify-center">
    <div className="flex flex-col items-center gap-3">
      <div className="w-8 h-8 rounded-full border-2 border-primary/40 border-t-primary animate-spin" />
      <span className="text-primary/60 text-xs font-mono">Loading…</span>
    </div>
  </div>
);

function HomeRedirect() {
  const { isSignedIn, isLoaded } = useUser();
  if (!isLoaded) return <Home />;
  if (isSignedIn) return <Redirect to="/app" />;
  return <Home />;
}

export function AppRoutes() {
  return (
    <QueryClientProvider client={queryClient}>
      <ClerkQueryClientCacheInvalidator />
      <ScrollToTop />
      <TooltipProvider>
        <Suspense fallback={<LazyFallback />}>
          <Switch>
            {/* ── Auth ──────────────────────────────────────────────────────── */}
            <Route path="/" component={HomeRedirect} />
            <Route path="/sign-in/*?" component={SignInPage} />
            <Route path="/sign-up/*?" component={SignUpPage} />
            <Route path="/anon-auth" component={AnonAuth} />
            <Route path="/anon" component={AnonDashboard} />
            <Route path="/anon/upgrade" component={AnonUpgrade} />

            {/* ── Smart post-login redirect — reads tier ─────────────────── */}
            <Route path="/app">
              <ProtectedLayout><AppLanding /></ProtectedLayout>
            </Route>

            {/* ── Public — no login needed ──────────────────────────────── */}
            <Route path="/pricing">
              <PublicLayout><Pricing /></PublicLayout>
            </Route>
            <Route path="/downloads">
              <PublicLayout><Downloads /></PublicLayout>
            </Route>
            <Route path="/browser-extension">
              <PublicLayout><BrowserExtension /></PublicLayout>
            </Route>
            <Route path="/guide">
              <PublicLayout><UserGuide /></PublicLayout>
            </Route>
            <Route path="/handbook/ambassador">
              <PublicLayout><AmbassadorHandbook /></PublicLayout>
            </Route>
            <Route path="/ambassadors">
              <PublicLayout><Ambassadors /></PublicLayout>
            </Route>
            <Route path="/transparency">
              <Layout><TransparencyReport /></Layout>
            </Route>

            {/* ── Requires sign-in (any tier) ───────────────────────────── */}
            <Route path="/account">
              <ProtectedLayout><Account /></ProtectedLayout>
            </Route>
            <Route path="/ambassador/apply">
              <ProtectedLayout><AmbassadorApply /></ProtectedLayout>
            </Route>
            <Route path="/checkout/success">
              <ProtectedLayout><CheckoutSuccess /></ProtectedLayout>
            </Route>
            <Route path="/account-security">
              <ProtectedLayout><AccountSecurityCenter /></ProtectedLayout>
            </Route>
            <Route path="/security-score">
              <ProtectedLayout><CustomerSecurityDashboard /></ProtectedLayout>
            </Route>
            <Route path="/config-lifecycle">
              <ProtectedLayout><ConfigLifecycle /></ProtectedLayout>
            </Route>
            <Route path="/autosetup">
              <AutoSetup />
            </Route>

            {/* ── VPN Basic — any active subscription ───────────────────── */}
            <Route path="/my-vpn">
              <ToolLayout><MyVPN /></ToolLayout>
            </Route>
            <Route path="/kill-switch">
              <ToolLayout><KillSwitch /></ToolLayout>
            </Route>
            <Route path="/leaks">
              <ToolLayout><LeakDetection /></ToolLayout>
            </Route>
            <Route path="/dns-shield">
              <ToolLayout><DnsShield /></ToolLayout>
            </Route>
            <Route path="/threat-protection">
              <ToolLayout><ThreatProtection /></ToolLayout>
            </Route>
            <Route path="/devices">
              <ToolLayout><DeviceManager /></ToolLayout>
            </Route>
            <Route path="/split-tunnel">
              <ToolLayout><SplitTunnel /></ToolLayout>
            </Route>
            <Route path="/vpngate">
              <ToolLayout><VpnGate /></ToolLayout>
            </Route>
            <Route path="/wireguard">
              <ToolLayout><WireGuardConfig /></ToolLayout>
            </Route>
            <Route path="/platforms">
              <ToolLayout><Platforms /></ToolLayout>
            </Route>
            <Route path="/obfuscation">
              <ToolLayout><Obfuscation /></ToolLayout>
            </Route>
            <Route path="/vpn-coexist">
              <ToolLayout><VpnCoexist /></ToolLayout>
            </Route>
            <Route path="/router-config">
              <ToolLayout><RouterConfig /></ToolLayout>
            </Route>
            <Route path="/smart-dns">
              <ToolLayout><SmartDns /></ToolLayout>
            </Route>
            <Route path="/onion-browser">
              <ToolLayout><OnionBrowser /></ToolLayout>
            </Route>
            <Route path="/ip-exposure">
              <ToolLayout><IpExposure /></ToolLayout>
            </Route>
            <Route path="/ghost-trap">
              <ToolLayout><GhostTrap /></ToolLayout>
            </Route>
            <Route path="/network-monitor">
              <ToolLayout><NetworkMonitor /></ToolLayout>
            </Route>
            <Route path="/dns-sinkhole">
              <ToolLayout><DnsSinkhole /></ToolLayout>
            </Route>
            <Route path="/manuals">
              <ToolLayout><Manuals /></ToolLayout>
            </Route>
            <Route path="/ambassador/dashboard">
              <ToolLayout><AmbassadorDashboard /></ToolLayout>
            </Route>

            {/* ── Privacy Suite ─────────────────────────────────────────── */}
            <Route path="/pqc">
              <ToolLayout><PostQuantum /></ToolLayout>
            </Route>
            <Route path="/daita">
              <ToolLayout><Daita /></ToolLayout>
            </Route>
            <Route path="/dark-web">
              <ToolLayout><DarkWebMonitor /></ToolLayout>
            </Route>
            <Route path="/alt-id">
              <ToolLayout><AltIdentity /></ToolLayout>
            </Route>
            <Route path="/ip-rotator">
              <ToolLayout><IpRotator /></ToolLayout>
            </Route>

            {/* ── VPN Gap Features ──────────────────────────────────────── */}
            <Route path="/gps-spoof">
              <ToolLayout><GpsSpoofing /></ToolLayout>
            </Route>
            <Route path="/port-forward">
              <ToolLayout><PortForwarding /></ToolLayout>
            </Route>
            <Route path="/dedicated-ip">
              <ToolLayout><DedicatedIp /></ToolLayout>
            </Route>
            <Route path="/meshnet">
              <ToolLayout><Meshnet /></ToolLayout>
            </Route>
            <Route path="/data-broker">
              <ToolLayout><DataBrokerScan /></ToolLayout>
            </Route>

            {/* ── Command Center Pro ────────────────────────────────────── */}
            <Route path="/dashboard">
              <CcLayout><Dashboard /></CcLayout>
            </Route>
            <Route path="/proxy">
              <CcLayout><ProxyConfig /></CcLayout>
            </Route>
            <Route path="/sqlmap">
              <CcLayout><SqlmapScanner /></CcLayout>
            </Route>
            <Route path="/alpha-tools">
              <CcLayout><AlphaTools /></CcLayout>
            </Route>
            <Route path="/tool-runner">
              <CcLayout><ToolRunner /></CcLayout>
            </Route>
            <Route path="/tool-history">
              <CcLayout><ToolHistory /></CcLayout>
            </Route>
            <Route path="/tool-scope">
              <CcLayout><ToolScope /></CcLayout>
            </Route>
            <Route path="/scan-scheduler">
              <CcLayout><ScanScheduler /></CcLayout>
            </Route>
            <Route path="/tool-scheduler">
              <CcLayout><ScanScheduler /></CcLayout>
            </Route>
            <Route path="/node-health">
              <CcLayout><NodeHealth /></CcLayout>
            </Route>
            <Route path="/security-audit">
              <CcLayout><SecurityAudit /></CcLayout>
            </Route>
            <Route path="/ai-audit">
              <CcLayout><AiAudit /></CcLayout>
            </Route>
            <Route path="/command-governance">
              <CcLayout><CommandGovernance /></CcLayout>
            </Route>
            <Route path="/dependency-map">
              <CcLayout><DependencyMap /></CcLayout>
            </Route>
            <Route path="/firewall-compiler">
              <CcLayout><FirewallPolicyCompiler /></CcLayout>
            </Route>
            <Route path="/drift-monitor">
              <CcLayout><DriftMonitor /></CcLayout>
            </Route>
            <Route path="/event-graph">
              <CcLayout><EventGraph /></CcLayout>
            </Route>
            <Route path="/service-bus">
              <CcLayout><ServiceBus /></CcLayout>
            </Route>
            <Route path="/device-trust">
              <CcLayout><DeviceTrustEngine /></CcLayout>
            </Route>
            <Route path="/firewall-core">
              <CcLayout><FirewallCore /></CcLayout>
            </Route>
            <Route path="/threat-intel">
              <CcLayout><ThreatIntel /></CcLayout>
            </Route>
            <Route path="/http-probe">
              <CcLayout><HttpProbe /></CcLayout>
            </Route>
            <Route path="/dir-fuzzer">
              <CcLayout><DirectoryFuzzer /></CcLayout>
            </Route>
            <Route path="/subdomain-scan">
              <CcLayout><SubdomainScan /></CcLayout>
            </Route>
            <Route path="/encoder">
              <CcLayout><Encoder /></CcLayout>
            </Route>
            <Route path="/comparer">
              <CcLayout><Comparer /></CcLayout>
            </Route>
            <Route path="/payloads">
              <CcLayout><PayloadGen /></CcLayout>
            </Route>
            <Route path="/cve-search">
              <CcLayout><CveSearch /></CcLayout>
            </Route>
            <Route path="/intruder">
              <CcLayout><Intruder /></CcLayout>
            </Route>
            <Route path="/ghost-trace">
              <CcLayout><GhostTrace /></CcLayout>
            </Route>
            <Route path="/ghost-chain">
              <CcLayout><GhostChain /></CcLayout>
            </Route>
            <Route path="/siem">
              <CcLayout><Siem /></CcLayout>
            </Route>
            <Route path="/osint">
              <CcLayout><OsintRecon /></CcLayout>
            </Route>
            <Route path="/username-intel">
              <CcLayout><UsernameIntel /></CcLayout>
            </Route>
            <Route path="/canary">
              <CcLayout><CanaryTokens /></CcLayout>
            </Route>
            <Route path="/exploit-import">
              <CcLayout><ExploitImporter /></CcLayout>
            </Route>
            <Route path="/omnistrike">
              <CcLayout><OmniStrike /></CcLayout>
            </Route>
            <Route path="/waf">
              <CcLayout><WafAnalyzer /></CcLayout>
            </Route>
            <Route path="/social-breach">
              <CcLayout><SocialBreach /></CcLayout>
            </Route>
            <Route path="/bug-bounty">
              <CcLayout><BugBountyHub /></CcLayout>
            </Route>
            <Route path="/parrot-tools">
              <CcLayout><ParrotTools /></CcLayout>
            </Route>
            <Route path="/im-auto">
              <CcLayout><ImAutomation /></CcLayout>
            </Route>
            <Route path="/redteam-scan">
              <CcLayout><RedTeamScan /></CcLayout>
            </Route>
            <Route path="/hackanon">
              <CcLayout><HackAnon /></CcLayout>
            </Route>
            <Route path="/vpn-tracker">
              <CcLayout><VpnTracker /></CcLayout>
            </Route>

            {/* ── Dev Security Tools ────────────────────────────────────── */}
            <Route path="/ssl-tls">
              <CcLayout><SslTlsAnalyzer /></CcLayout>
            </Route>
            <Route path="/jwt-analyzer">
              <CcLayout><JwtAnalyzer /></CcLayout>
            </Route>
            <Route path="/sqli-scanner">
              <CcLayout><SqliScanner /></CcLayout>
            </Route>
            <Route path="/iac-scan">
              <CcLayout><IacScanner /></CcLayout>
            </Route>
            <Route path="/http-interceptor">
              <CcLayout><HttpInterceptor /></CcLayout>
            </Route>
            <Route path="/api-tester">
              <CcLayout><ApiSecurityTester /></CcLayout>
            </Route>
            <Route path="/oast-tester">
              <CcLayout><OastTester /></CcLayout>
            </Route>
            <Route path="/oast-server">
              <CcLayout><OastServer /></CcLayout>
            </Route>
            <Route path="/waf-bypass">
              <CcLayout><WafBypass /></CcLayout>
            </Route>
            <Route path="/dep-scanner">
              <CcLayout><DepScanner /></CcLayout>
            </Route>
            <Route path="/token-seq">
              <CcLayout><TokenSequencer /></CcLayout>
            </Route>
            <Route path="/ws-tester">
              <CcLayout><WsTester /></CcLayout>
            </Route>
            <Route path="/sast">
              <CcLayout><SastAnalyzer /></CcLayout>
            </Route>
            <Route path="/quantum-audit">
              <CcLayout><QuantumAuditPage /></CcLayout>
            </Route>

            {/* ── AI Security Suite ─────────────────────────────────────── */}
            <Route path="/ghost-pentest">
              <CcLayout><GhostPentest /></CcLayout>
            </Route>
            <Route path="/deception-engine">
              <CcLayout><DeceptionEngine /></CcLayout>
            </Route>
            <Route path="/request-mind">
              <CcLayout><RequestMind /></CcLayout>
            </Route>
            <Route path="/soc-copilot">
              <CcLayout><SocCopilot /></CcLayout>
            </Route>
            <Route path="/code-sentinel">
              <CcLayout><CodeSentinel /></CcLayout>
            </Route>
            <Route path="/agent-strike">
              <CcLayout><AgentStrike /></CcLayout>
            </Route>
            <Route path="/llm-probe">
              <CcLayout><LlmProbe /></CcLayout>
            </Route>
            <Route path="/ai-shield">
              <CcLayout><AiShield /></CcLayout>
            </Route>
            <Route path="/ai-security-suite">
              <CcLayout><AISecuritySuite /></CcLayout>
            </Route>

            {/* ── Omega C2 Dashboard ────────────────────────────────────── */}
            <Route path="/omega-dashboard">
              <CcLayout><OmegaOverview /></CcLayout>
            </Route>
            <Route path="/omega-hosts/:id">
              <CcLayout><OmegaHostDetails /></CcLayout>
            </Route>
            <Route path="/omega-hosts">
              <CcLayout><OmegaHosts /></CcLayout>
            </Route>
            <Route path="/omega-events">
              <CcLayout><OmegaEvents /></CcLayout>
            </Route>
            <Route path="/omega-keylogger">
              <CcLayout><OmegaKeylogger /></CcLayout>
            </Route>
            <Route path="/omega-screen-capture">
              <CcLayout><OmegaScreenCapture /></CcLayout>
            </Route>
            <Route path="/omega-file-manager">
              <CcLayout><OmegaFileManager /></CcLayout>
            </Route>
            <Route path="/omega-chat">
              <CcLayout><OmegaChat /></CcLayout>
            </Route>
            <Route path="/omega-ip-scanner">
              <CcLayout><OmegaIpScanner /></CcLayout>
            </Route>
            <Route path="/omega-ip-tool">
              <CcLayout><OmegaIpTool /></CcLayout>
            </Route>
            <Route path="/omega-processes">
              <CcLayout><OmegaProcesses /></CcLayout>
            </Route>
            <Route path="/omega-system-info">
              <CcLayout><OmegaSystemInfo /></CcLayout>
            </Route>
            <Route path="/omega-windows">
              <CcLayout><OmegaWindows /></CcLayout>
            </Route>
            <Route path="/omega-clipboard">
              <CcLayout><OmegaClipboard /></CcLayout>
            </Route>
            <Route path="/omega-message-manager">
              <CcLayout><OmegaMessageManager /></CcLayout>
            </Route>
            <Route path="/omega-remote-commands">
              <CcLayout><OmegaRemoteCommands /></CcLayout>
            </Route>

            {/* ── Admin-only ────────────────────────────────────────────── */}
            <Route path="/handbook/employee">
              <AdminLayout><EmployeeHandbook /></AdminLayout>
            </Route>
            <Route path="/tool-approvals">
              <AdminLayout><ToolApprovals /></AdminLayout>
            </Route>
            <Route path="/node-trust">
              <AdminLayout><NodeTrustEngine /></AdminLayout>
            </Route>
            <Route path="/nodes">
              <AdminLayout><NodeManager /></AdminLayout>
            </Route>
            <Route path="/beacons">
              <AdminLayout><BeaconAlerts /></AdminLayout>
            </Route>
            <Route path="/silkweb">
              <AdminLayout><SilkWeb /></AdminLayout>
            </Route>
            <Route path="/firewall">
              <AdminLayout><Firewall /></AdminLayout>
            </Route>
            <Route path="/monitor">
              <AdminLayout><SystemMonitor /></AdminLayout>
            </Route>
            <Route path="/terminal">
              <AdminLayout><Terminal /></AdminLayout>
            </Route>
            <Route path="/sql">
              <AdminLayout><SqlInterface /></AdminLayout>
            </Route>
            <Route path="/user-management">
              <AdminLayout><UserManagement /></AdminLayout>
            </Route>
            <Route path="/employees">
              <AdminLayout><Employees /></AdminLayout>
            </Route>
            <Route path="/setup">
              <AdminLayout><Setup /></AdminLayout>
            </Route>

            {/* ── 404 ───────────────────────────────────────────────────── */}
            <Route>
              <ProtectedLayout>
                <div className="flex items-center justify-center h-64 font-mono text-primary/40 text-sm uppercase tracking-widest">
                  404 — Route Not Found
                </div>
              </ProtectedLayout>
            </Route>
          </Switch>
        </Suspense>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
