import type { IconName } from '@/design-system/Icon';
import type { Proposal } from '@/domain/inference/proposals';
import type { RevertSuggestion } from '@/domain/plan/history';
import type { PlanVerdict } from '@/domain/plan/verdict';
import type { Stall } from '@/domain/training/strength';

/**
 * The one thing the app wants to tell you.
 *
 * Every screen in this app used to end in a column of rows, each one something
 * the engine had noticed: the plan drifting, a lift stuck, a phase due, a
 * suggestion, a missing gym. Six of them, identically styled, all shouting at
 * the same volume. The effect of showing someone six equally-weighted problems
 * is not urgency — it is paralysis, because nothing that looks equally
 * important gives you any way to choose.
 *
 * So the ranking happens here, once, in one place, and the screen shows the
 * winner. The rest do not vanish; they wait behind a count, on a screen whose
 * whole job is to list them. That is the difference between an app that tells
 * you what to do and a dashboard that makes you decide what to read first.
 *
 * The order below is not arbitrary. It runs from "this invalidates the other
 * items" down to "this is a nicety":
 *
 *  1. The plan does not match what you are actually doing. Every other number
 *     on the screen is computed from a plan; if the plan is wrong, so are they.
 *  2. No gym. The exercise list is guesswork until the app knows the kit.
 *  3. A phase is due to start. A concrete transition, waiting on one tap.
 *  4. A lift is stuck. Specific, actionable, and it will not fix itself.
 *  5. A plan change did not stick. Evidence that a past decision was wrong.
 *  6. The target date moved. Real, but nothing to press.
 *  7. A suggestion. Useful, never urgent.
 *  8. No check-in today. The smallest thing here, and it says so.
 */

export type Attention = {
  id: string;
  /** A few words. What happened. */
  headline: string;
  /** One line. Why it matters, or what to do. */
  detail: string;
  tone: 'accent' | 'warning';
  icon: IconName;
  /** Where tapping it goes. */
  route: string;
  /** Lower runs first. */
  priority: number;
};

export type AttentionInput = {
  verdict: PlanVerdict | null;
  drift: { days: number; headline: string; detail: string } | null;
  nextBlock: { label: string; routeName: string } | null;
  proposals: Proposal[];
  /** Proposal ids already acted on, which must not come back. */
  appliedProposals: string[];
  stalls: Stall[];
  revert: RevertSuggestion | null;
  hasGym: boolean;
  checkedInToday: boolean;
  trainedToday: boolean;
};

export function attentionItems(input: AttentionInput): Attention[] {
  const items: Attention[] = [];

  // 1 — The plan is not the plan you are on.
  if (input.verdict?.action) {
    items.push({
      id: 'verdict',
      headline: input.verdict.headline,
      detail: input.verdict.detail,
      tone: input.verdict.state === 'too_demanding' ? 'warning' : 'accent',
      icon: 'target',
      route: '/plan',
      priority: 10,
    });
  }

  // 2 — Without a gym the app is inventing the equipment.
  if (!input.hasGym) {
    items.push({
      id: 'gym',
      headline: 'Tell it where you train',
      detail: 'Then it only picks exercises your gym actually has.',
      tone: 'accent',
      icon: 'gym',
      route: '/gyms',
      priority: 20,
    });
  }

  // 3 — A block of the plan is due to hand over to the next.
  if (input.nextBlock) {
    items.push({
      id: 'block',
      headline: `Time to start the ${input.nextBlock.label.toLowerCase()}`,
      detail: `${input.nextBlock.routeName} — the next stretch of your plan.`,
      tone: 'accent',
      icon: 'progress',
      route: '/roadmap',
      priority: 30,
    });
  }

  // 4 — One lift, stuck, with a specific way out. Only the worst one: a list
  //     of four plateaus is a list of four reasons to feel bad.
  const worst = [...input.stalls].sort((a, b) => b.weeks - a.weeks)[0];
  if (worst) {
    items.push({
      id: `stall:${worst.exerciseId}`,
      headline: worst.headline,
      detail: worst.detail,
      tone: 'warning',
      icon: 'bolt',
      route: '/lifts',
      priority: 40,
    });
  }

  // 5 — The plan changed, and training fell off after it.
  if (input.revert) {
    items.push({
      id: 'revert',
      headline: input.revert.headline,
      detail: input.revert.detail,
      tone: 'warning',
      icon: 'restart',
      route: '/previous-plan',
      priority: 50,
    });
  }

  // 6 — The date moved. Worth knowing, nothing to press.
  if (input.drift) {
    items.push({
      id: 'drift',
      headline: input.drift.headline,
      detail: input.drift.detail,
      tone: input.drift.days > 0 ? 'warning' : 'accent',
      icon: 'calendar',
      route: '/why',
      priority: 60,
    });
  }

  // 7 — Something the app worked out on its own.
  const open = input.proposals.find((entry) => !input.appliedProposals.includes(entry.id));
  if (open) {
    items.push({
      id: `proposal:${open.id}`,
      headline: open.headline,
      detail: open.detail,
      tone: 'accent',
      icon: 'info',
      route: '/knows',
      priority: 70,
    });
  }

  // 8 — The check-in, and only on a day it could still change something.
  if (!input.checkedInToday && !input.trainedToday) {
    items.push({
      id: 'checkin',
      headline: 'How did you sleep?',
      detail: 'Twenty seconds, and today gets easier or harder to match.',
      tone: 'accent',
      icon: 'sleep',
      route: '/checkin',
      priority: 80,
    });
  }

  return items.sort((a, b) => a.priority - b.priority);
}

/** The winner, or nothing at all — which is a perfectly good state to be in. */
export function topAttention(input: AttentionInput): Attention | null {
  return attentionItems(input)[0] ?? null;
}
