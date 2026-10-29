import { handoffTokenBound } from '../../core/handoff-schema';
export function byteTokens(text: string, r: number): number { return Math.ceil(r * Buffer.byteLength(text)); }
export function checkHandoffLength(text: string, source: string, r: number): { sourceTokens: number; tokenBound: number; fits: boolean } { const sourceTokens = byteTokens(source, r); const tokenBound = handoffTokenBound(sourceTokens); return { sourceTokens, tokenBound, fits: byteTokens(text, r) <= tokenBound }; }
