import { describe, expect, it } from 'vitest';

import { HABITS, buildNudges, topNudge, type NudgeInput } from '@/domain/nudges/nudges';
import { TODAY, checkin, daysAgo } from './helpers';
import type { PlannedSession } from '@/domain/types';

const plannedSession: PlannedSession = {
  id: 'planned-1',
  date: TODAY,
  routineId: 'routine-1',
  routineDayId: 'day-1',
  status: 'planned',
  sessionId: null,
  rescheduledToDate: null,
  createdAt: `${TODAY}T06:00:00.000Z`,
  updatedAt: `${TODAY}T06:00:00.000Z`,
};

function input(overrides: Partial<NudgeInput> = {}): NudgeInput {
  return {
    date: TODAY,
    hour: 21,
    checkins: [checkin(daysAgo(1), { sleepHours: 6 }), checkin(daysAgo(2), { sleepHours: 6 })],
    plannedToday: null,
    trainedToday: false,
    momentumScore: 60,
    momentumState: 'building',
    fuelScore: 65,
    weather: null,
    enabledHabits: [],
    wakeHour: 7,
    ...overrides,
  };
}

describe('nudges', () => {
  it('offers the bedtime nudge only in the evening', () => {
    const evening = buildNudges(input({ hour: 22 })).find((nudge) => nudge.kind === 'sleep');
    const midday = buildNudges(input({ hour: 13 })).find((nudge) => nudge.kind === 'sleep');
    expect(evening).toBeDefined();
    expect(midday).toBeUndefined();
  });

  it('handles the after-midnight case without going negative', () => {
    // 01:00 with a 07:00 wake is six hours, not minus eighteen. The baseline is
    // set low so the nudge is not suppressed for offering no gain, which would
    // hide whether the arithmetic wrapped correctly.
    const nudge = buildNudges(
      input({
        hour: 1,
        checkins: [checkin(daysAgo(1), { sleepHours: 4.5 }), checkin(daysAgo(2), { sleepHours: 4.5 })],
      }),
    ).find((entry) => entry.kind === 'sleep');
    expect(nudge?.headline).toContain('6 hours');
  });

  it('stays quiet when it is already too late to help', () => {
    const nudge = buildNudges(input({ hour: 4, wakeHour: 7 })).find((entry) => entry.kind === 'sleep');
    expect(nudge).toBeUndefined();
  });

  it('quotes a gain only when sleeping now beats the recent average', () => {
    const better = buildNudges(input({ hour: 21, wakeHour: 7 })).find((entry) => entry.kind === 'sleep');
    expect(better?.projectedGain).not.toBeNull();

    // Already sleeping well: tonight offers nothing extra, so nothing is said.
    const noGain = buildNudges(
      input({
        hour: 23,
        checkins: [checkin(daysAgo(1), { sleepHours: 8.5 }), checkin(daysAgo(2), { sleepHours: 8.5 })],
      }),
    ).find((entry) => entry.kind === 'sleep');
    expect(noGain).toBeUndefined();
  });

  it('says the gain is unknown rather than inventing one without a baseline', () => {
    const nudge = buildNudges(input({ checkins: [] })).find((entry) => entry.kind === 'sleep');
    expect(nudge?.projectedGain).toBeNull();
  });

  it('frames rain as the reason to go, not an excuse', () => {
    const nudge = buildNudges(
      input({ hour: 17, plannedToday: plannedSession, weather: { condition: 'rain', temperatureC: 9 } }),
    ).find((entry) => entry.kind === 'weather');
    expect(nudge?.headline).toContain('warriors');
  });

  it('never produces a weather nudge on a day with nothing planned', () => {
    const nudge = buildNudges(
      input({ hour: 17, plannedToday: null, weather: { condition: 'rain', temperatureC: 9 } }),
    ).find((entry) => entry.kind === 'weather');
    expect(nudge).toBeUndefined();
  });

  it('drops the weather nudge once the session is done', () => {
    const nudge = buildNudges(
      input({
        hour: 17,
        plannedToday: plannedSession,
        trainedToday: true,
        weather: { condition: 'clear', temperatureC: 20 },
      }),
    ).find((entry) => entry.kind === 'weather');
    expect(nudge).toBeUndefined();
  });

  it('produces nothing about weather when the user has not enabled it', () => {
    const nudges = buildNudges(input({ hour: 17, plannedToday: plannedSession, weather: null }));
    expect(nudges.some((nudge) => nudge.kind === 'weather')).toBe(false);
  });

  it('suggests the habit that addresses the actual gap', () => {
    const barelyLogging = buildNudges(input({ hour: 12, checkins: [] })).find((entry) => entry.kind === 'habit');
    expect(barelyLogging?.id).toBe('habit_daily_checkin');

    const slipping = buildNudges(
      input({
        hour: 12,
        momentumState: 'at_risk',
        checkins: [daysAgo(1), daysAgo(2), daysAgo(3), daysAgo(4)].map((date) => checkin(date)),
      }),
    ).find((entry) => entry.kind === 'habit');
    expect(slipping?.id).toBe('habit_never_two_in_a_row');
  });

  it('does not suggest a habit that is already on', () => {
    const nudge = buildNudges(
      input({ hour: 12, checkins: [], enabledHabits: ['daily_checkin'] }),
    ).find((entry) => entry.kind === 'habit');
    expect(nudge?.id).not.toBe('habit_daily_checkin');
  });

  it('ranks by priority and returns one', () => {
    const nudges = buildNudges(input({ hour: 21, plannedToday: plannedSession }));
    expect(nudges.length).toBeGreaterThan(1);
    for (let index = 1; index < nudges.length; index += 1) {
      expect(nudges[index - 1].priority).toBeGreaterThanOrEqual(nudges[index].priority);
    }
    expect(topNudge(input({ hour: 21, plannedToday: plannedSession }))).toEqual(nudges[0]);
  });

  it('returns null when there is nothing worth saying', () => {
    const quiet = topNudge(
      input({
        hour: 12,
        plannedToday: null,
        checkins: [daysAgo(1), daysAgo(2), daysAgo(3), daysAgo(4)].map((date) => checkin(date)),
        momentumState: 'strong',
        fuelScore: 85,
        enabledHabits: HABITS.map((habit) => habit.id),
      }),
    );
    expect(quiet).toBeNull();
  });
});
