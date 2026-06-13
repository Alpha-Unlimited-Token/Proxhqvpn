import { Panel, StatusBadge } from "@/components/system";

export function DeviceCard({ device }: { device: any }) {
  return (
    <Panel>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-white">
            {device.name ?? device.deviceId ?? "Unnamed Device"}
          </div>
          <div className="mt-1 text-xs text-white/45">
            {device.platform ?? "Unknown platform"}
          </div>
        </div>
        <StatusBadge status={device.revoked ? "inactive" : "active"} />
      </div>

      <div className="mt-4 text-xs text-white/45">
        Last seen: {device.lastSeenAt ?? "Never"}
      </div>
    </Panel>
  );
}
