import { describe, expect, it } from 'vitest';

import { complianceOf, evaluateCommitments, requiredSessionsPerWeek } from '@/domain/plan/commitments';
import { buildRamp, currentRampTarget, observedSessionsPerWeek } from '@/domain/plan/ramp';
import { judgePlan } from '@/domain/plan/verdict';
import type { DailyCheckin, WorkoutSession } from '@/domain/types';

function session(date: string, options: { logged?: boolean } = {}): WorkoutSession {
  const { logged = true } = options;
  return {
    id: `s-${date}`,
    date,
    startedAt: `${date}T18:00:00.000Z`,
    endedAt: `${date}T19:00:00.000Z`,
    name: 'Session',
    routineId: 'r1',
    routineDayId: 'd1',
    plannedSessionId: null,
    intent: 'full',
    status: 'completed',
    notes: null,
    exercises: [
      {
        id: 'we1',
        exerciseId: 'barbell_bench_press',
        order: 0,
        substitutedFrom: null,
        note: null,
        sets: [
          {
            id: 'set1',
            order: 0,
            weightKg: logged ? 60 : null,
            reps: logged ? 8 : null,
            rir: null,
            warmup: false,
            completed: true,
            completedAt: `${date}T18:30:00.000Z`,
          },
        ],
      },
    ],
  };
}

/** Sessions spread evenly over the four weeks before `today`. */
function weeklySessions(perWeek: number, today: string, options: { logged?: boolean } = {}): WorkoutSession[] {
  const end = new Date(`${today}T00:00:00`);
  const out: WorkoutSession[] = [];
  for (let week = 0; week < 4; week += 1) {
    for (let index = 0; index < perWeek; index += 1) {
      const date = new Date(end);
      date.setDate(date.getDate() - (week * 7 + index + 1));
      out.push(session(date.toISOString().slice(0, 10), options));
    }
  }
  return out;
}

const TODAY = '2026-04-01';

describe('what a plan asks for', () => {
  it('asks for more sessions the faster the pace', () => {
    expect(requiredSessionsPerWeek('build', 'cautious')).toBe(3);
    expect(requiredSessionsPerWeek('build', 'max')).toBe(6);
    expect(requiredSessionsPerWeek('lean', 'cautious')).toBeLessThan(
      requiredSessionsPerWeek('recomp', 'cautious'),
    );
  });

  it('measures the frequency it can see', () => {
    const commitments = evaluateCommitments({
      today: TODAY,
      sessions: weeklySessions(4, TODAY),
      checkins: [],
      requiredSessions: 4,
      requiredKcal: 2800,
      requiredProteinG: 160,
    });

    const frequency = commitments.find((entry) => entry.id === 'frequency');
    expect(frequency?.observed).toBe(4);
    expect(frequency?.met).toBe(true);
  });

  it('says a plan is not being met when it is not', () => {
    const commitments = evaluateCommitments({
      today: TODAY,
      sessions: weeklySessions(2, TODAY),
      checkins: [],
      requiredSessions: 5,
      requiredKcal: 2800,
      requiredProteinG: 160,
    });

    const frequency = commitments.find((entry) => entry.id === 'frequency');
    expect(frequency?.observed).toBe(2);
    expect(frequency?.met).toBe(false);
  });

  it('never claims to know what you ate', () => {
    const commitments = evaluateCommitments({
      today: TODAY,
      sessions: weeklySessions(4, TODAY),
      checkins: [],
      requiredSessions: 4,
      requiredKcal: 2800,
      requiredProteinG: 160,
    });

    for (const id of ['calories', 'protein'] as const) {
      const entry = commitments.find((item) => item.id === id);
      expect(entry?.observed).toBeNull();
      expect(entry?.met).toBeNull();
      expect(entry?.note).toMatch(/not tracked/i);
    }
    // And they are excluded from the score rather than counted as failures.
    expect(complianceOf(commitments)).toBe(1);
  });

  it('notices training without logging', () => {
    const commitments = evaluateCommitments({
      today: TODAY,
      sessions: weeklySessions(4, TODAY, { logged: false }),
      checkins: [],
      requiredSessions: 4,
      requiredKcal: 2800,
      requiredProteinG: 160,
    });

    const logging = commitments.find((entry) => entry.id === 'logging');
    expect(logging?.observed).toBe(0);
    expect(logging?.met).toBe(false);
  });

  it('waits for three nights before averaging sleep', () => {
    const checkin = (date: string, hours: number | null): DailyCheckin => ({
      id: date,
      date,
      sleepHours: hours,
      sleepQuality: null,
      energy: null,
      soreness: null,
      stress: null,
      motivation: null,
      source: 'manual',
      createdAt: '',
      updatedAt: '',
    });

    const two = evaluateCommitments({
      today: TODAY,
      sessions: [],
      checkins: [checkin('2026-03-30', 7), checkin('2026-03-31', 8)],
      requiredSessions: 4,
      requiredKcal: 2800,
      requiredProteinG: 160,
    });
    expect(two.find((entry) => entry.id === 'sleep')?.observed).toBeNull();

    const three = evaluateCommitments({
      today: TODAY,
      sessions: [],
      checkins: [checkin('2026-03-29', 6), checkin('2026-03-30', 7), checkin('2026-03-31', 8)],
      requiredSessions: 4,
      requiredKcal: 2800,
      requiredProteinG: 160,
    });
    expect(three.find((entry) => entry.id === 'sleep')?.observed).toBe(7);
  });

  it('measures nothing at all before the first session', () => {
    const commitments = evaluateCommitments({
      today: TODAY,
      sessions: [],
      checkins: [],
      requiredSessions: 4,
      requiredKcal: 2800,
      requiredProteinG: 160,
    });

    expect(commitments.find((entry) => entry.id === 'frequency')?.met).toBeNull();
    expect(complianceOf(commitments)).toBeNull();
  });
});

describe('the climb to the required frequency', () => {
  it('adds one session every two weeks', () => {
    const ramp = buildRamp({ today: TODAY, startDays: 2, targetDays: 5 });
    const sessionsByWeek = ramp.steps.map((step) => step.sessions);

    expect(sessionsByWeek).toEqual([2, 2, 3, 3, 4, 4, 5]);
    expect(ramp.weeksToTarget).toBe(6);
    expect(ramp.steps[ramp.steps.length - 1].atTarget).toBe(true);
  });

  it('does not climb when you are already there', () => {
    const ramp = buildRamp({ today: TODAY, startDays: 5, targetDays: 4 });
    expect(ramp.steps).toHaveLength(1);
    expect(ramp.steps[0].sessions).toBe(4);
    expect(ramp.weeksToTarget).toBe(0);
  });

  it('asks for this week, not the final number', () => {
    const ramp = buildRamp({ today: '2026-04-01', startDays: 2, targetDays: 5 });
    expect(currentRampTarget(ramp, '2026-04-01')).toBe(2);
    // Two weeks in.
    expect(currentRampTarget(ramp, '2026-04-15')).toBe(3);
    // Long past the end it holds at the full requirement.
    expect(currentRampTarget(ramp, '2026-09-01')).toBe(5);
  });

  it('starts from what you actually do', () => {
    // Three a week for the last three weeks.
    expect(observedSessionsPerWeek(weeklySessions(3, TODAY), TODAY)).toBeGreaterThanOrEqual(2.5);
    // One session is not a rate.
    expect(observedSessionsPerWeek([session('2026-03-30')], TODAY)).toBeNull();
    expect(observedSessionsPerWeek([], TODAY)).toBeNull();
  });
});

describe('is this the plan you are actually on', () => {
  const commitmentsFor = (perWeek: number, required: number, logged = true) =>
    evaluateCommitments({
      today: TODAY,
      sessions: weeklySessions(perWeek, TODAY, { logged }),
      checkins: [],
      requiredSessions: required,
      requiredKcal: 2800,
      requiredProteinG: 160,
    });

  it('says nothing before there is history to say it from', () => {
    const verdict = judgePlan({
      today: TODAY,
      sessions: [session('2026-03-30')],
      commitments: commitmentsFor(1, 4),
      currentTarget: 4,
      requiredSessions: 4,
      speed: 'steady',
      momentum: null,
      readinessVsBaseline: null,
    });

    expect(verdict.state).toBe('establishing');
    expect(verdict.action).toBeNull();
  });

  it('confirms a plan that is being met', () => {
    const verdict = judgePlan({
      today: TODAY,
      sessions: weeklySessions(4, TODAY),
      commitments: commitmentsFor(4, 4),
      currentTarget: 4,
      requiredSessions: 4,
      speed: 'steady',
      momentum: 55,
      readinessVsBaseline: 0,
    });

    expect(verdict.state).toBe('on_track');
    expect(verdict.action).toBeNull();
  });

  it('offers the plan you are actually doing when the gap is large', () => {
    const verdict = judgePlan({
      today: TODAY,
      sessions: weeklySessions(2, TODAY),
      commitments: commitmentsFor(2, 5),
      currentTarget: 5,
      requiredSessions: 5,
      speed: 'fast',
      momentum: 40,
      readinessVsBaseline: 0,
    });

    expect(verdict.state).toBe('too_demanding');
    expect(verdict.action).toEqual({ kind: 'lower_frequency', toSessions: 2 });
    expect(verdict.detail).toMatch(/2 sessions a week against 5/);
  });

  it('does not demote someone who is only slightly behind', () => {
    const verdict = judgePlan({
      today: TODAY,
      sessions: weeklySessions(3, TODAY),
      commitments: commitmentsFor(3, 4),
      currentTarget: 4,
      requiredSessions: 4,
      speed: 'steady',
      momentum: 50,
      readinessVsBaseline: 0,
    });

    expect(verdict.state).toBe('slipping');
    expect(verdict.action).toBeNull();
    // The distinction that keeps people going.
    expect(verdict.detail).toMatch(/pace that slipped, not the progress/);
  });

  it('offers to speed up someone clearing the bar with recovery to spare', () => {
    const verdict = judgePlan({
      today: TODAY,
      sessions: weeklySessions(5, TODAY),
      commitments: commitmentsFor(5, 4),
      currentTarget: 4,
      requiredSessions: 4,
      speed: 'steady',
      momentum: 78,
      readinessVsBaseline: 0.2,
    });

    expect(verdict.state).toBe('ahead');
    expect(verdict.action).toEqual({ kind: 'accelerate', toSpeed: 'fast' });
  });

  it('will not speed up someone whose recovery is going backwards', () => {
    const verdict = judgePlan({
      today: TODAY,
      sessions: weeklySessions(5, TODAY),
      commitments: commitmentsFor(5, 4),
      currentTarget: 4,
      requiredSessions: 4,
      speed: 'steady',
      momentum: 78,
      readinessVsBaseline: -0.4,
    });

    expect(verdict.state).not.toBe('ahead');
  });

  it('has nothing faster to offer at the top pace', () => {
    const verdict = judgePlan({
      today: TODAY,
      sessions: weeklySessions(6, TODAY),
      commitments: commitmentsFor(6, 6),
      currentTarget: 6,
      requiredSessions: 6,
      speed: 'max',
      momentum: 80,
      readinessVsBaseline: 0.3,
    });

    expect(verdict.state).toBe('ahead');
    expect(verdict.action).toBeNull();
  });

  it('raises logging above everything else, since nothing works without it', () => {
    const verdict = judgePlan({
      today: TODAY,
      sessions: weeklySessions(4, TODAY, { logged: false }),
      commitments: commitmentsFor(4, 4, false),
      currentTarget: 4,
      requiredSessions: 4,
      speed: 'steady',
      momentum: 60,
      readinessVsBaseline: 0,
    });

    expect(verdict.action).toEqual({ kind: 'log_more' });
  });
});
