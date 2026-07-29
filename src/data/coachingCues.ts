import type { Cue } from '@/domain/training/coaching';
import type { MovementPattern } from '@/domain/types';

/**
 * The one thing to think about while the set is happening.
 *
 * These are not the setup instructions in `exerciseGuidance.ts` — those are
 * read before you touch the bar. These are what a coach says *during* the set,
 * and they follow different rules:
 *
 *  · **Short.** It has to survive being read mid-rep, out of breath.
 *  · **One idea.** Not a checklist. A stack of instructions degrades the rep
 *    it was meant to fix.
 *  · **Focus chosen by movement.** External — attention on the effect, "push
 *    the floor away" — wins for force and skill on compounds. Internal, the
 *    mind-muscle connection, wins for growth on isolation work. Both are
 *    marked so the app can pick the right pool per exercise.
 *
 * The vivid ones are deliberate. "Pinkies to your shoulders" is a better curl
 * cue than "supinate at the top" because it produces the movement without
 * needing to be decoded.
 */

const e = (text: string): Cue => ({ text, focus: 'external' });
const i = (text: string): Cue => ({ text, focus: 'internal' });
const s = (text: string): Cue => ({ text, focus: 'safety' });

export const COACHING_CUES: Record<string, Cue[]> = {
  // ------------------------------------------------------------ chest ----
  barbell_bench_press: [
    s('Shoulder blades pinned back and down before you unrack.'),
    e('Bend the bar in half as you press.'),
    e('Push yourself away from the bar, not the bar away from you.'),
    e('Leave a gap you could slide a hand under at the low back.'),
  ],
  dumbbell_bench_press: [
    e('Bring the dumbbells together without letting them touch.'),
    i('Feel the chest stretch at the bottom, then squeeze it closed.'),
    e('Elbows at 45 degrees, not flared to the sides.'),
  ],
  incline_dumbbell_press: [
    e('Press towards a point above your collarbone, not your face.'),
    i('Chase the stretch across the top of the chest at the bottom.'),
  ],
  chest_press_machine: [
    e('Push the handles apart as much as forward.'),
    i('Squeeze the chest for a beat at the end of each rep.'),
  ],
  push_up: [
    s('Squeeze your glutes — it stops the hips sagging.'),
    e('Screw your hands into the floor.'),
    e('Move the floor away from you.'),
  ],
  cable_fly: [
    i('Think about hugging a barrel with your chest, not your arms.'),
    i('Hold the squeeze for a full second where the hands meet.'),
  ],
  dumbbell_fly: [
    s('Small bend in the elbows and keep it there the whole set.'),
    i('Open until you feel the chest stretch, not until the shoulders complain.'),
  ],
  pec_deck: [i('Drive with the elbows, not the hands.'), i('Pause where it is hardest.')],

  // -------------------------------------------------------- shoulders ----
  overhead_press: [
    s('Squeeze your glutes and ribs down before you press.'),
    e('Push your head through the window once the bar clears it.'),
    e('Press the ceiling away.'),
  ],
  dumbbell_shoulder_press: [
    e('Stack the dumbbells over your shoulders at the top, not in front.'),
    i('Keep the tension in the shoulders — do not lock out and rest.'),
  ],
  shoulder_press_machine: [e('Drive straight up the line of your ears.')],
  lateral_raise: [
    i('Lead with the elbows and let the hands trail.'),
    i('Imagine pouring a jug at the top.'),
    e('Stop at shoulder height — higher is traps, not side delts.'),
  ],
  cable_lateral_raise: [
    i('Feel the side of the shoulder do all of it.'),
    e('Control the way down for twice as long as the way up.'),
  ],
  rear_delt_fly: [i('Think of pulling your elbows apart, not lifting your hands.')],
  face_pull: [e('Pull the rope apart at your face and show your biceps.')],

  // ------------------------------------------------------------- back ----
  pull_up: [
    e('Pull your elbows into your back pockets.'),
    e('Lead with your chest to the bar, not your chin.'),
    i('Feel the lats start it, not the arms.'),
  ],
  assisted_pull_up: [e('Same pull as unassisted — the machine only takes weight off.')],
  lat_pulldown: [
    e('Bring the bar to your collarbone, elbows down and back.'),
    i('Start the pull by depressing the shoulder blades.'),
    e('Let the arms fully straighten at the top before the next rep.'),
  ],
  barbell_row: [
    s('Brace as if about to be punched, and keep the back flat.'),
    e('Pull the bar into your belt line.'),
    e('Row with the elbows, the hands are hooks.'),
  ],
  dumbbell_row: [e('Drive the elbow past your ribs.'), i('Let the shoulder blade travel, do not lock it.')],
  seated_cable_row: [
    e('Sit tall and pull to the navel.'),
    e('Let the weight pull the shoulder blades forward at the front.'),
  ],
  chest_supported_row: [
    i('Nothing to cheat with — just squeeze the back.'),
    e('Elbows tight to the body for lats, wider for upper back.'),
  ],

  // ------------------------------------------------------------- legs ----
  back_squat: [
    s('Brace hard before you come out of the rack, not on the way down.'),
    e('Spread the floor with your feet.'),
    e('Sit between your hips, not back onto your heels.'),
    e('Drive the whole foot through the floor on the way up.'),
  ],
  front_squat: [
    e('Elbows high the whole way — they drop and the bar follows.'),
    e('Stay upright and let the knees travel forward.'),
  ],
  goblet_squat: [e('Sit down between your feet and let the elbows brush the knees.')],
  hack_squat: [e('Push through the whole foot and keep the hips on the pad.')],
  leg_press: [
    s('Do not let the low back round off the pad at the bottom.'),
    e('Push the platform away, do not let the knees collapse in.'),
  ],
  leg_extension: [i('Squeeze the quad at the top and hold for a beat.')],
  deadlift: [
    s('Take the slack out of the bar before you pull — no jerking.'),
    e('Push the floor away rather than pulling the bar up.'),
    e('Keep the bar dragging up your legs.'),
  ],
  romanian_deadlift: [
    e('Push your hips back towards the wall behind you.'),
    i('Stop when the hamstrings run out of stretch, not when the bar hits the floor.'),
    s('Back stays flat — if it rounds, that was your last rep.'),
  ],
  trap_bar_deadlift: [e('Stand up tall — think of the legs, not the back.')],
  seated_leg_curl: [i('Curl the heels under the seat and squeeze.')],
  lying_leg_curl: [i('Keep the hips down on the pad and feel the hamstrings.')],
  hip_thrust: [i('Finish with the glutes, chin tucked, ribs down.')],
  bulgarian_split_squat: [
    s('Front foot far enough forward that the knee stays over the mid-foot.'),
    e('Drop the back knee straight down.'),
  ],
  walking_lunge: [e('Step out far enough that the front shin stays near vertical.')],
  standing_calf_raise: [i('All the way down for the stretch, all the way up for the squeeze.')],
  seated_calf_raise: [i('Pause at the bottom — the stretch is the point.')],

  // -------------------------------------------------------------- arms ---
  barbell_curl: [
    i('Pinkies towards your shoulders.'),
    e('Elbows stay pinned to your ribs.'),
    i('Lower for three seconds — that half does most of the work.'),
  ],
  dumbbell_curl: [
    i('Pinkies towards your shoulders at the top.'),
    i('Turn the palm up as you curl and squeeze.'),
  ],
  cable_curl: [i('Constant tension — do not rest at the bottom.')],
  triceps_pushdown: [
    e('Elbows glued to your sides, only the forearms move.'),
    i('Straighten fully and squeeze the back of the arm.'),
  ],
  overhead_triceps_extension: [
    i('Feel the long head stretch behind your head.'),
    s('Slow at the bottom — this is the position where triceps get strained.'),
  ],
  dip: [
    s('Lean forward for chest, stay upright for triceps. Pick one.'),
    e('Stop when the upper arm reaches parallel.'),
  ],

  // -------------------------------------------------------------- core ---
  plank: [i('Squeeze the glutes and pull the ribs down.'), e('Push the floor away through the elbows.')],
  cable_crunch: [i('Curl the ribs towards the hips — it is a crunch, not a hinge.')],
  hanging_leg_raise: [i('Start by curling the pelvis, not by lifting the legs.')],
};

/**
 * A fallback pool by movement pattern.
 *
 * Better than silence for an exercise with no entry of its own, and the
 * pattern is enough to say something true about the shape of the movement.
 */
export const PATTERN_CUES: Record<MovementPattern, Cue[]> = {
  horizontal_push: [e('Push yourself away from the weight.'), e('Elbows at 45 degrees, not flared.')],
  vertical_push: [e('Press the ceiling away.'), s('Ribs down and glutes tight.')],
  horizontal_pull: [e('Pull with the elbows, the hands are hooks.')],
  vertical_pull: [e('Elbows into your back pockets.')],
  squat: [e('Spread the floor with your feet.'), s('Brace before you descend.')],
  hinge: [e('Push the hips back, not the chest down.'), s('Flat back throughout.')],
  lunge: [e('Drop the back knee straight down.')],
  isolation: [i('Slow on the way down.'), i('Squeeze at the hardest point.')],
  carry: [e('Tall and quiet — no leaning.')],
  core: [i('Ribs down, glutes tight.')],
};

/** Cues for an exercise, falling back to its movement pattern. */
export function cuesFor(exerciseId: string, pattern: MovementPattern): Cue[] {
  return COACHING_CUES[exerciseId] ?? PATTERN_CUES[pattern] ?? [];
}
