import { MUSCLE_GROUP_LABELS } from '@/data/exercises';
import { FAT_TOLERANCE_LABELS, OBJECTIVE_LABELS, SPEED_LABELS } from '@/domain/plan/simulate';
import type {
  FatTolerance,
  Goal,
  MuscleGroup,
  PlanObjective,
  PlanSpeed,
  TrainingPreferences,
} from '@/domain/types';

/**
 * Every lever that changes the plan, in one list.
 *
 * These were spread across onboarding, `/adjust`, `/focus`, the fat-ceiling
 * screen and the plan tab, and — worse — they did not behave the same way.
 * Some recalculated the plan on change, some wrote a field and left the
 * projections stale until something else happened to trigger a rebuild. The
 * user had no way to know which was which, and "did that do anything?" is a
 * question an app should never make someone ask.
 *
 * So: one place, one rule. Changing any of these asks the same question and
 * runs the same deterministic recalculation. The screen is generated from
 * this file rather than hand-written, which is what stops a lever being added
 * later that quietly does not recalculate.
 */

export type PlanVariables = {
  objective: PlanObjective;
  speed: PlanSpeed;
  fatTolerance: FatTolerance;
  /** Hard ceiling on body fat, or null for none. */
  maxBodyFatPercent: number | null;
  muscleFocus: MuscleGroup[];
  daysPerWeek: number;
  sessionMinutes: number;
  horizonWeeks: number;
};

export type VariableKind = 'choice' | 'muscles';

export type VariableOption = {
  value: string | number | null;
  label: string;
};

export type VariableDefinition = {
  key: keyof PlanVariables;
  label: string;
  /** What this lever actually controls, in the user's terms. */
  help: string;
  kind: VariableKind;
  options: VariableOption[];
};

export const DAYS_OPTIONS = [2, 3, 4, 5, 6];
export const SESSION_MINUTES_OPTIONS = [30, 45, 60, 75, 90];
export const HORIZON_OPTIONS = [12, 24, 52, 104];
export const CEILING_OPTIONS: (number | null)[] = [null, 12, 15, 17, 20, 25];

export const PLAN_VARIABLES: VariableDefinition[] = [
  {
    key: 'objective',
    label: 'What you want',
    help: 'Everything else is read in light of this one.',
    kind: 'choice',
    options: (['build', 'lean', 'recomp'] as PlanObjective[]).map((value) => ({
      value,
      label: OBJECTIVE_LABELS[value],
    })),
  },
  {
    key: 'speed',
    label: 'How fast',
    help: 'Sets the size of the surplus or deficit, and how many days a week that needs.',
    kind: 'choice',
    options: (['cautious', 'steady', 'fast', 'max'] as PlanSpeed[]).map((value) => ({
      value,
      label: SPEED_LABELS[value],
    })),
  },
  {
    key: 'fatTolerance',
    label: 'Fat you will accept',
    help: 'A preference about the pace, not a limit. The ceiling below is the limit.',
    kind: 'choice',
    options: (['minimal', 'some', 'whatever'] as FatTolerance[]).map((value) => ({
      value,
      label: FAT_TOLERANCE_LABELS[value],
    })),
  },
  {
    key: 'maxBodyFatPercent',
    label: 'Fat ceiling',
    help: 'A line the plan may not cross. It decides where building phases end.',
    kind: 'choice',
    options: CEILING_OPTIONS.map((value) => ({
      value,
      label: value === null ? 'No limit' : `${value} %`,
    })),
  },
  {
    key: 'daysPerWeek',
    label: 'Days in the gym',
    help: 'What the pace above needs is derived; setting it here overrides that.',
    kind: 'choice',
    options: DAYS_OPTIONS.map((value) => ({ value, label: `${value}` })),
  },
  {
    key: 'sessionMinutes',
    label: 'How long a session',
    help: 'Decides how many movements fit in a day before the routine is rebuilt.',
    kind: 'choice',
    options: SESSION_MINUTES_OPTIONS.map((value) => ({ value, label: `${value} min` })),
  },
  {
    key: 'horizonWeeks',
    label: 'How far out you are planning',
    help: 'The window every projection and target date is drawn against.',
    kind: 'choice',
    options: HORIZON_OPTIONS.map((value) => ({
      value,
      label: value >= 52 ? `${Math.round(value / 52)} year${value >= 104 ? 's' : ''}` : `${value} weeks`,
    })),
  },
  {
    key: 'muscleFocus',
    label: 'Muscles to favour',
    help: 'Biases where the weekly sets go. None means a balanced routine.',
    kind: 'muscles',
    options: (Object.keys(MUSCLE_GROUP_LABELS) as MuscleGroup[]).map((value) => ({
      value,
      label: MUSCLE_GROUP_LABELS[value],
    })),
  },
];

/** Reads the current levers out of what the store has persisted. */
export function planVariablesOf(
  goal: Goal | null,
  training: TrainingPreferences,
): PlanVariables {
  return {
    objective: goal?.objective ?? 'build',
    speed: goal?.speed ?? 'steady',
    fatTolerance: goal?.fatTolerance ?? 'some',
    maxBodyFatPercent: goal?.maxBodyFatPercent ?? null,
    muscleFocus: goal?.muscleFocus ?? [],
    daysPerWeek: training.preferredDaysPerWeek,
    sessionMinutes: training.sessionMinutes,
    horizonWeeks: goal?.horizonWeeks ?? 24,
  };
}

/** The levers that differ between two sets, in the order they are displayed. */
export function changedVariables(
  before: PlanVariables,
  after: PlanVariables,
): (keyof PlanVariables)[] {
  return PLAN_VARIABLES.filter((definition) => {
    const a = before[definition.key];
    const b = after[definition.key];
    if (Array.isArray(a) && Array.isArray(b)) {
      return a.length !== b.length || a.some((entry, index) => entry !== b[index]);
    }
    return a !== b;
  }).map((definition) => definition.key);
}

/**
 * What the user is about to change, named rather than counted.
 *
 * "This will change your plan" with no subject is the kind of confirmation
 * people learn to tap through. Saying which lever moved and to what makes the
 * dialogue worth reading the second time.
 */
export function describeChange(
  before: PlanVariables,
  after: PlanVariables,
): { headline: string; detail: string } | null {
  const changed = changedVariables(before, after);
  if (changed.length === 0) return null;

  const key = changed[0];
  const definition = PLAN_VARIABLES.find((entry) => entry.key === key)!;

  const from = valueLabel(definition, before[key]);
  const to = valueLabel(definition, after[key]);

  return {
    headline: `${definition.label}: ${from} → ${to}`,
    detail:
      changed.length > 1
        ? `This changes your plan, along with ${changed.length - 1} other change${changed.length > 2 ? 's' : ''}. Everything derived from it is recalculated. Recalculate?`
        : 'This changes your plan. Calories, training days, the routine and every projection are recalculated from it. Recalculate?',
  };
}

/** How a lever's current value reads on screen. */
export function valueLabel(
  definition: VariableDefinition,
  value: PlanVariables[keyof PlanVariables],
): string {
  if (Array.isArray(value)) {
    return value.length === 0
      ? 'Balanced'
      : value.map((muscle) => MUSCLE_GROUP_LABELS[muscle]).join(' · ');
  }
  return definition.options.find((option) => option.value === value)?.label ?? String(value);
}
