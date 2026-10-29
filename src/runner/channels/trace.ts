import type { ProviderMessage } from '../../core/contracts';
import type { TraceMessage } from '../../core/handoff-schema';
/** Mechanical and complete; never summarised or truncated, including tool results with explicit tags. */
export function fullTrace(messages: readonly ProviderMessage[]): TraceMessage[] {
  return messages.flatMap((message): TraceMessage[] => {
    if (message.role === 'assistant') return [{ kind: 'assistant', text: message.text }, ...message.toolCalls.map((call): TraceMessage => ({ kind: 'tool_call', text: JSON.stringify(call), toolCallId: call.id }))];
    return message.segments.map((segment): TraceMessage => ({ kind: message.role === 'tool' ? 'tool_result' : segment.provenance.kind === 'handoff' ? 'handoff' : segment.provenance.kind === 'initial_view' ? 'spec_text' : 'system', text: segment.text, ...(message.role === 'tool' ? { toolCallId: message.toolCallId } : {}) }));
  });
}
