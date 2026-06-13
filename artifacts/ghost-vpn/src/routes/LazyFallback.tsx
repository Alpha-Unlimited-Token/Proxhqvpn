// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
export function LazyFallback() {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-primary/40 border-t-primary animate-spin" />
        <span className="text-primary/60 text-xs font-mono">Loading…</span>
      </div>
    </div>
  );
}
