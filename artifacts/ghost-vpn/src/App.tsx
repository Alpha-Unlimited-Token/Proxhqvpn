// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import React, { useEffect, useRef, Component, type ReactNode, lazy, Suspense } from "react";
import { useAccess } from "@/hooks/useAccess";
import { ClerkProvider, SignIn, SignUp, Show, useClerk, useUser } from "@clerk/react";

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: any) { console.error("[ProxhqVPN] Crash:", error, info); }
  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-black flex items-center justify-center p-8">
          <div className="border border-red-500/30 bg-red-900/10 p-6 max-w-lg w-full font-mono">
            <div className="text-red-400 text-sm font-bold uppercase tracking-widest mb-3">⚠ App Crash — Caught</div>
            <div className="text-red-300/80 text-xs mb-2">{this.state.error.message}</div>
            <div className="text-primary/30 text-[10px] whitespace-pre-wrap break-all">{this.state.error.stack?.split("\n").slice(0,6).join("\n")}</div>
            <button onClick={() => this.setState({ error: null })} className="mt-4 border border-red-400/40 text-red-400 text-xs px-3 py-1.5 hover:bg-red-400/10 uppercase">
              Retry
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
import { Switch, Route, useLocation, Redirect, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "./components/layout/Layout";
import { PaywallGate, AdminGate } from "./components/PaywallGate";

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
import ConfigLifecycle from "@/pages/ConfigLifecycle";
const VpnCoexist = lazy(() => import("@/pages/VpnCoexist"));
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
import HttpProbe from "@/pages/HttpProbe";
import DirectoryFuzzer from "@/pages/DirectoryFuzzer";
import SubdomainScan from "@/pages/SubdomainScan";
const Downloads         = lazy(() => import("@/pages/Downloads"));
const BrowserExtension  = lazy(() => import("@/pages/BrowserExtension"));
const UserGuide    = lazy(() => import("@/pages/UserGuide"));
const ParrotTools  = lazy(() => import("@/pages/ParrotTools"));
const ImAutomation = lazy(() => import("@/pages/ImAutomation"));
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
const OsintRecon      = lazy(() => import("@/pages/OsintRecon"));
const UsernameIntel   = lazy(() => import("@/pages/UsernameIntel"));
const CanaryTokens    = lazy(() => import("@/pages/CanaryTokens"));
const ExploitImporter = lazy(() => import("@/pages/ExploitImporter"));
const OmniStrike      = lazy(() => import("@/pages/OmniStrike"));
const WafAnalyzer     = lazy(() => import("@/pages/WafAnalyzer"));
const SocialBreach    = lazy(() => import("@/pages/SocialBreach"));
const BugBountyHub    = lazy(() => import("@/pages/BugBountyHub"));
const Manuals         = lazy(() => import("@/pages/Manuals"));
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
import RequestMind from "@/pages/RequestMind";
import SocCopilot from "@/pages/SocCopilot";
import CodeSentinel from "@/pages/CodeSentinel";
import AgentStrike from "@/pages/AgentStrike";
import LlmProbe from "@/pages/LlmProbe";
import AiShield from "@/pages/AiShield";
import AISecuritySuite from "@/pages/AISecuritySuite";
import VpnTracker from "@/pages/VpnTracker";
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
import AnonAuth from "@/pages/AnonAuth";
import AnonDashboard from "@/pages/AnonDashboard";
import AnonUpgrade from "@/pages/AnonUpgrade";

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");
}

const queryClient = new QueryClient();

const ghostGreen = "#00ff88";
const ghostGreenDark = "#009952";

const clerkAppearance = {
  variables: {
    colorPrimary: ghostGreen,
    colorBackground: "#040a06",
    colorInputBackground: "#0a120d",
    colorText: ghostGreen,
    colorTextSecondary: "#00cc66",
    colorInputText: ghostGreen,
    colorNeutral: ghostGreenDark,
    borderRadius: "8px",
    fontFamily: '"Inter", ui-sans-serif, system-ui, -apple-system, sans-serif',
    fontFamilyButtons: '"Inter", ui-sans-serif, system-ui, sans-serif',
    fontSize: "14px",
  },
  elements: {
    rootBox: "w-full",
    cardBox: "border border-primary/20 bg-black/95 w-full overflow-hidden rounded-xl shadow-lg shadow-primary/5",
    card: "!shadow-none !border-0 !bg-transparent",
    footer: "!shadow-none !border-0 !bg-transparent",
    headerTitle: { color: ghostGreen, fontSize: "20px", fontWeight: "700", letterSpacing: "-0.01em" },
    headerSubtitle: { color: `${ghostGreen}70`, fontSize: "13px" },
    socialButtonsBlockButton: "border border-primary/25 bg-black/60 hover:bg-primary/10 transition-colors",
    socialButtonsBlockButtonText: { color: ghostGreen, fontSize: "13px" },
    formFieldLabel: { color: `${ghostGreen}80`, fontSize: "12px", fontWeight: "500" },
    formFieldInput: "bg-black/60 border border-primary/25 text-primary focus:border-primary",
    formButtonPrimary: "bg-primary text-black font-semibold hover:bg-primary/85",
    footerActionLink: { color: ghostGreen, fontSize: "13px" },
    footerActionText: { color: `${ghostGreen}70`, fontSize: "13px" },
    dividerLine: "bg-primary/15",
    dividerText: { color: `${ghostGreen}50`, fontSize: "12px" },
    identityPreviewEditButton: { color: ghostGreen },
    formFieldSuccessText: { color: ghostGreen },
    alertText: { color: "#ff4444", fontSize: "12px" },
    alert: "border border-red-500/30 bg-red-900/10",
    otpCodeFieldInput: "bg-black/60 border border-primary/25 text-primary font-mono",
    formFieldRow: "mb-4",
    main: "p-6",
  },
};

/**
 * Smart post-login landing page.
 * Reads the user's subscription tier and redirects them to the right place:
 *   Command Center Pro  →  /dashboard   (full platform)
 *   VPN Basic           →  /my-vpn      (VPN-only experience)
 *   No subscription     →  /pricing     (choose a plan)
 */
function AppLanding() {
  const { hasCommandCenter, hasAccess, isLoading } = useAccess();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#080d09] flex flex-col items-center justify-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-2">
          <img src={`${basePath}/icon-final2.png`} alt="ProxhqVPN" className="w-8 h-8" />
        </div>
        <div className="w-5 h-5 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
        <p className="text-[11px] text-white/40 font-mono uppercase tracking-widest">Verifying access…</p>
      </div>
    );
  }

  if (hasCommandCenter) return <Redirect to="/dashboard" />;
  if (hasAccess) return <Redirect to="/my-vpn" />;
  return <Redirect to="/pricing" />;
}

function AuthLoadingScreen() {
  return (
    <div className="min-h-[100dvh] bg-[#080d09] flex flex-col items-center justify-center gap-4">
      <div className="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
        <img src={`${basePath}/icon-final2.png`} alt="ProxhqVPN" className="w-10 h-10" />
      </div>
      <div className="w-5 h-5 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
    </div>
  );
}

function AuthBrandingPanel({ bullets }: { bullets: string[] }) {
  return (
    <div className="hidden lg:flex flex-col justify-between w-96 bg-gradient-to-b from-[#0d1610] to-[#080d09] border-r border-white/[0.06] p-10">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center">
          <img src={`${basePath}/icon-final2.png`} alt="" className="w-7 h-7" />
        </div>
        <span className="text-lg font-bold text-white">ProxhqVPN</span>
      </div>
      <div className="space-y-6">
        {bullets.map(f => (
          <div key={f} className="flex items-center gap-3">
            <div className="w-5 h-5 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0">
              <div className="w-1.5 h-1.5 rounded-full bg-primary" />
            </div>
            <span className="text-sm text-white/88">{f}</span>
          </div>
        ))}
      </div>
      <div className="text-xs text-white/70">© 2026 ALPHA UNLIMITED TECHNOLOGIES LLC</div>
    </div>
  );
}

function SignInPage() {
  const { isSignedIn, isLoaded } = useUser();
  const [showClerk, setShowClerk] = React.useState(false);

  if (!isLoaded) return <AuthLoadingScreen />;
  if (isSignedIn) return <Redirect to="/app" />;

  return (
    <div className="flex min-h-[100dvh] bg-[#080d09]">
      <AuthBrandingPanel bullets={[
        "Military-grade WireGuard encryption",
        "Zero-logs privacy policy",
        "Double-hop anonymity",
        "Instant kill switch protection",
      ]} />
      <div className="flex-1 flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center lg:hidden mb-2">
            <img src={`${basePath}/icon-final2.png`} alt="ProxhqVPN" className="w-12 h-12 mx-auto mb-3" />
            <div className="text-xl font-bold text-white">ProxhqVPN</div>
          </div>
          {showClerk ? (
            <>
              <button
                onClick={() => setShowClerk(false)}
                className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white/80 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </button>
              <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} fallbackRedirectUrl={`${basePath}/dashboard`} />
            </>
          ) : (
            <div className="space-y-5">
              <div>
                <h1 className="text-2xl font-bold text-white">Welcome back</h1>
                <p className="text-sm text-white/55 mt-1">Choose how you want to sign in.</p>
              </div>
              {/* Google */}
              <button
                onClick={() => setShowClerk(true)}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-white/[0.06] border border-white/10 hover:bg-white/[0.09] hover:border-white/20 transition-all group"
              >
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                <div className="text-left">
                  <div className="text-sm font-medium text-white group-hover:text-white">Continue with Google</div>
                  <div className="text-xs text-white/45">Sign in with your Gmail account</div>
                </div>
              </button>
              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-white/[0.07]" />
                <span className="text-xs text-white/30">or</span>
                <div className="flex-1 h-px bg-white/[0.07]" />
              </div>
              {/* Anonymous */}
              <a
                href={`${basePath}/anon-auth`}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-white/[0.04] border border-white/[0.07] hover:bg-white/[0.07] hover:border-primary/30 transition-all group block"
              >
                <div className="w-5 h-5 shrink-0 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-primary" />
                </div>
                <div className="text-left">
                  <div className="text-sm font-medium text-white group-hover:text-primary/90 transition-colors">Anonymous Account</div>
                  <div className="text-xs text-white/45">No email. Just a 16-digit number.</div>
                </div>
              </a>
              <p className="text-center text-xs text-white/35">
                No account?{" "}
                <a href={`${basePath}/sign-up`} className="text-primary hover:underline">Create one</a>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SignUpPage() {
  const { isSignedIn, isLoaded } = useUser();
  const [showClerk, setShowClerk] = React.useState(false);

  if (!isLoaded) return <AuthLoadingScreen />;
  if (isSignedIn) return <Redirect to="/app" />;

  return (
    <div className="flex min-h-[100dvh] bg-[#080d09]">
      <AuthBrandingPanel bullets={[
        "Privacy that works from day one",
        "No email required — anonymous accounts available",
        "Download your VPN config in under 60 seconds",
        "60-node encrypted mesh network",
      ]} />
      <div className="flex-1 flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center lg:hidden mb-2">
            <img src={`${basePath}/icon-final2.png`} alt="ProxhqVPN" className="w-12 h-12 mx-auto mb-3" />
            <div className="text-xl font-bold text-white">ProxhqVPN</div>
          </div>
          {showClerk ? (
            <>
              <button
                onClick={() => setShowClerk(false)}
                className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white/80 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </button>
              <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} fallbackRedirectUrl={`${basePath}/app`} />
            </>
          ) : (
            <div className="space-y-5">
              <div>
                <h1 className="text-2xl font-bold text-white">Create account</h1>
                <p className="text-sm text-white/55 mt-1">Choose how you want to get started.</p>
              </div>
              {/* Google */}
              <button
                onClick={() => setShowClerk(true)}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-white/[0.06] border border-white/10 hover:bg-white/[0.09] hover:border-white/20 transition-all group"
              >
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                <div className="text-left">
                  <div className="text-sm font-medium text-white group-hover:text-white">Continue with Google</div>
                  <div className="text-xs text-white/45">Sign up with your Gmail account</div>
                </div>
              </button>
              {/* Divider */}
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-white/[0.07]" />
                <span className="text-xs text-white/30">or</span>
                <div className="flex-1 h-px bg-white/[0.07]" />
              </div>
              {/* Anonymous */}
              <a
                href={`${basePath}/anon-auth`}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-white/[0.04] border border-white/[0.07] hover:bg-white/[0.07] hover:border-primary/30 transition-all group block"
              >
                <div className="w-5 h-5 shrink-0 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-primary" />
                </div>
                <div className="text-left">
                  <div className="text-sm font-medium text-white group-hover:text-primary/90 transition-colors">Anonymous Account</div>
                  <div className="text-xs text-white/45">No email. Just a 16-digit number. 30-day free trial.</div>
                </div>
              </a>
              <p className="text-center text-xs text-white/35">
                Already have one?{" "}
                <a href={`${basePath}/sign-in`} className="text-primary hover:underline">Sign in</a>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function HomeRedirect() {
  const { isSignedIn, isLoaded } = useUser();
  // Show the homepage immediately while Clerk loads — never blank screen
  if (!isLoaded) return <Home />;
  if (isSignedIn) return <Redirect to="/app" />;
  return <Home />;
}

/** Pages accessible to anyone — no login required */
function ClerkLoadingSpinner() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-[#080d09]">
      <div className="w-6 h-6 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
    </div>
  );
}

function PublicLayout({ children }: { children: React.ReactNode }) {
  const { isLoaded } = useUser();
  if (!isLoaded) return <ClerkLoadingSpinner />;
  return (
    <>
      <Show when="signed-in">
        <Layout>
          <ErrorBoundary>{children}</ErrorBoundary>
        </Layout>
      </Show>
      <Show when="signed-out">
        {/* Minimal public header so non-logged-in users can still navigate */}
        <div className="min-h-screen bg-[#080d09] text-white">
          <header className="border-b border-white/[0.06] px-6 py-4 flex items-center justify-between">
            <a href={basePath || "/"} className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary/15 border border-primary/25 flex items-center justify-center">
                <img src={`${basePath}/icon-final2.png`} alt="" className="w-5 h-5" />
              </div>
              <span className="font-bold text-white text-sm">ProxhqVPN</span>
            </a>
            <div className="flex items-center gap-3">
              <a href={`${basePath}/sign-in`} className="text-xs text-white/83 hover:text-white transition-colors">Sign in</a>
              <a href={`${basePath}/sign-up`} className="text-xs bg-primary text-black font-semibold px-4 py-2 rounded-lg hover:brightness-110 transition-all">
                Get Started
              </a>
            </div>
          </header>
          <div className="max-w-5xl mx-auto px-6 py-10">
            <ErrorBoundary>{children}</ErrorBoundary>
          </div>
        </div>
      </Show>
    </>
  );
}

/** Pages accessible to any signed-in user (no subscription required) */
function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { isLoaded } = useUser();
  if (!isLoaded) return <ClerkLoadingSpinner />;
  return (
    <>
      <Show when="signed-in">
        <Layout>
          <ErrorBoundary>{children}</ErrorBoundary>
        </Layout>
      </Show>
      <Show when="signed-out">
        <Redirect to="/sign-in" />
      </Show>
    </>
  );
}

/** Pages that require any active subscription — VPN Basic or Command Center Pro */
function ToolLayout({ children }: { children: React.ReactNode }) {
  const { isLoaded } = useUser();
  if (!isLoaded) return <ClerkLoadingSpinner />;
  return (
    <>
      <Show when="signed-in">
        <Layout>
          <ErrorBoundary>
            <PaywallGate requireTier="any">{children}</PaywallGate>
          </ErrorBoundary>
        </Layout>
      </Show>
      <Show when="signed-out">
        <Redirect to="/sign-in" />
      </Show>
    </>
  );
}

/** Pages that require Command Center Pro subscription */
function CcLayout({ children }: { children: React.ReactNode }) {
  const { isLoaded } = useUser();
  if (!isLoaded) return <ClerkLoadingSpinner />;
  return (
    <>
      <Show when="signed-in">
        <Layout>
          <ErrorBoundary>
            <PaywallGate requireTier="command_center">{children}</PaywallGate>
          </ErrorBoundary>
        </Layout>
      </Show>
      <Show when="signed-out">
        <Redirect to="/sign-in" />
      </Show>
    </>
  );
}

/** Pages restricted to staff only — admin owners and employees */
function AdminLayout({ children }: { children: React.ReactNode }) {
  const { isLoaded } = useUser();
  if (!isLoaded) return <ClerkLoadingSpinner />;
  return (
    <>
      <Show when="signed-in">
        <Layout>
          <ErrorBoundary>
            <AdminGate>{children}</AdminGate>
          </ErrorBoundary>
        </Layout>
      </Show>
      <Show when="signed-out">
        <Redirect to="/sign-in" />
      </Show>
    </>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
        qc.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);

  return null;
}

function ScrollToTop() {
  const [location] = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [location]);
  return null;
}

const LazyFallback = () => (
  <div className="min-h-screen bg-black flex items-center justify-center">
    <div className="flex flex-col items-center gap-3">
      <div className="w-8 h-8 rounded-full border-2 border-primary/40 border-t-primary animate-spin" />
      <span className="text-primary/60 text-xs font-mono">Loading…</span>
    </div>
  </div>
);

function AppRoutes() {
  return (
    <QueryClientProvider client={queryClient}>
      <ClerkQueryClientCacheInvalidator />
      <ScrollToTop />
      <TooltipProvider>
        <Suspense fallback={<LazyFallback />}>
        <Switch>
          <Route path="/" component={HomeRedirect} />
          <Route path="/sign-in/*?" component={SignInPage} />
          <Route path="/sign-up/*?" component={SignUpPage} />
          <Route path="/anon-auth" component={AnonAuth} />
          <Route path="/anon" component={AnonDashboard} />
          <Route path="/anon/upgrade" component={AnonUpgrade} />

          {/* ── Smart post-login redirect — reads tier, sends to the right page ── */}
          <Route path="/app">
            <ProtectedLayout><AppLanding /></ProtectedLayout>
          </Route>

          {/* ── Freely accessible to everyone — no login needed ── */}
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


          {/* ── Handbooks ── */}
          <Route path="/handbook/ambassador">
            <PublicLayout><AmbassadorHandbook /></PublicLayout>
          </Route>
          {/* Employee handbook — staff only */}
          <Route path="/handbook/employee">
            <AdminLayout><EmployeeHandbook /></AdminLayout>
          </Route>

          {/* ── Requires sign-in ── */}
          <Route path="/account">
            <ProtectedLayout><Account /></ProtectedLayout>
          </Route>
          <Route path="/ambassadors">
            <PublicLayout><Ambassadors /></PublicLayout>
          </Route>
          <Route path="/ambassador/apply">
            <ProtectedLayout><AmbassadorApply /></ProtectedLayout>
          </Route>
          {/* Ambassador dashboard — requires at least a subscription */}
          <Route path="/ambassador/dashboard">
            <ToolLayout><AmbassadorDashboard /></ToolLayout>
          </Route>
          <Route path="/checkout/success">
            <ProtectedLayout><CheckoutSuccess /></ProtectedLayout>
          </Route>

          {/* ── Auto-setup: triggered by Windows/desktop installer after sign-in ── */}
          <Route path="/autosetup">
            <AutoSetup />
          </Route>

          {/* ── VPN Basic — any active subscription ── */}
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
          {/* Onion Browser — Tor over VPN, included in VPN Basic */}
          <Route path="/onion-browser">
            <ToolLayout><OnionBrowser /></ToolLayout>
          </Route>

          {/* ── Command Center Pro — requires Pro subscription ── */}
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
          <Route path="/security-audit">
            <CcLayout><SecurityAudit /></CcLayout>
          </Route>
          <Route path="/ai-audit">
            <CcLayout><AiAudit /></CcLayout>
          </Route>
          <Route path="/account-security">
            <ProtectedLayout><AccountSecurityCenter /></ProtectedLayout>
          </Route>
          <Route path="/command-governance">
            <CcLayout><CommandGovernance /></CcLayout>
          </Route>
          <Route path="/dependency-map">
            <CcLayout><DependencyMap /></CcLayout>
          </Route>
          <Route path="/node-trust">
            <AdminLayout><NodeTrustEngine /></AdminLayout>
          </Route>
          <Route path="/security-score">
            <ProtectedLayout><CustomerSecurityDashboard /></ProtectedLayout>
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
          <Route path="/config-lifecycle">
            <ProtectedLayout><ConfigLifecycle /></ProtectedLayout>
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
          <Route path="/ip-exposure">
            <ToolLayout><IpExposure /></ToolLayout>
          </Route>
          <Route path="/ghost-trap">
            <ToolLayout><GhostTrap /></ToolLayout>
          </Route>
          <Route path="/ghost-trace">
            <CcLayout><GhostTrace /></CcLayout>
          </Route>
          <Route path="/ghost-chain">
            <CcLayout><GhostChain /></CcLayout>
          </Route>
          <Route path="/network-monitor">
            <ToolLayout><NetworkMonitor /></ToolLayout>
          </Route>
          <Route path="/dns-sinkhole">
            <ToolLayout><DnsSinkhole /></ToolLayout>
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
          <Route path="/manuals">
            <ToolLayout><Manuals /></ToolLayout>
          </Route>

          {/* ── Privacy Suite — post-quantum, DAITA, dark web, alt-identity, IP rotation ── */}
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

          {/* ── VPN Gap Features — any active subscription ── */}
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

          {/* ── Dev Security Tools — Command Center Pro ── */}
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
          <Route path="/transparency">
            <Layout><TransparencyReport /></Layout>
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

          {/* ── AI Security Suite ── */}
          <Route path="/ghost-pentest">
            <CcLayout><GhostPentest /></CcLayout>
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

          {/* ── Omega C2 Dashboard ── */}
          <Route path="/omega-dashboard">
            <CcLayout><OmegaOverview /></CcLayout>
          </Route>
          <Route path="/omega-hosts">
            <CcLayout><OmegaHosts /></CcLayout>
          </Route>
          <Route path="/omega-hosts/:id">
            <CcLayout><OmegaHostDetails /></CcLayout>
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

          <Route path="/vpn-tracker">
            <CcLayout><VpnTracker /></CcLayout>
          </Route>

          {/* ── Admin-only — restricted to owners and employees; all others see Access Denied ── */}
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

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInFallbackRedirectUrl={`${basePath}/app`}
      signUpFallbackRedirectUrl={`${basePath}/app`}
      localization={{
        signIn: {
          start: {
            title: "Welcome Back",
            subtitle: "Sign in to your ProxhqVPN account",
          },
        },
        signUp: {
          start: {
            title: "Get Started",
            subtitle: "Create your ProxhqVPN account",
          },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <AppRoutes />
    </ClerkProvider>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <WouterRouter base={basePath}>
        <ClerkProviderWithRoutes />
      </WouterRouter>
    </ErrorBoundary>
  );
}

export default App;
