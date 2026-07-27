import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/Button';
import { Note } from '@/components/Feedback';
import { Header } from '@/components/Header';
import { Input } from '@/components/Input';
import { Screen } from '@/components/Screen';
import { Section } from '@/components/Section';
import { SegmentedControl } from '@/components/SegmentedControl';
import { Text } from '@/design-system/Text';
import { spacing } from '@/design-system/tokens';
import { EQUIPMENT_LABELS } from '@/data/exercises';
import type { EquipmentAvailability, EquipmentId } from '@/domain/types';
import { useAppStore } from '@/store/useAppStore';

const OPTIONS: { value: EquipmentAvailability; label: string }[] = [
  { value: 'available', label: 'Yes' },
  { value: 'unavailable', label: 'No' },
  { value: 'unsure', label: 'Not sure' },
];

/**
 * Equipment inventory. Nothing is required — the app records what it learns and
 * uses it to order substitution suggestions.
 */
export default function GymScreen() {
  const router = useRouter();
  const gyms = useAppStore((state) => state.gyms);
  const gymId = useAppStore((state) => state.training.gymId);
  const setGymEquipment = useAppStore((state) => state.setGymEquipment);
  const createGym = useAppStore((state) => state.createGym);

  const [name, setName] = useState('');
  const gym = gyms.find((entry) => entry.id === gymId) ?? gyms[0] ?? null;

  if (!gym) {
    return (
      <Screen>
        <Header title="Gym" leading={{ icon: 'chevronLeft', onPress: () => router.back(), label: 'Back' }} />
        <Section title="Add a gym">
          <Input label="Name" value={name} onChangeText={setName} placeholder="Home gym" style={styles.field} />
          <PrimaryButton label="Create" onPress={() => createGym(name.trim() || 'My gym')} disabled={!name.trim()} />
        </Section>
      </Screen>
    );
  }

  return (
    <Screen>
      <Header
        title={gym.name}
        subtitle="What you have access to"
        leading={{ icon: 'chevronLeft', onPress: () => router.back(), label: 'Back' }}
      />

      <Note>
        You do not need to fill this in. Answer as you go — whenever you substitute an exercise, the app remembers
        what was available.
      </Note>

      <View style={styles.list}>
        {(Object.keys(EQUIPMENT_LABELS) as EquipmentId[]).map((equipmentId) => (
          <Section key={equipmentId}>
            <Text variant="body" style={styles.label}>
              {EQUIPMENT_LABELS[equipmentId]}
            </Text>
            <SegmentedControl
              options={OPTIONS}
              value={gym.equipment[equipmentId] ?? null}
              onChange={(value) => setGymEquipment(gym.id, equipmentId, value)}
            />
          </Section>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  field: {
    marginBottom: spacing.lg,
  },
  list: {
    marginTop: spacing.xl,
  },
  label: {
    marginBottom: spacing.md,
  },
});
