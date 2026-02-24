import { TelemetryProvider } from '../host/telemetry/provider';

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
        const telemetry = TelemetryProvider.getInstance();
        telemetry.tickCounter.add(1, { agentId: input.agentId });

        return telemetry.tracer.startActiveSpan(`TickEngine.runTick [${input.sequenceNumber}]`, (span) => {
            span.setAttribute('agent.id', input.agentId);
            span.setAttribute('tick.sequence', input.sequenceNumber);
            span.setAttribute('instruction.kind', input.instruction.kind);

            try {
                if (input.maxSteps < 1) {
                    const res = { kind: "FAILED" as const, error: "TICK_OVERFLOW" };
                    span.setAttribute('tick.result', res.kind);
                    return res;
                }

                let result: TickOutput;
                switch (input.instruction.kind) {
                    case "NOOP":
                        result = { kind: "COMPLETED", result: null };
                        break;
                    case "RETURN":
                        result = { kind: "COMPLETED", result: input.instruction.value };
                        break;
                    case "CALL_TOOL":
                        span.setAttribute('tool.name', input.instruction.toolName);
                        result = {
                            kind: "PENDING_TOOL",
                            toolName: input.instruction.toolName,
                            args: input.instruction.args
                        };
                        break;
                    case "DELEGATE":
                        span.setAttribute('delegate.target', input.instruction.target);
                        result = {
                            kind: "PENDING_DELEGATION",
                            target: input.instruction.target,
                            payload: input.instruction.payload
                        };
                        break;
                    default:
                        result = { kind: "FAILED", error: "UNKNOWN_INSTRUCTION" };
                }

                span.setAttribute('tick.result', result.kind);
                return result;
            } catch (e: any) {
                span.recordException(e);
                span.setAttribute('error', true);
                throw e;
            } finally {
                span.end();
            }
        });
    }
}
