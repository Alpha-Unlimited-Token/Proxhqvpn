// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Shield } from "lucide-react";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="flex items-center gap-2 p-4 border-b border-border bg-card">
        <Shield className="w-5 h-5 text-primary" />
        <span className="font-bold text-primary tracking-tight">ProxhqVPN</span>
        <span className="text-muted-foreground text-xs ml-auto">© Alpha Unlimited Technologies LLC</span>
      </header>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
