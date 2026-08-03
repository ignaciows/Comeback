import { describe, expect, it } from 'vitest';

import { mikuyPlanLink, parseMikuyPlanLink } from '@/domain/plan/mikuyLink';

const macros = { kcal: 2847.4, proteinG: 168.6, fatG: 79.1, carbsG: 341.2 };

describe('handing macros to MIKUY', () => {
  it('survives the round trip', () => {
    const link = mikuyPlanLink({ macros, phaseLabel: 'Build', validUntil: '2026-11-30' });
    const back = parseMikuyPlanLink(link.url)!;

    expect(back.kcal).toBe(2847);
    expect(back.protein).toBe(169);
    expect(back.carbs).toBe(341);
    expect(back.fat).toBe(79);
    expect(back.phase).toBe('Build');
    expect(back.until).toBe('2026-11-30');
  });

  it('carries when the macros stop being right', () => {
    // A two-year plan changes macros eight times. Undated macros are macros
    // MIKUY keeps using three months after they stopped applying.
    const link = mikuyPlanLink({ macros, phaseLabel: 'Cut', validUntil: '2027-02-01' });
    expect(link.url).toContain('until=2027-02-01');
  });

  it('refuses a half-arrived payload rather than filling in blanks', () => {
    // Macros missing their protein are not partial macros, they are a
    // different target from the one that was sent.
    expect(parseMikuyPlanLink('mikuy://plan?kcal=2800&carbs=300&fat=80')).toBeNull();
    expect(parseMikuyPlanLink('mikuy://plan?kcal=0&protein=1&carbs=1&fat=1')).toBeNull();
    expect(parseMikuyPlanLink('mikuy://plan?kcal=x&protein=1&carbs=1&fat=1')).toBeNull();
    expect(parseMikuyPlanLink('mikuy://plan')).toBeNull();
    expect(parseMikuyPlanLink('nonsense')).toBeNull();
  });

  it('names a phase even when one was not sent', () => {
    expect(parseMikuyPlanLink('mikuy://plan?kcal=2000&protein=150&carbs=200&fat=60')!.phase).toBe('Plan');
  });

  it('escapes a phase label with spaces in it', () => {
    const link = mikuyPlanLink({ macros, phaseLabel: 'Build again', validUntil: null });
    expect(parseMikuyPlanLink(link.url)!.phase).toBe('Build again');
    expect(parseMikuyPlanLink(link.url)!.until).toBeNull();
  });

  it('shows what is about to be sent before sending it', () => {
    const link = mikuyPlanLink({ macros, phaseLabel: 'Build', validUntil: null });
    expect(link.summary).toContain('2847 kcal');
    expect(link.summary).toContain('169 g proteína');
  });
});
