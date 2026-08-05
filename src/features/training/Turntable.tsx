import { useRef, useState } from 'react';
import { Image, PanResponder, StyleSheet, View, type ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';

import { Label } from '@/design-system/Text';
import { colors, radius, spacing } from '@/design-system/tokens';
import { TURNTABLE_FRAMES } from '@/features/training/turntableArt';

/**
 * A movement you can spin with your thumb.
 *
 * Deliberately not a real 3D scene. `expo-gl` plus three.js plus a GLB per
 * exercise would mean a native module, which means every future change to this
 * ships as a twenty-minute build instead of an instant OTA — and the app's
 * whole delivery model is that a change reaches the phone in seconds. A ring
 * of pre-rendered frames gives the same thing the user asked for, in the same
 * art style as everything else, over the update channel that already works.
 *
 * The honest limit: the pose is fixed and only the camera moves, so this shows
 * you a position from every side rather than an animated rep. That is the
 * useful half anyway — "is my back flat", "do my knees track out" are
 * questions about one instant seen from the right angle.
 */
export function Turntable({
  exerciseId,
  size,
  style,
}: {
  exerciseId: string;
  size?: number;
  style?: ViewStyle;
}) {
  const frames = TURNTABLE_FRAMES[exerciseId];
  const [index, setIndex] = useState(0);

  // Kept in a ref as well: the pan handlers are created once and would
  // otherwise close over the first render's value forever.
  const current = useRef(0);
  const start = useRef(0);

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 4,
      onPanResponderGrant: () => {
        start.current = current.current;
      },
      onPanResponderMove: (_, gesture) => {
        const count = frames?.length ?? 0;
        if (count === 0) return;
        // A full drag across roughly a phone width is one complete turn, which
        // is the ratio that feels like spinning an object rather than
        // scrubbing a slider.
        const steps = Math.round((gesture.dx / 260) * count);
        const next = (((start.current + steps) % count) + count) % count;
        if (next !== current.current) {
          current.current = next;
          setIndex(next);
          Haptics.selectionAsync();
        }
      },
    }),
  ).current;

  if (!frames || frames.length === 0) return null;

  return (
    <View style={[styles.wrap, size ? { width: size, height: size } : null, style]} {...responder.panHandlers}>
      {/*
        Every frame is mounted and only one is visible. Swapping the `source`
        of a single Image makes each new angle decode on demand, which shows as
        a flicker exactly while the user is dragging.
      */}
      {frames.map((frame, position) => (
        <Image
          key={position}
          source={frame}
          style={[styles.frame, { opacity: position === index ? 1 : 0 }]}
          resizeMode="contain"
          accessibilityLabel={position === 0 ? 'Rotatable view of the movement' : undefined}
        />
      ))}

      <View style={styles.hint}>
        <Label>Drag to rotate</Label>
      </View>
    </View>
  );
}

export function hasTurntable(exerciseId: string): boolean {
  return (TURNTABLE_FRAMES[exerciseId]?.length ?? 0) > 0;
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.background,
  },
  frame: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  hint: {
    position: 'absolute',
    bottom: spacing.md,
    alignSelf: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    opacity: 0.85,
  },
});
