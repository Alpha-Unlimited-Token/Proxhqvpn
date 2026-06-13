import { useOnlineStatus } from "@/hooks/useOnlineStatus";

export function OfflineBanner() {
  const online = useOnlineStatus();

  if (online) return null;

  return (
    <div className="fixed left-0 right-0 top-0 z-[9999] border-b border-yellow-400/30 bg-yellow-950 px-4 py-2 text-center text-xs font-semibold text-yellow-200">
      You are offline. Some ProxhqVPN controls may be unavailable.
    </div>
  );
}
