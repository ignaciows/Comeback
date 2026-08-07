import { StyleSheet, View, type ViewStyle } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { Label, Text } from '@/design-system/Text';
import { colors, spacing } from '@/design-system/tokens';
import type { BodyShape } from '@/domain/body/composition';

/**
 * A body drawn from its own numbers.
 *
 * Shoulder, chest, waist and hip widths and limb thickness all come from the
 * composition model, so this is a picture of the arithmetic rather than an
 * illustration chosen to look encouraging. Put two of them side by side — now,
 * and the end of a phase — and the difference on screen is exactly the
 * difference the plan predicts. If the plan predicts almost nothing, the two
 * drawings look almost identical, which is the point.
 *
 * It is a silhouette, not a portrait. It carries proportions, which is all the
 * underlying numbers actually support.
 */

type Props = {
  shape: BodyShape;
  height?: number;
  /** Dims the whole figure, for the "before" in a comparison. */
  muted?: boolean;
  caption?: string;
  style?: ViewStyle;
};

/**
 * The torso and legs, without arms.
 *
 * The arms are drawn separately and hang clear of the body. Wrapping them into
 * one outline was the first attempt and it hid the waist completely: the
 * widest point at every height became the shoulder, so every body — lean,
 * heavy, muscular — drew as the same rounded rectangle. A visible gap between
 * arm and waist is the whole reason a taper is legible.
 *
 * All coordinates sit in a 100×200 box with the centre line at x = 50, so a
 * width of 40 means 20 either side. The vertical landmarks never change; only
 * widths do, which is what keeps a before-and-after honest.
 */
function torsoPath(shape: BodyShape): string {
  const cx = 50;
  const shoulder = shape.shoulderWidth / 2;
  const chest = shape.chestWidth / 2;
  const waist = shape.waistWidth / 2;
  const hip = shape.hipWidth / 2;
  const leg = shape.legThickness;

  const yShoulder = 46;
  const yChest = 60;
  const yWaist = 90;
  const yHip = 106;
  const yKnee = 142;
  const yFoot = 176;

  const l = (v: number) => cx - v;
  const r = (v: number) => cx + v;

  return [
    `M${cx - 7} 29`,
    // Trapezius sloping out to the deltoid.
    `C${cx - 13} 31 ${l(shoulder) + 3} 36 ${l(shoulder)} ${yShoulder}`,
    `C${l(shoulder)} ${yShoulder + 6} ${l(chest)} ${yChest - 6} ${l(chest)} ${yChest}`,
    // Chest down to the waist: the taper.
    `C${l(chest)} ${yChest + 12} ${l(waist)} ${yWaist - 14} ${l(waist)} ${yWaist}`,
    `C${l(waist)} ${yWaist + 8} ${l(hip)} ${yHip - 8} ${l(hip)} ${yHip}`,
    // Left leg out and down, then back up the inside to the crotch.
    `C${l(hip)} ${yKnee - 22} ${cx - leg} ${yKnee} ${cx - leg + 1} ${yFoot - 5}`,
    `Q${cx - leg + 1} ${yFoot} ${cx - leg + 6} ${yFoot}`,
    `L${cx - 4} ${yFoot}`,
    `Q${cx - 1.5} ${yFoot} ${cx - 1.5} ${yFoot - 5}`,
    `L${cx - 1.5} ${yHip + 4}`,
    `L${cx + 1.5} ${yHip + 4}`,
    `L${cx + 1.5} ${yFoot - 5}`,
    `Q${cx + 1.5} ${yFoot} ${cx + 4} ${yFoot}`,
    `L${cx + leg - 6} ${yFoot}`,
    `Q${cx + leg - 1} ${yFoot} ${cx + leg - 1} ${yFoot - 5}`,
    `C${cx + leg} ${yKnee} ${r(hip)} ${yKnee - 22} ${r(hip)} ${yHip}`,
    // Right side back up.
    `C${r(hip)} ${yHip - 8} ${r(waist)} ${yWaist + 8} ${r(waist)} ${yWaist}`,
    `C${r(waist)} ${yWaist - 14} ${r(chest)} ${yChest + 12} ${r(chest)} ${yChest}`,
    `C${r(chest)} ${yChest - 6} ${r(shoulder)} ${yShoulder + 6} ${r(shoulder)} ${yShoulder}`,
    `C${r(shoulder) - 3} 36 ${cx + 13} 31 ${cx + 7} 29`,
    'Z',
  ].join('');
}

/**
 * One arm, as a capsule from shoulder to wrist.
 *
 * Drawn as a thick round-capped stroke rather than an outline: it gives a
 * perfect capsule for free and, more usefully, lets the arm hang at a slight
 * outward angle. Vertical arms tucked against the deltoid was the second
 * attempt, and the inner edge still landed inside the waistline, so the gap
 * that makes a taper readable never appeared.
 */
function armLine(shape: BodyShape, side: -1 | 1): { d: string; width: number } {
  const cx = 50;
  const width = shape.armThickness;
  const topX = cx + side * (shape.shoulderWidth / 2 - width * 0.3);
  // Splayed by a share of the arm's own thickness rather than a flat 1.5.
  // A constant offset is swallowed by a thick arm: on a heavier figure the
  // arm's inner edge landed within a millimetre of the waistline, so the gap
  // this function exists to create never appeared and every body — lean or
  // heavy — drew with the same straight outer edge. Scaling the splay keeps
  // the gap open at every size, which is what makes the taper visible at all.
  const bottomX = cx + side * (shape.shoulderWidth / 2 + width * 0.55);

  return { d: `M${topX} 50L${bottomX} 116`, width };
}

export function BodyRender({ shape, height = 220, muted = false, caption, style }: Props) {
  const width = height / 2;

  return (
    <View style={[styles.wrap, style]}>
      <Svg width={width} height={height} viewBox="0 0 100 200">
        <Circle
          cx={50}
          cy={16}
          r={11}
          fill={muted ? colors.surfaceRaised : colors.accentMuted}
          stroke={muted ? colors.borderStrong : colors.accent}
          strokeWidth={1.2}
        />
        <Path
          d={torsoPath(shape)}
          fill={muted ? colors.surfaceRaised : colors.accentMuted}
          stroke={muted ? colors.borderStrong : colors.accent}
          strokeWidth={1.2}
          strokeLinejoin="round"
        />
        {([-1, 1] as const).map((side) => {
          const arm = armLine(shape, side);
          return (
            <Path
              key={side}
              d={arm.d}
              stroke={muted ? colors.borderStrong : colors.accent}
              strokeWidth={arm.width}
              strokeLinecap="round"
              fill="none"
            />
          );
        })}
      </Svg>

      {caption ? <Label style={styles.caption}>{caption}</Label> : null}
    </View>
  );
}

/** Two bodies side by side, with what changed between them underneath. */
export function BodyComparison({
  now,
  later,
  nowLabel = 'Now',
  laterLabel = 'Then',
  note,
  height = 220,
  style,
}: {
  now: BodyShape;
  later: BodyShape;
  nowLabel?: string;
  laterLabel?: string;
  note?: string;
  height?: number;
  style?: ViewStyle;
}) {
  return (
    <View style={style}>
      <View style={styles.pair}>
        <BodyRender shape={now} height={height} muted caption={nowLabel} />
        <BodyRender shape={later} height={height} caption={laterLabel} />
      </View>

      {note ? (
        <Text variant="caption" tone="tertiary" style={styles.note}>
          {note}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  pair: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xxl,
  },
  caption: {
    marginTop: spacing.xs,
  },
  note: {
    textAlign: 'center',
    marginTop: spacing.lg,
  },
});
