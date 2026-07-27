import { Redirect } from 'expo-router';
import { View } from 'react-native';

import { LoadingState } from '@/components/Feedback';
import { colors } from '@/design-system/tokens';
import { useAppStore } from '@/store/useAppStore';

/**
 * Entry point. Waits for storage inside the navigator rather than in place of
 * it, then sends you to onboarding or to Today.
 */
export default function Index() {
  const hydrated = useAppStore((state) => state.hydrated);
  const onboardingCompleted = useAppStore((state) => state.onboardingCompleted);

  if (!hydrated) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, justifyContent: 'center' }}>
        <LoadingState label="Loading your data" />
      </View>
    );
  }

  return <Redirect href={onboardingCompleted ? '/(tabs)/today' : '/onboarding'} />;
}
