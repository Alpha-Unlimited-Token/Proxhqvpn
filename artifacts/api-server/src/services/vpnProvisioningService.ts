// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { getAvailableVpnNodes } from "./nodeService";
import {
  fingerprintWireGuardConfig,
  renderWireGuardConfig,
  validateWireGuardPrivateKey,
  validateWireGuardPublicKey,
} from "./wireguardConfigService";

export type ProvisionVpnConfigInput = {
  userId: string;
  deviceId: string;
  privateKey: string;
  address: string[];
  dns?: string[];
};

function readNodeValue(node: any, keys: string[]): unknown {
  for (const key of keys) {
    if (node[key] !== undefined && node[key] !== null) return node[key];
  }

  return null;
}

export async function provisionVpnConfig(input: ProvisionVpnConfigInput) {
  if (!validateWireGuardPrivateKey(input.privateKey)) {
    throw new Error("Invalid WireGuard private key");
  }

  const nodes = await getAvailableVpnNodes();

  const peers = nodes
    .map((node: any) => {
      const publicKey = readNodeValue(node, [
        "publicKey",
        "public_key",
        "wireguardPublicKey",
      ]);

      const publicIp = readNodeValue(node, [
        "publicIp",
        "public_ip",
        "ipAddress",
        "ip_address",
      ]);

      const port = readNodeValue(node, [
        "port",
        "listenPort",
        "listen_port",
        "wireguardPort",
      ]);

      return { publicKey, publicIp, port };
    })
    .filter(
      (node) =>
        node.publicKey &&
        validateWireGuardPublicKey(String(node.publicKey)),
    )
    .map((node) => ({
      publicKey: String(node.publicKey),
      endpoint:
        node.publicIp && node.port
          ? `${String(node.publicIp)}:${String(node.port)}`
          : null,
      allowedIps: ["0.0.0.0/0", "::/0"],
      persistentKeepalive: 25,
    }));

  if (peers.length === 0) {
    throw new Error("No available VPN nodes with valid WireGuard public keys");
  }

  const config = renderWireGuardConfig({
    iface: {
      privateKey: input.privateKey,
      address: input.address,
      dns: input.dns ?? ["1.1.1.1", "9.9.9.9"],
      mtu: 1420,
    },
    peers,
  });

  return {
    userId: input.userId,
    deviceId: input.deviceId,
    config,
    fingerprint: fingerprintWireGuardConfig(config),
    peerCount: peers.length,
  };
}
