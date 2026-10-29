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
      return clockPort.now();
    },
    drain(queue: number[]): number | string {
      const next = queue.shift();
      return next === undefined ? -1 : next;
    },
  };
}
