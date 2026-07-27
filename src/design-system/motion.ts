import { Easing, useReducedMotion, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { useEffect } from 'react';

/**
 * Motion tokens.
 *
 * The app is a tracker, so it should read as something that is running rather
 * than a page that was printed. That comes from a small number of slow, quiet,
 * continuous motions — a heartbeat — not from things flying around.
 *
 * Rules:
 *  · Ambient loops are slow (2.4–6s) and low amplitude (≤6% scale, ≤0.25 alpha).
 *  · Reactions to a tap are fast (120–260ms) and land, they do not bounce.
 *  · Everything here respects the system "reduce motion" setting.
 */

export const motion = {
  duration: {
    instant: 120,
    fast: 180,
    base: 260,
    slow: 420,
    reveal: 620,
  },
  /** Ambient loop periods, in ms. */
  loop: {
    heartbeat: 2600,
    breathe: 4200,
    sweep: 6000,
    scan: 2400,
  },
  stagger: 55,
  easing: {
    /** Default for anything entering or settling. */
    out: Easing.bezier(0.16, 1, 0.3, 1),
    inOut: Easing.bezier(0.65, 0, 0.35, 1),
    linear: Easing.linear,
  },
  amplitude: {
    pulseScale: 0.06,
    pulseOpacity: 0.25,
  },
} as const;

/** True when the OS asks for reduced motion; ambient loops stay still. */
export function useAmbientMotion(): boolean {
  return !useReducedMotion();
}

/**
 * A shared value oscillating 0 → 1 → 0 forever. The single source of the
 * app's ambient rhythm: every idle animation reads from one of these so the
 * whole screen breathes together instead of drifting out of phase.
 */
export function useLoop(period: number = motion.loop.heartbeat) {
  const enabled = useAmbientMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (!enabled) {
      progress.value = 0;
      return;
    }
    progress.value = 0;
    progress.value = withRepeat(
      withTiming(1, { duration: period, easing: motion.easing.inOut }),
      -1,
      true,
    );
  }, [enabled, period, progress]);

  return progress;
}

/** Monotonic 0 → 1 loop, for sweeps and anything that should not reverse. */
export function useSweep(period: number = motion.loop.sweep) {
  const enabled = useAmbientMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (!enabled) {
      progress.value = 0;
      return;
    }
    progress.value = 0;
    progress.value = withRepeat(withTiming(1, { duration: period, easing: Easing.linear }), -1, false);
  }, [enabled, period, progress]);

  return progress;
}
