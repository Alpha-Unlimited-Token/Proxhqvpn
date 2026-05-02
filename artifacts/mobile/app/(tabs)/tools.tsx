// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import React, { useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";

interface Tool {
  slug: string;
  label: string;
  icon: string;
  iconSet?: "feather" | "mc";
  pro?: boolean;
}

const PROTECTION_TOOLS: Tool[] = [
  { slug: "kill-switch",       label: "Kill Switch",       icon: "power" },
  { slug: "leaks",             label: "Leak Test",         icon: "search" },
  { slug: "dns-shield",        label: "DNS Protection",    icon: "shield" },
  { slug: "dns-sinkhole",      label: "DNS Sinkhole",      icon: "slash" },
  { slug: "threat-protection", label: "Threat Protection", icon: "alert-triangle" },
  { slug: "obfuscation",       label: "Stealth Protocol",  icon: "eye-off" },
  { slug: "ip-exposure",       label: "IP Exposure Scan",  icon: "eye" },
  { slug: "ghost-trace",       label: "Ghost Trace",       icon: "radio" },
];

const PRIVACY_TOOLS: Tool[] = [
  { slug: "pqc",         label: "Post-Quantum",         icon: "lock" },
  { slug: "daita",       label: "DAITA Shield",         icon: "eye-off" },
  { slug: "dark-web",    label: "Dark Web Monitor",     icon: "moon" },
  { slug: "alt-id",      label: "Alternative Identity", icon: "user-x" },
  { slug: "ip-rotator",  label: "IP Rotator",           icon: "refresh-cw" },
  { slug: "gps-spoof",   label: "GPS Spoofing",         icon: "map-pin" },
  { slug: "data-broker", label: "Data Broker Removal",  icon: "file-minus" },
];

const NETWORK_TOOLS: Tool[] = [
  { slug: "vpngate",         label: "VPN Gate",        icon: "globe" },
  { slug: "split-tunnel",    label: "Split Tunneling",  icon: "git-branch" },
  { slug: "proxy",           label: "Proxy & Tor",     icon: "globe" },
  { slug: "network-monitor", label: "Network Monitor", icon: "activity" },
  { slug: "port-forward",    label: "Port Forwarding", icon: "arrow-right" },
  { slug: "dedicated-ip",    label: "Dedicated IP",    icon: "share-2" },
  { slug: "meshnet",         label: "Meshnet P2P",     icon: "git-merge" },
  { slug: "ghost-chain",     label: "Ghost Chain",     icon: "link" },
];

const COMMAND_TOOLS: Tool[] = [
  { slug: "wireguard",       label: "WireGuard Config",      icon: "cpu",        pro: true },
  { slug: "sqlmap",          label: "Vulnerability Scanner", icon: "search",     pro: true },
  { slug: "alpha-tools",     label: "Alpha Toolkit",         icon: "layers",     pro: true },
  { slug: "http-probe",      label: "HTTP Probe",            icon: "send",       pro: true },
  { slug: "intruder",        label: "Intruder",              icon: "crosshair",  pro: true },
  { slug: "dir-fuzzer",      label: "Directory Fuzzer",      icon: "folder",     pro: true },
  { slug: "subdomain-scan",  label: "Subdomain Scout",       icon: "radio",      pro: true },
  { slug: "encoder",         label: "Encoder / Decoder",     icon: "code",       pro: true },
  { slug: "comparer",        label: "Request Comparer",      icon: "git-commit", pro: true },
  { slug: "payloads",        label: "Payload Generator",     icon: "zap",        pro: true },
  { slug: "cve-search",      label: "CVE Lookup",            icon: "alert-circle", pro: true },
  { slug: "siem",            label: "Security Event Log",    icon: "database",   pro: true },
  { slug: "osint",           label: "OSINT Recon",           icon: "user-check", pro: true },
  { slug: "canary",          label: "Canary Tokens",         icon: "bell",       pro: true },
  { slug: "exploit-import",  label: "Exploit Importer",      icon: "upload",     pro: true },
  { slug: "omnistrike",      label: "OmniStrike",            icon: "target",     pro: true },
  { slug: "waf",             label: "WAF Analyzer",          icon: "shield",     pro: true },
  { slug: "social-breach",   label: "Social Breach",         icon: "users",      pro: true },
  { slug: "bug-bounty",      label: "Bug Bounty Hub",        icon: "award",      pro: true },
  { slug: "ssl-tls",         label: "SSL/TLS Analyzer",      icon: "lock",       pro: true },
  { slug: "jwt-analyzer",    label: "JWT Analyzer",          icon: "key",        pro: true },
  { slug: "iac-scan",        label: "IaC Scanner",           icon: "code",  pro: true },
  { slug: "http-interceptor",label: "HTTP Interceptor",      icon: "filter",     pro: true },
  { slug: "api-tester",      label: "API Security Tester",   icon: "zap",      pro: true },
  { slug: "oast-tester",     label: "OAST Blind Tester",     icon: "crosshair",  pro: true },
  { slug: "waf-bypass",      label: "WAF Bypass",            icon: "shield-off", pro: true },
  { slug: "dep-scanner",     label: "Dependency Scanner",    icon: "package",    pro: true },
  { slug: "token-seq",       label: "Token Sequencer",       icon: "key",        pro: true },
  { slug: "ws-tester",       label: "WebSocket Tester",      icon: "wifi",       pro: true },
  { slug: "sast",            label: "SAST Analyzer",         icon: "file",pro: true },
];

const ADMIN_TOOLS: Tool[] = [
  { slug: "dashboard",    label: "Dashboard",        icon: "bar-chart-2", pro: true },
  { slug: "nodes",        label: "VPN Servers",      icon: "server",      pro: true },
  { slug: "beacons",      label: "Threat Monitor",   icon: "alert-triangle", pro: true },
  { slug: "silkweb",      label: "Decoy Network",    icon: "wifi",     pro: true },
  { slug: "monitor",      label: "Performance",      icon: "activity",    pro: true },
  { slug: "firewall",     label: "Firewall",         icon: "shield",      pro: true },
  { slug: "terminal",     label: "Terminal",         icon: "terminal",    pro: true },
  { slug: "sql",          label: "Database",         icon: "database",    pro: true },
];

type Section = "protection" | "privacy" | "network" | "command" | "admin";

interface SectionDef {
  key: Section;
  label: string;
  icon: string;
  tools: Tool[];
  proGated?: boolean;
}

const SECTIONS: SectionDef[] = [
  { key: "protection", label: "Protection",     icon: "shield-off", tools: PROTECTION_TOOLS },
  { key: "privacy",    label: "Privacy Suite",  icon: "eye-off",    tools: PRIVACY_TOOLS },
  { key: "network",    label: "Network",        icon: "globe",      tools: NETWORK_TOOLS },
  { key: "command",    label: "Command Center", icon: "terminal",   tools: COMMAND_TOOLS, proGated: true },
  { key: "admin",      label: "Admin",          icon: "settings",   tools: ADMIN_TOOLS,   proGated: true },
];

function ToolGrid({ tools, router, colors }: { tools: Tool[]; router: ReturnType<typeof useRouter>; colors: ReturnType<typeof useColors> }) {
  return (
    <View style={styles.toolGrid}>
      {tools.map((tool) => (
        <Pressable
          key={tool.slug}
          testID={`tool-${tool.slug}`}
          onPress={() => { Haptics.selectionAsync(); router.push(`/tool/${tool.slug}`); }}
          style={({ pressed }) => [
            styles.toolCard,
            { backgroundColor: colors.card, borderColor: tool.pro ? `${colors.primary}30` : colors.border, opacity: pressed ? 0.75 : 1 },
          ]}
        >
          {tool.pro && (
            <View style={[styles.proBadge, { backgroundColor: colors.primary }]}>
              <Text style={[styles.proBadgeText, { color: colors.primaryForeground }]}>PRO</Text>
            </View>
          )}
          <Feather name={tool.icon as any} size={22} color={tool.pro ? colors.primary : colors.foreground} />
          <Text style={[styles.toolLabel, { color: colors.foreground }]} numberOfLines={2}>
            {tool.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export default function ToolsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const isWeb = Platform.OS === "web";
  const [openSection, setOpenSection] = useState<Section | null>("protection");

  const tabBottom = isWeb ? 84 : 49;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: isWeb ? 80 : insets.top + 16 }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>Command Center</Text>
        <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
          Security & privacy tools
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: tabBottom + insets.bottom + 16 }}
        showsVerticalScrollIndicator={false}
      >
        {SECTIONS.map((section) => {
          const isOpen = openSection === section.key;
          return (
            <View key={section.key} style={styles.section}>
              <Pressable
                onPress={() => setOpenSection(isOpen ? null : section.key)}
                style={[styles.sectionHeader, { borderColor: colors.border }]}
              >
                <View style={styles.sectionLeft}>
                  <Feather name={section.icon as any} size={16} color={section.proGated ? colors.primary : colors.foreground} />
                  <Text style={[styles.sectionTitle, { color: section.proGated ? colors.primary : colors.foreground }]}>
                    {section.label}
                  </Text>
                  {section.proGated && (
                    <View style={[styles.proBadgeLg, { backgroundColor: `${colors.primary}20`, borderColor: `${colors.primary}40` }]}>
                      <Text style={[styles.proBadgeLgText, { color: colors.primary }]}>PRO</Text>
                    </View>
                  )}
                </View>
                <View style={styles.sectionRight}>
                  <Text style={[styles.sectionCount, { color: colors.mutedForeground }]}>{section.tools.length}</Text>
                  <Feather name={isOpen ? "chevron-up" : "chevron-down"} size={16} color={colors.mutedForeground} />
                </View>
              </Pressable>

              {isOpen && (
                <ToolGrid tools={section.tools} router={router} colors={colors} />
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 12 },
  title: { fontSize: 24, fontWeight: "700" as const, letterSpacing: -0.3 },
  subtitle: { fontSize: 12, fontWeight: "500" as const, marginTop: 2 },
  section: { marginBottom: 4 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sectionLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  sectionRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionTitle: { fontSize: 14, fontWeight: "600" as const },
  sectionCount: { fontSize: 12 },
  proBadgeLg: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  proBadgeLgText: { fontSize: 9, fontWeight: "700" as const, letterSpacing: 0.5 },
  toolGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingVertical: 12 },
  toolCard: {
    width: "30%",
    aspectRatio: 1,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    position: "relative" as const,
  },
  proBadge: {
    position: "absolute" as const,
    top: 6,
    right: 6,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
  },
  proBadgeText: { fontSize: 7, fontWeight: "800" as const, letterSpacing: 0.5 },
  toolLabel: { fontSize: 10, fontWeight: "600" as const, textAlign: "center" as const, lineHeight: 13 },
});
