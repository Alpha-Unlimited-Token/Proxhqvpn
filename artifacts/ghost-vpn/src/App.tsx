import { useEffect, useRef } from "react";
import { ClerkProvider, SignIn, SignUp, Show, useClerk } from "@clerk/react";
import { Switch, Route, useLocation, Redirect, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "./components/layout/Layout";
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
    colorBackground: "#000000",
    colorInputBackground: "#0a0a0a",
    colorText: ghostGreen,
    colorTextSecondary: "#00cc66",
    colorInputText: ghostGreen,
    colorNeutral: ghostGreenDark,
    borderRadius: "0px",
    fontFamily: '"Courier New", Courier, monospace',
    fontFamilyButtons: '"Courier New", Courier, monospace',
    fontSize: "13px",
  },
  elements: {
    rootBox: "w-full",
    cardBox: "border border-primary/30 bg-black w-full overflow-hidden",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: { color: ghostGreen, fontFamily: '"Courier New", monospace', letterSpacing: "0.2em", textTransform: "uppercase" as const, fontSize: "18px" },
    headerSubtitle: { color: `${ghostGreen}80`, fontFamily: '"Courier New", monospace', fontSize: "11px", textTransform: "uppercase" as const, letterSpacing: "0.15em" },
    socialButtonsBlockButton: "border border-primary/30 bg-black hover:bg-primary/10 transition-colors rounded-none",
    socialButtonsBlockButtonText: { color: ghostGreen, fontFamily: '"Courier New", monospace', fontSize: "12px" },
    formFieldLabel: { color: `${ghostGreen}90`, fontFamily: '"Courier New", monospace', fontSize: "11px", textTransform: "uppercase" as const, letterSpacing: "0.1em" },
    formFieldInput: "bg-black border border-primary/30 text-primary font-mono focus:border-primary rounded-none",
    formButtonPrimary: "bg-primary text-black font-mono uppercase tracking-widest hover:bg-primary/80 rounded-none",
    footerActionLink: { color: ghostGreen, fontFamily: '"Courier New", monospace', fontSize: "12px" },
    footerActionText: { color: `${ghostGreen}70`, fontFamily: '"Courier New", monospace', fontSize: "12px" },
    dividerLine: "bg-primary/20",
    dividerText: { color: `${ghostGreen}50`, fontFamily: '"Courier New", monospace', fontSize: "11px" },
    identityPreviewEditButton: { color: ghostGreen },
    formFieldSuccessText: { color: ghostGreen },
    alertText: { color: "#ff4444", fontFamily: '"Courier New", monospace', fontSize: "12px" },
    alert: "border border-red-500/40 bg-red-900/10 rounded-none",
    otpCodeFieldInput: "bg-black border border-primary/30 text-primary font-mono rounded-none",
    formFieldRow: "mb-4",
    main: "p-6",
  },
};

function SignInPage() {
  // To update login providers, app branding, or OAuth settings use the Auth
  // pane in the workspace toolbar. More information can be found in the Replit docs.
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-black px-4 relative">
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,3px_100%] opacity-20 z-50" />
      <div className="w-full max-w-sm relative z-10">
        <div className="text-center mb-6">
          <img src={`${basePath}/logo.svg`} alt="ProxhqVPN" className="w-16 h-16 mx-auto mb-3" />
          <div className="text-[9px] font-mono tracking-[0.4em] text-primary/40 uppercase">OPERATOR AUTHENTICATION REQUIRED</div>
        </div>
        <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
      </div>
    </div>
  );
}

function SignUpPage() {
  // To update login providers, app branding, or OAuth settings use the Auth
  // pane in the workspace toolbar. More information can be found in the Replit docs.
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-black px-4 relative">
      <div className="pointer-events-none fixed inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_4px,3px_100%] opacity-20 z-50" />
      <div className="w-full max-w-sm relative z-10">
        <div className="text-center mb-6">
          <img src={`${basePath}/logo.svg`} alt="ProxhqVPN" className="w-16 h-16 mx-auto mb-3" />
          <div className="text-[9px] font-mono tracking-[0.4em] text-primary/40 uppercase">REQUEST OPERATOR ACCESS</div>
        </div>
        <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
      </div>
    </div>
  );
}

function HomeRedirect() {
  return (
    <>
      <Show when="signed-in">
        <Redirect to="/dashboard" />
      </Show>
      <Show when="signed-out">
        <Home />
      </Show>
    </>
  );
}

function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Show when="signed-in">
        <Layout>{children}</Layout>
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

          <Route path="/dashboard">
            <ProtectedLayout><Dashboard /></ProtectedLayout>
          </Route>
          <Route path="/nodes">
            <ProtectedLayout><NodeManager /></ProtectedLayout>
          </Route>
          <Route path="/beacons">
            <ProtectedLayout><BeaconAlerts /></ProtectedLayout>
          </Route>
          <Route path="/silkweb">
            <ProtectedLayout><SilkWeb /></ProtectedLayout>
          </Route>
          <Route path="/firewall">
            <ProtectedLayout><Firewall /></ProtectedLayout>
          </Route>
          <Route path="/wireguard">
            <ProtectedLayout><WireGuardConfig /></ProtectedLayout>
          </Route>
          <Route path="/monitor">
            <ProtectedLayout><SystemMonitor /></ProtectedLayout>
          </Route>
          <Route path="/terminal">
            <ProtectedLayout><Terminal /></ProtectedLayout>
          </Route>
          <Route path="/sql">
            <ProtectedLayout><SqlInterface /></ProtectedLayout>
          </Route>
          <Route path="/proxy">
            <ProtectedLayout><ProxyConfig /></ProtectedLayout>
          </Route>
          <Route path="/onion-browser">
            <ProtectedLayout><OnionBrowser /></ProtectedLayout>
          </Route>
          <Route path="/kill-switch">
            <ProtectedLayout><KillSwitch /></ProtectedLayout>
          </Route>
          <Route path="/leaks">
            <ProtectedLayout><LeakDetection /></ProtectedLayout>
          </Route>
          <Route path="/threat-intel">
            <ProtectedLayout><ThreatIntel /></ProtectedLayout>
          </Route>
          <Route path="/split-tunnel">
            <ProtectedLayout><SplitTunnel /></ProtectedLayout>
          </Route>
          <Route path="/obfuscation">
            <ProtectedLayout><Obfuscation /></ProtectedLayout>
          </Route>
          <Route path="/security-audit">
            <ProtectedLayout><SecurityAudit /></ProtectedLayout>
          </Route>
          <Route path="/vpn-coexist">
            <ProtectedLayout><VpnCoexist /></ProtectedLayout>
          </Route>
          <Route path="/vpngate">
            <ProtectedLayout><VpnGate /></ProtectedLayout>
          </Route>
          <Route path="/platforms">
            <ProtectedLayout><Platforms /></ProtectedLayout>
          </Route>
          <Route path="/devices">
            <ProtectedLayout><DeviceManager /></ProtectedLayout>
          </Route>
          <Route path="/smart-dns">
            <ProtectedLayout><SmartDns /></ProtectedLayout>
          </Route>
          <Route path="/dns-shield">
            <ProtectedLayout><DnsShield /></ProtectedLayout>
          </Route>
          <Route path="/router-config">
            <ProtectedLayout><RouterConfig /></ProtectedLayout>
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
            title: "Operator Login",
            subtitle: "Authenticate to access ProxhqVPN OS",
          },
        },
        signUp: {
          start: {
            title: "Request Access",
            subtitle: "Create your ProxhqVPN operator account",
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
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;
