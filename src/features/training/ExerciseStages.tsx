import { StyleSheet, View, type ViewStyle } from 'react-native';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

import { Icon } from '@/design-system/Icon';
import { Label, Text } from '@/design-system/Text';
import { borderWidth, colors, radius, spacing } from '@/design-system/tokens';
import type { EquipmentId, MovementPattern } from '@/domain/types';
import { MOVEMENTS, type Movement } from '@/features/training/movements';
import { armPath, bodyPath, farPath, solve } from '@/features/training/skeleton';

/**
 * The two positions that define a movement, side by side and still.
 *
 * A looping figure turned out to be the wrong tool. Motion at this size reads
 * as wobble: you cannot tell where the rep starts, where it ends, or which
 * moment is the one that matters, and a limb sweeping past is harder to copy
 * than a limb held still. Every printed exercise guide ever made shows two
 * frames for exactly this reason.
 *
 * So: bottom and top, labelled, with an arrow for the direction and the
 * equipment drawn behind. Nothing moves. The whole thing can be understood
 * from a photograph of the screen, which is the actual test — people look at
 * this once in a gym, not for thirty seconds.
 */

const AT_REST: Record<MovementPattern, [string, string]> = {
  horizontal_push: ['Bar at the chest', 'Arms locked out'],
  vertical_push: ['Bar at the shoulders', 'Overhead, head through'],
  horizontal_pull: ['Arms straight', 'Bar at the belt'],
  vertical_pull: ['Hanging, arms straight', 'Bar at the collarbone'],
  squat: ['Hips below the knees', 'Standing tall'],
  hinge: ['Bar at mid-shin', 'Hips locked out'],
  lunge: ['Back knee down', 'Standing'],
  isolation: ['Arm straight', 'Squeezed at the top'],
  carry: ['Mid-stride', 'Other side'],
  core: ['Braced', 'Hold it there'],
};

export function ExerciseStages({
  pattern,
  equipment = [],
  style,
}: {
  pattern: MovementPattern;
  equipment?: EquipmentId[];
  style?: ViewStyle;
}) {
  const movement = MOVEMENTS[pattern] ?? MOVEMENTS.isolation;
  const [startLabel, endLabel] = AT_REST[pattern] ?? AT_REST.isolation;
  const station = equipment.includes('machine') ? 'machine' : movement.station;

  return (
    <View style={[styles.wrap, style]}>
      <Stage
        frame={movement.from}
        station={station}
        caption={startLabel}
        step={1}
        implement={movement.implement}
        holdAt={movement.holdAt}
      />

      <View style={styles.arrow}>
        <Icon name="arrowUp" size={18} color={colors.accent} />
      </View>

      <Stage
        frame={movement.to}
        station={station}
        caption={endLabel}
        step={2}
        implement={movement.implement}
        holdAt={movement.holdAt}
      />
    </View>
  );
}

function Stage({
  frame,
  station,
  caption,
  step,
  implement,
  holdAt,
}: {
  frame: (typeof MOVEMENTS)[MovementPattern]['from'];
  station: string;
  caption: string;
  step: number;
  implement: Movement['implement'];
  holdAt: Movement['holdAt'];
}) {
  const joints = solve(frame);

  return (
    <View style={styles.stage}>
      <View style={styles.canvas}>
        <Svg width="100%" height="100%" viewBox="0 0 100 100">
          <Station kind={station} />

          <Path d={farPath(joints)} stroke={colors.textTertiary} strokeWidth={3} strokeLinecap="round" fill="none" />
          <Path
            d={bodyPath(joints)}
            stroke={colors.text}
            strokeWidth={3.6}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <Path
            d={armPath(joints)}
            stroke={colors.accent}
            strokeWidth={3.6}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
            <Circle cx={joints.head[0]} cy={joints.head[1]} r={7} fill={colors.text} />

          <Implement joints={joints} kind={implement} where={holdAt} />
        </Svg>

        <View style={styles.step}>
          <Text variant="caption" mono style={styles.stepText}>
            {step}
          </Text>
        </View>
      </View>

      <Label style={styles.caption}>{caption}</Label>
    </View>
  );
}

/**
 * What the hands are holding.
 *
 * Seen from the side a barbell is a bar end, so it is always drawn
 * horizontal. Deriving its angle from the two hand positions looks correct
 * until the arms come together, where the vector between them collapses and
 * the bar swings off at a wild diagonal.
 *
 * And a back squat carries the bar on the shoulders. Drawing it in the hands
 * leaves it floating in mid-air beside the figure, which is exactly the kind
 * of thing that makes a drawing unreadable rather than merely imperfect.
 */
function Implement({
  joints,
  kind,
  where,
}: {
  joints: ReturnType<typeof solve>;
  kind: Movement['implement'];
  where: Movement['holdAt'];
}) {
  const [x, y] = where === 'shoulders' ? joints.neck : joints.hand;

  if (kind === 'bar') {
    return (
      <>
        <Line x1={x - 15} y1={y} x2={x + 15} y2={y} stroke={colors.accent} strokeWidth={3.2} strokeLinecap="round" />
        <Circle cx={x - 15} cy={y} r={2.6} fill={colors.accent} />
        <Circle cx={x + 15} cy={y} r={2.6} fill={colors.accent} />
      </>
    );
  }

  if (kind === 'dumbbell') {
    const [fx, fy] = joints.farHand;
    return (
      <>
        <Line x1={fx - 4} y1={fy} x2={fx + 4} y2={fy} stroke={colors.textTertiary} strokeWidth={4.4} strokeLinecap="round" />
        <Line x1={x - 4} y1={y} x2={x + 4} y2={y} stroke={colors.accent} strokeWidth={4.4} strokeLinecap="round" />
      </>
    );
  }

  if (kind === 'handle') return <Circle cx={x} cy={y} r={3.2} fill={colors.accent} />;

  return null;
}

/** The bench, rack or cable the movement happens on. */
function Station({ kind }: { kind: string }) {
  const line = { stroke: colors.border, strokeWidth: 2.5, strokeLinecap: 'round' as const };

  if (kind === 'bench') {
    return (
      <>
        <Rect x={18} y={64} width={62} height={7} rx={3.5} fill={colors.surfaceRaised} />
        <Line x1={26} y1={71} x2={26} y2={92} {...line} />
        <Line x1={72} y1={71} x2={72} y2={92} {...line} />
      </>
    );
  }

  if (kind === 'rack') {
    return (
      <>
        <Line x1={14} y1={16} x2={14} y2={94} {...line} />
        <Line x1={86} y1={16} x2={86} y2={94} {...line} />
        <Line x1={14} y1={28} x2={24} y2={28} {...line} />
        <Line x1={86} y1={28} x2={76} y2={28} {...line} />
      </>
    );
  }

  if (kind === 'cable') {
    return (
      <>
        <Line x1={84} y1={8} x2={84} y2={94} {...line} />
        <Line x1={84} y1={8} x2={54} y2={8} {...line} />
        <Circle cx={54} cy={8} r={3.5} fill="none" {...line} />
      </>
    );
  }

  if (kind === 'machine') {
    return (
      <>
        <Rect x={70} y={22} width={18} height={52} rx={3} fill="none" {...line} />
        <Line x1={70} y1={38} x2={88} y2={38} {...line} />
        <Line x1={70} y1={54} x2={88} y2={54} {...line} />
      </>
    );
  }

  return <Line x1={8} y1={94} x2={92} y2={94} {...line} />;
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  stage: {
    flex: 1,
    gap: spacing.sm,
  },
  canvas: {
    aspectRatio: 1,
    borderRadius: radius.lg,
    borderWidth: borderWidth.hairline,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  step: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    width: 18,
    height: 18,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: {
    color: colors.textSecondary,
  },
  arrow: {
    paddingBottom: spacing.xl,
  },
  caption: {
    textAlign: 'center',
  },
});
