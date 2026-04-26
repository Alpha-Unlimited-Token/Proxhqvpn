import { Router } from "express";
import { getAuth } from "@clerk/express";

const router = Router();

interface GpsProfile {
  enabled: boolean;
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude: number;
  city: string;
  country: string;
  setAt: string;
}

const store = new Map<string, GpsProfile>();

const PRESETS = [
  { city: "New York", country: "US", latitude: 40.7128, longitude: -74.0060 },
  { city: "London", country: "GB", latitude: 51.5074, longitude: -0.1278 },
  { city: "Tokyo", country: "JP", latitude: 35.6762, longitude: 139.6503 },
  { city: "Paris", country: "FR", latitude: 48.8566, longitude: 2.3522 },
  { city: "Sydney", country: "AU", latitude: -33.8688, longitude: 151.2093 },
  { city: "Berlin", country: "DE", latitude: 52.5200, longitude: 13.4050 },
  { city: "São Paulo", country: "BR", latitude: -23.5505, longitude: -46.6333 },
  { city: "Toronto", country: "CA", latitude: 43.6532, longitude: -79.3832 },
  { city: "Singapore", country: "SG", latitude: 1.3521, longitude: 103.8198 },
  { city: "Dubai", country: "AE", latitude: 25.2048, longitude: 55.2708 },
];

function uid(req: any) {
  return (getAuth(req) as any)?.userId || "anon";
}

router.get("/presets", (_req, res) => {
  res.json({ presets: PRESETS });
});

router.get("/status", (req, res) => {
  const profile = store.get(uid(req));
  if (!profile) return res.json({ enabled: false, profile: null });
  res.json({ enabled: profile.enabled, profile });
});

router.post("/set", (req, res) => {
  const { latitude, longitude, accuracy = 10, altitude = 0, city = "Custom", country = "XX" } = req.body;
  if (typeof latitude !== "number" || typeof longitude !== "number") {
    return res.status(400).json({ error: "latitude and longitude required" });
  }
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    return res.status(400).json({ error: "coordinates out of range" });
  }
  const profile: GpsProfile = {
    enabled: true,
    latitude,
    longitude,
    accuracy: Math.max(1, Math.min(accuracy, 100)),
    altitude,
    city,
    country,
    setAt: new Date().toISOString(),
  };
  store.set(uid(req), profile);
  res.json({ ok: true, profile });
});

router.post("/preset/:index", (req, res) => {
  const idx = parseInt(req.params.index);
  if (isNaN(idx) || idx < 0 || idx >= PRESETS.length) {
    return res.status(400).json({ error: "invalid preset index" });
  }
  const preset = PRESETS[idx];
  const profile: GpsProfile = {
    enabled: true,
    latitude: preset.latitude + (Math.random() - 0.5) * 0.01,
    longitude: preset.longitude + (Math.random() - 0.5) * 0.01,
    accuracy: Math.floor(Math.random() * 15) + 5,
    altitude: Math.floor(Math.random() * 50),
    city: preset.city,
    country: preset.country,
    setAt: new Date().toISOString(),
  };
  store.set(uid(req), profile);
  res.json({ ok: true, profile });
});

router.delete("/clear", (req, res) => {
  store.delete(uid(req));
  res.json({ ok: true, enabled: false });
});

export default router;
