import { describe, expect, it } from 'vitest';

import { GYM_CHAINS, matchChain } from '@/data/gymChains';
import {
  distanceBetween,
  equipmentSummary,
  formatDistance,
  isStrengthGym,
  toResult,
} from '@/services/gyms/gymSearch';
import cologneFixture from './fixtures/cologne-gyms.json';

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
    expect(equipmentSummary(result!)).toMatch(/9 categories/);
  });

  it('counts one category in the singular', () => {
    const result = toResult(
      { type: 'node', id: 7, lat: 50.94, lon: 6.96, tags: { name: 'Bodystreet Köln' } },
      cologne,
    );
    // Bodyweight is all an EMS studio offers.
    expect(equipmentSummary(result!)).toBe('1 category · 7 missing');
  });
});

/**
 * Against real OSM data pulled from around Cologne centre, so the filtering
 * and chain matching are pinned to tags people actually wrote rather than to
 * tags I imagined.
 */
describe('real Cologne data', () => {
  const results = (cologneFixture as Parameters<typeof toResult>[0][])
    .map((element) => toResult(element, cologne))
    .filter((result): result is NonNullable<typeof result> => result !== null);

  const named = (name: string) => results.find((result) => result.name === name);

  it('keeps the gyms and drops the yoga and pilates studios', () => {
    expect(named('McFIT Köln Kalk')).toBeDefined();
    expect(named('Holmes Place')).toBeDefined();
    expect(named('Iron&Soul')).toBeDefined();
    expect(named('Yogaschule Köln')).toBeUndefined();
    expect(named('Reforma Pilates Club')).toBeUndefined();
  });

  it('keeps a gym that also offers yoga classes', () => {
    // Tagged "fitness;yoga;gymnastics" in OSM — it is still a gym with a floor.
    expect(isStrengthGym({ name: 'Just Fit 13 Classic', sport: 'fitness;yoga;gymnastics' })).toBe(true);
    expect(named('Just Fit 13 Classic')?.chain?.id).toBe('justfit');
  });

  it('identifies the Cologne chains', () => {
    expect(named('Holmes Place')?.chain?.id).toBe('holmesplace');
    expect(named('Basic-Fit')?.chain?.id).toBe('basicfit');
    expect(named('Next Door 03')?.chain?.id).toBe('nextdoor');
    expect(named('Kieser Training')?.chain?.id).toBe('kieser');
    expect(named('Beat81')?.chain?.id).toBe('beat81');
  });

  it('leaves a real independent gym unclaimed', () => {
    expect(named('Iron&Soul')?.chain).toBeNull();
    expect(named('Iron&Soul')?.equipmentSource).toBe('unknown');
  });

  it('carries through the details a person needs to actually go', () => {
    const mcfit = named('McFIT Köln Kalk');
    expect(mcfit?.address).toBe('Wipperfürther Straße 25, Köln');
    expect(mcfit?.openingHours).toBe('24/7');
    expect(mcfit?.website).toBe('https://www.mcfit.com/studio/koeln-kalk');
  });

  it('says plainly that a class studio has no barbell', () => {
    expect(named('Beat81')?.equipment.barbell).toBe('unavailable');
    expect(named('Beat81')?.equipment.rack).toBe('unavailable');
  });
});
