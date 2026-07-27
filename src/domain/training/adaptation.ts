import type { Confidence } from '@/domain/types';
import { clamp, round } from '@/utils/math';

/**
 * How today's session should differ from the plan.
 *
 * The plan is fixed; the day is not. On a day where you slept well, recovered
 * and have been consistent, there is room to do a little more — and if you are
 * behind for the week, that is exactly when to make it up. On a bad day the
 * session shrinks instead of being skipped.
 *
 * Deterministic, and deliberately narrow: never more than one extra set per
 * exercise, never less than 60 % of the planned work.
 */

export type AdaptationInput = {
  /** 0–100, or null before there is any. */
  momentum: number | null;
  /** 0–100 from today's check-in, or null when it was not logged. */
  readiness: number | null;
  /** Points above/below the user's own readiness baseline. */
  readinessVsBaseline: number | null;
  sessionsThisWeek: number;
  targetSessionsPerWeek: number;
  /** Sessions planned earlier this week that were not done. */
  missedThisWeek: number;
  daysSinceLastSession: number | null;
};

export type DailyAdaptation = {
  /** Applied to the planned set count of each exercise. */
  volumeMultiplier: number;
  /** Sets added to (or removed from) the main lifts. */
  setDelta: number;
  /** One short line for the session card. */
  headline: string;
  reason: string;
  confidence: Confidence;
};

export function adaptToday(input: AdaptationInput): DailyAdaptation {
  const {
    momentum,
    readiness,
    readinessVsBaseline,
    sessionsThisWeek,
    targetSessionsPerWeek,
    missedThisWeek,
    daysSinceLastSession,
  } = input;

  const behind = missedThisWeek > 0 || sessionsThisWeek < targetSessionsPerWeek - 1;
  const confidence: Confidence = readiness === null ? 'low' : momentum === null ? 'medium' : 'high';

  // No check-in: run the plan as written rather than guessing.
  if (readiness === null) {
    return {
      volumeMultiplier: 1,
      setDelta: 0,
      headline: 'Session as planned',
      reason: 'No check-in today, so the session runs exactly as written.',
      confidence,
    };
  }

  const wellRecovered = readiness >= 70 || (readinessVsBaseline !== null && readinessVsBaseline >= 8);
  const strugglingRecovery = readiness < 45 || (readinessVsBaseline !== null && readinessVsBaseline <= -15);
  const goodMomentum = momentum === null || momentum >= 55;

  if (wellRecovered && goodMomentum && behind) {
    return {
      volumeMultiplier: 1.2,
      setDelta: 1,
      headline: 'Room to make up ground',
      reason: `Recovery is above your baseline and you are ${missedThisWeek > 0 ? 'a session behind' : 'short of your weekly target'}. One extra set on the main lifts recovers some of it without adding a session.`,
      confidence,
    };
  }

  if (wellRecovered && goodMomentum) {
    return {
      volumeMultiplier: 1.1,
      setDelta: 1,
      headline: 'Good day to push',
      reason: 'Recovery is above your baseline. Take the top sets closer to failure than usual.',
      confidence,
    };
  }

  if (strugglingRecovery) {
    return {
      volumeMultiplier: 0.65,
      setDelta: -1,
      headline: 'Keep it short',
      reason: 'Recovery is well below your baseline. Keep the main lifts, drop the accessory work, and leave more in reserve.',
      confidence,
    };
  }

  if (readiness < 58) {
    return {
      volumeMultiplier: 0.85,
      setDelta: 0,
      headline: 'Slightly lighter',
      reason: 'Recovery is a little under your usual level. Same session, one less set on the accessories.',
      confidence,
    };
  }

  if (daysSinceLastSession !== null && daysSinceLastSession >= 7) {
    return {
      volumeMultiplier: 0.8,
      setDelta: 0,
      headline: 'Ease back in',
      reason: `It has been ${daysSinceLastSession} days. A slightly shorter first session back costs nothing and keeps the soreness manageable.`,
      confidence,
    };
  }

  return {
    volumeMultiplier: 1,
    setDelta: 0,
    headline: 'Session as planned',
    reason: 'Recovery is in your normal range. Run the session as written.',
    confidence,
  };
}

/** Applies the adaptation to a planned set count, keeping it sane. */
export function adaptSetCount(plannedSets: number, adaptation: DailyAdaptation, isMainLift: boolean): number {
  const scaled = plannedSets * adaptation.volumeMultiplier;
  const withDelta = isMainLift ? scaled + adaptation.setDelta : scaled;
  return clamp(Math.round(withDelta), 1, plannedSets + 1);
}

/**
 * How far behind the week is, in sets. Used to explain what "making up ground"
 * is actually recovering.
 */
export function setsBehind(missedSessions: number, setsPerSession: number): number {
  return round(missedSessions * setsPerSession, 0);
}
