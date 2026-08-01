import { buildObservedBaseline, calculateComebackProgress, type ComebackResult } from './comeback/calculateComebackProgress';
import { comebackConfig, momentumConfig } from './config';
import {
  calculateMomentumScore,
  momentumState,
  type MomentumResult,
} from './momentum/calculateMomentum';
import type { PlannedOutcome, ReadinessPoint, SessionSummary } from './momentum/components';
import {
  calculateReadiness,
  scoreCheckin,
  type ReadinessResult,
} from './readiness/calculateReadiness';
import { calculateFuel, type FuelResult, type NutritionPoint } from './fuel/calculateFuel';
import { buildNudges, type Nudge, type WeatherSnapshot } from './nudges/nudges';
import {
  generateDailyRecommendation,
  type RecommendationResult,
} from './recommendations/generateDailyRecommendation';
import { deriveObservations, type Observations } from './inference/observations';
import { deriveProposals, deriveReminder, type Proposal } from './inference/proposals';
import { adaptToday, type DailyAdaptation } from './training/adaptation';
import { volumeBreakdown, type MuscleVolume } from './training/volume';
import { bestE1rmByExercise, sessionSetCount, sessionVolume } from './training/metrics';
import { sessionMechanics, wasReduced } from './training/sessionMetrics';
import { evaluateCommitments, requiredSessionsPerWeek, type Commitment } from './plan/commitments';
import { observedWeeklyRate } from './plan/observedRate';
import { buildRamp, currentRampTarget, observedSessionsPerWeek, type Ramp } from './plan/ramp';
import { judgePlan, type PlanVerdict } from './plan/verdict';
import { buildPhases, type PlanPhaseView } from './plan/phases';
import { currentBlock, resolveRoute, simulateRoute, type FollowedRoute } from './plan/routes';
import { projectPlan, type PlanProjection, type ProjectionInput } from './plan/projection';
import { estimateTargetDateImpact, type TrajectoryResult } from './trajectory/estimateTargetDate';
import type {
  BodyMeasurement,
  NutritionStrategy,
  ComebackBaseline,
  DailyCheckin,
  Goal,
  ISODate,
  MomentumSnapshot,
  PlannedSession,
  Profile,
  Routine,
  TrainingPreferences,
  WorkoutSession,
} from './types';
import { addDays, daysBetween, nowISO, startOfWeek } from '@/utils/date';
import { createId } from '@/utils/id';
import { mean, round } from '@/utils/math';

/** Longest history the daily momentum series is rebuilt over. */
const MAX_SERIES_DAYS = 180;

export type EngineInput = {
  today: ISODate;
  sessions: WorkoutSession[];
  plannedSessions: PlannedSession[];
  checkins: DailyCheckin[];
  training: TrainingPreferences;
  routines: Routine[];
  activeRoutineId: string | null;
  goal: Goal | null;
  profile: Profile | null;
  /** A named route, or one the user built (which carries its own blocks). */
  planRoute: (FollowedRoute & { startedAt: ISODate }) | null;
  bodyMeasurements: BodyMeasurement[];
  baseline: ComebackBaseline | null;
  weekStartsOn: 0 | 1;
  /** Only needed to notice that the user rests differently than the default. */
  defaultRestSeconds: number;
  /** Daily totals imported from MIKUY through Apple Health. */
  nutrition: NutritionPoint[];
  /** Local hour, 0–23. Decides which nudges are still actionable. */
  hour: number;
  /** Null unless the user turned weather on and it could be read. */
  weather: WeatherSnapshot | null;
  enabledHabits: string[];
  /** Hour the user usually wakes, for the bedtime arithmetic. */
  wakeHour: number;
};

export type WeekSummary = {
  start: ISODate;
  completed: number;
  planned: number;
  target: number;
  days: { date: ISODate; state: 'completed' | 'planned' | 'missed' | 'rest' | 'today' }[];
};

export type EngineResult = {
  momentumSeries: MomentumSnapshot[];
  momentum: MomentumSnapshot | null;
  /** Change over the last 7 snapshots, used for the trend and the state. */
  momentumDelta7: number | null;
  momentumDelta28: number | null;
  readiness: ReadinessResult;
  /** What today has to draw on: nutrition, sleep and accumulated load. */
  fuel: FuelResult;
  /** Ranked, time-aware prompts. Screens show the first. */
  nudges: Nudge[];
  recommendation: RecommendationResult;
  comeback: ComebackResult;
  /** Set when the engine established a baseline that should be persisted. */
  derivedBaseline: ComebackBaseline | null;
  trajectory: TrajectoryResult | null;
  /** Where the current strategy leads: date, sessions, composition. */
  projection: PlanProjection | null;
  /** The exact input behind it, so screens can re-project other strategies. */
  projectionInput: ProjectionInput | null;
  /** Share of planned sessions completed over the last four weeks, 0–1. */
  adherenceRate: number;
  /** How today's session should differ from the plan. */
  adaptation: DailyAdaptation;
  /** Plain-language read on whether the goal date is drifting. */
  drift: { days: number; headline: string; detail: string } | null;
  /** Progress through a multi-block route, when one is being followed. */
  routeProgress: {
    routeName: string;
    blockLabel: string;
    blockIndex: number;
    weeksIntoBlock: number;
    weeksLeftInBlock: number;
    /** Set when the block's time is up and the next one should take over. */
    nextBlock: { label: string; strategy: NutritionStrategy } | null;
    finished: boolean;
  } | null;
  week: WeekSummary;
  lastSession: WorkoutSession | null;
  daysSinceLastSession: number | null;
  nextPlanned: PlannedSession | null;
  /** What the app has worked out about the user without asking. */
  observations: Observations;
  /** Changes those observations justify, for the store to apply. */
  proposals: Proposal[];
  /** When to nudge, derived from when they actually train. */
  reminder: ReturnType<typeof deriveReminder>;
  /** Weekly sets per muscle against the productive range. */
  volume: MuscleVolume[];
  /** What the chosen plan requires, and whether it is being done. */
  commitments: Commitment[];
  /** The climb from the user's current frequency to the plan's requirement. */
  ramp: Ramp;
  /** Sessions this week asks for — the ramp step, not always the full target. */
  weeklyTarget: number;
  /** Whether the plan being followed is the plan that was chosen. */
  verdict: PlanVerdict;
  /** The road ahead, cut into named stretches with what each one does to you. */
  phases: PlanPhaseView[];
};

function completedSessions(sessions: WorkoutSession[]): WorkoutSession[] {
  return sessions
    .filter((session) => session.status === 'completed')
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

export function toSessionSummary(session: WorkoutSession): SessionSummary {
  return {
    id: session.id,
    date: session.date,
    volumeKg: sessionVolume(session),
    setCount: sessionSetCount(session),
    e1rmByExercise: bestE1rmByExercise([session]),
  };
}

function toPlannedOutcomes(
  planned: PlannedSession[],
  sessions: WorkoutSession[],
  routines: Routine[],
): PlannedOutcome[] {
  const sessionById = new Map(sessions.map((session) => [session.id, session]));
  const plannedSetsByDay = new Map<string, number>();
  for (const routine of routines) {
    for (const day of routine.days) {
      plannedSetsByDay.set(day.id, day.exercises.reduce((total, exercise) => total + exercise.sets, 0));
    }
  }

  return planned.map((entry) => {
    const session = entry.sessionId ? sessionById.get(entry.sessionId) : undefined;
    if (!session) return { date: entry.date, status: entry.status };

    // A session where most of the laid-out work never happened earns the same
    // credit as one that was deliberately shortened, not a full one.
    const mechanics = sessionMechanics(session, plannedSetsByDay.get(entry.routineDayId ?? '') ?? null);
    const intent = session.intent === 'full' && wasReduced(mechanics) ? 'reduced' : session.intent;
    return { date: entry.date, status: entry.status, intent };
  });
}

function toReadinessPoints(checkins: DailyCheckin[]): ReadinessPoint[] {
  return checkins.map((checkin) => ({ date: checkin.date, score: scoreCheckin(checkin) }));
}

/**
 * Rebuilds the whole momentum series day by day, from the first day with data
 * up to today. Rebuilding rather than incrementally updating means the score is
 * always a pure function of the logged data — no drift, no stale snapshots —
 * and it is what makes inactivity decay accrue one day at a time.
 */
export function buildMomentumSeries(input: EngineInput): MomentumSnapshot[] {
  const sessions = completedSessions(input.sessions);
  const summaries = sessions.map(toSessionSummary);
  const outcomes = toPlannedOutcomes(input.plannedSessions, input.sessions, input.routines);
  const readiness = toReadinessPoints(input.checkins);

  const firstDates = [
    summaries[0]?.date,
    [...outcomes].sort((a, b) => (a.date < b.date ? -1 : 1))[0]?.date,
    [...readiness].sort((a, b) => (a.date < b.date ? -1 : 1))[0]?.date,
  ].filter((date): date is ISODate => Boolean(date));

  if (firstDates.length === 0) return [];

  const earliest = firstDates.sort()[0];
  const span = Math.min(MAX_SERIES_DAYS, Math.max(1, daysBetween(earliest, input.today) + 1));
  const start = addDays(input.today, -(span - 1));

  const series: MomentumSnapshot[] = [];
  let previousScore: number | null = null;

  for (let offset = 0; offset < span; offset += 1) {
    const date = addDays(start, offset);
    const result: MomentumResult = calculateMomentumScore({
      date,
      planned: outcomes,
      sessions: summaries,
      readiness,
      targetSessionsPerWeek: input.training.preferredDaysPerWeek,
      previousScore,
    });

    series.push({
      id: `momentum-${date}`,
      date,
      score: result.score,
      previousScore: result.previousScore,
      delta: result.delta,
      state: result.state,
      components: result.components,
      confidence: result.confidence,
      factors: result.factors,
      explanation: result.explanation,
      createdAt: nowISO(),
    });

    previousScore = result.score;
  }

  return series;
}

function weekSummary(input: EngineInput, sessions: WorkoutSession[], target: number): WeekSummary {
  const start = startOfWeek(input.today, input.weekStartsOn);
  const days = Array.from({ length: 7 }, (_, index) => addDays(start, index));

  const completedDates = new Set(sessions.map((session) => session.date));
  const plannedByDate = new Map(input.plannedSessions.map((entry) => [entry.date, entry]));

  return {
    start,
    completed: days.filter((date) => completedDates.has(date)).length,
    planned: days.filter((date) => plannedByDate.get(date)?.status === 'planned').length,
    target,
    days: days.map((date) => {
      if (completedDates.has(date)) return { date, state: 'completed' as const };
      const planned = plannedByDate.get(date);
      if (date === input.today) return { date, state: 'today' as const };
      if (!planned) return { date, state: 'rest' as const };
      if (planned.status === 'skipped') return { date, state: 'missed' as const };
      if (planned.status === 'planned' && date < input.today) return { date, state: 'missed' as const };
      if (planned.status === 'rest') return { date, state: 'rest' as const };
      return { date, state: 'planned' as const };
    }),
  };
}

function consecutiveTrainingDays(sessions: WorkoutSession[], today: ISODate): number {
  const dates = new Set(sessions.map((session) => session.date));
  let count = 0;
  let cursor = addDays(today, -1);
  while (dates.has(cursor) && count < 14) {
    count += 1;
    cursor = addDays(cursor, -1);
  }
  if (dates.has(today)) count += 1;
  return count;
}

function routineDayInfo(input: EngineInput, routineDayId: string | null) {
  if (!routineDayId) return null;
  for (const routine of input.routines) {
    const day = routine.days.find((entry) => entry.id === routineDayId);
    if (day) return { routine, day };
  }
  return null;
}

/**
 * One pass over the user's data producing everything the screens read:
 * momentum, readiness, today's recommendation, Comeback Progress, the target
 * date and this week's state. Pure — same input, same output.
 */
export function runEngine(input: EngineInput): EngineResult {
  const sessions = completedSessions(input.sessions);
  const summaries = sessions.map(toSessionSummary);

  const momentumSeries = buildMomentumSeries(input);
  const momentumRaw = momentumSeries[momentumSeries.length - 1] ?? null;

  const scoreAt = (offset: number) => momentumSeries[momentumSeries.length - 1 - offset]?.score ?? null;
  const current = momentumRaw?.score ?? null;
  const momentumDelta7 =
    current !== null && scoreAt(7) !== null ? round(current - (scoreAt(7) as number), 1) : null;
  const momentumDelta28 =
    current !== null && scoreAt(28) !== null ? round(current - (scoreAt(28) as number), 1) : null;

  // With history available, the state uses the weekly trend rather than the
  // single-day delta, so "Recovering" reflects a real climb.
  const momentum: MomentumSnapshot | null = momentumRaw
    ? { ...momentumRaw, state: momentumState(momentumRaw.score, momentumDelta7 ?? momentumRaw.delta) }
    : null;

  const sortedCheckins = [...input.checkins].sort((a, b) => (a.date < b.date ? -1 : 1));
  const todayCheckin = sortedCheckins.find((checkin) => checkin.date === input.today) ?? null;
  const readiness = calculateReadiness(
    todayCheckin,
    sortedCheckins.filter((checkin) => checkin.date < input.today),
  );

  const lastSession = sessions[sessions.length - 1] ?? null;
  const daysSinceLastSession = lastSession ? daysBetween(lastSession.date, input.today) : null;

  // What the chosen plan demands, and the climb towards it. The ramp starts
  // from what the user measurably does; only with no history at all does it
  // fall back to what they said they would do.
  const requiredSessions = input.goal
    ? requiredSessionsPerWeek(input.goal.objective, input.goal.speed)
    : input.training.preferredDaysPerWeek;

  const ramp = buildRamp({
    today: input.today,
    targetDays: requiredSessions,
    startDays: observedSessionsPerWeek(input.sessions, input.today) ?? input.training.preferredDaysPerWeek,
    weekStartsOn: input.weekStartsOn,
  });
  const weeklyTarget = currentRampTarget(ramp, input.today, input.weekStartsOn);

  const week = weekSummary(input, sessions, weeklyTarget);

  const todayPlanned = input.plannedSessions.find((entry) => entry.date === input.today) ?? null;
  const todayInfo = routineDayInfo(input, todayPlanned?.routineDayId ?? null);

  const missedThisWeek = input.plannedSessions
    .filter(
      (entry) =>
        entry.date >= week.start &&
        entry.date < input.today &&
        (entry.status === 'planned' || entry.status === 'skipped'),
    )
    .map((entry) => {
      const info = routineDayInfo(input, entry.routineDayId);
      return {
        routineId: info?.routine.id ?? null,
        routineDayId: entry.routineDayId,
        name: info?.day.name ?? 'Missed session',
        estimatedMinutes: input.training.sessionMinutes,
        date: entry.date,
      };
    });

  const recommendation = generateDailyRecommendation({
    date: input.today,
    planned:
      todayPlanned && todayPlanned.status !== 'rest' && todayPlanned.status !== 'completed' && todayInfo
        ? {
            routineId: todayInfo.routine.id,
            routineDayId: todayInfo.day.id,
            name: todayInfo.day.name,
            estimatedMinutes: input.training.sessionMinutes,
          }
        : null,
    isPlannedRestDay: !todayPlanned || todayPlanned.status === 'rest',
    missedThisWeek,
    readiness: readiness.score,
    readinessVsBaseline: readiness.vsBaseline,
    daysSinceLastSession,
    consecutiveTrainingDays: consecutiveTrainingDays(sessions, input.today),
    sessionsThisWeek: week.completed,
    targetSessionsPerWeek: weeklyTarget,
    momentumScore: momentum?.score ?? null,
    dataConfidence: momentum?.confidence ?? 'low',
  });

  // Comeback baseline: measured from the first sessions the user logs, so a
  // returning athlete with no history still gets an honest reference point.
  const baselineSample = summaries.slice(0, comebackConfig.baselineSessions);
  const derivedBaseline =
    input.baseline ??
    buildObservedBaseline(
      {
        e1rmByExercise: bestE1rmByExercise(sessions.slice(0, comebackConfig.baselineSessions)),
        weeklyVolumeKg: round(mean(baselineSample.map((entry) => entry.volumeKg)) * input.training.preferredDaysPerWeek, 0),
        weeklySessions: input.training.preferredDaysPerWeek,
        sessionCount: baselineSample.length,
      },
      baselineSample[baselineSample.length - 1]?.date ?? input.today,
      createId(),
    );

  const recentWindow = 28;
  const recentSessions = sessions.filter(
    (session) => daysBetween(session.date, input.today) < recentWindow,
  );
  const recentWeeks = recentWindow / 7;
  const comeback = calculateComebackProgress({
    baseline: input.baseline ?? derivedBaseline,
    currentE1rmByExercise: bestE1rmByExercise(recentSessions),
    currentWeeklyVolumeKg: round(
      recentSessions.reduce((total, session) => total + sessionVolume(session), 0) / recentWeeks,
      0,
    ),
    currentWeeklySessions: round(recentSessions.length / recentWeeks, 2),
    sessionsSinceBaseline: Math.max(0, sessions.length - comebackConfig.baselineSessions),
  });

  const firstSessionDate = sessions[0]?.date ?? null;
  const weeksOfHistory = firstSessionDate
    ? Math.max(0, Math.floor(daysBetween(firstSessionDate, input.today) / 7))
    : 0;

  const trajectory = input.goal
    ? estimateTargetDateImpact({
        today: input.today,
        goalStartedAt: input.goal.startedAt,
        horizonWeeks: input.goal.horizonWeeks,
        targetSessionsPerWeek: input.training.preferredDaysPerWeek,
        completedSessions: sessions.filter((session) => session.date >= (input.goal as Goal).startedAt).length,
        recentWeeklyRate: round(recentSessions.length / recentWeeks, 2),
        weeksOfHistory,
      })
    : null;

  const nextPlanned =
    input.plannedSessions
      .filter((entry) => entry.date >= input.today && entry.status === 'planned')
      .sort((a, b) => (a.date < b.date ? -1 : 1))[0] ?? null;

  // Adherence over the last four weeks, used to slow the projection for
  // someone who is not actually training as often as the plan assumes.
  const recentPlanned = input.plannedSessions.filter((entry) => {
    const age = daysBetween(entry.date, input.today);
    return age > 0 && age <= 28 && entry.status !== 'rest';
  });
  const adherenceRate =
    recentPlanned.length === 0
      ? 1
      : round(
          recentPlanned.filter((entry) => entry.status === 'completed').length / recentPlanned.length,
          2,
        );

  const latestWeight = [...input.bodyMeasurements].sort((a, b) => (a.date < b.date ? -1 : 1)).pop() ?? null;
  const rate = observedWeeklyRate(input.bodyMeasurements, input.today);

  const projectionInput: ProjectionInput | null =
    input.goal && input.profile && latestWeight
      ? {
          today: input.today,
          strategy: input.goal.strategy,
          experience: input.profile.experience,
          currentWeightKg: latestWeight.weightKg,
          heightCm: input.profile.heightCm,
          // Age and sex only affect the calorie estimate; assumed when unset.
          age: input.profile.age ?? 30,
          sex: input.profile.sex,
          targetWeightKg: input.goal.targetWeightKg,
          sessionsPerWeek: input.training.preferredDaysPerWeek,
          sessionsCompleted: sessions.filter((session) => session.date >= (input.goal as Goal).startedAt).length,
          goalStartedAt: input.goal.startedAt,
          observedWeeklyRateKg: rate.weeklyKg,
          weeksOfWeightData: rate.weeks,
          adherence: adherenceRate,
        }
      : null;

  const projection = projectionInput ? projectPlan(projectionInput) : null;

  const adaptation = adaptToday({
    momentum: momentum?.score ?? null,
    readiness: readiness.score,
    readinessVsBaseline: readiness.vsBaseline,
    sessionsThisWeek: week.completed,
    targetSessionsPerWeek: weeklyTarget,
    missedThisWeek: missedThisWeek.length,
    daysSinceLastSession,
  });

  const drift = buildDrift(trajectory);
  const routeProgress = buildRouteProgress(input);

  // What the app noticed on its own, and what it wants to do about it.
  const activeRoutine = activeRoutineOf(input.routines, input.activeRoutineId);
  const observations = deriveObservations({
    sessions: input.sessions,
    routine: activeRoutine,
    checkins: input.checkins,
    measurements: input.bodyMeasurements,
    today: input.today,
  });
  const proposals = deriveProposals({
    observations,
    training: input.training,
    preferences: { units: 'metric', defaultRestSeconds: input.defaultRestSeconds, weekStartsOn: input.weekStartsOn },
  });

  const commitments = evaluateCommitments({
    today: input.today,
    sessions: input.sessions,
    checkins: input.checkins,
    requiredSessions,
    requiredKcal: projection?.targetKcal ?? 0,
    requiredProteinG: projection?.proteinTargetG[0] ?? 0,
  });

  /**
   * The route walked week by week, when one is being followed. Needed for the
   * phases; `routeProgress` only says which block you are in.
   */
  const routeSimulation =
    input.planRoute && input.profile && latestWeight
      ? (() => {
          const route = resolveRoute(input.planRoute);
          return route
            ? simulateRoute(
                {
                  today: input.today,
                  currentWeightKg: latestWeight.weightKg,
                  heightCm: input.profile.heightCm,
                  age: input.profile.age ?? 30,
                  sex: input.profile.sex,
                  experience: input.profile.experience,
                  bodyFatPercent: latestWeight.bodyFatPercent,
                  sessionsPerWeek: weeklyTarget,
                },
                route,
              )
            : null;
        })()
      : null;

  const phases = buildPhases({
    today: input.today,
    sessions: input.sessions,
    simulation: routeSimulation,
    fallback:
      projection && projection.targetDate && input.goal
        ? {
            startsOn: input.today,
            endsOn: projection.targetDate,
            strategy: input.goal.strategy,
            totalWeightChangeKg: projection.targetWeightKg
              ? projection.targetWeightKg - latestWeight!.weightKg
              : 0,
            leanChangeKg: projection.leanChangeKg ?? 0,
            fatChangeKg: projection.fatChangeKg ?? 0,
            kcal: projection.targetKcal,
          }
        : null,
  });

  // Fuel and the nudges both need the same readiness series momentum reads, so
  // the three never disagree about the state of the last week.
  const readinessPoints = toReadinessPoints(input.checkins);

  const fuel = calculateFuel({
    date: input.today,
    nutrition: input.nutrition,
    // The plan's own targets, so "on target" means the plan's definition of it.
    calorieTargetKcal: projection?.targetKcal ?? null,
    // The range's lower bound: the floor that has to be cleared, not the ceiling.
    proteinTargetG: input.goal?.proteinTargetG ?? projection?.proteinTargetG[0] ?? null,
    checkin: todayCheckin,
    readiness: readinessPoints,
  });

  const nudges = buildNudges({
    date: input.today,
    hour: input.hour,
    checkins: input.checkins,
    plannedToday: todayPlanned,
    trainedToday: sessions.some((session) => session.date === input.today),
    momentumScore: momentum?.score ?? null,
    momentumState: momentum?.state ?? null,
    fuelScore: fuel.score,
    weather: input.weather,
    enabledHabits: input.enabledHabits,
    wakeHour: input.wakeHour,
  });

  const verdict = judgePlan({
    today: input.today,
    sessions: input.sessions,
    commitments,
    currentTarget: weeklyTarget,
    requiredSessions,
    speed: input.goal?.speed ?? 'steady',
    momentum: momentum?.score ?? null,
    readinessVsBaseline: readiness.vsBaseline,
  });

  return {
    momentumSeries,
    momentum,
    momentumDelta7,
    momentumDelta28,
    readiness,
    fuel,
    nudges,
    recommendation,
    comeback,
    derivedBaseline: input.baseline ? null : derivedBaseline,
    trajectory,
    projection,
    projectionInput,
    adherenceRate,
    adaptation,
    drift,
    routeProgress,
    week,
    lastSession,
    daysSinceLastSession,
    nextPlanned,
    observations,
    proposals,
    reminder: deriveReminder(observations),
    volume: volumeBreakdown(activeRoutine, input.goal?.muscleFocus ?? []),
    commitments,
    ramp,
    weeklyTarget,
    verdict,
    phases,
  };
}

/**
 * Where the user is inside a multi-block route, and whether the block they are
 * in has run its course. The switch is never made silently — the app offers it
 * and the user takes it.
 */
function buildRouteProgress(input: EngineInput): EngineResult['routeProgress'] {
  if (!input.planRoute) return null;
  const route = resolveRoute(input.planRoute);
  if (!route) return null;

  const weeksElapsed = Math.floor(daysBetween(input.planRoute.startedAt, input.today) / 7);
  const position = currentBlock(route, weeksElapsed);

  if (!position) {
    const last = route.blocks[route.blocks.length - 1];
    return {
      routeName: route.name,
      blockLabel: last.label,
      blockIndex: route.blocks.length - 1,
      weeksIntoBlock: last.weeks,
      weeksLeftInBlock: 0,
      nextBlock: null,
      finished: true,
    };
  }

  const dueStrategy = position.block.strategy;
  const running = input.goal?.strategy;

  return {
    routeName: route.name,
    blockLabel: position.block.label,
    blockIndex: position.index,
    weeksIntoBlock: position.weeksIntoBlock,
    weeksLeftInBlock: position.block.weeks - position.weeksIntoBlock,
    nextBlock:
      running && running !== dueStrategy
        ? { label: position.block.label, strategy: dueStrategy }
        : null,
    finished: false,
  };
}

/**
 * Turns the raw drift number into something a person can act on. Losing pace is
 * not the same as losing progress, and the copy has to say so — that difference
 * is the whole reason someone keeps going after a bad week.
 */
function buildDrift(trajectory: TrajectoryResult | null): EngineResult['drift'] {
  if (!trajectory || trajectory.driftDays === 0) return null;

  if (trajectory.driftDays > 0) {
    return {
      days: trajectory.driftDays,
      headline: `Target moved ${trajectory.driftDays} day${trajectory.driftDays === 1 ? '' : 's'} later`,
      detail:
        trajectory.recoverableDays > 0
          ? `You have not lost the work you did — only the pace. Three weeks at your target frequency pulls about ${trajectory.recoverableDays} days back.`
          : 'You have not lost the work you did — only the pace.',
    };
  }

  return {
    days: trajectory.driftDays,
    headline: `Target moved ${Math.abs(trajectory.driftDays)} day${trajectory.driftDays === -1 ? '' : 's'} earlier`,
    detail: 'You are ahead of the pace the plan assumed.',
  };
}

export { momentumConfig };
export type { MomentumResult, RecommendationResult, ComebackResult, TrajectoryResult, ReadinessResult };
export { activeRoutineOf };

function activeRoutineOf(routines: Routine[], activeRoutineId: string | null): Routine | null {
  return routines.find((routine) => routine.id === activeRoutineId) ?? routines[0] ?? null;
}
