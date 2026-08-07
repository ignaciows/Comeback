import { Tabs } from 'expo-router';
import { StyleSheet } from 'react-native';

import { Icon, type IconName } from '@/design-system/Icon';
import { colors, typography } from '@/design-system/tokens';

/**
 * Four tabs, because there were five and two of them did the same job.
 *
 * Today and Train both opened on a hero and a Start button, which meant the
 * first question the app asked a new user was one it had no business asking:
 * which of these two is the real one? They are one screen now. What is left is
 * the smallest set of questions a person actually has — what do I do now, where
 * is this going, what does any of this mean, and who am I in here.
 */
const TABS: { name: string; title: string; icon: IconName }[] = [
  { name: 'today', title: 'Today', icon: 'today' },
  { name: 'plan', title: 'Plan', icon: 'plan' },
  { name: 'learn', title: 'Learn', icon: 'method' },
  { name: 'profile', title: 'You', icon: 'profile' },
];

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.background },
        tabBarStyle: styles.bar,
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarLabelStyle: styles.label,
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarIcon: ({ color }) => <Icon name={tab.icon} color={color} size={22} />,
          }}
        />
      ))}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.background,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    elevation: 0,
  },
  label: {
    fontSize: typography.caption.fontSize,
    fontWeight: '500',
  },
});
