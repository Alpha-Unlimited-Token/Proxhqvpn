// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Clipboard,
  Easing,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";

import { useColors } from "@/hooks/useColors";

const BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
const IS_WEB = Platform.OS === "web";

type TunnelStep = "idle" | "fetching" | "ready" | "imported" | "error";

interface ServerNode {
  id: number;
  name: string;
  location: string;
  ipAddress: string;
  latencyMs: number;
  status: string;
}

function PulsingShield({ step, colors }: { step: TunnelStep; colors: ReturnType<typeof useColors> }) {
  const pulse = useRef(new Animated.Value(1)).current;
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (IS_WEB) return;
    if (step === "imported") {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.parallel([
            Animated.timing(pulse, { toValue: 1.07, duration: 2000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
            Animated.timing(glow, { toValue: 1, duration: 2000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          ]),
          Animated.parallel([
            Animated.timing(pulse, { toValue: 1, duration: 2000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
            Animated.timing(glow, { toValue: 0.3, duration: 2000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          ]),
        ])
      );
      loop.start();
      return () => loop.stop();
    } else {
      pulse.setValue(1);
      glow.setValue(0);
    }
  }, [step]);

  const color =
    step === "imported" ? colors.primary
    : step === "ready" ? "#ffaa00"
    : step === "error" ? colors.destructive
    : colors.mutedForeground;

  const iconName =
    step === "imported" ? "shield"
    : step === "error" ? "shield-off"
    : "shield";

  return (
    <Animated.View style={[styles.shieldWrap, !IS_WEB && { transform: [{ scale: pulse }] }]}>
      <Animated.View style={[styles.shieldGlow, { backgroundColor: color, opacity: IS_WEB ? 0 : glow }]} />
      <View style={[styles.shieldOuter, { borderColor: color }]}>
        <View style={[styles.shieldInner, { backgroundColor: step === "imported" ? `${color}14` : "transparent" }]}>
          {step === "fetching"
            ? <ActivityIndicator size="large" color={color} />
            : <Feather name={iconName as any} size={52} color={color} />
          }
        </View>
      </View>
    </Animated.View>
  );
}

function ServerCard({ node, onPress, colors }: { node: ServerNode | null; onPress: () => void; colors: ReturnType<typeof useColors> }) {
  const pingColor = !node ? colors.mutedForeground
    : node.latencyMs < 80 ? "#22c55e"
    : node.latencyMs < 180 ? "#eab308"
    : "#ef4444";

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.serverCard,
        { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.8 : 1 },
      ]}
    >
      <View style={styles.serverCardLeft}>
        <Feather name="globe" size={18} color={colors.primary} />
        <View>
          <Text style={[styles.serverCardName, { color: colors.foreground }]}>
            {node?.location ?? "Select Server"}
          </Text>
          {node && (
            <Text style={[styles.serverCardSub, { color: colors.mutedForeground }]}>{node.ipAddress}</Text>
          )}
        </View>
      </View>
      <View style={styles.serverCardRight}>
        {node && node.latencyMs > 0 && (
          <View style={[styles.pingBadge, { backgroundColor: `${pingColor}18`, borderColor: `${pingColor}44` }]}>
            <View style={[styles.pingDot, { backgroundColor: pingColor }]} />
            <Text style={[styles.pingText, { color: pingColor }]}>{Math.round(node.latencyMs)}ms</Text>
          </View>
        )}
        <Feather name="chevron-right" size={14} color={colors.mutedForeground} />
      </View>
    </Pressable>
  );
}

function StepBadge({ n, label, active, done, colors }: {
  n: number; label: string; active: boolean; done: boolean; colors: ReturnType<typeof useColors>;
}) {
  const c = done ? colors.primary : active ? "#ffaa00" : colors.mutedForeground;
  return (
    <View style={styles.stepBadge}>
      <View style={[styles.stepCircle, { backgroundColor: done ? colors.primary : "transparent", borderColor: c }]}>
        {done
          ? <Feather name="check" size={11} color="#000" />
          : <Text style={[styles.stepNum, { color: c }]}>{n}</Text>
        }
      </View>
      <Text style={[styles.stepLabel, { color: c }]}>{label}</Text>
    </View>
  );
}

export default function VpnConnectScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { getToken } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<TunnelStep>("idle");
  const [selectedServer, setSelectedServer] = useState<ServerNode | null>(null);
  const [wgConfig, setWgConfig] = useState<string | null>(null);
  const [dnsProtection, setDnsProtection] = useState(true);
  const [obfuscation, setObfuscation] = useState(false);
  const [killSwitch, setKillSwitch] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => { loadServers(); }, []);

  const loadServers = async () => {
    try {
      const token = await getToken();
      const res = await fetch(`${BASE}/api/nodes`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        const nodes: ServerNode[] = (Array.isArray(data) ? data : (data.nodes ?? [])).map((n: any) => ({
          id: n.id,
          name: n.name ?? "Server",
          location: n.region ?? n.location ?? n.name ?? "Server",
          ipAddress: n.ipAddress ?? n.ip_address ?? "",
          latencyMs: n.latencyMs ?? n.latency_ms ?? 0,
          status: n.status ?? "active",
        }));
        if (nodes.length > 0) setSelectedServer(nodes[0]);
      }
    } catch {}
  };

  const handleFetchConfig = useCallback(async () => {
    if (!selectedServer) {
      Alert.alert("No Server Selected", "Please tap the server row and select a VPN node first.");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setStep("fetching");
    setErrorMsg("");
    try {
      const token = await getToken();
      const res = await fetch(`${BASE}/api/wireguard?nodeId=${selectedServer.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        if (res.status === 402 || res.status === 403) {
          setStep("idle");
          Alert.alert(
            "Subscription Required",
            "You need an active ProxhqVPN subscription to connect.",
            [{ text: "View Plans", onPress: () => router.push("/tool/pricing") }, { text: "Cancel" }]
          );
          return;
        }
        throw new Error(`HTTP ${res.status}`);
      }
      const config = await res.text();
      setWgConfig(config);
      setStep("ready");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      setStep("error");
      setErrorMsg(err.message ?? "Could not retrieve VPN config");
    }
  }, [selectedServer, getToken]);

  const handleImport = useCallback(async () => {
    if (!wgConfig) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (IS_WEB) {
      const blob = new Blob([wgConfig], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `proxhqvpn-${(selectedServer?.location ?? "node").replace(/\s+/g, "-").toLowerCase()}.conf`;
      a.click();
      URL.revokeObjectURL(url);
      setStep("imported");
      return;
    }

    const { default: FileSystem } = await import("expo-file-system");
    const filename = `proxhqvpn-${(selectedServer?.location ?? "node").replace(/\s+/g, "-").toLowerCase()}.conf`;
    const path = `${(FileSystem as any).cacheDirectory}${filename}`;
    await FileSystem.writeAsStringAsync(path, wgConfig);

    const wgUrl = `wireguard://airdrop/${btoa(wgConfig)}`;
    const canOpenWg = await Linking.canOpenURL(wgUrl);

    if (canOpenWg) {
      await Linking.openURL(wgUrl);
      setStep("imported");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      const shareResult = await Share.share({
        message: wgConfig,
        title: `ProxhqVPN — ${selectedServer?.location ?? "Server"} Config`,
      });
      if (shareResult.action !== Share.dismissedAction) {
        setStep("imported");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    }
  }, [wgConfig, selectedServer]);

  const handleCopyConfig = useCallback(() => {
    if (!wgConfig) return;
    Clipboard.setString(wgConfig);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert("Copied", "WireGuard config copied to clipboard.");
  }, [wgConfig]);

  const handleReset = useCallback(() => {
    setStep("idle");
    setWgConfig(null);
    setShowConfig(false);
    setErrorMsg("");
  }, []);

  const statusLabel =
    step === "idle" ? "READY"
    : step === "fetching" ? "GENERATING..."
    : step === "ready" ? "CONFIG READY"
    : step === "imported" ? "TUNNEL ACTIVE"
    : "ERROR";

  const statusColor =
    step === "imported" ? colors.primary
    : step === "ready" || step === "fetching" ? "#ffaa00"
    : step === "error" ? colors.destructive
    : colors.mutedForeground;

  const tabBottom = IS_WEB ? 84 : 49;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: IS_WEB ? 80 : insets.top + 12 }]}>
        <View style={styles.headerBrand}>
          <Feather name="shield" size={16} color={colors.primary} />
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            Proxhq<Text style={{ color: colors.primary }}>VPN</Text>
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: `${statusColor}18`, borderColor: `${statusColor}44` }]}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: tabBottom + insets.bottom + 16 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* 3-step progress indicator */}
        <View style={[styles.stepsRow, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <StepBadge n={1} label="Select" active={step === "idle"} done={step !== "idle"} colors={colors} />
          <View style={[styles.stepLine, { backgroundColor: step !== "idle" ? colors.primary : colors.border }]} />
          <StepBadge n={2} label="Generate" active={step === "fetching" || step === "ready"} done={step === "imported"} colors={colors} />
          <View style={[styles.stepLine, { backgroundColor: step === "imported" ? colors.primary : colors.border }]} />
          <StepBadge n={3} label="Activate" active={false} done={step === "imported"} colors={colors} />
        </View>

        {/* Animated shield */}
        <View style={styles.heroZone}>
          <PulsingShield step={step} colors={colors} />
          {step === "error" && (
            <View style={[styles.errorBox, { backgroundColor: `${colors.destructive}14`, borderColor: `${colors.destructive}44` }]}>
              <Feather name="alert-circle" size={14} color={colors.destructive} />
              <Text style={[styles.errorText, { color: colors.destructive }]}>{errorMsg}</Text>
            </View>
          )}
        </View>

        {/* Server */}
        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>VPN Server</Text>
        <ServerCard node={selectedServer} onPress={() => router.push("/(tabs)/servers")} colors={colors} />

        {/* Protocol chips */}
        <View style={styles.chipsRow}>
          {[
            { label: "WireGuard", icon: "zap" },
            { label: "ChaCha20-Poly1305", icon: "lock" },
            { label: "Curve25519", icon: "key" },
          ].map(({ label, icon }) => (
            <View key={label} style={[styles.chip, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name={icon as any} size={11} color={colors.primary} />
              <Text style={[styles.chipText, { color: colors.mutedForeground }]}>{label}</Text>
            </View>
          ))}
        </View>

        {/* Settings */}
        <Text style={[styles.sectionTitle, { color: colors.mutedForeground, marginTop: 4 }]}>Settings</Text>
        <View style={[styles.settingsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {[
            { icon: "shield", label: "DNS Leak Protection", value: dnsProtection, set: setDnsProtection },
            { icon: "eye-off", label: "Stealth / Obfuscation", value: obfuscation, set: setObfuscation },
            { icon: "shield-off", label: "Kill Switch", value: killSwitch, set: setKillSwitch },
          ].map(({ icon, label, value, set }, i) => (
            <React.Fragment key={label}>
              {i > 0 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
              <View style={styles.toggleRow}>
                <Feather name={icon as any} size={15} color={value ? colors.primary : colors.mutedForeground} />
                <Text style={[styles.toggleLabel, { color: colors.foreground }]}>{label}</Text>
                <Switch
                  value={value}
                  onValueChange={set}
                  trackColor={{ false: colors.border, true: `${colors.primary}55` }}
                  thumbColor={value ? colors.primary : colors.mutedForeground}
                  ios_backgroundColor={colors.border}
                />
              </View>
            </React.Fragment>
          ))}
        </View>

        {/* Action buttons */}
        <View style={styles.actionZone}>
          {(step === "idle" || step === "error") && (
            <Pressable
              onPress={handleFetchConfig}
              style={({ pressed }) => [styles.primaryBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
            >
              <Feather name="download-cloud" size={18} color="#000" />
              <Text style={styles.primaryBtnText}>Generate WireGuard Config</Text>
            </Pressable>
          )}

          {step === "fetching" && (
            <View style={[styles.primaryBtn, { backgroundColor: `${colors.primary}33` }]}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[styles.primaryBtnText, { color: colors.primary }]}>Generating secure config...</Text>
            </View>
          )}

          {step === "ready" && (
            <View style={styles.dualBtns}>
              <Pressable
                onPress={handleImport}
                style={({ pressed }) => [styles.primaryBtn, { flex: 1, backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
              >
                <Feather name="external-link" size={18} color="#000" />
                <Text style={styles.primaryBtnText}>
                  {IS_WEB ? "Download .conf" : Platform.OS === "ios" ? "Open in WireGuard" : "Import to WireGuard"}
                </Text>
              </Pressable>
              <Pressable
                onPress={handleCopyConfig}
                style={({ pressed }) => [styles.iconBtn, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.8 : 1 }]}
              >
                <Feather name="copy" size={16} color={colors.primary} />
              </Pressable>
            </View>
          )}

          {step === "imported" && (
            <View style={styles.dualBtns}>
              <View style={[styles.primaryBtn, { flex: 1, backgroundColor: `${colors.primary}18`, borderWidth: 1, borderColor: `${colors.primary}44` }]}>
                <Feather name="check-circle" size={18} color={colors.primary} />
                <Text style={[styles.primaryBtnText, { color: colors.primary }]}>Config Imported — Tunnel Active</Text>
              </View>
              <Pressable
                onPress={handleReset}
                style={({ pressed }) => [styles.iconBtn, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.8 : 1 }]}
              >
                <Feather name="refresh-cw" size={16} color={colors.mutedForeground} />
              </Pressable>
            </View>
          )}

          {(step === "ready" || step === "imported") && wgConfig && (
            <Pressable onPress={() => setShowConfig(v => !v)} style={styles.showConfigRow}>
              <Feather name={showConfig ? "eye-off" : "eye"} size={13} color={colors.mutedForeground} />
              <Text style={[styles.showConfigText, { color: colors.mutedForeground }]}>
                {showConfig ? "Hide Config" : "View Config"}
              </Text>
            </Pressable>
          )}

          {showConfig && wgConfig && (
            <View style={[styles.configBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.configText, { color: colors.mutedForeground }]}>{wgConfig}</Text>
            </View>
          )}
        </View>

        {/* Connection guide */}
        {(step === "ready" || step === "imported") && (
          <View style={[styles.howItWorks, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.howTitle, { color: colors.foreground }]}>How to Activate</Text>
            <Text style={[styles.howStep, { color: colors.mutedForeground }]}>
              <Text style={{ color: colors.primary }}>1. </Text>
              Tap "Import to WireGuard" — this opens the WireGuard app with your config pre-loaded.
            </Text>
            <Text style={[styles.howStep, { color: colors.mutedForeground }]}>
              <Text style={{ color: colors.primary }}>2. </Text>
              In WireGuard, toggle on <Text style={{ color: colors.foreground }}>ProxhqVPN — {selectedServer?.location}</Text> to start the OS-level tunnel.
            </Text>
            <Text style={[styles.howStep, { color: colors.mutedForeground }]}>
              <Text style={{ color: colors.primary }}>3. </Text>
              All device traffic is now encrypted via WireGuard. ChaCha20-Poly1305, Curve25519.
            </Text>
            {!IS_WEB && Platform.OS === "ios" && (
              <Pressable
                onPress={() => Linking.openURL("https://apps.apple.com/app/wireguard/id1441195209")}
                style={[styles.installLink, { borderColor: colors.border }]}
              >
                <Feather name="download" size={13} color={colors.primary} />
                <Text style={[styles.installLinkText, { color: colors.primary }]}>Get WireGuard — App Store</Text>
              </Pressable>
            )}
            {!IS_WEB && Platform.OS === "android" && (
              <Pressable
                onPress={() => Linking.openURL("https://play.google.com/store/apps/details?id=com.wireguard.android")}
                style={[styles.installLink, { borderColor: colors.border }]}
              >
                <Feather name="download" size={13} color={colors.primary} />
                <Text style={[styles.installLinkText, { color: colors.primary }]}>Get WireGuard — Play Store</Text>
              </Pressable>
            )}
          </View>
        )}

        {/* Quick tools */}
        <Text style={[styles.sectionTitle, { color: colors.mutedForeground, marginTop: 16 }]}>Quick Tools</Text>
        <View style={styles.quickTools}>
          {[
            { icon: "activity", label: "Leak Test", slug: "leaks" },
            { icon: "search", label: "IP Scanner", slug: "ip-exposure" },
            { icon: "git-branch", label: "Ghost Chain", slug: "ghost-chain" },
            { icon: "radio", label: "OSINT", slug: "osint" },
          ].map(({ icon, label, slug }) => (
            <Pressable
              key={slug}
              onPress={() => { Haptics.selectionAsync(); router.push(`/tool/${slug}`); }}
              style={({ pressed }) => [
                styles.quickTool,
                { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Feather name={icon as any} size={20} color={colors.primary} />
              <Text style={[styles.quickToolLabel, { color: colors.foreground }]}>{label}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  headerBrand: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerTitle: { fontSize: 17, fontWeight: "700" as const, letterSpacing: 0.2 },
  statusBadge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 10, fontWeight: "700" as const, letterSpacing: 1 },
  scroll: { paddingHorizontal: 20 },

  stepsRow: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 12, paddingHorizontal: 16,
    borderRadius: 14, borderWidth: 1, marginBottom: 24,
  },
  stepBadge: { alignItems: "center", gap: 4 },
  stepCircle: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 1.5,
    alignItems: "center", justifyContent: "center",
  },
  stepNum: { fontSize: 11, fontWeight: "700" as const },
  stepLabel: { fontSize: 9, fontWeight: "600" as const, letterSpacing: 0.5 },
  stepLine: { flex: 1, height: 1, marginHorizontal: 6, marginBottom: 12 },

  heroZone: { alignItems: "center", marginBottom: 24 },
  shieldWrap: { width: 160, height: 160, alignItems: "center", justifyContent: "center" },
  shieldGlow: { position: "absolute", width: 180, height: 180, borderRadius: 90 },
  shieldOuter: {
    width: 148, height: 148, borderRadius: 74, borderWidth: 2,
    alignItems: "center", justifyContent: "center",
  },
  shieldInner: {
    width: 126, height: 126, borderRadius: 63,
    alignItems: "center", justifyContent: "center",
  },
  errorBox: {
    flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1,
  },
  errorText: { fontSize: 12, fontWeight: "500" as const },

  sectionTitle: { fontSize: 10, fontWeight: "700" as const, letterSpacing: 1.2, textTransform: "uppercase" as const, marginBottom: 8 },

  serverCard: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    padding: 14, borderRadius: 14, borderWidth: 1, marginBottom: 16,
  },
  serverCardLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  serverCardRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  serverCardName: { fontSize: 15, fontWeight: "600" as const },
  serverCardSub: { fontSize: 11, marginTop: 2 },
  pingBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1,
  },
  pingDot: { width: 5, height: 5, borderRadius: 2.5 },
  pingText: { fontSize: 10, fontWeight: "700" as const },

  chipsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 16 },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1,
  },
  chipText: { fontSize: 10, fontWeight: "600" as const },

  settingsCard: { borderRadius: 14, borderWidth: 1, marginBottom: 20, overflow: "hidden" },
  toggleRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  toggleLabel: { flex: 1, fontSize: 13, fontWeight: "500" as const },
  divider: { height: StyleSheet.hairlineWidth, marginHorizontal: 16 },

  actionZone: { gap: 10, marginBottom: 8 },
  primaryBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 10, paddingVertical: 16, borderRadius: 14,
  },
  primaryBtnText: { fontSize: 15, fontWeight: "700" as const, color: "#000" },
  dualBtns: { flexDirection: "row", gap: 10 },
  iconBtn: {
    width: 52, height: 52, borderRadius: 14, borderWidth: 1,
    alignItems: "center", justifyContent: "center", alignSelf: "center",
  },
  showConfigRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 4,
  },
  showConfigText: { fontSize: 12, fontWeight: "500" as const },
  configBox: { padding: 12, borderRadius: 10, borderWidth: 1 },
  configText: { fontFamily: "monospace", fontSize: 10, lineHeight: 16 },

  howItWorks: { borderRadius: 14, borderWidth: 1, padding: 16, gap: 8, marginTop: 4, marginBottom: 20 },
  howTitle: { fontSize: 13, fontWeight: "700" as const, marginBottom: 2 },
  howStep: { fontSize: 12, lineHeight: 19 },
  installLink: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginTop: 4,
  },
  installLinkText: { fontSize: 12, fontWeight: "600" as const },

  quickTools: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  quickTool: {
    width: "47%", paddingVertical: 16, borderRadius: 14, borderWidth: 1,
    alignItems: "center", justifyContent: "center", gap: 8,
  },
  quickToolLabel: { fontSize: 12, fontWeight: "600" as const },
});
