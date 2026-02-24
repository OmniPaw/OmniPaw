import { SharedStore } from './shared';
import { PermissionModel } from '../permissions/model';
import { ExecutionLogger } from '../logging/logger';
import { PermissionGrant, Policy } from '../permissions/types';

function testSharedStore() {
    const logger = new ExecutionLogger();
    const permissions = new PermissionModel(logger);
    const shared = new SharedStore(logger, permissions);

    const agentA = 'agent-admin';
    const agentB = 'agent-guest';
    const namespace = 'global-config';
    const keyNames = 'settings';

    const adminGrants: PermissionGrant[] = [
        { action: '*', resource: '*' } // root access
    ];

    const guestGrants: PermissionGrant[] = [
        { action: 'read', resource: 'shared/global-config/settings' } // read-only on specific key
    ];

    console.log("=== Test 1: Admin Write (ALLOW) ===");
    try {
        shared.write(agentA, namespace, keyNames, { maxWorkers: 5 }, 'tx-001', adminGrants, []);
        console.log("Admin Write: SUCCESS");
    } catch (e: any) {
        console.log("Admin Write: FAIL", e.message);
    }

    console.log("\n=== Test 2: Guest Read (ALLOW) ===");
    try {
        const data = shared.read(agentB, namespace, keyNames, guestGrants, []);
        console.log("Guest Read: SUCCESS ->", data);
    } catch (e: any) {
        console.log("Guest Read: FAIL", e.message);
    }

    console.log("\n=== Test 3: Guest Write (DENY) ===");
    try {
        shared.write(agentB, namespace, 'settings', { maxWorkers: 99 }, 'tx-002', guestGrants, []);
        console.log("Guest Write: FAILED TO BLOCK");
    } catch (e: any) {
        console.log("Guest Write: SUCCESSFULLY BLOCKED ->", e.message);
    }

    console.log("\n=== Test 4: Admin Read (ALLOW + WAL Check) ===");
    shared.read(agentA, namespace, keyNames, adminGrants, []);

    console.log("\n--- Execution Logger Audit ---");
    logger.getLogsForAgent(agentB).forEach(l => console.log(`[B] ${l.kind}`));
    logger.getLogsForAgent(agentA).forEach(l => console.log(`[A] ${l.kind}`));
}

testSharedStore();
