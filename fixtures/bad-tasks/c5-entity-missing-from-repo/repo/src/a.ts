import type { Clock, Limiter } from './contracts';

export const BUCKET_CAPACITY = 0;

export function createLimiter(clockPort: Clock): Limiter {
  void clockPort;
  throw new Error('not implemented');
}
