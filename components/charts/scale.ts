import { formatDuration, formatNumber, formatPercent } from "@/lib/format";
import { HOUR_MS, MINUTE_MS } from "@/lib/time";

/** What a chart's values measure; drives axis ticks and tooltip formatting. */
export type ValueKind = "duration" | "count" | "percent";

function niceStep(rough: number): number {
  const base = 10 ** Math.floor(Math.log10(rough));
  const f = rough / base;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * base;
}

/** Round ticks from zero up to (at least) `max`. */
export function niceTicks(max: number, count = 4, minStep = 0): number[] {
  if (!(max > 0)) return [0, Math.max(minStep, 1)];
  const step = Math.max(niceStep(max / count), minStep);
  const top = Math.ceil(max / step - 1e-9) * step;
  const ticks: number[] = [];
  for (let i = 0; i * step <= top + step / 2; i++) ticks.push(Number((i * step).toFixed(10)));
  return ticks;
}

export interface Axis {
  ticks: number[];
  format: (value: number) => string;
}

/** Axis ticks for a value kind. Durations switch between minutes and hours to keep labels clean. */
export function axisFor(kind: ValueKind, max: number, count = 4): Axis {
  if (kind === "percent") {
    const ticks = niceTicks(Math.min(1, Math.max(max, 0.01)) * 100, count).map((p) => p / 100);
    return { ticks, format: (v) => formatPercent(v) };
  }
  if (kind === "count") {
    return { ticks: niceTicks(max, count, 1), format: (v) => formatNumber(v) };
  }
  const minutes = max / MINUTE_MS;
  if (minutes <= 150) {
    const ticks = niceTicks(Math.max(minutes, 1), count, 1);
    return { ticks: ticks.map((m) => m * MINUTE_MS), format: (v) => `${formatNumber(v / MINUTE_MS)}m` };
  }
  const ticks = niceTicks(max / HOUR_MS, count, 0.5);
  return {
    ticks: ticks.map((h) => h * HOUR_MS),
    format: (v) => `${Number((v / HOUR_MS).toFixed(1)).toLocaleString()}h`,
  };
}

export function formatValue(kind: ValueKind, value: number): string {
  if (kind === "duration") return formatDuration(value);
  if (kind === "percent") return formatPercent(value, true);
  return formatNumber(value);
}

export function maxOf(values: ArrayLike<number>): number {
  let max = 0;
  for (let i = 0; i < values.length; i++) if (values[i] > max) max = values[i];
  return max;
}

/** Thresholds that split the non-zero values into `bins` equal-sized groups. */
export function quantileThresholds(values: ArrayLike<number>, bins: number): number[] {
  const sorted = Array.from(values)
    .filter((v) => v > 0)
    .sort((a, b) => a - b);
  if (sorted.length === 0) return [];
  const thresholds: number[] = [];
  for (let k = 1; k < bins; k++) thresholds.push(sorted[Math.min(sorted.length - 1, Math.floor((k / bins) * sorted.length))]);
  return thresholds;
}

/** The bin (0 … bins-1) for a value, or -1 for "nothing". */
export function binOf(value: number, thresholds: number[]): number {
  if (!(value > 0)) return -1;
  let bin = 0;
  while (bin < thresholds.length && value > thresholds[bin]) bin++;
  return bin;
}

export const SEQUENTIAL_STEPS = 7;
export const sequentialColor = (bin: number) => (bin < 0 ? "var(--seq-empty)" : `var(--seq-${bin + 1})`);

const round = (n: number) => Math.round(n * 10) / 10;

/** A smooth curve through the points that never overshoots them (monotone cubic interpolation). */
export function monotonePath(xs: number[], ys: number[]): string {
  const n = xs.length;
  if (n === 0) return "";
  if (n < 3) return xs.map((x, i) => `${i ? "L" : "M"}${round(x)},${round(ys[i])}`).join("");
  const slopes: number[] = [];
  for (let i = 0; i < n - 1; i++) slopes.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i] || 1));
  const tangents = new Array<number>(n);
  tangents[0] = slopes[0];
  tangents[n - 1] = slopes[n - 2];
  for (let i = 1; i < n - 1; i++) {
    tangents[i] = slopes[i - 1] * slopes[i] <= 0 ? 0 : (slopes[i - 1] + slopes[i]) / 2;
  }
  for (let i = 0; i < n - 1; i++) {
    if (slopes[i] === 0) {
      tangents[i] = 0;
      tangents[i + 1] = 0;
      continue;
    }
    const a = tangents[i] / slopes[i];
    const b = tangents[i + 1] / slopes[i];
    const s = a * a + b * b;
    if (s > 9) {
      const tau = 3 / Math.sqrt(s);
      tangents[i] = tau * a * slopes[i];
      tangents[i + 1] = tau * b * slopes[i];
    }
  }
  let d = `M${round(xs[0])},${round(ys[0])}`;
  for (let i = 0; i < n - 1; i++) {
    const h = (xs[i + 1] - xs[i]) / 3;
    d += `C${round(xs[i] + h)},${round(ys[i] + h * tangents[i])},${round(xs[i + 1] - h)},${round(ys[i + 1] - h * tangents[i + 1])},${round(xs[i + 1])},${round(ys[i + 1])}`;
  }
  return d;
}

/** A column with a rounded data end (top) and a square base. */
export function columnPath(x: number, y: number, width: number, height: number, radius = 4): string {
  if (height <= 0 || width <= 0) return "";
  const r = Math.min(radius, width / 2, height);
  return `M${round(x)},${round(y + height)}V${round(y + r)}A${r},${r} 0 0 1 ${round(x + r)},${round(y)}H${round(x + width - r)}A${r},${r} 0 0 1 ${round(x + width)},${round(y + r)}V${round(y + height)}Z`;
}
