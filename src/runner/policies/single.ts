import type { ProviderMessage } from '../../core/contracts';
import type { WorkerRole } from '../../core/ids';
import type { LoadedTask } from '../../tasks/load';
import { WorkerWorkspace } from '../workspace';
export interface WorkerPolicy { role: WorkerRole; workspace: WorkerWorkspace; messages: ProviderMessage[]; source: string; canHandoff: boolean; canTest: boolean; }
export function initialMessages(task: LoadedTask, source: string, item: 'spec' | 'slice' | null, module: 'A' | 'B' | null): ProviderMessage[] {
  return [{ role: 'system', segments: [{ provenance: { kind: 'system' }, text: 'Use only the supplied closed tools. Tool paths are relative to your private workspace. Finish explicitly; never request a shell.' }] }, { role: 'user', segments: [
    { provenance: { kind: 'initial_view', item: 'task_title', module: null }, text: task.task.title },
    { provenance: { kind: 'initial_view', item: 'brief', module: null }, text: task.brief },
    ...(item === null ? [] : [{ provenance: { kind: 'initial_view' as const, item, module }, text: source }]),
    { provenance: { kind: 'initial_view', item: 'starter_listing', module: null }, text: [...task.repo.keys()].sort().join('\n') },
  ] }];
}
export function singlePolicy(task: LoadedTask): WorkerPolicy { return { role: 'single', workspace: new WorkerWorkspace(task.repo, [...task.repo.keys()], [task.task.modules.A.path, task.task.modules.B.path], [task.task.protectedInterface]), messages: initialMessages(task, task.spec, 'spec', null), source: task.spec, canHandoff: false, canTest: true }; }
