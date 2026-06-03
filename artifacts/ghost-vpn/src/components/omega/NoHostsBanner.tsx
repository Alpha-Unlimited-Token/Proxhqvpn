// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Link } from "wouter";
import { Server, ArrowRight } from "lucide-react";

export function NoHostsBanner() {
  return (
    <div className="flex items-start gap-3 rounded-md border border-yellow-500/25 bg-yellow-500/8 px-4 py-3 mb-4">
      <Server className="h-4 w-4 text-yellow-400/70 mt-0.5 shrink-0" />
      <div className="text-sm">
        <span className="font-semibold text-yellow-400/90">No hosts registered yet.</span>{" "}
        <span className="text-muted-foreground">
          You need to add a host before using this tool.{" "}
        </span>
        <Link href="/omega-hosts" className="inline-flex items-center gap-1 text-primary hover:underline font-medium">
          Go to Omega → Hosts <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}
