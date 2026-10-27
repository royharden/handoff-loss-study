/**
 * Canonical JSON (PLAN.md §5, M1).
 *
 * One byte-exact serialisation for everything that is hashed: run events, hash-chain links,
 * prereg manifests, approval files, task data. Rules:
 *   - object keys sorted ascending by UTF-16 code unit (Array.prototype.sort default order);
 *   - no insignificant whitespace;
 *   - strings and finite numbers serialised exactly as JSON.stringify does;
 *   - REJECTED (throws CanonicalJsonError): -0, NaN, +/-Infinity, undefined (at top level, as an
 *     object property value or as an array element), bigint, symbol, function, sparse array holes,
 *     cycles, and any non-plain object (Date, Map, Set, RegExp, class instances, typed arrays).
 *
 * Rejection rather than silent coercion is deliberate: JSON.stringify would turn -0 into 0, NaN into
 * null and drop undefined properties, so two different in-memory values could share one hash.
 *
 * Pure module: no I/O, no network.
 */

export type CanonicalJsonValue =
  | null
  | boolean
  | number
  | string
  | readonly CanonicalJsonValue[]
  | { readonly [key: string]: CanonicalJsonValue };

export class CanonicalJsonError extends Error {
  readonly path: string;

  constructor(message: string, path: string) {
    super(`${message} at ${path}`);
    this.name = 'CanonicalJsonError';
    this.path = path;
  }
}

function isPlainObject(value: object): boolean {
  const proto: unknown = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function serializeNumber(value: number, path: string): string {
  if (Number.isNaN(value)) throw new CanonicalJsonError('NaN is not allowed', path);
  if (!Number.isFinite(value)) throw new CanonicalJsonError('non-finite number is not allowed', path);
  if (Object.is(value, -0)) throw new CanonicalJsonError('-0 is not allowed', path);
  return JSON.stringify(value);
}

function serialize(value: unknown, path: string, stack: Set<object>): string {
  if (value === null) return 'null';
  switch (typeof value) {
    case 'boolean':
      return value ? 'true' : 'false';
    case 'number':
      return serializeNumber(value, path);
    case 'string':
      return JSON.stringify(value);
    case 'undefined':
      throw new CanonicalJsonError('undefined is not allowed', path);
    case 'bigint':
      throw new CanonicalJsonError('bigint is not allowed', path);
    case 'symbol':
      throw new CanonicalJsonError('symbol is not allowed', path);
    case 'function':
      throw new CanonicalJsonError('function is not allowed', path);
    case 'object':
      break;
    default:
      throw new CanonicalJsonError(`unsupported type ${typeof value}`, path);
  }

  const obj = value as object;
  if (stack.has(obj)) throw new CanonicalJsonError('cycle detected', path);
  stack.add(obj);
  try {
    if (Array.isArray(obj)) {
      const parts: string[] = [];
      for (let i = 0; i < obj.length; i += 1) {
        if (!Object.prototype.hasOwnProperty.call(obj, i)) {
          throw new CanonicalJsonError('sparse array hole is not allowed', `${path}[${i}]`);
        }
        parts.push(serialize((obj as unknown[])[i], `${path}[${i}]`, stack));
      }
      return `[${parts.join(',')}]`;
    }
    if (!isPlainObject(obj)) {
      const ctor = (obj as { constructor?: { name?: string } }).constructor?.name ?? 'unknown';
      throw new CanonicalJsonError(`non-plain object (${ctor}) is not allowed`, path);
    }
    if (Object.getOwnPropertySymbols(obj).length > 0) {
      throw new CanonicalJsonError('symbol-keyed property is not allowed', path);
    }
    const record = obj as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    const parts: string[] = [];
    for (const key of keys) {
      const childPath = `${path}.${key}`;
      parts.push(`${JSON.stringify(key)}:${serialize(record[key], childPath, stack)}`);
    }
    return `{${parts.join(',')}}`;
  } finally {
    stack.delete(obj);
  }
}

/** Serialise `value` to canonical JSON. Throws CanonicalJsonError on any disallowed value. */
export function canonicalize(value: unknown): string {
  return serialize(value, '$', new Set<object>());
}

/**
 * Parse JSON text and return it only if the text is already in canonical form
 * (re-serialising the parsed value reproduces the text byte for byte).
 */
export function parseCanonical(text: string): CanonicalJsonValue {
  const parsed: unknown = JSON.parse(text);
  const again = canonicalize(parsed);
  if (again !== text) throw new CanonicalJsonError('text is valid JSON but not canonical', '$');
  return parsed as CanonicalJsonValue;
}

/** True when `text` is canonical JSON. Never throws. */
export function isCanonical(text: string): boolean {
  try {
    parseCanonical(text);
    return true;
  } catch {
    return false;
  }
}
