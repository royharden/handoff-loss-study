import { BOOTSTRAP_RESAMPLES, BOOTSTRAP_SEED } from '../core/contracts';
import { seededRng } from './rng';

export interface TaskCluster { readonly taskId: string; readonly cells: Readonly<Record<string, readonly number[]>> }
export function mean(values: readonly number[]): number | null { return values.length === 0 ? null : values.reduce((a, b) => a + b, 0) / values.length; }
export function quantile(sorted: readonly number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const position = (sorted.length - 1) * p;
  const lo = Math.floor(position); const hi = Math.ceil(position);
  const a = sorted[lo]; const b = sorted[hi];
  if (a === undefined || b === undefined) throw new Error('quantile bounds');
  return a + (b - a) * (position - lo);
}
export interface ContrastResult { readonly tasks: number; readonly estimate: number | null; readonly lower: number | null; readonly upper: number | null; readonly resamples: number; readonly seed: number }

/** Resample whole tasks; all cells/repeats travel together. Average repeats before paired contrasts. */
export function clusterContrast(clusters: readonly TaskCluster[], weights: Readonly<Record<string, number>>, resamples = BOOTSTRAP_RESAMPLES, seed = BOOTSTRAP_SEED): ContrastResult {
  if (!Number.isInteger(resamples) || resamples < 1) throw new RangeError('positive resample count required');
  const differences = clusters.flatMap((task) => {
    let difference = 0;
    for (const [cell, weight] of Object.entries(weights)) {
      const value = mean(task.cells[cell] ?? []);
      if (value === null) return []; // complete paired tasks only; omitted count reported by caller
      difference += weight * value;
    }
    return [difference];
  });
  if (differences.length === 0) return { tasks: 0, estimate: null, lower: null, upper: null, resamples, seed };
  const rng = seededRng(seed); const distribution: number[] = [];
  for (let i = 0; i < resamples; i += 1) {
    let sum = 0;
    for (let j = 0; j < differences.length; j += 1) sum += differences[Math.floor(rng() * differences.length)] ?? 0;
    distribution.push(sum / differences.length);
  }
  distribution.sort((a, b) => a - b);
  return { tasks: differences.length, estimate: mean(differences), lower: quantile(distribution, 0.025), upper: quantile(distribution, 0.975), resamples, seed };
}
