import type { ColorValue } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { colors, iconSize } from './tokens';

export type IconName =
  | 'today'
  | 'train'
  | 'progress'
  | 'plan'
  | 'profile'
  | 'chevronRight'
  | 'chevronLeft'
  | 'chevronDown'
  | 'close'
  | 'check'
  | 'plus'
  | 'minus'
  | 'clock'
  | 'edit'
  | 'trash'
  | 'arrowUp'
  | 'arrowDown'
  | 'arrowFlat'
  | 'info';

type Props = {
  name: IconName;
  size?: number;
  color?: ColorValue;
  strokeWidth?: number;
};

/**
 * Deliberately minimal geometric glyphs — no decorative iconography, no icon
 * font dependency, so every stroke stays under our control.
 */
export function Icon({ name, size = iconSize.md, color = colors.text, strokeWidth = 1.6 }: Props) {
  const stroke = { stroke: color, strokeWidth, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {name === 'today' && (
        <>
          <Circle cx={12} cy={12} r={8} {...stroke} />
          <Circle cx={12} cy={12} r={2.6} fill={color} stroke="none" />
        </>
      )}
      {name === 'train' && (
        <>
          <Path d="M4 9v6M20 9v6" {...stroke} />
          <Rect x={7.5} y={6.5} width={3} height={11} rx={1} {...stroke} />
          <Rect x={13.5} y={6.5} width={3} height={11} rx={1} {...stroke} />
          <Path d="M10.5 12h3" {...stroke} />
        </>
      )}
      {name === 'progress' && (
        <>
          <Path d="M4 19V5" {...stroke} />
          <Path d="M4 19h16" {...stroke} />
          <Path d="M7.5 15.5l3.5-4 3 2.5 4.5-6" {...stroke} />
        </>
      )}
      {name === 'plan' && (
        <>
          {/* A route with a marker on it: where you are on the way somewhere. */}
          <Path d="M4 17c4-9 12 3 16-6" {...stroke} />
          <Circle cx={12} cy={12.6} r={2.4} fill={color} stroke="none" />
        </>
      )}
      {name === 'profile' && (
        <>
          <Circle cx={12} cy={8.5} r={3.5} {...stroke} />
          <Path d="M5.5 19.5c1.2-3.2 3.6-4.8 6.5-4.8s5.3 1.6 6.5 4.8" {...stroke} />
        </>
      )}
      {name === 'chevronRight' && <Path d="M9.5 5.5l6.5 6.5-6.5 6.5" {...stroke} />}
      {name === 'chevronLeft' && <Path d="M14.5 5.5L8 12l6.5 6.5" {...stroke} />}
      {name === 'chevronDown' && <Path d="M5.5 9.5l6.5 6.5 6.5-6.5" {...stroke} />}
      {name === 'close' && <Path d="M6 6l12 12M18 6L6 18" {...stroke} />}
      {name === 'check' && <Path d="M5 12.5l4.5 4.5L19 7" {...stroke} />}
      {name === 'plus' && <Path d="M12 5v14M5 12h14" {...stroke} />}
      {name === 'minus' && <Path d="M5 12h14" {...stroke} />}
      {name === 'clock' && (
        <>
          <Circle cx={12} cy={12} r={8} {...stroke} />
          <Path d="M12 7.5V12l3 2" {...stroke} />
        </>
      )}
      {name === 'edit' && <Path d="M4 20h4L19 9l-4-4L4 16v4z" {...stroke} />}
      {name === 'trash' && (
        <>
          <Path d="M4 7h16" {...stroke} />
          <Path d="M9 7V4.5h6V7" {...stroke} />
          <Path d="M6.5 7l1 12.5h9L17.5 7" {...stroke} />
        </>
      )}
      {name === 'arrowUp' && <Path d="M12 19V5M6 11l6-6 6 6" {...stroke} />}
      {name === 'arrowDown' && <Path d="M12 5v14M6 13l6 6 6-6" {...stroke} />}
      {name === 'arrowFlat' && <Path d="M5 12h14M15 8l4 4-4 4" {...stroke} />}
      {name === 'info' && (
        <>
          <Circle cx={12} cy={12} r={8} {...stroke} />
          <Path d="M12 11v5.5" {...stroke} />
          <Circle cx={12} cy={8} r={1} fill={color} stroke="none" />
        </>
      )}
    </Svg>
  );
}
