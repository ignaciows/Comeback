import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

import { colors } from '@/design-system/tokens';
import {
  ACCENT, AXIS, DIM, H, PAD, SHAPES, W, curvePath, hasDiagram, x, y,
} from '@/features/learn/diagramGeometry';

export { hasDiagram };

/**
 * The diagram that carries a lesson's argument.
 *
 * The first seven lessons ship flat PNGs (see `lessonArt.ts`). Everything
 * added since is drawn here instead, for the reason that file already gives
 * for the body: a picture generated once is a picture you cannot change. These
 * are shapes with numbers behind them, so a curve that flattens flattens
 * because the array says so, and editing the claim edits the drawing. They also
 * stay sharp at any size, take the palette from the theme, and weigh nothing.
 *
 * Same rules as the PNGs: dark ground, one accent, no text baked in. Words in
 * the artwork cannot be translated and cannot be read at small sizes — the
 * cards next to the diagram carry them.
 *
 * There are six shapes, not sixteen drawings. A dose-response curve and a
 * pair of bars answer most of what these lessons need to show, and a set of
 * six things reused reads as one system where sixteen bespoke ones would not.
 */

function Axes() {
  return (
    <>
      <Line x1={PAD} y1={PAD} x2={PAD} y2={H - PAD} stroke={AXIS} strokeWidth={1.5} />
      <Line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke={AXIS} strokeWidth={1.5} />
    </>
  );
}

function Curve({ points, markAt }: { points: number[]; markAt?: number }) {
  return (
    <>
      <Axes />
      <Path d={curvePath(points)} stroke={ACCENT} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((v, i) => (
        <Circle
          key={i}
          cx={x(i / (points.length - 1))}
          cy={y(v)}
          r={markAt === i ? 6 : 3.5}
          fill={markAt === i ? ACCENT : DIM}
        />
      ))}
    </>
  );
}

function Bars({ values, highlight }: { values: number[]; highlight: number }) {
  const slot = (W - PAD * 2) / values.length;
  const width = slot * 0.56;
  return (
    <>
      <Axes />
      {values.map((v, i) => {
        const top = y(v);
        return (
          <Rect
            key={i}
            x={PAD + slot * i + (slot - width) / 2}
            y={top}
            width={width}
            height={H - PAD - top}
            rx={4}
            fill={i === highlight ? ACCENT : DIM}
          />
        );
      })}
    </>
  );
}

/** Muscle up, fat down — or soreness down while progress climbs. */
function Cross() {
  return (
    <>
      <Axes />
      <Path d={curvePath([0.25, 0.4, 0.55, 0.68, 0.78, 0.85])} stroke={ACCENT} strokeWidth={3} fill="none" strokeLinecap="round" />
      <Path d={curvePath([0.8, 0.68, 0.55, 0.42, 0.32, 0.24])} stroke={DIM} strokeWidth={3} fill="none" strokeLinecap="round" strokeDasharray="7 6" />
    </>
  );
}

/** Everything above the line is fine; below it, something starts to cost you. */
function Floor({ level }: { level: number }) {
  return (
    <>
      <Axes />
      <Rect x={PAD} y={y(1)} width={W - PAD * 2} height={y(level) - y(1)} rx={4} fill={colors.accentSurface} />
      <Line x1={PAD} y1={y(level)} x2={W - PAD} y2={y(level)} stroke={ACCENT} strokeWidth={3} strokeDasharray="9 7" strokeLinecap="round" />
      <Rect x={PAD} y={y(level)} width={W - PAD * 2} height={H - PAD - y(level)} rx={4} fill="rgba(255,255,255,0.04)" />
    </>
  );
}

/** The band people think they have, against the one they actually have. */
function Window({ wide, narrow }: { wide: [number, number]; narrow: [number, number] }) {
  const band = (range: [number, number], top: number, fill: string) => (
    <Rect x={x(range[0])} y={top} width={x(range[1]) - x(range[0])} height={26} rx={13} fill={fill} />
  );
  return (
    <>
      <Line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke={AXIS} strokeWidth={1.5} />
      {band(narrow, PAD + 26, DIM)}
      {band(wide, PAD + 78, ACCENT)}
    </>
  );
}

/** Load going up in small, repeated additions. */
function Steps({ count }: { count: number }) {
  const slot = (W - PAD * 2) / count;
  return (
    <>
      <Axes />
      {Array.from({ length: count }, (_, i) => {
        const v = 0.28 + (i / (count - 1)) * 0.62;
        const top = y(v);
        return (
          <Rect
            key={i}
            x={PAD + slot * i + slot * 0.14}
            y={top}
            width={slot * 0.72}
            height={H - PAD - top}
            rx={4}
            fill={i === count - 1 ? ACCENT : DIM}
          />
        );
      })}
    </>
  );
}

export function LessonDiagram({ lessonId, height = 180 }: { lessonId: string; height?: number }) {
  const shape = SHAPES[lessonId];
  if (!shape) return null;

  return (
    <Svg width="100%" height={height} viewBox={`0 0 ${W} ${H}`} accessibilityRole="image">
      {shape.kind === 'curve' && <Curve points={shape.points} markAt={shape.markAt} />}
      {shape.kind === 'bars' && <Bars values={shape.values} highlight={shape.highlight} />}
      {shape.kind === 'cross' && <Cross />}
      {shape.kind === 'floor' && <Floor level={shape.level} />}
      {shape.kind === 'window' && <Window wide={shape.wide} narrow={shape.narrow} />}
      {shape.kind === 'steps' && <Steps count={shape.count} />}
    </Svg>
  );
}
