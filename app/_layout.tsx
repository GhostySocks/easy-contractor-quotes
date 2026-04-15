import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';

import { useSessionBootstrap } from '@/lib/session-bootstrap';

export default function RootLayout() {
  useSessionBootstrap();

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
