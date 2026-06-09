// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useSignIn } from "@clerk/clerk-expo";
import { Link, useRouter } from "expo-router";
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
import { useColors } from "@/hooks/useColors";

export default function SignInScreen() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const router = useRouter();
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const isWeb = Platform.OS === "web";

  const handleSignIn = async () => {
    if (!isLoaded || !email || !password) return;
    setLoading(true);
    try {
      const result = await signIn.create({ identifier: email, password });
      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        router.replace("/(tabs)");
      } else {
        Alert.alert("Sign In", "Additional verification required. Please continue on the web.");
      }
    } catch (err: any) {
      const msg = err?.errors?.[0]?.message ?? err?.message ?? "Sign in failed";
      Alert.alert("Sign In Failed", msg);
    } finally {
      setLoading(false);
    }
  };

  const pt = isWeb ? 80 : insets.top + 24;
  const pb = isWeb ? 40 : insets.bottom + 24;
  const canSubmit = !loading && !!email && !!password;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: 24,
          paddingTop: pt,
          paddingBottom: pb,
          justifyContent: "center",
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={{ alignItems: "center", marginBottom: 40 }}>
          <View style={{
            width: 72,
            height: 72,
            borderRadius: 20,
            borderWidth: 1.5,
            borderColor: colors.border,
            backgroundColor: colors.accent,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 20,
          }}>
            <Feather name="shield" size={32} color={colors.primary} />
          </View>
          <Text style={{ fontSize: 28, fontWeight: "800", color: colors.foreground, letterSpacing: -0.5, marginBottom: 6 }}>
            Proxhq<Text style={{ color: colors.primary }}>VPN</Text>
          </Text>
          <Text style={{ fontSize: 14, fontWeight: "500", color: colors.mutedForeground }}>
            Sign in to your account
          </Text>
        </View>

        <View style={{ gap: 12 }}>
          <View style={{
            flexDirection: "row",
            alignItems: "center",
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 12,
            paddingHorizontal: 14,
            height: 52,
            backgroundColor: colors.card,
          }}>
            <Feather name="mail" size={16} color={colors.mutedForeground} style={{ marginRight: 10 }} />
            <TextInput
              style={{ flex: 1, fontSize: 15, color: colors.foreground }}
              placeholder="Email address"
              placeholderTextColor={colors.mutedForeground}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
              returnKeyType="next"
              testID="email-input"
            />
          </View>

          <View style={{
            flexDirection: "row",
            alignItems: "center",
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 12,
            paddingHorizontal: 14,
            height: 52,
            backgroundColor: colors.card,
          }}>
            <Feather name="lock" size={16} color={colors.mutedForeground} style={{ marginRight: 10 }} />
            <TextInput
              style={{ flex: 1, fontSize: 15, color: colors.foreground }}
              placeholder="Password"
              placeholderTextColor={colors.mutedForeground}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoComplete="password"
              returnKeyType="done"
              onSubmitEditing={handleSignIn}
              testID="password-input"
            />
            <Pressable onPress={() => setShowPassword(p => !p)} style={{ padding: 4 }}>
              <Feather name={showPassword ? "eye-off" : "eye"} size={16} color={colors.mutedForeground} />
            </Pressable>
          </View>

          <Pressable
            onPress={handleSignIn}
            disabled={!canSubmit}
            testID="sign-in-btn"
            style={({ pressed }) => ({
              height: 52,
              borderRadius: 12,
              alignItems: "center",
              justifyContent: "center",
              marginTop: 4,
              backgroundColor: colors.primary,
              opacity: !canSubmit ? 0.5 : pressed ? 0.85 : 1,
            })}
          >
            {loading
              ? <ActivityIndicator color={colors.primaryForeground} />
              : <Text style={{ fontSize: 16, fontWeight: "700", color: colors.primaryForeground }}>Sign In</Text>
            }
          </Pressable>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 4 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
            <Text style={{ fontSize: 12, fontWeight: "500", color: colors.mutedForeground }}>or</Text>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
          </View>

          <Link href="/sign-up" asChild>
            <Pressable style={({ pressed }) => ({
              height: 52,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.border,
              backgroundColor: colors.card,
              alignItems: "center",
              justifyContent: "center",
              opacity: pressed ? 0.7 : 1,
            })}>
              <Text style={{ fontSize: 15, fontWeight: "600", color: colors.foreground }}>Create an account</Text>
            </Pressable>
          </Link>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 2 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
            <Text style={{ fontSize: 11, color: colors.mutedForeground }}>or</Text>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.border }} />
          </View>

          <Link href="/anon-sign-in" asChild>
            <Pressable style={({ pressed }) => ({
              height: 52,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: `${colors.primary}55`,
              backgroundColor: `${colors.primary}0d`,
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "row",
              gap: 8,
              opacity: pressed ? 0.75 : 1,
            })}>
              <Feather name="shield" size={16} color={colors.primary} />
              <Text style={{ fontSize: 15, fontWeight: "600", color: colors.primary }}>Anonymous Account</Text>
            </Pressable>
          </Link>
          <Text style={{ textAlign: "center", fontSize: 11, color: colors.mutedForeground, marginTop: -4 }}>
            No email · No password · Just a 16-digit number
          </Text>
        </View>

        <Text style={{
          textAlign: "center",
          fontSize: 9,
          fontWeight: "600",
          color: colors.mutedForeground,
          letterSpacing: 2,
          textTransform: "uppercase",
          marginTop: 40,
        }}>
          ALPHA UNLIMITED TECHNOLOGIES LLC
        </Text>
      </ScrollView>
    </View>
  );
}
