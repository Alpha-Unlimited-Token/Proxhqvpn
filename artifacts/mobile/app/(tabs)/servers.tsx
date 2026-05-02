// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@clerk/clerk-expo";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";

const BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

interface VpnNode {
  id: number;
  name: string;
  location: string;
  ip: string;
  status: string;
  load?: number;
  ping?: number;
  country?: string;
  region?: string;
}

function PingBar({ load, colors }: { load: number; colors: ReturnType<typeof useColors> }) {
  const pct = Math.min(100, Math.max(0, load));
  const color = pct < 50 ? colors.primary : pct < 80 ? "#ffaa00" : colors.destructive;
  return (
    <View style={styles.pingBar}>
      <View style={[styles.pingFill, { width: `${pct}%` as any, backgroundColor: color }]} />
    </View>
  );
}

function NodeCard({
  node,
  selected,
  onSelect,
  colors,
}: {
  node: VpnNode;
  selected: boolean;
  onSelect: () => void;
  colors: ReturnType<typeof useColors>;
}) {
  const isOnline = node.status === "online" || node.status === "active";
  const statusColor = isOnline ? colors.primary : colors.destructive;
  const load = node.load ?? Math.floor(Math.random() * 60 + 10);

  return (
    <Pressable
      onPress={onSelect}
      testID={`node-${node.id}`}
      style={({ pressed }) => [
        styles.nodeCard,
        {
          backgroundColor: selected ? `${colors.primary}12` : colors.card,
          borderColor: selected ? colors.primary : colors.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={styles.nodeLeft}>
        <View style={[styles.nodeStatus, { backgroundColor: statusColor }]} />
        <View>
          <Text style={[styles.nodeName, { color: colors.foreground }]}>{node.location || node.name}</Text>
          <Text style={[styles.nodeIp, { color: colors.mutedForeground }]}>{node.ip || "—"}</Text>
        </View>
      </View>
      <View style={styles.nodeRight}>
        <PingBar load={load} colors={colors} />
        <Text style={[styles.nodeLoad, { color: colors.mutedForeground }]}>{load}%</Text>
        {selected && <Feather name="check-circle" size={16} color={colors.primary} />}
      </View>
    </Pressable>
  );
}

export default function ServersScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { getToken } = useAuth();
  const isWeb = Platform.OS === "web";

  const [nodes, setNodes] = useState<VpnNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  const fetchNodes = async () => {
    try {
      const token = await getToken();
      const res = await fetch(`${BASE}/api/nodes`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const list: VpnNode[] = Array.isArray(data) ? data : (data.nodes ?? []);
        setNodes(list);
        if (list.length > 0 && !selected) setSelected(list[0].id);
      }
    } catch {}
  };

  useEffect(() => { fetchNodes().finally(() => setLoading(false)); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchNodes();
    setRefreshing(false);
  };

  const filtered = nodes.filter(n =>
    (n.location || n.name || "").toLowerCase().includes(search.toLowerCase()) ||
    (n.ip || "").includes(search)
  );

  const tabBottom = isWeb ? 84 : 49;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: isWeb ? 80 : insets.top + 16 }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>VPN Servers</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          {nodes.length} node{nodes.length !== 1 ? "s" : ""} registered
        </Text>
      </View>

      <View style={[styles.searchWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Feather name="search" size={15} color={colors.mutedForeground} />
        <TextInput
          style={[styles.searchInput, { color: colors.foreground }]}
          placeholder="Search servers..."
          placeholderTextColor={colors.mutedForeground}
          value={search}
          onChangeText={setSearch}
        />
        {!!search && (
          <Pressable onPress={() => setSearch("")}>
            <Feather name="x" size={14} color={colors.mutedForeground} />
          </Pressable>
        )}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.center}>
          <Feather name="server" size={40} color={colors.mutedForeground} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            {search ? "No servers match your search" : "No VPN servers found"}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: tabBottom + insets.bottom + 16 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          renderItem={({ item }) => (
            <NodeCard
              node={item}
              selected={selected === item.id}
              onSelect={() => { Haptics.selectionAsync(); setSelected(item.id); }}
              colors={colors}
            />
          )}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          scrollEnabled={!!filtered.length}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 12 },
  title: { fontSize: 24, fontWeight: "700" as const, letterSpacing: -0.3 },
  subtitle: { fontSize: 12, fontWeight: "500" as const, marginTop: 2 },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchInput: { flex: 1, fontSize: 14 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emptyText: { fontSize: 14, fontWeight: "500" as const, textAlign: "center" as const },
  nodeCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  nodeLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  nodeStatus: { width: 8, height: 8, borderRadius: 4 },
  nodeName: { fontSize: 14, fontWeight: "600" as const },
  nodeIp: { fontSize: 11, marginTop: 2 },
  nodeRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  pingBar: { width: 52, height: 4, borderRadius: 2, backgroundColor: "#ffffff18", overflow: "hidden" },
  pingFill: { height: "100%" },
  nodeLoad: { fontSize: 11, fontWeight: "600" as const, minWidth: 30 },
});
