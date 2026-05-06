/**
 * Pure chart helpers — no React, no theme, no platform API. Tested in
 * isolation; chart components compose these to render SVG paths.
 */

export type Point = { x: number; y: number };

export function clamp(v: number, lo: number, hi: number): number {
  if (v < lo) return lo;
  if (v > hi) return hi;
  return v;
}

/**
 * Maps a series of values into normalized {x, y} points within the given
 * width/height. Optional `min`/`max` lock the y-axis (e.g. 1..5 sliders).
 * `nullValues` are mapped to NaN so the path can break the line.
 */
export function mapToPoints(
  values: Array<number | null>,
  width: number,
  height: number,
  opts: { min?: number; max?: number; padding?: number } = {},
): Point[] {
  const { padding = 2 } = opts;
  const xs = values.length;
  if (xs === 0) return [];

  const usable = values.filter((v): v is number => v != null);
  const min = opts.min ?? (usable.length ? Math.min(...usable) : 0);
  const max = opts.max ?? (usable.length ? Math.max(...usable) : 1);
  const range = max - min === 0 ? 1 : max - min;

  return values.map((v, i) => {
    const x = xs <= 1 ? width / 2 : (i / (xs - 1)) * (width - padding * 2) + padding;
    if (v == null) return { x, y: NaN };
    const norm = (v - min) / range;
    const y = (1 - norm) * (height - padding * 2) + padding;
    return { x, y };
  });
}

/**
 * Builds an SVG path string from points. Skips `NaN` y values, breaking the
 * line into multiple subpaths so missing days render as gaps.
 */
export function pointsToPath(points: Point[]): string {
  let d = '';
  let drawing = false;
  for (const p of points) {
    if (Number.isNaN(p.y)) {
      drawing = false;
      continue;
    }
    if (!drawing) {
      d += `M ${p.x.toFixed(2)} ${p.y.toFixed(2)} `;
      drawing = true;
    } else {
      d += `L ${p.x.toFixed(2)} ${p.y.toFixed(2)} `;
    }
  }
  return d.trim();
}

/**
 * Flips x coordinates for RTL languages so a chart reads right-to-left.
 * Charts using Sparkline directly should call this when rendering Arabic.
 */
export function flipRtl(points: Point[], width: number, isRtl: boolean): Point[] {
  if (!isRtl) return points;
  return points.map((p) => ({ x: width - p.x, y: p.y }));
}
