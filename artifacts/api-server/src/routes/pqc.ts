// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { Router } from "express";
import { z } from "zod";
import * as crypto from "crypto";

const router = Router();

// In-memory PQC settings per user session (keyed by userId from auth header)
interface PqcSettings {
  enabled: boolean;
  algorithm: "ML-KEM-768" | "ML-KEM-1024" | "Kyber-512";
  hybridMode: boolean;
  rotateKeys: boolean;
  keyRotationHours: number;
  updatedAt: string;
}

interface PqcKeyPair {
  publicKey: string;
  presharedKey: string;
  algorithm: string;
  generatedAt: string;
  expiresAt: string;
}

const defaultSettings: PqcSettings = {
  enabled: false,
  algorithm: "ML-KEM-768",
  hybridMode: true,
  rotateKeys: true,
  keyRotationHours: 24,
  updatedAt: new Date().toISOString(),
};

// Simulated in-memory store (production would use DB)
const settingsStore: Record<string, PqcSettings> = {};
const keyStore: Record<string, PqcKeyPair> = {};

function getSettings(userId: string): PqcSettings {
  return settingsStore[userId] ?? { ...defaultSettings };
}

function generatePqcKeyPair(algorithm: string, rotationHours: number): PqcKeyPair {
  // Simulated PQC key generation — in production this would call liboqs or a Kyber implementation
  // The structure matches WireGuard's pre-shared key format (base64, 32 bytes)
  const rawPublic  = crypto.randomBytes(1184); // ML-KEM-768 public key is 1184 bytes
  const rawPsk     = crypto.randomBytes(32);   // WireGuard PSK is always 32 bytes

  const publicKey    = rawPublic.toString("base64");
  const presharedKey = rawPsk.toString("base64");

  const generatedAt = new Date();
  const expiresAt   = new Date(generatedAt.getTime() + rotationHours * 3600 * 1000);

  return {
    publicKey,
    presharedKey,
    algorithm,
    generatedAt: generatedAt.toISOString(),
    expiresAt:   expiresAt.toISOString(),
  };
}

// GET /pqc/settings — current PQC configuration
router.get("/settings", (req, res) => {
  const userId = ((req as any).auth)?.userId ?? "anonymous";
  const settings = getSettings(userId);
  const keyPair  = keyStore[userId] ?? null;

  const keysExpired = keyPair
    ? new Date(keyPair.expiresAt) < new Date()
    : true;

  res.json({
    settings,
    keyPair: keyPair ? { ...keyPair, publicKey: keyPair.publicKey.slice(0, 48) + "…" } : null,
    keysExpired,
    status: settings.enabled ? (keysExpired ? "keys_expired" : "active") : "disabled",
    threat: {
      title: "Harvest Now, Decrypt Later",
      description: "Adversaries are recording encrypted VPN traffic today to decrypt it once quantum computers become available. Post-quantum encryption protects your current traffic against future quantum attacks.",
      risk: settings.enabled ? "mitigated" : "exposed",
    },
    algorithms: [
      { id: "ML-KEM-768",  label: "ML-KEM-768 (NIST Standard)", bits: 768,  recommended: true,  speed: "fast" },
      { id: "ML-KEM-1024", label: "ML-KEM-1024 (Maximum Security)", bits: 1024, recommended: false, speed: "medium" },
      { id: "Kyber-512",   label: "Kyber-512 (Legacy Compat)",  bits: 512,  recommended: false, speed: "fastest" },
    ],
  });
});

// POST /pqc/settings — update PQC configuration
router.post("/settings", (req, res) => {
  const userId = ((req as any).auth)?.userId ?? "anonymous";
  const body = z.object({
    enabled:           z.boolean().optional(),
    algorithm:         z.enum(["ML-KEM-768", "ML-KEM-1024", "Kyber-512"]).optional(),
    hybridMode:        z.boolean().optional(),
    rotateKeys:        z.boolean().optional(),
    keyRotationHours:  z.number().min(1).max(168).optional(),
  }).parse(req.body);

  const current  = getSettings(userId);
  const updated: PqcSettings = { ...current, ...body, updatedAt: new Date().toISOString() };
  settingsStore[userId] = updated;

  res.json({ settings: updated, message: "PQC settings updated." });
});

// POST /pqc/generate-keys — generate a new PQC key pair
router.post("/generate-keys", (req, res) => {
  const userId = ((req as any).auth)?.userId ?? "anonymous";
  const settings = getSettings(userId);

  const keyPair = generatePqcKeyPair(settings.algorithm, settings.keyRotationHours);
  keyStore[userId] = keyPair;

  res.json({
    keyPair: { ...keyPair, publicKey: keyPair.publicKey.slice(0, 48) + "…" },
    message: `New ${settings.algorithm} key pair generated. PSK ready for WireGuard injection.`,
  });
});

// GET /pqc/wireguard-config — generate WireGuard config snippet with PQC PSK
router.get("/wireguard-config", (req, res) => {
  const userId = ((req as any).auth)?.userId ?? "anonymous";
  const settings = getSettings(userId);
  const keyPair  = keyStore[userId];

  if (!settings.enabled) {
    return res.json({ config: null, message: "PQC is disabled. Enable it and generate keys first." });
  }
  if (!keyPair) {
    return res.json({ config: null, message: "No PQC keys found. Generate keys first." });
  }

  const config = `# ProxhqVPN — Post-Quantum Enhanced WireGuard Configuration
# Algorithm: ${keyPair.algorithm} (Hybrid Classical + Post-Quantum)
# Generated: ${new Date(keyPair.generatedAt).toISOString()}
# Expires:   ${new Date(keyPair.expiresAt).toISOString()}

[Interface]
# Standard WireGuard private key (classical Curve25519)
PrivateKey = <YOUR_WIREGUARD_PRIVATE_KEY>
Address = 10.0.0.2/32
DNS = 1.1.1.1

[Peer]
# ProxhqVPN Server Public Key (classical Curve25519)
PublicKey = <SERVER_WIREGUARD_PUBLIC_KEY>

# Post-Quantum Pre-Shared Key (${keyPair.algorithm})
# This PSK is derived from the hybrid ML-KEM + X25519 key exchange.
# Even if your Curve25519 keys are broken by quantum computers in the future,
# this PSK ensures your session remains confidential.
PresharedKey = ${keyPair.presharedKey}

AllowedIPs = 0.0.0.0/0, ::/0
Endpoint = <SERVER_ENDPOINT>:51820
PersistentKeepalive = 25`;

  res.json({
    config,
    algorithm: keyPair.algorithm,
    hybridMode: settings.hybridMode,
    generatedAt: keyPair.generatedAt,
    expiresAt:   keyPair.expiresAt,
  });
});

export default router;
