import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { PrimaryButton, TextButton } from '@/components/Button';
import { Note } from '@/components/Feedback';
import { Header } from '@/components/Header';
import { Reveal } from '@/components/motion/Reveal';
import { Screen } from '@/components/Screen';
import { Section } from '@/components/Section';
import { Text } from '@/design-system/Text';
import { spacing } from '@/design-system/tokens';
import { MUSCLE_GROUP_LABELS } from '@/data/exercises';
import { applyEmphasis } from '@/domain/training/volume';
import { MusclePicker } from '@/features/training/MuscleMap';
import { VolumeBars } from '@/features/plan/VolumeBars';
import { volumeBreakdown } from '@/domain/training/volume';
import type { MuscleGroup } from '@/domain/types';
import { useActiveRoutine, useEngine } from '@/store/hooks';
import { useAppStore } from '@/store/useAppStore';
import { snapshotOf, useRecalcStore } from '@/store/useRecalcStore';

/** More than this and nothing is a priority. */
const MAX_FOCUS = 3;

/**
 * Choosing what the plan is built around, by tapping the body.
 *
 * The bars underneath update as muscles are picked, before anything is saved —
 * so the trade-off is visible while making it rather than explained after. The
 * volume comes off somewhere, and you can see where.
 */
export default function FocusScreen() {
  const router = useRouter();
  const engine = useEngine();
  const routine = useActiveRoutine();
  const goal = useAppStore((state) => state.goal);
  const setMuscleFocus = useAppStore((state) => state.setMuscleFocus);
  const arm = useRecalcStore((state) => state.arm);

  const [selected, setSelected] = useState<MuscleGroup[]>(goal?.muscleFocus ?? []);

  const toggle = (muscle: MuscleGroup) => {
    Haptics.selectionAsync();
    setSelected((current) => {
      if (current.includes(muscle)) return current.filter((entry) => entry !== muscle);
      if (current.length >= MAX_FOCUS) return current;
      return [...current, muscle];
    });
  };

  // What the routine would look like with this selection, without saving it.
  const preview = routine ? applyEmphasis(routine, selected).routine : null;
  const previewVolume = volumeBreakdown(preview, selected);

  const save = () => {
    arm(snapshotOf(engine), 'Focus changed');
    setMuscleFocus(selected);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  const unchanged =
    JSON.stringify([...selected].sort()) === JSON.stringify([...(goal?.muscleFocus ?? [])].sort());

  return (
    <Screen>
      <Header
        title="Muscle focus"
        leading={{ icon: 'chevronLeft', onPress: () => router.back(), label: 'Back' }}
      />

      <Reveal index={0}>
        <MusclePicker selected={selected} onToggle={toggle} height={240} style={styles.picker} />
      </Reveal>

      <Reveal index={1}>
        <Text variant="body" tone={selected.length === 0 ? 'secondary' : 'primary'} style={styles.chosen}>
          {selected.length === 0
            ? 'Tap what you want to grow.'
            : selected.map((muscle) => MUSCLE_GROUP_LABELS[muscle]).join(' · ')}
        </Text>
      </Reveal>

      <Reveal index={2}>
        <Section title="Sets per week">
          <VolumeBars volume={previewVolume} />
        </Section>
      </Reveal>

      <Reveal index={3}>
        <PrimaryButton
          label={selected.length === 0 ? 'Keep it balanced' : 'Rebuild my routine'}
          onPress={save}
          disabled={unchanged}
          style={styles.cta}
        />
        {selected.length > 0 ? (
          <TextButton label="Clear" onPress={() => setSelected([])} style={styles.clear} />
        ) : null}
      </Reveal>

      <Note>
        Sets come off what you did not pick, never below what holds a muscle where it is. Up to {MAX_FOCUS} at a time.
      </Note>
    </Screen>
  );
}

const styles = StyleSheet.create({
  picker: {
    marginTop: spacing.lg,
  },
  chosen: {
    textAlign: 'center',
    marginTop: spacing.xl,
  },
  cta: {
    marginTop: spacing.xl,
  },
  clear: {
    alignSelf: 'center',
    marginTop: spacing.sm,
  },
});
