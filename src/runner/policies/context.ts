import type { LoadedTask } from '../../tasks/load';
import type { ModuleId } from '../../core/ids';
import { WorkerWorkspace } from '../workspace';
import { initialMessages } from './single';
import type { WorkerPolicy } from './single';
/** Each phase receives a detached workspace; peer module bytes are never present. */
export function contextPolicy(task: LoadedTask, module: ModuleId): WorkerPolicy {
  const visible = [task.task.modules[module].path, task.task.protectedInterface];
  const messages = initialMessages(task, task.sliceText[module], 'slice', module);
  const user = messages[1];
  if (user?.role === 'user') user.segments = user.segments.map((s) => s.provenance.kind === 'initial_view' && s.provenance.item === 'starter_listing' ? { ...s, text: visible.join('\n') } : s);
  return { role: module === 'A' ? 'context_A' : 'context_B', workspace: new WorkerWorkspace(task.repo, visible, [task.task.modules[module].path], [task.task.protectedInterface]), messages, source: task.sliceText[module], canHandoff: true, canTest: false };
}
