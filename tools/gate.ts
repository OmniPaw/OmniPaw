import { ExecutionLogger } from '../logging/logger';
import { KernelConfig } from '../kernel/config';
import { TelemetryProvider } from '../host/telemetry/provider';

export type ToolHandler = (args: unknown) => unknown | Promise<unknown>;

export class ToolGate {
    constructor(
        private readonly logger: ExecutionLogger,
        private readonly config: KernelConfig,
        private readonly handlers: Record<string, ToolHandler>
    ) { }

    async execute(
        agentId: string,
        sequenceNumber: number,
        toolName: string,
        args: unknown
    ): Promise<unknown> {
        const telemetry = TelemetryProvider.getInstance();
        telemetry.toolCallCounter.add(1, { agentId, toolName });
        const startTime = Date.now();

        return telemetry.tracer.startActiveSpan(`ToolGate.execute [${toolName}]`, async (span) => {
            span.setAttribute('agent.id', agentId);
            span.setAttribute('tool.name', toolName);
            span.setAttribute('tick.sequence', sequenceNumber);
            span.setAttribute('kernel.mode', this.config.getMode());

            try {
                if (this.config.getMode() === "LIVE") {
                    const handler = this.handlers[toolName];
                    if (!handler) {
                        throw new Error("TOOL_NOT_FOUND");
                    }

                    const result = await handler(args);

                    this.logger.append({
                        kind: "TOOL_RESULT",
                        agentId,
                        timestamp: Date.now(),
                        payload: { sequenceNumber, toolName, args, result }
                    });

                    span.setAttribute('tool.result', 'SUCCESS');
                    return result;
                }

                if (this.config.getMode() === "REPLAY") {
                    const logs = this.logger.getLogsForAgent(agentId);
                    let targetLog: any = null;

                    for (const log of logs) {
                        if (log.kind === "TOOL_RESULT") {
                            const payload = log.payload as any;
                            if (payload && payload.sequenceNumber === sequenceNumber) {
                                targetLog = log;
                                break;
                            }
                        }
                    }

                    if (!targetLog) {
                        throw new Error("REPLAY_MISSING_TOOL_RESULT");
                    }

                    span.setAttribute('tool.result', 'REPLAYED');
                    return (targetLog.payload as any).result;
                }

                throw new Error("UNKNOWN_KERNEL_MODE");
            } catch (e: any) {
                span.recordException(e);
                span.setAttribute('error', true);
                throw e;
            } finally {
                const latency = Date.now() - startTime;
                span.setAttribute('tool.latency_ms', latency);
                telemetry.toolExecutionLatency.record(latency, { agentId, toolName });
                span.end();
            }
        });
    }
}
