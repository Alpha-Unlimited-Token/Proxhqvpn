// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
//
// ProxhqVPN Mobile — WireGuard Tunnel Screen
//
// NATIVE TUNNEL (requires a development build):
//   When WireGuardModule is present (native build) → real connect/disconnect via
//   NativeModules bridge. iOS uses NEVPNManager + PacketTunnelProvider.
//   Android uses WireGuard GoBackend via VpnService.
//
// FALLBACK (Expo Go / web):
//   When native module is absent → 3-step config generator
//   (Select → Generate → Import via wireguard://airdrop/ deep-link or Share).
//   This path works today without any native setup.
//
// Kill switch:
//   iOS  — OnDemand rules via NEVPNManager (appends # KillSwitch=true marker)
//   Android — VpnService.Builder.setBlocking(true) (same marker)
//
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Linking,
  NativeEventEmitter,
  NativeModules,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";

const BASE    = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
const IS_WEB  = Platform.OS === "web";
const IS_IOS  = Platform.OS === "ios";

// ── WireGuard NativeModule bridge ─────────────────────────────────────────────
// Present only in native (development) builds that include the native module.
// On iOS:  PacketTunnelProvider via NEVPNManager
// On Android: WireGuard GoBackend via VpnService
const WireGuardModule = (NativeModules.WireGuardModule ?? null) as {
  startTunnel:   (config: string) => Promise<void>;
  stopTunnel:    () => Promise<void>;
  getTunnelState: () => Promise<{ state: NativeTunnelState }>;
  getStatistics:  () => Promise<{ bytesSent: number; bytesReceived: number; lastHandshake: number }>;
} | null;

const WireGuardEvents = WireGuardModule
  ? new NativeEventEmitter(NativeModules.WireGuardModule)
  : null;

type NativeTunnelState = "disconnected" | "connecting" | "connected" | "disconnecting" | "error";

// ── Config-generator step (fallback mode) ─────────────────────────────────────
type GenStep = "idle" | "fetching" | "ready" | "imported" | "error";

// ── Server node ───────────────────────────────────────────────────────────────
interface ServerNode {
  id:        number;
  name:      string;
  location:  string;
  ipAddress: string;
  latencyMs: number;
  status:    string;
}

// ── Kill-switch config marker ─────────────────────────────────────────────────
function buildKillSwitchConfig(base: string): string {
  return base + "\n# KillSwitch=true";
}

// ── Format helpers ────────────────────────────────────────────────────────────
function fmtBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
}
function fmtUptime(since: Date | null): string {
  if (!since) return "—";
  const s = Math.floor((Date.now() - since.getTime()) / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main screen
// ─────────────────────────────────────────────────────────────────────────────
export default function VpnScreen() {
  const { getToken, isSignedIn } = useAuth();
  const colors  = useColors();
  const insets  = useSafeAreaInsets();
  const router  = useRouter();

  // ── Shared state ────────────────────────────────────────────────────────────
  const [selectedNode, setSelectedNode] = useState<ServerNode | null>(null);
  const [killSwitch, setKillSwitch]     = useState(true);
  const [autoConnect, setAutoConnect]   = useState(false);
  const [errorMsg, setErrorMsg]         = useState<string | null>(null);
  const pulse = useRef(new Animated.Value(1)).current;

  // ── Native tunnel state (used when native module present) ───────────────────
  const [tunnelState, setTunnelState]       = useState<NativeTunnelState>("disconnected");
  const [bytesSent, setBytesSent]           = useState(0);
  const [bytesReceived, setBytesReceived]   = useState(0);
  const [connectedSince, setConnectedSince] = useState<Date | null>(null);
  const [tunnelConfig, setTunnelConfig]     = useState<string | null>(null);
  const [loadingConfig, setLoadingConfig]   = useState(false);
  const statsInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const isConnected  = tunnelState === "connected";
  const isConnecting = tunnelState === "connecting" || tunnelState === "disconnecting";
  const stateColor   = isConnected ? colors.primary
    : tunnelState === "error" ? "#ef4444"
    : isConnecting            ? "#ffaa00"
    : colors.mutedForeground;

  // ── Config-generator state (fallback) ──────────────────────────────────────
  const [genStep, setGenStep]       = useState<GenStep>("idle");
  const [wgConfig, setWgConfig]     = useState<string | null>(null);
  const [showConfig, setShowConfig] = useState(false);

  // ── Load best server on mount ───────────────────────────────────────────────
  useEffect(() => {
    if (!isSignedIn) return;
    (async () => {
      try {
        const token = await getToken();
        const res   = await fetch(`${BASE}/api/nodes?limit=1&sort=latency`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          const nodes: ServerNode[] = (data.nodes ?? []).map((n: any) => ({
            id:        n.id,
            name:      n.name ?? "Server",
            location:  n.region ?? n.location ?? n.name ?? "Server",
            ipAddress: n.ipAddress ?? n.ip_address ?? "",
            latencyMs: n.latencyMs ?? n.latency_ms ?? 0,
            status:    n.status ?? "active",
          }));
          if (nodes.length) setSelectedNode(nodes[0]);
        }
      } catch { /* ignore */ }
    })();
  }, [isSignedIn]);

  // ── Pulsing animation ───────────────────────────────────────────────────────
  useEffect(() => {
    if (IS_WEB) return;
    const active = WireGuardModule ? isConnected : genStep === "imported";
    if (active) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.06, duration: 2000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1,    duration: 2000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
    pulse.setValue(1);
  }, [isConnected, genStep]);

  // ── Native: listen for tunnel state changes ─────────────────────────────────
  useEffect(() => {
    if (!WireGuardEvents) return;
    const sub = WireGuardEvents.addListener("tunnelStateChanged", (e: { state: NativeTunnelState }) => {
      setTunnelState(e.state);
      if (e.state === "connected") {
        setConnectedSince(new Date());
        startStats();
      } else if (e.state === "disconnected") {
        setConnectedSince(null);
        stopStats();
        setBytesSent(0);
        setBytesReceived(0);
      } else if (e.state === "error") {
        setErrorMsg("Tunnel error — check your connection and try again.");
        stopStats();
      }
    });
    return () => sub.remove();
  }, []);

  function startStats() {
    stopStats();
    statsInterval.current = setInterval(async () => {
      if (!WireGuardModule) return;
      try {
        const s = await WireGuardModule.getStatistics();
        setBytesSent(s.bytesSent);
        setBytesReceived(s.bytesReceived);
      } catch { /* ignore */ }
    }, 2000);
  }
  function stopStats() {
    if (statsInterval.current) { clearInterval(statsInterval.current); statsInterval.current = null; }
  }
  useEffect(() => () => stopStats(), []);

  // ── Fetch WireGuard config text (two-step: create record → get text) ─────────
  const fetchConfigText = useCallback(async (node: ServerNode): Promise<string | null> => {
    setLoadingConfig(true);
    setErrorMsg(null);
    try {
      const token = await getToken();

      // Step 1: create / retrieve config record
      const createRes = await fetch(`${BASE}/api/wireguard/my-config`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ nodeId: node.id }),
      });
      if (!createRes.ok) {
        const err = await createRes.json().catch(() => ({}));
        if (createRes.status === 402 || createRes.status === 403) {
          Alert.alert(
            "Subscription Required",
            "You need an active ProxhqVPN subscription to generate configs.",
            [{ text: "View Plans", onPress: () => router.push("/tool/pricing") }, { text: "Cancel" }],
          );
          return null;
        }
        throw new Error((err as any).message ?? `HTTP ${createRes.status}`);
      }
      const created = await createRes.json();
      const configId = created.configId ?? created.id;
      if (!configId) throw new Error("No configId in response");

      // Step 2: fetch config text
      const textRes = await fetch(`${BASE}/api/wireguard/my-config/${configId}/text`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!textRes.ok) throw new Error(`Could not fetch config text (${textRes.status})`);
      return await textRes.text();
    } catch (e: any) {
      setErrorMsg(e.message ?? "Could not retrieve config");
      return null;
    } finally {
      setLoadingConfig(false);
    }
  }, [getToken]);

  // ════════════════════════════════════════════════════════════════════════════
  // NATIVE MODE — connect / disconnect via WireGuardModule
  // ════════════════════════════════════════════════════════════════════════════
  const handleNativeToggle = useCallback(async () => {
    if (!WireGuardModule || isConnecting) return;
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (isConnected) {
      setTunnelState("disconnecting");
      try {
        await WireGuardModule.stopTunnel();
        setTunnelState("disconnected");
        setConnectedSince(null);
        stopStats();
      } catch (e: any) {
        setTunnelState("error");
        setErrorMsg(e.message ?? "Disconnect failed");
      }
    } else {
      if (!selectedNode) {
        Alert.alert("No Server", "Pick a server from the Servers tab first.");
        return;
      }
      setTunnelState("connecting");
      setErrorMsg(null);
      let cfg = tunnelConfig;
      if (!cfg) {
        cfg = await fetchConfigText(selectedNode);
        if (!cfg) { setTunnelState("error"); return; }
        setTunnelConfig(cfg);
      }
      try {
        await WireGuardModule.startTunnel(killSwitch ? buildKillSwitchConfig(cfg) : cfg);
      } catch (e: any) {
        setTunnelState("error");
        setErrorMsg(e.message ?? "Connection failed");
      }
    }
  }, [isConnected, isConnecting, selectedNode, tunnelConfig, killSwitch, fetchConfigText]);

  // ════════════════════════════════════════════════════════════════════════════
  // FALLBACK MODE — config generator (Select → Generate → Import)
  // ════════════════════════════════════════════════════════════════════════════
  const handleGenerate = useCallback(async () => {
    if (!selectedNode) {
      Alert.alert("No Server Selected", "Tap the server row and select a VPN node first.");
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setGenStep("fetching");
    setErrorMsg(null);
    const cfg = await fetchConfigText(selectedNode);
    if (!cfg) { setGenStep("error"); return; }
    setWgConfig(cfg);
    setGenStep("ready");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [selectedNode, fetchConfigText]);

  const handleImport = useCallback(async () => {
    if (!wgConfig) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (IS_WEB) {
      const blob = new Blob([wgConfig], { type: "text/plain" });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `proxhqvpn-${(selectedNode?.location ?? "node").replace(/\s+/g, "-").toLowerCase()}.conf`;
      a.click();
      URL.revokeObjectURL(url);
      setGenStep("imported");
      return;
    }
    const { default: FileSystem } = await import("expo-file-system");
    const fname = `proxhqvpn-${(selectedNode?.location ?? "node").replace(/\s+/g, "-").toLowerCase()}.conf`;
    const fpath = `${(FileSystem as any).cacheDirectory}${fname}`;
    await FileSystem.writeAsStringAsync(fpath, wgConfig);
    const wgUrl = `wireguard://airdrop/${btoa(wgConfig)}`;
    if (await Linking.canOpenURL(wgUrl)) {
      await Linking.openURL(wgUrl);
      setGenStep("imported");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      const result = await Share.share({
        message: wgConfig,
        title:   `ProxhqVPN — ${selectedNode?.location ?? "Server"} Config`,
      });
      if (result.action !== Share.dismissedAction) {
        setGenStep("imported");
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    }
  }, [wgConfig, selectedNode]);

  const handleCopy  = useCallback(async () => {
    if (!wgConfig) return;
    await Clipboard.setStringAsync(wgConfig);
    Alert.alert("Copied", "WireGuard config copied to clipboard.");
  }, [wgConfig]);

  const handleReset = useCallback(() => {
    setGenStep("idle"); setWgConfig(null); setShowConfig(false); setErrorMsg(null);
  }, []);

  // ════════════════════════════════════════════════════════════════════════════
  // Sign-in gate
  // ════════════════════════════════════════════════════════════════════════════
  if (!isSignedIn) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <Feather name="shield-off" size={52} color={colors.mutedForeground} />
        <Text style={[styles.bigLabel, { color: colors.foreground, marginTop: 16 }]}>Sign in to connect</Text>
        <Text style={[styles.sub, { color: colors.mutedForeground, marginTop: 6 }]}>
          Your ProxhqVPN account is required to generate WireGuard configs.
        </Text>
        <Pressable style={[styles.connectBtn, { backgroundColor: colors.primary, marginTop: 24 }]}
          onPress={() => router.push("/sign-in")}>
          <Text style={[styles.connectBtnText, { color: colors.primaryForeground }]}>Sign In</Text>
        </Pressable>
      </View>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // ── RENDER: NATIVE MODE ───────────────────────────────────────────────────
  // ════════════════════════════════════════════════════════════════════════════
  if (WireGuardModule) {
    const statusLabel = tunnelState === "connected"     ? "PROTECTED"
      : tunnelState === "connecting"                    ? "CONNECTING..."
      : tunnelState === "disconnecting"                 ? "DISCONNECTING..."
      : tunnelState === "error"                         ? "ERROR"
      : "NOT CONNECTED";

    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={[styles.nativeContainer, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 28 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Shield button */}
        <Pressable onPress={handleNativeToggle} disabled={isConnecting || loadingConfig} style={styles.shieldWrap}>
          <Animated.View style={[styles.shieldOuter, { borderColor: stateColor, transform: IS_WEB ? [] : [{ scale: pulse }] }]}>
            <View style={[styles.shieldInner, { backgroundColor: `${stateColor}18` }]}>
              {(isConnecting || loadingConfig)
                ? <ActivityIndicator size="large" color={stateColor} />
                : <Feather name={isConnected ? "shield" : "shield-off"} size={52} color={stateColor} />
              }
            </View>
          </Animated.View>
        </Pressable>

        <Text style={[styles.bigLabel, { color: stateColor, letterSpacing: 2, marginTop: 4 }]}>{statusLabel}</Text>
        {errorMsg && <Text style={styles.errorText}>{errorMsg}</Text>}

        {/* Server picker */}
        <Pressable style={[styles.serverCard, { backgroundColor: colors.card, borderColor: colors.border }]}
          onPress={() => router.push("/(tabs)/servers")}>
          <View style={styles.serverCardLeft}>
            <Feather name="server" size={18} color={colors.primary} />
            <View style={{ marginLeft: 10 }}>
              <Text style={[styles.serverName, { color: colors.foreground }]}>{selectedNode?.name ?? "Select a server"}</Text>
              <Text style={[styles.serverLoc, { color: colors.mutedForeground }]}>{selectedNode?.location ?? "Tap to choose"}</Text>
            </View>
          </View>
          <View style={styles.serverCardRight}>
            {selectedNode && (
              <Text style={[styles.latency, { color: selectedNode.latencyMs < 80 ? colors.primary : "#ffaa00" }]}>
                {selectedNode.latencyMs}ms
              </Text>
            )}
            <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
          </View>
        </Pressable>

        {/* Live stats */}
        {isConnected && (
          <View style={[styles.statsRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {[
              { label: "↑ Sent",     value: fmtBytes(bytesSent)       },
              { label: "↓ Received", value: fmtBytes(bytesReceived)   },
              { label: "⏱ Uptime",  value: fmtUptime(connectedSince) },
            ].map(({ label, value }) => (
              <View key={label} style={styles.statItem}>
                <Text style={[styles.statValue, { color: colors.foreground }]}>{value}</Text>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{label}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Settings */}
        <View style={[styles.settingsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.settingsTitle, { color: colors.foreground }]}>Settings</Text>
          {[
            { label: "Kill Switch",   sub: "Block all traffic if VPN drops", value: killSwitch,   onChange: setKillSwitch },
            { label: "Auto-Connect",  sub: "Connect automatically on startup", value: autoConnect, onChange: setAutoConnect },
          ].map(({ label, sub, value, onChange }) => (
            <View key={label} style={[styles.settingRow, { borderTopColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.settingLabel, { color: colors.foreground }]}>{label}</Text>
                <Text style={[styles.settingSub, { color: colors.mutedForeground }]}>{sub}</Text>
              </View>
              <Switch value={value} onValueChange={onChange}
                trackColor={{ false: colors.muted, true: `${colors.primary}80` }}
                thumbColor={value ? colors.primary : colors.mutedForeground} />
            </View>
          ))}
        </View>

        {/* Connect / Disconnect */}
        <Pressable
          style={[
            styles.connectBtn,
            {
              backgroundColor: isConnected ? "#1a1a1a" : colors.primary,
              borderColor: isConnected ? "#ef4444" : "transparent",
              borderWidth: isConnected ? 1.5 : 0,
              opacity: (isConnecting || loadingConfig) ? 0.6 : 1,
            },
          ]}
          onPress={handleNativeToggle}
          disabled={isConnecting || loadingConfig}
        >
          {(isConnecting || loadingConfig)
            ? <ActivityIndicator color={isConnected ? "#ef4444" : "#000"} />
            : <Text style={[styles.connectBtnText, { color: isConnected ? "#ef4444" : "#000" }]}>
                {isConnected ? "Disconnect" : "Connect"}
              </Text>
          }
        </Pressable>

        <Text style={[styles.footer, { color: colors.mutedForeground }]}>
          ProxhqVPN · WireGuard ChaCha20-Poly1305 · Zero Logs
        </Text>
      </ScrollView>
    );
  }

  // ════════════════════════════════════════════════════════════════════════════
  // ── RENDER: FALLBACK MODE (Expo Go / web — 3-step config generator) ──────
  // ════════════════════════════════════════════════════════════════════════════
  const genColor   = genStep === "imported" ? colors.primary
    : genStep === "ready" || genStep === "fetching" ? "#ffaa00"
    : genStep === "error" ? "#ef4444"
    : colors.mutedForeground;

  const statusLabel = genStep === "idle"     ? "READY"
    : genStep === "fetching"                 ? "GENERATING..."
    : genStep === "ready"                    ? "CONFIG READY"
    : genStep === "imported"                 ? "TUNNEL ACTIVE"
    : "ERROR";

  const tabBottom = IS_WEB ? 84 : 49;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: IS_WEB ? 80 : insets.top + 12 }]}>
        <View style={styles.headerBrand}>
          <Feather name="shield" size={16} color={colors.primary} />
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            Proxhq<Text style={{ color: colors.primary }}>VPN</Text>
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: `${genColor}18`, borderColor: `${genColor}44` }]}>
          <View style={[styles.statusDot, { backgroundColor: genColor }]} />
          <Text style={[styles.statusText, { color: genColor }]}>{statusLabel}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: tabBottom + insets.bottom + 16 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* 3-step progress */}
        <View style={[styles.stepsRow, { borderColor: colors.border, backgroundColor: colors.card }]}>
          {[
            { n: 1, label: "Select",   done: genStep !== "idle",     active: genStep === "idle"                           },
            { n: 2, label: "Generate", done: genStep === "imported",  active: genStep === "fetching" || genStep === "ready" },
            { n: 3, label: "Activate", done: genStep === "imported",  active: false                                        },
          ].map(({ n, label, done, active }, i) => {
            const c = done ? colors.primary : active ? "#ffaa00" : colors.mutedForeground;
            return (
              <React.Fragment key={n}>
                {i > 0 && (
                  <View style={[styles.stepLine, { backgroundColor: done || (i === 1 && genStep === "imported") ? colors.primary : colors.border }]} />
                )}
                <View style={styles.stepBadge}>
                  <View style={[styles.stepCircle, { backgroundColor: done ? colors.primary : "transparent", borderColor: c }]}>
                    {done
                      ? <Feather name="check" size={11} color="#000" />
                      : <Text style={[styles.stepNum, { color: c }]}>{n}</Text>
                    }
                  </View>
                  <Text style={[styles.stepLabel, { color: c }]}>{label}</Text>
                </View>
              </React.Fragment>
            );
          })}
        </View>

        {/* Animated shield */}
        <View style={styles.heroZone}>
          <Animated.View style={[styles.shieldWrap, !IS_WEB && { transform: [{ scale: pulse }] }]}>
            <View style={[styles.shieldOuter, { borderColor: genColor }]}>
              <View style={[styles.shieldInner, { backgroundColor: genStep === "imported" ? `${genColor}14` : "transparent" }]}>
                {genStep === "fetching"
                  ? <ActivityIndicator size="large" color={genColor} />
                  : <Feather name={genStep === "error" ? "shield-off" : "shield"} size={52} color={genColor} />
                }
              </View>
            </View>
          </Animated.View>
          {(genStep === "error" && errorMsg) && (
            <View style={[styles.errorBox, { backgroundColor: "#ef444414", borderColor: "#ef444444" }]}>
              <Feather name="alert-circle" size={14} color="#ef4444" />
              <Text style={[styles.errorText, { color: "#ef4444" }]}>{errorMsg}</Text>
            </View>
          )}
        </View>

        {/* Server picker */}
        <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>VPN Server</Text>
        <Pressable
          onPress={() => router.push("/(tabs)/servers")}
          style={({ pressed }) => [
            styles.serverCard,
            { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <View style={styles.serverCardLeft}>
            <Feather name="globe" size={18} color={colors.primary} />
            <View>
              <Text style={[styles.serverName, { color: colors.foreground }]}>{selectedNode?.location ?? "Select Server"}</Text>
              {selectedNode && (
                <Text style={[styles.serverLoc, { color: colors.mutedForeground }]}>{selectedNode.ipAddress}</Text>
              )}
            </View>
          </View>
          <View style={styles.serverCardRight}>
            {selectedNode && selectedNode.latencyMs > 0 && (
              <View style={[styles.pingBadge, { backgroundColor: `${selectedNode.latencyMs < 80 ? "#22c55e" : "#eab308"}18`, borderColor: `${selectedNode.latencyMs < 80 ? "#22c55e" : "#eab308"}44` }]}>
                <View style={[styles.pingDot, { backgroundColor: selectedNode.latencyMs < 80 ? "#22c55e" : "#eab308" }]} />
                <Text style={[styles.pingText, { color: selectedNode.latencyMs < 80 ? "#22c55e" : "#eab308" }]}>{Math.round(selectedNode.latencyMs)}ms</Text>
              </View>
            )}
            <Feather name="chevron-right" size={14} color={colors.mutedForeground} />
          </View>
        </Pressable>

        {/* Protocol chips */}
        <View style={styles.chipsRow}>
          {[
            { label: "WireGuard",          icon: "zap"  },
            { label: "ChaCha20-Poly1305",  icon: "lock" },
            { label: "Curve25519",         icon: "key"  },
          ].map(({ label, icon }) => (
            <View key={label} style={[styles.chip, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Feather name={icon as any} size={11} color={colors.primary} />
              <Text style={[styles.chipText, { color: colors.mutedForeground }]}>{label}</Text>
            </View>
          ))}
        </View>

        {/* Settings toggles */}
        <Text style={[styles.sectionTitle, { color: colors.mutedForeground, marginTop: 4 }]}>Settings</Text>
        <View style={[styles.settingsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {[
            { icon: "shield",     label: "DNS Leak Protection", value: true,        set: () => {} },
            { icon: "eye-off",    label: "Stealth / Obfuscation", value: false,     set: () => {} },
            { icon: "shield-off", label: "Kill Switch",         value: killSwitch,  set: setKillSwitch },
          ].map(({ icon, label, value, set }, i) => (
            <React.Fragment key={label}>
              {i > 0 && <View style={[styles.divider, { backgroundColor: colors.border }]} />}
              <View style={styles.toggleRow}>
                <Feather name={icon as any} size={15} color={value ? colors.primary : colors.mutedForeground} />
                <Text style={[styles.toggleLabel, { color: colors.foreground }]}>{label}</Text>
                <Switch value={value} onValueChange={set as any}
                  trackColor={{ false: colors.border, true: `${colors.primary}55` }}
                  thumbColor={value ? colors.primary : colors.mutedForeground}
                  ios_backgroundColor={colors.border} />
              </View>
            </React.Fragment>
          ))}
        </View>

        {/* Action buttons */}
        <View style={styles.actionZone}>
          {(genStep === "idle" || genStep === "error") && (
            <Pressable onPress={handleGenerate}
              style={({ pressed }) => [styles.primaryBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}>
              <Feather name="download-cloud" size={18} color="#000" />
              <Text style={styles.primaryBtnText}>Generate WireGuard Config</Text>
            </Pressable>
          )}

          {genStep === "fetching" && (
            <View style={[styles.primaryBtn, { backgroundColor: `${colors.primary}33` }]}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[styles.primaryBtnText, { color: colors.primary }]}>Generating secure config...</Text>
            </View>
          )}

          {genStep === "ready" && (
            <View style={styles.dualBtns}>
              <Pressable onPress={handleImport}
                style={({ pressed }) => [styles.primaryBtn, { flex: 1, backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}>
                <Feather name="external-link" size={18} color="#000" />
                <Text style={styles.primaryBtnText}>
                  {IS_WEB ? "Download .conf" : IS_IOS ? "Open in WireGuard" : "Import to WireGuard"}
                </Text>
              </Pressable>
              <Pressable onPress={handleCopy}
                style={({ pressed }) => [styles.iconBtn, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.8 : 1 }]}>
                <Feather name="copy" size={16} color={colors.primary} />
              </Pressable>
            </View>
          )}

          {genStep === "imported" && (
            <View style={styles.dualBtns}>
              <View style={[styles.primaryBtn, { flex: 1, backgroundColor: `${colors.primary}18`, borderWidth: 1, borderColor: `${colors.primary}44` }]}>
                <Feather name="check-circle" size={18} color={colors.primary} />
                <Text style={[styles.primaryBtnText, { color: colors.primary }]}>Config Imported — Tunnel Active</Text>
              </View>
              <Pressable onPress={handleReset}
                style={({ pressed }) => [styles.iconBtn, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.8 : 1 }]}>
                <Feather name="refresh-cw" size={16} color={colors.mutedForeground} />
              </Pressable>
            </View>
          )}

          {(genStep === "ready" || genStep === "imported") && wgConfig && (
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

        {/* How to activate */}
        {(genStep === "ready" || genStep === "imported") && (
          <View style={[styles.howItWorks, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.howTitle, { color: colors.foreground }]}>How to Activate</Text>
            <Text style={[styles.howStep, { color: colors.mutedForeground }]}>
              <Text style={{ color: colors.primary }}>1. </Text>
              Tap "Import to WireGuard" — opens WireGuard with your config pre-loaded.
            </Text>
            <Text style={[styles.howStep, { color: colors.mutedForeground }]}>
              <Text style={{ color: colors.primary }}>2. </Text>
              In WireGuard, toggle on <Text style={{ color: colors.foreground }}>ProxhqVPN — {selectedNode?.location}</Text>.
            </Text>
            <Text style={[styles.howStep, { color: colors.mutedForeground }]}>
              <Text style={{ color: colors.primary }}>3. </Text>
              All traffic is now encrypted. ChaCha20-Poly1305 · Curve25519.
            </Text>
            {!IS_WEB && IS_IOS && (
              <Pressable onPress={() => Linking.openURL("https://apps.apple.com/app/wireguard/id1441195209")}
                style={[styles.installLink, { borderColor: colors.border }]}>
                <Feather name="download" size={13} color={colors.primary} />
                <Text style={[styles.installLinkText, { color: colors.primary }]}>Get WireGuard — App Store</Text>
              </Pressable>
            )}
            {!IS_WEB && !IS_IOS && (
              <Pressable onPress={() => Linking.openURL("https://play.google.com/store/apps/details?id=com.wireguard.android")}
                style={[styles.installLink, { borderColor: colors.border }]}>
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
            { icon: "activity", label: "Leak Test",  slug: "leaks"      },
            { icon: "search",   label: "IP Scanner", slug: "ip-exposure" },
            { icon: "shield",   label: "DNS Shield", slug: "dns-shield"  },
            { icon: "radio",    label: "OSINT",      slug: "osint"       },
          ].map(({ icon, label, slug }) => (
            <Pressable key={slug} onPress={() => { Haptics.selectionAsync(); router.push(`/tool/${slug}`); }}
              style={({ pressed }) => [
                styles.quickTool,
                { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
              ]}>
              <Feather name={icon as any} size={20} color={colors.primary} />
              <Text style={[styles.quickToolLabel, { color: colors.foreground }]}>{label}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  // ── Shared ─────────────────────────────────────────────────────────────────
  container:    { flex: 1 },
  center:       { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  shieldWrap:   { marginVertical: 28, alignItems: "center", justifyContent: "center",
                  width: 160, height: 160 },
  shieldOuter:  { width: 148, height: 148, borderRadius: 74, borderWidth: 2,
                  alignItems: "center", justifyContent: "center" },
  shieldInner:  { width: 126, height: 126, borderRadius: 63,
                  alignItems: "center", justifyContent: "center" },
  bigLabel:     { fontSize: 13, fontWeight: "700" as const },
  sub:          { fontSize: 13, textAlign: "center" },
  errorText:    { color: "#ef4444", fontSize: 12, textAlign: "center", marginTop: 4, paddingHorizontal: 20 },
  footer:       { fontSize: 11, marginTop: 24 },

  serverCard:     { width: "100%", flexDirection: "row", alignItems: "center",
                    justifyContent: "space-between", padding: 14, borderRadius: 14,
                    borderWidth: 1, marginTop: 12 },
  serverCardLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  serverCardRight:{ flexDirection: "row", alignItems: "center", gap: 6 },
  serverName:     { fontSize: 14, fontWeight: "600" as const },
  serverLoc:      { fontSize: 12, marginTop: 1 },
  latency:        { fontSize: 12, fontWeight: "600" as const },

  statsRow:   { width: "100%", flexDirection: "row", justifyContent: "space-around",
                borderRadius: 14, borderWidth: 1, marginTop: 12, padding: 14 },
  statItem:   { alignItems: "center" },
  statValue:  { fontSize: 14, fontWeight: "700" as const },
  statLabel:  { fontSize: 10, marginTop: 2 },

  settingsCard:  { width: "100%", borderRadius: 14, borderWidth: 1, marginTop: 14, padding: 16 },
  settingsTitle: { fontSize: 13, fontWeight: "700" as const, marginBottom: 10 },
  settingRow:    { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderTopWidth: 0.5 },
  settingLabel:  { fontSize: 14, fontWeight: "500" as const },
  settingSub:    { fontSize: 11, marginTop: 2 },

  connectBtn:     { width: "100%", paddingVertical: 16, borderRadius: 14,
                    alignItems: "center", justifyContent: "center", marginTop: 20 },
  connectBtnText: { fontSize: 16, fontWeight: "700" as const },

  // ── Native container ────────────────────────────────────────────────────────
  nativeContainer: { alignItems: "center", paddingHorizontal: 20 },

  // ── Fallback header ─────────────────────────────────────────────────────────
  header:      { flexDirection: "row", alignItems: "center",
                 justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 12 },
  headerBrand: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerTitle: { fontSize: 17, fontWeight: "700" as const, letterSpacing: 0.2 },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 6,
                 paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  statusDot:   { width: 6, height: 6, borderRadius: 3 },
  statusText:  { fontSize: 10, fontWeight: "700" as const, letterSpacing: 1 },
  scroll:      { paddingHorizontal: 20 },

  // ── Steps ───────────────────────────────────────────────────────────────────
  stepsRow:   { flexDirection: "row", alignItems: "center", paddingVertical: 12,
                paddingHorizontal: 16, borderRadius: 14, borderWidth: 1, marginBottom: 20 },
  stepBadge:  { alignItems: "center", gap: 4 },
  stepCircle: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5,
                alignItems: "center", justifyContent: "center" },
  stepNum:    { fontSize: 11, fontWeight: "700" as const },
  stepLabel:  { fontSize: 9, fontWeight: "600" as const, letterSpacing: 0.5 },
  stepLine:   { flex: 1, height: 1, marginHorizontal: 6, marginBottom: 12 },

  heroZone:   { alignItems: "center", marginBottom: 20 },
  errorBox:   { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12,
                paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },

  // ── Chips ───────────────────────────────────────────────────────────────────
  chipsRow: { flexDirection: "row", gap: 6, marginTop: 10, marginBottom: 4, flexWrap: "wrap" },
  chip:     { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10,
              paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
  chipText: { fontSize: 10 },

  // ── Toggle rows ─────────────────────────────────────────────────────────────
  toggleRow:   { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 11 },
  toggleLabel: { flex: 1, fontSize: 13 },
  divider:     { height: StyleSheet.hairlineWidth },

  // ── Action zone ─────────────────────────────────────────────────────────────
  actionZone:    { marginTop: 20, gap: 10 },
  primaryBtn:    { flexDirection: "row", alignItems: "center", justifyContent: "center",
                   gap: 10, height: 54, borderRadius: 14 },
  primaryBtnText:{ fontSize: 15, fontWeight: "700" as const, color: "#000" },
  dualBtns:      { flexDirection: "row", gap: 10 },
  iconBtn:       { width: 54, height: 54, borderRadius: 14, borderWidth: 1,
                   alignItems: "center", justifyContent: "center" },
  showConfigRow: { flexDirection: "row", alignItems: "center", gap: 6,
                   justifyContent: "center", marginTop: 4 },
  showConfigText:{ fontSize: 12 },
  configBox:     { borderRadius: 12, borderWidth: 1, padding: 12, marginTop: 4 },
  configText:    { fontFamily: "monospace", fontSize: 9, lineHeight: 14 },

  // ── How it works ────────────────────────────────────────────────────────────
  howItWorks:  { borderRadius: 14, borderWidth: 1, padding: 16, gap: 8, marginTop: 16 },
  howTitle:    { fontSize: 13, fontWeight: "700" as const, marginBottom: 4 },
  howStep:     { fontSize: 12, lineHeight: 18 },
  installLink: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8,
                 paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1 },
  installLinkText: { fontSize: 12, fontWeight: "600" as const },

  // ── Quick tools ─────────────────────────────────────────────────────────────
  quickTools:     { flexDirection: "row", gap: 10, flexWrap: "wrap", marginBottom: 8 },
  quickTool:      { flex: 1, minWidth: 80, alignItems: "center", justifyContent: "center",
                    paddingVertical: 16, borderRadius: 14, borderWidth: 1, gap: 8 },
  quickToolLabel: { fontSize: 11, fontWeight: "600" as const, textAlign: "center" },

  // ── Section ─────────────────────────────────────────────────────────────────
  sectionTitle: { fontSize: 11, fontWeight: "600" as const, letterSpacing: 0.5,
                  textTransform: "uppercase", marginBottom: 8, marginTop: 16 },
  pingBadge:    { flexDirection: "row", alignItems: "center", gap: 4,
                  paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, borderWidth: 1 },
  pingDot:      { width: 5, height: 5, borderRadius: 2.5 },
  pingText:     { fontSize: 10, fontWeight: "600" as const },
});
