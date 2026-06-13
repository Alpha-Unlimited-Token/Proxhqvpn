// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import React from "react";
import { ClerkProvider } from "@clerk/react";
import { Router as WouterRouter, useLocation } from "wouter";
import { ErrorBoundary } from "@/routes/errorBoundary";
import { AppRoutes } from "@/routes/AppRoutes";

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
