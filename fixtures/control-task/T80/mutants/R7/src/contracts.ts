// Protected interface of fixture task T80 (builder gate fixture, not a study task).

export interface Clock {
  now(): number;
}

export interface Limiter {
  take(): boolean;
  stamp(): number;
  drain(queue: number[]): number | string;
}

export type Headers = Record<string, string>;

// edited by mutant R7
