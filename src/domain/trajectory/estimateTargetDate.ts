import { trajectoryConfig } from '@/domain/config';
import type { Confidence, ISODate } from '@/domain/types';
import { addDays, daysBetween } from '@/utils/date';
import { clamp, round } from '@/utils/math';

export type TrajectoryInput = {
  today: ISODate;
  goalStartedAt: ISODate;
  /** Planned length of the goal, in weeks. */
  horizonWeeks: number;
  targetSessionsPerWeek: number;
  /** Sessions completed since the goal started. */
  completedSessions: number;
  /** Sessions actually completed per week recently — the effective rate. */
  recentWeeklyRate: number;
  /** Weeks of history available, drives confidence. */
  weeksOfHistory: number;
};

export type TrajectoryResult = {
  targetDate: ISODate;
  /** Days later (positive) or earlier (negative) than the original plan. */
  driftDays: number;
  /** Estimated cost, in days, of skipping a session today. */
  skipCostDays: number;
  /** Days that three consistent weeks at target frequency could recover. */
  recoverableDays: number;
  remainingSessions: number;
  confidence: Confidence;
  explanation: string;
};

/**
 * Projects the goal date from the work still to do and the rate the user is
 * actually training at. This is a planning aid, not a physiological prediction:
 * it treats a goal as a number of quality sessions and asks how long they take
 * at the current pace.
 */
export function estimateTargetDateImpact(input: TrajectoryInput): TrajectoryResult {
  const target = Math.max(1, input.targetSessionsPerWeek);
  const plannedTotal = Math.round(input.horizonWeeks * target);
  const remainingSessions = Math.max(0, plannedTotal - input.completedSessions);

  const rate = Math.max(trajectoryConfig.minWeeklyRate, input.recentWeeklyRate || 0);
  const weeksRemaining = clamp(remainingSessions / rate, 0, trajectoryConfig.maxHorizonWeeks);

  const targetDate = addDays(input.today, Math.round(weeksRemaining * 7));
  const originalDate = addDays(input.goalStartedAt, Math.round(input.horizonWeeks * 7));
  const driftDays = daysBetween(originalDate, targetDate);

  // One missed session pushes everything back by the time it takes to earn one
  // session back at the current rate.
  const skipCostDays = Math.max(1, Math.round(7 / rate));

  // Three weeks at the target rate versus the current rate.
  const sessionsGained = Math.max(0, (target - rate) * 3);
  const recoverableDays = Math.max(0, Math.round((sessionsGained / rate) * 7));

  const confidence: Confidence =
    input.weeksOfHistory >= trajectoryConfig.highWeeks
      ? 'high'
      : input.weeksOfHistory >= trajectoryConfig.mediumWeeks
        ? 'medium'
        : 'low';

  const explanation =
    confidence === 'low'
      ? 'Based on very little history — this estimate will move a lot at first.'
      : `Based on ${round(rate, 1)} sessions per week over the last ${input.weeksOfHistory} weeks.`;

  return {
    targetDate,
    driftDays,
    skipCostDays,
    recoverableDays,
    remainingSessions,
    confidence,
    explanation,
  };
}
