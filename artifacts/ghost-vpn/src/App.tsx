// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ClerkProvider } from "@clerk/react";
import { Router as WouterRouter, useLocation } from "wouter";
import { ErrorBoundary } from "@/routes/errorBoundary";
import { AppRoutes } from "@/routes/AppRoutes";
import { ClerkQueryClientCacheInvalidator } from "@/routes/queryInvalidator";
import { ScrollToTop } from "@/routes/ScrollToTop";
import {
  basePath,
  clerkAppearance,
  clerkLocalization,
  clerkProxyUrl,
  clerkPubKey,
  stripBase,
} from "@/routes/clerkConfig";
import { ThemeProvider } from "@/theme/ThemeProvider";

const queryClient = new QueryClient();

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInFallbackRedirectUrl={`${basePath}/app`}
      signUpFallbackRedirectUrl={`${basePath}/app`}
      localization={clerkLocalization}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <ClerkQueryClientCacheInvalidator />
          <ScrollToTop />
          <AppRoutes />
        </ThemeProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <WouterRouter base={basePath}>
        <ClerkProviderWithRoutes />
      </WouterRouter>
    </ErrorBoundary>
  );
}
