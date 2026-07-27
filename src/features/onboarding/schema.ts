import { z } from 'zod';

/**
 * Onboarding validation. Bounds only catch typos (186 cm entered as 1860) —
 * they are not there to police anyone's body.
 */
export const quickStartSchema = z.object({
  goalType: z.enum([
    'regain_condition',
    'build_muscle',
    'lose_fat',
    'recomposition',
    'build_strength',
    'maintain',
  ]),
  weightKg: z.number().min(30, 'That looks too low').max(300, 'That looks too high'),
  heightCm: z.number().min(120, 'That looks too low').max(230, 'That looks too high'),
  daysPerWeek: z.number().min(2).max(7),
});

export type QuickStart = z.infer<typeof quickStartSchema>;

/** Flattens a Zod error into `{ field: message }` for inline display. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === 'string' && !out[key]) out[key] = issue.message;
  }
  return out;
}
