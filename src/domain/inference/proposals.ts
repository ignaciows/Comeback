import type { TrainingPreferences, UserPreferences } from '@/domain/types';
import { getExercise } from '@/data/exercises';
import { weekdayLabel } from '@/utils/date';
import { formatTimeOfDay, type Observations } from './observations';

/**
 * Turning what the app noticed into what the app does.
 *
 * Observations on their own are trivia. These are the changes they justify,
 * expressed as data so the store applies them and the screen can explain them
 * in the same words.
 *
 * The split that matters is `auto` versus `ask`:
 *  · `auto` — the app is correcting its own assumption with measured fact. Rest
 *    length and session length were guesses on day one; once there is evidence,
 *    keeping the guess would be the strange choice.
 *  · `ask` — the change alters what the user is committing to. Training days
 *    and dropped exercises are theirs to confirm.
 *
 * Nothing here silently changes a goal, a target or a calorie number.
 */

export type Proposal = {
  id: string;
  kind: 'auto' | 'ask';
  /** A few words, no sentence. */
  headline: string;
  /** Why — one line, always naming the evidence. */
  detail: string;
  change: Change;
};

export type Change =
  | { type: 'training_weekdays'; weekdays: number[] }
  | { type: 'session_minutes'; minutes: number }
  | { type: 'rest_seconds'; seconds: number }
  | { type: 'drop_exercise'; exerciseId: string }
  | { type: 'days_per_week'; days: number };

export type ProposalInput = {
  observations: Observations;
  training: TrainingPreferences;
  preferences: UserPreferences;
};

/** Rest defaults are rounded to something a person would actually pick. */
function roundRest(seconds: number): number {
  return Math.max(45, Math.min(300, Math.round(seconds / 15) * 15));
}

export function deriveProposals({ observations, training, preferences }: ProposalInput): Proposal[] {
  const proposals: Proposal[] = [];
  const { trainingTime, weekdays, sessionLength, restSeconds, avoided } = observations;

  // --- The days you actually train ---------------------------------------
  if (weekdays && weekdays.sampleSize >= 6 && weekdays.concentration >= 0.7) {
    const declared = [...training.preferredWeekdays].sort((a, b) => a - b).join(',');
    const observed = [...weekdays.weekdays].sort((a, b) => a - b).join(',');
    if (declared !== observed && weekdays.weekdays.length >= 2) {
      proposals.push({
        id: 'weekdays',
        kind: 'ask',
        headline: `Move your week to ${weekdays.weekdays.map(weekdayLabel).join(', ')}`,
        detail: `That is when ${Math.round(weekdays.concentration * 100)}% of your last ${weekdays.sampleSize} sessions happened.`,
        change: { type: 'training_weekdays', weekdays: weekdays.weekdays },
      });
    }
  }

  // --- How many days a week you are really doing --------------------------
  if (weekdays && weekdays.sampleSize >= 8) {
    const observedDays = weekdays.weekdays.length;
    if (Math.abs(observedDays - training.preferredDaysPerWeek) >= 2) {
      proposals.push({
        id: 'days_per_week',
        kind: 'ask',
        headline: `You are training ${observedDays} days, not ${training.preferredDaysPerWeek}`,
        detail: 'The plan and its dates are built on the number you set, not the one you do.',
        change: { type: 'days_per_week', days: observedDays },
      });
    }
  }

  // --- How long a session actually takes ----------------------------------
  if (sessionLength !== null && Math.abs(sessionLength - training.sessionMinutes) >= 12) {
    proposals.push({
      id: 'session_minutes',
      kind: 'auto',
      headline: `Sessions take you ${sessionLength} minutes`,
      detail: `The app was working from ${training.sessionMinutes}. Using the measured one.`,
      change: { type: 'session_minutes', minutes: sessionLength },
    });
  }

  // --- How long you actually rest -----------------------------------------
  if (restSeconds !== null) {
    const rounded = roundRest(restSeconds);
    if (Math.abs(rounded - preferences.defaultRestSeconds) >= 30) {
      proposals.push({
        id: 'rest_seconds',
        kind: 'auto',
        headline: `You rest about ${rounded} seconds`,
        detail: `The timer was set to ${preferences.defaultRestSeconds}. Matching what you do.`,
        change: { type: 'rest_seconds', seconds: rounded },
      });
    }
  }

  // --- Something you keep refusing to do ----------------------------------
  const worstAvoided = avoided.find((entry) => entry.times >= 3);
  if (worstAvoided) {
    const exercise = getExercise(worstAvoided.exerciseId);
    if (exercise) {
      proposals.push({
        id: `drop_${exercise.id}`,
        kind: 'ask',
        headline: `Drop ${exercise.name}`,
        detail: `Swapped or skipped ${worstAvoided.times} times. Something else can cover ${exercise.primaryMuscle}.`,
        change: { type: 'drop_exercise', exerciseId: exercise.id },
      });
    }
  }

  void trainingTime;
  return proposals;
}

/** When to nudge, derived rather than asked. Null until there is a pattern. */
export function deriveReminder(
  observations: Observations,
): { hour: number; minute: number; weekdays: number[]; label: string } | null {
  const { trainingTime, weekdays } = observations;
  if (!trainingTime || !weekdays) return null;
  // A start time that swings by more than two hours is not a habit to remind against.
  if (trainingTime.spreadMinutes > 120) return null;
  if (trainingTime.sampleSize < 5) return null;

  // Half an hour before, so there is time to leave.
  const total = trainingTime.hour * 60 + trainingTime.minute - 30;
  const minutes = (total + 1440) % 1440;

  return {
    hour: Math.floor(minutes / 60),
    minute: minutes % 60,
    weekdays: weekdays.weekdays,
    label: `You usually train around ${formatTimeOfDay(trainingTime)}`,
  };
}
