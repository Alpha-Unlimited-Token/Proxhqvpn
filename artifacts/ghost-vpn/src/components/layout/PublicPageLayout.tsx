// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { type ReactNode, useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Menu, X } from "lucide-react";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

const NAV_LINKS = [
  { label: "Home",        href: "/" },
  { label: "Pricing",     href: "/pricing" },
  { label: "Downloads",   href: "/downloads" },
  { label: "Ambassadors", href: "/ambassadors" },
  { label: "Guide",       href: "/guide" },
];

function PublicNav() {
  const [scrolled,    setScrolled]    = useState(false);
  const [mobileOpen, setMobileOpen]   = useState(false);
  const [location]                    = useLocation();

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, []);

  useEffect(() => setMobileOpen(false), [location]);

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-[#080d09]/95 backdrop-blur border-b border-white/[0.06] shadow-lg"
          : "bg-[#080d09] border-b border-white/[0.04]"
      }`}
    >
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center">
            <img
              src={`${BASE}/icon-final2.png`}
              alt=""
              className="w-5 h-5"
              onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          </div>
          <span className="text-base font-bold text-white group-hover:text-primary transition-colors">
            ProxhqVPN
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map(({ label, href }) => (
            <Link
              key={label}
              href={href}
              className={`px-4 py-2 text-sm rounded-lg transition-all ${
                location === href
                  ? "text-primary bg-primary/10"
                  : "text-white/80 hover:text-white hover:bg-white/[0.05]"
              }`}
            >
              {label}
            </Link>
          ))}
        </nav>

        {/* CTA buttons */}
        <div className="hidden md:flex items-center gap-2">
          <Link
            href="/sign-in"
            className="px-4 py-2 text-sm text-white/80 hover:text-white transition-colors"
          >
            Sign In
          </Link>
          <Link
            href="/sign-up"
            className="px-4 py-2 text-sm font-semibold bg-primary text-black rounded-xl hover:brightness-110 transition-all shadow-[0_0_20px_rgba(0,255,136,0.2)]"
          >
            Get Started
          </Link>
        </div>

        {/* Mobile menu toggle */}
        <button
          className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg text-white/80 hover:text-white hover:bg-white/[0.06] transition-all"
          onClick={() => setMobileOpen(v => !v)}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile nav */}
      {mobileOpen && (
        <div className="md:hidden bg-[#080d09]/98 border-t border-white/[0.06] px-6 py-4 space-y-1">
          {NAV_LINKS.map(({ label, href }) => (
            <Link
              key={label}
              href={href}
              className={`block px-4 py-3 text-sm rounded-xl transition-all ${
                location === href
                  ? "text-primary bg-primary/10"
                  : "text-white/80 hover:text-white hover:bg-white/[0.05]"
              }`}
            >
              {label}
            </Link>
          ))}
          <div className="pt-3 flex flex-col gap-2">
            <Link
              href="/sign-in"
              className="block text-center py-3 text-sm text-white/80 border border-white/[0.1] rounded-xl hover:border-white/20 transition-all"
            >
              Sign In
            </Link>
            <Link
              href="/sign-up"
              className="block text-center py-3 text-sm font-semibold bg-primary text-black rounded-xl hover:brightness-110 transition-all"
            >
              Get Started Free
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}

export function PublicPageLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[#080d09] text-white flex flex-col selection:bg-primary selection:text-black">
      <PublicNav />
      <main className="flex-1">{children}</main>
      <footer className="border-t border-white/[0.05] py-6 text-center text-[11px] text-white/25 font-mono">
        © {new Date().getFullYear()} ALPHA UNLIMITED TECHNOLOGIES LLC. All rights reserved.
      </footer>
    </div>
  );
}
