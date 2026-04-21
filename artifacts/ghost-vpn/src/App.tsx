import { useEffect, useRef, Component, type ReactNode } from "react";
import { ClerkProvider, SignIn, SignUp, Show, useClerk } from "@clerk/react";

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
import { PaywallGate } from "./components/PaywallGate";

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
import VpnCoexist from "@/pages/VpnCoexist";
import VpnGate from "@/pages/VpnGate";
import Platforms from "@/pages/Platforms";
import DeviceManager from "@/pages/DeviceManager";
import SmartDns from "@/pages/SmartDns";
import DnsShield from "@/pages/DnsShield";
import RouterConfig from "@/pages/RouterConfig";
import Account from "@/pages/Account";
import MyVPN from "@/pages/MyVPN";
import Pricing from "@/pages/Pricing";
import SqlmapScanner from "@/pages/SqlmapScanner";
import AlphaTools from "@/pages/AlphaTools";
import HttpProbe from "@/pages/HttpProbe";
import DirectoryFuzzer from "@/pages/DirectoryFuzzer";
import SubdomainScan from "@/pages/SubdomainScan";
import Downloads from "@/pages/Downloads";
import UserGuide from "@/pages/UserGuide";
import Employees from "@/pages/Employees";
import ThreatProtection from "@/pages/ThreatProtection";
import Setup from "@/pages/Setup";
import Ambassadors from "@/pages/Ambassadors";
import AmbassadorApply from "@/pages/AmbassadorApply";
import AmbassadorDashboard from "@/pages/AmbassadorDashboard";
import CheckoutSuccess from "@/pages/CheckoutSuccess";

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
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
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

function SignInPage() {
  const { isSignedIn, isLoaded } = useClerk();
  if (isLoaded && isSignedIn) return <Redirect to="/dashboard" />;
  return (
    <div className="flex min-h-[100dvh] bg-[#080d09]">
      {/* Left branding panel */}
      <div className="hidden lg:flex flex-col justify-between w-96 bg-gradient-to-b from-[#0d1610] to-[#080d09] border-r border-white/[0.06] p-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center">
            <img src={`${basePath}/icon-final2.png`} alt="" className="w-7 h-7" />
          </div>
          <span className="text-lg font-bold text-white">ProxhqVPN</span>
        </div>
        <div className="space-y-6">
          {["Military-grade WireGuard encryption", "Zero-logs privacy policy", "Double-hop anonymity", "Instant kill switch protection"].map(f => (
            <div key={f} className="flex items-center gap-3">
              <div className="w-5 h-5 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0">
                <div className="w-1.5 h-1.5 rounded-full bg-primary" />
              </div>
              <span className="text-sm text-white/60">{f}</span>
            </div>
          ))}
        </div>
        <div className="text-xs text-white/20">© 2026 ALPHA UNLIMITED TECHNOLOGIES LLC</div>
      </div>
      {/* Sign in form */}
      <div className="flex-1 flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center lg:hidden mb-2">
            <img src={`${basePath}/icon-final2.png`} alt="ProxhqVPN" className="w-12 h-12 mx-auto mb-3" />
            <div className="text-xl font-bold text-white">ProxhqVPN</div>
          </div>
          <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} afterSignInUrl="/dashboard" forceRedirectUrl="/dashboard" />
        </div>
      </div>
    </div>
  );
}

function SignUpPage() {
  const { isSignedIn, isLoaded } = useClerk();
  if (isLoaded && isSignedIn) return <Redirect to="/dashboard" />;
  return (
    <div className="flex min-h-[100dvh] bg-[#080d09]">
      <div className="hidden lg:flex flex-col justify-between w-96 bg-gradient-to-b from-[#0d1610] to-[#080d09] border-r border-white/[0.06] p-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center">
            <img src={`${basePath}/icon-final2.png`} alt="" className="w-7 h-7" />
          </div>
          <span className="text-lg font-bold text-white">ProxhqVPN</span>
        </div>
        <div className="space-y-4">
          <div className="text-2xl font-bold text-white leading-tight">Privacy that works from day one.</div>
          <div className="text-sm text-white/45 leading-relaxed">Create your account and download your personal VPN config in under 60 seconds.</div>
        </div>
        <div className="text-xs text-white/20">© 2026 ALPHA UNLIMITED TECHNOLOGIES LLC</div>
      </div>
      <div className="flex-1 flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center lg:hidden mb-2">
            <img src={`${basePath}/icon-final2.png`} alt="ProxhqVPN" className="w-12 h-12 mx-auto mb-3" />
            <div className="text-xl font-bold text-white">ProxhqVPN</div>
          </div>
          <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} afterSignUpUrl="/pricing" />
        </div>
      </div>
    </div>
  );
}

function HomeRedirect() {
  const { isSignedIn, isLoaded } = useClerk();
  // Show the homepage immediately while Clerk loads — never blank screen
  if (!isLoaded) return <Home />;
  if (isSignedIn) return <Redirect to="/dashboard" />;
  return <Home />;
}

/** Pages accessible to any signed-in user (no subscription required) */
function ProtectedLayout({ children }: { children: React.ReactNode }) {
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

function AppRoutes() {
  return (
    <QueryClientProvider client={queryClient}>
      <ClerkQueryClientCacheInvalidator />
      <TooltipProvider>
        <Switch>
          <Route path="/" component={HomeRedirect} />
          <Route path="/sign-in/*?" component={SignInPage} />
          <Route path="/sign-up/*?" component={SignUpPage} />

          {/* ── Freely accessible to any signed-in user ── */}
          <Route path="/pricing">
            <ProtectedLayout><Pricing /></ProtectedLayout>
          </Route>
          <Route path="/account">
            <ProtectedLayout><Account /></ProtectedLayout>
          </Route>
          <Route path="/downloads">
            <ProtectedLayout><Downloads /></ProtectedLayout>
          </Route>
          <Route path="/guide">
            <ProtectedLayout><UserGuide /></ProtectedLayout>
          </Route>
          <Route path="/ambassadors">
            <ProtectedLayout><Ambassadors /></ProtectedLayout>
          </Route>
          <Route path="/ambassador/apply">
            <ProtectedLayout><AmbassadorApply /></ProtectedLayout>
          </Route>
          <Route path="/ambassador/dashboard">
            <ProtectedLayout><AmbassadorDashboard /></ProtectedLayout>
          </Route>
          <Route path="/checkout/success">
            <ProtectedLayout><CheckoutSuccess /></ProtectedLayout>
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
          <Route path="/security-audit">
            <CcLayout><SecurityAudit /></CcLayout>
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

          {/* ── Admin-only — gated on backend; frontend shows paywall for non-admins ── */}
          <Route path="/nodes">
            <CcLayout><NodeManager /></CcLayout>
          </Route>
          <Route path="/beacons">
            <CcLayout><BeaconAlerts /></CcLayout>
          </Route>
          <Route path="/silkweb">
            <CcLayout><SilkWeb /></CcLayout>
          </Route>
          <Route path="/firewall">
            <CcLayout><Firewall /></CcLayout>
          </Route>
          <Route path="/monitor">
            <CcLayout><SystemMonitor /></CcLayout>
          </Route>
          <Route path="/terminal">
            <CcLayout><Terminal /></CcLayout>
          </Route>
          <Route path="/sql">
            <CcLayout><SqlInterface /></CcLayout>
          </Route>
          <Route path="/employees">
            <CcLayout><Employees /></CcLayout>
          </Route>
          <Route path="/setup">
            <CcLayout><Setup /></CcLayout>
          </Route>
          <Route>
            <ProtectedLayout>
              <div className="flex items-center justify-center h-64 font-mono text-primary/40 text-sm uppercase tracking-widest">
                404 — Route Not Found
              </div>
            </ProtectedLayout>
          </Route>
        </Switch>
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
