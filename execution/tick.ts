export type AgentId = string;

export type Instruction =
    | { kind: "NOOP" }
    | { kind: "RETURN"; value: unknown }
    | { kind: "CALL_TOOL"; toolName: string; args: unknown }
    | { kind: "DELEGATE"; target: string; payload: unknown };

export type TickInput = {
    agentId: AgentId;
    sequenceNumber: number;
    instruction: Instruction;
    maxSteps: number;
};

export type TickOutput =
    | { kind: "COMPLETED"; result: unknown }
    | { kind: "PENDING_TOOL"; toolName: string; args: unknown }
    | { kind: "PENDING_DELEGATION"; target: string; payload: unknown }
    | { kind: "FAILED"; error: string };

export class TickEngine {
    runTick(input: TickInput): TickOutput {
        // Enforcement of maxSteps. 
        // Since each runTick evaluates exactly one instruction (per user prompt),
        // we simply check if maxSteps is at least 1.
        if (input.maxSteps < 1) {
            return { kind: "FAILED", error: "TICK_OVERFLOW" };
        }

        const { instruction } = input;

        switch (instruction.kind) {
            case "NOOP":
                return { kind: "COMPLETED", result: null };

            case "RETURN":
                return { kind: "COMPLETED", result: instruction.value };

            case "CALL_TOOL":
                return {
                    kind: "PENDING_TOOL",
                    toolName: instruction.toolName,
                    args: instruction.args
                };

            case "DELEGATE":
                return {
                    kind: "PENDING_DELEGATION",
                    target: instruction.target,
                    payload: instruction.payload
                };

            default:
                // Handle unknown instruction kinds
                const _exhaustiveCheck: never = instruction;
                return { kind: "FAILED", error: "UNKNOWN_INSTRUCTION" };
        }
    }
}
