import { TickEngine, TickInput, Instruction } from './tick';

function test() {
    const engine = new TickEngine();
    const agentId = "agent-1";
    const seq = 1;

    const run = (instruction: Instruction, maxSteps: number = 10) => {
        return engine.runTick({ agentId, sequenceNumber: seq, instruction, maxSteps });
    };

    console.log("--- Testing NOOP ---");
    console.log(run({ kind: "NOOP" }));

    console.log("\n--- Testing RETURN ---");
    console.log(run({ kind: "RETURN", value: { success: true } }));

    console.log("\n--- Testing CALL_TOOL ---");
    console.log(run({ kind: "CALL_TOOL", toolName: "fs.read", args: { path: "/etc/passwd" } }));

    console.log("\n--- Testing DELEGATE ---");
    console.log(run({ kind: "DELEGATE", target: "child-1", payload: "hello" }));

    console.log("\n--- Testing TICK_OVERFLOW ---");
    console.log(run({ kind: "NOOP" }, 0));

    console.log("\n--- Testing UNKNOWN_INSTRUCTION ---");
    // @ts-ignore
    console.log(run({ kind: "INVALID" }));
}

test();
