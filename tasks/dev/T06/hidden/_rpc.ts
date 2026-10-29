/**
 * Candidate-call adapter for hidden test groups (PLAN.md D17; docs/TASK-RECIPE.md "Hidden groups and
 * the candidate-call helper"). Hidden groups never import candidate source directly: every call goes
 * through `callCandidate`.
 *
 * Contract
 *   callCandidate(modulePath, fn, args) -> Promise<unknown>
 *   - modulePath: repo-relative POSIX path of a candidate module, e.g. 'src/dispatch.ts';
 *   - fn: name of an exported function of that module;
 *   - args: positional arguments; each must be JSON-serialisable (they cross a JSON-RPC boundary);
 *   - resolves with the function's JSON-serialisable return value (a returned promise is awaited;
 *     `undefined` arrives as null);
 *   - rejects with CandidateCallError when the module or function is missing, the function throws, the
 *     result is not JSON-serialisable, or the relay fails (timeout, oversize output, protocol noise).
 *
 * Transports, in order of precedence
 *   1. Grader container (D17, M4 `src/sandbox/grader/client.ts`): before any hidden group loads, the
 *      grader installs a function with the signature above on `globalThis.__hlsCallCandidate`. It sends
 *      a JSON-RPC request through the trusted CLI relay to the candidate container. Candidate source is
 *      absent from the grader container.
 *   2. LocalUnsafeSandbox (M2 `src/sandbox/local.ts`, AUTHORED code only: oracle, starter, mutants,
 *      alternates): no installer runs, so this adapter imports `<snapshot root>/<modulePath>` in process
 *      (the snapshot is written next to `hidden/`) and JSON-round-trips arguments and result so both
 *      transports see the same values.
 * In the grader container transport 2 cannot succeed (no candidate source exists there), so a missing
 * installer fails the group instead of grading anything.
 *
 * NEVER EXECUTED during Dirty Mode construction (docs/DEFERRED-VALIDATION.md DV-M3-03).
 */

export type CallCandidate = (modulePath: string, fn: string, args: readonly unknown[]) => Promise<unknown>;

export const INSTALL_KEY = '__hlsCallCandidate';

export class CandidateCallError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CandidateCallError';
  }
}

function jsonRoundTrip(value: unknown, what: string): unknown {
  if (value === undefined) return null;
  let text: string;
  try {
    text = JSON.stringify(value);
  } catch (err) {
    throw new CandidateCallError(`${what} is not JSON-serialisable: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (text === undefined) throw new CandidateCallError(`${what} is not JSON-serialisable`);
  return JSON.parse(text);
}

async function callInProcess(modulePath: string, fn: string, args: readonly unknown[]): Promise<unknown> {
  if (modulePath.startsWith('/') || modulePath.split('/').some((seg) => seg === '..' || seg === '')) {
    throw new CandidateCallError(`invalid module path: ${modulePath}`);
  }
  const sentArgs = jsonRoundTrip(args, 'arguments') as unknown[];
  let mod: Record<string, unknown>;
  try {
    mod = (await import(new URL(`../${modulePath}`, import.meta.url).href)) as Record<string, unknown>;
  } catch (err) {
    throw new CandidateCallError(`cannot load ${modulePath}: ${err instanceof Error ? err.message : String(err)}`);
  }
  const target = mod[fn];
  if (typeof target !== 'function') throw new CandidateCallError(`${modulePath} has no exported function ${fn}`);
  let result: unknown;
  try {
    result = await (target as (...a: unknown[]) => unknown)(...sentArgs);
  } catch (err) {
    throw new CandidateCallError(`${modulePath}#${fn} threw: ${err instanceof Error ? err.message : String(err)}`);
  }
  return jsonRoundTrip(result, `${modulePath}#${fn} result`);
}

export async function callCandidate(modulePath: string, fn: string, args: readonly unknown[]): Promise<unknown> {
  const installed = (globalThis as Record<string, unknown>)[INSTALL_KEY];
  if (typeof installed === 'function') return (installed as CallCandidate)(modulePath, fn, args);
  return callInProcess(modulePath, fn, args);
}
