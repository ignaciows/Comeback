import { describe, expect, it } from 'vitest';

import { replanWeek, type WeekInput } from '@/domain/plan/week';

/** Monday 2026-06-01 through Sunday 2026-06-07. */
const MONDAY = '2026-06-01';

const input = (patch: Partial<WeekInput> = {}): WeekInput => ({
  today: MONDAY,
  weekStart: MONDAY,
  target: 5,
  completedDates: [],
  preferredWeekdays: [1, 2, 3, 5, 6],
  routineDayIds: ['upper-a', 'lower-a', 'push', 'pull', 'legs'],
  ...patch,
});

const trainingDays = (plan: ReturnType<typeof replanWeek>) =>
  plan.days.filter((day) => day.state === 'today' || day.state === 'planned');

describe('the week rearranges itself as days go by', () => {
  it('lays out the full target at the start of the week', () => {
    const plan = replanWeek(input());

    expect(trainingDays(plan)).toHaveLength(5);
    expect(plan.onTrack).toBe(true);
    expect(plan.revisedTarget).toBe(5);
  });

  it('keeps the target after one missed day, and says where the sessions moved', () => {
    // Missed Monday. Five still fits in Tuesday to Sunday.
    const plan = replanWeek(input({ today: '2026-06-02' }));

    expect(plan.revisedTarget).toBe(5);
    expect(plan.onTrack).toBe(true);
    expect(trainingDays(plan)).toHaveLength(5);
    expect(plan.days[0].state).toBe('missed');
  });

  it('warns once the week has no slack left, without lowering the target', () => {
    // Wednesday, nothing done, five days left and five sessions wanted.
    const plan = replanWeek(input({ today: '2026-06-03' }));

    expect(plan.revisedTarget).toBe(5);
    expect(plan.daysLeft).toBe(5);
    expect(plan.headline).toMatch(/every day now/i);
    expect(plan.detail).toMatch(/no slack/i);
  });

  it('lowers the target rather than asking for two sessions in one day', () => {
    // Friday, nothing done: three days left cannot hold five sessions.
    const plan = replanWeek(input({ today: '2026-06-05' }));

    expect(plan.daysLeft).toBe(3);
    expect(plan.revisedTarget).toBe(3);
    expect(plan.onTrack).toBe(false);
    expect(plan.headline).toMatch(/3 this week, not 5/);
    expect(trainingDays(plan)).toHaveLength(3);
  });

  it('counts what is already done and only plans the rest', () => {
    const plan = replanWeek(
      input({ today: '2026-06-04', completedDates: ['2026-06-01', '2026-06-02'] }),
    );

    expect(plan.done).toBe(2);
    expect(plan.remaining).toBe(3);
    expect(trainingDays(plan)).toHaveLength(3);
    expect(plan.days[0].state).toBe('done');
  });

  it('never plans more sessions than there are days left', () => {
    for (const [today, expected] of [
      ['2026-06-01', 5],
      ['2026-06-04', 4],
      ['2026-06-05', 3],
      ['2026-06-06', 2],
      ['2026-06-07', 1],
    ] as const) {
      const plan = replanWeek(input({ today }));

      expect(trainingDays(plan).length, today).toBeLessThanOrEqual(plan.daysLeft);
      expect(plan.revisedTarget - plan.done, today).toBe(expected);
    }
  });

  it('calls the week finished without calling the rest a debt', () => {
    const plan = replanWeek(
      input({
        today: '2026-06-06',
        completedDates: ['2026-06-01', '2026-06-02', '2026-06-03', '2026-06-04', '2026-06-05'],
      }),
    );

    expect(plan.headline).toMatch(/done/i);
    expect(plan.detail).toMatch(/bonus, not a debt/i);
    expect(trainingDays(plan)).toHaveLength(0);
  });

  it('says next week starts fresh rather than carrying a shortfall', () => {
    // Sunday evening with nothing left to give.
    const plan = replanWeek(input({ today: '2026-06-07', target: 5, completedDates: [] }));
    const sunday = replanWeek({ ...plan_input(), today: '2026-06-07', completedDates: ['2026-06-07'] });

    expect(plan.remaining).toBe(1);
    expect(sunday.remaining).toBe(0);
    expect(sunday.detail).toMatch(/nothing carries over/i);
  });

  it('keeps a rest day a rest day, not a miss', () => {
    // Thursday is not in the preferred weekdays, so skipping it is the plan
    // working, not the user failing.
    const plan = replanWeek(input({ today: '2026-06-05' }));
    const thursday = plan.days.find((day) => day.date === '2026-06-04');

    expect(thursday?.state).toBe('rest');
  });

  it('gives every planned day a routine day, cycling through them', () => {
    const plan = replanWeek(input());
    const ids = trainingDays(plan).map((day) => day.routineDayId);

    expect(ids).toHaveLength(5);
    expect(new Set(ids).size).toBe(5);
    expect(ids[0]).toBe('upper-a');
  });

  it('carries on from where the completed sessions left off', () => {
    const plan = replanWeek(input({ today: '2026-06-03', completedDates: ['2026-06-01', '2026-06-02'] }));

    // Two done, so the next one is the third day of the routine, not the first.
    expect(trainingDays(plan)[0].routineDayId).toBe('push');
  });

  it('always returns seven days, whatever happened', () => {
    for (const today of ['2026-06-01', '2026-06-04', '2026-06-07']) {
      expect(replanWeek(input({ today })).days).toHaveLength(7);
    }
  });

  it('copes with a routine that has no days yet', () => {
    const plan = replanWeek(input({ routineDayIds: [] }));

    expect(trainingDays(plan)).toHaveLength(5);
    expect(trainingDays(plan)[0].routineDayId).toBeNull();
  });
});

function plan_input(): WeekInput {
  return input();
}
