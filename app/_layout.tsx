import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { LoadingState } from '@/components/Feedback';
import { colors } from '@/design-system/tokens';
import { createManualHealthDataProvider, registerHealthProvider } from '@/services/health/HealthDataProvider';
import { useAppStore } from '@/store/useAppStore';

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

export default function RootLayout() {
  const hydrated = useAppStore((state) => state.hydrated);
  useHealthProviders();

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        {hydrated ? (
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.background },
              animation: 'slide_from_right',
            }}
          >
            <Stack.Screen name="index" />
            <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
            <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
            <Stack.Screen name="session" options={{ animation: 'slide_from_bottom', gestureEnabled: false }} />
            <Stack.Screen name="checkin" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
            <Stack.Screen name="log-weight" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
          </Stack>
        ) : (
          <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center' }}>
            <LoadingState label="Loading your data" />
          </View>
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
