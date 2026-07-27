import { recommendationConfig } from '@/domain/config';
import type {
  Confidence,
  ISODate,
  RecommendationFactor,
  RecommendationType,
  UUID,
} from '@/domain/types';

export type RecommendationInput = {
  date: ISODate;
  /** What the plan says for today, if anything. */
  planned: {
    routineId: UUID | null;
    routineDayId: UUID | null;
    name: string;
    estimatedMinutes: number;
  } | null;
  /** True when today is a scheduled rest day. */
  isPlannedRestDay: boolean;
  /** Sessions planned earlier this week that were missed and not rescheduled. */
  missedThisWeek: {
    routineId: UUID | null;
    routineDayId: UUID | null;
    name: string;
    estimatedMinutes: number;
    date: ISODate;
  }[];
  /** 0–100, or null when today's check-in is missing. */
  readiness: number | null;
  /** Points above/below the user's own readiness baseline. */
  readinessVsBaseline: number | null;
  /** Null when the user has never logged a session. */
  daysSinceLastSession: number | null;
  /** Consecutive days trained up to and including yesterday. */
  consecutiveTrainingDays: number;
  sessionsThisWeek: number;
  targetSessionsPerWeek: number;
  momentumScore: number | null;
  /** Confidence of the underlying data, propagated to the recommendation. */
  dataConfidence: Confidence;
};

export type RecommendationResult = {
  type: RecommendationType;
  title: string;
  routineId: UUID | null;
  routineDayId: UUID | null;
  estimatedMinutes: number;
  reason: string;
  factors: RecommendationFactor[];
  confidence: Confidence;
};

function factor(
  key: string,
  label: string,
  direction: RecommendationFactor['direction'] = 'neutral',
): RecommendationFactor {
  return { key, label, direction };
}

function reduce(minutes: number): number {
  return Math.max(15, Math.round((minutes * recommendationConfig.reducedSessionRatio) / 5) * 5);
}

/**
 * Transparent rule engine. Exactly one recommendation comes out, together with
 * the factors that produced it — the reasoning is never hidden from the user.
 *
 * Ordering matters: hard blockers first (accumulated fatigue), then the plan,
 * then catching up, then readiness-driven downgrades.
 */
export function generateDailyRecommendation(input: RecommendationInput): RecommendationResult {
  const factors: RecommendationFactor[] = [];
  const {
    recoveryThreshold,
    reducedThreshold,
    maxConsecutiveDays,
    inactivityNudgeDays,
    recoverySessionMinutes,
  } = recommendationConfig;

  const {
    planned,
    isPlannedRestDay,
    missedThisWeek,
    readiness,
    readinessVsBaseline,
    daysSinceLastSession,
    consecutiveTrainingDays,
    sessionsThisWeek,
    targetSessionsPerWeek,
    momentumScore,
    dataConfidence,
  } = input;

  const lowConsistency =
    (momentumScore !== null && momentumScore < 45) ||
    (daysSinceLastSession !== null && daysSinceLastSession >= inactivityNudgeDays);

  if (readiness !== null) {
    factors.push(
      factor(
        'readiness',
        `Readiness ${Math.round(readiness)}/100${
          readinessVsBaseline === null
            ? ''
            : readinessVsBaseline >= 0
              ? ` (+${Math.round(readinessVsBaseline)} vs baseline)`
              : ` (${Math.round(readinessVsBaseline)} vs baseline)`
        }`,
        readiness >= reducedThreshold ? 'positive' : 'negative',
      ),
    );
  } else {
    factors.push(factor('readiness_missing', 'No check-in logged today'));
  }

  if (daysSinceLastSession !== null) {
    factors.push(
      factor(
        'last_session',
        daysSinceLastSession === 0
          ? 'You already trained today'
          : `${daysSinceLastSession} day${daysSinceLastSession === 1 ? '' : 's'} since your last session`,
        daysSinceLastSession <= 2 ? 'positive' : 'negative',
      ),
    );
  }

  factors.push(
    factor(
      'weekly_progress',
      `${sessionsThisWeek} of ${targetSessionsPerWeek} sessions done this week`,
      sessionsThisWeek >= targetSessionsPerWeek ? 'positive' : 'neutral',
    ),
  );

  const confidence: Confidence = readiness === null ? 'low' : dataConfidence;

  // 1. Accumulated fatigue: several days in a row plus poor recovery.
  if (consecutiveTrainingDays >= maxConsecutiveDays && (readiness === null || readiness < reducedThreshold)) {
    factors.push(factor('consecutive_days', `${consecutiveTrainingDays} training days in a row`, 'negative'));
    return {
      type: 'recovery',
      title: 'Recovery session',
      routineId: null,
      routineDayId: null,
      estimatedMinutes: recoverySessionMinutes,
      reason: `You have trained ${consecutiveTrainingDays} days in a row and recovery is below your usual level. Light movement keeps the streak without adding fatigue.`,
      factors,
      confidence,
    };
  }

  // 2. Very low readiness. Rest only when consistency is not already the problem.
  if (readiness !== null && readiness < recoveryThreshold) {
    if (lowConsistency) {
      const target = planned ?? missedThisWeek[0] ?? null;
      return {
        type: 'reduced',
        title: target ? `Reduced ${target.name.toLowerCase()}` : 'Reduced session',
        routineId: target?.routineId ?? null,
        routineDayId: target?.routineDayId ?? null,
        estimatedMinutes: reduce(target?.estimatedMinutes ?? 45),
        reason:
          'Recovery is low, but your recent training frequency is low too. A shortened session keeps the habit without demanding a full effort.',
        factors,
        confidence,
      };
    }
    return {
      type: 'rest',
      title: 'Rest day',
      routineId: null,
      routineDayId: null,
      estimatedMinutes: 0,
      reason:
        'Recovery is well below your baseline and you have been training consistently. A full rest day is the better trade today.',
      factors,
      confidence,
    };
  }

  // 3. Planned rest, with nothing outstanding.
  if (isPlannedRestDay && missedThisWeek.length === 0) {
    factors.push(factor('planned_rest', 'Rest is part of your plan today', 'positive'));
    return {
      type: 'rest',
      title: 'Planned rest',
      routineId: null,
      routineDayId: null,
      estimatedMinutes: 0,
      reason: 'Today is a scheduled rest day and nothing is outstanding this week. Planned rest does not reduce momentum.',
      factors,
      confidence,
    };
  }

  // 4. Nothing planned today, but something was missed earlier this week.
  if (!planned && missedThisWeek.length > 0) {
    const missed = missedThisWeek[0];
    factors.push(factor('missed_session', `${missed.name} was missed earlier this week`, 'negative'));
    const shorten = readiness !== null && readiness < reducedThreshold;
    return {
      type: 'rescheduled',
      title: shorten ? `Reduced ${missed.name.toLowerCase()}` : missed.name,
      routineId: missed.routineId,
      routineDayId: missed.routineDayId,
      estimatedMinutes: shorten ? reduce(missed.estimatedMinutes) : missed.estimatedMinutes,
      reason: `${missed.name} was missed earlier this week and today is open. Moving it here keeps your weekly frequency intact.`,
      factors,
      confidence,
    };
  }

  // 5. Nothing planned, nothing missed.
  if (!planned) {
    if (isPlannedRestDay || sessionsThisWeek >= targetSessionsPerWeek) {
      return {
        type: 'rest',
        title: 'Rest day',
        routineId: null,
        routineDayId: null,
        estimatedMinutes: 0,
        reason: 'You have met your target for the week and nothing is scheduled today.',
        factors,
        confidence,
      };
    }
    return {
      type: 'free',
      title: 'Free session',
      routineId: null,
      routineDayId: null,
      estimatedMinutes: 45,
      reason: 'Nothing is scheduled today, but you are below your weekly target. Log a free session with whatever you have access to.',
      factors,
      confidence,
    };
  }

  // 6. Planned session, readiness below the comfortable band → shorten it.
  if (readiness !== null && readiness < reducedThreshold) {
    return {
      type: 'reduced',
      title: `Reduced ${planned.name.toLowerCase()}`,
      routineId: planned.routineId,
      routineDayId: planned.routineDayId,
      estimatedMinutes: reduce(planned.estimatedMinutes),
      reason: `${planned.name} is planned, but recovery is under your usual level. Keep the main lifts and drop the accessory volume.`,
      factors,
      confidence,
    };
  }

  // 7. The plan stands.
  return {
    type: 'full',
    title: planned.name,
    routineId: planned.routineId,
    routineDayId: planned.routineDayId,
    estimatedMinutes: planned.estimatedMinutes,
    reason:
      readiness === null
        ? `${planned.name} is what your plan calls for today. Log a check-in to let recovery adjust this.`
        : `${planned.name} is planned and your recovery is in the normal range.`,
    factors,
    confidence,
  };
}

export const recommendationTypeLabel: Record<RecommendationType, string> = {
  full: 'Train',
  reduced: 'Reduced session',
  recovery: 'Recovery',
  rest: 'Rest',
  rescheduled: 'Catch up',
  free: 'Free session',
};
