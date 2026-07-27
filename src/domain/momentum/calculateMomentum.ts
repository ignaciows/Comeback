import { momentumConfig } from '@/domain/config';
import type {
  Confidence,
  ISODate,
  MomentumComponents,
  MomentumFactor,
  MomentumStateId,
} from '@/domain/types';
import { daysBetween } from '@/utils/date';
import { clamp, round, sum } from '@/utils/math';
import {
  calculateAdherenceScore,
  calculateConsistencyScore,
  calculateLoggingScore,
  calculateProgressionScore,
  calculateRecoveryScore,
  type PlannedOutcome,
  type ReadinessPoint,
  type SessionSummary,
} from './components';

export type MomentumInput = {
  date: ISODate;
  planned: PlannedOutcome[];
  sessions: SessionSummary[];
  readiness: ReadinessPoint[];
  targetSessionsPerWeek: number;
  /** Yesterday's smoothed score, or null on the very first evaluation. */
  previousScore: number | null;
};

export type MomentumResult = {
  /** Smoothed, capped score the product shows. */
  score: number;
  /** Unsmoothed weighted score, kept for debugging and explanations. */
  rawScore: number;
  previousScore: number | null;
  delta: number;
  state: MomentumStateId;
  components: MomentumComponents;
  confidence: Confidence;
  factors: MomentumFactor[];
  explanation: string;
};

type ComponentKey = keyof MomentumComponents;

const COMPONENT_LABELS: Record<ComponentKey, string> = {
  adherence: 'Plan adherence',
  consistency: 'Recent consistency',
  progression: 'Performance progression',
  recovery: 'Recovery',
  logging: 'Logging regularity',
};

/**
 * Weighted blend of the available components. Components with no data are
 * dropped and their weight is shared across the rest, so a missing signal never
 * silently reads as zero.
 */
export function combineComponents(components: MomentumComponents): number | null {
  const candidates: { key: ComponentKey; value: number | null; weight: number }[] = (
    Object.keys(components) as ComponentKey[]
  ).map((key) => ({ key, value: components[key], weight: momentumConfig.weights[key] }));

  const entries = candidates.filter(
    (entry): entry is { key: ComponentKey; value: number; weight: number } => entry.value !== null,
  );

  if (entries.length === 0) return null;
  const weightSum = sum(entries.map((entry) => entry.weight));
  return round(clamp(sum(entries.map((entry) => entry.value * entry.weight)) / weightSum, 0, 100), 1);
}

/**
 * Applies exponential smoothing and the daily change cap. This is what keeps a
 * single session — good or bad — from swinging the score.
 */
export function calculateMomentumDelta(previousScore: number | null, rawScore: number): number {
  if (previousScore === null) return 0;
  const smoothed = previousScore + momentumConfig.smoothingAlpha * (rawScore - previousScore);
  const capped = clamp(
    smoothed,
    previousScore - momentumConfig.maxDailyChange,
    previousScore + momentumConfig.maxDailyChange,
  );
  return round(capped - previousScore, 1);
}

/**
 * `recentDelta` is the rise over whatever window the caller has — the daily
 * delta during a single evaluation, or the 7-day delta when history exists.
 * A low but rising score reads as "Recovering" rather than "At risk".
 */
export function momentumState(score: number, recentDelta = 0): MomentumStateId {
  const { states, recovering } = momentumConfig;
  if (score < recovering.maxScore && recentDelta >= recovering.minDelta) return 'recovering';
  let state: MomentumStateId = states[0].id;
  for (const range of states) {
    if (score >= range.min) state = range.id;
  }
  return state;
}

export function momentumStateLabel(state: MomentumStateId): string {
  if (state === 'recovering') return 'Recovering';
  return momentumConfig.states.find((range) => range.id === state)?.label ?? 'Stable';
}

function determineConfidence(input: MomentumInput): Confidence {
  const { confidence } = momentumConfig;
  const dataDays = new Set([
    ...input.sessions
      .filter((session) => daysBetween(session.date, input.date) < 28)
      .map((session) => session.date),
    ...input.readiness
      .filter((point) => point.score !== null && daysBetween(point.date, input.date) < 28)
      .map((point) => point.date),
  ]).size;

  const checkins = input.readiness.filter(
    (point) => point.score !== null && daysBetween(point.date, input.date) < 28,
  ).length;

  if (dataDays >= confidence.highDays && checkins >= confidence.highCheckins) return 'high';
  if (dataDays >= confidence.mediumDays && checkins >= confidence.mediumCheckins) return 'medium';
  return 'low';
}

function buildFactors(input: MomentumInput, components: MomentumComponents): MomentumFactor[] {
  const factors: MomentumFactor[] = [];
  const { neutralScore } = momentumConfig;

  for (const key of Object.keys(components) as ComponentKey[]) {
    const value = components[key];
    if (value === null) {
      factors.push({
        key,
        label: COMPONENT_LABELS[key],
        direction: 'neutral',
        detail: 'Not enough data yet',
      });
      continue;
    }
    const direction = value >= neutralScore + 5 ? 'positive' : value <= neutralScore - 5 ? 'negative' : 'neutral';
    factors.push({
      key,
      label: COMPONENT_LABELS[key],
      direction,
      detail: `${Math.round(value)} / 100`,
    });
  }

  // Event-level context, which components alone do not convey.
  const trainedToday = input.sessions.some((session) => session.date === input.date);
  if (trainedToday) {
    factors.push({
      key: 'session_today',
      label: 'Session completed today',
      direction: 'positive',
      detail: 'Counted towards adherence and consistency',
    });
  }

  const skippedRecently = input.planned.filter(
    (outcome) => outcome.status === 'skipped' && daysBetween(outcome.date, input.date) < 7,
  ).length;
  if (skippedRecently > 0) {
    factors.push({
      key: 'skipped_sessions',
      label: `${skippedRecently} session${skippedRecently > 1 ? 's' : ''} skipped this week`,
      direction: 'negative',
      detail: 'Skipped sessions cost more than rescheduled ones',
    });
  }

  const rescheduledRecently = input.planned.filter(
    (outcome) => outcome.status === 'rescheduled' && daysBetween(outcome.date, input.date) < 7,
  ).length;
  if (rescheduledRecently > 0) {
    factors.push({
      key: 'rescheduled_sessions',
      label: `${rescheduledRecently} session${rescheduledRecently > 1 ? 's' : ''} rescheduled`,
      direction: 'neutral',
      detail: 'Partial credit kept',
    });
  }

  const lastSession = [...input.sessions].sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  const inactiveDays = lastSession ? daysBetween(lastSession.date, input.date) : null;
  if (inactiveDays !== null && inactiveDays >= 3) {
    factors.push({
      key: 'inactivity',
      label: `${inactiveDays} days since your last session`,
      direction: 'negative',
      detail: 'Consistency decays while inactive',
    });
  }

  return factors;
}

function buildExplanation(delta: number, factors: MomentumFactor[], confidence: Confidence): string {
  const rounded = Math.abs(round(delta, 1));
  const positives = factors.filter((factor) => factor.direction === 'positive');
  const negatives = factors.filter((factor) => factor.direction === 'negative');

  const phrase = (list: MomentumFactor[]) =>
    list
      .slice(0, 2)
      .map((factor) => factor.label.toLowerCase())
      .join(' and ');

  if (rounded < 0.1) {
    const stable = negatives.length > 0 ? `${phrase(negatives)} offset your recent work` : 'nothing changed materially';
    return `Momentum is unchanged because ${stable}.`;
  }

  const direction = delta > 0 ? 'increased' : 'decreased';
  const drivers = delta > 0 ? positives : negatives;
  const reason = drivers.length > 0 ? phrase(drivers) : 'your recent training pattern';
  const caveat = confidence === 'low' ? ' Confidence is low — there is little data so far.' : '';
  return `Momentum ${direction} by ${rounded} because of ${reason}.${caveat}`;
}

/**
 * The full daily momentum evaluation: components, weighted score, smoothing,
 * state, confidence and a written explanation of what moved it.
 */
export function calculateMomentumScore(input: MomentumInput): MomentumResult {
  const progression = calculateProgressionScore(input.sessions, input.date);

  const components: MomentumComponents = {
    adherence: calculateAdherenceScore(input.planned, input.date),
    consistency: calculateConsistencyScore(input.sessions, input.date, input.targetSessionsPerWeek),
    progression: progression.score,
    recovery: calculateRecoveryScore(input.readiness, input.date),
    logging: calculateLoggingScore(
      input.readiness,
      input.sessions,
      input.date,
      input.targetSessionsPerWeek,
    ),
  };

  const combined = combineComponents(components);
  const rawScore = combined ?? momentumConfig.neutralScore;
  const delta = calculateMomentumDelta(input.previousScore, rawScore);
  const score =
    input.previousScore === null ? round(rawScore, 1) : round(input.previousScore + delta, 1);

  const confidence = determineConfidence(input);
  const factors = buildFactors(input, components);

  return {
    score,
    rawScore,
    previousScore: input.previousScore,
    delta,
    state: momentumState(score, delta),
    components,
    confidence,
    factors,
    explanation: buildExplanation(delta, factors, confidence),
  };
}
