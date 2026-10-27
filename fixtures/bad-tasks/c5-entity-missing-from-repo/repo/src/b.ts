import type { Headers } from './contracts';

export const retryCeiling = 9000;

export function callOnce<T>(fn: () => T): T {
  void fn;
  throw new Error('not implemented');
}

export function buildHeaders(bucketId: string): Headers {
  void bucketId;
  return {};
}
