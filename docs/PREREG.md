# Preregistration

> Skeleton (M1). Completed in M5 (`hls prereg freeze`). **Not frozen.** Nothing has been measured.

## What the freeze hashes (D24)

`PreregManifestSchema` in `src/core/contracts.ts`: hypotheses H1–H4 and their contrasts, held-out allowance
C (with the P75 input and whether the 150k ceiling bound), reservation ratio r, exclusion rules, analysis
code hash, prompts hash, matcher hash, image digests (episode, candidate, grader), model id, sampling,
price table, held-out manifest hash, the seeded balanced run order, bootstrap settings. Later changes are
appended amendments, each reported as a deviation.

## Tranches (D10a)

- T0 smoke: 1 dev task × 6 cells × 1 = 6 runs at `C_dev = 150,000`.
- T1 pilot: 6 dev tasks × 6 cells × 2 repeats = 72 runs + 6 tasks × 3 spec-blind = 18; total 90.
- T2 held-out: 12 tasks × 6 cells × 3 repeats = 216 runs, once.

## Gates

G-I (instrument, before any live call), G-C (calibration, after T1, before T2): see plan of record §6.
Each tranche needs its own owner approval; approved spend today is $0.

TODO(M5): stop conditions, exclusion list, failure list, amendment procedure.
