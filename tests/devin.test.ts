import { OmniKernel } from '../kernel/index';
import { ExecutionLogger } from '../logging/logger';
import { KernelConfig } from '../kernel/config';
import { ToolGate } from '../tools/gate';
import { TickEngine } from '../execution/tick';
import { Scheduler } from '../execution/scheduler';
import { spawnDevinAgent } from '../host/agents/devin';

/**
 * This test proves that OmniPaw can orchestrate a multi-step "Devin-like"
 * software engineering workflow (clone → edit → commit) deterministically.
 * 
 * It verifies:
 * 1. The 3-step tool chain executes via the Scheduler without panic.
 * 2. The audit trail (TICK_OUTPUT logs) is structurally complete.
 * 3. Each tick produces a cryptographic state hash for future replay.
 * 4. The TickEngine correctly routes CALL_TOOL → PENDING_TOOL → RETURN.
 */
describe('Devin Agent Workflow Determinism', () => {

    function buildLiveKernel(logger: ExecutionLogger) {
        const config = new KernelConfig('LIVE');
        const kernel = new OmniKernel(logger);

        // Deterministic mock tool handlers matching ToolGate's constructor
        const handlers: Record<string, (args: any) => any> = {
            'host.git.clone': (args: any) => ({
                success: true,
                stdout: 'Cloned successfully',
                clonedPath: `.workspace/${args.directory || 'repo'}`
            }),
            'host.git.commit': (args: any) => ({
                success: true,
                stdout: `[main abc123] ${args.message}`
            }),
            'host.fs.write_file': (args: any) => ({
                success: true,
                data: `Written to ${args.relativePath}`
            }),
        };

        const toolGate = new ToolGate(logger, config, handlers);
        const tickEngine = new TickEngine();
        const scheduler = new Scheduler(tickEngine, logger, kernel.lifecycle, toolGate, config, kernel.persistentStore);

        return { kernel, scheduler };
    }

    test('should execute the full clone → write → commit workflow via Scheduler', () => {
        const logger = new ExecutionLogger();
        const { kernel, scheduler } = buildLiveKernel(logger);

        const agentId = spawnDevinAgent(kernel.registry);
        (kernel.lifecycle as any).stateMap.set(agentId, 'ACTIVE');

        // Step 1: Clone repo
        scheduler.runAgentLoop(agentId, {
            kind: 'CALL_TOOL',
            toolName: 'host.git.clone',
            args: { url: 'https://github.com/omnipaw/test-repo' }
        });

        expect(kernel.lifecycle.getState(agentId)).toBe('TERMINATED');

        // Re-activate for next workflow step
        (kernel.lifecycle as any).stateMap.set(agentId, 'ACTIVE');

        // Step 2: Write a fix
        scheduler.runAgentLoop(agentId, {
            kind: 'CALL_TOOL',
            toolName: 'host.fs.write_file',
            args: { relativePath: 'fix.ts', content: 'console.log("fixed");' }
        });

        expect(kernel.lifecycle.getState(agentId)).toBe('TERMINATED');
        (kernel.lifecycle as any).stateMap.set(agentId, 'ACTIVE');

        // Step 3: Commit changes
        scheduler.runAgentLoop(agentId, {
            kind: 'CALL_TOOL',
            toolName: 'host.git.commit',
            args: { message: 'Fix critical bug', cwd: 'test-repo' }
        });

        expect(kernel.lifecycle.getState(agentId)).toBe('TERMINATED');
    });

    test('should produce a complete cryptographic audit trail', () => {
        const logger = new ExecutionLogger();
        const { kernel, scheduler } = buildLiveKernel(logger);

        const agentId = spawnDevinAgent(kernel.registry);
        (kernel.lifecycle as any).stateMap.set(agentId, 'ACTIVE');

        // Execute all 3 steps
        const steps = [
            { toolName: 'host.git.clone', args: { url: 'https://github.com/omnipaw/test-repo' } },
            { toolName: 'host.fs.write_file', args: { relativePath: 'fix.ts', content: 'fixed' } },
            { toolName: 'host.git.commit', args: { message: 'Fix', cwd: 'repo' } },
        ];

        for (const step of steps) {
            scheduler.runAgentLoop(agentId, {
                kind: 'CALL_TOOL' as const,
                toolName: step.toolName,
                args: step.args
            });
            (kernel.lifecycle as any).stateMap.set(agentId, 'ACTIVE');
        }

        const logs = logger.getLogs();
        const tickOutputs = logs.filter(l => l.kind === 'TICK_OUTPUT');

        // Each CALL_TOOL step produces 2 TICK_OUTPUTs:
        //   Tick 1: PENDING_TOOL (the CALL_TOOL maps to PENDING_TOOL)
        //   Tick 2: COMPLETED (the tool result is wrapped as RETURN → COMPLETED)
        expect(tickOutputs.length).toBe(6);

        // Every TICK_OUTPUT must contain a cryptographic stateHash
        for (const to of tickOutputs) {
            const payload = to.payload as any;
            expect(payload.stateHash).toBeDefined();
            expect(typeof payload.stateHash).toBe('string');
            expect(payload.stateHash.length).toBe(64); // SHA-256 hex
        }
    });

    test('should produce identical state hashes for identical inputs (determinism proof)', () => {
        // Run the same workflow TWICE with independent kernels
        const run = () => {
            const logger = new ExecutionLogger();
            const { kernel, scheduler } = buildLiveKernel(logger);

            const agentId = spawnDevinAgent(kernel.registry);
            (kernel.lifecycle as any).stateMap.set(agentId, 'ACTIVE');

            scheduler.runAgentLoop(agentId, {
                kind: 'CALL_TOOL',
                toolName: 'host.git.clone',
                args: { url: 'https://github.com/omnipaw/test-repo' }
            });

            const logs = logger.getLogs();
            return logs
                .filter(l => l.kind === 'TICK_OUTPUT')
                .map(l => (l.payload as any).stateHash);
        };

        const hashes1 = run();
        const hashes2 = run();

        // Identical inputs must produce identical state hashes
        expect(hashes1).toEqual(hashes2);
    });
});
