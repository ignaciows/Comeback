import { StyleSheet, View, type ViewStyle } from 'react-native';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

import { Text } from '@/design-system/Text';
import { colors, spacing } from '@/design-system/tokens';
import { EQUIPMENT_LABELS } from '@/data/exercises';
import type { EquipmentId } from '@/domain/types';

/**
 * What to look for on the gym floor.
 *
 * A beginner's real problem is not "how do I do a lat pulldown" — it is
 * standing in a room of grey metal with no idea which of these is the lat
 * pulldown. These are stylised side-on drawings of each kind of station, drawn
 * in the app's own language rather than photographed, so they stay legible at
 * thumbnail size, need no assets, and never show a machine from a brand this
 * particular gym does not have.
 *
 * They are shape cues, not manuals: the silhouette plus the sentence under it
 * is enough to walk up to the right thing.
 */

type Props = {
  equipment: EquipmentId[];
  size?: number;
  showLabels?: boolean;
  style?: ViewStyle;
};

/** One line on how to recognise it in a room. */
export const EQUIPMENT_HINTS: Record<EquipmentId, string> = {
  barbell: 'A long straight bar on a rack, with round plates you load yourself.',
  dumbbell: 'The rack of individual weights along the wall, lightest first.',
  machine: 'A seat with a fixed path and a pin you push into a numbered stack.',
  cable: 'A tall tower with a wire, a pulley you slide up or down, and swappable handles.',
  bench: 'A padded flat or angled bench, usually stored under or beside the racks.',
  rack: 'The tall steel cage or two uprights, with safety bars you set at hip height.',
  bodyweight: 'No equipment — a bar to hang from or floor space is enough.',
  kettlebell: 'Cast-iron balls with a handle on top, usually near the dumbbells.',
  band: 'Elastic loops, often hanging on a peg by the stretching area.',
  cardio: 'The treadmills, bikes and rowers, usually near the entrance.',
};

function Glyph({ equipment, size }: { equipment: EquipmentId; size: number }) {
  const stroke = {
    stroke: colors.text,
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  };
  const dim = { ...stroke, stroke: colors.textTertiary };
  const solid = { fill: colors.accent, stroke: 'none' };

  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      {equipment === 'barbell' && (
        <>
          <Line x1={6} y1={24} x2={42} y2={24} {...stroke} />
          <Rect x={8} y={17} width={5} height={14} rx={1.5} {...solid} />
          <Rect x={14} y={19} width={4} height={10} rx={1.5} {...solid} />
          <Rect x={30} y={19} width={4} height={10} rx={1.5} {...solid} />
          <Rect x={35} y={17} width={5} height={14} rx={1.5} {...solid} />
        </>
      )}

      {equipment === 'dumbbell' && (
        <>
          <Line x1={16} y1={24} x2={32} y2={24} {...stroke} />
          <Rect x={9} y={16} width={7} height={16} rx={2} {...solid} />
          <Rect x={32} y={16} width={7} height={16} rx={2} {...solid} />
        </>
      )}

      {equipment === 'machine' && (
        <>
          {/* Frame, seat, and the numbered stack with a pin. */}
          <Path d="M10 40V10h4" {...stroke} />
          <Rect x={26} y={26} width={14} height={8} rx={2} {...stroke} />
          <Path d="M30 34v6M36 34v6" {...dim} />
          <Rect x={13} y={14} width={9} height={22} rx={1.5} {...dim} />
          <Line x1={13} y1={20} x2={22} y2={20} {...dim} />
          <Line x1={13} y1={26} x2={22} y2={26} {...dim} />
          <Rect x={13} y={14} width={9} height={6} rx={1.5} {...solid} />
        </>
      )}

      {equipment === 'cable' && (
        <>
          <Path d="M12 42V8h20" {...stroke} />
          <Circle cx={32} cy={10} r={3} {...stroke} />
          <Line x1={32} y1={13} x2={32} y2={28} {...dim} />
          <Path d="M27 28h10" {...solid} strokeWidth={0} />
          <Rect x={27} y={28} width={10} height={3} rx={1.5} {...solid} />
          <Rect x={14} y={16} width={7} height={20} rx={1.5} {...dim} />
        </>
      )}

      {equipment === 'bench' && (
        <>
          <Rect x={10} y={20} width={28} height={5} rx={2.5} {...solid} />
          <Path d="M14 25v13M34 25v13" {...stroke} />
          <Path d="M10 38h8M30 38h8" {...dim} />
        </>
      )}

      {equipment === 'rack' && (
        <>
          <Path d="M12 42V8M36 42V8" {...stroke} />
          <Line x1={12} y1={18} x2={36} y2={18} {...solid} strokeWidth={0} />
          <Rect x={12} y={16} width={24} height={3} rx={1.5} {...solid} />
          <Line x1={12} y1={30} x2={36} y2={30} {...dim} />
        </>
      )}

      {equipment === 'bodyweight' && (
        <>
          <Circle cx={24} cy={13} r={5} {...stroke} />
          <Path d="M24 18v12" {...stroke} />
          <Path d="M24 30l-6 10M24 30l6 10" {...stroke} />
          <Path d="M14 22l10 3 10-3" {...stroke} />
        </>
      )}

      {equipment === 'kettlebell' && (
        <>
          <Path d="M18 20a6 6 0 0112 0" {...stroke} />
          <Path d="M16 22h16a10 10 0 01-16 0z" {...solid} />
          <Circle cx={24} cy={31} r={9} {...solid} />
        </>
      )}

      {equipment === 'band' && (
        <>
          <Path d="M12 24c0-8 24-8 24 0s-24 8-24 0z" {...stroke} />
          <Path d="M16 24c0-4 16-4 16 0" {...dim} />
        </>
      )}

      {equipment === 'cardio' && (
        <>
          <Path d="M8 38h32" {...stroke} />
          <Rect x={10} y={30} width={28} height={6} rx={3} {...solid} />
          <Path d="M36 30V12h-8" {...stroke} />
        </>
      )}
    </Svg>
  );
}

export function EquipmentIllustration({ equipment, size = 48, showLabels = true, style }: Props) {
  // Bodyweight alongside real kit is noise; it only matters on its own.
  const shown = equipment.length > 1 ? equipment.filter((item) => item !== 'bodyweight') : equipment;

  return (
    <View style={[styles.row, style]}>
      {shown.map((item) => (
        <View key={item} style={styles.item}>
          <Glyph equipment={item} size={size} />
          {showLabels ? (
            <Text variant="caption" tone="tertiary">
              {EQUIPMENT_LABELS[item]}
            </Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

/** The "walk up to the right thing" sentence for a set of equipment. */
export function equipmentHint(equipment: EquipmentId[]): string | null {
  const primary = equipment.find((item) => item !== 'bodyweight') ?? equipment[0];
  return primary ? EQUIPMENT_HINTS[primary] : null;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xl,
    alignItems: 'flex-start',
  },
  item: {
    alignItems: 'center',
    gap: spacing.xs,
  },
});
