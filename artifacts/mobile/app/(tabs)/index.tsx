import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
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
import { useAuth, useUser } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import * as Linking from "expo-linking";
import { useColors } from "@/hooks/useColors";

const BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

type ConnectState = "disconnected" | "connecting" | "connected";

const IS_WEB = Platform.OS === "web";

function PowerButton({
  state,
  onPress,
  colors,
}: {
  state: ConnectState;
  onPress: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const spinAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (IS_WEB) return;
    if (state === "connected") {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.06, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ])
      );
      loop.start();
      return () => loop.stop();
    } else if (state === "connecting") {
      const spin = Animated.loop(
        Animated.timing(spinAnim, { toValue: 1, duration: 1200, easing: Easing.linear, useNativeDriver: true })
      );
      spin.start();
      return () => spin.stop();
    } else {
      pulseAnim.setValue(1);
      spinAnim.setValue(0);
    }
  }, [state]);

  const color =
    state === "connected" ? colors.primary
    : state === "connecting" ? "#ffaa00"
    : colors.mutedForeground;

  const spin = spinAnim.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  const innerButton = (
    <View style={[styles.powerOuter, { borderColor: color }]}>
      <Animated.View style={IS_WEB ? undefined : { transform: [{ rotate: state === "connecting" ? spin : "0deg" }] }}>
        <View style={[styles.powerInner, { backgroundColor: state === "connected" ? `${color}18` : "transparent" }]}>
          <Feather name={state === "connecting" ? "loader" : "power"} size={48} color={color} />
        </View>
      </Animated.View>
    </View>
  );

  return (
    <Pressable
      onPress={onPress}
      testID="power-button"
      style={({ pressed }) => [styles.powerBtnWrap, { opacity: pressed ? 0.85 : 1 }]}
    >
      <View style={[styles.powerGlow, { backgroundColor: color, opacity: state === "connected" ? 0.25 : 0 }]} />
      {IS_WEB ? innerButton : (
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          {innerButton}
        </Animated.View>
      )}
    </Pressable>
  );
}

function StatChip({ icon, label, value, colors }: { icon: string; label: string; value: string; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={[styles.statChip, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Feather name={icon as any} size={14} color={colors.primary} />
      <View>
        <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{label}</Text>
        <Text style={[styles.statValue, { color: colors.foreground }]}>{value}</Text>
      </View>
    </View>
  );
}

function ToggleRow({ icon, label, value, onToggle, colors, disabled }: {
  icon: string; label: string; value: boolean; onToggle: (v: boolean) => void;
  colors: ReturnType<typeof useColors>; disabled?: boolean;
}) {
  return (
    <View style={[styles.toggleRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Feather name={icon as any} size={16} color={value ? colors.primary : colors.mutedForeground} />
      <Text style={[styles.toggleLabel, { color: colors.foreground }]}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onToggle}
        disabled={disabled}
        trackColor={{ false: colors.border, true: `${colors.primary}55` }}
        thumbColor={value ? colors.primary : colors.mutedForeground}
        ios_backgroundColor={colors.border}
      />
    </View>
  );
}

export default function VpnConnectScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { getToken } = useAuth();
  const { user } = useUser();
  const router = useRouter();
  const isWeb = Platform.OS === "web";

  const [connectState, setConnectState] = useState<ConnectState>("disconnected");
  const [selectedServer, setSelectedServer] = useState<{ id: number; location: string; ip: string } | null>(null);
  const [killSwitch, setKillSwitch] = useState(false);
  const [dnsProtection, setDnsProtection] = useState(true);
  const [obfuscation, setObfuscation] = useState(false);
  const [connectedAt, setConnectedAt] = useState<Date | null>(null);
  const [elapsedSecs, setElapsedSecs] = useState(0);

  useEffect(() => {
    loadDefaultServer();
  }, []);

  useEffect(() => {
    if (connectState !== "connected" || !connectedAt) { setElapsedSecs(0); return; }
    const t = setInterval(() => setElapsedSecs(Math.floor((Date.now() - connectedAt.getTime()) / 1000)), 1000);
    return () => clearInterval(t);
  }, [connectState, connectedAt]);

  const loadDefaultServer = async () => {
    try {
      const token = await getToken();
      const res = await fetch(`${BASE}/api/nodes`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const nodes = Array.isArray(data) ? data : (data.nodes ?? []);
        if (nodes.length > 0) setSelectedServer({ id: nodes[0].id, location: nodes[0].location ?? nodes[0].name ?? "Server", ip: nodes[0].ip ?? "" });
      }
    } catch {}
  };

  const handleConnect = useCallback(async () => {
    if (connectState === "connected") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setConnectState("disconnected");
      setConnectedAt(null);
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setConnectState("connecting");

    try {
      const token = await getToken();
      const res = await fetch(`${BASE}/api/wireguard`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        if (res.status === 402 || res.status === 403) {
          setConnectState("disconnected");
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

      if (isWeb) {
        const blob = new Blob([config], { type: "text/plain" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "proxhqvpn.conf";
        a.click();
        URL.revokeObjectURL(url);
        setConnectState("connected");
        setConnectedAt(new Date());
        return;
      }

      if (Platform.OS !== "web") {
        const { default: FileSystem } = await import("expo-file-system");
        const path = `${FileSystem.cacheDirectory}proxhqvpn.conf`;
        await FileSystem.writeAsStringAsync(path, config);

        const wgUrl = `wireguard://airdrop/${btoa(config)}`;
        const canOpen = await Linking.canOpenURL(wgUrl);

        if (canOpen) {
          await Linking.openURL(wgUrl);
        } else {
          await Share.share({ message: config, title: "ProxhqVPN WireGuard Config" });
        }
      }

      setConnectState("connected");
      setConnectedAt(new Date());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      setConnectState("disconnected");
      Alert.alert("Connection Failed", err.message ?? "Could not retrieve VPN config");
    }
  }, [connectState, getToken]);

  const formatElapsed = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  const statusText =
    connectState === "connected" ? "PROTECTED"
    : connectState === "connecting" ? "CONNECTING..."
    : "UNPROTECTED";

  const statusColor =
    connectState === "connected" ? colors.primary
    : connectState === "connecting" ? "#ffaa00"
    : colors.destructive;

  const tabBottom = isWeb ? 84 : 49;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: isWeb ? 80 : insets.top + 12 }]}>
        <View style={styles.headerBrand}>
          <Feather name="shield" size={16} color={colors.primary} />
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>
            Proxhq<Text style={{ color: colors.primary }}>VPN</Text>
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: `${statusColor}18`, borderColor: `${statusColor}44` }]}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[styles.statusText, { color: statusColor }]}>{statusText}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: tabBottom + insets.bottom + 16 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.connectZone}>
          <PowerButton state={connectState} onPress={handleConnect} colors={colors} />

          <Text style={[styles.serverLabel, { color: colors.mutedForeground }]}>
            {connectState === "connected" ? "Connected to" : "Connect to"}
          </Text>
          <Pressable onPress={() => router.push("/(tabs)/servers")} style={styles.serverRow}>
            <Feather name="globe" size={14} color={colors.primary} />
            <Text style={[styles.serverName, { color: colors.foreground }]}>
              {selectedServer?.location ?? "Auto-select server"}
            </Text>
            <Feather name="chevron-right" size={14} color={colors.mutedForeground} />
          </Pressable>

          {connectState === "connected" && connectedAt && (
            <View style={[styles.connectedCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.elapsedLabel, { color: colors.mutedForeground }]}>Session Time</Text>
              <Text style={[styles.elapsed, { color: colors.primary }]}>{formatElapsed(elapsedSecs)}</Text>
            </View>
          )}
        </View>

        <View style={styles.statsRow}>
          <StatChip icon="server" label="Protocol" value="WireGuard" colors={colors} />
          <StatChip icon="lock" label="Encryption" value="ChaCha20" colors={colors} />
          <StatChip icon="zap" label="Auth" value="Poly1305" colors={colors} />
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>Quick Settings</Text>
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <ToggleRow
              icon="shield-off"
              label="Kill Switch"
              value={killSwitch}
              onToggle={setKillSwitch}
              colors={colors}
            />
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <ToggleRow
              icon="shield"
              label="DNS Protection"
              value={dnsProtection}
              onToggle={setDnsProtection}
              colors={colors}
            />
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <ToggleRow
              icon="eye-off"
              label="Stealth Protocol"
              value={obfuscation}
              onToggle={setObfuscation}
              colors={colors}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.mutedForeground }]}>Quick Tools</Text>
          <View style={styles.quickTools}>
            {[
              { icon: "activity", label: "Leak Test", slug: "leaks" },
              { icon: "search", label: "IP Scan", slug: "ip-exposure" },
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
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 10, fontWeight: "700" as const, letterSpacing: 1 },
  scroll: { paddingHorizontal: 20 },
  connectZone: { alignItems: "center", paddingVertical: 32 },
  powerBtnWrap: { width: 180, height: 180, alignItems: "center", justifyContent: "center", marginBottom: 24 },
  powerGlow: { position: "absolute", width: 200, height: 200, borderRadius: 100, opacity: 0.25 },
  powerOuter: {
    width: 164,
    height: 164,
    borderRadius: 82,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  powerInner: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: "center",
    justifyContent: "center",
  },
  serverLabel: { fontSize: 12, fontWeight: "500" as const, marginBottom: 8, letterSpacing: 0.5 },
  serverRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  serverName: { fontSize: 16, fontWeight: "600" as const },
  connectedCard: {
    marginTop: 20,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
  },
  elapsedLabel: { fontSize: 10, fontWeight: "500" as const, letterSpacing: 1, textTransform: "uppercase" as const, marginBottom: 4 },
  elapsed: { fontSize: 28, fontWeight: "700" as const },
  statsRow: { flexDirection: "row", gap: 8, marginBottom: 24 },
  statChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  statLabel: { fontSize: 9, fontWeight: "600" as const, letterSpacing: 0.5, textTransform: "uppercase" as const },
  statValue: { fontSize: 11, fontWeight: "700" as const },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 11, fontWeight: "600" as const, letterSpacing: 1, textTransform: "uppercase" as const, marginBottom: 8 },
  card: { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 0,
  },
  toggleLabel: { flex: 1, fontSize: 14, fontWeight: "500" as const },
  divider: { height: StyleSheet.hairlineWidth, marginHorizontal: 16 },
  quickTools: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  quickTool: {
    width: "47%",
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  quickToolLabel: { fontSize: 12, fontWeight: "600" as const },
});
