import { FailureHandler, ILifecycleController } from './handler';
import { FailureEvent } from './types';
import { ExecutionLogger } from '../logging/logger';
import { DelegationProtocol } from '../delegation/protocol';

class MockLifecycle implements ILifecycleController {
    states: Record<string, string> = {};
    transition(agentId: string, state: 'FAULTED' | 'TERMINATED'): void {
        this.states[agentId] = state;
        console.log(`[Lifecycle] Agent ${agentId} transitioned to ${state}`);
    }
}

function testFailureHandler() {
    const logger = new ExecutionLogger();
    const lifecycle = new MockLifecycle();
    const delegation = new DelegationProtocol(logger);

    // Create a root and child agent mapping
    delegation.initRoot('root-agent', [{ action: '*', resource: '*' }]);
    delegation.delegate({
        requestId: 'req-01',
        parentAgentId: 'root-agent',
        taskSpec: { instruction: 'noop' },
        grantSubset: [{ action: '*', resource: '*' }],
        maxDepth: 1,
        ttl: Date.now() + 100000
    });

    // This will be child-root-agent-1 based on my counter mapping internally
    const childToken = delegation.getToken('child-root-agent-1') || delegation.getToken('child-root-agent-2'); // fallback for IDs
    const childId = childToken ? childToken.childAgentId : 'child-root-agent-1';

    const handler = new FailureHandler(logger, lifecycle, delegation, 2); // maxRetries = 2

    console.log("=== Test 1: Transient Retry Limits ===");
    const transientEvent: FailureEvent = {
        agentId: 'agent-1',
        tickSeq: 5,
        class: 'TRANSIENT',
        code: 'TIMEOUT',
        message: 'Network lag',
        context: {},
        timestamp: Date.now()
    };

    console.log("Attempt 1:"); handler.handle(transientEvent);
    console.log("Attempt 2:"); handler.handle(transientEvent);
    console.log("Attempt 3 (Exhaust -> PERMANENT):"); handler.handle(transientEvent);

    console.log("\n=== Test 2: Policy Violation ===");
    handler.handle({
        ...transientEvent,
        class: 'POLICY_VIOLATION',
        code: 'DENIED',
        message: 'Write blocked'
    });
    console.log(`Lifecycle for agent-1 (expected undefined/ACTIVE): ${lifecycle.states['agent-1']}`);

    console.log("\n=== Test 3: INVARIANT BREACH Kernel Panic ===");
    console.log(`Child Token Revoked (Before): ${delegation.getToken(childId)?.revoked}`);

    handler.handle({
        agentId: 'root-agent',
        tickSeq: 99,
        class: 'INVARIANT_BREACH',
        code: 'INV-02-FAILED',
        message: 'Attempted to read closed memory node maliciously',
        context: {},
        timestamp: Date.now()
    });

    console.log(`Lifecycle for root-agent: ${lifecycle.states['root-agent']}`);
    console.log(`Child Token Revoked (After Cascade): ${delegation.getToken(childId)?.revoked}`);
}

testFailureHandler();
