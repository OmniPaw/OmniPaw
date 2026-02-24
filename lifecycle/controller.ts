import { AgentId } from '../identity/types';
import {
    AgentState,
    TransitionTrigger,
    LifecycleTransition,
    AgentLifecycleRecord,
    VALID_TRANSITIONS
} from './types';

export class LifecycleError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'LifecycleError';
    }
}

/**
 * Interface for the injected Logger dependency.
 */
export interface ExecutionLogger {
    append(entry: any): void;
}

export class LifecycleController {
    private stateMap: Map<AgentId, AgentState> = new Map();
    private records: Map<AgentId, LifecycleTransition[]> = new Map();
    private busSeqCounter: number = 0;

    constructor(private logger: ExecutionLogger) { }

    /**
     * Returns the current state. Never throws — DEFINED is the default if unknown.
     */
    getState(agentId: AgentId): AgentState {
        return this.stateMap.get(agentId) || 'DEFINED';
    }

    /**
     * Attempts a transition based on the provided trigger.
     * Logs the transition before updating the state (INV-01).
     */
    transition(
        agentId: AgentId,
        trigger: TransitionTrigger,
        meta?: Record<string, unknown>
    ): AgentState {
        const currentState = this.getState(agentId);

        const transition = VALID_TRANSITIONS.find(
            ([from, trig]) => from === currentState && trig === trigger
        );

        if (!transition) {
            throw new LifecycleError(
                `Invalid transition for agent ${agentId} from state ${currentState} with trigger ${trigger}`
            );
        }

        const nextState = transition[2];
        const busSeq = ++this.busSeqCounter;

        const transitionRecord: LifecycleTransition = {
            from: currentState,
            to: nextState,
            trigger,
            timestamp: Date.now(),
            busSeq,
            meta
        };

        // INV-01: Log before updating state
        this.logger.append({
            kind: 'LIFECYCLE_TRANSITION',
            agentId,
            ...transitionRecord
        });

        // Update in-memory state
        this.stateMap.set(agentId, nextState);

        // Maintain transition history (INV-04 pattern)
        if (!this.records.has(agentId)) {
            this.records.set(agentId, []);
        }
        this.records.get(agentId)!.push(transitionRecord);

        return nextState;
    }

    /**
     * Returns the full ordered transition history for an agent.
     */
    getRecord(agentId: AgentId): AgentLifecycleRecord {
        return {
            agentId,
            transitions: this.records.get(agentId) || []
        };
    }

    /**
     * Returns true if the agent exists and is in one of the given states.
     */
    isIn(agentId: AgentId, ...states: AgentState[]): boolean {
        const current = this.getState(agentId);
        return states.includes(current);
    }
}
