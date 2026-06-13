// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import React, { createContext, useContext } from "react";
import { securityApiFetch } from "./securityApiClient";

type SecurityApiContextValue = {
  apiFetch: typeof securityApiFetch;
};

const SecurityApiContext = createContext<SecurityApiContextValue | null>(null);

export function SecurityApiProvider({ children }: { children: React.ReactNode }) {
  return (
    <SecurityApiContext.Provider value={{ apiFetch: securityApiFetch }}>
      {children}
    </SecurityApiContext.Provider>
  );
}

export function useSecurityApi() {
  const ctx = useContext(SecurityApiContext);

  if (!ctx) {
    throw new Error("useSecurityApi must be used inside SecurityApiProvider");
  }

  return ctx;
}
