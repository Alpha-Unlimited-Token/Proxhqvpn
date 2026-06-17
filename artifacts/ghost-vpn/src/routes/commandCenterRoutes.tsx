// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { lazy } from "react";
import { Route } from "wouter";
import { CcLayout, ToolLayout, AdminLayout } from "./routeGuards";

import Dashboard from "@/pages/Dashboard";
import ConsumerDashboard from "@/pages/ConsumerDashboard";
import BusinessDashboard from "@/pages/BusinessDashboard";
import SecurityOperationsDashboard from "@/pages/SecurityOperationsDashboard";
import OnboardingV2 from "@/pages/OnboardingV2";
import ProxyConfig from "@/pages/ProxyConfig";
import AlphaTools from "@/pages/AlphaTools";
import ToolRunner from "@/pages/ToolRunner";
import ToolHistory from "@/pages/ToolHistory";
import ToolScope from "@/pages/ToolScope";
import ScanScheduler from "@/pages/ScanScheduler";
import ToolApprovals from "@/pages/ToolApprovals";
import NodeHealth from "@/pages/NodeHealth";
import SecurityAudit from "@/pages/SecurityAudit";
import AiAudit from "@/pages/AiAudit";
import AccountSecurityCenter from "@/pages/AccountSecurityCenter";
import CommandGovernance from "@/pages/CommandGovernance";
import DependencyMap from "@/pages/DependencyMap";
import FirewallPolicyCompiler from "@/pages/FirewallPolicyCompiler";
import DriftMonitor from "@/pages/DriftMonitor";
import EventGraph from "@/pages/EventGraph";
import ServiceBus from "@/pages/ServiceBus";
import DeviceTrustEngine from "@/pages/DeviceTrustEngine";
import FirewallCore from "@/pages/FirewallCore";
import ThreatIntel from "@/pages/ThreatIntel";
import HttpProbe from "@/pages/HttpProbe";
import DirectoryFuzzer from "@/pages/DirectoryFuzzer";
import SubdomainScan from "@/pages/SubdomainScan";
import Encoder from "@/pages/Encoder";
import Comparer from "@/pages/Comparer";
import PayloadGen from "@/pages/PayloadGen";
import CveSearch from "@/pages/CveSearch";
import Intruder from "@/pages/Intruder";
import GhostTrace from "@/pages/GhostTrace";
import GhostChain from "@/pages/GhostChain";
import Siem from "@/pages/Siem";
import SslTlsAnalyzer from "@/pages/SslTlsAnalyzer";
import JwtAnalyzer from "@/pages/JwtAnalyzer";
import SqliScanner from "@/pages/SqliScanner";
import IacScanner from "@/pages/IacScanner";
import HttpInterceptor from "@/pages/HttpInterceptor";
import ApiSecurityTester from "@/pages/ApiSecurityTester";
import OastTester from "@/pages/OastTester";
import OastServer from "@/pages/OastServer";
import WafBypass from "@/pages/WafBypass";
import DepScanner from "@/pages/DepScanner";
import TokenSequencer from "@/pages/TokenSequencer";
import WsTester from "@/pages/WsTester";
import SastAnalyzer from "@/pages/SastAnalyzer";
import QuantumAuditPage from "@/pages/QuantumAudit";
import GhostPentest from "@/pages/GhostPentest";
import DeceptionEngine from "@/pages/DeceptionEngine";
import GhostTrap from "@/pages/GhostTrap";
import GhostNodes from "@/pages/GhostNodes";
import GhostNodesDashboard from "@/pages/GhostNodesDashboard";
import GhostTrapDashboard from "@/pages/GhostTrapDashboard";
import SecurityOperationsCenter from "@/pages/SecurityOperationsCenter";
import GhostRouting from "@/pages/GhostRouting";
import RequestMind from "@/pages/RequestMind";
import SocCopilot from "@/pages/SocCopilot";
import CodeSentinel from "@/pages/CodeSentinel";
import AgentStrike from "@/pages/AgentStrike";
import LlmProbe from "@/pages/LlmProbe";
import AiShield from "@/pages/AiShield";
import AISecuritySuite from "@/pages/AISecuritySuite";
import VpnTracker from "@/pages/VpnTracker";
import ValidationDashboard from "@/pages/ValidationDashboard";
import TransparencyReport from "@/pages/TransparencyReport";
import AmbassadorDashboard from "@/pages/AmbassadorDashboard";

const OsintRecon      = lazy(() => import("@/pages/OsintRecon"));
const UsernameIntel   = lazy(() => import("@/pages/UsernameIntel"));
const CanaryTokens    = lazy(() => import("@/pages/CanaryTokens"));
const WafAnalyzer     = lazy(() => import("@/pages/WafAnalyzer"));
const SocialBreach    = lazy(() => import("@/pages/SocialBreach"));
const BugBountyHub    = lazy(() => import("@/pages/BugBountyHub"));

export function CommandCenterRoutes() {
  return (
    <>
      <Route path="/dashboard"><CcLayout><Dashboard /></CcLayout></Route>
      <Route path="/consumer-dashboard"><CcLayout><ConsumerDashboard /></CcLayout></Route>
      <Route path="/business"><CcLayout><BusinessDashboard /></CcLayout></Route>
      <Route path="/command-center"><CcLayout><SecurityOperationsDashboard /></CcLayout></Route>
      <Route path="/onboarding"><CcLayout><OnboardingV2 /></CcLayout></Route>
      <Route path="/proxy"><CcLayout><ProxyConfig /></CcLayout></Route>
      <Route path="/alpha-tools"><CcLayout><AlphaTools /></CcLayout></Route>
      <Route path="/tool-runner"><CcLayout><ToolRunner /></CcLayout></Route>
      <Route path="/tool-history"><CcLayout><ToolHistory /></CcLayout></Route>
      <Route path="/tool-scope"><CcLayout><ToolScope /></CcLayout></Route>
      <Route path="/scan-scheduler"><CcLayout><ScanScheduler /></CcLayout></Route>
      <Route path="/tool-scheduler"><CcLayout><ScanScheduler /></CcLayout></Route>
      <Route path="/tool-approvals"><AdminLayout><ToolApprovals /></AdminLayout></Route>
      <Route path="/node-health"><CcLayout><NodeHealth /></CcLayout></Route>
      <Route path="/security-audit"><CcLayout><SecurityAudit /></CcLayout></Route>
      <Route path="/ai-audit"><CcLayout><AiAudit /></CcLayout></Route>
      <Route path="/account-security"><CcLayout><AccountSecurityCenter /></CcLayout></Route>
      <Route path="/command-governance"><CcLayout><CommandGovernance /></CcLayout></Route>
      <Route path="/dependency-map"><CcLayout><DependencyMap /></CcLayout></Route>
      <Route path="/firewall-compiler"><CcLayout><FirewallPolicyCompiler /></CcLayout></Route>
      <Route path="/drift-monitor"><CcLayout><DriftMonitor /></CcLayout></Route>
      <Route path="/event-graph"><CcLayout><EventGraph /></CcLayout></Route>
      <Route path="/service-bus"><CcLayout><ServiceBus /></CcLayout></Route>
      <Route path="/device-trust"><CcLayout><DeviceTrustEngine /></CcLayout></Route>
      <Route path="/firewall-core"><CcLayout><FirewallCore /></CcLayout></Route>
      <Route path="/threat-intel"><CcLayout><ThreatIntel /></CcLayout></Route>

      <Route path="/http-probe"><CcLayout><HttpProbe /></CcLayout></Route>
      <Route path="/dir-fuzzer"><CcLayout><DirectoryFuzzer /></CcLayout></Route>
      <Route path="/subdomain-scan"><CcLayout><SubdomainScan /></CcLayout></Route>
      <Route path="/encoder"><CcLayout><Encoder /></CcLayout></Route>
      <Route path="/comparer"><CcLayout><Comparer /></CcLayout></Route>
      <Route path="/payloads"><CcLayout><PayloadGen /></CcLayout></Route>
      <Route path="/cve-search"><CcLayout><CveSearch /></CcLayout></Route>
      <Route path="/intruder"><CcLayout><Intruder /></CcLayout></Route>

      <Route path="/ghost-trace"><CcLayout><GhostTrace /></CcLayout></Route>
      <Route path="/ghost-chain"><CcLayout><GhostChain /></CcLayout></Route>
      <Route path="/siem"><CcLayout><Siem /></CcLayout></Route>
      <Route path="/osint"><CcLayout><OsintRecon /></CcLayout></Route>
      <Route path="/username-intel"><CcLayout><UsernameIntel /></CcLayout></Route>
      <Route path="/canary"><CcLayout><CanaryTokens /></CcLayout></Route>
      <Route path="/waf"><CcLayout><WafAnalyzer /></CcLayout></Route>
      <Route path="/social-breach"><CcLayout><SocialBreach /></CcLayout></Route>
      <Route path="/bug-bounty"><CcLayout><BugBountyHub /></CcLayout></Route>

      <Route path="/ssl-tls"><CcLayout><SslTlsAnalyzer /></CcLayout></Route>
      <Route path="/jwt-analyzer"><CcLayout><JwtAnalyzer /></CcLayout></Route>
      <Route path="/sqli-scanner"><CcLayout><SqliScanner /></CcLayout></Route>
      <Route path="/iac-scan"><CcLayout><IacScanner /></CcLayout></Route>
      <Route path="/http-interceptor"><CcLayout><HttpInterceptor /></CcLayout></Route>
      <Route path="/api-tester"><CcLayout><ApiSecurityTester /></CcLayout></Route>
      <Route path="/oast-tester"><CcLayout><OastTester /></CcLayout></Route>
      <Route path="/oast-server"><CcLayout><OastServer /></CcLayout></Route>
      <Route path="/waf-bypass"><CcLayout><WafBypass /></CcLayout></Route>
      <Route path="/dep-scanner"><CcLayout><DepScanner /></CcLayout></Route>
      <Route path="/token-seq"><CcLayout><TokenSequencer /></CcLayout></Route>
      <Route path="/ws-tester"><CcLayout><WsTester /></CcLayout></Route>
      <Route path="/sast"><CcLayout><SastAnalyzer /></CcLayout></Route>
      <Route path="/quantum-audit"><CcLayout><QuantumAuditPage /></CcLayout></Route>

      <Route path="/ghost-pentest"><CcLayout><GhostPentest /></CcLayout></Route>
      <Route path="/ghost-trap"><CcLayout><GhostTrap /></CcLayout></Route>
      <Route path="/deception-engine"><CcLayout><DeceptionEngine /></CcLayout></Route>
      <Route path="/ghost-nodes"><CcLayout><GhostNodes /></CcLayout></Route>
      <Route path="/ghost-nodes-ops"><AdminLayout><GhostNodesDashboard /></AdminLayout></Route>
      <Route path="/ghost-trap-ops"><AdminLayout><GhostTrapDashboard /></AdminLayout></Route>
      <Route path="/security-ops"><AdminLayout><SecurityOperationsCenter /></AdminLayout></Route>
      <Route path="/ghost-routing"><CcLayout><GhostRouting /></CcLayout></Route>
      <Route path="/request-mind"><CcLayout><RequestMind /></CcLayout></Route>
      <Route path="/soc-copilot"><CcLayout><SocCopilot /></CcLayout></Route>
      <Route path="/code-sentinel"><CcLayout><CodeSentinel /></CcLayout></Route>
      <Route path="/agent-strike"><CcLayout><AgentStrike /></CcLayout></Route>
      <Route path="/llm-probe"><CcLayout><LlmProbe /></CcLayout></Route>
      <Route path="/ai-shield"><CcLayout><AiShield /></CcLayout></Route>
      <Route path="/ai-security-suite"><CcLayout><AISecuritySuite /></CcLayout></Route>

      <Route path="/vpn-tracker"><CcLayout><VpnTracker /></CcLayout></Route>
      <Route path="/validation"><CcLayout><ValidationDashboard /></CcLayout></Route>
      <Route path="/transparency"><ToolLayout><TransparencyReport /></ToolLayout></Route>
      <Route path="/ambassador/dashboard"><ToolLayout><AmbassadorDashboard /></ToolLayout></Route>
    </>
  );
}
