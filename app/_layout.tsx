import { Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { InterTight_700Bold, InterTight_800ExtraBold } from '@expo-google-fonts/inter-tight';
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider as NavigationThemeProvider,
  type Theme as NavigationTheme,
} from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect, useMemo } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';

import * as Sentry from '@sentry/react-native';

import { BiometricGate } from '@/components/BiometricGate';
import { useAuth } from '@/lib/auth-store';
import { initErrorReporting, setErrorReportingUser } from '@/lib/error-reporting';
import { useNotificationRouting } from '@/lib/notifications';
import { useSessionBootstrap } from '@/lib/session-bootstrap';
import { ThemeProvider, useTheme } from '@/lib/theme-context';

initErrorReporting();

// Hold the native splash until the brand fonts are in, so nothing flashes in
// the system font. The names here must match typography.fonts in lib/theme.ts.
void SplashScreen.preventAutoHideAsync();

export default Sentry.wrap(RootLayout);

function RootLayout() {
  useSessionBootstrap();
  useNotificationRouting();

  const userId = useAuth((s) => s.session?.user.id ?? null);
  useEffect(() => setErrorReportingUser(userId), [userId]);

  const [fontsLoaded, fontError] = useFonts({
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    InterTight_700Bold,
    InterTight_800ExtraBold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      void SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <ThemeProvider>
      <SafeAreaProvider>
        <ThemedNavigation />
        <BiometricGate />
      </SafeAreaProvider>
    </ThemeProvider>
  );
}

/**
 * Everything below the ThemeProvider: native-stack backgrounds, the React
 * Navigation theme (header / card colors), the status bar and the root view
 * colour behind modals and during screen transitions all follow the palette.
 */
function ThemedNavigation() {
  const { colors, isDark } = useTheme();

  useEffect(() => {
    void SystemUI.setBackgroundColorAsync(colors.surface2);
  }, [colors.surface2]);

  const navigationTheme = useMemo<NavigationTheme>(() => {
    const base = isDark ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: colors.gold,
        background: colors.surface2,
        card: colors.surface,
        text: colors.ink,
        border: colors.divider,
        notification: colors.danger,
      },
    };
  }, [colors, isDark]);

  return (
    <NavigationThemeProvider value={navigationTheme}>
      <Stack
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.surface2 } }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(onboarding)" />
        <Stack.Screen name="paywall" />
        <Stack.Screen name="paywall-v2" />
        <Stack.Screen name="app-paused" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="quote/new" options={{ presentation: 'modal' }} />
        <Stack.Screen name="quote/[id]" />
        <Stack.Screen name="job/[id]" />
        <Stack.Screen name="customer/[id]" />
        <Stack.Screen name="customer/edit/[id]" />
        <Stack.Screen name="contract/[id]" />
        <Stack.Screen name="payments" />
        <Stack.Screen name="settings" />
      </Stack>
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </NavigationThemeProvider>
  );
}
