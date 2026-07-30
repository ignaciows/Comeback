import { useEffect } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

import { Label } from '@/design-system/Text';
import { motion, useAmbientMotion } from '@/design-system/motion';
import { borderWidth, colors, radius, spacing } from '@/design-system/tokens';
import type { EquipmentId, MovementPattern } from '@/domain/types';

/**
 * The movement, moving.
 *
 * A muscle map says what an exercise trains; it says nothing about what you
 * actually do. This is a side-on figure performing the rep on a loop, with the
 * bench, rack or cable it is done on drawn behind it — enough to walk up to
 * the right station and copy the shape.
 *
 * It is deliberately a stick figure. A more detailed drawing would need real
 * assets, would be wrong for half the body types using it, and would not read
 * any better at the size this is looked at. What matters is which joints move
 * and which stay still, and a stick figure shows that better than a photo.
 *
 * Every pose below is the two ends of one rep. The loop eases between them at
 * the tempo the movement is actually performed at, so a squat looks like a
 * squat and a curl looks like a curl.
 */

import { MOVEMENTS, type Movement } from '@/features/training/movements';
import { armPath, blend, bodyPath, farPath, solve } from '@/features/training/skeleton';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function Station({ kind }: { kind: Movement['station'] }) {
  const line = { stroke: colors.borderStrong, strokeWidth: 2, strokeLinecap: 'round' as const };

  return (
    <>
      <Line x1={6} y1={94} x2={94} y2={94} {...line} />

      {kind === 'bench' && (
        <>
          <Rect x={22} y={62} width={52} height={6} rx={3} fill={colors.borderStrong} />
          <Line x1={30} y1={68} x2={30} y2={94} {...line} />
          <Line x1={66} y1={68} x2={66} y2={94} {...line} />
        </>
      )}

      {kind === 'rack' && (
        <>
          <Line x1={16} y1={20} x2={16} y2={94} {...line} />
          <Line x1={84} y1={20} x2={84} y2={94} {...line} />
          <Line x1={16} y1={30} x2={26} y2={30} {...line} />
          <Line x1={84} y1={30} x2={74} y2={30} {...line} />
        </>
      )}

      {kind === 'cable' && (
        <>
          <Line x1={82} y1={6} x2={82} y2={94} {...line} />
          <Line x1={82} y1={6} x2={56} y2={6} {...line} />
          <Circle cx={56} cy={6} r={3} fill="none" {...line} />
        </>
      )}

      {kind === 'machine' && (
        <>
          <Rect x={70} y={20} width={16} height={50} rx={2} fill="none" {...line} />
          <Line x1={70} y1={34} x2={86} y2={34} {...line} />
          <Line x1={70} y1={48} x2={86} y2={48} {...line} />
        </>
      )}
    </>
  );
}

type Props = {
  pattern: MovementPattern;
  equipment?: EquipmentId[];
  size?: number;
  /** Shown under the figure. */
  caption?: string;
  style?: ViewStyle;
};

export function ExerciseAnimation({ pattern, equipment = [], size = 200, caption, style }: Props) {
  const movement = MOVEMENTS[pattern] ?? MOVEMENTS.isolation;
  const animate = useAmbientMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (!animate) {
      // Reduce-motion: hold the finished position rather than freezing mid-rep.
      progress.value = 1;
      return;
    }
    progress.value = 0;
    progress.value = withRepeat(
      withTiming(1, { duration: movement.tempo / 2, easing: motion.easing.inOut }),
      -1,
      true,
    );
  }, [animate, movement.tempo, progress]);

  /**
   * The whole skeleton as one path per colour, built inside the worklet.
   *
   * One animated value drives everything, so no joint can lag behind another,
   * and the hooks stay at the top level instead of being called from a helper.
   */
  const from = movement.from;
  const to = movement.to;

  /**
   * Each stroke is rebuilt inside the worklet from the solved skeleton.
   *
   * The angles are what get interpolated — never the joint positions — so no
   * frame in between can produce a bone of the wrong length. One shared value
   * drives all of them, so nothing can lag behind anything else.
   */
  const bodyProps = useAnimatedProps(() => ({ d: bodyPath(solve(blend(from, to, progress.value))) }));
  const armProps = useAnimatedProps(() => ({ d: armPath(solve(blend(from, to, progress.value))) }));
  const farProps = useAnimatedProps(() => ({ d: farPath(solve(blend(from, to, progress.value))) }));

  const headProps = useAnimatedProps(() => {
    const head = solve(blend(from, to, progress.value)).head;
    return { cx: head[0], cy: head[1] };
  });

  const handProps = useAnimatedProps(() => {
    const hand = solve(blend(from, to, progress.value)).hand;
    return { cx: hand[0], cy: hand[1] };
  });

  const limb = {
    stroke: colors.text,
    strokeWidth: 3.4,
    strokeLinecap: 'round' as const,
  };

  const station = equipment.includes('machine') ? 'machine' : movement.station;

  return (
    <View style={[styles.wrap, style]}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Station kind={station} />

        {/* The far arm and leg, dimmer and behind: without them a side-on
            figure standing still is a single vertical line. */}
        <AnimatedPath
          animatedProps={farProps}
          {...limb}
          stroke={colors.textTertiary}
          strokeWidth={3}
          fill="none"
        />

        <AnimatedPath animatedProps={bodyProps} {...limb} fill="none" />
        {/* The working arm takes the accent: it is the part to copy. */}
        <AnimatedPath animatedProps={armProps} {...limb} stroke={colors.accent} fill="none" />

        <AnimatedCircle animatedProps={headProps} r={7} fill={colors.text} />

        {/* What the hands are holding, carried along with them. */}
        {movement.implement === 'bar' ? (
          <AnimatedCircle animatedProps={handProps} r={3.4} fill={colors.accent} />
        ) : null}
        {movement.implement === 'dumbbell' ? (
          <AnimatedCircle animatedProps={handProps} r={4} fill={colors.accent} />
        ) : null}
        {movement.implement === 'handle' ? (
          <AnimatedCircle animatedProps={handProps} r={3} fill={colors.accent} />
        ) : null}
      </Svg>

      {caption ? <Label style={styles.caption}>{caption}</Label> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    borderRadius: radius.lg,
    borderWidth: borderWidth.hairline,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  caption: {
    marginBottom: spacing.xs,
  },
});
