import { getExercise } from '@/data/exercises';
import { warmupSets } from '@/domain/training/coaching';
import type { MovementPattern } from '@/domain/types';

/**
 * The ten minutes before the first working set.
 *
 * The app already knew how to ramp a barbell — `warmupSets` has been in
 * `coaching` the whole time — but nothing ever showed it, so in practice the
 * plan started at the working weight. This assembles the whole warm-up
 * instead of one lift's ramp: raise, then prepare what today actually asks
 * for, then ramp into the first heavy set.
 *
 * Three things it deliberately does not do:
 *
 *  · It is not forty minutes. The evidence for injury reduction sits with
 *    short, structured, movement-specific work, not with length, and a
 *    warm-up long enough to be a session is a warm-up people stop doing.
 *  · It is not static stretching. Holding a stretch before lifting reduces
 *    force output for up to an hour and does not lower injury risk; the
 *    mobility here is moving through range, which does not cost strength.
 *  · It is not generic. The drills are chosen from the patterns in today's
 *    session, so a pull day never warms up ankles for squats it will not do.
 *
 * Sources:
 *  · RAMP structure (Raise, Activate, Mobilise, Potentiate) — Jeffreys (2007).
 *  · Static stretching before strength work lowers force output — Simic et al.
 *    (2013) meta-analysis; Behm et al. (2016) position paper, which finds the
 *    deficit is avoided by dynamic work of the same duration.
 *  · Structured neuromuscular warm-ups cut acute injury rates roughly in half
 *    — Soligard et al. (2008); Lauersen et al. (2014) meta-analysis.
 *  · Ramping sets before the working weight — ACSM position stand (2009).
 */

export type WarmupPhase = 'raise' | 'mobilise' | 'ramp';

export type WarmupStep = {
  id: string;
  phase: WarmupPhase;
  /** What to do, in the imperative. */
  label: string;
  /** How much of it — "2 min", "8 reps each side", "5 reps @ 40 kg". */
  prescription: string;
  /** Why it is here. One sentence, or null when the label says it. */
  reason: string | null;
  /** Rough seconds, used only to total the warm-up honestly. */
  seconds: number;
  /** Set on ramp steps so the UI can link back to the lift. */
  exerciseId?: string;
};

export type Warmup = {
  steps: WarmupStep[];
  /** Total in minutes, rounded up. What the header promises. */
  minutes: number;
  /** The patterns today's session actually contains. */
  patterns: MovementPattern[];
};

type Drill = {
  id: string;
  label: string;
  prescription: string;
  reason: string;
  seconds: number;
};

/**
 * Mobility drills by movement pattern.
 *
 * Keyed by pattern rather than by muscle because what limits a squat is
 * usually ankles and hips, not quadriceps — the joint that has to travel is
 * the one worth preparing.
 */
const DRILLS: Record<MovementPattern, Drill[]> = {
  squat: [
    {
      id: 'ankle_rock',
      label: 'Ankle rocks against a wall',
      prescription: '8 each side',
      reason: 'Depth is usually limited at the ankle before it is limited anywhere else.',
      seconds: 45,
    },
    {
      id: 'bodyweight_squat',
      label: 'Slow bodyweight squats',
      prescription: '10, pausing at the bottom',
      reason: 'Rehearses the pattern at the range you are about to load.',
      seconds: 45,
    },
  ],
  hinge: [
    {
      id: 'hip_hinge',
      label: 'Hip hinge with a dowel on your back',
      prescription: '10 slow',
      reason: 'Finds the hinge with a flat back before there is a bar in your hands.',
      seconds: 45,
    },
    {
      id: 'glute_bridge',
      label: 'Glute bridges',
      prescription: '12, squeezing at the top',
      reason: 'Wakes up the glutes so the lower back does not take the lift.',
      seconds: 45,
    },
  ],
  lunge: [
    {
      id: 'hip_flexor',
      label: 'Walking hip-flexor stretch',
      prescription: '6 each side, moving through',
      reason: 'Opens the trailing hip, which is what the back leg has to do.',
      seconds: 45,
    },
  ],
  horizontal_push: [
    {
      id: 'band_pull_apart',
      label: 'Band pull-aparts',
      prescription: '15',
      reason: 'Upper back first, so the shoulder has something to press from.',
      seconds: 40,
    },
    {
      id: 'scap_pushup',
      label: 'Scapular push-ups',
      prescription: '10',
      reason: 'Gets the shoulder blades moving on the ribcage rather than locked.',
      seconds: 40,
    },
  ],
  vertical_push: [
    {
      id: 'wall_slide',
      label: 'Wall slides',
      prescription: '10',
      reason: 'Overhead range is the thing most likely to be missing.',
      seconds: 40,
    },
    {
      id: 'band_pull_apart_ohp',
      label: 'Band pull-aparts',
      prescription: '15',
      reason: 'Pressing overhead from a rounded upper back is where shoulders get hurt.',
      seconds: 40,
    },
  ],
  horizontal_pull: [
    {
      id: 'scap_retraction',
      label: 'Scapular rows on the cable',
      prescription: '12, arms straight',
      reason: 'Teaches the pull to start at the shoulder blade rather than the elbow.',
      seconds: 40,
    },
  ],
  vertical_pull: [
    {
      id: 'dead_hang',
      label: 'Dead hang',
      prescription: '20 seconds',
      reason: 'Loads the shoulder at full range before you pull against it.',
      seconds: 30,
    },
    {
      id: 'scap_pullup',
      label: 'Scapular pull-ups',
      prescription: '8',
      reason: 'The bottom of the pull is the part people skip and then strain.',
      seconds: 40,
    },
  ],
  carry: [
    {
      id: 'dead_bug',
      label: 'Dead bugs',
      prescription: '8 each side',
      reason: 'Braced trunk before you walk with load in your hands.',
      seconds: 45,
    },
  ],
  core: [
    {
      id: 'cat_cow',
      label: 'Cat–cow',
      prescription: '10 slow',
      reason: 'Moves the spine through range before you ask it to resist moving.',
      seconds: 40,
    },
  ],
  // Isolation work does not need its own preparation: whatever it targets was
  // already moved by the compound that comes before it.
  isolation: [],
};

/** Where the general raise comes from. Two minutes, and no more than two. */
const RAISE: WarmupStep = {
  id: 'raise',
  phase: 'raise',
  label: 'Get warm',
  prescription: '2–3 min easy',
  reason: 'Bike, rower or brisk walk. Enough to raise your temperature, not enough to cost you anything.',
  seconds: 150,
};

export type WarmupInput = {
  /** Today's exercises, in the order they will be done. */
  exercises: { exerciseId: string; workingWeightKg: number | null }[];
};

/**
 * Builds the warm-up for a session.
 *
 * Mobility is capped at three drills. The cap is the point: past that it stops
 * being preparation and starts being the reason people skip the warm-up, and
 * the patterns are taken in session order so the first lift is the best served.
 */
export function buildWarmup({ exercises }: WarmupInput): Warmup {
  const patterns: MovementPattern[] = [];
  for (const entry of exercises) {
    const pattern = getExercise(entry.exerciseId)?.pattern;
    if (pattern && !patterns.includes(pattern)) patterns.push(pattern);
  }

  const steps: WarmupStep[] = [RAISE];

  const used = new Set<string>();
  for (const pattern of patterns) {
    for (const drill of DRILLS[pattern] ?? []) {
      if (used.has(drill.id) || used.size >= 3) continue;
      used.add(drill.id);
      steps.push({ ...drill, phase: 'mobilise' });
    }
    if (used.size >= 3) break;
  }

  // Only the first lift gets a ramp written out. The second compound of the
  // day does not need one — you are warm, and by then the ramp is just sets
  // you will not do.
  const first = exercises[0];
  if (first) {
    const ramp = warmupSets(first.exerciseId, first.workingWeightKg);
    const name = getExercise(first.exerciseId)?.name ?? 'the first lift';
    ramp.forEach((set, index) => {
      steps.push({
        id: `ramp_${index}`,
        phase: 'ramp',
        label: index === 0 ? `Ramp into ${name.toLowerCase()}` : 'Next ramp set',
        prescription: `${set.reps} reps @ ${set.weightKg} kg`,
        reason:
          index === 0
            ? 'Same movement, light. This is the part that actually protects the first heavy set.'
            : null,
        seconds: 60,
        exerciseId: first.exerciseId,
      });
    });
  }

  const seconds = steps.reduce((total, step) => total + step.seconds, 0);
  return { steps, minutes: Math.max(1, Math.ceil(seconds / 60)), patterns };
}

/** One line for the session header: what the warm-up is and how long. */
export function warmupSummary(warmup: Warmup): string {
  const ramp = warmup.steps.filter((step) => step.phase === 'ramp').length;
  const mobility = warmup.steps.filter((step) => step.phase === 'mobilise').length;
  if (ramp === 0 && mobility === 0) return `${warmup.minutes} min to get warm.`;
  if (ramp === 0) return `${warmup.minutes} min: raise, then ${mobility} drills for today's patterns.`;
  return `${warmup.minutes} min: raise, ${mobility} drills, then ${ramp} ramp sets into the first lift.`;
}
