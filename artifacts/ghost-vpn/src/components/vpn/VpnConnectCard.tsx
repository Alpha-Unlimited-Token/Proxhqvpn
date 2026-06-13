export function VpnConnectCard({ connected = false }: { connected?: boolean }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.035] p-8 text-center shadow-xl shadow-black/30">
      <div className={connected ? "text-primary" : "text-white/45"}>
        {connected ? "Protected" : "Not connected"}
      </div>
      <button
        aria-label={connected ? "Disconnect from VPN" : "Connect to VPN"}
        className="mt-6 h-36 w-36 rounded-full border border-primary/30 bg-primary/10 text-lg font-bold text-primary hover:bg-primary hover:text-black transition"
      >
        {connected ? "Disconnect" : "Connect"}
      </button>
      <p className="mt-6 text-sm text-white/50">
        {connected
          ? "Your traffic is protected through ProxhqVPN."
          : "Connect to protect your device."}
      </p>
    </div>
  );
}
