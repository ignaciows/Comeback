import { create } from 'zustand';

import type { EngineResult } from '@/domain/engine';

/**
 * Making a recalculation visible.
 *
 * When the user changes something, the models re-run and every number on the
 * screen is quietly different. That is the moment the app is least like a
 * template and most like something paying attention — so it is shown rather
 * than left to be noticed: 612 days becomes 650 in front of you.
 *
 * The flow is deliberately two-step. A screen arms the recorder with the
 * numbers as they stand *before* dispatching the change; the next engine run
 * settles it and the difference becomes a card. Nothing is stored between
 * launches — a recalculation is a thing that just happened, not history.
 */

export type PlanSnapshot = {
  daysRemaining: number | null;
  targetDate: string | null;
  calories: number | null;
  proteinG: number | null;
  sessionsRemaining: number | null;
  weeklySets: number | null;
};

export type RecalcChange = {
  key: keyof PlanSnapshot;
  label: string;
  from: number;
  to: number;
  /** Decimals to render. */
  decimals: number;
  suffix: string;
  /** Whether a rise is the good direction. Null when neither is. */
  higherIsBetter: boolean | null;
};

type RecalcState = {
  before: PlanSnapshot | null;
  changes: RecalcChange[];
  /** What the user did, in a few words. */
  cause: string | null;
  arm: (snapshot: PlanSnapshot, cause: string) => void;
  settle: (snapshot: PlanSnapshot) => void;
  clear: () => void;
};

const LABELS: Record<keyof PlanSnapshot, { label: string; decimals: number; suffix: string; higherIsBetter: boolean | null }> = {
  daysRemaining: { label: 'Days to target', decimals: 0, suffix: '', higherIsBetter: false },
  targetDate: { label: 'Target date', decimals: 0, suffix: '', higherIsBetter: false },
  calories: { label: 'Daily calories', decimals: 0, suffix: ' kcal', higherIsBetter: null },
  proteinG: { label: 'Protein', decimals: 0, suffix: ' g', higherIsBetter: null },
  sessionsRemaining: { label: 'Sessions left', decimals: 0, suffix: '', higherIsBetter: false },
  weeklySets: { label: 'Sets per week', decimals: 0, suffix: '', higherIsBetter: null },
};

function diff(before: PlanSnapshot, after: PlanSnapshot): RecalcChange[] {
  const changes: RecalcChange[] = [];

  for (const key of Object.keys(LABELS) as (keyof PlanSnapshot)[]) {
    // The target date is a date, not a number; it rides along on days remaining.
    if (key === 'targetDate') continue;

    const from = before[key];
    const to = after[key];
    if (typeof from !== 'number' || typeof to !== 'number') continue;
    if (Math.round(from) === Math.round(to)) continue;

    changes.push({ key, from, to, ...LABELS[key] });
  }

  return changes;
}

export const useRecalcStore = create<RecalcState>()((set, get) => ({
  before: null,
  changes: [],
  cause: null,

  arm: (snapshot, cause) => set({ before: snapshot, cause, changes: [] }),

  settle: (snapshot) => {
    const before = get().before;
    if (!before) return;
    set({ before: null, changes: diff(before, snapshot) });
  },

  clear: () => set({ before: null, changes: [], cause: null }),
}));

/** Reads the numbers a change can move out of an engine run. */
export function snapshotOf(engine: EngineResult): PlanSnapshot {
  const projection = engine.projection;
  return {
    daysRemaining: projection?.daysRemaining ?? null,
    targetDate: projection?.targetDate ?? null,
    calories: projection?.targetKcal ?? null,
    // The protein target is a range; its floor is the number that matters.
    proteinG: projection?.proteinTargetG[0] ?? null,
    sessionsRemaining: projection?.sessionsRemaining ?? null,
    weeklySets: engine.volume.reduce((total, entry) => total + entry.sets, 0) || null,
  };
}
