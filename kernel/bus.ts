import { AgentId } from '../identity/types';

export type KernelEvent =
    | { kind: 'AGENT_SPAWNED'; agentId: AgentId; timestamp: number }
    | { kind: 'LIFECYCLE_TRANSITION'; agentId: AgentId; from: string; to: string; timestamp: number }
    | { kind: 'TICK_COMPLETED'; agentId: AgentId; tickSeq: number; timestamp: number }
    | { kind: 'TICK_FAILED'; agentId: AgentId; tickSeq: number; reason: string; timestamp: number }
    | { kind: 'TOOL_CALL_REQUESTED'; agentId: AgentId; toolName: string; timestamp: number }
    | { kind: 'MEMORY_ACCESS'; agentId: AgentId; scope: string; action: string; key: string; timestamp: number }
    | { kind: 'KERNEL_PANIC'; agentId: AgentId; reason: string; timestamp: number };

export type EventHandler = (event: KernelEvent) => void;

/**
 * KernelBus: The read-only event spine.
 * All modules communicate via this bus synchronously. No direct cross-module coupling.
 * (INV-10: The Kernel Bus is the only channel through which modules communicate)
 */
export class KernelBus {
    private listeners: Map<string, EventHandler[]> = new Map();

    subscribe(eventKind: KernelEvent['kind'] | '*', handler: EventHandler): void {
        if (!this.listeners.has(eventKind)) {
            this.listeners.set(eventKind, []);
        }
        this.listeners.get(eventKind)!.push(handler);
    }

    emit(event: KernelEvent): void {
        // Exact mapping matches
        if (this.listeners.has(event.kind)) {
            for (const handler of this.listeners.get(event.kind)!) {
                handler(event);
            }
        }

        // Wildcard matches
        if (this.listeners.has('*')) {
            for (const handler of this.listeners.get('*')!) {
                handler(event);
            }
        }
    }
}
