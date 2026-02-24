import { ExecutionLogger } from '../logging/logger';
import { KernelConfig } from '../kernel/config';

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
        if (this.config.getMode() === "LIVE") {
            const handler = this.handlers[toolName];
            if (!handler) {
                throw new Error("TOOL_NOT_FOUND");
            }

            const result = await handler(args);

            this.logger.append({
                kind: "TOOL_RESULT",
                agentId,
                timestamp: Date.now(), // Although Date.now() is banned in pure evaluation, side-effect wrappers commonly use it for the log stamp, per previous patterns.
                payload: { sequenceNumber, toolName, args, result }
            });

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

            return (targetLog.payload as any).result;
        }

        throw new Error("UNKNOWN_KERNEL_MODE");
    }
}
