import type { MomentumStateId } from './types';

/**
 * Every tunable number in the models lives here. Nothing in `src/domain/**`
 * hardcodes a weight or a threshold, so the models can be retuned without
 * touching their logic — and the tests can pin the behaviour, not the constants.
 */

export const momentumConfig = {
  /** Component weights; must sum to 1. Missing components redistribute. */
  weights: {
    adherence: 0.35,
    consistency: 0.2,
    progression: 0.2,
    recovery: 0.15,
    logging: 0.1,
  },
  /** Credit given per planned-session outcome, 0–1. */
  adherenceCredit: {
    completed: 1,
    /** A shortened session that happened still counts for most of it. */
    reduced: 0.85,
    recovery: 0.7,
    /** Moved, not dropped. Penalised, but far less than skipping. */
    rescheduled: 0.6,
    skipped: 0,
  },
  windows: {
    adherenceDays: 28,
    shortConsistencyDays: 7,
    longConsistencyDays: 28,
    progressionRecentDays: 14,
    progressionPreviousDays: 28,
    recoveryDays: 7,
    loggingDays: 14,
  },
  /** Exponential smoothing factor applied to the raw score each day. */
  smoothingAlpha: 0.35,
  /** Hard cap on how much the score may move in a single day. */
  maxDailyChange: 6,
  /** Neutral value used for a component that exists but has no signal. */
  neutralScore: 50,
  progression: {
    /** Relative change mapped onto ±50 points around neutral. */
    sensitivity: 250,
    maxCreditedChange: 0.2,
    /** Volume jumps beyond this are not rewarded further. */
    volumeSpikeCeiling: 0.3,
    minSessionsPerWindow: 2,
  },
  consistency: {
    streakBonusPerWeek: 3,
    maxStreakBonus: 9,
    maxVariabilityPenalty: 10,
    /** Ratio above 1 is credited a little, to reward catching up. */
    maxRatio: 1.1,
  },
  confidence: {
    /** Days of logged history required for each confidence level. */
    mediumDays: 10,
    highDays: 21,
    mediumCheckins: 4,
    highCheckins: 10,
  },
  /** State ranges, inclusive lower bound. Configurable by design. */
  states: [
    { id: 'declining', label: 'Declining', min: 0 },
    { id: 'at_risk', label: 'At risk', min: 25 },
    { id: 'stable', label: 'Stable', min: 45 },
    { id: 'building', label: 'Building', min: 60 },
    { id: 'strong', label: 'Strong', min: 80 },
  ] as { id: Exclude<MomentumStateId, 'recovering'>; label: string; min: number }[],
  /** Below this score, a positive 7-day delta is reported as "Recovering". */
  recovering: {
    maxScore: 60,
    minDelta: 2,
  },
} as const;

export const readinessConfig = {
  weights: {
    sleepDuration: 0.25,
    sleepQuality: 0.2,
    energy: 0.25,
    soreness: 0.15,
    stress: 0.1,
    motivation: 0.05,
  },
  /** Sleep hours mapped linearly between these bounds. */
  sleep: {
    poor: 4.5,
    good: 8,
  },
  /** Days of check-ins used for the personal baseline. */
  baselineDays: 21,
  minBaselineSamples: 3,
} as const;

export const recommendationConfig = {
  /** Readiness below this, with recent training load, suggests recovery. */
  recoveryThreshold: 35,
  reducedThreshold: 55,
  /** Consecutive training days after which a break is suggested. */
  maxConsecutiveDays: 5,
  /** Days without training after which returning takes priority. */
  inactivityNudgeDays: 4,
  reducedSessionRatio: 0.65,
  recoverySessionMinutes: 25,
} as const;

export const comebackConfig = {
  weights: {
    strength: 0.5,
    volume: 0.3,
    frequency: 0.2,
  },
  /** Sessions needed before an observed baseline is trusted. */
  baselineSessions: 3,
  confidence: {
    mediumExercises: 3,
    highExercises: 5,
    mediumSessions: 6,
    highSessions: 12,
  },
  /** Ratios are clamped here before weighting, so one lift cannot run away. */
  maxComponentRatio: 1.2,
} as const;

export const trajectoryConfig = {
  /** Effective weekly session rate is never assumed to be below this. */
  minWeeklyRate: 0.5,
  /** Estimates are not shown as precise beyond this horizon. */
  maxHorizonWeeks: 104,
  /** Weeks of history required before the estimate stops being "low". */
  mediumWeeks: 3,
  highWeeks: 8,
} as const;

export const trainingConfig = {
  defaultRestSeconds: 120,
  /** Epley coefficient for the estimated 1RM. */
  e1rmCoefficient: 30,
  /** Reps above this make the 1RM estimate unreliable. */
  maxRepsForE1rm: 12,
} as const;
