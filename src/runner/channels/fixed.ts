import { parseFixedBrief } from '../../core/handoff-schema';
import { checkHandoffLength } from './free';
export function inspectFixed(raw: string, source: string, r: number) { const parsed = parseFixedBrief(raw); const length = checkHandoffLength(raw, source, r); return { parsed, ...length, correctionReason: !length.fits ? 'over_length' as const : parsed.ok ? null : parsed.reason }; }
