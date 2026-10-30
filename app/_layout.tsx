import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider as NavigationThemeProvider,
  type Theme as NavigationTheme,
} from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect, useMemo } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';

import { useSessionBootstrap } from '@/lib/session-bootstrap';
import { ThemeProvider, useTheme } from '@/lib/theme-context';

export default function RootLayout() {
  useSessionBootstrap();

  return (
    <ThemeProvider>
      <SafeAreaProvider>
        <ThemedNavigation />
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
        <Stack.Screen name="contract/[id]" />
        <Stack.Screen name="settings" />
      </Stack>
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </NavigationThemeProvider>
  );
}
