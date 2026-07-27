import { momentumConfig } from '@/domain/config';
import type { ISODate, PlannedSessionStatus, SessionIntent } from '@/domain/types';
import { daysBetween } from '@/utils/date';
import { clamp, mean, round, standardDeviation, sum } from '@/utils/math';

/** A planned day and what became of it. */
export type PlannedOutcome = {
  date: ISODate;
  status: PlannedSessionStatus;
  /** Present when the session was trained; decides partial credit. */
  intent?: SessionIntent;
};

/** Flattened session data — momentum never touches set-level records. */
export type SessionSummary = {
  id: string;
  date: ISODate;
  volumeKg: number;
  setCount: number;
  /** Best estimated 1RM per exercise in that session. */
  e1rmByExercise: Record<string, number>;
};

export type ReadinessPoint = {
  date: ISODate;
  /** 0–100, precomputed by the readiness model. */
  score: number | null;
};

function withinWindow(date: ISODate, reference: ISODate, days: number): boolean {
  const age = daysBetween(date, reference);
  return age >= 0 && age < days;
}

function creditFor(outcome: PlannedOutcome, reference: ISODate): number | null {
  const { adherenceCredit } = momentumConfig;
  switch (outcome.status) {
    case 'rest':
      // Planned rest is part of the plan; it never counts against adherence.
      return null;
    case 'completed':
      if (outcome.intent === 'reduced' || outcome.intent === 'free') return adherenceCredit.reduced;
      if (outcome.intent === 'recovery') return adherenceCredit.recovery;
      return adherenceCredit.completed;
    case 'rescheduled':
      return adherenceCredit.rescheduled;
    case 'skipped':
      return adherenceCredit.skipped;
    case 'planned':
      // Still open today — not yet a miss. In the past it is an unresolved skip.
      return daysBetween(outcome.date, reference) <= 0 ? null : adherenceCredit.skipped;
    default:
      return null;
  }
}

/**
 * Share of planned training earned back over the adherence window, 0–100.
 * Returns null when nothing was planned, so the caller can redistribute weight
 * instead of inventing a score.
 */
export function calculateAdherenceScore(planned: PlannedOutcome[], reference: ISODate): number | null {
  const window = planned.filter((outcome) =>
    withinWindow(outcome.date, reference, momentumConfig.windows.adherenceDays),
  );
  const credits = window
    .map((outcome) => creditFor(outcome, reference))
    .filter((credit): credit is number => credit !== null);

  if (credits.length === 0) return null;
  return round(clamp((sum(credits) / credits.length) * 100, 0, 100), 1);
}

/** Trailing 7-day blocks ending at `reference`, most recent first. */
function weeklyCounts(sessions: SessionSummary[], reference: ISODate, weeks: number): number[] {
  return Array.from({ length: weeks }, (_, index) =>
    sessions.filter((session) => {
      const age = daysBetween(session.date, reference);
      return age >= index * 7 && age < (index + 1) * 7;
    }).length,
  );
}

/**
 * Recent training frequency against the user's own target, 0–100. Blends a
 * 7-day and a 28-day view, rewards unbroken weeks and penalises erratic ones.
 */
export function calculateConsistencyScore(
  sessions: SessionSummary[],
  reference: ISODate,
  targetSessionsPerWeek: number,
): number {
  const { consistency, windows } = momentumConfig;
  const target = Math.max(1, targetSessionsPerWeek);

  const shortCount = sessions.filter((session) =>
    withinWindow(session.date, reference, windows.shortConsistencyDays),
  ).length;
  const longCount = sessions.filter((session) =>
    withinWindow(session.date, reference, windows.longConsistencyDays),
  ).length;

  const shortRatio = clamp(shortCount / target, 0, consistency.maxRatio);
  const longRatio = clamp(longCount / (target * 4), 0, consistency.maxRatio);

  const blocks = weeklyCounts(sessions, reference, 4);
  const streakThreshold = Math.max(1, Math.round(target * 0.6));
  let streak = 0;
  for (const count of blocks) {
    if (count >= streakThreshold) streak += 1;
    else break;
  }
  const streakBonus = Math.min(consistency.maxStreakBonus, streak * consistency.streakBonusPerWeek);

  const variability = standardDeviation(blocks);
  const variabilityPenalty = clamp(variability / target, 0, 1) * consistency.maxVariabilityPenalty;

  const base = (shortRatio * 0.5 + longRatio * 0.5) * 100;
  return round(clamp(base + streakBonus - variabilityPenalty, 0, 100), 1);
}

export type ProgressionDetail = {
  score: number | null;
  strengthChange: number | null;
  volumeChange: number | null;
  matchedExercises: number;
};

/**
 * Whether performance is trending up, 0–100 with 50 as "unchanged". Compares a
 * recent window against the preceding one on matched exercises (estimated 1RM)
 * and on average session volume. Volume spikes stop earning credit past a
 * ceiling, so grinding out junk sets cannot inflate the score.
 */
export function calculateProgressionScore(
  sessions: SessionSummary[],
  reference: ISODate,
): ProgressionDetail {
  const { progression, windows, neutralScore } = momentumConfig;

  const recent = sessions.filter((session) =>
    withinWindow(session.date, reference, windows.progressionRecentDays),
  );
  const previous = sessions.filter((session) => {
    const age = daysBetween(session.date, reference);
    return (
      age >= windows.progressionRecentDays &&
      age < windows.progressionRecentDays + windows.progressionPreviousDays
    );
  });

  if (recent.length < progression.minSessionsPerWindow || previous.length < progression.minSessionsPerWindow) {
    return { score: null, strengthChange: null, volumeChange: null, matchedExercises: 0 };
  }

  const bestOf = (list: SessionSummary[]) => {
    const best: Record<string, number> = {};
    for (const session of list) {
      for (const [exerciseId, value] of Object.entries(session.e1rmByExercise)) {
        if (!best[exerciseId] || value > best[exerciseId]) best[exerciseId] = value;
      }
    }
    return best;
  };

  const recentBest = bestOf(recent);
  const previousBest = bestOf(previous);
  const matched = Object.keys(recentBest).filter((id) => previousBest[id] !== undefined);
  const strengthChange =
    matched.length === 0
      ? null
      : round(mean(matched.map((id) => recentBest[id] / previousBest[id] - 1)), 4);

  const recentVolume = mean(recent.map((session) => session.volumeKg));
  const previousVolume = mean(previous.map((session) => session.volumeKg));
  const rawVolumeChange = previousVolume > 0 ? recentVolume / previousVolume - 1 : null;
  const volumeChange =
    rawVolumeChange === null ? null : round(Math.min(rawVolumeChange, progression.volumeSpikeCeiling), 4);

  const parts: { value: number; weight: number }[] = [];
  if (strengthChange !== null) parts.push({ value: strengthChange, weight: 0.6 });
  if (volumeChange !== null) parts.push({ value: volumeChange, weight: 0.4 });
  if (parts.length === 0) {
    return { score: null, strengthChange, volumeChange, matchedExercises: matched.length };
  }

  const weightSum = sum(parts.map((part) => part.weight));
  const change = sum(parts.map((part) => part.value * part.weight)) / weightSum;
  const credited = clamp(change, -progression.maxCreditedChange, progression.maxCreditedChange);

  return {
    score: round(clamp(neutralScore + credited * progression.sensitivity, 0, 100), 1),
    strengthChange,
    volumeChange,
    matchedExercises: matched.length,
  };
}

/** Average readiness over the recovery window, 0–100. Null without check-ins. */
export function calculateRecoveryScore(readiness: ReadinessPoint[], reference: ISODate): number | null {
  const scores = readiness
    .filter((point) => withinWindow(point.date, reference, momentumConfig.windows.recoveryDays))
    .map((point) => point.score)
    .filter((score): score is number => score !== null);

  if (scores.length === 0) return null;
  return round(clamp(mean(scores), 0, 100), 1);
}

/**
 * How completely the user is feeding the models, 0–100. Low logging does not
 * mean low fitness — it means low confidence, and it is weighted accordingly.
 */
export function calculateLoggingScore(
  readiness: ReadinessPoint[],
  sessions: SessionSummary[],
  reference: ISODate,
  targetSessionsPerWeek: number,
): number {
  const days = momentumConfig.windows.loggingDays;
  const checkinDays = new Set(
    readiness.filter((point) => withinWindow(point.date, reference, days)).map((point) => point.date),
  ).size;
  const checkinCoverage = clamp(checkinDays / days, 0, 1);

  const expectedSessions = Math.max(1, (targetSessionsPerWeek * days) / 7);
  const loggedSessions = sessions.filter((session) => withinWindow(session.date, reference, days)).length;
  const sessionCoverage = clamp(loggedSessions / expectedSessions, 0, 1);

  return round(clamp((checkinCoverage * 0.7 + sessionCoverage * 0.3) * 100, 0, 100), 1);
}
