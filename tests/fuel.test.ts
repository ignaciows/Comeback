import { describe, expect, it } from 'vitest';

import { calculateFuel, fuelLabel, type FuelInput } from '@/domain/fuel/calculateFuel';
import { TODAY, checkin, daysAgo, readiness } from './helpers';

function input(overrides: Partial<FuelInput> = {}): FuelInput {
  return {
    date: TODAY,
    nutrition: [{ date: TODAY, kcal: 2500, proteinG: 160 }],
    calorieTargetKcal: 2500,
    proteinTargetG: 160,
    checkin: checkin(TODAY),
    readiness: [readiness(daysAgo(1), 70), readiness(daysAgo(2), 72)],
    ...overrides,
  };
}

describe('fuel', () => {
  it('scores on-target nutrition at the top of the band', () => {
    const result = calculateFuel(input());
    expect(result.components.nutrition).toBe(100);
  });

  it('penalises eating far under target', () => {
    const onTarget = calculateFuel(input()).components.nutrition as number;
    const under = calculateFuel(
      input({ nutrition: [{ date: TODAY, kcal: 1200, proteinG: 60 }] }),
    ).components.nutrition as number;
    expect(under).toBeLessThan(onTarget);
  });

  it('penalises overeating as well as undereating', () => {
    // The band is symmetric on purpose: a bulk is not a licence to overshoot.
    const over = calculateFuel(
      input({ nutrition: [{ date: TODAY, kcal: 4200, proteinG: 160 }] }),
    ).components.nutrition as number;
    expect(over).toBeLessThan(100);
  });

  it('weights protein above calories', () => {
    const proteinShort = calculateFuel(
      input({ nutrition: [{ date: TODAY, kcal: 2500, proteinG: 70 }] }),
    ).components.nutrition as number;
    const caloriesShort = calculateFuel(
      input({ nutrition: [{ date: TODAY, kcal: 1400, proteinG: 160 }] }),
    ).components.nutrition as number;
    expect(proteinShort).toBeLessThan(caloriesShort);
  });

  it('returns null nutrition when no target exists to compare against', () => {
    const result = calculateFuel(input({ calorieTargetKcal: null, proteinTargetG: null }));
    expect(result.components.nutrition).toBeNull();
  });

  it('drops a missing component instead of scoring it zero', () => {
    const withSleep = calculateFuel(input()).score as number;
    const noCheckin = calculateFuel(input({ checkin: null }));
    expect(noCheckin.components.sleep).toBeNull();
    // Nutrition and load are both good, so removing sleep must not drag the
    // score towards zero — it should stay in the same region.
    expect(noCheckin.score as number).toBeGreaterThan(withSleep - 25);
  });

  it('is null only when nothing at all was logged', () => {
    const result = calculateFuel(
      input({ nutrition: [], calorieTargetKcal: null, proteinTargetG: null, checkin: null, readiness: [] }),
    );
    expect(result.score).toBeNull();
    expect(result.confidence).toBe('low');
  });

  it('reports high confidence only with every component and a full window', () => {
    const full = calculateFuel(
      input({
        nutrition: [
          { date: TODAY, kcal: 2500, proteinG: 160 },
          { date: daysAgo(1), kcal: 2450, proteinG: 155 },
        ],
      }),
    );
    expect(full.confidence).toBe('high');
    expect(calculateFuel(input({ checkin: null })).confidence).toBe('medium');
  });

  it('averages nutrition over the window rather than trusting one day', () => {
    const single = calculateFuel(input({ nutrition: [{ date: TODAY, kcal: 800, proteinG: 40 }] }))
      .components.nutrition as number;
    const averaged = calculateFuel(
      input({
        nutrition: [
          { date: TODAY, kcal: 800, proteinG: 40 },
          { date: daysAgo(1), kcal: 2500, proteinG: 160 },
        ],
      }),
    ).components.nutrition as number;
    expect(averaged).toBeGreaterThan(single);
  });

  it('ignores nutrition outside the window', () => {
    const result = calculateFuel(input({ nutrition: [{ date: daysAgo(10), kcal: 2500, proteinG: 160 }] }));
    expect(result.components.nutrition).toBeNull();
  });

  it('names the weakest component when one is holding the score back', () => {
    const result = calculateFuel(input({ nutrition: [{ date: TODAY, kcal: 700, proteinG: 20 }] }));
    expect(result.explanation.toLowerCase()).toContain('nutrition');
  });

  it('labels the bands', () => {
    expect(fuelLabel(null)).toBe('Not logged');
    expect(fuelLabel(85)).toBe('Fully fueled');
    expect(fuelLabel(30)).toBe('Depleted');
  });
});
