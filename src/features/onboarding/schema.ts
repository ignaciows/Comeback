import { z } from 'zod';

/**
 * Onboarding validation. Bounds are generous — the point is to catch typos
 * (186 cm typed as 1860), not to police the user's body.
 */
export const goalStepSchema = z.object({
  goalType: z.enum([
    'regain_condition',
    'build_muscle',
    'lose_fat',
    'recomposition',
    'build_strength',
    'maintain',
  ]),
});

export const startingPointSchema = z.object({
  name: z.string().trim().min(1, 'Add a name so the app can address you'),
  weightKg: z.number({ invalid_type_error: 'Enter your weight' }).min(30, 'That looks too low').max(300, 'That looks too high'),
  heightCm: z.number({ invalid_type_error: 'Enter your height' }).min(120, 'That looks too low').max(230, 'That looks too high'),
  experience: z.enum(['beginner', 'returning', 'intermediate', 'advanced']),
  layoffWeeks: z.number().min(0).max(520),
});

export const availabilitySchema = z
  .object({
    daysPerWeek: z.number().min(2, 'Pick at least two days').max(6),
    sessionMinutes: z.number().min(20).max(150),
    preferredWeekdays: z.array(z.number().min(0).max(6)),
    location: z.enum(['gym', 'home']),
  })
  .refine((value) => value.preferredWeekdays.length >= value.daysPerWeek, {
    message: 'Select at least as many days as you plan to train',
    path: ['preferredWeekdays'],
  });

export const initialStateSchema = z.object({
  sleepHours: z.number().min(2).max(14),
  sleepQuality: z.number().min(1).max(5),
  energy: z.number().min(1).max(5),
  soreness: z.number().min(1).max(5),
  stress: z.number().min(1).max(5),
  motivation: z.number().min(1).max(5),
});

export type GoalStep = z.infer<typeof goalStepSchema>;
export type StartingPointStep = z.infer<typeof startingPointSchema>;
export type AvailabilityStep = z.infer<typeof availabilitySchema>;
export type InitialStateStep = z.infer<typeof initialStateSchema>;

/** Flattens a Zod error into `{ field: message }` for inline display. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === 'string' && !out[key]) out[key] = issue.message;
  }
  return out;
}
