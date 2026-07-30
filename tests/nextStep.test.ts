import { describe, expect, it } from 'vitest';

import { deriveSetupSteps, deriveTodayStep, setupProgress, type NextStepInput } from '@/domain/nextStep';
import type { BodyMeasurement, DailyCheckin, Gym, PlannedSession, WorkoutSession } from '@/domain/types';

const TODAY = '2026-06-10';

const weight = (date: string): BodyMeasurement => ({
  id: date,
  date,
  weightKg: 77,
  bodyFatPercent: null,
  source: 'manual',
  createdAt: '',
});

const gym: Gym = { id: 'g1', name: 'McFit', equipment: {}, createdAt: '', updatedAt: '' };

const checkin = (date: string): DailyCheckin => ({
  id: date,
  date,
  sleepHours: 7,
  sleepQuality: 4,
  energy: 4,
  soreness: 2,
  stress: 2,
  motivation: 4,
  source: 'manual',
  createdAt: '',
  updatedAt: '',
});

const session = (date: string): WorkoutSession => ({
  id: date,
  date,
  startedAt: `${date}T18:00:00.000Z`,
  endedAt: `${date}T19:00:00.000Z`,
  name: 'Session',
  routineId: null,
  routineDayId: null,
  plannedSessionId: null,
  intent: 'full',
  status: 'completed',
  notes: null,
  pauses: [],
  exercises: [],
});

const planned = (date: string): PlannedSession => ({
  id: date,
  date,
  routineId: null,
  routineDayId: null,
  status: 'planned',
  sessionId: null,
  rescheduledToDate: null,
  createdAt: '',
  updatedAt: '',
});

/** Everything set up, nothing done today. */
const ready: NextStepInput = {
  today: TODAY,
  profile: null,
  goal: null,
  gyms: [gym],
  routines: [{ id: 'r1', name: 'Upper / Lower', daysPerWeek: 4, days: [], createdAt: '', updatedAt: '', deletedAt: null }],
  measurements: [weight(TODAY)],
  // Assumed done in the shared fixture; the step that offers it has its own test.
  hasAssessment: true,
  checkins: [],
  sessions: [],
  plannedSessions: [],
  hasRoute: true,
  activeSessionId: null,
};

const blank: NextStepInput = {
  ...ready,
  gyms: [],
  routines: [],
  measurements: [],
  hasRoute: false,
  hasAssessment: true,
};

describe('setting the app up', () => {
  it('offers the strength assessment once there is a gym, and stops once it is done', () => {
    // It needs a gym first — measuring lifts you have no equipment for is
    // theatre — and it must disappear afterwards rather than nagging.
    const before = deriveSetupSteps({ ...ready, hasAssessment: false });
    expect(before.some((step) => step.id === 'assessment')).toBe(true);

    const after = deriveSetupSteps({ ...ready, hasAssessment: true });
    expect(after.some((step) => step.id === 'assessment')).toBe(false);

    const noGym = deriveSetupSteps({ ...ready, gyms: [], hasAssessment: false });
    expect(noGym.some((step) => step.id === 'assessment')).toBe(false);
  });

  it('asks for weight before anything else', () => {
    const steps = deriveSetupSteps(blank);
    // Nothing can be projected without it, so it outranks the rest.
    expect(steps[0].id).toBe('weight');
  });

  it('asks for the gym before the plan', () => {
    const steps = deriveSetupSteps({ ...blank, measurements: [weight(TODAY)] });
    // The plan is built from what you can actually lift with.
    expect(steps.map((step) => step.id)).toEqual(['gym', 'plan']);
  });

  it('stops asking once each thing is done', () => {
    expect(deriveSetupSteps(ready)).toEqual([]);
    expect(setupProgress(ready)).toBe(1);
    expect(setupProgress(blank)).toBe(0);
  });

  it('counts partial setup honestly', () => {
    const half = { ...blank, measurements: [weight(TODAY)], gyms: [gym] };
    expect(setupProgress(half)).toBe(0.5);
  });

  it('does not hold setup up for something optional', () => {
    // Muscle focus is offered but never counted against you.
    const withRoutine = { ...ready, goal: { muscleFocus: [] } as never };
    expect(setupProgress(withRoutine)).toBe(1);
  });
});

describe('the one thing to do now', () => {
  it('always returns exactly one thing', () => {
    for (const input of [blank, ready, { ...ready, sessions: [session(TODAY)] }]) {
      expect(deriveTodayStep(input)).not.toBeNull();
    }
  });

  it('finishes setting up before recommending a session', () => {
    const withSession = { ...blank, plannedSessions: [planned(TODAY)] };
    expect(deriveTodayStep(withSession)?.id).toBe('weight');
  });

  it('sends you back to a session that is still running', () => {
    expect(deriveTodayStep({ ...ready, activeSessionId: 's1' })?.id).toBe('resume');
  });

  it('points at today’s session when there is one', () => {
    expect(deriveTodayStep({ ...ready, plannedSessions: [planned(TODAY)] })?.id).toBe('train');
  });

  it('asks for the check-in on a day with nothing scheduled', () => {
    expect(deriveTodayStep(ready)?.id).toBe('checkin');
  });

  it('does not ask for a check-in after you have already trained', () => {
    const trained = { ...ready, sessions: [session(TODAY)] };
    expect(deriveTodayStep(trained)?.id).not.toBe('checkin');
  });

  it('asks for a weigh-in once a week has gone by', () => {
    const stale = {
      ...ready,
      measurements: [weight('2026-06-01')],
      checkins: [checkin(TODAY)],
    };
    expect(deriveTodayStep(stale)?.id).toBe('weigh_in');
  });

  it('treats a rest day as an answer, not an empty screen', () => {
    const resting = {
      ...ready,
      checkins: [checkin(TODAY)],
      sessions: [session('2026-06-09')],
    };
    const step = deriveTodayStep(resting);

    expect(step?.id).toBe('rest');
    expect(step?.why).toMatch(/rest counts/i);
  });

  it('never scolds', () => {
    // Aimed at the user, not at the session: "how hard today should be" is a
    // statement about the workout, while "you should" is a telling-off.
    const scolding = /you (should|must|need to|have to)|failed|falling behind|you missed/i;
    const inputs = [
      blank,
      ready,
      { ...ready, sessions: [session(TODAY)] },
      { ...ready, checkins: [checkin(TODAY)], sessions: [session('2026-06-09')] },
      { ...ready, measurements: [weight('2026-06-01')], checkins: [checkin(TODAY)] },
    ];

    for (const input of inputs) {
      const step = deriveTodayStep(input);
      expect(step?.why).not.toMatch(scolding);
      expect(step?.label).not.toMatch(scolding);
    }
  });
});
