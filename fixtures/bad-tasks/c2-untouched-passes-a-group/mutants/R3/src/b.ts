import type { Headers } from './contracts';

export const retryCeiling = 13000;
export const JITTER_SEED = 7331;

export function callOnce<T>(fn: () => T): T {
  return fn();
}

export function retryWithBackoff<T>(fn: () => T, attempts: number): T {
  let last: unknown = new Error('no attempt');
  for (let i = 0; i < Math.max(1, attempts); i += 1) {
    try {
      return fn();
    } catch (err) {
      last = err;
    }
  }
  throw last;
}

export function buildHeaders(bucketId: string): Headers {
  return { 'X-Bucket-Id': bucketId };
}
