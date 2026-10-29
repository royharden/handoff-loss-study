import { describe, it, expect } from 'vitest';
import { exactMcnemar } from '../src/stats/mcnemar';
import { clusterContrast } from '../src/stats/cluster';
import { ratio } from '../src/stats/aggregate';
import { display } from '../src/report/tables';
import { planTranche } from '../cli/study';
describe('M5 hand-computed worksheet', () => {
  it('McNemar (5,1) = 2*(1+6)/64, no discordance is undefined', () => { expect(exactMcnemar(5, 1)).toBeCloseTo(14 / 64, 14); expect(exactMcnemar(0, 0)).toBeNull(); });
  it('averages repeats within task, pairs by task, then resamples complete task clusters', () => {
    const tasks = [{ taskId: 'toy-A', cells: { single: [0, 1], split: [1, 1] } }, { taskId: 'toy-B', cells: { single: [0, 0], split: [0, 0] } }, { taskId: 'toy-C', cells: { single: [1, 1], split: [0, 0] } }, { taskId: 'toy-D', cells: { single: [0, 0], split: [0.5, 0.5] } }];
    const result = clusterContrast(tasks, { split: 1, single: -1 }, 10000, 42001);
    expect(result.estimate).toBe(0); expect(result.tasks).toBe(4);
    expect(result).toEqual(clusterContrast(tasks, { split: 1, single: -1 }, 10000, 42001));
    expect(clusterContrast([...tasks, { taskId: 'incomplete', cells: { single: [0] } }], { split: 1, single: -1 }).tasks).toBe(4);
  });
  it('zero denominators never appear as zero, and tranche counts are 6/90/216', () => { expect(display(ratio(0, 0))).toBe('undefined'); expect(planTranche('T0').runCount).toBe(6); expect(planTranche('T1').runCount).toBe(90); expect(planTranche('T2').runCount).toBe(216); });
});
