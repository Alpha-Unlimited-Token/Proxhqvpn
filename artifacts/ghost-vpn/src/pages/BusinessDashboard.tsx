// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Link } from "wouter";
import { Panel } from "@/components/system";
import { EmptyState } from "@/components/system/StateBlocks";

export default function BusinessDashboard() {
  return (
    <main id="main-content" className="space-y-6">
      <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-6">
        <div className="text-xs uppercase tracking-[0.3em] text-primary/60">
          Business
        </div>
        <h1 className="mt-2 text-2xl font-bold text-white">
          Team protection overview
        </h1>
        <p className="mt-2 text-sm text-white/55">
          Manage users, devices, policies, and VPN reliability.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Panel title="Users">
          <div className="text-2xl font-bold text-white">—</div>
        </Panel>
        <Panel title="Devices">
          <div className="text-2xl font-bold text-white">—</div>
        </Panel>
        <Panel title="Policies">
          <div className="text-2xl font-bold text-white">—</div>
        </Panel>
        <Panel title="Reports">
          <div className="text-sm text-white/55">Ready</div>
        </Panel>
      </div>

      <EmptyState
        title="No team members yet"
        description="Invite your team to start managing secure access together."
        action={
          <Link
            href="/user-management"
            className="inline-block rounded-xl bg-primary px-5 py-2 text-sm font-bold text-black"
          >
            Manage Users
          </Link>
        }
      />
    </main>
  );
}
