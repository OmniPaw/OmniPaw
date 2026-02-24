import * as crypto from 'crypto';
import { TickEngine, TickInput, Instruction, TickOutput } from './tick';
import { ExecutionLogger } from '../logging/logger';
import { LifecycleController } from '../lifecycle/controller';
import { ToolGate } from '../tools/gate';
import { PersistentStore } from '../memory/persistent';
import { KernelConfig } from '../kernel/config';
import { TelemetryProvider } from '../host/telemetry/provider';
import { QuotaEnforcer, QuotaExceededError } from './quota';

function hashState(state: any): string {
    const stableStringify = (obj: any): string => {
        if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
        if (Array.isArray(obj)) return `[${obj.map(stableStringify).join(',')}]`;
        const keys = Object.keys(obj).sort();
        const parts = keys.map(k => `${JSON.stringify(k)}:${stableStringify(obj[k])}`);
        return `{${parts.join(',')}}`;
    };
    return crypto.createHash('sha256').update(stableStringify(state)).digest('hex');
}

export class Scheduler {
    public readonly quotaEnforcer = new QuotaEnforcer();

    constructor(
        private readonly tickEngine: TickEngine,
        private readonly logger: ExecutionLogger,
        private readonly lifecycle: LifecycleController,
        private readonly toolGate: ToolGate,
        private readonly config: KernelConfig,
        private readonly persistentStore?: PersistentStore
    ) { }

    async runAgentLoop(agentId: string, initialInstruction: Instruction): Promise<void> {
        // Agent must be ACTIVE before running
        if (this.lifecycle.getState(agentId) !== 'ACTIVE') {
            throw new Error(`Agent ${agentId} is not ACTIVE`);
        }

        const telemetry = TelemetryProvider.getInstance();
        telemetry.agentSpawnCounter.add(1, { agentId });

        return telemetry.tracer.startActiveSpan(`Scheduler.runAgentLoop [${agentId}]`, async (span) => {
            span.setAttribute('agent.id', agentId);
            span.setAttribute('kernel.mode', this.config.getMode());

            try {
                let sequenceNumber = 1;
                let currentInstruction = initialInstruction;
                let isRunning = true;

                while (isRunning) {
                    this.quotaEnforcer.consumeTick(agentId);

                    const input: TickInput = {
                        agentId,
                        sequenceNumber,
                        instruction: currentInstruction,
                        maxSteps: 100
                    };

                    const output: TickOutput = this.tickEngine.runTick(input);

                    const kernelState = {
                        output,
                        lifecycle: this.lifecycle.getState(agentId),
                        memory: this.persistentStore ? this.persistentStore.snapshot(agentId) : {}
                    };
                    const stateHash = hashState(kernelState);

                    if (this.config.getMode() === 'LIVE') {
                        // Log TICK_OUTPUT
                        this.logger.append({
                            kind: 'TICK_OUTPUT',
                            agentId,
                            timestamp: Date.now(),
                            payload: {
                                sequenceNumber,
                                instruction: currentInstruction,
                                output,
                                stateHash
                            }
                        });
                    } else {
                        // Validate Cryptographic Trace in REPLAY MODE
                        const logs = this.logger.getLogsForAgent(agentId);
                        const targetLog = logs.find(l => l.kind === 'TICK_OUTPUT' && (l.payload as any)?.sequenceNumber === sequenceNumber);

                        if (!targetLog) {
                            throw new Error("REPLAY_MISSING_LOG");
                        }

                        const loggedHash = (targetLog.payload as any).stateHash;
                        if (loggedHash !== stateHash) {
                            throw new Error(`CRYPTOGRAPHIC_DIVERGENCE: Hash mismatch at tick ${sequenceNumber}. Expected ${loggedHash}, got ${stateHash}`);
                        }
                    }

                    switch (output.kind) {
                        case 'COMPLETED':
                            if (this.config.getMode() === 'LIVE') {
                                this.lifecycle.transition(agentId, 'complete'); // ACTIVE -> COMPLETING
                                this.lifecycle.transition(agentId, 'teardown_ok'); // COMPLETING -> TERMINATED
                            } else {
                                // Advance to terminated for local loop control without emitting false transitions safely
                                (this.lifecycle as any).stateMap.set(agentId, 'TERMINATED');
                            }
                            span.setAttribute('loop.exit', 'COMPLETED');
                            isRunning = false;
                            break;

                        case 'FAILED':
                            if (this.config.getMode() === 'LIVE') {
                                this.lifecycle.transition(agentId, 'error'); // ACTIVE -> FAULTED
                            } else {
                                (this.lifecycle as any).stateMap.set(agentId, 'FAULTED');
                            }
                            span.setAttribute('loop.exit', 'FAILED');
                            span.setAttribute('error', true);
                            isRunning = false;
                            break;

                        case 'PENDING_TOOL':
                            this.quotaEnforcer.consumeToolCall(agentId);

                            // FIX: Await the async tool execution
                            const toolResult = await this.toolGate.execute(
                                agentId,
                                sequenceNumber,
                                output.toolName,
                                output.args
                            );

                            currentInstruction = {
                                kind: 'RETURN',
                                value: toolResult
                            };

                            sequenceNumber++;
                            break;

                        case 'PENDING_DELEGATION':
                            if (this.config.getMode() === 'LIVE') {
                                this.lifecycle.transition(agentId, 'yield'); // ACTIVE -> WAITING
                            } else {
                                (this.lifecycle as any).stateMap.set(agentId, 'WAITING');
                            }
                            span.setAttribute('loop.exit', 'DELEGATED');
                            isRunning = false;
                            break;
                    }
                }
            } catch (e: any) {
                if (e.name === 'QuotaExceededError') {
                    if (this.config.getMode() === 'LIVE') {
                        try { this.lifecycle.transition(agentId, 'error'); } catch (_) { }
                    } else {
                        (this.lifecycle as any).stateMap.set(agentId, 'FAULTED');
                    }
                    span.setAttribute('loop.exit', 'QUOTA_EXCEEDED');
                }
                span.recordException(e);
                span.setAttribute('error', true);
                throw e;
            } finally {
                span.end();
            }
        });
    }
}
