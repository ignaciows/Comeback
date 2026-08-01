import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ScrollView, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { SecondaryButton } from '@/components/Button';
import { Text } from '@/design-system/Text';
import { colors, spacing } from '@/design-system/tokens';
import { createManualHealthDataProvider, registerHealthProvider } from '@/services/health/HealthDataProvider';
import { useWeatherSync } from '@/services/weather/useWeather';
import { useAppStore } from '@/store/useAppStore';

/**
 * Anything that throws while rendering lands here.
 *
 * In a production bundle React unmounts the tree on an uncaught error and the
 * screen goes black with no message — impossible to diagnose from a phone.
 * expo-router renders this instead, so a failure is always readable and there
 * is always a way out.
 */
export function ErrorBoundary({ error, retry }: { error: Error; retry: () => Promise<void> }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <ScrollView contentContainerStyle={{ padding: spacing.xl, paddingTop: spacing.xxxl * 2 }}>
        <Text variant="title" tone="danger">
          Something broke
        </Text>
        <Text variant="bodySmall" tone="secondary" style={{ marginTop: spacing.md }}>
          {error?.message ?? 'Unknown error'}
        </Text>
        <Text variant="caption" tone="tertiary" style={{ marginTop: spacing.lg }}>
          {error?.stack?.split('\n').slice(0, 8).join('\n')}
        </Text>
        <View style={{ marginTop: spacing.xxl, gap: spacing.md }}>
          <SecondaryButton label="Try again" onPress={() => void retry()} />
          <SecondaryButton
            label="Reset all data"
            tone="danger"
            onPress={() => {
              useAppStore.getState().resetAll();
              void retry();
            }}
          />
        </View>
      </ScrollView>
    </View>
  );
}

/**
 * Registers the manual health provider once. Apple Health, Apple Watch and
 * Renpho will register themselves here too, without any screen changing.
 */
function useHealthProviders() {
  useEffect(() => {
    registerHealthProvider(
      createManualHealthDataProvider({
        sleep: () =>
          useAppStore
            .getState()
            .checkins.filter((checkin) => checkin.sleepHours !== null)
            .map((checkin) => ({
              date: checkin.date,
              hours: checkin.sleepHours as number,
              quality: checkin.sleepQuality,
              source: checkin.source,
            })),
        bodyComposition: () => useAppStore.getState().bodyMeasurements,
      }),
    );
  }, []);
}

/**
 * Safety net for hydration. If reading from storage never resolves — a corrupt
 * payload, a storage error — the app must still start rather than sit on a
 * screen that never changes.
 */
function useHydrationTimeout() {
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!useAppStore.getState().hydrated) useAppStore.setState({ hydrated: true });
    }, 3000);
    return () => clearTimeout(timeout);
  }, []);
}

export default function RootLayout() {
  useHealthProviders();
  useHydrationTimeout();
  useWeatherSync();

  // The navigator is always mounted. Withholding it until some condition is met
  // leaves expo-router with nothing to consider "ready", which keeps the splash
  // screen up indefinitely — a black screen with no way to tell why.
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="index" options={{ animation: 'none' }} />
          <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
          <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
          <Stack.Screen name="session" options={{ animation: 'slide_from_bottom', gestureEnabled: false }} />
          {/* Guided is the whole screen while it is open: no swipe back mid-set. */}
          <Stack.Screen name="guided" options={{ animation: 'slide_from_bottom', gestureEnabled: false }} />
          <Stack.Screen name="previous-plan" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="checkin" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="log-weight" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          <Stack.Screen name="fuel" />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
