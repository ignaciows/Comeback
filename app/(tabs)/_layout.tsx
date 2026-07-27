import { Tabs } from 'expo-router';
import { StyleSheet } from 'react-native';

import { Icon, type IconName } from '@/design-system/Icon';
import { colors, typography } from '@/design-system/tokens';

const TABS: { name: string; title: string; icon: IconName }[] = [
  { name: 'today', title: 'Today', icon: 'today' },
  { name: 'train', title: 'Train', icon: 'train' },
  { name: 'progress', title: 'Progress', icon: 'progress' },
  { name: 'profile', title: 'Profile', icon: 'profile' },
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
