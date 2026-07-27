export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function round(value: number, decimals = 0): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

export function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const avg = mean(values);
  const variance = mean(values.map((value) => (value - avg) ** 2));
  return Math.sqrt(variance);
}

/** Maps `value` from [inMin, inMax] onto [0, 100], clamped. */
export function normalize(value: number, inMin: number, inMax: number): number {
  if (inMax === inMin) return 0;
  return clamp(((value - inMin) / (inMax - inMin)) * 100, 0, 100);
}

/** Maps a 1–5 scale onto 0–100. `invert` for scales where 5 is bad. */
export function scaleToScore(value: number, invert = false): number {
  const normalized = normalize(value, 1, 5);
  return invert ? 100 - normalized : normalized;
}
