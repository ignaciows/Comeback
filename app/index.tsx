import { Redirect } from 'expo-router';

import { useAppStore } from '@/store/useAppStore';

/** Entry point: onboarding until there is a profile, Today afterwards. */
export default function Index() {
  const onboardingCompleted = useAppStore((state) => state.onboardingCompleted);
  return <Redirect href={onboardingCompleted ? '/(tabs)/today' : '/onboarding'} />;
}
