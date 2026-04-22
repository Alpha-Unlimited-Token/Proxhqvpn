import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { WebView, WebViewNavigation } from "react-native-webview";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";

const PRIMARY_URL = "https://proxhqvpn.com";
const DEV_DOMAIN = process.env.EXPO_PUBLIC_DOMAIN;
const WEB_URL = DEV_DOMAIN ? `https://${DEV_DOMAIN}/ghost-vpn/` : PRIMARY_URL;

function ShieldIcon({ size = 48, color = "#00ff88", animated = false }: { size?: number; color?: string; animated?: boolean }) {
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Feather name="shield" size={size} color={color} />
    </View>
  );
}

function SplashScreen({ onComplete }: { onComplete: () => void }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const colors = useColors();

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 600,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 60,
          friction: 8,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(glowAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.delay(800),
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 400,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => onComplete());
  }, []);

  const glowOpacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.35] });

  return (
    <Animated.View style={[styles.splash, { opacity: fadeAnim }]}>
      <Animated.View style={{ transform: [{ scale: scaleAnim }], alignItems: "center" }}>
        <View style={styles.logoRing}>
          <Animated.View
            style={[
              styles.logoGlow,
              { opacity: glowOpacity, backgroundColor: colors.primary },
            ]}
          />
          <Feather name="shield" size={56} color={colors.primary} />
        </View>
        <Text style={[styles.splashTitle, { color: "#ffffff" }]}>
          Proxhq<Text style={{ color: colors.primary }}>VPN</Text>
        </Text>
        <Text style={[styles.splashSub, { color: colors.mutedForeground }]}>
          by ALPHA UNLIMITED TECHNOLOGIES
        </Text>
      </Animated.View>

      <View style={styles.splashDots}>
        {[0, 1, 2].map((i) => (
          <SplashDot key={i} delay={i * 180} color={colors.primary} />
        ))}
      </View>
    </Animated.View>
  );
}

function SplashDot({ delay, color }: { delay: number; color: string }) {
  const anim = useRef(new Animated.Value(0.3)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0.3, duration: 400, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return (
    <Animated.View
      style={[
        styles.splashDot,
        { backgroundColor: color, opacity: anim },
      ]}
    />
  );
}

function LoadingBar({ progress, color }: { progress: number; color: string }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: progress,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  return (
    <View style={styles.loadingTrack}>
      <Animated.View
        style={[
          styles.loadingFill,
          {
            backgroundColor: color,
            width: anim.interpolate({
              inputRange: [0, 1],
              outputRange: ["0%", "100%"],
            }),
          },
        ]}
      />
    </View>
  );
}

function OfflineScreen({ onRetry, url }: { onRetry: () => void; url: string }) {
  const colors = useColors();
  return (
    <View style={[styles.offlineContainer, { backgroundColor: colors.background }]}>
      <Feather name="wifi-off" size={48} color={colors.mutedForeground} />
      <Text style={[styles.offlineTitle, { color: colors.foreground }]}>Connection Failed</Text>
      <Text style={[styles.offlineSub, { color: colors.mutedForeground }]}>
        Could not reach {url.replace("https://", "").split("/")[0]}
      </Text>
      <Pressable
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onRetry(); }}
        style={({ pressed }) => [
          styles.retryBtn,
          { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
        ]}
      >
        <Text style={[styles.retryText, { color: colors.primaryForeground }]}>Retry</Text>
      </Pressable>
    </View>
  );
}

export default function MainScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const webViewRef = useRef<WebView>(null);
  const [showSplash, setShowSplash] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [webUrl, setWebUrl] = useState(WEB_URL);

  const handleSplashComplete = useCallback(() => {
    setShowSplash(false);
  }, []);

  const handleNavigationStateChange = useCallback((nav: WebViewNavigation) => {
    setCanGoBack(nav.canGoBack);
    setCanGoForward(nav.canGoForward);
    setHasError(false);
  }, []);

  const handleLoadProgress = useCallback(({ nativeEvent }: { nativeEvent: { progress: number } }) => {
    setLoadingProgress(nativeEvent.progress);
    setIsLoading(nativeEvent.progress < 1);
  }, []);

  const handleError = useCallback(() => {
    setHasError(true);
    setIsLoading(false);
    if (webUrl !== PRIMARY_URL) {
      setTimeout(() => setWebUrl(PRIMARY_URL), 500);
    }
  }, [webUrl]);

  const handleRetry = useCallback(() => {
    setHasError(false);
    setIsLoading(true);
    webViewRef.current?.reload();
  }, []);

  const handleBack = useCallback(() => {
    Haptics.selectionAsync();
    webViewRef.current?.goBack();
  }, []);

  const handleForward = useCallback(() => {
    Haptics.selectionAsync();
    webViewRef.current?.goForward();
  }, []);

  const handleRefresh = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsLoading(true);
    webViewRef.current?.reload();
  }, []);

  const isWeb = Platform.OS === "web";
  const webTopInset = isWeb ? 67 : insets.top;
  const webBottomInset = isWeb ? 34 : insets.bottom;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />

      {!showSplash && (
        <>
          <View
            style={[
              styles.header,
              {
                paddingTop: webTopInset,
                height: webTopInset + 44,
                backgroundColor: colors.background,
                borderBottomColor: colors.border,
              },
            ]}
          >
            <View style={styles.headerBrand}>
              <Feather name="shield" size={16} color={colors.primary} />
              <Text style={[styles.headerTitle, { color: "#ffffff" }]}>
                Proxhq<Text style={{ color: colors.primary }}>VPN</Text>
              </Text>
            </View>
            <View style={styles.headerRight}>
              {isLoading && (
                <View style={[styles.loadingBadge, { backgroundColor: colors.accent }]}>
                  <Text style={[styles.loadingBadgeText, { color: colors.primary }]}>●</Text>
                </View>
              )}
            </View>
          </View>

          <LoadingBar progress={loadingProgress} color={colors.primary} />
        </>
      )}

      {!showSplash && !hasError && (
        <WebView
          ref={webViewRef}
          source={{ uri: webUrl }}
          style={[styles.webview, { backgroundColor: colors.background }]}
          onNavigationStateChange={handleNavigationStateChange}
          onLoadProgress={handleLoadProgress}
          onError={handleError}
          onHttpError={handleError}
          allowsBackForwardNavigationGestures={Platform.OS === "ios"}
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          sharedCookiesEnabled
          domStorageEnabled
          javaScriptEnabled
          startInLoadingState
          renderLoading={() => (
            <View style={[styles.webLoadingContainer, { backgroundColor: colors.background }]}>
              <Feather name="shield" size={32} color={colors.primary} />
            </View>
          )}
        />
      )}

      {!showSplash && hasError && (
        <OfflineScreen onRetry={handleRetry} url={webUrl} />
      )}

      {!showSplash && (
        <View
          style={[
            styles.navbar,
            {
              paddingBottom: Math.max(webBottomInset, 8),
              backgroundColor: colors.background,
              borderTopColor: colors.border,
            },
          ]}
        >
          <NavBtn
            icon="chevron-left"
            onPress={handleBack}
            disabled={!canGoBack}
            color={colors.primary}
            dimColor={colors.mutedForeground}
          />
          <NavBtn
            icon="chevron-right"
            onPress={handleForward}
            disabled={!canGoForward}
            color={colors.primary}
            dimColor={colors.mutedForeground}
          />
          <NavBtn
            icon="shield"
            onPress={() => { webViewRef.current?.injectJavaScript(`window.location.href = '/ghost-vpn/';`); }}
            color={colors.primary}
            dimColor={colors.mutedForeground}
          />
          <NavBtn
            icon="refresh-cw"
            onPress={handleRefresh}
            color={colors.primary}
            dimColor={colors.mutedForeground}
          />
        </View>
      )}

      {showSplash && <SplashScreen onComplete={handleSplashComplete} />}
    </View>
  );
}

function NavBtn({
  icon,
  onPress,
  disabled = false,
  color,
  dimColor,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  onPress: () => void;
  disabled?: boolean;
  color: string;
  dimColor: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      testID={`nav-${icon}`}
      style={({ pressed }) => [
        styles.navBtn,
        { opacity: disabled ? 0.3 : pressed ? 0.6 : 1 },
      ]}
    >
      <Feather name={icon} size={20} color={disabled ? dimColor : color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    zIndex: 10,
  },
  headerBrand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: "700" as const,
    letterSpacing: 0.3,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  loadingBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  loadingBadgeText: {
    fontSize: 8,
  },
  loadingTrack: {
    height: 2,
    width: "100%",
    backgroundColor: "transparent",
    zIndex: 9,
  },
  loadingFill: {
    height: "100%",
    shadowColor: "#00ff88",
    shadowRadius: 6,
    shadowOpacity: 0.8,
    shadowOffset: { width: 0, height: 0 },
  },
  webview: {
    flex: 1,
  },
  webLoadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  navbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  navBtn: {
    width: 52,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
  },
  splash: {
    position: "absolute",
    inset: 0,
    backgroundColor: "#000000",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 999,
  },
  logoRing: {
    width: 100,
    height: 100,
    borderRadius: 28,
    backgroundColor: "rgba(0,255,136,0.06)",
    borderWidth: 1.5,
    borderColor: "rgba(0,255,136,0.25)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  logoGlow: {
    position: "absolute",
    inset: -20,
    borderRadius: 48,
    opacity: 0,
  },
  splashTitle: {
    fontSize: 30,
    fontWeight: "800" as const,
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  splashSub: {
    fontSize: 10,
    fontWeight: "600" as const,
    letterSpacing: 1.5,
    textTransform: "uppercase" as const,
  },
  splashDots: {
    position: "absolute",
    bottom: 60,
    flexDirection: "row",
    gap: 8,
  },
  splashDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  offlineContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 40,
  },
  offlineTitle: {
    fontSize: 20,
    fontWeight: "700" as const,
    marginTop: 4,
  },
  offlineSub: {
    fontSize: 13,
    textAlign: "center" as const,
    lineHeight: 20,
  },
  retryBtn: {
    marginTop: 12,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 10,
  },
  retryText: {
    fontSize: 15,
    fontWeight: "600" as const,
  },
});
