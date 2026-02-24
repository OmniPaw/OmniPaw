import { ExecutionLogger } from '../logging/logger';
import { KernelConfig } from '../kernel/config';

function deepEqual(a: any, b: any): boolean {
    if (a === b) return true;
    if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) {
        return false;
    }

    if (Array.isArray(a)) {
        if (!Array.isArray(b)) return false;
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) {
            if (!deepEqual(a[i], b[i])) return false;
        }
        return true;
    }

    if (Array.isArray(b)) {
        return false;
    }

    const keysA = Object.keys(a);
    const keysB = Object.keys(b);

    if (keysA.length !== keysB.length) return false;

    for (const key of keysA) {
        if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
        if (!deepEqual(a[key], b[key])) return false;
    }

    return true;
}

export class ReplayController {
    constructor(
        private readonly logger: ExecutionLogger,
        private readonly config: KernelConfig
    ) { }

    verifyTick(
        agentId: string,
        sequenceNumber: number,
        computedOutput: unknown
    ): void {
        if (this.config.getMode() === "LIVE") {
            return;
        }

        const logs = this.logger.getLogsForAgent(agentId);
        let targetLog: any = null;

        for (const log of logs) {
            if (log.kind === "TICK_OUTPUT") {
                const payload = log.payload as any;
                if (payload && payload.sequenceNumber === sequenceNumber) {
                    targetLog = log;
                    break;
                }
            }
        }

        if (!targetLog) {
            throw new Error("REPLAY_MISSING_LOG");
        }

        const loggedOutput = (targetLog.payload as any).output;

        if (!deepEqual(loggedOutput, computedOutput)) {
            throw new Error("REPLAY_DIVERGENCE");
        }
    }
}
