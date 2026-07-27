import { StyleSheet, View, type ViewStyle } from 'react-native';
import Svg, { Circle, Ellipse, Rect } from 'react-native-svg';

import { Label, Text } from '@/design-system/Text';
import { colors, spacing } from '@/design-system/tokens';
import { MUSCLE_GROUP_LABELS } from '@/data/exercises';
import type { MuscleGroup } from '@/domain/types';

/**
 * Which muscles a movement works, drawn.
 *
 * A stylised figure rather than an anatomical illustration: it has to read at
 * a glance, on a phone, between sets, and it has to be drawn in the app's own
 * language instead of a stock photo. Primary muscles take the accent, the ones
 * that help take a muted version, everything else stays quiet.
 *
 * Fully procedural — no image assets, so it scales to any size and works
 * offline.
 */

type Props = {
  primary: MuscleGroup;
  secondary?: MuscleGroup[];
  /** Both views by default; a single view when space is tight. */
  view?: 'front' | 'back' | 'both';
  height?: number;
  showLegend?: boolean;
  style?: ViewStyle;
};

/** Muscles visible from each side. Anything else is drawn inactive. */
const FRONT_MUSCLES: MuscleGroup[] = ['chest', 'shoulders', 'biceps', 'core', 'quads', 'calves'];
const BACK_MUSCLES: MuscleGroup[] = ['back', 'shoulders', 'triceps', 'glutes', 'hamstrings', 'calves'];

function fillFor(muscle: MuscleGroup, primary: MuscleGroup, secondary: MuscleGroup[]): string {
  if (muscle === primary) return colors.accent;
  if (secondary.includes(muscle)) return colors.accentMuted;
  return colors.surfaceRaised;
}

function FrontFigure({ primary, secondary, width }: { primary: MuscleGroup; secondary: MuscleGroup[]; width: number }) {
  const fill = (muscle: MuscleGroup) => fillFor(muscle, primary, secondary);
  const inert = colors.surfaceRaised;

  return (
    <Svg width={width} height={width * 2} viewBox="0 0 100 200">
      {/* Head and neck are never highlighted. */}
      <Circle cx={50} cy={15} r={11} fill={inert} />
      <Rect x={44} y={25} width={12} height={9} rx={3} fill={inert} />

      {/* Shoulders */}
      <Ellipse cx={27} cy={45} rx={11} ry={9} fill={fill('shoulders')} />
      <Ellipse cx={73} cy={45} rx={11} ry={9} fill={fill('shoulders')} />

      {/* Chest */}
      <Rect x={33} y={37} width={15} height={20} rx={6} fill={fill('chest')} />
      <Rect x={52} y={37} width={15} height={20} rx={6} fill={fill('chest')} />

      {/* Core */}
      <Rect x={39} y={60} width={22} height={34} rx={7} fill={fill('core')} />

      {/* Biceps and forearms */}
      <Rect x={19} y={57} width={11} height={24} rx={5} fill={fill('biceps')} />
      <Rect x={70} y={57} width={11} height={24} rx={5} fill={fill('biceps')} />
      <Rect x={17} y={83} width={9} height={24} rx={4} fill={inert} />
      <Rect x={74} y={83} width={9} height={24} rx={4} fill={inert} />

      {/* Quads */}
      <Rect x={35} y={97} width={13} height={40} rx={6} fill={fill('quads')} />
      <Rect x={52} y={97} width={13} height={40} rx={6} fill={fill('quads')} />

      {/* Calves */}
      <Rect x={36} y={140} width={11} height={32} rx={5} fill={fill('calves')} />
      <Rect x={53} y={140} width={11} height={32} rx={5} fill={fill('calves')} />
    </Svg>
  );
}

function BackFigure({ primary, secondary, width }: { primary: MuscleGroup; secondary: MuscleGroup[]; width: number }) {
  const fill = (muscle: MuscleGroup) => fillFor(muscle, primary, secondary);
  const inert = colors.surfaceRaised;

  return (
    <Svg width={width} height={width * 2} viewBox="0 0 100 200">
      <Circle cx={50} cy={15} r={11} fill={inert} />
      <Rect x={44} y={25} width={12} height={9} rx={3} fill={inert} />

      <Ellipse cx={27} cy={45} rx={11} ry={9} fill={fill('shoulders')} />
      <Ellipse cx={73} cy={45} rx={11} ry={9} fill={fill('shoulders')} />

      {/* Upper back and lats */}
      <Rect x={35} y={36} width={30} height={20} rx={8} fill={fill('back')} />
      <Rect x={31} y={54} width={16} height={26} rx={6} fill={fill('back')} />
      <Rect x={53} y={54} width={16} height={26} rx={6} fill={fill('back')} />

      {/* Lower back sits with the core group */}
      <Rect x={41} y={80} width={18} height={12} rx={5} fill={fill('core')} />

      {/* Triceps and forearms */}
      <Rect x={19} y={57} width={11} height={24} rx={5} fill={fill('triceps')} />
      <Rect x={70} y={57} width={11} height={24} rx={5} fill={fill('triceps')} />
      <Rect x={17} y={83} width={9} height={24} rx={4} fill={inert} />
      <Rect x={74} y={83} width={9} height={24} rx={4} fill={inert} />

      {/* Glutes */}
      <Rect x={35} y={94} width={30} height={20} rx={9} fill={fill('glutes')} />

      {/* Hamstrings */}
      <Rect x={35} y={116} width={13} height={26} rx={6} fill={fill('hamstrings')} />
      <Rect x={52} y={116} width={13} height={26} rx={6} fill={fill('hamstrings')} />

      {/* Calves */}
      <Rect x={36} y={144} width={11} height={28} rx={5} fill={fill('calves')} />
      <Rect x={53} y={144} width={11} height={28} rx={5} fill={fill('calves')} />
    </Svg>
  );
}

export function MuscleMap({
  primary,
  secondary = [],
  view = 'both',
  height = 180,
  showLegend = true,
  style,
}: Props) {
  const width = height / 2;
  const showFront =
    view === 'front' ||
    (view === 'both' && (FRONT_MUSCLES.includes(primary) || secondary.some((muscle) => FRONT_MUSCLES.includes(muscle))));
  const showBack =
    view === 'back' ||
    (view === 'both' && (BACK_MUSCLES.includes(primary) || secondary.some((muscle) => BACK_MUSCLES.includes(muscle))));

  return (
    <View style={style}>
      <View style={styles.figures}>
        {showFront ? (
          <View style={styles.figure}>
            <FrontFigure primary={primary} secondary={secondary} width={width} />
            <Label style={styles.viewLabel}>Front</Label>
          </View>
        ) : null}
        {showBack ? (
          <View style={styles.figure}>
            <BackFigure primary={primary} secondary={secondary} width={width} />
            <Label style={styles.viewLabel}>Back</Label>
          </View>
        ) : null}
      </View>

      {showLegend ? (
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.swatch, { backgroundColor: colors.accent }]} />
            <Text variant="caption" tone="secondary">
              {MUSCLE_GROUP_LABELS[primary]}
            </Text>
          </View>
          {secondary.map((muscle) => (
            <View key={muscle} style={styles.legendItem}>
              <View style={[styles.swatch, { backgroundColor: colors.accentMuted }]} />
              <Text variant="caption" tone="tertiary">
                {MUSCLE_GROUP_LABELS[muscle]}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  figures: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xxl,
  },
  figure: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  viewLabel: {
    marginTop: spacing.xs,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.lg,
    marginTop: spacing.lg,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  swatch: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
