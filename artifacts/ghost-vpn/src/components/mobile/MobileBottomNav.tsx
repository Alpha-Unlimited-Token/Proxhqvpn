import { Link, useLocation } from "wouter";
import { useUxMode } from "@/ux/UxModeProvider";

const navByMode = {
  consumer: [
    { label: "Dashboard", href: "/dashboard" },
    { label: "Servers", href: "/nodes" },
    { label: "Devices", href: "/devices" },
    { label: "Settings", href: "/account" },
  ],
  business: [
    { label: "Business", href: "/business" },
    { label: "Users", href: "/user-management" },
    { label: "Devices", href: "/devices" },
    { label: "Reports", href: "/reports" },
  ],
  security: [
    { label: "Command", href: "/command-center" },
    { label: "Alerts", href: "/security-dashboard-v2" },
    { label: "Ghost", href: "/ghost-trap" },
    { label: "Reports", href: "/reports" },
  ],
} as const;

export function MobileBottomNav() {
  const { mode } = useUxMode();
  const [location] = useLocation();
  const items = navByMode[mode];

  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-black/90 px-2 py-2 backdrop-blur md:hidden"
    >
      <div className="grid grid-cols-4 gap-1">
        {items.map(({ label, href }) => {
          const active = location === href || location.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={[
                "rounded-lg px-2 py-2 text-center text-[11px] transition hover:bg-white/10",
                active ? "text-primary font-semibold" : "text-white/70 hover:text-white",
              ].join(" ")}
              aria-current={active ? "page" : undefined}
            >
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
