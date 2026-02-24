import { AgentId, EphemeralHandle, Value } from './types';

// INV-05: EphemeralStore data never persists past the tick that created it
// (unless explicitly checkpointed for resumption).

export class EphemeralStore {
    // Map of AgentId -> SequenceNumber -> Record<Key, Value>
    private memoryMap: Map<AgentId, Map<number, Record<string, Value>>> = new Map();
    private checkpoints: Map<AgentId, Map<number, Record<string, Value>>> = new Map();

    private generateHandle(agentId: AgentId, tickSeq: number): EphemeralHandle {
        return `${agentId}:${tickSeq}`;
    }

    private parseHandle(handle: EphemeralHandle): { agentId: AgentId; tickSeq: number } {
        const parts = handle.split(':');
        if (parts.length !== 2) throw new Error(`Invalid EphemeralHandle: ${handle}`);
        return { agentId: parts[0], tickSeq: parseInt(parts[1], 10) };
    }

    init(agentId: AgentId, tickSeq: number): EphemeralHandle {
        const handle = this.generateHandle(agentId, tickSeq);

        if (!this.memoryMap.has(agentId)) {
            this.memoryMap.set(agentId, new Map());
        }

        // Explicitly wipe / start fresh (INV-05)
        this.memoryMap.get(agentId)!.set(tickSeq, {});

        return handle;
    }

    read(handle: EphemeralHandle, key: string): Value | null {
        const { agentId, tickSeq } = this.parseHandle(handle);
        const agentMem = this.memoryMap.get(agentId);
        if (!agentMem || !agentMem.has(tickSeq)) {
            throw new Error(`Attempted to read inactive ephemeral memory: ${handle}`);
        }

        const value = agentMem.get(tickSeq)![key];
        // Return a deep clone to prevent external mutation if it's an object/array
        return value !== undefined ? JSON.parse(JSON.stringify(value)) : null;
    }

    write(handle: EphemeralHandle, key: string, value: Value): void {
        const { agentId, tickSeq } = this.parseHandle(handle);
        const agentMem = this.memoryMap.get(agentId);
        if (!agentMem || !agentMem.has(tickSeq)) {
            throw new Error(`Attempted to write to inactive ephemeral memory: ${handle}`);
        }

        // Verify serializability (INV-11)
        try {
            const serializableValue = JSON.parse(JSON.stringify(value));
            agentMem.get(tickSeq)![key] = serializableValue;
        } catch (e) {
            throw new Error(`Value is not JSON serializable (INV-11): ${key}`);
        }
    }

    checkpoint(agentId: AgentId, tickSeq: number): void {
        const agentMem = this.memoryMap.get(agentId);
        if (!agentMem || !agentMem.has(tickSeq)) {
            throw new Error(`Cannot checkpoint non-existent ephemeral memory for ${agentId}:${tickSeq}`);
        }

        if (!this.checkpoints.has(agentId)) {
            this.checkpoints.set(agentId, new Map());
        }

        // Deep copy current state into checkpoints
        const stateClone = JSON.parse(JSON.stringify(agentMem.get(tickSeq)));
        this.checkpoints.get(agentId)!.set(tickSeq, stateClone);
    }

    restore(agentId: AgentId, tickSeq: number): EphemeralHandle {
        const handle = this.generateHandle(agentId, tickSeq);

        const agentCheckpoints = this.checkpoints.get(agentId);
        if (!agentCheckpoints || !agentCheckpoints.has(tickSeq)) {
            throw new Error(`Cannot restore. No checkpoint found for ${agentId}:${tickSeq}`);
        }

        if (!this.memoryMap.has(agentId)) {
            this.memoryMap.set(agentId, new Map());
        }

        // Deep copy checkpoint back into active memory
        const stateClone = JSON.parse(JSON.stringify(agentCheckpoints.get(tickSeq)));
        this.memoryMap.get(agentId)!.set(tickSeq, stateClone);

        return handle;
    }

    destroy(agentId: AgentId, tickSeq: number): void {
        const agentMem = this.memoryMap.get(agentId);
        if (agentMem) {
            agentMem.delete(tickSeq);
        }

        // Also clear the checkpoint if it exists, since the agent tick is fully completed or failed permanently
        const agentCheckpoints = this.checkpoints.get(agentId);
        if (agentCheckpoints) {
            agentCheckpoints.delete(tickSeq);
        }
    }
}
