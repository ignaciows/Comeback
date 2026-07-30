import { describe, expect, it } from 'vitest';

import { MOVEMENTS } from '@/features/training/movements';
import { BONES, blend, solve, type Frame } from '@/features/training/skeleton';

const length = (a: [number, number], b: [number, number]) => Math.hypot(a[0] - b[0], a[1] - b[1]);

const bonesOf = (frame: Frame) => {
  const s = solve(frame);
  return {
    torso: length(s.hip, s.neck),
    neck: length(s.neck, s.head),
    upperArm: length(s.shoulder, s.elbow),
    forearm: length(s.elbow, s.hand),
    thigh: length(s.hip, s.knee),
    shin: length(s.knee, s.foot),
  };
};

describe('the figure holds together', () => {
  it('keeps every bone the same length in every frame of every movement', () => {
    // This is the whole reason the model animates angles rather than joint
    // positions. The previous version interpolated the elbow and hand
    // directly, which grew the upper arm by a third and the forearm by half
    // mid-rep — the figure visibly came apart.
    for (const [pattern, movement] of Object.entries(MOVEMENTS)) {
      for (let step = 0; step <= 20; step += 1) {
        const bones = bonesOf(blend(movement.from, movement.to, step / 20));

        for (const [bone, expected] of Object.entries(BONES)) {
          expect(bones[bone as keyof typeof bones], `${pattern} at t=${step / 20}, ${bone}`).toBeCloseTo(
            expected,
            6,
          );
        }
      }
    }
  });

  it('actually moves — a keyframe pair that does nothing is a bug, not a still', () => {
    for (const [pattern, movement] of Object.entries(MOVEMENTS)) {
      // Isometrics are the exception, and have to say so explicitly.
      if (movement.hold) continue;
      const start = solve(movement.from);
      const end = solve(movement.to);

      const travel = Math.max(
        length(start.hand, end.hand),
        length(start.hip, end.hip),
        length(start.foot, end.foot),
      );

      expect(travel, `${pattern} barely moves`).toBeGreaterThan(4);
    }
  });

  it('keeps the figure inside the box it is drawn in', () => {
    for (const [pattern, movement] of Object.entries(MOVEMENTS)) {
      for (let step = 0; step <= 10; step += 1) {
        const joints = solve(blend(movement.from, movement.to, step / 10));

        for (const [name, point] of Object.entries(joints)) {
          expect(point[0], `${pattern}: ${name} off the left/right`).toBeGreaterThan(-6);
          expect(point[0], `${pattern}: ${name} off the left/right`).toBeLessThan(106);
          expect(point[1], `${pattern}: ${name} off the top/bottom`).toBeGreaterThan(-6);
          expect(point[1], `${pattern}: ${name} off the top/bottom`).toBeLessThan(106);
        }
      }
    }
  });

  it('still shows a breath on an isometric, rather than freezing', () => {
    const held = Object.values(MOVEMENTS).filter((movement) => movement.hold);
    expect(held.length).toBeGreaterThan(0);

    for (const movement of held) {
      const travel = Math.hypot(
        movement.from.hip[0] - movement.to.hip[0],
        movement.from.hip[1] - movement.to.hip[1],
      );
      expect(travel).toBeGreaterThan(0.5);
    }
  });

  it('never bends a knee forwards', () => {
    // Knees hinge one way. A positive bend here would draw a leg breaking
    // backwards, which is the kind of thing that is obvious on screen and
    // invisible in a diff.
    for (const [pattern, movement] of Object.entries(MOVEMENTS)) {
      for (const frame of [movement.from, movement.to]) {
        expect(frame.knee, `${pattern} bends the knee the wrong way`).toBeLessThanOrEqual(0.001);
      }
    }
  });

  it('gives each movement a tempo that suits it', () => {
    // A squat cycling as fast as a curl reads as a different exercise.
    expect(MOVEMENTS.squat.tempo).toBeGreaterThan(MOVEMENTS.isolation.tempo);
    expect(MOVEMENTS.hinge.tempo).toBeGreaterThan(MOVEMENTS.isolation.tempo);

    for (const [pattern, movement] of Object.entries(MOVEMENTS)) {
      expect(movement.tempo, `${pattern}`).toBeGreaterThan(1000);
      expect(movement.tempo, `${pattern}`).toBeLessThan(5000);
    }
  });
});
