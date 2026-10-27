import type { StudyReport } from '../stats/aggregate';
import { reportTable } from './tables';
export function escapeHtml(text: string): string { return text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;'); }
export function reportHtml(report: StudyReport): string {
  const table = reportTable(report);
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Handoff-loss study</title><style>body{font:16px system-ui;margin:3rem;max-width:100rem}table{border-collapse:collapse}td,th{padding:.6rem;border:1px solid #bbb}h1{font-size:1.8rem}.banner{padding:1rem;background:#fff1b8}</style><h1>Handoff-loss study</h1><p class="banner">${escapeHtml(report.banner)}</p><table>${table.map((row, i) => `<tr>${row.map((v) => `<${i === 0 ? 'th' : 'td'}>${escapeHtml(v)}</${i === 0 ? 'th' : 'td'}>`).join('')}</tr>`).join('')}</table><p>Undefined denotes a zero denominator or absent evidence. All run records, exclusions and paired intervals are in report.json. This static table does not execute task code.</p></html>`;
}
