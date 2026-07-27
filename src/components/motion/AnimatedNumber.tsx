import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'react-native-reanimated';

import { Text, type TextProps } from '@/design-system/Text';
import { motion } from '@/design-system/motion';

type Props = Omit<TextProps, 'children'> & {
  value: number | null;
  /** Decimals to display. */
  decimals?: number;
  /** Rendered when `value` is null. */
  placeholder?: string;
  prefix?: string;
  suffix?: string;
  /** Count-up duration; defaults to the reveal token. */
  duration?: number;
};

/**
 * Counts from the previous value to the new one instead of snapping. Every
 * number the models produce arrives this way, so a recalculation is visible as
 * it happens rather than appearing as a different screen.
 */
export function AnimatedNumber({
  value,
  decimals = 0,
  placeholder = '—',
  prefix = '',
  suffix = '',
  duration = motion.duration.reveal,
  ...textProps
}: Props) {
  const reduced = useReducedMotion();
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const from = fromRef.current;
    fromRef.current = value;

    if (value === null || from === null || reduced || from === value) {
      setDisplay(value);
      return;
    }

    const start = Date.now();
    const tick = () => {
      const elapsed = Date.now() - start;
      const t = Math.min(1, elapsed / duration);
      // Same easing curve as the rest of the app, expressed for plain JS.
      const eased = 1 - (1 - t) ** 3;
      setDisplay(from + (value - from) * eased);
      if (t < 1) frameRef.current = requestAnimationFrame(tick);
    };
    frameRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [value, duration, reduced]);

  if (display === null) {
    return (
      <Text {...textProps} mono>
        {placeholder}
      </Text>
    );
  }

  return (
    <Text {...textProps} mono>
      {`${prefix}${display.toFixed(decimals)}${suffix}`}
    </Text>
  );
}
