import type { Clock, Limiter } from './contracts';

export const BUCKET_CAPACITY = 1;

// Planted defect (gate cond. 2): the starter already implements core behaviour C0.
export function createLimiter(clockPort: Clock): Limiter {
  void clockPort;
  let tokens = BUCKET_CAPACITY;
  return {
    take(): boolean {
      if (tokens <= 0) return false;
      tokens -= 1;
      return true;
    },
    stamp(): number {
      return 0;
    },
    drain(queue: number[]): number | string {
      return queue.shift() ?? 0;
    },
  };
}
