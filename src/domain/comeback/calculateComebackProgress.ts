import { comebackConfig } from '@/domain/config';
import type { ComebackBaseline, Confidence } from '@/domain/types';
import { clamp, mean, round, sum } from '@/utils/math';

export type ComebackInput = {
  /** Null until a baseline exists — the model then refuses to report a number. */
  baseline: ComebackBaseline | null;
  /** Best estimated 1RM per exercise over the recent window. */
  currentE1rmByExercise: Record<string, number>;
  currentWeeklyVolumeKg: number;
  currentWeeklySessions: number;
  /** Sessions logged since the baseline was set; drives confidence. */
  sessionsSinceBaseline: number;
};

export type ComebackResult = {
  /** 0–100, or null while the baseline is still being established. */
  value: number | null;
  status: 'establishing' | 'estimated';
  confidence: Confidence;
  components: {
    strength: number | null;
    volume: number | null;
    frequency: number | null;
  };
  matchedExercises: number;
  /** True when current performance is already past the baseline. */
  exceedsBaseline: boolean;
  explanation: string;
};

function ratioToPercent(ratio: number): number {
  return round(clamp(ratio, 0, comebackConfig.maxComponentRatio) * 100, 1);
}

/**
 * How much of the previous level has been recovered, independent of Momentum.
 * Momentum answers "is the trajectory strong right now"; this answers "how much
 * of what was lost is back".
 */
export function calculateComebackProgress(input: ComebackInput): ComebackResult {
  const { baseline } = input;

  if (!baseline || baseline.exercises.length === 0) {
    return {
      value: null,
      status: 'establishing',
      confidence: 'low',
      components: { strength: null, volume: null, frequency: null },
      matchedExercises: 0,
      exceedsBaseline: false,
      explanation:
        'Comeback Progress needs a baseline. Log your first sessions and it will be measured from your own numbers.',
    };
  }

  const matched = baseline.exercises.filter(
    (entry) => input.currentE1rmByExercise[entry.exerciseId] !== undefined && entry.e1rmKg > 0,
  );

  const strength =
    matched.length === 0
      ? null
      : ratioToPercent(
          mean(matched.map((entry) => input.currentE1rmByExercise[entry.exerciseId] / entry.e1rmKg)),
        );

  const volume =
    baseline.weeklyVolumeKg > 0 ? ratioToPercent(input.currentWeeklyVolumeKg / baseline.weeklyVolumeKg) : null;

  const frequency =
    baseline.weeklySessions > 0 ? ratioToPercent(input.currentWeeklySessions / baseline.weeklySessions) : null;

  const candidates: { value: number | null; weight: number }[] = [
    { value: strength, weight: comebackConfig.weights.strength },
    { value: volume, weight: comebackConfig.weights.volume },
    { value: frequency, weight: comebackConfig.weights.frequency },
  ];
  const parts = candidates.filter(
    (part): part is { value: number; weight: number } => part.value !== null,
  );

  if (parts.length === 0) {
    return {
      value: null,
      status: 'establishing',
      confidence: 'low',
      components: { strength, volume, frequency },
      matchedExercises: matched.length,
      exceedsBaseline: false,
      explanation: 'No recent sessions overlap with your baseline exercises yet.',
    };
  }

  const weightSum = sum(parts.map((part) => part.weight));
  const raw = sum(parts.map((part) => part.value * part.weight)) / weightSum;
  const value = round(clamp(raw, 0, 100), 1);

  const { confidence: thresholds } = comebackConfig;
  let confidence: Confidence = 'low';
  if (matched.length >= thresholds.highExercises && input.sessionsSinceBaseline >= thresholds.highSessions) {
    confidence = 'high';
  } else if (
    matched.length >= thresholds.mediumExercises &&
    input.sessionsSinceBaseline >= thresholds.mediumSessions
  ) {
    confidence = 'medium';
  }

  const explanation =
    raw >= 100
      ? 'You are at or above the level this baseline was set from.'
      : `Estimated from ${matched.length} matched exercise${matched.length === 1 ? '' : 's'}, weekly volume and training frequency against your baseline.`;

  return {
    value,
    status: 'estimated',
    confidence,
    components: { strength, volume, frequency },
    matchedExercises: matched.length,
    exceedsBaseline: raw >= 100,
    explanation,
  };
}

export type BaselineCandidate = {
  e1rmByExercise: Record<string, number>;
  weeklyVolumeKg: number;
  weeklySessions: number;
  sessionCount: number;
};

/**
 * Builds the observed baseline once enough sessions exist. For a user with no
 * training history this is the honest starting point: the level they came back
 * at, measured rather than guessed.
 */
export function buildObservedBaseline(
  candidate: BaselineCandidate,
  establishedAt: string,
  id: string,
): ComebackBaseline | null {
  if (candidate.sessionCount < comebackConfig.baselineSessions) return null;
  const exercises = Object.entries(candidate.e1rmByExercise).map(([exerciseId, e1rmKg]) => ({
    exerciseId,
    e1rmKg,
  }));
  if (exercises.length === 0) return null;

  return {
    id,
    source: 'observed',
    establishedAt,
    exercises,
    weeklySessions: candidate.weeklySessions,
    weeklyVolumeKg: candidate.weeklyVolumeKg,
    sampleSessions: candidate.sessionCount,
  };
}
