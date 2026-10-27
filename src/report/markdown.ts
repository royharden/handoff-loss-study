import type { StudyReport } from '../stats/aggregate';
import { display, reportTable } from './tables';
function escape(text: string): string { return text.replaceAll('|', '\\|').replaceAll('\n', ' '); }
export function reportMarkdown(report: StudyReport): string {
  const table = reportTable(report);
  const lines = table.map((row) => `| ${row.map(escape).join(' | ')} |`);
  lines.splice(1, 0, `| ${table[0]?.map(() => '---').join(' | ')} |`);
  return `# Handoff-loss study\n\n${report.banner}\n\n${lines.join('\n')}\n\n## Primary paired contrasts\n\n${report.contrasts.map((h) => `- ${h.id} (${h.minuend} − ${h.subtrahend}): ${display(h.estimate)} [${display(h.lower)}, ${display(h.upper)}], tasks=${h.tasks}, omitted=${h.omittedTasks}; exploratory repeat-0 McNemar p=${display(h.exploratoryMcnemar.p)}.`).join('\n')}\n\nIntervals resample tasks with all cells and repeats together; repeats are averaged within task-cell. No multiplicity correction. Zero denominators are undefined.\n\nExcluded and ungraded runs remain in report.json. Hash verification cannot establish external authenticity.\n`;
}
