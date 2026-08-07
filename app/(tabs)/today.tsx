import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { BottomSheet } from '@/components/BottomSheet';
import { Reveal } from '@/components/motion/Reveal';
import { NavGroup, NavRow } from '@/components/NavRow';
import { Notice } from '@/components/Notice';
import { Screen } from '@/components/Screen';
import { Section } from '@/components/Section';
import { SegmentedControl } from '@/components/SegmentedControl';
import { SetupList } from '@/features/onboarding/NextStepCard';
import { Text } from '@/design-system/Text';
import { opacity, spacing } from '@/design-system/tokens';
import { exerciseName, findSubstitutions, getExercise } from '@/data/exercises';
import { estimateRoutineDayMinutes } from '@/data/routineTemplates';
import { attentionItems } from '@/domain/attention';
import { revertSuggestion } from '@/domain/plan/history';
import { replanWeek } from '@/domain/plan/week';
import { describeDay } from '@/domain/training/dayDescription';
import { stalls } from '@/domain/training/strength';
import { WeekStrip } from '@/features/plan/WeekStrip';
import { ExerciseRow } from '@/features/training/ExerciseRow';
import { SessionCard } from '@/features/training/SessionCard';
import { track } from '@/services/analytics/analytics';
import { useActiveSession, useEngine, useNextStep, useTodayCheckin } from '@/store/hooks';
import { useAppStore } from '@/store/useAppStore';
import { addDays, formatLongDate, greetingFor, startOfWeek, today as todayOf } from '@/utils/date';

/**
 * The home screen answers one question — what do I do now — and then shows the
 * work itself.
 *
 * This screen used to have a twin. There was a Today tab with a hero and a
 * Start button, and a Train tab with a hero and a Start button, and no way for
 * anyone opening the app for the first time to know which of the two was the
 * real one. Two tabs doing one job is not redundancy, it is a fork in the road
 * with no signpost, so they are one screen now: what today is, the body it
 * works, the exercises in order, and one button.
 *
 * Everything the engine noticed is ranked in `attention` and only the winner
 * appears. The rest are counted, never stacked — six equally-styled warnings
 * is a way of telling someone nothing at all.
 */
export default function TodayScreen() {
  const router = useRouter();
  const engine = useEngine();
  const checkin = useTodayCheckin();
  const activeSession = useActiveSession();

  const profile = useAppStore((state) => state.profile);
  const startSession = useAppStore((state) => state.startSession);
  const reschedulePlannedSession = useAppStore((state) => state.reschedulePlannedSession);
  const updateRoutineExercise = useAppStore((state) => state.updateRoutineExercise);
  const updateTraining = useAppStore((state) => state.updateTraining);
  const plannedSessions = useAppStore((state) => state.plannedSessions);

  const applied = useAppStore((state) => state.appliedProposals);
  const gyms = useAppStore((state) => state.gyms);
  const planHistory = useAppStore((state) => state.planHistory);
  const { setup } = useNextStep();
  const training = useAppStore((state) => state.training);
  const routines = useAppStore((state) => state.routines);
  const activeRoutineId = useAppStore((state) => state.activeRoutineId);
  const allSessions = useAppStore((state) => state.sessions);
  const weekStartsOn = useAppStore((state) => state.preferences.weekStartsOn);

  const [swapping, setSwapping] = useState<{ dayId: string; entryId: string; exerciseId: string } | null>(null);

  const date = todayOf();
  /** Guided runs one set at a time; the list assumes you know the movements. */
  const sessionScreen = training.guided ? '/guided' : '/session';

  const routine = routines.find((entry) => entry.id === activeRoutineId) ?? routines[0] ?? null;
  const gym = gyms.find((entry) => entry.id === training.gymId) ?? gyms[0] ?? null;
  const equipment = gym?.equipment ?? {};

  const { recommendation, adaptation, drift, routeProgress, verdict } = engine;
  const resting = recommendation.type === 'rest';
  const todayPlanned = plannedSessions.find((entry) => entry.date === date && entry.status === 'planned') ?? null;

  // The day you are about to do, and what is actually in it.
  const day = routine?.days.find((entry) => entry.id === recommendation.routineDayId) ?? null;
  const described = day ? describeDay(day) : null;

  // The week, rearranged around whatever has actually happened in it.
  const weekStart = startOfWeek(date, weekStartsOn);
  const weekPlan = replanWeek({
    today: date,
    weekStart,
    target: training.preferredDaysPerWeek,
    completedDates: allSessions
      .filter((entry) => entry.status === 'completed' && entry.date >= weekStart)
      .map((entry) => entry.date),
    preferredWeekdays: training.preferredWeekdays,
    routineDayIds: routine?.days.map((entry) => entry.id) ?? [],
  });

  // One thing, chosen once, in the domain rather than by stacking rows here.
  const notices = attentionItems({
    verdict,
    drift,
    nextBlock: routeProgress?.nextBlock
      ? { label: routeProgress.nextBlock.label, routeName: routeProgress.routeName }
      : null,
    proposals: engine.proposals,
    appliedProposals: applied,
    stalls: stalls(allSessions),
    revert: revertSuggestion(planHistory, allSessions, date),
    hasGym: gyms.length > 0,
    checkedInToday: checkin !== null,
    trainedToday: allSessions.some((entry) => entry.status === 'completed' && entry.date === date),
  });

  const begin = (intent: 'full' | 'reduced' | 'recovery' | 'free') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const id = startSession({
      routineId: recommendation.routineId,
      routineDayId: intent === 'free' ? null : recommendation.routineDayId,
      intent,
      name: intent === 'recovery' ? 'Recovery session' : intent === 'free' ? 'Free session' : recommendation.title,
      plannedSessionId: todayPlanned?.id ?? null,
    });
    track({ name: 'recommendation_followed', type: recommendation.type });
    router.push({ pathname: sessionScreen, params: { id } });
  };

  const intentFor = () => {
    if (recommendation.type === 'reduced') return 'reduced' as const;
    if (recommendation.type === 'recovery') return 'recovery' as const;
    if (recommendation.type === 'free') return 'free' as const;
    return 'full' as const;
  };

  // The one card at the top, in each of the three states it can be in.
  const card = activeSession
    ? {
        status: { label: 'Happening now', tone: 'info' as const },
        title: activeSession.name,
        line: 'You left this running. Pick it up where you stopped.',
        stats: [],
        action: {
          label: 'Carry on',
          onPress: () => router.push({ pathname: sessionScreen, params: { id: activeSession.id } }),
        },
      }
    : resting
      ? {
          status: { label: 'Rest day', tone: 'neutral' as const },
          title: 'Nothing today',
          line: 'Rest is when the work you already did turns into muscle. It is part of the plan, not a gap in it.',
          stats: [],
          action: { label: 'Train anyway', onPress: () => begin('free') },
        }
      : {
          status: { label: 'Today', tone: 'accent' as const },
          eyebrow: day?.name,
          title: described ? capitalise(described.muscles) : recommendation.title,
          line: described?.plain,
          stats: day
            ? [
                { value: `${estimateRoutineDayMinutes(day)}`, label: 'minutes' },
                { value: `${described?.exercises ?? day.exercises.length}`, label: 'exercises' },
                { value: `${described?.sets ?? 0}`, label: 'sets' },
              ]
            : [],
          setsByMuscle: described?.setsByMuscle,
          action: { label: 'Start', onPress: () => begin(intentFor()) },
          secondary: todayPlanned
            ? {
                label: 'Not today — move it',
                onPress: () => reschedulePlannedSession(todayPlanned.id, addDays(date, 1)),
              }
            : { label: 'Do something else', onPress: () => begin('free') },
        };

  /* While anything is still missing, the setup outranks the session: a
     recommendation built on data the app does not have is not worth pressing,
     and everything the engine noticed can wait behind it. */
  const settingUp = setup.length > 0;

  return (
    <Screen ambient>
      <Reveal index={0}>
        <View style={styles.header}>
          <Text variant="bodySmall" tone="tertiary">
            {`${greetingFor()}${profile?.name ? `, ${profile.name}` : ''} · ${formatLongDate(date)}`}
          </Text>
        </View>
      </Reveal>

      {settingUp ? (
        <Reveal index={1}>
          <SetupList steps={setup} onPress={(step) => router.push(step.route)} style={styles.setup} />
        </Reveal>
      ) : null}

      <Reveal index={settingUp ? 2 : 1}>
        <SessionCard {...card} />
      </Reveal>

      <Reveal index={settingUp ? 3 : 2}>
        <WeekStrip plan={weekPlan} onPress={() => router.push('/roadmap')} style={styles.week} />
      </Reveal>

      {/* One thing, never a column of them. */}
      {!settingUp && notices.length > 0 ? (
        <Reveal index={3}>
          <Notice
            item={notices[0]}
            more={notices.length - 1}
            onPress={() => router.push(notices[0].route)}
            onPressMore={() => router.push('/knows')}
            style={styles.notice}
          />
        </Reveal>
      ) : null}

      {/* The work itself, in order, with the muscle drawn beside each one. */}
      {day && !activeSession ? (
        <Reveal index={4}>
          <Section title="What you are doing" style={styles.section}>
            {day.exercises.map((entry) => {
              const exercise = getExercise(entry.exerciseId);
              if (!exercise) return null;
              const missing = exercise.equipment.some((item) => equipment[item] === 'unavailable');

              return (
                <ExerciseRow
                  key={entry.id}
                  exercise={exercise}
                  prescription={`${entry.sets} × ${entry.repMin}–${entry.repMax}`}
                  unavailable={missing}
                  onPress={() => router.push({ pathname: '/exercise/[id]', params: { id: exercise.id } })}
                  onSwap={() => setSwapping({ dayId: day.id, entryId: entry.id, exerciseId: exercise.id })}
                />
              );
            })}
          </Section>
        </Reveal>
      ) : null}

      {/* The choice belongs next to the exercises it changes, not above them —
          and nowhere at all on a day with no session to run. */}
      {day && !activeSession ? (
        <Reveal index={5}>
          <Section title="How the session runs" style={styles.section}>
            <SegmentedControl
              options={[
                { value: 'guided', label: 'Guided', detail: 'One set at a time' },
                { value: 'list', label: 'List', detail: 'Everything at once' },
              ]}
              value={training.guided ? 'guided' : 'list'}
              onChange={(value) => updateTraining({ guided: value === 'guided' })}
            />
          </Section>
        </Reveal>
      ) : null}

      <Reveal index={6}>
        <NavGroup>
          <NavRow
            label="Your gym"
            icon="gym"
            value={gym ? gym.name.split(' · ')[0] : 'Find one'}
            detail={gym ? undefined : 'So it only picks kit you have'}
            tone={gym ? 'neutral' : 'accent'}
            dot={!gym}
            onPress={() => router.push(gym ? '/gym' : '/gyms')}
          />
          <NavRow
            label="Why this session"
            icon="info"
            detail={adaptation.setDelta !== 0 ? adaptation.reason : 'What the app read to decide today'}
            onPress={() => router.push('/why')}
          />
          <NavRow label="Everything you have done" icon="journal" onPress={() => router.push('/history')} />
          <NavRow label="Look up an exercise" icon="search" onPress={() => router.push('/exercises')} />
        </NavGroup>
      </Reveal>

      <BottomSheet
        visible={swapping !== null}
        onClose={() => setSwapping(null)}
        title="Swap this out"
        subtitle={
          swapping ? `Instead of ${exerciseName(swapping.exerciseId)} — what your gym has comes first.` : undefined
        }
      >
        {(swapping ? findSubstitutions(swapping.exerciseId, equipment) : []).slice(0, 8).map((option) => (
          <Pressable
            key={option.exercise.id}
            onPress={() => {
              if (!swapping) return;
              updateRoutineExercise(swapping.dayId, swapping.entryId, { exerciseId: option.exercise.id });
              setSwapping(null);
            }}
            style={({ pressed }) => [pressed && { opacity: opacity.pressed }]}
          >
            <ExerciseRow exercise={option.exercise} detail={option.reason} unavailable={!option.availableHere} />
          </Pressable>
        ))}
      </BottomSheet>
    </Screen>
  );
}

function capitalise(value: string): string {
  return value.length === 0 ? value : value[0].toUpperCase() + value.slice(1);
}

const styles = StyleSheet.create({
  header: {
    marginBottom: spacing.xl,
  },
  setup: {
    marginBottom: spacing.xl,
  },
  week: {
    marginTop: spacing.lg,
  },
  notice: {
    marginTop: spacing.lg,
  },
  section: {
    marginTop: spacing.xxl,
    marginBottom: spacing.lg,
  },
});
