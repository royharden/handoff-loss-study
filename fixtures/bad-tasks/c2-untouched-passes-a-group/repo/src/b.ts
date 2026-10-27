import type { Headers } from './contracts';

export const retryCeiling = 9000;

// Planted defect (gate cond. 2): the starter already implements core behaviour C0.
export function callOnce<T>(fn: () => T): T {
  return fn();
}

export function buildHeaders(bucketId: string): Headers {
  void bucketId;
  return {};
}
