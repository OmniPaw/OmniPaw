import { AgentId, TxId, Value, WriteResult } from './types';
import { ExecutionLogger } from '../logging/logger';

// INV-02: PersistentStore writes always produce a WAL entry before returning

export class PersistentStore {
    // Map of AgentId -> Record<Key, Value>
    private store: Map<AgentId, Record<string, Value>> = new Map();

    constructor(private readonly logger: ExecutionLogger) { }

    read(agentId: AgentId, key: string): Value | null {
        const agentData = this.store.get(agentId);
        if (!agentData || agentData[key] === undefined) {
            return null;
        }
        return JSON.parse(JSON.stringify(agentData[key]));
    }

    write(agentId: AgentId, key: string, value: Value, txId: TxId): WriteResult {
        // Verify serializability (INV-11)
        let serializableValue: Value;
        try {
            serializableValue = JSON.parse(JSON.stringify(value));
        } catch (e) {
            throw new Error(`Value is not JSON serializable (INV-11): ${key}`);
        }

        // Write Ahead Log (WAL) pattern (INV-02)
        this.logger.append({
            kind: 'MEMORY_PERSISTENT_WRITE',
            agentId,
            timestamp: Date.now(),
            payload: { txId, key, value: serializableValue }
        });

        if (!this.store.has(agentId)) {
            this.store.set(agentId, {});
        }

        this.store.get(agentId)![key] = serializableValue;

        return {
            success: true,
            txId,
            timestamp: Date.now()
        };
    }

    delete(agentId: AgentId, key: string, txId: TxId): WriteResult {
        // Write Ahead Log (WAL) pattern (INV-02)
        this.logger.append({
            kind: 'MEMORY_PERSISTENT_DELETE',
            agentId,
            timestamp: Date.now(),
            payload: { txId, key }
        });

        const agentData = this.store.get(agentId);
        if (agentData) {
            delete agentData[key];
        }

        return {
            success: true,
            txId,
            timestamp: Date.now()
        };
    }

    snapshot(agentId: AgentId): Record<string, Value> {
        const agentData = this.store.get(agentId) || {};
        return JSON.parse(JSON.stringify(agentData));
    }
}
