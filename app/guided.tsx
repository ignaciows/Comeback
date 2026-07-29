import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeOut, useAnimatedStyle } from 'react-native-reanimated';

import { PrimaryButton, TextButton } from '@/components/Button';
import { StatusPill } from '@/components/Feedback';
import { AnimatedNumber } from '@/components/motion/AnimatedNumber';
import { Screen } from '@/components/Screen';
import { Icon } from '@/design-system/Icon';
import { Label, Text } from '@/design-system/Text';
import { motion, useLoop } from '@/design-system/motion';
import { borderWidth, colors, opacity, radius, spacing } from '@/design-system/tokens';
import { cuesFor } from '@/data/coachingCues';
import { exerciseName, getExercise } from '@/data/exercises';
import { cueForSet, restForSet, suggestLoad } from '@/domain/training/coaching';
import { formatClock, sessionProgress } from '@/domain/training/sessionProgress';
import type { WorkoutExercise, WorkoutSet } from '@/domain/types';
import { ExerciseAnimation } from '@/features/training/ExerciseAnimation';
import { useSession } from '@/store/hooks';
import { useAppStore } from '@/store/useAppStore';

/**
 * One set at a time, full screen.
 *
 * The ordinary session screen is a list: everything at once, good for someone
 * who already knows what they are doing. This is the opposite — the whole
 * screen is the set in front of you, with the movement animating, one cue, and
 * the weight and reps big enough to change without looking.
 *
 * Everything it does writes to the same session as the list view, so a set
 * logged here is a set logged, and you can leave at any point and carry on in
 * the other mode. Nothing is a separate "guided workout" with its own record.
 */
export default function GuidedScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const activeSessionId = useAppStore((state) => state.activeSessionId);
  const session = useSession(params.id ?? activeSessionId ?? undefined);
  const sessions = useAppStore((state) => state.sessions);

  const updateSet = useAppStore((state) => state.updateSet);
  const removeSet = useAppStore((state) => state.removeSet);
  const toggleExerciseSkipped = useAppStore((state) => state.toggleExerciseSkipped);
  const pauseSession = useAppStore((state) => state.pauseSession);
  const resumeSession = useAppStore((state) => state.resumeSession);
  const finishSession = useAppStore((state) => state.finishSession);
  const routines = useAppStore((state) => state.routines);

  useKeepAwake();

  const [restUntil, setRestUntil] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [weight, setWeight] = useState<number | null>(null);
  const [reps, setReps] = useState<number | null>(null);

  // One ticking clock drives the rest countdown and the session timer.
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(interval);
  }, []);

  /** The first set that has not been done, and the exercise it belongs to. */
  const current = useMemo(() => {
    if (!session) return null;
    for (const exercise of session.exercises) {
      if (exercise.skipped) continue;
      const index = exercise.sets.findIndex((entry) => !entry.completed);
      if (index >= 0) return { exercise, set: exercise.sets[index], index };
    }
    return null;
  }, [session]);

  /** What the last time this exercise was trained looked like. */
  const previousBest = useMemo(() => {
    if (!current || !session) return null;
    const earlier = sessions
      .filter((entry) => entry.status === 'completed' && entry.id !== session.id)
      .sort((a, b) => (a.date < b.date ? 1 : -1));

    for (const past of earlier) {
      const match = past.exercises.find((entry) => entry.exerciseId === current.exercise.exerciseId);
      const best = match?.sets
        .filter((entry) => entry.completed && !entry.warmup && entry.weightKg !== null)
        .sort((a, b) => (b.weightKg ?? 0) - (a.weightKg ?? 0))[0];
      if (best) return { weightKg: best.weightKg, reps: best.reps };
    }
    return null;
  }, [current, session, sessions]);

  const prescription = useMemo(() => {
    if (!current || !session) return { repMin: 8, repMax: 12 };
    const routine = routines.find((entry) => entry.id === session.routineId);
    const day = routine?.days.find((entry) => entry.id === session.routineDayId);
    const planned = day?.exercises.find((entry) => entry.exerciseId === current.exercise.exerciseId);
    return { repMin: planned?.repMin ?? 8, repMax: planned?.repMax ?? 12 };
  }, [current, session, routines]);

  const suggestion = useMemo(() => {
    if (!current) return null;
    const done = current.exercise.sets.filter((entry) => entry.completed && !entry.warmup);
    return suggestLoad({
      exerciseId: current.exercise.exerciseId,
      lastSet: done[done.length - 1] ?? null,
      setsThisSession: done,
      repMin: prescription.repMin,
      repMax: prescription.repMax,
      previousBest,
    });
  }, [current, prescription, previousBest]);

  // The suggestion seeds the inputs whenever the set changes; after that the
  // user's own numbers win.
  useEffect(() => {
    if (!current || !suggestion) return;
    setWeight(current.set.weightKg ?? suggestion.weightKg);
    setReps(current.set.reps ?? suggestion.reps);
  }, [current?.set.id, suggestion?.weightKg, suggestion?.reps]);

  const progress = session ? sessionProgress(session, new Date(now)) : null;
  const meta = current ? getExercise(current.exercise.exerciseId) : null;
  const cue = current && meta ? cueForSet(current.exercise.exerciseId, current.index, cuesFor(current.exercise.exerciseId, meta.pattern)) : null;

  const restLeft = restUntil === null ? null : Math.max(0, Math.ceil((restUntil - now) / 1000));
  useEffect(() => {
    if (restLeft === 0) setRestUntil(null);
  }, [restLeft]);

  if (!session || !progress) {
    return (
      <Screen scroll={false}>
        <View style={styles.centre}>
          <Text variant="body" tone="secondary">
            No session running.
          </Text>
          <TextButton label="Back" onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  // ---- Everything done -----------------------------------------------------
  if (!current) {
    return (
      <Screen scroll={false}>
        <View style={styles.centre}>
          <Icon name="check" size={48} color={colors.accent} />
          <Text variant="display" style={styles.doneTitle}>
            That is the session
          </Text>
          <Text variant="body" tone="secondary" style={styles.doneLine}>
            {`${progress.setsDone} sets · ${formatClock(progress.activeSeconds)} training`}
          </Text>
          {/* Straight to the summary — no second screen asking again. */}
          <PrimaryButton
            label="Finish and save"
            onPress={() => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              finishSession(session.id);
              router.replace({ pathname: '/workout/[id]', params: { id: session.id } });
            }}
            style={styles.doneCta}
          />
          <TextButton
            label="Back to the list"
            onPress={() => router.replace({ pathname: '/session', params: { id: session.id } })}
          />
        </View>
      </Screen>
    );
  }

  const logSet = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    updateSet(session.id, current.exercise.id, current.set.id, {
      weightKg: weight,
      reps,
      completed: true,
    });

    const isLast = current.index === current.exercise.sets.length - 1;
    setRestUntil(Date.now() + restForSet(current.exercise.exerciseId, isLast) * 1000);
  };

  const skipSet = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    removeSet(session.id, current.exercise.id, current.set.id);
  };

  const skipExercise = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    toggleExerciseSkipped(session.id, current.exercise.id);
  };

  // ---- Resting -------------------------------------------------------------
  if (restLeft !== null) {
    return (
      <Screen scroll={false}>
        <SessionBarTop session={session} progress={progress} onClose={() => router.back()} />

        <View style={styles.centre}>
          <Label>Rest</Label>
          <Text variant="display" mono style={styles.restClock}>
            {formatClock(restLeft)}
          </Text>
          <Text variant="body" tone="secondary" style={styles.restNext}>
            {`Next: ${exerciseName(current.exercise.exerciseId)} · set ${current.index + 1} of ${current.exercise.sets.length}`}
          </Text>

          <PrimaryButton label="Ready now" onPress={() => setRestUntil(null)} style={styles.doneCta} />
          <TextButton
            label="Another minute"
            onPress={() => setRestUntil((value) => (value ?? Date.now()) + 60_000)}
            style={styles.restMore}
          />
        </View>
      </Screen>
    );
  }

  // ---- The set in front of you --------------------------------------------
  const totalSets = current.exercise.sets.length;

  return (
    <Screen>
      <SessionBarTop session={session} progress={progress} onClose={() => router.back()} />

      <Animated.View key={current.set.id} entering={FadeIn.duration(motion.duration.base)} exiting={FadeOut}>
        {/* Tapping the movement opens the full setup: the machine, the steps,
            the mistakes. Nothing here has to say "tap for more". */}
        <Pressable
          onPress={() =>
            router.push({ pathname: '/exercise/[id]', params: { id: current.exercise.exerciseId } })
          }
          accessibilityRole="button"
          accessibilityLabel={`How to do ${exerciseName(current.exercise.exerciseId)}`}
          style={({ pressed }) => [styles.animation, pressed && { opacity: opacity.pressed }]}
        >
          <ExerciseAnimation
            pattern={meta?.pattern ?? 'isolation'}
            equipment={meta?.equipment ?? []}
            size={190}
          />
        </Pressable>

        <Text variant="title" style={styles.name}>
          {exerciseName(current.exercise.exerciseId)}
        </Text>
        <Label style={styles.setLabel}>{`Set ${current.index + 1} of ${totalSets}`}</Label>

        {/* One thing to think about. Never a list. */}
        {cue ? (
          <View style={styles.cue}>
            <Icon name="info" size={14} color={colors.accent} />
            <Text variant="body" style={styles.cueText}>
              {cue.text}
            </Text>
          </View>
        ) : null}

        <View style={styles.inputs}>
          <Stepper
            label="Weight"
            value={weight}
            suffix="kg"
            step={meta?.equipment.includes('dumbbell') ? 2 : 2.5}
            onChange={setWeight}
          />
          <Stepper label="Reps" value={reps} step={1} onChange={setReps} />
        </View>

        {suggestion?.reason ? (
          <Text variant="caption" tone="tertiary" style={styles.reason}>
            {suggestion.reason}
          </Text>
        ) : null}

        <PrimaryButton label="Done" onPress={logSet} style={styles.log} />

        <View style={styles.secondary}>
          <TextButton label="Skip set" onPress={skipSet} />
          <TextButton label="Skip exercise" onPress={skipExercise} />
          <TextButton
            label={progress.isPaused ? 'Continue' : 'Pause'}
            onPress={() => (progress.isPaused ? resumeSession(session.id) : pauseSession(session.id))}
          />
        </View>
      </Animated.View>
    </Screen>
  );
}

/** How far through the whole session, plus the clock and a way out. */
function SessionBarTop({
  session,
  progress,
  onClose,
}: {
  session: { exercises: WorkoutExercise[] };
  progress: ReturnType<typeof sessionProgress>;
  onClose: () => void;
}) {
  const beat = useLoop(motion.loop.heartbeat);
  const live = useAnimatedStyle(() => ({
    opacity: progress.isPaused ? 0.4 : 0.5 + Math.sin(beat.value * Math.PI) * 0.5,
  }));

  // One segment per working set of the session, filled as they are done.
  const segments = session.exercises
    .filter((exercise) => !exercise.skipped)
    .flatMap((exercise) => exercise.sets.filter((entry) => !entry.warmup));

  return (
    <View style={styles.top}>
      <View style={styles.topRow}>
        <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Close">
          <Icon name="chevronDown" size={22} color={colors.textTertiary} />
        </Pressable>

        <View style={styles.live}>
          <Animated.View style={[styles.dot, progress.isPaused ? styles.dotPaused : null, live]} />
          <Text variant="caption" tone="tertiary" mono>
            {formatClock(progress.isPaused ? (progress.currentPauseSeconds ?? 0) : progress.activeSeconds)}
          </Text>
        </View>

        {progress.isPaused ? <StatusPill label="Paused" tone="warning" /> : null}
      </View>

      <View style={styles.segments}>
        {segments.map((entry: WorkoutSet, index: number) => (
          <View
            key={entry.id}
            style={[styles.segment, entry.completed ? styles.segmentDone : null]}
            accessibilityLabel={`Set ${index + 1}`}
          />
        ))}
      </View>
    </View>
  );
}

/** A big number you can change without looking at your phone properly. */
function Stepper({
  label,
  value,
  step,
  suffix,
  onChange,
}: {
  label: string;
  value: number | null;
  step: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  const nudge = (direction: -1 | 1) => {
    Haptics.selectionAsync();
    onChange(Math.max(0, Math.round(((value ?? 0) + direction * step) * 10) / 10));
  };

  return (
    <View style={styles.stepper}>
      <Label>{label}</Label>

      <View style={styles.stepperRow}>
        <Pressable
          onPress={() => nudge(-1)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={`Less ${label}`}
          style={({ pressed }) => [styles.stepButton, pressed && { opacity: opacity.pressed }]}
        >
          <Icon name="minus" size={20} color={colors.text} />
        </Pressable>

        <View style={styles.stepperValue}>
          <AnimatedNumber
            value={value}
            decimals={value !== null && value % 1 !== 0 ? 1 : 0}
            variant="display"
            style={styles.stepperNumber}
          />
          {suffix ? (
            <Text variant="caption" tone="tertiary">
              {suffix}
            </Text>
          ) : null}
        </View>

        <Pressable
          onPress={() => nudge(1)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={`More ${label}`}
          style={({ pressed }) => [styles.stepButton, pressed && { opacity: opacity.pressed }]}
        >
          <Icon name="plus" size={20} color={colors.text} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centre: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xxxl,
  },
  top: {
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  live: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
  },
  dotPaused: {
    backgroundColor: colors.warning,
  },
  segments: {
    flexDirection: 'row',
    gap: 3,
  },
  segment: {
    flex: 1,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceRaised,
  },
  segmentDone: {
    backgroundColor: colors.accent,
  },
  animation: {
    alignSelf: 'center',
  },
  name: {
    textAlign: 'center',
    marginTop: spacing.xl,
  },
  setLabel: {
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  cue: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginTop: spacing.xl,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: borderWidth.hairline,
    borderColor: colors.accentMuted,
    backgroundColor: colors.accentSurface,
  },
  cueText: {
    flex: 1,
  },
  inputs: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.lg,
    marginTop: spacing.xl,
  },
  stepper: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.sm,
  },
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  stepButton: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    borderWidth: borderWidth.hairline,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValue: {
    alignItems: 'center',
  },
  stepperNumber: {
    fontSize: 40,
    lineHeight: 44,
  },
  reason: {
    textAlign: 'center',
    marginTop: spacing.md,
  },
  log: {
    marginTop: spacing.xl,
  },
  secondary: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xl,
    marginTop: spacing.lg,
  },
  restClock: {
    fontSize: 72,
    lineHeight: 76,
  },
  restNext: {
    textAlign: 'center',
  },
  restMore: {
    marginTop: spacing.sm,
  },
  doneTitle: {
    textAlign: 'center',
    marginTop: spacing.lg,
  },
  doneLine: {
    textAlign: 'center',
  },
  doneCta: {
    alignSelf: 'stretch',
    marginTop: spacing.xl,
  },
});
