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
  | 'info'
  | 'gym'
  | 'search'
  | 'calendar'
  | 'pause'
  | 'play'
  | 'restart'
  | 'target'
  | 'body'
  | 'journal'
  | 'sleep'
  | 'nutrition'
  | 'bolt'
  | 'sources'
  | 'method';

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
      {name === 'gym' && (
        <>
          {/* A loaded bar: the one shape every gym has. */}
          <Path d="M3 12h18" {...stroke} />
          <Rect x={4} y={8.5} width={2.6} height={7} rx={1} {...stroke} />
          <Rect x={7.4} y={10} width={2} height={4} rx={0.8} {...stroke} />
          <Rect x={14.6} y={10} width={2} height={4} rx={0.8} {...stroke} />
          <Rect x={17.4} y={8.5} width={2.6} height={7} rx={1} {...stroke} />
        </>
      )}
      {name === 'search' && (
        <>
          <Circle cx={11} cy={11} r={6} {...stroke} />
          <Path d="M15.5 15.5L20 20" {...stroke} />
        </>
      )}
      {name === 'calendar' && (
        <>
          <Rect x={4} y={6} width={16} height={14} rx={2.5} {...stroke} />
          <Path d="M4 10.5h16M8.5 4v4M15.5 4v4" {...stroke} />
        </>
      )}
      {name === 'pause' && <Path d="M9.5 6v12M14.5 6v12" {...stroke} />}
      {name === 'play' && <Path d="M8 5.5l11 6.5-11 6.5z" {...stroke} />}
      {name === 'restart' && (
        <>
          <Path d="M19 12a7 7 0 11-2.4-5.3" {...stroke} />
          <Path d="M19 4v4h-4" {...stroke} />
        </>
      )}
      {name === 'target' && (
        <>
          <Circle cx={12} cy={12} r={8} {...stroke} />
          <Circle cx={12} cy={12} r={3.6} {...stroke} />
          <Circle cx={12} cy={12} r={1} fill={color} stroke="none" />
        </>
      )}
      {name === 'body' && (
        <>
          <Circle cx={12} cy={5.5} r={2.6} {...stroke} />
          <Path d="M12 8.5v6.5" {...stroke} />
          <Path d="M6.5 11l5.5 1.6 5.5-1.6" {...stroke} />
          <Path d="M12 15l-3 5.5M12 15l3 5.5" {...stroke} />
        </>
      )}
      {name === 'journal' && (
        <>
          <Rect x={5} y={4} width={14} height={16} rx={2} {...stroke} />
          <Path d="M9 4v16" {...stroke} />
          <Path d="M12.5 9h3.5M12.5 13h3.5" {...stroke} />
        </>
      )}
      {name === 'sleep' && <Path d="M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z" {...stroke} />}
      {name === 'nutrition' && (
        <>
          <Path d="M12 8c3-4 8-2 8 3s-5 9-8 9-8-4-8-9 5-7 8-3z" {...stroke} />
          <Path d="M12 8V4.5" {...stroke} />
        </>
      )}
      {name === 'bolt' && <Path d="M13.5 3L6 13.5h5L10.5 21 18 10.5h-5z" {...stroke} />}
      {name === 'sources' && (
        <>
          <Circle cx={6.5} cy={12} r={2.5} {...stroke} />
          <Circle cx={17.5} cy={6.5} r={2.5} {...stroke} />
          <Circle cx={17.5} cy={17.5} r={2.5} {...stroke} />
          <Path d="M8.8 10.8l6.4-3.2M8.8 13.2l6.4 3.2" {...stroke} />
        </>
      )}
      {name === 'method' && (
        <>
          <Path d="M9 3v6.5L4.5 18a2 2 0 001.8 3h11.4a2 2 0 001.8-3L15 9.5V3" {...stroke} />
          <Path d="M7.5 3h9" {...stroke} />
          <Path d="M7 14h10" {...stroke} />
        </>
      )}
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
