// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Link, useLocation } from "wouter";
import { getNavSections, type AppRouteMeta } from "@/routes/routeRegistry";
import { useAccess } from "@/hooks/useAccess";

function canShowRoute(
  route: AppRouteMeta,
  access: {
    isAdmin: boolean;
    isEmployee: boolean;
    hasAccess: boolean;
    hasCommandCenter: boolean;
  },
): boolean {
  switch (route.access) {
    case "public":
      return true;
    case "authenticated":
      return true;
    case "vpn":
      return access.hasAccess || access.isAdmin || access.isEmployee;
    case "command_center":
      return access.hasCommandCenter || access.isAdmin || access.isEmployee;
    case "admin":
      return access.isAdmin || access.isEmployee;
    default:
      return false;
  }
}

function riskBadge(risk: AppRouteMeta["risk"]) {
  if (!risk || risk === "low") return null;

  return (
    <span className="ml-auto text-[9px] uppercase tracking-widest text-yellow-300/70 border border-yellow-400/20 rounded px-1.5 py-0.5">
      {risk}
    </span>
  );
}

export function RegistryNav() {
  const [location] = useLocation();
  const access = useAccess();

  const sections = getNavSections()
    .map((section) => ({
      ...section,
      routes: section.routes.filter((route) => canShowRoute(route, access)),
    }))
    .filter((section) => section.routes.length > 0);

  return (
    <nav className="space-y-6">
      {sections.map((section) => (
        <div key={section.title} className="space-y-2">
          <div className="px-3 text-[10px] uppercase tracking-[0.22em] text-white/35 font-semibold">
            {section.title}
          </div>

          <div className="space-y-1">
            {section.routes.map((route) => {
              const active =
                location === route.path ||
                (route.path !== "/" && location.startsWith(`${route.path}/`));

              return (
                <Link
                  key={route.path}
                  href={route.path}
                  className={[
                    "flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] transition-colors",
                    active
                      ? "bg-primary/12 text-primary border border-primary/20"
                      : "text-white/68 hover:text-white hover:bg-white/[0.05] border border-transparent",
                  ].join(" ")}
                >
                  <span className="truncate">{route.label}</span>
                  {riskBadge(route.risk)}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
