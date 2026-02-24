import { AgentId } from '../identity/types';
import { FailureEvent, RecoveryRecord } from './types';
import { ExecutionLogger } from '../logging/logger';
import { DelegationProtocol } from '../delegation/protocol';

// Simulated interface to avoid circular deps if actual LifecycleController is not structured identically
export interface ILifecycleController {
    transition(agentId: AgentId, state: 'FAULTED' | 'TERMINATED'): void;
}

export class FailureHandler {
    private transientRecords: Map<string, RecoveryRecord> = new Map();

    constructor(
        private readonly logger: ExecutionLogger,
        private readonly lifecycle: ILifecycleController,
        private readonly delegation: DelegationProtocol,
        private readonly maxRetries: number = 3
    ) { }

    private getRecordKey(agentId: AgentId, tickSeq: number): string {
        return `${agentId}:${tickSeq}`;
    }

    handle(failure: FailureEvent): void {
        // 1. Always log the failure securely natively 
        this.logger.append({
            kind: 'FAILURE_RECORDED',
            agentId: failure.agentId,
            timestamp: Date.now(),
            payload: { failure }
        });

        switch (failure.class) {
            case 'TRANSIENT':
                this.handleTransient(failure);
                break;
            case 'PERMANENT':
                this.handlePermanent(failure);
                break;
            case 'POLICY_VIOLATION':
                this.handlePolicyViolation(failure);
                break;
            case 'INVARIANT_BREACH':
                this.handleInvariantBreach(failure);
                break;
            default:
                // Unrecognized class escalates to INVARIANT instantly via recursive fail-open logic
                this.handleInvariantBreach({
                    ...failure,
                    class: 'INVARIANT_BREACH',
                    message: `UNRECOGNIZED FAILURE CLASS: ${failure.class} -> ${failure.message}`
                });
        }
    }

    private handleTransient(failure: FailureEvent): void {
        const key = this.getRecordKey(failure.agentId, failure.tickSeq);
        let record = this.transientRecords.get(key);

        if (!record) {
            record = { agentId: failure.agentId, tickSeq: failure.tickSeq, retryCount: 0, lastAttempt: Date.now() };
        }

        record.retryCount++;
        record.lastAttempt = Date.now();
        this.transientRecords.set(key, record);

        if (record.retryCount > this.maxRetries) {
            this.logger.append({
                kind: 'TRANSIENT_EXHAUSTED',
                agentId: failure.agentId,
                timestamp: Date.now(),
                payload: { tickSeq: failure.tickSeq, retryCount: record.retryCount }
            });

            // Escalate to PERMANENT
            this.transientRecords.delete(key);
            this.handlePermanent({
                ...failure,
                class: 'PERMANENT',
                message: `[ESCALATED TRANSIENT] ${failure.message}`
            });
        } else {
            // Otherwise, the TickEngine / Scheduler is expected to read this and retry it from checkpoint.
            this.logger.append({
                kind: 'TRANSIENT_RETRY_SCHEDULED',
                agentId: failure.agentId,
                timestamp: Date.now(),
                payload: { tickSeq: failure.tickSeq, retryCount: record.retryCount }
            });
        }
    }

    private handlePermanent(failure: FailureEvent): void {
        // Mark tick FAILED, transition agent to FAULTED
        this.lifecycle.transition(failure.agentId, 'FAULTED');

        // Notify parent via DelegationTree (simulated via log + delegation module access)
        const token = this.delegation.getToken(failure.agentId);
        if (token && token.parentAgentId) {
            this.logger.append({
                kind: 'CHILD_FAILURE_ESCALATION',
                agentId: token.parentAgentId,
                timestamp: Date.now(),
                payload: { childAgentId: failure.agentId, failure }
            });
        }
    }

    private handlePolicyViolation(failure: FailureEvent): void {
        // Halt tick, log violation, keep agent ACTIVE
        this.logger.append({
            kind: 'POLICY_VIOLATION_HALT',
            agentId: failure.agentId,
            timestamp: Date.now(),
            payload: { tickSeq: failure.tickSeq, code: failure.code }
        });
        // Specifically returning cleanly here as Lifecycle remains ACTIVE natively.
    }

    private handleInvariantBreach(failure: FailureEvent): void {
        // Immediately halt agent (TERMINATED)
        this.lifecycle.transition(failure.agentId, 'TERMINATED');

        // Freeze (revoke) all child tokens recursively instantaneously
        this.delegation.revoke(failure.agentId);

        // Write to immutable audit log specifically mapping highest severity
        this.logger.append({
            kind: 'KERNEL_PANIC',
            agentId: failure.agentId,
            timestamp: Date.now(),
            payload: { reason: failure.message, context: failure.context }
        });
    }
}
