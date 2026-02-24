import { ToolGate } from './gate';
import { ExecutionLogger } from '../logging/logger';
import { KernelConfig } from '../kernel/config';

function testToolGate() {
    const logger = new ExecutionLogger();

    // Handlers definition
    let executionCount = 0;
    const handlers = {
        testTool: (args: any) => {
            executionCount++;
            return { success: true, echoed_args: args };
        }
    };

    const agentId = "agent-x";
    const seqNum = 1;

    // --- PHASE 1: LIVE ---
    console.log("=== PHASE 1: LIVE ===");
    const liveConfig = new KernelConfig("LIVE");
    const liveGate = new ToolGate(logger, liveConfig, handlers);

    try {
        const result = liveGate.execute(agentId, seqNum, "testTool", { myArg: 123 });
        console.log("LIVE execution result:", result);
        console.log("Handler run count:", executionCount); // should be 1
    } catch (e: any) {
        console.log("LIVE failed:", e.message);
    }

    // --- PHASE 2: MISSING TOOL (LIVE) ---
    console.log("\n=== PHASE 2: MISSING TOOL (LIVE) ===");
    try {
        liveGate.execute(agentId, seqNum + 1, "badTool", {});
        console.log("MISSING TOOL: FAILED (did not throw)");
    } catch (e: any) {
        if (e.message === "TOOL_NOT_FOUND") console.log("MISSING TOOL: OK (Caught TOOL_NOT_FOUND)");
        else console.log("MISSING TOOL: FAIL", e.message);
    }

    // --- PHASE 3: REPLAY (SUCCESS) ---
    console.log("\n=== PHASE 3: REPLAY (SUCCESS) ===");
    const replayConfig = new KernelConfig("REPLAY");
    const replayGate = new ToolGate(logger, replayConfig, handlers);

    try {
        // Should return result without hitting handler
        const replayResult = replayGate.execute(agentId, seqNum, "testTool", { myArg: 123 });
        console.log("REPLAY execution result:", replayResult);
        console.log("Handler run count:", executionCount); // should STILL be 1
    } catch (e: any) {
        console.log("REPLAY failed:", e.message);
    }

    // --- PHASE 4: REPLAY (MISSING LOG) ---
    console.log("\n=== PHASE 4: REPLAY (MISSING LOG) ===");
    try {
        replayGate.execute(agentId, seqNum + 10, "testTool", {});
        console.log("REPLAY MISSING LOG: FAILED (did not throw)");
    } catch (e: any) {
        if (e.message === "REPLAY_MISSING_TOOL_RESULT") console.log("REPLAY MISSING LOG: OK (Caught expected)");
        else console.log("REPLAY MISSING LOG: FAIL", e.message);
    }
}

testToolGate();
