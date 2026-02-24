import { Invariants, InvariantError } from './checker';

function testInvariants() {
    const agentId = 'agent-inv-test';
    let passed = 0;

    console.log("=== Test 1: INV-03 Single Tick ===");
    try {
        Invariants.assertSingleTickProcessing(agentId, 1, true);
    } catch (e: any) {
        if (e instanceof InvariantError && e.failureEvent.code === 'INV-03') {
            console.log("PASS: Blocked parallel ticks gracefully.");
            passed++;
        }
    }

    console.log("\n=== Test 2: INV-12 Step Bounding ===");
    try {
        Invariants.assertStepBound(agentId, 2, 101, 100);
    } catch (e: any) {
        if (e.failureEvent.code === 'INV-12') {
            console.log("PASS: Bounded MaxSteps limit at 100 safely.");
            passed++;
        }
    }

    console.log("\n=== Test 3: INV-09 Terminated Zombie Check ===");
    try {
        Invariants.assertAgentNotTerminated(agentId, 3, 'TERMINATED');
    } catch (e: any) {
        if (e.failureEvent.code === 'INV-09') {
            console.log("PASS: Stopped execution run on TERMINATED agent natively.");
            passed++;
        }
    }

    console.log("\n=== Test 4: INV-11 Strict Serializable Scopes ===");
    try {
        // Circular reference which fails JSON stringify
        const a: any = {};
        const b: any = { a };
        a.b = b;

        Invariants.assertSerializable(agentId, 4, a, 'circular-object');
    } catch (e: any) {
        if (e.failureEvent.code === 'INV-11') {
            console.log("PASS: Correctly threw INVARIANT_BREACH on non-serializable object mapping context recursively.");
            passed++;
        }
    }

    console.log(`\nTests Passed: ${passed} / 4`);
}

testInvariants();
