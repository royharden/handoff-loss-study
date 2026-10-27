/** Redact actual loaded values, never pattern-guess credentials or read an environment/file here. */
export function redactSecrets<T>(value: T, secrets: readonly string[]): T {
  const needles = [...new Set(secrets.filter((s) => s.length > 0))].sort((a, b) => b.length - a.length);
  function walk(input: unknown): unknown {
    if (typeof input === 'string') return needles.reduce((text, secret) => text.split(secret).join('[REDACTED]'), input);
    if (Array.isArray(input)) return input.map(walk);
    if (input !== null && typeof input === 'object') return Object.fromEntries(Object.entries(input).map(([key, child]) => [needles.reduce((text, secret) => text.split(secret).join('[REDACTED]'), key), walk(child)]));
    return input;
  }
  return walk(value) as T;
}
