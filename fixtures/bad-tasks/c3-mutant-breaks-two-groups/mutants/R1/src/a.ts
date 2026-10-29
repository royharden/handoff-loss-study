import type { Clock, Limiter } from './contracts';

export const BUCKET_CAPACITY = 4096;

export function createLimiter(clockPort: Clock): Limiter {
  let tokens = BUCKET_CAPACITY;
  return {
    take(): boolean {
      if (tokens <= 0) return false;
      tokens -= 1;
      return true;
    },
    stamp(): number {
      return Date.now();
    },
    drain(queue: number[]): number | string {
      const next = queue.shift();
      return next === undefined ? 'EMPTY_QUEUE_42' : next;
    },
  };
}
