// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useColors } from "@/hooks/useColors";

const BASE = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
const IS_WEB = Platform.OS === "web";

const ANON_TOKEN_KEY = "proxhq_anon_token";
const ANON_NUMBER_KEY = "proxhq_anon_number";

function formatNumber(raw: string): string {
  return raw.replace(/(\d{4})(?=\d)/g, "$1 ");
}

async function saveAnonCredentials(token: string, accountNumber: string) {
  if (IS_WEB) {
    try {
      localStorage.setItem(ANON_TOKEN_KEY, token);
      localStorage.setItem(ANON_NUMBER_KEY, accountNumber);
    } catch {}
    return;
  }
  await SecureStore.setItemAsync(ANON_TOKEN_KEY, token);
  await SecureStore.setItemAsync(ANON_NUMBER_KEY, accountNumber);
}

export default function AnonSignInScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [tab, setTab] = useState<"create" | "login">("create");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Create state
  const [created, setCreated] = useState<{ number: string; expiresAt: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // Login state
  const [loginInput, setLoginInput] = useState("");

  const pt = IS_WEB ? 80 : insets.top + 24;
  const pb = IS_WEB ? 40 : insets.bottom + 24;

  const handleCreate = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`${BASE}/api/anon/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Failed to create account");
      setCreated({ number: data.accountNumber, expiresAt: data.expiresAt });
    } catch (e: any) {
      setError(e.message ?? "Network error");
    } finally {
      setLoading(false);
    }
  };

  const handleContinueAfterCreate = async () => {
    if (!created) return;
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`${BASE}/api/anon/auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountNumber: created.number }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Auth failed");
      await saveAnonCredentials(data.token, created.number);
      router.replace("/(tabs)");
    } catch (e: any) {
      setError(e.message ?? "Network error");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async () => {
    const clean = loginInput.replace(/\s/g, "");
    if (!/^\d{16}$/.test(clean)) {
      setError("Enter your 16-digit account number");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(`${BASE}/api/anon/auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountNumber: clean }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Account not found");
      await saveAnonCredentials(data.token, clean);
      router.replace("/(tabs)");
    } catch (e: any) {
      setError(e.message ?? "Network error");
    } finally {
      setLoading(false);
    }
  };

  const s = {
    bg: colors.background,
    card: colors.card,
    border: colors.border,
    fg: colors.foreground,
    muted: colors.mutedForeground,
    primary: colors.primary,
    primaryFg: colors.primaryForeground,
  };

  return (
    <View style={{ flex: 1, backgroundColor: s.bg }}>
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: pt, paddingBottom: pb }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Back button */}
        <Pressable
          onPress={() => router.back()}
          style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 32 }}
        >
          <Feather name="arrow-left" size={16} color={s.muted} />
          <Text style={{ fontSize: 13, color: s.muted }}>Back to sign in</Text>
        </Pressable>

        {/* Header */}
        <View style={{ marginBottom: 32 }}>
          <Text style={{ fontSize: 26, fontWeight: "800", color: s.fg, letterSpacing: -0.5, marginBottom: 6 }}>
            Anonymous Account
          </Text>
          <Text style={{ fontSize: 14, color: s.muted }}>No email. No password. Just a 16-digit number.</Text>
        </View>

        {/* Features */}
        <View style={{ gap: 8, marginBottom: 28, backgroundColor: `${s.primary}10`, borderWidth: 1, borderColor: `${s.primary}22`, borderRadius: 12, padding: 14 }}>
          {["No email required", "No personal data collected", "Mullvad-style privacy model", "30-day free trial"].map((f) => (
            <View key={f} style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: s.primary }} />
              <Text style={{ fontSize: 13, color: `${s.fg}cc` }}>{f}</Text>
            </View>
          ))}
        </View>

        {/* Tab selector */}
        <View style={{ flexDirection: "row", gap: 4, backgroundColor: `${s.fg}08`, borderRadius: 12, padding: 4, marginBottom: 20 }}>
          {(["create", "login"] as const).map((t) => (
            <Pressable
              key={t}
              onPress={() => { setTab(t); setError(null); setCreated(null); }}
              style={{
                flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 9,
                backgroundColor: tab === t ? s.primary : "transparent",
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: "600", color: tab === t ? "#000" : s.muted }}>
                {t === "create" ? "Create Account" : "Sign In"}
              </Text>
            </Pressable>
          ))}
        </View>

        {error && (
          <View style={{ backgroundColor: "#ff444422", borderWidth: 1, borderColor: "#ff444444", borderRadius: 12, padding: 12, marginBottom: 16 }}>
            <Text style={{ color: "#ff6666", fontSize: 13 }}>{error}</Text>
          </View>
        )}

        {/* Create tab */}
        {tab === "create" && (
          <View style={{ gap: 14 }}>
            {!created ? (
              <>
                <Text style={{ fontSize: 13, color: s.muted, lineHeight: 20 }}>
                  We generate a random 16-digit account number. Save it — it's your only credential. Includes a{" "}
                  <Text style={{ color: s.primary }}>30-day free trial</Text>.
                </Text>
                <Pressable
                  onPress={handleCreate}
                  disabled={loading}
                  style={({ pressed }) => ({
                    height: 52, borderRadius: 12, alignItems: "center", justifyContent: "center",
                    backgroundColor: s.primary, opacity: loading ? 0.5 : pressed ? 0.85 : 1,
                  })}
                >
                  {loading
                    ? <ActivityIndicator color="#000" />
                    : <Text style={{ fontSize: 16, fontWeight: "700", color: "#000" }}>Generate Account Number</Text>
                  }
                </Pressable>
              </>
            ) : (
              <View style={{ gap: 14 }}>
                {/* Number display */}
                <View style={{ backgroundColor: `${s.primary}10`, borderWidth: 1, borderColor: `${s.primary}44`, borderRadius: 16, padding: 20, alignItems: "center" }}>
                  <Text style={{ fontSize: 10, color: s.primary, letterSpacing: 3, fontFamily: "monospace", marginBottom: 12 }}>
                    YOUR ACCOUNT NUMBER
                  </Text>
                  <Text style={{ fontSize: 22, fontWeight: "800", color: s.fg, letterSpacing: 4, fontFamily: "monospace" }}>
                    {formatNumber(created.number)}
                  </Text>
                  <Text style={{ fontSize: 11, color: s.muted, marginTop: 10 }}>
                    Trial expires {new Date(created.expiresAt).toLocaleDateString()}
                  </Text>
                </View>

                {/* Warning */}
                <View style={{ flexDirection: "row", gap: 10, backgroundColor: "#f59e0b14", borderWidth: 1, borderColor: "#f59e0b22", borderRadius: 12, padding: 12 }}>
                  <Feather name="alert-triangle" size={14} color="#fbbf24" style={{ marginTop: 1 }} />
                  <Text style={{ flex: 1, fontSize: 12, color: "#fcd34d", lineHeight: 18 }}>
                    Save this number. No email recovery, no password reset. This is your only credential.
                  </Text>
                </View>

                <Pressable
                  onPress={() => Alert.alert("Account Number", formatNumber(created.number), [{ text: "OK" }])}
                  style={{ height: 44, borderRadius: 12, borderWidth: 1, borderColor: s.border, alignItems: "center", justifyContent: "center", backgroundColor: s.card }}
                >
                  <Text style={{ fontSize: 14, fontWeight: "600", color: s.fg }}>View Number</Text>
                </Pressable>

                <Pressable
                  onPress={handleContinueAfterCreate}
                  disabled={loading}
                  style={({ pressed }) => ({
                    height: 52, borderRadius: 12, alignItems: "center", justifyContent: "center",
                    backgroundColor: s.primary, opacity: loading ? 0.5 : pressed ? 0.85 : 1,
                  })}
                >
                  {loading
                    ? <ActivityIndicator color="#000" />
                    : <Text style={{ fontSize: 16, fontWeight: "700", color: "#000" }}>Continue →</Text>
                  }
                </Pressable>
              </View>
            )}
          </View>
        )}

        {/* Login tab */}
        {tab === "login" && (
          <View style={{ gap: 14 }}>
            <Text style={{ fontSize: 13, color: s.muted }}>Enter your 16-digit account number.</Text>
            <View style={{
              flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: s.border,
              borderRadius: 12, paddingHorizontal: 14, height: 56, backgroundColor: s.card,
            }}>
              <Feather name="hash" size={16} color={s.muted} style={{ marginRight: 10 }} />
              <TextInput
                style={{ flex: 1, fontSize: 18, color: s.fg, letterSpacing: 4, fontFamily: "monospace" }}
                placeholder="1234 5678 9012 3456"
                placeholderTextColor={s.muted}
                value={loginInput}
                onChangeText={(v) => {
                  const raw = v.replace(/\D/g, "").slice(0, 16);
                  setLoginInput(formatNumber(raw).trim());
                }}
                keyboardType="number-pad"
                autoComplete="off"
              />
            </View>
            <Pressable
              onPress={handleLogin}
              disabled={loading || loginInput.replace(/\s/g, "").length !== 16}
              style={({ pressed }) => ({
                height: 52, borderRadius: 12, alignItems: "center", justifyContent: "center",
                backgroundColor: s.primary,
                opacity: (loading || loginInput.replace(/\s/g, "").length !== 16) ? 0.5 : pressed ? 0.85 : 1,
              })}
            >
              {loading
                ? <ActivityIndicator color="#000" />
                : <Text style={{ fontSize: 16, fontWeight: "700", color: "#000" }}>Sign In</Text>
              }
            </Pressable>
          </View>
        )}

        <Text style={{ textAlign: "center", fontSize: 9, fontWeight: "600", color: s.muted, letterSpacing: 2, textTransform: "uppercase", marginTop: 40 }}>
          ALPHA UNLIMITED TECHNOLOGIES LLC
        </Text>
      </ScrollView>
    </View>
  );
}
