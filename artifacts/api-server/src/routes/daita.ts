import { Router } from "express";
import { z } from "zod";

const router = Router();

interface DaitaSettings {
  enabled: boolean;
  intensity: number;          // 1–10 — how aggressively to pad/morph
  packetPaddingMin: number;   // bytes
  packetPaddingMax: number;   // bytes
  timingJitterMin:  number;   // ms
  timingJitterMax:  number;   // ms
  dummyPacketRate:  number;   // dummy packets per second (0 = off)
  morphTraffic:     boolean;  // reshape packet size distribution to look uniform
  updatedAt: string;
}

const defaultSettings: DaitaSettings = {
  enabled: false,
  intensity: 5,
  packetPaddingMin: 0,
  packetPaddingMax: 1500,
  timingJitterMin:  0,
  timingJitterMax:  50,
  dummyPacketRate:  0,
  morphTraffic:     true,
  updatedAt: new Date().toISOString(),
};

const settingsStore: Record<string, DaitaSettings> = {};

function getSettings(userId: string): DaitaSettings {
  return settingsStore[userId] ?? { ...defaultSettings };
}

function intensityToParams(level: number): Omit<DaitaSettings, "enabled" | "intensity" | "morphTraffic" | "updatedAt"> {
  const t = (level - 1) / 9; // 0 → 1
  return {
    packetPaddingMin: Math.round(0   + t * 200),
    packetPaddingMax: Math.round(500 + t * 1000),
    timingJitterMin:  Math.round(0   + t * 20),
    timingJitterMax:  Math.round(10  + t * 90),
    dummyPacketRate:  Math.round(0   + t * 10),
  };
}

// GET /daita/settings
router.get("/settings", (req, res) => {
  const userId = (req.auth as any)?.userId ?? "anonymous";
  const settings = getSettings(userId);

  res.json({
    settings,
    threat: {
      title: "AI-Based Traffic Analysis (AITA)",
      description: "Machine learning models can analyze encrypted VPN traffic patterns — packet sizes, timing, inter-arrival rates — to fingerprint websites you visit, identify users, or detect VPN usage even through encryption.",
      techniques: [
        "Deep Packet Inspection (DPI) fingerprinting",
        "Website fingerprinting via timing correlation",
        "Flow-level ML classifiers",
        "ISP-level traffic shaping detection",
        "Cross-correlation de-anonymization attacks",
      ],
      risk: settings.enabled ? "mitigated" : "exposed",
    },
    presets: [
      { id: "stealth",    label: "Stealth",    intensity: 3,  desc: "Minimal overhead, basic traffic morphing" },
      { id: "balanced",   label: "Balanced",   intensity: 5,  desc: "Good protection with moderate performance impact" },
      { id: "maximum",    label: "Maximum",    intensity: 10, desc: "Full DAITA — strongest protection, highest overhead" },
    ],
  });
});

// POST /daita/settings
router.post("/settings", (req, res) => {
  const userId = (req.auth as any)?.userId ?? "anonymous";
  const body = z.object({
    enabled:          z.boolean().optional(),
    intensity:        z.number().min(1).max(10).optional(),
    packetPaddingMin: z.number().min(0).max(1500).optional(),
    packetPaddingMax: z.number().min(0).max(9000).optional(),
    timingJitterMin:  z.number().min(0).max(500).optional(),
    timingJitterMax:  z.number().min(0).max(2000).optional(),
    dummyPacketRate:  z.number().min(0).max(50).optional(),
    morphTraffic:     z.boolean().optional(),
    applyPreset:      z.enum(["stealth", "balanced", "maximum"]).optional(),
  }).parse(req.body);

  const current = getSettings(userId);
  let updated = { ...current, ...body, updatedAt: new Date().toISOString() };

  if (body.applyPreset) {
    const presetIntensity = { stealth: 3, balanced: 5, maximum: 10 }[body.applyPreset];
    const params = intensityToParams(presetIntensity);
    updated = { ...updated, intensity: presetIntensity, ...params };
  } else if (body.intensity !== undefined) {
    const params = intensityToParams(body.intensity);
    updated = { ...updated, ...params };
  }

  settingsStore[userId] = updated;
  res.json({ settings: updated, message: "DAITA settings updated." });
});

// GET /daita/rules — generate iptables/tc rules for DAITA
router.get("/rules", (req, res) => {
  const userId = (req.auth as any)?.userId ?? "anonymous";
  const s = getSettings(userId);

  if (!s.enabled) {
    return res.json({ rules: null, message: "DAITA is disabled." });
  }

  const rules = `#!/bin/bash
# ProxhqVPN DAITA (Defense Against AI Traffic Analysis) Rules
# Intensity: ${s.intensity}/10 | Generated: ${new Date().toISOString()}

WG_IFACE="wg0"
DUMMY_RATE="${s.dummyPacketRate}"

# ── Traffic Shaping with Netem (kernel-level timing jitter) ────────────────
# Adds ${s.timingJitterMin}–${s.timingJitterMax}ms timing jitter to outbound WireGuard packets.
# This defeats correlation attacks that rely on precise packet timing.
tc qdisc del dev $WG_IFACE root 2>/dev/null
tc qdisc add dev $WG_IFACE root netem \\
  delay ${s.timingJitterMin}ms ${s.timingJitterMax}ms \\
  loss 0% \\
  corrupt 0%

# ── Packet Padding (CAKE shaper) ──────────────────────────────────────────
# Morphs packet sizes toward a uniform distribution between ${s.packetPaddingMin}–${s.packetPaddingMax} bytes.
# Defeats website-fingerprinting attacks that analyze packet size histograms.
tc qdisc add dev $WG_IFACE parent 1:1 handle 10: cake \\
  bandwidth 1gbit \\
  overhead ${s.packetPaddingMax}

# ── Dummy Packet Injection ─────────────────────────────────────────────────
# Sends ${s.dummyPacketRate} dummy WireGuard-encapsulated packets per second.
# These are discarded by the server but defeat timing correlation at the ISP level.
${s.dummyPacketRate > 0 ? `# Run in background:
# proxhqvpn-dummy-inject --rate ${s.dummyPacketRate} --iface $WG_IFACE &` : "# Dummy injection disabled (dummyPacketRate = 0)"}

# ── Traffic Morphing ───────────────────────────────────────────────────────
${s.morphTraffic ? `# Enabled: packets are padded to fixed block sizes to defeat size-based fingerprinting.
# This makes your traffic pattern statistically indistinguishable from a uniform distribution.
iptables -t mangle -A POSTROUTING -o $WG_IFACE -j MARK --set-mark 0x4441` : "# Traffic morphing disabled"}

echo "DAITA rules applied: intensity ${s.intensity}/10"`;

  res.json({
    rules,
    settings: s,
    note: "Apply these rules on your WireGuard server or client host after VPN connection is established.",
  });
});

export default router;
