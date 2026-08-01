import { fuelConfig, momentumConfig } from '@/domain/config';
import type { DailyCheckin, ISODate, MomentumStateId, PlannedSession } from '@/domain/types';
import { daysBetween } from '@/utils/date';
import { clamp, mean, normalize, round } from '@/utils/math';

/**
 * The thing worth saying right now.
 *
 * Momentum and Fuel are scores; a score on its own does not tell anyone what
 * to do about it. A nudge names one lever, says what pulling it is worth, and
 * says it at the only moment it can still be acted on — a message about
 * bedtime is useless at noon and useless at 3am.
 *
 * Three rules the whole module follows:
 *
 *  · **Never invent a number.** Every nudge that quotes a gain derives it from
 *    the same models the score uses, so "+6 tomorrow" is what would actually
 *    happen and not encouragement dressed as arithmetic. When the data to
 *    compute a gain is missing, the nudge either goes unstated or is not
 *    produced.
 *  · **One at a time.** These are ranked and the caller shows the top one.
 *    A list of ways you are falling short is a list of reasons to close the
 *    app.
 *  · **Never scold.** A missed session and bad weather are both conditions,
 *    not verdicts. The copy for a cold, wet, dark evening is the one place
 *    the app is allowed to be theatrical about it.
 */

export type NudgeKind = 'sleep' | 'weather' | 'habit' | 'nutrition' | 'training';

export type Nudge = {
  id: string;
  kind: NudgeKind;
  /** A short sentence, the actual message. */
  headline: string;
  /** The reasoning, one line. Always names the evidence. */
  detail: string;
  /** Points this would add, when it can be derived honestly. */
  projectedGain: number | null;
  /** Ranking weight; the caller shows the highest. */
  priority: number;
};

/** What the sky is doing, when the user has allowed the app to look. */
export type WeatherSnapshot = {
  /** Open-Meteo WMO condition, collapsed to what changes the message. */
  condition: 'clear' | 'cloudy' | 'rain' | 'snow' | 'storm';
  temperatureC: number;
};

export type NudgeInput = {
  date: ISODate;
  /** Local hour, 0–23. Decides which nudges are still actionable. */
  hour: number;
  checkins: DailyCheckin[];
  /** Today's planned session, to know whether training is even on the table. */
  plannedToday: PlannedSession | null;
  trainedToday: boolean;
  momentumScore: number | null;
  momentumState: MomentumStateId | null;
  fuelScore: number | null;
  /** Null when the user has not enabled weather, or it could not be read. */
  weather: WeatherSnapshot | null;
  /** Habit ids currently switched on. */
  enabledHabits: string[];
  /** Hour the user usually gets up. Drives the bedtime arithmetic. */
  wakeHour: number;
};

/**
 * Habits the user can switch on. Deliberately few and deliberately boring:
 * each one is a behaviour with a defensible link to training outcomes, not a
 * streak to collect.
 *
 * `momentumLever` names which component of the score the habit actually moves,
 * so the app can explain the connection rather than assert it.
 */
export type Habit = {
  id: string;
  label: string;
  /** What it does, in the app's own terms. */
  detail: string;
  momentumLever: 'recovery' | 'consistency' | 'adherence' | 'progression';
};

export const HABITS: Habit[] = [
  {
    id: 'sleep_window',
    label: 'Consistent sleep window',
    detail: 'Same bedtime most nights. Sleep regularity predicts recovery better than total hours alone.',
    momentumLever: 'recovery',
  },
  {
    id: 'protein_every_meal',
    label: 'Protein at every meal',
    detail: 'Spreading protein across the day supports more muscle protein synthesis than the same total in one sitting.',
    momentumLever: 'progression',
  },
  {
    id: 'daily_checkin',
    label: 'Check in daily',
    detail: 'Readiness has no baseline to compare against until there are enough check-ins. Low logging costs confidence.',
    momentumLever: 'recovery',
  },
  {
    id: 'walk_daily',
    label: 'Walk every day',
    detail: 'Low-intensity movement on rest days aids recovery without adding training load.',
    momentumLever: 'recovery',
  },
  {
    id: 'never_two_in_a_row',
    label: 'Never miss twice',
    detail: 'One missed session is noise. Two in a row is where consistency actually breaks.',
    momentumLever: 'consistency',
  },
];

/** Sleep hours recently averaged, for comparing against what tonight offers. */
function recentSleepHours(checkins: DailyCheckin[], date: ISODate, days = 7): number | null {
  const values = checkins
    .filter((checkin) => {
      const age = daysBetween(checkin.date, date);
      return age >= 0 && age < days && checkin.sleepHours !== null;
    })
    .map((checkin) => checkin.sleepHours as number);
  return values.length === 0 ? null : mean(values);
}

/**
 * Hours of sleep available if the user went to bed now.
 *
 * Wrapping past midnight is the case that matters — at 01:00 with a 07:00
 * wake time the answer is 6, not -18.
 */
function hoursIfSleepingNow(hour: number, wakeHour: number): number {
  const raw = wakeHour - hour;
  return raw > 0 ? raw : raw + 24;
}

/**
 * What tonight's sleep would be worth against the recent average, in points of
 * the sleep component. Uses Fuel's own bounds, so the number quoted is the
 * number the score would move by.
 */
function sleepGain(hoursTonight: number, recentAverage: number): number {
  const { poor, good } = fuelConfig.sleep;
  const tonight = normalize(hoursTonight, poor, good);
  const usual = normalize(recentAverage, poor, good);
  return round((tonight - usual) * fuelConfig.weights.sleep, 1);
}

function sleepNudge(input: NudgeInput): Nudge | null {
  const { hour, wakeHour } = input;
  // Only says anything in the window where going to bed is a live option.
  const evening = hour >= 20 || hour <= 2;
  if (!evening) return null;

  const available = hoursIfSleepingNow(hour, wakeHour);
  const recent = recentSleepHours(input.checkins, input.date);

  // Already too late for the message to be useful rather than dispiriting.
  if (available < 4) return null;

  if (recent === null) {
    return {
      id: 'sleep_unknown_baseline',
      kind: 'sleep',
      headline: `Sleeping now gives you ${Math.floor(available)} hours.`,
      detail: 'Log a few check-ins and the app can tell you what that is worth to tomorrow.',
      projectedGain: null,
      priority: 40,
    };
  }

  const gain = sleepGain(available, recent);
  if (gain < 1) return null;

  return {
    id: 'sleep_now',
    kind: 'sleep',
    headline: `Go to sleep now for ${Math.floor(available)} hours — about +${gain} fuel tomorrow.`,
    detail: `You have averaged ${round(recent, 1)}h this week. Tonight is worth more than usual because you are ahead of that.`,
    projectedGain: gain,
    priority: 80,
  };
}

/**
 * Weather only ever changes the framing, never the plan.
 *
 * Good conditions are an invitation; bad conditions are the one place the app
 * leans on the fact that showing up when it is miserable is the whole point.
 * It is never produced on a day with no session planned — turning weather into
 * a reason to feel bad on a rest day would be the opposite of the intent.
 */
function weatherNudge(input: NudgeInput): Nudge | null {
  const { weather, plannedToday, trainedToday } = input;
  if (!weather || trainedToday || !plannedToday) return null;
  // After the evening the message cannot change what happens today.
  if (input.hour >= 21) return null;

  const { condition, temperatureC } = weather;

  if (condition === 'rain' || condition === 'storm') {
    return {
      id: 'weather_rain',
      kind: 'weather',
      headline: 'Anyone can train in the sun. Only warriors train in the rain.',
      detail: `${condition === 'storm' ? 'Storming' : 'Raining'} and ${Math.round(temperatureC)}°. The session is indoors anyway.`,
      projectedGain: null,
      priority: 55,
    };
  }

  if (condition === 'snow') {
    return {
      id: 'weather_snow',
      kind: 'weather',
      headline: 'Snow outside. The gym has not moved.',
      detail: `${Math.round(temperatureC)}° out. Give yourself extra time to warm up.`,
      projectedGain: null,
      priority: 55,
    };
  }

  if (condition === 'clear' && temperatureC >= 12 && temperatureC <= 28) {
    return {
      id: 'weather_good',
      kind: 'weather',
      headline: `Clear and ${Math.round(temperatureC)}°. Good day to make it count.`,
      detail: 'Nothing outside is an excuse today — worth using.',
      projectedGain: null,
      priority: 35,
    };
  }

  return null;
}

/** The habit with the clearest claim on what is currently weakest. */
function habitNudge(input: NudgeInput): Nudge | null {
  const available = HABITS.filter((habit) => !input.enabledHabits.includes(habit.id));
  if (available.length === 0) return null;

  const loggedRecently = input.checkins.filter((checkin) => daysBetween(checkin.date, input.date) < 7).length;

  // Suggest the one that addresses the actual gap, not the next in the list.
  const wanted =
    loggedRecently < 3
      ? 'daily_checkin'
      : input.momentumState === 'declining' || input.momentumState === 'at_risk'
        ? 'never_two_in_a_row'
        : input.fuelScore !== null && input.fuelScore < 55
          ? 'sleep_window'
          : null;

  const habit = available.find((candidate) => candidate.id === wanted) ?? null;
  if (!habit) return null;

  return {
    id: `habit_${habit.id}`,
    kind: 'habit',
    headline: `Turn on: ${habit.label}`,
    detail: habit.detail,
    projectedGain: null,
    priority: 45,
  };
}

/**
 * Momentum decays while inactive, and the size of that decay is knowable
 * before it happens. Saying it in advance is the only version that is useful.
 */
function trainingNudge(input: NudgeInput): Nudge | null {
  const { plannedToday, trainedToday, momentumScore, hour } = input;
  if (trainedToday || !plannedToday || momentumScore === null) return null;
  if (hour < 6 || hour >= 22) return null;

  const skipCost = round(
    momentumConfig.adherenceCredit.completed * momentumConfig.weights.adherence * momentumConfig.smoothingAlpha * 100,
    1,
  );

  return {
    id: 'training_planned',
    kind: 'training',
    headline: 'Today is a training day.',
    detail: `Completing it protects roughly ${clamp(skipCost, 1, 12)} points of momentum that a skip would cost.`,
    projectedGain: null,
    priority: hour >= 17 ? 75 : 50,
  };
}

/** All applicable nudges, highest priority first. */
export function buildNudges(input: NudgeInput): Nudge[] {
  return [sleepNudge(input), weatherNudge(input), trainingNudge(input), habitNudge(input)]
    .filter((nudge): nudge is Nudge => nudge !== null)
    .sort((a, b) => b.priority - a.priority);
}

/** The single one worth showing. */
export function topNudge(input: NudgeInput): Nudge | null {
  return buildNudges(input)[0] ?? null;
}
