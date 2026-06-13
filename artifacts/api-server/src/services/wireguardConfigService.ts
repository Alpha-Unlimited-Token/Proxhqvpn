// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import crypto from "crypto";

export type WireGuardPeer = {
  publicKey: string;
  allowedIps: string[];
  endpoint?: string | null;
  persistentKeepalive?: number | null;
};

export type WireGuardInterface = {
  privateKey: string;
  address: string[];
  dns?: string[];
  mtu?: number;
};

export type RenderWireGuardConfigInput = {
  iface: WireGuardInterface;
  peers: WireGuardPeer[];
};

function renderList(values: string[] | undefined): string | null {
  if (!values || values.length === 0) return null;
  return values.join(", ");
}

export function renderWireGuardConfig(
  input: RenderWireGuardConfigInput,
): string {
  const lines: string[] = [];

  lines.push("[Interface]");
  lines.push(`PrivateKey = ${input.iface.privateKey}`);
  lines.push(`Address = ${input.iface.address.join(", ")}`);

  const dns = renderList(input.iface.dns);
  if (dns) lines.push(`DNS = ${dns}`);

  if (input.iface.mtu) {
    lines.push(`MTU = ${input.iface.mtu}`);
  }

  for (const peer of input.peers) {
    lines.push("");
    lines.push("[Peer]");
    lines.push(`PublicKey = ${peer.publicKey}`);
    lines.push(`AllowedIPs = ${peer.allowedIps.join(", ")}`);

    if (peer.endpoint) {
      lines.push(`Endpoint = ${peer.endpoint}`);
    }

    if (peer.persistentKeepalive) {
      lines.push(`PersistentKeepalive = ${peer.persistentKeepalive}`);
    }
  }

  return `${lines.join("\n")}\n`;
}

export function fingerprintWireGuardConfig(config: string): string {
  return crypto.createHash("sha256").update(config, "utf8").digest("hex");
}

export function validateWireGuardPublicKey(value: string): boolean {
  return /^[A-Za-z0-9+/]{43}=$/.test(value);
}

export function validateWireGuardPrivateKey(value: string): boolean {
  return validateWireGuardPublicKey(value);
}
