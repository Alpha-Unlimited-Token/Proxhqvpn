// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import type { ReactNode } from "react";
import { Redirect } from "wouter";
import { useUser } from "@clerk/react";
import { Layout } from "@/components/layout/Layout";
import { PaywallGate, AdminGate } from "@/components/PaywallGate";

export function PublicLayout({ children }: { children: ReactNode }) {
  return <Layout>{children}</Layout>;
}

export function ProtectedLayout({ children }: { children: ReactNode }) {
  const { isSignedIn, isLoaded } = useUser();

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-primary/40 border-t-primary animate-spin" />
      </div>
    );
  }

  if (!isSignedIn) return <Redirect to="/sign-in" />;

  return <Layout>{children}</Layout>;
}

export function ToolLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedLayout>
      <PaywallGate requireTier="any">{children}</PaywallGate>
    </ProtectedLayout>
  );
}

export function CcLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedLayout>
      <PaywallGate requireTier="command_center">{children}</PaywallGate>
    </ProtectedLayout>
  );
}

export function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedLayout>
      <AdminGate>{children}</AdminGate>
    </ProtectedLayout>
  );
}
