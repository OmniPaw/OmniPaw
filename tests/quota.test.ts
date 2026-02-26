import { Scheduler } from '../execution/scheduler';
import { TickEngine, Instruction } from '../execution/tick';
import { ExecutionLogger } from '../logging/logger';
import { LifecycleController } from '../lifecycle/controller';
import { ToolGate } from '../tools/gate';
import { KernelConfig } from '../kernel/config';
import { QuotaExceededError } from '../execution/quota';

describe('Resource Quotas & Rate Limiting', () => {
    let tickEngine: TickEngine;
    let logger: ExecutionLogger;
    let lifecycle: LifecycleController;
    let toolGate: ToolGate;
    let config: KernelConfig;
    let scheduler: Scheduler;

    beforeEach(() => {
        tickEngine = new TickEngine();
        logger = new ExecutionLogger();
        lifecycle = new LifecycleController(logger);
        config = new KernelConfig('LIVE'); // Live mode to bypass replay log verification
        toolGate = new ToolGate(logger, config, {
            'test.tool': async () => 'data'
        });
        scheduler = new Scheduler(tickEngine, logger, lifecycle, toolGate, config);
    });

    it('enforces tick maximum quotas', async () => {
        const agentId = 'quota-agent-1';
        (lifecycle as any).stateMap.set(agentId, 'ACTIVE');

        // Set quota of 2 ticks max
        scheduler.quotaEnforcer.setQuota(agentId, { maxTicks: 2, maxToolCalls: 10 });

        // First tick: calls a tool (Tick 1) -> Returns PENDING_TOOL, then executes tool -> Returns RETURN (Tick 2) -> COMPLETED
        // Actually, if it's just 'CALL_TOOL', `TickEngine` will return PENDING_TOOL, then Scheduler invokes ToolGate and yields RETURN for next instruction
        // Wait, loop:
        // Tick 1: Instruction 'CALL_TOOL'. `runTick` -> result PENDING_TOOL. toolGate executes. instruction = RETURN. sequence_num = 2.
        // Tick 2: Instruction 'RETURN'. `runTick` -> result COMPLETED. Loop breaks.
        // This is exactly 2 ticks, which is within the quota.

        // But we want to trigger QuotaExceededError. Let's provide an infinite loop instruction or sequence.
        // For a test, we can mock `tickEngine.runTick` or just run an instruction that generates PENDING_TOOL continuously.
        const mockTick = jest.spyOn(tickEngine, 'runTick');
        mockTick.mockImplementation((input) => {
            // Keep returning PENDING_TOOL but an unknown one so it fails, or just mock it to return NOOP logic infinitely
            // Wait, Scheduler breaks on COMPLETED, FAILED, PENDING_DELEGATION.
            return { kind: 'PENDING_TOOL', toolName: 'test.tool', args: {} } as any;
        });

        // The mock will run Tick 1 (PENDING_TOOL), Tick 2 (PENDING_TOOL), Tick 3 (PENDING_TOOL) -> BOOM.
        const initialInstruction: Instruction = { kind: 'NOOP' };

        await expect(scheduler.runAgentLoop(agentId, initialInstruction)).rejects.toThrow(QuotaExceededError);

        const stateMap = (lifecycle as any).stateMap;
        expect(stateMap.get(agentId)).toBe('FAULTED');

        const usage = scheduler.quotaEnforcer.getUsage(agentId);
        expect(usage.ticks).toBe(3); // Throws on 3rd attempt
    });

    it('enforces tool call maximum quotas', async () => {
        const agentId = 'quota-agent-2';
        (lifecycle as any).stateMap.set(agentId, 'ACTIVE');

        // Set quota of 1 tool call max, many ticks
        scheduler.quotaEnforcer.setQuota(agentId, { maxTicks: 20, maxToolCalls: 1 });

        const mockTick = jest.spyOn(tickEngine, 'runTick');
        mockTick.mockImplementation((input) => {
            return { kind: 'PENDING_TOOL', toolName: 'test.tool', args: {} } as any;
        });

        const initialInstruction: Instruction = { kind: 'NOOP' };

        await expect(scheduler.runAgentLoop(agentId, initialInstruction)).rejects.toThrow(QuotaExceededError);

        const stateMap = (lifecycle as any).stateMap;
        expect(stateMap.get(agentId)).toBe('FAULTED');

        const usage = scheduler.quotaEnforcer.getUsage(agentId);
        expect(usage.toolCalls).toBe(2); // Second tool call triggers error
    });

    it('allows execution if quota is not reached', async () => {
        const agentId = 'quota-agent-3';
        (lifecycle as any).stateMap.set(agentId, 'ACTIVE');

        scheduler.quotaEnforcer.setQuota(agentId, { maxTicks: 5, maxToolCalls: 5 });

        // NOOP resolves locally in TickEngine to COMPLETED
        const initialInstruction: Instruction = { kind: 'NOOP' };

        await scheduler.runAgentLoop(agentId, initialInstruction);

        const stateMap = (lifecycle as any).stateMap;
        expect(stateMap.get(agentId)).toBe('TERMINATED'); // Replay mode successful completion advances to TERMINATED directly via hack or COMPLETES it.

        const usage = scheduler.quotaEnforcer.getUsage(agentId);
        expect(usage.ticks).toBe(1);
        expect(usage.toolCalls).toBe(0);
    });
});
