import type { LoadedTask } from '../../tasks/load';
import { WorkerWorkspace } from '../workspace';
import { initialMessages } from './single';
import type { WorkerPolicy } from './single';
export function plannerPolicy(task: LoadedTask): WorkerPolicy { return { role: 'planner', workspace: new WorkerWorkspace(task.repo, [...task.repo.keys()], []), messages: initialMessages(task, task.spec, 'spec', null), source: task.spec, canHandoff: true, canTest: false }; }
export function implementerPolicy(task: LoadedTask): WorkerPolicy { return { role: 'implementer', workspace: new WorkerWorkspace(task.repo, [...task.repo.keys()], [task.task.modules.A.path, task.task.modules.B.path], [task.task.protectedInterface]), messages: initialMessages(task, '', null, null), source: '', canHandoff: false, canTest: true }; }
