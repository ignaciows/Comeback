import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { PrimaryButton, SecondaryButton, TextButton } from '@/components/Button';
import { StatusPill } from '@/components/Feedback';
import { AnimatedNumber } from '@/components/motion/AnimatedNumber';
import { Screen } from '@/components/Screen';
import { Icon } from '@/design-system/Icon';
import { Label, Text } from '@/design-system/Text';
import { motion, useLoop } from '@/design-system/motion';
import { borderWidth, colors, opacity, radius, spacing } from '@/design-system/tokens';
import { cuesFor } from '@/data/coachingCues';
import { exerciseName, findSubstitutions, getExercise } from '@/data/exercises';
import { cueForSet, restForSet, suggestLoad } from '@/domain/training/coaching';
import { startingLoad } from '@/domain/training/assessment';
import { sessionLevels } from '@/domain/training/sessionLevels';
import { formatClock, sessionProgress, sessionStage } from '@/domain/training/sessionProgress';
import { MovementArt } from '@/features/training/MovementArt';
import { Turntable, hasTurntable } from '@/features/training/Turntable';
import { ExercisePicker } from '@/features/training/ExercisePicker';
import { LevelTrack } from '@/features/training/LevelTrack';
import { Stepper } from '@/features/training/Stepper';
import { WarmupBrief } from '@/features/training/WarmupBrief';
import { WorkoutFooter } from '@/features/training/WorkoutFooter';
import { hasWarmup } from '@/domain/training/warmup';
import { BottomSheet } from '@/components/BottomSheet';
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
/**
 * Long enough to register as deliberate, short enough that it is finished
 * before you have racked the weight. Anything longer starts to feel like
 * something you are waiting out.
 */
const LEVEL_PULSE_MS = 400;

export default function GuidedScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const activeSessionId = useAppStore((state) => state.activeSessionId);
  const session = useSession(params.id ?? activeSessionId ?? undefined);
  const sessions = useAppStore((state) => state.sessions);

  const updateSet = useAppStore((state) => state.updateSet);
  const removeSet = useAppStore((state) => state.removeSet);
  const addSet = useAppStore((state) => state.addSet);
  const addExerciseToSession = useAppStore((state) => state.addExerciseToSession);
  const substituteExercise = useAppStore((state) => state.substituteExercise);
  const updateRoutineExercise = useAppStore((state) => state.updateRoutineExercise);
  const gyms = useAppStore((state) => state.gyms);
  const gymId = useAppStore((state) => state.training.gymId);
  const toggleExerciseSkipped = useAppStore((state) => state.toggleExerciseSkipped);
  const pauseSession = useAppStore((state) => state.pauseSession);
  const resumeSession = useAppStore((state) => state.resumeSession);
  const finishSession = useAppStore((state) => state.finishSession);
  const routines = useAppStore((state) => state.routines);
  const assessment = useAppStore((state) => state.assessment);
  const profile = useAppStore((state) => state.profile);

  useKeepAwake();

  const [restUntil, setRestUntil] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [picking, setPicking] = useState(false);
  const [swapping, setSwapping] = useState(false);
  const [chosenSwap, setChosenSwap] = useState<string | null>(null);
  const [weight, setWeight] = useState<number | null>(null);
  const [reps, setReps] = useState<number | null>(null);

  /**
   * Clearing a level is worth marking, and worth marking *briefly*.
   *
   * A modal or an achievement card would cut the rhythm between exercises
   * dead — you would have to dismiss a congratulation before you could go and
   * do the next thing, which turns a good moment into an interruption. So:
   * haptics, and the movement wireframe glows in the accent colour for 400 ms.
   * It is over before you have finished putting the dumbbells down.
   */
  /**
   * The exercise being celebrated, held on screen for the length of the pulse.
   *
   * Without this the write lands first, `current` has already advanced, and
   * the glow appears on the wireframe of the exercise you have not started —
   * which reads as the app congratulating you for the wrong thing.
   */
  const [cleared, setCleared] = useState<{ exerciseId: string; caption: string } | null>(null);

  /**
   * Which exercises have already had their warm-up screen this session, by
   * workout-exercise id rather than exercise id — the same movement can
   * legitimately appear twice in one session, and the second time round you
   * are already warm.
   */
  const [warmedUp, setWarmedUp] = useState<string[]>([]);

  const clear = useSharedValue(0);
  const clearStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(clear.value, [0, 1], ['rgba(91, 228, 155, 0)', colors.accent]),
    backgroundColor: interpolateColor(clear.value, [0, 1], ['rgba(91, 228, 155, 0)', colors.accentSurface]),
  }));

  const celebrateLevel = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    clear.value = withSequence(
      withTiming(1, { duration: motion.duration.instant }),
      withTiming(0, { duration: LEVEL_PULSE_MS - motion.duration.instant }),
    );
  };

  // The hold releases itself; nothing to dismiss, which is the whole point.
  useEffect(() => {
    if (!cleared) return;
    const timer = setTimeout(() => setCleared(null), LEVEL_PULSE_MS);
    return () => clearTimeout(timer);
  }, [cleared]);

  // One ticking clock drives the rest countdown and the session timer.
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(interval);
  }, []);

  /**
   * The first set that has not been done, the exercise it belongs to, and where
   * that exercise sits among the ones still live — "exercise 2 of 5" is the
   * question people actually have mid-session, and counting skipped ones would
   * answer it wrongly.
   */
  const current = useMemo(() => {
    if (!session) return null;
    const live = session.exercises.filter((exercise) => !exercise.skipped);

    for (const [position, exercise] of live.entries()) {
      const index = exercise.sets.findIndex((entry) => !entry.completed);
      if (index >= 0) {
        return { exercise, set: exercise.sets[index], index, position, total: live.length };
      }
    }
    return null;
  }, [session]);

  const prescriptionReps = useMemo(() => {
    if (!current || !session) return 8;
    const routine = routines.find((entry) => entry.id === session.routineId);
    const day = routine?.days.find((entry) => entry.id === session.routineDayId);
    const planned = day?.exercises.find((entry) => entry.exerciseId === current.exercise.exerciseId);
    return planned?.repMin ?? 8;
  }, [current, session, routines]);

  /**
   * What the last time this exercise was trained looked like — and failing
   * that, what the assessment measured.
   *
   * Without the second half, the first session of every new movement opens
   * with no suggested weight at all, which is exactly the guesswork the
   * assessment exists to remove.
   */
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

    const measured = assessment?.results.find(
      (entry) => entry.exerciseId === current.exercise.exerciseId,
    );
    if (measured) {
      const load = startingLoad(
        measured,
        prescriptionReps,
        profile?.experience ?? 'returning',
        profile?.layoffWeeks ?? 0,
      );
      if (load) return { weightKg: load.weightKg, reps: load.reps };
    }

    return null;
  }, [current, session, sessions, assessment, profile, prescriptionReps]);

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

  // Which gym you are in decides which swaps are even possible.
  const equipment = gyms.find((entry) => entry.id === gymId)?.equipment ?? gyms[0]?.equipment ?? {};

  const progress = session ? sessionProgress(session, new Date(now)) : null;
  const levels = useMemo(() => (session ? sessionLevels(session) : null), [session]);
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

  // ---- Nothing laid out at all --------------------------------------------
  // A free session starts empty, and "no sets left" is not the same thing as
  // "you finished": congratulating someone who has not lifted anything is
  // worse than useless, and there is nothing here to save.
  if (sessionStage(progress) === 'empty') {
    return (
      <Screen scroll={false}>
        <View style={styles.centre}>
          <Text variant="display" style={styles.doneTitle}>
            Nothing in this session yet
          </Text>
          <Text variant="body" tone="secondary" style={styles.doneLine}>
            Pick the movements first, then come back here to be walked through them.
          </Text>
          <PrimaryButton label="Add an exercise" onPress={() => setPicking(true)} style={styles.doneCta} />
          <TextButton
            label="Use the list view"
            onPress={() => router.replace({ pathname: '/session', params: { id: session.id } })}
          />
        </View>

        <ExercisePicker
          visible={picking}
          onClose={() => setPicking(false)}
          onPick={(exerciseId) => addExerciseToSession(session.id, exerciseId)}
        />
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
    // A set that clears the level gets the level's celebration instead of the
    // ordinary one, rather than both firing on the same tap.
    if (levels?.lastOfLevel) {
      celebrateLevel();
      setCleared({
        exerciseId: current.exercise.exerciseId,
        caption: `Level ${levels.level} of ${levels.levelCount} cleared`,
      });
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }

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

  // One more set of what you are already doing. It lands after the last one,
  // so it becomes the next thing the screen puts in front of you.
  const addAnotherSet = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    addSet(session.id, current.exercise.id, { duplicateLast: true });
  };

  // ---- Level cleared -------------------------------------------------------
  // Four hundred milliseconds, then it moves on by itself. Deliberately not a
  // modal: an achievement card you have to dismiss turns the best moment of
  // the session into one more thing standing between you and the next lift.
  if (cleared) {
    const clearedMeta = getExercise(cleared.exerciseId);
    return (
      <Screen scroll={false}>
        <SessionBarTop session={session} progress={progress} onClose={() => router.back()} />

        <View style={styles.centre}>
          <Animated.View style={[styles.clearPulse, clearStyle]}>
            <MovementArt
              exerciseId={cleared.exerciseId}
              pattern={clearedMeta?.pattern ?? 'isolation'}
              equipment={clearedMeta?.equipment ?? []}
            />
          </Animated.View>

          <Text variant="heading" style={styles.clearText}>
            {cleared.caption}
          </Text>
        </View>

        {levels ? <WorkoutFooter levels={levels} /> : null}
      </Screen>
    );
  }

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

          {/* Rest is a suggestion, not a rule. The timer bends both ways. */}
          <View style={styles.restAdjust}>
            <TextButton
              label="−30s"
              onPress={() => {
                Haptics.selectionAsync();
                setRestUntil((value) => Math.max(Date.now(), (value ?? Date.now()) - 30_000));
              }}
            />
            <TextButton
              label="+30s"
              onPress={() => {
                Haptics.selectionAsync();
                setRestUntil((value) => (value ?? Date.now()) + 30_000);
              }}
            />
            <TextButton
              label="+2 min"
              onPress={() => {
                Haptics.selectionAsync();
                setRestUntil((value) => (value ?? Date.now()) + 120_000);
              }}
            />
          </View>
        </View>
      </Screen>
    );
  }

  // ---- Before the first set of a movement ---------------------------------
  /*
    The general warm-up got your temperature up and the ramp sets rehearse the
    pattern under load. Neither covers the middle: before a bench press you
    need to move shoulders, not ankles. Shown once per exercise, only when
    nothing in it has been logged yet, and skippable — a screen you cannot get
    past is one people learn to dread by the third exercise.
  */
  const needsWarmup =
    !warmedUp.includes(current.exercise.id) &&
    !current.exercise.sets.some((entry) => entry.completed) &&
    hasWarmup(current.exercise.exerciseId);

  if (needsWarmup) {
    const acknowledge = () => setWarmedUp((entries) => [...entries, current.exercise.id]);
    return (
      <Screen bottomInset={spacing.xxl}>
        <SessionBarTop session={session} progress={progress} onClose={() => router.back()} />

        <WarmupBrief
          exerciseId={current.exercise.exerciseId}
          onReady={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            acknowledge();
          }}
          onSkip={acknowledge}
        />

        {levels ? <WorkoutFooter levels={levels} /> : null}
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
          {/* Where there is a full turn rendered, the movement is something
              you can spin rather than something you look at. Tapping still
              opens the detail screen; the drag is handled before the press. */}
          {hasTurntable(current.exercise.exerciseId) ? (
            <Turntable exerciseId={current.exercise.exerciseId} />
          ) : (
            <MovementArt
              exerciseId={current.exercise.exerciseId}
              pattern={meta?.pattern ?? 'isolation'}
              equipment={meta?.equipment ?? []}
            />
          )}
        </Pressable>

        <Text variant="title" style={styles.name}>
          {exerciseName(current.exercise.exerciseId)}
        </Text>

        {/* The level you are on, and only its sublevels. How far through the
            whole workout you are lives at the foot of the screen. */}
        {levels ? <LevelTrack levels={levels} /> : null}

        {/* What the plan asks for, stated before you are asked to decide
            anything. The steppers below are there to disagree with it, not to
            be the only way to answer. */}
        <View style={styles.prescription}>
          <Icon name="target" size={13} color={colors.textTertiary} />
          <Text variant="caption" tone="secondary">
            {`Your plan: ${totalSets} × ${prescription.repMin}–${prescription.repMax} reps`}
          </Text>
        </View>

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

        {/*
          Everything you can do to the session without leaving it. A guided
          workout that can only be followed is a workout you abandon the moment
          the gym does not match the plan — the machine is taken, you have more
          in you, you want one more movement. All of it writes to the same
          session as the list view, so none of it is a special guided-mode
          record: it is just the session, edited.
        */}
        <View style={styles.secondary}>
          <TextButton label="One more set" onPress={addAnotherSet} />
          <TextButton label="Add exercise" onPress={() => setPicking(true)} />
          {/* The single most common reason a plan gets abandoned mid-session:
              the machine is taken and there is no obvious second choice. */}
          <TextButton label="Machine taken" onPress={() => setSwapping(true)} />
        </View>

        <View style={styles.secondary}>
          <TextButton label="Skip set" onPress={skipSet} />
          <TextButton label="Skip exercise" onPress={skipExercise} />
          <TextButton
            label={progress.isPaused ? 'Continue' : 'Pause'}
            onPress={() => (progress.isPaused ? resumeSession(session.id) : pauseSession(session.id))}
          />
        </View>

        {levels ? <WorkoutFooter levels={levels} /> : null}
      </Animated.View>

      <ExercisePicker
        visible={picking}
        onClose={() => setPicking(false)}
        onPick={(exerciseId) => addExerciseToSession(session.id, exerciseId)}
      />

      {/* Swaps that work the same muscle, with anything your gym does not have
          marked as such rather than quietly offered. */}
      {/*
        The most common reason a session gets abandoned: the machine is taken,
        or the gym never had it. Two answers, because they are different
        problems — a queue is today's problem, a gym that does not own the
        thing is every week's, and making someone re-swap every session until
        they give up is how a plan quietly dies.
      */}
      <BottomSheet
        visible={swapping}
        onClose={() => {
          setSwapping(false);
          setChosenSwap(null);
        }}
        title={chosenSwap ? 'For how long?' : 'Use something else'}
        subtitle={
          chosenSwap
            ? `${exerciseName(current.exercise.exerciseId)} → ${exerciseName(chosenSwap)}`
            : `Instead of ${exerciseName(current.exercise.exerciseId)}`
        }
      >
        {chosenSwap ? (
          <View style={styles.swapChoice}>
            <PrimaryButton
              label="Just for today"
              onPress={() => {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                substituteExercise(session.id, current.exercise.id, chosenSwap);
                setSwapping(false);
                setChosenSwap(null);
              }}
            />
            <Text variant="caption" tone="tertiary" style={styles.swapNote}>
              This session only. Next time the plan asks for the original again.
            </Text>

            <SecondaryButton
              label="Change it in my plan"
              onPress={() => {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                substituteExercise(session.id, current.exercise.id, chosenSwap);

                // The routine is what next week is built from, so a permanent
                // swap has to land there and not only on today's session.
                const routine = routines.find((entry) => entry.id === session.routineId);
                const day = routine?.days.find((entry) => entry.id === session.routineDayId);
                const planned = day?.exercises.find(
                  (entry) => entry.exerciseId === current.exercise.exerciseId,
                );
                if (day && planned) {
                  updateRoutineExercise(day.id, planned.id, { exerciseId: chosenSwap });
                }

                setSwapping(false);
                setChosenSwap(null);
              }}
              style={styles.swapForever}
            />
            <Text variant="caption" tone="tertiary" style={styles.swapNote}>
              From now on. Your history on the old movement stays where it is.
            </Text>

            <TextButton label="Back" onPress={() => setChosenSwap(null)} style={styles.swapBack} />
          </View>
        ) : (
          findSubstitutions(current.exercise.exerciseId, equipment).map((option) => (
            <Pressable
              key={option.exercise.id}
              onPress={() => {
                Haptics.selectionAsync();
                setChosenSwap(option.exercise.id);
              }}
              accessibilityRole="button"
              accessibilityLabel={option.exercise.name}
              style={({ pressed }) => [styles.swap, pressed && { opacity: opacity.pressed }]}
            >
              <View style={styles.swapText}>
                <Text variant="body">{option.exercise.name}</Text>
                <Text variant="caption" tone="tertiary">
                  {option.availableHere ? option.reason : `${option.reason} · not in your gym`}
                </Text>
              </View>
              {option.availableHere ? <Icon name="check" size={14} color={colors.accent} /> : null}
            </Pressable>
          ))
        )}
      </BottomSheet>
    </Screen>
  );
}

/**
 * The clock, whether the session is running, and a way out.
 *
 * It used to also draw one segment per working set of the entire session —
 * twenty-four slivers on a six-exercise day, nearly all of them about work
 * forty minutes away. That is now two separate things in the places they
 * belong: the sets of the current exercise sit under its name, and the whole
 * workout gets a single bar at the foot of the screen.
 */
function SessionBarTop({
  session,
  progress,
  onClose,
}: {
  session: { exercises: unknown[] };
  progress: ReturnType<typeof sessionProgress>;
  onClose: () => void;
}) {
  const beat = useLoop(motion.loop.heartbeat);
  const live = useAnimatedStyle(() => ({
    opacity: progress.isPaused ? 0.4 : 0.5 + Math.sin(beat.value * Math.PI) * 0.5,
  }));

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
  clearPulse: {
    borderRadius: radius.xl,
    borderWidth: borderWidth.hairline,
    padding: spacing.lg,
  },
  clearText: {
    marginTop: spacing.lg,
  },
  animation: {
    alignSelf: 'center',
  },
  name: {
    textAlign: 'center',
    marginTop: spacing.xl,
  },
  swap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  swapChoice: {
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  swapNote: {
    marginBottom: spacing.lg,
  },
  swapForever: {
    marginTop: spacing.sm,
  },
  swapBack: {
    alignSelf: 'center',
    marginTop: spacing.md,
  },
  swapText: {
    flex: 1,
    gap: spacing.xs,
  },
  prescription: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
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
  restAdjust: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xl,
    marginTop: spacing.lg,
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
