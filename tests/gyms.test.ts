import { describe, expect, it } from 'vitest';

import { GYM_CHAINS, matchChain } from '@/data/gymChains';
import { distanceBetween, equipmentSummary, formatDistance, toResult } from '@/services/gyms/gymSearch';

const cologne = { lat: 50.9375, lon: 6.9603 };

describe('gym search results', () => {
  it('maps an Overpass node into a result', () => {
    const result = toResult(
      {
        type: 'node',
        id: 123,
        lat: 50.94,
        lon: 6.96,
        tags: {
          name: 'FitX Köln Innenstadt',
          'addr:street': 'Hohe Straße',
          'addr:housenumber': '12',
          'addr:city': 'Köln',
          opening_hours: 'Mo-Su 06:00-23:00',
        },
      },
      cologne,
    );

    expect(result).not.toBeNull();
    expect(result?.name).toBe('FitX Köln Innenstadt');
    expect(result?.address).toBe('Hohe Straße 12, Köln');
    expect(result?.openingHours).toBe('Mo-Su 06:00-23:00');
    expect(result?.distanceMeters).toBeLessThan(1000);
  });

  it('reads the centre of a mapped building', () => {
    const result = toResult(
      { type: 'way', id: 9, center: { lat: 50.95, lon: 6.97 }, tags: { name: 'John Reed' } },
      cologne,
    );
    expect(result?.lat).toBe(50.95);
    expect(result?.id).toBe('way/9');
  });

  it('drops anything without a name or a position', () => {
    expect(toResult({ type: 'node', id: 1, lat: 50.9, lon: 6.9, tags: {} }, cologne)).toBeNull();
    expect(toResult({ type: 'node', id: 2, tags: { name: 'Gym' } }, cologne)).toBeNull();
  });

  it('measures distance sensibly', () => {
    // Cologne to Düsseldorf is about 35 km.
    const distance = distanceBetween(cologne, { lat: 51.2277, lon: 6.7735 });
    expect(distance).toBeGreaterThan(30_000);
    expect(distance).toBeLessThan(45_000);
    expect(formatDistance(850)).toBe('850 m');
    expect(formatDistance(2400)).toBe('2.4 km');
  });
});

describe('chain equipment', () => {
  it('recognises the chains by name', () => {
    expect(matchChain('FitX Köln Kalk')?.id).toBe('fitx');
    expect(matchChain('McFit Köln Ehrenfeld')?.id).toBe('mcfit');
    expect(matchChain('Clever fit Köln')?.id).toBe('cleverfit');
    expect(matchChain('Kieser Training Köln')?.id).toBe('kieser');
  });

  it('matches on the brand tag when the name is generic', () => {
    expect(matchChain('Fitnessstudio', 'John Reed')?.id).toBe('johnreed');
  });

  it('leaves an independent gym unknown rather than guessing', () => {
    const result = toResult(
      { type: 'node', id: 5, lat: 50.94, lon: 6.96, tags: { name: 'Kraftraum Ehrenfeld' } },
      cologne,
    );
    expect(result?.chain).toBeNull();
    expect(result?.equipmentSource).toBe('unknown');
    expect(equipmentSummary(result!)).toBe('Equipment unknown');
    // Nothing is claimed as available except what needs no equipment.
    expect(result?.equipment.barbell).toBe('unsure');
    expect(result?.equipment.bodyweight).toBe('available');
  });

  it('is explicit about what a machines-only gym cannot do', () => {
    const kieser = GYM_CHAINS.find((chain) => chain.id === 'kieser');
    expect(kieser?.equipment.barbell).toBe('unavailable');
    expect(kieser?.equipment.dumbbell).toBe('unavailable');
    expect(kieser?.equipment.rack).toBe('unavailable');
    expect(kieser?.equipment.machine).toBe('available');
    expect(kieser?.note).toMatch(/machines only/i);
  });

  it('summarises a chain gym by how many categories it has', () => {
    const result = toResult(
      { type: 'node', id: 6, lat: 50.94, lon: 6.96, tags: { name: 'McFit Köln' } },
      cologne,
    );
    expect(result?.equipmentSource).toBe('chain');
    expect(equipmentSummary(result!)).toMatch(/categories/);
  });
});
