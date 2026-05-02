// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useSignUp } from "@clerk/clerk-expo";
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

export default function SignUpScreen() {
  const { signUp, setActive, isLoaded } = useSignUp();
  const router = useRouter();
  const colors = useColors();
  const insets = useSafeAreaInsets();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingVerification, setPendingVerification] = useState(false);

  const isWeb = Platform.OS === "web";

  const handleSignUp = async () => {
    if (!isLoaded || !email || !password) return;
    setLoading(true);
    try {
      await signUp.create({ emailAddress: email, password });
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setPendingVerification(true);
    } catch (err: any) {
      const msg = err?.errors?.[0]?.message ?? err?.message ?? "Sign up failed";
      Alert.alert("Sign Up Failed", msg);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!isLoaded || !code) return;
    setLoading(true);
    try {
      const result = await signUp.attemptEmailAddressVerification({ code });
      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        router.replace("/(tabs)");
      }
    } catch (err: any) {
      const msg = err?.errors?.[0]?.message ?? err?.message ?? "Verification failed";
      Alert.alert("Verification Failed", msg);
    } finally {
      setLoading(false);
    }
  };

  const pt = isWeb ? 80 : insets.top + 24;
  const pb = isWeb ? 40 : insets.bottom + 24;

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
            Create Account
          </Text>
          <Text style={{ fontSize: 14, fontWeight: "500", color: colors.mutedForeground }}>
            {pendingVerification ? "Check your email for a code" : "Join ProxhqVPN today"}
          </Text>
        </View>

        {!pendingVerification ? (
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
                secureTextEntry
              />
            </View>

            <Pressable
              onPress={handleSignUp}
              disabled={loading || !email || !password}
              style={({ pressed }) => ({
                height: 52,
                borderRadius: 12,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.primary,
                opacity: loading || !email || !password ? 0.5 : pressed ? 0.85 : 1,
              })}
            >
              {loading
                ? <ActivityIndicator color={colors.primaryForeground} />
                : <Text style={{ fontSize: 16, fontWeight: "700", color: colors.primaryForeground }}>Create Account</Text>
              }
            </Pressable>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            <Text style={{ fontSize: 14, color: colors.mutedForeground, textAlign: "center", marginBottom: 4 }}>
              Enter the verification code sent to {email}
            </Text>
            <View style={{
              flexDirection: "row",
              alignItems: "center",
              borderWidth: 1,
              borderColor: colors.primary,
              borderRadius: 12,
              paddingHorizontal: 14,
              height: 52,
              backgroundColor: colors.card,
            }}>
              <Feather name="key" size={16} color={colors.primary} style={{ marginRight: 10 }} />
              <TextInput
                style={{ flex: 1, fontSize: 15, color: colors.foreground }}
                placeholder="6-digit code"
                placeholderTextColor={colors.mutedForeground}
                value={code}
                onChangeText={setCode}
                keyboardType="number-pad"
                maxLength={6}
              />
            </View>

            <Pressable
              onPress={handleVerify}
              disabled={loading || code.length < 6}
              style={({ pressed }) => ({
                height: 52,
                borderRadius: 12,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: colors.primary,
                opacity: loading || code.length < 6 ? 0.5 : pressed ? 0.85 : 1,
              })}
            >
              {loading
                ? <ActivityIndicator color={colors.primaryForeground} />
                : <Text style={{ fontSize: 16, fontWeight: "700", color: colors.primaryForeground }}>Verify Email</Text>
              }
            </Pressable>
          </View>
        )}

        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 32, gap: 4 }}>
          <Text style={{ fontSize: 14, color: colors.mutedForeground }}>Already have an account?</Text>
          <Link href="/sign-in" asChild>
            <Pressable>
              <Text style={{ fontSize: 14, fontWeight: "600", color: colors.primary }}> Sign in</Text>
            </Pressable>
          </Link>
        </View>

        <Text style={{
          textAlign: "center",
          fontSize: 9,
          fontWeight: "600",
          color: colors.mutedForeground,
          letterSpacing: 2,
          textTransform: "uppercase",
          marginTop: 32,
        }}>
          ALPHA UNLIMITED TECHNOLOGIES LLC
        </Text>
      </ScrollView>
    </View>
  );
}
