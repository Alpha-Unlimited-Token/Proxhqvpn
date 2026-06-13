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

export async function provisionVpnConfig(input: ProvisionVpnConfigInput) {
  if (!validateWireGuardPrivateKey(input.privateKey)) {
    throw new Error("Invalid WireGuard private key");
  }

  const nodes = await getAvailableVpnNodes();

  const peers = nodes
    .filter((node) => node.publicKey && validateWireGuardPublicKey(node.publicKey))
    .map((node) => ({
      publicKey: node.publicKey,
      // nodesTable uses listenPort (not port) and ipAddress / publicIp
      endpoint:
        node.publicIp && node.listenPort
          ? `${node.publicIp}:${node.listenPort}`
          : node.ipAddress && node.listenPort
            ? `${node.ipAddress}:${node.listenPort}`
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
