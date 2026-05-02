// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { WebView } from "react-native-webview";
import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@clerk/clerk-expo";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";

const BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

const SLUG_TO_PATH: Record<string, string> = {
  "kill-switch":       "/ghost-vpn/kill-switch",
  "leaks":             "/ghost-vpn/leaks",
  "dns-shield":        "/ghost-vpn/dns-shield",
  "dns-sinkhole":      "/ghost-vpn/dns-sinkhole",
  "threat-protection": "/ghost-vpn/threat-protection",
  "obfuscation":       "/ghost-vpn/obfuscation",
  "ip-exposure":       "/ghost-vpn/ip-exposure",
  "ghost-trace":       "/ghost-vpn/ghost-trace",
  "ghost-chain":       "/ghost-vpn/ghost-chain",
  "pqc":               "/ghost-vpn/pqc",
  "daita":             "/ghost-vpn/daita",
  "dark-web":          "/ghost-vpn/dark-web",
  "alt-id":            "/ghost-vpn/alt-id",
  "ip-rotator":        "/ghost-vpn/ip-rotator",
  "gps-spoof":         "/ghost-vpn/gps-spoof",
  "data-broker":       "/ghost-vpn/data-broker",
  "vpngate":           "/ghost-vpn/vpngate",
  "split-tunnel":      "/ghost-vpn/split-tunnel",
  "proxy":             "/ghost-vpn/proxy",
  "onion-browser":     "/ghost-vpn/onion-browser",
  "network-monitor":   "/ghost-vpn/network-monitor",
  "port-forward":      "/ghost-vpn/port-forward",
  "dedicated-ip":      "/ghost-vpn/dedicated-ip",
  "meshnet":           "/ghost-vpn/meshnet",
  "wireguard":         "/ghost-vpn/wireguard",
  "smart-dns":         "/ghost-vpn/smart-dns",
  "vpn-coexist":       "/ghost-vpn/vpn-coexist",
  "router-config":     "/ghost-vpn/router-config",
  "sqlmap":            "/ghost-vpn/sqlmap",
  "alpha-tools":       "/ghost-vpn/alpha-tools",
  "http-probe":        "/ghost-vpn/http-probe",
  "intruder":          "/ghost-vpn/intruder",
  "dir-fuzzer":        "/ghost-vpn/dir-fuzzer",
  "subdomain-scan":    "/ghost-vpn/subdomain-scan",
  "encoder":           "/ghost-vpn/encoder",
  "comparer":          "/ghost-vpn/comparer",
  "payloads":          "/ghost-vpn/payloads",
  "cve-search":        "/ghost-vpn/cve-search",
  "siem":              "/ghost-vpn/siem",
  "osint":             "/ghost-vpn/osint",
  "canary":            "/ghost-vpn/canary",
  "exploit-import":    "/ghost-vpn/exploit-import",
  "omnistrike":        "/ghost-vpn/omnistrike",
  "waf":               "/ghost-vpn/waf",
  "social-breach":     "/ghost-vpn/social-breach",
  "bug-bounty":        "/ghost-vpn/bug-bounty",
  "ssl-tls":           "/ghost-vpn/ssl-tls",
  "jwt-analyzer":      "/ghost-vpn/jwt-analyzer",
  "iac-scan":          "/ghost-vpn/iac-scan",
  "http-interceptor":  "/ghost-vpn/http-interceptor",
  "api-tester":        "/ghost-vpn/api-tester",
  "oast-tester":       "/ghost-vpn/oast-tester",
  "oast-server":       "/ghost-vpn/oast-server",
  "waf-bypass":        "/ghost-vpn/waf-bypass",
  "dep-scanner":       "/ghost-vpn/dep-scanner",
  "token-seq":         "/ghost-vpn/token-seq",
  "ws-tester":         "/ghost-vpn/ws-tester",
  "sast":              "/ghost-vpn/sast",
  "dashboard":         "/ghost-vpn/dashboard",
  "nodes":             "/ghost-vpn/nodes",
  "beacons":           "/ghost-vpn/beacons",
  "silkweb":           "/ghost-vpn/silkweb",
  "monitor":           "/ghost-vpn/monitor",
  "firewall":          "/ghost-vpn/firewall",
  "terminal":          "/ghost-vpn/terminal",
  "sql":               "/ghost-vpn/sql",
  "employees":         "/ghost-vpn/employees",
  "setup":             "/ghost-vpn/setup",
  "downloads":         "/ghost-vpn/downloads",
  "guide":             "/ghost-vpn/guide",
  "pricing":           "/ghost-vpn/pricing",
  "ambassadors":       "/ghost-vpn/ambassadors",
  "transparency":      "/ghost-vpn/transparency",
  "security-audit":    "/ghost-vpn/security-audit",
  "threat-intel":      "/ghost-vpn/threat-intel",
  "account":           "/ghost-vpn/account",
  "quantum-audit":     "/quantum-audit/",
};

const LABEL_MAP: Record<string, string> = {
  "kill-switch":       "Kill Switch",
  "leaks":             "Leak Test",
  "dns-shield":        "DNS Protection",
  "ghost-trace":       "Ghost Trace",
  "ghost-chain":       "Ghost Chain",
  "pqc":               "Post-Quantum",
  "daita":             "DAITA Shield",
  "dark-web":          "Dark Web Monitor",
  "alt-id":            "Alternative Identity",
  "ip-rotator":        "IP Rotator",
  "wireguard":         "WireGuard Config",
  "sqlmap":            "Vulnerability Scanner",
  "alpha-tools":       "Alpha Toolkit",
  "http-probe":        "HTTP Probe",
  "intruder":          "Intruder",
  "osint":             "OSINT Recon",
  "siem":              "Security Event Log",
  "terminal":          "Terminal",
  "sql":               "Database",
  "dashboard":         "Dashboard",
  "nodes":             "VPN Servers",
  "pricing":           "Subscription Plans",
  "ambassadors":       "Ambassadors",
  "downloads":         "Downloads",
  "guide":             "User Guide",
};

export default function ToolScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { getToken } = useAuth();
  const webRef = useRef<WebView>(null);
  const isWeb = Platform.OS === "web";

  const [loading, setLoading] = useState(true);
  const [canGoBack, setCanGoBack] = useState(false);
  const [error, setError] = useState(false);

  const path = SLUG_TO_PATH[slug ?? ""] ?? `/ghost-vpn/${slug}`;
  const url = `${BASE}${path}`;
  const label = LABEL_MAP[slug ?? ""] ?? slug?.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase()) ?? "Tool";

  const injectedJS = `
    (function() {
      var style = document.createElement('style');
      style.textContent = 'nav, .sidebar, [class*="sidebar"], header[class*="header"] { display: none !important; } body { padding: 0 !important; margin: 0 !important; }';
      document.head.appendChild(style);
    })();
    true;
  `;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.toolbar,
          {
            paddingTop: isWeb ? 74 : insets.top + 8,
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Pressable
          onPress={() => { Haptics.selectionAsync(); router.back(); }}
          style={styles.backBtn}
          testID="tool-back"
        >
          <Feather name="chevron-left" size={22} color={colors.primary} />
        </Pressable>

        <View style={styles.toolbarCenter}>
          <Text style={[styles.toolbarTitle, { color: colors.foreground }]} numberOfLines={1}>
            {label}
          </Text>
        </View>

        <View style={styles.toolbarRight}>
          {loading && <ActivityIndicator size="small" color={colors.primary} />}
          {canGoBack && !loading && (
            <Pressable
              onPress={() => { Haptics.selectionAsync(); webRef.current?.goBack(); }}
              style={styles.navBtn}
            >
              <Feather name="arrow-left" size={18} color={colors.mutedForeground} />
            </Pressable>
          )}
          <Pressable
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); webRef.current?.reload(); }}
            style={styles.navBtn}
          >
            <Feather name="refresh-cw" size={16} color={colors.mutedForeground} />
          </Pressable>
        </View>
      </View>

      {isWeb ? (
        <View style={[styles.webFallback, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="external-link" size={32} color={colors.primary} />
          <Text style={[styles.webFallbackTitle, { color: colors.foreground }]}>{label}</Text>
          <Text style={[styles.webFallbackSub, { color: colors.mutedForeground }]}>
            Open this tool in the web app
          </Text>
          <Pressable
            onPress={() => {
              if (typeof window !== "undefined") window.open(url, "_blank");
            }}
            style={[styles.webFallbackBtn, { backgroundColor: colors.primary }]}
          >
            <Text style={[styles.webFallbackBtnText, { color: colors.primaryForeground }]}>Open Tool</Text>
          </Pressable>
        </View>
      ) : error ? (
        <View style={styles.errorState}>
          <Feather name="wifi-off" size={36} color={colors.mutedForeground} />
          <Text style={[styles.errorText, { color: colors.mutedForeground }]}>Failed to load tool</Text>
          <Pressable
            onPress={() => { setError(false); webRef.current?.reload(); }}
            style={[styles.retryBtn, { backgroundColor: colors.primary }]}
          >
            <Text style={[styles.retryText, { color: colors.primaryForeground }]}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <WebView
          ref={webRef}
          source={{ uri: url }}
          style={{ flex: 1, backgroundColor: "#000000" }}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          onError={() => { setLoading(false); setError(true); }}
          onNavigationStateChange={nav => setCanGoBack(nav.canGoBack)}
          injectedJavaScript={injectedJS}
          sharedCookiesEnabled
          domStorageEnabled
          javaScriptEnabled
          allowsBackForwardNavigationGestures={Platform.OS === "ios"}
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  toolbar: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingBottom: 10,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    zIndex: 10,
    gap: 8,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  toolbarCenter: { flex: 1 },
  toolbarTitle: { fontSize: 15, fontWeight: "700" as const, letterSpacing: 0.1 },
  toolbarRight: { flexDirection: "row", alignItems: "center", gap: 4 },
  navBtn: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  webFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    margin: 20,
    borderRadius: 16,
    borderWidth: 1,
    padding: 32,
  },
  webFallbackTitle: { fontSize: 18, fontWeight: "700" as const },
  webFallbackSub: { fontSize: 13, textAlign: "center" as const },
  webFallbackBtn: { marginTop: 8, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 10 },
  webFallbackBtnText: { fontSize: 14, fontWeight: "600" as const },
  errorState: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  errorText: { fontSize: 14 },
  retryBtn: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10 },
  retryText: { fontSize: 14, fontWeight: "600" as const },
});
