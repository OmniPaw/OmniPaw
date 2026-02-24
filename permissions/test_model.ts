import { PermissionModel } from './model';
import { PermissionGrant, Policy } from './types';
import { ExecutionLogger } from '../logging/logger';

function testPermissions() {
    const agentId = 'agent-perm-test';
    const logger = new ExecutionLogger();
    const permissions = new PermissionModel(logger);

    console.log("=== Test 1: Explicit ALLOW (Basic Grant) ===");
    const grants1: PermissionGrant[] = [
        { action: 'read', resource: 'shared/documents' }
    ];
    const result1 = permissions.evaluate(agentId, 'read', 'shared/documents', grants1, []);
    console.log("Result (expected ALLOW):", result1);

    console.log("\n=== Test 2: Default DENY (No Match) ===");
    const result2 = permissions.evaluate(agentId, 'write', 'shared/documents', grants1, []);
    console.log("Result (expected DENY):", result2);

    console.log("\n=== Test 3: Wildcard Match ===");
    const grants2: PermissionGrant[] = [
        { action: '*', resource: 'shared/*' }
    ];
    const result3 = permissions.evaluate(agentId, 'delete', 'shared/*', grants2, []);
    console.log("Result (expected ALLOW):", result3);

    console.log("\n=== Test 4: Expiration Check ===");
    const grants3: PermissionGrant[] = [
        { action: 'read', resource: 'cache', notAfter: Date.now() - 1000 } // expired 1s ago
    ];
    const result4 = permissions.evaluate(agentId, 'read', 'cache', grants3, []);
    console.log("Result (expected DENY due to expiry):", result4);

    console.log("\n=== Test 5: Policy Escalation ===");
    const policies1: Policy[] = [
        (agId, act, res, gr) => {
            if (res.startsWith('restricted/')) return 'ESCALATE';
            return 'ALLOW';
        }
    ];
    const grants4: PermissionGrant[] = [
        { action: '*', resource: '*' } // superuser grant
    ];
    // Even with wildcard grant, the specific policy escalation triggers
    const result5 = permissions.evaluate(agentId, 'read', 'restricted/data', grants4, policies1);
    console.log("Result (expected ESCALATE):", result5);

    console.log("\n=== Test 6: Explicit DENY Override ===");
    const policies2: Policy[] = [
        (agId, act, res, gr) => 'ESCALATE', // wants to escalate
        (agId, act, res, gr) => 'DENY'      // explicitly denies
    ];
    const result6 = permissions.evaluate(agentId, 'read', 'restricted/data', grants4, policies2);
    console.log("Result (expected DENY overrides ESCALATE):", result6);

    console.log("\n=== Permissions Audit Log ===");
    logger.getLogsForAgent(agentId).forEach(l => {
        if (l.kind === 'PERMISSION_EVALUATION') {
            const p = l.payload as any;
            console.log(`[EVAL] Action: ${p.action}, Resource: ${p.resource} -> ${p.result} ${p.reason ? '(' + p.reason + ')' : ''}`);
        }
    });
}

testPermissions();
