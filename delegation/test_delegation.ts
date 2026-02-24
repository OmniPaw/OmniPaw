import { DelegationProtocol } from './protocol';
import { DelegationRequest } from './types';
import { ExecutionLogger } from '../logging/logger';
import { PermissionGrant } from '../permissions/types';

function testDelegation() {
    const logger = new ExecutionLogger();
    const protocol = new DelegationProtocol(logger);

    console.log("=== Setup Root Agent ===");
    const rootGrants: PermissionGrant[] = [
        { action: '*', resource: '*' }
    ];
    protocol.initRoot('root-agent', rootGrants);
    console.log("Root Token Grants:", protocol.getToken('root-agent')?.grants);

    console.log("\n=== Test 1: Valid Delegation ===");
    const req1: DelegationRequest = {
        requestId: 'req-01',
        parentAgentId: 'root-agent',
        taskSpec: { instruction: 'Read logs' },
        grantSubset: [{ action: 'read', resource: 'logs' }],
        maxDepth: 5,
        ttl: Date.now() + 10000
    };

    const res1 = protocol.delegate(req1);
    console.log("Delegation Result:", res1.kind);

    if (res1.kind === 'ACCEPTED') {
        const child1Id = res1.childAgentId;
        console.log("Child Agent ID:", child1Id);

        console.log("\n=== Test 2: Invalid Subset Delegation ===");
        // Child 1 tries to delegate 'write' which it doesn't have
        const req2: DelegationRequest = {
            requestId: 'req-02',
            parentAgentId: child1Id,
            taskSpec: { instruction: 'Write logs' },
            grantSubset: [{ action: 'write', resource: 'logs' }],
            maxDepth: 1,
            ttl: Date.now() + 5000
        };

        const res2 = protocol.delegate(req2);
        console.log("Delegation 2 Result (expected REJECTED):", res2.kind);
        if (res2.kind === 'REJECTED') console.log("Reason:", res2.reason);

        console.log("\n=== Test 3: Valid Child Delegation ===");
        const req3: DelegationRequest = {
            requestId: 'req-03',
            parentAgentId: child1Id,
            taskSpec: { instruction: 'Read specific log' },
            grantSubset: [{ action: 'read', resource: 'logs/specific' }], // subset of 'read logs'
            maxDepth: 1,
            ttl: Date.now() + 5000
        };
        const res3 = protocol.delegate(req3);
        console.log("Delegation 3 Result:", res3.kind);

        if (res3.kind === 'ACCEPTED') {
            console.log("\n=== Test 4: Revocation Cascade ===");
            protocol.revoke('root-agent');
            console.log("Root Revoked:", protocol.getToken('root-agent')?.revoked);
            console.log("Child 1 Revoked:", protocol.getToken(child1Id)?.revoked);
            console.log("Child 2 Revoked:", protocol.getToken(res3.childAgentId)?.revoked);
        }
    }
}

testDelegation();
