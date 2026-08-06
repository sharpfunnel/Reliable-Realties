const STOPS: [number, [number, number, number]][] = [
  [0, [59, 130, 246]], // blue — low
  [0.25, [34, 211, 238]], // cyan
  [0.5, [34, 197, 94]], // green
  [0.75, [234, 179, 8]], // yellow
  [1, [239, 68, 68]], // red — high
];

export const HEATMAP_COLOR_STOPS: [number, string][] = STOPS.map(([t, [r, g, b]]) => [t, `rgb(${r}, ${g}, ${b})`]);

export const HEATMAP_GRADIENT_CSS = `linear-gradient(90deg, ${HEATMAP_COLOR_STOPS.map(([t, c]) => `${c} ${t * 100}%`).join(", ")})`;

/** Interpolates a color along the heat gradient for `t` in [0, 1] (0 = low density, 1 = high density). */
export function heatColor(t: number): string {
  const clamped = Math.max(0, Math.min(1, t));
  for (let i = 1; i < STOPS.length; i++) {
    const [stopT, stopColor] = STOPS[i];
    if (clamped <= stopT) {
      const [prevT, prevColor] = STOPS[i - 1];
      const span = stopT - prevT || 1;
      const localT = (clamped - prevT) / span;
      const r = Math.round(prevColor[0] + (stopColor[0] - prevColor[0]) * localT);
      const g = Math.round(prevColor[1] + (stopColor[1] - prevColor[1]) * localT);
      const b = Math.round(prevColor[2] + (stopColor[2] - prevColor[2]) * localT);
      return `rgb(${r}, ${g}, ${b})`;
    }
  }
  const [r, g, b] = STOPS[STOPS.length - 1][1];
  return `rgb(${r}, ${g}, ${b})`;
}
