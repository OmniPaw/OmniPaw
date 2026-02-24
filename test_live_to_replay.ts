import { TickEngine } from './execution/tick';
import { ExecutionLogger } from './logging/logger';
import { LifecycleController } from './lifecycle/controller';
import { Scheduler } from './execution/scheduler';
import { KernelConfig } from './kernel/config';
import { ReplayController } from './execution/replay-controller';

function runTest() {
    const agentId = 'agent-replay-test';

    // ==========================================
    // PHASE 1: LIVE MODE
    // ==========================================
    console.log("=== PHASE 1: LIVE MODE ===");
    const liveConfig = new KernelConfig("LIVE");
    const logger = new ExecutionLogger();
    const lifecycle = new LifecycleController(logger);
    const tickEngine = new TickEngine();
    const replayController = new ReplayController(logger, liveConfig);
    const scheduler = new Scheduler(tickEngine, logger, lifecycle);

    lifecycle.transition(agentId, 'spawn');
    lifecycle.transition(agentId, 'activate');

    const instruction = { kind: 'RETURN', value: { computed: 42 } } as any;

    // Note: We'd normally let the scheduler run, but the scheduler doesn't invoke
    // replayController yet since we haven't integrated it into runAgentLoop.
    // We'll simulate the scheduler's behavior to test ReplayController explicitly.

    const tickInput = { agentId, sequenceNumber: 1, maxSteps: 10, instruction };
    const tickOutput = tickEngine.runTick(tickInput);

    console.log("LIVE Tick Output:", tickOutput);

    logger.append({
        kind: 'TICK_OUTPUT',
        agentId,
        timestamp: Date.now(),
        payload: { sequenceNumber: 1, instruction, output: tickOutput }
    });

    // Verify in LIVE mode (should do nothing, pass silently)
    replayController.verifyTick(agentId, 1, tickOutput);
    console.log("LIVE Verify: Over (did not throw)");

    // ==========================================
    // PHASE 2: REPLAY MODE
    // ==========================================
    console.log("\n=== PHASE 2: REPLAY MODE ===");
    // Re-use the exact same logger (to read the history)
    const replayConfig = new KernelConfig("REPLAY");
    const replayVerifier = new ReplayController(logger, replayConfig);

    console.log("Re-running same instruction...");
    const replayOutput = tickEngine.runTick(tickInput);

    try {
        replayVerifier.verifyTick(agentId, 1, replayOutput);
        console.log("REPLAY Verification: PASS (Outputs match!)");
    } catch (e: any) {
        console.log("REPLAY Verification: FAIL", e.message);
    }

    // ==========================================
    // PHASE 3: DIVERGENCE TEST
    // ==========================================
    console.log("\n=== PHASE 3: DIVERGENCE TEST ===");
    const badInstruction = { kind: 'RETURN', value: { computed: 99 } } as any;
    const badOutput = tickEngine.runTick({ ...tickInput, instruction: badInstruction });

    try {
        console.log("Verifying divergent output...");
        replayVerifier.verifyTick(agentId, 1, badOutput);
        console.log("REPLAY DIVERGENCE: FAIL (Did not catch mismatch)");
    } catch (e: any) {
        if (e.message === 'REPLAY_DIVERGENCE') {
            console.log("REPLAY DIVERGENCE: PASS (Caught mismatch!)");
        } else {
            console.log("REPLAY DIVERGENCE: FAIL (Wrong error)", e.message);
        }
    }
}

runTest();
