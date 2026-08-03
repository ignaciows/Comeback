import { describe, expect, it } from 'vitest';

import { feelLine, planMilestones, weeksToVisible, type MilestoneInput } from '@/domain/plan/milestones';

const base: MilestoneInput = {
  today: '2026-06-10',
  goalStartedAt: '2026-06-10',
  adherence: 1,
  weeklyRateKg: 0.2,
  currentWeightKg: 80,
  phaseEndsOn: '2026-08-05',
  phaseLabel: 'Build',
  planEndsOn: '2027-01-20',
};

describe('plan milestones', () => {
  it('leads with seeing results, then the phase, then the plan', () => {
    const [see, phase, plan] = planMilestones(base);

    expect(see.key).toBe('see');
    expect(phase.key).toBe('phase');
    expect(plan.key).toBe('plan');

    // The order is fixed by what a person cares about, not by which date
    // lands first — a phase can easily end before anything is visible, and
    // reordering on that would move the headline around week to week.
    expect(plan.days!).toBeGreaterThan(phase.days!);
  });

  it('does not reorder itself when a phase ends before results show', () => {
    const shortPhase = planMilestones({ ...base, phaseEndsOn: '2026-06-24' });
    expect(shortPhase.map((entry) => entry.key)).toEqual(['see', 'phase', 'plan']);
    expect(shortPhase[1].days!).toBeLessThan(shortPhase[0].days!);
  });

  it('counts down as the weeks are actually trained', () => {
    const start = planMilestones(base)[0].days!;
    const sixWeeksIn = planMilestones({ ...base, today: '2026-07-22' })[0].days!;

    expect(sixWeeksIn).toBeLessThan(start);
    // Restarting the count every time the app opens is how a countdown stops
    // meaning anything.
    expect(start - sixWeeksIn).toBe(42);
  });

  it('pushes the date out when the sessions are not happening', () => {
    const consistent = planMilestones(base)[0].days!;
    const patchy = planMilestones({ ...base, adherence: 0.5 })[0].days!;

    expect(patchy).toBeGreaterThan(consistent);
  });

  it('does not model adherence so bad the number stops being a date', () => {
    const barely = planMilestones({ ...base, adherence: 0.05 })[0].days!;
    const floor = planMilestones({ ...base, adherence: 0.4 })[0].days!;

    expect(barely).toBe(floor);
  });

  it('runs cutting on the scale rather than the training clock', () => {
    // Losing shows when enough is gone, not after a fixed number of weeks.
    const fast = weeksToVisible({ adherence: 1, weeklyRateKg: -0.8, currentWeightKg: 80 });
    const slow = weeksToVisible({ adherence: 1, weeklyRateKg: -0.3, currentWeightKg: 80 });

    expect(fast).toBeLessThan(slow);
    // But never so fast that water weight gets called a new body.
    expect(weeksToVisible({ adherence: 1, weeklyRateKg: -3, currentWeightKg: 80 })).toBeGreaterThanOrEqual(4);
  });

  it('says so once you are past the point rather than counting to zero forever', () => {
    const late = planMilestones({ ...base, today: '2026-10-01' })[0];
    expect(late.days).toBe(0);
    expect(late.detail).toContain('Compare a photo');
  });

  it('survives a plan with no phases and no end date', () => {
    const [see, phase, plan] = planMilestones({
      ...base,
      phaseEndsOn: null,
      phaseLabel: null,
      planEndsOn: null,
    });

    expect(see.days).not.toBeNull();
    expect(phase.days).toBeNull();
    expect(plan.days).toBeNull();
    expect(plan.detail).toContain('Set a target');
  });

  it('promises strength before it promises a mirror', () => {
    const line = feelLine({ today: '2026-06-10', goalStartedAt: '2026-06-10', adherence: 1 });
    expect(line).toContain('Strength moves first');

    const later = feelLine({ today: '2026-08-10', goalStartedAt: '2026-06-10', adherence: 1 });
    expect(later).toContain('already climbing');
  });
});
