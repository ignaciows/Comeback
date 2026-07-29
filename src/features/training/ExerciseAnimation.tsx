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

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type Point = [number, number];

/** Joints of a side-on figure in a 100×100 box. Feet at y ≈ 92. */
type Pose = {
  head: Point;
  neck: Point;
  hip: Point;
  shoulder: Point;
  elbow: Point;
  hand: Point;
  knee: Point;
  foot: Point;
};

type Movement = {
  /** Bottom, or start, of the rep. */
  from: Pose;
  /** Top, or finish. */
  to: Pose;
  /** One full rep in milliseconds. */
  tempo: number;
  /** Drawn behind the figure. */
  station: 'floor' | 'bench' | 'rack' | 'cable' | 'machine' | 'bar_overhead';
  /** What the hands are holding, drawn at the hand position. */
  implement: 'bar' | 'dumbbell' | 'handle' | 'none';
};

const lyingBase = {
  head: [30, 56] as Point,
  neck: [37, 58] as Point,
  hip: [62, 60] as Point,
  knee: [74, 66] as Point,
  foot: [78, 88] as Point,
};

const standingBase = {
  head: [50, 14] as Point,
  neck: [50, 22] as Point,
  hip: [50, 52] as Point,
};

const MOVEMENTS: Record<MovementPattern, Movement> = {
  // Lying on a bench, pressing away from the chest.
  horizontal_push: {
    from: { ...lyingBase, shoulder: [40, 56], elbow: [40, 44], hand: [34, 50] },
    to: { ...lyingBase, shoulder: [40, 56], elbow: [36, 40], hand: [40, 28] },
    tempo: 2600,
    station: 'bench',
    implement: 'bar',
  },
  /**
   * Standing, pressing overhead.
   *
   * This one sits lower than the other standing movements on purpose: the bar
   * has to finish above the head, and with the usual standing height there was
   * no room left, so the figure appeared to punch itself.
   */
  vertical_push: {
    from: {
      head: [50, 26],
      neck: [50, 34],
      hip: [50, 58],
      shoulder: [50, 36],
      elbow: [61, 42],
      hand: [59, 30],
      knee: [50, 76],
      foot: [50, 92],
    },
    to: {
      head: [50, 26],
      neck: [50, 34],
      hip: [50, 58],
      shoulder: [50, 36],
      elbow: [55, 22],
      hand: [52, 8],
      knee: [50, 76],
      foot: [50, 92],
    },
    tempo: 2800,
    station: 'floor',
    implement: 'bar',
  },
  // Hinged over, pulling towards the waist.
  horizontal_pull: {
    from: {
      head: [30, 32],
      neck: [36, 34],
      hip: [64, 44],
      shoulder: [38, 36],
      elbow: [36, 52],
      hand: [36, 66],
      knee: [66, 68],
      foot: [64, 92],
    },
    to: {
      head: [30, 32],
      neck: [36, 34],
      hip: [64, 44],
      shoulder: [38, 36],
      elbow: [50, 46],
      hand: [42, 44],
      knee: [66, 68],
      foot: [64, 92],
    },
    tempo: 2600,
    station: 'floor',
    implement: 'bar',
  },
  // Hanging or seated, pulling from overhead down to the chest.
  vertical_pull: {
    from: {
      head: [50, 30],
      neck: [50, 38],
      hip: [50, 62],
      shoulder: [50, 40],
      elbow: [53, 26],
      hand: [56, 12],
      knee: [56, 78],
      foot: [52, 92],
    },
    to: {
      head: [50, 26],
      neck: [50, 34],
      hip: [50, 62],
      shoulder: [50, 38],
      elbow: [60, 50],
      hand: [53, 42],
      knee: [56, 78],
      foot: [52, 92],
    },
    tempo: 2800,
    station: 'cable',
    implement: 'handle',
  },
  // Bar on the back, hips and knees bending together.
  squat: {
    from: {
      head: [46, 34],
      neck: [47, 42],
      hip: [50, 66],
      shoulder: [47, 44],
      elbow: [40, 48],
      hand: [38, 42],
      knee: [62, 68],
      foot: [52, 92],
    },
    to: {
      head: [48, 12],
      neck: [49, 20],
      hip: [50, 50],
      shoulder: [49, 22],
      elbow: [40, 26],
      hand: [38, 20],
      knee: [52, 72],
      foot: [52, 92],
    },
    tempo: 3000,
    station: 'rack',
    implement: 'bar',
  },
  // Bar travelling up the legs, knees nearly still, hips doing the work.
  hinge: {
    from: {
      head: [34, 34],
      neck: [39, 37],
      hip: [60, 50],
      shoulder: [41, 39],
      elbow: [42, 54],
      hand: [43, 68],
      knee: [62, 70],
      foot: [58, 92],
    },
    to: {
      head: [50, 14],
      neck: [50, 22],
      hip: [52, 52],
      shoulder: [51, 24],
      elbow: [52, 40],
      hand: [52, 56],
      knee: [54, 72],
      foot: [54, 92],
    },
    tempo: 3200,
    station: 'floor',
    implement: 'bar',
  },
  // One leg forward, back knee dropping.
  lunge: {
    from: {
      head: [48, 16],
      neck: [48, 24],
      hip: [48, 54],
      shoulder: [48, 26],
      elbow: [44, 38],
      hand: [42, 50],
      knee: [66, 66],
      foot: [70, 90],
    },
    to: {
      head: [48, 26],
      neck: [48, 34],
      hip: [48, 62],
      shoulder: [48, 36],
      elbow: [44, 48],
      hand: [42, 60],
      knee: [70, 74],
      foot: [72, 92],
    },
    tempo: 3000,
    station: 'floor',
    implement: 'dumbbell',
  },
  // Standing, one joint moving: the curl shape stands for isolation work.
  isolation: {
    from: {
      ...standingBase,
      shoulder: [50, 28],
      elbow: [50, 46],
      hand: [52, 64],
      knee: [50, 72],
      foot: [50, 92],
    },
    to: {
      ...standingBase,
      shoulder: [50, 28],
      elbow: [50, 46],
      hand: [42, 32],
      knee: [50, 72],
      foot: [50, 92],
    },
    tempo: 2400,
    station: 'floor',
    implement: 'dumbbell',
  },
  // Walking with load: the body barely changes, the feet do.
  carry: {
    from: {
      ...standingBase,
      shoulder: [50, 28],
      elbow: [52, 42],
      hand: [53, 58],
      knee: [46, 72],
      foot: [42, 92],
    },
    to: {
      ...standingBase,
      shoulder: [50, 28],
      elbow: [52, 42],
      hand: [53, 58],
      knee: [54, 72],
      foot: [58, 92],
    },
    tempo: 1600,
    station: 'floor',
    implement: 'dumbbell',
  },
  // Lying, curling the trunk.
  core: {
    from: {
      head: [22, 62],
      neck: [30, 62],
      hip: [58, 64],
      shoulder: [32, 62],
      elbow: [28, 56],
      hand: [24, 58],
      knee: [70, 52],
      foot: [78, 70],
    },
    to: {
      head: [34, 48],
      neck: [40, 54],
      hip: [58, 64],
      shoulder: [41, 54],
      elbow: [36, 48],
      hand: [33, 46],
      knee: [70, 52],
      foot: [78, 70],
    },
    tempo: 2400,
    station: 'floor',
    implement: 'none',
  },
};

/** The station under the figure. Static — only the body moves. */
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

  const bodyProps = useAnimatedProps(() => {
    const at = (key: keyof Pose): [number, number] => [
      from[key][0] + (to[key][0] - from[key][0]) * progress.value,
      from[key][1] + (to[key][1] - from[key][1]) * progress.value,
    ];
    const [hx, hy] = at('head');
    const [nx, ny] = at('neck');
    const [px, py] = at('hip');
    const [kx, ky] = at('knee');
    const [fx, fy] = at('foot');

    return { d: `M${hx} ${hy}L${nx} ${ny}L${px} ${py}L${kx} ${ky}L${fx} ${fy}` };
  });

  const armProps = useAnimatedProps(() => {
    const at = (key: keyof Pose): [number, number] => [
      from[key][0] + (to[key][0] - from[key][0]) * progress.value,
      from[key][1] + (to[key][1] - from[key][1]) * progress.value,
    ];
    const [sx, sy] = at('shoulder');
    const [ex, ey] = at('elbow');
    const [ax, ay] = at('hand');

    return { d: `M${sx} ${sy}L${ex} ${ey}L${ax} ${ay}` };
  });

  const headProps = useAnimatedProps(() => ({
    cx: from.head[0] + (to.head[0] - from.head[0]) * progress.value,
    cy: from.head[1] + (to.head[1] - from.head[1]) * progress.value,
  }));

  const handProps = useAnimatedProps(() => ({
    cx: from.hand[0] + (to.hand[0] - from.hand[0]) * progress.value,
    cy: from.hand[1] + (to.hand[1] - from.hand[1]) * progress.value,
  }));

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
