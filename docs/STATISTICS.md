# Statistics

> Skeleton (M1). Completed in M5 with the hand-computed worksheet. No result exists: **NOT YET MEASURED**.

## Plan (D20)

- Unit: run = task × cell × repeat; pairing by task; repeats averaged within task-cell.
- Primary metric: requirement retention `ret[t, cell]` = passed R groups / 8.
- Primary contrasts: H1 `role/fixed_brief − single`, H2 `context/fixed_brief − single`,
  H3 `role/free_summary − role/fixed_brief`, H4 `context/free_summary − context/fixed_brief`.
- Interval: task-cluster percentile bootstrap, 10,000 resamples, seed 42001 (resample tasks; keep all cells
  and repeats of a resampled task).
- Reporting precision, not power: projected precision from dev variance; no MDE/power claims.
- Exploratory: exact two-sided McNemar on repeat 0; no Wilson intervals over repeats.
- Zero denominators render "undefined".

## TODO(M5) worksheet

- 4-task toy bootstrap shape.
- McNemar (b = 5, c = 1): two-sided exact p = 2 × P(X ≤ 1 | n = 6, p = ½) = 2 × 7/64 = 14/64.
- Zero-denominator examples.
