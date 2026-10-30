import { Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { InterTight_700Bold, InterTight_800ExtraBold } from '@expo-google-fonts/inter-tight';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';

import { useSessionBootstrap } from '@/lib/session-bootstrap';

// Hold the native splash until the brand fonts are in, so nothing flashes in
// the system font. The names here must match typography.fonts in lib/theme.ts.
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useSessionBootstrap();

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
    <SafeAreaProvider>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#F7F5EF' } }}>
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
      <StatusBar style="light" />
    </SafeAreaProvider>
  );
}
