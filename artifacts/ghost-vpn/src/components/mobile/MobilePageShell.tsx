import type { ReactNode } from "react";

export function MobilePageShell({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-black px-4 py-5 text-white md:px-6">
      <h1 className="mb-5 text-xl font-bold">{title}</h1>
      <div className="space-y-4">{children}</div>
    </div>
  );
}
