import type {
  BodyMeasurement,
  Confidence,
  DailyCheckin,
  ISODate,
  MuscleGroup,
  Routine,
  WorkoutSession,
} from '@/domain/types';
import { getExercise } from '@/data/exercises';
import { sessionMechanics } from '@/domain/training/sessionMetrics';
import { daysBetween, isWithinDays, weekdayLabel, weekdayOf } from '@/utils/date';
import { mean, round } from '@/utils/math';

/**
 * What the app can work out on its own.
 *
 * Everything here is derived from things the user was going to do anyway —
 * starting a session, ticking a set, standing on a scale. Nothing is a setting
 * anyone has to fill in. The point is that the fewer questions the app asks,
 * the more it has to notice.
 *
 * Two rules hold throughout:
 *  · An observation with too few data points reports null, not a guess. Three
 *    sessions is not a habit.
 *  · Every observation carries what it is based on, so the app can say "you
 *    train around 18:30, from your last 9 sessions" instead of asserting it.
 */

export type ObservationId =
  | 'training_time'
  | 'training_days'
  | 'session_length'
  | 'rest_length'
  | 'best_weekday'
  | 'muscle_emphasis'
  | 'finishing'
  | 'avoided_exercises'
  | 'progression'
  | 'weigh_in'
  | 'drop_off_risk';

export type Observation = {
  id: ObservationId;
  /** Two or three words. */
  label: string;
  /** The finding, already phrased for display. Null when not known yet. */
  display: string | null;
  confidence: Confidence;
  /** How many data points it rests on. */
  sampleSize: number;
  /** What the app does with it. Empty when it is not acting on it yet. */
  used: string | null;
};

/** Below this many observations nothing is claimed at all. */
const MIN_SAMPLE = 3;
/** At or above this, an observation is treated as settled. */
const STRONG_SAMPLE = 8;

function confidenceFor(sampleSize: number): Confidence {
  if (sampleSize >= STRONG_SAMPLE) return 'high';
  if (sampleSize >= MIN_SAMPLE + 2) return 'medium';
  return 'low';
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

// ---------------------------------------------------------------------------
// When you train

export type TimeOfDay = {
  /** Local hour, 0–23. */
  hour: number;
  minute: number;
  /** How much the start time varies, in minutes. Small = a real routine. */
  spreadMinutes: number;
  sampleSize: number;
};

/**
 * The hour you usually start.
 *
 * Averaged around the clock rather than on a number line, so someone who
 * trains at 23:00 and 01:00 gets midnight instead of noon.
 */
export function inferTrainingTime(sessions: WorkoutSession[]): TimeOfDay | null {
  const stamps = sessions
    .filter((session) => session.status === 'completed')
    .map((session) => new Date(session.startedAt))
    .filter((date) => !Number.isNaN(date.getTime()));

  if (stamps.length < MIN_SAMPLE) return null;

  const angles = stamps.map((date) => ((date.getHours() * 60 + date.getMinutes()) / 1440) * 2 * Math.PI);
  const x = mean(angles.map(Math.cos));
  const y = mean(angles.map(Math.sin));

  const angle = Math.atan2(y, x);
  const normalised = angle < 0 ? angle + 2 * Math.PI : angle;
  const minutesOfDay = Math.round((normalised / (2 * Math.PI)) * 1440) % 1440;

  // Resultant length: 1 = identical every time, 0 = spread over the whole day.
  const resultant = Math.sqrt(x * x + y * y);
  const circularSd = resultant > 0 ? Math.sqrt(-2 * Math.log(resultant)) : Math.PI;
  const spreadMinutes = Math.round((circularSd / (2 * Math.PI)) * 1440);

  return {
    hour: Math.floor(minutesOfDay / 60),
    minute: minutesOfDay % 60,
    spreadMinutes,
    sampleSize: stamps.length,
  };
}

export function formatTimeOfDay(time: TimeOfDay): string {
  return `${`${time.hour}`.padStart(2, '0')}:${`${time.minute}`.padStart(2, '0')}`;
}

export type WeekdayHabit = {
  /** Weekdays used at least a quarter of the time, most frequent first. */
  weekdays: number[];
  /** Share of sessions falling on those days, 0–1. */
  concentration: number;
  sampleSize: number;
};

/** The days you actually turn up on, which is not always the days you picked. */
export function inferTrainingWeekdays(sessions: WorkoutSession[]): WeekdayHabit | null {
  const completed = sessions.filter((session) => session.status === 'completed');
  if (completed.length < MIN_SAMPLE) return null;

  const counts = new Map<number, number>();
  for (const session of completed) {
    const weekday = weekdayOf(session.date);
    counts.set(weekday, (counts.get(weekday) ?? 0) + 1);
  }

  const threshold = completed.length * 0.2;
  const weekdays = [...counts.entries()]
    .filter(([, count]) => count >= threshold)
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .map(([weekday]) => weekday);

  const covered = weekdays.reduce((total, weekday) => total + (counts.get(weekday) ?? 0), 0);

  return {
    weekdays: [...weekdays].sort((a, b) => a - b),
    concentration: round(covered / completed.length, 2),
    sampleSize: completed.length,
  };
}

/** How long a session actually takes you, as opposed to the estimate. */
export function inferSessionLength(sessions: WorkoutSession[]): number | null {
  const durations = sessions
    .filter((session) => session.status === 'completed')
    .map((session) => sessionMechanics(session).durationMinutes)
    .filter((value): value is number => value !== null && value > 5 && value < 240);

  if (durations.length < MIN_SAMPLE) return null;
  return Math.round(median(durations) as number);
}

/** How long you actually rest, which decides how long the app says a session takes. */
export function inferRestSeconds(sessions: WorkoutSession[]): number | null {
  const rests = sessions
    .filter((session) => session.status === 'completed')
    .map((session) => sessionMechanics(session).medianRestSeconds)
    .filter((value): value is number => value !== null);

  if (rests.length < MIN_SAMPLE) return null;
  return Math.round(median(rests) as number);
}

// ---------------------------------------------------------------------------
// How the sessions go

export type WeekdayQuality = {
  weekday: number;
  /** Working sets completed, averaged over sessions on that weekday. */
  averageSets: number;
  sessions: number;
};

/**
 * Which day of the week goes best.
 *
 * Measured as completed working sets, because that is the one thing every
 * session has regardless of which exercises were in it. Needs two sessions on
 * a weekday before it counts, so a single good Tuesday proves nothing.
 */
export function inferBestWeekday(sessions: WorkoutSession[]): WeekdayQuality | null {
  const completed = sessions.filter((session) => session.status === 'completed');
  if (completed.length < STRONG_SAMPLE) return null;

  const byWeekday = new Map<number, number[]>();
  for (const session of completed) {
    const weekday = weekdayOf(session.date);
    const sets = sessionMechanics(session).workingSets;
    byWeekday.set(weekday, [...(byWeekday.get(weekday) ?? []), sets]);
  }

  const ranked = [...byWeekday.entries()]
    .filter(([, values]) => values.length >= 2)
    .map(([weekday, values]) => ({
      weekday,
      averageSets: round(mean(values), 1),
      sessions: values.length,
    }))
    .sort((a, b) => b.averageSets - a.averageSets);

  if (ranked.length < 2) return null;
  // A best day only means something if it is actually better than the rest.
  const rest = mean(ranked.slice(1).map((entry) => entry.averageSets));
  if (ranked[0].averageSets < rest * 1.15) return null;

  return ranked[0];
}

/** Whether you finish what is laid out, or routinely cut it short. */
export function inferFinishing(
  sessions: WorkoutSession[],
  routine: Routine | null,
): { ratio: number; sampleSize: number } | null {
  if (!routine) return null;

  const ratios = sessions
    .filter((session) => session.status === 'completed' && session.routineDayId)
    .map((session) => {
      const day = routine.days.find((entry) => entry.id === session.routineDayId);
      if (!day) return null;
      const planned = day.exercises.reduce((total, exercise) => total + exercise.sets, 0);
      return sessionMechanics(session, planned).completionRatio;
    })
    .filter((value): value is number => value !== null);

  if (ratios.length < MIN_SAMPLE) return null;
  return { ratio: round(mean(ratios), 2), sampleSize: ratios.length };
}

/**
 * Exercises you keep swapping out or leaving unfinished.
 *
 * A repeated substitution is a preference the user expressed by doing, not by
 * filling in a form — either they dislike it or the gym does not have it.
 */
export function inferAvoidedExercises(sessions: WorkoutSession[]): { exerciseId: string; times: number }[] {
  const counts = new Map<string, number>();

  for (const session of sessions) {
    if (session.status !== 'completed') continue;
    for (const exercise of session.exercises) {
      if (exercise.substitutedFrom) {
        counts.set(exercise.substitutedFrom, (counts.get(exercise.substitutedFrom) ?? 0) + 1);
      }
      // Laid out and left completely untouched counts as avoidance too.
      const touched = exercise.sets.some((set) => set.completed);
      if (!touched && exercise.sets.length > 0) {
        counts.set(exercise.exerciseId, (counts.get(exercise.exerciseId) ?? 0) + 1);
      }
    }
  }

  return [...counts.entries()]
    .filter(([, times]) => times >= 2)
    .map(([exerciseId, times]) => ({ exerciseId, times }))
    .sort((a, b) => b.times - a.times);
}

/** Sets per muscle over a window — what you have actually been training. */
export function inferMuscleEmphasis(
  sessions: WorkoutSession[],
  today: ISODate,
  days = 28,
): Partial<Record<MuscleGroup, number>> {
  const totals: Partial<Record<MuscleGroup, number>> = {};

  for (const session of sessions) {
    if (session.status !== 'completed') continue;
    if (!isWithinDays(session.date, today, days)) continue;

    for (const entry of session.exercises) {
      const exercise = getExercise(entry.exerciseId);
      if (!exercise) continue;
      const sets = entry.sets.filter((set) => set.completed && !set.warmup).length;
      if (sets === 0) continue;

      totals[exercise.primaryMuscle] = (totals[exercise.primaryMuscle] ?? 0) + sets;
      for (const muscle of exercise.secondaryMuscles) {
        // Secondary work counts, but not as a full set.
        totals[muscle] = (totals[muscle] ?? 0) + sets * 0.5;
      }
    }
  }

  return Object.fromEntries(
    Object.entries(totals).map(([muscle, sets]) => [muscle, round(sets, 1)]),
  ) as Partial<Record<MuscleGroup, number>>;
}

// ---------------------------------------------------------------------------
// Whether you are drifting away

export type DropOffRisk = {
  level: 'none' | 'watch' | 'high';
  daysSinceLast: number | null;
  /** Typical gap between sessions, in days. */
  usualGapDays: number | null;
};

/**
 * How far past your own normal gap you are.
 *
 * Compared against your own rhythm rather than a fixed number of days: someone
 * training twice a week is not slipping at day four, and someone training six
 * times a week is.
 */
export function inferDropOffRisk(sessions: WorkoutSession[], today: ISODate): DropOffRisk {
  const dates = sessions
    .filter((session) => session.status === 'completed')
    .map((session) => session.date)
    .sort();

  if (dates.length === 0) return { level: 'none', daysSinceLast: null, usualGapDays: null };

  const daysSinceLast = daysBetween(dates[dates.length - 1], today);

  const gaps: number[] = [];
  for (let index = 1; index < dates.length; index += 1) {
    gaps.push(daysBetween(dates[index - 1], dates[index]));
  }
  const usualGapDays = gaps.length >= 2 ? round(median(gaps) as number, 1) : null;

  if (usualGapDays === null) {
    return {
      level: daysSinceLast >= 10 ? 'high' : daysSinceLast >= 6 ? 'watch' : 'none',
      daysSinceLast,
      usualGapDays,
    };
  }

  if (daysSinceLast >= usualGapDays * 3) return { level: 'high', daysSinceLast, usualGapDays };
  if (daysSinceLast >= usualGapDays * 1.8) return { level: 'watch', daysSinceLast, usualGapDays };
  return { level: 'none', daysSinceLast, usualGapDays };
}

/** How often you weigh yourself, so the app can stop asking if you are regular. */
export function inferWeighInCadence(measurements: BodyMeasurement[], today: ISODate): number | null {
  const dates = measurements
    .filter((entry) => isWithinDays(entry.date, today, 60))
    .map((entry) => entry.date)
    .sort();

  if (dates.length < MIN_SAMPLE) return null;

  const gaps: number[] = [];
  for (let index = 1; index < dates.length; index += 1) {
    gaps.push(daysBetween(dates[index - 1], dates[index]));
  }
  return gaps.length === 0 ? null : round(median(gaps) as number, 1);
}

// ---------------------------------------------------------------------------

export type ObservationInput = {
  sessions: WorkoutSession[];
  routine: Routine | null;
  checkins: DailyCheckin[];
  measurements: BodyMeasurement[];
  today: ISODate;
};

export type Observations = {
  trainingTime: TimeOfDay | null;
  weekdays: WeekdayHabit | null;
  sessionLength: number | null;
  restSeconds: number | null;
  bestWeekday: WeekdayQuality | null;
  finishing: { ratio: number; sampleSize: number } | null;
  avoided: { exerciseId: string; times: number }[];
  muscleEmphasis: Partial<Record<MuscleGroup, number>>;
  dropOff: DropOffRisk;
  weighInDays: number | null;
  /** Everything above, flattened for display. Unknown items are kept, so the
   *  screen can show what it is still working on rather than hiding it. */
  list: Observation[];
};

export function deriveObservations(input: ObservationInput): Observations {
  const { sessions, routine, measurements, today } = input;

  const trainingTime = inferTrainingTime(sessions);
  const weekdays = inferTrainingWeekdays(sessions);
  const sessionLength = inferSessionLength(sessions);
  const restSeconds = inferRestSeconds(sessions);
  const bestWeekday = inferBestWeekday(sessions);
  const finishing = inferFinishing(sessions, routine);
  const avoided = inferAvoidedExercises(sessions);
  const muscleEmphasis = inferMuscleEmphasis(sessions, today);
  const dropOff = inferDropOffRisk(sessions, today);
  const weighInDays = inferWeighInCadence(measurements, today);

  const completed = sessions.filter((session) => session.status === 'completed').length;

  const list: Observation[] = [
    {
      id: 'training_time',
      label: 'You train around',
      display: trainingTime ? formatTimeOfDay(trainingTime) : null,
      confidence: confidenceFor(trainingTime?.sampleSize ?? 0),
      sampleSize: trainingTime?.sampleSize ?? completed,
      used: trainingTime ? 'When you get reminded' : null,
    },
    {
      id: 'training_days',
      label: 'Your days',
      display: weekdays ? weekdays.weekdays.map(weekdayLabel).join(' · ') : null,
      confidence: confidenceFor(weekdays?.sampleSize ?? 0),
      sampleSize: weekdays?.sampleSize ?? completed,
      used: weekdays ? 'When sessions get scheduled' : null,
    },
    {
      id: 'session_length',
      label: 'A session takes you',
      display: sessionLength ? `${sessionLength} min` : null,
      confidence: confidenceFor(completed),
      sampleSize: completed,
      used: sessionLength ? 'How long the app says today will take' : null,
    },
    {
      id: 'rest_length',
      label: 'You rest',
      display: restSeconds ? `${Math.round(restSeconds / 15) * 15}s` : null,
      confidence: confidenceFor(completed),
      sampleSize: completed,
      used: restSeconds ? 'The rest timer default' : null,
    },
    {
      id: 'best_weekday',
      label: 'Your strongest day',
      display: bestWeekday ? weekdayLabel(bestWeekday.weekday) : null,
      confidence: confidenceFor(completed),
      sampleSize: completed,
      used: bestWeekday ? 'The hardest session goes here' : null,
    },
    {
      id: 'finishing',
      label: 'You finish',
      display: finishing ? `${Math.round(finishing.ratio * 100)}%` : null,
      confidence: confidenceFor(finishing?.sampleSize ?? 0),
      sampleSize: finishing?.sampleSize ?? completed,
      used: finishing ? 'How much work gets laid out' : null,
    },
    {
      id: 'avoided_exercises',
      label: 'You skip',
      display:
        avoided.length === 0
          ? null
          : `${getExercise(avoided[0].exerciseId)?.name ?? avoided[0].exerciseId}`,
      confidence: avoided.length >= 3 ? 'medium' : 'low',
      sampleSize: avoided[0]?.times ?? 0,
      used: avoided.length > 0 ? 'Dropped from the routine' : null,
    },
    {
      id: 'weigh_in',
      label: 'You weigh in every',
      display: weighInDays ? `${weighInDays} days` : null,
      confidence: confidenceFor(measurements.length),
      sampleSize: measurements.length,
      used: weighInDays ? 'How often the app asks' : null,
    },
  ];

  return {
    trainingTime,
    weekdays,
    sessionLength,
    restSeconds,
    bestWeekday,
    finishing,
    avoided,
    muscleEmphasis,
    dropOff,
    weighInDays,
    list,
  };
}

/** How much of the picture the app has, 0–1. Drives the "learning you" meter. */
export function observationCoverage(observations: Observations): number {
  const known = observations.list.filter((entry) => entry.display !== null).length;
  return round(known / observations.list.length, 2);
}
