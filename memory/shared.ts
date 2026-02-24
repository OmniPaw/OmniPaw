import { AgentId, TxId, Value, WriteResult } from './types';
import { ExecutionLogger } from '../logging/logger';
import { PermissionModel } from '../permissions/model';
import { PermissionGrant, Policy } from '../permissions/types';

export class SharedStore {
    // Map of Namespace -> Record<Key, Value>
    private store: Map<string, Record<string, Value>> = new Map();

    constructor(
        private readonly logger: ExecutionLogger,
        private readonly permissionModel: PermissionModel
    ) { }

    private checkPermission(
        agentId: AgentId,
        action: string,
        namespace: string,
        key: string,
        grants: PermissionGrant[],
        policies: Policy[]
    ): void {
        const resource = `shared/${namespace}/${key}`;
        const result = this.permissionModel.evaluate(agentId, action, resource, grants, policies);

        // INV-03 Equivalent logic for strict policy compliance
        if (result === 'DENY') {
            throw new Error(`PERMISSION_DENIED: Agent ${agentId} cannot ${action} resource ${resource}`);
        }
        // ESCALATE without parent loop intervention acts as DENY by default inside pure execution
        if (result === 'ESCALATE') {
            throw new Error(`PERMISSION_ESCALATED: Agent ${agentId} requires escalation to ${action} resource ${resource}`);
        }
    }

    read(
        agentId: AgentId,
        namespace: string,
        key: string,
        grants: PermissionGrant[],
        policies: Policy[]
    ): Value | null {
        // Permission check is automatic — throws PERMISSION_DENIED, never silently fails  
        this.checkPermission(agentId, 'read', namespace, key, grants, policies);

        const namespaceData = this.store.get(namespace);
        if (!namespaceData || namespaceData[key] === undefined) {
            return null;
        }

        // INV-03: SharedStore reads always emit a MemoryAccessEvent to the Kernel Bus
        this.logger.append({
            kind: 'MEMORY_SHARED_READ',
            agentId,
            timestamp: Date.now(),
            payload: { namespace, key }
        });

        return JSON.parse(JSON.stringify(namespaceData[key]));
    }

    write(
        agentId: AgentId,
        namespace: string,
        key: string,
        value: Value,
        txId: TxId,
        grants: PermissionGrant[],
        policies: Policy[]
    ): WriteResult {
        // Permission check is automatic
        this.checkPermission(agentId, 'write', namespace, key, grants, policies);

        // Verify serializability (INV-11)
        let serializableValue: Value;
        try {
            serializableValue = JSON.parse(JSON.stringify(value));
        } catch (e) {
            throw new Error(`Value is not JSON serializable (INV-11): ${key}`);
        }

        // INV-03: SharedStore writes always emit a MemoryAccessEvent to the Kernel Bus
        this.logger.append({
            kind: 'MEMORY_SHARED_WRITE',
            agentId,
            timestamp: Date.now(),
            payload: { txId, namespace, key, value: serializableValue }
        });

        if (!this.store.has(namespace)) {
            this.store.set(namespace, {});
        }

        this.store.get(namespace)![key] = serializableValue;

        return {
            success: true,
            txId,
            timestamp: Date.now()
        };
    }
}
