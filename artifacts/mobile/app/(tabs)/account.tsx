import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";

const BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

interface MeData {
  userId: string;
  email: string | null;
  isAdmin: boolean;
  role: string | null;
  hasAccess: boolean;
  hasSubscription: boolean;
  hasCommandCenter: boolean;
  tier: "vpn" | "command_center" | null;
}

function InfoRow({ icon, label, value, colors }: {
  icon: string; label: string; value: string; colors: ReturnType<typeof useColors>;
}) {
  return (
    <View style={[styles.infoRow, { borderColor: colors.border }]}>
      <Feather name={icon as any} size={15} color={colors.mutedForeground} style={{ marginRight: 12 }} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.infoLabel, { color: colors.mutedForeground }]}>{label}</Text>
        <Text style={[styles.infoValue, { color: colors.foreground }]}>{value}</Text>
      </View>
    </View>
  );
}

function ActionRow({ icon, label, onPress, destructive, colors }: {
  icon: string; label: string; onPress: () => void; destructive?: boolean;
  colors: ReturnType<typeof useColors>;
}) {
  const color = destructive ? colors.destructive : colors.foreground;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.actionRow, { borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
    >
      <Feather name={icon as any} size={16} color={color} />
      <Text style={[styles.actionLabel, { color }]}>{label}</Text>
      <Feather name="chevron-right" size={14} color={colors.mutedForeground} />
    </Pressable>
  );
}

export default function AccountScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { signOut, getToken } = useAuth();
  const { user } = useUser();
  const router = useRouter();
  const isWeb = Platform.OS === "web";

  const [me, setMe] = useState<MeData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        const res = await fetch(`${BASE}/api/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) setMe(await res.json());
      } catch {}
      setLoading(false);
    })();
  }, []);

  const handleSignOut = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          await signOut();
          router.replace("/sign-in");
        },
      },
    ]);
  };

  const tierLabel = me?.tier === "command_center" ? "ProxhqVPN PRO" : me?.hasAccess ? "ProxhqVPN VPN" : "Free";
  const tierColor =
    me?.tier === "command_center" ? colors.primary
    : me?.hasAccess ? "#ffaa00"
    : colors.mutedForeground;

  const tabBottom = isWeb ? 84 : 49;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: isWeb ? 80 : insets.top + 16 }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Account</Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: tabBottom + insets.bottom + 16 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.profileCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.avatar, { backgroundColor: `${colors.primary}18`, borderColor: colors.border }]}>
            <Text style={[styles.avatarText, { color: colors.primary }]}>
              {(user?.emailAddresses?.[0]?.emailAddress?.[0] ?? "U").toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.profileEmail, { color: colors.foreground }]} numberOfLines={1}>
              {user?.emailAddresses?.[0]?.emailAddress ?? "—"}
            </Text>
            {loading ? (
              <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 4, alignSelf: "flex-start" }} />
            ) : (
              <View style={[styles.tierBadge, { backgroundColor: `${tierColor}18`, borderColor: `${tierColor}40` }]}>
                <View style={[styles.tierDot, { backgroundColor: tierColor }]} />
                <Text style={[styles.tierLabel, { color: tierColor }]}>{tierLabel}</Text>
              </View>
            )}
          </View>
        </View>

        {!loading && me && (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <InfoRow icon="mail"   label="Email"          value={me.email ?? "—"}                      colors={colors} />
            <InfoRow icon="shield" label="Subscription"   value={tierLabel}                            colors={colors} />
            <InfoRow icon="user"   label="Role"           value={me.role ?? "subscriber"}              colors={colors} />
            <InfoRow icon="check-circle" label="Command Center" value={me.hasCommandCenter ? "Enabled" : "Not included"} colors={colors} />
          </View>
        )}

        {!loading && !me?.hasAccess && (
          <Pressable
            onPress={() => router.push("/tool/pricing")}
            style={[styles.upgradeCard, { backgroundColor: `${colors.primary}10`, borderColor: `${colors.primary}30` }]}
          >
            <Feather name="zap" size={18} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.upgradeTitle, { color: colors.primary }]}>Upgrade to ProxhqVPN</Text>
              <Text style={[styles.upgradeSub, { color: colors.mutedForeground }]}>Get full VPN access + Command Center</Text>
            </View>
            <Feather name="chevron-right" size={16} color={colors.primary} />
          </Pressable>
        )}

        {!loading && me?.hasAccess && !me.hasCommandCenter && (
          <Pressable
            onPress={() => router.push("/tool/pricing")}
            style={[styles.upgradeCard, { backgroundColor: "#ffaa0010", borderColor: "#ffaa0030" }]}
          >
            <Feather name="terminal" size={18} color="#ffaa00" />
            <View style={{ flex: 1 }}>
              <Text style={[styles.upgradeTitle, { color: "#ffaa00" }]}>Unlock Command Center</Text>
              <Text style={[styles.upgradeSub, { color: colors.mutedForeground }]}>Access 35+ offensive security tools</Text>
            </View>
            <Feather name="chevron-right" size={16} color="#ffaa00" />
          </Pressable>
        )}

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 8 }]}>
          <ActionRow icon="download"        label="Downloads"        onPress={() => router.push("/tool/downloads")}     colors={colors} />
          <ActionRow icon="book-open"       label="User Guide"       onPress={() => router.push("/tool/guide")}         colors={colors} />
          <ActionRow icon="file-text"       label="Transparency"     onPress={() => router.push("/tool/transparency")}  colors={colors} />
          <ActionRow icon="users"           label="Ambassadors"      onPress={() => router.push("/tool/ambassadors")}   colors={colors} />
          <ActionRow icon="settings"        label="WireGuard Config" onPress={() => router.push("/tool/wireguard")}     colors={colors} />
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 8 }]}>
          <ActionRow icon="log-out" label="Sign Out" onPress={handleSignOut} destructive colors={colors} />
        </View>

        <Text style={[styles.legal, { color: colors.mutedForeground }]}>
          ProxhqVPN{"\n"}
          © {new Date().getFullYear()} Alpha Unlimited Technologies LLC{"\n"}
          All rights reserved.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 12 },
  title: { fontSize: 24, fontWeight: "700" as const, letterSpacing: -0.3 },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 22, fontWeight: "700" as const },
  profileEmail: { fontSize: 14, fontWeight: "600" as const, marginBottom: 6 },
  tierBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  tierDot: { width: 5, height: 5, borderRadius: 2.5 },
  tierLabel: { fontSize: 11, fontWeight: "700" as const, letterSpacing: 0.3 },
  card: { borderRadius: 14, borderWidth: 1, overflow: "hidden", marginBottom: 8 },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  infoIcon: { marginRight: 12 },
  infoLabel: { fontSize: 10, fontWeight: "500" as const, letterSpacing: 0.3, marginBottom: 2 },
  infoValue: { fontSize: 14, fontWeight: "600" as const },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  actionLabel: { flex: 1, fontSize: 14, fontWeight: "500" as const },
  upgradeCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
  },
  upgradeTitle: { fontSize: 14, fontWeight: "700" as const, marginBottom: 2 },
  upgradeSub: { fontSize: 12 },
  legal: { textAlign: "center" as const, fontSize: 10, marginTop: 20, lineHeight: 16 },
});
