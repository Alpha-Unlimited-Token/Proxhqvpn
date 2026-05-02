// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useAuth } from "@clerk/clerk-expo";
import { Redirect } from "expo-router";
import React from "react";
import { Platform, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";

export default function IndexScreen() {
  const { isSignedIn, isLoaded } = useAuth();

  if (!isLoaded) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#000000",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
        }}
      >
        <View
          style={{
            width: 120,
            height: 120,
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 8,
          }}
        >
          <View
            style={{
              position: "absolute",
              width: 140,
              height: 140,
              borderRadius: 70,
              backgroundColor: "#00ff88",
              opacity: 0.25,
            }}
          />
          <Feather name="shield" size={64} color="#00ff88" />
        </View>
        <Text
          style={{
            fontSize: 32,
            fontWeight: "800",
            color: "#ffffff",
            letterSpacing: -0.5,
          }}
        >
          Proxhq<Text style={{ color: "#00ff88" }}>VPN</Text>
        </Text>
        <Text
          style={{
            fontSize: 10,
            fontWeight: "600",
            color: "#00cc66",
            letterSpacing: 2,
            textTransform: "uppercase",
          }}
        >
          by ALPHA UNLIMITED TECHNOLOGIES
        </Text>
      </View>
    );
  }

  if (isSignedIn) return <Redirect href="/(tabs)" />;
  return <Redirect href="/sign-in" />;
}
