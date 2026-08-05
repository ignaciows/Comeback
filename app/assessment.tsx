import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { PrimaryButton, TextButton } from '@/components/Button';
import { Note } from '@/components/Feedback';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { Icon } from '@/design-system/Icon';
import { Label, Text } from '@/design-system/Text';
import { motion } from '@/design-system/motion';
import { borderWidth, colors, radius, spacing } from '@/design-system/tokens';
import { exerciseName, getExercise } from '@/data/exercises';
import { ASSESSMENT, summarise, type RepOut } from '@/domain/training/assessment';
import { MovementArt } from '@/features/training/MovementArt';
import { Stepper } from '@/features/training/Stepper';
import { useAppStore } from '@/store/useAppStore';

/**
 * One session to find out what you can lift.
 *
 * Until this happens the app is guessing at every weight it prescribes, and
 * the first fortnight gets spent discovering by trial and error what a single
 * session could have established. Five sets, one per movement pattern, each a
 * rep-out at a weight you choose — never a one-rep max, which is how people
 * get hurt in their first week back for a number that is not worth it.
 *
 * Skippable at every step. An assessment nobody finishes is worse than none,
 * because it leaves half a picture the plan then trusts.
 */
export default function AssessmentScreen() {
  const router = useRouter();
  const profile = useAppStore((state) => state.profile);
  const saveAssessment = useAppStore((state) => state.saveAssessment);

  const [step, setStep] = useState(0);
  const [weight, setWeight] = useState<number | null>(null);
  const [reps, setReps] = useState<number | null>(10);
  const [results, setResults] = useState<RepOut[]>([]);

  const done = step >= ASSESSMENT.length;
  const item = done ? null : ASSESSMENT[step];
  const meta = item ? getExercise(item.exerciseId) : null;

  const outcome = summarise(results, 8, profile?.experience ?? 'returning', profile?.layoffWeeks ?? 0);

  const record = () => {
    if (!item || weight === null || reps === null) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setResults((current) => [...current, { exerciseId: item.exerciseId, weightKg: weight, reps }]);
    advance();
  };

  const advance = () => {
    setStep((value) => value + 1);
    setWeight(null);
    setReps(10);
  };

  const finish = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    saveAssessment(results);
    router.replace('/(tabs)/today');
  };

  // ---- The summary ---------------------------------------------------------
  if (done) {
    return (
      <Screen bottomInset={spacing.xxl}>
        <Header
          title="That is the measurement"
          leading={{ icon: 'close', onPress: () => router.back(), label: 'Close' }}
        />

        <Text variant="body" tone="secondary" style={styles.summary}>
          {outcome.summary}
        </Text>

        {outcome.loads.map((load) => (
          <View key={load.exerciseId} style={styles.result}>
            <View style={styles.resultText}>
              <Text variant="body">{exerciseName(load.exerciseId)}</Text>
              <Text variant="caption" tone="tertiary">
                {load.reason}
              </Text>
            </View>
            <View style={styles.resultNumbers}>
              <Text variant="title" mono>
                {load.weightKg}
              </Text>
              <Text variant="caption" tone="tertiary">
                kg to start
              </Text>
            </View>
          </View>
        ))}

        <Note style={styles.note}>
          These are deliberately below what you just did. Starting light costs one session; starting
          heavy costs a lot more, and the plan adds load every time you earn it.
        </Note>

        <PrimaryButton label="Use these numbers" onPress={finish} style={styles.cta} />
      </Screen>
    );
  }

  // ---- One test set --------------------------------------------------------
  return (
    <Screen bottomInset={spacing.xxl}>
      <Header
        title={`Test ${step + 1} of ${ASSESSMENT.length}`}
        leading={{ icon: 'close', onPress: () => router.back(), label: 'Close' }}
      />

      <View style={styles.bar}>
        {ASSESSMENT.map((_, index) => (
          <View key={index} style={[styles.barCell, index <= step && styles.barCellOn]} />
        ))}
      </View>

      <Animated.View key={item!.exerciseId} entering={FadeIn.duration(motion.duration.base)}>
        <MovementArt
          exerciseId={item!.exerciseId}
          pattern={meta?.pattern ?? 'isolation'}
          equipment={meta?.equipment ?? []}
          style={styles.animation}
        />

        <Text variant="title" style={styles.name}>
          {exerciseName(item!.exerciseId)}
        </Text>

        <View style={styles.instruction}>
          <Icon name="info" size={14} color={colors.accent} />
          <Text variant="body" style={styles.instructionText}>
            {item!.instruction}
          </Text>
        </View>

        <View style={styles.inputs}>
          <Stepper label="Weight" value={weight} suffix="kg" step={2.5} onChange={setWeight} />
          <Stepper label="Reps done" value={reps} step={1} onChange={setReps} />
        </View>

        <PrimaryButton
          label="Record it"
          onPress={record}
          disabled={weight === null || weight <= 0 || reps === null || reps < 1}
          style={styles.cta}
        />
        <TextButton label="Skip this one" onPress={advance} style={styles.skip} />
      </Animated.View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    gap: 3,
    marginBottom: spacing.xl,
  },
  barCell: {
    flex: 1,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceRaised,
  },
  barCellOn: {
    backgroundColor: colors.accent,
  },
  animation: {
    alignSelf: 'center',
  },
  name: {
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  instruction: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: borderWidth.hairline,
    borderColor: colors.accentMuted,
    backgroundColor: colors.accentSurface,
  },
  instructionText: {
    flex: 1,
  },
  inputs: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.lg,
    marginTop: spacing.xl,
  },
  cta: {
    marginTop: spacing.xl,
  },
  skip: {
    alignSelf: 'center',
    marginTop: spacing.md,
  },
  summary: {
    marginBottom: spacing.xl,
  },
  result: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.lg,
    padding: spacing.lg,
    marginBottom: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: borderWidth.hairline,
    borderColor: colors.border,
  },
  resultText: {
    flex: 1,
    gap: spacing.xs,
  },
  resultNumbers: {
    alignItems: 'flex-end',
  },
  note: {
    marginTop: spacing.lg,
  },
});
