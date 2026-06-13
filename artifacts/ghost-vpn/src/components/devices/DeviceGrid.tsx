import { DeviceCard } from "./DeviceCard";

export function DeviceGrid({ devices }: { devices: any[] }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {devices.map((device) => (
        <DeviceCard key={device.id ?? device.deviceId} device={device} />
      ))}
    </div>
  );
}
