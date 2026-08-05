import type { MovementPattern, MuscleGroup } from '@/domain/types';

/**
 * What to do in the two minutes before the first set of a given lift.
 *
 * The general warm-up gets your temperature up. It does nothing about the fact
 * that a bench press needs shoulders that will sit back and a hinge needs hips
 * that will fold — and no amount of stationary bike prepares either. This file
 * is the specific half: two to four movements that take the joints you are
 * about to load through the range you are about to load them in.
 *
 * ## What the evidence actually supports, and what it does not
 *
 * Strongly supported, and the reason this file exists at all:
 *
 *  · **Move, do not hold.** Pre-exercise static stretching reduces subsequent
 *    strength by around 5 %, power by ~2 %, and the deficit grows with holding
 *    time; under about 45 s the effect is small. Dynamic work through the
 *    range shows no impairment and often a small benefit.
 *    — Simic, Sarabon & Markovic (2013); Behm & Chaouachi (2011)
 *  · **Warm-ups have a structure worth following.** Raise, Activate, Mobilise,
 *    Potentiate: general temperature first, then the specific joints, then the
 *    pattern itself under rising load. The ramp sets the app already
 *    prescribes are the last step of that sequence; these drills are the
 *    middle two. — Jeffreys (2007)
 *  · **Overhead work needs a thoracic spine that extends.** Full overhead
 *    shoulder motion requires roughly 15° of thoracic extension, and a stiff
 *    or slouched upper back costs range directly.
 *
 * Weaker than it is usually sold as, and stated as such in the drills below:
 *
 *  · **"Activation".** That a glute drill raises subsequent gluteal EMG during
 *    the working sets is not well established — it is an open question, not a
 *    finding. What *is* measured is which drills produce the most activity
 *    while you are doing them (Distefano et al., 2009), so the drills chosen
 *    here are the ones that score well on that, and the claim made for them is
 *    rehearsal and range, not a performance boost.
 *
 * Nothing here is generated. Each drill carries the source for the specific
 * claim it makes, and where the honest answer is "this is applied practice
 * rather than a tested protocol", the source says so.
 */

export type WarmupDrill = {
  id: string;
  name: string;
  /** How much. Deliberately small — this is not the workout. */
  dose: string;
  /** What it is for, in one line. */
  why: string;
  /** Where the claim comes from. Never empty. */
  source: string;
};

/** Shared drills, so the same movement is described identically everywhere. */
const DRILLS = {
  bandPullApart: {
    id: 'band_pull_apart',
    name: 'Band pull-apart',
    dose: '2 × 15, slow',
    why: 'Wakes up the mid-back and rehearses pulling the shoulder blades back and down — the position a press is stable from.',
    source: 'EMG of the band pull-apart shows infraspinatus, mid/lower trapezius and posterior deltoid activity varying with hand position; applied practice for pressing setup.',
  },
  scapPushUp: {
    id: 'scap_push_up',
    name: 'Scapular push-up',
    dose: '2 × 10',
    why: 'Moves the shoulder blades on the rib cage through their full range without loading the elbow.',
    source: 'Mobilise phase of the RAMP structure — Jeffreys (2007).',
  },
  armCircles: {
    id: 'arm_circles',
    name: 'Arm circles, forward and back',
    dose: '30 s',
    why: 'Takes the shoulder through its whole range under no load. Moving beats holding a stretch here.',
    source: 'Behm & Chaouachi (2011): dynamic range-of-motion work does not impair force, unlike held static stretching.',
  },
  thoracicExtension: {
    id: 'thoracic_extension',
    name: 'Thoracic extension over a bench or foam roller',
    dose: '8 slow reps',
    why: 'Full overhead position needs about 15° of upper-back extension; a stiff thoracic spine takes that range straight off the lift.',
    source: 'Thoracic extension range is a direct constraint on overhead shoulder flexion; extension drills are a standard pre-overhead warm-up.',
  },
  wallSlide: {
    id: 'wall_slide',
    name: 'Wall slide',
    dose: '2 × 8',
    why: 'Rehearses getting the arms overhead with the ribs down, which is the position the press has to start from.',
    source: 'Mobilise phase of the RAMP structure — Jeffreys (2007).',
  },
  deadHang: {
    id: 'dead_hang',
    name: 'Dead hang',
    dose: '2 × 20 s',
    why: 'Loads the overhead position and the grip before you have to hold bodyweight there.',
    source: 'Raise/potentiate phases of the RAMP structure — Jeffreys (2007).',
  },
  scapPullUp: {
    id: 'scap_pull_up',
    name: 'Scapular pull-up',
    dose: '2 × 8',
    why: 'The first inch of a pull-up, on its own, so the lats start the rep instead of the arms.',
    source: 'Rehearsal of the movement pattern under low load — Jeffreys (2007), potentiate phase.',
  },
  facePull: {
    id: 'band_face_pull',
    name: 'Band face pull',
    dose: '2 × 15',
    why: 'External rotation and mid-back work through the exact range a row finishes in.',
    source: 'Applied practice; same rotator-cuff and scapular musculature measured in band pull-apart EMG work.',
  },
  catCow: {
    id: 'cat_cow',
    name: 'Cat–cow',
    dose: '8 slow cycles',
    why: 'Finds spinal flexion and extension before you ask the spine to hold one position under load.',
    source: 'Mobilise phase of the RAMP structure — Jeffreys (2007).',
  },
  gluteBridge: {
    id: 'glute_bridge',
    name: 'Glute bridge',
    dose: '2 × 12',
    why: 'Rehearses finishing a hip extension. Whether this raises glute activity in the sets afterwards is genuinely unsettled — it is here for the rehearsal and the range.',
    source: 'Distefano et al. (2009), JOSPT, measured gluteal EMG across common therapeutic exercises; the carry-over of "activation" warm-ups to later work remains an open question.',
  },
  bodyweightSquat: {
    id: 'bodyweight_squat',
    name: 'Bodyweight squat, slow to the bottom',
    dose: '2 × 10',
    why: 'The pattern itself, unloaded, through the depth you are about to load.',
    source: 'Potentiate phase of the RAMP structure — Jeffreys (2007): rehearse the specific pattern before loading it.',
  },
  ankleRock: {
    id: 'ankle_rock',
    name: 'Half-kneeling ankle rock',
    dose: '10 per side',
    why: 'Knee-over-toe range decides how upright you can squat; short ankles push the depth into the hips and back.',
    source: 'Ankle dorsiflexion available at the bottom of a squat measurably changes joint angles and muscle contribution.',
  },
  ninetyNinety: {
    id: 'ninety_ninety',
    name: '90/90 hip rotations',
    dose: '6 per side',
    why: 'Internal and external hip rotation, moving rather than held, before the hips have to travel through range under a bar.',
    source: 'Behm & Chaouachi (2011): dynamic mobility work before lifting, rather than long static holds.',
  },
  hipHinge: {
    id: 'hip_hinge_dowel',
    name: 'Dowel hip hinge',
    dose: '2 × 8',
    why: 'Grooves the hinge with a straight back before there is a loaded bar to get it wrong with.',
    source: 'Potentiate phase of the RAMP structure — Jeffreys (2007).',
  },
  legSwings: {
    id: 'leg_swings',
    name: 'Leg swings, front to back',
    dose: '12 per side',
    why: 'Hamstrings and hip flexors taken through range by moving, which is the version that does not cost you force.',
    source: 'Simic et al. (2013): held static stretching before lifting reduces strength ~5 %; dynamic swings do not.',
  },
  deadBug: {
    id: 'dead_bug',
    name: 'Dead bug',
    dose: '2 × 8 per side',
    why: 'Finds a braced trunk against a moving limb, which is what a heavy set asks the trunk to do.',
    source: 'Activate phase of the RAMP structure — Jeffreys (2007).',
  },
  wristPrep: {
    id: 'wrist_prep',
    name: 'Wrist circles and extension holds',
    dose: '30 s',
    why: 'Front-rack and pressing positions load the wrist near end range; a cold wrist is where that complaint comes from.',
    source: 'Applied practice for front-rack and pressing positions; RAMP mobilise phase — Jeffreys (2007).',
  },
  calfRaiseSlow: {
    id: 'calf_raise_slow',
    name: 'Slow bodyweight calf raises',
    dose: '2 × 15',
    why: 'Takes the ankle through the full range unloaded before adding weight to the end of it.',
    source: 'Potentiate phase of the RAMP structure — Jeffreys (2007).',
  },
  elbowPrep: {
    id: 'elbow_prep',
    name: 'Light band pressdowns',
    dose: '2 × 20',
    why: 'Blood into the elbow and triceps before loading a joint that complains when it is cold.',
    source: 'Raise phase of the RAMP structure — Jeffreys (2007).',
  },
} as const satisfies Record<string, WarmupDrill>;

/**
 * By pattern, because that is the level the answer actually lives at: every
 * horizontal press needs the same shoulders, whatever is in your hands.
 * Exercises whose demands genuinely differ from their pattern get an override
 * below.
 */
export const WARMUP_BY_PATTERN: Record<MovementPattern, WarmupDrill[]> = {
  horizontal_push: [DRILLS.bandPullApart, DRILLS.scapPushUp, DRILLS.armCircles],
  vertical_push: [DRILLS.thoracicExtension, DRILLS.wallSlide, DRILLS.bandPullApart],
  horizontal_pull: [DRILLS.bandPullApart, DRILLS.facePull, DRILLS.catCow],
  vertical_pull: [DRILLS.deadHang, DRILLS.scapPullUp, DRILLS.bandPullApart],
  squat: [DRILLS.ankleRock, DRILLS.ninetyNinety, DRILLS.bodyweightSquat],
  hinge: [DRILLS.catCow, DRILLS.gluteBridge, DRILLS.hipHinge, DRILLS.legSwings],
  lunge: [DRILLS.ninetyNinety, DRILLS.legSwings, DRILLS.gluteBridge],
  isolation: [],
  carry: [DRILLS.deadBug, DRILLS.bandPullApart],
  core: [DRILLS.catCow, DRILLS.deadBug],
};

/**
 * Where the pattern is too coarse.
 *
 * A front squat asks the wrists for something a back squat never does; a
 * standing calf raise is an isolation movement that still has one joint worth
 * preparing. Only exercises whose needs genuinely differ from their pattern
 * appear here — an override that repeats the pattern would just be a place for
 * the two to drift apart.
 */
export const WARMUP_BY_EXERCISE: Record<string, WarmupDrill[]> = {
  front_squat: [DRILLS.ankleRock, DRILLS.wristPrep, DRILLS.thoracicExtension, DRILLS.bodyweightSquat],
  overhead_press: [DRILLS.thoracicExtension, DRILLS.wallSlide, DRILLS.wristPrep, DRILLS.bandPullApart],
  deadlift: [DRILLS.catCow, DRILLS.gluteBridge, DRILLS.hipHinge, DRILLS.legSwings],
  hip_thrust: [DRILLS.gluteBridge, DRILLS.ninetyNinety],
  standing_calf_raise: [DRILLS.calfRaiseSlow],
  seated_calf_raise: [DRILLS.calfRaiseSlow],
  dip: [DRILLS.scapPushUp, DRILLS.bandPullApart, DRILLS.elbowPrep],
  push_up: [DRILLS.scapPushUp, DRILLS.armCircles],
  triceps_pushdown: [DRILLS.elbowPrep],
  overhead_triceps_extension: [DRILLS.elbowPrep, DRILLS.thoracicExtension],
  barbell_curl: [DRILLS.elbowPrep],
  hanging_leg_raise: [DRILLS.deadHang, DRILLS.deadBug],
  cable_crunch: [DRILLS.catCow, DRILLS.deadBug],
  back_extension: [DRILLS.catCow, DRILLS.gluteBridge],
};

/** Muscles a drill is chosen for, used only to explain the grouping. */
export const WARMUP_FOCUS: Partial<Record<MovementPattern, MuscleGroup>> = {
  horizontal_push: 'shoulders',
  vertical_push: 'shoulders',
  horizontal_pull: 'back',
  vertical_pull: 'back',
  squat: 'quads',
  hinge: 'hamstrings',
  lunge: 'glutes',
};

/**
 * Every source cited above, for the Method screen.
 *
 * Kept next to the drills rather than in `trainingPrinciples.ts` so a drill
 * and the paper behind it cannot drift apart.
 */
export const WARMUP_SOURCES: string[] = [
  'Simic, Sarabon & Markovic (2013), Scand J Med Sci Sports — pre-exercise static stretching reduces strength ~5 %, power ~2 %; the deficit grows with holding time.',
  'Behm & Chaouachi (2011), Eur J Appl Physiol 111:2633–2651 — dynamic range-of-motion work before training does not impair performance and often improves it.',
  'Jeffreys (2007), Professional Strength & Conditioning 6:12–18 — the RAMP structure: raise, activate, mobilise, potentiate.',
  'Distefano, Blackburn, Marshall & Padua (2009), JOSPT — gluteal EMG across common therapeutic exercises.',
  'ACSM position stand (2009) — general warm-up and the ramp into working load.',
];
