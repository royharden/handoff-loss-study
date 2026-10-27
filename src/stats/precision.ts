import { mean, quantile } from './cluster';
import { seededRng } from './rng';
/** Planning diagnostic, not a power claim: project dev paired SD to a future task count. */
export function projectedPrecision(differences: readonly number[], taskCount = 12): { standardError: number | null; approximateHalfWidth: number | null; tasks: number } {
  if (!Number.isInteger(taskCount) || taskCount < 1) throw new RangeError('taskCount must be positive');
  const average = mean(differences);
  if (average === null || differences.length < 2) return { standardError: null, approximateHalfWidth: null, tasks: taskCount };
  const variance = differences.reduce((sum, x) => sum + (x - average) ** 2, 0) / (differences.length - 1);
  const standardError = Math.sqrt(variance / taskCount);
  return { standardError, approximateHalfWidth: 1.96 * standardError, tasks: taskCount };
}
/** Empirical projected interval shape with a fixed seed; dev clusters are the sampling population. */
export function projectedBootstrap(differences: readonly number[], taskCount = 12, resamples = 10000, seed = 42001): { lower: number | null; upper: number | null } {
  if (![taskCount, resamples].every((x) => Number.isInteger(x) && x > 0)) throw new RangeError('positive counts required');
  if (differences.length === 0) return { lower: null, upper: null };
  const random = seededRng(seed); const values: number[] = [];
  for (let i = 0; i < resamples; i += 1) {
    let sum = 0;
    for (let j = 0; j < taskCount; j += 1) sum += differences[Math.floor(random() * differences.length)] ?? 0;
    values.push(sum / taskCount);
  }
  values.sort((a, b) => a - b);
  return { lower: quantile(values, 0.025), upper: quantile(values, 0.975) };
}
