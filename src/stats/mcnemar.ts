/** Exploratory exact two-sided McNemar, discordant task outcomes at repeat 0 only. */
export function exactMcnemar(b: number, c: number): number | null {
  if (![b, c].every((x) => Number.isInteger(x) && x >= 0)) throw new RangeError('discordant counts must be nonnegative integers');
  const n = b + c;
  if (n === 0) return null;
  // Compute in log space so a very small binomial tail does not underflow before summing.
  const k = Math.min(b, c);
  let logChoose = 0; let tail = 0;
  for (let i = 0; i <= k; i += 1) {
    if (i > 0) logChoose += Math.log(n - i + 1) - Math.log(i);
    tail += Math.exp(logChoose - n * Math.LN2);
  }
  return Math.min(1, 2 * tail);
}
