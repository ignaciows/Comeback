/**
 * The angles a movement is worth seeing from, and what each one is for.
 *
 * One render answers "what does this look like" and stops there. The questions
 * people actually have are positional — is my back flat, are my elbows in the
 * right place, how deep is deep — and those are answered by a *specific*
 * angle, not by a better single picture. An overhead shot of a bench press
 * settles the elbow question in a way no side view can.
 *
 * So the compounds get a small set of deliberate views rather than a gallery.
 * Each carries the reason it exists, because a carousel of pictures with no
 * captions is decoration and this is meant to be usable.
 *
 * Everything not listed here has its single render, which is the right amount
 * for a lateral raise.
 */

export type MovementView = {
  /** Asset key under `assets/views/`. */
  id: string;
  /** What you are looking at. */
  label: string;
  /** What this angle shows that the others cannot. */
  why: string;
};

export const MOVEMENT_VIEWS: Record<string, MovementView[]> = {
  back_squat: [
    {
      id: 'back_squat_bottom',
      label: 'The bottom',
      why: 'Hip crease below the knee, chest still up. This is the position the whole lift is judged on.',
    },
    {
      id: 'back_squat_top',
      label: 'Locked out',
      why: 'Hips and knees straight, ribs down. Standing up is the rep finishing, not a rest.',
    },
    {
      id: 'back_squat_rear',
      label: 'From behind',
      why: 'The angle that shows whether the knees track over the feet or cave inward under load.',
    },
  ],
  barbell_bench_press: [
    {
      id: 'barbell_bench_press_bottom',
      label: 'Bar on the chest',
      why: 'The bottom position, where the chest is stretched and doing most of the work.',
    },
    {
      id: 'barbell_bench_press_top',
      label: 'Locked out',
      why: 'Arms straight over the chest, shoulder blades still pinned back into the bench.',
    },
    {
      id: 'barbell_bench_press_overhead',
      label: 'From above',
      why: 'The only angle that settles the elbow question: tucked around sixty degrees, not flared straight out.',
    },
  ],
  deadlift: [
    {
      id: 'deadlift_bottom',
      label: 'The setup',
      why: 'Hips above the knees, shoulders just in front of the bar, bar touching the shins.',
    },
    {
      id: 'deadlift_top',
      label: 'Locked out',
      why: 'Standing tall with the bar against the thighs. There is nothing to lean back into.',
    },
    {
      id: 'deadlift_rear',
      label: 'From behind',
      why: 'Where you can see whether the back is flat or rounding — the thing that decides if this lift is safe.',
    },
  ],
  barbell_row: [
    {
      id: 'barbell_row_top',
      label: 'Bar at the ribs',
      why: 'Elbows behind the torso and shoulder blades squeezed. If the bar stops short, the arms did it.',
    },
    {
      id: 'barbell_row_bottom',
      label: 'The stretch',
      why: 'Arms straight, shoulder blades allowed forward. This is the part people skip.',
    },
    {
      id: 'barbell_row_rear',
      label: 'From behind',
      why: 'Shows the back working, and whether the torso stays at one angle instead of bouncing.',
    },
  ],
  overhead_press: [
    {
      id: 'overhead_press_bottom',
      label: 'Racked',
      why: 'Bar on the front of the shoulders, elbows under it. Where the press starts.',
    },
    {
      id: 'overhead_press_top',
      label: 'Head through',
      why: 'Bar over the middle of the body, not in front of the face. This is what the lockout means.',
    },
    {
      id: 'overhead_press_rear',
      label: 'From behind',
      why: 'Shows the bar path finishing over the mid-foot rather than out in front.',
    },
  ],
  pull_up: [
    {
      id: 'pull_up_top',
      label: 'Chest to the bar',
      why: 'Leading with the chest rather than the chin, elbows driving down and back.',
    },
    {
      id: 'pull_up_bottom',
      label: 'Full hang',
      why: 'Arms straight, shoulders up by the ears. Starting anywhere higher hides how much you can do.',
    },
    {
      id: 'pull_up_rear',
      label: 'From behind',
      why: 'Where the shoulder blades are visible, which is what actually starts the rep.',
    },
  ],
};

export function viewsFor(exerciseId: string): MovementView[] {
  return MOVEMENT_VIEWS[exerciseId] ?? [];
}

export function hasViews(exerciseId: string): boolean {
  return viewsFor(exerciseId).length > 1;
}
