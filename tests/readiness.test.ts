import { describe, expect, it } from 'vitest';

import { calculateReadiness, scoreCheckin } from '@/domain/readiness/calculateReadiness';
import { TODAY, checkin, daysAgo } from './helpers';

describe('readiness', () => {
  it('drops when sleep is short', () => {
    const normal = scoreCheckin(checkin(TODAY)) as number;
    const poorSleep = scoreCheckin(checkin(TODAY, { sleepHours: 4, sleepQuality: 2 })) as number;
    expect(poorSleep).toBeLessThan(normal);
  });

  it('treats soreness and stress as inverted scales', () => {
    const calm = scoreCheckin(checkin(TODAY, { soreness: 1, stress: 1 })) as number;
    const wrecked = scoreCheckin(checkin(TODAY, { soreness: 5, stress: 5 })) as number;
    expect(calm).toBeGreaterThan(wrecked);
  });

  it('scores a partial check-in from the fields that exist', () => {
    const partial = scoreCheckin(
      checkin(TODAY, { sleepQuality: null, soreness: null, stress: null, motivation: null }),
    );
    expect(partial).not.toBeNull();
    expect(partial as number).toBeGreaterThan(0);
  });

  it('returns null when nothing was logged', () => {
    const empty = scoreCheckin(
      checkin(TODAY, {
        sleepHours: null,
        sleepQuality: null,
        energy: null,
        soreness: null,
        stress: null,
        motivation: null,
      }),
    );
    expect(empty).toBeNull();
  });

  it('compares against the user’s own baseline once enough check-ins exist', () => {
    const history = [5, 4, 3, 2].map((offset) => checkin(daysAgo(offset)));
    const result = calculateReadiness(checkin(TODAY, { sleepHours: 5, energy: 2 }), history);

    expect(result.baseline).not.toBeNull();
    expect(result.vsBaseline).not.toBeNull();
    expect(result.vsBaseline as number).toBeLessThan(0);
    expect(result.confidence).not.toBe('low');
  });

  it('reports low confidence and no baseline with too few check-ins', () => {
    const result = calculateReadiness(checkin(TODAY), [checkin(daysAgo(1))]);
    expect(result.baseline).toBeNull();
    expect(result.confidence).toBe('low');
  });

  it('returns a null score when there is no check-in at all', () => {
    const result = calculateReadiness(null, []);
    expect(result.score).toBeNull();
  });
});
