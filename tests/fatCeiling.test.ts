import { describe, expect, it } from 'vitest';

import {
  CEILING_ROUTE_ID,
  CEILING_SWING,
  ceilingRoute,
  planToCeiling,
  weeksOfHeadroom,
  type CeilingInput,
} from '@/domain/plan/fatCeiling';

const input = (patch: Partial<CeilingInput> = {}): CeilingInput => ({
  weightKg: 80,
  bodyFatPercent: 14,
  ceilingPercent: 17,
  buildStrategy: 'lean_bulk',
  cutStrategy: 'cut',
  experience: 'intermediate',
  horizonWeeks: 40,
  ...patch,
});

describe('building up to a fat ceiling', () => {
  it('builds first, then cuts, and keeps alternating', () => {
    // A fast bulk reaches the ceiling inside a normal horizon; a lean one from
    // 14 % does not, which is itself the useful answer and is covered below.
    const plan = planToCeiling(input({ buildStrategy: 'bulk', horizonWeeks: 60 }));

    expect(plan.blocks.length).toBeGreaterThan(1);
    expect(plan.blocks[0].kind).toBe('build');
    expect(plan.blocks[1].kind).toBe('cut');
    expect(plan.warning).toBeNull();
  });

  it('never lets the projection cross the ceiling', () => {
    // The whole point. If a build block ends above the limit, the constraint
    // did nothing.
    for (const ceiling of [12, 15, 17, 20, 25]) {
      const plan = planToCeiling(input({ ceilingPercent: ceiling, bodyFatPercent: 10 }));

      for (const block of plan.blocks) {
        expect(block.endFatPercent, `ceiling ${ceiling}, ${block.label}`).toBeLessThanOrEqual(ceiling + 0.1);
        expect(block.startFatPercent, `ceiling ${ceiling}, ${block.label}`).toBeLessThanOrEqual(ceiling + 0.1);
      }
    }
  });

  it('gives a leaner person a longer run before they have to stop', () => {
    const lean = weeksOfHeadroom({ ...input(), bodyFatPercent: 10 });
    const closer = weeksOfHeadroom({ ...input(), bodyFatPercent: 15 });

    expect(lean).toBeGreaterThan(closer);
    expect(closer).toBeGreaterThan(0);
  });

  it('cuts first, and says why, when you are already over the line', () => {
    const plan = planToCeiling(input({ bodyFatPercent: 22, ceilingPercent: 17 }));

    expect(plan.blocks[0].kind).toBe('cut');
    expect(plan.warning).toMatch(/cuts first/i);
    expect(plan.blocks[0].endFatPercent).toBeLessThan(22);
  });

  it('does not pretend there is room when there is none', () => {
    const plan = planToCeiling(input({ bodyFatPercent: 17, ceilingPercent: 17 }));

    // Sitting exactly on the ceiling, the only honest first move is down.
    expect(plan.blocks[0]?.kind).toBe('cut');
    expect(plan.warning).not.toBeNull();
    expect(weeksOfHeadroom({ ...input(), bodyFatPercent: 17 })).toBe(0);
  });

  it('says how long the run is, and a slow build makes it a long one', () => {
    // The number someone asking "how fast can I build" actually wants: not a
    // rate, but how many weeks they get before they have to stop.
    const weeks = weeksOfHeadroom({ ...input(), buildStrategy: 'lean_bulk', bodyFatPercent: 14 });

    expect(weeks).toBeGreaterThan(30);
  });

  it('cuts back far enough that the next build is worth having', () => {
    const plan = planToCeiling(input({ buildStrategy: 'bulk', horizonWeeks: 60 }));
    const cut = plan.blocks.find((block) => block.kind === 'cut');

    // Cutting to exactly the ceiling would mean building for a week and
    // cutting again — all the disruption, none of the progress.
    expect(cut).toBeDefined();
    expect(cut!.endFatPercent).toBeLessThanOrEqual(17 - CEILING_SWING + 0.6);
    expect(plan.floorPercent).toBe(12);
  });

  it('never cuts below what is sensible, however low the ceiling is set', () => {
    const plan = planToCeiling(input({ ceilingPercent: 9, bodyFatPercent: 14 }));

    expect(plan.floorPercent).toBeGreaterThanOrEqual(8);
    for (const block of plan.blocks) {
      expect(block.endFatPercent).toBeGreaterThanOrEqual(7.5);
    }
  });

  it('fits the horizon it was given and emits no throwaway phases', () => {
    const plan = planToCeiling(input({ horizonWeeks: 24 }));
    const total = plan.blocks.reduce((sum, block) => sum + block.weeks, 0);

    expect(total).toBeLessThanOrEqual(24);
    for (const block of plan.blocks) {
      expect(block.weeks, `${block.label} is too short to be a phase`).toBeGreaterThanOrEqual(3);
    }
  });

  it('gains weight while building and loses it while cutting', () => {
    const plan = planToCeiling(input({ buildStrategy: 'bulk', horizonWeeks: 60 }));

    for (const block of plan.blocks) {
      if (block.kind === 'build') expect(block.endWeightKg).toBeGreaterThan(block.startWeightKg);
      else expect(block.endWeightKg).toBeLessThan(block.startWeightKg);
    }
  });

  it('a faster build strategy reaches the ceiling sooner', () => {
    const slow = weeksOfHeadroom({ ...input(), buildStrategy: 'lean_bulk' });
    const fast = weeksOfHeadroom({ ...input(), buildStrategy: 'bulk' });

    expect(fast).toBeLessThan(slow);
  });

  it('explains a cut-first plan with the payoff, not just the refusal', () => {
    // The user's actual question: 18.7 % now, unwilling to pass 17 %. "Cuts
    // first" alone reads as the app disagreeing with them; the reason it is
    // acceptable is the run of building it unlocks, so that has to be in the
    // sentence and it has to be their own number.
    const plan = planToCeiling(input({ bodyFatPercent: 18.7, ceilingPercent: 17 }));

    expect(plan.rationale?.headline).toMatch(/starts with a cut/i);
    expect(plan.rationale?.detail).toContain('18.7 %');
    expect(plan.rationale?.detail).toContain('17 %');
    expect(plan.rationale?.detail).toMatch(/opens up a \d+-week run of building/);
  });

  it('explains a build-first plan by how long the run lasts', () => {
    const plan = planToCeiling(input({ bodyFatPercent: 12, buildStrategy: 'bulk', horizonWeeks: 60 }));

    expect(plan.rationale?.headline).toMatch(/starts by building/i);
    expect(plan.rationale?.detail).toMatch(/\d+ weeks of building/);
  });

  it('says the limit costs nothing when the horizon never reaches it', () => {
    const plan = planToCeiling(input({ bodyFatPercent: 12, horizonWeeks: 24 }));

    expect(plan.blocks).toHaveLength(1);
    expect(plan.rationale?.detail).toMatch(/costs you nothing/i);
  });

  it('quotes only numbers the plan actually produced', () => {
    // A sentence that drifts from the blocks under it is worse than no
    // sentence, so every figure in it is read back off the plan.
    const plan = planToCeiling(input({ bodyFatPercent: 22, ceilingPercent: 15 }));
    const cut = plan.blocks[0];

    expect(cut.kind).toBe('cut');
    expect(plan.rationale?.detail).toContain(`${cut.weeks} weeks`);
    expect(plan.rationale?.detail).toContain(`${plan.floorPercent} %`);
  });

  it('shapes the plan as a route the rest of the app can simulate', () => {
    const route = ceilingRoute(input({ bodyFatPercent: 18.7, ceilingPercent: 17 }));
    const plan = planToCeiling(input({ bodyFatPercent: 18.7, ceilingPercent: 17 }));

    expect(route.id).toBe(CEILING_ROUTE_ID);
    expect(route.name).toContain('17');
    expect(route.blocks.map((block) => block.weeks)).toEqual(plan.blocks.map((block) => block.weeks));
  });

  it('has no rationale when there is no plan to explain', () => {
    expect(planToCeiling(input({ horizonWeeks: 2 })).rationale).toBeNull();
  });

  it('terminates on a horizon it cannot fill', () => {
    // A guard against the loop that never advances: a two-week horizon has no
    // room for any phase, and the answer is an empty plan, not a hang.
    expect(planToCeiling(input({ horizonWeeks: 2 })).blocks).toEqual([]);
  });
});
