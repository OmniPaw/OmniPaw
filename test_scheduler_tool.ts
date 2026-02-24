import { TickEngine } from './execution/tick';
import { ExecutionLogger } from './logging/logger';
import { LifecycleController } from './lifecycle/controller';
import { Scheduler } from './execution/scheduler';
import { KernelConfig } from './kernel/config';
import { ToolGate } from './tools/gate';
import { ReplayController } from './execution/replay-controller';

function runTest() {
    const agentId = 'agent-tool-test';

    // Track handler executions
    let handlerRunCount = 0;
    const handlers = {
        echo: (args: any) => {
            handlerRunCount++;
            return { echoed: args.x };
        }
    };

    const logger = new ExecutionLogger();

    // ==========================================
    // PHASE 1: LIVE MODE
    // ==========================================
    console.log("=== Test 1: Tool Auto Resume (LIVE) ===");
    const liveConfig = new KernelConfig("LIVE");
    const lifecycleLive = new LifecycleController(logger);
    const tickEngine = new TickEngine();
    const liveGate = new ToolGate(logger, liveConfig, handlers);
    const liveScheduler = new Scheduler(tickEngine, logger, lifecycleLive, liveGate);

    // Setup agent
    lifecycleLive.transition(agentId, 'spawn');
    lifecycleLive.transition(agentId, 'activate');

    const initialInstruction = { kind: "CALL_TOOL", toolName: "echo", args: { x: 10 } } as any;

    console.log("Running Scheduler Loop...");
    liveScheduler.runAgentLoop(agentId, initialInstruction);

    console.log("Final State:", lifecycleLive.getState(agentId));
    console.log("Handler Run Count:", handlerRunCount);

    // Verify the logs generated during live run
    console.log("\nGenerated Logs:");
    logger.getLogsForAgent(agentId).forEach(l => {
        if (l.kind === 'TICK_OUTPUT') {
            console.log(`[TICK ${l.busSeq}] SeqNum: ${(l.payload as any).sequenceNumber}, output: ${(l.payload as any).output.kind}`);
        } else if (l.kind === 'TOOL_RESULT') {
            console.log(`[TOOL ${l.busSeq}] Tool: ${(l.payload as any).toolName}, result:`, (l.payload as any).result);
        }
    });


    // ==========================================
    // PHASE 2: REPLAY MODE
    // ==========================================
    console.log("\n=== Test 2: Replay Mode ===");
    const replayConfig = new KernelConfig("REPLAY");
    // CRITICAL: Must use a new LifecycleController but the SAME logger to read history
    const lifecycleReplay = new LifecycleController(logger);
    const replayGate = new ToolGate(logger, replayConfig, handlers);
    const replayScheduler = new Scheduler(tickEngine, logger, lifecycleReplay, replayGate);
    const replayVerifier = new ReplayController(logger, replayConfig);

    // Setup agent for replay (we need to bypass the logger append for these setup steps 
    // since we are just forcing the state back to ACTIVE to re-run the loop, 
    // or we can use a different agent ID if we copy the logs. 
    // For simplicity, we just force the state map).
    (lifecycleReplay as any).stateMap.set(agentId, 'ACTIVE');

    // We need to patch the Scheduler slightly in our test to actually call the ReplayController
    // Since the user spec didn't have us inject ReplayController into Scheduler yet,
    // the Scheduler will just run. But we DO verify that ToolGate doesn't fire the handler.

    const initialHandlerCount = handlerRunCount;

    console.log("Running Scheduler Loop in REPLAY...");
    replayScheduler.runAgentLoop(agentId, initialInstruction);

    console.log("Final State:", lifecycleReplay.getState(agentId));
    console.log("Handler Run Count Changed?:", handlerRunCount !== initialHandlerCount ? "YES (FAIL)" : "NO (PASS)");
    console.log("Total Handler Runs:", handlerRunCount);
}

runTest();
