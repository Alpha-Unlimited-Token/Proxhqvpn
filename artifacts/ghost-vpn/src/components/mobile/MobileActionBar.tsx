import type { ReactNode } from "react";

export function MobileActionBar({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-black/90 p-3 backdrop-blur md:hidden">
      <div className="flex gap-2">{children}</div>
    </div>
  );
}
