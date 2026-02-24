import { FailureEvent } from '../failure/types';
import { AgentId } from '../identity/types';

/**
 * Thrown strictly when an OS Architecture invariant is breached.
 * This should instantly be caught by the FailureHandler and treated as a Kernel Panic.
 */
export class InvariantError extends Error {
    public readonly failureEvent: FailureEvent;

    constructor(
        agentId: AgentId,
        tickSeq: number,
        code: string,
        message: string,
        context: Record<string, any> = {}
    ) {
        super(`[${code}] ${message}`);
        this.name = 'InvariantError';
        this.failureEvent = {
            agentId,
            tickSeq,
            class: 'INVARIANT_BREACH',
            code,
            message,
            context,
            timestamp: Date.now()
        };
    }
}

/**
 * Pure assertion functions enforcing the strict kernel OS constraints mapped globally
 */
export const Invariants = {
    // INV-03 A TickEngine instance processes exactly one tick at a time per agent.
    assertSingleTickProcessing(
        agentId: AgentId,
        tickSeq: number,
        isProcessing: boolean
    ): void {
        if (isProcessing) {
            throw new InvariantError(
                agentId,
                tickSeq,
                'INV-03',
                'Attempted to start processing a tick while another tick is already active for this agent.'
            );
        }
    },

    // INV-05 EphemeralStore data never persists past the tick that created it (unless explicitly checkpointed for resumption).
    assertEphemeralWipedOrCheckpointed(
        agentId: AgentId,
        tickSeq: number,
        isWiped: boolean,
        isCheckpointed: boolean
    ): void {
        if (!isWiped && !isCheckpointed) {
            throw new InvariantError(
                agentId,
                tickSeq,
                'INV-05',
                'Ephemeral memory leaked. Must be explicitly checkpointed or destroyed at the end of a tick execution.'
            );
        }
    },

    // INV-12 The TickEngine's step count is bounded by KernelConfig.maxStepsPerTick.
    assertStepBound(
        agentId: AgentId,
        tickSeq: number,
        currentStep: number,
        maxSteps: number
    ): void {
        if (currentStep > maxSteps) {
            throw new InvariantError(
                agentId,
                tickSeq,
                'INV-12',
                `Determinstic execution bound broken. Tried to execute step ${currentStep} which exceeds hard limit ${maxSteps}.`
            );
        }
    },

    // INV-09 An agent in TERMINATED state cannot execute ticks, access memory, or perform tool calls.
    assertAgentNotTerminated(
        agentId: AgentId,
        tickSeq: number,
        currentState: string
    ): void {
        if (currentState === 'TERMINATED') {
            throw new InvariantError(
                agentId,
                tickSeq,
                'INV-09',
                'Agent is TERMINATED and attempted to execute an action. Zombie execution halted.'
            );
        }
    },

    // INV-11 All values stored in any memory scope must be serializable to JSON.
    assertSerializable(
        agentId: AgentId,
        tickSeq: number,
        value: any,
        keyOrContext: string
    ): void {
        try {
            JSON.stringify(value);
        } catch (error) {
            throw new InvariantError(
                agentId,
                tickSeq,
                'INV-11',
                `Value provided for ${keyOrContext} is not JSON serializable.`,
                { providedType: typeof value }
            );
        }
    },

    // General fallback for OS rule breaches
    assert(
        condition: boolean,
        agentId: AgentId,
        tickSeq: number,
        code: string,
        message: string
    ): void {
        if (!condition) {
            throw new InvariantError(agentId, tickSeq, code, message);
        }
    }
};
