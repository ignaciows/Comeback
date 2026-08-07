import { describe, expect, it } from 'vitest';

import { attentionItems, topAttention, type AttentionInput } from '@/domain/attention';
import type { PlanVerdict } from '@/domain/plan/verdict';

const input = (patch: Partial<AttentionInput> = {}): AttentionInput => ({
  verdict: null,
  drift: null,
  nextBlock: null,
  proposals: [],
  appliedProposals: [],
  stalls: [],
  revert: null,
  hasGym: true,
  checkedInToday: true,
  trainedToday: false,
  ...patch,
});

const verdict = (state: PlanVerdict['state']): PlanVerdict => ({
  state,
  headline: 'The plan asks for more than you are doing',
  detail: 'Four weeks at three sessions against a plan built on five.',
  action: { kind: 'lower_frequency', toSessions: 3 },
});

const stall = (weeks: number, exerciseId = 'bench-press') => ({
  exerciseId,
  weeks,
  headline: `Bench press has not moved in ${weeks} weeks`,
  detail: 'Take a week at 90% and come back at it.',
  deloadKg: 60,
});

describe('one thing at a time', () => {
  it('says nothing when there is nothing to say', () => {
    expect(topAttention(input())).toBeNull();
    expect(attentionItems(input())).toEqual([]);
  });

  it('puts a wrong plan above everything else', () => {
    const items = attentionItems(
      input({
        verdict: verdict('too_demanding'),
        hasGym: false,
        drift: { days: 9, headline: 'Target moved 9 days later', detail: 'Only the pace.' },
        checkedInToday: false,
      }),
    );

    // Everything is still there — the screen just knows which one to show.
    expect(items).toHaveLength(4);
    expect(items[0].id).toBe('verdict');
    expect(items[0].tone).toBe('warning');
  });

  it('ranks a missing gym above a stuck lift, and a stuck lift above a suggestion', () => {
    const items = attentionItems(
      input({
        hasGym: false,
        stalls: [stall(4)],
        proposals: [
          { id: 'rest', kind: 'ask', headline: 'Rest 90s', detail: 'You take about that anyway.', change: { type: 'rest_seconds', seconds: 90 } },
        ],
      }),
    );

    expect(items.map((entry) => entry.id)).toEqual(['gym', 'stall:bench-press', 'proposal:rest']);
  });

  it('surfaces the longest-running plateau, not all of them', () => {
    const items = attentionItems(input({ stalls: [stall(3, 'squat'), stall(6, 'row'), stall(4, 'press')] }));

    expect(items).toHaveLength(1);
    expect(items[0].id).toBe('stall:row');
  });

  it('does not resurface a suggestion that was already acted on', () => {
    const proposals = [
      { id: 'rest', kind: 'ask' as const, headline: 'Rest 90s', detail: 'Evidence.', change: { type: 'rest_seconds' as const, seconds: 90 } },
    ];

    expect(attentionItems(input({ proposals, appliedProposals: ['rest'] }))).toEqual([]);
  });

  it('drops the check-in once the day is already trained', () => {
    expect(attentionItems(input({ checkedInToday: false, trainedToday: true }))).toEqual([]);
    expect(attentionItems(input({ checkedInToday: false, trainedToday: false }))).toHaveLength(1);
  });

  it('reads an early target date as good news rather than a warning', () => {
    const items = attentionItems(
      input({ drift: { days: -4, headline: 'Target moved 4 days earlier', detail: 'Ahead of pace.' } }),
    );

    expect(items[0].tone).toBe('accent');
  });

  it('never lets a verdict with nothing to do take the slot', () => {
    const items = attentionItems(input({ verdict: { ...verdict('on_track'), action: null }, hasGym: false }));

    expect(items.map((entry) => entry.id)).toEqual(['gym']);
  });
});
