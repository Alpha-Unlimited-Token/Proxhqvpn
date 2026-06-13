// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Component, type ReactNode } from "react";
import { captureFrontendError } from "@/lib/frontendTelemetry";

export class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: unknown) {
    console.error("[ProxhqVPN] Crash:", error, info);
    captureFrontendError(error, { info });
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-black flex items-center justify-center p-8">
          <div className="border border-red-500/30 bg-red-900/10 p-6 max-w-lg w-full font-mono">
            <div className="text-red-400 text-sm font-bold uppercase tracking-widest mb-3">
              App Crash Caught
            </div>
            <div className="text-red-300/80 text-xs mb-2">
              {this.state.error.message}
            </div>
            <button
              onClick={() => this.setState({ error: null })}
              className="mt-4 border border-red-400/40 text-red-400 text-xs px-3 py-1.5 hover:bg-red-400/10 uppercase"
            >
              Retry
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
