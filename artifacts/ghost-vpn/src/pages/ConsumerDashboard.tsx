// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { VpnConnectCard } from "@/components/vpn/VpnConnectCard";
import { Panel, StatusBadge } from "@/components/system";

export default function ConsumerDashboard() {
  return (
    <main id="main-content" className="mx-auto max-w-6xl space-y-6">
      <section className="rounded-3xl border border-primary/20 bg-primary/[0.04] p-8 text-center shadow-xl shadow-black/30">
        <div className="text-xs uppercase tracking-[0.35em] text-primary/70">
          ProxhqVPN
        </div>
        <h1 className="mt-3 text-3xl font-bold text-white">
          Your VPN protection
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-sm text-white/55">
          Connect securely, protect your device, and keep your network activity
          private.
        </p>
        <div className="mt-8 flex justify-center">
          <VpnConnectCard />
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Panel title="VPN Status">
          <StatusBadge status="inactive" />
        </Panel>
        <Panel title="Current IP">
          <div className="text-sm text-white/70">Hidden after connection</div>
        </Panel>
        <Panel title="Server">
          <div className="text-sm text-white/70">Auto-select best</div>
        </Panel>
        <Panel title="Protection Score">
          <div className="text-2xl font-bold text-primary">—</div>
        </Panel>
      </div>
    </main>
  );
}
