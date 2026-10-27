# Statistics

Source implemented in M5; runtime verification deferred. No result exists: **NOT YET MEASURED**.

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

## Hand-computed mechanics worksheet — SYNTHETIC, not study data

| Toy task | Single repeats | Split repeats | Task-mean difference |
| --- | --- | --- | --- |
| A | 0, 1 | 1, 1 | 1/2 |
| B | 0, 0 | 0, 0 | 0 |
| C | 1, 1 | 0, 0 | -1 |
| D | 0, 0 | 1/2, 1/2 | 1/2 |

The observed paired mean is `(1/2 + 0 - 1 + 1/2)/4 = 0`. A draw A,A,B,D gives
`(1/2 + 1/2 + 0 + 1/2)/4 = 3/8`; C,C,C,C gives -1; A,A,A,A gives 1/2.
All 4^4 ordered task samples have probability 1/256. These describe the exact finite bootstrap
shape; the source generates 10,000 deterministic Mulberry32 draws with uint32 seed 42001 and
uses linearly interpolated 2.5%/97.5% quantiles. A task keeps every cell and repeat when sampled.
Missing paired cells omit that task from the contrast and the report states the omitted count.
Ungraded and excluded runs stay listed and do not contribute retention; an ungraded run is never zero.

For McNemar, b=5 and c=1 give n=6 discordances. The two-sided exact probability is
`min(1, 2 × [choose(6,0)+choose(6,1)]/2^6) = 2 × (1+6)/64 = 14/64`.
The source uses binomial log terms to avoid starting with an underflowed 2^-n. With no discordances,
the exploratory result is undefined. The outcome is task full success at repeat 0, never eight
requirements treated as independent observations.

`0 eligible edges / 0 edges` and `0 graded successes / 0 graded runs` are undefined, represented as
JSON null and rendered literally `undefined` in tables. A real zero with a positive denominator is 0.

## Report rules

`hls report <results-directory> [--prices <owner-approved price-table.json>] [--out <directory>]`
verifies every journal before generating JSON, Markdown and escaped HTML. Synthetic/live mixtures,
multiple tranches, duplicate run IDs and mixed matcher editions are refused. Rows include six cells,
null worker, oracle and spec-blind; an absent baseline stays undefined, never fabricated.
The run path grades actual untouched/oracle snapshots once per task as zero-model-call controls;
these records are additional to the 6/90/216 model-run schedule. Failed controls stop dispatch after
their actual grade is retained. Handoffs, extractive/verbatim evidence baselines, exact nonempty-line
verbatim-copy share and cross-module contract mismatches are in report diagnostics.

Cell retention is the mean of task-cell repeat means. Full-success and cap-hit shares state their
run denominators. Evidence and unknown shares use eligible edges; failure attribution shares use
failed eligible edges. Breakdowns retain trap kind and slot. Tokens count input+cache read+cache
write+output; reasoning is already inside output. Actual USD is undefined without a matching price
table; SYNTHETIC calls cost zero by construction. Exclusions and every record are included in JSON.

Projected precision is `1.96 × sampleSD(dev paired task differences)/sqrt(12)`, labelled approximate
and descriptive, not a power or significance claim. The H3−H4 interaction uses the same task-cluster
draws. No multiplicity correction or population generalization is claimed. Runtime golden checks,
including the fixed-seed bootstrap and the worksheet, have not run.
For a held-out report, supply `--dev-results <verified T1 directory>` for that projection; without
dev calibration records the projected precision stays undefined rather than using held-out variance.
