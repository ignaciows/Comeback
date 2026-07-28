/**
 * Analytics port. No third-party tracker is wired up: the interface exists so
 * one can be added later without scattering calls through the app, and so the
 * event vocabulary is fixed now.
 *
 * Payloads carry counts and identifiers only — never body metrics, check-in
 * values or anything that describes the user's health.
 */

export type AnalyticsEvent =
  | { name: 'onboarding_completed'; daysPerWeek: number; goalType: string }
  | { name: 'daily_checkin_completed'; fieldsLogged: number }
  | { name: 'workout_started'; intent: string; planned: boolean }
  | { name: 'workout_completed'; exercises: number; sets: number; durationMinutes: number | null }
  | { name: 'workout_skipped' }
  | { name: 'workout_rescheduled'; days: number }
  | { name: 'exercise_substituted' }
  | { name: 'body_weight_logged' }
  | { name: 'momentum_viewed'; state: string }
  | { name: 'recommendation_followed'; type: string }
  | { name: 'muscle_focus_set'; count: number }
  | { name: 'proposal_applied'; proposal: string }
  | { name: 'plan_reconfigured'; reason: string };

export interface Analytics {
  track(event: AnalyticsEvent): void;
}

export const noopAnalytics: Analytics = {
  track() {},
};

/** Development sink: prints the event name and its non-sensitive payload. */
export const consoleAnalytics: Analytics = {
  track(event) {
    const { name, ...payload } = event;
    console.log(`[analytics] ${name}`, payload);
  },
};

let current: Analytics = __DEV__ ? consoleAnalytics : noopAnalytics;

export function setAnalytics(implementation: Analytics): void {
  current = implementation;
}

export function track(event: AnalyticsEvent): void {
  current.track(event);
}
