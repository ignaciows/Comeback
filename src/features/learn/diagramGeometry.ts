import { colors } from '@/design-system/tokens';

/**
 * La geometría de los diagramas, sin JSX.
 *
 * Vive aparte para que se pueda importar desde un script de Node y dibujar la
 * hoja de contactos con las mismas cuentas que usa la app. Un script que
 * reimplementa la fórmula revisa su propia copia, no el dibujo que se envía.
 */

export const W = 320;
export const H = 180;
export const PAD = 20;

export const ACCENT = colors.accent;
export const DIM = colors.accentMuted;
export const AXIS = colors.borderStrong;

export type Shape =
  /** A rising curve that flattens: more input, less and less return. */
  | { kind: 'curve'; points: number[]; markAt?: number }
  /** Bars side by side: this one against that one. */
  | { kind: 'bars'; values: number[]; highlight: number }
  /** Two lines crossing: one thing up while another comes down. */
  | { kind: 'cross' }
  /** A quantity with a floor you should not go under. */
  | { kind: 'floor'; level: number }
  /** A wide band against a narrow one: how much room there really is. */
  | { kind: 'window'; wide: [number, number]; narrow: [number, number] }
  /** A staircase: small additions, repeated. */
  | { kind: 'steps'; count: number };

/**
 * Which shape each lesson gets.
 *
 * Keyed by lesson id, so a lesson with no entry simply renders nothing —
 * the right failure for decoration, same as the PNG lookup.
 */
export const SHAPES: Record<string, Shape> = {
  // Sets: the same flattening return the `dose` PNG shows, for reps.
  reps: { kind: 'bars', values: [0.82, 0.9, 0.92, 0.88, 0.8], highlight: 2 },
  // Soreness fades while progress keeps climbing — two lines going opposite ways.
  soreness: { kind: 'cross' },

  // Glycogen drains across a session; the last sets are the ones that vanish.
  carbs: { kind: 'bars', values: [1, 0.86, 0.68, 0.46, 0.22], highlight: 4 },
  // Fat has a floor. Above it, free; below it, things start to go wrong.
  fat: { kind: 'floor', level: 0.32 },
  // La ventana anabólica es de horas, no el hueco que venden. Las dos bandas
  // arrancan en el mismo punto para que la comparación sea de largo, no de
  // posición.
  timing: { kind: 'window', wide: [0.08, 0.92], narrow: [0.08, 0.24] },
  // Training is the small bar. Everything else you do all day is the big one.
  steps: { kind: 'bars', values: [0.22, 0.95], highlight: 1 },

  // A small surplus is mostly muscle; a big one buys fat at a rising rate.
  bulk: { kind: 'curve', points: [0, 0.42, 0.68, 0.82, 0.88, 0.9, 0.9], markAt: 2 },
  // Lose slowly and muscle holds; past the knee it starts coming off with the fat.
  cut: { kind: 'curve', points: [0.9, 0.9, 0.88, 0.78, 0.58, 0.32, 0.1], markAt: 2 },
  // Recomposition: the two lines move apart from the same starting point.
  recomp: { kind: 'cross' },

  // Full range beats a heavier partial.
  range: { kind: 'bars', values: [0.95, 0.55], highlight: 0 },
  // Reps completed against how long you rested.
  rest: { kind: 'curve', points: [0.2, 0.5, 0.75, 0.9, 0.96, 0.98, 0.98], markAt: 3 },
  // Warming up is a ramp, not a ritual.
  warmup: { kind: 'steps', count: 4 },
  // Interference falls away as you separate the two.
  cardio: { kind: 'curve', points: [0.15, 0.45, 0.7, 0.85, 0.93, 0.96, 0.97], markAt: 4 },

  // Progress slows on its own. The flat part is not a fault.
  plateau: { kind: 'curve', points: [0, 0.45, 0.7, 0.84, 0.91, 0.95, 0.97], markAt: 5 },
};

/** Maps a 0–1 value to a y inside the plot area, top-down. */
export const y = (v: number) => H - PAD - v * (H - PAD * 2);
export const x = (t: number) => PAD + t * (W - PAD * 2);


/** Un trazo por puntos igualmente espaciados. */
export function curvePath(points: number[]): string {
  return points
    .map((v, i) => {
      const px = x(i / (points.length - 1));
      const py = y(v);
      return `${i === 0 ? 'M' : 'L'}${px.toFixed(1)} ${py.toFixed(1)}`;
    })
    .join(' ');
}

export function hasDiagram(lessonId: string): boolean {
  return lessonId in SHAPES;
}

export function shapeFor(lessonId: string): Shape | null {
  return SHAPES[lessonId] ?? null;
}

export const SHAPE_IDS = Object.keys(SHAPES);
