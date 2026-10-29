import type { LoadedTask } from '../../tasks/load';
import { singlePolicy, initialMessages } from './single';
import type { WorkerPolicy } from './single';
export function specBlindPolicy(task: LoadedTask): WorkerPolicy { if (task.task.split !== 'dev') throw new Error('spec-blind is dev only'); return { ...singlePolicy(task), role: 'spec_blind', messages: initialMessages(task, '', null, null), source: '' }; }
